"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  AudioLines,
  Bookmark,
  Check,
  CheckCheck,
  Heart,
  Leaf,
  MapPin,
  RefreshCw,
  Volume2,
} from "lucide-react";
import {
  fetchDescription,
  fetchPokemon,
  TYPE_COLORS,
  TYPE_LABELS,
} from "@/lib/pokemon";
import type {
  Encounter,
  Expedition,
  PokemonDetail,
  PokemonType,
} from "@/lib/types";
import "./detail.css";

interface PokemonDetailPanelProps {
  encounter: Encounter;
  expedition: Expedition;
  registered: boolean;
  inTeam: boolean;
  teamFull: boolean;
  onRegister: () => void;
  onToggleTeam: () => void;
  onClose: () => void;
  boostedTypes: PokemonType[];
}

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span
      className="detail-type"
      style={{ "--type-color": TYPE_COLORS[type] } as CSSProperties}
    >
      <span aria-hidden="true" />
      {TYPE_LABELS[type]}
    </span>
  );
}

function PokemonPortrait({ pokemon }: { pokemon: PokemonDetail }) {
  const [attempt, setAttempt] = useState(0);
  const sources = Array.from(
    new Set(
      [pokemon.artwork, pokemon.sprite].filter((source): source is string =>
        Boolean(source),
      ),
    ),
  );
  const source = sources[attempt];

  if (!source) {
    return (
      <span
        className="detail-portrait-fallback"
        aria-label={`Ilustración de ${pokemon.name} no disponible`}
      >
        ?
      </span>
    );
  }

  return (
    // Pokémon artwork comes directly from the API and has its own fallback sequence.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="detail-portrait"
      src={source}
      alt={pokemon.name}
      width={232}
      height={232}
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}

function CryButton({ source, name }: { source: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  async function playCry() {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    setPlaying(true);
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  }

  return (
    <div className="detail-audio">
      <audio
        ref={audioRef}
        src={source}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <button
        className="detail-audio-button"
        type="button"
        onClick={playCry}
        aria-label={`${playing ? "Detener sonido de" : "Escuchar a"} ${name}`}
        aria-pressed={playing}
        title={playing ? "Detener sonido" : "Escuchar Pokémon"}
      >
        {playing ? <AudioLines size={16} /> : <Volume2 size={16} />}
      </button>
      {failed && (
        <span className="detail-audio-error" role="status">
          Sonido no disponible
        </span>
      )}
    </div>
  );
}

export default function PokemonDetailPanel({
  encounter,
  expedition,
  registered,
  inTeam,
  teamFull,
  onRegister,
  onToggleTeam,
  onClose,
  boostedTypes,
}: PokemonDetailPanelProps) {
  const reduceMotion = useReducedMotion();
  const pokemonQuery = useQuery({
    queryKey: ["pokemon", encounter.pokemonId],
    queryFn: ({ signal }) => fetchPokemon(encounter.pokemonId, signal),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  const descriptionQuery = useQuery({
    queryKey: ["species", encounter.pokemonId],
    queryFn: ({ signal }) => fetchDescription(encounter.pokemonId, signal),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  const pokemon = pokemonQuery.data;
  const types = pokemon?.types ?? encounter.types;
  const boosted = types.some((type) => boostedTypes.includes(type));
  const title = (pokemon?.name ?? encounter.name).replaceAll("-", " ");

  return (
    <section className="detail-panel" aria-labelledby="pokemon-detail-title">
      <div className="detail-toolbar">
        <button className="detail-back" onClick={onClose} type="button">
          <ArrowLeft size={16} />
          <span>Volver a explorar</span>
        </button>
        <span className="detail-number">
          N.º {String(encounter.pokemonId).padStart(3, "0")}
        </span>
      </div>

      <div
        className="detail-stage"
        style={{ "--stage-color": TYPE_COLORS[types[0]] } as CSSProperties}
      >
        <div className="detail-orbit detail-orbit-outer" aria-hidden="true" />
        <div className="detail-orbit detail-orbit-inner" aria-hidden="true" />
        {registered && (
          <span className="detail-registered-mark">
            <Check size={12} /> Registrado
          </span>
        )}
        <motion.div
          className="detail-portrait-wrap"
          key={encounter.id}
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {pokemon ? (
            <PokemonPortrait key={pokemon.id} pokemon={pokemon} />
          ) : pokemonQuery.isPending ? (
            <span
              className="detail-portrait-skeleton detail-skeleton"
              aria-hidden="true"
            />
          ) : (
            <Leaf
              className="detail-portrait-leaf"
              size={70}
              strokeWidth={1}
              aria-hidden="true"
            />
          )}
        </motion.div>
        <span className="detail-stage-place">
          <MapPin size={12} />
          {expedition.biome}
        </span>
        {pokemon?.cry && (
          <CryButton key={pokemon.id} source={pokemon.cry} name={title} />
        )}
      </div>

      <div className="detail-content">
        <div className="detail-heading">
          <div>
            <p className="detail-eyebrow">
              {expedition.name} · {expedition.country}
            </p>
            <h2 id="pokemon-detail-title">{title}</h2>
          </div>
          {registered && (
            <CheckCheck
              size={22}
              className="detail-heading-check"
              aria-label="Avistamiento registrado"
            />
          )}
        </div>
        <div className="detail-types">
          {types.map((type) => (
            <TypeBadge type={type} key={type} />
          ))}
        </div>

        {boosted && (
          <p className="detail-weather-boost">
            <Leaf size={14} />
            <span>Condiciones favorables para su actividad</span>
          </p>
        )}

        {pokemonQuery.isError && (
          <div className="detail-error" role="alert">
            <strong>No pudimos cargar esta ficha.</strong>
            <p>Podés volver a intentarlo mientras seguís explorando.</p>
            <button
              type="button"
              className="detail-retry"
              onClick={() => void pokemonQuery.refetch()}
              disabled={pokemonQuery.isFetching}
            >
              <RefreshCw size={14} />
              {pokemonQuery.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        )}

        {pokemonQuery.isPending && (
          <div
            aria-label="Cargando información del Pokémon"
            role="status"
            className="detail-loading"
          >
            <div className="detail-skeleton detail-skeleton-line" />
            <div className="detail-skeleton detail-skeleton-line detail-skeleton-short" />
            <div className="detail-skeleton detail-skeleton-facts" />
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="detail-skeleton detail-skeleton-stat" />
            ))}
          </div>
        )}

        {pokemon && (
          <>
            {descriptionQuery.data && (
              <p className="detail-description">{descriptionQuery.data}</p>
            )}
            <dl className="detail-facts">
              <div>
                <dt>Altura</dt>
                <dd>
                  {pokemon.height.toLocaleString("es-AR")} <span>m</span>
                </dd>
              </div>
              <div>
                <dt>Peso</dt>
                <dd>
                  {pokemon.weight.toLocaleString("es-AR")} <span>kg</span>
                </dd>
              </div>
            </dl>
            <section
              className="detail-stats"
              aria-labelledby="pokemon-stats-title"
            >
              <div className="detail-section-heading">
                <h3 id="pokemon-stats-title">Estadísticas base</h3>
                <span>Máx. 255</span>
              </div>
              <dl>
                {pokemon.stats.map((stat) => (
                  <div
                    className="detail-stat"
                    key={`${pokemon.id}-${stat.name}`}
                  >
                    <dt>{stat.name}</dt>
                    <dd>{stat.value}</dd>
                    <div className="detail-stat-track" aria-hidden="true">
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{
                          width: `${Math.min(stat.value / 255, 1) * 100}%`,
                        }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.5,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}

        <div className="detail-field-note">
          <span className="detail-note-icon">
            <Leaf size={17} />
          </span>
          <div>
            <h3>En este hábitat</h3>
            <p>{encounter.rationale}</p>
          </div>
        </div>

        <p className="detail-source">
          Avistamiento simulado ·{" "}
          <a
            href={`https://pokeapi.co/api/v2/pokemon/${encounter.pokemonId}`}
            target="_blank"
            rel="noreferrer"
          >
            Datos de PokéAPI
          </a>
        </p>
      </div>
      <div className="detail-actions">
        <button
          type="button"
          className={`detail-primary${registered ? " is-recorded" : ""}`}
          onClick={onRegister}
          disabled={registered || !pokemon}
        >
          {registered ? <Check size={17} /> : <Bookmark size={17} />}
          {registered ? "Guardado en tu atlas" : "Registrar avistamiento"}
        </button>
        {registered && (
          <button
            type="button"
            className={`detail-secondary${inTeam ? " is-in-team" : ""}`}
            onClick={onToggleTeam}
            disabled={!inTeam && teamFull}
            aria-pressed={inTeam}
          >
            <Heart size={16} fill={inTeam ? "currentColor" : "none"} />
            {inTeam
              ? "Quitar de mi equipo"
              : teamFull
                ? "Tu equipo está completo"
                : "Añadir a mi equipo"}
          </button>
        )}
        {registered && teamFull && !inTeam && (
          <p className="detail-team-hint">
            Podés liberar un lugar desde tu equipo de seis.
          </p>
        )}
      </div>
    </section>
  );
}
