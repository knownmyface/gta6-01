// CORAL HEAT v2.8 — the entry program (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ from beside this file
// into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library, exactly as the
// kit's starter does. No network, no installs, no build step.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The sealed scorer's caps, from the kit's reference/gate.json: the dossier
// text is capped at 160 KiB, screenshots at 4 files / 256 KiB each, game/ at
// 993 entries / 48 MiB. buildDossier enforces the same numbers here.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function cleanDir(path) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

function handIn(repoRoot, outDir) {
  mkdirSync(outDir, { recursive: true });
  // Start from a clean output so stale screenshots can never leak into a grade.
  cleanDir(join(outDir, 'game'));
  cleanDir(join(outDir, 'screenshots'));
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  return dossier.length;
}

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const bytes = handIn(repoRoot, outDir);
console.log(`CORAL HEAT v2.8 handed in: ${outDir} (dossier ${bytes} bytes)`);
