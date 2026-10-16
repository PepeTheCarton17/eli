/**
 * LEVEL MANAGER: GESTOR DE NIVELES Y FÍSICAS MODULARES
 * Administra el ciclo de vida de los 6 niveles epistemológicos.
 */
window.LevelManager = {
    levels: [],
    currentIndex: 0,
    currentMapGroup: null,
    obstacles: [],
    collectibles: [],

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

        return level;
    },

    // Verificación de colisiones contra los muros del nivel activo únicamente
    checkCollision(px, pz, radius = 1.3) {
        for (let i = 0; i < this.obstacles.length; i++) {
            const obs = this.obstacles[i];
            if (px + radius > obs.minX && px - radius < obs.maxX &&
                pz + radius > obs.minZ && pz - radius < obs.maxZ) {
                return true;
            }
        }
        return false;
    },

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
        return { x, z };
    },

    // Generación de coleccionables en zonas transitables seguras (sin muros)
    spawnCollectibles(scene, count = 22) {
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
        while (spawned < count && attempts < 250) {
            attempts++;
            const px = cX + (Math.random() - 0.5) * 2 * halfX;
            const pz = cZ + (Math.random() - 0.5) * 2 * halfZ;

            if (Math.hypot(px, pz) < 18 || this.checkCollision(px, pz, 2.8)) {
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
