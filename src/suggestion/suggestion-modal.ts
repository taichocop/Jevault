import { App, Modal } from "obsidian";

import type { SuggestionViewModel } from "./suggestion-view-model";

/** 分類済み候補を表示するだけの、Vault操作を持たないread-only Modal。 */
export class SuggestionModal extends Modal {
  constructor(
    app: App,
    private readonly viewModel: SuggestionViewModel,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Jevault" });
    contentEl.createEl("p", {
      text: `Suggested folders for “${this.viewModel.noteTitle}”`,
    });

    const list = contentEl.createEl("ol");
    for (const candidate of this.viewModel.candidates) {
      const row = list.createEl("li");
      row.createEl("span", { text: candidate.path });
      row.createEl("span", { text: ` — ${candidate.probability}` });
      // candidate rowは表示専用とし、clickによるVault変更を結び付けない。
    }

    const closeButton = contentEl.createEl("button", { text: "Close" });
    closeButton.addEventListener("click", () => this.close());
  }

  onClose(): void {
    // 標準Close/Escapeでは表示要素だけを破棄し、分類やVault操作を行わない。
    this.contentEl.empty();
  }
}
