import { describe, expect, it, vi } from "vitest";
import type { TFile, Vault, Workspace } from "obsidian";

import { NoteService } from "../src/note-service";

function createFile(path: string, body: string) {
  const filename = path.slice(path.lastIndexOf("/") + 1);
  const extensionIndex = filename.lastIndexOf(".");
  const extension =
    extensionIndex === -1 ? "" : filename.slice(extensionIndex + 1);
  const basename =
    extensionIndex === -1 ? filename : filename.slice(0, extensionIndex);
  const file = { path, basename, extension } as TFile;
  const read = vi.fn(async () => body);
  const service = new NoteService(
    { getActiveFile: vi.fn(() => file) } as Pick<Workspace, "getActiveFile">,
    { read } as Pick<Vault, "read">,
  );

  return { file, read, service };
}

describe("NoteService", () => {
  it("creates a NoteState from the active Markdown file", async () => {
    const body = "# IAM Role\n\nIAM Role is...";
    const { file, read, service } = createFile("Inbox/IAM Role.md", body);

    await expect(service.getActiveNoteState()).resolves.toEqual({
      status: "ready",
      note: {
        title: "IAM Role",
        path: "Inbox/IAM Role.md",
        body,
      },
    });
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith(file);
  });

  it("keeps a nested Vault-relative path out of the title", async () => {
    const { service } = createFile(
      "programming/aws/S3 Storage Classes.md",
      "Storage classes",
    );

    await expect(service.getActiveNoteState()).resolves.toMatchObject({
      status: "ready",
      note: {
        title: "S3 Storage Classes",
        path: "programming/aws/S3 Storage Classes.md",
      },
    });
  });

  it("preserves Japanese title, path, and body", async () => {
    const body = "# 筋力トレーニング\n\nスクワットを行う。";
    const { service } = createFile("健康/筋力トレーニング.md", body);

    await expect(service.getActiveNoteState()).resolves.toEqual({
      status: "ready",
      note: {
        title: "筋力トレーニング",
        path: "健康/筋力トレーニング.md",
        body,
      },
    });
  });

  it("creates a NoteState for an empty Markdown body", async () => {
    const { service } = createFile("Inbox/Empty.md", "");

    await expect(service.getActiveNoteState()).resolves.toEqual({
      status: "ready",
      note: {
        title: "Empty",
        path: "Inbox/Empty.md",
        body: "",
      },
    });
  });

  it("returns no-active-file without reading when no file is active", async () => {
    const read = vi.fn();
    const service = new NoteService(
      { getActiveFile: vi.fn(() => null) },
      { read } as unknown as Pick<Vault, "read">,
    );

    await expect(service.getActiveNoteState()).resolves.toEqual({
      status: "no-active-file",
    });
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["Attachments/diagram.png", "Documents/reference.pdf"])(
    "returns unsupported-file without reading %s",
    async (path) => {
      const { read, service } = createFile(path, "must not be read");

      await expect(service.getActiveNoteState()).resolves.toEqual({
        status: "unsupported-file",
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
});
