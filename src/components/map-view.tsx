"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  AttributionControl,
  setWorkerUrl,
  getVersion,
} from "maplibre-gl";
import { EXPEDITIONS } from "@/lib/expeditions";
import { spriteUrl, TYPE_COLORS } from "@/lib/pokemon";
import type { Encounter, Expedition, PokemonType } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

interface MapViewProps {
  expedition: Expedition;
  encounters: Encounter[];
  selectedId: string | null;
  registeredIds: number[];
  boostedTypes: PokemonType[];
  worldView: boolean;
  recenterKey?: number;
  onSelect: (encounter: Encounter) => void;
  onExpedition: (id: string) => void;
  onMapError: (message: string | null) => void;
}

function cameraPadding(container: HTMLElement, detailOpen: boolean) {
  if (window.matchMedia("(min-width: 900px)").matches) {
    return { top: 40, right: 75, bottom: 120, left: 420 };
  }
  if (window.matchMedia("(min-width: 650px) and (max-height: 550px)").matches) {
    return { top: 75, right: 58, bottom: 33, left: 320 };
  }
  const height = container.clientHeight;
  const viewportHeight = window.innerHeight;
  const sheetHeight = detailOpen
    ? Math.min(viewportHeight * 0.6, viewportHeight - 146)
    : Math.max(178, Math.min(viewportHeight * 0.38, 335));
  return {
    top: Math.min(155, height * 0.31),
    right: 63,
    bottom: Math.min(sheetHeight + 18, height * (detailOpen ? 0.71 : 0.52)),
    left: 40,
  };
}

function colorMap(map: MapLibreMap) {
  const colors: Record<
    string,
    ["background-color" | "fill-color" | "line-color", string]
  > = {
    background: ["background-color", "#e9ecdb"],
    park: ["fill-color", "#d3dfbe"],
    landuse_residential: ["fill-color", "#eeebdf"],
    landcover_wood: ["fill-color", "#c4d5b2"],
    landcover_grass: ["fill-color", "#dce4c9"],
    landcover_ice: ["fill-color", "#edf3ee"],
    landcover_wetland: ["fill-color", "#c8d9c5"],
    landcover_sand: ["fill-color", "#e8dfc5"],
    water: ["fill-color", "#a9cdd1"],
    building: ["fill-color", "#d4d2c5"],
    waterway_river: ["line-color", "#a9cdd1"],
    waterway_other: ["line-color", "#a9cdd1"],
  };

  for (const [id, [property, color]] of Object.entries(colors)) {
    if (map.getLayer(id)) map.setPaintProperty(id, property, color);
  }

  // Keep geographic labels, while removing noisy business and transit overlays.
  for (const layer of map.getStyle().layers) {
    if (
      layer.id.startsWith("poi_") ||
      layer.id.includes("shield") ||
      layer.id === "building-3d"
    ) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      map.setPaintProperty(layer.id, "text-color", "#617361");
      map.setPaintProperty(layer.id, "text-halo-color", "#f5f4e9");
    }
  }
}

function createPokemonElement(encounter: Encounter, select: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pokemon-marker";
  button.dataset.encounterId = encounter.id;
  button.setAttribute("aria-label", `Ver ${encounter.name}`);

  const inner = document.createElement("span");
  inner.className = "marker-inner";
  const image = document.createElement("img");
  image.className = "marker-sprite";
  image.src = spriteUrl(encounter.pokemonId);
  image.alt = "";
  image.width = 80;
  image.height = 80;
  image.draggable = false;
  image.addEventListener(
    "error",
    () => {
      const fallback = document.createElement("span");
      fallback.className = "marker-fallback";
      fallback.textContent = encounter.name.slice(0, 2);
      image.replaceWith(fallback);
    },
    { once: true },
  );

  const dot = document.createElement("span");
  dot.className = "marker-type-dot";
  dot.style.backgroundColor = TYPE_COLORS[encounter.types[0]];
  const status = document.createElement("span");
  status.className = "marker-registration";
  status.setAttribute("aria-hidden", "true");
  status.textContent = "✓";
  const activity = document.createElement("span");
  activity.className = "marker-activity";
  activity.setAttribute("aria-hidden", "true");
  activity.textContent = "+";
  inner.append(image, dot, status, activity);

  const label = document.createElement("span");
  label.className = "marker-label";
  label.textContent = encounter.name;
  button.append(inner, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    select();
  });
  return button;
}

export default function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const latest = useRef(props);
  const lastRecenterKey = useRef(props.recenterKey);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    latest.current = props;
  }, [props]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let disposed = false;
    let map: MapLibreMap;
    const reportFailure = () => {
      if (disposed) return;
      setError(true);
      latest.current.onMapError(
        "La cartografía no está disponible. Podés seguir investigando desde la lista.",
      );
    };

    try {
      // Resolve the module worker from the same origin in both dev and Turbopack builds.
      setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`);
      map = new MapLibreMap({
        container: element,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: latest.current.expedition.coordinates,
        zoom: latest.current.expedition.zoom,
        minZoom: 0,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: false,
        pitch: 0,
        locale: {
          "NavigationControl.ZoomIn": "Acercar mapa",
          "NavigationControl.ZoomOut": "Alejar mapa",
          "NavigationControl.ResetBearing": "Orientar hacia el norte",
          "AttributionControl.ToggleAttribution":
            "Mostrar atribuciones del mapa",
        },
      });
    } catch {
      reportFailure();
      return;
    }

    mapRef.current = map;
    map
      .getCanvas()
      .setAttribute(
        "aria-label",
        "Mapa de avistamientos Pokémon. También podés explorar con la lista de especies.",
      );
    map.addControl(new NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const loadingTimeout = window.setTimeout(reportFailure, 18000);
    map.once("load", () => {
      if (disposed) return;
      window.clearTimeout(loadingTimeout);
      colorMap(map);
      setReady(true);
      setError(false);
      latest.current.onMapError(null);
    });
    map.on("error", reportFailure);
    map.on("webglcontextlost", reportFailure);
    map.on("idle", () => {
      if (!disposed && map.isStyleLoaded() && map.areTilesLoaded()) {
        setError(false);
        latest.current.onMapError(null);
      }
    });

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(element);

    return () => {
      disposed = true;
      window.clearTimeout(loadingTimeout);
      observer.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (props.worldView) {
      markers.current = EXPEDITIONS.map((expedition) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "expedition-marker";
        button.setAttribute(
          "aria-label",
          `Explorar ${expedition.name}, ${expedition.country}`,
        );
        const title = document.createElement("strong");
        title.textContent = expedition.name;
        const country = document.createElement("span");
        country.textContent = expedition.country;
        button.append(title, country);
        button.style.setProperty("--expedition-color", expedition.color);
        button.addEventListener("click", () =>
          latest.current.onExpedition(expedition.id),
        );
        return new Marker({ element: button, anchor: "bottom" })
          .setLngLat(expedition.coordinates)
          .addTo(map);
      });
    } else {
      markers.current = props.encounters.map((encounter) => {
        const button = createPokemonElement(encounter, () =>
          latest.current.onSelect(encounter),
        );
        return new Marker({ element: button, anchor: "bottom" })
          .setLngLat(encounter.coordinates)
          .addTo(map);
      });
    }
  }, [ready, attempt, props.worldView, props.encounters]);

  useEffect(() => {
    const registered = new Set(props.registeredIds);
    const boosted = new Set(props.boostedTypes);
    for (const marker of markers.current) {
      const element = marker.getElement();
      const encounter = props.encounters.find(
        (item) => item.id === element.dataset.encounterId,
      );
      if (!encounter) continue;
      const selected = props.selectedId === encounter.id;
      const isRegistered = registered.has(encounter.pokemonId);
      const isBoosted = encounter.types.some((type) => boosted.has(type));
      element.classList.toggle("is-selected", selected);
      element.classList.toggle("is-registered", isRegistered);
      element.classList.toggle("is-boosted", isBoosted);
      element.setAttribute("aria-pressed", String(selected));
      element.setAttribute(
        "aria-label",
        `Ver ${encounter.name}${isRegistered ? ", registrado" : ""}${isBoosted ? ", favorecido por el clima" : ""}`,
      );
    }
  }, [
    ready,
    attempt,
    props.selectedId,
    props.encounters,
    props.registeredIds,
    props.boostedTypes,
    props.worldView,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const element = container.current;
    if (!ready || !map || !element) return;

    const padding = cameraPadding(element, Boolean(props.selectedId));
    map.stop();
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    if (props.worldView) {
      map.fitBounds(
        [
          [-30, -36],
          [156, 66],
        ],
        {
          padding,
          duration: reducedMotion ? 0 : 1400,
          maxZoom: 2.5,
        },
      );
      return;
    }

    const recenterRequested = lastRecenterKey.current !== props.recenterKey;
    lastRecenterKey.current = props.recenterKey;
    const selected = recenterRequested
      ? undefined
      : props.expedition.encounters.find(
          (encounter) => encounter.id === props.selectedId,
        );
    if (!selected) {
      const longitudes = props.expedition.encounters.map(
        (item) => item.coordinates[0],
      );
      const latitudes = props.expedition.encounters.map(
        (item) => item.coordinates[1],
      );
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        {
          padding,
          maxZoom: props.expedition.zoom,
          duration: reducedMotion ? 0 : 1400,
        },
      );
      return;
    }
    map.flyTo({
      center: selected.coordinates,
      zoom: Math.max(props.expedition.zoom + 0.5, 13),
      padding,
      duration: reducedMotion ? 0 : 650,
      essential: false,
    });
  }, [
    ready,
    attempt,
    props.expedition,
    props.selectedId,
    props.worldView,
    props.recenterKey,
    reducedMotion,
  ]);

  return (
    <div className="map-surface">
      <div ref={container} className="map-canvas" />
      {!ready && !error && (
        <div className="map-loading" role="status">
          <span className="map-loading-ring" />
          <span>Preparando tu expedición…</span>
        </div>
      )}
      {error && (
        <div className="map-retry" role="status">
          <span>No pudimos cargar parte del mapa.</span>
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar mapa
          </button>
        </div>
      )}
    </div>
  );
}
