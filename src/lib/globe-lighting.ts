import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

export interface SolarPosition {
  longitude: number;
  latitude: number;
}

export type NightZone = "twilight" | "night" | "deep-night";

export interface NightOverlayProperties {
  zone: NightZone;
  /** Maximum geometric solar elevation in this cumulative overlay, in degrees. */
  elevation: number;
}

const RAD = Math.PI / 180;
const MAX_LATITUDE = 85;
const LONGITUDE_STEP = 1;
const NIGHT_STAGES: readonly NightOverlayProperties[] = [
  { zone: "twilight", elevation: 0 },
  { zone: "night", elevation: -6 },
  { zone: "deep-night", elevation: -18 },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * Approximate subsolar point, with east-positive longitude and UTC input.
 * NOAA fractional-year declination and equation of time, for globe illumination.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
export function getSolarPosition(date: Date): SolarPosition {
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("Invalid solar date");
  const year = date.getUTCFullYear();
  const yearStart = new Date(date);
  yearStart.setUTCMonth(0, 1);
  yearStart.setUTCHours(0, 0, 0, 0);
  const daysInYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
  const elapsedDays = (date.getTime() - yearStart.getTime()) / 86_400_000;
  const gamma = (2 * Math.PI * (elapsedDays - 0.5)) / daysInYear;
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60_000;

  return {
    longitude: wrapLongitude(180 - (utcMinutes + equationOfTime) / 4),
    latitude: declination / RAD,
  };
}

/** Surface normal · solar direction, ranging from -1 at midnight to 1 at the subsolar point. */
export function getSunlightDot(
  longitude: number,
  latitude: number,
  sun: SolarPosition,
): number {
  const observerLatitude = latitude * RAD;
  const solarLatitude = sun.latitude * RAD;
  return clamp(
    Math.sin(observerLatitude) * Math.sin(solarLatitude) +
      Math.cos(observerLatitude) *
        Math.cos(solarLatitude) *
        Math.cos((longitude - sun.longitude) * RAD),
    -1,
    1,
  );
}

/** Geometric solar elevation in degrees, without atmospheric refraction. */
export function getSunElevation(
  longitude: number,
  latitude: number,
  sun: SolarPosition,
): number {
  return Math.asin(getSunlightDot(longitude, latitude, sun)) / RAD;
}

interface LatitudeInterval {
  south: number;
  north: number;
}

interface LongitudeColumn extends LatitudeInterval {
  longitude: number;
}

/**
 * For elevations <= 0 the dark portion of a meridian is a single interval.
 * Its minimum is found analytically, so polar day/night need no singular tan(declination).
 */
function darkLatitudeInterval(
  longitude: number,
  sun: SolarPosition,
  threshold: number,
): LatitudeInterval | null {
  const sine = Math.sin(sun.latitude * RAD);
  const cosine =
    Math.cos(sun.latitude * RAD) * Math.cos((longitude - sun.longitude) * RAD);
  const dotAt = (latitude: number) =>
    sine * Math.sin(latitude * RAD) + cosine * Math.cos(latitude * RAD);
  const darkestLatitude = clamp(
    Math.atan2(-sine, -cosine) / RAD,
    -MAX_LATITUDE,
    MAX_LATITUDE,
  );
  if (dotAt(darkestLatitude) > threshold) return null;

  let south = -MAX_LATITUDE;
  let north = MAX_LATITUDE;
  if (dotAt(south) > threshold) {
    let day = south;
    let night = darkestLatitude;
    for (let step = 0; step < 28; step += 1) {
      const middle = (day + night) / 2;
      if (dotAt(middle) > threshold) day = middle;
      else night = middle;
    }
    south = night;
  }
  if (dotAt(north) > threshold) {
    let day = north;
    let night = darkestLatitude;
    for (let step = 0; step < 28; step += 1) {
      const middle = (day + night) / 2;
      if (dotAt(middle) > threshold) day = middle;
      else night = middle;
    }
    north = night;
  }
  return north - south > 0.000001 ? { south, north } : null;
}

/** Find where a strip tapers to its final point instead of leaving a one-degree gap. */
function findStripEnd(
  nightColumn: LongitudeColumn,
  dayLongitude: number,
  sun: SolarPosition,
  threshold: number,
): LongitudeColumn {
  let night = nightColumn;
  let day = dayLongitude;
  for (let step = 0; step < 24; step += 1) {
    const longitude = (night.longitude + day) / 2;
    const interval = darkLatitudeInterval(longitude, sun, threshold);
    if (interval) night = { longitude, ...interval };
    else day = longitude;
  }
  return night;
}

function stripPolygon(columns: LongitudeColumn[]): Polygon | null {
  if (columns.length < 2) return null;
  const ring: Position[] = columns.map(({ longitude, south }) => [
    longitude,
    south,
  ]);
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    ring.push([columns[index].longitude, columns[index].north]);
  }
  // The terminator can become nearly vertical at an equinox. Subdivide both
  // its steep edges and the closing meridians before the globe tessellates them.
  const denseRing: Position[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [longitude, latitude] = ring[index];
    const next = ring[(index + 1) % ring.length];
    const segments = Math.max(1, Math.ceil(Math.abs(next[1] - latitude) / 5));
    for (let segment = 0; segment < segments; segment += 1) {
      const fraction = segment / segments;
      denseRing.push([
        longitude + fraction * (next[0] - longitude),
        latitude + fraction * (next[1] - latitude),
      ]);
    }
  }
  denseRing.push([...denseRing[0]]);
  return { type: "Polygon", coordinates: [denseRing] };
}

/**
 * Cumulative layers below the requested solar elevations (0° or lower).
 * Quadrants keep every polygon within a 90° longitude span, avoiding dateline
 * wrapping and whole-globe triangulation. Coordinates stay inside ±85° latitude.
 * Layers may use zone filters with increasing opacity; disable fill antialiasing
 * to prevent hairlines between adjacent quadrants.
 * Twilight definitions: https://aa.usno.navy.mil/faq/RST_defs
 */
export function getNightOverlay(
  sun: SolarPosition,
  stages: readonly NightOverlayProperties[] = NIGHT_STAGES,
): FeatureCollection<Polygon, NightOverlayProperties> {
  if (
    !Number.isFinite(sun.longitude) ||
    !Number.isFinite(sun.latitude) ||
    Math.abs(sun.latitude) > 90
  ) {
    throw new RangeError("Invalid solar position");
  }
  const features: Feature<Polygon, NightOverlayProperties>[] = [];

  for (const stage of stages) {
    const threshold = Math.sin(stage.elevation * RAD);
    for (let west = -180; west < 180; west += 90) {
      let columns: LongitudeColumn[] = [];
      for (
        let longitude = west;
        longitude <= west + 90;
        longitude += LONGITUDE_STEP
      ) {
        const interval = darkLatitudeInterval(longitude, sun, threshold);
        if (interval) {
          const column = { longitude, ...interval };
          if (columns.length === 0 && longitude > west) {
            columns.push(
              findStripEnd(column, longitude - LONGITUDE_STEP, sun, threshold),
            );
          }
          columns.push(column);
        } else if (columns.length > 0) {
          columns.push(
            findStripEnd(
              columns[columns.length - 1],
              longitude,
              sun,
              threshold,
            ),
          );
          const geometry = stripPolygon(columns);
          if (geometry)
            features.push({
              type: "Feature",
              properties: { ...stage },
              geometry,
            });
          columns = [];
        }
      }
      const geometry = stripPolygon(columns);
      if (geometry)
        features.push({ type: "Feature", properties: { ...stage }, geometry });
    }
  }

  return { type: "FeatureCollection", features };
}
