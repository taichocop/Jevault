import console from "node:console";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

import { thirdPartyNotice } from "./third-party-notices.mjs";

const bundle = await readFile(new URL("../main.js", import.meta.url), "utf8");
if (!bundle.startsWith(thirdPartyNotice)) {
  throw new Error("Production main.js is missing the full TypeSafe SDK notice.");
}

console.log("Production main.js contains the full TypeSafe SDK notice.");
