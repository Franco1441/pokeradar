"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Leaf,
  Search,
  SlidersHorizontal,
  Sprout,
  Stamp,
} from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import type { ExpeditionPostcardData } from "@/lib/expedition-postcard";
import { TYPE_LABELS } from "@/lib/pokemon";
import { expeditionProgress } from "@/lib/research";
import { getExpeditionCatalog } from "@/lib/safari-roster";
import type {
  Encounter,
  Expedition,
  PokemonType,
  ResearchProgress,
} from "@/lib/types";

interface AtlasPanelProps {
  progress: ResearchProgress;
  catalogSize: number;
  entries: { encounter: Encounter; region: Expedition }[];
  postcards: ExpeditionPostcardData[];
  search: string;
  type: PokemonType | "";
  regionFilter: string;
  onlyRegistered: boolean;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: PokemonType | "") => void;
  onRegionChange: (id: string) => void;
  onOnlyRegisteredChange: (value: boolean) => void;
  onOpenPostcard: (expeditionId: string, opener: HTMLButtonElement) => void;
  onSelectEncounter: (encounter: Encounter, region: Expedition) => void;
  renderSprite: (id: number, name: string) => ReactNode;
}

const registrationDate = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});

const expeditionSizes = EXPEDITIONS.map((region) => ({
  region,
  total: getExpeditionCatalog(region).length,
}));

export default function AtlasPanel({
  progress,
  catalogSize,
  entries,
  postcards,
  search,
  type,
  regionFilter,
  onlyRegistered,
  onSearchChange,
  onTypeChange,
  onRegionChange,
  onOnlyRegisteredChange,
  onOpenPostcard,
  onSelectEncounter,
  renderSprite,
}: AtlasPanelProps) {
  const expeditionSummaries = expeditionSizes.map((summary) => ({
    ...summary,
    regionProgress: expeditionProgress(summary.region, progress),
  }));
  const recordsByPokemon = new Map(
    progress.records.map((record) => [record.pokemonId, record]),
  );

  return (
    <div className="panel-body atlas-panel">
      <h1>Atlas de campo</h1>
      <div className="atlas-total">
        <BookOpen size={24} />
        <strong>
          {progress.records.length}
          <small>/ {catalogSize}</small>
        </strong>
        <span>
          especies
          <br />
          registradas
        </span>
      </div>
      <div className="atlas-stamps">
        {expeditionSummaries.map(({ region, regionProgress, total }) => (
          <button
            key={region.id}
            onClick={() =>
              onRegionChange(
                regionFilter === region.id ? "all" : region.id,
              )
            }
            className={`${regionProgress.complete ? "earned" : ""} ${regionFilter === region.id ? "chosen" : ""}`}
            title={region.name}
            aria-label={`Filtrar atlas por ${region.name}. ${regionProgress.registered} de ${total} registradas`}
            aria-pressed={regionFilter === region.id}
            style={
              { "--stamp-color": region.color } as CSSProperties
            }
          >
            <Leaf size={18} />
            <span>{region.country}</span>
            <small>
              {regionProgress.registered}/{total}
            </small>
            {regionProgress.complete && <Check size={12} />}
          </button>
        ))}
      </div>
      {postcards.length > 0 && (
        <section
          className="atlas-postcards"
          aria-labelledby="atlas-postcards-title"
        >
          <h2 id="atlas-postcards-title">Postales</h2>
          {postcards.map(({ expedition: region, localDate }) => (
            <button
              key={region.id}
              type="button"
              aria-label={`Ver postal de ${region.name}`}
              onClick={(event) => {
                onOpenPostcard(region.id, event.currentTarget);
              }}
            >
              <Stamp size={17} aria-hidden="true" />
              <span>
                <strong>{region.name}</strong>
                <small>{localDate}</small>
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}
      <div className="search-field">
        <Search size={16} />
        <input
          aria-label="Buscar en el atlas"
          placeholder="Encontrar una especie…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="atlas-filters">
        <label>
          <SlidersHorizontal size={14} />
          <select
            aria-label="Tipo de Pokémon en el atlas"
            value={type}
            onChange={(event) =>
              onTypeChange(event.target.value as PokemonType | "")
            }
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyRegistered}
            onChange={(event) =>
              onOnlyRegisteredChange(event.target.checked)
            }
          />
          Registrados
        </label>
      </div>
      <div className="atlas-grid">
        {entries.map(({ encounter, region }) => {
          const record = recordsByPokemon.get(encounter.pokemonId);
          return (
            <button
              className={`atlas-entry ${record ? "registered" : ""}`}
              key={encounter.id}
              onClick={() => onSelectEncounter(encounter, region)}
            >
              <span className="atlas-number">
                #{String(encounter.pokemonId).padStart(3, "0")}
                {record && <CheckCircle2 size={12} />}
              </span>
              {renderSprite(encounter.pokemonId, encounter.name)}
              <strong>{encounter.name}</strong>
              <span>
                {record
                  ? `Registrado · ${registrationDate.format(new Date(record.registeredAt))}`
                  : region.country}
              </span>
            </button>
          );
        })}
      </div>
      {!entries.length && (
        <div className="empty-state">
          <Sprout />
          <h3>Tu próximo descubrimiento te espera</h3>
          <button
            className="text-button"
            onClick={() => {
              onOnlyRegisteredChange(false);
              onRegionChange("all");
              onTypeChange("");
              onSearchChange("");
            }}
          >
            Explorar el atlas completo
          </button>
        </div>
      )}
    </div>
  );
}
