import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowUpRight, Binoculars, List, Map, MapPin } from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { getFieldSite } from "@/lib/field-sites";
import "./world-directory.css";

interface WorldDirectoryProps {
  activeId: string;
  mapUnavailable: boolean;
  onFocusDestination: (id: string) => void;
  onChoose: (id: string) => void;
  onLand: (id: string) => void;
}

export default function WorldDirectory({
  activeId,
  mapUnavailable,
  onFocusDestination,
  onChoose,
  onLand,
}: WorldDirectoryProps) {
  const expedition =
    EXPEDITIONS.find((item) => item.id === activeId) ?? EXPEDITIONS[0];
  const site = getFieldSite(expedition.id);

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
