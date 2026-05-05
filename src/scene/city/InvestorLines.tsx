import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingRoofWorldY,
} from '../../lib/encoding';
import { stageColorHex } from '../../data/stages';
import { useAppStore } from '../../store/useAppStore';

interface InvestorLinesProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

const MAX_STARTUP_TO_INVESTOR = 32;
const MAX_PORTFOLIO_ARCS = 24;
const MAX_CROSS_PER_STARTUP = 6;
const MAX_CROSS_ARCS_GLOBAL = 48;
const EXTERNAL_FUNDING_HUB_ID = '__external_funding_hub__';

const ARC_SEGMENTS = 36;

const VS = /* glsl */ `
attribute float aT;
attribute vec3 dashColor;
varying float vT;
varying vec3 vDashColor;

void main() {
  vT = aT;
  vDashColor = dashColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = /* glsl */ `
precision highp float;

uniform float uTime;
varying float vT;
varying vec3 vDashColor;

void main() {
  float dashCycle = mod(vT - uTime * 0.42, 1.0);
  float dash = smoothstep(0.55, 0.95, 1.0 - dashCycle);
  float base = 0.32 + 0.42 * (1.0 - vT * 0.6);
  float a = clamp(base + dash * 1.1, 0.0, 1.0);
  gl_FragColor = vec4(vDashColor, a * 0.9);
}
`;

interface ColoredArcDef {
  start: THREE.Vector3;
  end: THREE.Vector3;
  control: THREE.Vector3;
  /** Drives ribbon width — higher when more investors overlap (legacy heuristic). */
  shared: number;
  color: THREE.Color;
}

function arcAttachY(ent: Startup): number {
  const base = cityBuildingBaseY(ent);
  const roof = cityBuildingRoofWorldY(ent);
  return Math.max(base + 0.48, roof - 0.12);
}

function arcLateralOffset(
  start: THREE.Vector3,
  end: THREE.Vector3,
  lane: number,
  lanes: number,
  sep: number
): THREE.Vector3 {
  if (lanes <= 1) return new THREE.Vector3(0, 0, 0);
  const v = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
  if (v.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, 0);
  v.normalize();
  const perp = new THREE.Vector3(-v.z, 0, v.x);
  const centered = lane - (lanes - 1) / 2;
  return perp.multiplyScalar(centered * sep);
}

function buildArcGeometry(def: ColoredArcDef): THREE.BufferGeometry {
  const positions = new Float32Array((ARC_SEGMENTS + 1) * 2 * 3);
  const ts = new Float32Array((ARC_SEGMENTS + 1) * 2);
  const colors = new Float32Array((ARC_SEGMENTS + 1) * 2 * 3);
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
  const { r: cr, g: cg, b: cb } = def.color;

  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    const t = i / ARC_SEGMENTS;
    sample(t, tmp);
    sample(Math.min(1, t + 0.001), next);
    tangent.copy(next).sub(tmp).normalize();
    right.crossVectors(tangent, normal).normalize();
    const taper = w * (0.55 + Math.sin(t * Math.PI) * 0.55);
    const left = tmp.clone().addScaledVector(right, -taper);
    const rightP = tmp.clone().addScaledVector(right, taper);

    const base = i * 6;
    positions[base + 0] = left.x;
    positions[base + 1] = left.y;
    positions[base + 2] = left.z;
    positions[base + 3] = rightP.x;
    positions[base + 4] = rightP.y;
    positions[base + 5] = rightP.z;
    ts[i * 2] = t;
    ts[i * 2 + 1] = t;
    colors[base + 0] = cr;
    colors[base + 1] = cg;
    colors[base + 2] = cb;
    colors[base + 3] = cr;
    colors[base + 4] = cg;
    colors[base + 5] = cb;

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
  g.setAttribute('dashColor', new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices);
  return g;
}

function makeQuadraticArc(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: THREE.Color,
  shared: number
): ColoredArcDef {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const lift = Math.min(14, 2.5 + dist * 0.18);
  const control = new THREE.Vector3(
    mid.x,
    Math.max(start.y, end.y) + lift,
    mid.z
  );
  return { start, end, control, shared, color };
}

const noopRaycast: THREE.Mesh['raycast'] = () => {};

export function InvestorLines({ startups, positions }: InvestorLinesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hover = useAppStore((s) => s.hover);
  const selection = useAppStore((s) => s.selection);

  const activeId = useMemo(() => {
    if (selection?.kind === 'entity') return selection.id;
    if (hover?.kind === 'entity') return hover.id;
    return null;
  }, [hover, selection]);

  const byId = useMemo(() => {
    const m = new Map<string, Startup>();
    startups.forEach((s) => m.set(s.id, s));
    return m;
  }, [startups]);

  const arcs = useMemo<ColoredArcDef[]>(() => {
    if (!activeId) return [];
    const active = byId.get(activeId);
    if (!active) return [];

    const startPos = positions.get(active.id);
    if (!startPos) return [];

    const out: ColoredArcDef[] = [];
    const edgeSeen = new Set<string>();
    const hub = startups.find((s) => s.id.endsWith(EXTERNAL_FUNDING_HUB_ID));
    const hubPos = hub ? positions.get(hub.id) : undefined;

    if (active.entityType === 'Startup') {
      // Hover/selection: connect startup to investors by *round*, colored by that round's stage.
      const ay = arcAttachY(active);
      const startBase = new THREE.Vector3(startPos[0], ay, startPos[1]);

      type EdgeOccur = { toId: string; stage: Startup['stage']; roundIdx: number; invIdx: number };
      const occ: EdgeOccur[] = [];

      if (active.rounds?.length) {
        active.rounds.forEach((r, ri) => {
          r.investorIds.forEach((invId, ii) => {
            const inv = byId.get(invId);
            const toPresent =
              inv != null &&
              inv.entityType !== 'Startup' &&
              positions.has(invId);
            if (toPresent) {
              occ.push({ toId: invId, stage: r.stage, roundIdx: ri, invIdx: ii });
            } else if (hub && hubPos) {
              occ.push({ toId: hub.id, stage: r.stage, roundIdx: ri, invIdx: ii });
            }
          });
        });
      } else if (active.investorIds?.length) {
        active.investorIds.forEach((invId, ii) => {
          const inv = byId.get(invId);
          const toPresent =
            inv != null && inv.entityType !== 'Startup' && positions.has(invId);
          if (toPresent) {
            occ.push({ toId: invId, stage: active.stage, roundIdx: 0, invIdx: ii });
          } else if (hub && hubPos) {
            occ.push({ toId: hub.id, stage: active.stage, roundIdx: 0, invIdx: ii });
          }
        });
      }

      if (occ.length === 0) return [];
      const trimmed = occ.slice(0, MAX_STARTUP_TO_INVESTOR);

      // Group occurrences by destination so we can fan out multiple arcs.
      const byTo = new Map<string, EdgeOccur[]>();
      for (const o of trimmed) {
        if (!byTo.has(o.toId)) byTo.set(o.toId, []);
        byTo.get(o.toId)!.push(o);
      }

      for (const [toId, list] of byTo.entries()) {
        const dest = byId.get(toId);
        const destPos = positions.get(toId);
        if (!destPos) continue;
        const dy = dest ? arcAttachY(dest) : ay;
        const endBase = new THREE.Vector3(destPos[0], dy, destPos[1]);

        // Stable ordering so offsets don't flicker.
        list.sort((a, b) => a.roundIdx - b.roundIdx || a.invIdx - b.invIdx);
        const sep = 0.22;
        list.forEach((o, lane) => {
          const key = `${active.id}->${toId}::${o.roundIdx}::${o.invIdx}`;
          if (edgeSeen.has(key)) return;
          edgeSeen.add(key);
          const off = arcLateralOffset(startBase, endBase, lane, list.length, sep);
          const start = startBase.clone().add(off);
          const end = endBase.clone().add(off);
          const c = new THREE.Color(stageColorHex(o.stage));
          out.push(makeQuadraticArc(start, end, c, 1));
        });
      }

      return out;
    }

    // VC / Angel / Other — portfolio radiants + startup → co-investor cross-links.
    const invPos = positions.get(active.id);
    if (!invPos) return [];

    const portfolio = startups
      .filter(
        (s) =>
          s.entityType === 'Startup' &&
          Array.isArray(s.rounds) &&
          s.rounds.some((r) => r.investorIds.includes(active.id))
      )
      .sort((a, b) => b.totalRaised - a.totalRaised)
      .slice(0, MAX_PORTFOLIO_ARCS);

    const invY = arcAttachY(active);
    const invVec = new THREE.Vector3(invPos[0], invY, invPos[1]);

    for (const co of portfolio) {
      const p = positions.get(co.id);
      if (!p) continue;
      const coY = arcAttachY(co);
      const end = new THREE.Vector3(p[0], coY, p[1]);
      // One arc per round participation (fan out if investor appears multiple times).
      const rounds = co.rounds.filter((r) => r.investorIds.includes(active.id));
      const sep = 0.22;
      rounds.forEach((r, lane) => {
        const key = `${active.id}->${co.id}::${r.date}`;
        if (edgeSeen.has(key)) return;
        edgeSeen.add(key);
        const off = arcLateralOffset(invVec, end, lane, rounds.length, sep);
        const c = new THREE.Color(stageColorHex(r.stage));
        out.push(makeQuadraticArc(invVec.clone().add(off), end.clone().add(off), c, 1));
      });
    }

    let crossTotal = 0;
    for (const co of portfolio) {
      if (crossTotal >= MAX_CROSS_ARCS_GLOBAL) break;
      if (!co.investorIds?.length) continue;
      const p = positions.get(co.id);
      if (!p) continue;
      const coY = arcAttachY(co);
      const start = new THREE.Vector3(p[0], coY, p[1]);
      const stageC = new THREE.Color(stageColorHex(co.stage));
      let perStartup = 0;
      // Cross-links: portfolio startup → co-investors in-city; keep stage color per startup.
      for (const otherId of co.investorIds) {
        if (perStartup >= MAX_CROSS_PER_STARTUP) break;
        if (crossTotal >= MAX_CROSS_ARCS_GLOBAL) break;
        if (otherId === active.id) continue;
        const other = byId.get(otherId);
        if (!other || other.entityType === 'Startup') continue;
        const key = `${co.id}->${otherId}`;
        if (edgeSeen.has(key)) continue;
        const op = positions.get(otherId);
        if (!op) continue;
        edgeSeen.add(key);
        const oy = arcAttachY(other);
        const end = new THREE.Vector3(op[0], oy, op[1]);
        out.push(makeQuadraticArc(start.clone(), end, stageC, 1));
        perStartup += 1;
        crossTotal += 1;
      }
    }

    return out;
  }, [activeId, byId, positions, startups]);

  const meshes = useMemo(() => arcs.map((def) => buildArcGeometry(def)), [arcs]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: FS,
        uniforms: {
          uTime: { value: 0 },
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

  useLayoutEffect(() => {
    groupRef.current?.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) m.raycast = noopRaycast;
    });
  }, [meshes.length]);

  if (meshes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {meshes.map((g, i) => (
        <mesh key={i} geometry={g} material={material} renderOrder={30} />
      ))}
    </group>
  );
}
