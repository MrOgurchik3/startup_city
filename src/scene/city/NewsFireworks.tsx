import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NewsKind, Startup } from '../../types';
import { cityBuildingBaseY, cityBuildingHeight, citySpireHeight } from '../../lib/encoding';
import { CITY_PALETTE } from '../../theme/cityPalette';

interface Props {
  startups: Startup[];
  positions: Map<string, [number, number]>;
  cap?: number;
}

const KIND_PRIORITY: Record<string, number> = {
  fundraise: 4,
  product: 3,
  partnership: 2,
  other: 1,
};

const KIND_COLOR: Record<NewsKind, THREE.ColorRepresentation> = {
  fundraise: CITY_PALETTE.tealBright,
  product: CITY_PALETTE.purpleMain,
  partnership: '#2563eb',
  other: CITY_PALETTE.textMuted,
};

const PARTICLES = 16;
const CYCLE = 2.2;
const BEAM_H = 44;

function hashSeed(id: string, salt: string): number {
  let h = 2166136261 >>> 0;
  const str = `${id}::${salt}`;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function burstGeometry(kind: NewsKind, seed: number): THREE.BufferGeometry {
  let state = seed;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state & 0xffffff) / 0xffffff;
  };

  const positions = new Float32Array(PARTICLES * 3);
  const colors = new Float32Array(PARTICLES * 3);
  const c = new THREE.Color(KIND_COLOR[kind]);
  for (let i = 0; i < PARTICLES; i += 1) {
    const u = next() * Math.PI * 2;
    const v = next();
    const spread = 0.15 + v * 0.55;
    positions[i * 3 + 0] = Math.cos(u) * spread * 0.4;
    positions[i * 3 + 1] = 0.2 + next() * 0.75;
    positions[i * 3 + 2] = Math.sin(u) * spread * 0.4;
    const jitter = 0.7 + next() * 0.35;
    colors[i * 3 + 0] = c.r * jitter;
    colors[i * 3 + 1] = c.g * jitter;
    colors[i * 3 + 2] = c.b * jitter;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

const noopRaycast: THREE.Object3D['raycast'] = () => {};

function NewsBurst({ startup, eventKind }: { startup: Startup; eventKind: NewsKind }) {
  const pickRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const geomSeed = useMemo(
    () => hashSeed(startup.id, `news-${eventKind}`),
    [startup.id, eventKind]
  );
  const geom = useMemo(
    () => burstGeometry(eventKind, geomSeed),
    [eventKind, geomSeed]
  );
  const beamColor = useMemo(() => new THREE.Color(KIND_COLOR[eventKind]), [eventKind]);
  const pointsMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.22,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [beamColor]
  );
  const phaseOffset = useMemo(
    () => (hashSeed(startup.id, 'phase') % 10000) / 10000,
    [startup.id]
  );

  useFrame((state) => {
    const t = (state.clock.elapsedTime + phaseOffset * CYCLE) % CYCLE;
    const phase = t / CYCLE;
    const fade = 1 - Math.pow(phase, 1.55);

    const pts = pointsRef.current;
    if (pts) {
      const rise = phase * 0.95;
      const spread = 0.32 + phase * 1.6;
      pts.position.y = rise;
      pts.scale.setScalar(spread);
      (pts.material as THREE.PointsMaterial).opacity = Math.max(0, fade * 0.72);
    }

    const beamMesh = beamRef.current;
    if (beamMesh) {
      const bm = beamMesh.material as THREE.MeshBasicMaterial;
      const pulse = 0.28 + 0.34 * (0.5 + 0.5 * Math.sin(t * 4.2 + phaseOffset * 12));
      bm.opacity = pulse * (0.55 + 0.45 * fade);
    }
  });

  useLayoutEffect(() => {
    if (pickRef.current) pickRef.current.raycast = noopRaycast;
    if (beamRef.current) beamRef.current.raycast = noopRaycast;
    if (pointsRef.current) pointsRef.current.raycast = noopRaycast;
  }, []);

  return (
    <group>
      <mesh ref={pickRef} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.5, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Volumetric-style spotlight: wide at top, tight at roof */}
      <mesh ref={beamRef} position={[0, BEAM_H * 0.5, 0]} material={beamMat}>
        <cylinderGeometry args={[0.52, 0.06, BEAM_H, 14, 1, true]} />
      </mesh>
      <points ref={pointsRef} geometry={geom} material={pointsMat} />
    </group>
  );
}

export function NewsFireworks({ startups, positions, cap = 50 }: Props) {
  const items = useMemo(() => {
    const events = startups
      .filter((s) => s.events.length > 0)
      .map((s) => ({ s, e: s.events[0] }));
    events.sort((a, b) => {
      const pa = KIND_PRIORITY[a.e.kind] ?? 0;
      const pb = KIND_PRIORITY[b.e.kind] ?? 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.e.date).getTime() - new Date(a.e.date).getTime();
    });
    return events.slice(0, cap);
  }, [startups, cap]);

  return (
    <group>
      {items.map(({ s, e }) => {
        const pos = positions.get(s.id);
        if (!pos) return null;
        const [x, z] = pos;
        const baseY = cityBuildingBaseY(s) + cityBuildingHeight(s) + citySpireHeight(s) + 0.05;
        return (
          <group key={s.id} position={[x, baseY, z]}>
            <NewsBurst startup={s} eventKind={e.kind} />
          </group>
        );
      })}
    </group>
  );
}
