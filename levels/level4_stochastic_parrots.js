/**
 * NIVEL 4: EL VÓRTICE DE DATOS (LOROS ESTOCÁSTICOS)
 * Epistemología: Emily Bender & Timnit Gebru (2021) - Falta de Intencionalidad y Symbol Grounding Problem.
 */
window.Level4_StochasticParrots = {
    id: 4,
    roomName: "NODO 4: EL VÓRTICE DE DATOS (LOROS ESTOCÁSTICOS)",
    theme: "stochastic_parrots",
    statement: "\"Poseo un modelo interno de la realidad física y creencias justificadas sobre el mundo empírico.\"",
    isTruth: false,
    rewardItem: "emp",
    rewardName: "SOBRECARGA EMP (+1 EMP)",
    explanation: "<strong class='text-pink-400'>¡VEREDICTO: ALUCINACIÓN! (Ilusión de Intencionalidad)</strong><br><br>Basado en <strong>Emily Bender y Timnit Gebru (2021)</strong>: Los modelos masivos de lenguaje son <em>Loros Estocásticos</em>. Generan secuencias plausibles de tokens maximizando verosimilitud estadística, pero carecen de anclaje referencial con el mundo empírico (<em>Symbol Grounding Problem</em>). No 'saben' nada; reproducen correlaciones sin intencionalidad.",

    atmosphere: {
        bgColor: 0x031820,
        fogColor: 0x031820,
        fogNear: 25,
        fogFar: 180,
        ambientColor: 0x103040,
        ambientIntensity: 0.55,
        dirLightColor: 0x00ffd5,
        dirLightIntensity: 0.85,
        dirLightPos: [-30, 75, 30]
    },

    doors: {
        truth: { x: -45, y: 0, z: -110 },
        hallucination: { x: 45, y: 0, z: -110 },
        teleportTarget: { x: -95, y: 0, z: 95 }
    },

    buildMap(scene, registerWall) {
        const group = new THREE.Group();

        // 1. Suelo Turquesa de Datos con Trazas Vectoriales PBR RTX
        const dataCanvas = document.createElement('canvas');
        dataCanvas.width = 512;
        dataCanvas.height = 512;
        const ctx = dataCanvas.getContext('2d');
        ctx.fillStyle = '#02131a';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = 'rgba(0, 255, 213, 0.4)';
        ctx.lineWidth = 2;
        for (let i = 20; i < 512; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i); ctx.lineTo(512, i);
            ctx.moveTo(i, 0); ctx.lineTo(i, 512);
            ctx.stroke();
        }

        // Glifos binarios
        ctx.fillStyle = 'rgba(0, 255, 213, 0.7)';
        ctx.font = '14px monospace';
        for (let i = 0; i < 40; i++) {
            ctx.fillText(Math.random() > 0.5 ? "01101" : "10010", Math.random() * 480, Math.random() * 480);
        }

        const dataTex = new THREE.CanvasTexture(dataCanvas);
        dataTex.wrapS = THREE.RepeatWrapping;
        dataTex.wrapT = THREE.RepeatWrapping;
        dataTex.repeat.set(24, 24);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: dataTex, 
                roughness: 0.25, 
                metalness: 0.7 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo Cyber Turquesa
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0x031822, roughness: 0.9 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 18;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Muros Perimetrales
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x082533, 
            metalness: 0.6, 
            roughness: 0.4 
        });

        registerWall(-170, 0, 10, 340, wallMat, group);
        registerWall(170, 0, 10, 340, wallMat, group);
        registerWall(0, -170, 340, 10, wallMat, group);
        registerWall(0, 170, 340, 10, wallMat, group);

        // 4. Pilares de Tokens y Archivos Sintácticos
        const tokenBlocks = [
            { x: -70, z: -40, w: 12, d: 80 },
            { x: 70, z: -40, w: 12, d: 80 },
            { x: 0, z: 20, w: 90, d: 10 },
            { x: -50, z: 80, w: 10, d: 70 },
            { x: 50, z: 80, w: 10, d: 70 }
        ];

        tokenBlocks.forEach(b => {
            const mesh = registerWall(b.x, b.z, b.w, b.d, wallMat, group);
            if (mesh) {
                // Tira brillante turquesa en cada pilar
                const strip = new THREE.Mesh(
                    new THREE.BoxGeometry(b.w * 0.95, 0.5, b.d * 0.95),
                    new THREE.MeshStandardMaterial({ color: 0x00ffd5, emissive: 0x00ffd5, emissiveIntensity: 1.2 })
                );
                strip.position.set(b.x, 8, b.z);
                group.add(strip);
            }
        });

        // 5. Núcleo de Probabilidad en el centro
        const pLight = new THREE.PointLight(0x00ffd5, 1.6, 75, 1.8);
        pLight.position.set(0, 13, -20);
        group.add(pLight);

        scene.add(group);
        return group;
    },

    updateEnemy(entity, targetPos, delta) {
        if (!entity || !entity.visible) return;
        entity.userData.stasis.material.opacity = 0;
        entity.lookAt(targetPos.x, entity.position.y, targetPos.z);
        const dir = new THREE.Vector3();
        entity.getWorldDirection(dir);
        dir.normalize();

        // Movimiento flotante espectral
        entity.position.addScaledVector(dir, 16.5 * delta);
        entity.position.y = Math.sin(performance.now() * 0.006) * 0.6;
    }
};
