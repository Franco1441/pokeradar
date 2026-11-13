import type { Encounter, Expedition, WeatherSnapshot } from "./types";
import { SAFARI_ZONES, type SafariZone } from "./safari-zones";
import { weatherInfo } from "./weather";

export type SafariMode = "live" | "day" | "night";
export const SAFARI_INTERVAL_MS = 60_000;
const MAX_SIGNALS = 4;

export interface SafariSignal {
  encounter: Encounter;
  reason: string;
  boosted: boolean;
}

export interface SafariZoneSnapshot extends SafariZone {
  signals: SafariSignal[];
  newSignalIds: string[];
}

export interface SafariSnapshot {
  isDay: boolean;
  source: "live" | "preview" | "estimated";
  timeLabel: string;
  weatherLabel: string;
  signals: SafariSignal[];
  zones: SafariZoneSnapshot[];
  nextRefreshAt: number;
}

interface SafariOptions {
  weather?: WeatherSnapshot;
  mode: SafariMode;
  now: number;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return items;
  const index = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(index), ...items.slice(0, index)];
}

function nearestZone(encounter: Encounter, zones: readonly SafariZone[], scale: number) {
  const [longitude, latitude] = encounter.coordinates;
  const distance = (zone: SafariZone) =>
    ((zone.coordinates[0] - longitude) * scale) ** 2 +
    (zone.coordinates[1] - latitude) ** 2;
  return zones.reduce((nearest, zone) => distance(zone) < distance(nearest) ? zone : nearest);
}

export function getSafariSnapshot(
  expedition: Expedition,
  { weather, mode, now }: SafariOptions,
): SafariSnapshot {
  const clock = new Intl.DateTimeFormat("es-AR", {
    timeZone: expedition.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const localHour = Number(
    clock.formatToParts(now).find(({ type }) => type === "hour")?.value,
  );
  const estimatedDay = localHour >= 6 && localHour < 18;
  const isDay =
    mode === "live" ? (weather?.isDay ?? estimatedDay) : mode === "day";
  const period = isDay ? "day" : "night";
  const conditions = weather ? weatherInfo(weather) : undefined;
  const favors = (encounter: Encounter) =>
    encounter.types.some((type) => conditions?.types.includes(type));
  const slot = Math.floor(now / SAFARI_INTERVAL_MS);
  // A stable offset lets each destination rotate its own catalog without changing encounter IDs.
  const destinationOffset = [...expedition.id].reduce(
    (offset, character) => (31 * offset + character.charCodeAt(0)) >>> 0,
    0,
  );
  const offset = slot + destinationOffset;
  const eligible = expedition.encounters.filter(
    ({ activity }) => !activity || activity === "any" || activity === period,
  );

  function detectUngrouped() {
    const featured = rotate(
      eligible.filter(({ activity }) => activity === period),
      offset,
    ).slice(0, 2);
    const remaining = rotate(
      eligible.filter((encounter) => !featured.includes(encounter)),
      offset,
    );
    const weatherSignal = featured.some(favors) ? undefined : remaining.find(favors);
    const selected = [
      ...featured,
      ...(weatherSignal ? [weatherSignal] : []),
      ...remaining.filter((encounter) => encounter !== weatherSignal),
    ].slice(0, MAX_SIGNALS);

    return selected.map(toSignal);
  }

  function toSignal(encounter: Encounter): SafariSignal {
    const boosted = favors(encounter);
    const activity = encounter.activity === "day"
      ? "Actividad diurna"
      : encounter.activity === "night"
        ? "Actividad nocturna"
        : "Presencia en el bioma";
    return { encounter, boosted, reason: boosted ? `${activity} · clima favorable` : activity };
  }

  function detectInZone(encounters: Encounter[], rotation: number) {
    if (encounters.length < 2) return encounters.map(toSignal);
    const matchingWeather = encounters.filter(favors);
    const matchingPhase = encounters.filter(({ activity }) => activity === period);
    const matchingBoth = matchingWeather.filter(({ activity }) => activity === period);
    const priority = [matchingBoth, matchingWeather, matchingPhase].find(({ length }) => length > 0);
    const [lead] = rotate(priority ?? encounters, rotation);
    // The other slot rotates freely, including when a single species suits the conditions.
    const [second] = rotate(encounters.filter((encounter) => encounter !== lead), rotation);
    return [lead, second].map(toSignal);
  }

  const definitions = SAFARI_ZONES[expedition.id];
  const longitudeScale = Math.cos((expedition.coordinates[1] * Math.PI) / 180);
  const zones = definitions
    ? definitions.map((zone, index) => {
        const encounters = eligible.filter((encounter) =>
          nearestZone(encounter, definitions, longitudeScale) === zone,
        );
        const signals = detectInZone(encounters, offset + index);
        const previous = detectInZone(encounters, offset + index - 1);
        return {
          ...zone,
          signals,
          newSignalIds: signals.filter(({ encounter }) =>
            !previous.some((signal) => signal.encounter.id === encounter.id),
          ).map(({ encounter }) => encounter.id),
        };
      })
    : [{
        id: expedition.id,
        name: expedition.biome,
        coordinates: expedition.coordinates,
        signals: detectUngrouped(),
        newSignalIds: [],
      }];

  return {
    isDay,
    source: mode !== "live" ? "preview" : weather ? "live" : "estimated",
    timeLabel: clock.format(now),
    weatherLabel: conditions?.label ?? "Clima no disponible",
    nextRefreshAt: (slot + 1) * SAFARI_INTERVAL_MS,
    signals: zones.flatMap((zone) => zone.signals),
    zones,
  };
}
