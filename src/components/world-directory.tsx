import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Binoculars,
  Clock3,
  CloudSun,
  Leaf,
  List,
  Map,
  MapPin,
} from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { getFieldSite } from "@/lib/field-sites";
import { spriteUrl, TYPE_LABELS } from "@/lib/pokemon";
import { weatherInfo } from "@/lib/weather";
import type { Encounter, WeatherSnapshot } from "@/lib/types";
import "./world-directory.css";

interface WorldDirectoryProps {
  activeId: string;
  mapUnavailable: boolean;
  onFocusDestination: (id: string) => void;
  onChoose: (id: string) => void;
  onLand: (id: string) => void;
  weather?: WeatherSnapshot;
  weatherPending?: boolean;
  localTime?: string;
  onPreviewEncounter: (encounter: Encounter) => void;
  detail?: ReactNode;
}

function PreviewSpecies({
  encounter,
  onSelect,
}: {
  encounter: Encounter;
  onSelect: (encounter: Encounter) => void;
}) {
  const [spriteFailed, setSpriteFailed] = useState(false);

  return (
    <button
      type="button"
      className="world-species-preview"
      data-world-encounter={encounter.id}
      aria-label={`Ver ficha de ${encounter.name}`}
      onClick={() => onSelect(encounter)}
    >
      <span className="world-species-sprite" aria-hidden="true">
        {spriteFailed ? (
          <span>{encounter.name.slice(0, 2)}</span>
        ) : (
          // These small Pokémon sprites retain their original pixel dimensions.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spriteUrl(encounter.pokemonId)}
            alt=""
            width={48}
            height={48}
            onError={() => setSpriteFailed(true)}
          />
        )}
      </span>
      <span className="world-species-name">
        <strong>{encounter.name}</strong>
        <span>
          {encounter.types.map((type) => TYPE_LABELS[type]).join(" / ")}
        </span>
      </span>
      <ArrowUpRight size={12} aria-hidden="true" />
    </button>
  );
}

export default function WorldDirectory({
  activeId,
  mapUnavailable,
  onFocusDestination,
  onChoose,
  onLand,
  weather,
  weatherPending = false,
  localTime,
  onPreviewEncounter,
  detail,
}: WorldDirectoryProps) {
  const expedition =
    EXPEDITIONS.find((item) => item.id === activeId) ?? EXPEDITIONS[0];
  const site = getFieldSite(expedition.id);
  const previewEncounters = expedition.encounters
    .filter((encounter) => !encounter.safariOnly)
    .slice(0, 2);
  const conditions = weather ? weatherInfo(weather) : undefined;
  const weatherLabel = weather
    ? `${Math.round(weather.temperature)} °C · ${conditions?.label}`
    : weatherPending
      ? "Consultando…"
      : "No disponible";

  if (detail) {
    return (
      <div className="world-directory world-directory-detail">{detail}</div>
    );
  }

  return (
    <section className="world-directory" aria-labelledby="world-title">
      <div className="world-directory-heading">
        <h1 id="world-title">El mundo por explorar.</h1>
        {mapUnavailable ? (
          <p role="status">
            Elegí un destino para seguir sus pistas o ver sus avistamientos.
          </p>
        ) : (
          <p>Girá el globo y elegí dónde seguir las pistas.</p>
        )}
      </div>

      <article
        key={expedition.id}
        className="world-preview"
        aria-label={expedition.name}
        style={
          { "--preview-accent": site?.accent ?? "#dce9bd" } as CSSProperties
        }
      >
        <div className="world-preview-hero">
          <Image
            src={site?.image ?? expedition.image}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 899px) calc(100vw - 24px), 340px"
          />
          <div className="world-preview-caption">
            <p>
              <MapPin size={13} aria-hidden="true" /> {expedition.country}
            </p>
            <h2>{expedition.name}</h2>
            {site && <span>{site.name}</span>}
          </div>
        </div>

        <dl className="world-preview-facts">
          <div>
            <dt>
              <Leaf size={12} aria-hidden="true" />
              Bioma
            </dt>
            <dd title={expedition.biome}>{expedition.biome}</dd>
          </div>
          <div>
            <dt>
              <CloudSun size={12} aria-hidden="true" />
              Clima
            </dt>
            <dd title={weatherLabel} aria-busy={weatherPending}>
              {weatherLabel}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={12} aria-hidden="true" />
              Hora local
            </dt>
            <dd>{localTime ?? "—"}</dd>
          </div>
        </dl>

        <div
          className="world-preview-species"
          aria-label="Avistamientos del destino"
        >
          {previewEncounters.map((encounter) => (
            <PreviewSpecies
              key={encounter.id}
              encounter={encounter}
              onSelect={onPreviewEncounter}
            />
          ))}
        </div>

        <div className="world-preview-actions">
          <button type="button" onClick={() => onChoose(expedition.id)}>
            {mapUnavailable ? (
              <List size={15} aria-hidden="true" />
            ) : (
              <Map size={15} aria-hidden="true" />
            )}
            {mapUnavailable ? "Ver avistamientos" : "Ver mapa"}
          </button>
          {site && (
            <button
              type="button"
              className="world-preview-land"
              onClick={() => onLand(expedition.id)}
            >
              <Binoculars size={15} aria-hidden="true" />
              {site.action}
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </article>

      <ul className="world-quick-destinations" aria-label="Destinos">
        {EXPEDITIONS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={`Enfocar ${item.name}, ${item.country}`}
              aria-pressed={item.id === expedition.id}
              onClick={() => onFocusDestination(item.id)}
              style={{ "--destination-accent": item.color } as CSSProperties}
            >
              {item.country}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
