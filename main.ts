// CORAL HEAT v2.9 round 5 — make.fun gta6-01 entrypoint (Node 22, stdlib only).
// Hands the game in: copies game/ and screenshots/ to the output dir and writes
// /output/dossier.json with the vendored make.fun library.
//
// ENTRYPOINT FIX (round 4 failed on this): the grader runs `node /bot/main.ts`
// from a working directory that is NOT the repository, so game/ and screenshots/
// are resolved from THIS FILE's own location (import.meta.url), never from
// process.cwd(). The output dir still comes from MAKEFUN_OUTPUT_DIR, default /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Directory that holds this entrypoint file — the repository root, wherever
// the grader happens to invoke node from.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) throw new Error('game/ not found next to main.ts at ' + gameDir);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
