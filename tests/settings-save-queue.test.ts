import { describe, expect, it } from "vitest";

import type { JevaultSettings } from "../src/settings";
import { SettingsSaveQueue } from "../src/settings-save-queue";

function createSettings(inboxPath: string): JevaultSettings {
  return {
    apiKeySecretName: "",
    inboxPath,
    suggestionCount: 3,
    ignoredFolders: ["Archive"],
  };
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

describe("SettingsSaveQueue", () => {
  it("saves immutable snapshots serially in update order", async () => {
    const firstSave = createDeferred();
    const secondSave = createDeferred();
    const gates = [firstSave, secondSave];
    const started: JevaultSettings[] = [];
    const queue = new SettingsSaveQueue(async (snapshot) => {
      const gate = gates[started.length];
      started.push(snapshot);
      await gate.promise;
    }, () => undefined);
    const firstSettings = createSettings("A");

    const firstResult = queue.enqueue(firstSettings);
    firstSettings.ignoredFolders.push("Changed later");
    const secondResult = queue.enqueue(createSettings("B"));
    await Promise.resolve();

    expect(started).toEqual([
      expect.objectContaining({ inboxPath: "A", ignoredFolders: ["Archive"] }),
    ]);

    firstSave.resolve();
    await firstResult;
    await Promise.resolve();

    expect(started).toEqual([
      expect.objectContaining({ inboxPath: "A" }),
      expect.objectContaining({ inboxPath: "B" }),
    ]);

    secondSave.resolve();
    await secondResult;
  });

  it("reports a failed save and continues with later saves", async () => {
    const failure = new Error("write failed");
    const savedPaths: string[] = [];
    const reportedErrors: unknown[] = [];
    const queue = new SettingsSaveQueue(
      async (snapshot) => {
        if (snapshot.inboxPath === "A") {
          throw failure;
        }
        savedPaths.push(snapshot.inboxPath);
      },
      (error) => reportedErrors.push(error),
    );

    const firstResult = queue.enqueue(createSettings("A"));
    const secondResult = queue.enqueue(createSettings("B"));

    await Promise.all([firstResult, secondResult]);

    expect(reportedErrors).toEqual([failure]);
    expect(savedPaths).toEqual(["B"]);
  });
});
