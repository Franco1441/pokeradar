import { describe, expect, it } from "vitest";
import { buildExpeditionAnalysis } from "./expedition-analysis";
import { EXPEDITIONS } from "./expeditions";
import { EMPTY_PROGRESS, registerEncounter } from "./research";
import { getSafariSnapshot, SAFARI_RESPAWN_MS } from "./safari";
import { getExpeditionCatalog } from "./safari-roster";
import type { Expedition, ResearchProgress, WeatherSnapshot } from "./types";

const now = Date.parse("2026-11-11T15:00:00Z");
const rainyNight: WeatherSnapshot = {
  temperature: 20,
  windSpeed: 3,
  code: 61,
  isDay: false,
  time: "2026-11-11T12:00",
  timezone: "America/Argentina/Buenos_Aires",
};
const iguazu = EXPEDITIONS.find(({ id }) => id === "iguazu")!;

function registerCatalog(expedition: Expedition, progress: ResearchProgress = EMPTY_PROGRESS) {
  return getExpeditionCatalog(expedition).reduce(
    (catalogProgress, encounter) => registerEncounter(catalogProgress, expedition, encounter),
    progress,
  );
}

describe("expedition analysis", () => {
  it("compares the seven expedition catalogs with a fresh atlas", () => {
    const analysis = buildExpeditionAnalysis(EXPEDITIONS, EMPTY_PROGRESS, { now });

    expect(analysis.totals).toMatchObject({
      registeredSpecies: 0,
      totalSpecies: 177,
      completionPercent: 0,
      completedExpeditions: 0,
      totalExpeditions: 7,
    });
    expect(analysis.totals.activeSignals).toBeGreaterThan(0);
    expect(analysis.totals.unregisteredSignals).toBe(analysis.totals.activeSignals);
    expect(analysis.nextRefreshAt).toBe(now + SAFARI_RESPAWN_MS);
    expect(analysis.rows.find(({ id }) => id === "iguazu")).toMatchObject({
      country: "Argentina",
      registeredSpecies: 0,
      remainingSpecies: getExpeditionCatalog(iguazu).length,
    });
  });

  it("distinguishes a saved active signal from new ones and tracks catalog completion", () => {
    const weatherByExpedition = { iguazu: rainyNight };
    const scan = getSafariSnapshot(iguazu, { now, weather: rainyNight, mode: "live" });
    const progress = registerEncounter(EMPTY_PROGRESS, iguazu, scan.signals[0].encounter);
    const { rows: [row], totals } = buildExpeditionAnalysis([iguazu], progress, {
      now,
      weatherByExpedition,
    });

    expect(row).toMatchObject({
      registeredSpecies: 1,
      remainingSpecies: row.totalSpecies - 1,
      completionPercent: Math.round(100 / row.totalSpecies),
      activeSignals: scan.signals.length,
      unregisteredSignals: scan.signals.length - 1,
      missionComplete: false,
    });
    expect(row.activeTypes).toContain("water");
    expect(new Set(row.activeTypes).size).toBe(row.activeTypes.length);
    expect(totals.registeredSpecies).toBe(1);
    expect(totals.unregisteredSignals).toBe(scan.signals.length - 1);
  });

  it("uses observed daylight where weather exists and flags the local-time fallback", () => {
    const { rows: [observed] } = buildExpeditionAnalysis([iguazu], EMPTY_PROGRESS, {
      now,
      weatherByExpedition: { iguazu: rainyNight },
    });
    const { rows: [estimated] } = buildExpeditionAnalysis([iguazu], EMPTY_PROGRESS, { now });

    expect(observed).toMatchObject({
      isDay: false, localTime: "12:00", weatherSource: "live", weatherLabel: "Lluvia", temperature: 20,
    });
    expect(estimated).toMatchObject({
      isDay: true, localTime: "12:00", weatherSource: "estimated", temperature: null,
    });
  });

  it("prioritizes currently discoverable signals over remaining catalog species", () => {
    const secondary = EXPEDITIONS.find(({ id }) => id !== iguazu.id)!;
    const iguazuSignals = getSafariSnapshot(iguazu, { now, mode: "live" }).signals;
    const currentIds = new Set(iguazuSignals.map(({ encounter }) => encounter.pokemonId));
    let progress = getExpeditionCatalog(iguazu).reduce(
      (saved, encounter) => currentIds.has(encounter.pokemonId)
        ? saved
        : registerEncounter(saved, iguazu, encounter),
      EMPTY_PROGRESS,
    );
    const alternativeSignal = getSafariSnapshot(secondary, { now, mode: "live" }).signals[0];
    progress = registerEncounter(progress, secondary, alternativeSignal.encounter);
    const analysis = buildExpeditionAnalysis([secondary, iguazu], progress, { now });
    const [alternative, opportunity] = analysis.rows;

    expect(alternative.remainingSpecies).toBeGreaterThan(opportunity.remainingSpecies);
    expect(alternative.unregisteredSignals).toBeLessThan(opportunity.unregisteredSignals);
    expect(analysis.recommended?.id).toBe(iguazu.id);
  });

  it("uses the remaining catalog and then the original order when signals tie", () => {
    const initial = buildExpeditionAnalysis(EXPEDITIONS, EMPTY_PROGRESS, { now });
    const highestSignals = Math.max(...initial.rows.map(row => row.unregisteredSignals));
    const candidates = initial.rows.filter(row => row.unregisteredSignals === highestSignals);
    const mostRemaining = Math.max(...candidates.map(row => row.remainingSpecies));
    const expected = candidates.find(row => row.remainingSpecies === mostRemaining);

    expect(initial.recommended?.id).toBe(expected?.id);
  });

  it("has no recommendation after the catalog is complete or when no regions are available", () => {
    const progress = EXPEDITIONS.reduce((saved, expedition) => registerCatalog(expedition, saved), EMPTY_PROGRESS);
    const full = buildExpeditionAnalysis(EXPEDITIONS, progress, { now });
    const empty = buildExpeditionAnalysis([], EMPTY_PROGRESS, { now });

    expect(full.totals).toMatchObject({
      registeredSpecies: 177, completionPercent: 100, completedExpeditions: 7, unregisteredSignals: 0,
    });
    expect(full.recommended).toBeNull();
    expect(empty).toMatchObject({
      rows: [], recommended: null, nextRefreshAt: null, totals: { totalSpecies: 0, completionPercent: 0 },
    });
  });
});
