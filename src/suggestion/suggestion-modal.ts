import { App, Modal } from "obsidian";

import { moveFeedback, type SuggestionSession } from "./suggestion-session";

/** 表示と入力だけを担当し、clickと数字キーを同じsessionの選択へ渡す。 */
export class SuggestionModal extends Modal {
  private opened = false;
  private moveButton?: HTMLButtonElement;
  private cancelButton?: HTMLButtonElement;
  private readonly closeFromOwner = (): void => this.close();

  constructor(
    app: App,
    private readonly session: SuggestionSession,
    private readonly notify: (message: string) => void,
    private readonly ownerSignal: AbortSignal,
  ) {
    super(app);
    for (let number = 1; number <= Math.min(9, session.viewModel.candidates.length); number += 1) {
      this.scope.register([], String(number), (event) => {
        if (!this.acceptShortcut(event)) return;
        this.selectCandidate(number - 1);
        return false;
      });
    }
    this.scope.register([], "Enter", (event) => {
      if (!this.opened || this.session.closed || this.isEditableFocus() || this.hasModifier(event)) return;
      // 選択前・長押し中はnative button clickも抑止し、同じキー入力で選択と移動を兼ねない。
      if (event.repeat || event.isComposing) return false;
      if (this.contentEl.ownerDocument.activeElement === this.cancelButton) return;
      if (this.session.confirmation === null) return false;
      void this.confirmMove();
      return false;
    });
  }

  onOpen(): void {
    if (this.ownerSignal.aborted || this.session.closed) {
      this.close();
      return;
    }
    this.opened = true;
    this.ownerSignal.addEventListener("abort", this.closeFromOwner, { once: true });
    this.render();
  }

  onClose(): void {
    this.opened = false;
    this.session.close();
    this.ownerSignal.removeEventListener("abort", this.closeFromOwner);
    this.contentEl.empty();
  }

  private hasModifier(event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): boolean {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }

  private isEditableFocus(): boolean {
    const active = this.contentEl.ownerDocument.activeElement;
    return active?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') != null;
  }

  private acceptShortcut(event: KeyboardEvent): boolean {
    return this.opened && !this.session.closed && !event.repeat && !event.isComposing &&
      !this.hasModifier(event) && !this.isEditableFocus();
  }

  private selectCandidate(index: number): void {
    if (this.opened && this.session.selectCandidate(index)) {
      this.render();
      this.moveButton?.focus();
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const plan = this.session.confirmation;
    contentEl.createEl("h2", { text: plan === null ? "Jevault" : "Move note?" });
    if (plan === null) {
      contentEl.createEl("p", { text: `Suggested folders for “${this.session.viewModel.noteTitle}”` });
      const list = contentEl.createEl("ol", { cls: "jevault-suggestion-list" });
      this.session.viewModel.candidates.forEach((candidate, index) => {
        const row = list.createEl("li");
        const shortcut = index < 9 ? `[${index + 1}] ` : "";
        const button = row.createEl("button", {
          cls: "jevault-suggestion-candidate",
          text: `${shortcut}${candidate.path} — ${candidate.probability}`,
        });
        button.addEventListener("click", () => this.selectCandidate(index));
      });
    } else {
      contentEl.createEl("p", { text: `Source: ${plan.sourcePath}` });
      contentEl.createEl("p", { text: `Destination folder: ${plan.destination}` });
      contentEl.createEl("p", { text: `Target: ${plan.targetPath}` });
      this.moveButton = contentEl.createEl("button", { text: "Move", cls: "mod-cta" });
      this.moveButton.disabled = this.session.pending;
      this.moveButton.addEventListener("click", (event) => {
        // 修飾キー付きnative button activationはScopeを迂回するため、click境界でも拒否する。
        if (this.hasModifier(event)) return;
        // 候補のdouble-clickが再描画後のMoveへ偶然届いても確認として扱わない。
        if (event.detail <= 1) void this.confirmMove();
      });
      contentEl.createEl("p", { text: "Enter to move · Esc to cancel" });
    }
    this.cancelButton = contentEl.createEl("button", { text: plan === null ? "Close" : "Cancel" });
    this.cancelButton.addEventListener("click", () => this.close());
  }

  private async confirmMove(): Promise<void> {
    if (!this.opened || this.ownerSignal.aborted) return;
    const completion = this.session.confirm();
    if (this.moveButton !== undefined) this.moveButton.disabled = this.session.pending;
    const result = await completion;
    if (result === null) return;
    // API開始後のCloseでも実際の成否を通知する。unload後はUIを復活させない。
    const message = moveFeedback(result);
    if (!this.ownerSignal.aborted && message !== null) this.notify(message);
    this.close();
  }
}
