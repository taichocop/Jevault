import type { ClassificationResult } from "../classification/classification-result";

export interface SuggestionViewModel {
  noteTitle: string;
  candidates: Array<{
    path: string;
    probability: string;
  }>;
}

/** 元のprobabilityを変更せず、表示時だけ過剰でない精度の百分率へ変換する。 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function createSuggestionViewModel(
  noteTitle: string,
  result: ClassificationResult,
): SuggestionViewModel {
  return {
    noteTitle,
    // Serviceが保証する順位とsuggestionCountを尊重し、UIではsortやsliceを行わない。
    candidates: result.candidates.map((candidate) => ({
      path: candidate.path,
      probability: formatProbability(candidate.probability),
    })),
  };
}
