import type { Encounter, Expedition, WeatherSnapshot } from "./types";
import { SAFARI_ZONES, type SafariZone } from "./safari-zones";
import { getSafariEncounters } from "./safari-roster";
import { weatherInfo } from "./weather";

export type SafariMode = "live" | "day" | "night";
export const SAFARI_INTERVAL_MS = 60_000;
export const SAFARI_CLOCK_MS = 1000;
export const SAFARI_RESPAWN_MS = 30_000;
export const SAFARI_FRESH_MS = 8000;
export const SAFARI_ENTRY_HEADING = -0.16;
const MAX_SIGNALS = 4;
const VISIT_STEPS = 3;

export interface SafariSignal {
  encounter: Encounter;
  reason: string;
  boosted: boolean;
  slot: number;
  bearing: number;
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

function spawnSpread(zoneId: string, encounterId: string, appearedAt: number) {
  // Mix the time and the encounter into a stable fraction. Recalculating the
  // snapshot during a visit must not move a Pokémon or its radar blip.
  const seed = safariSeed(`${zoneId}:${encounterId}:${appearedAt}`);
  const mixed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 0x1_0000_0000;
}

function regularBearing(zoneId: string, encounter: Encounter, slot: number, appearedAt: number) {
  const spread = spawnSpread(zoneId, encounter.id, appearedAt);
  // Keep one encounter in the entry frame. The other spans the sides and rear.
  return SAFARI_ENTRY_HEADING + (slot === 0
    ? (spread - 0.5) * 0.44
    : 1.05 + spread * (Math.PI * 2 - 2.1));
}

type ZoneSighting = Pick<SafariSignal, "encounter" | "slot" | "bearing" | "appearedAt" | "expiresAt">;

function getZoneSightings(
  encounters: Encounter[],
  tick: number,
  offset: number,
  zoneId: string,
) {
  if (encounters.length <= 2) {
    return {
      signals: encounters.map((encounter, slot) => ({
        encounter, slot, bearing: regularBearing(zoneId, encounter, slot, 0),
        appearedAt: 0, expiresAt: null,
      })),
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
  // Alternate the two regular slots so the ongoing sighting stays in place.
  const currentSlot = Math.abs(visit % 2);
  const signals: ZoneSighting[] = [
    {
      encounter: encounters[prior],
      slot: 1 - currentSlot,
      bearing: regularBearing(zoneId, encounters[prior], 1 - currentSlot, startedAt - visitDuration),
      appearedAt: startedAt - visitDuration,
      expiresAt: endsAt,
    },
    {
      encounter: encounters[current],
      slot: currentSlot,
      bearing: regularBearing(zoneId, encounters[current], currentSlot, startedAt),
      appearedAt: startedAt,
      expiresAt: endsAt + visitDuration,
    },
  ];
  // A brief visitor appears on the opposite side from the roaming sighting.
  if (phase === 1) {
    const bonusIndex = (current + (encounters.length === 3 ? 1 : 2)) % encounters.length;
    const visitor = encounters[bonusIndex];
    const appearedAt = startedAt + SAFARI_RESPAWN_MS;
    const roaming = signals[currentSlot === 1 ? 1 : 0];
    const otherSide = Math.sin(roaming.bearing - SAFARI_ENTRY_HEADING) >= 0 ? -1 : 1;
    const spread = spawnSpread(zoneId, visitor.id, appearedAt);
    signals.push({
      encounter: visitor,
      slot: 2 + currentSlot,
      bearing: SAFARI_ENTRY_HEADING + otherSide * (0.78 + spread * 1.26),
      appearedAt,
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
  const exclusive = getSafariEncounters(expedition);
  const eligible = (exclusive.length ? exclusive : expedition.encounters).filter(
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

    return selected.map((encounter, slot) => toSignal({
      encounter,
      slot,
      bearing: regularBearing(expedition.id, encounter, slot, 0),
      appearedAt: 0,
      expiresAt: null,
    }));
  }

  function toSignal(sighting: ZoneSighting): SafariSignal {
    const { encounter } = sighting;
    const boosted = favors(encounter);
    const activity = encounter.activity === "day"
      ? "Actividad diurna"
      : encounter.activity === "night"
        ? "Actividad nocturna"
        : "Presencia en el bioma";
    return {
      ...sighting,
      boosted,
      reason: boosted ? `${activity} · clima favorable` : activity,
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
          `${expedition.id}:${zone.id}`,
        );
        return {
          ...zone,
          nextRefreshAt,
          signals: signals.map(toSignal),
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
