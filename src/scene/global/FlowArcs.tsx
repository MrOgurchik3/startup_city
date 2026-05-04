import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { InvestmentEdge, RegionAggregate, RegionId } from '../../types';
import { REGIONS } from '../../data/regions';
import { REGION_FLOW_ORIGIN_COLORS } from '../../data/regionFlowColors';
import { lngLatToWorld } from '../../lib/projection';
import {
  arcGlow,
  arcSpeed,
  arcThickness,
  extrusionForSlice,
  type AggregateEncodingExtents,
} from '../../lib/encoding';

interface FlowArcsProps {
  edges: InvestmentEdge[];
  aggregates: Record<RegionId, RegionAggregate>;
  extents: AggregateEncodingExtents;
}

interface ArcDef {
  start: THREE.Vector3;
  end: THREE.Vector3;
  control: THREE.Vector3;
  thickness: number;
  speed: number;
  glow: number;
  color: THREE.Color;
  phase: number;
}

const ARC_VS = /* glsl */ `
attribute float aT;
attribute float aWidth;
varying float vT;
varying float vWidth;

void main() {
  vT = aT;
  vWidth = aWidth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ARC_FS = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSpeed;
uniform float uGlow;
uniform float uPhase;
uniform vec3 uColor;
varying float vT;
varying float vWidth;

void main() {
  float dashCycle = mod(vT - uTime * uSpeed + uPhase, 1.0);
  float dash = smoothstep(0.62, 0.98, 1.0 - dashCycle);
  float base = 0.44 + 0.38 * (1.0 - vT * 0.38);
  float a = clamp(base + dash * 1.15, 0.0, 1.0) * uGlow;
  gl_FragColor = vec4(uColor, a);
}
`;

function roofY(
  rid: RegionId,
  aggregates: Record<RegionId, RegionAggregate>,
  extents: AggregateEncodingExtents
): number {
  const h = extrusionForSlice(aggregates[rid].dealFlowVolume, extents);
  return 0.05 + h;
}

function createArcGeometry(def: ArcDef): THREE.BufferGeometry {
  const segments = 64;
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const ts = new Float32Array((segments + 1) * 2);
  const widths = new Float32Array((segments + 1) * 2);
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

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    sample(t, tmp);
    sample(Math.min(1, t + 0.001), next);
    tangent.copy(next).sub(tmp).normalize();
    right.crossVectors(tangent, normal).normalize();

    const w = def.thickness * (0.75 + Math.sin(t * Math.PI) * 0.65);

    const left = tmp.clone().addScaledVector(right, -w);
    const rightP = tmp.clone().addScaledVector(right, w);

    positions[i * 6 + 0] = left.x;
    positions[i * 6 + 1] = left.y;
    positions[i * 6 + 2] = left.z;
    positions[i * 6 + 3] = rightP.x;
    positions[i * 6 + 4] = rightP.y;
    positions[i * 6 + 5] = rightP.z;
    ts[i * 2] = t;
    ts[i * 2 + 1] = t;
    widths[i * 2] = w;
    widths[i * 2 + 1] = w;

    if (i < segments) {
      const a0 = i * 2;
      const a1 = i * 2 + 1;
      const a2 = (i + 1) * 2;
      const a3 = (i + 1) * 2 + 1;
      indices.push(a0, a1, a2, a1, a3, a2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
  geom.setAttribute('aWidth', new THREE.BufferAttribute(widths, 1));
  geom.setIndex(indices);
  return geom;
}

function lineColorForOrigin(origin: RegionId): THREE.Color {
  return new THREE.Color(REGION_FLOW_ORIGIN_COLORS[origin]);
}

export function FlowArcs({ edges, aggregates, extents }: FlowArcsProps) {
  const arcData = useMemo(() => {
    const byHub = new Map<RegionId, InvestmentEdge[]>();
    edges.forEach((e) => {
      const list = byHub.get(e.investorCountry) ?? [];
      list.push(e);
      byHub.set(e.investorCountry, list);
    });
    byHub.forEach((list) => {
      list.sort((a, b) => a.startupCountry.localeCompare(b.startupCountry));
    });

    const out: { def: ArcDef }[] = [];
    byHub.forEach((list) => {
      const n = list.length;
      list.forEach((edge, laneIdx) => {
        const from = REGIONS[edge.investorCountry].centroid;
        const to = REGIONS[edge.startupCountry].centroid;
        const [sx, sz] = lngLatToWorld(from[0], from[1]);
        const [ex, ez] = lngLatToWorld(to[0], to[1]);
        const sy = roofY(edge.investorCountry, aggregates, extents);
        const ey = roofY(edge.startupCountry, aggregates, extents);
        const start = new THREE.Vector3(sx, sy, sz);
        const end = new THREE.Vector3(ex, ey, ez);
        const chord = new THREE.Vector3(ex - sx, 0, ez - sz);
        const len = Math.max(1e-4, chord.length());
        chord.multiplyScalar(1 / len);
        const perp = new THREE.Vector3(-chord.z, 0, chord.x);
        const lane = laneIdx - (n - 1) / 2;
        const spread = 3.15;
        const edgeNudge = perp.clone().multiplyScalar(lane * 0.52);
        start.add(edgeNudge);
        end.add(edgeNudge);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const dist = Math.hypot(ex - sx, ez - sz);
        const lift = Math.min(
          72,
          Math.max(sy, ey) + 10 + dist * 0.26 + Math.abs(lane) * spread * 0.15
        );
        const control = new THREE.Vector3(
          mid.x + perp.x * lane * spread,
          lift,
          mid.z + perp.z * lane * spread
        );
        const t = arcThickness(edge.totalCapital) * 0.62;
        const speed = arcSpeed(edge.dealCount);
        const glow = arcGlow(edge.avgRoundSize) * 1.28;
        const color = lineColorForOrigin(edge.investorCountry);
        const phase = (laneIdx * 0.173 + edge.startupCountry.charCodeAt(0) * 0.01) % 1;
        out.push({
          def: {
            start,
            end,
            control,
            thickness: t,
            speed,
            glow,
            color,
            phase,
          },
        });
      });
    });
    return out;
  }, [edges, aggregates, extents]);

  const groups = useMemo(() => {
    return arcData.map(({ def }) => {
      const geom = createArcGeometry(def);
      const underGeom = geom.clone();

      const underRgb = def.color.clone().lerp(new THREE.Color(0x000000), 0.62);
      const underMat = new THREE.MeshBasicMaterial({
        color: underRgb,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      });

      const glowMat = new THREE.ShaderMaterial({
        vertexShader: ARC_VS,
        fragmentShader: ARC_FS,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: def.speed },
          uGlow: { value: def.glow },
          uPhase: { value: def.phase },
          uColor: { value: def.color },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      const under = new THREE.Mesh(underGeom, underMat);
      const glow = new THREE.Mesh(geom, glowMat);
      under.renderOrder = 10;
      glow.renderOrder = 11;

      const group = new THREE.Group();
      group.add(under);
      group.add(glow);
      return group;
    });
  }, [arcData]);

  useFrame((state) => {
    const tNow = state.clock.getElapsedTime();
    groups.forEach((g) => {
      const glow = g.children[1] as THREE.Mesh;
      const mat = glow.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = tNow;
    });
  });

  return (
    <group>
      {groups.map((g, i) => (
        <primitive key={`arc-g-${i}`} object={g} />
      ))}
    </group>
  );
}
