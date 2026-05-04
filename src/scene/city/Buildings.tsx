import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingHeight,
  cityBuildingWidth,
  cityOutcomeAccent,
  cityWindowDensity,
  cityWindowIntensity,
  shapeGroup,
} from '../../lib/encoding';
import { SELECTED_COLOR } from '../../data/stages';
import { BUILDING_FS, BUILDING_VS } from './buildingShader';
import { useAppStore } from '../../store/useAppStore';
import { CITY_PALETTE, mixHex } from '../../theme/cityPalette';

interface BuildingsProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

function makeTriangularTower(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = 0.68;
  shape.moveTo(0, r * 0.55);
  shape.lineTo(-r * 0.866, -r * 0.28);
  shape.lineTo(r * 0.866, -r * 0.28);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (bb) {
    const minY = bb.min.y;
    const spanY = Math.max(bb.max.y - minY, 1e-6);
    g.translate(0, -minY, 0);
    g.scale(1, 1 / spanY, 1);
  }
  return g;
}

const SHAPE_DEFS: { geometry: () => THREE.BufferGeometry }[] = [
  {
    geometry: () => {
      const g = new THREE.BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      return g;
    },
  },
  // VC: tall triangular prism (reads as HQ tower, not a mound)
  { geometry: () => makeTriangularTower() },
  // Angel: slim square tower
  {
    geometry: () => {
      const g = new THREE.BoxGeometry(0.38, 1, 0.38);
      g.translate(0, 0.5, 0);
      return g;
    },
  },
  // Other / family office: hexagonal column
  {
    geometry: () => {
      const g = new THREE.CylinderGeometry(0.34, 0.36, 1, 6);
      g.translate(0, 0.5, 0);
      return g;
    },
  },
];

function buildShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BUILDING_VS,
    fragmentShader: BUILDING_FS,
    transparent: false,
    side: THREE.FrontSide,
  });
}

const INV_FOOTPRINT_MUL = 1.1;

function footprintScale(shape: 0 | 1 | 2 | 3, w: number, h: number): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  switch (shape) {
    case 1:
      m.makeScale(
        w * 1.12 * INV_FOOTPRINT_MUL,
        h * 1.18 * INV_FOOTPRINT_MUL,
        w * 1.06 * INV_FOOTPRINT_MUL
      );
      break;
    case 2:
      m.makeScale(w * 0.88 * INV_FOOTPRINT_MUL, h * INV_FOOTPRINT_MUL, w * 0.88 * INV_FOOTPRINT_MUL);
      break;
    case 3:
      m.makeScale(w * 0.96 * INV_FOOTPRINT_MUL, h * INV_FOOTPRINT_MUL, w * 0.96 * INV_FOOTPRINT_MUL);
      break;
    default:
      m.makeScale(w, h, w);
  }
  return m;
}

function ShapeGroup({
  startups,
  positions,
  shape,
}: {
  startups: Startup[];
  positions: Map<string, [number, number]>;
  shape: 0 | 1 | 2 | 3;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const podiumRef = useRef<THREE.InstancedMesh | null>(null);
  const setHover = useAppStore((s) => s.setHover);
  const selectStartup = useAppStore((s) => s.selectStartup);
  const selection = useAppStore((s) => s.selection);

  const geometry = useMemo(() => SHAPE_DEFS[shape].geometry(), [shape]);
  const material = useMemo(() => buildShaderMaterial(), []);
  const podiumGeometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const podiumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: mixHex(mixHex(CITY_PALETTE.stone, CITY_PALETTE.textMain, 0.42), CITY_PALETTE.activeNav, 0.18),
        roughness: 0.91,
        metalness: 0.04,
      }),
    []
  );
  const investorShape = shape >= 1;

  useLayoutEffect(() => {
    const p = podiumRef.current;
    if (!p || !investorShape) return;
    p.raycast = () => {};
  }, [investorShape]);

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
    const scaleM = new THREE.Matrix4();
    const startupFlopped = new THREE.Color(CITY_PALETTE.startupFlopped);
    const invVc = new THREE.Color(CITY_PALETTE.investorVc);
    const invAngel = new THREE.Color(CITY_PALETTE.investorAngel);
    const invOther = new THREE.Color(CITY_PALETTE.investorOther);
    const tmpColor = new THREE.Color();
    const sel = selection?.kind === 'startup' ? selection.id : null;

    startups.forEach((s, i) => {
      const pos = positions.get(s.id);
      if (!pos) return;
      const [x, z] = pos;
      const w = cityBuildingWidth(s);
      const h = cityBuildingHeight(s);
      const baseY = cityBuildingBaseY(s);

      scaleM.copy(footprintScale(shape, w, h));
      matrix.copy(scaleM);
      matrix.setPosition(x, baseY, z);
      mesh.setMatrixAt(i, matrix);

      if (podium && investorShape) {
        podiumM.makeScale(w * 1.06, 0.022, w * 1.06);
        podiumM.setPosition(x, Math.max(0.012, baseY - 0.012), z);
        podium.setMatrixAt(i, podiumM);
      }

      if (investorShape) {
        if (shape === 1) tmpColor.copy(invVc);
        else if (shape === 2) tmpColor.copy(invAngel);
        else tmpColor.copy(invOther);
      } else if (s.outcomeStatus === 'Flopped') {
        tmpColor.copy(startupFlopped);
      } else {
        tmpColor.set(CITY_PALETTE.activeNav);
      }
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

    if (podium && investorShape) {
      podium.count = startups.length;
      podium.instanceMatrix.needsUpdate = true;
    }

    const geom = mesh.geometry as THREE.InstancedBufferGeometry;
    geom.setAttribute(
      'instanceBodyColor',
      new THREE.InstancedBufferAttribute(buffers.bodyColor, 3)
    );
    geom.setAttribute(
      'instanceWindowDensity',
      new THREE.InstancedBufferAttribute(buffers.windowDensity, 1)
    );
    geom.setAttribute(
      'instanceWindowIntensity',
      new THREE.InstancedBufferAttribute(buffers.windowIntensity, 1)
    );
    geom.setAttribute(
      'instanceHeight',
      new THREE.InstancedBufferAttribute(buffers.height, 1)
    );
    geom.setAttribute(
      'instanceSelected',
      new THREE.InstancedBufferAttribute(buffers.selected, 1)
    );
    geom.setAttribute(
      'instanceOutcomeMute',
      new THREE.InstancedBufferAttribute(buffers.outcomeMute, 1)
    );
    geom.setAttribute(
      'instanceOutcomeAccent',
      new THREE.InstancedBufferAttribute(buffers.outcomeAccent, 1)
    );
  }, [startups, positions, buffers, selection, shape, investorShape]);

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const s = startups[e.instanceId];
    if (!s) return;
    setHover({ kind: 'startup', id: s.id, x: e.clientX, y: e.clientY });
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHover(null);
    document.body.style.cursor = '';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const s = startups[e.instanceId];
    if (s) selectStartup(s.id);
  };

  if (startups.length === 0) return null;

  return (
    <group>
      {investorShape && (
        <instancedMesh
          ref={podiumRef}
          args={[podiumGeometry, podiumMaterial, startups.length]}
          frustumCulled={false}
        />
      )}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, startups.length]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        frustumCulled={false}
      />
    </group>
  );
}

export function Buildings({ startups, positions }: BuildingsProps) {
  const groups = useMemo(() => {
    const byShape: Record<number, Startup[]> = { 0: [], 1: [], 2: [], 3: [] };
    startups.forEach((s) => {
      byShape[shapeGroup(s)].push(s);
    });
    return byShape;
  }, [startups]);

  return (
    <group>
      {([0, 1, 2, 3] as const).map((shape) => (
        <ShapeGroup
          key={shape}
          shape={shape}
          startups={groups[shape]}
          positions={positions}
        />
      ))}
    </group>
  );
}

export const STAGE_SELECTED = SELECTED_COLOR;
