export type PokemonType = 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface Encounter {
  id: string;
  pokemonId: number;
  name: string;
  types: PokemonType[];
  coordinates: [number, number];
  rationale: string;
}

export interface Expedition {
  id: string;
  name: string;
  country: string;
  biome: string;
  description: string;
  coordinates: [number, number];
  zoom: number;
  color: string;
  image: string;
  encounters: Encounter[];
}

export interface PokemonDetail {
  id: number;
  name: string;
  types: PokemonType[];
  height: number;
  weight: number;
  artwork: string | null;
  sprite: string | null;
  cry: string | null;
  stats: { name: string; value: number }[];
}

export interface WeatherSnapshot {
  temperature: number;
  windSpeed: number;
  code: number;
  isDay: boolean;
  time: string;
  timezone: string;
}

export interface ResearchRecord {
  encounterId: string;
  pokemonId: number;
  expeditionId: string;
  registeredAt: string;
}

export interface ResearchProgress {
  version: 1;
  records: ResearchRecord[];
  team: number[];
}
