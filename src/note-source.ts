import type { TFile } from "obsidian";

/** pathの再利用で別ノートを動かさないよう、分類開始時の同一オブジェクトも保持する。 */
export class NoteSource {
  readonly path: string;
  readonly #file: TFile;

  constructor(file: TFile) {
    this.path = file.path;
    this.#file = file;
    Object.freeze(this);
  }

  matches(file: TFile): boolean {
    return file === this.#file && file.path === this.path;
  }
}
