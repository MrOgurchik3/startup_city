import * as THREE from 'three';

const ROAD_Y = 0.014;
const ASPHALT_ALLEY = '#2e3138';

const alleyMat = new THREE.MeshStandardMaterial({
  color: ASPHALT_ALLEY,
  roughness: 0.9,
  metalness: 0.06,
});

interface CityWardsProps {
  rowsTotal: number;
  pitch: number;
  /** Wider lane between startup district and investor block. */
  alleyRoad: { cx: number; widthX: number } | null;
}

/** Startup–investor alley only (meta-grid roads live in CityMetaGridRoads). */
export function CityWards({ rowsTotal, pitch, alleyRoad }: CityWardsProps) {
  const depthZ = rowsTotal * pitch + pitch * 0.5;

  if (alleyRoad == null || alleyRoad.widthX <= 0.08) return null;

  return (
    <group>
      <mesh position={[alleyRoad.cx, ROAD_Y + 0.002, 0]} material={alleyMat}>
        <boxGeometry args={[alleyRoad.widthX, 0.038, depthZ + pitch * 0.06]} />
      </mesh>
    </group>
  );
}
