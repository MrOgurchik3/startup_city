// GLSL building shader — deck teal IPO, purple M&A, dark operating bases.

export const BUILDING_VS = /* glsl */ `
attribute vec3 instanceBodyColor;
attribute float instanceWindowDensity;
attribute float instanceWindowIntensity;
attribute float instanceHeight;
attribute float instanceSelected;
attribute float instanceOutcomeMute;
attribute float instanceOutcomeAccent;

varying vec3 vBodyColor;
varying vec2 vUv;
varying vec3 vNormal;
varying float vWindowDensity;
varying float vWindowIntensity;
varying float vWorldY;
varying float vSelected;
varying float vHeight;
varying float vOutcomeMute;
varying float vOutcomeAccent;

void main() {
  vBodyColor = instanceBodyColor;
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vWindowDensity = instanceWindowDensity;
  vWindowIntensity = instanceWindowIntensity;
  vSelected = instanceSelected;
  vHeight = instanceHeight;
  vOutcomeMute = instanceOutcomeMute;
  vOutcomeAccent = instanceOutcomeAccent;

  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  vWorldY = worldPos.y;
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

export const BUILDING_FS = /* glsl */ `
precision highp float;

varying vec3 vBodyColor;
varying vec2 vUv;
varying vec3 vNormal;
varying float vWindowDensity;
varying float vWindowIntensity;
varying float vWorldY;
varying float vSelected;
varying float vHeight;
varying float vOutcomeMute;
varying float vOutcomeAccent;

const vec3 TINT_IPO = vec3(0.051, 0.580, 0.533);
const vec3 TINT_MA = vec3(0.42, 0.26, 0.72);
const vec3 INK = vec3(0.06, 0.09, 0.16);
const vec3 PURPLE_SEL = vec3(0.49, 0.23, 0.93);

void main() {
  vec3 base = vBodyColor;
  float m = vOutcomeMute;
  float grey = dot(base, vec3(0.299, 0.587, 0.114));
  base = mix(base, vec3(grey * 0.08 + 0.02), m * 0.95);

  if (m < 0.35) {
    float oa = vOutcomeAccent;
    if (oa > 0.5 && oa < 1.5) {
      base = mix(base, TINT_IPO, 0.58);
    } else if (oa > 1.5 && oa < 2.5) {
      base = mix(base, TINT_MA, 0.52);
    }
  }

  float verticality = 1.0 - abs(vNormal.y);
  float isSide = step(0.5, verticality);

  float rows = clamp(floor(vHeight * 1.8), 4.0, 60.0);
  float cols = 5.0;
  vec2 cell = vec2(cols, rows);
  vec2 grid = vUv * cell;
  vec2 g = fract(grid);
  vec2 gi = floor(grid);

  float cellJitter = fract(sin(dot(gi, vec2(12.9898, 78.233))) * 43758.5453);
  base *= 1.0 + 0.028 * (cellJitter - 0.5);

  float verticalFactor = clamp(vUv.y, 0.0, 1.0);
  base = mix(base, base * 1.04, verticalFactor * 0.18);

  float seed = fract(sin(dot(gi, vec2(12.9898, 78.233))) * 43758.5453);
  float lit = step(seed, vWindowDensity);

  float windowMask = step(0.12, g.x) * step(g.x, 0.88) *
                     step(0.16, g.y) * step(g.y, 0.84);

  float inten = pow(clamp(vWindowIntensity, 0.06, 1.0), 1.08);
  vec3 windowDark = mix(base * 0.72, INK, 0.35);
  vec3 windowBright = mix(vec3(0.42, 0.68, 0.92), vec3(0.88, 0.94, 1.0), inten);
  vec3 windowLitColor = mix(windowDark, windowBright, inten);

  float cover = isSide * windowMask * lit;
  float brighten = 0.35 + 1.05 * inten;
  vec3 col = mix(base, windowLitColor, clamp(cover * brighten, 0.0, 1.0));

  float fres = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
  col = mix(col, col * 0.9, fres * 0.2);

  col = mix(col, col * vec3(0.42, 0.44, 0.48), m * 0.78);

  if (vSelected > 0.5) {
    col = mix(col, mix(col, PURPLE_SEL, 0.38), 0.55);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
