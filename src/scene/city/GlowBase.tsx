import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Startup } from '../../types';
import { cityBuildingBaseY, cityBuildingWidth, shapeGroup } from '../../lib/encoding';
import { stageColorHex } from '../../data/stages';
import { CITY_PALETTE } from '../../theme/cityPalette';

interface GlowBaseProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

const VERTEX_SHADER = /* glsl */ `
attribute vec3 instanceColor;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = instanceColor;
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float d = length(uv);
  float ring = smoothstep(0.65, 0.95, 1.0 - abs(d - 0.85));
  float core = smoothstep(0.95, 0.0, d) * 0.18;
  float a = clamp(ring + core, 0.0, 1.0);
  gl_FragColor = vec4(vColor, a);
}
`;

export function GlowBase({ startups, positions }: GlowBaseProps) {
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

  const colorBuf = useMemo(
    () => new Float32Array(startups.length * 3),
    [startups.length]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    startups.forEach((s, i) => {
      const pos = positions.get(s.id);
      if (!pos) return;
      const [x, z] = pos;
      const g = shapeGroup(s);
      const wMul = g === 1 ? 2.65 : g >= 2 ? 2.45 : 2.2;
      const w = cityBuildingWidth(s) * wMul;
      m.makeScale(w, 1, w);
      m.setPosition(x, cityBuildingBaseY(s) + 0.058, z);
      mesh.setMatrixAt(i, m);

      if (s.entityType === 'Startup') {
        c.set(stageColorHex(s.stage));
        c.multiplyScalar(1.05);
      } else if (g === 1) {
        c.set(CITY_PALETTE.tealBright);
        c.multiplyScalar(1.0);
      } else if (g === 2) {
        c.set(CITY_PALETTE.amber);
        c.multiplyScalar(0.95);
      } else {
        c.set(CITY_PALETTE.purpleMain);
        c.multiplyScalar(0.92);
      }
      colorBuf[i * 3 + 0] = c.r;
      colorBuf[i * 3 + 1] = c.g;
      colorBuf[i * 3 + 2] = c.b;
    });
    mesh.count = startups.length;
    mesh.instanceMatrix.needsUpdate = true;
    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute(
      'instanceColor',
      new THREE.InstancedBufferAttribute(colorBuf, 3)
    );
  }, [startups, positions, colorBuf]);

  if (startups.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, startups.length]}
      frustumCulled={false}
    />
  );
}
