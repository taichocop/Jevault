import { Plugin } from "obsidian";

import { loadSettings, type JevaultSettings } from "./settings";
import { JevaultSettingTab } from "./settings-tab";

export default class JevaultPlugin extends Plugin {
  settings: JevaultSettings = loadSettings(undefined);

  async onload(): Promise<void> {
    this.settings = loadSettings(await this.loadData());

    this.addSettingTab(
      new JevaultSettingTab(
        this.app,
        this,
        () => this.settings,
        async (update) => {
          this.settings = { ...this.settings, ...update };
          await this.saveData(this.settings);
        },
      ),
    );
  }

  onunload(): void {}
}
