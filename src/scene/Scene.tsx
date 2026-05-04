import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MOUSE, TOUCH } from 'three';
import { useAppStore } from '../store/useAppStore';
import { CITY_PALETTE } from '../theme/cityPalette';
import { CityScene } from './city/CityScene';
import { GlobalScene } from './global/GlobalScene';

const SCENE_SKY = CITY_PALETTE.mapLightSky;

function HorizonFog() {
  const mode = useAppStore((s) => s.mode);
  if (mode === 'global') {
    return <fogExp2 attach="fog" args={[SCENE_SKY, 0.000095]} />;
  }
  return <fogExp2 attach="fog" args={[SCENE_SKY, 0.00105]} />;
}

function PostEffects() {
  const mode = useAppStore((s) => s.mode);
  const isGlobal = mode === 'global';
  return (
    <EffectComposer>
      <Bloom
        intensity={isGlobal ? 0.24 : 0.22}
        luminanceThreshold={isGlobal ? 0.52 : 0.62}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <Vignette
        eskil={false}
        offset={isGlobal ? 0.34 : 0.42}
        darkness={isGlobal ? 0.22 : 0.24}
      />
    </EffectComposer>
  );
}

function ResetSelectionOnEmptyClick() {
  const clearSelection = useAppStore((s) => s.clearSelection);
  return (
    <mesh
      position={[0, -0.01, 0]}
      rotation-x={-Math.PI / 2}
      onClick={(e) => {
        e.stopPropagation();
        clearSelection();
      }}
    >
      <planeGeometry args={[20000, 20000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function CameraRig() {
  const mode = useAppStore((s) => s.mode);
  const globalNavMode = useAppStore((s) => s.globalNavMode);
  const controls = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.target.set(0, 0, 0);
    if (mode === 'global') {
      // North-side vantage (projection: north = −Z); not from the south below the map.
      c.object.position.set(28, 98, -88);
    } else {
      c.object.position.set(60, 55, 60);
    }
    c.update();
  }, [mode]);

  const panFirst = mode === 'global' && globalNavMode === 'pan';

  const maxPolarAngle = mode === 'global' ? Math.PI * 0.58 : Math.PI * 0.52;
  const minPolarAngle = mode === 'global' ? 0.12 : 0.08;
  const minDistance = mode === 'global' ? 32 : 12;
  const maxDistance = mode === 'global' ? 480 : 220;

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableRotate
      enableZoom
      screenSpacePanning={panFirst}
      panSpeed={mode === 'global' ? (panFirst ? 0.95 : 0.7) : 1.05}
      rotateSpeed={0.78}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      minDistance={minDistance}
      maxDistance={maxDistance}
      mouseButtons={{
        LEFT: panFirst ? MOUSE.PAN : MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: panFirst ? MOUSE.ROTATE : MOUSE.PAN,
      }}
      touches={{
        ONE: panFirst ? TOUCH.PAN : TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN,
      }}
    />
  );
}

export function Scene() {
  const mode = useAppStore((s) => s.mode);

  return (
    <Canvas
      shadows={false}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: 45, near: 0.1, far: 4000, position: [28, 98, -88] }}
      onCreated={({ scene, gl }) => {
        scene.background = new THREE.Color(CITY_PALETTE.mapLightSky);
        gl.setClearColor(CITY_PALETTE.mapLightSky);
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <ambientLight intensity={0.85} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#ebe8e4', 0.5]} />
      <directionalLight
        position={[120, 200, 90]}
        intensity={0.85}
        color="#ffffff"
      />
      <directionalLight
        position={[-100, 80, -120]}
        intensity={0.25}
        color="#d6e1f0"
      />

      <HorizonFog />

      <Suspense fallback={null}>
        {mode === 'global' ? <GlobalScene /> : <CityScene />}
      </Suspense>

      <ResetSelectionOnEmptyClick />
      <CameraRig />

      <PostEffects />
    </Canvas>
  );
}
