"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ArrowLeft, ArrowRight, Binoculars, Check, MapPin, ScanLine, X } from "lucide-react";
import { artworkUrl, spriteUrl } from "@/lib/pokemon";
import "./field-scene.css";

const FIELD_IMAGE = "/expeditions/nikko-field.webp";
const CLUES = [
  {
    id: "nikko-bulbasaur",
    pokemonId: 1,
    name: "Bulbasaur",
    label: "Movimiento entre los helechos",
    observation: "Un bulbo asoma entre los helechos del claro.",
    x: 0.24,
    y: 0.65,
  },
  {
    id: "nikko-caterpie",
    pokemonId: 10,
    name: "Caterpie",
    label: "Hojas que se mueven",
    observation: "Caterpie se refugia bajo las hojas tiernas.",
    x: 0.53,
    y: 0.43,
  },
  {
    id: "nikko-hoothoot",
    pokemonId: 163,
    name: "Hoothoot",
    label: "Una silueta en las ramas",
    observation: "Hoothoot observa el claro desde una rama.",
    x: 0.85,
    y: 0.31,
  },
];

interface FieldSceneProps {
  registeredIds: number[];
  onObserve: (encounterId: string) => void;
  onExit: () => void;
  detailOpen: boolean;
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
  registeredIds,
  onObserve,
  onExit,
  detailOpen,
}: FieldSceneProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; startX: number; startPan: number } | null>(null);
  const openDetail = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState(3);
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [lookingAt, setLookingAt] = useState(0);
  const [manualPan, setManualPan] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  useEffect(() => {
    exit.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (revealedIndex !== null) openDetail.current?.focus({ preventScroll: true });
  }, [revealedIndex]);

  const sceneWidth = Math.max(size.width * 1.18, size.height * aspect);
  const sceneHeight = sceneWidth / aspect;
  const maxPan = Math.max(0, sceneWidth - size.width);
  const pan = clamp(manualPan ?? CLUES[lookingAt].x * sceneWidth - size.width / 2, maxPan);
  const discovered = CLUES.filter((clue) => registeredIds.includes(clue.pokemonId)).length;
  const revealed = revealedIndex === null ? null : CLUES[revealedIndex];

  function lookAt(index: number) {
    setLookingAt((index + CLUES.length) % CLUES.length);
    setManualPan(null);
  }

  function lookWithKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (detailOpen || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
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

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { id: event.pointerId, startX: event.clientX, startPan: pan };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const nextPan = clamp(active.startPan + active.startX - event.clientX, maxPan);
    setManualPan(nextPan);
    if (!sceneWidth) return;

    const center = (nextPan + size.width / 2) / sceneWidth;
    const nearestIndex = CLUES.reduce(
      (nearest, clue, index) =>
        Math.abs(clue.x - center) < Math.abs(CLUES[nearest].x - center)
          ? index
          : nearest,
      0,
    );
    setLookingAt(nearestIndex);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  function examine(index: number) {
    lookAt(index);
    setRevealedIndex(index);
    if (revealedIndex === index) openDetail.current?.focus({ preventScroll: true });
  }

  function dismissReveal() {
    const id = revealed?.id;
    setRevealedIndex(null);
    if (id) viewport.current?.querySelector<HTMLButtonElement>(`[data-clue="${id}"]`)?.focus();
  }

  return (
    <section
      className="field-scene"
      aria-label="Exploración del bosque de Nikkō"
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
          className="field-panorama"
          style={{
            width: sceneWidth,
            height: sceneHeight,
            top: (size.height - sceneHeight) / 2,
            transform: `translate3d(${-pan}px, 0, 0)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- The panorama needs its exact intrinsic aspect ratio. */}
          <img
            className="field-backdrop"
            src={FIELD_IMAGE}
            alt=""
            draggable={false}
            onLoad={({ currentTarget }) => {
              setAspect(currentTarget.naturalWidth / currentTarget.naturalHeight);
              setImageStatus("ready");
            }}
            onError={() => setImageStatus("failed")}
            data-failed={imageStatus === "failed"}
          />
          {CLUES.map((clue, index) => {
            const registered = registeredIds.includes(clue.pokemonId);
            const found = registered || index === revealedIndex;
            return (
              <div
                key={clue.id}
                className="field-clue-point"
                data-found={found}
                style={{ left: `${clue.x * 100}%`, top: `${clue.y * 100}%` }}
              >
                <FieldPokemon pokemonId={clue.pokemonId} />
                <button
                  className="field-clue"
                  type="button"
                  data-clue={clue.id}
                  aria-label={registered ? `Volver a observar a ${clue.name}` : `Examinar: ${clue.label}`}
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible")) lookAt(index);
                  }}
                  onClick={() => examine(index)}
                >
                  {registered ? <Check size={19} /> : <ScanLine size={20} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="field-shade" aria-hidden="true" />
      {imageStatus === "ready" && <div className="field-fog" aria-hidden="true" />}

      <header className="field-heading">
        <div>
          <p><MapPin size={14} /> Japón · Expedición a pie</p>
          <h2>Bosques de Nikkō</h2>
        </div>
        <button ref={exit} className="field-exit" type="button" onClick={onExit}>
          <ArrowLeft size={17} /> Volver al mapa
        </button>
      </header>

      {imageStatus === "failed" && (
        <p className="field-failure" role="status">
          El panorama no se pudo cargar. Podés seguir las pistas con los controles.
        </p>
      )}

      <div className="field-controls">
        <nav className="field-navigation" aria-label="Mirar alrededor">
          <button type="button" aria-label="Mirar a la izquierda" onClick={() => lookAt(lookingAt - 1)}>
            <ArrowLeft size={18} />
          </button>
          <button
            className="field-observe"
            type="button"
            onClick={() => examine(lookingAt)}
            aria-label={`Examinar pista enfocada: ${CLUES[lookingAt].label}`}
          >
            <Binoculars size={19} />
            <span>{CLUES[lookingAt].label}</span>
          </button>
          <button type="button" aria-label="Mirar a la derecha" onClick={() => lookAt(lookingAt + 1)}>
            <ArrowRight size={18} />
          </button>
        </nav>
        <div className="field-status">
          <p className="field-hint">Arrastrá para mirar alrededor</p>
          <p className="field-progress" aria-live="polite">
            {discovered} de {CLUES.length} registrados
          </p>
        </div>
      </div>

      {revealed && (
        <div className="field-discovery" role="region" aria-label={`Avistamiento de ${revealed.name}`}>
          <button className="field-dismiss" type="button" aria-label="Seguir explorando el bosque" onClick={dismissReveal}>
            <X size={17} />
          </button>
          <div>
            <h3>{revealed.name}</h3>
            <p>{revealed.observation}</p>
          </div>
          <button
            ref={openDetail}
            className="field-detail-button"
            type="button"
            onClick={() => onObserve(revealed.id)}
          >
            Abrir ficha <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
