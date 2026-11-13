import type { Expedition } from "./types";

export interface SafariZone {
  id: string;
  name: string;
  image: string;
  coordinates: Expedition["coordinates"];
}

export const SAFARI_ZONES: Readonly<Partial<Record<string, readonly SafariZone[]>>> = {
  nikko: [
    { id: "cedros", name: "Claro de los cedros", coordinates: [139.597, 36.756], image: "/safari/nikko-cedros.webp" },
    { id: "arroyo", name: "Orilla del arroyo", coordinates: [139.611, 36.758], image: "/safari/nikko-arroyo.webp" },
    { id: "dosel", name: "Bosque alto", coordinates: [139.602, 36.767], image: "/safari/nikko-dosel.webp" },
  ],
  reykjanes: [
    { id: "basalto", name: "Campos de basalto", coordinates: [-22.707, 63.825], image: "/safari/reykjanes-basalto.webp" },
    { id: "vapor", name: "Lomas de vapor", coordinates: [-22.68, 63.825], image: "/safari/reykjanes-vapor.webp" },
    { id: "colada", name: "Colada antigua", coordinates: [-22.691, 63.813], image: "/safari/reykjanes-colada.webp" },
  ],
  namib: [
    { id: "pie", name: "Pie de la duna", coordinates: [15.28, -24.724], image: "/safari/namib-pie.webp" },
    { id: "cresta", name: "Cresta de arena", coordinates: [15.315, -24.73], image: "/safari/namib-cresta.webp" },
    { id: "cuenca", name: "Cuenca seca", coordinates: [15.28, -24.743], image: "/safari/namib-cuenca-360.webp" },
  ],
  zermatt: [
    { id: "glaciar", name: "Borde del glaciar", coordinates: [7.733, 45.988], image: "/safari/zermatt-glaciar.webp" },
    { id: "paso", name: "Paso de montaña", coordinates: [7.766, 45.988], image: "/safari/zermatt-paso.webp" },
    { id: "ladera", name: "Ladera nevada", coordinates: [7.746, 46.001], image: "/safari/zermatt-ladera.webp" },
  ],
  heron: [
    { id: "laguna", name: "Laguna costera", coordinates: [151.909, -23.444], image: "/safari/heron-laguna.webp" },
    { id: "coral", name: "Jardín de coral", coordinates: [151.926, -23.445], image: "/safari/heron-coral.webp" },
    { id: "pradera", name: "Pradera marina", coordinates: [151.915, -23.439], image: "/safari/heron-pradera.webp" },
  ],
  iguazu: [
    { id: "cataratas", name: "Mirador de las cataratas", coordinates: [-54.443, -25.687], image: "/safari/iguazu-cataratas.webp" },
    { id: "helechos", name: "Claro de los helechos", coordinates: [-54.437, -25.685], image: "/safari/iguazu-helechos.webp" },
    { id: "ribera", name: "Ribera bajo el dosel", coordinates: [-54.449, -25.683], image: "/safari/iguazu-ribera.webp" },
  ],
  everglades: [
    { id: "cipreses", name: "Canal de los cipreses", coordinates: [-80.614, 25.379], image: "/safari/everglades-cipreses.webp" },
    { id: "juncos", name: "Banco de juncos", coordinates: [-80.61, 25.387], image: "/safari/everglades-juncos.webp" },
    { id: "remanso", name: "Remanso del este", coordinates: [-80.604, 25.379], image: "/safari/everglades-remanso.webp" },
  ],
};
