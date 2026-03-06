/**
 * S40: GeoJSON Level-of-Detail (LOD) System
 *
 * Provides zoom-level-based GeoJSON simplification for the WorldMap.
 * At low zoom (globe overview), uses simplified 110m data.
 * At medium zoom (regional), uses standard 50m data.
 * At high zoom (country close-up), uses detailed 10m data.
 *
 * This avoids rendering 195 high-detail polygons when the user
 * is viewing the whole world (saves ~80% of vertex processing).
 */

export type LODLevel = 'low' | 'medium' | 'high';

/** LOD thresholds mapped to MapLibre zoom levels */
export const LOD_ZOOM_THRESHOLDS = {
  /** zoom < 3: simplified world view (110m Natural Earth) */
  low: 3,
  /** 3 <= zoom < 5: regional view (50m Natural Earth) */
  medium: 5,
  /** zoom >= 5: detailed view (10m Natural Earth) */
  high: Infinity,
} as const;

/** GeoJSON file paths for each LOD level */
export const LOD_SOURCES: Record<LODLevel, string> = {
  low: '/data/countries-110m.geojson',
  medium: '/data/countries.geojson',
  high: '/data/countries.geojson', // same as medium until 10m data is available
};

/**
 * Determines the LOD level based on current zoom.
 */
export function getLODLevel(zoom: number): LODLevel {
  if (zoom < LOD_ZOOM_THRESHOLDS.low) return 'low';
  if (zoom < LOD_ZOOM_THRESHOLDS.medium) return 'medium';
  return 'high';
}

/**
 * Debounced LOD switcher for MapLibre GL source updates.
 * Only triggers a source change when the LOD level actually changes.
 */
export class LODController {
  private currentLevel: LODLevel = 'low';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private readonly onLODChange: (level: LODLevel, source: string) => void;

  constructor(
    onLODChange: (level: LODLevel, source: string) => void,
    debounceMs = 300,
  ) {
    this.onLODChange = onLODChange;
    this.debounceMs = debounceMs;
  }

  /** Call on every zoom change */
  update(zoom: number): void {
    const newLevel = getLODLevel(zoom);
    if (newLevel === this.currentLevel) return;

    // Debounce to avoid rapid source swaps during zoom animation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.currentLevel = newLevel;
      this.onLODChange(newLevel, LOD_SOURCES[newLevel]);
    }, this.debounceMs);
  }

  /** Get current LOD level */
  getLevel(): LODLevel {
    return this.currentLevel;
  }

  /** Cleanup */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

/**
 * Simplifies a GeoJSON FeatureCollection by reducing coordinate precision.
 * This is a client-side fallback when pre-simplified data is not available.
 *
 * @param geojson - Original GeoJSON data
 * @param precision - Decimal places to keep (3 = ~111m, 2 = ~1.1km, 1 = ~11km)
 */
export function simplifyGeoJSONCoordinates(
  geojson: GeoJSON.FeatureCollection,
  precision: number,
): GeoJSON.FeatureCollection {
  const factor = Math.pow(10, precision);

  function roundCoord(coord: number[]): number[] {
    return coord.map((v) => Math.round(v * factor) / factor);
  }

  function simplifyCoords(coords: unknown): unknown {
    if (!Array.isArray(coords)) return coords;
    if (coords.length === 0) return coords;

    // Check if this is a coordinate pair [lng, lat]
    if (typeof coords[0] === 'number') {
      return roundCoord(coords as number[]);
    }

    // Recursively simplify nested arrays (Polygon, MultiPolygon rings)
    return (coords as unknown[]).map(simplifyCoords);
  }

  return {
    type: 'FeatureCollection',
    features: geojson.features.map((feature) => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: simplifyCoords(
          (feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates,
        ),
      } as GeoJSON.Geometry,
    })),
  };
}
