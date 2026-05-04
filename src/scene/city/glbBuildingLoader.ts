import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * GLB → archetype loader.
 *
 * Each city archetype optionally points at a GLB file in `public/buildings/`.
 * Loaded GLBs preserve their baked material (so the artist's textures /
 * window detail show through), and gain a small `onBeforeCompile` patch that
 * applies per-instance overrides for outcome-mute, IPO/M&A accent, and
 * selection highlight.
 *
 * Missing or broken GLBs fall back to the procedural builder + the existing
 * window shader, so the city always renders something.
 */

export const BUILDINGS_BASE = '/buildings';

const loader = new GLTFLoader();

export interface ArchetypeAsset {
  geometry: THREE.BufferGeometry;
  /** When non-null, use this material instead of the procedural window shader. */
  material: THREE.Material | null;
}

const cache = new Map<string, Promise<ArchetypeAsset>>();

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

interface BakedScene {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | null;
}

function bakeGltf(gltf: { scene: THREE.Object3D }): BakedScene {
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let firstMaterial: THREE.Material | null = null;

  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const baked = mesh.geometry.clone();
    baked.applyMatrix4(mesh.matrixWorld);
    parts.push(ensureCommonAttributes(baked));
    if (!firstMaterial) {
      // Kenney pack uses one material per building (a colormap texture atlas);
      // taking the first found preserves the baked window/wall colours.
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (m) firstMaterial = m;
    }
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
    merged.translate(-(bb.min.x + sx / 2), -bb.min.y, -(bb.min.z + sz / 2));
    const scaleXZ = 1.0 / Math.max(sx, sz);
    const scaleY = 1.0 / sy;
    merged.scale(scaleXZ, scaleY, scaleXZ);
  }
  // Recompute normals after the non-uniform scale; the GLB's own UVs are kept.
  merged.computeVertexNormals();

  const material = firstMaterial ? prepareInstanceMaterial(firstMaterial) : null;
  return { geometry: merged, material };
}

/**
 * Clone the GLB material and install an `onBeforeCompile` that wires up
 * per-instance attributes for mute (Flopped), selection, and outcome accent.
 * The standard PBR pipeline (lighting, baseColorTexture, etc.) is preserved.
 */
function prepareInstanceMaterial(src: THREE.Material): THREE.Material {
  const cloned = src.clone();
  // Ensure our InstancedMesh's per-instance attrs are seen by the shader.
  cloned.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float instanceMute;
attribute float instanceSelected;
attribute float instanceOutcomeAccent;
attribute float instanceWindowDensity;
attribute float instanceWindowIntensity;
varying float vMute;
varying float vSelected;
varying float vOutcomeAccent;
varying float vWindowDensity;
varying float vWindowIntensity;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vMute = instanceMute;
vSelected = instanceSelected;
vOutcomeAccent = instanceOutcomeAccent;
vWindowDensity = instanceWindowDensity;
vWindowIntensity = instanceWindowIntensity;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vMute;
varying float vSelected;
varying float vOutcomeAccent;
varying float vWindowDensity;
varying float vWindowIntensity;`
      )
      .replace(
        '#include <opaque_fragment>',
        `// "Lights on" — Kenney's colormap atlas paints windows as blue tiles
// against cream/white walls. Detect window-ness from the sampled diffuse
// (blue-dominant pixels) and add per-instance emissive proportional to
// (visitor density × ARR intensity). Walls stay neutral; windows glow.
{
  float winness = smoothstep(0.05, 0.30, diffuseColor.b - max(diffuseColor.r, diffuseColor.g) * 0.65);
  float lit = clamp(vWindowDensity * vWindowIntensity, 0.0, 1.0);
  vec3 windowGlow = mix(vec3(0.62, 0.78, 1.0), vec3(0.95, 0.94, 0.85), lit);
  outgoingLight += windowGlow * winness * lit * 1.35;

  // Per-instance overrides (outcome mute / accent / selection).
  float grey = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  outgoingLight = mix(outgoingLight, vec3(grey * 0.55), vMute * 0.85);
  if (vOutcomeAccent > 0.5 && vOutcomeAccent < 1.5) {
    outgoingLight = mix(outgoingLight, vec3(0.051, 0.580, 0.533), 0.32);
  } else if (vOutcomeAccent > 1.5 && vOutcomeAccent < 2.5) {
    outgoingLight = mix(outgoingLight, vec3(0.42, 0.26, 0.72), 0.30);
  }
  if (vSelected > 0.5) {
    outgoingLight = mix(outgoingLight, vec3(0.49, 0.23, 0.93), 0.32);
  }
}
#include <opaque_fragment>`
      );
  };
  cloned.needsUpdate = true;
  return cloned;
}

export interface GlbLoadOptions {
  glbAsset: string;
  fallback: () => THREE.BufferGeometry;
}

export function loadArchetypeAsset(opts: GlbLoadOptions): Promise<ArchetypeAsset> {
  const key = opts.glbAsset;
  const hit = cache.get(key);
  if (hit) return hit;

  const promise = (async (): Promise<ArchetypeAsset> => {
    const url = `${BUILDINGS_BASE}/${opts.glbAsset}`;
    let head: Response;
    try {
      head = await fetch(url, { method: 'HEAD' });
    } catch (err) {
      console.warn(`[glbLoader] HEAD failed for ${url}, using procedural fallback`, err);
      return { geometry: opts.fallback(), material: null };
    }
    if (!head.ok) {
      console.info(`[glbLoader] ${url} not present (status ${head.status}), using procedural fallback`);
      return { geometry: opts.fallback(), material: null };
    }
    try {
      const gltf = await loader.loadAsync(url);
      const baked = bakeGltf(gltf);
      console.info(`[glbLoader] loaded ${url}`);
      return baked;
    } catch (err) {
      console.warn(`[glbLoader] failed to parse ${url}, using procedural fallback`, err);
      return { geometry: opts.fallback(), material: null };
    }
  })();
  cache.set(key, promise);
  return promise;
}
