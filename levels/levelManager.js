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

        // 5. Construir geometría del nivel actual
        this.currentMapGroup = level.buildMap(scene, registerWall);

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
        while (spawned < count && attempts < 250) {
            attempts++;
            const px = (Math.random() - 0.5) * 240;
            const pz = (Math.random() - 0.5) * 240;

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
