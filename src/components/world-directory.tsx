import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowUpRight, Compass } from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";
import { getFieldSite } from "@/lib/field-sites";

export default function WorldDirectory({
  onChoose,
}: {
  onChoose: (id: string) => void;
}) {
  return (
    <section className="world-directory" aria-labelledby="world-title">
      <div className="world-intro">
        <p className="world-kicker">
          <Compass size={16} aria-hidden="true" />
          {EXPEDITIONS.length} expediciones
        </p>
        <h1 id="world-title">El mundo por explorar.</h1>
        <p>Girá el globo o elegí un destino para seguir sus pistas.</p>
      </div>

      <ul className="world-destinations">
        {EXPEDITIONS.map((expedition) => {
          const site = getFieldSite(expedition.id);
          return (
            <li key={expedition.id}>
              <button
                type="button"
                onClick={() => onChoose(expedition.id)}
                style={
                  { "--destination-accent": expedition.color } as CSSProperties
                }
              >
                <span className="world-destination-photo" aria-hidden="true">
                  <Image
                    src={site?.image ?? expedition.image}
                    alt=""
                    fill
                    sizes="92px"
                  />
                </span>
                <span className="world-destination-text">
                  <span className="world-destination-country">
                    {expedition.country}
                  </span>
                  <strong>{expedition.name}</strong>
                  <small>{site?.name ?? expedition.biome}</small>
                </span>
                <span className="world-destination-action" aria-hidden="true">
                  <ArrowUpRight size={16} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
