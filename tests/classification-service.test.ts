import { describe, expect, it, vi } from "vitest";

import { CandidateBuilder } from "../src/classification/candidate-builder";
import {
  ClassificationService,
  type ClassifierFactory,
} from "../src/classification/classification-service";
import type { Classifier } from "../src/classification/classifier";
import type { NoteStateResult } from "../src/note-service";
import type { JevaultSettings } from "../src/settings";

const settings: JevaultSettings = {
  apiKeySecretName: "typesafe-api-key",
  inboxPath: "Inbox",
  ignoredFolders: ["Templates", "Attachments"],
  suggestionCount: 3,
};

const readyNote: NoteStateResult = {
  status: "ready",
  note: {
    title: "Amazon S3 Storage Classes",
    path: "programming/aws/S3 Storage Classes.md",
    body: "Amazon S3 has multiple storage classes.",
  },
};

function createService(options: {
  noteState?: NoteStateResult;
  folderPaths?: string[];
  apiKey?: string | null;
  suggestionCount?: number;
  classifier?: Classifier;
} = {}) {
  const classify = vi.fn(async () => ({
    candidates: [
      { path: "programming/ruby", probability: 0.1 },
      { path: "programming/aws", probability: 0.85 },
      { path: "health/fitness", probability: 0.05 },
    ],
    providerConfidence: 0.77,
  }));
  const classifier = options.classifier ?? { classify };
  const classifierFactory = vi.fn<ClassifierFactory>(() => classifier);
  const getApiKey = vi.fn(() =>
    options.apiKey === undefined ? "unit-test-api-key" : options.apiKey,
  );
  const service = new ClassificationService(
    {
      getActiveNoteState: vi.fn(async () => options.noteState ?? readyNote),
    },
    {
      getAvailableFolderPaths: vi.fn(() =>
        options.folderPaths ?? [
          "programming/aws",
          "programming/ruby",
          "health/fitness",
        ],
      ),
    },
    new CandidateBuilder(),
    { getApiKey },
    classifierFactory,
    () => ({
      ...settings,
      suggestionCount: options.suggestionCount ?? settings.suggestionCount,
    }),
  );

  return { classify, classifierFactory, getApiKey, service };
}

describe("ClassificationService", () => {
  it("forwards arbitrary Vault paths instead of fixed spike candidates", async () => {
    const classifier: Classifier = {
      classify: vi.fn(async () => ({
        candidates: [
          { path: "InboxArchive", probability: 0.2 },
          { path: "research/machine-learning", probability: 0.8 },
        ],
      })),
    };
    const { service } = createService({
      classifier,
      folderPaths: ["research/machine-learning", "InboxArchive"],
    });

    await expect(service.classifyActiveNote()).resolves.toMatchObject({
      status: "success",
      result: {
        candidates: [
          { path: "research/machine-learning", probability: 0.8 },
          { path: "InboxArchive", probability: 0.2 },
        ],
      },
    });
    expect(classifier.classify).toHaveBeenCalledWith(readyNote.note, [
      {
        path: "research/machine-learning",
        description: "Existing vault folder: research/machine-learning",
      },
      {
        path: "InboxArchive",
        description: "Existing vault folder: InboxArchive",
      },
    ]);
  });

  it("forwards dynamic candidates, sorts by probability, and preserves provider confidence", async () => {
    const { classify, classifierFactory, service } = createService();

    await expect(service.classifyActiveNote()).resolves.toEqual({
      status: "success",
      noteTitle: "Amazon S3 Storage Classes",
      result: {
        candidates: [
          { path: "programming/aws", probability: 0.85 },
          { path: "programming/ruby", probability: 0.1 },
          { path: "health/fitness", probability: 0.05 },
        ],
        providerConfidence: 0.77,
      },
    });
    expect(classifierFactory).toHaveBeenCalledWith("unit-test-api-key");
    expect(classify).toHaveBeenCalledWith(readyNote.note, [
      {
        path: "programming/aws",
        description: "Existing vault folder: programming/aws",
      },
      {
        path: "programming/ruby",
        description: "Existing vault folder: programming/ruby",
      },
      {
        path: "health/fitness",
        description: "Existing vault folder: health/fitness",
      },
    ]);
  });

  it("returns only the configured top candidates after sorting", async () => {
    const { service } = createService({ suggestionCount: 2 });

    await expect(service.classifyActiveNote()).resolves.toMatchObject({
      status: "success",
      result: {
        candidates: [
          { path: "programming/aws", probability: 0.85 },
          { path: "programming/ruby", probability: 0.1 },
        ],
      },
    });
  });

  it("returns one candidate when fewer than suggestionCount exist", async () => {
    const classifier: Classifier = {
      classify: vi.fn(async () => ({
        candidates: [{ path: "InboxArchive", probability: 1 }],
      })),
    };
    const { service } = createService({
      classifier,
      folderPaths: ["InboxArchive"],
    });

    await expect(service.classifyActiveNote()).resolves.toEqual({
      status: "success",
      noteTitle: "Amazon S3 Storage Classes",
      result: {
        candidates: [{ path: "InboxArchive", probability: 1 }],
      },
    });
  });

  it.each([null, "", " ", "   ", "\n", "\t", " \n\t "])(
    "does not create or call a classifier for missing or blank secret %j",
    async (apiKey) => {
      const { classify, classifierFactory, service } = createService({ apiKey });

      await expect(service.classifyActiveNote()).resolves.toEqual({
        status: "missing-secret",
      });
      expect(classifierFactory).not.toHaveBeenCalled();
      expect(classify).not.toHaveBeenCalled();
    },
  );

  it("does not resolve a secret or call a classifier when no candidates exist", async () => {
    const { classify, classifierFactory, getApiKey, service } = createService({
      folderPaths: [],
    });

    await expect(service.classifyActiveNote()).resolves.toEqual({
      status: "no-candidates",
    });
    expect(getApiKey).not.toHaveBeenCalled();
    expect(classifierFactory).not.toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
  });

  it.each(["no-active-file", "unsupported-file"] as const)(
    "does not call a classifier for %s",
    async (status) => {
      const { classify, classifierFactory, getApiKey, service } = createService({
        noteState: { status },
      });

      await expect(service.classifyActiveNote()).resolves.toEqual({ status });
      expect(getApiKey).not.toHaveBeenCalled();
      expect(classifierFactory).not.toHaveBeenCalled();
      expect(classify).not.toHaveBeenCalled();
    },
  );
});
