import type { FolderCandidate } from "./folder-candidate";

/** 除外済みのVault folder pathを、providerへ渡す最小候補へ変換する。 */
export class CandidateBuilder {
  build(folderPaths: readonly string[]): FolderCandidate[] {
    // 除外規則をここへ重複させず、VaultServiceが保証したpathだけを説明付き候補へ写像する。
    return folderPaths.map((path) => ({
      path,
      description: `Existing vault folder: ${path}`,
    }));
  }
}
