// Dev-only static server for game/ — no build step, no dependencies beyond
// the Node 22 standard library. Run it with `node serve.ts` and open
// http://localhost:8080 (or set $PORT, or pass --port <n>). It serves files
// from game/ with the content types a browser game expects, answers 403 for
// any path that would escape that directory, and 404 for anything that is
// not a plain file inside it. Nothing here is meant for the public internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const TYPES: Record<string, string> = {
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function pickPort(): number {
  const argv = process.argv.slice(2);
  let wanted = Number(process.env.PORT) || 8080;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') wanted = Number(argv[i + 1]);
  }
  const ok = Number.isInteger(wanted) && wanted > 0 && wanted < 65536;
  return ok ? wanted : 8080;
}

// Map a request path onto a file inside game/. A path that climbs out of
// the root is 'forbidden'; anything that is not a plain file there is
// 'not-found'; otherwise the resolved file path comes back.
function lookup(pathname: string): string | 'forbidden' | 'not-found' {
  const candidate = resolve(join(GAME_ROOT, normalize(pathname)));
  const inside = candidate === GAME_ROOT || candidate.startsWith(GAME_ROOT + sep);
  if (!inside) return 'forbidden';
  let info;
  try {
    info = statSync(candidate);
  } catch {
    return 'not-found';
  }
  return info.isFile() ? candidate : 'not-found';
}

function fail(response, code: number, message: string): void {
  response.writeHead(code).end(message);
}

function send(response, file: string): void {
  const bytes = statSync(file).size;
  response.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': bytes,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

function handle(request, response): void {
  const raw = request.url ?? '/';
  const url = new URL(raw, 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    fail(response, 400, 'bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const found = lookup(pathname);
  if (found === 'forbidden') {
    fail(response, 403, 'forbidden');
    return;
  }
  if (found === 'not-found') {
    fail(response, 404, 'not found');
    return;
  }
  send(response, found);
}

const port = pickPort();

createServer(handle).listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
  console.log(`shots: http://localhost:${port}/?shot=chase&seed=7  (chase | foot | marina | mission)`);
});
