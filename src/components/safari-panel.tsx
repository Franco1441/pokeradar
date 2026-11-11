"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CloudSun,
  MapPin,
  Moon,
  Radio,
  Radar,
  Sun,
  Timer,
} from "lucide-react";
import { spriteUrl } from "@/lib/pokemon";
import type { SafariMode, SafariSnapshot } from "@/lib/safari";
import type { Encounter, Expedition } from "@/lib/types";
import "./safari-panel.css";

interface SafariPanelProps {
  expedition: Expedition;
  snapshot: SafariSnapshot;
  mode: SafariMode;
  registeredIds: number[];
  onModeChange: (mode: SafariMode) => void;
  onSelect: (encounter: Encounter) => void;
  onChangeDestination: () => void;
}

const MODES = [
  { value: "live", label: "En vivo", Icon: Radio },
  { value: "day", label: "Día", Icon: Sun },
  { value: "night", label: "Noche", Icon: Moon },
] as const;

function RadarScreen({
  expedition,
  snapshot,
}: Pick<SafariPanelProps, "expedition" | "snapshot">) {
  const [longitude, latitude] = expedition.coordinates;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  function getOffset([
    signalLongitude,
    signalLatitude,
  ]: Encounter["coordinates"]) {
    return [
      (signalLongitude - longitude) * longitudeScale,
      latitude - signalLatitude,
    ] as const;
  }

  const radius = Math.max(
    0.001,
    ...expedition.encounters.map(({ coordinates }) =>
      Math.hypot(...getOffset(coordinates)),
    ),
  );

  return (
    <div className="safari-screen" aria-hidden="true">
      <div className="safari-sweep" />
      <span className="safari-north">N</span>
      {snapshot.signals.map(({ encounter, boosted }) => {
        const [x, y] = getOffset(encounter.coordinates);
        return (
          <span
            className="safari-blip"
            key={encounter.id}
            data-boosted={boosted}
            style={
              {
                "--blip-x": `${50 + (x / radius) * 39}%`,
                "--blip-y": `${50 + (y / radius) * 39}%`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function SignalSprite({ pokemonId }: { pokemonId: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="safari-signal-sprite" aria-hidden="true">
      {failed ? (
        <Radar size={20} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- PokéAPI sprites are tiny and preserve their pixel edges.
        <img
          src={spriteUrl(pokemonId)}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function SafariCountdown({ nextRefreshAt }: { nextRefreshAt: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
  return (
    <span className="safari-countdown">
      <Timer size={14} aria-hidden="true" />
      Barrido en {secondsLeft} s
    </span>
  );
}

export default function SafariPanel({
  expedition,
  snapshot,
  mode,
  registeredIds,
  onModeChange,
  onSelect,
  onChangeDestination,
}: SafariPanelProps) {
  const PhaseIcon = snapshot.isDay ? Sun : Moon;
  const phase = snapshot.isDay ? "Día" : "Noche";
  const periodLabel = {
    live: `${phase} local`,
    preview: `${phase} de prueba`,
    estimated: snapshot.isDay ? "Día estimado" : "Noche estimada",
  }[snapshot.source];

  return (
    <section className="safari-panel" aria-labelledby="safari-title">
      <header className="safari-header">
        <h2 id="safari-title">Safari</h2>
        <button
          className="safari-destination"
          type="button"
          onClick={onChangeDestination}
          aria-label={`Cambiar destino. Destino actual: ${expedition.name}`}
        >
          <MapPin size={15} aria-hidden="true" />
          <span>{expedition.name}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </header>

      <div
        className="safari-mode"
        role="group"
        aria-label="Condiciones del safari"
      >
        {MODES.map(({ value, label, Icon }) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="safari-console" data-night={!snapshot.isDay}>
        <RadarScreen expedition={expedition} snapshot={snapshot} />
        <div className="safari-conditions">
          <span className="safari-biome">{expedition.biome}</span>
          <span className="safari-phase">
            <PhaseIcon size={16} aria-hidden="true" />
            {periodLabel}
          </span>
          <span className="safari-local-time">
            {snapshot.timeLabel} <span>· Hora local</span>
          </span>
          <span className="safari-weather">
            <CloudSun size={14} aria-hidden="true" />
            {snapshot.weatherLabel}
          </span>
        </div>
      </div>

      <div className="safari-results-header">
        <h3>
          Señales simuladas <span>{snapshot.signals.length}</span>
        </h3>
        <SafariCountdown nextRefreshAt={snapshot.nextRefreshAt} />
      </div>

      {snapshot.signals.length ? (
        <>
          <p className="safari-help">
            Elegí una señal para ubicarla en el mapa y abrir su ficha.
          </p>
          <ul className="safari-signals" aria-label="Señales detectadas">
            {snapshot.signals.map(({ encounter, reason, boosted }) => (
              <li key={encounter.id}>
                <button
                  type="button"
                  className="safari-signal"
                  onClick={() => onSelect(encounter)}
                  data-boosted={boosted}
                >
                  <SignalSprite pokemonId={encounter.pokemonId} />
                  <span className="safari-signal-copy">
                    <strong>
                      {encounter.name}
                      {registeredIds.includes(encounter.pokemonId) && (
                        <Check size={13} aria-label="Registrado" />
                      )}
                    </strong>
                    <span>{reason}</span>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="safari-help safari-empty">
          El radar no detectó actividad. Probá otro horario o destino.
        </p>
      )}
    </section>
  );
}
