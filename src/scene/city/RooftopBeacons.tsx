import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Startup } from '../../types';
import {
  cityBuildingBaseY,
  cityBuildingHeight,
  cityWindowDensity,
  cityWindowIntensity,
} from '../../lib/encoding';
import { CITY_PALETTE } from '../../theme/cityPalette';

interface RooftopBeaconsProps {
  startups: Startup[];
  positions: Map<string, [number, number]>;
}

/**
 * "Lights on" signal — a small quiet lamp on top of every building.
 *   density   ← visitor traffic   (was per-instance window density)
 *   intensity ← ARR / "lights on" (was per-instance window brightness)
 * Combined into one value because the GLB-detailed buildings make
 * per-window encoding unreliable. No halo: it's a marker, not a flare.
 */

const BEACON_VS = /* glsl */ `
attribute float aIntensity;
attribute vec3 aColor;
varying float vIntensity;
varying vec3 vColor;
void main() {
  vIntensity = aIntensity;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const BEACON_FS = /* glsl */ `
precision highp float;
varying float vIntensity;
varying vec3 vColor;
void main() {
  // Quiet emissive lamp — tiny modulation by intensity so high-ARR companies
  // read brighter without overwhelming the silhouette.
  vec3 col = vColor * (0.78 + 0.32 * vIntensity);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Cool-blue family that matches the Kenney facade window tone, so the lamp
// reads as part of the building rather than a foreign object on top.
const NORMAL_LIGHT = new THREE.Color('#aec5e0');
const EXIT_LIGHT = new THREE.Color('#ffffff');

export function RooftopBeacons({ startups, positions }: RooftopBeaconsProps) {
  const lampRef = useRef<THREE.InstancedMesh | null>(null);

  const lampGeom = useMemo(() => new THREE.SphereGeometry(0.5, 10, 8), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEACON_VS,
        fragmentShader: BEACON_FS,
        transparent: false,
        depthWrite: true,
        toneMapped: false,
      }),
    []
  );

  const buffers = useMemo(() => {
    const n = startups.length;
    return {
      intensity: new Float32Array(n),
      color: new Float32Array(n * 3),
    };
  }, [startups.length]);

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    const m = new THREE.Matrix4();
    const tmpColor = new THREE.Color();
    const flopped = new THREE.Color(CITY_PALETTE.startupFlopped);

    startups.forEach((s, i) => {
      const pos = positions.get(s.id);
      if (!pos) return;
      const [x, z] = pos;
      const baseY = cityBuildingBaseY(s);
      const h = cityBuildingHeight(s);
      const density = cityWindowDensity(s);
      const intensity = cityWindowIntensity(s);
      const combined = THREE.MathUtils.clamp(0.55 * density + 0.55 * intensity, 0.05, 1.2);

      // Roughly half the previous size; sits just above the roof line.
      const lampSize = 0.09 + combined * 0.16;
      const topY = baseY + h * 1.0 + lampSize * 0.6;

      m.makeScale(lampSize, lampSize, lampSize);
      m.setPosition(x, topY, z);
      lamp.setMatrixAt(i, m);

      if (s.outcomeStatus === 'Flopped') tmpColor.copy(flopped);
      else if (s.outcomeStatus === 'Unicorn' || s.outcomeStatus === 'IPO') tmpColor.copy(EXIT_LIGHT);
      else tmpColor.copy(NORMAL_LIGHT);

      buffers.color[i * 3 + 0] = tmpColor.r;
      buffers.color[i * 3 + 1] = tmpColor.g;
      buffers.color[i * 3 + 2] = tmpColor.b;
      buffers.intensity[i] = combined;
    });

    lamp.count = startups.length;
    lamp.instanceMatrix.needsUpdate = true;

    const ig = lamp.geometry as THREE.InstancedBufferGeometry;
    ig.setAttribute('aIntensity', new THREE.InstancedBufferAttribute(buffers.intensity, 1));
    ig.setAttribute('aColor', new THREE.InstancedBufferAttribute(buffers.color, 3));
  }, [startups, positions, buffers]);

  if (startups.length === 0) return null;

  return (
    <instancedMesh
      ref={lampRef}
      args={[lampGeom, material, startups.length]}
      renderOrder={20}
      frustumCulled={false}
    />
  );
}
