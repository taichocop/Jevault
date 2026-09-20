import { describe, expect, it } from "vitest";

import { classifyAndSort } from "../../src/classification/classify-and-sort";
import type { FolderCandidate } from "../../src/classification/folder-candidate";
import {
  TYPE_SAFE_SDK_VERSION,
  TypeSafeAdapter,
} from "../../src/classification/typesafe-adapter";
import type { NoteState } from "../../src/note-service";

const apiKey = process.env.TYPESAFE_API_KEY;
if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error(
    "TYPESAFE_API_KEY is required for the explicit TypeSafe integration spike.",
  );
}

const note: NoteState = {
  title: "Amazon S3 Storage Classes",
  path: "Inbox/Amazon S3 Storage Classes.md",
  body:
    "Amazon S3 has multiple storage classes for different access patterns, " +
    "durability requirements, and cost profiles.",
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

describe("explicit TypeSafe integration spike", () => {
  it("classifies the synthetic S3 note against the fixed candidates", async () => {
    // このsuiteだけが明示実行時に外部通信し、通常のnpm testからは除外される。
    const result = await classifyAndSort(
      new TypeSafeAdapter(apiKey),
      note,
      candidates,
    );

    expect(result.candidates[0]?.path).toBe("programming/aws");
    console.info(
      JSON.stringify({
        sdkVersion: TYPE_SAFE_SDK_VERSION,
        responseShape:
          "answers.destination.{type,choice,confidence,probabilities}",
        probabilitySource: "answers.destination.probabilities",
        independentProviderConfidenceObserved:
          result.providerConfidence !== undefined,
        candidates: result.candidates,
      }),
    );
  });
});
