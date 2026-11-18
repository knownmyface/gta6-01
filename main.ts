// CORAL HEAT v2.6 — entry hand-in for make.fun gta6-01.
// Same game as v2.5, code rewritten from scratch in-session.
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

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the source lives and where the entry goes.
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored from reference/gate.json. Only text_max_bytes
// shapes the dossier bytes; the rest refuse an entry the scorer would refuse:
// more than 4 screenshots, or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in total; a path under game/ over 1000 bytes.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const DOSSIER_CAP = 1572864;
const GAME_CAP = 50331648;
const OUTPUT_CAP = 67108864;

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function treeBytes(dir: string): number {
  let total = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += treeBytes(p);
    else total += statSync(p).size;
  }
  return total;
}

function listNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

// --- build the output tree ---
function buildOutput(): void {
  mkdirSync(outDir, { recursive: true });
  copyTree(join(rootDir, 'game'), join(outDir, 'game'));
  const shotsDir = join(rootDir, 'screenshots');
  if (existsSync(shotsDir)) {
    copyTree(shotsDir, join(outDir, 'screenshots'));
  }
  const dossierPath = join(outDir, 'dossier.json');
  const dossier = buildDossier(outDir, GATE_CAPS);
  writeFileSync(dossierPath, dossier);
}

// --- gate sizes at a glance ---
function reportSizes(): void {
  const dossierPath = join(outDir, 'dossier.json');
  const dossierSize = statSync(dossierPath).size;
  const gameSize = treeBytes(join(outDir, 'game'));
  const shotNames = listNames(join(outDir, 'screenshots'));
  let shotsSize = 0;
  console.log(`dossier.json ${dossierSize} bytes (cap ${DOSSIER_CAP})`);
  console.log(`game/ ${gameSize} bytes (cap ${GAME_CAP})`);
  for (const name of shotNames) {
    const bytes = statSync(join(outDir, 'screenshots', name)).size;
    shotsSize += bytes;
    console.log(`screenshot ${name} ${bytes} bytes (cap 262144)`);
  }
  // v2.1: the whole output shares the platform's 64 MiB cap — print it too.
  const outputTotal = dossierSize + gameSize + shotsSize;
  console.log(`output total ${outputTotal} bytes (cap ${OUTPUT_CAP})`);
}

buildOutput();
reportSizes();
