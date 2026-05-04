// Global view uses a simple equirectangular projection scaled to fit a
// rectangle on the ground plane (XZ in three.js). Y is up.
export const GLOBAL_PLANE = {
  width: 360, // world units along x (-180..180 lng)
  height: 180, // world units along z (-90..90 lat -> z flipped so north is -z)
};

export function lngLatToWorld(
  lng: number,
  lat: number
): [number, number] {
  const x = (lng / 180) * (GLOBAL_PLANE.width / 2);
  const z = -(lat / 90) * (GLOBAL_PLANE.height / 2); // north -> -z
  return [x, z];
}
