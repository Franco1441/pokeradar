import { describe, expect, it } from 'vitest';
import { EXPEDITIONS } from './expeditions';
import { EMPTY_PROGRESS, expeditionProgress, parseProgress, registerEncounter, toggleTeam } from './research';
import type { ResearchProgress } from './types';

const nikko = EXPEDITIONS[0];

function registeredCatalog(): ResearchProgress {
  return EXPEDITIONS.reduce((progress, expedition) =>
    expedition.encounters.reduce((state, encounter) => registerEncounter(state, expedition, encounter), progress),
  EMPTY_PROGRESS);
}

describe('research progress', () => {
  it('registers a species once and leaves the previous state intact', () => {
    const once = registerEncounter(EMPTY_PROGRESS, nikko, nikko.encounters[0]);
    const twice = registerEncounter(once, nikko, nikko.encounters[0]);
    expect(EMPTY_PROGRESS.records).toHaveLength(0);
    expect(once.records).toHaveLength(1);
    expect(twice).toBe(once);
    expect(once.records[0].registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects encounters attributed to a different expedition', () => {
    expect(registerEncounter(EMPTY_PROGRESS, EXPEDITIONS[1], nikko.encounters[0])).toBe(EMPTY_PROGRESS);
  });

  it('allows only registered species in the team and caps the team at six', () => {
    expect(toggleTeam(EMPTY_PROGRESS, 25)).toBe(EMPTY_PROGRESS);
    const registered = registeredCatalog();
    const allRequested = registered.records.reduce((state, record) => toggleTeam(state, record.pokemonId), registered);
    expect(allRequested.team).toHaveLength(6);
    const removed = toggleTeam(allRequested, allRequested.team[0]);
    expect(removed.team).toHaveLength(5);
    expect(allRequested.team).toHaveLength(6);
    expect(toggleTeam(removed, 4).team).toHaveLength(6);
  });

  it('requires three registered species and two distinct types for a completed expedition', () => {
    const heron = EXPEDITIONS.find(expedition => expedition.id === 'heron')!;
    const onlyWater = heron.encounters.slice(0, 3).reduce((state, encounter) => registerEncounter(state, heron, encounter), EMPTY_PROGRESS);
    expect(expeditionProgress(heron, onlyWater)).toEqual({ registered: 3, typeCount: 1, complete: false });
    const withCorsola = registerEncounter(onlyWater, heron, heron.encounters[5]);
    expect(expeditionProgress(heron, withCorsola)).toEqual({ registered: 4, typeCount: 2, complete: true });
    expect(expeditionProgress(nikko, withCorsola).registered).toBe(0);
  });
});

describe('stored progress recovery', () => {
  it.each([null, '{invalid', 'null', '[]', '{"version":2}', '{"version":1,"records":null}'])('recovers a safe empty state from %s', raw => {
    expect(parseProgress(raw)).toEqual(EMPTY_PROGRESS);
  });

  it('keeps valid records while removing duplicates, unknown species, and mismatched coordinates metadata', () => {
    const valid = registeredCatalog();
    const first = valid.records[0];
    const raw = JSON.stringify({
      version: 1,
      records: [first, first, { ...first, pokemonId: 999999 }, { ...first, expeditionId: 'heron' },
        { ...valid.records[1], registeredAt: 'yesterday' }, ...valid.records.slice(2)],
      team: [1, 1, 999999, 25, ...valid.records.map(record => record.pokemonId)],
    });
    const recovered = parseProgress(raw);
    expect(recovered.records).toEqual([first, ...valid.records.slice(2)]);
    expect(recovered.team).toHaveLength(6);
    expect(new Set(recovered.team).size).toBe(6);
    expect(recovered.team).not.toContain(999999);
    expect(recovered.team).not.toContain(25);
  });

  it('round trips a complete valid record and team', () => {
    const progress = toggleTeam(registerEncounter(EMPTY_PROGRESS, nikko, nikko.encounters[0]), 1);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
});
