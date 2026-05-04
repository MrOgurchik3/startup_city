import * as THREE from 'three';
import type { Geometry, Polygon, MultiPolygon, Position } from 'geojson';
import { lngLatToWorld } from '../../lib/projection';

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

// Build an array of THREE.Shape objects from a GeoJSON Polygon or MultiPolygon.
// Returns [] for unsupported geometries (e.g. Points).
export function shapesFromGeometry(geom: Geometry): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  if (geom.type === 'Polygon') {
    shapes.push(shapeFromCoordinates(geom.coordinates));
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach((polyCoords) => {
      shapes.push(shapeFromCoordinates(polyCoords));
    });
  }
  return shapes;
}

function shapeFromCoordinates(rings: Position[][]): THREE.Shape {
  const [outer, ...holes] = rings;
  const shape = new THREE.Shape();
  // We negate the projected z because `ExtrudeGeometry` plus a `rotateX(-PI/2)`
  // would otherwise flip the latitude axis (north would land at +z). Storing the
  // shape with `(x, -z_world)` cancels that out so north correctly ends up at -z.
  outer.forEach(([lng, lat], i) => {
    const [x, z] = lngLatToWorld(lng, lat);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  holes.forEach((hole) => {
    const path = new THREE.Path();
    hole.forEach(([lng, lat], i) => {
      const [x, z] = lngLatToWorld(lng, lat);
      if (i === 0) path.moveTo(x, -z);
      else path.lineTo(x, -z);
    });
    path.closePath();
    shape.holes.push(path);
  });
  return shape;
}

export function buildExtrudedGeometry(
  shapes: THREE.Shape[],
  height: number
): THREE.BufferGeometry {
  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
  });
  // ExtrudeGeometry extrudes along +z; we want extrude along +y.
  geom.rotateX(-Math.PI / 2);
  return geom;
}

export function buildFlatGeometry(shapes: THREE.Shape[]): THREE.BufferGeometry {
  const geom = new THREE.ShapeGeometry(shapes);
  geom.rotateX(-Math.PI / 2);
  return geom;
}

// Convert geometry rings to outline points in world coordinates.
export function outlinesFromGeometry(
  geom: Polygon | MultiPolygon,
  y: number
): [number, number, number][][] {
  const out: [number, number, number][][] = [];
  if (geom.type === 'Polygon') {
    geom.coordinates.forEach((ring) =>
      out.push(ring.map(([lng, lat]) => projWithY(lng, lat, y)))
    );
  } else {
    geom.coordinates.forEach((poly) =>
      poly.forEach((ring) =>
        out.push(ring.map(([lng, lat]) => projWithY(lng, lat, y)))
      )
    );
  }
  return out;
}

function projWithY(lng: number, lat: number, y: number): [number, number, number] {
  const [x, z] = lngLatToWorld(lng, lat);
  return [x, y, z];
}
