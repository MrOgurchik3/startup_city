import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingHeight,
  cityBuildingWidth,
  cityOutcomeAccent,
  cityWindowDensity,
  cityWindowIntensity,
} from '../../lib/encoding';
import { SELECTED_COLOR } from '../../data/stages';
import { BUILDING_FS, BUILDING_VS } from './buildingShader';
import { useAppStore } from '../../store/useAppStore';
import { CITY_PALETTE, mixHex } from '../../theme/cityPalette';
import {
  ARCHETYPES,
  cityArchetypeIndex,
  INVESTOR_ANGEL_INDEX,
  INVESTOR_OTHER_INDEX,
  INVESTOR_VC_INDEX,
  type ArchetypeMeta,
} from './cityArchetypes';

const noopRaycastInstanced: THREE.InstancedMesh['raycast'] = () => {};

interface BuildingsProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

function buildShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BUILDING_VS,
    fragmentShader: BUILDING_FS,
    transparent: false,
    side: THREE.FrontSide,
  });
}

function ShapeGroup({
  startups,
  positions,
  archetype,
}: {
  startups: Startup[];
  positions: Map<string, [number, number]>;
  archetype: ArchetypeMeta;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const podiumRef = useRef<THREE.InstancedMesh | null>(null);
  const selection = useAppStore((s) => s.selection);

  const geometry = useMemo(() => archetype.builder(), [archetype]);
  const material = useMemo(() => buildShaderMaterial(), []);

  const podiumGeometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const podiumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: mixHex(
          mixHex(CITY_PALETTE.stone, CITY_PALETTE.textMain, 0.42),
          CITY_PALETTE.activeNav,
          0.18
        ),
        roughness: 0.91,
        metalness: 0.04,
      }),
    []
  );

  useLayoutEffect(() => {
    const p = podiumRef.current;
    if (!p || !archetype.isInvestor) return;
    p.raycast = noopRaycastInstanced;
  }, [archetype.isInvestor]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.raycast = noopRaycastInstanced;
  }, [archetype]);

  const buffers = useMemo(() => {
    const count = startups.length;
    return {
      bodyColor: new Float32Array(count * 3),
      windowDensity: new Float32Array(count),
      windowIntensity: new Float32Array(count),
      height: new Float32Array(count),
      selected: new Float32Array(count),
      outcomeMute: new Float32Array(count),
      outcomeAccent: new Float32Array(count),
    };
  }, [startups.length]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const podium = podiumRef.current;
    const matrix = new THREE.Matrix4();
    const podiumM = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScl = new THREE.Vector3();
    const startupFlopped = new THREE.Color(CITY_PALETTE.startupFlopped);
    const invVc = new THREE.Color(CITY_PALETTE.investorVc);
    const invAngel = new THREE.Color(CITY_PALETTE.investorAngel);
    const invOther = new THREE.Color(CITY_PALETTE.investorOther);
    const tmpColor = new THREE.Color();
    const sel = selection?.kind === 'entity' ? selection.id : null;
    const [mx, my, mz] = archetype.scaleMul;
    const thicknessMul = 1.32;

    startups.forEach((s, i) => {
      const pos = positions.get(s.id);
      if (!pos) return;
      const [x, z] = pos;
      const w = cityBuildingWidth(s);
      const h = cityBuildingHeight(s);
      const baseY = cityBuildingBaseY(s);

      tmpPos.set(x, baseY, z);
      tmpQuat.identity();
      tmpScl.set(w * mx * thicknessMul, h * my, w * mz * thicknessMul);
      matrix.compose(tmpPos, tmpQuat, tmpScl);
      mesh.setMatrixAt(i, matrix);

      if (podium && archetype.isInvestor) {
        podiumM.makeScale(w * 1.06, 0.022, w * 1.06);
        podiumM.setPosition(x, Math.max(0.012, baseY - 0.012), z);
        podium.setMatrixAt(i, podiumM);
      }

      if (archetype.index === INVESTOR_VC_INDEX) tmpColor.copy(invVc);
      else if (archetype.index === INVESTOR_ANGEL_INDEX) tmpColor.copy(invAngel);
      else if (archetype.index === INVESTOR_OTHER_INDEX) tmpColor.copy(invOther);
      else if (s.outcomeStatus === 'Flopped') tmpColor.copy(startupFlopped);
      else tmpColor.set(CITY_PALETTE.activeNav);

      buffers.bodyColor[i * 3 + 0] = tmpColor.r;
      buffers.bodyColor[i * 3 + 1] = tmpColor.g;
      buffers.bodyColor[i * 3 + 2] = tmpColor.b;

      buffers.windowDensity[i] = cityWindowDensity(s);
      buffers.windowIntensity[i] = cityWindowIntensity(s);
      buffers.height[i] = h;
      buffers.selected[i] = sel === s.id ? 1.0 : 0.0;
      buffers.outcomeMute[i] = s.outcomeStatus === 'Flopped' ? 1.0 : 0.0;
      buffers.outcomeAccent[i] = cityOutcomeAccent(s);
    });

    mesh.count = startups.length;
    mesh.instanceMatrix.needsUpdate = true;

    if (podium && archetype.isInvestor) {
      podium.count = startups.length;
      podium.instanceMatrix.needsUpdate = true;
    }

    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute('instanceBodyColor', new THREE.InstancedBufferAttribute(buffers.bodyColor, 3));
    geom.setAttribute('instanceWindowDensity', new THREE.InstancedBufferAttribute(buffers.windowDensity, 1));
    geom.setAttribute('instanceWindowIntensity', new THREE.InstancedBufferAttribute(buffers.windowIntensity, 1));
    geom.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(buffers.height, 1));
    geom.setAttribute('instanceSelected', new THREE.InstancedBufferAttribute(buffers.selected, 1));
    geom.setAttribute('instanceOutcomeMute', new THREE.InstancedBufferAttribute(buffers.outcomeMute, 1));
    geom.setAttribute('instanceOutcomeAccent', new THREE.InstancedBufferAttribute(buffers.outcomeAccent, 1));
  }, [startups, positions, buffers, selection, archetype]);

  if (startups.length === 0) return null;

  return (
    <group>
      {archetype.isInvestor && (
        <instancedMesh
          ref={podiumRef}
          args={[podiumGeometry, podiumMaterial, startups.length]}
          frustumCulled={false}
        />
      )}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, startups.length]}
        frustumCulled={false}
      />
    </group>
  );
}

export function Buildings({ startups, positions }: BuildingsProps) {
  const groups = useMemo(() => {
    const byArchetype = new Map<number, Startup[]>();
    ARCHETYPES.forEach((a) => byArchetype.set(a.index, []));
    startups.forEach((s) => {
      const idx = cityArchetypeIndex(s);
      const list = byArchetype.get(idx);
      if (list) list.push(s);
    });
    return byArchetype;
  }, [startups]);

  return (
    <group>
      {ARCHETYPES.map((a) => (
        <ShapeGroup
          key={a.index}
          archetype={a}
          startups={groups.get(a.index) ?? []}
          positions={positions}
        />
      ))}
    </group>
  );
}

export const STAGE_SELECTED = SELECTED_COLOR;
