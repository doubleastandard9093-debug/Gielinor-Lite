// Detailed character anatomy: jointed humanoids (shoulder > elbow > wrist with
// fingers, hip > knee > foot), muscle-shaped limbs, faces, per-character variety,
// and a distance LOD (cheap baked mesh far away, detailed rig built on demand up close).
import * as THREE from 'three';
import { getNoiseTexture } from './gfx.js';
import { DAY } from './daycycle.js';
const CHAR_LIGHT = { dir: { value: DAY.lightDir }, col: { value: DAY.lightCol }, k: { get value() { return DAY.dirK; } } };
import { prim, place, paint, col, kit, snoise, blob, vcMat, humanoidParts, npcExtras } from './models.js';

// Character skin/cloth material (no world-xz bump: it flattens vertical surfaces).
// Characters get: a triplanar fine-noise bump (pores, weave, fur), a rim/sheen term,
// and a warm subsurface-style glow on skin-coloured vertices. The extra terms are
// switched off on Low via CHAR.q.
export const CHAR = { q: { value: 1 } };
export function makeCharMat({ rough = 0.68, metal = 0.02, bump = 0.35, freq = 9, rim = 0.35, sss = 1, sheen = 0, gear = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
  m.onBeforeCompile = sh => {
    sh.uniforms.tCharNoise = { value: getNoiseTexture() }; sh.uniforms.charQ = CHAR.q; sh.uniforms.cLDir = CHAR_LIGHT.dir; sh.uniforms.cLCol = CHAR_LIGHT.col; sh.uniforms.cLK = CHAR_LIGHT.k;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying vec3 vCN;' + (gear ? ' varying vec3 vGP;' : ''))
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cwp = instanceMatrix * cwp;
        #endif
        vCW = (modelMatrix * cwp).xyz; vCN = normalize(mat3(modelMatrix) * objectNormal);${gear ? ' vGP = transformed;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCW; varying vec3 vCN; uniform sampler2D tCharNoise; uniform float charQ, cLK; uniform vec3 cLDir, cLCol;${gear ? `
        varying vec3 vGP; const float gk = ${gear.toFixed(1)};
${GEAR_GLSL}` : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float skinR = smoothstep(0.06, 0.2, vColor.r - vColor.b) * smoothstep(0.02, 0.12, vColor.g - vColor.b) * ${sss.toFixed(2)};
        roughnessFactor = mix(roughnessFactor, 0.5, skinR * charQ);   // skin has a soft oily sheen, cloth stays matte${gear ? `
        // armour pattern on everything that is not skin (and not near-black trim)
        float gM = (1.0 - smoothstep(0.02, 0.1, skinR)) * smoothstep(0.06, 0.16, max(vColor.r, max(vColor.g, vColor.b)));
        float gF = gM * charQ * (1.0 - smoothstep(8.0, 22.0, length(cameraPosition - vCW))); vec4 gP = gearPat(vGP);
        diffuseColor.rgb *= mix(1.0, gP.y, gF); roughnessFactor = mix(roughnessFactor, gP.w, gF);` : ''}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>${gear ? `
        metalnessFactor = mix(0.02, mix(0.15, 0.85, gP.z), gM);` : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float cfade = charQ * (1.0 - smoothstep(10.0, 28.0, length(cameraPosition - vCW)));
        if (cfade > 0.01) {
          vec3 bw = abs(vCN); bw /= (bw.x + bw.y + bw.z);
          vec3 P = vCW * ${freq.toFixed(1)};
          float hx = texture2D(tCharNoise, P.yz).r * bw.x + texture2D(tCharNoise, P.xz).r * bw.y + texture2D(tCharNoise, P.xy).r * bw.z;
          float hy = texture2D(tCharNoise, P.yz + 0.37).g * bw.x + texture2D(tCharNoise, P.xz + 0.37).g * bw.y + texture2D(tCharNoise, P.xy + 0.37).g * bw.z;
          vec3 wn = normalize(vCN + (vec3(hx, hy, 1.0 - hx) - 0.5) * ${bump.toFixed(2)} * cfade);
          normal = normalize(mix(normal, normalize((viewMatrix * vec4(wn, 0.0)).xyz), 0.6 * cfade * ${gear ? '(1.0 - gM)' : '1.0'}));
        }${gear ? `
        if (gF > 0.01) { float hh = gP.x * (gk > 1.5 ? 0.012 : 0.006) * gF;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }` : ''}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        if (charQ > 0.5) {
          vec3 vv = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(normal, vv), 0.0, 1.0), 3.0);
          // light actually arriving at this pixel (sun/moon, sky, torches): the rim and skin scatter below scale with it,
          // so they fade with the light at night instead of glowing on their own
          vec3 litD = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          float litY = dot(litD, vec3(0.2126, 0.7152, 0.0722)), litK = clamp(litY / max(0.04, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * 1.4, 0.0, 1.0);
          // sky-tinted rim (sheen on fur, edge light on everything)
          reflectedLight.indirectSpecular += vec3(0.85, 0.92, 1.0) * fr * ${rim.toFixed(2)} * (0.4 + diffuseColor.rgb * ${sheen ? '1.6' : '0.6'}) * litK;
          // warm light scattering through skin (reddish-tan vertex colours), a share of the light the skin already receives
          float skinK = smoothstep(0.06, 0.2, vColor.r - vColor.b) * smoothstep(0.02, 0.12, vColor.g - vColor.b) * ${sss.toFixed(2)};
          reflectedLight.indirectDiffuse += litD * vec3(1.0, 0.42, 0.28) * skinK * (0.22 + 0.32 * fr);
          vec3 Lv = normalize((viewMatrix * vec4(cLDir, 0.0)).xyz); float nl = dot(normal, Lv);
          // skin: wrapped diffuse softens the light/shadow edge with a red-orange band, and thin edges glow when backlit
          float wrap = max(0.0, (nl + 0.45) / 1.45) - max(0.0, nl);
          float back = pow(max(0.0, dot(vv, Lv)), 4.0) * fr;
          reflectedLight.directDiffuse += diffuseColor.rgb * cLCol * cLK * skinK * (vec3(0.9, 0.35, 0.22) * wrap * 0.55 + vec3(1.0, 0.45, 0.3) * back * 0.6);
          ${sheen ? `// fur: strand highlight along the hair direction (Kajiya-Kay), shifted toward the root colour
          vec3 Tv = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); Tv = normalize(Tv - normal * dot(Tv, normal) + 1e-4);
          vec3 Hh = normalize(Lv + vv); float th = dot(Tv, Hh); float kk = pow(sqrt(max(0.0, 1.0 - th * th)), 24.0);
          reflectedLight.directSpecular += cLCol * cLK * diffuseColor.rgb * kk * 0.35 * max(0.0, nl + 0.3);` : `// cloth: soft velvet-like sheen at grazing angles on non-skin surfaces
          reflectedLight.directDiffuse += diffuseColor.rgb * cLCol * cLK * (1.0 - skinK) * fr * max(0.0, nl + 0.25) * 0.35;`}
        }`);
  };
  m.customProgramCacheKey = () => 'char-' + [rough, metal, bump, freq, rim, sss, sheen, gear].join(',');
  return m;
}
export const charMat = makeCharMat();
export const furMat = makeCharMat({ rough: 0.92, bump: 0.6, freq: 26, rim: 0.5, sss: 0, sheen: 1 });
export const scaleMat = makeCharMat({ rough: 0.42, metal: 0.12, bump: 0.45, freq: 14, rim: 0.3, sss: 0 });
export const chitinMat = makeCharMat({ rough: 0.3, metal: 0.05, bump: 0.25, freq: 20, rim: 0.45, sss: 0 });
export const metalMat = makeCharMat({ rough: 0.22, metal: 0.9, bump: 0.06, freq: 40, rim: 0.6, sss: 0 });
export const boneMat = makeCharMat({ rough: 0.62, metal: 0.0, bump: 0.4, freq: 34, rim: 0.3, sss: 0 });
export const plateCharMat = makeCharMat({ rough: 0.4, metal: 0.6, bump: 0.08, rim: 0.5, sss: 1, gear: 2 });
export const chainCharMat = makeCharMat({ rough: 0.5, metal: 0.5, bump: 0.08, rim: 0.45, sss: 1, gear: 1 });
export const hideMat = makeCharMat({ rough: 0.85, bump: 0.4, freq: 18, rim: 0.3, sss: 0.3, sheen: 1 });

// ---- small helpers ----------------------------------------------------------
const V2 = THREE.Vector2;
// Lathe a radius profile [[r, y], ...] into a closed limb. LatheGeometry only faces
// outward when its points run bottom to top, so the profile is ordered by y here whichever
// way it was written (a top-down profile used to come out inside-out: culled from the
// camera side, showing the inside of the far wall, e.g. the see-through torso back).
export function lathe(profile, seg = 16) {
  const pts = profile.map(([r, y]) => new V2(Math.max(r, 0.0001), y));
  if (pts[0].y > pts[pts.length - 1].y) pts.reverse();
  const g = new THREE.LatheGeometry(pts, seg);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}
const sq = (g, sx, sy, sz) => { g.scale(sx, sy, sz); return g; };
export function seeded(seed) {
  let s = (Math.abs(Math.floor(seed * 9301 + 49297)) % 233280) || 1;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
export function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

// Colour a geometry with a base hex, soft top light, and fine skin/cloth mottling.
const _a = new THREE.Color(), _b = new THREE.Color();
export function skinPaint(geo, hex, { mottle = 0.07, freq = 22, seed = 0, crease = null, ao = 0.18 } = {}) {
  const base = new THREE.Color(hex);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y);
  return paint(geo, (x, y, z, nx, ny, nz) => {
    let k = 1 - ao + ao * ((y - bb.min.y) / h) * 1.15;
    k *= 1 + mottle * snoise(x * freq, y * freq, z * freq, seed) + mottle * 0.5 * snoise(x * freq * 2.7, y * freq * 2.7, z * freq * 2.7, seed + 4);
    if (crease) k *= crease(x, y, z, nx, ny, nz);
    return _a.copy(base).multiplyScalar(k);
  });
}
// Two-colour split by a predicate (sleeves, trouser cuffs, boots).
export function splitPaint(geo, hexA, hexB, pred, opts = {}) {
  skinPaint(geo, 0xffffff, opts);
  const A = new THREE.Color(hexA), B = new THREE.Color(hexB), p = geo.attributes.position, c = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const s = pred(p.getX(i), p.getY(i), p.getZ(i)) ? A : B;
    c.setXYZ(i, c.getX(i) * s.r, c.getY(i) * s.g, c.getZ(i) * s.b);
  }
  return geo;
}

// ---- body part geometry (raw shapes; used by the player too) -----------------
// All limbs hang down from their joint at y = 0.
export const shapes = {
  torso(build = 1, chest = 1, seg = 22) {
    const b = build;
    const g = lathe([[0, 0.72], [0.12 * b, 0.715], [0.255 * b, 0.69], [0.27 * b, 0.6], [0.24 * b, 0.48], [0.215 * b, 0.4], [0.235 * b, 0.32],
      [0.255 * b * chest, 0.2], [0.29 * b * chest, 0.08], [0.24 * b, 0.02], [0.2, 0.0], [0, -0.01]].map(([r, y]) => [r, 0.78 + (0.72 - y)]), seg);
    // y now runs 0.78 (top of hips) to ~1.51 (neck base). Flatten front/back, push chest forward.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const chestK = Math.max(0, 1 - Math.abs(y - 1.3) / 0.22);
      const zz = z * 0.66 + (z > 0 ? chestK * 0.035 * chest : 0) - (z < 0 ? Math.max(0, 1 - Math.abs(y - 1.32) / 0.2) * -0.02 : 0);
      p.setXYZ(i, x * (1 + Math.max(0, (y - 1.32) / 0.2) * 0.12), y, zz);
    }
    g.computeVertexNormals();
    return g;
  },
  pec(b = 1, bare = false) { return sq(prim.sphere(0.1 * b, 14, 10), 1.15, 0.72, bare ? 0.42 : 0.18); },
  deltoid(b = 1) { return sq(prim.sphere(0.092 * b, 16, 12), 1.0, 1.05, 1.0); },
  trap(b = 1) { const g = prim.cone(0.2 * b, 0.16, 16); sq(g, 1, 1, 0.55); return g; },
  upperArm(b = 1, seg = 14) { return lathe([[0, 0.03], [0.07 * b, 0.02], [0.088 * b, -0.02], [0.098 * b, -0.1], [0.09 * b, -0.18], [0.072 * b, -0.27], [0.066 * b, -0.32], [0, -0.35]], seg); },
  forearm(b = 1, seg = 14) { return lathe([[0, 0.02], [0.066 * b, 0.0], [0.078 * b, -0.06], [0.074 * b, -0.11], [0.058 * b, -0.2], [0.046 * b, -0.26], [0.044 * b, -0.28], [0, -0.3]], seg); },
  thigh(b = 1, seg = 16) { return lathe([[0, 0.04], [0.11 * b, 0.02], [0.13 * b, -0.04], [0.128 * b, -0.14], [0.112 * b, -0.25], [0.09 * b, -0.35], [0.084 * b, -0.38], [0, -0.41]], seg); },
  shin(b = 1, seg = 16) { return lathe([[0, 0.02], [0.085 * b, 0.0], [0.098 * b, -0.07], [0.1 * b, -0.12], [0.08 * b, -0.22], [0.062 * b, -0.3], [0.058 * b, -0.33], [0, -0.35]], seg); },
  kneecap(b = 1) { return sq(prim.sphere(0.055 * b, 10, 8), 1, 1.1, 0.6); },
  // Shoe: rounded upper with a toe cap and a flat sole. Origin at the ankle.
  foot(seg = 14) {
    const up = sq(prim.sphere(0.1, seg, 10), 0.85, 0.62, 1.55); place(up, 0, -0.035, 0.06);
    const toe = sq(prim.sphere(0.075, seg, 8), 1.1, 0.6, 1.0); place(toe, 0, -0.05, 0.17);
    const sole = prim.box(0.15, 0.03, 0.34); place(sole, 0, -0.085, 0.07);
    return [up, toe, sole];
  },
  // Hand with palm, four two-segment fingers and an opposable thumb. Origin at the wrist.
  hand(side = 1, curl = 0.5, seg = 7) {
    const out = [];
    const palm = sq(prim.sphere(0.05, seg + 3, 8), 0.95, 1.25, 0.55); place(palm, 0, -0.055, 0.005);
    out.push(palm);
    const fx = [-0.03, -0.01, 0.01, 0.03], fl = [0.034, 0.04, 0.038, 0.03];
    for (let i = 0; i < 4; i++) {
      const L = fl[i], r = 0.0105 - (i === 3 ? 0.0015 : 0);
      const knuckleY = -0.115, x = fx[i] * side;
      out.push(place(prim.capsule(r, L, 2, seg), x, knuckleY - L / 2, 0.005, curl * 0.5, 0, 0));
      const c2 = curl * 1.1, y2 = knuckleY - Math.cos(curl * 0.5) * L, z2 = 0.005 + Math.sin(curl * 0.5) * L;
      out.push(place(prim.capsule(r * 0.9, L * 0.8, 2, seg), x, y2 - Math.cos(c2) * L * 0.42, z2 + Math.sin(c2) * L * 0.42, c2, 0, 0));
      out.push(place(sq(prim.sphere(r * 1.15, 6, 4), 1, 0.8, 1), x, knuckleY + 0.005, -0.012));
    }
    out.push(place(prim.capsule(0.013, 0.04, 2, seg), -0.045 * side, -0.07, 0.03, 0.5, 0, -0.55 * side));
    out.push(place(prim.capsule(0.011, 0.03, 2, seg), -0.062 * side, -0.1, 0.052, 0.9, 0, -0.25 * side));
    return out;
  },
  claw(side = 1) { // monster hand: three hooked digits with nails
    const out = [place(sq(prim.sphere(0.055, 10, 8), 1, 1.2, 0.6), 0, -0.055, 0)];
    for (let i = -1; i <= 1; i++) {
      out.push(place(prim.capsule(0.013, 0.05, 2, 6), i * 0.026 * side, -0.13, 0.01, 0.35, 0, 0));
      out.push(place(prim.cone(0.011, 0.045, 5), i * 0.026 * side, -0.18, 0.04, 2.4, 0, 0));
    }
    out.push(place(prim.capsule(0.013, 0.035, 2, 6), -0.05 * side, -0.08, 0.035, 0.6, 0, -0.5 * side));
    return out;
  },
  // Skull with jaw, cheekbones and chin. Origin at the head centre.
  skull(seg = 24, { jaw = 1, brow = 1 } = {}) {
    const g = prim.sphere(0.25, seg, Math.round(seg * 0.75));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const lo = Math.max(0, -y / 0.25);
      x *= 1 - 0.2 * lo * lo * (1.1 - 0.3 * jaw);
      if (z > 0) z *= 1 - 0.12 * lo + 0.08 * lo * lo * jaw;           // chin
      if (z > 0.12 && y > 0.02 && y < 0.1) z += 0.012 * brow;          // brow ridge
      if (z > 0.1 && Math.abs(y + 0.02) < 0.05 && Math.abs(x) > 0.08) z += 0.01; // cheekbones
      if (z > 0.15 && Math.abs(x) < 0.13 && y > -0.02 && y < 0.06) z -= 0.012 * (1 - Math.abs(x - Math.sign(x) * 0.085) / 0.05 > 0 ? 1 : 0); // eye sockets
      p.setXYZ(i, x * 0.95, y * 1.08, z * 0.98);
    }
    g.computeVertexNormals();
    return g;
  },
  nose(size = 1) {
    const g = new THREE.ConeGeometry(0.035 * size, 0.09 * size, 8, 1); g.deleteAttribute('uv');
    sq(g, 1, 1, 0.75); g.rotateX(-0.35); return g;
  },
  ear() { return sq(prim.sphere(0.055, 10, 8), 0.4, 1, 0.75); },
  pointyEar(side) { const g = prim.cone(0.06, 0.28, 6); sq(g, 1, 1, 0.35); g.rotateZ(-side * 1.15); return g; }
};

// ---- variation --------------------------------------------------------------
export const SKIN_TONES = [0xf2c9a6, 0xe8b48c, 0xe0ae84, 0xd09a6e, 0xc08458, 0xa86c44, 0x8a5634, 0x6e4228, 0x5a3420];
export const HAIR_TONES = [0x1a1410, 0x2a1c12, 0x3a2a1a, 0x4a3220, 0x6a4a2a, 0x8a6a3a, 0xb08a4a, 0xd0b070, 0x9a3a1a, 0x888888, 0xd8d8d8];
const HAIR_STYLES = ['short', 'cap', 'long', 'pony', 'spiky', 'bald', 'curly', 'bun'];
// Fill in any look fields that weren't set, deterministically from seed.
export function varyLook(look, seed) {
  const r = seeded(seed * 1000 + 7);
  const pick = a => a[Math.floor(r() * a.length) % a.length];
  const tweak = (hex, amt) => hex == null ? hex : new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.04 * amt, (r() - 0.5) * 0.15 * amt, (r() - 0.5) * 0.12 * amt).getHex();
  const L = { ...look };
  L.height = look.height ?? 0.93 + r() * 0.15;
  L.build = look.build ?? 0.88 + r() * 0.26;
  L.chest = look.chest ?? 0.92 + r() * 0.2;
  L.skin = look.skin ?? pick(SKIN_TONES);
  if (look.hair === undefined) L.hair = pick(HAIR_TONES);
  L.hairStyle = look.hairStyle ?? (L.hair === null ? 'bald' : pick(HAIR_STYLES));
  L.body = tweak(look.body, 1); L.legs = tweak(look.legs ?? 0x3a2a1a, 1); L.sleeve = look.sleeve ? tweak(look.sleeve, 1) : L.body;
  L.boots = look.boots ?? pick([0x2e2016, 0x3a2414, 0x1e1a16, 0x4a3420]);
  L.sleeveLen = look.sleeveLen ?? pick([0.35, 0.62, 0.62, 0.62, 0.15]);
  L.nose = look.nose ?? 0.85 + r() * 0.35;
  L.jaw = look.jaw ?? 0.8 + r() * 0.45;
  L.eyes = look.eyes ?? pick([0x3a2a1a, 0x2a4a6a, 0x3a5a2a, 0x5a3a1a, 0x1a1410]);
  if (look.beard === undefined && r() < 0.18 && L.hair) L.stubble = true;
  return L;
}

// ---- detailed humanoid rig --------------------------------------------------
// Returns a Group with userData { body, head, arms[2], legs[2] } where each arm has
// userData.elbow and each leg userData.knee, matching the player's rig layout.
export function buildHumanoidRig(look, { extras = [], held = [[], []], seg = LOD.seg, claws = false, ears = null, material = charMat } = {}) {
  const S = Math.round(16 * seg), b = look.build ?? 1, skin = look.skin ?? 0xe0ae84;
  const sk = (g, opt) => skinPaint(g, skin, { seed: 1, mottle: look.mottle ?? 0.06, ...opt });
  const cloth = (g, hex, opt) => skinPaint(g, hex, { mottle: 0.05, freq: 40, seed: 3, ...opt });
  const mesh = (geos, parent) => { const m = new THREE.Mesh(bakeList(geos), material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  // torso (shirt, belt, trousers), with muscle creases on bare skin
  const bare = look.bare;
  const tor = shapes.torso(b, look.chest ?? 1, Math.round(28 * seg));
  const legsHex = look.legs ?? 0x3a2a1a, beltHex = look.belt ?? 0x3a2414, bodyHex = look.body;
  const crease = (x, y, z) => {
    if (!bare || z < 0) return 1;
    let k = 1;
    if (y > 0.95 && y < 1.22 && Math.abs(x) < 0.12) k *= 1 - 0.12 * Math.max(0, Math.cos((y - 0.95) * 34)) * (1 - Math.abs(x) / 0.12) - (Math.abs(x) < 0.012 ? 0.1 : 0);
    if (y > 1.2 && y < 1.26) k *= 0.9; // under the pecs
    return k;
  };
  skinPaint(tor, 0xffffff, { mottle: 0.05, freq: 30, crease });
  { const p = tor.attributes.position, c = tor.attributes.color, B = new THREE.Color(bare ? skin : bodyHex), Lg = new THREE.Color(legsHex), Bt = new THREE.Color(beltHex);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), s = y < 0.86 ? Lg : y < 0.93 ? Bt : B; c.setXYZ(i, c.getX(i) * s.r, c.getY(i) * s.g, c.getZ(i) * s.b); } }
  const top = [tor];
  const chestHex = bare ? skin : bodyHex;
  for (const sx of [-1, 1]) {
    top.push(place(cloth(shapes.pec(b, bare), chestHex, { ao: 0 }), sx * 0.1 * b, 1.3, 0.1));
    top.push(place(cloth(shapes.trap(b), chestHex, { ao: 0.05 }), sx * 0.1 * b, 1.45, -0.02, 0, 0, sx * -0.25));
  }
  top.push(place(cloth(prim.box(0.09, 0.07, 0.04), look.buckle ?? 0xc9a227, { ao: 0 }), 0, 0.895, 0.2));
  if (!bare && !look.noCollar) top.push(place(cloth(new THREE.TorusGeometry(0.1, 0.022, 6, 16), dark(bodyHex, 0.8)), 0, 1.5, 0, Math.PI / 2 - 0.2));
  for (const x of extras) top.push(x);
  mesh(top, body);
  // head
  const headG = new THREE.Group(); headG.position.y = 1.5; body.add(headG);
  const hd = [place(sk(lathe([[0, 0.17], [0.075, 0.16], [0.085, 0.06], [0.095, 0.0], [0, -0.02]], S)), 0, 0, 0)];
  hd.push(place(sk(shapes.skull(Math.round(26 * seg), look), { mottle: 0.05, freq: 30 }), 0, 0.25, 0.01));
  hd.push(place(sk(shapes.nose(look.nose ?? 1), { ao: 0 }), 0, 0.225, 0.255));
  for (const sx of [-1, 1]) {
    hd.push(place(paint(prim.sphere(0.012, 6, 4), () => dark(skin, 0.5)), sx * 0.018, 0.19, 0.27)); // nostrils
    hd.push(place(paint(sq(prim.sphere(0.034, 10, 8), 1, 0.72, 0.6), () => 0xf4f0e8), sx * 0.085, 0.275, 0.205));
    hd.push(place(paint(prim.sphere(0.017, 8, 6), () => look.eyes ?? 0x3a2a1a), sx * 0.085, 0.275, 0.224));
    hd.push(place(paint(prim.sphere(0.008, 6, 4), () => 0x0a0806), sx * 0.085, 0.275, 0.236));
    hd.push(place(paint(sq((() => { const g = new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.deleteAttribute('uv'); return g; })(), 1.05, 0.5, 0.75), () => dark(skin, 0.92)), sx * 0.085, 0.284, 0.205, -0.25)); // eyelid
    hd.push(place(paint(prim.box(0.085, 0.018, 0.03), () => look.hair ? dark(look.hair, 1) : dark(skin, 0.7)), sx * 0.088, 0.325, 0.215, 0.1, 0, sx * -0.12)); // brow
    hd.push(place(sk(ears ? shapes.pointyEar(sx) : shapes.ear()), sx * (ears ? 0.3 : 0.24), ears ? 0.3 : 0.25, -0.01));
  }
  hd.push(place(paint(sq(prim.sphere(0.04, 10, 6), 1.3, 0.35, 0.6), () => new THREE.Color(skin).lerp(new THREE.Color(0xa04040), 0.3).multiplyScalar(0.85).getHex()), 0, 0.135, 0.225));
  hd.push(...hairGeos(look, S));
  if (look.beard) hd.push(place(skinPaint(sq(blob(0.16, 0.14, 0.11, { detail: 3, lump: 0.12, seed: 5 }), 1, 1, 1), look.beard, { mottle: 0.2, freq: 60 }), 0, 0.1, 0.14));
  for (const x of look.headExtras || []) hd.push(x);
  mesh(hd, headG);
  // arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.37 * b, 1.38, 0); body.add(pivot);
    const sl = look.sleeveLen ?? 0.62, sleeveHex = bare ? skin : (look.sleeve ?? bodyHex);
    const ua = splitPaint(shapes.upperArm(b, S), sleeveHex, skin, y => y > -sl, { mottle: 0.05, freq: 26 });
    mesh([ua, place(cloth(shapes.deltoid(b), sleeveHex), sx * 0.02, -0.02, 0)], pivot);
    const elbow = new THREE.Group(); elbow.position.y = -0.34; elbow.rotation.x = -0.2; pivot.add(elbow);
    const fa = splitPaint(shapes.forearm(b, S), sleeveHex, skin, y => y > -(sl - 0.34), { mottle: 0.05, freq: 26 });
    const handParts = (claws ? shapes.claw(sx) : shapes.hand(sx, look.curl ?? 0.6, Math.max(5, Math.round(7 * seg)))).map(g => place(sk(g, { ao: 0.1 }), 0, -0.29, 0));
    if (claws) handParts.forEach(g => { /* tint nails */ });
    mesh([fa, ...handParts], elbow);
    attachHeld(elbow, held[sx < 0 ? 0 : 1], material);
    pivot.userData.elbow = elbow;
    arms.push(pivot);
  }
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.13 * b, 0.78, 0); root.add(pivot);
    mesh([cloth(shapes.thigh(b, S), legsHex)], pivot);
    const knee = new THREE.Group(); knee.position.y = -0.4; pivot.add(knee);
    const bootTop = look.bootH ?? 0.18;
    const sh = splitPaint(shapes.shin(b, S), legsHex, look.boots ?? 0x2e2016, y => y > -0.35 + bootTop, { mottle: 0.05, freq: 30 });
    const feet = look.barefoot ? shapes.foot(S).slice(0, 2).map(g => sk(g)) : shapes.foot(S).map((g, i) => cloth(g, i === 2 ? dark(look.boots ?? 0x2e2016, 0.6) : (look.boots ?? 0x2e2016)));
    mesh([sh, place(cloth(shapes.kneecap(b), legsHex), 0, -0.01, 0.07), ...feet.map(g => place(g, 0, -0.3, 0))], knee);
    pivot.userData.knee = knee;
    legs.push(pivot);
  }
  root.scale.setScalar(look.height ?? 1);
  root.userData = { body, head: headG, arms, legs };
  return root;
}
// Apron shaped to the torso: a bib over the chest, waist band, and a skirt that
// drapes over the thighs, following the body's lathe profile with gentle folds.
export function apronGeo(hex, b = 1, chest = 1) {
  const prof = [[0.30, 0.45], [0.27, 0.62], [0.255, 0.78], [0.255, 0.81], [0.27, 0.9], [0.24, 1.02], [0.215, 1.1], [0.235, 1.18], [0.255 * chest, 1.3], [0.27 * chest, 1.38]];
  const rAt = y => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return prof[prof.length - 1][0]; };
  const g = new THREE.PlaneGeometry(1, 1, 16, 30); g.deleteAttribute('uv');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5, y = 0.47 + v * 0.9;
    const span = y > 1.0 ? 0.5 - (y - 1.0) * 0.35 : y > 0.9 ? 0.5 + (1.0 - y) * 5 : 1.0 + (0.9 - y) * 0.6;
    const a = u * span, r = (rAt(y) * b + 0.04 + (y < 0.85 ? 0.018 * Math.sin(u * 11) * (0.85 - y) * 3 : 0));
    const chestK = Math.max(0, 1 - Math.abs(y - 1.3) / 0.22);
    p.setXYZ(i, Math.sin(a) * r, y, Math.cos(a) * r * 0.66 + chestK * 0.04 * chest + (y < 0.78 ? (0.78 - y) * 0.12 : 0));
  }
  g.computeVertexNormals();
  skinPaint(g, hex, { mottle: 0.08, freq: 40, seed: 4, ao: 0.1 });
  const str = new THREE.TorusGeometry(0.13 * b, 0.012, 5, 16, Math.PI); str.deleteAttribute('uv');
  const band = new THREE.CylinderGeometry(0.262 * b, 0.262 * b, 0.05, 20, 1, true); band.deleteAttribute('uv'); band.scale(1, 1, 0.68);
  return [g, place(skinPaint(str, dark(hex, 0.8)), 0, 1.38, -0.01, -0.3), place(skinPaint(band, dark(hex, 0.75)), 0, 0.88, 0.005)];
}

// Held items (weapons, shields) ride on the forearm pivot so they swing with the arm.
// items: [{ geo, metal }], geometry already in elbow-local space (hand at y -0.3).
export function attachHeld(elbow, items, material = charMat) {
  if (!items || !items.length) return;
  const plain = items.filter(i => !i.metal).map(i => i.geo), shiny = items.filter(i => i.metal).map(i => i.geo);
  for (const [list, m] of [[plain, material], [shiny, metalMat]]) {
    if (!list.length) continue;
    const me = new THREE.Mesh(bakeList(list), m); me.castShadow = true; me.receiveShadow = true; me.userData.held = true; elbow.add(me);
  }
}
const dark = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
function bakeList(geos) {
  // merge non-indexed coloured geometries (local copy of models.bake to avoid a cycle on normals)
  let n = 0; const parts = geos.map(g => { const ng = g.index ? g.toNonIndexed() : g; if (!ng.attributes.normal) ng.computeVertexNormals(); n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colr = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.color) colr.set(g.attributes.color.array, o * 3); else colr.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  out.computeBoundingSphere(); return out;
}
export { bakeList };

function hairGeos(look, S) {
  const st = look.hairStyle, H = look.hair;
  const out = [];
  const hp = (g, x, y, z, rx = 0, ry = 0, rz = 0) => out.push(place(skinPaint(g, H, { mottle: 0.22, freq: 70, seed: 9, ao: 0.25 }), x, y, z, rx, ry, rz));
  if (look.stubble) out.push(place(skinPaint(sq((() => { const g = new THREE.SphereGeometry(0.236, S, 10, -Math.PI * 0.2, Math.PI * 1.4, Math.PI * 0.55, Math.PI * 0.3); g.deleteAttribute('uv'); return g; })(), 1, 1.08, 1.02), dark(look.skin ?? 0xe0ae84, 0.78), { mottle: 0.3, freq: 90 }), 0, 0.25, 0.012));
  if (!H || st === 'bald') return out;
  const capG = (r, cover = 0.56) => { const g = new THREE.SphereGeometry(r, S + 4, 12, 0, Math.PI * 2, 0, Math.PI * cover); g.deleteAttribute('uv'); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.06 * snoise(p.getX(i) * 30, p.getY(i) * 30, p.getZ(i) * 30, 2); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; };
  if (st === 'curly') { for (let i = 0; i < 22; i++) { const a = i * 2.4, e = 0.25 + (i % 5) * 0.2; hp(prim.sphere(0.06, 8, 6), Math.cos(a) * Math.cos(e) * 0.25, 0.27 + Math.sin(e) * 0.24, Math.sin(a) * Math.cos(e) * 0.24 - 0.02); } return out; }
  hp(capG(0.27, st === 'cap' ? 0.5 : 0.56), 0, 0.27, -0.015, -0.3);
  if (st === 'short' || st === 'cap') hp(sq(prim.capsule(0.05, 0.24, 3, 10), 1, 1, 0.7), 0, 0.43, 0.17, 0, 0, Math.PI / 2 + 0.15);
  if (st === 'spiky') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; hp(prim.cone(0.05, 0.16, 6), Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15 - 0.03, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
  if (st === 'long') { hp(sq(lathe([[0.25, 0], [0.27, -0.15], [0.24, -0.38], [0.2, -0.42]], S), 1, 1, 0.75), 0, 0.3, -0.07); }
  if (st === 'pony') { hp(prim.sphere(0.05, 8, 6), 0, 0.32, -0.27); hp(lathe([[0.04, 0], [0.06, -0.1], [0.04, -0.3], [0.0, -0.36]], 10), 0, 0.3, -0.3, 0.25); }
  if (st === 'bun') hp(prim.sphere(0.09, 12, 10), 0, 0.45, -0.18);
  return out;
}

// ---- posing ------------------------------------------------------------------
// t: walk phase, move 0..1, atk 0..1 (1 = swing just started), work: skilling bob.
export function poseHumanoid(rig, t, move, atk = 0, work = 0) {
  const u = rig.userData; if (!u || !u.arms) return;
  const sw = Math.sin(t) * 0.6 * move;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.legs[0].userData.knee.rotation.x = Math.max(0, -Math.cos(t)) * 0.8 * move;
  u.legs[1].userData.knee.rotation.x = Math.max(0, Math.cos(t)) * 0.8 * move;
  u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
  u.arms[0].userData.elbow.rotation.x = -0.25 - 0.35 * move * (0.5 + 0.5 * Math.sin(t));
  u.arms[1].userData.elbow.rotation.x = -0.25 - 0.35 * move * (0.5 - 0.5 * Math.sin(t));
  u.body.rotation.y = Math.sin(t) * 0.07 * move;
  if (atk > 0) {
    const k = 1 - atk;
    u.arms[1].rotation.x = k < 0.35 ? -(k / 0.35) * 2.3 : -2.3 + ((k - 0.35) / 0.65) * 2.6;
    u.arms[1].userData.elbow.rotation.x = k < 0.35 ? -1.0 * (k / 0.35) : -1.0 + (k - 0.35) * 1.2;
    u.body.rotation.y = k < 0.35 ? -0.25 * k / 0.35 : -0.25 + (k - 0.35) * 0.6;
  }
  if (work > 0) { const s = Math.sin(work * 6); u.arms[1].rotation.x = -1.0 + s * 0.5; u.arms[0].rotation.x = -0.8 + s * 0.3; u.arms[1].userData.elbow.rotation.x = -0.9; u.arms[0].userData.elbow.rotation.x = -0.9; }
  u.head.rotation.y = Math.sin(t * 0.13 + rig.id) * 0.15 * (1 - move);
}

// ---- distance LOD ------------------------------------------------------------
// ent.lod = { lo: Object3D, buildHi: () => Object3D, hi: null, parent }
export const LOD = { near: 26, far: 34, seg: 1.3 };
export function setLodRange(quality) { CHAR.q.value = quality === 'low' ? 0 : 1;
  if (quality === 'low') { LOD.near = 10; LOD.far = 14; LOD.seg = 0.8; } else { LOD.near = 30; LOD.far = 40; LOD.seg = 1.3; } }
export function updateLod(ent, cx, cz) {
  const L = ent.lod; if (!L) return false;
  const p = ent.mesh.position, d = Math.hypot(p.x - cx, p.z - cz);
  if (!L.hi && d < LOD.near) {
    L.hi = L.buildHi(); L.parent.add(L.hi); L.lo.visible = false; return true;
  } else if (L.hi && d > LOD.far) {
    L.parent.remove(L.hi); L.hi.traverse(o => { if (o.geometry) o.geometry.dispose(); }); L.hi = null; L.lo.visible = true; return true;
  }
  return false;
}

// Soft contact shadow / ambient occlusion blob under a character (one shared texture).
let blobTex = null, blobMat = null;
export function contactShadow(r = 0.5, k = 1) {
  if (!blobTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(cv);
    blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2 * k), blobMat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1;
  m.userData.contact = true;
  return m;
}

const GEAR_GLSL = `
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }
      // returns height in .x, albedo multiplier in .y, metal mask in .z, roughness in .w
      vec4 gearPat(vec3 p) {
        vec2 uv = vec2(atan(p.x, p.z) * 0.16, p.y);   // wrap around the limb
        if (gk < 0.5) { vec2 w = uv * vec2(260.0, 260.0); float wx = sin(w.x) * 0.5 + 0.5, wy = sin(w.y) * 0.5 + 0.5;
          float h = mix(wx, wy, step(0.5, fract((floor(w.x / 3.1416) + floor(w.y / 3.1416)) * 0.5))) * 0.6 + gNoise(uv * 40.0) * 0.4;
          return vec4(h * 0.3, 0.95 + 0.08 * h, 0.0, 0.92); }
        if (gk < 1.5) { vec2 c = uv * vec2(42.0, 48.0); c.x += 0.5 * mod(floor(c.y), 2.0); vec2 f = fract(c) - 0.5;
          float r = length(f * vec2(1.0, 1.25)); float aa = clamp(length(fwidth(c)) * 1.5, 0.0, 1.0); float ring = mix(1.0 - smoothstep(0.06, 0.14, abs(r - 0.3)), 0.55, aa);   // fade to average when rings get sub-pixel
          return vec4(ring, mix(0.25, 1.05, ring), ring, mix(0.8, 0.35, ring)); }
        if (gk < 2.5) { float band = fract(p.y * 6.0); float edge = smoothstep(0.0, 0.08, band) * (1.0 - smoothstep(0.9, 1.0, band));
          vec2 rv = vec2(fract(uv.x * 18.0) - 0.5, band - 0.5 / 1.0 + 0.42); float rivet = 1.0 - smoothstep(0.05, 0.11, length(rv * vec2(1.0, 2.5)));
          float brush = gNoise(vec2(uv.x * 600.0, p.y * 6.0));
          return vec4(edge * 0.6 + rivet * 0.6 + brush * 0.03, (0.8 + 0.2 * edge) * (0.96 + 0.08 * brush) + rivet * 0.15, 1.0, 0.28 + 0.18 * brush + 0.3 * (1.0 - edge)); }
        float gr = gNoise(uv * 90.0) * 0.6 + gNoise(uv * 22.0) * 0.4;
        float st = step(0.5, fract(uv.x * 40.0)) * (1.0 - smoothstep(0.004, 0.009, abs(fract(p.y * 4.0) - 0.5)));
        return vec4(gr * 0.5 - st * 0.5, 0.8 + 0.3 * gr - st * 0.25, 0.0, 0.6 + 0.25 * gr); }`;

// Armour and clothing surface detail for the player's equipment materials. Pattern is chosen per material by
// mat.userData.gk.value: 0 woven cloth, 1 chainmail rings, 2 plate (bands, rivets, brushed streaks), 3 leather (grain and stitches).
// Object-space coordinates keep the pattern stuck to the limb as it animates; bump uses screen derivatives. High only (CHAR.q).
export function gearDetail(m) {
  const gk = { value: 0 }; m.userData.gk = gk;
  m.onBeforeCompile = sh => {
    sh.uniforms.gk = gk; sh.uniforms.charQ = CHAR.q;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP; varying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGP = transformed; vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGP; varying vec3 vGW; uniform float gk, charQ;
      ${GEAR_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float gF = charQ * (1.0 - smoothstep(8.0, 22.0, length(cameraPosition - vGW)));
      vec4 gP = gearPat(vGP);
      if (gF > 0.01) { diffuseColor.rgb *= mix(1.0, gP.y, gF); roughnessFactor = mix(roughnessFactor, gP.w, gF); }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      if (gk > 0.5 && gk < 2.5) metalnessFactor = mix(metalnessFactor, mix(0.15, 0.85, gP.z), gF);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (gF > 0.01) { float hh = gP.x * (gk > 1.5 && gk < 2.5 ? 0.012 : 0.006) * gF;
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hh), dhy = dFdy(hh);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - grad); }`);
  };
  m.customProgramCacheKey = () => 'gear';
  return m;
}
