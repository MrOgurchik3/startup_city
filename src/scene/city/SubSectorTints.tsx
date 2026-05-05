import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Startup } from '../../types';

interface SubSectorTintsProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

/**
 * A subtle per-startup ground tile coloured by sub-sector. Within a vertical's
 * district, startups with the same sub-sector cluster visually (matching tint),
 * so districts read as textured rather than monolithic. Sub-sector colour is
 * a deterministic hash of the sub-sector string — same name → same hue across
 * verticals.
 */

const TILE_SIZE = 2.05;

const VERTEX_SHADER = /* glsl */ `
attribute vec3 instanceColor;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  // Soft squircle falloff so adjacent tiles blend at the seams.
  vec2 p = abs(vUv * 2.0 - 1.0);
  float d = pow(pow(p.x, 4.0) + pow(p.y, 4.0), 0.25);
  float a = smoothstep(1.0, 0.55, d) * 0.30;
  gl_FragColor = vec4(vColor, a);
}
`;

const noopRaycast: THREE.Mesh['raycast'] = () => {};

function subSectorColor(sub: string, target: THREE.Color): void {
  let h = 0;
  for (let i = 0; i < sub.length; i += 1) h = (h * 131 + sub.charCodeAt(i)) | 0;
  const hue = (((h >>> 0) % 360) / 360 + 0.05) % 1; // shift away from pure red
  target.setHSL(hue, 0.34, 0.74);
}

export function SubSectorTints({ startups, positions }: SubSectorTintsProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    []
  );

  const colorBuf = useMemo(() => new Float32Array(startups.length * 3), [startups.length]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let idx = 0;
    startups.forEach((s) => {
      if (s.entityType !== 'Startup') return;
      const pos = positions.get(s.id);
      if (!pos) return;
      const sub = s.subSector || s.vertical || 'other';
      subSectorColor(sub, c);
      const [x, z] = pos;
      m.makeScale(TILE_SIZE, 1, TILE_SIZE);
      // Just above the city ground, below the GlowBase ring (which sits ~0.06).
      m.setPosition(x, 0.018, z);
      mesh.setMatrixAt(idx, m);
      colorBuf[idx * 3 + 0] = c.r;
      colorBuf[idx * 3 + 1] = c.g;
      colorBuf[idx * 3 + 2] = c.b;
      idx += 1;
    });
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorBuf, 3));
  }, [startups, positions, colorBuf]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.raycast = noopRaycast;
  }, []);

  if (startups.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, startups.length]}
      frustumCulled={false}
      renderOrder={-2}
    />
  );
}
