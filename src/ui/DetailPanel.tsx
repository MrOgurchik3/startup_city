import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getDataset } from '../data/generateFakeData';
import { useFilteredDataset } from '../lib/useFilteredDataset';
import { REGIONS } from '../data/regions';
import { INVESTOR_BY_ID } from '../data/investors';
import {
  fmtCount,
  fmtDate,
  fmtMoney,
  fmtMultiple,
  fmtPct01,
} from '../lib/encoding';
import { bucketFor } from '../data/stages';
import type { Startup } from '../types';

function StartupDetail({ s }: { s: Startup }) {
  const meta = REGIONS[s.region];
  const investors = s.investorIds
    .map((id) => INVESTOR_BY_ID[id])
    .filter(Boolean)
    .slice(0, 3);
  const latestNews = s.events[0];
  const newsClass = latestNews
    ? `news news-${latestNews.kind === 'fundraise' ? 'fundraise' : latestNews.kind}`
    : '';
  const stageBucket = bucketFor(s.stage);
  const inv = s.investorFirmProfile;
  const isInvestorFirm = s.entityType !== 'Startup' && inv != null;

  return (
    <div className="detail">
      <h2>{s.name}</h2>
      <div className="detail-sub">
        {isInvestorFirm ? (
          <>
            <strong>{s.entityType}</strong> · {s.city}, {meta.name}
          </>
        ) : (
          <>
            <span className={`stage-dot stage-dot-${stageBucket}`} />
            {s.stage} · {s.vertical} / {s.subSector} · {s.city}, {meta.name}
          </>
        )}
      </div>

      {isInvestorFirm && inv ? (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="k">Assets under management</div>
            <div className="v">{fmtMoney(inv.assetsUnderManagement)}</div>
          </div>
          <div className="kpi">
            <div className="k">Portfolio companies</div>
            <div className="v">{fmtCount(inv.portfolioCompanies)}</div>
          </div>
          <div className="kpi">
            <div className="k">Total deals (LTM)</div>
            <div className="v">{fmtCount(inv.totalDealsLtm)}</div>
          </div>
          <div className="kpi">
            <div className="k">Deals (last year)</div>
            <div className="v">{inv.dealsLastYear}</div>
          </div>
          <div className="kpi">
            <div className="k">Lead round rate</div>
            <div className="v">{fmtPct01(inv.leadRoundRate, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Co-investor frequency</div>
            <div className="v">{fmtPct01(inv.coInvestorFrequency, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Avg days between deals</div>
            <div className="v">{inv.avgDaysBetweenDeals}</div>
          </div>
          <div className="kpi">
            <div className="k">Portfolio avg raised</div>
            <div className="v">{fmtMoney(inv.portfolioAvgRaised)}</div>
          </div>
          <div className="kpi">
            <div className="k">Portfolio unicorn rate</div>
            <div className="v">{fmtPct01(inv.portfolioUnicornRate, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Portfolio acquisition rate</div>
            <div className="v">{fmtPct01(inv.portfolioAcquisitionRate, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Portfolio flop rate</div>
            <div className="v">{fmtPct01(inv.portfolioFlopRate, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Repeat founder rate</div>
            <div className="v">{fmtPct01(inv.repeatFounderRate, 1)}</div>
          </div>
          <div className="kpi">
            <div className="k">Prior exit / flop (founders)</div>
            <div className="v">
              {fmtPct01(inv.priorExitRate, 0)} / {fmtPct01(inv.priorFlopRate, 0)}
            </div>
          </div>
        </div>
      ) : (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="k">Total Raised</div>
            <div className="v">{fmtMoney(s.totalRaised)}</div>
          </div>
          <div className="kpi">
            <div className="k">Latest Valuation</div>
            <div className="v">{fmtMoney(s.latestValuation)}</div>
          </div>
          <div className="kpi">
            <div className="k">ARR</div>
            <div className="v">{fmtMoney(s.arr)}</div>
          </div>
          <div className="kpi">
            <div className="k">Val / Raised</div>
            <div className="v">{fmtMultiple(s.valuationRaisedMultiple)}</div>
          </div>
          <div className="kpi">
            <div className="k">Time to Last Round</div>
            <div className="v">{s.timeToLastRoundDays} days</div>
          </div>
          <div className="kpi">
            <div className="k">Monthly Visitors</div>
            <div className="v">{fmtCount(s.websiteVisitorsMonthly)}</div>
          </div>
          <div className="kpi">
            <div className="k">Company Size</div>
            <div className="v">{s.companySize}</div>
          </div>
          <div className="kpi">
            <div className="k">Outcome</div>
            <div className="v">{s.outcomeStatus}</div>
          </div>
        </div>
      )}

      {!isInvestorFirm && (
      <div className="section">
        <h4>Top Investors</h4>
        <div className="investor-list">
          {investors.length === 0 && <span className="empty">No investors recorded.</span>}
          {investors.map((inv) => (
            <div key={inv.id} className="investor-row">
              <span>{inv.name}</span>
              <span style={{ color: 'var(--ink-mute)' }}>{inv.type}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {!isInvestorFirm && (
      <div className="section">
        <h4>Founders ({s.founders.length})</h4>
        <div className="founder-list">
          {s.founders.map((f, i) => (
            <div key={i} className="investor-row">
              <span>
                {f.name}
                <span style={{ color: 'var(--ink-mute)', marginLeft: 6 }}>
                  · {f.background}
                </span>
              </span>
              <span style={{ color: 'var(--ink-mute)' }}>
                {f.education} · {f.priorExit ? '✓ exit' : f.repeatFounder ? '↻ repeat' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      {!isInvestorFirm && latestNews && (
        <div className="section">
          <h4>Latest News (last 7 days)</h4>
          <div className={newsClass}>
            <div className="news-head">{latestNews.headline}</div>
            <div className="news-meta">
              {fmtDate(latestNews.date)} · {latestNews.source}
            </div>
            <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'var(--ink-soft)' }}>
              {latestNews.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function RegionDetail({ regionId }: { regionId: string }) {
  const { aggregates, edges } = useFilteredDataset();
  const meta = REGIONS[regionId as keyof typeof REGIONS];
  const agg = aggregates[regionId as keyof typeof aggregates];
  const inbound = edges
    .filter((e) => e.startupCountry === regionId && e.investorCountry !== regionId)
    .sort((a, b) => b.totalCapital - a.totalCapital)
    .slice(0, 5);
  const outbound = edges
    .filter((e) => e.investorCountry === regionId && e.startupCountry !== regionId)
    .sort((a, b) => b.totalCapital - a.totalCapital)
    .slice(0, 5);

  return (
    <div className="detail">
      <h2>{meta.name}</h2>
      <div className="detail-sub">{meta.flag} · region aggregate</div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k">Capital Deployed (LTM)</div>
          <div className="v">{fmtMoney(agg.totalCapitalDeployedLtm)}</div>
        </div>
        <div className="kpi">
          <div className="k">Deal Flow</div>
          <div className="v">{agg.dealFlowVolume}</div>
        </div>
        <div className="kpi">
          <div className="k">Startups</div>
          <div className="v">{fmtCount(agg.startupCount)}</div>
        </div>
        <div className="kpi">
          <div className="k">Active Investors</div>
          <div className="v">{fmtCount(agg.investorCount)}</div>
        </div>
      </div>

      <div className="section">
        <h4>Top Inbound Capital</h4>
        <div className="investor-list">
          {inbound.length === 0 && <span className="empty">No inbound flows.</span>}
          {inbound.map((e, i) => (
            <div key={i} className="investor-row">
              <span>{REGIONS[e.investorCountry].name}</span>
              <span style={{ color: 'var(--ink-mute)' }}>
                {fmtMoney(e.totalCapital)} · {e.dealCount} deals
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h4>Top Outbound Capital</h4>
        <div className="investor-list">
          {outbound.length === 0 && <span className="empty">No outbound flows.</span>}
          {outbound.map((e, i) => (
            <div key={i} className="investor-row">
              <span>{REGIONS[e.startupCountry].name}</span>
              <span style={{ color: 'var(--ink-mute)' }}>
                {fmtMoney(e.totalCapital)} · {e.dealCount} deals
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailPanel() {
  const selection = useAppStore((s) => s.selection);
  const setMode = useAppStore((s) => s.setMode);
  const setRegion = useAppStore((s) => s.setRegion);

  const startup = useMemo(() => {
    if (selection?.kind !== 'entity') return null;
    const { startups } = getDataset();
    return startups.find((s) => s.id === selection.id) ?? null;
  }, [selection]);

  if (!selection) return null;

  if (selection.kind === 'entity' && startup) {
    return <StartupDetail s={startup} />;
  }

  if (selection.kind === 'region') {
    return (
      <div>
        <RegionDetail regionId={selection.id} />
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            setRegion(selection.id as never);
            setMode('city');
          }}
        >
          Drill into City View →
        </button>
      </div>
    );
  }

  return null;
}
