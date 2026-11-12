import { describe, expect, it } from "vitest";
import type { Position } from "geojson";
import {
  getNightOverlay,
  getSolarPosition,
  getSunElevation,
  getSunlightDot,
} from "./globe-lighting";

function ringContains(
  longitude: number,
  latitude: number,
  ring: Position[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (
      y > latitude !== previousY > latitude &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x
    )
      inside = !inside;
  }
  return inside;
}

describe("solar position", () => {
  it("places the March equinox Sun near the equator and Greenwich at UTC noon", () => {
    const sun = getSolarPosition(new Date("2026-03-20T12:00:00Z"));
    expect(Math.abs(sun.latitude)).toBeLessThan(1);
    expect(sun.longitude).toBeGreaterThan(1);
    expect(sun.longitude).toBeLessThan(3);
  });

  it("tracks opposite seasonal declinations and the Earth's westward solar motion", () => {
    const june = getSolarPosition(new Date("2026-06-21T12:00:00Z"));
    const december = getSolarPosition(new Date("2026-12-21T12:00:00Z"));
    const later = getSolarPosition(new Date("2026-06-21T13:00:00Z"));
    expect(june.latitude).toBeGreaterThan(23);
    expect(june.latitude).toBeLessThan(24);
    expect(december.latitude).toBeLessThan(-23);
    expect(december.latitude).toBeGreaterThan(-24);
    expect(later.longitude - june.longitude).toBeCloseTo(-15, 1);
  });

  it("keeps leap-year and year-boundary positions finite and normalized", () => {
    for (const timestamp of [
      "2024-02-29T00:00:00Z",
      "2024-12-31T23:59:59Z",
      "2025-01-01T00:00:00Z",
    ]) {
      const sun = getSolarPosition(new Date(timestamp));
      expect(sun.longitude).toBeGreaterThanOrEqual(-180);
      expect(sun.longitude).toBeLessThan(180);
      expect(Math.abs(sun.latitude)).toBeLessThan(24);
    }
    expect(() => getSolarPosition(new Date("invalid"))).toThrow(RangeError);
  });

  it("returns zenith at the subsolar point, nadir at its antipode, and polar night in winter", () => {
    const sun = getSolarPosition(new Date("2026-06-21T12:00:00Z"));
    expect(getSunlightDot(sun.longitude, sun.latitude, sun)).toBeCloseTo(1, 12);
    expect(getSunElevation(sun.longitude, sun.latitude, sun)).toBeCloseTo(
      90,
      5,
    );
    expect(
      getSunElevation(sun.longitude + 180, -sun.latitude, sun),
    ).toBeCloseTo(-90, 5);
    expect(getSunElevation(0, 85, sun)).toBeGreaterThan(0);
    expect(getSunElevation(0, -85, sun)).toBeLessThan(-18);
  });
});

describe("globe night geometry", () => {
  it.each([
    { longitude: 0, latitude: 0 },
    { longitude: 179.9, latitude: 0 },
    { longitude: -179.9, latitude: 0 },
    { longitude: 45, latitude: 23.44 },
    { longitude: -135, latitude: -23.44 },
    { longitude: 89.999, latitude: 0.001 },
  ])(
    "matches the solar elevation across the dateline and poles for %j",
    (sun) => {
      const overlay = getNightOverlay(sun);
      for (const threshold of [0, -6, -18]) {
        const polygons = overlay.features.filter(
          (feature) => feature.properties.elevation === threshold,
        );
        for (let longitude = -179.5; longitude < 180; longitude += 15) {
          for (let latitude = -84.5; latitude < 85; latitude += 13) {
            const elevation = getSunElevation(longitude, latitude, sun);
            // The one-degree boundary sampling is intended for a globe-scale map.
            if (Math.abs(elevation - threshold) < 0.25) continue;
            const covered = polygons.some((feature) =>
              ringContains(
                longitude,
                latitude,
                feature.geometry.coordinates[0],
              ),
            );
            expect(
              covered,
              `${longitude}, ${latitude} at elevation ${elevation}, threshold ${threshold}`,
            ).toBe(elevation <= threshold);
          }
        }
      }
    },
  );

  it("uses closed counterclockwise rings with bounded edges and a compact payload", () => {
    const overlay = getNightOverlay(
      getSolarPosition(new Date("2026-11-12T12:00:00Z")),
    );
    expect(overlay.features.length).toBeLessThanOrEqual(12);
    expect(JSON.stringify(overlay).length).toBeLessThan(150_000);
    expect(
      new Set(overlay.features.map((feature) => feature.properties.zone)),
    ).toEqual(new Set(["twilight", "night", "deep-night"]));
    for (const feature of overlay.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      let twiceArea = 0;
      for (let index = 0; index < ring.length - 1; index += 1) {
        const [longitude, latitude] = ring[index];
        const [nextLongitude, nextLatitude] = ring[index + 1];
        expect(Math.abs(longitude)).toBeLessThanOrEqual(180);
        expect(Math.abs(latitude)).toBeLessThanOrEqual(85);
        expect(Math.abs(nextLongitude - longitude)).toBeLessThanOrEqual(
          1.00001,
        );
        expect(Math.abs(nextLatitude - latitude)).toBeLessThanOrEqual(5.00001);
        twiceArea += longitude * nextLatitude - nextLongitude * latitude;
      }
      expect(twiceArea).toBeGreaterThan(0);
    }
  });
});
