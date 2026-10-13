/**
 * NIVEL 6: EL TRIBUNAL ALGORÍTMICO (INJUSTICIA HERMENÉUTICA)
 * Epistemología: Miranda Fricker (2007) - Injusticia Testimonial y Hermenéutica en la IA.
 */
window.Level6_TestimonialJustice = {
    id: 6,
    roomName: "NODO 6: EL TRIBUNAL ALGORÍTMICO (INJUSTICIA HERMENÉUTICA)",
    theme: "testimonial_justice",
    statement: "\"Al delegar sentencias judiciales o créditos a modelos de IA, la injusticia testimonial desaparece porque los vectores no poseen prejuicios identitarios.\"",
    isTruth: false,
    rewardItem: null,
    rewardName: "CERTIFICACIÓN DE AUDITOR EPISTÉMICO",
    explanation: "<strong class='text-pink-400'>¡VEREDICTO: ALUCINACIÓN! (Injusticia Testimonial Automatizada)</strong><br><br>Basado en <strong>Miranda Fricker (2007)</strong> y <strong>Safiya Noble</strong>: Los sistemas automatizados de decisión no eliminan la injusticia epistémica; la codifican matemáticamente. Asignan un <em>déficit sistemático de credibilidad</em> a comunidades históricamente vulnerables bajo el disfraz de 'objetividad algorítmica'.<br><br><strong>¡ENHORABUENA! HAS SUPERADO TODOS LOS DILEMAS EPISTEMOLÓGICOS DEL ORÁCULO.</strong>",

    atmosphere: {
        bgColor: 0x060f1c,
        fogColor: 0x060f1c,
        fogNear: 25,
        fogFar: 185,
        ambientColor: 0x14243d,
        ambientIntensity: 0.65,
        dirLightColor: 0xffdf80,
        dirLightIntensity: 0.9,
        dirLightPos: [0, 85, 20]
    },

    doors: {
        truth: { x: -30, y: 0, z: -120 },
        hallucination: { x: 30, y: 0, z: -120 },
        teleportTarget: { x: 0, y: 0, z: 110 }
    },

    buildMap(scene, registerWall) {
        const group = new THREE.Group();

        // 1. Suelo de Mármol Cyber y Oro PBR RTX
        const tribunalCanvas = document.createElement('canvas');
        tribunalCanvas.width = 512;
        tribunalCanvas.height = 512;
        const ctx = tribunalCanvas.getContext('2d');
        ctx.fillStyle = '#060f1a';
        ctx.fillRect(0, 0, 512, 512);

        // Cuadrícula dorada
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
        ctx.lineWidth = 3;
        for (let i = 0; i <= 512; i += 64) {
            ctx.beginPath();
            ctx.moveTo(0, i); ctx.lineTo(512, i);
            ctx.moveTo(i, 0); ctx.lineTo(i, 512);
            ctx.stroke();
        }

        const tribunalTex = new THREE.CanvasTexture(tribunalCanvas);
        tribunalTex.wrapS = THREE.RepeatWrapping;
        tribunalTex.wrapT = THREE.RepeatWrapping;
        tribunalTex.repeat.set(16, 16);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: tribunalTex, 
                roughness: 0.15, 
                metalness: 0.75 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo del Tribunal
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0x09182b, roughness: 0.85 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 20;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Muros Perimetrales
        const colMat = new THREE.MeshStandardMaterial({ 
            color: 0x0b1e36, 
            roughness: 0.35, 
            metalness: 0.6 
        });

        registerWall(-170, 0, 10, 340, colMat, group);
        registerWall(170, 0, 10, 340, colMat, group);
        registerWall(0, -170, 340, 10, colMat, group);
        registerWall(0, 170, 340, 10, colMat, group);

        // 4. Columnas Monumentales del Tribunal
        const columns = [
            { x: -50, z: -80 }, { x: 50, z: -80 },
            { x: -50, z: -30 }, { x: 50, z: -30 },
            { x: -50, z: 20 },  { x: 50, z: 20 },
            { x: -50, z: 70 },  { x: 50, z: 70 }
        ];

        columns.forEach(col => {
            const mesh = registerWall(col.x, col.z, 12, 12, colMat, group);
            if (mesh) {
                const goldTrim = new THREE.Mesh(
                    new THREE.BoxGeometry(12.2, 0.6, 12.2),
                    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.2 })
                );
                goldTrim.position.set(col.x, 8, col.z);
                group.add(goldTrim);
            }
        });

        // 5. Luz Monumental de Balanza de la Justicia en el centro
        const goldLight = new THREE.PointLight(0xffd700, 1.8, 85, 1.8);
        goldLight.position.set(0, 15, -40);
        group.add(goldLight);

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
        entity.position.addScaledVector(dir, 17.5 * delta);
    }
};
