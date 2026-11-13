import { expeditionProgress } from "./research";
import { getExpeditionCatalog } from "./safari-roster";
import type {
  Encounter,
  Expedition,
  ResearchProgress,
  ResearchRecord,
} from "./types";

export interface ExpeditionPostcardData {
  expedition: Expedition;
  completedAt: string;
  localDate: string;
  encounters: Encounter[];
  completingEncounter: Encounter;
  registeredCount: number;
  typeCount: number;
}

/** Reconstruct the original completion moment without adding persisted state. */
export function buildExpeditionPostcard(
  expedition: Expedition,
  progress: ResearchProgress,
): ExpeditionPostcardData | null {
  const encountersById = new Map(
    getExpeditionCatalog(expedition).map((encounter) => [encounter.id, encounter]),
  );
  const chronologicalRecords = progress.records
    .filter((record) => {
      const encounter = encountersById.get(record.encounterId);
      return (
        record.expeditionId === expedition.id &&
        encounter?.pokemonId === record.pokemonId &&
        Number.isFinite(Date.parse(record.registeredAt))
      );
    })
    .sort(
      (first, second) =>
        Date.parse(first.registeredAt) - Date.parse(second.registeredAt),
    );
  const records: ResearchRecord[] = [];
  const encounters: Encounter[] = [];
  const registeredIds = new Set<number>();

  for (const record of chronologicalRecords) {
    if (registeredIds.has(record.pokemonId)) continue;
    const encounter = encountersById.get(record.encounterId)!;
    registeredIds.add(record.pokemonId);
    records.push(record);
    encounters.push(encounter);

    const result = expeditionProgress(expedition, { ...progress, records });
    if (result.complete) {
      return {
        expedition,
        completedAt: record.registeredAt,
        localDate: new Intl.DateTimeFormat("es-AR", {
          timeZone: expedition.timeZone,
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(record.registeredAt)),
        encounters,
        completingEncounter: encounter,
        registeredCount: result.registered,
        typeCount: result.typeCount,
      };
    }
  }

  return null;
}
