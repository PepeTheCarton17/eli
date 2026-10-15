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

const basePort = Number(process.argv[2]) || 8123;
const root = resolve(process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.vrm': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
};

const server = createServer(async (req, res) => {
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
});

// Si el puerto está ocupado, prueba el siguiente (hasta 20) en vez de romper.
let port = basePort;
let attempts = 0;

server.on('error', (err) => {
  if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && attempts < 20) {
    attempts++;
    console.warn(`  \u26a0 Puerto ${port} ocupado, probando ${port + 1}...`);
    port++;
    setTimeout(() => server.listen(port), 50);
    return;
  }
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});

server.on('listening', () => {
  console.log(`Neon Oracle disponible en http://localhost:${port}/`);
  console.log('(Ctrl+C para detener)');
});

server.listen(port);
