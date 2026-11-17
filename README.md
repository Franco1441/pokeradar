# PokéRadar · Diario de expedición

Explorá siete hábitats del mundo, descubrí Pokémon y registrá tus hallazgos en un diario de campo. Proyecto para el desafío técnico Frontend Engineer Junior de DataInt.

[Abrir PokéRadar](https://pokeradar-lyart.vercel.app/) · [Comparar expediciones](https://pokeradar-lyart.vercel.app/?region=iguazu&view=analysis) · [Cómo ejecutar el proyecto](#ejecutar-localmente) · [Uso de IA y correcciones](#3-uso-de-inteligencia-artificial-ai-native-workflow)

### Recorrido rápido para la evaluación

1. **Globo y mapa regional.** En el globo, elegí Nikkō, tocá **Ver mapa** y seleccioná a Pikachu para probar el movimiento de cámara y la carga de la ficha. [Abrir el globo](https://pokeradar-lyart.vercel.app/?region=nikko&view=world)
2. **Safari.** Elegí otra zona desde el radar y girá para seguir una señal. El contador marca cuándo cambia la actividad. Podés probar **Día** y **Noche** sin esperar a que cambie la hora local. [Entrar al Safari de Iguazú](https://pokeradar-lyart.vercel.app/?region=iguazu&view=safari)
3. **Registro y persistencia.** Registrá un Pokémon desde su ficha, abrí **Mi atlas** y recargá la página para comprobar que el hallazgo queda guardado en ese navegador. [Abrir la ficha de Pikachu](https://pokeradar-lyart.vercel.app/?region=nikko&encounter=nikko-pikachu)
4. **Análisis.** Cambiá la métrica del gráfico, seleccioná un destino y consultá sus condiciones. Abrí esa expedición desde **Ver en el mapa** o **Abrir Safari**. [Comparar las siete expediciones](https://pokeradar-lyart.vercel.app/?region=iguazu&view=analysis)

## 1. Concepto y narrativa

Elegí la idea de un diario de expedición para darle un propósito a cada movimiento en el mapa. El globo sirve para elegir un hábitat, el mapa regional ubica el encuentro y la ficha explica por qué esa especie encaja allí. El atlas guarda lo que encontraste y permite retomar el recorrido.

### Cómo explorar

1. **Elegí un destino en el globo.** Giralo o seleccioná una región desde el panel. La vista muestra el día, el crepúsculo y las luces nocturnas según la posición aproximada del sol.
2. **Abrí el mapa y seleccioná un Pokémon.** Cada región tiene seis marcadores con sprites. Al seleccionar uno, la cámara deja espacio para la ficha y confirma la llegada con un anillo. La ficha consulta PokéAPI en el momento y muestra nombre, tipos, ilustración, estadísticas base y sonido cuando está disponible. Durante la consulta muestra un esqueleto de carga y, si falla, permite reintentar.
3. **Registrá el avistamiento.** Encontrar tres especies y conocer dos tipos distintos completa el objetivo de una expedición y desbloquea su postal. Podés agregar hasta seis favoritos a tu equipo. El progreso queda guardado en el navegador.

### Dos formas de explorar el terreno

**Explorar a pie** lleva al punto de entrada de la expedición desde la tarjeta del globo, el marcador del sendero o con doble clic en el marcador del destino. La cámara se acerca y el fundido da paso a una escena panorámica con entre doce y quince Pokémon por región. Tres se descubren al examinar pistas del entorno. Cada avistamiento presenta un dato de la especie antes de abrir su ficha. Podés recorrer la escena con arrastre o teclado y pasar a la siguiente pista después de registrar un hallazgo.

**Safari** se abre desde la misma tarjeta de destino que **Explorar a pie**. Tiene 84 especies propias que rotan en tres zonas por expedición. Cada una de las 21 zonas tiene un panorama esférico distinto. Elegí una zona desde el radar y girá 360° con arrastre o con las flechas. Cada 30 segundos cambian las señales activas. Una señal queda cerca del encuadre de entrada y otras pueden aparecer a los lados o detrás. Los puntos del radar indican hacia dónde girar. La fase del día determina qué especies pueden aparecer y el clima destaca los tipos favorecidos. El radar muestra tu rumbo, el tiempo hasta el próximo cambio y qué especies nuevas detectó en otras zonas. El modo **En vivo** toma la fase de Open-Meteo y usa la hora local como estimación si falla el servicio. Los modos **Día** y **Noche** permiten probar ambas fases.

En celular, la tarjeta compacta deja más espacio para el globo y permite desplegar el clima y los avistamientos cuando hacen falta. En Safari, la cámara abre el encuadre y el radar ocupa menos espacio. La preferencia de movimiento reducido acorta o desactiva las transiciones. Si falla el mapa, podés elegir una expedición y consultar la lista de avistamientos. Si falla WebGL en Safari, el paisaje, el radar y las fichas siguen disponibles en la vista panorámica.

| Destino | Escena | Pistas |
| --- | --- | --- |
| Nikkō | Claro de los cedros | Bulbasaur, Caterpie y Hoothoot |
| Reykjanes | Campo de basalto | Charmander, Geodude y Vulpix |
| Namib | Paso de las dunas | Sandshrew, Cacnea y Sandile |
| Zermatt | Mirador del glaciar | Sneasel, Swinub y Delibird |
| Heron | Jardín de coral | Squirtle, Corsola y Horsea |
| Iguazú | Sendero de las cataratas | Aipom, Lotad y Tropius |
| Everglades | Canal de los cipreses | Totodile, Croagunk y Ducklett |

### Comparar expediciones

El panel de **Análisis** se incorporó después de la entrega original para conectar los datos de la exploración con la elección del siguiente destino.

- **Tipos activos** compara la variedad de tipos entre las señales actuales del Safari.
- **Cobertura del atlas** muestra las especies registradas sobre el catálogo de cada región.
- **Señales sin registrar** compara cuántos encuentros activos todavía podés sumar a tu diario.

El gráfico ordena los siete destinos por la métrica elegida y permite seleccionar cada uno con mouse, teclado o tacto. La ficha de selección muestra el bioma, los tipos activos, el clima y la hora local, con accesos al mapa y al Safari. Sin registros previos, la primera comparación muestra tipos activos. Con registros guardados, abre la cobertura del atlas.

La sugerencia prioriza las regiones con más señales sin registrar y desempata por especies pendientes. Las señales se recalculan en intervalos de 30 segundos. Open-Meteo aporta las condiciones observadas; si falla, el panel marca la fase del día como estimada a partir de la hora local. El progreso proviene del atlas guardado en ese navegador y las apariciones son simuladas.

En celular, **Ver detalle** lleva del gráfico a la ficha del destino. La URL conserva la selección, por ejemplo `/?region=iguazu&view=analysis`.

### Datos reales y simulación

PokéAPI aporta los nombres, tipos, estadísticas, medidas, ilustraciones, descripciones y sonidos. Open-Meteo aporta el tiempo meteorológico y la fase del día en el destino. Las coordenadas de los avistamientos y la relación de cada especie con su hábitat forman parte de la simulación y se identifican en la interfaz.

El catálogo local contiene 177 especies distribuidas por hábitat: 93 de exploración a pie y 84 exclusivas del Safari. Sus identificadores y tipos se contrastaron con PokéAPI. Los marcadores y filtros pueden mostrarse con ese catálogo mientras las fichas consultan los datos detallados de cada especie.

### Referencias de experiencia

- El globo interactivo de Apple Maps inspiró la vista estrellada y el tratamiento visual de la transición solar. [Apple Maps](https://www.apple.com/maps/)
- Pokémon GO inspiró el mapa protagonista, los avistamientos y la relación visible entre clima y tipos. [Mapa](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1084-what-is-the-map-view/) · [Clima](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1099-what-are-weather-boosts/)
- Cobblemon sirvió como referencia para la jerarquía de las fichas y la identidad visual de un instrumento de exploración Pokémon. [Galería](https://modrinth.com/mod/cobblemon/gallery)
- Alba aportó una referencia de exploración tranquila, observación de fauna y descubrimiento. [Proceso de diseño](https://ustwogames.co.uk/news/the-environment-art-of-alba-a-wildlife-adventure/)
- Redline inspiró la secuencia de globo, descenso y paisaje. PokéRadar aplica ese recorrido a un mapa navegable. [MotionSites](https://motionsites.ai/?prompt=redline-mars-hero)
- Merlin sirvió como referencia para organizar una guía de especies y una colección personal. [Merlin Bird ID](https://www.merlinbirds.org/)

## 2. Arquitectura y stack

| Tecnología | Responsabilidad |
| --- | --- |
| Next.js App Router y React | Composición de la aplicación y renderizado inicial |
| TypeScript estricto | Contratos de datos, estados y límites entre componentes |
| Tailwind CSS y CSS | Estilos globales y utilidades accesibles, con hojas específicas para las vistas |
| MapLibre GL JS y OpenFreeMap | Cartografía vectorial, marcadores y movimientos de cámara |
| Three.js | Cámara panorámica y proyección de los avistamientos de Safari |
| Framer Motion, hoy Motion para React | Transiciones de paneles, estadísticas y registro con `motion/react` |
| TanStack Query | Caché de datos remotos, cancelación, carga y reintentos |
| Radix UI | Primitivas accesibles para diálogos |
| Lucide | Iconografía de navegación y acciones |
| Vitest y Playwright | Pruebas de las reglas de dominio y del recorrido en Chromium |

### Organización

```text
src/
  app/           Página, layout, metadatos y estilos globales
  components/    Explorador, mapa, fichas, escenas, radar, atlas y análisis
  lib/           Catálogo, métricas, reglas de Safari, adaptadores y progreso
public/
  destinations/  Fotografías de portada
  expeditions/   Panoramas de la exploración a pie
  safari/        Paisajes de las 21 zonas de Safari
  map/           Texturas y datos para la vista del globo
e2e/             Pruebas de navegación en Chromium
```

[`page.tsx`](src/app/page.tsx) y [`layout.tsx`](src/app/layout.tsx) son Server Components. [`explorer.tsx`](src/components/explorer.tsx) es el límite cliente que coordina la selección y el progreso. Importa MapLibre mediante `next/dynamic` con `ssr: false`, de modo que el mapa se inicializa con acceso a las APIs del navegador. Una instancia conserva la cámara al cambiar de escala o abrir una escena. Al entrar por el mapa, el radar de pantalla completa permanece dos segundos como mínimo y se retira cuando el mapa está listo. La exploración a pie y Safari se cargan al entrar a cada vista. Safari decodifica el panorama de la zona elegida y cambia la textura durante el fundido. La vista 360° proyecta cada panorama equirectangular completo con muestreo continuo en la unión. En pantallas grandes de alta densidad usa texturas de 4096 × 2048; en pantallas pequeñas o con ahorro de datos usa 2560 × 1280. Cada zona se descarga cuando se necesita. Si no hay WebGL, una vista plana conserva el giro horizontal, el radar y las fichas.

El ID de `Encounter` identifica el lugar del hallazgo y el ID de PokéAPI identifica la especie. [`safari.ts`](src/lib/safari.ts) calcula los avistamientos a partir del destino, la fase y el reloj, y ambas vistas de radar comparten el resultado. Cada señal tiene un rumbo calculado a partir de la zona, la especie y el inicio de su aparición. La escena y el radar usan ese mismo rumbo y los Pokémon activos mantienen su posición.

El [modelo de análisis](src/lib/expedition-analysis.ts) es una función pura que recibe el catálogo, el progreso, la hora y las condiciones disponibles. Calcula métricas y recomendaciones sin depender de React. El [panel de análisis](src/components/expedition-analysis.tsx) comparte la caché meteorológica con el mapa mediante TanStack Query y actualiza las métricas al cambiar el intervalo del Safari. La [vista del atlas](src/components/atlas-panel.tsx) se extrajo de Explorer y recibe los datos y acciones por props.

Los adaptadores validan los datos externos en tiempo de ejecución. Las consultas de ficha y descripción usan caché por especie y `AbortSignal`. La ficha puede mostrar sus datos principales aunque falle la descripción. El clima se consulta y se cachea por destino.

El progreso se guarda en `localStorage` bajo `pokeradar.research.v1`. Su lectura valida la versión, los IDs del catálogo, las fechas y el límite del equipo. Los registros duplicados y las referencias inválidas se descartan. Si el almacenamiento falla, la experiencia puede continuar en memoria durante la sesión.

La URL conserva el destino, la vista y el avistamiento seleccionado. `/?region=nikko&view=field` abre el claro de los cedros y `/?region=iguazu&view=safari` abre el paseo de Iguazú. `/?region=iguazu&view=radar` abre su radar en el mapa. `/?region=nikko&encounter=nikko-pikachu` permite compartir una ficha con su contexto geográfico.

### Ejecutar localmente

Usá Node.js 24 LTS y npm. Los servicios que consume la aplicación funcionan sin claves de API.

```bash
npm ci
npm run dev
```

Abrí [localhost:3000](http://localhost:3000).

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` sirve el build de producción después de ejecutar `npm run build`.

### Despliegue en Vercel

Importá el repositorio con el preset de Next.js y mantené `npm run build` como comando de compilación. El script `prebuild` copia a `public/vendor/` el worker de la versión instalada de MapLibre para que pueda cargarse desde el mismo origen. No se requieren variables de entorno. [Guía de Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)

### Validación

Para ejecutar el recorrido automatizado en Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Las 65 pruebas unitarias cubren la validación de respuestas de las APIs, la recuperación de datos guardados, el límite del equipo y las reglas del Safari. La suite de 23 pruebas de navegador comprueba los 93 avistamientos de exploración a pie y cubre situaciones concretas: que una respuesta lenta no reemplace la ficha seleccionada después, que el radar siga disponible si falla un panorama y que se pueda encontrar un Pokémon detrás de la cámara. [Pruebas de navegador](e2e)

El análisis tiene pruebas de cálculo y navegación. Comprueban que los registros cambien la cobertura y las señales pendientes, que la recomendación aplique el orden previsto y que falle un pronóstico sin impedir la comparación. También verifican la selección de región, el cambio de métrica y el acceso al mapa desde el panel móvil. [Modelo y pruebas](src/lib/expedition-analysis.test.ts) · [Recorrido del panel](e2e/analysis.spec.ts)

Con Codex también hice una comprobación en producción: el recorrido del globo a la ficha de Pikachu funcionó en Chromium de escritorio y WebKit con tamaño de pantalla móvil, con respuestas reales de PokéAPI y Open-Meteo. Para revisar el giro usé WebKit en los panoramas y probé el arrastre del globo con gestos táctiles simulados en Chromium.

## 3. Uso de inteligencia artificial (AI-Native Workflow)

Definí la experiencia como un diario de expedición a escala global. Usé Codex para explorar referencias, generar y revisar código y escribir pruebas. Mi parte fue probar las versiones en el navegador, señalar qué fallaba y definir el comportamiento esperado antes de iterar. Usé ImageGen para los siete panoramas de campo y los 21 fondos de Safari. Los paisajes se exportaron en WebP y se revisaron dentro de la interfaz para ajustar encuadre y contraste. En el Safari reemplacé los fondos reflejados por panoramas esféricos. Restauré el detalle con el modelo [Real-ESRGAN General x4v3](https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0) y verifiqué el giro en el navegador. Las texturas de 4096 píxeles son reescaladas a partir de las fuentes de 1774 píxeles de ancho. Son recreaciones ilustrativas de los biomas.

### Correcciones y comprobaciones durante el trabajo

- **El zoom mínimo cambiaba el aspecto del globo.** Lo encontré al alejar por completo el mapa regional: se perdía el fondo de estrellas y reaparecía el globo cartográfico. Pedí separar los límites de zoom de las dos vistas. La prueba lleva ambas hasta su mínimo y comprueba que conserven su contexto. [Prueba del globo y el mapa regional](e2e/world-context.spec.ts)
- **El primer Safari se sentía lineal y las señales quedaban casi siempre de frente.** Pedí elegir zonas desde un radar siempre visible, desacelerar el giro y actualizar los avistamientos cada 30 segundos. Al probar el giro completo vi que faltaban encuentros detrás. Pedí mantener un avistamiento cerca de la entrada y variar el rumbo de los demás. El radar y la escena comparten ese rumbo, y un encuentro activo conserva su posición. La prueba gira hasta encontrar un Pokémon que empezó fuera del encuadre. [Prueba de un avistamiento detrás de la cámara](e2e/safari-walk.spec.ts#L141)
- **En el celular, el globo quedaba chico y el giro era demasiado rápido.** Lo señalé con una captura y pedí que la tarjeta cediera espacio al mapa. La versión móvil deja los tres accesos principales a la vista y mueve el clima y los Pokémon de muestra a **Detalles**. En Safari pedí abrir el ángulo de cámara y compactar el radar. Con Codex comprobamos la vista en vertical y horizontal, el arrastre y el zoom con dos dedos.
- **La unión de los panoramas tenía una línea y, en Iguazú, manchas azules.** Detecté el problema al girar y compartí capturas. El ajuste podía escribir colores fuera de rango. Corregimos el cálculo, procesamos las texturas desde los originales y revisamos el giro en las 21 zonas con WebKit. [Preparación de panoramas](scripts/prepare-safari-panoramas.mjs)
- **La compilación de producción no cargaba el mapa.** La primera implementación dejaba sin resolver el worker de MapLibre y la lista alternativa podía ocultar el fallo. Pedí probar el mapa real en Chromium. El build ahora copia el worker de la versión instalada para servirlo desde el mismo origen. [Preparación del worker](scripts/prepare-map-worker.mjs)
- **La validación inicial de PokéAPI devolvió HTTP 403.** Repetimos la consulta con la URL canónica y un agente de usuario explícito. Los adaptadores usan esas rutas y validan la estructura de las respuestas antes de mostrar los datos.

## 4. Próximos pasos

Con una semana adicional ampliaría el trabajo en estas direcciones.

1. Observar a usuarios que llegan por primera vez. Medir cuánto tardan en encontrar y registrar su primer Pokémon, y ajustar las instrucciones o controles donde se traben.
2. Medir el tiempo hasta que el mapa se puede usar y los cambios de zona en celulares de gama media. Separar la coordinación de cámara y paneles para probar esas interacciones de forma aislada.
3. Validar en CI que los identificadores y las imágenes de cada expedición sigan disponibles. Agregar pruebas de teclado y conexión intermitente antes de ampliar el catálogo.
4. Diseñar sincronización opcional entre dispositivos y una migración que conserve el diario local existente.
5. Ampliar el catálogo y definir probabilidades de aparición por zona, con un tratamiento específico para Pokémon variocolor y legendarios.

## Fuentes y créditos

- Datos y recursos de Pokémon mediante PokéAPI y su repositorio de sprites. Los textos breves de campo adaptan descripciones de la Pokédex. [PokéAPI](https://pokeapi.co/docs/v2) · [Sprites](https://github.com/PokeAPI/sprites)
- Cartografía vectorial mediante OpenFreeMap y datos de OpenStreetMap. Las atribuciones se conservan en el mapa. [OpenFreeMap](https://openfreemap.org/) · [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Texturas del globo de NASA Earth Observatory. Blue Marble Next Generation aporta color natural, topografía y batimetría. Black Marble 2016 aporta las luces nocturnas, con imágenes de Joshua Stevens y datos Suomi NPP VIIRS de Miguel Román, NASA Goddard Space Flight Center. [Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/) · [Black Marble](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/)
- Datos meteorológicos de Open-Meteo. [Open-Meteo](https://open-meteo.com/)
- Pokémon y los nombres de sus personajes pertenecen a sus respectivos titulares. Este proyecto es una demostración técnica de exploración geoespacial.
- Fotografías de portada de Unsplash. [Bosque](https://images.unsplash.com/photo-1448375240586-882707db888b) · [Islandia](https://images.unsplash.com/photo-1476610182048-b716b8518aae) · [Namib](https://unsplash.com/photos/nt66_G8DCBM) · [Zermatt, Manuel Hodel](https://unsplash.com/photos/HVB2Mwj_txQ) · [Gran Barrera de Coral, GeoNadir](https://unsplash.com/photos/b78E12dTxlo)
- Paisajes ilustrativos generados con ImageGen. [Exploración a pie](public/expeditions) · [Safari](public/safari)
- Tipografía de sistema Helvetica Neue, con Helvetica y Arial como alternativas según el dispositivo.
