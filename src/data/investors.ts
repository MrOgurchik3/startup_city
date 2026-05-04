import type { Investor, InvestorType, RegionId } from '../types';

interface RawInvestor {
  name: string;
  type: InvestorType;
  homeCountry: RegionId;
}

const RAW: RawInvestor[] = [
  // US (24)
  { name: 'Sequoia Capital', type: 'VC', homeCountry: 'US' },
  { name: 'Andreessen Horowitz', type: 'VC', homeCountry: 'US' },
  { name: 'Accel', type: 'VC', homeCountry: 'US' },
  { name: 'Benchmark', type: 'VC', homeCountry: 'US' },
  { name: 'Founders Fund', type: 'VC', homeCountry: 'US' },
  { name: 'Greylock Partners', type: 'VC', homeCountry: 'US' },
  { name: 'Khosla Ventures', type: 'VC', homeCountry: 'US' },
  { name: 'Bessemer Venture Partners', type: 'VC', homeCountry: 'US' },
  { name: 'GV', type: 'VC', homeCountry: 'US' },
  { name: 'Lightspeed Ventures', type: 'VC', homeCountry: 'US' },
  { name: 'Kleiner Perkins', type: 'VC', homeCountry: 'US' },
  { name: 'Tiger Global', type: 'VC', homeCountry: 'US' },
  { name: 'Coatue', type: 'VC', homeCountry: 'US' },
  { name: 'General Catalyst', type: 'VC', homeCountry: 'US' },
  { name: 'NEA', type: 'VC', homeCountry: 'US' },
  { name: 'IVP', type: 'VC', homeCountry: 'US' },
  { name: 'Insight Partners', type: 'VC', homeCountry: 'US' },
  { name: 'Y Combinator', type: 'Accelerator', homeCountry: 'US' },
  { name: 'Techstars', type: 'Accelerator', homeCountry: 'US' },
  { name: 'Naval Ravikant', type: 'Angel', homeCountry: 'US' },
  { name: 'Elad Gil', type: 'Angel', homeCountry: 'US' },
  { name: 'Blackstone', type: 'PE', homeCountry: 'US' },
  { name: 'KKR', type: 'PE', homeCountry: 'US' },
  { name: 'In-Q-Tel', type: 'Government', homeCountry: 'US' },

  // UK (10)
  { name: 'Index Ventures', type: 'VC', homeCountry: 'UK' },
  { name: 'Balderton Capital', type: 'VC', homeCountry: 'UK' },
  { name: 'Atomico', type: 'VC', homeCountry: 'UK' },
  { name: 'LocalGlobe', type: 'VC', homeCountry: 'UK' },
  { name: 'Hoxton Ventures', type: 'VC', homeCountry: 'UK' },
  { name: 'Octopus Ventures', type: 'VC', homeCountry: 'UK' },
  { name: 'Seedcamp', type: 'Accelerator', homeCountry: 'UK' },
  { name: 'Entrepreneur First', type: 'Accelerator', homeCountry: 'UK' },
  { name: 'British Business Bank', type: 'Government', homeCountry: 'UK' },
  { name: 'Robin Klein', type: 'Angel', homeCountry: 'UK' },

  // DE (5)
  { name: 'Earlybird VC', type: 'VC', homeCountry: 'DE' },
  { name: 'HV Capital', type: 'VC', homeCountry: 'DE' },
  { name: 'Project A', type: 'VC', homeCountry: 'DE' },
  { name: 'Cherry Ventures', type: 'VC', homeCountry: 'DE' },
  { name: 'KfW Capital', type: 'Government', homeCountry: 'DE' },

  // FR (3)
  { name: 'Partech', type: 'VC', homeCountry: 'FR' },
  { name: 'Eurazeo', type: 'VC', homeCountry: 'FR' },
  { name: 'Bpifrance', type: 'Government', homeCountry: 'FR' },

  // Nordics (4)
  { name: 'EQT Ventures', type: 'VC', homeCountry: 'NORDICS' },
  { name: 'Creandum', type: 'VC', homeCountry: 'NORDICS' },
  { name: 'Northzone', type: 'VC', homeCountry: 'NORDICS' },
  { name: 'Heartcore Capital', type: 'VC', homeCountry: 'NORDICS' },

  // WE (3)
  { name: 'Lakestar', type: 'VC', homeCountry: 'WE' },
  { name: 'Speedinvest', type: 'VC', homeCountry: 'WE' },
  { name: 'Prime Ventures', type: 'VC', homeCountry: 'WE' },

  // IN (3)
  { name: 'Peak XV Partners', type: 'VC', homeCountry: 'IN' },
  { name: 'Blume Ventures', type: 'VC', homeCountry: 'IN' },
  { name: 'Nexus Venture Partners', type: 'VC', homeCountry: 'IN' },
];

export const INVESTORS: Investor[] = RAW.map((r, idx) => ({
  id: `inv_${idx.toString().padStart(3, '0')}`,
  name: r.name,
  type: r.type,
  homeCountry: r.homeCountry,
}));

export const INVESTOR_BY_ID: Record<string, Investor> = Object.fromEntries(
  INVESTORS.map((i) => [i.id, i])
);

export const INVESTORS_BY_REGION: Record<RegionId, Investor[]> = (() => {
  const acc: Record<string, Investor[]> = {};
  INVESTORS.forEach((i) => {
    (acc[i.homeCountry] ??= []).push(i);
  });
  return acc as Record<RegionId, Investor[]>;
})();
