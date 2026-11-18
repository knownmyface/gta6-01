// CORAL HEAT v2.1 — a 3D open-world crime game in a sunset marina city.
// This program hands the entry in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json with the
// vendored make.fun library, exactly as the kit's starter does. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// After the build it prints the sizes that matter for the gate, so a bad
// screenshot or an over-cap dossier is caught before submission.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
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

// Gate sizes at a glance, so a bad build is caught before submission.
function dirBytes(dir) {
  let total = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    total += name.isDirectory() ? dirBytes(p) : statSync(p).size;
  }
  return total;
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const gameBytes = dirBytes(join(out, 'game'));
const shots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')) : [];
console.log(`dossier.json ${dossierBytes} bytes (cap 1,572,864)`);
console.log(`game/ ${gameBytes} bytes (cap 50,331,648)`);
let shotsBytes = 0;
for (const s of shots) {
  const b = statSync(join(out, 'screenshots', s)).size;
  shotsBytes += b;
  console.log(`screenshot ${s} ${b} bytes (cap 262,144)`);
}
// v2.1: the whole output shares the platform's 64 MiB cap — print it too
console.log(`output total ${dossierBytes + gameBytes + shotsBytes} bytes (cap 67,108,864)`);
