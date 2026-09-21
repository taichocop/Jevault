import {
  APIConnectionError,
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
import {
  InvalidTypeSafeResponseError,
  NetworkError,
  TypeSafeApiError,
} from "./classification-errors";
import type { FolderCandidate } from "./folder-candidate";

export { TYPE_SAFE_SDK_VERSION };

const DESTINATION_QUESTION = "destination";
const DESTINATION_INSTRUCTIONS =
  "Which existing vault folder is the most appropriate destination for this note?";

type SystemOneExecutor = (request: SystemOneRequest) => Promise<unknown>;

interface UnknownRecord {
  [key: string]: unknown;
}

export { InvalidTypeSafeResponseError } from "./classification-errors";

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
    let response: unknown;
    try {
      response = await this.execute({
        state: {
          title: note.title,
          path: note.path,
          body: note.body,
        },
        questions: {
          [DESTINATION_QUESTION]: choice(DESTINATION_INSTRUCTIONS, criteria),
        },
      });
    } catch (error: unknown) {
      // SDKの詳細やresponse bodyをdomain/UIへ渡さず、通信失敗だけを区別する。
      if (error instanceof APIConnectionError) {
        throw new NetworkError();
      }
      throw new TypeSafeApiError();
    }

    return mapTypeSafeResponse(response, candidates);
  }
}

/** 信頼境界の外から来た値を、domainの正常値として扱う前に検証する。 */
export function mapTypeSafeResponse(
  response: unknown,
  candidates: readonly FolderCandidate[],
): ClassificationResult {
  const root = asRecord(response);
  const answers = asRecord(root.answers);
  const answer = asRecord(answers[DESTINATION_QUESTION]);
  if (answer.type !== "choice") {
    throw new InvalidTypeSafeResponseError();
  }
  const allowedPaths = new Set(candidates.map((candidate) => candidate.path));
  if (typeof answer.choice !== "string" || !allowedPaths.has(answer.choice)) {
    throw new InvalidTypeSafeResponseError();
  }
  const probabilities = asRecord(answer.probabilities);
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
    throw new InvalidTypeSafeResponseError();
  }
  const providerConfidence = validateOptionalProbability(answer.confidence);

  return providerConfidence === undefined
    ? { candidates: validatedCandidates }
    : { candidates: validatedCandidates, providerConfidence };
}

export function validateClassificationCandidates(
  value: unknown,
  candidates: readonly FolderCandidate[],
): ClassificationCandidate[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidTypeSafeResponseError();
  }

  const allowedPaths = new Set(candidates.map((candidate) => candidate.path));
  const observedPaths = new Set<string>();

  const validatedCandidates = value.map((entry) => {
    const candidate = asRecord(entry);
    if (typeof candidate.path !== "string" || !allowedPaths.has(candidate.path)) {
      throw new InvalidTypeSafeResponseError();
    }
    if (observedPaths.has(candidate.path)) {
      throw new InvalidTypeSafeResponseError();
    }
    observedPaths.add(candidate.path);

    return {
      path: candidate.path,
      probability: validateProbability(candidate.probability),
    };
  });

  // 候補の欠落を許すと未評価のfolderを0扱いしてしまうため、集合の完全一致を要求する。
  if (observedPaths.size !== allowedPaths.size) {
    throw new InvalidTypeSafeResponseError();
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

function asRecord(value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidTypeSafeResponseError();
  }
  return value as UnknownRecord;
}

function validateOptionalProbability(value: unknown): number | undefined {
  return value === undefined ? undefined : validateProbability(value);
}

function validateProbability(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new InvalidTypeSafeResponseError();
  }
  return value;
}
