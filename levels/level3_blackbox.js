/**
 * NIVEL 3: LA CAJA NEGRA (OPACIDAD EPISTÉMICA)
 * Epistemología: Opacidad Epistémica (Humphreys, 2004) y Explicabilidad (XAI).
 * Enemigo: Kuudere AI / Slenderman (Weeping Angel por Dot Product).
 */
window.Level3_Blackbox = {
    id: 3,
    roomName: "NODO 3: LA CAJA NEGRA (OPACIDAD EPISTÉMICA)",
    theme: "blackbox",
    statement: "\"Debido a la Opacidad Epistémica, ni mis programadores pueden explicar el proceso exacto que produjo este diagnóstico médico.\"",
    isTruth: true,
    rewardItem: "shield",
    rewardName: "ESCUDO CORTAFUEGOS (Tecla R)",
    explanation: "<strong class='text-cyan-400'>¡VEREDICTO: TESTIMONIO REAL Y VÁLIDO!</strong><br><br>Describe la <strong>Opacidad Epistémica (Humphreys, 2004)</strong>: En redes neuronales profundas con miles de millones de parámetros latentes, resulta imposible auditar y explicar paso a paso la cadena causal de inferencias. ¡Has dominado la justificación del testimonio!",

    atmosphere: {
        bgColor: 0x03050c,
        fogColor: 0x03050c,
        fogNear: 25,
        fogFar: 180,
        ambientColor: 0x141828,
        ambientIntensity: 0.5,
        dirLightColor: 0x00f3ff,
        dirLightIntensity: 0.8,
        dirLightPos: [0, 80, 0]
    },

    doors: {
        truth: { x: -30, y: 0, z: -120 },
        hallucination: { x: 30, y: 0, z: -120 },
        teleportTarget: { x: 0, y: 0, z: 120 }
    },

    // Estado interno para la mecánica Weeping Angel
    lastTeleportCheck: 0,
    isBeingObserved: false,

    buildMap(scene, registerWall) {
        const group = new THREE.Group();

        // 1. Suelo Espejo Negro Matrix con Circuitos Neón PBR RTX
        const circuitCanvas = document.createElement('canvas');
        circuitCanvas.width = 512;
        circuitCanvas.height = 512;
        const ctx = circuitCanvas.getContext('2d');
        ctx.fillStyle = '#03050a';
        ctx.fillRect(0, 0, 512, 512);

        // Trazado de circuitos luminosos
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
        ctx.lineWidth = 3;
        for (let i = 40; i < 512; i += 80) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, 200); ctx.lineTo(i + 40, 240); ctx.lineTo(i + 40, 512);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i); ctx.lineTo(180, i); ctx.lineTo(220, i + 40); ctx.lineTo(512, i + 40);
            ctx.stroke();
        }

        // Puntos de soldadura / nodos latentes
        ctx.fillStyle = '#ff0077';
        for (let i = 40; i < 512; i += 80) {
            ctx.beginPath(); ctx.arc(i + 40, 240, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(220, i + 40, 5, 0, Math.PI * 2); ctx.fill();
        }

        const circuitTex = new THREE.CanvasTexture(circuitCanvas);
        circuitTex.wrapS = THREE.RepeatWrapping;
        circuitTex.wrapT = THREE.RepeatWrapping;
        circuitTex.repeat.set(24, 24);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: circuitTex, 
                roughness: 0.12, 
                metalness: 0.85 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo Cyber Matrix
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0x050711, roughness: 0.9 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 20;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Muros Perimetrales
        const cyberWallMat = new THREE.MeshStandardMaterial({ 
            color: 0x0c1322, 
            metalness: 0.7, 
            roughness: 0.35 
        });

        registerWall(-170, 0, 10, 340, cyberWallMat, group);
        registerWall(170, 0, 10, 340, cyberWallMat, group);
        registerWall(0, -170, 340, 10, cyberWallMat, group);
        registerWall(0, 170, 340, 10, cyberWallMat, group);

        // 4. Servidores y Monolitos de la Caja Negra (Arquitectura simétrica y despejada)
        // No bloquean puertas (-120) ni el centro del spawn (0, 0)
        const serverMat = new THREE.MeshStandardMaterial({ 
            color: 0x070b16, 
            roughness: 0.3, 
            metalness: 0.8 
        });

        const serverAisles = [
            // Pasillo Izquierdo
            { x: -75, z: -50, w: 12, d: 24 },
            { x: -75, z: 0, w: 12, d: 24 },
            { x: -75, z: 50, w: 12, d: 24 },
            // Pasillo Derecho
            { x: 75, z: -50, w: 12, d: 24 },
            { x: 75, z: 0, w: 12, d: 24 },
            { x: 75, z: 50, w: 12, d: 24 },
            // Monolitos Centrales Distribuidos
            { x: -35, z: -50, w: 10, d: 10 },
            { x: 35, z: -50, w: 10, d: 10 },
            { x: -35, z: 50, w: 10, d: 10 },
            { x: 35, z: 50, w: 10, d: 10 }
        ];

        serverAisles.forEach(s => {
            const mesh = registerWall(s.x, s.z, s.w, s.d, serverMat, group);
            if (mesh) {
                // Tiras LED en los servidores
                const ledStripGeo = new THREE.BoxGeometry(s.w * 0.9, 0.4, s.d * 0.95);
                const ledMat = new THREE.MeshStandardMaterial({
                    color: 0x00f3ff,
                    emissive: 0x00f3ff,
                    emissiveIntensity: 1.2
                });
                const ledStrip = new THREE.Mesh(ledStripGeo, ledMat);
                ledStrip.position.set(s.x, 8, s.z);
                group.add(ledStrip);
            }
        });

        // 5. Núcleo Holográfico de la Caja Negra en el centro superior
        const coreGeo = new THREE.OctahedronGeometry(8, 2);
        const coreMat = new THREE.MeshStandardMaterial({ 
            color: 0x7700ff, 
            emissive: 0x9900ff, 
            emissiveIntensity: 1.4,
            wireframe: true 
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 16, 0);
        group.add(core);

        const coreLight = new THREE.PointLight(0x9900ff, 1.8, 80, 1.8);
        coreLight.position.set(0, 14, 0);
        group.add(coreLight);

        scene.add(group);
        return group;
    },

    // Mecánica Slenderman / Weeping Angel con cálculo de Dot Product
    updateKuudereAI(entity, playerGroup, camera, delta) {
        if (!entity || !entity.visible) return;

        // Vector de visión de la cámara hacia adelante
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        // Vector desde la cámara/jugador hacia el enemigo
        const toEnemy = entity.position.clone().sub(playerGroup.position);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        toEnemy.normalize();

        // Producto Punto (Dot Product): > 0.35 significa que la cámara está apuntando al enemigo
        const dot = camDir.dot(toEnemy);
        const isObserved = (dot > 0.35);
        this.isBeingObserved = isObserved;

        if (isObserved) {
            // El jugador lo está mirando: ¡CONGELADO TOTALMENTE! (Efecto Weeping Angel)
            entity.userData.stasis.material.opacity = 0.5;
            entity.lookAt(playerGroup.position.x, entity.position.y, playerGroup.position.z);
        } else {
            // El jugador le dio la espalda: ¡ACECHA A MÁXIMA VELOCIDAD!
            // (Con navegación A*: rodea los muros en vez de atorarse.)
            entity.userData.stasis.material.opacity = 0;
            const sprintSpeed = 22.0; // Velocidad de pesadilla
            LevelManager.moveAgentToward(entity, playerGroup.position.x, playerGroup.position.z,
                sprintSpeed * delta, entity.userData.navRadius || 1.2);

            // Probabilidad de teletransporte instantáneo justo detrás si lleva tiempo sin ser visto
            const now = performance.now();
            if (now - this.lastTeleportCheck > 3500 && dist > 25) {
                this.lastTeleportCheck = now;
                if (Math.random() < 0.45) {
                    // Teletransportar a 12 unidades detrás de la cámara del
                    // jugador, pero SIEMPRE en un punto libre (nunca dentro
                    // de un muro: usaba la posición exacta, que podía chocar).
                    const behind = playerGroup.position.clone().sub(camDir.clone().multiplyScalar(12));
                    const spot = LevelManager.findFreeSpot(behind.x, behind.z, 0, 14, entity.userData.navRadius || 1.2);
                    entity.position.set(spot.x, 0, spot.z);
                }
            }
        }
    }
};
