import type { PokemonDetail, PokemonType } from './types';

export const TYPE_LABELS: Record<PokemonType, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada',
};

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#787763', fire: '#bc5940', water: '#3e78a8', electric: '#a37719',
  grass: '#557e42', ice: '#3e8390', fighting: '#a44b43', poison: '#935993',
  ground: '#937341', flying: '#7976aa', psychic: '#b6537d', bug: '#75852c',
  rock: '#887844', ghost: '#76618e', dragon: '#6755a8', dark: '#665a50',
  steel: '#687c85', fairy: '#b66a91',
};

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const API_BASE = 'https://pokeapi.co/api/v2';
const STAT_LABELS: Record<string, string> = {
  hp: 'PS', attack: 'Ataque', defense: 'Defensa',
  'special-attack': 'At. especial', 'special-defense': 'Def. especial', speed: 'Velocidad',
};

export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

export function artworkUrl(id: number): string {
  return `${SPRITE_BASE}/other/official-artwork/${id}.png`;
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function imageUrl(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('https://') ? value : null;
}

function isPokemonType(value: unknown): value is PokemonType {
  return typeof value === 'string' && Object.hasOwn(TYPE_LABELS, value);
}

async function request(resource: string, id: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!Number.isInteger(id) || id < 1) throw new Error('El identificador del Pokémon no es válido.');
  const response = await fetch(`${API_BASE}/${resource}/${id}/`, { signal });
  if (!response.ok) throw new Error('No pudimos consultar PokéAPI. Intentá de nuevo.');
  const json: unknown = await response.json();
  return object(json);
}

export async function fetchPokemon(id: number, signal?: AbortSignal): Promise<PokemonDetail> {
  const data = await request('pokemon', id, signal);
  const types = Array.isArray(data.types)
    ? data.types.map((entry: unknown) => object(object(entry).type).name).filter(isPokemonType)
    : [];
  if (data.id !== id || typeof data.name !== 'string' || types.length === 0 ||
      typeof data.height !== 'number' || !Number.isFinite(data.height) ||
      typeof data.weight !== 'number' || !Number.isFinite(data.weight)) {
    throw new Error('Los datos del Pokémon llegaron incompletos. Intentá de nuevo.');
  }

  const stats = new Map<string, number>();
  const entries: unknown[] = Array.isArray(data.stats) ? data.stats : [];
  for (const entry of entries) {
    const item = object(entry);
    const name = object(item.stat).name;
    const value = item.base_stat;
    if (typeof name === 'string' && Object.hasOwn(STAT_LABELS, name) &&
        typeof value === 'number' && Number.isFinite(value)) {
      stats.set(STAT_LABELS[name], value);
    }
  }
  if (stats.size !== Object.keys(STAT_LABELS).length) {
    throw new Error('Los datos del Pokémon llegaron incompletos. Intentá de nuevo.');
  }

  const sprites = object(data.sprites);
  const other = object(sprites.other);
  return {
    id,
    name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
    types,
    height: data.height / 10,
    weight: data.weight / 10,
    artwork: imageUrl(object(other['official-artwork']).front_default),
    sprite: imageUrl(sprites.front_default),
    cry: imageUrl(object(data.cries).latest),
    stats: Array.from(stats, ([name, value]) => ({ name, value })),
  };
}

export async function fetchDescription(id: number, signal?: AbortSignal): Promise<string | null> {
  const data = await request('pokemon-species', id, signal);
  if (!Array.isArray(data.flavor_text_entries)) return null;
  const entries = data.flavor_text_entries.map((entry: unknown) => object(entry));
  const entry = entries.find(item => object(item.language).name === 'es' && typeof item.flavor_text === 'string');
  return entry ? String(entry.flavor_text).replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim() : null;
}
