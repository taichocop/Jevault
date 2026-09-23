import type { App, TAbstractFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => import("./helpers/obsidian-move"));

import { NoteSource } from "../src/note-source";
import { NoteService } from "../src/note-service";
import { NoteMoveService, createMovePlan, MOVE_MESSAGES } from "../src/note-move-service";
import { ClassificationService } from "../src/classification/classification-service";
import { CandidateBuilder } from "../src/classification/candidate-builder";
import { ClassificationCommand } from "../src/suggestion/classification-command";
import { SuggestionSession } from "../src/suggestion/suggestion-session";
import { SuggestionModal } from "../src/suggestion/suggestion-modal";
import { DEFAULT_SETTINGS } from "../src/settings";
import * as fake from "./helpers/obsidian-move";
import type { TFile } from "obsidian";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 10; i += 1) await Promise.resolve(); }
function setup(sourcePath = "Inbox/ノート.MD") {
  const file = new fake.TFile(sourcePath) as unknown as TFile;
  const other = new fake.TFile("Inbox/Other.md") as unknown as TFile;
  const source = new NoteSource(file);
  const folders = ["Research/日本語", "Projects", "Archive"].map((path) => new fake.TFolder(path));
  const entries = new Map<string, unknown>([[file.path, file], [other.path, other], ...folders.map((f) => [f.path, f] as [string, unknown])]);
  const getAbstractFileByPath = vi.fn((path: string) => (entries.get(path) ?? null) as TAbstractFile | null);
  const renameFile = vi.fn<(file: TAbstractFile, path: string) => Promise<void>>(async () => {});
  const service = new NoteMoveService({ getAbstractFileByPath }, { renameFile });
  const outcome = {
    status: "success" as const, noteTitle: file.basename, source,
    result: { candidates: folders.map(({ path }, index) => ({ path, probability: 0.8 - index * 0.3 })) },
  };
  const owner = new AbortController();
  const session = new SuggestionSession(outcome, service);
  const notify = vi.fn();
  const modal = new SuggestionModal({} as App, session, notify, owner.signal);
  const dom = modal.contentEl as unknown as fake.Element;
  const scope = modal.scope as unknown as fake.Modal["scope"];
  const button = (text: string) => {
    const result = dom.all().find((el) => el.tag === "button" && el.text.startsWith(text));
    if (!result) throw new Error(`Missing button: ${text}`);
    return result;
  };
  return { file, other, source, folders, entries, getAbstractFileByPath, renameFile, service, outcome, owner, session, notify, modal, dom, scope, button };
}

describe("suggestion selection and explicit confirmation", () => {
  it.each(["click", "number"])("%s selects the same second candidate without mutation", (method) => {
    const s = setup(); s.modal.open();
    expect(s.button("[2]").text).toContain("Projects");
    if (method === "click") s.button("[2]").click(); else s.scope.press("2");
    expect(s.session.confirmation).toEqual({ sourcePath: s.file.path, destination: "Projects", targetPath: "Projects/ノート.MD" });
    expect(s.dom.all().map((e) => e.text)).toEqual(expect.arrayContaining([
      `Source: ${s.file.path}`, "Destination folder: Projects", "Target: Projects/ノート.MD",
    ]));
    expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["4", "9", "0", "Enter"])("ignores %s before selection", (key) => {
    const s = setup(); s.modal.open(); s.scope.press(key);
    expect(s.session.confirmation).toBeNull(); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["repeat", "altKey", "ctrlKey", "metaKey", "shiftKey", "isComposing"])("ignores %s keys", (flag) => {
    const s = setup(); s.modal.open(); s.scope.press("2", { [flag]: true });
    expect(s.session.confirmation).toBeNull(); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["input", "textarea", "select", "contenteditable"])("ignores editable focus: %s", (tag) => {
    const s = setup(); s.modal.open(); const input = s.dom.createEl(tag); input.editable = true; input.focus();
    s.scope.press("2"); expect(s.session.confirmation).toBeNull();
  });
  it("supports keys through nine and keeps further candidates clickable", () => {
    const s = setup();
    const candidates = Array.from({ length: 10 }, (_, i) => ({ path: `Folder${i + 1}`, probability: 0.1 }));
    const session = new SuggestionSession({ ...s.outcome, result: { candidates } }, s.service);
    const modal = new SuggestionModal({} as App, session, s.notify, s.owner.signal);
    modal.open();
    const scope = modal.scope as unknown as fake.Modal["scope"];
    expect(scope.handlers.has("9")).toBe(true);
    expect(scope.handlers.has("0")).toBe(false);
    const dom = modal.contentEl as unknown as fake.Element;
    dom.all().find((el) => el.tag === "button" && el.text.startsWith("Folder10"))!.click();
    expect(session.confirmation?.destination).toBe("Folder10");
    expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["source-changed", "destination-missing", "collision", "already-in-folder", "unexpected"] as const)(
    "presents safe %s feedback and consumes the confirmation", async (reason) => {
      const s = setup();
      const move = vi.fn(async () => ({ status: "failure" as const, reason }));
      const session = new SuggestionSession(s.outcome, { move });
      const modal = new SuggestionModal({} as App, session, s.notify, s.owner.signal);
      modal.open();
      const scope = modal.scope as unknown as fake.Modal["scope"];
      scope.press("1"); scope.press("Enter"); await flush();
      expect(s.notify).toHaveBeenCalledExactlyOnceWith(MOVE_MESSAGES[reason]);
      expect(session.closed).toBe(true);
      await session.confirm(); expect(move).toHaveBeenCalledOnce();
    },
  );
  it("consumes an unexpected boundary rejection without leaking its message", async () => {
    const s = setup();
    const move = vi.fn(async () => { throw new Error("/private/internal-path stack"); });
    const session = new SuggestionSession(s.outcome, { move });
    expect(await session.confirm()).toBeNull();
    session.selectCandidate(0);
    await expect(session.confirm()).resolves.toEqual({ status: "failure", reason: "unexpected" });
    await session.confirm(); expect(move).toHaveBeenCalledOnce();
  });
  it("ignores keys before open, while another scope is active, and after close", () => {
    const s = setup(); s.scope.press("2"); expect(s.session.confirmation).toBeNull();
    s.modal.open(); s.scope.active = false; s.scope.press("2"); expect(s.session.confirmation).toBeNull();
    s.scope.active = true; const stale = s.button("[2]"); s.modal.close(); stale.click(); s.scope.press("2");
    expect(s.session.confirmation).toBeNull(); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["Cancel", "Escape", "close", "unload"])("%s before confirmation never moves", async (action) => {
    const s = setup(); s.modal.open(); s.scope.press("2"); const stale = s.button("Move");
    if (action === "Cancel") s.button("Cancel").click();
    if (action === "Escape") s.scope.press("Escape");
    if (action === "close") s.modal.close();
    if (action === "unload") s.owner.abort();
    stale.click(); s.modal.open(); await flush();
    expect(s.renameFile).not.toHaveBeenCalled(); expect(s.dom.children).toEqual([]);
  });
  it.each(["Move", "Enter"])("%s after selection moves exact path once and closes stale suggestions", async (action) => {
    const s = setup(); s.modal.open(); const stale = s.button("[1]"); s.scope.press("2");
    if (action === "Move") s.button("Move").click(); else s.scope.press("Enter");
    await flush();
    expect(s.renameFile).toHaveBeenCalledExactlyOnceWith(s.file, "Projects/ノート.MD");
    expect(s.notify).toHaveBeenCalledExactlyOnceWith("Moved to Projects");
    stale.click(); s.modal.open(); await s.session.confirm();
    expect(s.renameFile).toHaveBeenCalledOnce(); expect(s.dom.children).toEqual([]);
  });
  it("does not confirm from a double-click or repeated Enter, and respects focused Cancel", () => {
    const s = setup(); s.modal.open(); s.button("[1]").click(); s.button("Move").click(2);
    s.scope.press("Enter", { repeat: true }); s.scope.press("Enter", { ctrlKey: true });
    s.button("Cancel").focus(); s.scope.press("Enter");
    expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["ctrlKey", "altKey", "metaKey", "shiftKey"] as const)(
    "rejects %s native keyboard and pointer clicks at the Move boundary", async (modifier) => {
      const s = setup(); s.modal.open(); s.scope.press("2");
      const move = s.button("Move");
      expect(s.session.confirmation?.targetPath).toBe("Projects/ノート.MD");
      expect(s.dom.ownerDocument.activeElement).toBe(move);
      // Scopeを迂回するnative keyboard click(detail=0)とmodified pointer clickを再現する。
      move.click(0, { [modifier]: true });
      move.click(1, { [modifier]: true });
      await flush();
      expect(s.renameFile).not.toHaveBeenCalled();
      expect(s.session.pending).toBe(false);
      expect(s.session.closed).toBe(false);
      expect(s.session.confirmation?.targetPath).toBe("Projects/ノート.MD");
      expect(s.notify).not.toHaveBeenCalled();
      move.click(); await flush();
      expect(s.renameFile).toHaveBeenCalledExactlyOnceWith(s.file, "Projects/ノート.MD");
    },
  );
  it("guards repeated clicks/Enter during a pending move", async () => {
    const s = setup(); const pending = deferred<void>(); s.renameFile.mockReturnValue(pending.promise);
    s.modal.open(); s.scope.press("2"); const move = s.button("Move");
    move.click(); move.click(); s.scope.press("Enter");
    expect(move.disabled).toBe(true); expect(s.renameFile).toHaveBeenCalledOnce();
    pending.resolve(); await flush(); move.click(); expect(s.renameFile).toHaveBeenCalledOnce();
  });
  it.each(["resolve", "reject"])("handles %s after close without rollback or stale UI", async (completion) => {
    const s = setup(); const pending = deferred<void>(); s.renameFile.mockReturnValue(pending.promise);
    s.modal.open(); s.scope.press("1"); s.scope.press("Enter"); s.modal.close();
    if (completion === "resolve") pending.resolve(); else pending.reject(new Error("/private/internal-path stack"));
    await flush(); expect(s.renameFile).toHaveBeenCalledOnce(); expect(s.dom.children).toEqual([]);
    expect(s.notify).toHaveBeenCalledWith(completion === "resolve" ? "Moved to Research/日本語" : MOVE_MESSAGES.unexpected);
  });
  it.each(["resolve", "reject"])("handles %s after unload without resurrecting UI", async (completion) => {
    const s = setup(); const pending = deferred<void>(); s.renameFile.mockReturnValue(pending.promise);
    s.modal.open(); s.scope.press("1"); s.scope.press("Enter"); s.owner.abort();
    if (completion === "resolve") pending.resolve(); else pending.reject(new Error("late failure"));
    await flush();
    expect(s.renameFile).toHaveBeenCalledOnce(); expect(s.notify).not.toHaveBeenCalled(); expect(s.dom.children).toEqual([]);
  });
});

describe("move boundary safety", () => {
  const move = (s: ReturnType<typeof setup>, destination = "Projects", signal = new AbortController().signal) =>
    s.service.move(s.source, s.outcome.result.candidates.map((c) => c.path), destination, signal);
  it.each(["deleted", "renamed", "moved", "replaced", "not-markdown", "folder"])("rejects %s source without fallback", async (change) => {
    const s = setup();
    if (change === "deleted") s.entries.delete(s.source.path);
    if (change === "renamed") s.file.path = "Inbox/Renamed.md";
    if (change === "moved") s.file.path = "Elsewhere/ノート.MD";
    if (change === "replaced") s.entries.set(s.source.path, new fake.TFile(s.source.path));
    if (change === "not-markdown") s.file.extension = "png";
    if (change === "folder") s.entries.set(s.source.path, new fake.TFolder(s.source.path));
    await expect(move(s)).resolves.toEqual({ status: "failure", reason: "source-changed" });
    expect(s.renameFile).not.toHaveBeenCalled(); expect(s.other.path).toBe("Inbox/Other.md");
  });
  it.each(["deleted", "file"])("rejects destination that is %s", async (change) => {
    const s = setup(); if (change === "deleted") s.entries.delete("Projects"); else s.entries.set("Projects", new fake.TFile("Projects"));
    await expect(move(s)).resolves.toEqual({ status: "failure", reason: "destination-missing" }); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it.each(["file", "folder", "case"])("rejects %s collision, preserving both entries", async (kind) => {
    const s = setup(); const path = kind === "case" ? "Projects/ノート.md" : "Projects/ノート.MD";
    const target = kind === "folder" ? new fake.TFolder(path) : new fake.TFile(path);
    s.entries.set(path, target); s.folders[1]!.children.push(target);
    await expect(move(s)).resolves.toEqual({ status: "failure", reason: "collision" });
    expect(s.renameFile).not.toHaveBeenCalled(); expect(s.entries.get(s.source.path)).toBe(s.file); expect(s.entries.get(path)).toBe(target);
  });
  it("reports already in folder without calling the API", async () => {
    const s = setup("Projects/ノート.MD");
    await expect(move(s)).resolves.toEqual({ status: "failure", reason: "already-in-folder" }); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it("rejects destinations not displayed", async () => {
    const s = setup(); s.entries.set("Other", new fake.TFolder("Other"));
    await expect(move(s, "Other")).resolves.toEqual({ status: "failure", reason: "invalid-destination" }); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it("checks cancellation immediately before mutation", async () => {
    const s = setup(); const owner = new AbortController();
    s.getAbstractFileByPath.mockImplementation((path) => {
      if (path === "Projects/ノート.MD") owner.abort();
      return (s.entries.get(path) ?? null) as TAbstractFile | null;
    });
    await expect(move(s, "Projects", owner.signal)).resolves.toEqual({ status: "cancelled" }); expect(s.renameFile).not.toHaveBeenCalled();
  });
  it("blocks multiple suggestion sessions involving the same source or target", async () => {
    const s = setup(); const pending = deferred<void>(); s.renameFile.mockReturnValue(pending.promise);
    const first = move(s); await expect(move(s)).resolves.toEqual({ status: "failure", reason: "busy" });
    const sameName = new fake.TFile("Elsewhere/ノート.MD") as unknown as TFile;
    s.entries.set(sameName.path, sameName);
    await expect(s.service.move(new NoteSource(sameName), ["Projects"], "Projects", new AbortController().signal)).resolves.toEqual({ status: "failure", reason: "busy" });
    expect(s.renameFile).toHaveBeenCalledOnce(); pending.resolve(); await first;
  });
  it.each(["/absolute", "../Other", "a/../b", "a/./b", "a//b", "a/", "a\\b", "C:/Other", "a\u0000b", ""])("rejects unsafe/noncanonical path %j", (path) => {
    expect(createMovePlan("Inbox/note.md", path)).toBeNull(); expect(createMovePlan(path, "Projects")).toBeNull();
  });
  it.each([["Inbox/ノート.MD", "/", "ノート.MD"], ["note.md", "日本語/階層", "日本語/階層/note.md"]])("builds safe paths from %s", (source, dest, target) => {
    expect(createMovePlan(source, dest)?.targetPath).toBe(target);
  });
  it("supports an explicitly displayed Vault root", async () => {
    const s = setup(); s.entries.set("/", new fake.TFolder("/"));
    await expect(s.service.move(s.source, ["/"], "/", new AbortController().signal)).resolves.toEqual({ status: "moved", destination: "/" });
    expect(s.renameFile).toHaveBeenCalledExactlyOnceWith(s.file, "ノート.MD");
  });
});

describe("classification identity and local move integration", () => {
  it("classifies A, switches to B during read, and moves only A with no new classifier call", async () => {
    const s = setup(); let active = s.file; const pendingRead = deferred<string>();
    const getActiveFile = vi.fn(() => active); const read = vi.fn(() => pendingRead.promise);
    const classify = vi.fn(async () => s.outcome.result);
    const getApiKey = vi.fn(() => "synthetic-test-credential");
    const classification = new ClassificationService(new NoteService({ getActiveFile }, { read }),
      { getAvailableFolderPaths: () => s.folders.map((f) => f.path) }, new CandidateBuilder(),
      { getApiKey }, () => ({ classify }), () => DEFAULT_SETTINGS);
    let session!: SuggestionSession; let modal!: SuggestionModal;
    const command = new ClassificationCommand({ classificationService: classification,
      getActiveNotePath: () => active.path, showLoading: () => ({ hide: vi.fn() }), showError: vi.fn(),
      showSuggestions: (outcome, ownerSignal) => {
        session = new SuggestionSession(outcome, s.service);
        modal = new SuggestionModal({} as App, session, s.notify, ownerSignal); modal.open();
      },
    });
    const execution = command.execute(); active = s.other; pendingRead.resolve("Synthetic body only."); await execution;
    session.selectCandidate(1); expect(s.renameFile).not.toHaveBeenCalled();
    await session.confirm();
    expect(s.renameFile).toHaveBeenCalledExactlyOnceWith(s.file, "Projects/ノート.MD");
    expect(getActiveFile).toHaveBeenCalledOnce(); expect(classify).toHaveBeenCalledOnce(); expect(getApiKey).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledExactlyOnceWith(s.file);
    expect(JSON.stringify(session.viewModel)).not.toContain("Synthetic body only.");
    expect(JSON.stringify(session.viewModel)).not.toContain("synthetic-test-credential");
    command.dispose(); expect(session.closed).toBe(true);
  });
  it("retains identity from before Vault.read even if source is renamed during the read", async () => {
    const s = setup(); const pending = deferred<string>();
    const reader = new NoteService({ getActiveFile: () => s.file }, { read: () => pending.promise });
    const execution = reader.getActiveNoteState(); s.file.path = "Other/Renamed.md"; s.file.basename = "Renamed";
    pending.resolve("Synthetic body"); const state = await execution;
    if (state.status !== "ready") throw new Error("Expected ready");
    expect(state.note.path).toBe("Inbox/ノート.MD"); expect(state.note.title).toBe("ノート"); expect(state.source.matches(s.file)).toBe(false);
    await expect(s.service.move(state.source, ["Projects"], "Projects", new AbortController().signal)).resolves.toEqual({ status: "failure", reason: "source-changed" });
    expect(s.renameFile).not.toHaveBeenCalled();
  });
});
