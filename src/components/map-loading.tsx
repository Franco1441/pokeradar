import { Radar } from "lucide-react";
import "./map-loading.css";

export default function MapLoading({ world, active = true, fullscreen = false }: {
  world: boolean;
  active?: boolean;
  fullscreen?: boolean;
}) {
  return (
    <div className="map-loading" data-world={world} data-active={active} data-fullscreen={fullscreen}>
      <div className="map-loading-content" role="status" aria-hidden={!active}>
        <span className="map-loading-scan" aria-hidden="true">
          <Radar size={27} strokeWidth={1.4} />
        </span>
        {fullscreen ? "Preparando la expedición…" : world ? "Cargando el globo…" : "Cargando el mapa…"}
      </div>
    </div>
  );
}
