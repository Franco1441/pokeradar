import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPEDITIONS } from './expeditions';
import { fetchWeather, weatherInfo } from './weather';
import type { WeatherSnapshot } from './types';

const current: WeatherSnapshot = { temperature: 14, windSpeed: 12, code: 0, isDay: true, time: '2026-11-11T12:00', timezone: 'Asia/Tokyo' };
afterEach(() => vi.unstubAllGlobals());

describe('weather activity simulation', () => {
  it.each([
    [0, ['grass', 'fire', 'ground']],
    [1, ['grass', 'fire', 'ground']],
    [2, ['normal', 'rock']],
    [3, ['fairy', 'fighting', 'poison']],
    [45, ['dark', 'ghost']],
    [48, ['dark', 'ghost']],
    [55, ['water', 'electric', 'bug']],
    [65, ['water', 'electric', 'bug']],
    [82, ['water', 'electric', 'bug']],
    [95, ['water', 'electric', 'bug']],
    [99, ['water', 'electric', 'bug']],
    [75, ['ice', 'steel']],
    [86, ['ice', 'steel']],
    [999, []],
  ])('maps WMO code %i to favored types', (code, types) => {
    expect(weatherInfo({ ...current, code }).types).toEqual(types);
  });

  it('labels a clear night without changing the explicit simulation rules', () => {
    expect(weatherInfo({ ...current, isDay: false }).label).toBe('Noche despejada');
  });

  it('normalizes a valid forecast with the destination timezone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      timezone: 'Asia/Tokyo', current: { temperature_2m: 14, wind_speed_10m: 12, weather_code: 0, is_day: 1, time: '2026-11-11T12:00' },
    })));
    expect(await fetchWeather(EXPEDITIONS[0])).toEqual(current);
  });

  it('rejects unavailable or incomplete conditions instead of inventing favorable weather', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ timezone: 'Asia/Tokyo', current: { temperature_2m: null } })));
    await expect(fetchWeather(EXPEDITIONS[0])).rejects.toThrow('incompleta');
  });
});
