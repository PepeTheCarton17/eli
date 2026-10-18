/**
 * NIVEL 5: LA ZONA DE ENTROPÍA (COLAPSO DEL MODELO)
 * Epistemología: Shumailov et al. (Nature, 2024) - Model Collapse y Degeneración por Autorreferencialidad.
 */
window.Level5_ModelCollapse = {
    id: 5,
    roomName: "NODO 5: LA ZONA DE ENTROPÍA (COLAPSO DEL MODELO)",
    theme: "model_collapse",
    statement: "\"Si entreno redes generativas recursivamente solo con sus propias respuestas sintéticas, el conocimiento alcanzará pureza matemática absoluta.\"",
    isTruth: false,
    rewardItem: "shield",
    rewardName: "ESCUDO CORTAFUEGOS REFORZADO",
    explanation: "<strong class='text-pink-400'>¡VEREDICTO: ALUCINACIÓN! (Colapso del Modelo)</strong><br><br>Demostrado por <strong>Shumailov et al. (Nature, 2024)</strong>: La recursividad de alimentar IAs con datos generados por otras IAs produce <em>Model Collapse</em>. La entropía epistémica se acumula, las distribuciones de baja probabilidad se borran y el sistema degenera en alucinaciones delirantes irreversibles. ¡El testimonio humano es irremplazable!",

    atmosphere: {
        bgColor: 0x140407,
        fogColor: 0x140407,
        fogNear: 20,
        fogFar: 165,
        ambientColor: 0x2b0d14,
        ambientIntensity: 0.6,
        dirLightColor: 0xff2a48,
        dirLightIntensity: 0.85,
        dirLightPos: [20, 70, -20]
    },

    doors: {
        truth: { x: -35, y: 0, z: -115 },
        hallucination: { x: 35, y: 0, z: -115 },
        teleportTarget: { x: 80, y: 0, z: 90 }
    },

    lastGlitchDash: 0,

    buildMap(scene, registerWall) {
        const group = new THREE.Group();

        // 1. Suelo de Glitch Entrópico
        const glitchCanvas = document.createElement('canvas');
        glitchCanvas.width = 512;
        glitchCanvas.height = 512;
        const ctx = glitchCanvas.getContext('2d');
        ctx.fillStyle = '#0f0205';
        ctx.fillRect(0, 0, 512, 512);

        // Ruido y barras de estática
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 30, 70, 0.25)' : 'rgba(255, 255, 255, 0.15)';
            const h = 2 + Math.random() * 8;
            ctx.fillRect(0, Math.random() * 512, 512, h);
        }

        const glitchTex = new THREE.CanvasTexture(glitchCanvas);
        glitchTex.wrapS = THREE.RepeatWrapping;
        glitchTex.wrapT = THREE.RepeatWrapping;
        glitchTex.repeat.set(20, 20);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: glitchTex, 
                roughness: 0.35, 
                metalness: 0.6 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo Corrupto
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0x1a060a, roughness: 0.9 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 18;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Muros Perimetrales
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x22070e, 
            roughness: 0.5, 
            metalness: 0.4 
        });

        registerWall(-170, 0, 10, 340, wallMat, group);
        registerWall(170, 0, 10, 340, wallMat, group);
        registerWall(0, -170, 340, 10, wallMat, group);
        registerWall(0, 170, 340, 10, wallMat, group);

        // 4. Bloques de Fractura Entrópica
        const fractureBlocks = [
            { x: -50, z: -60, w: 14, d: 70 },
            { x: 50, z: -60, w: 14, d: 70 },
            { x: 0, z: 0, w: 80, d: 14 },
            { x: -70, z: 60, w: 14, d: 60 },
            { x: 70, z: 60, w: 14, d: 60 }
        ];

        fractureBlocks.forEach(b => {
            const mesh = registerWall(b.x, b.z, b.w, b.d, wallMat, group);
            if (mesh) {
                const redCore = new THREE.Mesh(
                    new THREE.BoxGeometry(b.w * 0.92, 0.4, b.d * 0.92),
                    new THREE.MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 1.4 })
                );
                redCore.position.set(b.x, 8, b.z);
                group.add(redCore);
            }
        });

        // 5. Luz de Emergencia Entrópica
        const redLight = new THREE.PointLight(0xff0033, 1.8, 80, 1.8);
        redLight.position.set(0, 12, 0);
        group.add(redLight);

        scene.add(group);
        return group;
    },

    updateEnemy(entity, targetPos, delta) {
        if (!entity || !entity.visible) return;
        entity.userData.stasis.material.opacity = 0;

        // Velocidad con saltos cuánticos repentinos (glitch dash), pero
        // rodeando muros con A* (antes: línea recta y se atoraba).
        const now = performance.now();
        let speed = 15.0;
        if (now - this.lastGlitchDash > 2200) {
            this.lastGlitchDash = now;
            speed = 38.0; // Impulso brusco de glitch
        }
        LevelManager.moveAgentToward(entity, targetPos.x, targetPos.z,
            speed * delta, entity.userData.navRadius || 1.2);
    }
};
