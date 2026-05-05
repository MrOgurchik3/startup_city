import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingRenderedHeight,
  cityBuildingWidth,
  citySpireHeight,
} from '../../lib/encoding';
import { SELECTED_COLOR } from '../../data/stages';

interface Props {
  startup: Startup | null;
  positions: Map<string, [number, number]>;
}

const noopRaycast: THREE.Mesh['raycast'] = () => {};

export function SelectionRing({ startup, positions }: Props) {
  const ringRef = useRef<THREE.Mesh | null>(null);
  const beamRef = useRef<THREE.Mesh | null>(null);

  const ringGeom = useMemo(() => {
    const g = new THREE.RingGeometry(0.8, 1.05, 64);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const beamGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.6, 0.6, 1, 24, 1, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SELECTED_COLOR,
        transparent: true,
        opacity: 0.85,
      }),
    []
  );

  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SELECTED_COLOR,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  useFrame((state) => {
    if (!startup) return;
    const pos = positions.get(startup.id);
    if (!pos) return;
    const [x, z] = pos;
    const w = cityBuildingWidth(startup);
    const by = cityBuildingBaseY(startup);
    const towerH = cityBuildingRenderedHeight(startup);
    const totalH = towerH + citySpireHeight(startup) + 1.5;
    const t = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2) * 0.08;
    if (ringRef.current) {
      ringRef.current.position.set(x, by + 0.05, z);
      ringRef.current.scale.set(w * 1.6 * pulse, 1, w * 1.6 * pulse);
    }
    if (beamRef.current) {
      beamRef.current.position.set(x, by, z);
      beamRef.current.scale.set(w * 1.4, totalH, w * 1.4);
    }
  });

  useLayoutEffect(() => {
    if (ringRef.current) ringRef.current.raycast = noopRaycast;
    if (beamRef.current) beamRef.current.raycast = noopRaycast;
  }, [startup]);

  if (!startup) return null;
  return (
    <group>
      <mesh ref={ringRef} geometry={ringGeom} material={ringMaterial} />
      <mesh ref={beamRef} geometry={beamGeom} material={beamMaterial} />
    </group>
  );
}
