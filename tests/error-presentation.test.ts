import { describe, expect, it } from "vitest";

import {
  InvalidTypeSafeResponseError,
  MissingApiKeyError,
  NetworkError,
  NoActiveNoteError,
  NoCandidatesError,
  TypeSafeApiError,
  UnsupportedFileError,
} from "../src/classification/classification-errors";
import { createErrorPresentation } from "../src/suggestion/error-presentation";

describe("classification error presentation", () => {
  it.each([
    [
      new MissingApiKeyError(),
      "TypeSafe API key is not configured.\nOpen Jevault settings to select a secret.",
    ],
    [
      new NoActiveNoteError(),
      "Open a Markdown note before running Jevault.",
    ],
    [
      new UnsupportedFileError(),
      "This file can't be classified. Open a Markdown note and try again.",
    ],
    [new NoCandidatesError(), "No destination folders are available."],
  ])("maps %s to a safe non-retryable message", (error, message) => {
    expect(createErrorPresentation(error)).toEqual({
      message,
      retryable: false,
    });
  });

  it.each([
    new NetworkError(),
    new TypeSafeApiError(),
    new InvalidTypeSafeResponseError(),
  ])("maps %s to the shared safe retryable message", (error) => {
    const presentation = createErrorPresentation(error);

    expect(presentation).toEqual({
      message: "Jevault couldn't classify this note.\nPlease try again.",
      retryable: true,
    });
    expect(presentation.message).not.toContain(error.stack ?? error.message);
  });

  it("does not expose an unknown raw error", () => {
    expect(
      createErrorPresentation(new Error("raw provider response and secret")),
    ).toEqual({
      message: "Jevault couldn't classify this note.",
      retryable: false,
    });
  });
});
