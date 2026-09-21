/** 取消はUI向けの7種類の失敗と分け、Secretを含み得るabort reasonも引き継がない。 */
export class ClassificationCancelledError extends Error {
  constructor() {
    super("Classification cancelled.");
    this.name = "ClassificationCancelledError";
  }
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ClassificationCancelledError();
  }
}
