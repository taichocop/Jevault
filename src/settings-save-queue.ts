import type { JevaultSettings } from "./settings";

type SaveSettings = (settings: JevaultSettings) => Promise<void>;
type ReportError = (error: unknown) => void;

/** Settings の snapshot を受付順に保存し、古い書き込みによる上書きを防ぐ。 */
export class SettingsSaveQueue {
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly save: SaveSettings,
    private readonly reportError: ReportError,
  ) {}

  enqueue(settings: JevaultSettings): Promise<void> {
    // 配列も複製し、後続 update が待機中の snapshot を書き換えないようにする。
    const snapshot: JevaultSettings = {
      ...settings,
      ignoredFolders: [...settings.ignoredFolders],
    };

    this.pending = this.pending
      .then(async () => this.save(snapshot))
      .catch((error: unknown) => {
        // 失敗を報告したうえで chain を fulfilled に戻し、後続の保存を継続可能にする。
        this.reportError(error);
      });

    return this.pending;
  }
}
