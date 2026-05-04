import type { RegionId } from '../types';

/** Arc ribbon colour = investor (origin) country — same keys as `REGIONS`. */
export const REGION_FLOW_ORIGIN_COLORS: Record<RegionId, string> = {
  UK: '#c62828',
  US: '#1565c0',
  DE: '#37474f',
  FR: '#0277bd',
  NORDICS: '#00897b',
  WE: '#6a1b9a',
  IN: '#ef6c00',
};
