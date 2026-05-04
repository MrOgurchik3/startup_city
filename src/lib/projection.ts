import * as THREE from 'three';

// Legacy flat (equirectangular) projection — still used by City View, where each
// region's bbox is treated as a local lng/lat rectangle on the ground plane (XZ).
export const GLOBAL_PLANE = {
  width: 360, // world units along x (-180..180 lng)
  height: 180, // world units along z (-90..90 lat -> z flipped so north is -z)
};

export function lngLatToWorld(
  lng: number,
  lat: number
): [number, number] {
  const x = (lng / 180) * (GLOBAL_PLANE.width / 2);
  const z = -(lat / 90) * (GLOBAL_PLANE.height / 2);
  return [x, z];
}

// Globe (Global View). Right-handed with Y up. lng=0,lat=0 lands at +Z so the
// "front" of the globe faces the default camera vantage. North pole at +Y.
export const R_GLOBE = 100;

export function lngLatToSphere(
  lng: number,
  lat: number,
  radius: number = R_GLOBE,
  out?: THREE.Vector3
): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180; // -PI/2..PI/2
  const lambda = (lng * Math.PI) / 180; // -PI..PI
  const cosPhi = Math.cos(phi);
  const x = radius * cosPhi * Math.sin(lambda);
  const y = radius * Math.sin(phi);
  const z = radius * cosPhi * Math.cos(lambda);
  return out ? out.set(x, y, z) : new THREE.Vector3(x, y, z);
}

/** Outward unit normal at a (lng, lat) — same direction as lngLatToSphere(...).normalize(). */
export function lngLatNormal(lng: number, lat: number, out?: THREE.Vector3): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = cosPhi * Math.cos(lambda);
  return out ? out.set(x, y, z) : new THREE.Vector3(x, y, z);
}
