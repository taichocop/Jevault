import type {
  ClassificationService,
  ClassificationServiceResult,
} from "../classification/classification-service";
import type { ClassificationResult } from "../classification/classification-result";

type ClassificationRunner = Pick<ClassificationService, "classifyActiveNote">;

export interface LoadingHandle {
  hide(): void;
}

interface ClassificationCommandDependencies {
  classificationService: ClassificationRunner;
  getActiveNotePath: () => string | null;
  showLoading: () => LoadingHandle;
  showSuggestions: (noteTitle: string, result: ClassificationResult) => void;
  handleFailure: () => void;
}

const NO_ACTIVE_NOTE_KEY = Symbol("no-active-note");

/** CommandとClassificationServiceの間で、UI状態と多重実行だけを調停する。 */
export class ClassificationCommand {
  private readonly inFlight = new Set<string | symbol>();

  constructor(private readonly dependencies: ClassificationCommandDependencies) {}

  async execute(): Promise<void> {
    const requestKey =
      this.dependencies.getActiveNotePath() ?? NO_ACTIVE_NOTE_KEY;

    // 同じノートへの連打で外部requestを増やさず、別ノートの明示実行は妨げない。
    if (this.inFlight.has(requestKey)) {
      return;
    }

    this.inFlight.add(requestKey);
    const loading = this.dependencies.showLoading();

    try {
      // Vault走査やSecret解決をUIへ複製せず、分類の唯一の入口を利用する。
      const outcome = await this.dependencies.classificationService.classifyActiveNote();
      this.showSuccessfulOutcome(outcome);
    } catch {
      // エラー別UXは次Issueへ残し、このIssueでは未処理rejectionだけを防ぐ。
      this.dependencies.handleFailure();
    } finally {
      // 成功・failure・throwの全経路でloadingとlockを残さず、再実行を可能にする。
      loading.hide();
      this.inFlight.delete(requestKey);
    }
  }

  private showSuccessfulOutcome(outcome: ClassificationServiceResult): void {
    if (outcome.status !== "success") {
      return;
    }

    this.dependencies.showSuggestions(outcome.noteTitle, outcome.result);
  }
}
