import * as THREE from 'three';
import type { Geometry, Position } from 'geojson';
import { lngLatToSphere } from '../../lib/projection';

/** Bbox in lng/lat: minLng, minLat, maxLng, maxLat. Drops overseas fragments (e.g. FR/ES islands). */
export type LngLatBBox = [number, number, number, number];

type RingBounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

function ringLngLatBounds(ring: Position[]): RingBounds {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  ring.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  return { minLng, maxLng, minLat, maxLat };
}

function lngLatBBoxesIntersect(clip: LngLatBBox, ring: RingBounds): boolean {
  const [cMinLng, cMinLat, cMaxLng, cMaxLat] = clip;
  return !(
    ring.maxLng < cMinLng ||
    ring.minLng > cMaxLng ||
    ring.maxLat < cMinLat ||
    ring.minLat > cMaxLat
  );
}

/**
 * Keep polygon parts whose outer-ring lng/lat bounds intersect the clip bbox
 * (robust for MultiPolygons / islands vs centroid-only filters).
 * Returns null if nothing remains (caller should fall back to outline).
 */
export function clipGeometryToLngLatBBox(geom: Geometry, bbox: LngLatBBox): Geometry | null {
  if (geom.type === 'Polygon') {
    const outer = geom.coordinates[0];
    return lngLatBBoxesIntersect(bbox, ringLngLatBounds(outer)) ? geom : null;
  }
  if (geom.type === 'MultiPolygon') {
    const kept = geom.coordinates.filter((poly) =>
      lngLatBBoxesIntersect(bbox, ringLngLatBounds(poly[0]))
    );
    if (kept.length === 0) return null;
    if (kept.length === 1) return { type: 'Polygon', coordinates: kept[0] };
    return { type: 'MultiPolygon', coordinates: kept };
  }
  return null;
}

/** A polygon is [outerRing, ...holeRings]; each ring is a closed list of [lng,lat] points. */
export type PolyRings = Position[][];

export function polysFromGeometry(geom: Geometry): PolyRings[] {
  if (geom.type === 'Polygon') return [geom.coordinates as PolyRings];
  if (geom.type === 'MultiPolygon') return geom.coordinates as PolyRings[];
  return [];
}

/**
 * Insert intermediate vertices along each lng/lat edge so straight-line lng/lat
 * segments approximate great-circle curves once projected to the sphere.
 * Input ring is closed (first==last); output ring is also closed.
 */
function subdivideRing(ring: Position[], maxStepDeg: number): Position[] {
  if (ring.length < 2) return ring.slice();
  const out: Position[] = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    out.push([lng1, lat1]);
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    const dist = Math.hypot(dLng, dLat);
    const steps = Math.max(1, Math.ceil(dist / maxStepDeg));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      out.push([lng1 + dLng * t, lat1 + dLat * t]);
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}

interface RingSpan {
  start: number;
  count: number;
  isOuter: boolean;
}

interface TriangulatedPoly {
  /** Open polyline vertices (closing duplicate dropped) for outer + holes, concatenated. */
  verts: Position[];
  /** Triangle index triples into `verts`. */
  triangles: [number, number, number][];
  /** One span per ring (outer first, then holes). Each span is [start, count) in `verts`. */
  rings: RingSpan[];
}

function triangulatePoly(rings: PolyRings, stepDeg: number): TriangulatedPoly | null {
  if (rings.length === 0) return null;
  const subdivided = rings.map((r) => subdivideRing(r, stepDeg).slice(0, -1));
  const [outer, ...holes] = subdivided;
  if (!outer || outer.length < 3) return null;

  const contour2D = outer.map(([lng, lat]) => new THREE.Vector2(lng, lat));
  const holes2D = holes.map((h) => h.map(([lng, lat]) => new THREE.Vector2(lng, lat)));

  let triangles: number[][];
  try {
    triangles = THREE.ShapeUtils.triangulateShape(contour2D, holes2D);
  } catch {
    return null;
  }

  const verts: Position[] = outer.slice();
  const ringSpans: RingSpan[] = [{ start: 0, count: outer.length, isOuter: true }];
  let cursor = outer.length;
  holes.forEach((h) => {
    h.forEach((p) => verts.push(p));
    ringSpans.push({ start: cursor, count: h.length, isOuter: false });
    cursor += h.length;
  });

  return {
    verts,
    triangles: triangles.map((t) => [t[0], t[1], t[2]]),
    rings: ringSpans,
  };
}

/**
 * Earth-hugging triangulated mesh on a sphere of radius `radius`. Each polygon
 * vertex is projected via `lngLatToSphere`, with edges pre-subdivided so the
 * polygon outline approximates great-circle arcs.
 */
export function buildSpheredFlatGeometry(
  polys: PolyRings[],
  radius: number,
  stepDeg = 1.5
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const indices: number[] = [];

  polys.forEach((rings) => {
    const tri = triangulatePoly(rings, stepDeg);
    if (!tri) return;
    const offset = positions.length / 3;
    tri.verts.forEach(([lng, lat]) => {
      const p = lngLatToSphere(lng, lat, radius);
      positions.push(p.x, p.y, p.z);
    });
    tri.triangles.forEach(([a, b, c]) => {
      indices.push(offset + a, offset + b, offset + c);
    });
  });

  if (indices.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  return geom;
}

/**
 * Radially-extruded mesh: each polygon vertex gets two copies (base on
 * `baseRadius`, top on `baseRadius + height`). Top cap + sidewalls; bottom
 * cap is omitted (it's against the ocean sphere and never visible).
 */
export function buildSpheredExtrudedGeometry(
  polys: PolyRings[],
  baseRadius: number,
  height: number,
  stepDeg = 1.5
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const indices: number[] = [];

  polys.forEach((rings) => {
    const tri = triangulatePoly(rings, stepDeg);
    if (!tri) return;
    const baseOff = positions.length / 3;
    const N = tri.verts.length;

    // Layout: [base 0..N-1, top N..2N-1]
    tri.verts.forEach(([lng, lat]) => {
      const p = lngLatToSphere(lng, lat, baseRadius);
      positions.push(p.x, p.y, p.z);
    });
    tri.verts.forEach(([lng, lat]) => {
      const p = lngLatToSphere(lng, lat, baseRadius + height);
      positions.push(p.x, p.y, p.z);
    });

    // Top cap (on the lifted vertices).
    tri.triangles.forEach(([a, b, c]) => {
      indices.push(baseOff + N + a, baseOff + N + b, baseOff + N + c);
    });

    // Sidewalls. Outer rings are CCW in lng/lat (standard GeoJSON), holes CW;
    // flipping winding for holes keeps the outward face oriented away from the
    // filled interior in both cases.
    tri.rings.forEach((span) => {
      for (let i = 0; i < span.count; i += 1) {
        const a = baseOff + span.start + i;
        const b = baseOff + span.start + ((i + 1) % span.count);
        const aT = a + N;
        const bT = b + N;
        if (span.isOuter) {
          indices.push(a, aT, b);
          indices.push(b, aT, bT);
        } else {
          indices.push(a, b, aT);
          indices.push(b, bT, aT);
        }
      }
    });
  });

  if (indices.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  return geom;
}
