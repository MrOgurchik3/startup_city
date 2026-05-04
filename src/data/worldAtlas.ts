import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type {
  GeometryCollection as TopoGeometryCollection,
  Topology,
} from 'topojson-specification';
import type { RegionId } from '../types';
import { regionForISO3 } from './regions';
import { ISO_NUMERIC_TO_ALPHA3 } from './isoNumericToAlpha3';

export interface CountryProps {
  name?: string;
  region: RegionId | null;
}

export type WorldFeature = Feature<Geometry, CountryProps>;
export type WorldFeatureCollection = FeatureCollection<Geometry, CountryProps>;

let CACHE: WorldFeatureCollection | null = null;

export async function loadWorldAtlas(): Promise<WorldFeatureCollection> {
  if (CACHE) return CACHE;
  // The 110m TopoJSON is ~250 KB and is plenty for our grey basemap.
  const mod = await import('world-atlas/countries-110m.json');
  const topo = mod.default as unknown as Topology;
  const fc = feature(
    topo,
    topo.objects.countries as TopoGeometryCollection
  ) as unknown as FeatureCollection<Geometry, { name?: string }>;

  const enriched: WorldFeatureCollection = {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const num = String(f.id ?? '').padStart(3, '0');
      const iso3 = ISO_NUMERIC_TO_ALPHA3[num];
      const region = iso3 ? regionForISO3(iso3) : null;
      const enrichedFeature: WorldFeature = {
        type: 'Feature',
        id: f.id,
        geometry: f.geometry,
        properties: { name: f.properties?.name, region },
      };
      return enrichedFeature;
    }),
  };

  CACHE = enriched;
  return CACHE;
}
