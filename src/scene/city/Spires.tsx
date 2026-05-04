import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingHeight,
  cityBuildingWidth,
  citySpireHeight,
} from '../../lib/encoding';

interface SpiresProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

const RAINBOW_VS = /* glsl */ `
attribute float instanceHue;
varying float vY;
varying float vHue;

void main() {
  vHue = instanceHue;
  vY = position.y;
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

const RAINBOW_FS = /* glsl */ `
precision highp float;
uniform float uTime;
varying float vY;
varying float vHue;

void main() {
  float t = fract(vY * 2.1 + uTime * 0.14 + vHue);
  vec3 c = 0.52 + 0.48 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  c = min(c * 1.35, vec3(1.0));
  gl_FragColor = vec4(c, 1.0);
}
`;

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (h % 997) / 997;
}

function StandardSpires({ startups, positions }: SpiresProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.16, 1, 8);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: '#5ce1e6',
      transparent: true,
      opacity: 0.96,
      toneMapped: false,
      depthWrite: true,
    });
    return m;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    let active = 0;
    startups.forEach((s) => {
      if (s.outcomeStatus === 'Unicorn') return;
      const pos = positions.get(s.id);
      if (!pos) return;
      const sh = citySpireHeight(s);
      if (sh < 0.35) return;
      const [x, z] = pos;
      const baseHeight = cityBuildingHeight(s);
      const w = cityBuildingWidth(s);
      m.makeScale(w * 0.45, sh, w * 0.45);
      m.setPosition(x, cityBuildingBaseY(s) + baseHeight, z);
      mesh.setMatrixAt(active, m);
      active += 1;
    });
    mesh.count = active;
    mesh.instanceMatrix.needsUpdate = true;
  }, [startups, positions]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, startups.length]}
      frustumCulled={false}
    />
  );
}

function RainbowSpires({ unicorns, positions }: { unicorns: Startup[]; positions: Map<string, [number, number]> }) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const n = unicorns.length;
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.26, 1, 12);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: RAINBOW_VS,
        fragmentShader: RAINBOW_FS,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || n === 0) return;
    const m = new THREE.Matrix4();
    const hueBuf = new Float32Array(n);
    unicorns.forEach((s, i) => {
      const pos = positions.get(s.id);
      if (!pos) return;
      const sh = Math.max(1.05, citySpireHeight(s) * 1.15);
      const [x, z] = pos;
      const baseHeight = cityBuildingHeight(s);
      const w = cityBuildingWidth(s);
      m.makeScale(w * 0.58, sh, w * 0.58);
      m.setPosition(x, cityBuildingBaseY(s) + baseHeight, z);
      mesh.setMatrixAt(i, m);
      hueBuf[i] = hashHue(s.id);
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute('instanceHue', new THREE.InstancedBufferAttribute(hueBuf, 1));
  }, [unicorns, positions, n]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (n === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, n]}
      frustumCulled={false}
      renderOrder={30}
    />
  );
}

export function Spires({ startups, positions }: SpiresProps) {
  const unicorns = useMemo(
    () => startups.filter((s) => s.outcomeStatus === 'Unicorn'),
    [startups]
  );
  return (
    <group>
      <StandardSpires startups={startups} positions={positions} />
      <RainbowSpires unicorns={unicorns} positions={positions} />
    </group>
  );
}
