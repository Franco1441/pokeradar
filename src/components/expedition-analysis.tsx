"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { ArrowRight, ChartNoAxesColumnIncreasing, CloudSun, Compass, MapPin, Radar, Sprout } from "lucide-react";
import Image from "next/image";
import { buildExpeditionAnalysis, type ExpeditionAnalysisRow } from "@/lib/expedition-analysis";
import { EXPEDITIONS } from "@/lib/expeditions";
import { TYPE_LABELS } from "@/lib/pokemon";
import type { ResearchProgress, WeatherSnapshot } from "@/lib/types";
import { SAFARI_RESPAWN_MS } from "@/lib/safari";
import { fetchWeather } from "@/lib/weather";
import "./expedition-analysis.css";

const metrics = {
  diversity: {
    label: "Tipos activos",
    value: (row: ExpeditionAnalysisRow) => row.activeTypes.length,
    description: "Tipos de Pokémon distintos entre las señales activas del Safari.",
  },
  coverage: {
    label: "Cobertura del atlas",
    value: (row: ExpeditionAnalysisRow) => row.completionPercent,
    description: "Cobertura = especies registradas sobre el catálogo de cada destino.",
  },
  signals: {
    label: "Señales sin registrar",
    value: (row: ExpeditionAnalysisRow) => row.unregisteredSignals,
    description: "Las señales son simuladas y se recalculan cada 30 segundos según la actividad del Safari.",
  },
};
type Metric = keyof typeof metrics;
const metricIds = Object.keys(metrics) as Metric[];

const clock = () => Math.floor(Date.now() / SAFARI_RESPAWN_MS) * SAFARI_RESPAWN_MS;
const serverClock = () => null;
function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 1_000);
  return () => window.clearInterval(timer);
}

function combineWeather(results: UseQueryResult<WeatherSnapshot>[]) {
  return {
    byExpedition: Object.fromEntries(
      EXPEDITIONS.map(({ id }, index) => [id, results[index].data]),
    ),
    pending: results.some((result) => result.isPending),
  };
}

interface ExpeditionAnalysisProps {
  progress: ResearchProgress;
  regionId: string;
  onSelectRegion: (id: string) => void;
  onOpenMap: (id: string) => void;
  onOpenSafari: (id: string) => void;
}

export default function ExpeditionAnalysis({
  progress, regionId, onSelectRegion, onOpenMap, onOpenSafari,
}: ExpeditionAnalysisProps) {
  const [metricChoice, setMetric] = useState<Metric>();
  const metric = metricChoice ?? (progress.records.length > 0 ? "coverage" : "diversity");
  const currentMetric = metrics[metric];
  const now = useSyncExternalStore(subscribe, clock, serverClock);
  const weather = useQueries({
    queries: EXPEDITIONS.map((expedition) => ({
      queryKey: ["weather", expedition.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchWeather(expedition, signal),
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
      retry: 1,
    })),
    combine: combineWeather,
  });
  const weatherByExpedition = weather.byExpedition;
  const analysis = useMemo(() => {
    if (now === null) return null;
    return buildExpeditionAnalysis(EXPEDITIONS, progress, { now, weatherByExpedition });
  }, [now, progress, weatherByExpedition]);
  const rows = analysis?.rows ?? [];
  const totals = analysis?.totals;
  const selected = rows.find(({ id }) => id === regionId) ?? rows[0];
  const selectedExpedition = EXPEDITIONS.find(({ id }) => id === selected?.id);
  const ranked = [...rows].sort((first, second) => currentMetric.value(second) - currentMetric.value(first));
  const highest = metric === "coverage" ? 100 : Math.max(1, ...rows.map(currentMetric.value));
  const recommended = analysis?.recommended;

  return (
    <main className="analysis-stage" id="expedition-panel" tabIndex={-1} aria-labelledby="analysis-title">
      <div className="analysis-shell mx-auto grid gap-5">
        <header className="analysis-intro">
          <div>
            <h1 id="analysis-title">Análisis de expediciones</h1>
            <p>Compará tu avance y las señales del Safari para elegir dónde explorar.</p>
          </div>
          <ChartNoAxesColumnIncreasing aria-hidden="true" size={34} strokeWidth={1.3} />
        </header>

        {totals ? (
          <>
            <dl className="analysis-kpis">
              <div>
                <dt><Sprout size={16} aria-hidden="true" /> Especies registradas</dt>
                <dd>{totals.registeredSpecies}<span> / {totals.totalSpecies}</span></dd>
              </div>
              <div>
                <dt><Compass size={16} aria-hidden="true" /> Misiones completas</dt>
                <dd>{totals.completedExpeditions}<span> / {totals.totalExpeditions}</span></dd>
              </div>
              <div>
                <dt><Radar size={16} aria-hidden="true" /> Señales sin registrar</dt>
                <dd>{totals.unregisteredSignals}<span> / {totals.activeSignals}</span></dd>
              </div>
            </dl>

            <div className="analysis-grid">
              <section className="analysis-card analysis-comparison" aria-labelledby="analysis-comparison-title">
                <div className="analysis-card-title">
                  <h2 id="analysis-comparison-title">Comparar destinos</h2>
                  <a className="analysis-detail-jump" href="#analysis-selected-destination">Ver detalle</a>
                  <div className="analysis-metrics" role="group" aria-label="Métrica de comparación">
                    {metricIds.map((id) => (
                      <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)}>
                        {metrics[id].label}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="analysis-bars" aria-label={`${currentMetric.label} por destino`}>
                  {ranked.map((row) => (
                    <ComparisonBar
                      key={row.id}
                      row={row}
                      metric={metric}
                      highest={highest}
                      selected={selected?.id === row.id}
                      onSelect={onSelectRegion}
                    />
                  ))}
                </ul>
                <p className="analysis-footnote">
                  {currentMetric.description}
                </p>
              </section>

              {selected && selectedExpedition && (
                <section className="analysis-card analysis-destination" id="analysis-selected-destination" tabIndex={-1} aria-labelledby="analysis-destination-title">
                  <div className="analysis-destination-cover">
                    <Image src={selectedExpedition.image} alt="" fill sizes="(max-width: 850px) 100vw, 420px" />
                    <div>
                      <span><MapPin size={14} aria-hidden="true" /> {selected.country}</span>
                      <h2 id="analysis-destination-title">{selected.name}</h2>
                    </div>
                  </div>
                  <div className="analysis-destination-body">
                    <p className="analysis-biome">{selected.biome}</p>
                    <dl className="analysis-destination-facts">
                      <div><dt>Especies pendientes</dt><dd>{selected.remainingSpecies}</dd></div>
                      <div><dt>Señales sin registrar</dt><dd>{selected.unregisteredSignals}</dd></div>
                    </dl>
                    {selected.activeTypes.length > 0 && (
                      <ul className="analysis-types" aria-label="Tipos activos en el Safari">
                        {selected.activeTypes.map((type) => <li key={type}>{TYPE_LABELS[type]}</li>)}
                      </ul>
                    )}
                    <div className="analysis-weather">
                      <CloudSun size={19} aria-hidden="true" />
                      <div>
                        <p>{selected.temperature !== null && <strong>{Math.round(selected.temperature)} °C · </strong>}<span>{selected.weatherLabel}</span></p>
                        <small>{selected.weatherSource === "live" ? "Clima en vivo" : "Hora local estimada"} · {selected.localTime} · {selected.isDay ? "Día" : "Noche"}</small>
                      </div>
                    </div>
                    <div className="analysis-actions">
                      <button type="button" onClick={() => onOpenMap(selected.id)}>Ver en el mapa</button>
                      <button type="button" onClick={() => onOpenSafari(selected.id)}>Abrir Safari <ArrowRight size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                </section>
              )}
            </div>
            {recommended && (
              <section className="analysis-recommendation" aria-labelledby="analysis-recommendation-title">
                <Compass size={23} aria-hidden="true" />
                <div>
                  <h2 id="analysis-recommendation-title">Próxima expedición sugerida</h2>
                  <p><strong>{recommended.name}</strong> · {recommended.unregisteredSignals} señales sin registrar y {recommended.remainingSpecies} especies pendientes.</p>
                  <small>Prioriza las señales sin registrar. Si hay empate, elige el destino con más especies pendientes.</small>
                </div>
                <button type="button" onClick={() => {
                  if (recommended.unregisteredSignals > 0) onOpenSafari(recommended.id);
                  else onOpenMap(recommended.id);
                }}>Explorar destino <ArrowRight size={16} aria-hidden="true" /></button>
              </section>
            )}
            <p className="analysis-footnote analysis-source">
              Atlas guardado en este navegador · Meteorología de Open-Meteo{weather.pending ? " · Consultando condiciones…" : ""} · Apariciones simuladas
            </p>
          </>
        ) : <p role="status">Preparando la comparación…</p>}
      </div>
    </main>
  );
}

function ComparisonBar({ row, metric, highest, selected, onSelect }: {
  row: ExpeditionAnalysisRow;
  metric: Metric;
  highest: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const coverage = metric === "coverage";
  const value = metrics[metric].value(row);
  const label = coverage
    ? `${row.registeredSpecies} de ${row.totalSpecies} especies registradas, ${value}%`
    : metric === "signals"
      ? `${value} señales sin registrar de ${row.activeSignals} activas`
      : `${value} tipos activos`;
  return (
    <li>
      <button type="button" aria-pressed={selected} aria-label={`${row.name}, ${label}`} onClick={() => onSelect(row.id)}>
        <span className="analysis-bar-name"><strong>{row.name}</strong><small>{row.country}</small></span>
        <span className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${(value / highest) * 100}%` }} /></span>
        <span className="analysis-bar-value" aria-hidden="true">{coverage ? `${value}%` : value}</span>
      </button>
    </li>
  );
}
