import type { Expedition } from './types';

// Coordinates are curated fictional sightings. Species metadata was checked
// against PokéAPI; the geographical association is part of the simulation.
export const EXPEDITIONS: Expedition[] = [
  {
    id: 'nikko', name: 'Bosques de Nikkō', country: 'Japón', biome: 'Bosque templado',
    description: 'Entre cedros, senderos y ríos de montaña, la vida se esconde a plena vista. Acercate y descubrí quién habita este bosque.',
    coordinates: [139.599, 36.759], zoom: 13.5, color: '#53794f', image: '/destinations/nikko.jpg',
    encounters: [
      { id: 'nikko-bulbasaur', pokemonId: 1, name: 'Bulbasaur', types: ['grass', 'poison'], coordinates: [139.595, 36.755], rationale: 'En esta expedición simulada, los claros húmedos del bosque ofrecen luz y refugio a Bulbasaur.' },
      { id: 'nikko-pikachu', pokemonId: 25, name: 'Pikachu', types: ['electric'], coordinates: [139.605, 36.76], rationale: 'Avistamiento simulado entre los cedros, donde Pikachu encuentra frutos y protección.' },
      { id: 'nikko-caterpie', pokemonId: 10, name: 'Caterpie', types: ['bug'], coordinates: [139.591, 36.764], rationale: 'Las hojas tiernas del sotobosque son el hábitat elegido para este avistamiento simulado de Caterpie.' },
      { id: 'nikko-oddish', pokemonId: 43, name: 'Oddish', types: ['grass', 'poison'], coordinates: [139.602, 36.768], rationale: 'La simulación sitúa a Oddish en un rincón de suelo húmedo y sombra junto al bosque.' },
      { id: 'nikko-scyther', pokemonId: 123, name: 'Scyther', types: ['bug', 'flying'], coordinates: [139.615, 36.756], rationale: 'Scyther patrulla un claro del bosque en esta interpretación ficticia de su hábitat.' },
      { id: 'nikko-hoothoot', pokemonId: 163, name: 'Hoothoot', types: ['normal', 'flying'], coordinates: [139.611, 36.767], rationale: 'Las copas altas sirven de observatorio a Hoothoot en este encuentro simulado.' },
    ],
  },
  {
    id: 'reykjanes', name: 'Tierras de fuego', country: 'Islandia', biome: 'Paisaje volcánico',
    description: 'Roca oscura, vapor y senderos de lava antigua. Explorá un paisaje volcánico donde cada grieta invita a mirar de nuevo.',
    coordinates: [-22.691, 63.819], zoom: 12.9, color: '#ad6549', image: '/destinations/reykjanes.jpg',
    encounters: [
      { id: 'reykjanes-charmander', pokemonId: 4, name: 'Charmander', types: ['fire'], coordinates: [-22.693, 63.818], rationale: 'La simulación asocia a Charmander con el calor geotérmico del paisaje de Reykjanes.' },
      { id: 'reykjanes-vulpix', pokemonId: 37, name: 'Vulpix', types: ['fire'], coordinates: [-22.681, 63.826], rationale: 'Un refugio entre rocas volcánicas inspira este avistamiento simulado de Vulpix.' },
      { id: 'reykjanes-geodude', pokemonId: 74, name: 'Geodude', types: ['rock', 'ground'], coordinates: [-22.711, 63.826], rationale: 'Las formaciones de basalto son el escenario elegido para este encuentro ficticio con Geodude.' },
      { id: 'reykjanes-onix', pokemonId: 95, name: 'Onix', types: ['rock', 'ground'], coordinates: [-22.712, 63.813], rationale: 'Onix aparece junto a un campo de lava en esta interpretación simulada de su entorno rocoso.' },
      { id: 'reykjanes-slugma', pokemonId: 218, name: 'Slugma', types: ['fire'], coordinates: [-22.681, 63.814], rationale: 'La actividad geotérmica inspira la ubicación ficticia de Slugma, un Pokémon de magma.' },
      { id: 'reykjanes-numel', pokemonId: 322, name: 'Numel', types: ['fire', 'ground'], coordinates: [-22.67, 63.82], rationale: 'El terreno volcánico abierto conecta con la naturaleza de Numel en este avistamiento simulado.' },
    ],
  },
  {
    id: 'namib', name: 'Dunas del Namib', country: 'Namibia', biome: 'Desierto',
    description: 'Dunas que cambian con el viento y pequeñas huellas sobre la arena. Buscá la vida que prospera entre el calor y el silencio.',
    coordinates: [15.297, -24.734], zoom: 12.4, color: '#a6793e', image: '/destinations/namib.jpg',
    encounters: [
      { id: 'namib-sandshrew', pokemonId: 27, name: 'Sandshrew', types: ['ground'], coordinates: [15.278, -24.727], rationale: 'La arena suelta ofrece un lugar para excavar en este avistamiento simulado de Sandshrew.' },
      { id: 'namib-diglett', pokemonId: 50, name: 'Diglett', types: ['ground'], coordinates: [15.306, -24.721], rationale: 'La simulación ubica a Diglett bajo una llanura arenosa protegida entre dunas.' },
      { id: 'namib-cubone', pokemonId: 104, name: 'Cubone', types: ['ground'], coordinates: [15.287, -24.744], rationale: 'Un paisaje seco y solitario inspira el lugar elegido para este encuentro ficticio con Cubone.' },
      { id: 'namib-trapinch', pokemonId: 328, name: 'Trapinch', types: ['ground'], coordinates: [15.315, -24.739], rationale: 'Trapinch encuentra arena para sus trampas en esta representación simulada de su hábitat.' },
      { id: 'namib-cacnea', pokemonId: 331, name: 'Cacnea', types: ['grass'], coordinates: [15.271, -24.739], rationale: 'La resistencia de Cacnea a los ambientes áridos inspira su presencia ficticia en el desierto.' },
      { id: 'namib-sandile', pokemonId: 551, name: 'Sandile', types: ['ground', 'dark'], coordinates: [15.322, -24.726], rationale: 'En esta simulación, Sandile se oculta bajo la superficie cálida de una duna.' },
    ],
  },
  {
    id: 'zermatt', name: 'Cumbres de Zermatt', country: 'Suiza', biome: 'Alta montaña',
    description: 'Aire frío, roca y nieve en el horizonte. Seguí el relieve alpino para encontrar especies que se sienten en casa a estas alturas.',
    coordinates: [7.749, 45.987], zoom: 12.8, color: '#648a9a', image: '/destinations/zermatt.jpg',
    encounters: [
      { id: 'zermatt-sneasel', pokemonId: 215, name: 'Sneasel', types: ['dark', 'ice'], coordinates: [7.733, 45.993], rationale: 'Las laderas frías y rocosas son el escenario de este encuentro simulado con Sneasel.' },
      { id: 'zermatt-swinub', pokemonId: 220, name: 'Swinub', types: ['ice', 'ground'], coordinates: [7.754, 45.999], rationale: 'La simulación sitúa a Swinub en terreno alpino donde puede buscar alimento bajo el suelo.' },
      { id: 'zermatt-delibird', pokemonId: 225, name: 'Delibird', types: ['ice', 'flying'], coordinates: [7.769, 45.99], rationale: 'Los pasos de montaña inspiran este avistamiento ficticio de Delibird.' },
      { id: 'zermatt-snorunt', pokemonId: 361, name: 'Snorunt', types: ['ice'], coordinates: [7.742, 45.98], rationale: 'Un rincón frío de la montaña alberga a Snorunt en esta interpretación simulada.' },
      { id: 'zermatt-snover', pokemonId: 459, name: 'Snover', types: ['grass', 'ice'], coordinates: [7.765, 45.98], rationale: 'La transición entre vegetación y nieve inspira la ubicación simulada de Snover.' },
      { id: 'zermatt-vanillite', pokemonId: 582, name: 'Vanillite', types: ['ice'], coordinates: [7.724, 45.984], rationale: 'La nieve de altura es el escenario elegido para este encuentro ficticio con Vanillite.' },
    ],
  },
  {
    id: 'heron', name: 'Arrecife de Heron', country: 'Australia', biome: 'Costa y arrecife',
    description: 'El azul cambia a cada metro entre la isla y el arrecife. Explorá la costa y sus aguas para descubrir una expedición llena de vida.',
    coordinates: [151.916, -23.444], zoom: 14, color: '#408d91', image: '/destinations/heron.jpg',
    encounters: [
      { id: 'heron-squirtle', pokemonId: 7, name: 'Squirtle', types: ['water'], coordinates: [151.909, -23.443], rationale: 'La playa y el agua poco profunda inspiran este avistamiento simulado de Squirtle.' },
      { id: 'heron-psyduck', pokemonId: 54, name: 'Psyduck', types: ['water'], coordinates: [151.913, -23.44], rationale: 'Psyduck recorre una orilla tranquila en esta interpretación ficticia de su hábitat.' },
      { id: 'heron-horsea', pokemonId: 116, name: 'Horsea', types: ['water'], coordinates: [151.924, -23.439], rationale: 'La simulación sitúa a Horsea entre las aguas protegidas del arrecife.' },
      { id: 'heron-staryu', pokemonId: 120, name: 'Staryu', types: ['water'], coordinates: [151.922, -23.447], rationale: 'Un fondo marino somero es el lugar elegido para este encuentro simulado con Staryu.' },
      { id: 'heron-magikarp', pokemonId: 129, name: 'Magikarp', types: ['water'], coordinates: [151.907, -23.449], rationale: 'Magikarp nada cerca de la isla en esta representación ficticia de la expedición.' },
      { id: 'heron-corsola', pokemonId: 222, name: 'Corsola', types: ['water', 'rock'], coordinates: [151.929, -23.444], rationale: 'La afinidad de Corsola con los arrecifes inspira este avistamiento simulado.' },
    ],
  },
];
