import * as THREE from 'three';
import type { Position } from 'geojson';
import { loadWorldAtlas } from '../../data/worldAtlas';
import { polysFromGeometry, type PolyRings } from './geoUtils';

/**
 * Rasterise the world-atlas TopoJSON onto a single equirectangular canvas
 * (lng:-180→+180 maps to x:0→W, lat:+90→-90 maps to y:0→H), then upload as a
 * CanvasTexture. Used as the diffuse map on the globe sphere; eliminates the
 * per-country triangulation seams entirely.
 *
 * Sphere setup must use phiStart=-π/2 so this texture aligns with lngLatToSphere:
 *   u(lng) = (lng + 180) / 360
 *   v(lat) = 1 - (lat + 90) / 180   (with the default flipY texture upload)
 */
const TEX_W = 4096;
const TEX_H = 2048;

const OCEAN = '#a8b9cf';
const LAND = '#d4ccba';
const COAST = '#9aa090';
const COAST_W = 1.1;

let cache: Promise<THREE.CanvasTexture> | null = null;

function projectX(lng: number): number {
  return ((lng + 180) / 360) * TEX_W;
}

function projectY(lat: number): number {
  return ((90 - lat) / 180) * TEX_H;
}

/**
 * Walk a closed lng/lat ring and return a copy in which consecutive lng deltas
 * are constrained to (-180, 180]. Ring may end up with lng values outside the
 * canonical [-180, 180] range; we then draw it (and shifted copies at ±360°)
 * so antimeridian-crossing polygons render seamlessly through the canvas wrap.
 */
function unwrapRing(ring: Position[]): Position[] {
  if (ring.length === 0) return [];
  const out: Position[] = [];
  let prev = ring[0][0];
  out.push([prev, ring[0][1]]);
  for (let i = 1; i < ring.length; i += 1) {
    let lng = ring[i][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, ring[i][1]]);
    prev = lng;
  }
  return out;
}

function ringLngBounds(ring: Position[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  ring.forEach(([lng]) => {
    if (lng < min) min = lng;
    if (lng > max) max = lng;
  });
  return { min, max };
}

function drawPolygon(ctx: CanvasRenderingContext2D, polygon: PolyRings, lngOffsetDeg: number): void {
  ctx.beginPath();
  polygon.forEach((rawRing) => {
    const ring = unwrapRing(rawRing);
    ring.forEach(([lng, lat], i) => {
      const x = projectX(lng + lngOffsetDeg);
      const y = projectY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  });
  ctx.fill('evenodd');
  if (COAST_W > 0) ctx.stroke();
}

export function loadEarthTexture(): Promise<THREE.CanvasTexture> {
  if (cache) return cache;
  cache = (async () => {
    const fc = await loadWorldAtlas();

    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    ctx.fillStyle = LAND;
    ctx.strokeStyle = COAST;
    ctx.lineWidth = COAST_W;
    ctx.lineJoin = 'round';

    fc.features.forEach((f) => {
      const polys = polysFromGeometry(f.geometry);
      polys.forEach((rings) => {
        const outerUnwrapped = unwrapRing(rings[0]);
        const { min, max } = ringLngBounds(outerUnwrapped);

        // Always draw at the canonical position. If the polygon crosses the
        // ±180° seam after unwrapping, also draw shifted copies so the wrap is
        // visually continuous.
        drawPolygon(ctx, rings, 0);
        if (min < -180) drawPolygon(ctx, rings, 360);
        if (max > 180) drawPolygon(ctx, rings, -360);
      });
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  })();
  return cache;
}
