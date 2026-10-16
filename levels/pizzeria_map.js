/**
 * MAPA: FNAF MOVIE PIZZERIA (modelo glTF del restaurante de Freddy Fazbear)
 * Modelo: "FNAF Movie Pizzeria" (Sketchfab). Ver license.txt en el origen.
 *
 * Igual que BackroomsMap, este módulo:
 *   1. Carga el modelo glTF (.glb optimizado con meshopt + WebP) de forma asíncrona.
 *   2. DESCUANTIZA las posiciones (gltfpack/meshopt guarda POSITION como enteros
 *      normalizados; three r128 los dibuja bien, pero el cálculo en JS necesita
 *      los valores reales). Se hace una sola vez y se sustituyen por Float32.
 *   3. Rasteriza los muros verticales sobre una rejilla 2D (gruesa para
 *      alcanzabilidad/puertas/objetos, fina para la colisión real).
 *   4. Flood fill desde la aparición para saber qué zonas son transitables.
 *   5. Construye un clon escalado/centrado y registra las colisiones.
 *
 * El modelo trae una "Baseplate" gigantesca (suelo de 8224 uds) que se ignora
 * para las rejillas: sólo cuentan los muros del edificio (~1200 uds). El suelo
 * sigue renderizándose como suelo del restaurante.
 *
 * Si el modelo no carga (p.ej. file://), el Nivel 2 cae al mapa procedural.
 */
window.PizzeriaMap = {
    URL: 'assets/pizzeria/scene.glb',
    TARGET_SIZE: 300,     // ancho objetivo del edificio en unidades de juego
    CELL: 6.0,            // rasterizado GRUESO (unidades del modelo): alcance/puertas/objetos
    COLLIDE_CELL: 2.0,    // rasterizado FINO (unidades del modelo): muros reales de colisión
    PLAYER_HEIGHT: 4.8,   // altura del jugador (unidades de juego): un dintel por encima
                          // de la cabeza NO debe bloquear (si no, sella las puertas)

    ready: false,
    failed: false,
    _loading: false,
    scene: null,
    grid: null,           // { w, h, cell, minX, minZ, data } (coords del modelo)
    collideGrid: null,
    reach: null,          // Uint8Array: 1 = alcanzable desde la aparición
    center: { x: 0, z: 0 },
    scale: 1,
    bounds: null,         // límites en unidades de juego (ya escalado y centrado)
    wallBox: null,        // límites de los muros en coords del modelo
    spawnCell: null,
    reachCount: 0,

    // ---------------------------------------------------------------- carga
    load(onDone) {
        if (this.ready || this._loading) { if (onDone) onDone(this.ready); return; }
        if (typeof THREE === 'undefined' || !THREE.GLTFLoader) { this.failed = true; if (onDone) onDone(false); return; }
        this._loading = true;
        const loader = new THREE.GLTFLoader();
        if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
        loader.load(this.URL, (gltf) => {
            try {
                this.scene = gltf.scene;
                this._process(gltf.scene);
                this.ready = true;
                console.log('[PizzeriaMap] Sala cargada: ' + Math.round(this.bounds.w) + ' x ' + Math.round(this.bounds.d) +
                    ' uds (escala ' + this.scale.toFixed(3) + '), techo ' + Math.round(this.bounds.ceil) +
                    ' uds, zona alcanzable ' + this.reachCount + ' celdas.');
            } catch (e) {
                console.warn('[PizzeriaMap] Error procesando el modelo:', e);
                this.failed = true;
            } finally {
                this._loading = false;
                if (onDone) onDone(this.ready);
            }
        }, undefined, (e) => {
            console.warn('[PizzeriaMap] No se pudo cargar el modelo (se usará el mapa procedural):', e && e.message ? e.message : e);
            this.failed = true;
            this._loading = false;
            if (onDone) onDone(false);
        });
    },

    // --------------------------------------------------- descuantización
    _normMax(arr) {
        if (arr instanceof Int16Array) return 32767;
        if (arr instanceof Int8Array) return 127;
        if (arr instanceof Uint16Array) return 65535;
        if (arr instanceof Uint8Array) return 255;
        return 1;
    },

    // meshopt guarda POSITION como enteros normalizados (a menudo INTERcalados con
    // normales/UVs). Se convierten a float una sola vez: así el rasterizado, las
    // cajas contenedoras (culling) y el resto del juego leen valores reales.
    // OJO: hay que leer con p.getX/getY/getZ (respetan el stride). Leer p.array
    // directamente mezcla atributos cuando el buffer es intercalado.
    _dequantize(root) {
        let fixed = 0;
        root.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const p = o.geometry.attributes.position;
            if (!p || !p.normalized) return;
            const src = p.array || (p.data && p.data.array);
            const m = this._normMax(src);
            const n = p.count;
            const f = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                f[i * 3] = p.getX(i) / m;
                f[i * 3 + 1] = p.getY(i) / m;
                f[i * 3 + 2] = p.getZ(i) / m;
            }
            o.geometry.setAttribute('position', new THREE.Float32BufferAttribute(f, 3));
            o.geometry.computeBoundingBox();
            o.geometry.computeBoundingSphere();
            fixed++;
        });
        if (fixed) console.log('[PizzeriaMap] ' + fixed + ' mallas descuantizadas.');
    },

    // ------------------------------------------------------------ procesado
    _process(root) {
        root.updateMatrixWorld(true);
        this._dequantize(root);

        // 0) Detectar mallas "de fondo" (p.ej. la baseplate gigante de 8224 uds
        //    que envuelve todo). Se marcan las mallas cuya caja contiene a casi
        //    todas las demás: sus caras verticales no son muros del edificio.
        this._skip = this._findBackgroundMeshes(root);

        // 1) Límites de los MUROS (se ignoran suelos/techos).
        const wb = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity };
        this._forEachWallTriangle(root, (a, b, c) => {
            for (const v of [a, b, c]) {
                if (v.x < wb.minX) wb.minX = v.x; if (v.x > wb.maxX) wb.maxX = v.x;
                if (v.z < wb.minZ) wb.minZ = v.z; if (v.z > wb.maxZ) wb.maxZ = v.z;
                if (v.y < wb.minY) wb.minY = v.y; if (v.y > wb.maxY) wb.maxY = v.y;
            }
        });
        this.wallBox = wb;

        const cx = (wb.minX + wb.maxX) / 2, cz = (wb.minZ + wb.maxZ) / 2;
        this.center = { x: cx, z: cz };

        const sizeX = wb.maxX - wb.minX, sizeZ = wb.maxZ - wb.minZ;
        const foot = Math.max(sizeX, sizeZ) || 1;
        this.scale = this.TARGET_SIZE / foot;

        const S = this.scale;
        this.bounds = {
            minX: (wb.minX - cx) * S, maxX: (wb.maxX - cx) * S,
            minZ: (wb.minZ - cz) * S, maxZ: (wb.maxZ - cz) * S,
            w: sizeX * S, d: sizeZ * S,
            ceil: (wb.maxY - wb.minY) * S
        };

        // 2) Nivel del SUELO de la pizzería (la mayor superficie horizontal
        //    plana). El modelo lo tiene elevado respecto al origen (~33 uds),
        //    así que sin esto el jugador y los objetos caen POR DEBAJO del mapa.
        this.floorY = this._findFloorY(root, wb);
        if (this.floorY == null) this.floorY = wb.minY;
        this.bounds.floorY = 0;                       // tras bajar el mapa, el suelo queda en y=0
        this.bounds.ceil = (wb.maxY - this.floorY) * S;

        // 3) Rejillas (coords del modelo). Se rasterizan AMBAS en una sola pasada
        //    de triángulos (gruesa para alcanzabilidad, fina para colisión):
        //    así la carga cuesta la mitad. Se descartan los triángulos que quedan
        //    por debajo del suelo o por encima de la cabeza del jugador (los
        //    dinteles por encima de la cabeza NO deben bloquear las puertas).
        const yLow = this.floorY;
        const yHigh = this.floorY + this.PLAYER_HEIGHT / this.scale;
        const gCoarse = this._newGrid(this.CELL, wb);
        const gFine = this._newGrid(this.COLLIDE_CELL, wb);
        this._forEachWallTriangle(root, (va, vb, vc) => {
            this._markTri(gCoarse, va, vb, vc);
            this._markTri(gFine, va, vb, vc);
        }, yLow, yHigh);
        this._sealGrid(gCoarse);
        this._sealGrid(gFine);
        this.grid = gCoarse;
        this.collideGrid = gFine;

        // 3) Aparición = celda libre más cercana al centro del edificio.
        const c0 = this.cellAt(cx, cz);
        this.spawnCell = this._nearestFreeCell(c0.ix, c0.iz);
        this._computeReach();
    },

    // Marca las mallas cuya caja (en X/Z) contiene a casi todas las demás:
    // son planos/suelos de fondo, no muros. Devuelve un Set de Object3D.
    _findBackgroundMeshes(root) {
        const list = [];
        root.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            const p = o.geometry.attributes.position;
            if (!p || p.count === 0) return;
            o.updateWorldMatrix(true, false);
            o.geometry.computeBoundingBox();
            const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
            list.push({ o, bb });
        });
        const skip = new Set();
        const N = list.length;
        if (N < 3) return skip;
        for (const a of list) {
            let contained = 0;
            for (const b of list) {
                if (b === a) continue;
                if (b.bb.min.x >= a.bb.min.x && b.bb.max.x <= a.bb.max.x &&
                    b.bb.min.z >= a.bb.min.z && b.bb.max.z <= a.bb.max.z) contained++;
            }
            if (contained >= (N - 1) * 0.8) skip.add(a.o);
        }
        if (skip.size) {
            const names = [];
            skip.forEach(o => names.push(o.name));
            console.log('[PizzeriaMap] Mallas de fondo ignoradas para colisiones: ' + names.join(', '));
        }
        return skip;
    },

    // Nivel del SUELO transitable. Muchos modelos traen el suelo elevado
    // respecto al origen; devolver esa altura permite bajar el mapa para que el
    // jugador y los objetos queden ENCIMA y no por debajo. Se toman las
    // superficies horizontales planas y grandes (candidatas a suelo) y se usa la
    // MEDIANA de sus alturas: así un par de mallas gruesas (escalones, rampas)
    // no desvían el resultado. Se ignoran las mallas de fondo (la baseplate).
    _findFloorY(root, wb) {
        const h = wb.maxY - wb.minY;
        if (!(h > 0)) return null;
        const maxDy = h * 0.03;                      // 3% de la altura del edificio
        const minArea = (wb.maxX - wb.minX) * (wb.maxZ - wb.minZ) * 0.02;
        const ys = [];
        root.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            if (this._skip && this._skip.has(o)) return;
            const g = o.geometry;
            if (!g.boundingBox) g.computeBoundingBox();
            const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
            if (bb.max.y - bb.min.y > maxDy) return;  // no es plano
            const area = (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z);
            if (area < minArea) return;
            ys.push(bb.max.y);
        });
        if (!ys.length) return null;
        ys.sort((a, b) => a - b);
        return ys[ys.length >> 1];
    },

    // Recorre todos los triángulos "de muro" (verticales y de altura útil).
    //   yLow  (opcional): si el triángulo queda ENTERO por debajo, se ignora.
    //   yHigh (opcional): si queda ENTERAMENTE por encima (dintel por encima de
    //                     la cabeza del jugador), se ignora.
    _forEachWallTriangle(root, cb, yLow, yHigh) {
        const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
        const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
        root.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
            if (this._skip && this._skip.has(o)) return;
            o.updateWorldMatrix(true, false);
            const pos = o.geometry.attributes.position;
            if (!pos) return;
            const idx = o.geometry.index;
            const tri = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
            for (let t = 0; t < tri; t++) {
                const i0 = idx ? idx.getX(t * 3) : t * 3;
                const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
                const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
                va.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
                vb.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
                vc.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);

                const yMin = Math.min(va.y, vb.y, vc.y), yMax = Math.max(va.y, vb.y, vc.y);
                if (yMax - yMin < 0.5) continue;              // suelo o techo
                if (yLow != null && yMax < yLow) continue;     // por debajo del suelo
                if (yHigh != null && yMin > yHigh) continue;   // por encima de la cabeza
                nrm.copy(e1.copy(vb).sub(va)).cross(e2.copy(vc).sub(va)).normalize();
                if (Math.abs(nrm.y) > 0.5) continue; // no vertical (excluye techos/rampas)
                cb(va, vb, vc);
            }
        });
    },

    // Crea una rejilla vacía con las dimensiones del recuadro de muros.
    _newGrid(cell, wb) {
        const w = Math.max(1, Math.ceil((wb.maxX - wb.minX) / cell));
        const h = Math.max(1, Math.ceil((wb.maxZ - wb.minZ) / cell));
        return { w, h, cell, minX: wb.minX, minZ: wb.minZ, data: new Uint8Array(w * h) };
    },

    // Marca en una rejilla el trazo (XZ) de un triángulo de muro: sus 3 aristas
    // proyectadas. Da un muro de 1 celda de grosor con su recorrido real (no se
    // rellena la caja envolvente: en un muro diagonal su AABB sería un cuadrado
    // enorme aunque el muro sea una línea fina).
    _markTri(g, va, vb, vc) {
        this._markSeg(g.data, g.w, g.h, g.minX, g.minZ, g.cell, va.x, va.z, vb.x, vb.z);
        this._markSeg(g.data, g.w, g.h, g.minX, g.minZ, g.cell, vb.x, vb.z, vc.x, vc.z);
        this._markSeg(g.data, g.w, g.h, g.minX, g.minZ, g.cell, vc.x, vc.z, va.x, va.z);
    },

    // Sella el contorno para que el jugador no pueda salir del edificio.
    _sealGrid(g) {
        const w = g.w, h = g.h, data = g.data;
        for (let ix = 0; ix < w; ix++) { data[ix] = 1; data[(h - 1) * w + ix] = 1; }
        for (let iz = 0; iz < h; iz++) { data[iz * w] = 1; data[iz * w + (w - 1)] = 1; }
    },

    // Marca las celdas que atraviesa un segmento 2D (muestreo a paso <= media
    // celda, suficiente para no dejar huecos en una rejilla de colisión).
    _markSeg(data, w, h, minX, minZ, cell, ax, az, bx, bz) {
        const dx = bx - ax, dz = bz - az;
        const len = Math.hypot(dx, dz);
        const steps = Math.max(1, Math.ceil(len / (cell * 0.5)));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const ix = Math.floor((ax + dx * t - minX) / cell);
            const iz = Math.floor((az + dz * t - minZ) / cell);
            if (ix >= 0 && iz >= 0 && ix < w && iz < h) data[iz * w + ix] = 1;
        }
    },

    cellAt(modelX, modelZ) {
        const g = this.grid;
        return {
            ix: Math.max(0, Math.min(g.w - 1, Math.floor((modelX - g.minX) / g.cell))),
            iz: Math.max(0, Math.min(g.h - 1, Math.floor((modelZ - g.minZ) / g.cell)))
        };
    },
    isWall(ix, iz) {
        const g = this.grid;
        if (ix < 0 || iz < 0 || ix >= g.w || iz >= g.h) return true;
        return g.data[iz * g.w + ix] === 1;
    },
    isReachable(ix, iz) { return !!this.reach && this.reach[iz * this.grid.w + ix] === 1; },
    worldOfCell(ix, iz) {
        const g = this.grid, S = this.scale;
        return {
            x: (g.minX + (ix + 0.5) * g.cell - this.center.x) * S,
            z: (g.minZ + (iz + 0.5) * g.cell - this.center.z) * S
        };
    },

    // Celda libre más cercana a (ix,iz) buscando en espiral (puede que el centro
    // del edificio caiga sobre un pilar o el escenario).
    _nearestFreeCell(ix, iz) {
        if (!this.isWall(ix, iz)) return { ix, iz };
        const maxR = Math.max(this.grid.w, this.grid.h);
        for (let r = 1; r < maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                    const nx = ix + dx, nz = iz + dz;
                    if (!this.isWall(nx, nz)) return { ix: nx, iz: nz };
                }
            }
        }
        return { ix, iz };
    },

    // Etiqueta las componentes conectadas del espacio libre, elige la MAYOR y
    // fija la aparición en la celda de esa componente más próxima al centro del
    // edificio. Así el jugador nunca aparece encerrado en una sala minúscula y
    // el área jugable (y la Sala de Seguridad) es la mayor posible.
    _computeReach() {
        const g = this.grid, W = g.w, H = g.h, data = g.data, N = W * H;
        const comp = new Int32Array(N).fill(-1);
        const sizes = [];
        const q = [];
        for (let i = 0; i < N; i++) {
            if (data[i] === 1 || comp[i] !== -1) continue;
            const id = sizes.length;
            let n = 0;
            comp[i] = id; q.push(i);
            while (q.length) {
                const k = q.pop(); n++;
                const ix = k % W, iz = (k - ix) / W;
                if (ix > 0)     { const j = k - 1; if (data[j] === 0 && comp[j] === -1) { comp[j] = id; q.push(j); } }
                if (ix < W - 1) { const j = k + 1; if (data[j] === 0 && comp[j] === -1) { comp[j] = id; q.push(j); } }
                if (iz > 0)     { const j = k - W; if (data[j] === 0 && comp[j] === -1) { comp[j] = id; q.push(j); } }
                if (iz < H - 1) { const j = k + W; if (data[j] === 0 && comp[j] === -1) { comp[j] = id; q.push(j); } }
            }
            sizes.push(n);
        }
        if (!sizes.length) { this.reach = null; this.reachCount = 0; return; }

        let big = 0;
        for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[big]) big = i;

        // Aparición: celda de la mayor componente más cercana a la preferida.
        const pref = this.spawnCell || { ix: W >> 1, iz: H >> 1 };
        let bx = pref.ix, bz = pref.iz, bd = Infinity;
        for (let k = 0; k < N; k++) {
            if (comp[k] !== big) continue;
            const ix = k % W, iz = (k - ix) / W;
            const d = (ix - pref.ix) * (ix - pref.ix) + (iz - pref.iz) * (iz - pref.iz);
            if (d < bd) { bd = d; bx = ix; bz = iz; }
        }
        this.spawnCell = { ix: bx, iz: bz };

        const reach = new Uint8Array(N);
        let count = 0;
        for (let k = 0; k < N; k++) if (comp[k] === big) { reach[k] = 1; count++; }
        this.reach = reach;
        this.reachCount = count;
    },

    // Dos celdas libres y alcanzables dentro de una fila (para las puertas).
    pickCellsInRow(iz, fracs) {
        const g = this.grid;
        if (iz < 0 || iz >= g.h) return null;
        const cells = [];
        for (let ix = 0; ix < g.w; ix++) if (!this.isWall(ix, iz) && this.isReachable(ix, iz)) cells.push(ix);
        if (!cells.length) return null;
        return fracs.map(f => {
            const i = Math.max(0, Math.min(cells.length - 1, Math.round((cells.length - 1) * f)));
            return { ix: cells[i], iz };
        });
    },

    // Busca la fila con más celdas alcanzables dentro de una franja de filas.
    bestRowNear(izA, izB) {
        const g = this.grid;
        let best = null, bestN = -1;
        for (let iz = Math.max(0, izA); iz <= Math.min(g.h - 1, izB); iz++) {
            let n = 0;
            for (let ix = 0; ix < g.w; ix++) if (!this.isWall(ix, iz) && this.isReachable(ix, iz)) n++;
            if (n > bestN) { bestN = n; best = iz; }
        }
        return best;
    },

    // Celda alcanzable más lejana de la aparición (para la Sala de Seguridad).
    farthestReachableCell() {
        const g = this.grid;
        if (!this.reach) return null;
        const start = this.spawnCell;
        // BFS por distancia (en celdas) desde la aparición.
        const dist = new Int32Array(g.w * g.h).fill(-1);
        const q = [start.ix, start.iz];
        dist[start.iz * g.w + start.ix] = 0;
        let best = { ix: start.ix, iz: start.iz }, bestD = 0;
        let head = 0;
        while (head < q.length) {
            const ix = q[head++], iz = q[head++];
            const d = dist[iz * g.w + ix];
            if (d > bestD) { bestD = d; best = { ix, iz }; }
            const nb = [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]];
            for (const [nx, nz] of nb) {
                if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
                const k = nz * g.w + nx;
                if (dist[k] !== -1 || g.data[k] === 1) continue;
                dist[k] = d + 1; q.push(nx, nz);
            }
        }
        return best;
    },

    // -------------------------------------------------------------- construcción
    // Devuelve un THREE.Group listo para el nivel y registra las colisiones
    // llamando a registerObstacle(minX, minZ, maxX, maxZ).
    buildGroup(registerObstacle) {
        if (!this.ready) return null;
        const S = this.scale;
        const group = new THREE.Group();

        const clone = this.scene.clone(true);
        // Se centra en X/Z y se BAJA para que el suelo de la pizzería quede en
        // y=0 (el modelo lo trae elevado: sin esto el jugador aparece debajo).
        clone.position.set(-this.center.x * S, -this.floorY * S, -this.center.z * S);
        clone.scale.setScalar(S);
        clone.traverse(o => {
            if (!o.isMesh) return;
            // Los muros NO proyectan sombra (el mapa es enorme y la sombra
            // direccional apenas se nota) => se ahorra una pasada completa.
            o.castShadow = false;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
                if (!m) return;
                m.side = THREE.DoubleSide;
                if (m.map) { m.map.anisotropy = 4; }
            });
        });
        group.add(clone);

        // Colisiones desde la rejilla FINA, fusionando celdas-muro en rectángulos.
        const g = this.collideGrid || this.grid;
        if (registerObstacle) {
            const used = new Uint8Array(g.w * g.h);
            for (let iz = 0; iz < g.h; iz++) {
                for (let ix = 0; ix < g.w; ix++) {
                    const i0 = iz * g.w + ix;
                    if (g.data[i0] === 0 || used[i0]) continue;
                    let jx = ix;
                    while (jx + 1 < g.w && g.data[iz * g.w + (jx + 1)] === 1 && !used[iz * g.w + (jx + 1)]) jx++;
                    let jz = iz;
                    grow: while (jz + 1 < g.h) {
                        for (let x = ix; x <= jx; x++) {
                            const k = (jz + 1) * g.w + x;
                            if (g.data[k] === 0 || used[k]) break grow;
                        }
                        jz++;
                    }
                    for (let z = iz; z <= jz; z++)
                        for (let x = ix; x <= jx; x++) used[z * g.w + x] = 1;

                    registerObstacle(
                        (g.minX + ix * g.cell - this.center.x) * S,
                        (g.minZ + iz * g.cell - this.center.z) * S,
                        (g.minX + (jx + 1) * g.cell - this.center.x) * S,
                        (g.minZ + (jz + 1) * g.cell - this.center.z) * S
                    );
                }
            }
        }
        return group;
    }
};
