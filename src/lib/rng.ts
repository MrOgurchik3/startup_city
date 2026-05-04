import seedrandom from 'seedrandom';

export type RNG = () => number;

export function makeRng(seed: string): RNG {
  return seedrandom(seed);
}

export function rangeInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function rangeFloat(rng: RNG, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function weightedPick<T>(
  rng: RNG,
  items: readonly T[],
  weights: readonly number[]
): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function weightedPickMap<T extends string>(
  rng: RNG,
  weightMap: Record<T, number>
): T {
  const keys = Object.keys(weightMap) as T[];
  const weights = keys.map((k) => weightMap[k]);
  return weightedPick(rng, keys, weights);
}

// Box-Muller gaussian.
export function gaussian(rng: RNG, mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function logNormal(rng: RNG, mu: number, sigma: number): number {
  return Math.exp(gaussian(rng, mu, sigma));
}

export function chance(rng: RNG, p: number): boolean {
  return rng() < p;
}
