import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("plugin skeleton", () => {
  it("declares the Jevault desktop plugin manifest", async () => {
    const manifestContents = await readFile(
      new URL("../manifest.json", import.meta.url),
      "utf8",
    );
    const manifest: unknown = JSON.parse(manifestContents);
    const versionsContents = await readFile(
      new URL("../versions.json", import.meta.url),
      "utf8",
    );
    const versions: unknown = JSON.parse(versionsContents);

    expect(manifest).toMatchObject({
      id: "jevault",
      name: "Jevault",
      version: "0.1.0",
      isDesktopOnly: true,
      minAppVersion: "1.11.4",
    });
    expect(versions).toEqual({ "0.1.0": "1.11.4" });
  });
});
