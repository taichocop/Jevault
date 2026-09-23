import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const sdkPackagePath = fileURLToPath(
  import.meta.resolve("@typesafe-ai/sdk/package.json"),
);
const sdkPackage = JSON.parse(await readFile(sdkPackagePath, "utf8"));
const lock = JSON.parse(
  await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
);
const lockedSdk = lock.packages["node_modules/@typesafe-ai/sdk"];

if (sdkPackage.version !== lockedSdk?.version) {
  throw new Error("Installed TypeSafe SDK version differs from package-lock.json.");
}

const sdkLicense = await readFile(join(dirname(sdkPackagePath), "LICENSE"), "utf8");
if (sdkLicense.includes("*/")) {
  throw new Error("TypeSafe SDK license cannot be embedded in a JavaScript comment.");
}

export const thirdPartyNotice =
  `/*!\nThird-party software notices\n@typesafe-ai/sdk ${sdkPackage.version}\n\n` +
  sdkLicense +
  `${sdkLicense.endsWith("\n") ? "" : "\n"}*/\n`;
