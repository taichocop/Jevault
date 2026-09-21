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
  private readonly loadingHandles = new Set<LoadingHandle>();
  private disposed = false;

  constructor(private readonly dependencies: ClassificationCommandDependencies) {}

  async execute(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const requestKey =
      this.dependencies.getActiveNotePath() ?? NO_ACTIVE_NOTE_KEY;

    // 同じノートへの連打で外部requestを増やさず、別ノートの明示実行は妨げない。
    if (this.inFlight.has(requestKey)) {
      return;
    }

    this.inFlight.add(requestKey);
    const loading = this.dependencies.showLoading();
    this.loadingHandles.add(loading);

    try {
      // Vault走査やSecret解決をUIへ複製せず、分類の唯一の入口を利用する。
      const outcome = await this.dependencies.classificationService.classifyActiveNote();
      if (this.disposed) {
        return;
      }
      this.showSuccessfulOutcome(outcome);
    } catch {
      // エラー別UXは次Issueへ残し、このIssueでは未処理rejectionだけを防ぐ。
      if (!this.disposed) {
        this.dependencies.handleFailure();
      }
    } finally {
      // 成功・failure・throwの全経路でloadingとlockを残さず、再実行を可能にする。
      this.inFlight.delete(requestKey);
      if (this.loadingHandles.delete(loading)) {
        loading.hide();
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.inFlight.clear();
    // unload時点で全Noticeを閉じ、late completion側のfinallyとの二重cleanupを避ける。
    for (const loading of this.loadingHandles) {
      loading.hide();
    }
    this.loadingHandles.clear();
  }

  private showSuccessfulOutcome(outcome: ClassificationServiceResult): void {
    if (outcome.status !== "success") {
      return;
    }

    this.dependencies.showSuggestions(outcome.noteTitle, outcome.result);
  }
}
