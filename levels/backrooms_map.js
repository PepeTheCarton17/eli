/**
 * MAPA: THE BACKROOMS ORIGINALES (modelo glTF de Sketchfab)
 * Modelo: "Original Backrooms" de Huuxloc - Licencia CC-BY-4.0.
 *
 * Este modulo:
 *   1. Carga el modelo glTF de forma asincrona.
 *   2. Rasteriza sus muros (triangulos verticales) sobre una rejilla 2D,
 *      porque las mayas de muro son delgadas pero sus cajas contenedoras
 *      abarcan toda la sala y no sirven como colision directa.
 *   3. Calcula que zona es alcanzable desde el punto de aparicion (flood fill)
 *      para elegir posiciones validas de puertas y coleccionables.
 *   4. Construye un clon escalado/centrado y registra las colisiones.
 *
 * Si el modelo no carga (por ejemplo al abrir index.html con file://, donde
 * el navegador bloquea la lectura de archivos locales), el Nivel 1 cae
 * automaticamente al mapa procedural clasico.
 */
window.BackroomsMap = {
    URL: 'assets/backrooms/scene.gltf',
    SCALE: 6.0,      // 1 unidad del modelo -> 6 unidades del juego (techo ~16, igual que el mapa clasico)
    CELL: 1.0,       // resolucion de rasterizado en unidades del modelo

    ready: false,
    failed: false,
    _loading: false,
    scene: null,
    grid: null,      // { w, h, cell, minX, minZ, data: Uint8Array (1 = muro) }
    reach: null,     // Uint8Array: 1 = alcanzable desde la aparicion
    center: { x: 0, z: 0 },
    bounds: null,    // limites en unidades de juego (ya escalado y centrado)
    spawnCell: null, // { ix, iz } de la aparicion del jugador

    // ---------------------------------------------------------------- carga
    load(onDone) {
        if (this.ready || this._loading) { if (onDone) onDone(this.ready); return; }
        if (typeof THREE === 'undefined' || !THREE.GLTFLoader) { this.failed = true; if (onDone) onDone(false); return; }
        this._loading = true;
        const loader = new THREE.GLTFLoader();
        loader.load(this.URL, (gltf) => {
            try {
                this.scene = gltf.scene;
                this._process(gltf.scene);
                this.ready = true;
                console.log('[BackroomsMap] Sala cargada: ' + Math.round(this.bounds.w) + ' x ' + Math.round(this.bounds.d) +
                    ' uds, techo ' + Math.round(this.bounds.ceil) + ', ' + Math.round(this.bounds.w) + ' muros, zona alcanzable ' +
                    this.reachCount + ' celdas.');
            } catch (e) {
                console.warn('[BackroomsMap] Error procesando el modelo:', e);
                this.failed = true;
            } finally {
                this._loading = false;
                if (onDone) onDone(this.ready);
            }
        }, undefined, (e) => {
            console.warn('[BackroomsMap] No se pudo cargar el modelo (se usara el mapa procedural):', e && e.message ? e.message : e);
            this.failed = true;
            this._loading = false;
            if (onDone) onDone(false);
        });
    },

    // ------------------------------------------------------------ procesado
    _process(root) {
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const minX = box.min.x, maxX = box.max.x, minZ = box.min.z, maxZ = box.max.z;
        const cell = this.CELL;
        const w = Math.max(1, Math.ceil((maxX - minX) / cell));
        const h = Math.max(1, Math.ceil((maxZ - minZ) / cell));
        const data = new Uint8Array(w * h);

        const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
        const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();

        root.traverse(o => {
            if (!o.isMesh || !o.geometry) return;
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
                if (yMax - yMin < 0.5) continue;    // suelo o techo (plano horizontal)
                if (yMax < 0.35) continue;          // objeto bajo (zocalo, enchufe...)

                nrm.copy(e1.copy(vb).sub(va)).cross(e2.copy(vc).sub(va)).normalize();
                if (Math.abs(nrm.y) > 0.7) continue; // no es vertical

                const tminX = Math.min(va.x, vb.x, vc.x), tmaxX = Math.max(va.x, vb.x, vc.x);
                const tminZ = Math.min(va.z, vb.z, vc.z), tmaxZ = Math.max(va.z, vb.z, vc.z);
                const ix0 = Math.max(0, Math.floor((tminX - minX) / cell));
                const ix1 = Math.min(w - 1, Math.floor((tmaxX - minX) / cell));
                const iz0 = Math.max(0, Math.floor((tminZ - minZ) / cell));
                const iz1 = Math.min(h - 1, Math.floor((tmaxZ - minZ) / cell));
                for (let iz = iz0; iz <= iz1; iz++)
                    for (let ix = ix0; ix <= ix1; ix++)
                        data[iz * w + ix] = 1;
            }
        });

        // Sellar el contorno para que el jugador no pueda salir de la sala.
        for (let ix = 0; ix < w; ix++) { data[ix] = 1; data[(h - 1) * w + ix] = 1; }
        for (let iz = 0; iz < h; iz++) { data[iz * w] = 1; data[iz * w + (w - 1)] = 1; }

        this.grid = { w, h, cell, minX, minZ, data };
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
        this.center = { x: cx, z: cz };

        const S = this.SCALE;
        this.bounds = {
            minX: (minX - cx) * S, maxX: (maxX - cx) * S,
            minZ: (minZ - cz) * S, maxZ: (maxZ - cz) * S,
            w: (maxX - minX) * S, d: (maxZ - minZ) * S,
            ceil: (box.max.y - box.min.y) * S
        };

        // Celda de aparicion = punto (0,0) del mundo -> centro del modelo.
        this.spawnCell = this.cellAt(cx, cz);
        this._computeReach();
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
        const g = this.grid, S = this.SCALE;
        return {
            x: (g.minX + (ix + 0.5) * g.cell - this.center.x) * S,
            z: (g.minZ + (iz + 0.5) * g.cell - this.center.z) * S
        };
    },

    // Flood fill (4 direcciones) desde la aparicion.
    _computeReach() {
        const g = this.grid;
        const reach = new Uint8Array(g.w * g.h);
        const start = this.spawnCell;
        const q = [];
        if (!this.isWall(start.ix, start.iz)) { reach[start.iz * g.w + start.ix] = 1; q.push(start.ix, start.iz); }
        let count = 0;
        while (q.length) {
            const iz = q.pop(), ix = q.pop();
            count++;
            const nb = [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]];
            for (const [nx, nz] of nb) {
                if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
                const k = nz * g.w + nx;
                if (reach[k] || g.data[k] === 1) continue;
                reach[k] = 1; q.push(nx, nz);
            }
        }
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

    // Busca la fila con mas celdas alcanzables dentro de una franja de filas.
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

    // -------------------------------------------------------------- construccion
    // Devuelve un THREE.Group listo para el nivel, y registra las colisiones
    // llamando a registerObstacle(minX, minZ, maxX, maxZ).
    buildGroup(registerObstacle) {
        if (!this.ready) return null;
        const S = this.SCALE;
        const group = new THREE.Group();

        const clone = this.scene.clone(true);
        clone.position.set(-this.center.x * S, 0, -this.center.z * S);
        clone.scale.setScalar(S);
        clone.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
                if (!m) return;
                m.side = THREE.DoubleSide;
                // Mantener la densidad de texel al escalar el modelo.
                if (m.map) { m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.repeat.set(S, S); m.map.needsUpdate = true; }
                if (m.normalMap) { m.normalMap.wrapS = m.normalMap.wrapT = THREE.RepeatWrapping; m.normalMap.repeat.set(S, S); }
            });
        });
        group.add(clone);

        // Colisiones: fusionar cada fila de celdas-muro en tiradas horizontales.
        const g = this.grid;
        if (registerObstacle) {
            for (let iz = 0; iz < g.h; iz++) {
                let ix = 0;
                while (ix < g.w) {
                    if (g.data[iz * g.w + ix] === 0) { ix++; continue; }
                    let jx = ix;
                    while (jx + 1 < g.w && g.data[iz * g.w + (jx + 1)] === 1) jx++;
                    const x0 = (g.minX + ix * g.cell - this.center.x) * S;
                    const x1 = (g.minX + (jx + 1) * g.cell - this.center.x) * S;
                    const z0 = (g.minZ + iz * g.cell - this.center.z) * S;
                    const z1 = (g.minZ + (iz + 1) * g.cell - this.center.z) * S;
                    registerObstacle(x0, z0, x1, z1);
                    ix = jx + 1;
                }
            }
        }
        return group;
    }
};
