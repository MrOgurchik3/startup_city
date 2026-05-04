import type { ReactNode } from 'react';
import * as THREE from 'three';
import { CITY_PALETTE } from '../../theme/cityPalette';

const ROAD_Y = 0.048;

const mat = new THREE.MeshStandardMaterial({
  color: CITY_PALETTE.asphalt,
  roughness: 0.92,
  metalness: 0.05,
});
mat.polygonOffset = true;
mat.polygonOffsetFactor = -1;
mat.polygonOffsetUnits = -1;

const edgeMat = new THREE.MeshStandardMaterial({
  color: CITY_PALETTE.asphaltEdge,
  roughness: 0.9,
  metalness: 0.05,
});
edgeMat.polygonOffset = true;
edgeMat.polygonOffsetFactor = -1;
edgeMat.polygonOffsetUnits = -1;

function cellCx(gc: number, metaCols: number, metaCellW: number): number {
  return (gc - (metaCols - 1) / 2) * metaCellW;
}

function cellCz(gr: number, metaRows: number, metaCellD: number): number {
  return (gr - (metaRows - 1) / 2) * metaCellD;
}

interface CityMetaGridRoadsProps {
  metaCols: number;
  metaRows: number;
  metaCellW: number;
  metaCellD: number;
  roadW: number;
  withPerimeter?: boolean;
}

/**
 * Asphalt running north–south and east–west between meta-cells (industry vertical lots).
 */
export function CityMetaGridRoads({
  metaCols,
  metaRows,
  metaCellW,
  metaCellD,
  roadW,
  withPerimeter = true,
}: CityMetaGridRoadsProps) {
  if (metaCols < 1 || metaRows < 1) return null;

  const totalW = metaCols * metaCellW;
  const totalD = metaRows * metaCellD;

  const nsRoads =
    metaCols > 1
      ? Array.from({ length: metaCols - 1 }, (_, gc) => {
          const xMid = cellCx(gc, metaCols, metaCellW) + metaCellW / 2;
          return (
            <mesh key={`ns-${gc}`} position={[xMid, ROAD_Y, 0]} material={mat}>
              <boxGeometry args={[roadW, 0.034, totalD + roadW * 2]} />
            </mesh>
          );
        })
      : [];

  const ewRoads =
    metaRows > 1
      ? Array.from({ length: metaRows - 1 }, (_, gr) => {
          const zMid = cellCz(gr, metaRows, metaCellD) + metaCellD / 2;
          return (
            <mesh key={`ew-${gr}`} position={[0, ROAD_Y, zMid]} material={mat}>
              <boxGeometry args={[totalW + roadW * 2, 0.034, roadW]} />
            </mesh>
          );
        })
      : [];

  let perimeter: ReactNode = null;
  if (withPerimeter) {
    const x0 = cellCx(0, metaCols, metaCellW) - metaCellW / 2 - roadW / 2;
    const x1 = cellCx(metaCols - 1, metaCols, metaCellW) + metaCellW / 2 + roadW / 2;
    const z0 = cellCz(0, metaRows, metaCellD) - metaCellD / 2 - roadW / 2;
    const z1 = cellCz(metaRows - 1, metaRows, metaCellD) + metaCellD / 2 + roadW / 2;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const spanX = x1 - x0 + roadW;
    const spanZ = z1 - z0 + roadW;
    perimeter = (
      <>
        <mesh position={[mx, ROAD_Y + 0.002, z0]} material={edgeMat}>
          <boxGeometry args={[spanX, 0.036, roadW]} />
        </mesh>
        <mesh position={[mx, ROAD_Y + 0.002, z1]} material={edgeMat}>
          <boxGeometry args={[spanX, 0.036, roadW]} />
        </mesh>
        <mesh position={[x0, ROAD_Y + 0.002, mz]} material={edgeMat}>
          <boxGeometry args={[roadW, 0.036, spanZ]} />
        </mesh>
        <mesh position={[x1, ROAD_Y + 0.002, mz]} material={edgeMat}>
          <boxGeometry args={[roadW, 0.036, spanZ]} />
        </mesh>
      </>
    );
  }

  return (
    <group>
      {nsRoads}
      {ewRoads}
      {perimeter}
    </group>
  );
}
