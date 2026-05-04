import { useMemo } from 'react';
import { useFilteredDataset } from '../../lib/useFilteredDataset';
import { aggregateEncodingExtents } from '../../lib/encoding';
import { InfiniteHorizonBackdrop } from '../InfiniteHorizonBackdrop';
import { GlobeOcean } from './GlobeOcean';
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
      <GlobeOcean />
      <RegionPolys aggregates={aggregates} extents={extents} />
      <FlowArcs edges={topEdges} aggregates={aggregates} extents={extents} />
    </group>
  );
}
