/**
 * RTX POST-PROCESSING & ENHANCED LIGHTING PIPELINE
 * Bloom Cinematográfico (UnrealBloomPass) + Tone Mapping ACES + Codificación sRGB.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTA TÉCNICA IMPORTANTE (three.js r128)
 * ─────────────────────────────────────────────────────────────────────────────
 * Un EffectComposer normal crea sus render targets con encoding Lineal. Además,
 * UnrealBloomPass, cuando renderiza a pantalla, dibuja la escena base con un
 * MeshBasicMaterial que aplica OTRA VEZ el tone mapping (ACES) y la codificación
 * sRGB. El resultado era una imagen sobreexpuesta, desaturada y "blanquecina"
 * (el famoso pantallazo blanco de RTX).
 *
 * La solución correcta:
 *   1. El render target del composer se crea con `encoding = sRGBEncoding`, de
 *      modo que la escena se codifica EXACTAMENTE igual que al renderizar directo
 *      a pantalla (una sola vez).
 *   2. El bloom se añade sobre ese buffer.
 *   3. El pase final es una COPIA CRUDA (sin volver a codificar sRGB).
 *
 * Con esto, "RTX ON" y "RTX OFF" producen los mismos colores, y el bloom sólo
 * añade un resplandor sutil sobre los neones.
 */
window.RTXPostprocessing = {
    composer: null,
    bloomPass: null,
    outputPass: null,
    renderer: null,
    isRTXEnabled: true,
    initialized: false,

    init(renderer, scene, camera) {
        // Configuración de Renderizado Fotorrealista (Tone Mapping y Espacio de Color)
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputEncoding = THREE.sRGBEncoding;

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.renderer = renderer;

        try {
            if (typeof THREE.EffectComposer === 'function' && typeof THREE.UnrealBloomPass === 'function') {
                const size = renderer.getDrawingBufferSize(new THREE.Vector2());

                // Render target con encoding sRGB: evita el doble tone mapping / doble
                // codificación que blanqueaba la pantalla.
                const renderTarget = new THREE.WebGLRenderTarget(
                    Math.max(1, Math.floor(size.x)),
                    Math.max(1, Math.floor(size.y)),
                    {
                        minFilter: THREE.LinearFilter,
                        magFilter: THREE.LinearFilter,
                        format: THREE.RGBAFormat
                    }
                );
                renderTarget.texture.encoding = THREE.sRGBEncoding;

                const composer = new THREE.EffectComposer(renderer, renderTarget);

                const renderScene = new THREE.RenderPass(scene, camera);
                composer.addPass(renderScene);

                // Parámetros de Bloom estilo RTX: resplandor sutil sobre los neones.
                // El umbral alto evita que el fondo claro dispare bloom por todas partes.
                const bloom = new THREE.UnrealBloomPass(
                    new THREE.Vector2(size.x, size.y),
                    0.2,  // Fuerza del resplandor (sutil)
                    0.5,  // Radio del halo
                    0.9   // Umbral de luminancia
                );
                composer.addPass(bloom);

                // Pase final: copia cruda (SIN volver a codificar a sRGB).
                if (typeof THREE.ShaderPass === 'function') {
                    const copyPass = new THREE.ShaderPass({
                        uniforms: { tDiffuse: { value: null } },
                        vertexShader: [
                            'varying vec2 vUv;',
                            'void main() {',
                            '    vUv = uv;',
                            '    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
                            '}'
                        ].join('\n'),
                        fragmentShader: [
                            'uniform sampler2D tDiffuse;',
                            'varying vec2 vUv;',
                            'void main() {',
                            '    gl_FragColor = texture2D( tDiffuse, vUv );',
                            '}'
                        ].join('\n')
                    });
                    composer.addPass(copyPass);
                    this.outputPass = copyPass;
                }

                this.composer = composer;
                this.bloomPass = bloom;
                this.initialized = true;
                return true;
            }
        } catch (err) {
            console.warn("RTX Postprocessing: Operando en modo estándar sin Bloom.", err);
        }
        return false;
    },

    setSize(w, h) {
        if (!this.composer) return;
        const pr = this.renderer ? this.renderer.getPixelRatio() : 1;
        this.composer.setSize(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr)));
    },

    render(renderer, scene, camera) {
        if (this.isRTXEnabled && this.composer && this.initialized) {
            this.composer.render();
        } else {
            renderer.render(scene, camera);
        }
    },

    toggle() {
        this.isRTXEnabled = !this.isRTXEnabled;
        return this.isRTXEnabled;
    }
};
