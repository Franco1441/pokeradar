import type { Encounter, Expedition, WeatherSnapshot } from "./types";
import { SAFARI_ZONES, type SafariZone } from "./safari-zones";
import { weatherInfo } from "./weather";

export type SafariMode = "live" | "day" | "night";
export const SAFARI_INTERVAL_MS = 60_000;
export const SAFARI_CLOCK_MS = 1000;
export const SAFARI_RESPAWN_MS = 30_000;
export const SAFARI_FRESH_MS = 8000;
const MAX_SIGNALS = 4;
const VISIT_STEPS = 3;

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
  tick: number,
  offset: number,
) {
  if (encounters.length <= 2) {
    return {
      signals: encounters.map((encounter, slot) => ({ encounter, slot, appearedAt: 0, expiresAt: null })),
      nextRefreshAt: null,
    };
  }

  const zoneTick = tick + offset;
  const visit = Math.floor(zoneTick / VISIT_STEPS);
  const phase = zoneTick - visit * VISIT_STEPS;
  const startedAt = (tick - phase) * SAFARI_RESPAWN_MS;
  const visitDuration = VISIT_STEPS * SAFARI_RESPAWN_MS;
  const endsAt = startedAt + visitDuration;
  const current = ((visit % encounters.length) + encounters.length) % encounters.length;
  const prior = (current + encounters.length - 1) % encounters.length;
  // Alternate the front slot by visit, so the other creature stays in place.
  const currentSlot = Math.abs(visit % 2);
  const signals = [
    {
      encounter: encounters[prior],
      slot: 1 - currentSlot,
      appearedAt: startedAt - visitDuration,
      expiresAt: endsAt,
    },
    {
      encounter: encounters[current],
      slot: currentSlot,
      appearedAt: startedAt,
      expiresAt: endsAt + visitDuration,
    },
  ];
  // Swap one front sighting, then allow a visitor for one tick before it leaves.
  if (phase === 1) {
    const bonusIndex = (current + (encounters.length === 3 ? 1 : 2)) % encounters.length;
    signals.push({
      encounter: encounters[bonusIndex],
      slot: 2 + currentSlot,
      appearedAt: startedAt + SAFARI_RESPAWN_MS,
      expiresAt: startedAt + 2 * SAFARI_RESPAWN_MS,
    });
  }

  return {
    signals: signals.sort((first, second) => first.slot - second.slot),
    nextRefreshAt: (tick + 1) * SAFARI_RESPAWN_MS,
  };
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
  const tick = Math.floor(now / SAFARI_RESPAWN_MS);
  const nextRespawnAt = (tick + 1) * SAFARI_RESPAWN_MS;
  // A stable offset lets each destination rotate its own catalog without changing encounter IDs.
  const destinationOffset = safariSeed(expedition.id);
  const offset = tick + destinationOffset;
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
        // Every zone updates on the same tick, but each takes a different phase.
        const { signals, nextRefreshAt } = getZoneSightings(
          rotate(encounters, seed),
          tick,
          index,
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
        image: expedition.image,
        signals: detectUngrouped(),
        newSignalIds: [],
        nextRefreshAt: nextRespawnAt,
      }];

  return {
    isDay,
    source: mode !== "live" ? "preview" : weather ? "live" : "estimated",
    timeLabel: clock.format(now),
    weatherLabel: conditions?.label ?? "Clima no disponible",
    nextRefreshAt: nextRespawnAt,
    signals: zones.flatMap((zone) => zone.signals),
    zones,
  };
}
