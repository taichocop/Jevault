export interface JevaultSettings {
  apiKeySecretName: string;
  inboxPath: string;
  suggestionCount: number;
  ignoredFolders: string[];
}

export const DEFAULT_SETTINGS: JevaultSettings = {
  apiKeySecretName: "",
  inboxPath: "Inbox",
  suggestionCount: 3,
  ignoredFolders: [".trash", "Templates", "Attachments"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSuggestionCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** 保存済みデータを、欠けている設定をデフォルトで補完した現在の形式へ復元する。 */
export function loadSettings(savedData: unknown): JevaultSettings {
  if (!isRecord(savedData)) {
    return {
      ...DEFAULT_SETTINGS,
      ignoredFolders: [...DEFAULT_SETTINGS.ignoredFolders],
    };
  }

  // data.json はユーザー編集や旧バージョン由来の値も取り得るため、型が一致する項目だけを引き継ぐ。
  return {
    apiKeySecretName:
      typeof savedData.apiKeySecretName === "string"
        ? savedData.apiKeySecretName
        : DEFAULT_SETTINGS.apiKeySecretName,
    inboxPath:
      typeof savedData.inboxPath === "string"
        ? savedData.inboxPath
        : DEFAULT_SETTINGS.inboxPath,
    suggestionCount: isValidSuggestionCount(savedData.suggestionCount)
      ? savedData.suggestionCount
      : DEFAULT_SETTINGS.suggestionCount,
    ignoredFolders:
      Array.isArray(savedData.ignoredFolders) &&
      savedData.ignoredFolders.every(
        (folder): folder is string => typeof folder === "string",
      )
        ? [...savedData.ignoredFolders]
        : [...DEFAULT_SETTINGS.ignoredFolders],
  };
}

export function parseSuggestionCount(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const suggestionCount = Number(value);
  return isValidSuggestionCount(suggestionCount) ? suggestionCount : undefined;
}

export function parseIgnoredFolders(value: string): string[] {
  return value
    .split("\n")
    .map((folder) => folder.trim())
    .filter((folder) => folder.length > 0);
}
