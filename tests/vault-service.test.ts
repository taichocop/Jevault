import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TAbstractFile } from "obsidian";

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

function createService(entries: MockEntry[]): VaultService {
  return new VaultService({
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
    const service = new VaultService({ getAllLoadedFiles });

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
});
