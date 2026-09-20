import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

import {
  parseIgnoredFolders,
  parseSuggestionCount,
  type JevaultSettings,
} from "./settings";

type SettingsUpdate = Partial<
  Pick<JevaultSettings, "inboxPath" | "suggestionCount" | "ignoredFolders">
>;

/** Jevault の非機密設定だけを編集する Obsidian Settings タブ。 */
export class JevaultSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly getSettings: () => JevaultSettings,
    private readonly updateSettings: (update: SettingsUpdate) => Promise<void>,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.getSettings();

    containerEl.empty();

    new Setting(containerEl)
      .setName("Inbox folder")
      .setDesc("Vault-relative path used to exclude the Inbox from suggestions.")
      .addText((text) =>
        text.setValue(settings.inboxPath).onChange(async (value) => {
          await this.updateSettings({ inboxPath: value });
        }),
      );

    new Setting(containerEl)
      .setName("Number of suggestions")
      .setDesc("Number of folder suggestions to show.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(settings.suggestionCount)).onChange(async (value) => {
          const suggestionCount = parseSuggestionCount(value);

          // 未入力途中の値を保存して設定を壊さない。上限は Issue で未定義のため設けない。
          if (suggestionCount === undefined) {
            return;
          }

          await this.updateSettings({ suggestionCount });
        });
      });

    new Setting(containerEl)
      .setName("Ignored folders")
      .setDesc("Vault-relative folder paths to ignore, one per line.")
      .addTextArea((text) =>
        text
          .setValue(settings.ignoredFolders.join("\n"))
          .onChange(async (value) => {
            // 空行は除外し、後続処理へ意味のない候補を渡さない。
            const ignoredFolders = parseIgnoredFolders(value);

            await this.updateSettings({ ignoredFolders });
          }),
      );
  }
}
