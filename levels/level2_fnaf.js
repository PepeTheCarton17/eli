/**
 * NIVEL 2: FIVE NIGHTS AT FREDDY'S (CÁMARA DE SESGOS)
 * Epistemología: Epistemología Social - Sesgos Algorítmicos e Injusticia Epistémica.
 * Mecánica FNAF: Freddy y Bonnie persiguen al jugador; debes correr a la Sala de Seguridad y cerrar la puerta.
 */
window.Level2_FNAF = {
    id: 2,
    roomName: "NODO 2: FIVE NIGHTS AT FREDDY'S (CÁMARA DE SESGOS)",
    theme: "fnaf_pizzeria",
    statement: "\"Mis decisiones son puras y objetivas porque soy un algoritmo matemático sin prejuicios sociales.\"",
    isTruth: false,
    rewardItem: "decoy",
    rewardName: "SEÑUELO HOLOGRÁFICO FAZBEAR (Tecla F)",
    explanation: "<strong class='text-pink-400'>¡VEREDICTO: ALUCINACIÓN! (Sesgo Algorítmico)</strong><br><br>Desde la <strong>Epistemología Social</strong>: Los modelos son entrenados con datos humanos históricos que reflejan discriminaciones e inequidades. Si la historia está sesgada, la IA reproduce y amplifica dicho sesgo.<br><br><em>¡Lograste refugiarte en la Sala de Seguridad de Fazbear antes del jumpscare!</em>",

    atmosphere: {
        bgColor: 0x0a0c16,
        fogColor: 0x0a0c16,
        fogNear: 20,
        fogFar: 165,
        ambientColor: 0x24283b,
        ambientIntensity: 0.55,
        dirLightColor: 0x9fb4ff,
        dirLightIntensity: 0.7,
        dirLightPos: [40, 65, 20]
    },

    doors: {
        truth: { x: 50, y: 0, z: 30 },
        hallucination: { x: 110, y: 0, z: 30 },
        teleportTarget: { x: -80, y: 0, z: -100 }
    },

    securityOffice: {
        x: 100,
        z: 70,
        doorMesh: null,
        beaconMesh: null
    },

    buildMap(scene, registerWall) {
        const group = new THREE.Group();

        // 1. Suelo Ajedrezado FNAF con Reflejo Especular PBR RTX
        const chessCanvas = document.createElement('canvas');
        chessCanvas.width = 512;
        chessCanvas.height = 512;
        const chctx = chessCanvas.getContext('2d');
        chctx.fillStyle = '#08080d';
        chctx.fillRect(0, 0, 512, 512);
        chctx.fillStyle = '#e5e5f0';
        chctx.fillRect(0, 0, 256, 256);
        chctx.fillRect(256, 256, 256, 256);
        
        for (let i = 0; i < 200; i++) {
            chctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
            chctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
        }

        const chessTex = new THREE.CanvasTexture(chessCanvas);
        chessTex.wrapS = THREE.RepeatWrapping;
        chessTex.wrapT = THREE.RepeatWrapping;
        chessTex.repeat.set(28, 28);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ 
                map: chessTex, 
                roughness: 0.22, 
                metalness: 0.35 
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);

        // 2. Techo de Pizzería Oscuro
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(360, 360),
            new THREE.MeshStandardMaterial({ color: 0x0c0e18, roughness: 0.95 })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 18;
        ceiling.receiveShadow = true;
        group.add(ceiling);

        // 3. Muros perimetrales Pizzería
        const fnafWallMat = new THREE.MeshStandardMaterial({ 
            color: 0x182035, 
            roughness: 0.58,
            metalness: 0.15
        });

        registerWall(-170, 0, 10, 340, fnafWallMat, group);
        registerWall(170, 0, 10, 340, fnafWallMat, group);
        registerWall(0, -170, 340, 10, fnafWallMat, group);
        registerWall(0, 170, 340, 10, fnafWallMat, group);

        // Muros divisores de la Pizzería
        registerWall(-50, -40, 10, 120, fnafWallMat, group);
        registerWall(30, -40, 10, 100, fnafWallMat, group);
        registerWall(-10, 30, 90, 10, fnafWallMat, group);

        // 4. Escenario Show Stage de Freddy Fazbear
        const stageMat = new THREE.MeshStandardMaterial({ color: 0x3d0e16, roughness: 0.45, metalness: 0.2 });
        const stage = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 32), stageMat);
        stage.position.set(0, 2, -120);
        stage.castShadow = true;
        stage.receiveShadow = true;
        group.add(stage);

        const curtainMat = new THREE.MeshStandardMaterial({ color: 0x8a0011, roughness: 0.8 });
        const curtain = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 2.5), curtainMat);
        curtain.position.set(0, 10, -134);
        curtain.castShadow = true;
        group.add(curtain);

        const signMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0044, 
            emissive: 0xff0044, 
            emissiveIntensity: 1.5 
        });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 1), signMat);
        sign.position.set(0, 17.5, -120);
        group.add(sign);

        // 5. Mesas de fiesta en el salón central
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x1f283d, roughness: 0.6 });
        const tablePositions = [
            [-25, -20], [-25, 10], [10, -20], [10, 10]
        ];
        tablePositions.forEach(([tx, tz]) => {
            const table = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 8), tableMat);
            table.position.set(tx, 1.2, tz);
            table.castShadow = true;
            table.receiveShadow = true;
            group.add(table);
            registerWall(tx, tz, 16, 8, tableMat, group);
        });

        // 6. SALA DE SEGURIDAD FNAF (Security Office en x: 100, z: 70)
        const secWallMat = new THREE.MeshStandardMaterial({ color: 0x202636, metalness: 0.5, roughness: 0.4 });
        registerWall(this.securityOffice.x, this.securityOffice.z - 16, 36, 2, secWallMat, group);
        registerWall(this.securityOffice.x, this.securityOffice.z + 16, 36, 2, secWallMat, group);
        registerWall(this.securityOffice.x + 18, this.securityOffice.z, 2, 34, secWallMat, group);

        // Puerta Blindada Deslizante de Acero Reforzado
        const secDoorGeo = new THREE.BoxGeometry(2, 14, 16);
        const secDoorMat = new THREE.MeshStandardMaterial({ 
            color: 0xdd1122, 
            emissive: 0x440505,
            metalness: 0.85, 
            roughness: 0.25 
        });
        this.securityOffice.doorMesh = new THREE.Mesh(secDoorGeo, secDoorMat);
        this.securityOffice.doorMesh.position.set(this.securityOffice.x - 17, 7, this.securityOffice.z);
        this.securityOffice.doorMesh.castShadow = true;
        this.securityOffice.doorMesh.receiveShadow = true;
        group.add(this.securityOffice.doorMesh);

        // Faro Baliza de Emergencia sobre la Sala de Seguridad
        const beaconGeo = new THREE.CylinderGeometry(1.5, 1.5, 180, 16);
        const beaconMat = new THREE.MeshStandardMaterial({
            color: 0xff2222,
            emissive: 0xff0000,
            emissiveIntensity: 1.6,
            transparent: true,
            opacity: 0.45
        });
        this.securityOffice.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        this.securityOffice.beaconMesh.position.set(this.securityOffice.x, 90, this.securityOffice.z);
        group.add(this.securityOffice.beaconMesh);

        // Cartel luminoso "SECURITY ROOM"
        const secSign = new THREE.Mesh(
            new THREE.BoxGeometry(16, 2.5, 1),
            new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 1.4 })
        );
        secSign.position.set(this.securityOffice.x - 17, 15, this.securityOffice.z);
        group.add(secSign);

        // Mesa de monitores y ventilador
        const desk = new THREE.Mesh(
            new THREE.BoxGeometry(8, 3, 18),
            new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.7 })
        );
        desk.position.set(this.securityOffice.x + 8, 1.5, this.securityOffice.z);
        desk.castShadow = true;
        group.add(desk);

        const monitors = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 3.2, 8),
            new THREE.MeshStandardMaterial({ 
                color: 0x00f3ff, 
                emissive: 0x00d4ff, 
                emissiveIntensity: 1.2 
            })
        );
        monitors.position.set(this.securityOffice.x + 7.5, 4.6, this.securityOffice.z);
        group.add(monitors);

        // 7. Iluminación Teatral y Neón FNAF
        const fnafRedLight = new THREE.PointLight(0xff0044, 1.8, 85, 1.8);
        fnafRedLight.position.set(0, 14, -80);
        fnafRedLight.castShadow = true;
        group.add(fnafRedLight);

        const secCyanLight = new THREE.PointLight(0x00f3ff, 1.4, 65, 1.8);
        secCyanLight.position.set(this.securityOffice.x, 13, this.securityOffice.z);
        group.add(secCyanLight);

        scene.add(group);
        return group;
    },

    // IA Animatrónica FNAF: Persecución sinusoidal (Tsundere / Zig-zag)
    updateAnimatronics(freddy, bonnie, targetPos, delta, time) {
        if (!freddy || !bonnie) return;

        this._chaseSinusoidal(freddy, targetPos, freddy.userData.speed || 15.0, delta, time, 0);
        if (freddy.userData.jaw) {
            freddy.userData.jaw.position.y = 5.1 + Math.sin(time * 16.0) * 0.25;
        }

        this._chaseSinusoidal(bonnie, targetPos, bonnie.userData.speed || 17.5, delta, time, Math.PI / 2);
        if (bonnie.userData.earL) {
            bonnie.userData.earL.rotation.z = Math.sin(time * 11.0) * 0.25;
            bonnie.userData.earR.rotation.z = -Math.sin(time * 11.0) * 0.25;
        }
    },

    _chaseSinusoidal(entity, target, speed, delta, time, phase) {
        entity.lookAt(target.x, entity.position.y, target.z);
        const dir = new THREE.Vector3();
        entity.getWorldDirection(dir);
        dir.normalize();

        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        const zigZag = Math.sin(time * 4.2 + phase) * 8.0;

        const moveVec = dir.clone().multiplyScalar(speed * delta)
            .add(perp.clone().multiplyScalar(zigZag * delta));
        
        entity.position.add(moveVec);
    }
};
