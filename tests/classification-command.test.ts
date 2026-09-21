import { describe, expect, it, vi } from "vitest";

import type { ClassificationServiceResult } from "../src/classification/classification-service";
import { ClassificationCommand } from "../src/suggestion/classification-command";

const success: ClassificationServiceResult = {
  status: "success",
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
  classifyActiveNote: () => Promise<ClassificationServiceResult>,
  getActiveNotePath: () => string | null = () => "Inbox/IAM Role.md",
) {
  const hide = vi.fn();
  const showLoading = vi.fn(() => ({ hide }));
  const showSuggestions = vi.fn();
  const handleFailure = vi.fn();
  const command = new ClassificationCommand({
    classificationService: { classifyActiveNote },
    getActiveNotePath,
    showLoading,
    showSuggestions,
    handleFailure,
  });

  return { command, handleFailure, hide, showLoading, showSuggestions };
}

describe("ClassificationCommand", () => {
  it("invokes ClassificationService once and shows only a successful result", async () => {
    const classifyActiveNote = vi.fn(async () => success);
    const { command, hide, showSuggestions } = createCommand(classifyActiveNote);

    await command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(1);
    expect(showSuggestions).toHaveBeenCalledWith("IAM Role", success.result);
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

  it("cleans up loading and allows retry after a thrown failure", async () => {
    const classifyActiveNote = vi
      .fn<() => Promise<ClassificationServiceResult>>()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(success);
    const { command, handleFailure, hide, showSuggestions } =
      createCommand(classifyActiveNote);

    await command.execute();
    await command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    expect(handleFailure).toHaveBeenCalledOnce();
    expect(showSuggestions).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledTimes(2);
  });

  it("cleans up loading and allows retry after a failure result", async () => {
    const classifyActiveNote = vi.fn(async () => ({
      status: "missing-secret" as const,
    }));
    const { command, handleFailure, hide, showSuggestions } =
      createCommand(classifyActiveNote);

    await command.execute();
    await command.execute();

    expect(classifyActiveNote).toHaveBeenCalledTimes(2);
    expect(showSuggestions).not.toHaveBeenCalled();
    expect(handleFailure).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(2);
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
    const { command, handleFailure, hide } = createCommand(classifyActiveNote);

    const execution = command.execute();
    command.dispose();
    pending.reject(new Error("late network failure"));
    await execution;

    expect(handleFailure).not.toHaveBeenCalled();
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
