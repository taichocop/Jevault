import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClassificationCancelledError } from "../src/classification/classification-cancellation";
import {
  NetworkError,
  TypeSafeApiError,
} from "../src/classification/classification-errors";
import type { FolderCandidate } from "../src/classification/folder-candidate";
import { TypeSafeAdapter } from "../src/classification/typesafe-adapter";
import type { NoteState } from "../src/note-service";

const note: NoteState = {
  title: "Synthetic runtime note",
  path: "Inbox/Synthetic runtime note.md",
  body: "Synthetic content for a network-free runtime regression test.",
};
const candidates: FolderCandidate[] = [
  { path: "Projects", description: "Synthetic project folder" },
  { path: "Archive", description: "Synthetic archive folder" },
];
const providerResponse = {
  answers: {
    destination: {
      type: "choice",
      choice: "Projects",
      probabilities: { Projects: 0.8, Archive: 0.2 },
    },
  },
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TypeSafe production runtime boundary", () => {
  beforeEach(() => {
    // executor差し替えでは通らない実SDK constructorを、renderer相当のglobalsで検証する。
    vi.stubGlobal("window", { document: {} });
    vi.stubGlobal("navigator", { userAgent: "Synthetic Electron renderer" });
    // 各testがtransportを置き換える前も、実networkへ接続できない状態にする。
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(providerResponse)));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("constructs the real SDK in a Desktop-like renderer without starting a request", async () => {
    const fetch = vi.mocked(globalThis.fetch);
    const adapter = new TypeSafeAdapter("unit-test-only");

    expect(fetch).not.toHaveBeenCalled();
    await expect(adapter.classify(note, candidates)).resolves.toEqual({
      candidates: [
        { path: "Projects", probability: 0.8 },
        { path: "Archive", probability: 0.2 },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
  });

  it("pins the endpoint and keeps logging off despite ambient SDK configuration", async () => {
    vi.stubEnv("TYPESAFE_BASE_URL", "https://example.invalid");
    vi.stubEnv("TYPESAFE_LOG_LEVEL", "debug");
    const logs = ["debug", "info", "warn", "error"] as const;
    const spies = logs.map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    const fetch = vi.mocked(globalThis.fetch);
    const adapter = new TypeSafeAdapter("unit-test-only");

    await adapter.classify(note, candidates);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
    expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("error");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("never starts the SDK transport for a pre-cancelled operation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("synthetic cancellation detail"));
    const adapter = new TypeSafeAdapter("unit-test-only");

    const result = adapter.classify(note, candidates, controller.signal);

    await expect(result).rejects.toBeInstanceOf(ClassificationCancelledError);
    await expect(result).rejects.not.toThrow("synthetic cancellation detail");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("aborts an active SDK fetch and never retries the cancelled request", async () => {
    vi.useFakeTimers();
    let transportSignal: AbortSignal | null | undefined;
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          transportSignal = init?.signal;
          transportSignal?.addEventListener(
            "abort",
            () => reject(new Error("synthetic transport cancellation")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const adapter = new TypeSafeAdapter("unit-test-only");
    const result = adapter.classify(note, candidates, controller.signal);
    const cancelled = expect(result).rejects.toBeInstanceOf(
      ClassificationCancelledError,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("error");
    expect(transportSignal?.aborted).toBe(false);
    controller.abort();

    expect(transportSignal?.aborted).toBe(true);
    await cancelled;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([408, 429, 500, 503, 599])(
    "does not automatically retry HTTP %i, including after cancellation",
    async (status) => {
      vi.useFakeTimers();
      const fetch = vi.fn(async () => jsonResponse({ error: "synthetic" }, status));
      vi.stubGlobal("fetch", fetch);
      const controller = new AbortController();
      const adapter = new TypeSafeAdapter("unit-test-only");

      await expect(
        adapter.classify(note, candidates, controller.signal),
      ).rejects.toBeInstanceOf(TypeSafeApiError);
      controller.abort();
      await vi.advanceTimersByTimeAsync(120_000);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("does not automatically retry a network failure", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => {
      throw new Error("synthetic connection failure");
    });
    vi.stubGlobal("fetch", fetch);
    const adapter = new TypeSafeAdapter("unit-test-only");

    await expect(adapter.classify(note, candidates)).rejects.toBeInstanceOf(
      NetworkError,
    );
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sanitizes a transport redirect rejection without an automatic retry", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => {
      throw new TypeError("synthetic redirect to https://example.invalid");
    });
    vi.stubGlobal("fetch", fetch);
    const adapter = new TypeSafeAdapter("unit-test-only");
    const result = adapter.classify(note, candidates);

    await expect(result).rejects.toBeInstanceOf(NetworkError);
    await expect(result).rejects.not.toThrow("example.invalid");
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["resolve", "reject"] as const)(
    "discards a late executor %s after cancellation",
    async (settlement) => {
      let resolve!: (value: unknown) => void;
      let reject!: (reason: Error) => void;
      const response = new Promise<unknown>((resolveResponse, rejectResponse) => {
        resolve = resolveResponse;
        reject = rejectResponse;
      });
      const execute = vi.fn(async () => response);
      const classifyFailure = vi.fn(() => "api" as const);
      const adapter = new TypeSafeAdapter(
        "unit-test-only",
        execute,
        classifyFailure,
      );
      const controller = new AbortController();
      const result = adapter.classify(note, candidates, controller.signal);
      const cancelled = expect(result).rejects.toBeInstanceOf(
        ClassificationCancelledError,
      );

      controller.abort();
      if (settlement === "resolve") resolve(providerResponse);
      else reject(new Error("synthetic provider failure"));

      await cancelled;
      expect(execute).toHaveBeenCalledTimes(1);
      expect(classifyFailure).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );
});
