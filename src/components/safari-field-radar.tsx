import { ArrowUpRight, LocateFixed, Radar } from "lucide-react";
import type { CSSProperties } from "react";
import type { SafariZoneSnapshot } from "@/lib/safari";
import type { Expedition } from "@/lib/types";

interface SafariFieldRadarProps {
  expedition: Expedition;
  zones: SafariZoneSnapshot[];
  activeZone: number;
  registeredIds: number[];
  onTravel: (index: number) => void;
  onOpenRadar?: () => void;
}

export default function SafariFieldRadar({
  expedition,
  zones,
  activeZone,
  registeredIds,
  onTravel,
  onOpenRadar,
}: SafariFieldRadarProps) {
  const [longitude, latitude] = expedition.coordinates;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const positions = zones.map(({ coordinates: [lng, lat] }) => ({
    x: (lng - longitude) * longitudeScale,
    y: latitude - lat,
  }));
  const radius = Math.max(0.001, ...positions.map(({ x, y }) => Math.hypot(x, y)));
  const unread = zones.map(({ signals }) => signals.filter(
    ({ encounter }) => !registeredIds.includes(encounter.pokemonId),
  ));
  const remote = unread.flatMap((signals, index) =>
    index === activeZone ? [] : signals.map(({ encounter }) => encounter.name),
  );
  const freshRemote = zones.flatMap((zone, index) => {
    if (index === activeZone) return [];
    return unread[index].filter(({ encounter }) => zone.newSignalIds.includes(encounter.id))
      .map(({ encounter }) => ({ name: encounter.name, zone: zone.name }));
  });
  const [latest] = freshRemote;

  return (
    <aside className="safari-field-radar" aria-label="Radar de campo">
      <header className="safari-field-radar-header">
        <h3><Radar size={17} aria-hidden="true" /> Radar de campo</h3>
        {onOpenRadar && (
          <button type="button" onClick={onOpenRadar} aria-label="Ver radar en el mapa" title="Ver radar en el mapa">
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="safari-field-radar-content">
        <div className="safari-field-radar-scope" aria-hidden="true">
          <span className="safari-field-radar-north">N</span>
          <span className="safari-field-radar-sweep" />
          {zones.map((zone, index) => (
            <div
              key={zone.id}
              className="safari-field-radar-node"
              data-current={index === activeZone}
              style={{
                "--node-x": `${50 + positions[index].x / radius * 29}%`,
                "--node-y": `${50 + positions[index].y / radius * 29}%`,
              } as CSSProperties}
            >
              <span className="safari-field-radar-node-label">{index + 1}</span>
              <div className="safari-field-radar-blips">
                {zone.signals.map(({ encounter }) => (
                  <i
                    key={encounter.id}
                    className="safari-field-radar-blip"
                    data-unregistered={!registeredIds.includes(encounter.pokemonId)}
                    data-fresh={zone.newSignalIds.includes(encounter.id)}
                    title={encounter.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="safari-field-radar-zones" role="group" aria-label="Zonas del Safari">
          {zones.map((zone, index) => {
            const current = index === activeZone;
            const unregistered = unread[index];
            const fresh = unregistered.some(({ encounter }) => zone.newSignalIds.includes(encounter.id));
            return (
              <button
                key={zone.id}
                type="button"
                data-current={current}
                aria-pressed={current}
                aria-label={`${zone.name}, ${zone.signals.length} ${zone.signals.length === 1 ? "señal" : "señales"}, ${unregistered.length} sin registrar`}
                title={zone.signals.map(({ encounter }) => encounter.name).join(", ") || "Sin señales"}
                onClick={() => onTravel(index)}
              >
                <span className="safari-field-radar-index" aria-hidden="true">
                  {current ? <LocateFixed size={13} /> : index + 1}
                </span>
                <span>{zone.name}</span>
                <span
                  className="safari-field-radar-count"
                  data-unregistered={unregistered.length > 0}
                  data-fresh={!current && fresh}
                >
                  {unregistered.length || zone.signals.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="safari-field-radar-summary">
        <span className="safari-field-radar-key" aria-hidden="true" />
        <span>{remote.length > 0 ? `${remote.length} sin registrar en otras zonas` : "Dorado · sin registrar"}</span>
      </p>
      <p className="sr-only" role="status">
        {latest
          ? freshRemote.map(({ name, zone }) => `${name}, nueva señal en ${zone}.`).join(" ")
          : remote.length > 0 && `Sin registrar en otras zonas: ${remote.sort().join(", ")}.`}
      </p>
    </aside>
  );
}
