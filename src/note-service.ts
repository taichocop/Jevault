import type { TFile, Vault, Workspace } from "obsidian";

import { throwIfCancelled } from "./classification/classification-cancellation";
import { NoteSource } from "./note-source";

export interface NoteState {
  title: string;
  path: string;
  body: string;
}

export type NoteStateResult =
  | { status: "no-active-file" }
  | { status: "unsupported-file" }
  | { status: "ready"; note: NoteState; source: NoteSource };

type ActiveFileReader = Pick<Workspace, "getActiveFile">;
type NoteBodyReader = Pick<Vault, "read">;

/** Active Markdownの取得とNoteState生成だけを担う、read-onlyな境界。 */
export class NoteService {
  constructor(
    private readonly workspace: ActiveFileReader,
    private readonly vault: NoteBodyReader,
  ) {}

  async getActiveNoteState(signal?: AbortSignal): Promise<NoteStateResult> {
    throwIfCancelled(signal);
    const activeFile = this.workspace.getActiveFile();

    // 呼び出し元が未選択と非対応形式を別々に扱えるよう、本文取得前に状態を確定する。
    if (activeFile === null) {
      return { status: "no-active-file" };
    }

    if (!isMarkdown(activeFile)) {
      // 画像やPDFの内容を分類用本文として誤読しないよう、Vault.readを呼び出さずに終了する。
      return { status: "unsupported-file" };
    }

    // read待機中のrenameやactive切替でも、分類開始時のidentityを変更しない。
    const source = new NoteSource(activeFile);
    const title = activeFile.basename;
    // OS filesystemを介さずObsidianのread APIだけを使うため、ノートやVaultを変更しない。
    throwIfCancelled(signal);
    const body = await this.vault.read(activeFile);
    throwIfCancelled(signal);

    return {
      status: "ready",
      source,
      note: {
        // basenameは親folderを含まず、Markdown拡張子も除かれたObsidianのファイル名である。
        title,
        // 分類元を一意に保てるよう、nested folderや日本語を含むVault相対pathをそのまま使う。
        path: source.path,
        body,
      },
    };
  }
}

function isMarkdown(file: TFile): boolean {
  return file.extension.toLowerCase() === "md";
}
