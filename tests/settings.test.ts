import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseIgnoredFolders,
  parseSuggestionCount,
} from "../src/settings";

describe("Jevault settings", () => {
  it("provides the Issue #3 defaults without duplicating Inbox", () => {
    expect(loadSettings(undefined)).toEqual({
      apiKeySecretName: "",
      inboxPath: "Inbox",
      suggestionCount: 3,
      ignoredFolders: [".obsidian", ".trash", "Templates", "Attachments"],
    });
    expect(DEFAULT_SETTINGS.ignoredFolders).not.toContain("Inbox");
  });

  it("fills missing keys in partial saved settings", () => {
    expect(loadSettings({ inboxPath: "00_Inbox" })).toEqual({
      apiKeySecretName: "",
      inboxPath: "00_Inbox",
      suggestionCount: 3,
      ignoredFolders: [".obsidian", ".trash", "Templates", "Attachments"],
    });
  });

  it("restores settings after JSON serialization", () => {
    const settings = {
      apiKeySecretName: "typesafe-production",
      inboxPath: "00_Inbox",
      suggestionCount: 5,
      ignoredFolders: ["Archive", "Assets"],
    };
    const savedData: unknown = JSON.parse(JSON.stringify(settings));

    expect(loadSettings(savedData)).toEqual(settings);
  });

  it("falls back safely when saved values have unexpected types", () => {
    expect(
      loadSettings({
        apiKeySecretName: 123,
        inboxPath: null,
        suggestionCount: Number.NaN,
        ignoredFolders: ["Archive", 42],
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("does not share the default ignored folder array with loaded settings", () => {
    const settings = loadSettings(undefined);

    settings.ignoredFolders.push("Personal");

    expect(DEFAULT_SETTINGS.ignoredFolders).not.toContain("Personal");
  });

  it("parses editable ignored folders into a string array", () => {
    expect(parseIgnoredFolders(" Archive \n\nAssets\n")).toEqual([
      "Archive",
      "Assets",
    ]);
  });

  it("accepts finite suggestion counts without adding a product maximum", () => {
    expect(parseSuggestionCount("5")).toBe(5);
    expect(parseSuggestionCount("1000")).toBe(1000);
    expect(parseSuggestionCount("")).toBeUndefined();
    expect(parseSuggestionCount("not-a-number")).toBeUndefined();
  });
});
