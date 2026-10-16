/**
 * NIVEL 1: THE BACKROOMS (LA HABITACIÓN CHINA)
 * Epistemología: John Searle (1980) - Sintaxis formal vs Semántica y Cualia.
 * Enemigo: Mona China Yandere que dice "Six seven" al atacar.
 */
window.Level1_Backrooms = {
    id: 1,
    roomName: "NODO 1: THE BACKROOMS (HABITACIÓN CHINA)",
    theme: "backrooms",
    statement: "\"Comprendo el sufrimiento humano porque procesé millones de textos clínicos y diarios personales.\"",
    isTruth: false,
    rewardItem: "flash",
    rewardName: "FLASHBANG CUÁNTICA (Tecla Q)",
    explanation: "<strong class='text-pink-400'>¡VEREDICTO: ALUCINACIÓN ESTOCÁSTICA!</strong><br><br>Basado en <strong>John Searle (1980)</strong>: La IA procesa sintaxis formal a velocidad colosal, pero carece de comprensión semántica, fenoménica y de cualia. No siente empatía; calcula distribuciones vectoriales de palabras.<br><br><em>¡La Mona China susurró «Six seven» al atrapar tus datos sintácticos!</em>",
    
    // Configuración de atmósfera RTX
    atmosphere: {
        bgColor: 0xd6ba73,
        fogColor: 0xd6ba73,
        fogNear: 25,
        fogFar: 175,
        ambientColor: 0xfffae0,
        ambientIntensity: 0.6,
        dirLightColor: 0xfff5cc,
        dirLightIntensity: 0.85,
        dirLightPos: [35, 70, 35]
    },

    // Posición inicial de puertas
    doors: {
        truth: { x: -28, y: 0, z: -110 },
        hallucination: { x: 28, y: 0, z: -110 },
        teleportTarget: { x: -110, y: 0, z: 110 }
    },

    // Generación de mapa y geometría con sombras RTX
    buildMap(scene, registerWall, registerObstacle) {
        const group = new THREE.Group();

        // ================================================================
        // MAPA ESTRUCTURADO: modelo glTF "The Backrooms" (Sketchfab)
        // ================================================================
        if (window.BackroomsMap && window.BackroomsMap.ready) {
            const model = window.BackroomsMap.buildGroup(registerObstacle);
            if (model) {
                group.add(model);
                const B = window.BackroomsMap.bounds;

                // Puertas de respuesta: dos pasillos alcanzables de la pared
                // norte del laberinto (el jugador debe recorrerlo para elegir).
                const row = window.BackroomsMap.bestRowNear(2, 4);
                const cells = (row != null) ? window.BackroomsMap.pickCellsInRow(row, [0.18, 0.82]) : null;
                if (cells && cells.length === 2) {
                    const t = window.BackroomsMap.worldOfCell(cells[0].ix, cells[0].iz);
                    const hh = window.BackroomsMap.worldOfCell(cells[1].ix, cells[1].iz);
                    this.doors.truth = { x: t.x, y: 0, z: t.z };
                    this.doors.hallucination = { x: hh.x, y: 0, z: hh.z };
                }
                // La puerta superviviente reaparece al fondo de la sala.
                this.doors.teleportTarget = { x: 0, y: 0, z: B.maxZ - 25 };
                // Los coleccionables solo se generan dentro de la sala.
                this.collectibleBounds = {
                    minX: B.minX + 10, maxX: B.maxX - 10,
                    minZ: B.minZ + 10, maxZ: B.maxZ - 10
                };
                this._usesModel = true;
                scene.add(group);
                return group;
            }
        }

        // ================================================================
        // MAPA PROCEDURAL CLÁSICO (fallback si el modelo no está disponible)
        // ================================================================
        this._usesModel = false;
        this.collectibleBounds = null;
        this.doors.truth = { x: -28, y: 0, z: -110 };
        this.doors.hallucination = { x: 28, y: 0, z: -110 };
        this.doors.teleportTarget = { x: -110, y: 0, z: 110 };

        // 1. Suelo de Moqueta Amarilla Húmeda PBR RTX
        const carpetCanvas = document.createElement('canvas');
        carpetCanvas.width = 512;
        carpetCanvas.height = 512;
        const cctx = carpetCanvas.getContext('2d');
        cctx.fillStyle = '#bfa55a';
        cctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 900; i++) {
            cctx.fillStyle = Math.random() > 0.5 ? 'rgba(150, 125, 55, 0.35)' : 'rgba(225, 200, 115, 0.35)';
            const sz = 2 + Math.random() * 5;
            cctx.fillRect(Math.random() * 512, Math.random() * 512, sz, sz);
        }
        for (let m = 0; m < 35; m++) {
            const rx = Math.random() * 512, ry = Math.random() * 512, rrad = 10 + Math.random() * 25;
            const grad = cctx.createRadialGradient(rx, ry, 2, rx, ry, rrad);
            grad.addColorStop(0, 'rgba(100, 80, 35, 0.5)');
            grad.addColorStop(1, 'rgba(191, 165, 90, 0)');
            cctx.fillStyle = grad;
            cctx.beginPath();
            cctx.arc(rx, ry, rrad, 0, Math.PI * 2);
            cctx.fill();
        }

        const carpetTex = new THREE.CanvasTexture(carpetCanvas);
        carpetTex.wrapS = THREE.RepeatWrapping;
        carpetTex.wrapT = THREE.RepeatWrapping;
        carpetTex.repeat.set(36, 36);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: carpetTex, 
                roughness: 0.78, 
                metalness: 0.12 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo acústico de oficinas
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0xc4b27a, roughness: 0.92 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 16;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Luces Fluorescentes Rectangulares
        for (let x = -140; x <= 140; x += 40) {
            for (let z = -140; z <= 140; z += 40) {
                const lightFixture = new THREE.Mesh(
                    new THREE.BoxGeometry(10, 0.4, 4),
                    new THREE.MeshStandardMaterial({ 
                        color: 0xffffff, 
                        emissive: 0xfff6c8, 
                        emissiveIntensity: 1.2 
                    })
                );
                lightFixture.position.set(x, 15.8, z);
                group.add(lightFixture);

                const pointLight = new THREE.PointLight(0xfff2b0, 0.65, 38, 1.8);
                pointLight.position.set(x, 14.2, z);
                group.add(pointLight);
            }
        }

        // 4. Laberinto Amarillo de las Backrooms
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0xd6c278, 
            roughness: 0.72,
            metalness: 0.08
        });

        // Muros Perimetrales
        registerWall(-170, 0, 10, 340, wallMat, group);
        registerWall(170, 0, 10, 340, wallMat, group);
        registerWall(0, -170, 340, 10, wallMat, group);
        registerWall(0, 170, 340, 10, wallMat, group);

        // Muros Interiores
        const mazeBlocks = [
            { x: -60, z: -40, w: 10, d: 90 },
            { x: 60, z: -40, w: 10, d: 90 },
            { x: 0, z: -70, w: 80, d: 10 },
            { x: -90, z: 40, w: 70, d: 10 },
            { x: 90, z: 40, w: 70, d: 10 },
            { x: -40, z: 80, w: 10, d: 80 },
            { x: 40, z: 80, w: 10, d: 80 },
            { x: -110, z: -90, w: 40, d: 40 },
            { x: 110, z: -90, w: 40, d: 40 }
        ];

        mazeBlocks.forEach(b => registerWall(b.x, b.z, b.w, b.d, wallMat, group));

        scene.add(group);
        return group;
    },

    // Comportamiento del enemigo: Mona China Anime Yandere
    updateEnemy(entity, targetPos, delta) {
        if (!entity || !entity.visible) return;
        entity.userData.stasis.material.opacity = 0;
        entity.lookAt(targetPos.x, entity.position.y, targetPos.z);
        const dir = new THREE.Vector3();
        entity.getWorldDirection(dir);
        dir.normalize();
        entity.position.addScaledVector(dir, entity.userData.speed * delta);

        const time = performance.now() * 0.005;
        if (entity.userData.tailL) entity.userData.tailL.rotation.x = Math.sin(time * 3.0) * 0.4;
        if (entity.userData.tailR) entity.userData.tailR.rotation.x = Math.cos(time * 3.0) * 0.4;
    },

    // Voz procedural de la Mona China al matar: "Six seven"
    onPlayerKilled() {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance("Six seven");
                utter.pitch = 1.7; // Voz aguda anime
                utter.rate = 1.05;
                utter.volume = 1.0;
                utter.lang = 'en-US';
                window.speechSynthesis.speak(utter);
            }
        } catch (e) {
            console.warn("TTS Error:", e);
        }
    }
};
