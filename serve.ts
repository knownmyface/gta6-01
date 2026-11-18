// A tiny static server for game/ (Node 22, standard library only), so an
// entry can be played locally without a build step: `node serve.ts` serves
// game/ on http://localhost:8080 (or $PORT, or --port <n>). v2.5 is a
// from-scratch rewrite of v2.4's serve.ts: same routes, same MIME types,
// same path guard, different code. It sends the MIME types a browser game
// needs, refuses any path outside game/, and otherwise does nothing clever:
// this is a development convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function choosePort(): number {
  const args = process.argv.slice(2);
  const flagAt = args.indexOf('--port');
  const wanted = flagAt === -1
    ? Number(process.env.PORT) || 8080
    : Number(args[flagAt + 1]);
  if (Number.isInteger(wanted) && wanted > 0 && wanted < 65536) return wanted;
  return 8080;
}

// Resolve a request path to a file under game/. Returns the file path, or
// 'forbidden' when the path escapes the root, or 'not-found' when it is not
// a plain file inside the root.
function resolvePath(pathname: string): string | 'forbidden' | 'not-found' {
  const file = resolve(join(rootDir, normalize(pathname)));
  if (file !== rootDir && !file.startsWith(rootDir + sep)) return 'forbidden';
  let stats;
  try {
    stats = statSync(file);
  } catch {
    return 'not-found';
  }
  if (!stats.isFile()) return 'not-found';
  return file;
}

function serveFile(response, file: string): void {
  const size = statSync(file).size;
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

const port = choosePort();

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolvePath(pathname);
  if (file === 'forbidden') {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (file === 'not-found') {
    response.writeHead(404).end('not found');
    return;
  }
  serveFile(response, file);
}).listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
  console.log(`shots: http://localhost:${port}/?shot=chase&seed=7  (chase | foot | marina | mission)`);
});
