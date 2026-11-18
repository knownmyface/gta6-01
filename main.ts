// CORAL HEAT v2.4 — entry hand-in for make.fun gta6-01.
// Same game as v2.3, code rewritten from scratch in-session.
// What this program does: copy game/ and screenshots/ from beside this file
// into the output directory and write output/dossier.json with the vendored
// make.fun library, exactly like the kit's starter does. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// After the build it prints the sizes the gate cares about, so an oversized
// dossier, an over-cap screenshot, or an over-cap game/ is caught locally
// before anyone tries to submit.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the source lives and where the entry goes.
const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const outputRoot = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored from reference/gate.json. Only text_max_bytes
// shapes the dossier bytes; the rest refuse an entry the scorer would refuse:
// more than 4 screenshots, or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in total; a path under game/ over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const DOSSIER_CAP_BYTES = 1572864;
const GAME_CAP_BYTES = 50331648;
const OUTPUT_CAP_BYTES = 67108864;

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function totalBytes(dir: string): number {
  let sum = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    sum += entry.isDirectory() ? totalBytes(p) : statSync(p).size;
  }
  return sum;
}

function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir) : [];
}

// --- build the output tree ---
function buildOutput(): void {
  mkdirSync(outputRoot, { recursive: true });
  copyTree(join(sourceRoot, 'game'), join(outputRoot, 'game'));
  if (existsSync(join(sourceRoot, 'screenshots'))) {
    copyTree(join(sourceRoot, 'screenshots'), join(outputRoot, 'screenshots'));
  }
  const dossierPath = join(outputRoot, 'dossier.json');
  writeFileSync(dossierPath, buildDossier(outputRoot, DOSSIER_CAPS));
}

// --- gate sizes at a glance ---
function reportSizes(): void {
  const dossierPath = join(outputRoot, 'dossier.json');
  const dossierSize = statSync(dossierPath).size;
  const gameSize = totalBytes(join(outputRoot, 'game'));
  const shotNames = listFiles(join(outputRoot, 'screenshots'));
  let shotsSize = 0;
  console.log(`dossier.json ${dossierSize} bytes (cap ${DOSSIER_CAP_BYTES})`);
  console.log(`game/ ${gameSize} bytes (cap ${GAME_CAP_BYTES})`);
  for (const name of shotNames) {
    const bytes = statSync(join(outputRoot, 'screenshots', name)).size;
    shotsSize += bytes;
    console.log(`screenshot ${name} ${bytes} bytes (cap 262144)`);
  }
  // v2.1: the whole output shares the platform's 64 MiB cap — print it too.
  console.log(`output total ${dossierSize + gameSize + shotsSize} bytes (cap ${OUTPUT_CAP_BYTES})`);
}

buildOutput();
reportSizes();
