import type { Startup } from '../../types';
import { cityBuildingBaseY, cityBuildingHeight, cityBuildingWidth } from '../../lib/encoding';

interface OutcomeMarkersProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

/** Roof marker for flopped only — IPO / M&A tint live on façades; unicorn = rainbow spire. */
export function OutcomeMarkers({ startups, positions }: OutcomeMarkersProps) {
  return (
    <group>
      {startups.map((s) => {
        if (s.outcomeStatus !== 'Flopped') return null;
        const pos = positions.get(s.id);
        if (!pos) return null;
        const [x, z] = pos;
        const h = cityBuildingHeight(s);
        const w = cityBuildingWidth(s);
        const roof = cityBuildingBaseY(s) + h + 0.08;
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
