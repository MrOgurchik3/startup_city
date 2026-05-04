import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { R_GLOBE } from '../../lib/projection';
import { useAppStore } from '../../store/useAppStore';
import { loadEarthTexture } from './earthTexture';

const OCEAN_COLOR = '#a8b9cf';
const OCEAN_EMISSIVE = new THREE.Color('#5b6f8b').multiplyScalar(0.04);
const ATMOSPHERE_COLOR = new THREE.Color('#cfdcef');

const ATM_VS = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const ATM_FS = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
  float a = pow(rim, 2.4) * 0.85;
  gl_FragColor = vec4(uColor, a);
}
`;

/**
 * Globe sphere + soft outer Fresnel atmosphere rim.
 *
 * Sphere uses phiStart=-π/2 so the standard equirectangular Earth texture
 * (drawn in earthTexture.ts as lng:-180→+180 across canvas X) lines up with
 * world positions emitted by lngLatToSphere.
 */
export function GlobeOcean() {
  const clearSelection = useAppStore((s) => s.clearSelection);
  const [earthTex, setEarthTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEarthTexture()
      .then((t) => {
        if (!cancelled) setEarthTex(t);
      })
      .catch(() => {
        // Fallback to flat ocean colour if the atlas fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const atmMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: ATM_VS,
      fragmentShader: ATM_FS,
      uniforms: { uColor: { value: ATMOSPHERE_COLOR } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      fog: false,
    });
  }, []);

  return (
    <group>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          clearSelection();
        }}
        renderOrder={0}
      >
        <sphereGeometry args={[R_GLOBE, 128, 96, -Math.PI / 2]} />
        <meshStandardMaterial
          map={earthTex ?? null}
          color={earthTex ? '#ffffff' : OCEAN_COLOR}
          emissive={OCEAN_EMISSIVE}
          roughness={0.82}
          metalness={0.04}
        />
      </mesh>
      <mesh material={atmMaterial} renderOrder={-10}>
        <sphereGeometry args={[R_GLOBE * 1.045, 64, 48]} />
      </mesh>
    </group>
  );
}
