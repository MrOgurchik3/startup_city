import type {
  CompanySize,
  EducationLevel,
  EntityType,
  Founder,
  FounderBackground,
  FundraisingStatus,
  NewsEvent,
  NewsKind,
  InvestorFirmProfile,
  OutcomeStatus,
  Round,
  RegionId,
  Stage,
  Startup,
} from '../types';
import {
  chance,
  gaussian,
  logNormal,
  makeRng,
  pick,
  rangeInt,
  weightedPick,
  weightedPickMap,
} from '../lib/rng';
import { REGIONS, REGION_IDS } from './regions';
import { STAGE_WEIGHTS } from './stages';
import { INVESTORS_BY_REGION, INVESTORS } from './investors';
import { VERTICAL_WEIGHTS, subSectorsOf } from './sectors';
import {
  UNIVERSITIES,
  universitiesForRegion,
} from './universities';

const SEED = 'venture-intelligence-map-v2-investor-metrics';
const STARTUPS_PER_REGION: Record<RegionId, number> = {
  US: 2200,
  UK: 1850,
  DE: 1120,
  FR: 1000,
  NORDICS: 880,
  WE: 1360,
  IN: 1720,
};

const FIRST_NAMES = [
  'Aarav', 'Alex', 'Amelia', 'Anouk', 'Ben', 'Camille', 'Chen', 'Diana', 'Elias',
  'Emma', 'Felix', 'Greta', 'Hugo', 'Imran', 'Isabella', 'James', 'Julia', 'Kai',
  'Karim', 'Klara', 'Leah', 'Leo', 'Lior', 'Maya', 'Mia', 'Nadia', 'Niko',
  'Oliver', 'Omar', 'Otto', 'Priya', 'Rafael', 'Rahul', 'Rhea', 'Sara', 'Sasha',
  'Sofia', 'Tara', 'Theo', 'Tom', 'Vera', 'Wei', 'Yara', 'Yasmin', 'Yusuf',
  'Zara',
];

const LAST_NAMES = [
  'Andersson', 'Becker', 'Bernard', 'Bhatt', 'Brown', 'Chen', 'Cohen', 'Davis',
  'Dubois', 'Evans', 'Fernandez', 'Garcia', 'Hansen', 'Iyer', 'Johansson',
  'Jones', 'Kapoor', 'Khan', 'Kim', 'Kowalski', 'Larsen', 'Lee', 'Lopez',
  'Mehta', 'Meyer', 'Miller', 'Müller', 'Nakamura', 'Novak', 'Patel', 'Park',
  'Petersen', 'Reddy', 'Rossi', 'Schmidt', 'Sharma', 'Singh', 'Smith', 'Tanaka',
  'Taylor', 'Vidal', 'Wang', 'Williams', 'Wilson', 'Wright', 'Yamada',
];

const COMPANY_PREFIXES = [
  'Aether', 'Apex', 'Arc', 'Atlas', 'Aurora', 'Beam', 'Bolt', 'Cascade',
  'Cipher', 'Cobalt', 'Crest', 'Crimson', 'Delta', 'Drift', 'Echo', 'Ember',
  'Equinox', 'Fable', 'Flux', 'Forge', 'Fountain', 'Glass', 'Glyph', 'Halo',
  'Harbour', 'Helix', 'Indigo', 'Iris', 'Ivory', 'Junction', 'Kestrel', 'Kindred',
  'Lattice', 'Lumen', 'Lyric', 'Meridian', 'Midnight', 'Mosaic', 'Nimbus',
  'North', 'Nova', 'Onyx', 'Orbit', 'Origin', 'Parallel', 'Plume', 'Polar',
  'Prism', 'Quartz', 'Quill', 'Radian', 'Rivet', 'Rook', 'Saffron', 'Sable',
  'Sage', 'Saturn', 'Sentry', 'Slate', 'Solace', 'Spire', 'Stellar', 'Stoic',
  'Stone', 'Sundial', 'Tessera', 'Theta', 'Thrive', 'Tide', 'Tundra', 'Verge',
  'Vesper', 'Vista', 'Volt', 'Watershed', 'Whisper', 'Wing', 'Yarrow', 'Zenith',
];

const COMPANY_SUFFIXES = [
  'AI', 'Labs', 'OS', 'Health', 'Bio', 'Stack', 'Cloud', 'Capital', 'Works',
  'Pay', 'Hub', 'Trust', 'Studio', 'Logic', 'Bank', 'Energy', 'Robotics', 'X',
  'Loop', 'Wave', 'Atomic', 'Forge', 'Co', '',
];

const ENTITY_TYPES: EntityType[] = ['Startup', 'VC', 'Angel', 'Other'];
const ENTITY_WEIGHTS = [0.92, 0.045, 0.025, 0.01];

const COMPANY_SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-500', '500+'];
const EDUCATION_LEVELS: EducationLevel[] = ['BSc', 'MSc', 'MBA', 'PhD', 'No Degree', 'Other'];
const EDU_WEIGHTS = [0.32, 0.32, 0.12, 0.1, 0.1, 0.04];
const FOUNDER_BACKGROUNDS: FounderBackground[] = [
  'Engineering', 'Product', 'Science', 'Finance', 'Sales', 'Operations', 'Design',
];
const BG_WEIGHTS = [0.34, 0.18, 0.14, 0.12, 0.08, 0.08, 0.06];

function pickName(rng: () => number): string {
  const a = pick(rng, COMPANY_PREFIXES);
  const b = pick(rng, COMPANY_SUFFIXES);
  return b ? `${a} ${b}` : a;
}

function pickCity(rng: () => number, region: RegionId) {
  const cities = REGIONS[region].hqCities;
  const weights = cities.map((c) => c.weight);
  return weightedPick(rng, cities, weights);
}

function jitterLatLng(rng: () => number, lat: number, lng: number, region: RegionId) {
  // Spread buildings around the anchor city while keeping them in-region.
  const meta = REGIONS[region];
  const dlng = (meta.bbox[2] - meta.bbox[0]) / 50;
  const dlat = (meta.bbox[3] - meta.bbox[1]) / 50;
  return {
    lat: lat + gaussian(rng, 0, dlat),
    lng: lng + gaussian(rng, 0, dlng),
  };
}

function chooseStage(rng: () => number): Stage {
  return weightedPickMap(rng, STAGE_WEIGHTS);
}

function totalRaisedFor(rng: () => number, stage: Stage): number {
  // Rough log-normal anchored to typical UK/US round sizes (£).
  const muMap: Record<Stage, number> = {
    'Pre-Seed': 12.5,
    Seed: 14.5,
    'Series A': 16.2,
    'Series B': 17.5,
    Bridge: 17.0,
    'Series C+': 18.6,
  };
  const sigmaMap: Record<Stage, number> = {
    'Pre-Seed': 0.7,
    Seed: 0.7,
    'Series A': 0.6,
    'Series B': 0.6,
    Bridge: 0.6,
    'Series C+': 0.7,
  };
  return logNormal(rng, muMap[stage], sigmaMap[stage]);
}

function arrFor(rng: () => number, stage: Stage, raised: number): number {
  // ARR is usually a fraction of total raised; growth-stage companies have higher ARR.
  const stageMul: Record<Stage, number> = {
    'Pre-Seed': 0.05,
    Seed: 0.12,
    'Series A': 0.35,
    'Series B': 0.65,
    Bridge: 0.5,
    'Series C+': 1.1,
  };
  const noise = Math.exp(gaussian(rng, 0, 0.45));
  return Math.max(0, raised * stageMul[stage] * noise);
}

function valuationFor(rng: () => number, stage: Stage, raised: number): number {
  const stageMul: Record<Stage, number> = {
    'Pre-Seed': 6,
    Seed: 5,
    'Series A': 6,
    'Series B': 5.5,
    Bridge: 4.5,
    'Series C+': 7,
  };
  const noise = Math.exp(gaussian(rng, 0, 0.5));
  return raised * stageMul[stage] * noise;
}

function visitorsFor(rng: () => number, stage: Stage): number {
  const muMap: Record<Stage, number> = {
    'Pre-Seed': 7,
    Seed: 9,
    'Series A': 11,
    'Series B': 12.5,
    Bridge: 12,
    'Series C+': 14,
  };
  return logNormal(rng, muMap[stage], 1.2);
}

function companySizeFor(rng: () => number, stage: Stage): CompanySize {
  const dist: Record<Stage, number[]> = {
    'Pre-Seed': [0.85, 0.13, 0.02, 0, 0],
    Seed: [0.55, 0.4, 0.05, 0, 0],
    'Series A': [0.1, 0.55, 0.3, 0.05, 0],
    'Series B': [0.02, 0.18, 0.55, 0.2, 0.05],
    Bridge: [0.05, 0.25, 0.4, 0.2, 0.1],
    'Series C+': [0, 0.05, 0.2, 0.35, 0.4],
  };
  return weightedPick(rng, COMPANY_SIZES, dist[stage]);
}

function outcomeFor(
  rng: () => number,
  stage: Stage,
  raised: number,
  valuation: number
): OutcomeStatus {
  if (raised > 1e9 && chance(rng, 0.42)) return 'Unicorn';
  if (raised > 4e8 && chance(rng, 0.16)) return 'Unicorn';
  if (valuation > 2.5e9 && stage === 'Series C+' && chance(rng, 0.11)) return 'IPO';
  if (valuation > 9e8 && chance(rng, 0.048)) return 'IPO';
  if (chance(rng, 0.055)) return 'Acquired';
  if (stage === 'Pre-Seed' && raised < 8e5 && chance(rng, 0.12)) return 'Flopped';
  if (stage === 'Seed' && raised < 2e6 && chance(rng, 0.09)) return 'Flopped';
  if (stage === 'Bridge' && chance(rng, 0.24)) return 'Flopped';
  if (stage === 'Series B' && chance(rng, 0.07)) return 'Flopped';
  if (chance(rng, 0.095)) return 'Flopped';
  return 'Active';
}

function investorProfileFor(rng: () => number): InvestorFirmProfile {
  const dealsLastYear = rangeInt(rng, 2, 52);
  const totalDealsLtm = dealsLastYear * rangeInt(rng, 4, 14) + rangeInt(rng, 8, 120);
  const lead = 0.12 + rng() * 0.55;
  const coInv = 0.25 + rng() * 0.65;
  const unicorn = rng() * 0.14;
  const flop = rng() * 0.22;
  const acq = rng() * 0.18;
  const sum = unicorn + flop + acq;
  const norm = sum > 0.85 ? 0.85 / sum : 1;
  return {
    assetsUnderManagement: logNormal(rng, 16.4, 1.05),
    portfolioCompanies: rangeInt(rng, 8, 190),
    dealsLastYear,
    totalDealsLtm,
    leadRoundRate: lead,
    coInvestorFrequency: Math.min(1, coInv),
    avgDaysBetweenDeals: rangeInt(rng, 28, 220),
    portfolioUnicornRate: unicorn * norm,
    portfolioFlopRate: flop * norm,
    portfolioAcquisitionRate: acq * norm,
    portfolioAvgRaised: logNormal(rng, 14.2, 0.95),
    repeatFounderRate: 0.08 + rng() * 0.42,
    priorExitRate: 0.05 + rng() * 0.28,
    priorFlopRate: 0.02 + rng() * 0.18,
  };
}

function fundraisingStatusFor(
  rng: () => number,
  daysSinceLastRound: number
): FundraisingStatus {
  if (daysSinceLastRound < 90) return 'Recently Raised';
  if (daysSinceLastRound < 540) return 'Mid-Cycle';
  if (chance(rng, 0.6)) return 'Likely Raising';
  return 'Mid-Cycle';
}

function makeFounders(rng: () => number, region: RegionId): Founder[] {
  const count = rangeInt(rng, 1, 3);
  const founders: Founder[] = [];
  const localUnis = universitiesForRegion(region);
  const allUnis = UNIVERSITIES;
  for (let i = 0; i < count; i += 1) {
    const useLocal = chance(rng, 0.7) && localUnis.length > 0;
    const uni = useLocal ? pick(rng, localUnis) : pick(rng, allUnis);
    founders.push({
      name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
      education: weightedPick(rng, EDUCATION_LEVELS, EDU_WEIGHTS),
      background: weightedPick(rng, FOUNDER_BACKGROUNDS, BG_WEIGHTS),
      university: uni.name,
      repeatFounder: chance(rng, 0.18),
      priorExit: chance(rng, 0.07),
      yearsExperience: rangeInt(rng, 2, 22),
    });
  }
  return founders;
}

function makeRounds(
  rng: () => number,
  finalStage: Stage,
  totalRaised: number,
  region: RegionId,
  endDate: Date
): { rounds: Round[]; lastRoundDate: string; investorIds: string[] } {
  const stageOrder: Stage[] = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  const idx = stageOrder.indexOf(finalStage === 'Bridge' ? 'Series B' : finalStage);
  const stages = idx >= 0 ? stageOrder.slice(0, idx + 1) : ['Seed' as Stage];

  // Distribute total raised across rounds (later rounds bigger).
  const weights = stages.map((_, i) => Math.pow(2.4, i));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const cursor = new Date(endDate);
  cursor.setDate(cursor.getDate() - rangeInt(rng, 30, 900));
  const rounds: Round[] = [];
  const investorIds: Set<string> = new Set();
  const localInvestors = INVESTORS_BY_REGION[region] ?? [];

  // Walk backwards through stages so the last entry is the most recent.
  const reverseStages = [...stages].reverse();
  let runningDate = new Date(cursor);
  reverseStages.forEach((st, i) => {
    const w = weights[stages.length - 1 - i] / sumW;
    const amt = totalRaised * w;
    const investorCount = rangeInt(rng, 1, st === 'Pre-Seed' ? 3 : 5);
    const ids: string[] = [];
    for (let j = 0; j < investorCount; j += 1) {
      const useLocal = chance(rng, 0.55) && localInvestors.length > 0;
      const inv = useLocal ? pick(rng, localInvestors) : pick(rng, INVESTORS);
      ids.push(inv.id);
      investorIds.add(inv.id);
    }
    rounds.push({
      stage: st,
      amount: amt,
      date: runningDate.toISOString().slice(0, 10),
      leadInvestorId: ids[0],
      investorIds: ids,
    });
    runningDate = new Date(runningDate);
    runningDate.setDate(runningDate.getDate() - rangeInt(rng, 240, 720));
  });

  rounds.reverse();
  if (finalStage === 'Bridge') {
    const bridgeDate = new Date(endDate);
    bridgeDate.setDate(bridgeDate.getDate() - rangeInt(rng, 30, 200));
    const ids: string[] = [];
    const investorCount = rangeInt(rng, 1, 3);
    for (let j = 0; j < investorCount; j += 1) {
      const inv = pick(rng, INVESTORS);
      ids.push(inv.id);
      investorIds.add(inv.id);
    }
    rounds.push({
      stage: 'Bridge',
      amount: totalRaised * 0.15,
      date: bridgeDate.toISOString().slice(0, 10),
      leadInvestorId: ids[0],
      investorIds: ids,
    });
  }

  const last = rounds[rounds.length - 1];
  return {
    rounds,
    lastRoundDate: last.date,
    investorIds: Array.from(investorIds),
  };
}

function makeEvents(
  rng: () => number,
  startup: { name: string; stage: Stage; vertical: string; subSector: string },
  now: Date
): NewsEvent[] {
  // News window = last 7 days. Most companies have 0; ~8% have one.
  if (!chance(rng, 0.08)) return [];
  const kinds: NewsKind[] = ['fundraise', 'product', 'partnership', 'other'];
  const kindWeights = [0.42, 0.3, 0.18, 0.1];
  const kind = weightedPick(rng, kinds, kindWeights);
  const daysAgo = rangeInt(rng, 0, 6);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);

  let headline: string;
  const bullets: string[] = [];
  if (kind === 'fundraise') {
    headline = `${startup.name} raises ${startup.stage} round`;
    bullets.push('Round led by tier-1 institutional investor');
    bullets.push(`Capital to be deployed across ${startup.vertical} expansion`);
    bullets.push('Hiring across engineering and GTM');
  } else if (kind === 'product') {
    headline = `${startup.name} launches new ${startup.subSector} product`;
    bullets.push('Live in the UK and Europe today');
    bullets.push('Aimed at mid-market customers');
    bullets.push('Pricing tier announced for Q4');
  } else if (kind === 'partnership') {
    headline = `${startup.name} partners with established ${startup.vertical} player`;
    bullets.push('Multi-year commercial agreement');
    bullets.push('Joint go-to-market in Europe');
    bullets.push('Distribution expected to exceed £20M ARR');
  } else {
    headline = `${startup.name} reaches operational milestone`;
    bullets.push('Reached cash-flow break-even ahead of plan');
    bullets.push('Customer base grew over the last quarter');
  }

  return [
    {
      kind,
      headline,
      date: date.toISOString().slice(0, 10),
      source: ['TechCrunch', 'Sifted', 'Bloomberg', 'Reuters', 'The Information'][
        rangeInt(rng, 0, 4)
      ],
      bullets,
    },
  ];
}

function makeStartup(rng: () => number, region: RegionId, idx: number, now: Date): Startup {
  const name = pickName(rng);
  const city = pickCity(rng, region);
  const { lat, lng } = jitterLatLng(rng, city.lat, city.lng, region);
  const stage = chooseStage(rng);
  const totalRaised = totalRaisedFor(rng, stage);
  const arr = arrFor(rng, stage, totalRaised);
  const valuation = valuationFor(rng, stage, totalRaised);
  const visitors = visitorsFor(rng, stage);
  const valMultiple = valuation / Math.max(1e3, totalRaised);
  const entityType = weightedPick(rng, ENTITY_TYPES, ENTITY_WEIGHTS);

  const vertical = weightedPickMap(rng, VERTICAL_WEIGHTS);
  const subList = subSectorsOf(vertical);
  const subSector = subList[rangeInt(rng, 0, subList.length - 1)];

  const founded = new Date(now);
  founded.setFullYear(founded.getFullYear() - rangeInt(rng, 1, 9));

  const { rounds, lastRoundDate, investorIds } = makeRounds(
    rng,
    stage,
    totalRaised,
    region,
    now
  );

  const lastRound = new Date(lastRoundDate);
  const timeToLastRoundDays = Math.max(
    1,
    Math.floor((now.getTime() - lastRound.getTime()) / 86400000)
  );

  const founders =
    entityType === 'Startup'
      ? makeFounders(rng, region)
      : makeFounders(rng, region).slice(0, rangeInt(rng, 1, 2));

  const events =
    entityType === 'Startup'
      ? makeEvents(rng, { name, stage, vertical, subSector }, now)
      : [];

  const investorFirmProfile =
    entityType === 'VC' || entityType === 'Angel' || entityType === 'Other'
      ? investorProfileFor(rng)
      : undefined;

  const outcomeStatus: OutcomeStatus =
    entityType === 'Startup'
      ? outcomeFor(rng, stage, totalRaised, valuation)
      : 'Active';

  return {
    id: `${region}-${idx.toString().padStart(5, '0')}`,
    name,
    region,
    city: city.name,
    lat,
    lng,
    stage,
    vertical,
    subSector,
    entityType,
    totalRaised,
    latestValuation: valuation,
    arr,
    websiteVisitorsMonthly: visitors,
    valuationRaisedMultiple: valMultiple,
    timeToLastRoundDays,
    lastRoundDate,
    founded: founded.toISOString().slice(0, 10),
    companySize: companySizeFor(rng, stage),
    outcomeStatus,
    fundraisingStatus: fundraisingStatusFor(rng, timeToLastRoundDays),
    founders,
    rounds,
    investorIds: investorIds.slice(0, 6),
    events,
    investorFirmProfile,
  };
}

let DATASET_CACHE: { startups: Startup[]; now: Date } | null = null;

export function getDataset(): { startups: Startup[]; now: Date } {
  if (DATASET_CACHE) return DATASET_CACHE;
  // Fix "now" so the dataset is stable across renders, but use a recent feel.
  const now = new Date('2026-04-30T00:00:00Z');
  const startups: Startup[] = [];
  REGION_IDS.forEach((region) => {
    const count = STARTUPS_PER_REGION[region];
    const rng = makeRng(`${SEED}::${region}`);
    for (let i = 0; i < count; i += 1) {
      startups.push(makeStartup(rng, region, i, now));
    }
  });
  DATASET_CACHE = { startups, now };
  return DATASET_CACHE;
}
