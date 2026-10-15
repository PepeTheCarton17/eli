#!/usr/bin/env node
// Servidor estático mínimo (sin dependencias) para jugar Neon Oracle en local.
//
// Uso:
//   node serve.mjs            -> sirve esta carpeta en http://localhost:8123/
//   node serve.mjs 3000       -> usa otro puerto
//
// No requiere `npm install`: solo necesita tener Node.js instalado.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2]) || 8123;
const root = resolve(process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.vrm': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(urlPath).replace(/^([/\\])+/, '');
    const file = join(root, rel === '' ? 'index.html' : rel);
    if (!file.startsWith(root)) { res.writeHead(403).end('403'); return; }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found');
  }
}).listen(port, () => console.log(`Neon Oracle disponible en http://localhost:${port}/`));
