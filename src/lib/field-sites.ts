export interface FieldClue {
  encounterId: string;
  label: string;
  observation: string;
  x: number;
  y: number;
}

type FieldSighting = readonly [encounterId: string, x: number, y: number];

export interface FieldSite {
  name: string;
  action: string;
  coordinates: [number, number];
  image: string;
  accent: string;
  clues: readonly FieldClue[];
  sightings: readonly FieldSighting[];
}

const FIELD_SITES = new Map<string, FieldSite>([
  [
    "nikko",
    {
      name: "Claro de los cedros",
      action: "Explorar a pie",
      coordinates: [139.605, 36.7545],
      image: "/expeditions/nikko-field.webp",
      accent: "#dce9bd",
      clues: [
        {
          encounterId: "nikko-bulbasaur",
          label: "Movimiento entre los helechos",
          observation: "Un bulbo asoma entre los helechos del claro.",
          x: 0.24,
          y: 0.65,
        },
        {
          encounterId: "nikko-caterpie",
          label: "Hojas que se mueven",
          observation: "Caterpie se refugia bajo las hojas tiernas.",
          x: 0.53,
          y: 0.43,
        },
        {
          encounterId: "nikko-hoothoot",
          label: "Una silueta en las ramas",
          observation: "Hoothoot observa el claro desde una rama.",
          x: 0.85,
          y: 0.31,
        },
      ],
      sightings: [
        ["nikko-shroomish", 0.09, 0.74],
        ["nikko-pikachu", 0.285, 0.53],
        ["nikko-deerling", 0.335, 0.61],
        ["nikko-leafeon", 0.39, 0.7],
        ["nikko-butterfree", 0.46, 0.35],
        ["nikko-oddish", 0.63, 0.7],
        ["nikko-scyther", 0.745, 0.57],
        ["nikko-noctowl", 0.94, 0.44],
      ],
    },
  ],
  [
    "reykjanes",
    {
      name: "Campo de basalto",
      action: "Explorar a pie",
      coordinates: [-22.695, 63.823],
      image: "/expeditions/reykjanes-field.webp",
      accent: "#ffd0a5",
      clues: [
        {
          encounterId: "reykjanes-charmander",
          label: "Un destello entre las grietas",
          observation: "La llama de Charmander ilumina una grieta del basalto.",
          x: 0.23,
          y: 0.63,
        },
        {
          encounterId: "reykjanes-geodude",
          label: "Una piedra que se mueve",
          observation: "Geodude se confunde con las piedras del campo de lava.",
          x: 0.52,
          y: 0.55,
        },
        {
          encounterId: "reykjanes-vulpix",
          label: "Huellas junto al musgo",
          observation:
            "Vulpix se refugia del viento entre las rocas cubiertas de musgo.",
          x: 0.81,
          y: 0.59,
        },
      ],
      sightings: [
        ["reykjanes-slugma", 0.09, 0.72],
        ["reykjanes-rolycoly", 0.165, 0.8],
        ["reykjanes-numel", 0.28, 0.79],
        ["reykjanes-magmar", 0.38, 0.58],
        ["reykjanes-rhyhorn", 0.45, 0.74],
        ["reykjanes-torkoal", 0.56, 0.78],
        ["reykjanes-litwick", 0.62, 0.61],
        ["reykjanes-onix", 0.705, 0.51],
        ["reykjanes-houndour", 0.93, 0.74],
      ],
    },
  ],
  [
    "namib",
    {
      name: "Paso de las dunas",
      action: "Explorar a pie",
      coordinates: [15.292, -24.732],
      image: "/expeditions/namib-field.webp",
      accent: "#ffde9e",
      clues: [
        {
          encounterId: "namib-sandshrew",
          label: "Arena removida",
          observation: "Sandshrew emerge de una madriguera al pie de la duna.",
          x: 0.22,
          y: 0.65,
        },
        {
          encounterId: "namib-cacnea",
          label: "Una forma entre los matorrales",
          observation: "Cacnea se queda quieto entre los arbustos del paso.",
          x: 0.52,
          y: 0.55,
        },
        {
          encounterId: "namib-sandile",
          label: "Dos ojos en la arena",
          observation:
            "Sandile se entierra en la cresta de la duna y deja los ojos al descubierto.",
          x: 0.81,
          y: 0.64,
        },
      ],
      sightings: [
        ["namib-diglett", 0.08, 0.72],
        ["namib-helioptile", 0.275, 0.53],
        ["namib-silicobra", 0.34, 0.6],
        ["namib-trapinch", 0.38, 0.77],
        ["namib-maractus", 0.435, 0.61],
        ["namib-gligar", 0.63, 0.43],
        ["namib-cubone", 0.73, 0.77],
        ["namib-umbreon", 0.92, 0.57],
      ],
    },
  ],
  [
    "zermatt",
    {
      name: "Mirador del glaciar",
      action: "Explorar a pie",
      coordinates: [7.751, 45.983],
      image: "/expeditions/zermatt-field.webp",
      accent: "#c9e7fa",
      clues: [
        {
          encounterId: "zermatt-sneasel",
          label: "Un rastro sobre la roca",
          observation:
            "Sneasel se asoma desde un saliente protegido de la ladera.",
          x: 0.23,
          y: 0.61,
        },
        {
          encounterId: "zermatt-swinub",
          label: "Nieve que se levanta",
          observation:
            "Swinub aparta la nieve con el hocico para buscar alimento.",
          x: 0.51,
          y: 0.64,
        },
        {
          encounterId: "zermatt-delibird",
          label: "Un aleteo en el paso",
          observation:
            "Delibird descansa entre las rocas antes de cruzar el paso.",
          x: 0.81,
          y: 0.47,
        },
      ],
      sightings: [
        ["zermatt-bergmite", 0.085, 0.56],
        ["zermatt-snorunt", 0.28, 0.76],
        ["zermatt-cubchoo", 0.39, 0.67],
        ["zermatt-froslass", 0.46, 0.51],
        ["zermatt-snom", 0.58, 0.8],
        ["zermatt-vanillite", 0.63, 0.69],
        ["zermatt-snover", 0.73, 0.78],
        ["zermatt-glalie", 0.93, 0.58],
      ],
    },
  ],
  [
    "heron",
    {
      name: "Jardín de coral",
      action: "Explorar bajo el agua",
      coordinates: [151.919, -23.443],
      image: "/expeditions/heron-field.webp",
      accent: "#baf0e4",
      clues: [
        {
          encounterId: "heron-squirtle",
          label: "Burbujas entre las rocas",
          observation: "Squirtle sale de un refugio entre roca y coral.",
          x: 0.23,
          y: 0.64,
        },
        {
          encounterId: "heron-corsola",
          label: "El coral cambia de lugar",
          observation: "Corsola se mueve entre las ramas del arrecife.",
          x: 0.51,
          y: 0.54,
        },
        {
          encounterId: "heron-horsea",
          label: "Una sombra entre las algas",
          observation:
            "Horsea se oculta entre las algas que balancea la corriente.",
          x: 0.79,
          y: 0.6,
        },
      ],
      sightings: [
        ["heron-clamperl", 0.08, 0.77],
        ["heron-magikarp", 0.285, 0.44],
        ["heron-psyduck", 0.39, 0.74],
        ["heron-finneon", 0.45, 0.43],
        ["heron-staryu", 0.63, 0.78],
        ["heron-chinchou", 0.71, 0.53],
        ["heron-lumineon", 0.86, 0.43],
        ["heron-jellicent", 0.92, 0.49],
      ],
    },
  ],
  [
    "iguazu",
    {
      name: "Sendero de las cataratas",
      action: "Explorar a pie",
      coordinates: [-54.4445, -25.6881],
      image: "/expeditions/iguazu-field.webp",
      accent: "#c8efaa",
      clues: [
        {
          encounterId: "iguazu-aipom",
          label: "Una cola sobre el tronco",
          observation: "Aipom trepa por un tronco cubierto de musgo.",
          x: 0.23,
          y: 0.6,
        },
        {
          encounterId: "iguazu-lotad",
          label: "Una hoja que flota",
          observation: "Lotad sale del remanso entre las gotas del salto.",
          x: 0.53,
          y: 0.55,
        },
        {
          encounterId: "iguazu-tropius",
          label: "Hojas que se inclinan",
          observation: "Tropius asoma la cabeza entre la vegetación.",
          x: 0.8,
          y: 0.58,
        },
      ],
      sightings: [
        ["iguazu-morelull", 0.09, 0.78],
        ["iguazu-yanma", 0.28, 0.45],
        ["iguazu-noibat", 0.355, 0.32],
        ["iguazu-surskit", 0.41, 0.63],
        ["iguazu-vivillon", 0.47, 0.35],
        ["iguazu-politoed", 0.57, 0.76],
        ["iguazu-leavanny", 0.63, 0.7],
        ["iguazu-lurantis", 0.72, 0.46],
        ["iguazu-crobat", 0.805, 0.31],
        ["iguazu-venonat", 0.93, 0.76],
      ],
    },
  ],
  [
    "everglades",
    {
      name: "Canal de los cipreses",
      action: "Explorar a pie",
      coordinates: [-80.6092, 25.3801],
      image: "/expeditions/everglades-field.webp",
      accent: "#d8eca7",
      clues: [
        {
          encounterId: "everglades-totodile",
          label: "Juncos que se abren",
          observation: "Totodile asoma el hocico entre los juncos.",
          x: 0.23,
          y: 0.6,
        },
        {
          encounterId: "everglades-croagunk",
          label: "Un croar entre las raíces",
          observation: "Croagunk se agacha junto a un ciprés inundado.",
          x: 0.53,
          y: 0.55,
        },
        {
          encounterId: "everglades-ducklett",
          label: "Ondas junto a la orilla",
          observation: "Ducklett cruza el canal en dirección a la orilla.",
          x: 0.8,
          y: 0.58,
        },
      ],
      sightings: [
        ["everglades-gastly", 0.09, 0.49],
        ["everglades-wooper", 0.275, 0.77],
        ["everglades-barboach", 0.39, 0.64],
        ["everglades-lombre", 0.46, 0.76],
        ["everglades-poliwag", 0.625, 0.63],
        ["everglades-palpitoad", 0.715, 0.77],
        ["everglades-quagsire", 0.93, 0.68],
      ],
    },
  ],
]);

export function getFieldSite(expeditionId: string): FieldSite | undefined {
  return FIELD_SITES.get(expeditionId);
}
