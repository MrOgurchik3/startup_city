import { CitySubGrid } from './CitySubGrid';
import { CITY_PALETTE, mixHex } from '../../theme/cityPalette';

export interface CitySubGridSpec {
  cx: number;
  cz: number;
  cols: number;
  rows: number;
  pitch: number;
  lineColor?: string;
}

interface CityGroundProps {
  gridExtent: number;
  /** Per-district rectangular grids (gap between districts has no lines). */
  subGrids: CitySubGridSpec[];
}

/** Thick lot slab (top at y≈0) reduces z-fighting when zooming; buildings sit slightly above. */
const LOT_SLAB_THICK = 0.09;

/**
 * City floor: same dark ocean / lot tones as the global map infinite plane + sub-grids.
 */
export function CityGround({ gridExtent, subGrids }: CityGroundProps) {
  const halfT = LOT_SLAB_THICK / 2;
  const span = Math.max(gridExtent * 1.14, 2800);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -LOT_SLAB_THICK - 0.004, 0]}>
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial
          color={CITY_PALETTE.mapOceanFloor}
          depthWrite
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, -halfT, 0]}>
        <boxGeometry args={[gridExtent, LOT_SLAB_THICK, gridExtent]} />
        <meshBasicMaterial
          color={CITY_PALETTE.mapOceanFloor}
          depthWrite
          toneMapped={false}
        />
      </mesh>

      {subGrids.map((g, i) => (
        <CitySubGrid
          key={`subgrid-${i}-${g.cx}-${g.cz}`}
          cx={g.cx}
          cz={g.cz}
          cols={g.cols}
          rows={g.rows}
          pitch={g.pitch}
          y={0.052}
          color={g.lineColor ?? mixHex(CITY_PALETTE.borderLight, '#cbd5e1', 0.35)}
        />
      ))}
    </group>
  );
}
