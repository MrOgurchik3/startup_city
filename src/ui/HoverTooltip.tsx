import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useFilteredDataset } from '../lib/useFilteredDataset';
import { getDataset } from '../data/generateFakeData';
import { REGIONS } from '../data/regions';
import { fmtMoney, fmtCount, fmtPct01 } from '../lib/encoding';
import type { RegionId } from '../types';

export function HoverTooltip() {
  const hover = useAppStore((s) => s.hover);
  const { aggregates } = useFilteredDataset();

  const startup = useMemo(() => {
    if (hover?.kind !== 'entity') return null;
    const { startups } = getDataset();
    return startups.find((s) => s.id === hover.id) ?? null;
  }, [hover]);

  if (!hover) return null;

  if (hover.kind === 'entity' && startup) {
    const inv = startup.investorFirmProfile;
    const isFirm = startup.entityType !== 'Startup' && inv;
    return (
      <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
        <div className="name">{startup.name}</div>
        {isFirm && inv ? (
          <>
            <div className="row">
              <span className="k">Type</span>
              <span>{startup.entityType}</span>
            </div>
            <div className="row">
              <span className="k">Deals LTM</span>
              <span>{fmtCount(inv.totalDealsLtm)}</span>
            </div>
            <div className="row">
              <span className="k">Lead rate</span>
              <span>{fmtPct01(inv.leadRoundRate, 0)}</span>
            </div>
            <div className="row">
              <span className="k">Port. avg raised</span>
              <span>{fmtMoney(inv.portfolioAvgRaised)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="row">
              <span className="k">Stage</span>
              <span>{startup.stage}</span>
            </div>
            <div className="row">
              <span className="k">Raised</span>
              <span>{fmtMoney(startup.totalRaised)}</span>
            </div>
            <div className="row">
              <span className="k">ARR</span>
              <span>{fmtMoney(startup.arr)}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  if (hover.kind === 'region') {
    const meta = REGIONS[hover.id as RegionId];
    const agg = aggregates[hover.id as RegionId];
    return (
      <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
        <div className="name">{meta.name}</div>
        <div className="row">
          <span className="k">Capital LTM</span>
          <span>{fmtMoney(agg.totalCapitalDeployedLtm)}</span>
        </div>
        <div className="row">
          <span className="k">Deals</span>
          <span>{agg.dealFlowVolume}</span>
        </div>
        <div className="row">
          <span className="k">Startups</span>
          <span>{fmtCount(agg.startupCount)}</span>
        </div>
        <div className="row">
          <span className="k">Investors</span>
          <span>{fmtCount(agg.investorCount)}</span>
        </div>
      </div>
    );
  }

  return null;
}
