import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Startup } from '../../types';
import { cityBuildingRoofWorldY, cityBuildingWidth } from '../../lib/encoding';

interface OutcomeMarkersProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

const noopRaycast: THREE.Mesh['raycast'] = () => {};

/** Roof marker for flopped only — IPO / M&A tint live on façades; unicorn = rainbow spire. */
export function OutcomeMarkers({ startups, positions }: OutcomeMarkersProps) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    groupRef.current?.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) m.raycast = noopRaycast;
    });
  }, [startups]);

  return (
    <group ref={groupRef}>
      {startups.map((s) => {
        if (s.outcomeStatus !== 'Flopped') return null;
        const pos = positions.get(s.id);
        if (!pos) return null;
        const [x, z] = pos;
        const w = cityBuildingWidth(s);
        const roof = cityBuildingRoofWorldY(s) + 0.04;
        const arm = Math.max(0.14, w * 0.36);
        const thick = 0.045;
        return (
          <group key={`o-${s.id}`} position={[x, roof, z]}>
            <mesh rotation-y={Math.PI / 4}>
              <boxGeometry args={[arm, thick, thick]} />
              <meshBasicMaterial color="#0a0a0c" />
            </mesh>
            <mesh rotation-y={-Math.PI / 4}>
              <boxGeometry args={[arm, thick, thick]} />
              <meshBasicMaterial color="#0a0a0c" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
