import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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
attribute float instanceFundStatus;     // 0 mid · 1 likely raising · 2 recently raised
attribute float instanceDaysSinceRound; // for fade on "recently raised"
varying vec2 vUv;
varying vec3 vColor;
varying float vFundStatus;
varying float vDaysSince;
void main() {
  vUv = uv;
  vColor = instanceColor;
  vFundStatus = instanceFundStatus;
  vDaysSince = instanceDaysSinceRound;
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying float vFundStatus;
varying float vDaysSince;

const vec3 GOLD = vec3(0.99, 0.78, 0.32);

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float d = length(uv);
  float ring = smoothstep(0.65, 0.95, 1.0 - abs(d - 0.85));
  float core = smoothstep(0.95, 0.0, d) * 0.18;

  // Likely Raising — slow breathing pulse on ring intensity (~3s period).
  float pulse = 1.0;
  if (vFundStatus > 0.5 && vFundStatus < 1.5) {
    pulse = 0.65 + 0.55 * (0.5 + 0.5 * sin(uTime * 2.1));
  }

  // Recently Raised — short-lived gold bloom that decays over ~14 days.
  float bloom = 0.0;
  vec3 bloomCol = vec3(0.0);
  if (vFundStatus > 1.5 && vFundStatus < 2.5) {
    float decay = exp(-vDaysSince / 14.0);
    // Gentle scintillation overlaid on the decay so it reads as "fresh"
    float scint = 0.85 + 0.15 * sin(uTime * 4.4);
    bloom = decay * scint * 0.9;
    bloomCol = GOLD;
  }

  vec3 col = mix(vColor, bloomCol, clamp(bloom, 0.0, 1.0));
  float ringA = ring * pulse + bloom * ring * 0.8;
  float a = clamp(ringA + core, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
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
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    []
  );

  const buffers = useMemo(() => {
    const n = startups.length;
    return {
      color: new Float32Array(n * 3),
      fundStatus: new Float32Array(n),
      daysSince: new Float32Array(n),
    };
  }, [startups.length]);

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
      } else if (g === 2) {
        c.set(CITY_PALETTE.amber);
        c.multiplyScalar(0.95);
      } else {
        c.set(CITY_PALETTE.purpleMain);
        c.multiplyScalar(0.92);
      }
      buffers.color[i * 3 + 0] = c.r;
      buffers.color[i * 3 + 1] = c.g;
      buffers.color[i * 3 + 2] = c.b;

      // Fundraising status code: 0 mid · 1 likely raising · 2 recently raised.
      // (Investors don't carry the status — leave them at 0 = no pulse.)
      let code = 0;
      if (s.entityType === 'Startup') {
        if (s.fundraisingStatus === 'Likely Raising') code = 1;
        else if (s.fundraisingStatus === 'Recently Raised') code = 2;
      }
      buffers.fundStatus[i] = code;
      buffers.daysSince[i] = Math.max(0, s.timeToLastRoundDays);
    });
    mesh.count = startups.length;
    mesh.instanceMatrix.needsUpdate = true;
    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(buffers.color, 3));
    geom.setAttribute('instanceFundStatus', new THREE.InstancedBufferAttribute(buffers.fundStatus, 1));
    geom.setAttribute('instanceDaysSinceRound', new THREE.InstancedBufferAttribute(buffers.daysSince, 1));
  }, [startups, positions, buffers]);

  useFrame(({ clock }) => {
    // eslint-disable-next-line react-hooks/immutability
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  if (startups.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, startups.length]}
      frustumCulled={false}
    />
  );
}
