import { Plugin } from "obsidian";

import { loadSettings, type JevaultSettings } from "./settings";
import { SettingsSaveQueue } from "./settings-save-queue";
import { JevaultSettingTab } from "./settings-tab";

export default class JevaultPlugin extends Plugin {
  settings: JevaultSettings = loadSettings(undefined);

  async onload(): Promise<void> {
    this.settings = loadSettings(await this.loadData());
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
