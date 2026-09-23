import type { NoteState } from "../note-service";
import { throwIfCancelled } from "./classification-cancellation";
import type { ClassificationResult } from "./classification-result";
import type { Classifier } from "./classifier";
import type { FolderCandidate } from "./folder-candidate";

/** providerが返した候補をapplication側の表示順に整える。 */
export async function classifyAndSort(
  classifier: Classifier,
  note: NoteState,
  candidates: FolderCandidate[],
  signal?: AbortSignal,
): Promise<ClassificationResult> {
  throwIfCancelled(signal);
  const result = await classifier.classify(note, candidates, signal);
  throwIfCancelled(signal);

  return {
    ...result,
    // provider境界は変換と検証に限定し、表示順はapplication側で決める。
    candidates: [...result.candidates].sort(
      (left, right) => right.probability - left.probability,
    ),
  };
}
