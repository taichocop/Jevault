import {
  App,
  Plugin,
  PluginSettingTab,
  SecretComponent,
  Setting,
} from "obsidian";

import {
  parseIgnoredFolders,
  parseSuggestionCount,
  type JevaultSettings,
} from "./settings";

type SettingsUpdate = Partial<
  Pick<
    JevaultSettings,
    "apiKeySecretName" | "inboxPath" | "suggestionCount" | "ignoredFolders"
  >
>;

/** Jevault の設定を編集し、機密値は Obsidian SecretStorage に委ねる Settings タブ。 */
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
      .setName("Privacy and external services")
      .setDesc(
        "When you explicitly run “Jevault: Classify current note”, the active note title, Vault-relative path, full Markdown note body, and candidate folder paths are sent to TypeSafe. Jevault does not send note data in the background.",
      );

    const apiKeySetting = new Setting(containerEl)
      .setName("TypeSafe API key")
      .setDesc("Select the Obsidian secret that contains your TypeSafe API key.");

    // SecretComponent は値を露出せず、設定には SecretStorage 上の参照名だけを渡す。
    new SecretComponent(this.app, apiKeySetting.controlEl)
      .setValue(settings.apiKeySecretName)
      .onChange(async (apiKeySecretName) => {
        await this.updateSettings({ apiKeySecretName });
      });

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
        text.inputEl.min = "1";
        text.inputEl.step = "1";
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
