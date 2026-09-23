import { fixtureSource } from "./helpers/note-source";
import { describe, expect, it, vi } from "vitest";

import {
  MissingApiKeyError,
  NetworkError,
  NoActiveNoteError,
} from "../src/classification/classification-errors";
import type { ClassificationServiceResult } from "../src/classification/classification-service";
import { ClassificationCommand } from "../src/suggestion/classification-command";

const success: ClassificationServiceResult = {
  status: "success",
  source: fixtureSource(),
  noteTitle: "IAM Role",
  result: {
    candidates: [{ path: "programming/aws", probability: 0.964 }],
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createCommand(
  classifyActiveNote: (signal?: AbortSignal) => Promise<ClassificationServiceResult>,
  getActiveNotePath: () => string | null = () => "Inbox/IAM Role.md",
) {
  const hide = vi.fn();
  const showLoading = vi.fn(() => ({ hide }));
  const showSuggestions = vi.fn();
  const showError = vi.fn();
  const command = new ClassificationCommand({
    classificationService: { classifyActiveNote },
    getActiveNotePath,
    showLoading,
    showSuggestions,
    showError,
  });

  return { command, hide, showError, showLoading, showSuggestions };
}

describe("ClassificationCommand", () => {
  it("invokes ClassificationService once and shows only a successful result", async () => {
    const classifyActiveNote = vi.fn(async () => success);
    const { command, hide, showSuggestions } = createCommand(classifyActiveNote);

    await command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(1);
    expect(classifyActiveNote).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(showSuggestions).toHaveBeenCalledWith(success, expect.any(AbortSignal));
    expect(hide).toHaveBeenCalledOnce();
  });

  it("prevents a duplicate request for the same note while pending", async () => {
    const pending = deferred<ClassificationServiceResult>();
    const classifyActiveNote = vi.fn(() => pending.promise);
    const { command, hide, showLoading } = createCommand(classifyActiveNote);

    const first = command.execute();
    const second = command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(1);
    expect(showLoading).toHaveBeenCalledTimes(1);
    pending.resolve(success);
    await Promise.all([first, second]);
    expect(hide).toHaveBeenCalledOnce();
  });

  it("allows another request after completion", async () => {
    const classifyActiveNote = vi.fn(async () => success);
    const { command } = createCommand(classifyActiveNote);

    await command.execute();
    await command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
  });

  it("allows explicit requests for different notes to run concurrently", async () => {
    const requests = [
      deferred<ClassificationServiceResult>(),
      deferred<ClassificationServiceResult>(),
    ];
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockImplementationOnce(() => requests[0]!.promise)
      .mockImplementationOnce(() => requests[1]!.promise);
    let activePath = "Inbox/First.md";
    const { command } = createCommand(classifyActiveNote, () => activePath);

    const first = command.execute();
    activePath = "Inbox/Second.md";
    const second = command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    requests[0]!.resolve(success);
    requests[1]!.resolve(success);
    await Promise.all([first, second]);
  });

  it("retries through ClassificationService and shows suggestions after success", async () => {
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(success);
    const { command, hide, showError, showSuggestions } =
      createCommand(classifyActiveNote);

    await command.execute();
    const retry = showError.mock.calls[0]?.[1] as () => Promise<unknown>;
    await expect(retry()).resolves.toEqual({ status: "success" });

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    expect(showError).toHaveBeenCalledWith(
      {
        message: "Jevault couldn't classify this note.\nPlease try again.",
        retryable: true,
      },
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(showSuggestions).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledTimes(2);
  });

  it("shows the latest error after retry failure", async () => {
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValueOnce(new MissingApiKeyError());
    const { command, hide, showError, showSuggestions } =
      createCommand(classifyActiveNote);

    await command.execute();
    const retry = showError.mock.calls[0]?.[1] as () => Promise<unknown>;
    await expect(retry()).resolves.toEqual({
      status: "failure",
      presentation: {
        message:
          "TypeSafe API key is not configured.\nOpen Jevault settings to select a secret.",
        retryable: false,
      },
    });

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    expect(showSuggestions).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate Retry requests while the first Retry is pending", async () => {
    const pending = deferred<ClassificationServiceResult>();
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockRejectedValueOnce(new NetworkError())
      .mockImplementationOnce(() => pending.promise);
    const { command, showError } = createCommand(classifyActiveNote);

    await command.execute();
    const retry = showError.mock.calls[0]?.[1] as () => Promise<unknown>;
    const first = retry();
    const second = retry();

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toEqual({ status: "ignored" });
    pending.resolve(success);
    await expect(first).resolves.toEqual({ status: "success" });
  });

  it("maps non-retryable failures without a Retry callback", async () => {
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockRejectedValue(new NoActiveNoteError());
    const { command, showError } = createCommand(classifyActiveNote);

    await command.execute();

    expect(showError).toHaveBeenCalledWith(
      {
        message: "Open a Markdown note before running Jevault.",
        retryable: false,
      },
      undefined,
      expect.any(AbortSignal),
    );
  });

  it("hides every pending loading handle and ignores late success after dispose", async () => {
    const requests = [
      deferred<ClassificationServiceResult>(),
      deferred<ClassificationServiceResult>(),
    ];
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockImplementationOnce(() => requests[0]!.promise)
      .mockImplementationOnce(() => requests[1]!.promise);
    let activePath = "Inbox/First.md";
    const { command, hide, showSuggestions } = createCommand(
      classifyActiveNote,
      () => activePath,
    );

    const first = command.execute();
    activePath = "Inbox/Second.md";
    const second = command.execute();
    command.dispose();

    expect(hide).toHaveBeenCalledTimes(2);
    requests[0]!.resolve(success);
    requests[1]!.resolve(success);
    await Promise.all([first, second]);
    expect(showSuggestions).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(2);
  });

  it("consumes a pending rejection without failure UI after dispose", async () => {
    const pending = deferred<ClassificationServiceResult>();
    const classifyActiveNote = vi.fn(() => pending.promise);
    const { command, hide, showError } = createCommand(classifyActiveNote);

    const execution = command.execute();
    command.dispose();
    pending.reject(new Error("late network failure"));
    await execution;

    expect(showError).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledOnce();
  });

  it("does not start classification after dispose", async () => {
    const classifyActiveNote = vi.fn(async () => success);
    const { command, showLoading } = createCommand(classifyActiveNote);

    command.dispose();
    await command.execute();

    expect(classifyActiveNote).not.toHaveBeenCalled();
    expect(showLoading).not.toHaveBeenCalled();
  });
});

describe("ClassificationCommand cancellation", () => {
  it("passes abort to all pending service calls on dispose", async () => {
    const pending = deferred<ClassificationServiceResult>();
    const classifyActiveNote = vi.fn<
      (signal?: AbortSignal) => Promise<ClassificationServiceResult>
    >(() => pending.promise);
    let activePath = "Inbox/First.md";
    const { command, hide } = createCommand(classifyActiveNote, () => activePath);

    const first = command.execute();
    activePath = "Inbox/Second.md";
    const second = command.execute();
    const signals = classifyActiveNote.mock.calls.map(([signal]) => signal!);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    command.dispose();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(hide).toHaveBeenCalledTimes(2);
    pending.resolve(success);
    await Promise.all([first, second]);
  });

  it("does not start a Retry with an already aborted owner signal", async () => {
    const classifyActiveNote = vi.fn(async () => {
      throw new NetworkError();
    });
    const { command, showError, showLoading } = createCommand(classifyActiveNote);
    await command.execute();
    const retry = showError.mock.calls[0]?.[1] as
      (signal: AbortSignal) => Promise<unknown>;
    const owner = new AbortController();
    owner.abort();

    await expect(retry(owner.signal)).resolves.toEqual({ status: "ignored" });
    expect(classifyActiveNote).toHaveBeenCalledOnce();
    expect(showLoading).toHaveBeenCalledOnce();
  });
});
