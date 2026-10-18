/**
 * LEVEL MANAGER: GESTOR DE NIVELES Y FÍSICAS MODULARES
 * Administra el ciclo de vida de los 6 niveles epistemológicos.
 *
 * Además gestiona:
 *   - Índice espacial de obstáculos (checkCollision O(1) en vez de O(n)).
 *   - Rejilla de navegación por radio de agente + A* (caminos reales para que
 *     las seguidoras y los animatrónicos rodeen las paredes en vez de avanzar
 *     en línea recta y atorarse).
 *   - Reubicación SEGURA (nunca dentro de un muro ni en una zona sellada):
 *     aparición del jugador, puertas, enemigos y coleccionables.
 */
window.LevelManager = {
    levels: [],
    currentIndex: 0,
    currentMapGroup: null,
    obstacles: [],
    collectibles: [],

    // --- Navegación / índice espacial -----------------------------------
    _obsGrid: null,        // rejilla espacial de obstáculos (bounds + cajas)
    _navCache: {},         // rejillas de navegación cacheadas por radio
    _navCell: 1.2,         // tamaño de celda de navegación (unidades de juego)
    _navState: new WeakMap(), // estado de ruta por entidad ( waypoints, etc.)

    init() {
        this.levels = [
            window.Level1_Backrooms,
            window.Level2_FNAF,
            window.Level3_Blackbox,
            window.Level4_StochasticParrots,
            window.Level5_ModelCollapse,
            window.Level6_TestimonialJustice
        ];
    },

    getCurrentLevel() {
        return this.levels[this.currentIndex];
    },

    loadLevel(index, scene, dirLight, ambientLight) {
        if (index < 0 || index >= this.levels.length) return null;
        this.currentIndex = index;
        const level = this.levels[index];

        // 1. Limpiar mapa anterior si existe
        if (this.currentMapGroup) {
            scene.remove(this.currentMapGroup);
            this.currentMapGroup = null;
        }

        // 2. VACIAR COMPLETAMENTE EL ARRAY DE COLISIONES
        // Garantiza que no haya muros fantasmas de otros niveles
        this.obstacles = [];
        this._obsGrid = null;
        this._navCache = {};

        // 3. Ajustar atmósfera y luces RTX para el nivel
        if (level.atmosphere) {
            scene.background.setHex(level.atmosphere.bgColor);
            if (scene.fog) {
                scene.fog.color.setHex(level.atmosphere.fogColor);
                scene.fog.near = level.atmosphere.fogNear;
                scene.fog.far = level.atmosphere.fogFar;
            }

            if (ambientLight) {
                ambientLight.color.setHex(level.atmosphere.ambientColor);
                ambientLight.intensity = level.atmosphere.ambientIntensity;
            }

            if (dirLight) {
                dirLight.color.setHex(level.atmosphere.dirLightColor);
                dirLight.intensity = level.atmosphere.dirLightIntensity;
                dirLight.position.set(...level.atmosphere.dirLightPos);
                dirLight.castShadow = true;
            }
        }

        // Recorte lejano: nada más allá de la niebla es visible, así que se
        // limita el frustum de la cámara para descartar objetos invisibles.
        if (typeof camera !== 'undefined' && camera && scene.fog) {
            camera.far = Math.max(260, scene.fog.far + 100);
            camera.updateProjectionMatrix();
        }

        // 4. Callback para registrar muros con sombras RTX activas
        const registerWall = (x, z, w, d, mat, parentGroup) => {
            const wallGeo = new THREE.BoxGeometry(w, 16, d);
            const wall = new THREE.Mesh(wallGeo, mat);
            wall.position.set(x, 8, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            parentGroup.add(wall);

            this.obstacles.push({
                minX: x - w / 2,
                maxX: x + w / 2,
                minZ: z - d / 2,
                maxZ: z + d / 2
            });
            return wall;
        };

        // 4b. Registro de colisión sin geometría (lo usan los mapas cargados
        //     desde modelos, cuyos muros ya existen como mallas)
        const registerObstacle = (minX, minZ, maxX, maxZ) => {
            this.obstacles.push({ minX, maxX, minZ, maxZ });
        };

        // 5. Construir geometría del nivel actual
        this.currentMapGroup = level.buildMap(scene, registerWall, registerObstacle);

        // 6. Índice espacial: acelera TODAS las comprobaciones de colisión
        //    (los mapas-modelo traen miles de cajas de muro).
        this._buildObsGrid();

        return level;
    },

    // ---------------------------------------------------------- obstáculos
    // Rejilla uniforme con los índices de las cajas que toca cada celda.
    _buildObsGrid() {
        this._obsGrid = null;
        if (!this.obstacles.length) return;

        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        for (const o of this.obstacles) {
            if (o.minX < minX) minX = o.minX;
            if (o.maxX > maxX) maxX = o.maxX;
            if (o.minZ < minZ) minZ = o.minZ;
            if (o.maxZ > maxZ) maxZ = o.maxZ;
        }

        const cell = 6;
        const w = Math.max(1, Math.ceil((maxX - minX) / cell));
        const h = Math.max(1, Math.ceil((maxZ - minZ) / cell));
        const cells = new Array(w * h);

        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            const ix0 = Math.max(0, Math.floor((o.minX - minX) / cell));
            const ix1 = Math.min(w - 1, Math.floor((o.maxX - minX) / cell));
            const iz0 = Math.max(0, Math.floor((o.minZ - minZ) / cell));
            const iz1 = Math.min(h - 1, Math.floor((o.maxZ - minZ) / cell));
            for (let iz = iz0; iz <= iz1; iz++) {
                for (let ix = ix0; ix <= ix1; ix++) {
                    const k = iz * w + ix;
                    if (!cells[k]) cells[k] = [];
                    cells[k].push(i);
                }
            }
        }

        this._obsGrid = { minX, minZ, maxX, maxZ, cell, w, h, cells };
    },

    // Verificación de colisiones contra los muros del nivel activo únicamente.
    // Mismo criterio que siempre: el agente se trata como un cuadrado de
    // semi-lado `radius` que no puede solapar ninguna caja.
    checkCollision(px, pz, radius = 1.3) {
        const g = this._obsGrid;
        if (!g) {
            for (let i = 0; i < this.obstacles.length; i++) {
                const obs = this.obstacles[i];
                if (px + radius > obs.minX && px - radius < obs.maxX &&
                    pz + radius > obs.minZ && pz - radius < obs.maxZ) {
                    return true;
                }
            }
            return false;
        }

        const ix0 = Math.max(0, Math.floor((px - radius - g.minX) / g.cell));
        const ix1 = Math.min(g.w - 1, Math.floor((px + radius - g.minX) / g.cell));
        const iz0 = Math.max(0, Math.floor((pz - radius - g.minZ) / g.cell));
        const iz1 = Math.min(g.h - 1, Math.floor((pz + radius - g.minZ) / g.cell));
        if (ix0 > ix1 || iz0 > iz1) return false;

        for (let iz = iz0; iz <= iz1; iz++) {
            const row = iz * g.w;
            for (let ix = ix0; ix <= ix1; ix++) {
                const list = g.cells[row + ix];
                if (!list) continue;
                for (let n = 0; n < list.length; n++) {
                    const obs = this.obstacles[list[n]];
                    if (px + radius > obs.minX && px - radius < obs.maxX &&
                        pz + radius > obs.minZ && pz - radius < obs.maxZ) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    // ¿Hay línea recta libre entre dos puntos para un agente de ese radio?
    lineClear(x1, z1, x2, z2, radius = 1.3) {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.0001) return !this.checkCollision(x1, z1, radius);
        const step = Math.max(0.4, radius * 0.7);
        const n = Math.min(600, Math.ceil(len / step));
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            if (this.checkCollision(x1 + dx * t, z1 + dz * t, radius)) return false;
        }
        return true;
    },

    // ---------------------------------------------------------- navegación
    // Rejilla de celdas libres/bloqueadas para un agente de `radius`.
    _getNavGrid(radius) {
        const cell = this._navCell;
        const key = Math.round(radius * 100) + ':' + cell;
        if (!this._navCache) this._navCache = {};
        if (key in this._navCache) return this._navCache[key];
        const grid = this._buildNavGrid(radius, cell);
        this._navCache[key] = grid;
        return grid;
    },

    _buildNavGrid(radius, cell) {
        const og = this._obsGrid;
        if (!og) return null;   // mapa sin muros: todo es transitable

        const w = Math.max(1, Math.round((og.maxX - og.minX) / cell));
        const h = Math.max(1, Math.round((og.maxZ - og.minZ) / cell));
        const data = new Uint8Array(w * h);   // 1 = bloqueado para este radio

        for (const o of this.obstacles) {
            // Celda bloqueada si su CENTRO cae dentro de la caja expandida
            // por el radio del agente (mismo criterio que checkCollision).
            const ix0 = Math.max(0, Math.ceil((o.minX - radius - og.minX) / cell - 0.5));
            const ix1 = Math.min(w - 1, Math.floor((o.maxX + radius - og.minX) / cell - 0.5));
            const iz0 = Math.max(0, Math.ceil((o.minZ - radius - og.minZ) / cell - 0.5));
            const iz1 = Math.min(h - 1, Math.floor((o.maxZ + radius - og.minZ) / cell - 0.5));
            for (let iz = iz0; iz <= iz1; iz++) {
                const row = iz * w;
                for (let ix = ix0; ix <= ix1; ix++) data[row + ix] = 1;
            }
        }

        return { w, h, cell, minX: og.minX, minZ: og.minZ, data, comp: null, sizes: null, big: -1 };
    },

    _cellOf(grid, x, z) {
        const ix = Math.floor((x - grid.minX) / grid.cell);
        const iz = Math.floor((z - grid.minZ) / grid.cell);
        if (ix < 0 || iz < 0 || ix >= grid.w || iz >= grid.h) return null;
        return { ix, iz, k: iz * grid.w + ix };
    },

    // Etiqueta las componentes conectadas (8 direcciones sin cortar esquinas,
    // la misma regla que usa A*). Se calcula una vez por rejilla.
    _navComponents(grid) {
        if (grid.comp) return grid;
        const N = grid.w * grid.h;
        const comp = new Int32Array(N).fill(-1);
        const sizes = [];
        const stack = new Int32Array(N);
        const W = grid.w, H = grid.h, data = grid.data;

        const free8 = (k, ix, iz) => {
            // movimiento diagonal permitido solo si no se corta una esquina
            if (ix > 0 && data[k - 1]) return false;
            if (ix < W - 1 && data[k + 1]) return false;
            if (iz > 0 && data[k - W]) return false;
            if (iz < H - 1 && data[k + W]) return false;
            return true;
        };

        for (let i = 0; i < N; i++) {
            if (data[i] || comp[i] !== -1) continue;
            const id = sizes.length;
            let n = 0, top = 0;
            stack[top++] = i;
            comp[i] = id;
            while (top) {
                const k = stack[--top];
                n++;
                const ix = k % W, iz = (k - ix) / W;
                const push = (j, jx, jz) => {
                    if (data[j] || comp[j] !== -1) return;
                    const diag = (jx !== ix && jz !== iz);
                    if (diag && !free8(k, ix, iz)) return;
                    comp[j] = id;
                    stack[top++] = j;
                };
                if (ix > 0) push(k - 1, ix - 1, iz);
                if (ix < W - 1) push(k + 1, ix + 1, iz);
                if (iz > 0) push(k - W, ix, iz - 1);
                if (iz < H - 1) push(k + W, ix, iz + 1);
                if (ix > 0 && iz > 0) push(k - W - 1, ix - 1, iz - 1);
                if (ix < W - 1 && iz > 0) push(k - W + 1, ix + 1, iz - 1);
                if (ix > 0 && iz < H - 1) push(k + W - 1, ix - 1, iz + 1);
                if (ix < W - 1 && iz < H - 1) push(k + W + 1, ix + 1, iz + 1);
            }
            sizes.push(n);
        }

        let big = -1;
        for (let i = 0; i < sizes.length; i++) if (big < 0 || sizes[i] > sizes[big]) big = i;
        grid.comp = comp;
        grid.sizes = sizes;
        grid.big = big;
        return grid;
    },

    // ¿Puede un agente de `radius` ir de (x1,z1) a (x2,z2)? (misma zona)
    isReachable(x1, z1, x2, z2, radius = 1.3) {
        const grid = this._getNavGrid(radius);
        if (!grid) return !this.checkCollision(x2, z2, radius);
        this._navComponents(grid);
        const a = this._cellOf(grid, x1, z1);
        const b = this._cellOf(grid, x2, z2);
        if (!a || !b) return false;
        if (grid.data[a.k] || grid.data[b.k]) return false;
        return grid.comp[a.k] === grid.comp[b.k];
    },

    // Punto libre más cercano dentro de la zona navegable MÁS GRANDE.
    // Evita apariciones dentro de un muro o en un callejón sellado.
    findSafeSpawn(x, z, radius = 1.3, maxR = 70) {
        const grid = this._getNavGrid(radius);
        const okBig = (px, pz) => {
            if (this.checkCollision(px, pz, radius)) return false;
            if (!grid) return true;
            const c = this._cellOf(grid, px, pz);
            if (!c || grid.data[c.k]) return false;
            this._navComponents(grid);
            return grid.comp[c.k] === grid.big;
        };
        if (okBig(x, z)) return { x, z };

        // Anillos concéntricos con paso fino: primero zonas conectadas...
        for (let d = 1; d <= maxR; d += 1) {
            const per = Math.max(16, Math.min(64, Math.round(d * 3)));
            for (let a = 0; a < per; a++) {
                const ang = (a / per) * Math.PI * 2 + d * 0.31;
                const px = x + Math.cos(ang) * d;
                const pz = z + Math.sin(ang) * d;
                if (okBig(px, pz)) return { x: px, z: pz };
            }
        }
        // ...y si no, al menos un punto libre (aunque no esté conectado).
        if (!this.checkCollision(x, z, radius)) return { x, z };
        return this.findFreeSpot(x, z, 0, maxR, radius, 0, true);
    },

    // Punto libre y CONECTADO con (refX,refZ) más cercano a (x,z).
    // Sirve para reubicar puertas y enemigos sin mandarlos a zonas inalcanzables.
    findConnectedSpot(x, z, refX, refZ, radius = 1.3, maxR = 160) {
        const ok = (px, pz) =>
            !this.checkCollision(px, pz, radius) &&
            this.isReachable(refX, refZ, px, pz, radius);

        if (ok(x, z)) return { x, z };
        for (let d = 1; d <= maxR; d += Math.max(1, d * 0.12)) {
            const per = Math.max(16, Math.min(72, Math.round(d * 2)));
            for (let a = 0; a < per; a++) {
                const ang = (a / per) * Math.PI * 2 + d * 0.27;
                const px = x + Math.cos(ang) * d;
                const pz = z + Math.sin(ang) * d;
                if (ok(px, pz)) return { x: px, z: pz };
            }
        }
        if (ok(x, z)) return { x, z };
        return this.findFreeSpot(x, z, 0, 60, radius, 0, true);
    },

    // ------------------------------------------------------- A* + steering
    // Camino de celdas desde (sx,sz) hasta (tx,tz) para un agente de `radius`.
    // Devuelve [{x,z},...] sin el punto de partida, o null si no hay camino.
    findPath(sx, sz, tx, tz, radius = 1.3) {
        const grid = this._getNavGrid(radius);
        if (!grid) return null;
        this._navComponents(grid);
        const W = grid.w, H = grid.h, data = grid.data;

        const nearestFree = (x, z, maxC = 10) => {
            const c = this._cellOf(grid, x, z);
            if (!c) return null;
            if (!data[c.k] && grid.comp[c.k] === grid.big) return c.k;
            for (let r = 1; r <= maxC; r++) {
                for (let dz = -r; dz <= r; dz++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                        const ix = c.ix + dx, iz = c.iz + dz;
                        if (ix < 0 || iz < 0 || ix >= W || iz >= H) continue;
                        const k = iz * W + ix;
                        if (!data[k] && grid.comp[k] === grid.big) return k;
                    }
                }
            }
            return null;
        };

        const s = nearestFree(sx, sz);
        const g = nearestFree(tx, tz);
        if (s == null || g == null) return null;
        if (s === g) return [{ x: tx, z: tz }];

        const N = W * H;
        const came = new Int32Array(N).fill(-1);
        const gScore = new Float64Array(N).fill(Infinity);
        const closed = new Uint8Array(N);
        const hCost = (k) => {
            const ix = k % W, iz = (k - ix) / W;
            const gx = g % W, gz = (g - gx) / W;
            const dx = Math.abs(ix - gx), dz = Math.abs(iz - gz);
            return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); // octogonal
        };
        // montículo binario simple (índices de celda)
        const heap = [];
        const push = (k, f) => {
            heap.push({ k, f });
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p].f <= heap[i].f) break;
                const t = heap[p]; heap[p] = heap[i]; heap[i] = t;
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length) {
                heap[0] = last;
                let i = 0;
                for (;;) {
                    const l = i * 2 + 1, r = l + 1;
                    let m = i;
                    if (l < heap.length && heap[l].f < heap[m].f) m = l;
                    if (r < heap.length && heap[r].f < heap[m].f) m = r;
                    if (m === i) break;
                    const t = heap[m]; heap[m] = heap[i]; heap[i] = t;
                    i = m;
                }
            }
            return top;
        };

        gScore[s] = 0;
        push(s, hCost(s));
        let found = false;
        let guard = 0;
        while (heap.length && guard++ < N * 4) {
            const cur = pop();
            const k = cur.k;
            if (closed[k]) continue;
            closed[k] = 1;
            if (k === g) { found = true; break; }
            const ix = k % W, iz = (k - ix) / W;
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dz) continue;
                    const nx = ix + dx, nz = iz + dz;
                    if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
                    const j = nz * W + nx;
                    if (data[j] || closed[j]) continue;
                    if (dx && dz) {
                        // no cortar esquinas
                        if (data[iz * W + nx] || data[nz * W + ix]) continue;
                    }
                    const step = (dx && dz) ? Math.SQRT2 : 1;
                    const tentative = gScore[k] + step;
                    if (tentative < gScore[j]) {
                        gScore[j] = tentative;
                        came[j] = k;
                        push(j, tentative + hCost(j));
                    }
                }
            }
        }
        if (!found) return null;

        // reconstruir
        const cells = [];
        let k = g;
        while (k !== -1) {
            const ix = k % W, iz = (k - ix) / W;
            cells.push({
                x: grid.minX + (ix + 0.5) * grid.cell,
                z: grid.minZ + (iz + 0.5) * grid.cell
            });
            k = came[k];
        }
        cells.reverse();
        cells[cells.length - 1] = { x: tx, z: tz };

        // "string pulling": eliminar waypoints innecesarios con línea recta
        const out = [];
        let i = 0;
        while (i < cells.length - 1) {
            let j = cells.length - 1;
            while (j > i + 1 && !this.lineClear(cells[i].x, cells[i].z, cells[j].x, cells[j].z, radius)) j--;
            out.push(cells[j]);
            i = j;
        }
        return out;
    },

    // Estado de navegación de una entidad (waypoints + destino cacheado).
    _steer(ent, tx, tz, radius, now) {
        const st = this._navState.get(ent) || {};
        const p = ent.position;

        if (this.lineClear(p.x, p.z, tx, tz, radius)) {
            st.path = null;
            st.tx = tx; st.tz = tz; st.born = now;
            this._navState.set(ent, st);
            return null;   // línea directa: no hace falta ruta
        }

        const stale = !st.path ||
            Math.abs(st.tx - tx) + Math.abs(st.tz - tz) > 4 ||
            now - (st.born || 0) > 800 ||
            st.i >= st.path.length;

        if (stale) {
            const path = this.findPath(p.x, p.z, tx, tz, radius);
            st.path = path;
            st.i = 0;
            st.tx = tx; st.tz = tz; st.born = now;
            this._navState.set(ent, st);
        }
        if (!st.path || !st.path.length) return null;

        // Avanzar al siguiente waypoint cuando el actual está a la vista
        while (st.i < st.path.length - 1 &&
               this.lineClear(p.x, p.z, st.path[st.i].x, st.path[st.i].z, radius)) {
            st.i++;
        }
        const wp = st.path[st.i];
        if (Math.hypot(wp.x - p.x, wp.z - p.z) < Math.max(1.2, radius) &&
            st.i < st.path.length - 1) {
            st.i++;
        }
        return st.path[st.i];
    },

    // Dirección unitaria hacia (tx,tz) rodeando muros. {x:0,z:0} si no avanza.
    steerTo(ent, tx, tz, radius = 1.3) {
        const p = ent.position;
        const dx = tx - p.x, dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.0001) return { x: 0, z: 0 };
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const wp = this._steer(ent, tx, tz, radius, now);
        let ax = dx, az = dz;
        if (wp) { ax = wp.x - p.x; az = wp.z - p.z; }
        const ad = Math.hypot(ax, az);
        if (ad < 0.0001) return { x: 0, z: 0 };
        return { x: ax / ad, z: az / ad };
    },

    // Desplaza (dx,dz) resolviendo eje por eje: se desliza por los muros.
    // Recuperación anti-estancamiento: si el agente lleva varios frames sin
    // moverse siguiendo una ruta (la rejilla discreta y la colisión exacta
    // pueden discrepar en pasillos ajustados), salta al siguiente waypoint o
    // descarta la ruta para que se recalcule.
    moveAgentBy(ent, dx, dz, radius = 1.3) {
        let moved = 0;
        if (!this.checkCollision(ent.position.x + dx, ent.position.z, radius)) {
            ent.position.x += dx;
            moved += Math.abs(dx);
        }
        if (!this.checkCollision(ent.position.x, ent.position.z + dz, radius)) {
            ent.position.z += dz;
            moved += Math.abs(dz);
        }
        const st = this._navState.get(ent);
        if (st && st.path) {
            if (moved < 1e-4) {
                st.stuck = (st.stuck || 0) + 1;
                if (st.stuck >= 8) {
                    st.stuck = 0;
                    if (st.i < st.path.length - 1) st.i++;  // waypoint problemático
                    else st.path = null;                     // recalcula la ruta
                }
            } else {
                st.stuck = 0;
            }
        }
        return moved;
    },

    // Camina hacia (tx,tz) rodeando muros y gira hacia donde se mueve.
    moveAgentToward(ent, tx, tz, dist, radius = 1.3) {
        const dir = this.steerTo(ent, tx, tz, radius);
        if (!dir.x && !dir.z) return 0;
        ent.rotation.y = Math.atan2(dir.x, dir.z);
        return this.moveAgentBy(ent, dir.x * dist, dir.z * dist, radius);
    },

    // -------------------------------------------------- reubicación segura
    // Punto libre (sin colisión) cerca de (x,z) buscando en anillos concéntricos.
    // Sirve para recolocar al jugador, a la seguidora o a los animatrónicos
    // SIEMPRE dentro del mapa (usa `collectibleBounds` si el nivel lo define) y
    // sin quedar atrapados en un muro. Antes el reintento los ponía fuera.
    //   keepIfFree = true  -> si (x,z) ya es válido, se devuelve tal cual (mover
    //                         al jugador lo justo).
    //   keepIfFree = false -> SIEMPRE busca a distancia [minDist,maxDist] (para
    //                         colocar lejos a la chica/quien persigue, nunca
    //                         encima del jugador).
    findFreeSpot(x, z, minDist = 6, maxDist = 20, radius = 1.3, phase = 0, keepIfFree = true) {
        const b = (this.getCurrentLevel() && this.getCurrentLevel().collectibleBounds) || null;
        const inside = (px, pz) => !b || (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ);
        const free = (px, pz) => inside(px, pz) && !this.checkCollision(px, pz, radius);

        if (keepIfFree && free(x, z)) return { x, z };

        const rings = 26, per = 24;
        // 1) Anillos de minDist a maxDist.
        for (let r = 0; r < rings; r++) {
            const d = minDist + (maxDist - minDist) * (r / (rings - 1));
            for (let a = 0; a < per; a++) {
                const ang = (a / per) * Math.PI * 2 + r * 0.35 + phase;
                const px = x + Math.cos(ang) * d;
                const pz = z + Math.sin(ang) * d;
                if (free(px, pz)) return { x: px, z: pz };
            }
        }
        // 2) Respaldo: si no hay hueco (p.ej. junto a una esquina), acercarse.
        for (let r = 0; r < rings; r++) {
            const d = Math.max(1.5, minDist) * (1 - r / rings);
            for (let a = 0; a < per; a++) {
                const ang = (a / per) * Math.PI * 2 + r * 0.35 + phase;
                const px = x + Math.cos(ang) * d;
                const pz = z + Math.sin(ang) * d;
                if (free(px, pz)) return { x: px, z: pz };
            }
        }
        // 3) Último recurso: punto sin muro encima aunque esté fuera de bounds.
        if (!this.checkCollision(x, z, radius)) return { x, z };
        for (let r = 0; r < rings; r++) {
            const d = minDist + (maxDist - minDist) * (r / (rings - 1));
            for (let a = 0; a < per; a++) {
                const ang = (a / per) * Math.PI * 2 + r * 0.35 + phase;
                const px = x + Math.cos(ang) * d;
                const pz = z + Math.sin(ang) * d;
                if (!this.checkCollision(px, pz, radius)) return { x: px, z: pz };
            }
        }
        return { x, z };
    },

    // Generación de coleccionables en zonas transitables seguras (sin muros)
    spawnCollectibles(scene, count = 22, cx = 0, cz = 0) {
        this.collectibles.forEach(item => {
            if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
        });
        this.collectibles = [];

        const shardGeo = new THREE.OctahedronGeometry(1.2, 0);
        const shardMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ff66, 
            emissive: 0x00ff66, 
            emissiveIntensity: 1.1, 
            metalness: 0.3, 
            roughness: 0.2 
        });

        let spawned = 0;
        let attempts = 0;
        // Algunos niveles (p.ej. el modelo de Backrooms) limitan la zona útil
        // con `collectibleBounds`; si no existe, se usa el cuadrado clásico.
        const b = (this.getCurrentLevel() && this.getCurrentLevel().collectibleBounds) || null;
        const halfX = b ? (b.maxX - b.minX) / 2 : 120;
        const halfZ = b ? (b.maxZ - b.minZ) / 2 : 120;
        const cX = b ? (b.maxX + b.minX) / 2 : 0;
        const cZ = b ? (b.maxZ + b.minZ) / 2 : 0;
        while (spawned < count && attempts < 400) {
            attempts++;
            const px = cX + (Math.random() - 0.5) * 2 * halfX;
            const pz = cZ + (Math.random() - 0.5) * 2 * halfZ;

            // No aparecer encima del jugador ni dentro de un muro.
            if (Math.hypot(px - cx, pz - cz) < 18 || this.checkCollision(px, pz, 2.8)) {
                continue;
            }

            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.set(px, 2.0, pz);
            shard.castShadow = true;
            scene.add(shard);

            this.collectibles.push({
                mesh: shard,
                active: true,
                baseY: 2.0
            });
            spawned++;
        }

        return this.collectibles;
    }
};
