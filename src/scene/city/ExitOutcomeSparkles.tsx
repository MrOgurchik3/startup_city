import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingRenderedHeight,
  citySpireHeight,
} from '../../lib/encoding';
import { CITY_PALETTE } from '../../theme/cityPalette';

interface Props {
  startups: Startup[];
  positions: Map<string, [number, number]>;
  cap?: number;
}

const SPARKS = 22;
const CYCLE = 2.8;

const noopRaycast: THREE.Object3D['raycast'] = () => {};

function hashSeed(id: string, salt: string): number {
  let h = 2166136261 >>> 0;
  const str = `${id}::${salt}`;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function sparkGeometry(seed: number, hue: THREE.Color): THREE.BufferGeometry {
  let state = seed;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state & 0xffffff) / 0xffffff;
  };
  const positions = new Float32Array(SPARKS * 3);
  const colors = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i += 1) {
    const u = next() * Math.PI * 2;
    const v = next();
    const spread = 0.2 + v * 0.85;
    positions[i * 3 + 0] = Math.cos(u) * spread * 0.35;
    positions[i * 3 + 1] = 0.25 + next() * 1.1;
    positions[i * 3 + 2] = Math.sin(u) * spread * 0.35;
    const j = 0.75 + next() * 0.45;
    colors[i * 3 + 0] = hue.r * j;
    colors[i * 3 + 1] = hue.g * j;
    colors[i * 3 + 2] = hue.b * j;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

function ExitSpark({
  startupId,
  outcome,
}: {
  startupId: string;
  outcome: 'Unicorn' | 'IPO' | 'Acquired';
}) {
  const ref = useRef<THREE.Points>(null);
  const hue = useMemo(() => {
    if (outcome === 'Unicorn') {
      return new THREE.Color(CITY_PALETTE.purpleMain).lerp(new THREE.Color(CITY_PALETTE.tealBright), 0.35);
    }
    if (outcome === 'IPO') return new THREE.Color(CITY_PALETTE.tealBright);
    return new THREE.Color(CITY_PALETTE.purpleMain);
  }, [outcome]);
  const geomSeed = useMemo(
    () => hashSeed(startupId, `exit-${outcome}`),
    [startupId, outcome]
  );
  const geom = useMemo(() => sparkGeometry(geomSeed, hue), [geomSeed, hue]);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.32,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    []
  );
  const phase = useMemo(
    () => (hashSeed(startupId, 'exit-phase') % 10000) / 10000,
    [startupId]
  );

  useLayoutEffect(() => {
    if (ref.current) ref.current.raycast = noopRaycast;
  }, []);

  useFrame((state) => {
    const pts = ref.current;
    if (!pts) return;
    const t = (state.clock.elapsedTime + phase * CYCLE) % CYCLE;
    const p = t / CYCLE;
    const rise = p * 1.4;
    const spread = 0.45 + p * 2.2;
    const fade = 1 - Math.pow(p, 1.45);
    pts.position.y = rise;
    pts.scale.setScalar(spread);
    (pts.material as THREE.PointsMaterial).opacity = Math.max(0, fade * 0.88);
  });

  return <points ref={ref} geometry={geom} material={mat} />;
}

export function ExitOutcomeSparkles({ startups, positions, cap = 40 }: Props) {
  const items = useMemo(() => {
    const exited = startups.filter(
      (s) =>
        s.outcomeStatus === 'Unicorn' ||
        s.outcomeStatus === 'IPO' ||
        s.outcomeStatus === 'Acquired'
    );
    exited.sort((a, b) => b.totalRaised - a.totalRaised);
    return exited.slice(0, cap).map((s) => ({
      s,
      outcome: s.outcomeStatus as 'Unicorn' | 'IPO' | 'Acquired',
    }));
  }, [startups, cap]);

  return (
    <group>
      {items.map(({ s, outcome }) => {
        const pos = positions.get(s.id);
        if (!pos) return null;
        const [x, z] = pos;
        const baseY =
          cityBuildingBaseY(s) + cityBuildingRenderedHeight(s) + citySpireHeight(s) + 0.12;
        return (
          <group key={`exit-${s.id}`} position={[x, baseY, z]}>
            <ExitSpark startupId={s.id} outcome={outcome} />
          </group>
        );
      })}
    </group>
  );
}
