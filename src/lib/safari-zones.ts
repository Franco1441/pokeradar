import type { Expedition } from "./types";

export interface SafariZone {
  id: string;
  name: string;
  coordinates: Expedition["coordinates"];
}

export const SAFARI_ZONES: Readonly<Partial<Record<string, readonly SafariZone[]>>> = {
  nikko: [
    { id: "cedros", name: "Claro de los cedros", coordinates: [139.597, 36.756] },
    { id: "arroyo", name: "Orilla del arroyo", coordinates: [139.611, 36.758] },
    { id: "dosel", name: "Bosque alto", coordinates: [139.602, 36.767] },
  ],
  reykjanes: [
    { id: "basalto", name: "Campos de basalto", coordinates: [-22.707, 63.825] },
    { id: "vapor", name: "Lomas de vapor", coordinates: [-22.68, 63.825] },
    { id: "colada", name: "Colada antigua", coordinates: [-22.691, 63.813] },
  ],
  namib: [
    { id: "pie", name: "Pie de la duna", coordinates: [15.28, -24.724] },
    { id: "cresta", name: "Cresta de arena", coordinates: [15.315, -24.73] },
    { id: "cuenca", name: "Cuenca seca", coordinates: [15.28, -24.743] },
  ],
  zermatt: [
    { id: "glaciar", name: "Borde del glaciar", coordinates: [7.733, 45.988] },
    { id: "paso", name: "Paso de montaña", coordinates: [7.766, 45.988] },
    { id: "ladera", name: "Ladera nevada", coordinates: [7.746, 46.001] },
  ],
  heron: [
    { id: "laguna", name: "Laguna costera", coordinates: [151.909, -23.444] },
    { id: "coral", name: "Jardín de coral", coordinates: [151.926, -23.445] },
    { id: "pradera", name: "Pradera marina", coordinates: [151.915, -23.439] },
  ],
  iguazu: [
    { id: "cataratas", name: "Mirador de las cataratas", coordinates: [-54.443, -25.687] },
    { id: "helechos", name: "Claro de los helechos", coordinates: [-54.437, -25.685] },
    { id: "ribera", name: "Ribera bajo el dosel", coordinates: [-54.449, -25.683] },
  ],
  everglades: [
    { id: "cipreses", name: "Canal de los cipreses", coordinates: [-80.614, 25.379] },
    { id: "juncos", name: "Banco de juncos", coordinates: [-80.61, 25.387] },
    { id: "remanso", name: "Remanso del este", coordinates: [-80.604, 25.379] },
  ],
};
