import { useEffect, useMemo, useState } from 'react';
import { loadWorldAtlas } from '../../data/worldAtlas';
import type { WorldFeatureCollection } from '../../data/worldAtlas';
import { R_GLOBE } from '../../lib/projection';
import { buildSpheredFlatGeometry, polysFromGeometry, type PolyRings } from './geoUtils';

// Sit fractionally above the ocean sphere to avoid z-fighting with it.
const LAND_RADIUS = R_GLOBE + 0.08;

export function WorldBasemap() {
  const [fc, setFc] = useState<WorldFeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorldAtlas()
      .then((c) => {
        if (!cancelled) setFc(c);
      })
      .catch(() => {
        // noop: basemap is optional, the rest of the global view still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const geometry = useMemo(() => {
    if (!fc) return null;
    const allPolys: PolyRings[] = [];
    fc.features.forEach((f) => {
      if (f.properties.region) return; // data regions handled separately
      polysFromGeometry(f.geometry).forEach((p) => allPolys.push(p));
    });
    return buildSpheredFlatGeometry(allPolys, LAND_RADIUS);
  }, [fc]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        color="#7a8699"
        roughness={0.92}
        metalness={0.0}
      />
    </mesh>
  );
}
