import type { Expedition } from "./types";

export interface SafariZone {
  id: string;
  name: string;
  shortName?: string;
  image: string;
  coordinates: Expedition["coordinates"];
}

const STANDARD_PANORAMA = "-360-2560.webp";

export function getSafariPanoramaSource(source: string) {
  const { innerWidth, devicePixelRatio } = window;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  const useHd = innerWidth >= 900 && innerWidth * devicePixelRatio >= 1400 &&
    !connection?.saveData && !window.matchMedia("(prefers-reduced-data: reduce)").matches;
  return useHd && source.endsWith(STANDARD_PANORAMA)
    ? source.replace(STANDARD_PANORAMA, "-360-4096.webp")
    : source;
}

export const SAFARI_ZONES: Readonly<Partial<Record<string, readonly SafariZone[]>>> = {
  nikko: [
    { id: "cedros", name: "Claro de los cedros", shortName: "Cedros", coordinates: [139.597, 36.756], image: "/safari/nikko-cedros-360-2560.webp" },
    { id: "arroyo", name: "Orilla del arroyo", shortName: "Arroyo", coordinates: [139.611, 36.758], image: "/safari/nikko-arroyo-360-2560.webp" },
    { id: "dosel", name: "Bosque alto", shortName: "Bosque", coordinates: [139.602, 36.767], image: "/safari/nikko-dosel-360-2560.webp" },
  ],
  reykjanes: [
    { id: "basalto", name: "Campos de basalto", shortName: "Basalto", coordinates: [-22.707, 63.825], image: "/safari/reykjanes-basalto-360-2560.webp" },
    { id: "vapor", name: "Lomas de vapor", shortName: "Vapor", coordinates: [-22.68, 63.825], image: "/safari/reykjanes-vapor-360-2560.webp" },
    { id: "colada", name: "Colada antigua", shortName: "Colada", coordinates: [-22.691, 63.813], image: "/safari/reykjanes-colada-360-2560.webp" },
  ],
  namib: [
    { id: "pie", name: "Pie de la duna", shortName: "Pie", coordinates: [15.28, -24.724], image: "/safari/namib-pie-360-2560.webp" },
    { id: "cresta", name: "Cresta de arena", shortName: "Cresta", coordinates: [15.315, -24.73], image: "/safari/namib-cresta-360-2560.webp" },
    { id: "cuenca", name: "Cuenca seca", shortName: "Cuenca", coordinates: [15.28, -24.743], image: "/safari/namib-cuenca-360-2560.webp" },
  ],
  zermatt: [
    { id: "glaciar", name: "Borde del glaciar", shortName: "Glaciar", coordinates: [7.733, 45.988], image: "/safari/zermatt-glaciar-360-2560.webp" },
    { id: "paso", name: "Paso de montaña", shortName: "Paso", coordinates: [7.766, 45.988], image: "/safari/zermatt-paso-360-2560.webp" },
    { id: "ladera", name: "Ladera nevada", shortName: "Ladera", coordinates: [7.746, 46.001], image: "/safari/zermatt-ladera-360-2560.webp" },
  ],
  heron: [
    { id: "laguna", name: "Laguna costera", shortName: "Laguna", coordinates: [151.909, -23.444], image: "/safari/heron-laguna-360-2560.webp" },
    { id: "coral", name: "Jardín de coral", shortName: "Coral", coordinates: [151.926, -23.445], image: "/safari/heron-coral-360-2560.webp" },
    { id: "pradera", name: "Pradera marina", shortName: "Pradera", coordinates: [151.915, -23.439], image: "/safari/heron-pradera-360-2560.webp" },
  ],
  iguazu: [
    { id: "cataratas", name: "Mirador de las cataratas", shortName: "Cataratas", coordinates: [-54.443, -25.687], image: "/safari/iguazu-cataratas-360-2560.webp" },
    { id: "helechos", name: "Claro de los helechos", shortName: "Helechos", coordinates: [-54.437, -25.685], image: "/safari/iguazu-helechos-360-2560.webp" },
    { id: "ribera", name: "Ribera bajo el dosel", shortName: "Ribera", coordinates: [-54.449, -25.683], image: "/safari/iguazu-ribera-360-2560.webp" },
  ],
  everglades: [
    { id: "cipreses", name: "Canal de los cipreses", shortName: "Cipreses", coordinates: [-80.614, 25.379], image: "/safari/everglades-cipreses-360-2560.webp" },
    { id: "juncos", name: "Banco de juncos", shortName: "Juncos", coordinates: [-80.61, 25.387], image: "/safari/everglades-juncos-360-2560.webp" },
    { id: "remanso", name: "Remanso del este", shortName: "Remanso", coordinates: [-80.604, 25.379], image: "/safari/everglades-remanso-360-2560.webp" },
  ],
};
