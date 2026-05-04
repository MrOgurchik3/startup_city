import type {
  FilterState,
  InvestmentEdge,
  RegionAggregate,
  RegionId,
  Startup,
} from '../types';
import { REGION_IDS } from './regions';
import { INVESTOR_BY_ID } from './investors';
import { applyFilters, periodWindow } from '../lib/filters';

function emptyAggregate(region: RegionId): RegionAggregate {
  return {
    region,
    totalCapitalDeployedLtm: 0,
    dealFlowVolume: 0,
    startupCount: 0,
    investorCount: 0,
  };
}

export function buildAggregates(
  startups: Startup[],
  filters: FilterState,
  now: Date
): {
  filtered: Startup[];
  aggregates: Record<RegionId, RegionAggregate>;
  edges: InvestmentEdge[];
  topRegion: RegionId;
} {
  const filtered = applyFilters(startups, filters, now);
  const [winStart, winEnd] = periodWindow(filters.timePeriod, now);

  const aggregates: Record<RegionId, RegionAggregate> = {} as Record<
    RegionId,
    RegionAggregate
  >;
  REGION_IDS.forEach((id) => {
    aggregates[id] = emptyAggregate(id);
  });

  const investorSets: Record<RegionId, Set<string>> = {} as Record<
    RegionId,
    Set<string>
  >;
  REGION_IDS.forEach((id) => {
    investorSets[id] = new Set();
  });

  // Edge map keyed by `${investor}->${startup}`
  const edgeMap: Map<string, InvestmentEdge> = new Map();

  filtered.forEach((s) => {
    const agg = aggregates[s.region];
    agg.startupCount += 1;
    s.rounds.forEach((r) => {
      const d = new Date(r.date);
      if (d < winStart || d > winEnd) return;
      agg.totalCapitalDeployedLtm += r.amount;
      agg.dealFlowVolume += 1;
      r.investorIds.forEach((invId) => {
        const inv = INVESTOR_BY_ID[invId];
        if (!inv) return;
        investorSets[s.region].add(invId);
        const key = `${inv.homeCountry}>${s.region}`;
        let edge = edgeMap.get(key);
        if (!edge) {
          edge = {
            investorCountry: inv.homeCountry,
            startupCountry: s.region,
            totalCapital: 0,
            dealCount: 0,
            avgRoundSize: 0,
          };
          edgeMap.set(key, edge);
        }
        // Each investor in a round is credited the round amount divided by the number
        // of investors in that round (rough proxy; keeps totals consistent).
        const share = r.amount / Math.max(1, r.investorIds.length);
        edge.totalCapital += share;
        edge.dealCount += 1;
      });
    });
  });

  REGION_IDS.forEach((id) => {
    aggregates[id].investorCount = investorSets[id].size;
  });

  const edges = Array.from(edgeMap.values()).map((e) => ({
    ...e,
    avgRoundSize: e.totalCapital / Math.max(1, e.dealCount),
  }));

  let topRegion: RegionId = REGION_IDS[0];
  let topVal = -1;
  REGION_IDS.forEach((id) => {
    if (aggregates[id].totalCapitalDeployedLtm > topVal) {
      topVal = aggregates[id].totalCapitalDeployedLtm;
      topRegion = id;
    }
  });

  return { filtered, aggregates, edges, topRegion };
}

// Cap the number of rendered cross-border arcs (top N by capital) for perf.
export function topEdges(
  edges: InvestmentEdge[],
  n: number,
  options: { includeIntraRegion?: boolean } = {}
): InvestmentEdge[] {
  const filtered = options.includeIntraRegion
    ? edges
    : edges.filter((e) => e.investorCountry !== e.startupCountry);
  return [...filtered]
    .sort((a, b) => b.totalCapital - a.totalCapital)
    .slice(0, n);
}
