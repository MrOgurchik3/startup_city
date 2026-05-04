import * as THREE from 'three';

export interface DistrictAccent {
  id: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
}

const padMat = new THREE.MeshStandardMaterial({
  color: '#ebe7df',
  roughness: 0.94,
  metalness: 0.02,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const cardMat = new THREE.MeshStandardMaterial({
  color: '#f7f4ec',
  roughness: 0.88,
  metalness: 0.03,
});
const chipMat = new THREE.MeshStandardMaterial({
  color: '#dcd7cc',
  roughness: 0.9,
  metalness: 0.04,
});

/**
 * Light “lot pad”, corner card, and marker chip per vertical district (readability, not KPI).
 */
export function CityDistrictAccents({ strips }: { strips: DistrictAccent[] }) {
  if (strips.length === 0) return null;

  return (
    <group>
      {strips.map((s) => {
        const w = s.halfW * 2 + 0.14;
        const d = s.halfD * 2 + 0.14;
        const wx = s.cx - s.halfW - 0.14;
        const nz = s.cz - s.halfD - 0.1;
        return (
          <group key={s.id}>
            <mesh position={[s.cx, 0.042, s.cz]} rotation-x={-Math.PI / 2} material={padMat}>
              <planeGeometry args={[w, d]} />
            </mesh>
            <mesh position={[wx, 0.092, nz]} rotation={[0, 0.35, 0]} material={cardMat}>
              <boxGeometry args={[0.26, 0.045, 0.34]} />
            </mesh>
            <mesh position={[s.cx + s.halfW - 0.08, 0.068, s.cz + s.halfD - 0.08]} material={chipMat}>
              <cylinderGeometry args={[0.07, 0.08, 0.022, 10]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
