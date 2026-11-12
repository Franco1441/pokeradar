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
  type MapEventType,
} from "maplibre-gl";
import { EXPEDITIONS } from "@/lib/expeditions";
import { getFieldSite, type FieldSite } from "@/lib/field-sites";
import { spriteUrl, TYPE_COLORS } from "@/lib/pokemon";
import type { Encounter, Expedition, PokemonType } from "@/lib/types";
import { mountGlobeLighting, solarBoundaryCenter } from "./map-lighting";
import {
  EARTH_SURFACE_FADE_END,
  loadEarthTextures,
  mountPhotographicGlobe,
} from "./earth-surface";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

interface MapViewProps {
  expedition: Expedition;
  encounters: Encounter[];
  selectedId: string | null;
  confirmationRequest?: { encounterId: string; sequence: number };
  registeredIds: number[];
  boostedTypes: PokemonType[];
  worldView: boolean;
  safariPeriod?: "day" | "night";
  recenterKey?: number;
  solarFocusKey?: number;
  focusedDestinationId?: string;
  landingSite?: FieldSite;
  landingDuration?: number;
  onSelect: (encounter: Encounter) => void;
  onExpedition: (id: string) => void;
  onEnterField?: () => void;
  onMapError: (message: string | null) => void;
}

function visiblePanel(container: HTMLElement, detailOpen: boolean) {
  const detail = detailOpen
    ? document.querySelector<HTMLElement>(
        ".detail-dialog:not(.detail-dialog-field)",
      )
    : null;
  return (
    detail ??
    container
      .closest(".map-stage")
      ?.querySelector<HTMLElement>("#expedition-panel")
  );
}

function cameraPadding(
  container: HTMLElement,
  panel?: HTMLElement | null,
  globe = false,
) {
  const canvas = container.getBoundingClientRect();
  const bounds = panel?.getBoundingClientRect();
  const width = canvas.width;
  const height = canvas.height;
  let left = Math.min(globe ? 15 : 38, width * 0.1);
  const right = Math.min(globe ? 26 : 72, width * 0.17);
  let bottom = Math.min(globe ? 48 : 112, height * 0.13);
  let top = Math.min(globe ? 25 : 40, height * 0.12);

  if (bounds && bounds.width && bounds.height) {
    if (bounds.width >= width * 0.65) {
      // Leave enough room for the map even when the user expands the sheet.
      bottom = Math.min(
        Math.max(bottom, canvas.bottom - bounds.top + 12),
        height * 0.93,
      );
      top = Math.min(globe ? 20 : 78, Math.max(0, height - bottom - 112));
    } else {
      const maxLeft = width - right - Math.min(145, width * 0.35);
      left = Math.min(Math.max(left, bounds.right - canvas.left + 18), maxLeft);
    }
  }

  return { top, right, bottom, left };
}

function observePanelPadding(
  map: MapLibreMap,
  container: HTMLElement,
  panel: HTMLElement | null | undefined,
  initial: ReturnType<typeof cameraPadding>,
) {
  let padding = initial;
  const updatePadding = () => {
    if (map.isMoving()) return;
    const next = cameraPadding(container, panel);
    if (
      Math.abs(next.top - padding.top) < 1 &&
      Math.abs(next.right - padding.right) < 1 &&
      Math.abs(next.bottom - padding.bottom) < 1 &&
      Math.abs(next.left - padding.left) < 1
    )
      return;
    padding = next;
    map.setPadding(padding);
  };
  const observer = new ResizeObserver(updatePadding);
  observer.observe(container);
  if (panel) observer.observe(panel);
  map.on("moveend", updatePadding);
  return () => {
    observer.disconnect();
    map.off("moveend", updatePadding);
  };
}

function globeViewport(container: HTMLElement) {
  const padding = cameraPadding(container, visiblePanel(container, false), true);
  const available = Math.min(
    container.clientWidth - padding.left - padding.right,
    container.clientHeight - padding.top - padding.bottom,
  );
  return { padding, available };
}

function globeMinimumZoom(available: number) {
  const zoom = Math.log2((available * 0.68 * Math.PI) / 512);
  return Math.max(0, Math.min(1.55, zoom));
}

function regionalMinimumZoom(expedition: Expedition) {
  return expedition.zoom - 3;
}

function globeCamera(
  container: HTMLElement,
  expedition: Expedition,
  centered = false,
  centerOverride?: [number, number],
) {
  const [longitude, latitude] =
    centerOverride ??
    (expedition.id === "nikko" && !centered
      ? solarBoundaryCenter(104)
      : expedition.coordinates);
  const center: [number, number] = [longitude, Math.min(latitude, 45)];
  const { padding, available } = globeViewport(container);
  const baseDiameter = 512 / Math.PI / Math.cos((center[1] * Math.PI) / 180);
  const zoom = Math.min(
    2.2,
    Math.max(0, Math.log2((available * 0.96) / baseDiameter)),
  );
  return { center, zoom, padding, pitch: 0, bearing: 0 };
}

function colorMap(map: MapLibreMap) {
  const colors: Record<
    string,
    ["background-color" | "fill-color" | "line-color", string]
  > = {
    background: ["background-color", "#e7e3d8"],
    park: ["fill-color", "#cbd4bf"],
    park_outline: ["line-color", "#a9b7a0"],
    landuse_residential: ["fill-color", "#e0dbd0"],
    landcover_wood: ["fill-color", "#aebea6"],
    landcover_grass: ["fill-color", "#c3cfb5"],
    landcover_ice: ["fill-color", "#e9efed"],
    landcover_wetland: ["fill-color", "#b2c5bb"],
    landcover_sand: ["fill-color", "#e1d1b4"],
    building: ["fill-color", "#ccc6ba"],
    boundary_2: ["line-color", "#777d78"],
    boundary_3: ["line-color", "#9c9b90"],
    boundary_disputed: ["line-color", "#777d78"],
    waterway_river: ["line-color", "#91abb8"],
    waterway_other: ["line-color", "#91abb8"],
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
      "#657f8d",
      7,
      "#aec3ca",
    ]);
  }
  if (map.getLayer("natural_earth")) {
    map.setPaintProperty("natural_earth", "raster-saturation", -0.65);
    map.setPaintProperty("natural_earth", "raster-contrast", -0.12);
  }
  if (map.getLayer("park")) {
    map.setPaintProperty("park", "fill-outline-color", "#a8b29d");
  }

  const globeLabelMinZoom = new Map([
    ["water_name_point_label", 3],
    ["water_name_line_label", 3],
    ["label_country_3", 3.4],
    ["label_country_2", 2.2],
    ["label_country_1", 1.4],
  ]);

  // Keep names, trails and boundaries legible beneath the field markers.
  for (const layer of map.getStyle().layers) {
    if (
      layer.id.startsWith("poi_") ||
      layer.id.includes("shield") ||
      layer.id === "building-3d"
    ) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
    if (layer.type === "line" && /^(road|bridge|tunnel)_/.test(layer.id)) {
      if (layer.id.endsWith("_casing")) {
        map.setPaintProperty(layer.id, "line-color", "#bfb3a2");
      } else if (/motorway|trunk_primary|secondary_tertiary/.test(layer.id)) {
        map.setPaintProperty(layer.id, "line-color", "#f5ead5");
      }
    }
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      const labelColor = layer.id.startsWith("water") ? "#395765" : "#37454a";
      map.setPaintProperty(layer.id, "text-color", labelColor);
      map.setPaintProperty(layer.id, "text-halo-color", "#f8f5eb");
      map.setPaintProperty(layer.id, "text-halo-width", 0.85);
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
  const installGlobe = useRef<(() => void) | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const latest = useRef(props);
  const lastRecenterKey = useRef(props.recenterKey);
  const lastSolarFocusKey = useRef(props.solarFocusKey);
  const lastConfirmationSequence = useRef<number | undefined>(undefined);
  const previousWorldView = useRef(props.worldView);
  const previousFocusedDestinationId = useRef(props.focusedDestinationId);
  const activeLanding = useRef<{ map: MapLibreMap; site: FieldSite } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showSpace, setShowSpace] = useState(props.worldView);
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
    let disposeGlobe: (() => void) | undefined;
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
      if (worldView) void loadEarthTextures().catch(() => undefined);
      map = new MapLibreMap({
        container: element,
        style: "https://tiles.openfreemap.org/styles/liberty",
        transformStyle: (_, style) => ({
          ...style,
          projection: {
            type: [
              "interpolate",
              ["linear"],
              ["zoom"],
              EARTH_SURFACE_FADE_END - 1,
              "vertical-perspective",
              EARTH_SURFACE_FADE_END,
              "mercator",
            ],
          },
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
        minZoom: worldView
          ? globeMinimumZoom(globeViewport(element).available)
          : regionalMinimumZoom(expedition),
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
    installGlobe.current = () => {
      disposeGlobe ??= mountPhotographicGlobe(map, () => mountGlobeLighting(map));
    };
    let space: boolean | undefined;
    function updateBackdrop() {
      const next = map.getZoom() < EARTH_SURFACE_FADE_END;
      if (space === next) return;
      space = next;
      setShowSpace(next);
    }
    updateBackdrop();
    map.on("zoom", updateBackdrop);
    map.addControl(new NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const zoomOut = element.querySelector<HTMLButtonElement>(
      ".maplibregl-ctrl-zoom-out",
    );
    function updateZoomOut() {
      if (!zoomOut) return;
      const zoom = map.getZoom();
      const onGlobe = zoom < EARTH_SURFACE_FADE_END - 1;
      // The sphere's zoom floor is latitude-adjusted, unlike the control's floor.
      const latitude = Math.min(Math.abs(map.getCenter().lat), 85.051129);
      const minimum = onGlobe
        ? map.getMinZoom() + Math.log2(Math.cos((latitude * Math.PI) / 180))
        : map.getMinZoom(true);
      const disabled = zoom <= minimum + 0.001;
      zoomOut.disabled = disabled;
      zoomOut.setAttribute("aria-disabled", String(disabled));
    }
    map.on("move", updateZoomOut);
    updateZoomOut();

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
    map.once("style.load", () => {
      if (!disposed) colorMap(map);
    });
    map.once("load", () => {
      if (disposed) return;
      window.clearTimeout(loadingTimeout);
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

    let viewportWidth = element.clientWidth;
    let viewportHeight = element.clientHeight;
    const observer = new ResizeObserver(() => {
      const resized =
        viewportWidth !== element.clientWidth ||
        viewportHeight !== element.clientHeight;
      viewportWidth = element.clientWidth;
      viewportHeight = element.clientHeight;
      map.resize();
      if (latest.current.worldView) {
        const { available, padding } = globeViewport(element);
        const minimum = globeMinimumZoom(available);
        const previousMinimum = map.getMinZoom();
        const previousZoom = map.getZoom();
        if (previousMinimum !== minimum) map.setMinZoom(minimum);
        if (resized && !map.isMoving() && previousZoom < 3) {
          map.jumpTo({
            padding,
            zoom: Math.max(minimum, previousZoom + minimum - previousMinimum),
          });
        }
      }
    });
    observer.observe(element);

    return () => {
      disposed = true;
      window.clearTimeout(loadingTimeout);
      observer.disconnect();
      attachedMarkers.forEach((marker) => marker.remove());
      attachedMarkers.clear();
      disposeGlobe?.();
      installGlobe.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  useEffect(() => {
    if (ready && props.worldView) installGlobe.current?.();
  }, [ready, attempt, props.worldView]);

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
          element.dataset.expeditionId ===
          (props.focusedDestinationId ?? props.expedition.id);
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
    props.expedition.id,
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
    map.stop();
    if (props.worldView) {
      map.setMinZoom(globeMinimumZoom(globeViewport(element).available));
      const destination = EXPEDITIONS.find(
        ({ id }) => id === props.focusedDestinationId,
      );
      const solarFocusRequested =
        lastSolarFocusKey.current !== props.solarFocusKey;
      lastSolarFocusKey.current = props.solarFocusKey;
      const camera = globeCamera(
        element,
        destination ?? props.expedition,
        Boolean(destination),
        solarFocusRequested
          ? solarBoundaryCenter(map.getCenter().lng)
          : undefined,
      );
      if (focusingDestination || solarFocusRequested) {
        map.easeTo({ ...camera, duration: reducedMotion ? 0 : 850 });
      } else {
        map.flyTo({ ...camera, duration: reducedMotion ? 0 : 1450 });
      }
      return;
    }
    const minimum = regionalMinimumZoom(props.expedition);
    const constrainRegion = () => map.setMinZoom(minimum);
    // Let a descent leave the globe before applying its regional zoom floor.
    const approachingRegion = map.getZoom() < minimum;
    if (!approachingRegion) constrainRegion();
    const recenterRequested = lastRecenterKey.current !== props.recenterKey;
    lastRecenterKey.current = props.recenterKey;
    const selected = recenterRequested
      ? undefined
      : props.expedition.encounters.find(
          (encounter) => encounter.id === props.selectedId,
        );
    if (!selected) {
      map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
      const panel = visiblePanel(element, Boolean(props.selectedId));
      const padding = cameraPadding(element, panel);
      const coordinates = props.expedition.encounters.map(
        (item) => item.coordinates,
      );
      if (fieldSite) coordinates.push(fieldSite.coordinates);
      const longitudes = coordinates.map(([longitude]) => longitude);
      const latitudes = coordinates.map(([, latitude]) => latitude);
      if (approachingRegion) map.once("moveend", constrainRegion);
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
      const stopObserving = observePanelPadding(map, element, panel, padding);
      return () => {
        map.off("moveend", constrainRegion);
        stopObserving();
      };
    }

    let stopObserving: (() => void) | undefined;
    let onArrival: ((event: MapEventType["moveend"]) => void) | undefined;
    let confirmation: HTMLElement | undefined;
    let confirmationTimer = 0;
    // Radix places the selected detail in a portal. Measure it after the DOM commit.
    const frame = requestAnimationFrame(() => {
      const panel = visiblePanel(element, true);
      const padding = cameraPadding(element, panel);
      const marker = markers.current
        .get(`encounter:${selected.id}`)
        ?.getElement();
      const zoom = Math.max(props.expedition.zoom + 0.5, 13);
      const usableHeight = element.clientHeight - padding.top - padding.bottom;
      // The marker is bottom-anchored. Lower its anchor so the sprite stays centered in the gap.
      const anchorOffset = Math.max(
        0,
        Math.min((marker?.offsetHeight ?? 80) / 2, usableHeight / 2 - 8),
      );
      const request = props.confirmationRequest;
      const intentional =
        request?.encounterId === selected.id &&
        request.sequence !== lastConfirmationSequence.current;
      const duration = intentional && !reducedMotion ? 650 : 0;

      if (intentional) lastConfirmationSequence.current = request.sequence;
      if (intentional && duration > 0) {
        const startTime = performance.now();
        onArrival = (event) => {
          if (
            !("confirmationSequence" in event) ||
            event.confirmationSequence !== request.sequence
          )
            return;
          if (onArrival) map.off("moveend", onArrival);

          // MapLibre also emits moveend if a gesture or another animation interrupts flyTo.
          if (
            performance.now() - startTime < duration - 16 ||
            Math.abs(map.getZoom() - zoom) > 0.05
          )
            return;
          const point = map.project(selected.coordinates);
          const expectedX =
            (element.clientWidth + padding.left - padding.right) / 2;
          const expectedY =
            (element.clientHeight + padding.top - padding.bottom) / 2 +
            anchorOffset;
          if (Math.hypot(point.x - expectedX, point.y - expectedY) > 10) return;
          confirmation = markers.current
            .get(`encounter:${selected.id}`)
            ?.getElement();
          confirmation?.classList.add("has-confirmation");
          confirmationTimer = window.setTimeout(
            () => confirmation?.classList.remove("has-confirmation"),
            760,
          );
        };
        map.on("moveend", onArrival);
      }

      if (approachingRegion) map.once("moveend", constrainRegion);
      map.flyTo(
        {
          center: selected.coordinates,
          zoom,
          padding,
          offset: [0, anchorOffset],
          pitch: 0,
          duration,
          essential: false,
        },
        { confirmationSequence: request?.sequence },
      );
      stopObserving = observePanelPadding(map, element, panel, padding);
    });

    return () => {
      cancelAnimationFrame(frame);
      map.off("moveend", constrainRegion);
      stopObserving?.();
      if (onArrival) map.off("moveend", onArrival);
      window.clearTimeout(confirmationTimer);
      confirmation?.classList.remove("has-confirmation");
    };
  }, [
    ready,
    attempt,
    props.expedition,
    props.selectedId,
    props.confirmationRequest,
    props.worldView,
    props.recenterKey,
    props.solarFocusKey,
    props.focusedDestinationId,
    props.landingSite,
    props.landingDuration,
    fieldSite,
    reducedMotion,
  ]);

  return (
    <div
      className={`map-surface${props.worldView ? " is-globe" : ""}${showSpace ? " has-space" : ""}${props.landingSite ? " is-descending" : ""}${props.safariPeriod ? ` is-safari is-safari-${props.safariPeriod}` : ""}`}
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
