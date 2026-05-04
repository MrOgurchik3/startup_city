import { useMemo } from 'react';
import * as THREE from 'three';
import { CITY_PALETTE } from '../theme/cityPalette';

const ZENITH = new THREE.Color(CITY_PALETTE.mapLightSky);
const HAZE = new THREE.Color(CITY_PALETTE.mapSkyHaze);
const HORIZON = new THREE.Color(CITY_PALETTE.mapSkyHorizon);

const VS = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = /* glsl */ `
varying vec3 vWorld;
uniform vec3 uZenith;
uniform vec3 uHaze;
uniform vec3 uHorizon;
void main() {
  vec3 dir = normalize(vWorld);
  float h = dir.y;
  vec3 col = mix(uHaze, uZenith, smoothstep(-0.06, 0.82, h));
  float low = smoothstep(0.28, -0.48, h);
  col = mix(col, uHorizon, low * 0.55);
  col = mix(col, uHaze, low * 0.25);
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Inner sky shell: light-theme only — soft haze, airy horizon band, gentle “reflection”
 * (no dark tones). Shared by global map and city.
 */
export function InfiniteHorizonBackdrop() {
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        uZenith: { value: ZENITH },
        uHaze: { value: HAZE },
        uHorizon: { value: HORIZON },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    return m;
  }, []);

  return (
    <mesh renderOrder={-800} scale={[1, 0.55, 1]} material={material}>
      <sphereGeometry args={[1600, 48, 32]} />
    </mesh>
  );
}
