import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Startup } from '../../types';

/**
 * City tower shells: one canonical FinTech-style mass (slab + crown) for every
 * vertical and investor type. Per-vertical instancing groups still spread load
 * across batches; only shape + scaleMul differ by row type.
 */

interface PartSpec {
  geometry: THREE.BufferGeometry;
  matrix?: THREE.Matrix4;
}

function part(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): PartSpec {
  return { geometry, matrix };
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, ry = 0): PartSpec {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  if (ry !== 0) m.makeRotationY(ry);
  m.setPosition(x, y + h / 2, z);
  return part(g, m);
}

function mergeParts(parts: PartSpec[]): THREE.BufferGeometry {
  const transformed = parts.map(({ geometry, matrix }) => {
    const cloned = geometry.clone();
    if (matrix) cloned.applyMatrix4(matrix);
    return cloned;
  });
  parts.forEach(({ geometry }) => geometry.dispose());
  const merged = mergeGeometries(transformed, false);
  transformed.forEach((g) => g.dispose());
  if (!merged) throw new Error('mergeGeometries returned null');
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  if (bb) {
    const minY = bb.min.y;
    const maxY = bb.max.y;
    const span = Math.max(maxY - minY, 1e-6);
    merged.translate(0, -minY, 0);
    merged.scale(1, 1 / span, 1);
  }
  merged.computeVertexNormals();
  return merged;
}

/** Sleek glass slab — shared by all city entities. */
function archFinTech(): THREE.BufferGeometry {
  return mergeParts([
    box(0.78, 0.86, 0.62, 0, 0, 0),
  ]);
}

export interface ArchetypeMeta {
  index: number;
  builder: () => THREE.BufferGeometry;
  isInvestor: boolean;
  scaleMul: [number, number, number];
}

export const ARCHETYPES: ArchetypeMeta[] = [
  { index: 0, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 1, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 2, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 3, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 4, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 5, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 6, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 7, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 8, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 9, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 10, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 11, builder: archFinTech, isInvestor: true, scaleMul: [1.12 * 1.1, 1.18 * 1.1, 1.06 * 1.1] },
  { index: 12, builder: archFinTech, isInvestor: true, scaleMul: [0.88 * 1.1, 1.0 * 1.1, 0.88 * 1.1] },
  { index: 13, builder: archFinTech, isInvestor: true, scaleMul: [0.96 * 1.1, 1.0 * 1.1, 0.96 * 1.1] },
];

export const ARCHETYPE_FALLBACK_INDEX = 10;

/** Shared `archFinTech` geometry is normalized to y ∈ [0, 1]. */
export const CITY_SHELL_ROOF_ATTACHMENT_LOCAL_Y = 1.0;

export const INVESTOR_VC_INDEX = 11;
export const INVESTOR_ANGEL_INDEX = 12;
export const INVESTOR_OTHER_INDEX = 13;

const VERTICAL_INDEX: Record<string, number> = {
  fintech: 0,
  healthtech: 1,
  deeptech: 2,
  cleantech: 3,
  ai: 4,
  saas: 5,
  consumer: 6,
  logistics: 7,
  education: 8,
  proptech: 9,
};

export function cityArchetypeIndex(s: Startup): number {
  if (s.entityType === 'VC') return INVESTOR_VC_INDEX;
  if (s.entityType === 'Angel') return INVESTOR_ANGEL_INDEX;
  if (s.entityType !== 'Startup') return INVESTOR_OTHER_INDEX;
  const k = (s.vertical ?? '').toLowerCase().replace(/[^a-z]+/g, '');
  return VERTICAL_INDEX[k] ?? ARCHETYPE_FALLBACK_INDEX;
}

/** Y scale applied in Buildings instancing (must match spire placement). */
export function archetypeScaleY(s: Startup): number {
  return ARCHETYPES[cityArchetypeIndex(s)].scaleMul[1];
}
