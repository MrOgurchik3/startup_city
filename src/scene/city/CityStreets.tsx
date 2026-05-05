import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY_PALETTE } from '../../theme/cityPalette';

export interface StreetBlock {
  cx: number;
  cz: number;
  cols: number;
  rows: number;
  pitch: number;
}

interface CityStreetsProps {
  /** One asphalt layout per district (no roads drawn in the gap between blocks). */
  blocks: StreetBlock[];
}

const noopRaycast: THREE.InstancedMesh['raycast'] = () => {};

const ROAD_W = 0.22;
const ROAD_Y = 0.048;

/**
 * Asphalt strips on cell boundaries within each street block only.
 */
export function CityStreets({ blocks }: CityStreetsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const maxInst = useMemo(
    () => blocks.reduce((sum, b) => sum + (b.cols + 1) + (b.rows + 1), 0),
    [blocks]
  );

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 0.028, 1);
    g.translate(0, 0.014, 0);
    return g;
  }, []);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: CITY_PALETTE.asphalt,
      roughness: 0.92,
      metalness: 0.05,
    });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
    return m;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.raycast = noopRaycast;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || blocks.length === 0) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    let i = 0;
    blocks.forEach(({ cx, cz, cols, rows, pitch }) => {
      if (cols < 1 || rows < 1) return;
      const depth = rows * pitch + pitch * 0.2;
      const width = cols * pitch + pitch * 0.2;
      for (let b = 0; b <= cols; b += 1) {
        const x = cx + (-cols / 2) * pitch + b * pitch;
        pos.set(x, ROAD_Y, cz);
        scl.set(ROAD_W, 1, depth);
        m.compose(pos, quat, scl);
        mesh.setMatrixAt(i, m);
        i += 1;
      }
      for (let b = 0; b <= rows; b += 1) {
        const z = cz + (-rows / 2) * pitch + b * pitch;
        pos.set(cx, ROAD_Y, z);
        scl.set(width, 1, ROAD_W);
        m.compose(pos, quat, scl);
        mesh.setMatrixAt(i, m);
        i += 1;
      }
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, [blocks]);

  if (blocks.length === 0 || maxInst === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(maxInst, 4)]}
      frustumCulled={false}
    />
  );
}
