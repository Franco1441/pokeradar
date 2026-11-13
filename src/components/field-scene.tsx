"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Binoculars,
  BookOpen,
  Check,
  MapPin,
  ScanLine,
  X,
} from "lucide-react";
import { artworkUrl, spriteUrl } from "@/lib/pokemon";
import { getPokemonPreview } from "@/lib/pokemon-previews";
import type { FieldSite } from "@/lib/field-sites";
import type { Expedition } from "@/lib/types";
import "./field-scene.css";

interface FieldSceneProps {
  expedition: Expedition;
  site: FieldSite;
  registeredIds: number[];
  onObserve: (encounterId: string) => void;
  onExit: () => void;
  detailOpen: boolean;
  cinematicArrival?: boolean;
  onPanoramaReady?: () => void;
}

function FieldPokemon({ pokemonId }: { pokemonId: number }) {
  const [source, setSource] = useState(() => artworkUrl(pokemonId));
  if (!source) return null;

  // The official artwork and its sprite fallback are already optimized PNGs.
  /* eslint-disable @next/next/no-img-element */
  return (
    <img
      className="field-pokemon"
      src={source}
      alt=""
      width={160}
      height={160}
      draggable={false}
      decoding="async"
      onError={() =>
        setSource(source === spriteUrl(pokemonId) ? "" : spriteUrl(pokemonId))
      }
    />
  );
  /* eslint-enable @next/next/no-img-element */
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(value, max));
}

export default function FieldScene({
  expedition,
  site,
  registeredIds,
  onObserve,
  onExit,
  detailOpen,
  cinematicArrival = false,
  onPanoramaReady,
}: FieldSceneProps) {
  const spots = useMemo(() => {
    const encounters = new Map(
      expedition.encounters.map((encounter) => [encounter.id, encounter]),
    );
    const hiddenSpots = site.clues.flatMap((clue) => {
      const encounter = encounters.get(clue.encounterId);
      return encounter ? [{ ...clue, ...encounter, hidden: true }] : [];
    });
    const visibleSpots = site.sightings.flatMap(([encounterId, x, y]) => {
      const encounter = encounters.get(encounterId);
      return encounter
        ? [{ ...encounter, x, y, label: encounter.name, hidden: false as const }]
        : [];
    });
    return [...hiddenSpots, ...visibleSpots].sort((left, right) => left.x - right.x);
  }, [expedition, site]);
  const viewport = useRef<HTMLDivElement>(null);
  const panorama = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; startX: number; startPan: number } | null>(
    null,
  );
  const primaryAction = useRef<HTMLButtonElement>(null);
  const examineClue = useRef<HTMLButtonElement>(null);
  const focusClueOnDismiss = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState(3);
  const [imageStatus, setImageStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [lookingAt, setLookingAt] = useState(() =>
    Math.max(0, spots.findIndex((spot) => spot.id === site.clues[0]?.encounterId)),
  );
  const [manualPan, setManualPan] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  useEffect(() => {
    exit.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (revealedIndex !== null) {
      primaryAction.current?.focus({ preventScroll: true });
    } else if (focusClueOnDismiss.current) {
      focusClueOnDismiss.current = false;
      examineClue.current?.focus({ preventScroll: true });
    }
  }, [revealedIndex]);

  const currentSpot = spots[lookingAt];
  const sceneWidth = Math.max(size.width * 1.18, size.height * aspect);
  const sceneHeight = sceneWidth / aspect;
  const maxPan = Math.max(0, sceneWidth - size.width);
  const pan = clamp(
    manualPan ?? (currentSpot?.x ?? 0.5) * sceneWidth - size.width / 2,
    maxPan,
  );
  const discovered = spots.filter((spot) =>
    registeredIds.includes(spot.pokemonId),
  ).length;
  const revealed = revealedIndex === null ? null : spots[revealedIndex];
  const preview = revealed && (getPokemonPreview(revealed.pokemonId)
    ?? ("observation" in revealed ? revealed.observation : undefined));
  const revealedIsRegistered = Boolean(
    revealed && registeredIds.includes(revealed.pokemonId),
  );
  const fieldComplete = spots.length > 0 && discovered === spots.length;
  const hasTableCoral = expedition.id === "heron";

  function lookAt(index: number) {
    if (!spots.length) return;
    setLookingAt((index + spots.length) % spots.length);
    setManualPan(null);
  }

  function lookWithKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (
      detailOpen ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (revealed) dismissReveal();
      else onExit();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    lookAt(lookingAt + (event.key === "ArrowRight" ? 1 : -1));
  }

  function followPan(nextPan: number) {
    setManualPan(nextPan);
    if (!sceneWidth || !spots.length) return;

    const center = (nextPan + size.width / 2) / sceneWidth;
    const nearestIndex = spots.reduce(
      (nearest, spot, index) =>
        Math.abs(spot.x - center) < Math.abs(spots[nearest].x - center)
          ? index
          : nearest,
      0,
    );
    setLookingAt(nearestIndex);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    // A drag can begin halfway through a look animation. Start at the
    // painted position so the panorama stays under the pointer.
    const transform = panorama.current
      ? getComputedStyle(panorama.current).transform
      : "none";
    const startPan =
      transform === "none"
        ? pan
        : clamp(-new DOMMatrixReadOnly(transform).m41, maxPan);
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startPan,
    };
    followPan(startPan);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    followPan(
      clamp(active.startPan + active.startX - event.clientX, maxPan),
    );
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  function examine(index: number) {
    lookAt(index);
    setRevealedIndex(index);
    if (revealedIndex === index)
      primaryAction.current?.focus({ preventScroll: true });
  }

  function dismissReveal() {
    const id = revealed?.id;
    setRevealedIndex(null);
    if (id)
      viewport.current
        ?.querySelector<HTMLButtonElement>(`[data-clue="${id}"]`)
        ?.focus();
  }

  function continueFieldwork() {
    if (fieldComplete) {
      onExit();
      return;
    }

    const isUnregistered = (spot: (typeof spots)[number]) =>
      !registeredIds.includes(spot.pokemonId);
    const nextIndex = spots.findIndex(
      (spot, index) =>
        index > (revealedIndex ?? lookingAt) && isUnregistered(spot),
    );
    lookAt(nextIndex < 0 ? spots.findIndex(isUnregistered) : nextIndex);
    focusClueOnDismiss.current = true;
    setRevealedIndex(null);
  }

  return (
    <section
      className="field-scene"
      aria-label={`Exploración en ${site.name}`}
      style={{ "--field-accent": site.accent } as CSSProperties}
      data-arrival={cinematicArrival ? "cinematic" : undefined}
      data-panorama={imageStatus}
      onKeyDown={lookWithKeyboard}
      inert={detailOpen}
    >
      <div
        ref={viewport}
        className="field-viewport"
        data-dragging={dragging}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
      >
        <div
          ref={panorama}
          className="field-panorama"
          style={
            {
              width: sceneWidth,
              height: sceneHeight,
              top: (size.height - sceneHeight) / 2,
              transform: `translate3d(${-pan}px, 0, 0)`,
              "--reef-creature-size": `${sceneHeight * 0.17}px`,
            } as CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- The panorama needs its exact intrinsic aspect ratio. */}
          <img
            className="field-backdrop"
            src={site.image}
            alt=""
            draggable={false}
            onLoad={({ currentTarget }) => {
              setAspect(
                currentTarget.naturalWidth / currentTarget.naturalHeight,
              );
              setImageStatus("ready");
              onPanoramaReady?.();
            }}
            onError={() => {
              setImageStatus("failed");
              onPanoramaReady?.();
            }}
            data-failed={imageStatus === "failed"}
          />
          {hasTableCoral && imageStatus === "ready" && (
            // The foreground uses the same pixels and coordinate system as the panorama.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="field-table-coral"
              src={site.image}
              alt=""
              draggable={false}
            />
          )}
          {spots.map((spot, index) => {
            const registered = registeredIds.includes(spot.pokemonId);
            const found = registered || index === revealedIndex;
            const position = { left: `${spot.x * 100}%`, top: `${spot.y * 100}%` };
            const focusSpot = (event: FocusEvent<HTMLButtonElement>) => {
              if (event.currentTarget.matches(":focus-visible")) lookAt(index);
            };
            if (!spot.hidden) {
              return (
                <div
                  key={spot.id}
                  className="field-clue-point"
                  data-focused={index === lookingAt}
                  style={position}
                >
                  <button
                    className="field-wild-pokemon"
                    type="button"
                    data-clue={spot.id}
                    aria-label={registered ? `Volver a observar a ${spot.name}` : `Observar a ${spot.name}`}
                    onFocus={focusSpot}
                    onClick={() => examine(index)}
                  >
                    <FieldPokemon pokemonId={spot.pokemonId} />
                    <span>{registered && <Check size={13} aria-hidden="true" />}{spot.name}</span>
                  </button>
                </div>
              );
            }
            return (
              <div
                key={spot.id}
                className="field-clue-point"
                data-found={found}
                data-focused={index === lookingAt}
                data-habitat={
                  spot.id === "heron-squirtle" ? "table-coral" : undefined
                }
                style={position}
              >
                <FieldPokemon pokemonId={spot.pokemonId} />
                <button
                  className="field-clue"
                  type="button"
                  data-clue={spot.id}
                  aria-label={
                    registered
                      ? `Volver a observar a ${spot.name}`
                      : `Examinar: ${spot.label}`
                  }
                  onFocus={focusSpot}
                  onClick={() => examine(index)}
                >
                  <span className="field-clue-icon" aria-hidden="true">
                    {registered ? <Check size={12} /> : <ScanLine size={12} />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="field-shade" aria-hidden="true" />
      {!cinematicArrival && imageStatus === "ready" && (
        <div className="field-fog" aria-hidden="true" />
      )}

      <header className="field-heading">
        <div>
          <p>
            <MapPin size={14} /> {expedition.country} · {expedition.name}
          </p>
          <h2>{site.name}</h2>
        </div>
        <button
          ref={exit}
          className="field-exit"
          type="button"
          onClick={onExit}
        >
          <ArrowLeft size={17} /> Volver al mapa
        </button>
      </header>

      {imageStatus === "failed" && (
        <p className="field-failure" role="status">
          El panorama no se pudo cargar. Podés seguir las pistas con los
          controles.
        </p>
      )}

      <div className="field-controls">
        {currentSpot && (
          <nav className="field-navigation" aria-label="Mirar alrededor">
            <button
              type="button"
              aria-label="Mirar a la izquierda"
              onClick={() => lookAt(lookingAt - 1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              ref={examineClue}
              className="field-observe"
              type="button"
              onClick={() => examine(lookingAt)}
              aria-label={currentSpot.hidden
                ? `Examinar pista enfocada: ${currentSpot.label}`
                : `Observar pista enfocada: ${currentSpot.name}`}
            >
              <Binoculars size={19} aria-hidden="true" />
              <span className="field-observe-copy">
                <strong>{currentSpot.hidden ? "Examinar pista" : "Observar Pokémon"}</strong>
                <span>{currentSpot.label}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Mirar a la derecha"
              onClick={() => lookAt(lookingAt + 1)}
            >
              <ArrowRight size={18} />
            </button>
          </nav>
        )}
        <div className="field-status">
          <p className="field-hint">Arrastrá para mirar alrededor.</p>
          <div className="field-progress">
            <div className="field-progress-segments" aria-hidden="true">
              {spots.map((spot) => (
                <span
                  key={spot.id}
                  data-registered={registeredIds.includes(spot.pokemonId)}
                />
              ))}
            </div>
            <p aria-live="polite">
              {discovered} de {spots.length} registrados
            </p>
          </div>
        </div>
      </div>

      {revealed && (
        <div
          key={revealed.id}
          className="field-discovery"
          role="region"
          aria-label={`Avistamiento de ${revealed.name}`}
        >
          <button
            className="field-dismiss"
            type="button"
            aria-label={
              expedition.id === "nikko"
                ? "Seguir explorando el bosque"
                : "Seguir explorando"
            }
            onClick={dismissReveal}
          >
            <X size={17} />
          </button>
          <div>
            {revealedIsRegistered && (
              <p className="field-registration" aria-live="polite">
                <Check size={15} aria-hidden="true" />
                {fieldComplete
                  ? "Recorrido completado"
                  : "Registrado en tu atlas"}
              </p>
            )}
            <h3>{revealed.name}</h3>
            {preview && <p>{preview}</p>}
          </div>
          <div className="field-discovery-actions">
            <button
              ref={primaryAction}
              className="field-detail-button"
              type="button"
              onClick={
                revealedIsRegistered
                  ? continueFieldwork
                  : () => onObserve(revealed.id)
              }
            >
              {revealedIsRegistered
                ? fieldComplete
                  ? "Finalizar recorrido"
                  : "Buscar la siguiente pista"
                : "Abrir ficha"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {revealedIsRegistered && (
              <button
                className="field-reopen-button"
                type="button"
                onClick={() => onObserve(revealed.id)}
                aria-label="Ver ficha de nuevo"
              >
                <BookOpen size={15} aria-hidden="true" /> Ficha
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
