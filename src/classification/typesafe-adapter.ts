import {
  choice,
  TypeSafeClient,
  type SystemOneRequest,
  VERSION as TYPE_SAFE_SDK_VERSION,
} from "@typesafe-ai/sdk";

import type { NoteState } from "../note-service";
import type {
  ClassificationCandidate,
  ClassificationResult,
} from "./classification-result";
import type { Classifier } from "./classifier";
import type { FolderCandidate } from "./folder-candidate";

export { TYPE_SAFE_SDK_VERSION };

const DESTINATION_QUESTION = "destination";
const DESTINATION_INSTRUCTIONS =
  "Which existing vault folder is the most appropriate destination for this note?";

type SystemOneExecutor = (request: SystemOneRequest) => Promise<unknown>;

interface UnknownRecord {
  [key: string]: unknown;
}

export class InvalidTypeSafeResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTypeSafeResponseError";
  }
}

/** TypeSafe固有のrequest構築・通信・response変換をdomainへ漏らさないadapter。 */
export class TypeSafeAdapter implements Classifier {
  private readonly execute: SystemOneExecutor;

  constructor(apiKey: string, execute?: SystemOneExecutor) {
    if (execute !== undefined) {
      this.execute = execute;
      return;
    }

    // SecretStorage等をadapterから探索せず、呼び出し元が注入した値だけを利用する。
    const client = new TypeSafeClient({ apiKey, logLevel: "off" });
    this.execute = async (request) => client.systemOne(request);
  }

  async classify(
    note: NoteState,
    candidates: FolderCandidate[],
  ): Promise<ClassificationResult> {
    assertValidInputPaths(candidates);
    const criteria = Object.fromEntries(
      candidates.map((candidate) => [candidate.path, candidate.description]),
    );
    const response = await this.execute({
      state: {
        title: note.title,
        path: note.path,
        body: note.body,
      },
      questions: {
        [DESTINATION_QUESTION]: choice(DESTINATION_INSTRUCTIONS, criteria),
      },
    });

    return mapTypeSafeResponse(response, candidates);
  }
}

/** 信頼境界の外から来た値を、domainの正常値として扱う前に検証する。 */
export function mapTypeSafeResponse(
  response: unknown,
  candidates: readonly FolderCandidate[],
): ClassificationResult {
  const root = asRecord(response, "response");
  const answers = asRecord(root.answers, "answers");
  const answer = asRecord(answers[DESTINATION_QUESTION], "destination answer");
  if (answer.type !== "choice") {
    throw new InvalidTypeSafeResponseError(
      "TypeSafe destination answer must be a Choice response.",
    );
  }
  const allowedPaths = new Set(candidates.map((candidate) => candidate.path));
  if (typeof answer.choice !== "string" || !allowedPaths.has(answer.choice)) {
    throw new InvalidTypeSafeResponseError(
      "TypeSafe destination answer contains an unknown selected path.",
    );
  }
  const probabilities = asRecord(answer.probabilities, "probabilities");
  const rawCandidates = Object.entries(probabilities).map(
    ([path, probability]) => ({ path, probability }),
  );
  const validatedCandidates = validateClassificationCandidates(
    rawCandidates,
    candidates,
  );
  if (
    !validatedCandidates.some((candidate) => candidate.path === answer.choice)
  ) {
    throw new InvalidTypeSafeResponseError(
      "TypeSafe destination answer selected a path without a probability.",
    );
  }
  const providerConfidence = validateOptionalProbability(
    answer.confidence,
    "provider confidence",
  );

  return providerConfidence === undefined
    ? { candidates: validatedCandidates }
    : { candidates: validatedCandidates, providerConfidence };
}

export function validateClassificationCandidates(
  value: unknown,
  candidates: readonly FolderCandidate[],
): ClassificationCandidate[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidTypeSafeResponseError(
      "TypeSafe response must contain at least one candidate.",
    );
  }

  const allowedPaths = new Set(candidates.map((candidate) => candidate.path));
  const observedPaths = new Set<string>();

  const validatedCandidates = value.map((entry, index) => {
    const candidate = asRecord(entry, `candidate ${index}`);
    if (typeof candidate.path !== "string" || !allowedPaths.has(candidate.path)) {
      throw new InvalidTypeSafeResponseError(
        `TypeSafe response contains an unknown candidate path at index ${index}.`,
      );
    }
    if (observedPaths.has(candidate.path)) {
      throw new InvalidTypeSafeResponseError(
        `TypeSafe response contains a duplicate candidate path at index ${index}.`,
      );
    }
    observedPaths.add(candidate.path);

    return {
      path: candidate.path,
      probability: validateProbability(
        candidate.probability,
        `candidate probability at index ${index}`,
      ),
    };
  });

  // 候補の欠落を許すと未評価のfolderを0扱いしてしまうため、集合の完全一致を要求する。
  if (observedPaths.size !== allowedPaths.size) {
    throw new InvalidTypeSafeResponseError(
      "TypeSafe response must contain every requested candidate path exactly once.",
    );
  }

  return validatedCandidates;
}

function assertValidInputPaths(candidates: readonly FolderCandidate[]): void {
  if (candidates.length === 0) {
    throw new Error("At least one folder candidate is required.");
  }
  const paths = new Set<string>();
  for (const candidate of candidates) {
    if (paths.has(candidate.path)) {
      throw new Error(`Folder candidates contain a duplicate path: ${candidate.path}`);
    }
    paths.add(candidate.path);
  }
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidTypeSafeResponseError(
      `TypeSafe ${label} must be an object.`,
    );
  }
  return value as UnknownRecord;
}

function validateOptionalProbability(
  value: unknown,
  label: string,
): number | undefined {
  return value === undefined ? undefined : validateProbability(value, label);
}

function validateProbability(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new InvalidTypeSafeResponseError(
      `TypeSafe ${label} must be a finite number between 0 and 1.`,
    );
  }
  return value;
}
