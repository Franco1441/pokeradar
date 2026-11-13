import type { Encounter, Expedition, WeatherSnapshot } from "./types";
import { SAFARI_ZONES, type SafariZone } from "./safari-zones";
import { weatherInfo } from "./weather";

export type SafariMode = "live" | "day" | "night";
export const SAFARI_INTERVAL_MS = 60_000;
export const SAFARI_CLOCK_MS = 1000;
export const SAFARI_FRESH_MS = 8000;
const MAX_SIGNALS = 4;
const SIGHTING_INTERVAL_MS = 21_000;
const BONUS_MARGIN_MS = 6000;
const FAVORABLE_WEATHER_MARGIN_MS = 3000;

export interface SafariSignal {
  encounter: Encounter;
  reason: string;
  boosted: boolean;
  slot: number;
  appearedAt: number;
  expiresAt: number | null;
}

export interface SafariZoneSnapshot extends SafariZone {
  signals: SafariSignal[];
  newSignalIds: string[];
  nextRefreshAt: number | null;
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

function safariSeed(value: string) {
  return [...value].reduce(
    (seed, character) => (31 * seed + character.charCodeAt(0)) >>> 0,
    0,
  );
}

function getZoneSightings(
  encounters: Encounter[],
  now: number,
  offset: number,
  visitInterval: (encounter: Encounter) => number,
  favors: (encounter: Encounter) => boolean,
) {
  if (encounters.length <= 2) {
    return {
      signals: encounters.map((encounter, slot) => ({ encounter, slot, appearedAt: 0, expiresAt: null })),
      nextRefreshAt: null,
    };
  }

  // An even cycle preserves the same slot during both intervals of a visit.
  const cycle = encounters.length % 2 === 0 ? encounters : [...encounters, ...encounters];
  const durations = cycle.map(visitInterval);
  const cycleDuration = durations.reduce((total, duration) => total + duration, 0);
  const cycleStart = Math.floor((now - offset) / cycleDuration) * cycleDuration + offset;
  let current = 0;
  let startedAt = cycleStart;
  while (now >= startedAt + durations[current]) {
    startedAt += durations[current];
    current++;
  }

  const prior = (current + cycle.length - 1) % cycle.length;
  const upcoming = (current + 1) % cycle.length;
  const endsAt = startedAt + durations[current];
  const signals = [
    {
      encounter: cycle[prior],
      slot: prior % 2,
      appearedAt: startedAt - durations[prior],
      expiresAt: endsAt,
    },
    {
      encounter: cycle[current],
      slot: current % 2,
      appearedAt: startedAt,
      expiresAt: endsAt + durations[upcoming],
    },
  ];
  // Keep the extra sighting clear of both front slots and allow a grace period
  // before a creature can return in a different part of the terrain.
  const bonusIndex = (current + (encounters.length === 3 ? 1 : 2)) % cycle.length;
  const bonus = cycle[bonusIndex];
  const bonusStartsAt = startedAt + BONUS_MARGIN_MS;
  const bonusEndsAt = endsAt - (favors(bonus) ? FAVORABLE_WEATHER_MARGIN_MS : BONUS_MARGIN_MS);
  let nextRefreshAt = endsAt;
  if (now < bonusStartsAt) {
    nextRefreshAt = bonusStartsAt;
  } else if (now < bonusEndsAt) {
    signals.push({
      encounter: bonus,
      slot: 2 + (current % 2),
      appearedAt: bonusStartsAt,
      expiresAt: bonusEndsAt,
    });
    nextRefreshAt = bonusEndsAt;
  }

  return { signals: signals.sort((first, second) => first.slot - second.slot), nextRefreshAt };
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
  const destinationOffset = safariSeed(expedition.id);
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

    return selected.map((encounter, slot) => toSignal(encounter, slot, 0, null));
  }

  function toSignal(
    encounter: Encounter,
    slot: number,
    appearedAt: number,
    expiresAt: number | null,
  ): SafariSignal {
    const boosted = favors(encounter);
    const activity = encounter.activity === "day"
      ? "Actividad diurna"
      : encounter.activity === "night"
        ? "Actividad nocturna"
        : "Presencia en el bioma";
    return {
      encounter,
      boosted,
      reason: boosted ? `${activity} · clima favorable` : activity,
      slot,
      appearedAt,
      expiresAt,
    };
  }

  const definitions = SAFARI_ZONES[expedition.id];
  const longitudeScale = Math.cos((expedition.coordinates[1] * Math.PI) / 180);
  const zones = definitions
    ? definitions.map((zone, index) => {
        const encounters = eligible.filter((encounter) =>
          nearestZone(encounter, definitions, longitudeScale) === zone,
        );
        const seed = safariSeed(`${expedition.id}-${zone.id}`);
        // The zone index staggers changes so one part of the radar updates at a time.
        const phaseOffset = (index + 3 * (seed % 11)) * SAFARI_CLOCK_MS;
        const { signals, nextRefreshAt } = getZoneSightings(
          rotate(encounters, seed),
          now,
          phaseOffset,
          (encounter) => SIGHTING_INTERVAL_MS + (encounter.activity === period ? 3000 : 0),
          favors,
        );
        return {
          ...zone,
          nextRefreshAt,
          signals: signals.map(({ encounter, slot, appearedAt, expiresAt }) =>
            toSignal(encounter, slot, appearedAt, expiresAt),
          ),
          newSignalIds: signals.filter(({ expiresAt, appearedAt }) =>
            expiresAt !== null && now - appearedAt < SAFARI_FRESH_MS,
          ).map(({ encounter }) => encounter.id),
        };
      })
    : [{
        id: expedition.id,
        name: expedition.biome,
        coordinates: expedition.coordinates,
        signals: detectUngrouped(),
        newSignalIds: [],
        nextRefreshAt: (slot + 1) * SAFARI_INTERVAL_MS,
      }];

  const nextZoneRefresh = Math.min(...zones.flatMap(({ nextRefreshAt }) =>
    nextRefreshAt === null ? [] : [nextRefreshAt],
  ));

  return {
    isDay,
    source: mode !== "live" ? "preview" : weather ? "live" : "estimated",
    timeLabel: clock.format(now),
    weatherLabel: conditions?.label ?? "Clima no disponible",
    nextRefreshAt: Number.isFinite(nextZoneRefresh)
      ? nextZoneRefresh
      : (slot + 1) * SAFARI_INTERVAL_MS,
    signals: zones.flatMap((zone) => zone.signals),
    zones,
  };
}
