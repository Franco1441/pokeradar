import { EXPEDITIONS } from './expeditions';
import { getExpeditionCatalog } from './safari-roster';
import type { Encounter, Expedition, ResearchProgress, ResearchRecord } from './types';

export const EMPTY_PROGRESS: ResearchProgress = { version: 1, records: [], team: [] };
const catalog = new Map(EXPEDITIONS.flatMap(expedition =>
  getExpeditionCatalog(expedition).map(encounter => [encounter.id, { expedition, encounter }] as const),
));

function validRecord(value: unknown): value is ResearchRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const known = typeof record.encounterId === 'string' ? catalog.get(record.encounterId) : undefined;
  return Boolean(known && known.expedition.id === record.expeditionId &&
    known.encounter.pokemonId === record.pokemonId && typeof record.registeredAt === 'string' &&
    Number.isFinite(Date.parse(record.registeredAt)));
}

export function parseProgress(raw: string | null): ResearchProgress {
  const empty: ResearchProgress = { ...EMPTY_PROGRESS, records: [], team: [] };
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1) return empty;
    const candidate = value as Record<string, unknown>;
    const seen = new Set<number>();
    const records: ResearchRecord[] = [];
    for (const record of Array.isArray(candidate.records) ? candidate.records : []) {
      if (validRecord(record) && !seen.has(record.pokemonId)) {
        records.push({
          encounterId: record.encounterId, pokemonId: record.pokemonId,
          expeditionId: record.expeditionId, registeredAt: record.registeredAt,
        });
        seen.add(record.pokemonId);
      }
    }
    const team = Array.isArray(candidate.team)
      ? [...new Set(candidate.team.filter((id: unknown): id is number => typeof id === 'number' && seen.has(id)))].slice(0, 6)
      : [];
    return { version: 1, records, team };
  } catch {
    return empty;
  }
}

export function registerEncounter(progress: ResearchProgress, expedition: Expedition, encounter: Encounter): ResearchProgress {
  const known = catalog.get(encounter.id);
  if (!known || known.expedition.id !== expedition.id || known.encounter.pokemonId !== encounter.pokemonId ||
      progress.records.some(record => record.pokemonId === encounter.pokemonId)) return progress;
  return {
    ...progress,
    records: [...progress.records, {
      encounterId: encounter.id, pokemonId: encounter.pokemonId,
      expeditionId: expedition.id, registeredAt: new Date().toISOString(),
    }],
  };
}

export function toggleTeam(progress: ResearchProgress, pokemonId: number): ResearchProgress {
  if (progress.team.includes(pokemonId)) {
    return { ...progress, team: progress.team.filter(id => id !== pokemonId) };
  }
  if (progress.team.length >= 6 || !progress.records.some(record => record.pokemonId === pokemonId)) return progress;
  return { ...progress, team: [...progress.team, pokemonId] };
}

export function expeditionProgress(expedition: Expedition, progress: ResearchProgress): { registered: number; typeCount: number; complete: boolean } {
  const registeredIds = new Set(progress.records.filter(record => record.expeditionId === expedition.id).map(record => record.pokemonId));
  const encounters = getExpeditionCatalog(expedition).filter(encounter => registeredIds.has(encounter.pokemonId));
  const typeCount = new Set(encounters.flatMap(encounter => encounter.types)).size;
  return { registered: encounters.length, typeCount, complete: encounters.length >= 3 && typeCount >= 2 };
}
