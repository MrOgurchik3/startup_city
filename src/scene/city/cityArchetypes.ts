import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Startup } from '../../types';

/**
 * Vertical-typed startup archetypes + the existing 3 investor archetypes,
 * authored procedurally as merged primitive geometries. Each archetype is
 * normalised to:
 *   x, z ∈ [-0.5, 0.5]   (footprint inside one lot cell)
 *   y    ∈ [0, 1]        (origin at base, top at y=1)
 * so the per-instance scale matrix `(w, h, w)` from Buildings.tsx works
 * uniformly. UVs are inherited from the source primitives — the building
 * shader's window grid tiles per-face, which gives a "modular" look on
 * stacked archetypes (intentional, reads as floor banding).
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

function cyl(rTop: number, rBot: number, h: number, segs: number, x = 0, y = 0, z = 0): PartSpec {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs, 1, false);
  const m = new THREE.Matrix4().setPosition(x, y + h / 2, z);
  return part(g, m);
}

function dome(r: number, x = 0, y = 0, z = 0): PartSpec {
  // Upper hemisphere of a sphere (theta 0..π/2).
  const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Matrix4().setPosition(x, y, z);
  return part(g, m);
}

function cone(r: number, h: number, segs: number, x = 0, y = 0, z = 0): PartSpec {
  const g = new THREE.ConeGeometry(r, h, segs);
  const m = new THREE.Matrix4().setPosition(x, y + h / 2, z);
  return part(g, m);
}

function tiltedPanel(w: number, d: number, tiltDeg: number, x: number, y: number, z: number): PartSpec {
  const g = new THREE.BoxGeometry(w, 0.025, d);
  const m = new THREE.Matrix4()
    .makeRotationX(THREE.MathUtils.degToRad(tiltDeg))
    .setPosition(x, y, z);
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
  // Snap base to y=0 + force unit-height scale so per-instance height works.
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

// ---------- Archetypes ----------

// 0 — FinTech: sleek glass slab with a subtle setback at the crown.
function archFinTech(): THREE.BufferGeometry {
  return mergeParts([
    box(0.78, 0.86, 0.62, 0, 0, 0),
    box(0.66, 0.10, 0.52, 0, 0.86, 0),
    box(0.04, 0.06, 0.04, 0, 0.96, 0), // crown pin
  ]);
}

// 1 — HealthTech: cross-shaped footprint (medical "+").
function archHealthTech(): THREE.BufferGeometry {
  return mergeParts([
    box(0.88, 0.78, 0.32, 0, 0, 0),
    box(0.32, 0.78, 0.88, 0, 0, 0),
    // Lifted central tower
    box(0.30, 0.18, 0.30, 0, 0.78, 0),
    box(0.04, 0.10, 0.04, 0, 0.96, 0), // antenna
  ]);
}

// 2 — DeepTech: cylindrical reactor with a hemisphere top + antenna.
function archDeepTech(): THREE.BufferGeometry {
  return mergeParts([
    cyl(0.42, 0.46, 0.74, 24, 0, 0, 0),
    dome(0.42, 0, 0.74, 0),
    cyl(0.015, 0.015, 0.18, 6, 0, 1.16, 0), // antenna spike
  ]);
}

// 3 — CleanTech: low slab with tilted solar-panel array on the roof.
function archCleanTech(): THREE.BufferGeometry {
  const parts: PartSpec[] = [box(0.86, 0.46, 0.86, 0, 0, 0)];
  // 3×3 grid of tilted panels.
  const tilt = 22;
  const yPanels = 0.50;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const x = (i - 1) * 0.26;
      const z = (j - 1) * 0.26;
      parts.push(tiltedPanel(0.22, 0.18, tilt, x, yPanels, z));
    }
  }
  // Small inverter cabinet on the roof.
  parts.push(box(0.12, 0.06, 0.12, -0.34, 0.46, 0.34));
  return mergeParts(parts);
}

// 4 — AI: tapered obelisk with a needle spire.
function archAI(): THREE.BufferGeometry {
  return mergeParts([
    box(0.50, 0.78, 0.50, 0, 0, 0),
    cone(0.30, 0.20, 4, 0, 0.78, 0), // pyramid cap (4-sided)
    cyl(0.012, 0.012, 0.16, 4, 0, 0.98, 0), // needle
  ]);
}

// 5 — SaaS: stacked offset modules ("server racks" / Lego-like).
function archSaaS(): THREE.BufferGeometry {
  return mergeParts([
    box(0.62, 0.24, 0.58, 0, 0, 0),
    box(0.56, 0.22, 0.62, 0.04, 0.24, -0.02, Math.PI / 12),
    box(0.58, 0.22, 0.54, -0.04, 0.46, 0.02, -Math.PI / 14),
    box(0.50, 0.22, 0.56, 0.02, 0.68, -0.04, Math.PI / 16),
    box(0.44, 0.10, 0.44, 0, 0.90, 0),
  ]);
}

// 6 — Consumer: retail block + uplifted marquee sign.
function archConsumer(): THREE.BufferGeometry {
  return mergeParts([
    box(0.92, 0.36, 0.78, 0, 0, 0),
    box(0.66, 0.42, 0.58, 0, 0.36, 0),
    // Marquee sign on top
    box(0.58, 0.14, 0.06, 0, 0.78, 0.30),
    box(0.04, 0.08, 0.04, -0.24, 0.92, 0.30),
    box(0.04, 0.08, 0.04, 0.24, 0.92, 0.30),
  ]);
}

// 7 — Logistics: long warehouse + shipping containers stacked.
function archLogistics(): THREE.BufferGeometry {
  return mergeParts([
    box(0.94, 0.36, 0.66, 0, 0, 0),
    // Saw-tooth roof: 3 short ridges
    box(0.94, 0.05, 0.20, 0, 0.36, -0.22),
    box(0.94, 0.05, 0.20, 0, 0.36, 0.0),
    box(0.94, 0.05, 0.20, 0, 0.36, 0.22),
    // Stacked containers
    box(0.32, 0.16, 0.16, -0.28, 0.41, 0.30),
    box(0.32, 0.16, 0.16, 0.04, 0.41, 0.30),
    box(0.32, 0.16, 0.16, -0.12, 0.57, 0.30),
  ]);
}

// 8 — Education: classical campus — colonnade + flat-roof entablature.
function archEducation(): THREE.BufferGeometry {
  const parts: PartSpec[] = [
    // Foundation step
    box(0.94, 0.08, 0.84, 0, 0, 0),
    // Inner cella
    box(0.62, 0.66, 0.50, 0, 0.08, 0),
  ];
  // 6 columns around the front + sides
  const colH = 0.66;
  const yCol = 0.08;
  const colR = 0.045;
  const cols: [number, number][] = [
    [-0.42, 0.36], [-0.14, 0.36], [0.14, 0.36], [0.42, 0.36],
    [-0.42, -0.36], [0.42, -0.36],
  ];
  cols.forEach(([x, z]) => parts.push(cyl(colR, colR, colH, 12, x, yCol, z)));
  // Entablature + low pediment
  parts.push(box(0.96, 0.08, 0.88, 0, 0.74, 0));
  parts.push(box(0.92, 0.06, 0.84, 0, 0.82, 0));
  parts.push(box(0.40, 0.08, 0.06, 0, 0.88, 0.42)); // front cornice piece
  return mergeParts(parts);
}

// 9 — PropTech: wide podium + offset narrow tower (mixed-use).
function archPropTech(): THREE.BufferGeometry {
  return mergeParts([
    box(0.92, 0.30, 0.86, 0, 0, 0),
    box(0.50, 0.66, 0.50, 0.10, 0.30, -0.10),
    box(0.42, 0.06, 0.42, 0.10, 0.96, -0.10),
    box(0.06, 0.06, 0.06, 0.10, 1.02, -0.10), // crown
  ]);
}

// 10 — Fallback (unknown vertical): plain extruded block.
function archFallback(): THREE.BufferGeometry {
  return mergeParts([box(0.78, 1.0, 0.62, 0, 0, 0)]);
}

// 11 — Investor / VC: tall triangular prism (HQ tower).
function archInvestorVC(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = 0.68;
  shape.moveTo(0, r * 0.55);
  shape.lineTo(-r * 0.866, -r * 0.28);
  shape.lineTo(r * 0.866, -r * 0.28);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  // Normalise base + height
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb) {
    const minY = bb.min.y;
    const span = Math.max(bb.max.y - minY, 1e-6);
    g.translate(0, -minY, 0);
    g.scale(1, 1 / span, 1);
  }
  return g;
}

// 12 — Investor / Angel: slim square tower.
function archInvestorAngel(): THREE.BufferGeometry {
  return mergeParts([box(0.38, 1.0, 0.38, 0, 0, 0)]);
}

// 13 — Investor / Other: hexagonal column.
function archInvestorOther(): THREE.BufferGeometry {
  return mergeParts([cyl(0.34, 0.36, 1.0, 6, 0, 0, 0)]);
}

export interface ArchetypeMeta {
  index: number;
  builder: () => THREE.BufferGeometry;
  isInvestor: boolean;
  /** Per-axis multiplier on top of the (w, h, w) per-instance footprint. */
  scaleMul: [number, number, number];
}

export const ARCHETYPES: ArchetypeMeta[] = [
  { index: 0, builder: archFinTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 1, builder: archHealthTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 2, builder: archDeepTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 3, builder: archCleanTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 4, builder: archAI, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 5, builder: archSaaS, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 6, builder: archConsumer, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 7, builder: archLogistics, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 8, builder: archEducation, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 9, builder: archPropTech, isInvestor: false, scaleMul: [1, 1, 1] },
  { index: 10, builder: archFallback, isInvestor: false, scaleMul: [1, 1, 1] },
  // Investor footprint multipliers preserve the prior visual weight (was INV_FOOTPRINT_MUL = 1.1).
  { index: 11, builder: archInvestorVC, isInvestor: true, scaleMul: [1.12 * 1.1, 1.18 * 1.1, 1.06 * 1.1] },
  { index: 12, builder: archInvestorAngel, isInvestor: true, scaleMul: [0.88 * 1.1, 1.0 * 1.1, 0.88 * 1.1] },
  { index: 13, builder: archInvestorOther, isInvestor: true, scaleMul: [0.96 * 1.1, 1.0 * 1.1, 0.96 * 1.1] },
];

export const ARCHETYPE_FALLBACK_INDEX = 10;
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
