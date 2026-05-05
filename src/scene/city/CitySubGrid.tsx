import { useMemo } from 'react';
import * as THREE from 'three';

const noopRaycast: THREE.LineSegments['raycast'] = () => {};

interface CitySubGridProps {
  cx: number;
  cz: number;
  cols: number;
  rows: number;
  pitch: number;
  y?: number;
  color?: string;
}

/**
 * Rectangular cell grid for one district. Sparse interior lines when the grid is large.
 */
export function CitySubGrid({
  cx,
  cz,
  cols,
  rows,
  pitch,
  y = 0.006,
  color = '#94a3b8',
}: CitySubGridProps) {
  const geometry = useMemo(() => {
    if (cols < 1 || rows < 1) return new THREE.BufferGeometry();
    const sparse = Math.max(cols, rows) > 14;
    const verts: number[] = [];
    const halfW = (cols * pitch) / 2;
    const halfD = (rows * pitch) / 2;
    const x0 = cx - halfW;
    const z0 = cz - halfD;
    const x1 = cx + halfW;
    const z1 = cz + halfD;

    const drawCol = (i: number) => {
      const x = x0 + i * pitch;
      verts.push(x, 0, z0, x, 0, z1);
    };
    const drawRow = (j: number) => {
      const z = z0 + j * pitch;
      verts.push(x0, 0, z, x1, 0, z);
    };

    for (let i = 0; i <= cols; i += 1) {
      if (sparse && i > 0 && i < cols && i % 2 === 1) continue;
      drawCol(i);
    }
    for (let j = 0; j <= rows; j += 1) {
      if (sparse && j > 0 && j < rows && j % 2 === 1) continue;
      drawRow(j);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(verts), 3));
    return g;
  }, [cx, cz, cols, rows, pitch]);

  const material = useMemo(() => {
    const m = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
    return m;
  }, [color]);

  if (cols < 1 || rows < 1) return null;

  return (
    <lineSegments
      ref={(node) => {
        if (node) node.raycast = noopRaycast;
      }}
      geometry={geometry}
      material={material}
      position={[0, y, 0]}
    />
  );
}
