import type { NoteState } from "../note-service";
import type { ClassificationResult } from "./classification-result";
import type { FolderCandidate } from "./folder-candidate";

/** SDKをdomainから切り離し、fakeや別providerへ安全に差し替えるための境界。 */
export interface Classifier {
  classify(
    note: NoteState,
    candidates: FolderCandidate[],
    signal?: AbortSignal,
  ): Promise<ClassificationResult>;
}
