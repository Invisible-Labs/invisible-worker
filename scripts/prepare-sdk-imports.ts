import { access, writeFile } from "node:fs/promises";

const output = new URL("../src/sdk-imports.generated.ts", import.meta.url);

try {
  await access(new URL("../node_modules/@invisible/sdk/package.json", import.meta.url));
  await writeGeneratedLoader(true);
  console.log("generated static @invisible/sdk imports");
} catch {
  await writeGeneratedLoader(false);
  console.log("generated SDK-missing stub");
}

async function writeGeneratedLoader(usePackage: boolean): Promise<void> {
  const source = usePackage
    ? [
        'import * as root from "@invisible/sdk";',
        'import * as user from "@invisible/sdk/user";',
        'import * as storage from "@invisible/sdk/storage";',
        'import type { SdkBundle } from "./sdk-types.js";',
        "",
        "export async function loadSdkBundle(): Promise<SdkBundle | null> {",
        "  return { root, user, storage };",
        "}",
        "",
      ]
    : [
        'import type { SdkBundle } from "./sdk-types.js";',
        "",
        "export async function loadSdkBundle(): Promise<SdkBundle | null> {",
        "  return null;",
        "}",
        "",
      ];

  await writeFile(output, source.join("\n"));
}
