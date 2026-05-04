import { scaleLinear, scaleLog, scaleSqrt } from 'd3-scale';
import type { InvestorFirmProfile, RegionAggregate, RegionId, Stage, Startup } from '../types';
import { stageColorHex, SELECTED_COLOR } from '../data/stages';
import { REGION_IDS } from '../data/regions';

// Single source of truth for KPI -> visual mapping.
// All inputs assumed to be in their natural units (£, monthly visitors, etc.).
// Output ranges chosen for the City View at the configured city size.

const heightScale = scaleLog<number, number>()
  .domain([1e5, 5e8])
  .range([0.6, 12])
  .clamp(true);

const widthScale = scaleSqrt<number, number>()
  .domain([0, 1e8])
  .range([0.6, 2.4])
  .clamp(true);

const spireScale = scaleLinear<number, number>()
  .domain([1, 25])
  .range([0.0, 5.5])
  .clamp(true);

/** Fraction of façade cells that show a window (traffic / reach). */
const windowDensityScale = scaleLog<number, number>()
  .domain([1e3, 5e7])
  .range([0.18, 0.95])
  .clamp(true);

/** Window brightness / “lights on” intensity from ARR (decoupled from visitor density). */
const windowIlluminanceScale = scaleSqrt<number, number>()
  .domain([0, 8e7])
  .range([0.22, 1.0])
  .clamp(true);

export function buildingHeight(s: Startup): number {
  return Math.max(0.4, heightScale(Math.max(1e5, s.totalRaised)));
}

export function buildingWidth(s: Startup): number {
  return Math.max(0.4, widthScale(s.arr));
}

export function spireHeight(s: Startup): number {
  return spireScale(Math.max(1, s.valuationRaisedMultiple));
}

export function windowDensity(s: Startup): number {
  return windowDensityScale(Math.max(1e3, s.websiteVisitorsMonthly));
}

export function windowIntensity(s: Startup): number {
  return windowIlluminanceScale(Math.max(0, s.arr));
}

function hasInvestorEncoding(s: Startup): s is Startup & { investorFirmProfile: InvestorFirmProfile } {
  return s.entityType !== 'Startup' && s.investorFirmProfile != null;
}

const investorHeightScale = scaleLog<number, number>()
  .domain([2e5, 2e8])
  .range([2.0, 24])
  .clamp(true);

const investorFootprintScale = scaleSqrt<number, number>()
  .domain([12, 520])
  .range([0.78, 2.65])
  .clamp(true);

const investorSpireScale = scaleLinear<number, number>()
  .domain([0, 0.32])
  .range([0.35, 5.6])
  .clamp(true);

/** City tower height: startups = total raised; investors = portfolio avg cheque. */
export function cityBuildingHeight(s: Startup): number {
  if (hasInvestorEncoding(s)) {
    return Math.max(1.2, investorHeightScale(Math.max(1e4, s.investorFirmProfile.portfolioAvgRaised)));
  }
  return buildingHeight(s);
}

/** City footprint width: startups = ARR; investors = LTM deal count. */
export function cityBuildingWidth(s: Startup): number {
  if (hasInvestorEncoding(s)) {
    return Math.max(0.62, investorFootprintScale(s.investorFirmProfile.totalDealsLtm));
  }
  return buildingWidth(s);
}

/** Spire: startups = val/raised multiple (unicorns get rainbow material); investors = portfolio unicorn rate. */
export function citySpireHeight(s: Startup): number {
  if (hasInvestorEncoding(s)) {
    return investorSpireScale(s.investorFirmProfile.portfolioUnicornRate);
  }
  return spireHeight(s);
}

export function cityWindowDensity(s: Startup): number {
  if (hasInvestorEncoding(s)) {
    const c = s.investorFirmProfile.coInvestorFrequency;
    return 0.2 + c * 0.72;
  }
  return windowDensity(s);
}

export function cityWindowIntensity(s: Startup): number {
  if (hasInvestorEncoding(s)) {
    const r = s.investorFirmProfile.leadRoundRate;
    return 0.22 + r * 0.75;
  }
  return windowIntensity(s);
}

/** 0 = none, 1 = IPO (green), 2 = M&A (purple). Unicorn uses spire colour only. */
export function cityOutcomeAccent(s: Startup): number {
  if (s.outcomeStatus === 'IPO') return 1;
  if (s.outcomeStatus === 'Acquired') return 2;
  return 0;
}

export function fmtPct01(value: number, digits = 0): string {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(digits)}%`;
}

export function colorForStage(stage: Stage, selected: boolean): string {
  return selected ? SELECTED_COLOR : stageColorHex(stage);
}

// Group buildings by entity type so we can use one InstancedMesh per shape.
export function shapeGroup(s: Startup): 0 | 1 | 2 | 3 {
  switch (s.entityType) {
    case 'Startup':
      return 0;
    case 'VC':
      return 1;
    case 'Angel':
      return 2;
    default:
      return 3;
  }
}

/** World Y for instanced building origin (local mesh bottom at 0). Slightly above lot slab top to avoid z-fighting. */
export function cityBuildingBaseY(s: Startup): number {
  return shapeGroup(s) >= 1 ? 0.024 : 0.038;
}

// Choropleth scale for the Global View: cool light low end, dark ink high end.
const choroplethScale = scaleLog<string, string>()
  .domain([1e8, 5e10])
  .range(['#dce4f0', '#0f172a'])
  .clamp(true);

export function choroplethFor(totalCapital: number): string {
  return choroplethScale(Math.max(1, totalCapital)) as unknown as string;
}

const extrusionScale = scaleLog<number, number>()
  .domain([5, 5000])
  .range([0.4, 8])
  .clamp(true);

export function regionExtrusion(dealCount: number): number {
  return extrusionScale(Math.max(1, dealCount));
}

const arcThicknessScale = scaleLog<number, number>()
  .domain([1e7, 5e10])
  .range([0.16, 1.35])
  .clamp(true);

const arcSpeedScale = scaleLinear<number, number>()
  .domain([1, 200])
  .range([0.06, 0.55])
  .clamp(true);

const arcGlowScale = scaleLog<number, number>()
  .domain([5e5, 1e8])
  .range([0.85, 2.35])
  .clamp(true);

export function arcThickness(totalCapital: number): number {
  return arcThicknessScale(Math.max(1e6, totalCapital));
}

export function arcSpeed(dealCount: number): number {
  return arcSpeedScale(Math.max(1, dealCount));
}

export function arcGlow(avgRoundSize: number): number {
  return arcGlowScale(Math.max(1e4, avgRoundSize));
}

/** Min/max capital & deal flow across the 7 regions for relative map encoding. */
export interface AggregateEncodingExtents {
  capMin: number;
  capMax: number;
  dealMin: number;
  dealMax: number;
}

export function aggregateEncodingExtents(
  aggregates: Record<RegionId, RegionAggregate>
): AggregateEncodingExtents {
  const caps = REGION_IDS.map((r) => aggregates[r].totalCapitalDeployedLtm);
  const deals = REGION_IDS.map((r) => aggregates[r].dealFlowVolume);
  const capMin = Math.min(...caps);
  let capMax = Math.max(...caps);
  const dealMin = Math.min(...deals);
  let dealMax = Math.max(...deals);
  if (capMax <= capMin) capMax = capMin + 1e-6;
  if (dealMax <= dealMin) dealMax = dealMin + 1e-6;
  return { capMin, capMax, dealMin, dealMax };
}

/** Choropleth colour for capital deployed, normalized to the current filter slice. */
export function choroplethForSlice(
  totalCapital: number,
  extents: AggregateEncodingExtents
): string {
  const sc = scaleLinear<string>()
    .domain([extents.capMin, extents.capMax])
    .range(['#e2e8f0', '#0f172a'])
    .clamp(true);
  return sc(totalCapital);
}

/** Extrusion height for deal-flow volume, normalized to the current filter slice. */
export function extrusionForSlice(
  dealFlow: number,
  extents: AggregateEncodingExtents,
  minH = 1,
  maxH = 22
): number {
  const sc = scaleLinear<number>()
    .domain([extents.dealMin, extents.dealMax])
    .range([minH, maxH])
    .clamp(true);
  return sc(dealFlow);
}

// Number formatting helpers used in tooltips / detail panels.
export function fmtMoney(value: number, currency = '£'): string {
  if (value >= 1e9) return `${currency}${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${currency}${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${currency}${(value / 1e3).toFixed(0)}K`;
  return `${currency}${value.toFixed(0)}`;
}

export function fmtCount(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

export function fmtMultiple(value: number): string {
  return `${value.toFixed(1)}x`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
