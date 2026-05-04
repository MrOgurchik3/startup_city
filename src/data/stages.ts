import type { Stage, StageBucket } from '../types';

export const STAGES: Stage[] = [
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B',
  'Bridge',
  'Series C+',
];

export const STAGE_WEIGHTS: Record<Stage, number> = {
  'Pre-Seed': 0.18,
  Seed: 0.32,
  'Series A': 0.22,
  'Series B': 0.14,
  Bridge: 0.06,
  'Series C+': 0.08,
};

export function bucketFor(stage: Stage): StageBucket {
  if (stage === 'Pre-Seed' || stage === 'Seed') return 'pre';
  if (stage === 'Series A') return 'growth';
  if (stage === 'Series B' || stage === 'Bridge') return 'scale';
  return 'late';
}

/** Deck-aligned stage accents (red / amber / green / purple). */
export const STAGE_COLORS: Record<StageBucket, string> = {
  pre: '#DC2626',
  growth: '#F59E0B',
  scale: '#10B981',
  late: '#7C3AED',
};

export const SELECTED_COLOR = '#7C3AED';

export function stageColorHex(stage: Stage): string {
  return STAGE_COLORS[bucketFor(stage)];
}
