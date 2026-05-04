import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { InvestmentEdge, RegionAggregate, RegionId } from '../../types';
import { REGIONS } from '../../data/regions';
import { REGION_FLOW_ORIGIN_COLORS } from '../../data/regionFlowColors';
import { lngLatToSphere, R_GLOBE } from '../../lib/projection';
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
  /** Anchor positions in world space (already at the lifted region roof). */
  start: THREE.Vector3;
  end: THREE.Vector3;
  /** Maximum extra radial lift at the apex of the arc. */
  lift: number;
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

const MAX_LIFT = R_GLOBE * 0.35;
const ROOF_OFFSET_BASE = 0.22; // matches REGION_BASE_RADIUS lift above ocean

function regionRoofRadius(
  rid: RegionId,
  aggregates: Record<RegionId, RegionAggregate>,
  extents: AggregateEncodingExtents
): number {
  const h = extrusionForSlice(aggregates[rid].dealFlowVolume, extents);
  return R_GLOBE + ROOF_OFFSET_BASE + h + 0.4;
}

/** Spherical linear interpolation of two unit vectors. */
function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-5) {
    return out.copy(a).lerp(b, t).normalize();
  }
  const sinO = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinO;
  const wb = Math.sin(t * omega) / sinO;
  return out
    .set(0, 0, 0)
    .addScaledVector(a, wa)
    .addScaledVector(b, wb);
}

/**
 * Build a thin tube/ribbon along a sphered arc:
 *   • direction interpolated via slerp between start/end unit vectors
 *   • radius rises in a parabolic bulge centered at t=0.5 (visual "altitude")
 *   • cross-section perpendicular to tangent and aligned to the surface normal
 *     so the ribbon always reads "facing outward from the globe"
 */
function createArcGeometry(def: ArcDef, segments = 96): THREE.BufferGeometry {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const ts = new Float32Array((segments + 1) * 2);
  const widths = new Float32Array((segments + 1) * 2);
  const indices: number[] = [];

  const startN = def.start.clone().normalize();
  const endN = def.end.clone().normalize();
  const rStart = def.start.length();
  const rEnd = def.end.length();

  const dirA = new THREE.Vector3();
  const dirB = new THREE.Vector3();
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const right = new THREE.Vector3();

  const sampleRadius = (t: number) =>
    THREE.MathUtils.lerp(rStart, rEnd, t) + def.lift * 4 * t * (1 - t);

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    slerpUnit(startN, endN, t, dirA);
    posA.copy(dirA).multiplyScalar(sampleRadius(t));

    // Forward neighbor for tangent.
    const tN = Math.min(1, t + 1 / segments);
    slerpUnit(startN, endN, tN, dirB);
    posB.copy(dirB).multiplyScalar(sampleRadius(tN));

    tangent.copy(posB).sub(posA);
    if (tangent.lengthSq() < 1e-10) {
      // End of arc: reuse previous tangent direction.
      tangent.set(0, 0, 1);
    } else {
      tangent.normalize();
    }
    normal.copy(dirA); // outward surface-normal direction

    right.crossVectors(tangent, normal);
    if (right.lengthSq() < 1e-10) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }

    const w = def.thickness * (0.75 + Math.sin(t * Math.PI) * 0.65);

    const left = posA.clone().addScaledVector(right, -w);
    const rightP = posA.clone().addScaledVector(right, w);

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
        const rStart = regionRoofRadius(edge.investorCountry, aggregates, extents);
        const rEnd = regionRoofRadius(edge.startupCountry, aggregates, extents);
        const startN = lngLatToSphere(from[0], from[1], 1);
        const endN = lngLatToSphere(to[0], to[1], 1);

        // Lane axis: perpendicular to the great-circle plane, tangent to the
        // sphere at both endpoints. Shifting endpoints along this direction
        // moves the whole arc to a parallel-ish neighbouring path.
        const axis = startN.clone().cross(endN);
        if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0);
        else axis.normalize();

        const lane = laneIdx - (n - 1) / 2;
        const laneShift = (lane * 0.014); // small angular offset on the unit sphere
        const startShifted = startN
          .clone()
          .addScaledVector(axis, laneShift)
          .normalize();
        const endShifted = endN
          .clone()
          .addScaledVector(axis, laneShift)
          .normalize();

        const start = startShifted.clone().multiplyScalar(rStart);
        const end = endShifted.clone().multiplyScalar(rEnd);

        // Great-circle chord length on the unit sphere -> arc-length proxy.
        const cosO = THREE.MathUtils.clamp(startShifted.dot(endShifted), -1, 1);
        const omega = Math.acos(cosO);
        const arcLen = omega * R_GLOBE;
        const lift = Math.min(MAX_LIFT, 4 + arcLen * 0.18 + Math.abs(lane) * 0.6);

        const t = arcThickness(edge.totalCapital) * 0.62;
        const speed = arcSpeed(edge.dealCount);
        const glow = arcGlow(edge.avgRoundSize) * 1.28;
        const color = lineColorForOrigin(edge.investorCountry);
        const phase = (laneIdx * 0.173 + edge.startupCountry.charCodeAt(0) * 0.01) % 1;
        out.push({
          def: { start, end, lift, thickness: t, speed, glow, color, phase },
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
