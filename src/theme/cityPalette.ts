import * as THREE from 'three';

const _tmpA = new THREE.Color();
const _tmpB = new THREE.Color();
const _tmpOut = new THREE.Color();

/** Linear RGB mix between two hex colours (t in 0..1). */
export function mixHex(a: string, b: string, t: number): string {
  _tmpA.set(a);
  _tmpB.set(b);
  _tmpOut.copy(_tmpA).lerp(_tmpB, t);
  return `#${_tmpOut.getHexString()}`;
}

const ACTIVE_NAV = '#0D2D52';
const TEAL_MAIN = '#0D9488';

/**
 * City scene + VCMI deck tokens (BI dashboard: teal data, purple accents).
 */
export const CITY_PALETTE = {
  pageBg: '#F8FAFD',
  cardBg: '#FFFFFF',
  borderLight: '#E2E8F0',
  textMain: '#0F172A',
  textMuted: '#64748B',

  activeNav: ACTIVE_NAV,
  /** VC lots: active nav + teal tint (distinct from angel/other). */
  investorVc: mixHex(ACTIVE_NAV, TEAL_MAIN, 0.22),
  investorAngel: '#153a5c',
  investorOther: '#102a42',

  tealMain: TEAL_MAIN,
  tealBright: '#14B8A6',
  purpleMain: '#7C3AED',

  /** Aliases for IPO / M&A (shader + legend). */
  mint: TEAL_MAIN,
  violet: '#7C3AED',

  ink: '#0F172A',
  startupFlopped: '#0f172a',
  cream: '#F8FAFD',
  creamCool: '#f1f5f9',
  stone: '#e2e8f0',
  asphalt: '#2c3548',
  asphaltEdge: '#1e2636',
  /** Softer roads if used on light surfaces. */
  asphaltPlaza: '#7d8896',
  asphaltPlazaEdge: '#5f6b7a',

  amber: '#F59E0B',
  coral: '#EF4346',

  /** Canvas / fog — light sky (same as clear color). */
  mapLightSky: '#f5f3ee',
  /** Infinite sky shell: light theme only (zenith → haze → soft horizon band). */
  mapSkyHaze: '#e8eef6',
  mapSkyHorizon: '#d2e0f0',

  /** Global map ocean + city infinite floor / main lot slab (same hex). */
  mapOceanFloor: '#0b1120',
} as const;
