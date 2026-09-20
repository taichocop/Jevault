import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 実API費用が通常testやCIで発生しないよう、明示的spikeを常に除外する。
    exclude: [...configDefaults.exclude, "tests/integration/**"],
  },
});
