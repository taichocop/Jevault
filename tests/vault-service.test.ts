import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TFolder } from "obsidian";

import { CandidateBuilder } from "../src/classification/candidate-builder";
import { ClassificationService } from "../src/classification/classification-service";
import { fixtureSource } from "./helpers/note-source";

const { MockTFolder } = vi.hoisted(() => {
  class MockTFolder {
    constructor(readonly path: string) {}
  }

  return { MockTFolder };
});

import { DEFAULT_SETTINGS } from "../src/settings";
import {
  normalizeVaultPath,
  VaultService,
} from "../src/vault-service";

function asObsidianFolders(folders: InstanceType<typeof MockTFolder>[]): TFolder[] {
  return folders as unknown as TFolder[];
}

function createService(folders: InstanceType<typeof MockTFolder>[], configDir = ".obsidian"): VaultService {
  return new VaultService({
    configDir,
    getAllFolders: vi.fn(() => asObsidianFolders(folders)),
  });
}

describe("VaultService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the folder-only Vault boundary", () => {
    const folders = [
      new MockTFolder("programming"),
      new MockTFolder("programming/aws"),
    ];
    const getAllFolders = vi.fn(() => asObsidianFolders(folders));
    const service = new VaultService({ configDir: ".obsidian", getAllFolders });

    expect(service.getFolders()).toEqual(folders);
    expect(getAllFolders).toHaveBeenCalledWith(false);
  });

  it("excludes the root folder at the Vault API boundary", () => {
    const root = new MockTFolder("/");
    const projects = new MockTFolder("Projects");
    const getAllFolders = vi.fn((includeRoot = false) =>
      asObsidianFolders(includeRoot ? [root, projects] : [projects]),
    );
    const service = new VaultService({ configDir: ".obsidian", getAllFolders });

    expect(service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] })).toEqual([
      "Projects",
    ]);
    expect(getAllFolders).toHaveBeenCalledWith(false);
  });

  it("keeps distinct nested Vault-relative paths", () => {
    const service = createService([
      new MockTFolder("programming"),
      new MockTFolder("programming/aws"),
      new MockTFolder("programming/ruby"),
    ]);

    expect(
      service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] }),
    ).toEqual(["programming", "programming/aws", "programming/ruby"]);
  });

  it("excludes the default ignored folders and all descendants", () => {
    const service = createService([
      new MockTFolder(".obsidian"),
      new MockTFolder(".obsidian/plugins"),
      new MockTFolder(".trash"),
      new MockTFolder("Templates"),
      new MockTFolder("Templates/snippets"),
      new MockTFolder("Attachments"),
      new MockTFolder("Attachments/images"),
      new MockTFolder("projects"),
    ]);

    expect(service.getAvailableFolderPaths(DEFAULT_SETTINGS)).toEqual([
      "projects",
    ]);
  });

  it("excludes a custom config directory before candidate building", () => {
    const service = createService([
      new MockTFolder(".obsidian-custom"),
      new MockTFolder(".obsidian-custom/plugins"),
      new MockTFolder("Projects"),
    ], ".obsidian-custom");
    const paths = service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] });

    expect(paths).toEqual(["Projects"]);
    expect(new CandidateBuilder().build(paths).map((candidate) => candidate.path)).toEqual([
      "Projects",
    ]);
  });

  it("passes only eligible folder paths to classification", async () => {
    const vaultService = createService([
      new MockTFolder(".obsidian"),
      new MockTFolder(".obsidian-custom"),
      new MockTFolder(".obsidian-custom/plugins"),
      new MockTFolder("Inbox"),
      new MockTFolder("Inbox/Child"),
      new MockTFolder("InboxArchive"),
      new MockTFolder("Templates"),
      new MockTFolder("Programming"),
      new MockTFolder("Programming/AWS"),
      new MockTFolder("健康/運動"),
      new MockTFolder("Projects"),
    ], ".obsidian-custom");
    const classify = vi.fn(async () => ({
      candidates: [{ path: "Projects", probability: 1 }],
    }));
    const service = new ClassificationService(
      { getActiveNoteState: async () => ({
        status: "ready",
        source: fixtureSource(),
        note: { title: "Synthetic", path: "Inbox/Synthetic.md", body: "Fixture" },
      }) },
      vaultService,
      new CandidateBuilder(),
      { getApiKey: () => "fixture-key" },
      () => ({ classify }),
      () => ({
        ...DEFAULT_SETTINGS,
        apiKeySecretName: "fixture-secret",
        ignoredFolders: [".obsidian", "Templates"],
      }),
    );

    const outcome = await service.classifyActiveNote();

    expect(classify).toHaveBeenCalledWith(expect.anything(), [
      { path: "InboxArchive", description: "Existing vault folder: InboxArchive" },
      { path: "Programming", description: "Existing vault folder: Programming" },
      { path: "Programming/AWS", description: "Existing vault folder: Programming/AWS" },
      { path: "健康/運動", description: "Existing vault folder: 健康/運動" },
      { path: "Projects", description: "Existing vault folder: Projects" },
    ], undefined);
    expect(outcome.result.candidates.map((candidate) => candidate.path)).toEqual([
      "Projects",
    ]);
  });

  it("excludes conventional config folders even without an ignored setting", () => {
    const service = createService([
      new MockTFolder(".obsidian"),
      new MockTFolder(".obsidian/themes"),
      new MockTFolder("Projects"),
    ]);

    expect(service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] })).toEqual([
      "Projects",
    ]);
  });

  it("preserves persisted .obsidian and excludes the actual custom config directory", () => {
    const service = createService([
      new MockTFolder(".obsidian"),
      new MockTFolder(".obsidian/plugins"),
      new MockTFolder(".obsidian-custom"),
      new MockTFolder(".obsidian-custom/plugins"),
      new MockTFolder("Projects"),
    ], ".obsidian-custom");

    expect(service.getAvailableFolderPaths({
      inboxPath: "",
      ignoredFolders: [".obsidian"],
    })).toEqual(["Projects"]);
  });

  it("does not exclude a folder sharing only the config directory prefix", () => {
    const service = createService([
      new MockTFolder(".obsidian"),
      new MockTFolder(".obsidian-backup"),
      new MockTFolder(".obsidian-old"),
    ]);

    expect(service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] })).toEqual([
      ".obsidian-backup",
      ".obsidian-old",
    ]);
  });

  it("normalizes a nested config directory without excluding sibling paths", () => {
    const service = createService([
      new MockTFolder("Config"),
      new MockTFolder("Config/obsidian"),
      new MockTFolder("Config/obsidian/plugins"),
      new MockTFolder("Config/obsidian-backup"),
    ], "/Config/obsidian/");

    expect(service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] })).toEqual([
      "Config",
      "Config/obsidian-backup",
    ]);
  });

  it("excludes Inbox and its descendants without requiring a duplicate ignored entry", () => {
    const service = createService([
      new MockTFolder("Inbox"),
      new MockTFolder("Inbox/drafts"),
      new MockTFolder("notes"),
    ]);

    expect(
      service.getAvailableFolderPaths({
        inboxPath: "Inbox",
        ignoredFolders: [],
      }),
    ).toEqual(["notes"]);
  });

  it("does not exclude folders that only share a text prefix", () => {
    const service = createService([
      new MockTFolder("InboxArchive"),
      new MockTFolder("TemplatesOld"),
    ]);

    expect(service.getAvailableFolderPaths(DEFAULT_SETTINGS)).toEqual([
      "InboxArchive",
      "TemplatesOld",
    ]);
  });

  it("normalizes root-relative and trailing slashes before exclusion", () => {
    const service = createService([
      new MockTFolder("/Templates/"),
      new MockTFolder("/Templates/snippets/"),
      new MockTFolder("/notes/"),
    ]);

    expect(
      service.getAvailableFolderPaths({
        inboxPath: "",
        ignoredFolders: ["/Templates/"],
      }),
    ).toEqual(["notes"]);
    expect(normalizeVaultPath("Templates/")).toBe("Templates");
  });

  it("preserves Japanese folder paths", () => {
    const service = createService([
      new MockTFolder("健康"),
      new MockTFolder("健康/運動"),
      new MockTFolder("プログラミング/Ruby"),
    ]);

    expect(
      service.getAvailableFolderPaths({ inboxPath: "", ignoredFolders: [] }),
    ).toEqual(["健康", "健康/運動", "プログラミング/Ruby"]);
  });

  it("ignores empty and whitespace-only exclusions", () => {
    const service = createService([
      new MockTFolder("Inbox"),
      new MockTFolder("projects"),
    ]);

    expect(
      service.getAvailableFolderPaths({
        inboxPath: "",
        ignoredFolders: ["", "   "],
      }),
    ).toEqual(["Inbox", "projects"]);
  });

  it("returns an empty list safely when no destination folders are available", () => {
    const service = createService([new MockTFolder("Inbox")]);

    expect(
      service.getAvailableFolderPaths({
        inboxPath: "Inbox",
        ignoredFolders: [],
      }),
    ).toEqual([]);
  });

  it("feeds only available Vault paths into CandidateBuilder", () => {
    const service = createService([
      new MockTFolder("Inbox"),
      new MockTFolder("Inbox/drafts"),
      new MockTFolder("programming"),
      new MockTFolder("programming/aws"),
      new MockTFolder("programming/ruby"),
      new MockTFolder("Templates"),
      new MockTFolder("Attachments"),
      new MockTFolder("health/fitness"),
    ]);
    const paths = service.getAvailableFolderPaths({
      inboxPath: "Inbox",
      ignoredFolders: ["Templates", "Attachments"],
    });

    expect(new CandidateBuilder().build(paths)).toEqual([
      {
        path: "programming",
        description: "Existing vault folder: programming",
      },
      {
        path: "programming/aws",
        description: "Existing vault folder: programming/aws",
      },
      {
        path: "programming/ruby",
        description: "Existing vault folder: programming/ruby",
      },
      {
        path: "health/fitness",
        description: "Existing vault folder: health/fitness",
      },
    ]);
  });
});
