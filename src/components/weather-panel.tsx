"use client";

import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Clock3, Leaf, MapPin, Moon, RefreshCw, Sun, Thermometer, Wind } from "lucide-react";
import { weatherInfo } from "@/lib/weather";
import type { Expedition, WeatherSnapshot } from "@/lib/types";
import { TypeBadge } from "./pokemon-detail";
import "./detail.css";

interface WeatherPanelProps {
  expedition: Expedition;
  weather: WeatherSnapshot | undefined;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
}

function WeatherIcon({ weather, size = 68 }: { weather: WeatherSnapshot; size?: number }) {
  const props = { size, strokeWidth: 1.2, "aria-hidden": true as const };
  if (weather.code >= 95) return <CloudLightning {...props} />;
  if ([71, 73, 75, 77, 85, 86].includes(weather.code)) return <CloudSnow {...props} />;
  if ([45, 48].includes(weather.code)) return <CloudFog {...props} />;
  if (weather.code >= 51) return <CloudRain {...props} />;
  if (weather.code === 3) return <Cloud {...props} />;
  if (weather.code > 0) return <CloudSun {...props} />;
  return weather.isDay ? <Sun {...props} /> : <Moon {...props} />;
}

export function WeatherPanel({ expedition, weather, isLoading, error, onRetry }: WeatherPanelProps) {
  const conditions = weather ? weatherInfo(weather) : null;
  const weatherTime = weather?.time.split("T")[1]?.slice(0, 5);
  const boostedEncounters = conditions ? expedition.encounters.filter((encounter) => encounter.types.some((type) => conditions.types.includes(type))) : [];

  return (
    <section className="weather-panel" aria-labelledby="weather-panel-title">
      <p className="detail-eyebrow">EL ENTORNO TAMBIÉN CUENTA</p>
      <h2 id="weather-panel-title">Observatorio</h2>
      <p className="weather-intro">Descubrí qué condiciones acompañan tu expedición y qué especies se sienten en su elemento.</p>
      <div className="weather-location"><MapPin size={15} /><span>{expedition.name}<small>{expedition.country}</small></span></div>

      {isLoading && !weather && <div className="weather-loading" role="status" aria-label="Consultando condiciones meteorológicas"><div className="detail-skeleton weather-skeleton-icon" /><div className="detail-skeleton detail-skeleton-line" /><div className="detail-skeleton detail-skeleton-line detail-skeleton-short" /></div>}

      {error && <div className="detail-error" role="alert"><strong>{weather ? "Mostramos la última lectura disponible." : "El clima no está disponible ahora."}</strong><p>Tu expedición sigue disponible. Podemos volver a consultar las condiciones.</p><button className="detail-retry" type="button" onClick={onRetry} disabled={isLoading}><RefreshCw size={14} />{isLoading ? "Consultando…" : "Actualizar clima"}</button></div>}

      {weather && conditions && (
        <>
          <div className="weather-current">
            <div className="weather-current-top"><span>Condiciones actuales</span>{error && <span className="weather-status is-stale">Última lectura</span>}</div>
            <div className="weather-temperature"><WeatherIcon weather={weather} /><strong>{Math.round(weather.temperature)}<span>°</span></strong></div>
            <p className="weather-condition">{conditions.label}</p>
            <div className="weather-readings"><span><Thermometer size={15} />Grados Celsius</span><span><Wind size={16} />{Math.round(weather.windSpeed)} km/h</span></div>
            <p className="weather-update"><Clock3 size={12} />Lectura de las {weatherTime ?? "—"} · hora local</p>
          </div>

          <section className="weather-activity" aria-labelledby="weather-activity-title">
            <span className="weather-activity-icon"><Leaf size={19} /></span>
            <h3 id="weather-activity-title">Un buen momento para explorar</h3>
            <p>Estas condiciones favorecen la actividad de los siguientes tipos en nuestra simulación.</p>
            <div className="detail-types">{conditions.types.map((type) => <TypeBadge key={type} type={type} />)}</div>
            <div className="weather-favored"><strong>{boostedEncounters.length}</strong><span>{boostedEncounters.length === 1 ? "especie de esta expedición tiene" : "especies de esta expedición tienen"} condiciones favorables.</span></div>
          </section>
        </>
      )}

      <div className="weather-explanation"><h3>Seguí la señal verde</h3><p>Los avistamientos favorecidos se destacan en el mapa y en sus fichas. Podés investigar todas las especies de la expedición en cualquier condición.</p></div>
      <p className="detail-source">Clima de <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Actividad Pokémon simulada</p>
    </section>
  );
}

export default WeatherPanel;
