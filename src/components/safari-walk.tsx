"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CloudSun,
  MapPin,
  Sun,
  Moon,
  Radio,
} from "lucide-react";
import type { FieldSite } from "@/lib/field-sites";
import { artworkUrl, spriteUrl } from "@/lib/pokemon";
import type { SafariMode, SafariSnapshot } from "@/lib/safari";
import type { Expedition } from "@/lib/types";
import SafariFieldRadar from "./safari-field-radar";
import { createSafariWorld, safariPanorama } from "./safari-world";
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
    zone: number,
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
  const [zoneIndex, setZoneIndex] = useState(0);
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const zone = snapshot.zones[zoneIndex];
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
      const duration = 580 + Math.abs(target - from) * 85;
      const progress = !start || motion.matches ? 1 : Math.min((time - start) / duration, 1);
      const ease = progress * progress * (3 - 2 * progress);
      current = from + (target - from) * ease;
      world.draw(current, turn, progress < 1);
      const background = safariPanorama(current, turn);
      stage.style.setProperty("--walk-offset-x", `${background.x}%`);
      stage.style.setProperty("--walk-offset-y", `${background.y}%`);
      stage.style.setProperty("--walk-scale", String(background.scale));
      for (const [slot, { encounter }] of signals.entries()) {
        const marker = markers.current.get(encounter.id);
        if (!marker) continue;
        const location = world.locate(encounter, target, slot, target);
        marker.style.visibility = location ? "visible" : "hidden";
        if (!location) continue;
        marker.style.setProperty("--sighting-x", `${location.x}px`);
        marker.style.setProperty("--sighting-y", `${location.y}px`);
        marker.style.setProperty("--sighting-size", `${location.size}px`);
        marker.style.opacity = String(location.opacity * Math.max(0, (progress - 0.5) * 2));
      }
      if (progress < 1) schedule();
      finishArrival();
    }

    controller.current = {
      setScene(nextZone, nextSignals, isDay) {
        signals = nextSignals;
        world.light(isDay);
        if (nextZone !== target) {
          from = current;
          target = nextZone;
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
    controller.current?.setScene(zoneIndex, zone.signals, snapshot.isDay);
  }, [zoneIndex, zone.signals, snapshot.isDay]);

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented
    )
      return;
    switch (event.key.toLowerCase()) {
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
      data-active-zone={zone.id}
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
          {zone.signals.map(({ encounter }) => (
            <button
              key={encounter.id}
              ref={(element) => {
                if (element) markers.current.set(encounter.id, element);
                else markers.current.delete(encounter.id);
              }}
              type="button"
              className="safari-walk-sighting"
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
        <section className="safari-walk-local" aria-label="Avistamientos de la zona actual">
          <h3><MapPin size={16} aria-hidden="true" /> {zone.name}</h3>
          <div className="safari-walk-local-signals">
            {zone.signals.map(({ encounter }) => (
              <button
                key={encounter.id}
                type="button"
                className="safari-walk-observe"
                onClick={() => onObserve(encounter.id)}
                aria-label={`Ver ficha de ${encounter.name}`}
              >
                <span className="safari-walk-signal-key" data-unregistered={!registeredIds.includes(encounter.pokemonId)} />
                {encounter.name}
                <ArrowUpRight size={13} aria-hidden="true" />
              </button>
            ))}
            {zone.signals.length === 0 && <span>Sin señales por ahora.</span>}
          </div>
          <p className="safari-walk-instructions">
            {hasWebGL === false ? "Vista panorámica · " : ""}Arrastrá para mirar alrededor.
          </p>
        </section>
        <SafariFieldRadar
          expedition={expedition}
          zones={snapshot.zones}
          activeZone={zoneIndex}
          registeredIds={registeredIds}
          onTravel={setZoneIndex}
          onOpenRadar={onOpenRadar}
        />
      </div>
    </section>
  );
}
