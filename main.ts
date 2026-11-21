// CORAL HEAT — entrypoint: copies game/ + screenshots/ to the output dir
// and writes dossier.json with the kit library vendor/makefun-game.ts.
// Runs on Node 22 with no install and no build step.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
await mkdir(outDir, { recursive: true });
await cp('game', join(outDir, 'game'), { recursive: true });
await cp('screenshots', join(outDir, 'screenshots'), { recursive: true });
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
await writeFile(join(outDir, 'dossier.json'), dossier);
console.log('CORAL HEAT dossier written to ' + join(outDir, 'dossier.json'));
