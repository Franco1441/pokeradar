export interface FieldClue {
  encounterId: string;
  label: string;
  observation: string;
  x: number;
  y: number;
}

export interface FieldSite {
  name: string;
  action: string;
  coordinates: [number, number];
  image: string;
  accent: string;
  clues: readonly FieldClue[];
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
    },
  ],
]);

export function getFieldSite(expeditionId: string): FieldSite | undefined {
  return FIELD_SITES.get(expeditionId);
}
