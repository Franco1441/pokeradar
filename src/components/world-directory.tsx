import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Binoculars,
  ChevronDown,
  Clock3,
  CloudSun,
  Leaf,
  List,
  Map,
  MapPin,
  Radar,
} from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { getFieldSite } from "@/lib/field-sites";
import { TYPE_LABELS } from "@/lib/pokemon";
import { weatherInfo } from "@/lib/weather";
import type { Encounter, WeatherSnapshot } from "@/lib/types";
import PokemonSprite from "./pokemon-sprite";
import "./world-directory.css";

const coordinateFormat = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function coordinateLabel([longitude, latitude]: [number, number]) {
  const northSouth = latitude >= 0 ? "N" : "S";
  const eastWest = longitude >= 0 ? "E" : "O";
  return `${coordinateFormat.format(Math.abs(latitude))}° ${northSouth} · ${coordinateFormat.format(Math.abs(longitude))}° ${eastWest}`;
}

interface WorldDirectoryProps {
  activeId: string;
  mapUnavailable: boolean;
  onFocusDestination: (id: string) => void;
  onChoose: (id: string) => void;
  onLand: (id: string) => void;
  onSafari: (id: string) => void;
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
  return (
    <button
      type="button"
      className="world-species-preview"
      data-world-encounter={encounter.id}
      aria-label={`Ver ficha de ${encounter.name}`}
      onClick={() => onSelect(encounter)}
    >
      <span className="world-species-sprite" aria-hidden="true">
        <PokemonSprite
          id={encounter.pokemonId}
          name={encounter.name}
          width={48}
          height={48}
        />
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
  onSafari,
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

  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const destinations = useRef<HTMLUListElement>(null);
  const showingDetail = Boolean(detail);
  useEffect(() => {
    const list = destinations.current;
    const active = list?.querySelector('[aria-pressed="true"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    const listBounds = list.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    if (activeBounds.right > listBounds.right)
      list.scrollLeft += activeBounds.right - listBounds.right + 2;
    else if (activeBounds.left < listBounds.left)
      list.scrollLeft -= listBounds.left - activeBounds.left + 2;
  }, [activeId, showingDetail]);

  if (detail) {
    return (
      <div className="world-directory world-directory-detail">{detail}</div>
    );
  }

  return (
    <section className="world-directory" aria-labelledby="world-title">
      <div className="world-directory-heading">
        <h1 id="world-title">El mundo Pokémon te espera.</h1>
        {mapUnavailable ? (
          <p role="status">
            Elegí un destino para seguir sus pistas o ver sus avistamientos.
          </p>
        ) : (
          <p>
            Girá el globo o elegí un destino.
            <span className="world-marker-hint">
              {" "}Doble clic en un marcador para entrar.
            </span>
          </p>
        )}
      </div>

      <article
        key={expedition.id}
        className="world-preview"
        aria-label={expedition.name}
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
              <span className="world-preview-coordinates">
                {coordinateLabel(expedition.coordinates)}
              </span>
            </p>
            <h2>{expedition.name}</h2>
            {site && <span>{site.name}</span>}
          </div>
          <button
            className="world-preview-toggle"
            type="button"
            aria-label={detailsOpen ? "Ocultar detalles del destino" : "Ver detalles del destino"}
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            <ChevronDown size={16} aria-hidden="true" />
            <span aria-hidden="true">Detalles</span>
          </button>
        </div>

        <div className="world-preview-extra" id={detailsId} data-expanded={detailsOpen}>
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
            <>
              <button
                type="button"
                className="world-preview-land"
                onClick={() => onLand(expedition.id)}
                title="Encuentros fijos"
              >
                <Binoculars size={15} aria-hidden="true" />
                {site.action}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onSafari(expedition.id)}
                title="Avistamientos rotativos con radar"
              >
                <Radar size={15} aria-hidden="true" /> Safari
              </button>
            </>
          )}
        </div>
      </article>

      <ul
        ref={destinations}
        className="world-quick-destinations"
        aria-label="Destinos"
      >
        {EXPEDITIONS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={`Enfocar ${item.name}, ${item.country}`}
              aria-pressed={item.id === expedition.id}
              onClick={() => onFocusDestination(item.id)}
            >
              {item.country}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
