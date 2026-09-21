import { App, Modal } from "obsidian";

import type { ErrorPresentation } from "./error-presentation";

export type RetryResult =
  | { status: "success" }
  | { status: "failure"; presentation: ErrorPresentation }
  | { status: "ignored" };

/** 安全なerror presentationと明示的Retryだけを扱う、Vault操作を持たないModal。 */
export class ClassificationErrorModal extends Modal {
  private retryInFlight = false;
  private closed = false;

  constructor(
    app: App,
    private presentation: ErrorPresentation,
    private readonly retry: (() => Promise<RetryResult>) | undefined,
  ) {
    super(app);
  }

  onOpen(): void {
    this.closed = false;
    this.render();
  }

  onClose(): void {
    this.closed = true;
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Jevault" });
    for (const line of this.presentation.message.split("\n")) {
      contentEl.createEl("p", { text: line });
    }

    if (this.presentation.retryable && this.retry !== undefined) {
      const retryButton = contentEl.createEl("button", { text: "Retry" });
      retryButton.disabled = this.retryInFlight;
      retryButton.addEventListener("click", () => {
        void this.retryClassification(retryButton);
      });
    }

    const closeButton = contentEl.createEl("button", { text: "Close" });
    closeButton.addEventListener("click", () => this.close());
  }

  private async retryClassification(retryButton: HTMLButtonElement): Promise<void> {
    if (this.retryInFlight || this.retry === undefined) {
      return;
    }

    this.retryInFlight = true;
    retryButton.disabled = true;
    try {
      const result = await this.retry();
      if (this.closed) {
        return;
      }
      if (result.status === "success") {
        this.close();
        return;
      }
      if (result.status === "failure") {
        // 最新の失敗へ差し替え、入力側エラーへ変化した場合はRetryを表示しない。
        this.presentation = result.presentation;
      }
    } finally {
      this.retryInFlight = false;
      if (!this.closed) {
        this.render();
      }
    }
  }
}
