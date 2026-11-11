import type { Expedition, PokemonType, WeatherSnapshot } from './types';

export interface WeatherInfo {
  label: string;
  types: PokemonType[];
}

export function weatherInfo(snapshot: WeatherSnapshot): WeatherInfo {
  const code = snapshot.code;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Nieve', types: ['ice', 'steel'] };
  if ([45, 48].includes(code)) return { label: 'Niebla', types: ['dark', 'ghost'] };
  if ([95, 96, 99].includes(code)) return { label: 'Tormenta', types: ['water', 'electric', 'bug'] };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: 'Lluvia', types: ['water', 'electric', 'bug'] };
  }
  if (code === 3) return { label: 'Cielo cubierto', types: ['fairy', 'fighting', 'poison'] };
  if (code === 2) return { label: 'Parcialmente nublado', types: ['normal', 'rock'] };
  if (code === 0 || code === 1) {
    return { label: snapshot.isDay ? 'Cielo despejado' : 'Noche despejada', types: ['grass', 'fire', 'ground'] };
  }
  return { label: 'Condición no disponible', types: [] };
}

export async function fetchWeather(expedition: Expedition, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const [longitude, latitude] = expedition.coordinates;
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day', timezone: 'auto',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error('El clima no está disponible. Podés seguir explorando.');
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('current' in data) || !('timezone' in data)) {
    throw new Error('La información meteorológica llegó incompleta.');
  }
  const current = data.current;
  if (typeof current !== 'object' || current === null ||
      !('temperature_2m' in current) || typeof current.temperature_2m !== 'number' || !Number.isFinite(current.temperature_2m) ||
      !('wind_speed_10m' in current) || typeof current.wind_speed_10m !== 'number' || !Number.isFinite(current.wind_speed_10m) ||
      !('weather_code' in current) || typeof current.weather_code !== 'number' ||
      !('is_day' in current) || (current.is_day !== 0 && current.is_day !== 1) ||
      !('time' in current) || typeof current.time !== 'string' || typeof data.timezone !== 'string') {
    throw new Error('La información meteorológica llegó incompleta.');
  }
  return {
    temperature: current.temperature_2m, windSpeed: current.wind_speed_10m,
    code: current.weather_code, isDay: current.is_day === 1,
    time: current.time, timezone: data.timezone,
  };
}
