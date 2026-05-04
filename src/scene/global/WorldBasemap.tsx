import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadWorldAtlas } from '../../data/worldAtlas';
import type { WorldFeatureCollection } from '../../data/worldAtlas';
import { buildFlatGeometry, shapesFromGeometry } from './geoUtils';

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
    const allShapes: THREE.Shape[] = [];
    fc.features.forEach((f) => {
      if (f.properties.region) return; // data regions handled separately
      shapesFromGeometry(f.geometry).forEach((s) => allShapes.push(s));
    });
    if (allShapes.length === 0) return null;
    return buildFlatGeometry(allShapes);
  }, [fc]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0.125, 0]} renderOrder={2}>
      <meshBasicMaterial
        color="#64748b"
        toneMapped={false}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
