import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TAbstractFile } from "obsidian";

import { CandidateBuilder } from "../src/classification/candidate-builder";
import { ClassificationService } from "../src/classification/classification-service";
import { fixtureSource } from "./helpers/note-source";

const { MockTFile, MockTFolder } = vi.hoisted(() => {
  class MockTFile {
    constructor(readonly path: string) {}
  }

  class MockTFolder {
    constructor(readonly path: string) {}
  }

  return { MockTFile, MockTFolder };
});

vi.mock("obsidian", () => ({ TFolder: MockTFolder }));

import { DEFAULT_SETTINGS } from "../src/settings";
import {
  normalizeVaultPath,
  VaultService,
} from "../src/vault-service";

type MockEntry =
  | InstanceType<typeof MockTFile>
  | InstanceType<typeof MockTFolder>;

function asObsidianEntries(entries: MockEntry[]): TAbstractFile[] {
  return entries as unknown as TAbstractFile[];
}

function createService(entries: MockEntry[], configDir = ".obsidian"): VaultService {
  return new VaultService({
    configDir,
    getAllLoadedFiles: vi.fn(() => asObsidianEntries(entries)),
  });
}

describe("VaultService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses loaded Vault entries and returns only TFolder instances", () => {
    const folders = [
      new MockTFolder("programming"),
      new MockTFolder("programming/aws"),
    ];
    const getAllLoadedFiles = vi.fn(() =>
      asObsidianEntries([new MockTFile("Inbox/note.md"), ...folders]),
    );
    const service = new VaultService({ configDir: ".obsidian", getAllLoadedFiles });

    expect(service.getFolders()).toEqual(folders);
    expect(getAllLoadedFiles).toHaveBeenCalledOnce();
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

  it("keeps the actual config directory out of classifier input and suggestions", async () => {
    const vaultService = createService([
      new MockTFolder(".obsidian-custom"),
      new MockTFolder(".obsidian-custom/plugins"),
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
        ignoredFolders: [],
      }),
    );

    const outcome = await service.classifyActiveNote();

    expect(classify).toHaveBeenCalledWith(expect.anything(), [
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
