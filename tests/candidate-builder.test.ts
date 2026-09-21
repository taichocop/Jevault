import { describe, expect, it } from "vitest";

import { CandidateBuilder } from "../src/classification/candidate-builder";

describe("CandidateBuilder", () => {
  it("maps VaultService's excluded folder paths to minimal candidates", () => {
    const availableFolderPaths = [
      "programming",
      "programming/aws",
      "programming/ruby",
      "health/fitness",
    ];

    expect(new CandidateBuilder().build(availableFolderPaths)).toEqual([
      {
        path: "programming",
        description: "Existing vault folder: programming",
      },
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
});
