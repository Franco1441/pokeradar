import { describe, expect, it } from "vitest";
import { EXPEDITIONS } from "./expeditions";
import { buildExpeditionPostcard } from "./expedition-postcard";
import type { Expedition, ResearchProgress, ResearchRecord } from "./types";

const nikko = EXPEDITIONS.find((expedition) => expedition.id === "nikko")!;
const heron = EXPEDITIONS.find((expedition) => expedition.id === "heron")!;

function record(
  expedition: Expedition,
  index: number,
  registeredAt: string,
): ResearchRecord {
  const encounter = expedition.encounters[index];
  return {
    expeditionId: expedition.id,
    encounterId: encounter.id,
    pokemonId: encounter.pokemonId,
    registeredAt,
  };
}

function progress(records: ResearchRecord[]): ResearchProgress {
  return { version: 1, records, team: [] };
}

describe("expedition postcards", () => {
  it("returns no postcard until both existing objectives are met", () => {
    const records = [0, 1, 2].map((index) =>
      record(heron, index, `2026-11-12T10:0${index}:00.000Z`),
    );
    expect(buildExpeditionPostcard(heron, progress(records))).toBeNull();
    expect(buildExpeditionPostcard(nikko, progress([]))).toBeNull();
  });

  it("uses the first chronological prefix that completed the expedition", () => {
    const records = [0, 1, 2].map((index) =>
      record(heron, index, `2026-11-12T10:0${index}:00.000Z`),
    );
    const completingRecord = record(heron, 5, "2026-11-12T10:03:00.000Z");
    const laterRecord = record(heron, 3, "2026-11-13T10:03:00.000Z");
    const postcard = buildExpeditionPostcard(
      heron,
      progress([laterRecord, completingRecord, ...records.reverse()]),
    );

    expect(postcard).toMatchObject({
      completedAt: completingRecord.registeredAt,
      completingEncounter: heron.encounters[5],
      registeredCount: 4,
      typeCount: 2,
    });
    expect(
      postcard?.encounters.map((encounter) => encounter.pokemonId),
    ).toEqual([7, 54, 116, 222]);
  });

  it("formats completion using the expedition's timezone across a date boundary", () => {
    const records = [0, 1, 2].map((index) =>
      record(nikko, index, `2026-11-11T23:0${index}:00.000Z`),
    );
    expect(buildExpeditionPostcard(nikko, progress(records))?.localDate).toBe(
      "12 de noviembre de 2026",
    );
  });

  it("retains the original postcard when further species are registered", () => {
    const records = [0, 1, 2].map((index) =>
      record(nikko, index, `2026-11-12T10:0${index}:00.000Z`),
    );
    const before = buildExpeditionPostcard(nikko, progress(records));
    const after = buildExpeditionPostcard(
      nikko,
      progress([...records, record(nikko, 3, "2026-11-13T10:00:00.000Z")]),
    );
    expect(after).toEqual(before);
  });

  it("ignores other regions, duplicates and inconsistent records while preserving input order", () => {
    const first = record(nikko, 0, "2026-11-12T10:00:00.000Z");
    const records = [
      record(nikko, 2, "2026-11-12T10:02:00.000Z"),
      first,
      first,
      record(heron, 5, "2026-11-12T09:00:00.000Z"),
      { ...record(nikko, 1, "2026-11-12T09:00:00.000Z"), pokemonId: 222 },
      record(nikko, 3, "invalid"),
      record(nikko, 1, "2026-11-12T10:01:00.000Z"),
    ];
    const initial = structuredClone(records);
    const postcard = buildExpeditionPostcard(nikko, progress(records));
    expect(
      postcard?.encounters.map((encounter) => encounter.pokemonId),
    ).toEqual([1, 25, 10]);
    expect(postcard?.registeredCount).toBe(3);
    expect(records).toEqual(initial);
  });
});
