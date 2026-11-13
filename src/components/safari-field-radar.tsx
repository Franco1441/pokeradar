import { ArrowUpRight, LocateFixed, Radar } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { SafariZoneSnapshot } from "@/lib/safari";
import type { Expedition } from "@/lib/types";
import { getSafariSignalBearing } from "./safari-world";
import "./safari-field-radar.css";

interface SafariFieldRadarProps {
  expedition: Expedition;
  zones: SafariZoneSnapshot[];
  activeZone: number;
  registeredIds: number[];
  nextRefreshAt: number;
  onTravel: (index: number) => void;
  onOpenRadar?: () => void;
}

function ScanCountdown({ nextRefreshAt }: { nextRefreshAt?: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = nextRefreshAt
    ? Math.max(0, Math.ceil((nextRefreshAt - now) / 1_000))
    : 0;

  return (
    <span
      className="safari-field-radar-countdown"
      role="timer"
      aria-label={secondsLeft
        ? `Radar en vivo. Próximo cambio en ${secondsLeft} ${secondsLeft === 1 ? "segundo" : "segundos"}`
        : "Radar en vivo"}
    >
      En vivo{secondsLeft > 0 && <span aria-hidden="true">{secondsLeft} s</span>}
    </span>
  );
}

export default function SafariFieldRadar({
  expedition,
  zones,
  activeZone,
  registeredIds,
  nextRefreshAt,
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
  const registered = new Set(registeredIds);
  const radarZones = zones.map((zone, index) => {
    const current = index === activeZone;
    const unregistered = zone.signals.filter(({ encounter }) => !registered.has(encounter.pokemonId));
    const fresh = unregistered.filter(({ encounter }) => zone.newSignalIds.includes(encounter.id));
    return { zone, current, unregistered, fresh };
  });
  const remote = radarZones.flatMap(({ current, unregistered }) => current ? [] : unregistered);
  const arrivals = radarZones.flatMap(({ zone, current, fresh }) =>
    current ? [] : fresh.map(({ encounter }) => `${encounter.name}, nueva señal en ${zone.name}.`),
  );
  const hasUpcomingSignal = zones.some(({ nextRefreshAt }) => nextRefreshAt !== null);

  return (
    <aside className="safari-field-radar" aria-label="Radar de campo">
      <header className="safari-field-radar-header">
        <h3><Radar size={17} aria-hidden="true" /> Radar de campo</h3>
        <ScanCountdown nextRefreshAt={hasUpcomingSignal ? nextRefreshAt : undefined} />
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
          {radarZones.map(({ zone, current }, index) => (
            <div
              key={zone.id}
              className="safari-field-radar-node"
              data-current={current}
              style={{
                "--node-x": `${50 + positions[index].x / radius * 29}%`,
                "--node-y": `${50 + positions[index].y / radius * 29}%`,
              } as CSSProperties}
            >
              <span className="safari-field-radar-node-label">{index + 1}</span>
              {current && <span className="safari-field-radar-heading" />}
              <div className="safari-field-radar-blips" data-local={current}>
                {zone.signals.map(({ encounter, slot }) => {
                  const bearing = getSafariSignalBearing(index, slot);
                  return (
                    <span
                      key={encounter.id}
                      className="safari-field-radar-blip"
                      data-unregistered={!registered.has(encounter.pokemonId)}
                      data-fresh={zone.newSignalIds.includes(encounter.id)}
                      title={encounter.name}
                      style={{
                        "--blip-x": `${Math.sin(bearing) * 16}px`,
                        "--blip-y": `${-Math.cos(bearing) * 16}px`,
                      } as CSSProperties}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="safari-field-radar-zones" role="group" aria-label="Zonas del Safari">
          {radarZones.map(({ zone, current, unregistered, fresh }, index) => {
            const newNames = !current && fresh.map(({ encounter }) => encounter.name).join(" · ");
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
                <span className="safari-field-radar-zone-copy">
                  {zone.name}
                  {newNames && <small aria-hidden="true">{newNames}</small>}
                </span>
                <span
                  className="safari-field-radar-count"
                  data-unregistered={unregistered.length > 0}
                  data-fresh={Boolean(newNames)}
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
        {arrivals.join(" ")}
      </p>
    </aside>
  );
}
