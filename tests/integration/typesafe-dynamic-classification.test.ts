import { fixtureSource } from "../helpers/note-source";
import { describe, expect, it, vi } from "vitest";
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

import { CandidateBuilder } from "../../src/classification/candidate-builder";
import { ClassificationService } from "../../src/classification/classification-service";
import { TypeSafeAdapter } from "../../src/classification/typesafe-adapter";
import { SecretService } from "../../src/secret-service";
import type { JevaultSettings } from "../../src/settings";
import { VaultService } from "../../src/vault-service";

const apiKey = process.env.TYPESAFE_API_KEY;
if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error(
    "TYPESAFE_API_KEY is required for explicit dynamic classification integration.",
  );
}

const settings: JevaultSettings = {
  apiKeySecretName: "typesafe-api-key",
  inboxPath: "Inbox",
  ignoredFolders: ["Templates", "Attachments"],
  suggestionCount: 3,
};

const syntheticEntries = [
  new MockTFolder("Inbox"),
  new MockTFile("Inbox/test-s3.md"),
  new MockTFolder("programming"),
  new MockTFolder("programming/aws"),
  new MockTFolder("programming/ruby"),
  new MockTFolder("health"),
  new MockTFolder("health/fitness"),
  new MockTFolder("Templates"),
  new MockTFolder("Attachments"),
  new MockTFolder("InboxArchive"),
] as unknown as TAbstractFile[];

describe("explicit dynamic classification integration", () => {
  it("classifies a synthetic active note against filtered Test Vault folders", async () => {
    const vaultService = new VaultService({
      configDir: ".obsidian",
      getAllLoadedFiles: () => syntheticEntries,
    });
    const availablePaths = vaultService.getAvailableFolderPaths(settings);
    const service = new ClassificationService(
      {
        getActiveNoteState: async () => ({
          status: "ready",
          source: fixtureSource(),
          note: {
            title: "Amazon S3 Storage Classes",
            path: "Inbox/test-s3.md",
            body:
              "Amazon S3 has multiple storage classes for different access " +
              "patterns, durability requirements, and cost profiles.",
          },
        }),
      },
      vaultService,
      new CandidateBuilder(),
      new SecretService({
        getSecret: (name) => (name === settings.apiKeySecretName ? apiKey : null),
      }),
      (resolvedApiKey) => new TypeSafeAdapter(resolvedApiKey),
      () => settings,
    );

    expect(availablePaths).toEqual([
      "programming",
      "programming/aws",
      "programming/ruby",
      "health",
      "health/fitness",
      "InboxArchive",
    ]);

    const outcome = await service.classifyActiveNote();
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") {
      return;
    }

    expect(outcome.result.candidates).toHaveLength(3);
    expect(outcome.result.candidates[0]?.path).toBe("programming/aws");
    console.info(
      JSON.stringify({
        availablePaths,
        topCandidates: outcome.result.candidates,
        independentProviderConfidenceObserved:
          outcome.result.providerConfidence !== undefined,
      }),
    );
  });
});
