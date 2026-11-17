import { expeditionProgress } from "./research";
import { getSafariSnapshot } from "./safari";
import { getExpeditionCatalog } from "./safari-roster";
import type { Expedition, PokemonType, ResearchProgress, WeatherSnapshot } from "./types";

export interface ExpeditionAnalysisRow {
  id: string;
  name: string;
  country: string;
  biome: string;
  color: string;
  registeredSpecies: number;
  totalSpecies: number;
  remainingSpecies: number;
  completionPercent: number;
  activeTypes: PokemonType[];
  missionComplete: boolean;
  activeSignals: number;
  unregisteredSignals: number;
  isDay: boolean;
  localTime: string;
  weatherLabel: string;
  weatherSource: "live" | "estimated";
  temperature: number | null;
}

export interface ExpeditionAnalysis {
  rows: ExpeditionAnalysisRow[];
  totals: {
    registeredSpecies: number;
    totalSpecies: number;
    completionPercent: number;
    activeSignals: number;
    unregisteredSignals: number;
    completedExpeditions: number;
    totalExpeditions: number;
  };
  recommended: ExpeditionAnalysisRow | null;
  nextRefreshAt: number | null;
}

interface AnalysisOptions {
  now: number;
  weatherByExpedition?: Readonly<Record<string, WeatherSnapshot | undefined>>;
}

function percentage(registered: number, total: number) {
  return total > 0 ? Math.round((registered / total) * 100) : 0;
}

function hasMoreToDiscover(candidate: ExpeditionAnalysisRow, current: ExpeditionAnalysisRow) {
  if (candidate.unregisteredSignals !== current.unregisteredSignals) {
    return candidate.unregisteredSignals > current.unregisteredSignals;
  }
  return candidate.remainingSpecies > current.remainingSpecies;
}

export function buildExpeditionAnalysis(
  expeditions: readonly Expedition[],
  progress: ResearchProgress,
  { now, weatherByExpedition }: AnalysisOptions,
): ExpeditionAnalysis {
  const recordedIds = new Set(progress.records.map(({ pokemonId }) => pokemonId));
  let nextRefreshAt: number | null = null;
  const rows = expeditions.map<ExpeditionAnalysisRow>((expedition) => {
    const { id, name, country, biome, color } = expedition;
    const weather = weatherByExpedition?.[id];
    const safari = getSafariSnapshot(expedition, { now, mode: "live", weather });
    const { registered, complete } = expeditionProgress(expedition, progress);
    const totalSpecies = getExpeditionCatalog(expedition).length;
    nextRefreshAt = Math.min(nextRefreshAt ?? safari.nextRefreshAt, safari.nextRefreshAt);

    return {
      id, name, country, biome, color,
      registeredSpecies: registered,
      totalSpecies,
      remainingSpecies: totalSpecies - registered,
      completionPercent: percentage(registered, totalSpecies),
      activeTypes: [...new Set(safari.signals.flatMap(({ encounter }) => encounter.types))],
      missionComplete: complete,
      activeSignals: safari.signals.length,
      unregisteredSignals: safari.signals.filter(({ encounter }) => !recordedIds.has(encounter.pokemonId)).length,
      isDay: safari.isDay,
      localTime: safari.timeLabel,
      weatherLabel: safari.weatherLabel,
      weatherSource: weather ? "live" : "estimated",
      temperature: weather?.temperature ?? null,
    };
  });

  let recommended: ExpeditionAnalysisRow | null = null;
  let registeredSpecies = 0;
  let totalSpecies = 0;
  let activeSignals = 0;
  let unregisteredSignals = 0;
  let completedExpeditions = 0;
  for (const row of rows) {
    registeredSpecies += row.registeredSpecies;
    totalSpecies += row.totalSpecies;
    activeSignals += row.activeSignals;
    unregisteredSignals += row.unregisteredSignals;
    if (row.missionComplete) completedExpeditions++;
    if (row.remainingSpecies > 0 && (!recommended || hasMoreToDiscover(row, recommended))) {
      recommended = row;
    }
  }

  return {
    rows,
    totals: {
      registeredSpecies,
      totalSpecies,
      completionPercent: percentage(registeredSpecies, totalSpecies),
      activeSignals,
      unregisteredSignals,
      completedExpeditions,
      totalExpeditions: rows.length,
    },
    recommended,
    nextRefreshAt,
  };
}
