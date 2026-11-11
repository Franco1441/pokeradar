import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDescription, fetchPokemon } from './pokemon';

const pokemon = {
  id: 25, name: 'pikachu', height: 4, weight: 60,
  types: [{ type: { name: 'electric' } }],
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map(name => ({ stat: { name }, base_stat: 50 })),
  sprites: { front_default: null, other: { 'official-artwork': { front_default: 'https://example.com/pikachu.png' } } },
  cries: { latest: null },
};
afterEach(() => vi.unstubAllGlobals());

describe('PokéAPI details', () => {
  it('converts decimeters and hectograms and accepts optional missing media', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(pokemon)));
    const result = await fetchPokemon(25);
    expect(result).toMatchObject({ name: 'Pikachu', height: 0.4, weight: 6, types: ['electric'], sprite: null, cry: null });
    expect(result.stats).toHaveLength(6);
  });

  it('rejects mismatched and malformed Pokémon payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...pokemon, id: 1 })));
    await expect(fetchPokemon(25)).rejects.toThrow('incompletos');
  });

  it('propagates cancellation so a stale selection can be abandoned', async () => {
    const controller = new AbortController();
    const request = vi.fn().mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', request);
    const response = fetchPokemon(25, controller.signal);
    controller.abort();
    await expect(response).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('loads Spanish text independently and removes embedded line breaks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ flavor_text_entries: [
      { language: { name: 'en' }, flavor_text: 'English text' },
      { language: { name: 'es' }, flavor_text: 'Vive en\nlos bosques.\fEs curioso.' },
    ] })));
    expect(await fetchDescription(25)).toBe('Vive en los bosques. Es curioso.');
  });
});
