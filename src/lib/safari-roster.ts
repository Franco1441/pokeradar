import { SAFARI_ZONES } from "./safari-zones";
import type { Encounter, Expedition, PokemonType } from "./types";

type SafariSpecies = readonly [pokemonId: number, name: string, types: readonly PokemonType[]];

// Each group has three residents and a visitor whose activity varies by zone.
const ROSTERS: Readonly<Partial<Record<string, readonly SafariSpecies[]>>> = {
  "nikko:cedros": [
    [152, "Chikorita", ["grass"]],
    [273, "Seedot", ["grass"]],
    [540, "Sewaddle", ["bug", "grass"]],
    [165, "Ledyba", ["bug", "flying"]],
  ],
  "nikko:arroyo": [
    [298, "Azurill", ["normal", "fairy"]],
    [535, "Tympole", ["water"]],
    [418, "Buizel", ["water"]],
    [314, "Illumise", ["bug"]],
  ],
  "nikko:dosel": [
    [263, "Zigzagoon", ["normal"]],
    [204, "Pineco", ["bug"]],
    [216, "Teddiursa", ["normal"]],
    [198, "Murkrow", ["dark", "flying"]],
  ],
  "reykjanes:basalto": [
    [524, "Roggenrola", ["rock"]],
    [304, "Aron", ["steel", "rock"]],
    [932, "Nacli", ["rock"]],
    [302, "Sableye", ["dark", "ghost"]],
  ],
  "reykjanes:vapor": [
    [58, "Growlithe", ["fire"]],
    [850, "Sizzlipede", ["fire", "bug"]],
    [631, "Heatmor", ["fire"]],
    [77, "Ponyta", ["fire"]],
  ],
  "reykjanes:colada": [
    [246, "Larvitar", ["rock", "ground"]],
    [112, "Rhydon", ["ground", "rock"]],
    [529, "Drilbur", ["ground"]],
    [757, "Salandit", ["poison", "fire"]],
  ],
  "namib:pie": [
    [844, "Sandaconda", ["ground"]],
    [449, "Hippopotas", ["ground"]],
    [213, "Shuckle", ["bug", "rock"]],
    [559, "Scraggy", ["dark", "fighting"]],
  ],
  "namib:cresta": [
    [329, "Vibrava", ["ground", "dragon"]],
    [632, "Durant", ["bug", "steel"]],
    [332, "Cacturne", ["grass", "dark"]],
    [343, "Baltoy", ["ground", "psychic"]],
  ],
  "namib:cuenca": [
    [554, "Darumaka", ["fire"]],
    [451, "Skorupi", ["poison", "bug"]],
    [769, "Sandygast", ["ghost", "ground"]],
    [355, "Duskull", ["ghost"]],
  ],
  "zermatt:glaciar": [
    [615, "Cryogonal", ["ice"]],
    [713, "Avalugg", ["ice"]],
    [975, "Cetitan", ["ice"]],
    [614, "Beartic", ["ice"]],
  ],
  "zermatt:paso": [
    [749, "Mudbray", ["ground"]],
    [672, "Skiddo", ["grass"]],
    [744, "Rockruff", ["rock"]],
    [903, "Sneasler", ["fighting", "poison"]],
  ],
  "zermatt:ladera": [
    [698, "Amaura", ["rock", "ice"]],
    [583, "Vanillish", ["ice"]],
    [471, "Glaceon", ["ice"]],
    [461, "Weavile", ["dark", "ice"]],
  ],
  "heron:laguna": [
    [370, "Luvdisc", ["water"]],
    [278, "Wingull", ["water", "flying"]],
    [320, "Wailmer", ["water"]],
    [771, "Pyukumuku", ["water"]],
  ],
  "heron:coral": [
    [747, "Mareanie", ["poison", "water"]],
    [779, "Bruxish", ["water", "psychic"]],
    [690, "Skrelp", ["poison", "water"]],
    [211, "Qwilfish", ["water", "poison"]],
  ],
  "heron:pradera": [
    [692, "Clauncher", ["water"]],
    [550, "Basculin", ["water"]],
    [594, "Alomomola", ["water"]],
    [171, "Lanturn", ["water", "electric"]],
  ],
  "iguazu:cataratas": [
    [581, "Swanna", ["water", "flying"]],
    [656, "Froakie", ["water"]],
    [419, "Floatzel", ["water"]],
    [284, "Masquerain", ["bug", "flying"]],
  ],
  "iguazu:helechos": [
    [664, "Scatterbug", ["bug"]],
    [265, "Wurmple", ["bug"]],
    [906, "Sprigatito", ["grass"]],
    [590, "Foongus", ["grass", "poison"]],
  ],
  "iguazu:ribera": [
    [340, "Whiscash", ["water", "ground"]],
    [944, "Shroodle", ["poison", "normal"]],
    [401, "Kricketot", ["bug"]],
    [167, "Spinarak", ["bug", "poison"]],
  ],
  "everglades:cipreses": [
    [272, "Ludicolo", ["water", "grass"]],
    [341, "Corphish", ["water"]],
    [469, "Yanmega", ["bug", "flying"]],
    [168, "Ariados", ["bug", "poison"]],
  ],
  "everglades:juncos": [
    [187, "Hoppip", ["grass", "flying"]],
    [188, "Skiploom", ["grass", "flying"]],
    [940, "Wattrel", ["electric", "flying"]],
    [595, "Joltik", ["bug", "electric"]],
  ],
  "everglades:remanso": [
    [422, "Shellos", ["water"]],
    [79, "Slowpoke", ["water", "psychic"]],
    [980, "Clodsire", ["poison", "ground"]],
    [434, "Stunky", ["poison", "dark"]],
  ],
};

const POSITIONS = [[-0.00019, 0.00012], [0.00016, 0.00017], [0.00009, -0.00019], [-0.00015, -0.00012]] as const;

export function getSafariEncounters(expedition: Expedition): Encounter[] {
  return (SAFARI_ZONES[expedition.id] ?? []).flatMap((zone, zoneIndex) =>
    (ROSTERS[`${expedition.id}:${zone.id}`] ?? []).map(([pokemonId, name, types], index) => {
      const [longitude, latitude] = zone.coordinates;
      const [offsetLongitude, offsetLatitude] = POSITIONS[index];
      return {
        id: `${expedition.id}-safari-${pokemonId}`,
        pokemonId,
        name,
        types: [...types],
        coordinates: [longitude + offsetLongitude, latitude + offsetLatitude],
        rationale: `${name} forma parte de los avistamientos rotativos de ${zone.name.toLowerCase()}.`,
        activity: index === 3 ? (zoneIndex % 2 === 0 ? "night" : "day") : "any",
        safariOnly: true,
      };
    }),
  );
}

export function getExpeditionCatalog(expedition: Expedition): Encounter[] {
  return [...expedition.encounters, ...getSafariEncounters(expedition)];
}
