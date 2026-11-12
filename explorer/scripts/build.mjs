// Build a single self-contained HTML file: dist/mtm-explorer.html
// Bundles src/main.js with esbuild (IIFE) and inlines it plus src/styles.css into the page.
// The output has no doctype/html/head/body tags, because the claude.ai artifact host wraps
// the page in its own skeleton (including the reset in src/base.css). Use --standalone to
// produce a full HTML document you can open directly from disk instead.
import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const standalone = process.argv.includes('--standalone');

const js = (await build({entryPoints:[root + 'src/main.js'], bundle:true, format:'iife', minify:true, write:false, target:'es2020'})).outputFiles[0].text;
const css = await readFile(root + 'src/styles.css', 'utf8');
const base = await readFile(root + 'src/base.css', 'utf8');
const html = await readFile(root + 'index.html', 'utf8');

const head = html.slice(html.indexOf('<title>'), html.indexOf('<link rel="stylesheet" href="src/base.css">'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const page = standalone
  ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}<style>\n${base}\n${css}</style>\n</head>\n<body>\n${body}<script>\n${safeJs}</script>\n</body>\n</html>\n`
  : `${head}<style>\n${css}</style>\n${body}<script>\n${safeJs}</script>\n`;

await mkdir(root + 'dist', {recursive:true});
const out = root + `dist/mtm-explorer${standalone ? '.standalone' : ''}.html`;
await writeFile(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(1)} KB)`);
