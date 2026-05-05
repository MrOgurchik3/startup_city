import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Startup } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import {
  cityBuildingPickAabb,
  cityBuildingWidth,
} from '../../lib/encoding';

const GROUND_FALLBACK_MUL = 0.94;

type PickVolume = {
  id: string;
  min: [number, number, number];
  max: [number, number, number];
};

type GroundCell = {
  id: string;
  x: number;
  z: number;
  rSq: number;
};

/**
 * Hover + click: ray vs building AABB (closest hit along ray = in front).
 * Optional xz fallback when the ray misses all boxes (gaps between towers).
 */
export function CityXZPick({
  entities,
  positions,
  active,
}: {
  entities: Startup[];
  positions: Map<string, [number, number]>;
  active: boolean;
}) {
  const { camera, gl } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const boxRef = useRef(new THREE.Box3());
  const hitPtRef = useRef(new THREE.Vector3());
  const tToHitRef = useRef(new THREE.Vector3());

  const setHover = useAppStore((s) => s.setHover);
  const selectEntity = useAppStore((s) => s.selectEntity);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const volumes = useMemo((): PickVolume[] => {
    const out: PickVolume[] = [];
    entities.forEach((s) => {
      const p = positions.get(s.id);
      if (!p) return;
      const a = cityBuildingPickAabb(s, p[0], p[1]);
      out.push({ id: s.id, min: a.min, max: a.max });
    });
    return out;
  }, [entities, positions]);

  const groundCells = useMemo((): GroundCell[] => {
    const out: GroundCell[] = [];
    entities.forEach((s) => {
      const p = positions.get(s.id);
      if (!p) return;
      const w = Math.max(0.7, cityBuildingWidth(s));
      const r = w * GROUND_FALLBACK_MUL * 1.32;
      out.push({
        id: s.id,
        x: p[0],
        z: p[1],
        rSq: r * r,
      });
    });
    return out;
  }, [entities, positions]);

  const volumesRef = useRef(volumes);
  const groundRef = useRef(groundCells);
  volumesRef.current = volumes;
  groundRef.current = groundCells;

  const downRef = useRef<{ x: number; y: number } | null>(null);
  const rafHoverRef = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    if (!active) return undefined;

    const raycaster = raycasterRef.current;
    raycaster.near = 0.12;
    raycaster.far = 8000;

    const pickAt = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      ndcRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcRef.current, camera);
      const ray = raycaster.ray;

      let bestT = Infinity;
      let bestId: string | null = null;
      const box = boxRef.current;
      const hitPt = hitPtRef.current;
      const tTmp = tToHitRef.current;

      for (const v of volumesRef.current) {
        box.min.fromArray(v.min);
        box.max.fromArray(v.max);
        const pt = ray.intersectBox(box, hitPt);
        if (!pt) continue;
        tTmp.copy(pt).sub(ray.origin);
        const t = tTmp.dot(ray.direction);
        if (t >= raycaster.near && t <= raycaster.far && t < bestT) {
          bestT = t;
          bestId = v.id;
        }
      }

      if (bestId) return bestId;

      const groundHit = hitPt;
      if (!ray.intersectPlane(planeRef.current, groundHit)) return null;

      const gx = groundHit.x;
      const gz = groundHit.z;
      const cells = groundRef.current;

      let bestGround: string | null = null;
      let bestD = Infinity;
      cells.forEach((c) => {
        const dx = gx - c.x;
        const dz = gz - c.z;
        const d = dx * dx + dz * dz;
        if (d <= c.rSq && d < bestD) {
          bestD = d;
          bestGround = c.id;
        }
      });
      return bestGround;
    };

    const flushHover = (clientX: number, clientY: number) => {
      if (rafHoverRef.current) cancelAnimationFrame(rafHoverRef.current);
      rafHoverRef.current = requestAnimationFrame(() => {
        const id = pickAt(clientX, clientY);
        if (id) {
          document.body.style.cursor = 'pointer';
          setHover({ kind: 'entity', id, x: clientX, y: clientY });
        } else {
          document.body.style.cursor = '';
          setHover(null);
        }
      });
    };

    const onLeave = () => {
      document.body.style.cursor = '';
      setHover(null);
    };

    const onMove = (e: PointerEvent) => {
      if ((e.buttons & 1) !== 0 || (e.buttons & 4) !== 0) return;
      flushHover(e.clientX, e.clientY);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      downRef.current = { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const start = downRef.current;
      downRef.current = null;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 64) return;
      const id = pickAt(e.clientX, e.clientY);
      if (id) selectEntity(id);
      else {
        clearSelection();
        setHover(null);
      }
    };

    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      if (rafHoverRef.current) cancelAnimationFrame(rafHoverRef.current);
      document.body.style.cursor = '';
    };
  }, [active, camera, clearSelection, gl, selectEntity, setHover]);

  return null;
}
