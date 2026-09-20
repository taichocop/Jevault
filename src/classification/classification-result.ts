export interface ClassificationCandidate {
  path: string;
  probability: number;
}

export interface ClassificationResult {
  candidates: ClassificationCandidate[];
  // 候補確率とは意味が異なるため、providerが独立値を返した場合だけ保持する。
  providerConfidence?: number;
}
