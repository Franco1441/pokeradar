import type { FeatureCollection, Point } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  getNightOverlay,
  getSolarPosition,
  getSunElevation,
  type NightOverlayProperties,
} from "@/lib/globe-lighting";

const SHADOW_SOURCE = "pokeradar-solar-shadow";
const LIGHT_SOURCE = "pokeradar-city-lights";
const GLOBE_LIGHTING_MAX_ZOOM = 4.5;
const REFRESH_INTERVAL = 60_000;
const SHADOW_STEPS = 21;
const NIGHT_OPACITY = 0.9;
const NIGHT_COLOR = "#071223";

function cumulativeShadow(progress: number) {
  return NIGHT_OPACITY * progress ** 2 * (3 - 2 * progress);
}

const SHADOWS: (NightOverlayProperties & { opacity: number })[] = Array.from(
  { length: SHADOW_STEPS },
  (_, index) => {
    const elevation = -index;
    const previous = cumulativeShadow(index / SHADOW_STEPS);
    const next = cumulativeShadow((index + 1) / SHADOW_STEPS);
    return {
      elevation,
      zone:
        elevation <= -18
          ? "deep-night"
          : elevation <= -6
            ? "night"
            : "twilight",
      // Each nested fill blends over the previous ones. Match the target opacity.
      opacity: (next - previous) / (1 - previous),
    };
  },
);

function shadowLayerId(elevation: number) {
  return `${SHADOW_SOURCE}-${Math.abs(elevation)}`;
}

const LIGHT_LAYERS = [
  "pokeradar-city-halos",
  "pokeradar-city-centers",
] as const;
type NightLights = FeatureCollection<Point, { brightness: number }>;

let nightLights: Promise<NightLights> | undefined;

function loadNightLights() {
  nightLights ??= fetch("/map/night-lights.geojson")
    .then(async (response) => {
      if (!response.ok) throw new Error("Night lights unavailable");
      return (await response.json()) as NightLights;
    })
    .catch((error: unknown) => {
      nightLights = undefined;
      throw error;
    });
  return nightLights;
}

function zoomFade(
  opacity: number | ExpressionSpecification,
): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    opacity,
    2.8,
    opacity,
    GLOBE_LIGHTING_MAX_ZOOM,
    0,
  ];
}

/** Centers the globe on the day/night boundary closest to the current view. */
export function solarBoundaryCenter(
  longitude: number,
  date = new Date(),
): [number, number] {
  const sun = getSolarPosition(date);
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  const east = wrap(sun.longitude + 90);
  const west = wrap(sun.longitude - 90);
  return [
    Math.abs(wrap(east - longitude)) <= Math.abs(wrap(west - longitude))
      ? east
      : west,
    0,
  ];
}

export function mountGlobeLighting(map: MapLibreMap) {
  let disposed = false;
  let lights: NightLights | undefined;
  const firstLabel = map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol")?.id;

  map.addSource(SHADOW_SOURCE, {
    type: "geojson",
    data: getNightOverlay(getSolarPosition(new Date()), SHADOWS),
    maxzoom: 4,
    tolerance: 0.1,
  });

  for (const { elevation, opacity } of SHADOWS) {
    map.addLayer(
      {
        id: shadowLayerId(elevation),
        type: "fill",
        source: SHADOW_SOURCE,
        maxzoom: GLOBE_LIGHTING_MAX_ZOOM,
        filter: ["==", ["get", "elevation"], elevation],
        paint: {
          "fill-color": NIGHT_COLOR,
          "fill-opacity": zoomFade(opacity),
          "fill-antialias": false,
        },
      },
      firstLabel,
    );
  }

  map.addSource(LIGHT_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    attribution:
      '<a href="https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/" target="_blank" rel="noreferrer">NASA Black Marble</a>',
    maxzoom: 4,
  });

  map.addLayer(
    {
      id: LIGHT_LAYERS[0],
      type: "circle",
      source: LIGHT_SOURCE,
      maxzoom: GLOBE_LIGHTING_MAX_ZOOM,
      paint: {
        "circle-color": "#efa14d",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "brightness"],
          0,
          1.25,
          1,
          2.8,
        ],
        "circle-blur": 0.9,
        "circle-opacity": zoomFade(["*", ["get", "opacity"], 0.49]),
        "circle-pitch-scale": "viewport",
      },
    },
    firstLabel,
  );
  map.addLayer(
    {
      id: LIGHT_LAYERS[1],
      type: "circle",
      source: LIGHT_SOURCE,
      maxzoom: GLOBE_LIGHTING_MAX_ZOOM,
      paint: {
        "circle-color": "#ffe4aa",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "brightness"],
          0,
          0.55,
          1,
          1.45,
        ],
        "circle-blur": 0.23,
        "circle-opacity": zoomFade(["get", "opacity"]),
        "circle-pitch-scale": "viewport",
      },
    },
    firstLabel,
  );

  function refresh() {
    if (disposed) return;
    const sun = getSolarPosition(new Date());
    map
      .getSource<GeoJSONSource>(SHADOW_SOURCE)
      ?.setData(getNightOverlay(sun, SHADOWS));
    if (!lights) return;

    map.getSource<GeoJSONSource>(LIGHT_SOURCE)?.setData({
      type: "FeatureCollection",
      features: lights.features.flatMap((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const elevation = getSunElevation(longitude, latitude, sun);
        if (elevation >= -3) return [];
        const { brightness } = feature.properties;
        return [
          {
            ...feature,
            properties: {
              brightness,
              opacity:
                Math.min(1, (-elevation - 3) / 15) * (0.31 + brightness * 0.69),
            },
          },
        ];
      }),
    });
  }

  void loadNightLights()
    .then((data) => {
      lights = data;
      refresh();
    })
    .catch(() => {
      // Solar shading remains available if the supplemental raster sample fails to load.
    });

  const timer = window.setInterval(refresh, REFRESH_INTERVAL);
  return () => {
    disposed = true;
    window.clearInterval(timer);
    if (!map.getStyle()) return;
    for (const id of [
      ...LIGHT_LAYERS,
      ...SHADOWS.map(({ elevation }) => shadowLayerId(elevation)),
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [LIGHT_SOURCE, SHADOW_SOURCE]) {
      if (map.getSource(id)) map.removeSource(id);
    }
  };
}
