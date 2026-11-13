import { Radar } from "lucide-react";
import "./map-loading.css";

export default function MapLoading({ world, active = true }: {
  world: boolean;
  active?: boolean;
}) {
  return (
    <div className="map-loading" data-world={world} data-active={active}>
      <div className="map-loading-content" role="status" aria-hidden={!active}>
        <span className="map-loading-scan" aria-hidden="true">
          <Radar size={27} strokeWidth={1.4} />
        </span>
        {world ? "Cargando el globo…" : "Cargando el mapa…"}
      </div>
    </div>
  );
}
