import { getSafariEncounters } from "./safari-roster";
import { describe, expect, it } from "vitest";
import { EXPEDITIONS } from "./expeditions";
import { getSafariSnapshot, SAFARI_FRESH_MS, SAFARI_RESPAWN_MS } from "./safari";
import type {
  Encounter,
  Expedition,
  PokemonType,
  WeatherSnapshot,
} from "./types";

const now = Date.parse("2026-11-11T15:00:00Z");
const weather: WeatherSnapshot = {
  temperature: 20,
  windSpeed: 3,
  code: 61,
  isDay: true,
  time: "2026-11-11T12:00",
  timezone: "America/Argentina/Buenos_Aires",
};

function encounter(
  pokemonId: number,
  activity?: Encounter["activity"],
  type: PokemonType = "normal",
): Encounter {
  return {
    id: `biome-${pokemonId}`,
    pokemonId,
    name: `Pokémon ${pokemonId}`,
    types: [type],
    coordinates: [-54.43 + pokemonId / 1_000, -25.69],
    rationale: "Avistamiento simulado.",
    activity,
  };
}

const biome: Expedition = {
  id: "biome",
  name: "Reserva",
  country: "Argentina",
  biome: "Selva",
  coordinates: [-54.43, -25.69],
  timeZone: weather.timezone,
  zoom: 12,
  color: "#53794f",
  description: "Reserva de prueba.",
  image: "/reserve.webp",
  encounters: [
    encounter(1, "day"),
    encounter(2, "day"),
    encounter(3, "night"),
    encounter(4, "night", "water"),
    encounter(5),
    encounter(6),
    encounter(7),
    encounter(8),
    encounter(9),
    encounter(10, "any", "water"),
  ],
};

describe("safari radar", () => {
  it("keeps two front sightings and rotates in every eligible species", () => {
    for (const expedition of EXPEDITIONS) {
      const safari = getSafariEncounters(expedition);
      const walking = new Set(expedition.encounters.map(({ pokemonId }) => pokemonId));
      expect(safari, expedition.id).toHaveLength(12);
      expect(safari.some(({ pokemonId }) => walking.has(pokemonId)), expedition.id).toBe(false);
      for (const mode of ["day", "night"] as const) {
        const eligible = safari.filter(({ activity }) =>
          !activity || activity === "any" || activity === mode,
        );
        const seen = new Set<string>();
        const zonesWithBonus = new Set<string>();
        let snapshot = getSafariSnapshot(expedition, { mode, now, weather });

        for (let tick = 0; tick < eligible.length * 3; tick++) {
          const { zones, signals } = snapshot;
          expect(zones, expedition.id).toHaveLength(3);
          expect(new Set(signals.map(({ encounter }) => encounter.id)).size).toBe(signals.length);
          for (const { id, signals } of zones) {
            expect(signals.slice(0, 2).map(({ slot }) => slot), id).toEqual([0, 1]);
            if (signals.length > 2) zonesWithBonus.add(id);
            for (const { encounter } of signals) seen.add(encounter.id);
          }
          snapshot = getSafariSnapshot(expedition, { mode, now: snapshot.nextRefreshAt, weather });
        }

        expect(seen, `${expedition.id} ${mode}`).toEqual(new Set(eligible.map(({ id }) => id)));
        expect(zonesWithBonus.size, `${expedition.id} ${mode}`).toBe(3);
      }
    }
  });

  it("updates at 30-second boundaries while ongoing sightings stay in place", () => {
    const expedition = EXPEDITIONS.find(({ id }) => id === "iguazu")!;
    const options = { mode: "day" as const, weather };
    const seenCounts = new Set<number>();
    const bonusSlots = new Set<number>();
    let snapshot = getSafariSnapshot(expedition, { ...options, now });

    for (let event = 0; event < 12; event++) {
      const changeAt = snapshot.nextRefreshAt;
      expect(changeAt).toBe(now + (event + 1) * SAFARI_RESPAWN_MS);
      const beforeBoundary = getSafariSnapshot(expedition, { ...options, now: changeAt - 1 });
      expect(beforeBoundary.signals).toEqual(snapshot.signals);
      const next = getSafariSnapshot(expedition, { ...options, now: changeAt });
      let arrivals = 0;
      let departures = 0;
      for (const [index, zone] of snapshot.zones.entries()) {
        const nextZone = next.zones[index];
        const departed = zone.signals.filter(({ encounter }) =>
          !nextZone.signals.some((signal) => signal.encounter.id === encounter.id),
        );
        const arrived = nextZone.signals.filter(({ encounter }) =>
          !zone.signals.some((signal) => signal.encounter.id === encounter.id),
        );
        expect(nextZone.nextRefreshAt).toBe(changeAt + SAFARI_RESPAWN_MS);
        expect(arrived.length).toBeLessThanOrEqual(1);
        expect(departed.length).toBeLessThanOrEqual(1);
        expect(arrived.length + departed.length).toBeGreaterThan(0);
        expect(departed.every(({ expiresAt }) => expiresAt === changeAt)).toBe(true);
        expect(arrived.every(({ appearedAt }) => appearedAt === changeAt)).toBe(true);
        arrivals += arrived.length;
        departures += departed.length;
        seenCounts.add(nextZone.signals.length);
        for (const before of zone.signals) {
          const after = nextZone.signals.find(({ encounter }) => encounter.id === before.encounter.id);
          if (after) expect(after).toEqual(before);
        }
      }
      expect(arrivals).toBe(2);
      expect(departures).toBe(2);
      const freshIds = next.zones.flatMap(({ newSignalIds }) => newSignalIds);
      expect(freshIds).toHaveLength(arrivals);
      const later = getSafariSnapshot(expedition, { ...options, now: changeAt + SAFARI_FRESH_MS });
      expect(later.zones.flatMap(({ newSignalIds }) => newSignalIds)).toEqual([]);
      for (const { slot } of next.signals) {
        if (slot > 1) bonusSlots.add(slot);
      }
      snapshot = next;
    }

    expect(seenCounts).toEqual(new Set([2, 3]));
    expect(bonusSlots).toEqual(new Set([2, 3]));
  });

  it("marks weather-favored sightings without changing an active visit", () => {
    const expedition = EXPEDITIONS.find(({ id }) => id === "iguazu")!;
    const options = { mode: "day" as const };
    const dry = getSafariSnapshot(expedition, { ...options, now });
    const rainy = getSafariSnapshot(expedition, { ...options, now: now + 5000, weather });
    const positions = (snapshot: typeof dry) => snapshot.signals
      .map(({ encounter, slot, appearedAt, expiresAt }) => ({ encounter, slot, appearedAt, expiresAt }));
    expect(positions(rainy)).toEqual(positions(dry));
    expect(dry.signals.every(({ boosted }) => !boosted)).toBe(true);
    expect(rainy.signals.some(({ boosted }) => boosted)).toBe(true);
  });

  it("prefers observed daylight over the approximate local schedule", () => {
    const snapshot = getSafariSnapshot(biome, {
      mode: "live",
      now,
      weather: { ...weather, isDay: false },
    });
    expect(snapshot).toMatchObject({
      isDay: false,
      source: "live",
      timeLabel: "12:00",
      weatherLabel: "Lluvia",
    });
    expect(
      snapshot.signals.map(({ encounter }) => encounter.pokemonId),
    ).toEqual(expect.arrayContaining([3, 4]));
    expect(
      snapshot.signals.every(({ encounter }) => encounter.activity !== "day"),
    ).toBe(true);
  });

  it("estimates activity from the destination time zone when weather is unavailable", () => {
    const daytime = getSafariSnapshot(biome, { mode: "live", now });
    const night = getSafariSnapshot(
      { ...biome, timeZone: "Asia/Tokyo" },
      { mode: "live", now },
    );
    expect(daytime).toMatchObject({
      isDay: true,
      source: "estimated",
      timeLabel: "12:00",
    });
    expect(night).toMatchObject({
      isDay: false,
      source: "estimated",
      timeLabel: "00:00",
    });
    expect(daytime.signals.every(({ boosted }) => !boosted)).toBe(true);
  });

  it("switches the active species in preview without replacing the observed weather", () => {
    const day = getSafariSnapshot(biome, { mode: "day", now, weather });
    const night = getSafariSnapshot(biome, { mode: "night", now, weather });
    expect(day).toMatchObject({
      source: "preview",
      isDay: true,
      weatherLabel: "Lluvia",
    });
    expect(night).toMatchObject({
      source: "preview",
      isDay: false,
      weatherLabel: "Lluvia",
    });
    expect(
      day.signals
        .map(({ encounter }) => encounter.pokemonId)
        .slice(0, 2)
        .sort(),
    ).toEqual([1, 2]);
    expect(
      night.signals
        .map(({ encounter }) => encounter.pokemonId)
        .slice(0, 2)
        .sort(),
    ).toEqual([3, 4]);
  });

  it("gives a slot to eligible weather-favored species", () => {
    const snapshot = getSafariSnapshot(biome, { mode: "live", now, weather });
    expect(snapshot.signals).toHaveLength(4);
    expect(snapshot.signals.find(({ boosted }) => boosted)).toMatchObject({
      encounter: { pokemonId: 10 },
      reason: expect.stringContaining("clima favorable"),
    });
    expect(
      snapshot.signals.every(({ encounter }) => encounter.activity !== "night"),
    ).toBe(true);
  });

  it("keeps ungrouped sightings stable until the next 30-second boundary", () => {
    const first = getSafariSnapshot(biome, { mode: "day", now });
    const sameSlot = getSafariSnapshot(biome, {
      mode: "day",
      now: now + SAFARI_RESPAWN_MS - 1,
    });
    const nextSlot = getSafariSnapshot(biome, {
      mode: "day",
      now: now + SAFARI_RESPAWN_MS,
    });
    expect(first.nextRefreshAt).toBe(now + SAFARI_RESPAWN_MS);
    expect(sameSlot.signals).toEqual(first.signals);
    expect(
      nextSlot.signals.map(({ encounter }) => encounter.id).sort(),
    ).not.toEqual(first.signals.map(({ encounter }) => encounter.id).sort());
    for (const { encounter } of first.signals) {
      expect(encounter).toBe(
        biome.encounters.find(({ id }) => id === encounter.id),
      );
    }
  });

  it("returns an empty scan when the habitat has no active species", () => {
    const empty = { ...biome, encounters: [encounter(1, "night", "water")] };
    const snapshot = getSafariSnapshot(empty, { mode: "day", now, weather });
    expect(snapshot.signals).toEqual([]);
  });
});
