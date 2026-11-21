// CORAL HEAT — tiny static server for local playtesting.
// Serves game/ at http://localhost:8080 (no build, no network).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};
const ROOT = 'game';
const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  try {
    const data = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found: ' + file);
  }
});
server.listen(8080, () => console.log('CORAL HEAT at http://localhost:8080'));
