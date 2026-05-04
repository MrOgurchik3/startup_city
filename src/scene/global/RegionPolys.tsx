import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { loadWorldAtlas } from '../../data/worldAtlas';
import type { WorldFeatureCollection, WorldFeature } from '../../data/worldAtlas';
import {
  buildExtrudedGeometry,
  clipGeometryToLngLatBBox,
  shapesFromGeometry,
  type LngLatBBox,
} from './geoUtils';
import {
  choroplethForSlice,
  extrusionForSlice,
  type AggregateEncodingExtents,
} from '../../lib/encoding';
import { useAppStore } from '../../store/useAppStore';
import type { RegionAggregate, RegionId } from '../../types';
import { REGION_IDS, REGIONS } from '../../data/regions';
import { lngLatToWorld } from '../../lib/projection';

interface RegionPolysProps {
  aggregates: Record<RegionId, RegionAggregate>;
  extents: AggregateEncodingExtents;
}

interface RegionMeshes {
  geometries: Record<RegionId, THREE.BufferGeometry | null>;
  features: Record<RegionId, WorldFeature[]>;
}

const CLIP_PAD = 2;

/** Wide boxes where REGIONS[id].bbox omits overseas / multi-part extents (e.g. US, Iceland). */
const REGION_CLIP_OVERRIDE: Partial<Record<RegionId, LngLatBBox>> = {
  US: [-168, 17, -60, 72],
  NORDICS: [-35, 53, 38, 72],
};

function clipBboxForRegion(rid: RegionId): LngLatBBox {
  const override = REGION_CLIP_OVERRIDE[rid];
  if (override) return override;
  const [minLng, minLat, maxLng, maxLat] = REGIONS[rid].bbox;
  return [
    minLng - CLIP_PAD,
    minLat - CLIP_PAD,
    maxLng + CLIP_PAD,
    maxLat + CLIP_PAD,
  ];
}

export function RegionPolys({ aggregates, extents }: RegionPolysProps) {
  const [fc, setFc] = useState<WorldFeatureCollection | null>(null);
  const setHover = useAppStore((s) => s.setHover);
  const selectRegion = useAppStore((s) => s.selectRegion);
  const setMode = useAppStore((s) => s.setMode);
  const setRegion = useAppStore((s) => s.setRegion);

  useEffect(() => {
    let cancelled = false;
    loadWorldAtlas().then((c) => {
      if (!cancelled) setFc(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const meshes: RegionMeshes = useMemo(() => {
    const geometries: Record<string, THREE.BufferGeometry | null> = {};
    const features: Record<string, WorldFeature[]> = {};
    REGION_IDS.forEach((id) => {
      geometries[id] = null;
      features[id] = [];
    });
    if (!fc) return { geometries, features } as RegionMeshes;

    REGION_IDS.forEach((rid) => {
      const matching = fc.features.filter((f) => f.properties.region === rid);
      features[rid] = matching;
      const shapes: THREE.Shape[] = [];
      const clipB = clipBboxForRegion(rid);
      matching.forEach((f) => {
        const clipped = clipGeometryToLngLatBBox(f.geometry, clipB);
        if (!clipped) return;
        shapesFromGeometry(clipped).forEach((s) => shapes.push(s));
      });
      if (shapes.length === 0) {
        // Fall back to the simplified silhouette so the region is still visible
        // (e.g. if world-atlas isn't available). Same `-z` flip as in geoUtils
        // so the extrude+rotate pipeline yields north at -z.
        const fallback = REGIONS[rid].outline;
        const shape = new THREE.Shape();
        fallback.forEach(([lng, lat], i) => {
          const [x, z] = lngLatToWorld(lng, lat);
          if (i === 0) shape.moveTo(x, -z);
          else shape.lineTo(x, -z);
        });
        shape.closePath();
        shapes.push(shape);
      }
      const agg = aggregates[rid];
      const h = extrusionForSlice(agg.dealFlowVolume, extents);
      geometries[rid] = buildExtrudedGeometry(shapes, h);
    });
    return { geometries, features } as RegionMeshes;
  }, [fc, aggregates, extents]);

  return (
    <group>
      {REGION_IDS.map((rid) => {
        const geom = meshes.geometries[rid];
        if (!geom) return null;
        const agg = aggregates[rid];
        const color = choroplethForSlice(agg.totalCapitalDeployedLtm, extents);
        return (
          <mesh
            key={rid}
            geometry={geom}
            position={[0, 0.132, 0]}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHover({ kind: 'region', id: rid, x: e.clientX, y: e.clientY });
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHover(null);
              document.body.style.cursor = '';
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.detail >= 2) {
                // Double-click: drill into City View.
                setRegion(rid);
                setMode('city');
              } else {
                selectRegion(rid);
              }
            }}
          >
            <meshStandardMaterial
              color={color}
              roughness={0.85}
              metalness={0.0}
              flatShading
            />
          </mesh>
        );
      })}
    </group>
  );
}
