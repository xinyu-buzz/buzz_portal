import type { GeoGeometry, GeoFeature } from "./types";

/**
 * Convert GeoJSON geometry to an SVG path `d` string.
 * Uses equirectangular projection: x = longitude, y = -latitude.
 */
export function projectToSvg(geometry: GeoGeometry): string {
  const parts: string[] = [];
  const polygons =
    geometry.type === "MultiPolygon"
      ? (geometry.coordinates as number[][][][])
      : [geometry.coordinates as number[][][]];

  for (const polygon of polygons) {
    for (const ring of polygon) {
      const pts = ring.map(([lng, lat]) => `${lng},${-lat}`);
      parts.push(`M${pts.join("L")}Z`);
    }
  }
  return parts.join(" ");
}

/**
 * Ray-casting point-in-polygon test.
 * Coordinates in the ring are [lng, lat].
 */
export function pointInPolygon(
  lng: number,
  lat: number,
  ring: number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Find the GeoJSON feature that contains the given coordinate.
 */
export function findFeature(
  lng: number,
  lat: number,
  features: GeoFeature[],
): GeoFeature | null {
  for (const feature of features) {
    const polys =
      feature.geometry.type === "MultiPolygon"
        ? (feature.geometry.coordinates as number[][][][])
        : [feature.geometry.coordinates as number[][][]];
    for (const polygon of polys) {
      if (pointInPolygon(lng, lat, polygon[0])) return feature;
    }
  }
  return null;
}

/** 6-step color scale from dark background to accent orange. */
const COLOR_STOPS = [
  "#2c3039",
  "#3d4455",
  "#5a5f6e",
  "#8b7040",
  "#cc8520",
  "#ffa500",
];

export function getColorForCount(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return COLOR_STOPS[0];
  const ratio = count / maxCount;
  const idx = Math.min(
    Math.floor(ratio * (COLOR_STOPS.length - 1)) + 1,
    COLOR_STOPS.length - 1,
  );
  return COLOR_STOPS[idx];
}

/**
 * Compute an SVG viewBox [minX, minY, width, height] that encompasses
 * all given features, with a padding margin in coordinate units.
 */
export function getBoundingBox(
  features: GeoFeature[],
  padding = 2,
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const f of features) {
    const polys =
      f.geometry.type === "MultiPolygon"
        ? (f.geometry.coordinates as number[][][][])
        : [f.geometry.coordinates as number[][][]];
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          const svgY = -lat;
          if (lng < minX) minX = lng;
          if (lng > maxX) maxX = lng;
          if (svgY < minY) minY = svgY;
          if (svgY > maxY) maxY = svgY;
        }
      }
    }
  }

  return [
    minX - padding,
    minY - padding,
    maxX - minX + 2 * padding,
    maxY - minY + 2 * padding,
  ];
}
