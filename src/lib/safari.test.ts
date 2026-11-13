import { describe, expect, it } from "vitest";
import { EXPEDITIONS } from "./expeditions";
import { getSafariSnapshot, SAFARI_INTERVAL_MS } from "./safari";
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
  it("keeps two eligible sightings in each destination zone and rotates at least one pair in each phase", () => {
    for (const expedition of EXPEDITIONS) {
      for (const mode of ["day", "night"] as const) {
        const snapshots = [0, 1, 2, 3].map((minute) => getSafariSnapshot(expedition, {
          mode,
          now: now + minute * SAFARI_INTERVAL_MS,
          weather,
        }));
        const configurations = new Set<string>();
        for (const { zones, signals } of snapshots) {
          expect(zones, expedition.id).toHaveLength(3);
          expect(new Set(signals.map(({ encounter }) => encounter.id)).size).toBe(6);
          for (const zone of zones) {
            expect(zone.signals, zone.id).toHaveLength(2);
            expect(zone.signals.every(({ encounter }) =>
              !encounter.activity || encounter.activity === "any" || encounter.activity === mode,
            )).toBe(true);
          }
          configurations.add(zones.map(({ signals }) =>
            signals.map(({ encounter }) => encounter.id).sort().join(","),
          ).join("|"));
        }
        expect(configurations.size, `${expedition.id} ${mode}`).toBeGreaterThan(1);
      }
    }
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

  it("keeps positions and identities stable until the next minute, then rotates", () => {
    const first = getSafariSnapshot(biome, { mode: "day", now });
    const sameSlot = getSafariSnapshot(biome, {
      mode: "day",
      now: now + SAFARI_INTERVAL_MS - 1,
    });
    const nextSlot = getSafariSnapshot(biome, {
      mode: "day",
      now: now + SAFARI_INTERVAL_MS,
    });
    expect(first.nextRefreshAt).toBe(now + SAFARI_INTERVAL_MS);
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
