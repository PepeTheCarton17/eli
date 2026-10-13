/**
 * RTX POST-PROCESSING & ENHANCED LIGHTING PIPELINE
 * Bloom Cinematográfico (UnrealBloomPass) + HDR Tone Mapping + Glow Dinámico
 */
window.RTXPostprocessing = {
    composer: null,
    bloomPass: null,
    isRTXEnabled: true,
    initialized: false,

    init(renderer, scene, camera) {
        // Configuración de Renderizado Fotorrealista (Tone Mapping y Espacio de Color)
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputEncoding = THREE.sRGBEncoding;

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        try {
            if (typeof THREE.EffectComposer === 'function' && typeof THREE.UnrealBloomPass === 'function') {
                const renderScene = new THREE.RenderPass(scene, camera);
                
                // Parámetros de Bloom estilo RTX: Resplandor sutil pero visible en neones
                const bloom = new THREE.UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.95, // Fuerza del resplandor (bloom strength)
                    0.42, // Radio del halo
                    0.65  // Umbral de luminancia
                );

                const composer = new THREE.EffectComposer(renderer);
                composer.addPass(renderScene);
                composer.addPass(bloom);

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
        if (this.composer) {
            this.composer.setSize(w, h);
        }
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
