import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getDataset } from '../data/generateFakeData';
import { buildAggregates, topEdges } from '../data/aggregates';

const TOP_FLOW_EDGES = 48;

export function useFilteredDataset() {
  const filters = useAppStore((s) => s.filters);
  return useMemo(() => {
    const { startups, now } = getDataset();
    const { filtered, aggregates, edges } = buildAggregates(
      startups,
      filters,
      now
    );
    return {
      now,
      all: startups,
      filtered,
      aggregates,
      edges,
      topEdges: topEdges(edges, TOP_FLOW_EDGES),
    };
  }, [filters]);
}
