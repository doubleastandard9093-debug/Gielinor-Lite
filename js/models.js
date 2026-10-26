// Procedural model kit: smooth organic shapes baked into single vertex-coloured
// meshes, so each tree, rock or building is one draw call. All original art.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TIME, SWAY, attachNoiseBump, getNoiseTexture } from './gfx.js';

// Smooth pseudo-noise (cheap sum of sines), roughly -1..1.
export function snoise(x, y, z, s = 0) {
  return (Math.sin(x * 1.7 + s + Math.sin(z * 1.3 + s * 0.7)) * Math.cos(y * 1.9 - s * 0.3 + Math.cos(x * 0.9))
    + Math.sin(z * 2.3 + y * 1.1 + s * 1.3) * 0.5 + Math.sin(x * 3.1 - z * 2.7 + s) * 0.25) / 1.75;
}

const _c = new THREE.Color();
// Give a geometry a vertex colour attribute. fn(x,y,z,nx,ny,nz) -> THREE.Color or hex.
export function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const r = fn(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
    if (typeof r === 'number') _c.setHex(r); else _c.copy(r);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
// Solid colour with soft top-light / bottom-dark shading baked in.
export function shade(geo, hex, amt = 0.25) {
  const base = new THREE.Color(hex);
  const bb = (geo.computeBoundingBox(), geo.boundingBox);
  const h = Math.max(1e-3, bb.max.y - bb.min.y);
  const c = new THREE.Color();
  const prev = geo.attributes.color;
  let i = 0;
  return paint(geo, (x, y) => {
    c.copy(base).multiplyScalar(1 - amt + amt * ((y - bb.min.y) / h) * 1.2);
    if (prev) c.setRGB(c.r * prev.getX(i), c.g * prev.getY(i), c.b * prev.getZ(i));
    i++;
    return c;
  });
}

// Lumpy smooth blob (leaves, rocks, bushes). Returns an indexed, smooth-normal geometry.
const blobCache = new Map();
function icoBase(detail) {
  if (!blobCache.has(detail)) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    blobCache.set(detail, mergeVertices(g));
  }
  return blobCache.get(detail);
}
export function blob(rx, ry, rz, { detail = 2, lump = 0.18, seed = 0, flat = 0 } = {}) {
  const g = icoBase(detail).clone();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + lump * snoise(x * 1.6, y * 1.6, z * 1.6, seed) + lump * 0.5 * snoise(x * 3.7, y * 3.7, z * 3.7, seed + 3);
    if (flat && y < 0) y *= 1 - flat;
    p.setXYZ(i, x * rx * k, y * ry * k, z * rz * k);
  }
  g.computeVertexNormals();
  return g;
}

// Put a geometry at a position / rotation / scale (returns the same geometry).
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export function place(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  geo.applyMatrix4(_m);
  return geo;
}

// Merge many coloured geometries into one (all need position, normal, color).
export function bake(list) {
  let n = 0;
  const parts = list.map(g => { const ng = g.index ? g.toNonIndexed() : g; ng.userData = g.userData; n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const hasMat = parts.some(g => g.attributes.aMat), mt = hasMat ? new Float32Array(n) : null;
  const hasUv = parts.some(g => g.userData.cardUv), uvs = hasUv ? new Float32Array(n * 2).fill(0.1) : null;
  let o = 0;
  for (const g of parts) {
    if (mt && g.attributes.aMat) mt.set(g.attributes.aMat.array, o);
    if (uvs && g.userData.cardUv && g.attributes.uv) uvs.set(g.attributes.uv.array, o * 2);
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (mt) out.setAttribute('aMat', new THREE.BufferAttribute(mt, 1));
  if (uvs) out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

// Surface tag for the building material (1-3 wood with grain along x/y/z, 4 plaster, 5 stone, 6 roof thatch/shingle).
export function setMat(geo, id) { geo.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(id), 1)); return geo; }
export function woodAxis(geo) { geo.computeBoundingBox(); const s = new THREE.Vector3(); geo.boundingBox.getSize(s); return s.x >= s.y && s.x >= s.z ? 1 : s.y >= s.z ? 2 : 3; }
// Building material: world-space procedural detail keyed on aMat. Wood gets grain and knots along its long axis,
// plaster gets mottling, hairline cracks and rain-darkened bases, stone gets coursed blocks with mortar,
// roofs get straw/shingle strands down the slope with moss in the low rows. All with bump and roughness.
export const buildMat = (() => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02 });
  m.onBeforeCompile = sh => {
    sh.uniforms.tBN = { value: getNoiseTexture() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMat; varying float vMat; varying vec3 vBW; varying vec3 vBN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMat = aMat; vBW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMat; varying vec3 vBW; varying vec3 vBN; uniform sampler2D tBN; float bH = 0.0; float bR = -1.0;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float fade = 1.0 - smoothstep(35.0, 65.0, length(cameraPosition - vBW));
          int id = int(vMat + 0.5); vec3 P = vBW; vec3 an = abs(vBN);
          if (id >= 1 && id <= 3 && fade > 0.0) {
            // grain runs along the beam: project onto the two cross axes, stretch along the long one
            vec3 Q = id == 1 ? P.yzx : id == 2 ? P.xzy : P.xyz;   // Q.z = along the grain
            float w = texture2D(tBN, vec2(Q.x * 1.2 + Q.y * 1.2, Q.z * 0.08)).r;
            float rings = sin((Q.x + Q.y) * 38.0 + w * 9.0) * 0.5 + 0.5;
            float knot = smoothstep(0.86, 0.95, texture2D(tBN, Q.xz * 0.9 + Q.yz * 0.7).g);
            diffuseColor.rgb *= mix(1.0, 0.72 + 0.4 * rings - 0.35 * knot, 0.8 * fade);
            bH = (rings * 0.5 - knot) * fade; bR = 0.78 + 0.12 * rings;
          } else if (id == 4 && fade > 0.0) {
            vec2 uv = an.x > an.z ? P.zy : P.xy;
            float mot = texture2D(tBN, uv * 0.35).g * 0.6 + texture2D(tBN, uv * 1.7).r * 0.4;
            float grime = 1.0 - smoothstep(0.5, 1.4, P.y - (texture2D(tBN, uv * 0.6).r - 0.5) * 0.4);
            diffuseColor.rgb *= mix(1.0, (0.86 + 0.24 * mot) * (1.0 - grime * 0.22), fade);
            bH = (mot - 0.5) * 0.6 * fade; bR = 0.92;
          } else if (id == 5 && fade > 0.0) {
            vec2 uv = an.y > 0.7 ? P.xz : (an.x > an.z ? P.zy : P.xy);
            vec2 b = uv * vec2(2.2, 4.4); b.x += floor(b.y) * 0.5; vec2 f = fract(b), ci = floor(b);
            float mortar = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
            float bv = texture2D(tBN, ci * 0.173).g, chip = texture2D(tBN, uv * 2.5).r;
            diffuseColor.rgb *= mix(1.0, mix(0.55, 0.82 + 0.35 * bv, mortar) * (0.9 + 0.2 * chip), fade);
            bH = (mortar * (0.6 + 0.4 * chip) - 0.5) * fade; bR = 0.85;
          } else if (id == 6 && fade > 0.0) {
            vec2 down = length(vBN.xz) > 0.05 ? normalize(vBN.xz) : vec2(0.0, 1.0); vec2 across = vec2(-down.y, down.x);
            float a = dot(P.xz, across), dn = dot(P.xz, down) + P.y * 0.0;
            float strands = texture2D(tBN, vec2(a * 3.5, dn * 0.25 + P.y * 0.3)).r * 0.6 + texture2D(tBN, vec2(a * 11.0, dn * 0.6)).g * 0.4;
            float moss = smoothstep(0.55, 0.8, texture2D(tBN, P.xz * 0.3 + P.y * 0.2).b) * (1.0 - smoothstep(0.0, 0.25, vBN.y - 0.55));
            diffuseColor.rgb *= mix(1.0, 0.7 + 0.5 * strands, fade);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.28, 0.12), moss * 0.35 * fade);
            bH = (strands - 0.5) * 1.2 * fade; bR = 0.9;
          }
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (bR > 0.0) roughnessFactor = bR;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (abs(bH) > 0.0001) { vec3 sp = -vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp); float h = bH * 0.012, dhx = dFdx(h), dhy = dFdy(h);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); vec3 bn = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2); if (dot(bn, bn) > 1e-12) normal = normalize(bn); }`);
  };
  m.customProgramCacheKey = () => 'buildmat-v1';
  return m;
})();

// Common primitive helpers (all return fresh geometries).
// Mirror a geometry across x and keep its faces pointing outward (a negative scale alone
// flips the triangle winding, so the mirrored copy would be culled from the outside).
export function mirrorX(g) {
  g.scale(-1, 1, 1);
  if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
  else for (const k in g.attributes) { const at = g.attributes[k], n = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let j = 0; j < n; j++) { const t = a[(i + 1) * n + j]; a[(i + 1) * n + j] = a[(i + 2) * n + j]; a[(i + 2) * n + j] = t; } at.needsUpdate = true; }
  return g;
}
export const prim = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg, 1),
  cone: (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg, 1),
  sphere: (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs),
  capsule: (r, len, cs = 4, rs = 10) => new THREE.CapsuleGeometry(r, len, cs, rs),
  // Bow limb: a curved arc in the x/y plane.
  torusArc(r) { const g = new THREE.TorusGeometry(r, 0.03, 5, 14, Math.PI * 0.8); g.rotateZ(Math.PI / 2 - Math.PI * 0.4); g.deleteAttribute('uv'); return g; },
  // Bat wing membrane pointing out to one side.
  wing(side) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.9, 0.5); s.lineTo(1.0, -0.1); s.lineTo(0.6, -0.4); s.lineTo(0.3, -0.25); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }); g.deleteAttribute('uv');
    if (side < 0) mirrorX(g);
    g.rotateY(side * 0.5);
    return g;
  },
  // Triangular prism along z: base width w, height h, depth d (gable ends, roofs).
  prism(w, h, d) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2); g.deleteAttribute('uv');
    return g;
  }
};
export function col(geo, hex, amt = 0.22) { return shade(geo, hex, amt); }

// ---------------------------------------------------------------------------
// Materials: one shared vertex-colour material, and one with gentle wind sway.
// ---------------------------------------------------------------------------
// Shared vertex-colour Standard materials (roughness/metalness tuned for outdoor props).
export const vcMat = attachNoiseBump(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 }), 0.2);
// Up to 4 world-space pushers (x, z, radius, strength): the player and nearby mobs flatten grass around them.
export const PUSH = { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] };
export function makeFoliageMat(opts = {}, amount = 1, ring = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0, ...opts });
  m.onBeforeCompile = sh => swayShader(sh, amount, ring);
  m.customProgramCacheKey = () => 'foliage-std-lod-' + amount + (opts.side || 0) + (ring ? 'r' : '');
  return m;
}
function swayShader(sh, amount, ring = false) {
  sh.uniforms.time = TIME; sh.uniforms.sway = SWAY; if (amount > 1) sh.uniforms.pushers = PUSH;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float time, sway;' + (amount > 1 ? '\nuniform vec4 pushers[4];' : ''))
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 wo = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          wo = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif
        // shader LOD: sway fades out between 40 and 60 units from the camera
        float lod = 1.0 - smoothstep(40.0, 60.0, length(cameraPosition.xz - wo.xz));
        float h = max(transformed.y - 0.9, 0.0);
        float ph = wo.x * 0.37 + wo.z * 0.23;
        transformed.x += sin(time * 1.25 + ph) * 0.03 * h * sway * AMT * lod;
        transformed.z += cos(time * 1.05 + ph * 1.3) * 0.025 * h * sway * AMT * lod;
        PUSHCODE
      }`.replace('PUSHCODE', amount > 1 ? `
        // bend away from pushers, tips most, with a little squash so trampled grass lies lower
        for (int i = 0; i < 4; i++) { vec4 P = pushers[i]; if (P.w <= 0.0) continue;
          vec2 dv = wo.xz - P.xy; float dd = length(dv); float f = (1.0 - smoothstep(P.z * 0.3, P.z, dd)) * P.w;
          vec2 dir = dd > 1e-3 ? dv / dd : vec2(1.0, 0.0);
          transformed.xz += dir * f * transformed.y * 0.9; transformed.y *= 1.0 - 0.45 * f; }` + (ring ? `
        { float rd = max(abs(wo.x - pushers[0].x), abs(wo.z - pushers[0].y)); transformed *= 1.0 - smoothstep(10.0, 16.0, rd); }` : '') : '').replace(/AMT/g, amount.toFixed(2)).replace('transformed.y - 0.9', amount > 1 ? 'transformed.y' : 'transformed.y - 0.9'));
}
export const foliageMat = makeFoliageMat();
// Leaf atlas painted in code: the left half is solid white (trunks and branches sample it, so they are unchanged);
// the right half is a cluster of leaves with stems on transparent ground, in greys so vertex colours tint them.
function leafAtlas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.strokeStyle = 'rgba(120,110,90,1)'; x.lineWidth = 2; x.beginPath(); x.moveTo(192, 124); x.lineTo(192, 30); x.stroke();
  for (let i = 0; i < 34; i++) {
    const t = R(), px = 192 + (R() - 0.5) * 100 * (0.4 + t), py = 118 - t * 100 - R() * 8, a = Math.atan2(py - 124, px - 192) + Math.PI / 2 + (R() - 0.5) * 0.6;
    const L = 12 + R() * 10, W = L * (0.38 + R() * 0.15), g = Math.round(170 + R() * 85);
    x.save(); x.translate(px, py); x.rotate(a);
    x.fillStyle = `rgb(${g},${g},${g})`; x.beginPath(); x.moveTo(0, L * 0.5); x.quadraticCurveTo(W, 0, 0, -L * 0.5); x.quadraticCurveTo(-W, 0, 0, L * 0.5); x.fill();
    x.strokeStyle = `rgba(${g - 60},${g - 60},${g - 60},0.8)`; x.lineWidth = 1; x.beginPath(); x.moveTo(0, L * 0.5); x.lineTo(0, -L * 0.45); x.stroke();
    x.restore();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
export const treeMat = (typeof document !== 'undefined') ? makeFoliageMat({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide }) : foliageMat;
// shadow-pass twin of treeMat: same alpha-cut leaf atlas and the same wind sway, so leaf shadows move with the leaves

// Mesh <-> impostor crossfade (Tier L fix): screen-space dither across an 8-10 m band at the cull radius.
// FADE.r = (start, end) distance from the player; sign 1 fades OUT with distance (full trees), -1 fades IN (impostors).
export const FADE = { c: { value: new THREE.Vector2() }, r: { value: new THREE.Vector2(1e6, 1e6 + 1) } };
export function addFadeDither(m, sign) {
  const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, rd) => { if (prev) prev.call(m, sh, rd);
    sh.uniforms.fadeC = FADE.c; sh.uniforms.fadeR = FADE.r;
    sh.vertexShader = 'varying vec2 vFadeXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 fw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fw = instanceMatrix * fw;
      #endif
      vFadeXZ = (modelMatrix * fw).xz; }`);
    sh.fragmentShader = 'uniform vec2 fadeC, fadeR; varying vec2 vFadeXZ;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float k = smoothstep(fadeR.x, fadeR.y, distance(vFadeXZ, fadeC)); float th = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (${sign > 0 ? 'th < k' : 'th >= k'}) discard; }`); };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|fade' + sign;
  m.needsUpdate = true; return m;
}
addFadeDither(treeMat, 1);
export const treeDepthMat = (() => { const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: treeMat.map || null, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => swayShader(sh, 1); m.customProgramCacheKey = () => 'tree-depth-sway'; return m; })();
// One leaf card: a quad whose UVs cover the leaf half of the atlas
function leafCard(size) { const g = new THREE.PlaneGeometry(size, size); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 + uv.getX(i) * 0.5); g.userData.cardUv = true; return g; }

export function bakedMesh(geos, material = vcMat, shadow = true) {
  const m = new THREE.Mesh(bake(geos), material);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// Trees: tapered trunk with roots and branches, layered leafy canopy.
// ---------------------------------------------------------------------------
function leafColorFn(base, rng, light = 0.35) {
  const b = new THREE.Color(base), hi = b.clone().offsetHSL(0.02, 0.05, 0.12), lo = b.clone().offsetHSL(-0.01, 0, -0.12);
  const c = new THREE.Color();
  return (x, y, z, nx, ny) => {
    const t = Math.max(0, Math.min(1, 0.5 + ny * 0.5));
    c.copy(lo).lerp(hi, t * (0.6 + light));
    c.multiplyScalar(0.9 + 0.2 * snoise(x * 3, y * 3, z * 3, 1));
    return c;
  };
}
function trunkGeo(h, r, bark, rng) {
  // bark: more segments so vertical ridges and furrows are real geometry (lit by the sun), plus a slight twist
  const g = new THREE.CylinderGeometry(r * 0.55, r, h, 16, 8);
  const p = g.attributes.position, ridge = (a, y) => Math.abs(Math.sin(a * 6.5 + y * 0.6 + 0.8 * snoise(a, y * 1.5, 0, 3)));
  for (let i = 0; i < p.count; i++) { const x0 = p.getX(i), z0 = p.getZ(i), y = p.getY(i), a = Math.atan2(z0, x0);
    const k = 1 + 0.08 * snoise(x0 * 4, y * 2, z0 * 4, 2) + 0.07 * ridge(a, y) - 0.035; p.setX(i, x0 * k); p.setZ(i, z0 * k); }
  g.computeVertexNormals();
  place(g, 0, h / 2, 0);
  const bc = new THREE.Color(bark), c = new THREE.Color(), moss = new THREE.Color(0x4a6a2a);
  paint(g, (x, y, z, nx, ny, nz) => { const a = Math.atan2(z, x), rr = ridge(a, y - h / 2);
    c.copy(bc).multiplyScalar(0.55 + 0.5 * rr + 0.12 * snoise(x * 20, y * 8, z * 20, 4));   // dark furrows, lighter ridges
    if (y < h * 0.35 && nz + nx * 0.3 > 0.35) c.lerp(moss, 0.35 * (1 - y / (h * 0.35)));        // moss on the shady lower side
    return c; });
  const parts = [g];
  // root flare
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + rng() * 0.6;
    const root = col(prim.cone(r * 0.35, r * 1.6, 6), bark, 0.3);
    place(root, Math.cos(a) * r * 0.75, r * 0.35, Math.sin(a) * r * 0.75, Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
    parts.push(root);
  }
  return parts;
}
export const TREE_LOOK = {
  Tree:   { bark: 0x5e4026, leaf: 0x3f7f2a, h: 1.9, r: 0.26, canopy: 'round', size: 1.15 },
  Oak:    { bark: 0x54391f, leaf: 0x4f8a26, h: 1.7, r: 0.36, canopy: 'wide', size: 1.5 },
  Willow: { bark: 0x6a5634, leaf: 0x86ad45, h: 2.1, r: 0.3, canopy: 'willow', size: 1.35 },
  Maple:  { bark: 0x5a3a20, leaf: 0xd0622a, h: 1.9, r: 0.28, canopy: 'round', size: 1.4 },
  Yew:    { bark: 0x3e2a18, leaf: 0x245a32, h: 2.2, r: 0.38, canopy: 'tiered', size: 1.45 },
  Magic:  { bark: 0x8a8aa0, leaf: 0x5f92c8, h: 2.2, r: 0.26, canopy: 'tiered', size: 1.2 }
};
export function treeGeometry(kind, rng) {
  const L = TREE_LOOK[kind] || TREE_LOOK.Tree;
  const parts = trunkGeo(L.h + 0.6, L.r, L.bark, rng);
  const leafFn = leafColorFn(L.leaf, rng);
  const top = L.h + 0.4;
  const S = L.size;
  const clumps = [];
  const addLeaf = (rx, ry, rz, x, y, z, detail = 2) => { clumps.push([rx, ry, rz, x, y, z]); parts.push(paint(place(blob(rx, ry, rz, { detail, lump: 0.22, seed: rng() * 10, flat: 0.35 }), x, y, z), leafFn)); };
  // a couple of branches reaching into the canopy
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const br = col(prim.cyl(0.04, L.r * 0.4, S * 0.9, 6), L.bark, 0.2);
    place(br, Math.cos(a) * S * 0.25, top - 0.2, Math.sin(a) * S * 0.25, Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    parts.push(br);
  }
  if (L.canopy === 'tiered') {
    for (let i = 0; i < 4; i++) {
      const s = S * (1.05 - i * 0.2);
      addLeaf(s, 0.42 * S, s, (rng() - 0.5) * 0.15, top - 0.3 + i * 0.62 * S, (rng() - 0.5) * 0.15);
    }
    addLeaf(0.3 * S, 0.45 * S, 0.3 * S, 0, top + 2.35 * S, 0, 1);
  } else {
    const wide = L.canopy === 'wide' ? 1.25 : 1;
    addLeaf(S * 0.95 * wide, S * 0.75, S * 0.95 * wide, 0, top + S * 0.45, 0);
    const n = L.canopy === 'wide' ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.5;
      const d = S * (0.6 + rng() * 0.25) * wide;
      const s = S * (0.48 + rng() * 0.18);
      addLeaf(s, s * 0.8, s, Math.cos(a) * d, top + S * (0.15 + rng() * 0.45), Math.sin(a) * d, 1);
    }
    addLeaf(S * 0.55, S * 0.5, S * 0.55, (rng() - 0.5) * 0.3, top + S * 1.05, (rng() - 0.5) * 0.3, 1);
    if (L.canopy === 'willow') {
      // hanging fronds around the rim
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + rng() * 0.2;
        const d = S * (0.95 + rng() * 0.2);
        const len = 1.1 + rng() * 0.7;
        const f = paint(place(prim.cone(0.2, len, 5), Math.cos(a) * d, top + S * 0.35 - len / 2, Math.sin(a) * d, Math.PI, 0, 0), leafFn);
        parts.push(f);
      }
    }
  }
  // layered foliage: small leaf sprays standing off each clump's surface break up the blob outline and add depth.
  // Upper sprays catch more light, inner/lower ones are darker, so the crown reads as layers of leaves.
  const lb = new THREE.Color(L.leaf), lc = new THREE.Color();
  for (const [rx, ry, rz, x, y, z] of clumps) {
    const n = Math.round(10 + 10 * Math.min(1.6, rx));
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1, a = rng() * Math.PI * 2, q = Math.sqrt(1 - u * u), dx = q * Math.cos(a), dy = u * 0.85 + 0.15, dz = q * Math.sin(a);
      const off = 0.88 + rng() * 0.2, sz = 0.16 + rng() * 0.14;
      const spray = leafCard(sz * 3.8);
      const shade = 0.72 + 0.45 * (0.5 + 0.5 * dy) + (rng() - 0.5) * 0.18;
      lc.copy(lb).offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.1, 0).multiplyScalar(shade);
      const placed = col(place(spray, x + dx * rx * off, y + dy * ry * off, z + dz * rz * off, Math.acos(Math.max(-1, Math.min(1, dy))) + (rng() - 0.5) * 0.8, a + rng(), (rng() - 0.5) * 0.8), lc.clone().multiplyScalar(1.15).getHex(), 0.1);
      // foliage normals: point away from the clump centre so cards shade like the crown's volume, not like flat paper
      { const nm = placed.attributes.normal; for (let k = 0; k < nm.count; k++) nm.setXYZ(k, dx, dy, dz); }
      parts.push(placed);
    }
  }
  return bake(parts);
}

// Short stump left after a tree is chopped (one shared geo per bark colour).
export function stumpGeometry(kind, rng) {
  const L = TREE_LOOK[kind] || TREE_LOOK.Tree;
  const parts = [];
  const h = 0.55, r = L.r * 0.95;
  const g = prim.cyl(r * 0.7, r, h, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + 0.1 * snoise(p.getX(i) * 4, p.getY(i) * 2, p.getZ(i) * 4, 8);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  place(g, 0, h / 2, 0);
  const bc = new THREE.Color(L.bark), c = new THREE.Color();
  paint(g, (x, y, z) => c.copy(bc).multiplyScalar(0.7 + 0.35 * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 5 + y))));
  parts.push(g);
  // cut top disc
  const top = col(prim.cyl(r * 0.72, r * 0.72, 0.06, 10), new THREE.Color(L.bark).offsetHSL(0.02, -0.1, 0.15).getHex(), 0.15);
  place(top, 0, h + 0.02, 0);
  parts.push(top);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.4;
    const root = col(prim.cone(r * 0.28, r * 1.1, 5), L.bark, 0.3);
    place(root, Math.cos(a) * r * 0.7, r * 0.25, Math.sin(a) * r * 0.7, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    parts.push(root);
  }
  return bake(parts);
}

// Empty rock shell after ore is mined (grey, no crystals).
export function emptyRockGeometry(rng) {
  return rockGeometry(null, rng || (() => 0.5));
}

// ---------------------------------------------------------------------------
// Rocks: smooth boulder cluster with coloured ore veins and crystals.
// ---------------------------------------------------------------------------
export function rockGeometry(oreHex, rng) {
  const parts = [];
  const grey = new THREE.Color(0x77726a), dark = new THREE.Color(0x4e4a45), ore = new THREE.Color(oreHex ?? 0x888888);
  const c = new THREE.Color();
  const seed = rng() * 10;
  const veinFn = (x, y, z, nx, ny) => {
    c.copy(dark).lerp(grey, 0.45 + 0.4 * ny + 0.15 * snoise(x * 4, y * 4, z * 4, seed));
    const v = Math.abs(snoise(x * 2.2, y * 3.0, z * 2.2, seed + 5));
    if (oreHex != null && v < 0.16) c.lerp(ore, 0.85 * (1 - v / 0.16));
    return c;
  };
  parts.push(paint(place(blob(0.9, 0.62, 0.8, { detail: 2, lump: 0.2, seed, flat: 0.6 }), 0, 0.32, 0, 0, rng() * 6, 0), veinFn));
  parts.push(paint(place(blob(0.5, 0.42, 0.48, { detail: 1, lump: 0.25, seed: seed + 2, flat: 0.5 }), 0.45, 0.25, 0.3, 0, rng() * 6, 0), veinFn));
  parts.push(paint(place(blob(0.38, 0.3, 0.36, { detail: 1, lump: 0.25, seed: seed + 4, flat: 0.5 }), -0.5, 0.15, -0.25), veinFn));
  if (oreHex != null) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng();
      const d = 0.35 + rng() * 0.3;
      const g = new THREE.OctahedronGeometry(0.12 + rng() * 0.06, 0);
      g.deleteAttribute('uv');
      place(g, Math.cos(a) * d, 0.5 + rng() * 0.32, Math.sin(a) * d, rng(), rng(), rng(), 1, 1.6, 1);
      parts.push(col(g, ore.getHex(), 0.4));
    }
  }
  return bake(parts);
}

// ---------------------------------------------------------------------------
// Ground clutter: grass tufts, flowers and bushes as instanced meshes
// (one draw call per kind). Not clickable.
// ---------------------------------------------------------------------------
export function tuftGeometry(blades = 5, height = 0.42, spread = 0.16) {
  const pos = [], nor = [], colr = [];
  const lo = new THREE.Color(0x2c5a18), hi = new THREE.Color(0x8ab84a);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI + (i * 0.7);
    const ox = Math.cos(a * 2.3) * spread * 0.6, oz = Math.sin(a * 1.7) * spread * 0.6;
    const w = 0.05, dx = Math.cos(a) * w, dz = Math.sin(a) * w;
    const lean = 0.12, tx = ox + Math.cos(a + 1.3) * lean, tz = oz + Math.sin(a + 1.3) * lean;
    const h = height * (0.7 + 0.5 * ((i * 37) % 10) / 10);
    // both windings so blades look the same from either side, with an upward normal (lit like the ground)
    pos.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, tx, h, tz, ox + dx, 0, oz + dz, ox - dx, 0, oz - dz, tx, h, tz);
    for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
    for (let k = 0; k < 2; k++) colr.push(lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, hi.r, hi.g, hi.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}
export function flowerGeometry() {
  // Low-poly: a thin stem and one flattened bloom (about 20 triangles).
  const stem = col(new THREE.CylinderGeometry(0.012, 0.015, 0.3, 3, 1, true), 0x3a6a22, 0);
  place(stem, 0, 0.15, 0);
  const bloom = col(new THREE.SphereGeometry(0.075, 6, 2), 0xffffff, 0);
  place(bloom, 0, 0.31, 0, 0, 0, 0, 1, 0.45, 1);
  return bake([stem, bloom]);
}

// ---------------------------------------------------------------------------
// Characters. Parts lists are [geometry, colour, x, y, z, rx, ry, rz, shade].
// ---------------------------------------------------------------------------
export function kit(list, material = vcMat, shadow = true) {
  return bakedMesh(list.map(([geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, amt = 0.22]) => place(col(geo, hex, amt), x, y, z, rx, ry, rz)), material, shadow);
}
const scaled = (geo, sx, sy, sz) => { geo.scale(sx, sy, sz); return geo; };
const dark = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
export const hairCap = r => { const g = new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56); g.deleteAttribute('uv'); return g; };

// Rounded person. Returns { top: parts above the hips, leg: parts for one leg hanging from the hip at y=0, hipY }.
export function humanoidParts(look) {
  const skin = look.skin ?? 0xe0ae84, body = look.body, legs = look.legs ?? 0x3a2a1a, boots = look.boots ?? 0x2e2016;
  const top = [
    [scaled(prim.capsule(0.26, 0.32, 4, 12), 1, 1, 0.72), body, 0, 1.12, 0],
    [scaled(prim.sphere(0.24, 12, 8), 1, 0.6, 0.75), legs, 0, 0.8, 0],
    [prim.cyl(0.255, 0.255, 0.07, 14), look.belt ?? 0x3a2414, 0, 0.88, 0, 0, 0, 0, 0],
    [prim.sphere(0.12, 10, 8), body, -0.32, 1.36, 0], [prim.sphere(0.12, 10, 8), body, 0.32, 1.36, 0],
    [prim.capsule(0.085, 0.26, 3, 8), look.sleeve ?? body, -0.37, 1.16, 0, 0, 0, -0.1], [prim.capsule(0.085, 0.26, 3, 8), look.sleeve ?? body, 0.37, 1.16, 0, 0, 0, 0.1],
    [prim.capsule(0.072, 0.24, 3, 8), skin, -0.4, 0.88, 0.03, 0.15], [prim.capsule(0.072, 0.24, 3, 8), skin, 0.4, 0.88, 0.03, 0.15],
    [prim.sphere(0.08, 8, 6), skin, -0.41, 0.7, 0.05], [prim.sphere(0.08, 8, 6), skin, 0.41, 0.7, 0.05],
    [prim.cyl(0.08, 0.09, 0.14, 8), skin, 0, 1.5, 0],
    [scaled(prim.sphere(0.25, 16, 12), 1, 1.08, 0.98), skin, 0, 1.73, 0, 0, 0, 0, 0.12],
    [prim.sphere(0.045, 6, 4), dark(skin, 0.92), 0, 1.7, 0.245, 0, 0, 0, 0],
    [prim.sphere(0.032, 6, 4), 0x1a1410, -0.085, 1.77, 0.215, 0, 0, 0, 0], [prim.sphere(0.032, 6, 4), 0x1a1410, 0.085, 1.77, 0.215, 0, 0, 0, 0],
    [scaled(prim.sphere(0.05, 6, 4), 0.5, 1, 0.8), skin, -0.25, 1.73, 0], [scaled(prim.sphere(0.05, 6, 4), 0.5, 1, 0.8), skin, 0.25, 1.73, 0]
  ];
  if (look.hair !== null) top.push([hairCap(0.27), look.hair ?? 0x3a2a1a, 0, 1.75, -0.02, -0.3, 0, 0, 0.1]);
  const leg = [
    [prim.capsule(0.11, 0.3, 3, 8), legs, 0, -0.2, 0],
    [prim.capsule(0.095, 0.28, 3, 8), legs, 0, -0.5, 0],
    [scaled(prim.sphere(0.12, 10, 6), 1, 0.65, 1.5), boots, 0, -0.68, 0.05, 0, 0, 0, 0.3]
  ];
  return { top, leg, hipY: 0.74 };
}

// NPC accessories from a look { hat, hatW, hatH, beard, apron }.
export function npcExtras(look) {
  const out = [];
  if (look.hat) {
    const H = look.hatH ?? 0.16, W = look.hatW ?? 0.5;
    if (H >= 0.35) { // chef's toque
      out.push([hairCap(0.275), look.hat, 0, 1.85, -0.03, -0.3, 0, 0, 0.08], [prim.cyl(0.25, 0.26, H * 0.8, 16), look.hat, 0, 1.96 + H * 0.4, -0.02, -0.1, 0, 0, 0.1], [scaled(prim.sphere(0.3, 16, 10), 1, 0.6, 1), look.hat, 0, 1.96 + H * 0.85, -0.04, -0.1, 0, 0, 0.1]);
    } else if (W >= 0.65) { // wide straw brim
      out.push([prim.cyl(W * 0.6, W * 0.62, 0.035, 20), look.hat, 0, 1.93, -0.01, -0.1], [hairCap(0.275), look.hat, 0, 1.84, -0.02, -0.25, 0, 0, 0.1], [prim.cyl(0.22, 0.26, 0.14, 16), look.hat, 0, 2.02, -0.03, -0.12]);
    } else if (H >= 0.24) { // metal helm with nose guard
      out.push([hairCap(0.29), look.hat, 0, 1.76, 0, -0.1, 0, 0, 0.15], [prim.box(0.05, 0.18, 0.04), look.hat, 0, 1.72, 0.27]);
    } else { // soft cap / hood
      out.push([hairCap(0.28), look.hat, 0, 1.83, -0.02, -0.3, 0, 0, 0.15], [prim.cyl(0.3, 0.3, 0.05, 14), look.hat, 0, 1.9, 0.02, -0.18]);
    }
  }
  if (look.beard) out.push([scaled(prim.sphere(0.17, 10, 8), 1, 1.1, 0.7), look.beard, 0, 1.56, 0.14]);
  if (look.apron) out.push([prim.box(0.42, 0.62, 0.03), look.apron, 0, 0.92, 0.2, -0.05, 0, 0, 0.1]);
  return out;
}

// Build a leg pivot (Group at the hip) holding one baked leg mesh.
export function legPivot(parts, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(kit(parts));
  return pivot;
}

// Creature bodies. Each returns { top: parts, legs: [{ parts, x, y, z }] } facing +z.
export function creatureParts(shape, c, typeName) {
  const lighter = new THREE.Color(c).offsetHSL(0, 0, 0.12).getHex(), darker = dark(c, 0.7);
  if (typeName === 'Cow') {
    const hide = blob(0.48, 0.42, 0.82, { detail: 2, lump: 0.06, seed: 2 });
    const W = new THREE.Color(0xf2efe8), B = new THREE.Color(0x2a2622), cc = new THREE.Color();
    paint(hide, (x, y, z, nx, ny) => (snoise(x * 3, y * 3, z * 3, 5) > 0.25 ? cc.copy(B) : cc.copy(W)).multiplyScalar(0.8 + 0.25 * (0.5 + ny * 0.5)));
    return {
      top: [
        [hide, 0xffffff, 0, 0.98, 0, 0, 0, 0, 0],
        [blob(0.24, 0.24, 0.3, { detail: 1, lump: 0.05 }), 0xf2efe8, 0, 1.18, 0.88], [scaled(prim.sphere(0.15, 10, 8), 1.1, 0.8, 0.8), 0xe8b0a0, 0, 1.06, 1.12],
        [prim.cone(0.04, 0.2, 6), 0xe0d8c0, 0.16, 1.42, 0.85, 0, 0, -0.6], [prim.cone(0.04, 0.2, 6), 0xe0d8c0, -0.16, 1.42, 0.85, 0, 0, 0.6],
        [scaled(prim.sphere(0.07, 6, 4), 1.4, 0.6, 1), 0x2a2622, 0.24, 1.3, 0.8], [scaled(prim.sphere(0.07, 6, 4), 1.4, 0.6, 1), 0x2a2622, -0.24, 1.3, 0.8],
        [prim.sphere(0.14, 8, 6), 0xe8a8a0, 0, 0.62, -0.25], [prim.capsule(0.03, 0.5, 2, 5), 0xf2efe8, 0, 0.85, -0.85, 0.3]
      ],
      legs: [[0.26, 0.45], [-0.26, 0.45], [0.26, -0.5], [-0.26, -0.5]].map(([x, z]) => ({ x, y: 0.72, z, parts: [[prim.capsule(0.09, 0.5, 3, 8), 0xf2efe8, 0, -0.35, 0], [prim.cyl(0.1, 0.1, 0.1, 8), 0x3a3028, 0, -0.68, 0]] }))
    };
  }
  if (typeName === 'Wolf') {
    // Compact wolf: short deep torso, raised head, long snout, tall ears, bushy tail.
    return {
      top: [
        [blob(0.36, 0.32, 0.42, { detail: 2, lump: 0.05, seed: 11 }), c, 0, 0.82, 0],
        [blob(0.26, 0.24, 0.24, { detail: 1, lump: 0.04, seed: 12 }), lighter, 0, 1.0, 0.38],
        [blob(0.2, 0.18, 0.2, { detail: 1, lump: 0.04, seed: 13 }), c, 0, 1.15, 0.58],
        [scaled(prim.cone(0.1, 0.32, 8), 1, 0.85, 1), lighter, 0, 1.08, 0.88, Math.PI / 2],
        [prim.sphere(0.04, 6, 4), 0x1a1a1a, 0, 1.05, 1.12, 0, 0, 0, 0],
        [prim.sphere(0.04, 6, 4), 0xe8c040, 0.1, 1.22, 0.68, 0, 0, 0, 0],
        [prim.sphere(0.04, 6, 4), 0xe8c040, -0.1, 1.22, 0.68, 0, 0, 0, 0],
        [prim.cone(0.07, 0.22, 5), c, 0.11, 1.38, 0.52, -0.1],
        [prim.cone(0.07, 0.22, 5), c, -0.11, 1.38, 0.52, -0.1],
        [prim.cone(0.035, 0.1, 4), 0xe8c0b0, 0.11, 1.44, 0.52, -0.1],
        [prim.cone(0.035, 0.1, 4), 0xe8c0b0, -0.11, 1.44, 0.52, -0.1],
        [blob(0.1, 0.09, 0.32, { detail: 1, lump: 0.03, seed: 14 }), c, 0, 0.95, -0.55],
        [prim.sphere(0.12, 8, 6), lighter, 0, 1.02, -0.82]
      ],
      legs: [[0.17, 0.28], [-0.17, 0.28], [0.17, -0.3], [-0.17, -0.3]].map(([x, z]) => ({
        x, y: 0.55, z,
        parts: [[prim.capsule(0.05, 0.42, 3, 7), c, 0, -0.28, 0], [scaled(prim.sphere(0.055, 7, 5), 1, 0.5, 1.3), darker, 0, -0.55, 0.03]]
      }))
    };
  }
  if (shape === 'quad') {
    // Generic quadruped: shorter body so it doesn't look like a stretched blob.
    return {
      top: [
        [blob(0.32, 0.28, 0.5, { detail: 2, lump: 0.08, seed: 1 }), c, 0, 0.72, 0],
        [blob(0.26, 0.26, 0.28, { detail: 1, lump: 0.08, seed: 2 }), lighter, 0, 0.85, 0.4],
        [blob(0.2, 0.18, 0.22, { detail: 1, lump: 0.06, seed: 3 }), c, 0, 0.98, 0.68],
        [scaled(prim.sphere(0.1, 8, 6), 0.95, 0.8, 1.3), lighter, 0, 0.92, 0.9],
        [prim.sphere(0.035, 6, 4), 0x111111, 0, 0.9, 1.08, 0, 0, 0, 0],
        [prim.sphere(0.03, 6, 4), 0xe0c020, 0.09, 1.04, 0.82, 0, 0, 0, 0],
        [prim.sphere(0.03, 6, 4), 0xe0c020, -0.09, 1.04, 0.82, 0, 0, 0, 0],
        [prim.cone(0.055, 0.16, 5), c, 0.1, 1.18, 0.62, -0.2],
        [prim.cone(0.055, 0.16, 5), c, -0.1, 1.18, 0.62, -0.2],
        [blob(0.1, 0.08, 0.22, { detail: 1, lump: 0.04, seed: 4 }), c, 0, 0.8, -0.55],
        [prim.sphere(0.09, 7, 5), lighter, 0, 0.86, -0.75]
      ],
      legs: [[0.16, 0.32], [-0.16, 0.32], [0.16, -0.35], [-0.16, -0.35]].map(([x, z]) => ({
        x, y: 0.58, z,
        parts: [[prim.capsule(0.06, 0.4, 3, 8), c, 0, -0.28, 0], [scaled(prim.sphere(0.065, 8, 6), 1, 0.55, 1.25), darker, 0, -0.55, 0.03]]
      }))
    };
  }
  if (shape === 'spider') {
    const legs = [];
    for (const side of [-1, 1]) [-0.3, -0.08, 0.14, 0.34].forEach((lz, i) => {
      legs.push({ x: side * 0.28, y: 0.6, z: lz, parts: [
        [prim.capsule(0.045, 0.5, 2, 6), darker, side * 0.28, 0.12, 0, 0, (i - 1.5) * 0.25 * side, side * -1.0],
        [prim.capsule(0.04, 0.6, 2, 6), darker, side * 0.62, -0.25, 0, 0, (i - 1.5) * 0.25 * side, side * 0.45]
      ] });
    });
    return {
      top: [
        [blob(0.5, 0.4, 0.58, { detail: 2, lump: 0.08, seed: 4 }), c, 0, 0.72, -0.5], [blob(0.3, 0.24, 0.32, { detail: 1, lump: 0.08, seed: 5 }), darker, 0, 0.62, 0.2],
        [prim.sphere(0.05, 6, 4), 0xff2020, 0.08, 0.72, 0.48, 0, 0, 0, 0], [prim.sphere(0.05, 6, 4), 0xff2020, -0.08, 0.72, 0.48, 0, 0, 0, 0],
        [prim.sphere(0.035, 6, 4), 0xff2020, 0.15, 0.7, 0.44, 0, 0, 0, 0], [prim.sphere(0.035, 6, 4), 0xff2020, -0.15, 0.7, 0.44, 0, 0, 0, 0],
        [prim.cone(0.04, 0.16, 5), 0x1a1a1a, 0.06, 0.48, 0.48, 2.8], [prim.cone(0.04, 0.16, 5), 0x1a1a1a, -0.06, 0.48, 0.48, 2.8],
        [scaled(prim.sphere(0.2, 8, 6), 1, 0.3, 1), 0xc02020, 0, 1.04, -0.55, 0, 0, 0, 0]
      ],
      legs
    };
  }
  if (shape === 'dragon') {
    const wing = (side) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.6, 0.5); s.lineTo(1.9, -0.2); s.lineTo(1.2, -0.5); s.lineTo(0.6, -0.4); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); g.deleteAttribute('uv');
      g.rotateX(-Math.PI / 2); if (side < 0) mirrorX(g);
      return [g, darker, side * 0.35, 1.55, -0.1, 0, 0, side * 0.35, 0.15];
    };
    return {
      top: [
        [blob(0.55, 0.5, 1.0, { detail: 2, lump: 0.08, seed: 6 }), c, 0, 1.05, 0], [blob(0.42, 0.3, 0.8, { detail: 1, lump: 0.05, seed: 7 }), 0xc8b878, 0, 0.82, 0.1],
        [prim.capsule(0.2, 0.7, 3, 10), c, 0, 1.6, 0.9, 0.7], [blob(0.3, 0.26, 0.42, { detail: 1, lump: 0.1, seed: 8 }), c, 0, 2.0, 1.32],
        [prim.capsule(0.14, 0.3, 3, 8), lighter, 0, 1.9, 1.7, Math.PI / 2], [prim.sphere(0.05, 6, 4), 0xffc020, 0.15, 2.1, 1.48, 0, 0, 0, 0], [prim.sphere(0.05, 6, 4), 0xffc020, -0.15, 2.1, 1.48, 0, 0, 0, 0],
        [prim.cone(0.06, 0.4, 6), 0xd8c890, 0.14, 2.3, 1.15, -0.6], [prim.cone(0.06, 0.4, 6), 0xd8c890, -0.14, 2.3, 1.15, -0.6],
        [prim.cone(0.22, 1.6, 8), c, 0, 0.95, -1.5, -Math.PI / 2 - 0.15],
        ...[0, 1, 2, 3].map(i => [prim.cone(0.07, 0.22, 4), 0xd8c890, 0, 1.55 - i * 0.05, 0.4 - i * 0.35, 0, 0, 0, 0]),
        wing(1), wing(-1)
      ],
      legs: [[0.35, 0.55], [-0.35, 0.55], [0.35, -0.55], [-0.35, -0.55]].map(([x, z]) => ({ x, y: 0.75, z, parts: [[prim.capsule(0.13, 0.45, 3, 8), c, 0, -0.35, 0], [scaled(prim.sphere(0.13, 8, 6), 1, 0.6, 1.4), darker, 0, -0.7, 0.06]] }))
    };
  }
  return null;
}
