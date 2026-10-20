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

    buildMap(scene, registerWall, registerObstacle) {
        const group = new THREE.Group();

        // ================================================================
        // MAPA DESDE MODELO glTF: pizzería real de la película FNAF
        // (Sketchfab). Si no está cargado, se usa el mapa procedural de abajo.
        // ================================================================
        if (window.PizzeriaMap && window.PizzeriaMap.ready && registerObstacle) {
            const model = window.PizzeriaMap.buildGroup(registerObstacle);
            if (model) {
                group.add(model);
                const P = window.PizzeriaMap;
                const B = P.bounds;

                // Sala de Seguridad: la celda alcanzable MÁS LEJANA de la
                // aparición (hay que cruzar la pizzería para refugiarse).
                const far = P.farthestReachableCell();
                if (far) {
                    const w = P.worldOfCell(far.ix, far.iz);
                    this.securityOffice.x = w.x;
                    this.securityOffice.z = w.z;
                }
                // El centro devuelto por la celda gruesa puede caer dentro de
                // un muro fino del modelo; se ajusta al punto libre cercano
                // (el disparador de la puerta es por distancia, < 24, así que
                // un pequeño desplazamiento no cambia la jugabilidad).
                const officeSpot = LevelManager.findFreeSpot(
                    this.securityOffice.x, this.securityOffice.z, 0, 18, 1.6);
                this.securityOffice.x = officeSpot.x;
                this.securityOffice.z = officeSpot.z;
                // ...y que se pueda LLEGAR hasta ella desde la aparición: la
                // celda más lejana a veces queda tras un pasillo más estrecho
                // que el radio de navegación (1.6) y el refugio sería inútil.
                const spawnW = P.worldOfCell(P.spawnCell.ix, P.spawnCell.iz);
                const officeConn = LevelManager.findConnectedSpot(
                    this.securityOffice.x, this.securityOffice.z, spawnW.x, spawnW.z, 1.6);
                if (officeConn) {
                    this.securityOffice.x = officeConn.x;
                    this.securityOffice.z = officeConn.z;
                }

                // Puertas (testimonio/alucinación) sobre celdas alcanzables
                // DENTRO de la casa y lejos de la aparición. Antes se buscaba
                // en las filas 2..6 del borde del recuadro: ahí estaba el
                // aparcamiento de FUERA y el jugador veía las puertas "en la
                // calle" (y aparecía fuera del mapa). Se evita además la Sala
                // de Seguridad para no superponer el refugio con una puerta.
                // Puertas lo más lejos posible de la aparición Y SEPARADAS
                // entre sí: su disparador es SOLO por proximidad (<14 uds) y
                // si quedan juntas, una misma posición dispara las DOS a la
                // vez (ganas y pierdes a la vez). Ninguna debe aparecer pegada
                // a la aparición del jugador tampoco.
                let cells = null;
                const spW0 = P.worldOfCell(P.spawnCell.ix, P.spawnCell.iz);
                for (const md of [40, 26, 0]) {
                    for (const rz of P.rowsAwayFrom(P.spawnCell.iz, md, 4)) {
                        const cc = P.pickCellsInRow(rz, [0.2, 0.8], [
                            { x: this.securityOffice.x, z: this.securityOffice.z, r: 30 }
                        ]);
                        if (!cc || cc.length !== 2) continue;
                        const t0 = P.worldOfCell(cc[0].ix, cc[0].iz);
                        const h0 = P.worldOfCell(cc[1].ix, cc[1].iz);
                        if (Math.hypot(t0.x - h0.x, t0.z - h0.z) < 32) continue;     // separadas entre sí
                        if (Math.hypot(t0.x - spW0.x, t0.z - spW0.z) < 20) continue;  // lejos de la aparición
                        if (Math.hypot(h0.x - spW0.x, h0.z - spW0.z) < 20) continue;
                        cells = cc; break;
                    }
                    if (cells) break;
                }
                if (cells && cells.length === 2) {
                    const t = P.worldOfCell(cells[0].ix, cells[0].iz);
                    const h = P.worldOfCell(cells[1].ix, cells[1].iz);
                    this.doors.truth = { x: t.x, y: 0, z: t.z };
                    this.doors.hallucination = { x: h.x, y: 0, z: h.z };
                }
                this.doors.teleportTarget = { x: B.minX + 20, y: 0, z: B.minZ + 20 };

                // Los coleccionables solo aparecen dentro de la pizzería.
                this.collectibleBounds = {
                    minX: B.minX + 12, maxX: B.maxX - 12,
                    minZ: B.minZ + 12, maxZ: B.maxZ - 12
                };
                this._usesModel = true;

                // Sala de Seguridad (sin muros extra: el modelo ya trae los suyos).
                this._buildSecurityOffice(group, null);

                // Iluminación teatral + neón FNAF.
                const fnafRedLight = new THREE.PointLight(0xff0044, 1.6, 120, 1.8);
                fnafRedLight.position.set(0, 22, -30);
                group.add(fnafRedLight);

                const secCyanLight = new THREE.PointLight(0x00f3ff, 1.4, 75, 1.8);
                secCyanLight.position.set(this.securityOffice.x, 14, this.securityOffice.z);
                group.add(secCyanLight);

                scene.add(group);
                return group;
            }
        }
        this._usesModel = false;
        this.collectibleBounds = null;

        // ================================================================
        // MAPA PROCEDURAL (respaldo)
        // ================================================================

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

        // 6. SALA DE SEGURIDAD FNAF
        this._buildSecurityOffice(group, registerWall);

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

    // Punto de aparición del mapa (el centro libre de la pizzería si se usa el
    // modelo; si no, el (0,0,0) clásico del nivel procedural).
    getSpawnPoint() {
        if (this._usesModel && window.PizzeriaMap && window.PizzeriaMap.spawnCell) {
            const w = window.PizzeriaMap.worldOfCell(
                window.PizzeriaMap.spawnCell.ix, window.PizzeriaMap.spawnCell.iz);
            return { x: w.x, z: w.z };
        }
        return { x: 0, z: 0 };
    },

    // Sala de Seguridad: muros (solo en el mapa procedural), puerta blindada,
    // baliza, cartel y mesa de monitores. En el mapa-modelo se omite el muro.
    _buildSecurityOffice(group, registerWall) {
        const o = this.securityOffice;

        if (registerWall) {
            const secWallMat = new THREE.MeshStandardMaterial({ color: 0x202636, metalness: 0.5, roughness: 0.4 });
            registerWall(o.x, o.z - 16, 36, 2, secWallMat, group);
            registerWall(o.x, o.z + 16, 36, 2, secWallMat, group);
            registerWall(o.x + 18, o.z, 2, 34, secWallMat, group);
        }

        // Puerta Blindada Deslizante de Acero Reforzado
        const secDoorMat = new THREE.MeshStandardMaterial({
            color: 0xdd1122,
            emissive: 0x440505,
            metalness: 0.85,
            roughness: 0.25
        });
        o.doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 16), secDoorMat);
        o.doorMesh.position.set(o.x - 17, 7, o.z);
        o.doorMesh.castShadow = true;
        o.doorMesh.receiveShadow = true;
        group.add(o.doorMesh);

        // Faro Baliza de Emergencia sobre la Sala de Seguridad
        const beaconMat = new THREE.MeshStandardMaterial({
            color: 0xff2222,
            emissive: 0xff0000,
            emissiveIntensity: 1.6,
            transparent: true,
            opacity: 0.45
        });
        o.beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 180, 16), beaconMat);
        o.beaconMesh.position.set(o.x, 90, o.z);
        group.add(o.beaconMesh);

        // Cartel luminoso "SECURITY ROOM"
        const secSign = new THREE.Mesh(
            new THREE.BoxGeometry(16, 2.5, 1),
            new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 1.4 })
        );
        secSign.position.set(o.x - 17, 15, o.z);
        group.add(secSign);

        // Mesa de monitores y ventilador
        const desk = new THREE.Mesh(
            new THREE.BoxGeometry(8, 3, 18),
            new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.7 })
        );
        desk.position.set(o.x + 8, 1.5, o.z);
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
        monitors.position.set(o.x + 7.5, 4.6, o.z);
        group.add(monitors);
    },

    // IA Animatrónica FNAF: PATRULLA lenta cerca de su puesto mientras el
    // jugador explora; solo persiguen (zig-zag sinusoidal) tras fallar la puerta.
    updateAnimatronics(freddy, bonnie, targetPos, delta, time) {
        if (!freddy || !bonnie) return;

        if (gameState.fnafModeActive) {
            this._chaseSinusoidal(freddy, targetPos, freddy.userData.speed || 15.0, delta, time, 0);
            this._chaseSinusoidal(bonnie, targetPos, bonnie.userData.speed || 17.5, delta, time, Math.PI / 2);
        } else {
            // Patrulla: sin esto, plantados con su clíp idle 'Walk' (no tienen
            // 'Idle'), parecía que "caminaban en el mismo sitio" sin moverse.
            this._patrolAnimatronic(freddy, delta, time, 0.0);
            this._patrolAnimatronic(bonnie, delta, time, 2.6);
        }

        if (freddy.userData.jaw) {
            freddy.userData.jaw.position.y = 5.1 + Math.sin(time * 16.0) * 0.25;
        }
        if (bonnie.userData.earL) {
            bonnie.userData.earL.rotation.z = Math.sin(time * 11.0) * 0.25;
            bonnie.userData.earR.rotation.z = -Math.sin(time * 11.0) * 0.25;
        }

        // Foxy lleva animacion real (subtitulo: idle/walk/run segun su velocidad).
    },

    // Patrulla: camina despacio hacia puntos LIBRES conectados con su "casa"
    // (userData.home, fijada al colocarlos en el nivel). Elegimos puntos
    // conectados para no quedar bloqueado contra un muro.
    _patrolAnimatronic(ent, delta, time, phase) {
        const home = ent.userData.home ||
            (ent.userData.home = { x: ent.position.x, z: ent.position.z });
        const nav = ent.userData.navRadius || 1.2;
        let tgt = ent.userData.patrolTarget;
        const distToTgt = tgt ? Math.hypot(ent.position.x - tgt.x, ent.position.z - tgt.z) : 999;
        if (!tgt || time > (ent.userData.patrolUntil || 0) || distToTgt < 2.0) {
            const s = LevelManager.findFreeSpot(home.x, home.z, 6, 26, nav, time * 0.25 + phase, false);
            const c = LevelManager.findConnectedSpot(s.x, s.z, home.x, home.z, nav) ||
                LevelManager.findConnectedSpot(s.x, s.z, ent.position.x, ent.position.z, nav) || s;
            ent.userData.patrolTarget = tgt = { x: c.x, z: c.z };
            ent.userData.patrolUntil = time + 6 + (phase % 3);
        }
        LevelManager.moveAgentToward(ent, tgt.x, tgt.z, 4.5 * delta, nav);
    },

    _chaseSinusoidal(entity, target, speed, delta, time, phase) {
        // Persecución con zig-zag, pero colision-aware: la dirección base sale
        // del steering A* (rodea muros de la pizzería) y el zig-zag se aplica
        // en perpendicular. Antes era línea recta pura y Foxy se atoraba
        // contra el primer muro sin poder alcanzarte nunca.
        const base = LevelManager.steerTo(entity, target.x, target.z, entity.userData.navRadius || 1.2);
        if (!base.x && !base.z) return;

        const perpX = -base.z, perpZ = base.x;
        const zigZag = Math.sin(time * 4.2 + phase) * 0.5;  // amplitud relativa

        let mx = base.x + perpX * zigZag;
        let mz = base.z + perpZ * zigZag;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;

        entity.rotation.y = Math.atan2(mx, mz);  // mira hacia donde se mueve
        LevelManager.moveAgentBy(entity, mx * speed * delta, mz * speed * delta,
            entity.userData.navRadius || 1.2);
    }
};
