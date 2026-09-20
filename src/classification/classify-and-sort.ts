import type { NoteState } from "../note-service";
import type { ClassificationResult } from "./classification-result";
import type { Classifier } from "./classifier";
import type { FolderCandidate } from "./folder-candidate";

/** Spike用の最小coordinator。完全なClassificationServiceは後続Issueで実装する。 */
export async function classifyAndSort(
  classifier: Classifier,
  note: NoteState,
  candidates: FolderCandidate[],
): Promise<ClassificationResult> {
  const result = await classifier.classify(note, candidates);

  return {
    ...result,
    // provider境界は変換と検証に限定し、表示順はapplication側で決める。
    candidates: [...result.candidates].sort(
      (left, right) => right.probability - left.probability,
    ),
  };
}
