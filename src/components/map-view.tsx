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
import { getFieldSite, type FieldSite } from "@/lib/field-sites";
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
  safariPeriod?: "day" | "night";
  recenterKey?: number;
  focusedDestinationId?: string;
  landingSite?: FieldSite;
  landingDuration?: number;
  onSelect: (encounter: Encounter) => void;
  onExpedition: (id: string) => void;
  onEnterField?: () => void;
  onMapError: (message: string | null) => void;
}

function cameraPadding(
  container: HTMLElement,
  detailOpen: boolean,
  safariOpen: boolean,
) {
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
    : safariOpen
      ? Math.max(220, Math.min(viewportHeight * 0.44, 370))
      : Math.max(178, Math.min(viewportHeight * 0.38, 335));
  return {
    top: Math.min(155, height * 0.31),
    right: 63,
    bottom: Math.min(sheetHeight + 18, height * (detailOpen ? 0.71 : 0.52)),
    left: 40,
  };
}

function globeCamera(
  container: HTMLElement,
  expedition: Expedition,
  centered = false,
) {
  const [longitude, latitude] =
    expedition.id === "nikko" && !centered ? [104, 25] : expedition.coordinates;
  const center: [number, number] = [longitude, Math.min(latitude, 45)];
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  const landscape = window.matchMedia(
    "(min-width: 650px) and (max-height: 550px)",
  ).matches;
  const padding = desktop
    ? { left: 350, right: 42, top: 30, bottom: 65 }
    : landscape
      ? { left: 300, right: 32, top: 12, bottom: 24 }
      : {
          left: 14,
          right: 14,
          top: 20,
          bottom: Math.min(265, container.clientHeight * 0.43),
        };
  const available = Math.min(
    container.clientWidth - padding.left - padding.right,
    container.clientHeight - padding.top - padding.bottom,
  );
  const baseDiameter = 512 / Math.PI / Math.cos((center[1] * Math.PI) / 180);
  const zoom = Math.min(
    2.2,
    Math.max(0, Math.log2((available * 0.9) / baseDiameter)),
  );
  return { center, zoom, padding, pitch: 0, bearing: 0 };
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
    building: ["fill-color", "#d4d2c5"],
    waterway_river: ["line-color", "#a9cdd1"],
    waterway_other: ["line-color", "#a9cdd1"],
  };

  for (const [id, [property, color]] of Object.entries(colors)) {
    if (map.getLayer(id)) map.setPaintProperty(id, property, color);
  }
  if (map.getLayer("water")) {
    map.setPaintProperty("water", "fill-color", [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      "#66948d",
      7,
      "#a9cdd1",
    ]);
  }
  const globeLabelMinZoom = new Map([
    ["water_name_point_label", 3],
    ["water_name_line_label", 3],
    ["label_country_3", 3.4],
    ["label_country_2", 2.2],
  ]);

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
      map.setPaintProperty(layer.id, "text-color", "#4c6253");
      map.setPaintProperty(layer.id, "text-halo-color", "#f5f4e9");
      const minZoom = globeLabelMinZoom.get(layer.id);
      if (minZoom !== undefined) {
        map.setLayerZoomRange(layer.id, minZoom, layer.maxzoom ?? 24);
      }
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

function createTrailheadMarker(site: FieldSite, onEnter: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "trailhead-marker";
  button.setAttribute("aria-label", `${site.action}: ${site.name}`);
  button.style.setProperty("--site-accent", site.accent);

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const trail = document.createElementNS("http://www.w3.org/2000/svg", "path");
  trail.setAttribute("d", "M4 19l5-8 3 4 3-7 5 11M4 19h16M7 6h4m-2-2v4");
  icon.append(trail);
  const label = document.createElement("span");
  label.textContent = site.name;
  button.append(icon, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onEnter();
  });
  return new Marker({ element: button, anchor: "bottom" }).setLngLat(
    site.coordinates,
  );
}

export default function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const latest = useRef(props);
  const lastRecenterKey = useRef(props.recenterKey);
  const previousWorldView = useRef(props.worldView);
  const previousFocusedDestinationId = useRef(props.focusedDestinationId);
  const activeLanding = useRef<{ map: MapLibreMap; site: FieldSite } | null>(
    null,
  );
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

    const attachedMarkers = markers.current;
    let disposed = false;
    let blockingError = false;
    let contextLost = false;
    let tileReceived = false;
    let tileError = false;
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
      const { expedition, worldView } = latest.current;
      map = new MapLibreMap({
        container: element,
        style: "https://tiles.openfreemap.org/styles/liberty",
        transformStyle: (_, style) => ({
          ...style,
          projection: { type: "globe" },
          sky: {
            "sky-color": "transparent",
            "horizon-color": "transparent",
            "fog-color": "transparent",
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              0.8,
              5,
              0,
            ],
          },
        }),
        ...(worldView
          ? globeCamera(element, expedition)
          : { center: expedition.coordinates, zoom: expedition.zoom }),
        minZoom: 0,
        maxZoom: 18,
        attributionControl: false,
        renderWorldCopies: false,
        maxPitch: 55,
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
    map.addControl(new NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    function updateMapStatus() {
      if (disposed || blockingError || contextLost) return;
      if (tileError && !tileReceived) {
        reportFailure();
      } else {
        setError(false);
        latest.current.onMapError(null);
      }
    }

    const loadingTimeout = window.setTimeout(reportFailure, 18000);
    map.once("load", () => {
      if (disposed) return;
      window.clearTimeout(loadingTimeout);
      colorMap(map);
      setReady(true);
      updateMapStatus();
    });
    map.on("sourcedata", (event) => {
      if (event.tile) tileReceived = true;
    });
    map.on("error", (event) => {
      // MapLibre attaches the individual tile to tile-loading errors.
      // Wait for the initial batch to settle before reporting a failed map.
      if ("tile" in event) {
        tileError = true;
        return;
      }
      blockingError = true;
      reportFailure();
    });
    map.on("webglcontextlost", () => {
      contextLost = true;
      tileReceived = false;
      tileError = false;
      reportFailure();
    });
    map.on("webglcontextrestored", () => {
      contextLost = false;
    });
    map.on("idle", () => {
      if (!disposed && map.isStyleLoaded() && map.areTilesLoaded()) {
        updateMapStatus();
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
      attachedMarkers.forEach((marker) => marker.remove());
      attachedMarkers.clear();
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  const safariOpen = Boolean(props.safariPeriod);
  const fieldSite = props.onEnterField
    ? getFieldSite(props.expedition.id)
    : undefined;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const attachedMarkers = markers.current;
    const nextKeys = new Set<string>();

    const retainMarker = (key: string, create: () => Marker) => {
      nextKeys.add(key);
      if (!attachedMarkers.has(key)) {
        attachedMarkers.set(key, create().addTo(map));
      }
    };

    if (props.worldView) {
      for (const expedition of EXPEDITIONS) {
        retainMarker(`world:${expedition.id}`, () => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "expedition-marker";
          button.dataset.expeditionId = expedition.id;
          button.setAttribute(
            "aria-label",
            `Explorar ${expedition.name}, ${expedition.country}`,
          );
          const title = document.createElement("strong");
          title.textContent = expedition.country;
          const country = document.createElement("span");
          country.textContent = expedition.name;
          button.append(title, country);
          button.style.setProperty("--expedition-color", expedition.color);
          button.addEventListener("click", () =>
            latest.current.onExpedition(expedition.id),
          );
          return new Marker({ element: button, anchor: "bottom" }).setLngLat(
            expedition.coordinates,
          );
        });
      }
    } else {
      for (const encounter of props.encounters) {
        retainMarker(`encounter:${encounter.id}`, () => {
          const button = createPokemonElement(encounter, () => {
            const current = latest.current.encounters.find(
              ({ id }) => id === encounter.id,
            );
            if (current) latest.current.onSelect(current);
          });
          if (safariOpen) button.classList.add("safari-signal-enter");
          return new Marker({ element: button, anchor: "bottom" }).setLngLat(
            encounter.coordinates,
          );
        });
      }
      if (fieldSite) {
        retainMarker(`trailhead:${props.expedition.id}`, () =>
          createTrailheadMarker(fieldSite, () =>
            latest.current.onEnterField?.(),
          ),
        );
      }
    }

    // Preserve attached elements for surviving signals so focus and loaded sprites stay in place.
    for (const [key, marker] of attachedMarkers) {
      if (!nextKeys.has(key)) {
        marker.remove();
        attachedMarkers.delete(key);
      }
    }
  }, [
    ready,
    attempt,
    props.worldView,
    props.encounters,
    props.expedition.id,
    fieldSite,
    safariOpen,
  ]);

  useEffect(() => {
    const registered = new Set(props.registeredIds);
    const boosted = new Set(props.boostedTypes);
    for (const marker of markers.current.values()) {
      const element = marker.getElement();
      if (element.dataset.expeditionId) {
        const focused =
          element.dataset.expeditionId === props.focusedDestinationId;
        element.classList.toggle("is-focused", focused);
        element.setAttribute("aria-pressed", String(focused));
        continue;
      }
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
    props.focusedDestinationId,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const element = container.current;
    if (!ready || !map || !element) return;

    if (props.landingSite) {
      if (
        activeLanding.current?.map === map &&
        activeLanding.current.site === props.landingSite
      )
        return;

      activeLanding.current = { map, site: props.landingSite };
      map.stop();
      map.flyTo({
        center: props.landingSite.coordinates,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        zoom: props.worldView ? 13.6 : 16.4,
        pitch: reducedMotion ? 0 : 32,
        bearing: reducedMotion ? 0 : -10,
        curve: 1.55,
        duration: reducedMotion ? 0 : (props.landingDuration ?? 1300),
        easing: (t) => t * t * (3 - 2 * t),
      });
      return;
    }
    activeLanding.current = null;

    const arrivingFromGlobe = previousWorldView.current && !props.worldView;
    const focusingDestination =
      previousWorldView.current &&
      previousFocusedDestinationId.current !== props.focusedDestinationId;
    previousWorldView.current = props.worldView;
    previousFocusedDestinationId.current = props.focusedDestinationId;
    map
      .getCanvas()
      .setAttribute(
        "aria-label",
        props.worldView
          ? "Globo interactivo de expediciones Pokémon. Podés usar las flechas para girar."
          : "Mapa de avistamientos Pokémon. También podés explorar con la lista de especies.",
      );
    const padding = cameraPadding(
      element,
      Boolean(props.selectedId),
      safariOpen,
    );
    map.stop();
    if (props.worldView) {
      const destination = EXPEDITIONS.find(
        ({ id }) => id === props.focusedDestinationId,
      );
      const camera = globeCamera(
        element,
        destination ?? props.expedition,
        Boolean(destination),
      );
      if (focusingDestination) {
        map.easeTo({ ...camera, duration: reducedMotion ? 0 : 620 });
      } else {
        map.flyTo({ ...camera, duration: reducedMotion ? 0 : 1450 });
      }
      return;
    }
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });

    const recenterRequested = lastRecenterKey.current !== props.recenterKey;
    lastRecenterKey.current = props.recenterKey;
    const selected = recenterRequested
      ? undefined
      : props.expedition.encounters.find(
          (encounter) => encounter.id === props.selectedId,
        );
    if (!selected) {
      const coordinates = props.expedition.encounters.map(
        (item) => item.coordinates,
      );
      if (fieldSite) coordinates.push(fieldSite.coordinates);
      const longitudes = coordinates.map(([longitude]) => longitude);
      const latitudes = coordinates.map(([, latitude]) => latitude);
      map.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        {
          padding,
          maxZoom: props.expedition.zoom,
          duration: reducedMotion ? 0 : arrivingFromGlobe ? 2150 : 1400,
          pitch: arrivingFromGlobe && !reducedMotion ? 16 : 0,
          bearing: 0,
        },
      );
      return;
    }
    map.flyTo({
      center: selected.coordinates,
      zoom: Math.max(props.expedition.zoom + 0.5, 13),
      padding,
      pitch: 0,
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
    props.focusedDestinationId,
    props.landingSite,
    props.landingDuration,
    fieldSite,
    reducedMotion,
    safariOpen,
  ]);

  return (
    <div
      className={`map-surface${props.worldView ? " is-globe" : ""}${props.landingSite ? " is-descending" : ""}${props.safariPeriod ? ` is-safari is-safari-${props.safariPeriod}` : ""}`}
    >
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
