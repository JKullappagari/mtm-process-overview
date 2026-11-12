// Zero-dependency static server for local development: npm start  (PORT env to change port)
// ES modules don't load from file://, so open the site through this instead of double-clicking index.html.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png'};

http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(root, path.endsWith('/') ? path + 'index.html' : path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {'content-type':types[extname(file)] || 'application/octet-stream', 'cache-control':'no-store'}).end(body);
  } catch {
    res.writeHead(404, {'content-type':'text/plain'}).end('Not found');
  }
}).listen(port, () => console.log(`MTM Process Explorer running at http://localhost:${port}`));
