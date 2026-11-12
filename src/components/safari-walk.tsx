"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Binoculars,
  CloudSun,
  MapPin,
  Radar,
  Sun,
  Moon,
  Radio,
} from "lucide-react";
import type { FieldSite } from "@/lib/field-sites";
import { artworkUrl, spriteUrl } from "@/lib/pokemon";
import type { SafariMode, SafariSnapshot } from "@/lib/safari";
import type { Expedition } from "@/lib/types";
import { createSafariWorld } from "./safari-world";
import "./safari-walk.css";

interface SafariWalkProps {
  expedition: Expedition;
  site: FieldSite;
  snapshot: SafariSnapshot;
  mode: SafariMode;
  onModeChange: (mode: SafariMode) => void;
  onObserve: (encounterId: string) => void;
  onExit: () => void;
  onReady?: () => void;
  onOpenRadar?: () => void;
  registeredIds: number[];
  detailOpen: boolean;
}

type WalkController = {
  setScene: (
    step: number,
    signals: SafariSnapshot["signals"],
    isDay: boolean,
  ) => void;
  turnBy: (delta: number) => void;
};

const MODES = [
  { value: "live", label: "En vivo", Icon: Radio },
  { value: "day", label: "Día", Icon: Sun },
  { value: "night", label: "Noche", Icon: Moon },
] as const;

export default function SafariWalk({
  expedition,
  site,
  snapshot,
  mode,
  onModeChange,
  onObserve,
  onExit,
  onReady,
  onOpenRadar,
  registeredIds,
  detailOpen,
}: SafariWalkProps) {
  const [index, setIndex] = useState(0);
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const step = Math.min(index, Math.max(0, snapshot.signals.length - 1));
  const signal = snapshot.signals[step];
  const exit = useRef<HTMLButtonElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const panorama = useRef<HTMLImageElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const controller = useRef<WalkController | null>(null);
  const readyCallback = useRef(onReady);
  const reportedReady = useRef(false);
  const pointer = useRef<{ id: number; x: number } | null>(null);

  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);

  function finishArrival() {
    if (
      reportedReady.current ||
      !controller.current ||
      !panorama.current?.complete
    )
      return;
    reportedReady.current = true;
    readyCallback.current?.();
  }

  useEffect(() => {
    exit.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const viewportElement = viewport.current;
    const mount = host.current;
    if (!viewportElement || !mount) return;
    const stage = viewportElement;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let start = 0;
    let from = 0;
    let current = 0;
    let target = 0;
    let turn = 0;
    let signals: SafariSnapshot["signals"] = [];

    const world = createSafariWorld(mount, expedition.id, setHasWebGL, () =>
      schedule(),
    );
    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function draw(time: number) {
      frame = 0;
      const progress =
        !start || motion.matches ? 1 : Math.min((time - start) / 780, 1);
      const ease = progress * progress * (3 - 2 * progress);
      current = from + (target - from) * ease;
      world.draw(current, turn, progress < 1);
      const offset = turn * -9 + Math.sin(current * 1.8) * -1.7;
      stage.style.setProperty("--walk-offset", `${offset}%`);
      stage.style.setProperty("--walk-scale", String(1.075 + current * 0.035));
      for (const [station, { encounter }] of signals.entries()) {
        const marker = markers.current.get(encounter.id);
        if (!marker) continue;
        const location = world.locate(encounter, station);
        marker.style.visibility = location ? "visible" : "hidden";
        if (!location) continue;
        marker.style.setProperty("--sighting-x", `${location.x}px`);
        marker.style.setProperty("--sighting-y", `${location.y}px`);
        marker.style.setProperty("--sighting-size", `${location.size}px`);
        marker.style.opacity = String(location.opacity);
      }
      if (progress < 1) schedule();
      finishArrival();
    }

    controller.current = {
      setScene(nextStep, nextSignals, isDay) {
        signals = nextSignals;
        world.light(isDay);
        if (nextStep !== target) {
          from = current;
          target = nextStep;
          turn = 0;
          start = performance.now();
        }
        schedule();
      },
      turnBy(delta) {
        turn = Math.max(-0.76, Math.min(0.76, turn + delta));
        schedule();
      },
    };

    function resize() {
      world.resize(stage.clientWidth, stage.clientHeight);
      schedule();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    const initialFrame = requestAnimationFrame(() => setHasWebGL(world.active));
    motion.addEventListener("change", schedule);
    resize();
    return () => {
      controller.current = null;
      observer.disconnect();
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(initialFrame);
      world.dispose();
    };
  }, [expedition.id]);

  useEffect(() => {
    controller.current?.setScene(step, snapshot.signals, snapshot.isDay);
  }, [step, snapshot.signals, snapshot.isDay]);

  function walk(direction: number) {
    setIndex(
      Math.max(0, Math.min(step + direction, snapshot.signals.length - 1)),
    );
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented
    )
      return;
    switch (event.key.toLowerCase()) {
      case "w":
      case "arrowup":
        event.preventDefault();
        walk(1);
        break;
      case "s":
      case "arrowdown":
        event.preventDefault();
        walk(-1);
        break;
      case "a":
      case "arrowleft":
        event.preventDefault();
        controller.current?.turnBy(-0.13);
        break;
      case "d":
      case "arrowright":
        event.preventDefault();
        controller.current?.turnBy(0.13);
        break;
      case "escape":
        event.preventDefault();
        onExit();
        break;
    }
  }

  function startLooking(event: PointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, x: event.clientX };
  }

  function lookAround(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    const delta = pointer.current.x - event.clientX;
    pointer.current.x = event.clientX;
    controller.current?.turnBy(
      (delta / event.currentTarget.clientWidth) * 1.15,
    );
  }

  function stopLooking(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  }

  return (
    <section
      className="safari-walk"
      aria-labelledby="safari-walk-title"
      data-night={!snapshot.isDay}
      inert={detailOpen}
      onKeyDown={handleKey}
    >
      <div
        className="safari-walk-viewport"
        ref={viewport}
        onPointerDown={startLooking}
        onPointerMove={lookAround}
        onPointerUp={stopLooking}
        onPointerCancel={stopLooking}
        onLostPointerCapture={stopLooking}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- The local WebP is the full-bleed scenery. */}
        <img
          ref={panorama}
          className="safari-walk-panorama"
          src={site.image}
          alt=""
          draggable={false}
          onLoad={finishArrival}
          onError={finishArrival}
        />
        <div className="safari-walk-world" ref={host} aria-hidden="true" />
        <div className="safari-walk-vignette" aria-hidden="true" />
        <div className="safari-walk-sightings">
          {snapshot.signals.map(({ encounter }, station) => (
            <button
              key={encounter.id}
              ref={(element) => {
                if (element) markers.current.set(encounter.id, element);
                else markers.current.delete(encounter.id);
              }}
              type="button"
              className="safari-walk-sighting"
              tabIndex={station === step ? 0 : -1}
              aria-label={`Observar a ${encounter.name}`}
              onClick={() => onObserve(encounter.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Keep transparency and fall back to the official sprite. */}
              <img
                src={artworkUrl(encounter.pokemonId)}
                alt=""
                draggable={false}
                onError={(event) => {
                  const image = event.currentTarget;
                  const fallback = spriteUrl(encounter.pokemonId);
                  if (image.src !== fallback) image.src = fallback;
                  else image.hidden = true;
                }}
              />
              <span>{encounter.name}</span>
            </button>
          ))}
        </div>
      </div>

      <header className="safari-walk-header">
        <div className="safari-walk-header-actions">
          <button
            ref={exit}
            type="button"
            className="safari-walk-glass"
            onClick={onExit}
            aria-label="Volver al mapa"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            <span className="safari-walk-map-label">Volver al mapa</span>
          </button>
          {onOpenRadar && (
            <button
              type="button"
              className="safari-walk-glass safari-walk-radar"
              onClick={onOpenRadar}
              aria-label="Ver radar en el mapa"
            >
              <Radar size={17} aria-hidden="true" /> <span>Radar</span>
            </button>
          )}
        </div>
        <div className="safari-walk-location">
          <p>
            <MapPin size={15} aria-hidden="true" /> {expedition.name}
          </p>
          <h2 id="safari-walk-title">Safari</h2>
          <div className="safari-walk-weather">
            <CloudSun size={14} aria-hidden="true" />
            {snapshot.source === "preview"
              ? snapshot.isDay
                ? "Día de prueba"
                : "Noche de prueba"
              : `${snapshot.timeLabel} · Hora local`}
            <span>{snapshot.weatherLabel}</span>
          </div>
        </div>
        <div
          className="safari-walk-modes"
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
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="safari-walk-footer">
        {hasWebGL === false && (
          <p className="safari-walk-instructions" role="status">
            Safari en vista panorámica
          </p>
        )}
        <div className="safari-walk-route">
          <div className="safari-walk-route-context">
            <span>{site.name}</span>
            {snapshot.signals.length > 0 && (
              <small>
                Avistamiento {step + 1} de {snapshot.signals.length}
              </small>
            )}
          </div>
          <div className="safari-walk-movement">
            <button
              className="safari-walk-glass"
              type="button"
              onClick={() => walk(-1)}
              disabled={step === 0}
            >
              <ArrowDown size={17} aria-hidden="true" /> Retroceder
            </button>
            <button
              className="safari-walk-glass"
              type="button"
              onClick={() => walk(1)}
              disabled={step >= snapshot.signals.length - 1}
            >
              <ArrowUp size={17} aria-hidden="true" /> Avanzar
            </button>
          </div>
        </div>
        {signal && (
          <button
            type="button"
            className="safari-walk-observe"
            onClick={() => onObserve(signal.encounter.id)}
            aria-label={`Ver ficha de ${signal.encounter.name}`}
          >
            <Binoculars size={20} aria-hidden="true" />
            <span>
              <strong aria-live="polite">{signal.encounter.name}</strong>
              <small>
                {registeredIds.includes(signal.encounter.pokemonId)
                  ? "Registrado en tu atlas"
                  : signal.reason}
              </small>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
