import { useMemo } from 'react';
import { useFilteredDataset } from '../../lib/useFilteredDataset';
import { aggregateEncodingExtents } from '../../lib/encoding';
import { CITY_PALETTE } from '../../theme/cityPalette';
import { InfiniteHorizonBackdrop } from '../InfiniteHorizonBackdrop';
import { WorldBasemap } from './WorldBasemap';
import { RegionPolys } from './RegionPolys';
import { FlowArcs } from './FlowArcs';
export function GlobalScene() {
  const { aggregates, topEdges } = useFilteredDataset();

  const extents = useMemo(
    () => aggregateEncodingExtents(aggregates),
    [aggregates]
  );

  return (
    <group>
      <InfiniteHorizonBackdrop />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.055, 0]}>
        <planeGeometry args={[2200, 1400]} />
        <meshBasicMaterial color={CITY_PALETTE.mapOceanFloor} depthWrite />
      </mesh>

      <WorldBasemap />
      <RegionPolys aggregates={aggregates} extents={extents} />
      <FlowArcs edges={topEdges} aggregates={aggregates} extents={extents} />
    </group>
  );
}
