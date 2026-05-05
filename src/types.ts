export type Mode = 'global' | 'city';

export type RegionId =
  | 'UK'
  | 'US'
  | 'DE'
  | 'FR'
  | 'NORDICS'
  | 'WE'
  | 'IN';

export type Stage =
  | 'Not Raised'
  | 'Pre-Pre Seed'
  | 'Pre-Seed'
  | 'Angel Round'
  | 'Seed'
  | 'Series A'
  | 'Series B'
  | 'Bridge'
  | 'Series C+';

export type StageBucket =
  | 'notraised'
  | 'pre'
  | 'angelround'
  | 'seed'
  | 'growth'
  | 'scale'
  | 'late';

export type EntityType = 'Startup' | 'VC' | 'Angel' | 'Other';

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';

export type InvestorType =
  | 'VC'
  | 'Angel'
  | 'PE'
  | 'Accelerator'
  | 'Government';

export type OutcomeStatus =
  | 'Active'
  | 'Unicorn'
  | 'Acquired'
  | 'Flopped'
  | 'IPO';

/** Populated for investor entity rows (VC, Angel, sometimes Other). */
export interface InvestorFirmProfile {
  assetsUnderManagement: number;
  portfolioCompanies: number;
  dealsLastYear: number;
  /** LTM deal count (city height/footprint encoding uses this + portfolio stats). */
  totalDealsLtm: number;
  /** Share of rounds where this firm led (0–1). */
  leadRoundRate: number;
  /** Share of rounds with multiple institutional co-investors (0–1). */
  coInvestorFrequency: number;
  avgDaysBetweenDeals: number;
  portfolioUnicornRate: number;
  portfolioFlopRate: number;
  portfolioAcquisitionRate: number;
  portfolioAvgRaised: number;
  repeatFounderRate: number;
  priorExitRate: number;
  priorFlopRate: number;
}

export type FundraisingStatus =
  | 'Likely Raising'
  | 'Mid-Cycle'
  | 'Recently Raised';

export type EducationLevel =
  | 'BSc'
  | 'MSc'
  | 'MBA'
  | 'PhD'
  | 'No Degree'
  | 'Other';

export type FounderBackground =
  | 'Finance'
  | 'Engineering'
  | 'Product'
  | 'Sales'
  | 'Science'
  | 'Operations'
  | 'Design';

export type TimePeriod = 'Month' | 'Quarter' | 'Year' | 'LTM' | 'YTD';

export type NewsKind = 'fundraise' | 'product' | 'partnership' | 'other';

export interface Founder {
  name: string;
  education: EducationLevel;
  background: FounderBackground;
  university: string;
  repeatFounder: boolean;
  priorExit: boolean;
  yearsExperience: number;
}

export interface Round {
  stage: Stage;
  amount: number;
  date: string; // ISO yyyy-mm-dd
  leadInvestorId?: string;
  investorIds: string[];
}

export interface NewsEvent {
  kind: NewsKind;
  headline: string;
  date: string;
  source: string;
  bullets: string[];
}

export interface Investor {
  id: string;
  name: string;
  type: InvestorType;
  homeCountry: RegionId;
}

export interface Startup {
  id: string;
  name: string;
  region: RegionId;
  city: string;
  lat: number;
  lng: number;
  stage: Stage;
  vertical: string;
  subSector: string;
  entityType: EntityType;
  totalRaised: number;
  latestValuation: number;
  arr: number;
  websiteVisitorsMonthly: number;
  valuationRaisedMultiple: number;
  timeToLastRoundDays: number;
  lastRoundDate: string;
  founded: string;
  companySize: CompanySize;
  outcomeStatus: OutcomeStatus;
  fundraisingStatus: FundraisingStatus;
  founders: Founder[];
  rounds: Round[];
  investorIds: string[]; // top investors, ordered
  events: NewsEvent[];
  investorFirmProfile?: InvestorFirmProfile;
}

export interface InvestmentEdge {
  investorCountry: RegionId;
  startupCountry: RegionId;
  totalCapital: number;
  dealCount: number;
  avgRoundSize: number;
}

export interface RegionAggregate {
  region: RegionId;
  totalCapitalDeployedLtm: number;
  dealFlowVolume: number;
  startupCount: number;
  investorCount: number;
}

export interface FilterState {
  vertical: string[];
  subSector: string[];
  stage: Stage[];
  geography: RegionId[];
  companySize: CompanySize[];
  investorType: InvestorType[];
  investorName: string[];
  timePeriod: TimePeriod;
  outcomeStatus: OutcomeStatus[];
  fundraisingStatus: FundraisingStatus[];
  education: EducationLevel[];
  founderBackground: FounderBackground[];
  university: string[];
  repeatFounder: 'any' | 'yes' | 'no';
  priorExit: 'any' | 'yes' | 'no';
}

export interface RegionMeta {
  id: RegionId;
  name: string;
  flag: string;
  iso3: string[]; // ISO_A3 codes for the world-atlas TopoJSON match
  bbox: [number, number, number, number]; // lng_min, lat_min, lng_max, lat_max
  centroid: [number, number]; // lng, lat
  outline: [number, number][]; // simplified silhouette polygon (lng, lat)
  hqCities: { name: string; lat: number; lng: number; weight: number }[];
}
