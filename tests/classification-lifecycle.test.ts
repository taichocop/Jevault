import { fixtureSource } from "./helpers/note-source";
import type { NoteSource } from "../src/note-source";
import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { CandidateBuilder } from "../src/classification/candidate-builder";
import { ClassificationCancelledError } from "../src/classification/classification-cancellation";
import { ClassificationService } from "../src/classification/classification-service";
import type { ClassificationResult } from "../src/classification/classification-result";
import type { Classifier } from "../src/classification/classifier";
import { NoteService } from "../src/note-service";
import { SecretService } from "../src/secret-service";
import { DEFAULT_SETTINGS } from "../src/settings";
import { ClassificationCommand } from "../src/suggestion/classification-command";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  const pendingRead = deferred<string>();
  const read = vi.fn(() => pendingRead.promise);
  const getSecret = vi.fn(() => "unit-test-only");
  const classify = vi.fn<Classifier["classify"]>(async () => ({
    candidates: [{ path: "Research", probability: 1 }],
  }));
  const classifierFactory = vi.fn(() => ({ classify }));
  const noteService = new NoteService(
    {
      getActiveFile: () => ({
        path: "Inbox/Synthetic.md",
        basename: "Synthetic",
        extension: "md",
      }) as TFile,
    },
    { read },
  );
  const service = new ClassificationService(
    noteService,
    { getAvailableFolderPaths: () => ["Research"] },
    new CandidateBuilder(),
    new SecretService({ getSecret }),
    classifierFactory,
    () => ({ ...DEFAULT_SETTINGS, apiKeySecretName: "unit-test-secret" }),
  );
  const showSuggestions = vi.fn();
  const showError = vi.fn();
  const hide = vi.fn();
  const command = new ClassificationCommand({
    classificationService: service,
    getActiveNotePath: () => "Inbox/Synthetic.md",
    showLoading: () => ({ hide }),
    showSuggestions,
    showError,
  });
  return {
    pendingRead, read, getSecret, classify, classifierFactory, service,
    command, showSuggestions, showError, hide,
  };
}

describe("classification cancellation across application boundaries", () => {
  it.each(["resolve", "reject"] as const)(
    "disposal during Vault.read blocks Secret/provider/UI after late %s",
    async (completion) => {
      const state = setup();
      const execution = state.command.execute();
      expect(state.read).toHaveBeenCalledOnce();

      state.command.dispose();
      if (completion === "resolve") {
        state.pendingRead.resolve("Synthetic Markdown fixture.");
      } else {
        state.pendingRead.reject(new Error("Synthetic read failure."));
      }
      await execution;

      expect(state.getSecret).not.toHaveBeenCalled();
      expect(state.classifierFactory).not.toHaveBeenCalled();
      expect(state.classify).not.toHaveBeenCalled();
      expect(state.showSuggestions).not.toHaveBeenCalled();
      expect(state.showError).not.toHaveBeenCalled();
      expect(state.hide).toHaveBeenCalledOnce();
    },
  );

  it("does not read or resolve a Secret for an already cancelled operation", async () => {
    const state = setup();
    const controller = new AbortController();
    controller.abort("synthetic-private-abort-reason");

    const execution = state.service.classifyActiveNote(controller.signal);
    await expect(execution).rejects.toThrow(ClassificationCancelledError);
    await expect(execution).rejects.not.toThrow("synthetic-private-abort-reason");
    expect(state.read).not.toHaveBeenCalled();
    expect(state.getSecret).not.toHaveBeenCalled();
    expect(state.classify).not.toHaveBeenCalled();
  });

  it("checks cancellation after a note provider that ignores its signal", async () => {
    const pending = deferred<{
      status: "ready";
      source: NoteSource;
      note: { title: string; path: string; body: string };
    }>();
    const getApiKey = vi.fn(() => "unit-test-only");
    const factory = vi.fn();
    const service = new ClassificationService(
      { getActiveNoteState: () => pending.promise },
      { getAvailableFolderPaths: () => ["Research"] },
      new CandidateBuilder(),
      { getApiKey },
      factory,
      () => DEFAULT_SETTINGS,
    );
    const controller = new AbortController();
    const execution = service.classifyActiveNote(controller.signal);
    controller.abort();
    pending.resolve({
      status: "ready",
      source: fixtureSource(),
      note: { title: "Synthetic", path: "Synthetic.md", body: "Fixture" },
    });

    await expect(execution).rejects.toThrow(ClassificationCancelledError);
    expect(getApiKey).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it("forwards the operation signal to Classifier and discards late results", async () => {
    const state = setup();
    const pendingProvider = deferred<ClassificationResult>();
    const started = deferred<AbortSignal | undefined>();
    state.classify.mockImplementation((_note, _candidates, signal) => {
      started.resolve(signal);
      return pendingProvider.promise;
    });
    const controller = new AbortController();
    const execution = state.service.classifyActiveNote(controller.signal);
    state.pendingRead.resolve("Synthetic Markdown fixture.");

    expect(await started.promise).toBe(controller.signal);
    controller.abort();
    pendingProvider.resolve({ candidates: [{ path: "Research", probability: 1 }] });
    await expect(execution).rejects.toThrow(ClassificationCancelledError);
    expect(state.getSecret).toHaveBeenCalledOnce();
    expect(state.classify).toHaveBeenCalledOnce();
  });
});
