import { describe, expect, it, vi } from "vitest";

import { classifyAndSort } from "../src/classification/classify-and-sort";
import type { Classifier } from "../src/classification/classifier";
import type { FolderCandidate } from "../src/classification/folder-candidate";
import {
  InvalidTypeSafeResponseError,
  mapTypeSafeResponse,
  TypeSafeAdapter,
  validateClassificationCandidates,
} from "../src/classification/typesafe-adapter";
import type { NoteState } from "../src/note-service";

const note: NoteState = {
  title: "Amazon S3 Storage Classes",
  path: "Inbox/Amazon S3 Storage Classes.md",
  body: "Amazon S3 has multiple storage classes.",
};

const candidates: FolderCandidate[] = [
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
];

function response(
  probabilities: Record<string, unknown>,
  ...confidenceValues: unknown[]
): unknown {
  const confidence =
    confidenceValues.length === 0 ? 0.91 : confidenceValues[0];
  const destination: Record<string, unknown> = {
    type: "choice",
    choice: "programming/aws",
    probabilities,
  };
  if (confidence !== undefined) {
    destination.confidence = confidence;
  }

  return {
    model: "jev-test",
    answers: {
      destination,
    },
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

describe("classification spike", () => {
  it("sorts a typed fake Classifier result without mutating the fake result", async () => {
    const fakeResult = {
      candidates: [
        { path: "programming/ruby", probability: 0.05 },
        { path: "programming/aws", probability: 0.9 },
        { path: "health/fitness", probability: 0.05 },
      ],
    };
    const classifier: Classifier = {
      classify: vi.fn(async () => fakeResult),
    };

    await expect(
      classifyAndSort(classifier, note, candidates),
    ).resolves.toEqual({
      candidates: [
        { path: "programming/aws", probability: 0.9 },
        { path: "programming/ruby", probability: 0.05 },
        { path: "health/fitness", probability: 0.05 },
      ],
    });
    expect(fakeResult.candidates[0]?.path).toBe("programming/ruby");
  });

  it("builds a Choice request and maps the SDK response through a network-free executor", async () => {
    const execute = vi.fn(async () =>
      response({
        "programming/aws": 0.9,
        "programming/ruby": 0.06,
        "health/fitness": 0.04,
      }),
    );
    const adapter = new TypeSafeAdapter("unit-test-only", execute);

    await expect(adapter.classify(note, candidates)).resolves.toEqual({
      candidates: [
        { path: "programming/aws", probability: 0.9 },
        { path: "programming/ruby", probability: 0.06 },
        { path: "health/fitness", probability: 0.04 },
      ],
      providerConfidence: 0.91,
    });
    expect(execute).toHaveBeenCalledWith({
      state: note,
      questions: {
        destination: {
          type: "choice",
          instructions:
            "Which existing vault folder is the most appropriate destination for this note?",
          criteria: Object.fromEntries(
            candidates.map((candidate) => [
              candidate.path,
              candidate.description,
            ]),
          ),
        },
      },
    });
  });

  it("accepts a valid response without independent provider confidence", () => {
    expect(
      mapTypeSafeResponse(
        response(
          {
            "programming/aws": 0.8,
            "programming/ruby": 0.1,
            "health/fitness": 0.1,
          },
          undefined,
        ),
        candidates,
      ),
    ).toEqual({
      candidates: [
        { path: "programming/aws", probability: 0.8 },
        { path: "programming/ruby", probability: 0.1 },
        { path: "health/fitness", probability: 0.1 },
      ],
    });
  });

  it.each([
    ["empty candidates", []],
    ["NaN probability", [{ path: "programming/aws", probability: Number.NaN }]],
    [
      "infinite probability",
      [{ path: "programming/aws", probability: Number.POSITIVE_INFINITY }],
    ],
    ["negative probability", [{ path: "programming/aws", probability: -0.01 }]],
    ["probability above one", [{ path: "programming/aws", probability: 1.01 }]],
    ["unknown path", [{ path: "private/unknown", probability: 0.5 }]],
    [
      "duplicate path",
      [
        { path: "programming/aws", probability: 0.6 },
        { path: "programming/aws", probability: 0.4 },
      ],
    ],
  ])("rejects %s", (_label, invalidCandidates) => {
    expect(() =>
      validateClassificationCandidates(invalidCandidates, candidates),
    ).toThrow(InvalidTypeSafeResponseError);
  });
});
