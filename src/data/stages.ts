import type { Stage, StageBucket } from '../types';

export const STAGES: Stage[] = [
  'Not Raised',
  'Pre-Pre Seed',
  'Pre-Seed',
  'Angel Round',
  'Seed',
  'Series A',
  'Series B',
  'Bridge',
  'Series C+',
];

export const STAGE_WEIGHTS: Record<Stage, number> = {
  'Not Raised': 0.05,
  'Pre-Pre Seed': 0.09,
  'Pre-Seed': 0.13,
  'Angel Round': 0.16,
  Seed: 0.2,
  'Series A': 0.19,
  'Series B': 0.11,
  Bridge: 0.05,
  'Series C+': 0.08,
};

export function bucketFor(stage: Stage): StageBucket {
  if (stage === 'Not Raised') return 'notraised';
  if (stage === 'Pre-Pre Seed' || stage === 'Pre-Seed') return 'pre';
  if (stage === 'Angel Round') return 'angelround';
  if (stage === 'Seed') return 'seed';
  if (stage === 'Series A') return 'growth';
  if (stage === 'Series B' || stage === 'Bridge') return 'scale';
  return 'late';
}

/** Deck / lot-ring accents — visually separated (NR / pre / angel / seed / A / B·C / C+). */
export const STAGE_COLORS: Record<StageBucket, string> = {
  notraised: '#64748b',
  pre: '#b91c1c',
  angelround: '#2563eb',
  seed: '#d97706',
  growth: '#0e7490',
  scale: '#059669',
  late: '#7e22ce',
};

export const SELECTED_COLOR = '#7C3AED';

export function stageColorHex(stage: Stage): string {
  return STAGE_COLORS[bucketFor(stage)];
}
