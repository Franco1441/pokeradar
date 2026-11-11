import Image from "next/image";
import { ArrowUpRight, Binoculars, MapPin } from "lucide-react";
import { EXPEDITIONS } from "@/lib/expeditions";

export default function WorldDirectory({
  onChoose,
}: {
  onChoose: (id: string) => void;
}) {
  return (
    <section className="world-directory" aria-labelledby="world-title">
      <div className="world-intro">
        <p className="world-kicker">
          <MapPin size={13} /> Destinos de expedición
        </p>
        <h1 id="world-title">El mundo por explorar.</h1>
        <p>
          Girá el globo o elegí un destino para investigar sus avistamientos.
        </p>
      </div>

      <ul className="world-destinations">
        {EXPEDITIONS.map((expedition) => (
          <li key={expedition.id}>
            <button onClick={() => onChoose(expedition.id)}>
              <span className="world-destination-photo">
                <Image src={expedition.image} alt="" fill sizes="64px" />
              </span>
              <span className="world-destination-text">
                <strong>{expedition.name}</strong>
                <span>
                  {expedition.country} · {expedition.biome}
                </span>
                {expedition.id === "nikko" && (
                  <small>
                    <Binoculars size={13} /> Exploración en primera persona
                  </small>
                )}
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
