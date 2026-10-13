# Contexto del Proyecto: Neon Oracle - Testimonio vs Alucinación

## 1. Resumen del Proyecto
**Nombre:** Neon Oracle
**Tipo de Aplicación:** Videojuego Web 3D (Escape Room Epistemológico).
**Archivo Principal:** `neon-oracle.html` (Single-file approach: HTML, CSS, JS unificados).
**Objetivo Académico:** Cumplir con la rúbrica de un proyecto universitario sobre "Epistemología e Inteligencia Artificial Generativa". Específicamente aborda el tema de *El Testimonio y las Alucinaciones*, *La Habitación China* y *La Opacidad Epistémica (Caja Negra)*.

## 2. Restricciones Académicas ("Reglas de Oro" del PDF)
*   **Privacidad (Cero Datos Biométricos):** No se pueden usar fotos, videos ni voces reales. **Solución técnica implementada:** Todo el entorno, avatares y enemigos están generados mediante matemáticas 3D (primitivas de geometría) y los sonidos son sintetizados procedimentalmente, garantizando 100% de anonimato.
*   **Contenido:** Lenguaje formal y académico en las retroalimentaciones.

## 3. Stack Tecnológico
*   **Frontend:** HTML5, CSS3 (Tailwind CSS vía CDN).
*   **Motor Gráfico 3D:** `Three.js` (r128 vía CDN). Se usa `InstancedMesh` para renderizar el entorno de los *Backrooms* (laberinto de pilares) para mantener un alto rendimiento (optimizando la RAM) simulando "Gráficos RTX".
*   **Motor de Audio:** `Tone.js` (v14.8.49 vía CDN). Genera música ambiental, efectos de pasos, alarmas y recolección de objetos matemáticamente sin depender de archivos `.mp3` externos.

## 4. Mecánicas Principales (Gameplay)
*   **Controles:** 
    *   Movimiento relativo a la cámara: `W, A, S, D`.
    *   Salto con gravedad simulada: `Barra Espaciadora`.
    *   Cámara: Sistema de *Free-look* (Cámara Libre). Se puede controlar activando el *PointerLock* (clic en pantalla y uso del Mouse) o utilizando las flechas del teclado (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`).
*   **Toma de Decisiones:** En cada nivel (Nodo), el jugador lee un enunciado generado por una "IA" en la parte superior (HUD). El jugador debe explorar el nivel y caminar físicamente a través de una de dos puertas gigantes: **VERDAD** o **ALUCINACIÓN**.
*   **Condición de Éxito:** Si el jugador cruza la puerta correcta, el tiempo se pausa, aparece un modal con la explicación epistemológica del tema (ej. El sesgo algorítmico) y se avanza al siguiente Nodo.
*   **Condición de Fracaso / Castigo:** Si el jugador cruza la puerta incorrecta, la puerta elegida desaparece y la puerta real se teletransporta muy lejos en el mapa. La pantalla parpadea en rojo, suena una alarma, y se invoca a un enemigo.
*   **Coleccionables e Inventario (Granada EMP):** Existen fragmentos de datos verdes esparcidos por el mapa. Recoger 3 fragmentos otorga 1 carga EMP. Si el jugador es perseguido, puede presionar la tecla `E` para lanzar el EMP y congelar al enemigo por 4 segundos.

## 5. Inteligencia Artificial del Enemigo ("Mona China RTX")
El enemigo es una entidad 3D que persigue al jugador tras un error. Posee habilidades distintas según el nivel actual (`gameState.currentNodeIndex`):
*   **Nivel 1 (Yandere / Pelo Rosa):** Persigue al jugador de forma lineal apuntando a su posición.
*   **Nivel 2 (Tsundere / Pelo Azul):** Mayor velocidad. Incorpora un movimiento sinusoidal (zig-zag) haciendo difícil predecir su trayectoria.
*   **Nivel 3 (Kuudere / Pelo Morado):** Mecánica de terror tipo "Slenderman/Weeping Angel". Calcula el *Dot Product* entre el vector de visión de la cámara y la posición del enemigo. Si el jugador le da la espalda, tiene una probabilidad matemática de teletransportarse instantáneamente justo detrás de él.

## 6. Estado Actual del Código
*   El código es robusto y completamente funcional en un solo archivo.
*   Los bucles de colisiones (paredes, coleccionables, enemigo, puertas) están operativos.
*   Existe un temporizador global de 5 minutos; si llega a cero, es Game Over.
*   Si el enemigo alcanza al jugador (distancia menor a 4 unidades), penaliza restando 30 segundos del reloj, fuerza la aparición del modal de "¡ATRAPADO!" y obliga a reanudar la persecución/búsqueda de la puerta en el mismo nivel.