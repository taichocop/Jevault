import { describe, expect, it } from "vitest";

import {
  createSuggestionViewModel,
  formatProbability,
} from "../src/suggestion/suggestion-view-model";

describe("suggestion view model", () => {
  it.each([
    [0.964, "96.4%"],
    [0, "0.0%"],
    [1, "100.0%"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatProbability(value)).toBe(expected);
  });

  it("preserves candidate order and renders every returned candidate", () => {
    const result = {
      candidates: [
        { path: "programming/aws", probability: 0.964 },
        { path: "programming", probability: 0.021 },
        { path: "programming/rails", probability: 0.015 },
      ],
    };

    expect(createSuggestionViewModel("IAM Role", result)).toEqual({
      noteTitle: "IAM Role",
      candidates: [
        { path: "programming/aws", probability: "96.4%" },
        { path: "programming", probability: "2.1%" },
        { path: "programming/rails", probability: "1.5%" },
      ],
    });
    expect(result.candidates[0]?.probability).toBe(0.964);
  });

  it.each([1, 2])("renders safely when only %i candidates are returned", (count) => {
    const result = {
      candidates: [
        { path: "programming/aws", probability: 0.8 },
        { path: "programming", probability: 0.2 },
      ].slice(0, count),
    };

    expect(createSuggestionViewModel("IAM Role", result).candidates).toHaveLength(
      count,
    );
  });
});
