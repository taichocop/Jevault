import type { App, Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => ({
  onSecretChange: undefined as ((value: unknown) => Promise<void>) | undefined,
}));

vi.mock("obsidian", () => {
  class PluginSettingTab {
    containerEl = { empty: () => undefined };
  }

  class Setting {
    controlEl = {};
    setName(): this { return this; }
    setDesc(): this { return this; }
    addText(): this { return this; }
    addTextArea(): this { return this; }
  }

  class SecretComponent {
    setValue(): this { return this; }
    onChange(callback: (value: unknown) => Promise<void>): this {
      ui.onSecretChange = callback;
      return this;
    }
  }

  return { PluginSettingTab, Setting, SecretComponent };
});

import { CandidateBuilder } from "../src/classification/candidate-builder";
import { MissingApiKeyError } from "../src/classification/classification-errors";
import { ClassificationService } from "../src/classification/classification-service";
import { SecretService } from "../src/secret-service";
import { DEFAULT_SETTINGS, loadSettings, type JevaultSettings } from "../src/settings";
import { SettingsSaveQueue } from "../src/settings-save-queue";
import { JevaultSettingTab } from "../src/settings-tab";
import { createErrorPresentation } from "../src/suggestion/error-presentation";

describe("SecretComponent unlink", () => {
  it("keeps active and saved settings valid, stops before the provider, and recovers on re-selection", async () => {
    let activeSettings: JevaultSettings = {
      ...DEFAULT_SETTINGS,
      apiKeySecretName: "unit-test-secret",
    };
    const saved: JevaultSettings[] = [];
    const queue = new SettingsSaveQueue(async (snapshot) => {
      saved.push(snapshot);
    }, vi.fn());
    const tab = new JevaultSettingTab(
      {} as App,
      {} as Plugin,
      () => activeSettings,
      async (update) => {
        activeSettings = { ...activeSettings, ...update };
        await queue.enqueue(activeSettings);
      },
    );
    tab.display();
    const changeSecret = ui.onSecretChange;
    expect(changeSecret).toBeDefined();
    if (changeSecret === undefined) throw new Error("Missing SecretComponent callback");

    const getSecret = vi.fn((name: string) =>
      name === "unit-test-secret" ? "dummy-credential" : null,
    );
    const classify = vi.fn(async () => ({
      candidates: [{ path: "Projects", probability: 1 }],
    }));
    const classifierFactory = vi.fn(() => ({ classify }));
    const service = new ClassificationService(
      { getActiveNoteState: async () => ({
        status: "ready" as const,
        note: { title: "Example", path: "Example.md", body: "Synthetic note" },
      }) },
      { getAvailableFolderPaths: () => ["Projects"] },
      new CandidateBuilder(),
      new SecretService({ getSecret }),
      classifierFactory,
      () => activeSettings,
    );

    await expect(service.classifyActiveNote()).resolves.toMatchObject({ status: "success" });
    expect(classifierFactory).toHaveBeenCalledTimes(1);

    await changeSecret(null);
    expect(activeSettings.apiKeySecretName).toBe("");
    expect(saved.at(-1)?.apiKeySecretName).toBe("");
    expect(JSON.parse(JSON.stringify(saved.at(-1)))).toMatchObject({ apiKeySecretName: "" });
    await service.classifyActiveNote().then(
      () => { throw new Error("Expected MissingApiKeyError"); },
      (error: unknown) => {
        expect(error).toBeInstanceOf(MissingApiKeyError);
        expect(createErrorPresentation(error)).toEqual({
          message: "TypeSafe API key is not configured.\nOpen Jevault settings to select a secret.",
          retryable: false,
        });
      },
    );
    expect(getSecret).toHaveBeenCalledTimes(1);
    expect(classifierFactory).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenCalledTimes(1);

    await changeSecret(undefined);
    expect(activeSettings.apiKeySecretName).toBe("");
    expect(saved.at(-1)?.apiKeySecretName).toBe("");

    await changeSecret("unit-test-secret");
    expect(activeSettings.apiKeySecretName).toBe("unit-test-secret");
    await expect(service.classifyActiveNote()).resolves.toMatchObject({ status: "success" });
    expect(getSecret).toHaveBeenCalledTimes(2);
    expect(classifierFactory).toHaveBeenCalledTimes(2);
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("still normalizes a saved null on load", () => {
    expect(loadSettings({ apiKeySecretName: null }).apiKeySecretName).toBe("");
  });
});
