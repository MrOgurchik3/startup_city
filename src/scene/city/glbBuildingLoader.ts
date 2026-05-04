import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * GLB → archetype geometry loader.
 *
 * Each city archetype optionally points at a GLB file in `public/buildings/`.
 * If found, all meshes inside are baked (worldMatrix applied), normalized
 * (recenter footprint to (0,0,0), base at y=0, fit unit-height + ≤1 footprint),
 * and merged into a single BufferGeometry suitable for InstancedMesh.
 *
 * If the GLB is missing or fails to load/parse, the caller's procedural
 * fallback is used — the city renders immediately with procedural archetypes
 * and progressively upgrades as GLBs become available.
 */

export const BUILDINGS_BASE = '/buildings';

const loader = new GLTFLoader();

const cache = new Map<string, Promise<THREE.BufferGeometry>>();

/**
 * Promote a geometry's attribute set to a common (position, normal, uv) so that
 * mergeGeometries can combine meshes with mismatched attribute layouts.
 */
function ensureCommonAttributes(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', geom.attributes.position);
  if (geom.attributes.normal) {
    out.setAttribute('normal', geom.attributes.normal);
  } else {
    const fake = new Float32Array(geom.attributes.position.count * 3);
    out.setAttribute('normal', new THREE.BufferAttribute(fake, 3));
  }
  if (geom.attributes.uv) {
    out.setAttribute('uv', geom.attributes.uv);
  } else {
    const fake = new Float32Array(geom.attributes.position.count * 2);
    out.setAttribute('uv', new THREE.BufferAttribute(fake, 2));
  }
  if (geom.index) out.setIndex(geom.index);
  return out;
}

/** Cylindrical UV projection — gives the window-grid shader something usable on
 *  any merged GLB regardless of its original UV layout. u wraps around the
 *  building's vertical axis; v goes 0 (base) → 1 (top). */
function projectCylindricalUVs(geom: THREE.BufferGeometry): void {
  const pos = geom.attributes.position;
  const count = pos.count;
  const uvs = new Float32Array(count * 2);
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return;
  const minY = bb.min.y;
  const spanY = Math.max(bb.max.y - minY, 1e-6);
  for (let i = 0; i < count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
    const v = (y - minY) / spanY;
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

/** Walk a GLTF scene, bake transforms, return one merged geometry normalized to
 *  the archetype convention (footprint within ±0.5, base y=0, height 1). */
function bakeGltfToArchetypeGeometry(gltf: { scene: THREE.Object3D }): THREE.BufferGeometry {
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const baked = mesh.geometry.clone();
    baked.applyMatrix4(mesh.matrixWorld);
    parts.push(ensureCommonAttributes(baked));
  });
  if (parts.length === 0) throw new Error('GLB scene contains no meshes');

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('mergeGeometries returned null');

  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  if (bb) {
    const sx = Math.max(bb.max.x - bb.min.x, 1e-6);
    const sy = Math.max(bb.max.y - bb.min.y, 1e-6);
    const sz = Math.max(bb.max.z - bb.min.z, 1e-6);
    // Recenter footprint at origin, base at y=0.
    merged.translate(-(bb.min.x + sx / 2), -bb.min.y, -(bb.min.z + sz / 2));
    // Uniform XZ scale to fit largest footprint extent into [-0.5, 0.5];
    // independent Y scale so height becomes 1.
    const scaleXZ = 1.0 / Math.max(sx, sz);
    const scaleY = 1.0 / sy;
    merged.scale(scaleXZ, scaleY, scaleXZ);
  }

  // Replace baked normals (they may have been distorted by non-uniform scale).
  merged.computeVertexNormals();
  // Synthetic UVs so the building shader's window grid still renders sensibly.
  projectCylindricalUVs(merged);
  return merged;
}

export interface GlbLoadOptions {
  glbAsset: string;
  fallback: () => THREE.BufferGeometry;
}

export function loadArchetypeGeometry(opts: GlbLoadOptions): Promise<THREE.BufferGeometry> {
  const key = opts.glbAsset;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = (async () => {
    const url = `${BUILDINGS_BASE}/${opts.glbAsset}`;
    let head: Response;
    try {
      head = await fetch(url, { method: 'HEAD' });
    } catch (err) {
      console.warn(`[glbLoader] HEAD failed for ${url}, using procedural fallback`, err);
      return opts.fallback();
    }
    if (!head.ok) {
      console.info(`[glbLoader] ${url} not present (status ${head.status}), using procedural fallback`);
      return opts.fallback();
    }
    try {
      const gltf = await loader.loadAsync(url);
      const geom = bakeGltfToArchetypeGeometry(gltf);
      console.info(`[glbLoader] loaded ${url}`);
      return geom;
    } catch (err) {
      console.warn(`[glbLoader] failed to parse ${url}, using procedural fallback`, err);
      return opts.fallback();
    }
  })();
  cache.set(key, promise);
  return promise;
}
