import type {
  CompanySize,
  EducationLevel,
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

const DATASET_VERSION = '2026-05-08-realistic-outcomes-v1';
const SEED = `venture-intelligence-map-v2-investor-metrics::${DATASET_VERSION}`;
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
    'Not Raised': 10.95,
    'Pre-Pre Seed': 11.7,
    'Pre-Seed': 12.5,
    'Angel Round': 13.6,
    Seed: 14.5,
    'Series A': 16.2,
    'Series B': 17.5,
    Bridge: 17.0,
    'Series C+': 18.6,
  };
  const sigmaMap: Record<Stage, number> = {
    'Not Raised': 0.35,
    'Pre-Pre Seed': 0.72,
    'Pre-Seed': 0.7,
    'Angel Round': 0.65,
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
    'Not Raised': 0.012,
    'Pre-Pre Seed': 0.03,
    'Pre-Seed': 0.05,
    'Angel Round': 0.08,
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
    'Not Raised': 4.2,
    'Pre-Pre Seed': 6.2,
    'Pre-Seed': 6,
    'Angel Round': 5.2,
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
    'Not Raised': 6.0,
    'Pre-Pre Seed': 6.4,
    'Pre-Seed': 7,
    'Angel Round': 8.2,
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
    'Not Raised': [0.96, 0.04, 0, 0, 0],
    'Pre-Pre Seed': [0.9, 0.09, 0.01, 0, 0],
    'Pre-Seed': [0.85, 0.13, 0.02, 0, 0],
    'Angel Round': [0.72, 0.24, 0.04, 0, 0],
    Seed: [0.55, 0.4, 0.05, 0, 0],
    'Series A': [0.1, 0.55, 0.3, 0.05, 0],
    'Series B': [0.02, 0.18, 0.55, 0.2, 0.05],
    Bridge: [0.05, 0.25, 0.4, 0.2, 0.1],
    'Series C+': [0, 0.05, 0.2, 0.35, 0.4],
  };
  return weightedPick(rng, COMPANY_SIZES, dist[stage]);
}

type ExitRates = {
  flopped: number;
  acquired: number;
  ipo: number;
  unicorn: number;
};

/** Rough cohort mix aligned with venture literature (most cos stay active; exits are tail-heavy by stage). */
function outcomeTier(stage: Stage): 'early' | 'growth' | 'scale' | 'late' {
  if (
    stage === 'Not Raised' ||
    stage === 'Pre-Pre Seed' ||
    stage === 'Pre-Seed' ||
    stage === 'Angel Round' ||
    stage === 'Seed'
  )
    return 'early';
  if (stage === 'Series A') return 'growth';
  if (stage === 'Series B' || stage === 'Bridge') return 'scale';
  return 'late';
}

function outcomeFor(
  rng: () => number,
  stage: Stage,
  raised: number,
  valuation: number
): OutcomeStatus {
  const tier = outcomeTier(stage);

  const base: Record<typeof tier, ExitRates> = {
    // Many early bets fail; liquidity events almost never here
    early: { flopped: 0.2, acquired: 0.035, ipo: 0.002, unicorn: 0.002 },
    // Series A: M&A picks up; still meaningful mortality
    growth: { flopped: 0.11, acquired: 0.065, ipo: 0.004, unicorn: 0.008 },
    // B / bridge: acquihires and follow-on; unicorns still uncommon
    scale: { flopped: 0.075, acquired: 0.085, ipo: 0.01, unicorn: 0.022 },
    // C+: path to IPO / large M&A / unicorn more plausible; failure rarer
    late: { flopped: 0.045, acquired: 0.11, ipo: 0.035, unicorn: 0.055 },
  };

  let { flopped, acquired, ipo, unicorn } = base[tier];

  // Nudge “exit” weights when valuation clearly supports it (keeps tails believable).
  if (valuation >= 1e9) {
    unicorn += 0.04;
    ipo += 0.012;
    acquired += 0.03;
    flopped *= 0.55;
  } else if (valuation >= 4e8) {
    unicorn += 0.015;
    ipo += 0.006;
    acquired += 0.02;
    flopped *= 0.72;
  }

  if (raised < 3e5 && (tier === 'early' || tier === 'growth')) {
    flopped += 0.06;
  }

  const total = flopped + acquired + ipo + unicorn;
  if (total > 0.92) {
    const s = 0.92 / total;
    flopped *= s;
    acquired *= s;
    ipo *= s;
    unicorn *= s;
  }

  const u = rng();
  let c = 0;
  c += flopped;
  if (u < c) return 'Flopped';
  c += acquired;
  if (u < c) return 'Acquired';
  c += ipo;
  if (u < c) return 'IPO';
  c += unicorn;
  if (u < c) return 'Unicorn';
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
  endDate: Date,
  foundedIso: string
): { rounds: Round[]; lastRoundDate: string; investorIds: string[] } {
  if (finalStage === 'Not Raised') {
    return {
      rounds: [],
      lastRoundDate: foundedIso,
      investorIds: [],
    };
  }
  const stageOrder: Stage[] = [
    'Pre-Pre Seed',
    'Pre-Seed',
    'Angel Round',
    'Seed',
    'Series A',
    'Series B',
    'Series C+',
  ];
  const idx = stageOrder.indexOf(finalStage === 'Bridge' ? 'Series B' : finalStage);
  const stages = idx >= 0 ? stageOrder.slice(0, idx + 1) : ['Pre-Seed' as Stage];

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
    let invLo = 3;
    let invHi = 12;
    if (st === 'Pre-Pre Seed') {
      invLo = 2;
      invHi = 5;
    } else if (st === 'Pre-Seed') {
      invLo = 3;
      invHi = 7;
    } else if (st === 'Angel Round') {
      invLo = 4;
      invHi = 9;
    } else if (st === 'Seed') {
      invLo = 6;
      invHi = 10;
    }
    const investorCount = rangeInt(rng, invLo, invHi);
    const ids: string[] = [];
    for (let j = 0; j < investorCount; j += 1) {
      const useLocal = chance(rng, 0.72) && localInvestors.length > 0;
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

function makeInvestorEntity(inv: (typeof INVESTORS)[number], now: Date): Startup {
  const rng = makeRng(`${SEED}::investor::${inv.id}`);
  const entityType: Startup['entityType'] =
    inv.type === 'VC' ? 'VC' : inv.type === 'Angel' ? 'Angel' : 'Other';
  const profile = investorProfileFor(rng);
  // Provide stable-but-plausible values for fields required by encodings/tooltip.
  return {
    id: inv.id,
    name: inv.name,
    region: inv.homeCountry,
    city: REGIONS[inv.homeCountry].hqCities[0]?.name ?? 'HQ',
    lat: 0,
    lng: 0,
    stage: 'Series C+',
    vertical: 'Investors',
    subSector: 'Investor',
    entityType,
    totalRaised: profile.portfolioAvgRaised * 40,
    latestValuation: profile.assetsUnderManagement,
    arr: profile.portfolioAvgRaised * 0.8,
    websiteVisitorsMonthly: 2e6,
    valuationRaisedMultiple: 6,
    timeToLastRoundDays: 120,
    lastRoundDate: now.toISOString().slice(0, 10),
    founded: '2010-01-01',
    companySize: '500+',
    outcomeStatus: 'Active',
    fundraisingStatus: 'Mid-Cycle',
    founders: [],
    rounds: [],
    investorIds: [],
    events: [],
    investorFirmProfile: profile,
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
  const entityType: Startup['entityType'] = 'Startup';

  const vertical = weightedPickMap(rng, VERTICAL_WEIGHTS);
  const subList = subSectorsOf(vertical);
  const subSector = subList[rangeInt(rng, 0, subList.length - 1)];

  const founded = new Date(now);
  founded.setFullYear(founded.getFullYear() - rangeInt(rng, 1, 9));
  const foundedIso = founded.toISOString().slice(0, 10);

  let totalRaised: number;
  let arr: number;
  let valuation: number;
  let visitors: number;
  let rounds: Round[];
  let lastRoundDate: string;
  let investorIds: string[];
  let timeToLastRoundDays: number;

  if (stage === 'Not Raised') {
    totalRaised = Math.max(8e4, totalRaisedFor(rng, stage));
    arr = arrFor(rng, stage, totalRaised);
    valuation = valuationFor(rng, stage, totalRaised);
    visitors = visitorsFor(rng, stage);
    rounds = [];
    investorIds = [];
    lastRoundDate = foundedIso;
    timeToLastRoundDays = rangeInt(rng, 300, 2400);
  } else {
    totalRaised = totalRaisedFor(rng, stage);
    arr = arrFor(rng, stage, totalRaised);
    valuation = valuationFor(rng, stage, totalRaised);
    visitors = visitorsFor(rng, stage);
    const mr = makeRounds(rng, stage, totalRaised, region, now, foundedIso);
    rounds = mr.rounds;
    lastRoundDate = mr.lastRoundDate;
    investorIds = mr.investorIds;
    const lastRound = new Date(lastRoundDate);
    timeToLastRoundDays = Math.max(
      1,
      Math.floor((now.getTime() - lastRound.getTime()) / 86400000)
    );
  }

  const valMultiple = valuation / Math.max(1e3, totalRaised);

  const founders =
    makeFounders(rng, region);

  const events =
    makeEvents(rng, { name, stage, vertical, subSector }, now);

  const investorFirmProfile = undefined;

  const outcomeStatus: OutcomeStatus =
    outcomeFor(rng, stage, totalRaised, valuation);

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
    founded: foundedIso,
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
let DATASET_CACHE_KEY: string | null = null;

export function getDataset(): { startups: Startup[]; now: Date } {
  if (DATASET_CACHE && DATASET_CACHE_KEY === SEED) return DATASET_CACHE;
  // Fix "now" so the dataset is stable across renders, but use a recent feel.
  const now = new Date('2026-04-30T00:00:00Z');
  const startups: Startup[] = [];
  REGION_IDS.forEach((region) => {
    const count = STARTUPS_PER_REGION[region];
    const rng = makeRng(`${SEED}::${region}`);
    for (let i = 0; i < count; i += 1) {
      startups.push(makeStartup(rng, region, i, now));
    }
    // Add real investor entities whose ids match round investorIds.
    const invs = INVESTORS_BY_REGION[region] ?? [];
    invs.forEach((inv) => {
      startups.push(makeInvestorEntity(inv, now));
    });
  });
  DATASET_CACHE = { startups, now };
  DATASET_CACHE_KEY = SEED;
  return DATASET_CACHE;
}
