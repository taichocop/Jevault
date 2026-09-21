import type {
  ClassificationService,
  ClassificationServiceResult,
} from "../classification/classification-service";
import type { ClassificationResult } from "../classification/classification-result";
import type { RetryResult } from "./classification-error-modal";
import {
  createErrorPresentation,
  type ErrorPresentation,
} from "./error-presentation";

type ClassificationRunner = Pick<ClassificationService, "classifyActiveNote">;

export interface LoadingHandle {
  hide(): void;
}

interface ClassificationCommandDependencies {
  classificationService: ClassificationRunner;
  getActiveNotePath: () => string | null;
  showLoading: () => LoadingHandle;
  showSuggestions: (noteTitle: string, result: ClassificationResult) => void;
  showError: (
    presentation: ErrorPresentation,
    retry: (() => Promise<RetryResult>) | undefined,
  ) => void;
}

const NO_ACTIVE_NOTE_KEY = Symbol("no-active-note");

/** CommandとClassificationServiceの間で、UI状態と多重実行だけを調停する。 */
export class ClassificationCommand {
  private readonly inFlight = new Set<string | symbol>();
  private readonly loadingHandles = new Set<LoadingHandle>();
  private disposed = false;

  constructor(private readonly dependencies: ClassificationCommandDependencies) {}

  async execute(): Promise<void> {
    const result = await this.run();
    if (result.status !== "failure" || this.disposed) {
      return;
    }

    this.dependencies.showError(
      result.presentation,
      result.presentation.retryable ? () => this.run() : undefined,
    );
  }

  private async run(): Promise<RetryResult> {
    if (this.disposed) {
      return { status: "ignored" };
    }

    const requestKey =
      this.dependencies.getActiveNotePath() ?? NO_ACTIVE_NOTE_KEY;

    // 同じノートへの連打で外部requestを増やさず、別ノートの明示実行は妨げない。
    if (this.inFlight.has(requestKey)) {
      return { status: "ignored" };
    }

    this.inFlight.add(requestKey);
    const loading = this.dependencies.showLoading();
    this.loadingHandles.add(loading);

    try {
      // Vault走査やSecret解決をUIへ複製せず、分類の唯一の入口を利用する。
      const outcome = await this.dependencies.classificationService.classifyActiveNote();
      if (this.disposed) {
        return { status: "ignored" };
      }
      this.showSuccessfulOutcome(outcome);
      return { status: "success" };
    } catch (error) {
      return this.disposed
        ? { status: "ignored" }
        : { status: "failure", presentation: createErrorPresentation(error) };
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
