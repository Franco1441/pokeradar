"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
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
import type { SafariMode, SafariSignal, SafariSnapshot } from "@/lib/safari";
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
  setScene: (zones: SafariSnapshot["zones"], isDay: boolean) => void;
  travelTo: (zone: number) => void;
  turnBy: (delta: number) => void;
};

const MODES = [
  { value: "live", label: "En vivo", Icon: Radio },
  { value: "day", label: "Día", Icon: Sun },
  { value: "night", label: "Noche", Icon: Moon },
] as const;

const TURN_PER_VIEWPORT = Math.PI * 0.68;
const KEY_TURN = 0.12;
const INITIAL_HEADING = -0.16;
const COVER_MS = 240;
const REVEAL_MS = 300;

function loadPanorama(source: string) {
  const image = new Image();
  image.src = source;
  return image.decode().then(() => image);
}

function SafariSighting({
  signal,
  markers,
  onObserve,
}: {
  signal: SafariSignal;
  markers: Map<string, HTMLButtonElement>;
  onObserve: (encounterId: string) => void;
}) {
  const { encounter } = signal;
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return (
    <motion.button
      ref={(element) => {
        if (element) markers.set(encounter.id, element);
        else markers.delete(encounter.id);
      }}
      type="button"
      className="safari-walk-sighting"
      aria-label={`Observar a ${encounter.name}`}
      aria-hidden={!present}
      disabled={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : present ? 0.38 : 0.27 }}
      onClick={() => onObserve(encounter.id)}
    >
      <span className="safari-walk-sighting-content">
        {/* eslint-disable-next-line @next/next/no-img-element -- Preserve transparent artwork and its sprite fallback. */}
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
        <span className="safari-walk-sighting-label">{encounter.name}</span>
      </span>
    </motion.button>
  );
}

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
  const [markers] = useState(() => new Map<string, HTMLButtonElement>());
  const controller = useRef<WalkController | null>(null);
  const readyCallback = useRef(onReady);
  const reportedReady = useRef(false);
  const pointer = useRef<{ id: number; x: number } | null>(null);

  useEffect(() => {
    readyCallback.current = onReady;
  }, [onReady]);

  useEffect(() => {
    exit.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const viewportElement = viewport.current;
    const mount = host.current;
    const imageElement = panorama.current;
    if (!viewportElement || !mount || !imageElement) return;
    const stage = viewportElement;
    const backdrop = imageElement;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let displayedZone: number | undefined;
    let requestedZone: number | undefined;
    let request = 0;
    let disposed = false;
    let turn = INITIAL_HEADING;
    let targetTurn = turn;
    let lastFrame = 0;
    let zones: SafariSnapshot["zones"] = [];
    type ZoneImage = { zone: number; image: HTMLImageElement | null };
    let pending: ZoneImage | null = null;
    let travel: {
      destination: ZoneImage;
      phase: "cover" | "swap" | "reveal";
      start: number;
    } | null = null;
    const panoramas = new Map<string, Promise<HTMLImageElement>>();

    const world = createSafariWorld(
      mount,
      expedition.id,
      setHasWebGL,
      schedule,
    );
    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function getPanorama(source: string) {
      const cached = panoramas.get(source);
      if (cached) return cached;
      const loading = loadPanorama(source).catch((error: unknown) => {
        panoramas.delete(source);
        throw error;
      });
      panoramas.set(source, loading);
      return loading;
    }

    function showPanorama({ zone: nextZone, image }: ZoneImage) {
      displayedZone = nextZone;
      if (image) {
        backdrop.src = image.src;
        world.setPanorama(image);
      }
      flushSync(() => setZoneIndex(nextZone));
    }

    function travelTo(nextZone: number) {
      const next = zones[nextZone];
      if (!next || requestedZone === nextZone) return;
      requestedZone = nextZone;
      pending = null;
      const sequence = ++request;
      if (nextZone === displayedZone && travel?.phase !== "reveal") return;

      for (const { encounter } of next.signals) {
        const artwork = new Image();
        artwork.src = artworkUrl(encounter.pokemonId);
      }
      void getPanorama(next.image)
        .catch(() => getPanorama(site.image))
        .catch(() => null)
        .then((image) => {
          if (disposed || sequence !== request) return;
          pending = { zone: nextZone, image };
          schedule();
        });
    }

    function advanceTravel(time: number) {
      if (!travel) {
        const destination = pending;
        pending = null;
        if (!destination || destination.zone === displayedZone) return 0;
        if (displayedZone === undefined || motion.matches) {
          showPanorama(destination);
          return 0;
        }
        if (destination.image) world.preparePanorama(destination.image);
        // Give the upload its own frame while the outgoing scene is still visible.
        travel = { destination, phase: "cover", start: performance.now() };
        return 0;
      }

      if (travel.phase === "cover") {
        const progress = motion.matches ? 1 : Math.min((time - travel.start) / COVER_MS, 1);
        if (progress === 1) travel.phase = "swap";
        return progress * progress * (3 - 2 * progress);
      }

      if (travel.phase === "swap") {
        // The previous frame fully covered both the landscape and its Pokémon.
        const destination = pending ?? travel.destination;
        if (destination.zone === requestedZone && destination.zone !== displayedZone) {
          showPanorama(destination);
          pending = null;
        }
        travel.phase = "reveal";
        travel.start = performance.now();
        return 1;
      }

      const progress = motion.matches ? 1 : Math.min((time - travel.start) / REVEAL_MS, 1);
      if (progress === 1) travel = null;
      return 1 - progress * progress * (3 - 2 * progress);
    }

    function draw(time: number) {
      frame = 0;
      const elapsed = Math.min(40, Math.max(8, time - lastFrame));
      lastFrame = time;
      const rotationPending = Math.abs(targetTurn - turn) > 0.0008;
      turn = motion.matches || !rotationPending
        ? targetTurn
        : turn + (targetTurn - turn) * (1 - Math.exp(-elapsed / 57));

      const veil = advanceTravel(time);
      const current = displayedZone ?? 0;
      world.draw(current, turn);
      const background = safariPanorama(world.heading);
      stage.parentElement?.style.setProperty("--safari-heading", `${world.heading}rad`);
      stage.style.setProperty("--walk-offset-x", `${background.x}%`);
      stage.style.setProperty("--walk-offset-y", `${background.y}%`);
      stage.style.setProperty("--walk-scale", String(background.scale));
      stage.style.setProperty("--walk-veil", String(veil));
      for (const { encounter, slot } of zones[current]?.signals ?? []) {
        const marker = markers.get(encounter.id);
        if (!marker) continue;
        const location = world.locate(encounter, current, slot, current);
        marker.style.visibility = location ? "visible" : "hidden";
        if (!location) continue;
        marker.style.setProperty("--sighting-x", `${location.x}px`);
        marker.style.setProperty("--sighting-y", `${location.y}px`);
        marker.style.setProperty("--sighting-size", `${location.size}px`);
        marker.style.setProperty("--sighting-presence", String(location.opacity));
      }
      if (!reportedReady.current && displayedZone !== undefined) {
        reportedReady.current = true;
        readyCallback.current?.();
      }
      if (travel || pending || rotationPending) schedule();
    }

    controller.current = {
      setScene(nextZones, isDay) {
        zones = nextZones;
        world.light(isDay);
        if (requestedZone === undefined) travelTo(0);
        schedule();
      },
      travelTo,
      turnBy(delta) {
        targetTurn += delta;
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
      disposed = true;
      controller.current = null;
      observer.disconnect();
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(initialFrame);
      world.dispose();
    };
  }, [expedition.id, markers, site.image]);

  useEffect(() => {
    controller.current?.setScene(snapshot.zones, snapshot.isDay);
  }, [snapshot.zones, snapshot.isDay]);

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
        controller.current?.turnBy(-KEY_TURN);
        break;
      case "d":
      case "arrowright":
        event.preventDefault();
        controller.current?.turnBy(KEY_TURN);
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
      (delta / event.currentTarget.clientWidth) * TURN_PER_VIEWPORT,
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
        tabIndex={0}
        aria-label="Vista de Safari. Arrastrá o usá las flechas para girar."
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
          alt=""
          draggable={false}
        />
        <div className="safari-walk-world" ref={host} aria-hidden="true" />
        <div className="safari-walk-vignette" aria-hidden="true" />
        <div className="safari-walk-sightings">
          <AnimatePresence key={zone.id} initial={false}>
            {zone.signals.map((signal) => (
              <SafariSighting
                key={signal.encounter.id}
                signal={signal}
                markers={markers}
                onObserve={onObserve}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="safari-walk-travel-veil" aria-hidden="true" />
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
            {hasWebGL === false ? "Vista panorámica · " : ""}Arrastrá para girar 360°.
          </p>
        </section>
        <SafariFieldRadar
          expedition={expedition}
          zones={snapshot.zones}
          nextRefreshAt={snapshot.nextRefreshAt}
          activeZone={zoneIndex}
          registeredIds={registeredIds}
          onTravel={(nextZone) => controller.current?.travelTo(nextZone)}
          onOpenRadar={onOpenRadar}
        />
      </div>
    </section>
  );
}
