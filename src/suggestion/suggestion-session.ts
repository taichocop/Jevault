import type { ClassificationServiceResult } from "../classification/classification-service";
import {
  createMovePlan,
  MOVE_MESSAGES,
  type MovePlan,
  type MoveResult,
  type NoteMoveService,
} from "../note-move-service";
import type { NoteSource } from "../note-source";
import { createSuggestionViewModel, type SuggestionViewModel } from "./suggestion-view-model";

/** click/key共通の選択・確認状態。UIへ本文や元TFileを公開しない。 */
export class SuggestionSession {
  readonly viewModel: SuggestionViewModel;
  private readonly source: NoteSource;
  private selected: MovePlan | null = null;
  private phase: "selecting" | "confirming" | "pending" | "finished" = "selecting";
  private readonly lifetime = new AbortController();
  private readonly displayedPaths: readonly string[];

  constructor(
    outcome: ClassificationServiceResult,
    private readonly moveService: Pick<NoteMoveService, "move">,
  ) {
    this.source = outcome.source;
    this.viewModel = createSuggestionViewModel(outcome.noteTitle, outcome.result);
    this.displayedPaths = this.viewModel.candidates.map(({ path }) => path);
  }

  get confirmation(): MovePlan | null {
    return this.selected;
  }

  get pending(): boolean {
    return this.phase === "pending";
  }

  get closed(): boolean {
    return this.lifetime.signal.aborted;
  }

  selectCandidate(index: number): boolean {
    if (this.closed || this.phase !== "selecting" || !Number.isInteger(index)) {
      return false;
    }
    const destination = this.displayedPaths[index];
    if (destination === undefined) return false;
    this.selected = createMovePlan(this.source.path, destination);
    if (this.selected === null) return false;
    this.phase = "confirming";
    return true;
  }

  async confirm(): Promise<MoveResult | null> {
    if (this.closed || this.phase !== "confirming" || this.selected === null) {
      return null;
    }
    this.phase = "pending";
    try {
      return await this.moveService.move(
        this.source,
        this.displayedPaths,
        this.selected.destination,
        this.lifetime.signal,
      );
    } catch {
      return { status: "failure", reason: "unexpected" };
    } finally {
      // 成否が不明な例外でも同じ確認を再利用させず、再確認には新しい分類を要求する。
      this.phase = "finished";
    }
  }

  close(): void {
    this.lifetime.abort();
  }
}

export function moveFeedback(result: MoveResult): string | null {
  if (result.status === "cancelled") return null;
  return result.status === "moved"
    ? `Moved to ${result.destination}`
    : MOVE_MESSAGES[result.reason];
}
