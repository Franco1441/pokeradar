# PokéRadar · Diario de expedición

Explorá siete hábitats del mundo, investigá Pokémon y construí tu propio diario de campo. Proyecto realizado para el desafío técnico Frontend Engineer Junior de DataInt.

## 1. Concepto y narrativa

PokéRadar propone un recorrido de investigación con 93 especies repartidas entre siete expediciones. El mapa abre como un globo interactivo. Podés girarlo o elegir un destino en el panel para descender a los bosques de Nikkō, Reykjanes, el Namib, Zermatt, el arrecife de Heron, la selva de Iguazú o los humedales de Everglades. Cada destino tiene seis avistamientos en el mapa regional y entre doce y quince en la exploración a pie. El Safari mantiene entre seis y nueve encuentros activos en tres zonas.

El recorrido principal consiste en viajar, encontrar un Pokémon, consultar su ficha y registrar el encuentro. Cada expedición propone registrar tres especies y conocer al menos dos tipos diferentes. Los descubrimientos completan un atlas personal y permiten formar un equipo de seis favoritos.

El globo muestra el día, el crepúsculo y la noche según la posición aproximada del sol. El botón **Ver día y noche** centra la cámara en el límite entre ambos. Las luces representan observaciones satelitales de NASA Black Marble de 2016 y se atenúan hacia la zona iluminada. Una capa de MapLibre renderiza las texturas satelitales, mezcla la sombra solar de forma continua y dibuja el halo de la atmósfera. Al acercar la cámara, la capa se funde con la cartografía regional.

Cada expedición tiene un punto de entrada georreferenciado a una vista panorámica en primera persona. Podés entrar con doble clic sobre un destino del globo o con el botón de exploración de su tarjeta. En el mapa regional también podés tocar el marcador del sendero. Al seleccionar un destino se empieza a cargar su panorama. La cámara se acerca al punto de entrada y la transición espera a que la escena esté lista para disipar la neblina. Con movimiento reducido la entrada es directa. Arrastrá el paisaje o usá las flechas para recorrer los avistamientos. Tres Pokémon por destino se revelan al examinar una pista marcada. Los demás están a la vista. Después de registrar una especie, podés enfocar la siguiente pista pendiente con un botón. Las fichas comparten el catálogo y el progreso del mapa. El globo muestra clima, hora local y dos especies del destino enfocado. Al consultar una de esas especies, la ficha se abre en el mismo panel y se puede volver al destino con el globo en la misma posición. Si el globo no carga, podés elegir un destino y abrir sus avistamientos o su panorama.

| Destino | Escena | Pistas |
| --- | --- | --- |
| Nikkō | Claro de los cedros | Bulbasaur, Caterpie y Hoothoot |
| Reykjanes | Campo de basalto | Charmander, Geodude y Vulpix |
| Namib | Paso de las dunas | Sandshrew, Cacnea y Sandile |
| Zermatt | Mirador del glaciar | Sneasel, Swinub y Delibird |
| Heron | Jardín de coral | Squirtle, Corsola y Horsea |
| Iguazú | Sendero de las cataratas | Aipom, Lotad y Tropius |
| Everglades | Canal de los cipreses | Totodile, Croagunk y Ducklett |

Desde el mapa regional podés abrir **Clima local** para consultar las condiciones y los tipos favorecidos. Cada ficha explica la relación propuesta entre especie y hábitat.

Safari permite moverse entre tres zonas de cada expedición. Al tocar una zona en el radar de campo, la cámara se desplaza y conserva tu orientación. Podés girar 360° con un arrastre o con las flechas. El paisaje envolvente de Safari se construye a partir de las imágenes de cada destino. Los Pokémon entran y salen en distintos momentos y algunos aparecen a un costado o detrás. El radar indica hacia dónde mirás, cuánto falta para el próximo cambio y en qué zona se detectó una especie que todavía no registraste. **En vivo** usa el dato de luz de Open-Meteo y estima la fase mediante la hora local si el servicio falla. **Día** y **Noche** permiten probar ambas fases conservando la lectura meteorológica del lugar. Podés abrir una ficha y registrar el encuentro sin perder tu zona. Si WebGL falla, el radar, las fichas y el cambio de zona siguen disponibles en una vista panorámica. El mapa mide el espacio libre junto a la ficha y confirma la llegada con un anillo anclado al marcador. Al completar una expedición, el atlas guarda una postal del primer hallazgo que cumplió los dos objetivos, con el panorama y la fecha local.

### Datos reales y simulación

Los nombres, tipos, estadísticas, medidas, imágenes, descripciones y sonidos provienen de PokéAPI. Las condiciones meteorológicas provienen de Open-Meteo. Las coordenadas de los avistamientos y sus asociaciones con los destinos son una curaduría ficticia del proyecto, identificada en la interfaz.

Los 93 identificadores y tipos del catálogo fueron contrastados con PokéAPI. El catálogo local permite dibujar el mapa y ofrecer filtros inmediatamente. Al abrir una ficha, la aplicación consulta los datos detallados de la especie en la API.

### Referencias de experiencia

- El globo interactivo de Apple Maps inspiró la vista estrellada y el tratamiento visual de la transición solar. [Apple Maps](https://www.apple.com/maps/)
- Pokémon GO inspiró el mapa protagonista, los avistamientos y la relación visible entre clima y tipos. [Mapa](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1084-what-is-the-map-view/) · [Clima](https://scopelyexplore.helpshift.com/hc/en/5-pokemon-go/faq/1099-what-are-weather-boosts/)
- Cobblemon sirvió como referencia para la jerarquía de las fichas y la identidad visual de un instrumento de exploración Pokémon. [Galería](https://modrinth.com/mod/cobblemon/gallery)
- Alba aportó una referencia de exploración tranquila, observación de fauna y descubrimiento. [Proceso de diseño](https://ustwogames.co.uk/news/the-environment-art-of-alba-a-wildlife-adventure/)
- Redline, el prompt de MotionSites compartido por Franco, inspiró la secuencia continua de globo, descenso y paisaje. PokéRadar usa esa estructura para cambiar de escala en un mapa real. [Referencia](https://motionsites.ai/?prompt=redline-mars-hero)
- Merlin sirvió como referencia para organizar una guía de especies y una colección personal. [Merlin Bird ID](https://www.merlinbirds.org/)

## 2. Arquitectura y stack

| Tecnología | Responsabilidad |
| --- | --- |
| Next.js App Router y React | Composición de la aplicación y renderizado inicial |
| TypeScript estricto | Contratos de datos, estados y límites entre componentes |
| Tailwind CSS y CSS | Sistema visual, estilos y adaptación responsive |
| MapLibre GL JS y OpenFreeMap | Cartografía vectorial, marcadores y movimientos de cámara |
| Three.js | Cámara, recorrido y geometría de Safari |
| Motion para React, antes Framer Motion | Transiciones de paneles, estadísticas y registro |
| TanStack Query | Caché de datos remotos, cancelación, carga y reintentos |
| Radix UI | Primitivas accesibles para diálogos |
| Lucide | Iconografía de navegación y acciones |
| Vitest | Pruebas de reglas de dominio y adaptación de APIs |

### Organización

```text
src/
  app/           Página, layout, metadatos y estilos globales
  components/    Explorador, mapa, ficha Pokémon y observatorio
  lib/           Catálogo, contratos, APIs, progreso y sincronización
public/
  destinations/  Imágenes de los destinos
```

La página y el layout son Server Components. El explorador es el límite cliente que contiene el estado interactivo. La importación dinámica del mapa usa `ssr: false` desde ese componente cliente, porque MapLibre necesita las APIs del navegador. Una sola instancia del mapa conserva el contexto durante los cambios de escala y permanece montada al entrar al claro. La escena panorámica se importa y carga al abrir el modo de campo. Los puntos interactivos se vinculan por ID a los avistamientos existentes.

El modelo distingue `Expedition`, `Encounter`, `PokemonDetail`, `WeatherSnapshot` y `ResearchProgress`. El ID del avistamiento identifica el lugar del encuentro y el ID del Pokémon identifica la especie consultada en PokéAPI.

Las fichas y descripciones se consultan de manera independiente. Una descripción que falla permite conservar los datos principales de la criatura. Las consultas reciben `AbortSignal` para cancelar trabajo obsoleto y comparten caché por especie. El clima se consulta por destino, con una vigencia de 15 minutos antes de volver a considerarse desactualizado.

El progreso se guarda en `localStorage` bajo `pokeradar.research.v1`. Su lectura valida la versión, los IDs del catálogo, las fechas y el límite del equipo. Los registros duplicados y las referencias inválidas se descartan. Si el almacenamiento falla, la experiencia puede continuar en memoria durante la sesión.

La URL conserva el destino, la vista y el avistamiento seleccionado. `/?region=nikko&view=field` abre el claro de los cedros y `/?region=iguazu&view=safari` abre el paseo de Iguazú. `/?region=iguazu&view=radar` abre su radar en el mapa. `/?region=nikko&encounter=nikko-pikachu` permite compartir una ficha con su contexto geográfico.

### Ejecutar localmente

Requiere Node.js 20.19 o posterior y npm. La aplicación consume servicios públicos sin claves de API.

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

`npm start` sirve el build de producción después de ejecutar `npm run build`. Vercel detecta Next.js al importar el repositorio. Usá `npm run build` como comando de compilación para generar también el worker de MapLibre.

### Validación

Para ejecutar el recorrido automatizado en Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Las pruebas unitarias cubren el registro idempotente, la separación entre expediciones, el límite de seis favoritos, la recuperación de datos guardados incompletos, el cumplimiento de objetivos, los códigos meteorológicos, la conversión de medidas de PokéAPI, la cancelación de consultas y la descripción en español. Las reglas del Safari se prueban con cambios de fase, clima y zona horaria, además del ciclo de aparición y retiro de cada señal.

Pasaron TypeScript, ESLint, 58 pruebas unitarias, 18 pruebas E2E y la compilación de producción. Las pruebas E2E recorren los 93 avistamientos de campo, verifican el descenso directo a Heron y el doble clic, prueban el cambio de zona y la actualización del radar al aparecer, retirarse o registrar un Pokémon y comprueban el acceso a las fichas sin WebGL. También verifican los límites de zoom, el contexto de la ficha en el globo y la reapertura de una postal después de recargar. El globo solar, Safari y las expediciones se verificaron en Chrome, en escritorio y celular, con cartografía, clima y fichas reales.

## 3. Uso de inteligencia artificial

Se utilizó Codex para analizar la consigna, investigar referencias, proponer alternativas de producto, implementar componentes y revisar casos de error. Franco dirigió la elección del producto mediante decisiones explícitas de experiencia y diseño.

Una primera propuesta se centraba en Argentina. Franco pidió explorar otras direcciones, incorporó Cobblemon y Pokémon GO como referencias y eligió combinar expediciones, atlas y observatorio. También definió una estética natural y luminosa, investigación y colección, y un clima que destaca actividad manteniendo disponibles los avistamientos.

### Correcciones y comprobaciones durante el trabajo

- La primera consulta de validación a PokéAPI se hizo mediante `urllib` sin la barra final y devolvió HTTP 403. Se probó la ruta canónica terminada en `/` y un agente de usuario explícito, y las 30 consultas devolvieron datos válidos. Los adaptadores de la aplicación usan las rutas canónicas. La prueba permitió corregir la integración y evitó interpretar esa respuesta como ausencia de las especies.
- El primer build de producción no cargó el worker de MapLibre. Una prueba en Chromium reprodujo el error que las pruebas con la lista de avistamientos habían pasado por alto. El build ahora copia el worker de la versión instalada y el mapa lo carga desde el mismo origen.
- Al definir la expedición de Heron se detectó que cinco especies comparten únicamente el tipo Agua. Corsola aporta Agua y Roca, por lo que el segundo objetivo depende de descubrirla. Se añadió una prueba que verifica que registrar tres especies de Agua deja la expedición en progreso y que registrar Corsola satisface la diversidad requerida.
- Los datos guardados se trataron como entrada externa. Las pruebas comprobaron JSON inválido, registros duplicados, especies ajenas al catálogo, fechas inválidas y equipos con más de seis miembros. Esto concretó una validación más completa que asumir que cada lectura de `localStorage` contendría el estado esperado.

Los siete panoramas se generaron con ImageGen a la altura de los ojos y se optimizaron a WebP. Cada escena usa sus propios elementos del bioma para ubicar las pistas. Se revisaron la composición, el encuadre en pantallas chicas y el contraste de los controles. Los paisajes son recreaciones ilustrativas de los biomas.

## 4. Próximos pasos

Con una semana adicional ampliaría el trabajo en estas direcciones.

1. Probar el recorrido con usuarios y ajustar la visibilidad de objetivos, filtros y registro según sus dificultades reales.
2. Incorporar más expediciones y especies mediante una validación automatizada del catálogo y sus recursos.
3. Añadir sincronización opcional del diario entre dispositivos, con una migración del progreso local existente.
4. Mejorar el comportamiento con conexión intermitente y la conservación de los últimos datos consultados.
5. Ampliar las pruebas de integración de mapa, teclado, selección rápida y navegación móvil, y medir rendimiento sobre dispositivos de gama media.

## Fuentes y créditos

- Datos y recursos de Pokémon mediante PokéAPI y su repositorio de sprites. [PokéAPI](https://pokeapi.co/docs/v2) · [Sprites](https://github.com/PokeAPI/sprites)
- Cartografía vectorial mediante OpenFreeMap y datos de OpenStreetMap. Las atribuciones se conservan en el mapa. [OpenFreeMap](https://openfreemap.org/) · [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Texturas del globo de NASA Earth Observatory. Blue Marble Next Generation aporta color natural, topografía y batimetría. Black Marble 2016 aporta las luces nocturnas, con imágenes de Joshua Stevens y datos Suomi NPP VIIRS de Miguel Román, NASA Goddard Space Flight Center. [Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/) · [Black Marble](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/)
- Datos meteorológicos de Open-Meteo. [Open-Meteo](https://open-meteo.com/)
- Pokémon y los nombres de sus personajes pertenecen a sus respectivos titulares. Este proyecto es una demostración técnica de exploración geoespacial.

- Fotografías ilustrativas de hábitats en Unsplash. [Bosque](https://images.unsplash.com/photo-1448375240586-882707db888b) · [Islandia](https://images.unsplash.com/photo-1476610182048-b716b8518aae) · [Namib](https://unsplash.com/photos/nt66_G8DCBM) · [Zermatt, Manuel Hodel](https://unsplash.com/photos/HVB2Mwj_txQ) · [Gran Barrera de Coral, GeoNadir](https://unsplash.com/photos/b78E12dTxlo)
- Tipografía de sistema Helvetica Neue, con Helvetica y Arial como alternativas según el dispositivo.
