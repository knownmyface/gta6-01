// main.ts — entrypoint for the CORAL HEAT make.fun entry (Node 22, stdlib
// only). Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Paths resolve from this file's own location, never
// from the working directory, so it exits 0 from the repo dir and from /tmp.
// The dossier text is capped at 163,840 UTF-8 bytes, as the kit requires.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as kit from "./vendor/makefun-game.ts";

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const gameDir = join(here, "game");
  const shotsDir = join(here, "screenshots");
  const outDir = process.env.MAKEFUN_OUTPUT_DIR
    ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
    : "/output";

  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "game"), { recursive: true });
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  cpSync(gameDir, join(outDir, "game"), { recursive: true });
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });

  const buildDossier = (kit as { buildDossier?: unknown }).buildDossier as
    | ((root: string, opts: { text_max_bytes: number }) => unknown)
    | undefined;
  if (typeof buildDossier !== "function") {
    throw new Error("vendor/makefun-game.ts does not export buildDossier");
  }

  let dossier: unknown;
  try {
    dossier = await buildDossier(here, { text_max_bytes: 163840 });
  } catch {
    // Fall back to building the dossier from the copied output tree.
    dossier = await buildDossier(outDir, { text_max_bytes: 163840 });
  }
  const bytes = dossier instanceof Uint8Array
    ? dossier
    : typeof dossier === "string"
      ? dossier
      : JSON.stringify(dossier);
  writeFileSync(join(outDir, "dossier.json"), bytes);
  console.log("wrote " + join(outDir, "dossier.json"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
