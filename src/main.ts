import { Plugin } from "obsidian";

import { NoteService } from "./note-service";
import { SecretService } from "./secret-service";
import { loadSettings, type JevaultSettings } from "./settings";
import { SettingsSaveQueue } from "./settings-save-queue";
import { JevaultSettingTab } from "./settings-tab";
import { VaultService } from "./vault-service";

export default class JevaultPlugin extends Plugin {
  settings: JevaultSettings = loadSettings(undefined);
  noteService!: NoteService;
  secretService!: SecretService;
  vaultService!: VaultService;

  async onload(): Promise<void> {
    this.settings = loadSettings(await this.loadData());
    this.noteService = new NoteService(this.app.workspace, this.app.vault);
    // SecretStorage へのアクセスは専用サービスへ閉じ込め、後続の分類処理から差し替え可能にする。
    this.secretService = new SecretService(this.app.secretStorage);
    this.vaultService = new VaultService(this.app.vault);
    const saveQueue = new SettingsSaveQueue(
      async (snapshot) => this.saveData(snapshot),
      () => console.error("Failed to save Jevault settings."),
    );

    this.addSettingTab(
      new JevaultSettingTab(
        this.app,
        this,
        () => this.settings,
        async (update) => {
          this.settings = { ...this.settings, ...update };
          await saveQueue.enqueue(this.settings);
        },
      ),
    );
  }

  onunload(): void {}
}
