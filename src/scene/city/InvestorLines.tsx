import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Startup } from '../../types';
import { cityBuildingBaseY, cityBuildingHeight } from '../../lib/encoding';
import { useAppStore } from '../../store/useAppStore';

interface InvestorLinesProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

const MAX_LINES = 8;
const ARC_SEGMENTS = 36;

const VS = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
varying float vT;
void main() {
  float dashCycle = mod(vT - uTime * 0.42, 1.0);
  float dash = smoothstep(0.55, 0.95, 1.0 - dashCycle);
  float base = 0.32 + 0.42 * (1.0 - vT * 0.6);
  float a = clamp(base + dash * 1.1, 0.0, 1.0);
  gl_FragColor = vec4(uColor, a * 0.9);
}
`;

const COLOR = new THREE.Color('#7C3AED'); // selected-purple, ties to selection ring

interface ArcDef {
  start: THREE.Vector3;
  end: THREE.Vector3;
  control: THREE.Vector3;
  shared: number; // # shared investors → drives line thickness
}

function buildArcGeometry(def: ArcDef): THREE.BufferGeometry {
  const positions = new Float32Array((ARC_SEGMENTS + 1) * 2 * 3);
  const ts = new Float32Array((ARC_SEGMENTS + 1) * 2);
  const indices: number[] = [];
  const tmp = new THREE.Vector3();
  const next = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();

  const sample = (t: number, out: THREE.Vector3) => {
    const u = 1 - t;
    out.set(0, 0, 0);
    out.addScaledVector(def.start, u * u);
    out.addScaledVector(def.control, 2 * u * t);
    out.addScaledVector(def.end, t * t);
  };

  const w = 0.05 + Math.min(0.18, def.shared * 0.04);

  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    const t = i / ARC_SEGMENTS;
    sample(t, tmp);
    sample(Math.min(1, t + 0.001), next);
    tangent.copy(next).sub(tmp).normalize();
    right.crossVectors(tangent, normal).normalize();
    const taper = w * (0.55 + Math.sin(t * Math.PI) * 0.55);
    const left = tmp.clone().addScaledVector(right, -taper);
    const rightP = tmp.clone().addScaledVector(right, taper);

    positions[i * 6 + 0] = left.x;
    positions[i * 6 + 1] = left.y;
    positions[i * 6 + 2] = left.z;
    positions[i * 6 + 3] = rightP.x;
    positions[i * 6 + 4] = rightP.y;
    positions[i * 6 + 5] = rightP.z;
    ts[i * 2] = t;
    ts[i * 2 + 1] = t;

    if (i < ARC_SEGMENTS) {
      const a0 = i * 2;
      const a1 = i * 2 + 1;
      const a2 = (i + 1) * 2;
      const a3 = (i + 1) * 2 + 1;
      indices.push(a0, a1, a2, a1, a3, a2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
  g.setIndex(indices);
  return g;
}

/**
 * Portfolio-siblings overlay — when a startup is hovered or selected, draw
 * animated arcs to up to MAX_LINES other startups in the same city that share
 * at least one investor. Mirrors the global flow arcs at street scale and
 * makes the cap-table graph viscerally legible without leaving the city.
 */
export function InvestorLines({ startups, positions }: InvestorLinesProps) {
  const hover = useAppStore((s) => s.hover);
  const selection = useAppStore((s) => s.selection);

  const activeId = useMemo(() => {
    if (selection?.kind === 'startup') return selection.id;
    if (hover?.kind === 'startup') return hover.id;
    return null;
  }, [hover, selection]);

  const arcs = useMemo<ArcDef[]>(() => {
    if (!activeId) return [];
    const active = startups.find((s) => s.id === activeId);
    if (!active || active.entityType !== 'Startup') return [];
    if (!active.investorIds || active.investorIds.length === 0) return [];
    const startPos = positions.get(active.id);
    if (!startPos) return [];

    const investorSet = new Set(active.investorIds);
    type Sibling = { startup: Startup; shared: number };
    const siblings: Sibling[] = [];
    startups.forEach((s) => {
      if (s.id === active.id) return;
      if (!s.investorIds || s.investorIds.length === 0) return;
      let shared = 0;
      for (const id of s.investorIds) if (investorSet.has(id)) shared += 1;
      if (shared > 0) siblings.push({ startup: s, shared });
    });
    siblings.sort((a, b) => b.shared - a.shared);
    const top = siblings.slice(0, MAX_LINES);

    const ay = cityBuildingBaseY(active) + Math.max(0.5, cityBuildingHeight(active) * 0.55);
    const start = new THREE.Vector3(startPos[0], ay, startPos[1]);

    return top
      .map(({ startup, shared }): ArcDef | null => {
        const p = positions.get(startup.id);
        if (!p) return null;
        const by = cityBuildingBaseY(startup) + Math.max(0.5, cityBuildingHeight(startup) * 0.55);
        const end = new THREE.Vector3(p[0], by, p[1]);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const dist = start.distanceTo(end);
        const lift = Math.min(14, 2.5 + dist * 0.18);
        const control = new THREE.Vector3(mid.x, Math.max(start.y, end.y) + lift, mid.z);
        return { start, end, control, shared };
      })
      .filter((d): d is ArcDef => d !== null);
  }, [activeId, startups, positions]);

  const meshes = useMemo(() => {
    return arcs.map((def) => buildArcGeometry(def));
  }, [arcs]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: FS,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: COLOR },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      }),
    []
  );

  useFrame(({ clock }) => {
    // Direct uniform mutation is the standard three.js animation pattern; the
    // material instance is stable across renders.
    // eslint-disable-next-line react-hooks/immutability
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  if (meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((g, i) => (
        <mesh key={i} geometry={g} material={material} renderOrder={30} />
      ))}
    </group>
  );
}
