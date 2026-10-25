// Graphics helpers for the modern look: sky dome, procedural textures,
// textured terrain, animated water, swaying foliage, graphics quality.
// Everything is generated in code (no image files), and kept cheap for phones.
import * as THREE from 'three';
import { IS_TOUCH } from './scene.js';

export const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.42).normalize();
export const SKY = {
  top: new THREE.Color(0x3f7fd0),
  horizon: new THREE.Color(0xc9d3d6),
  sun: new THREE.Color(0xfff0c8)
};
// Shared, ticking time uniform used by water, foliage sway and clouds.
export const TIME = { value: 0 };
export const SWAY = { value: 1 };

// ---------------------------------------------------------------------------
// Graphics quality: 'high' or 'low'. Auto (null) = High on desktop, High on
// phones too but at a lower pixel ratio; it drops to Low by itself if the
// phone can't keep a smooth frame rate.
// ---------------------------------------------------------------------------
export function resolveQuality(setting) {
  if (setting === 'high' || setting === 'low') return setting;
  return 'high';
}
export function pixelRatioFor(quality) {
  const dpr = window.devicePixelRatio || 1;
  if (quality === 'low') return Math.min(dpr, IS_TOUCH ? 1.25 : 1);
  return Math.min(dpr, IS_TOUCH ? 1.75 : 2);
}

// ---------------------------------------------------------------------------
// Tileable value-noise texture (RGB = three different noise octaves).
// ---------------------------------------------------------------------------
function makeNoiseData(size, seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = new Float32Array(size * size);
  const octave = (cells, amp) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const step = size / cells;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / step, fy = y / step;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[(y0 % cells) * cells + (x0 % cells)], b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
      const c = g[((y0 + 1) % cells) * cells + (x0 % cells)], d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
      out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
    }
  };
  return { out, octave };
}
let noiseTex = null;
export function getNoiseTexture() {
  if (noiseTex) return noiseTex;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const chans = [[4, 8, 16], [8, 16, 32], [16, 32, 64]];
  chans.forEach((cells, ch) => {
    const { out, octave } = makeNoiseData(size, 1234 + ch * 777);
    octave(cells[0], 0.55); octave(cells[1], 0.3); octave(cells[2], 0.15);
    for (let i = 0; i < size * size; i++) data[i * 4 + ch] = Math.max(0, Math.min(255, out[i] * 255));
  });
  for (let i = 0; i < size * size; i++) data[i * 4 + 3] = 255;
  noiseTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

// ---------------------------------------------------------------------------
// Sky dome: blue gradient, warm sun with glow, drifting soft clouds.
// ---------------------------------------------------------------------------
export function createSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: SKY.top }, horizon: { value: SKY.horizon }, sunCol: { value: SKY.sun },
      sunDir: { value: SUN_DIR }, time: TIME, tNoise: { value: getNoiseTexture() }, clouds: { value: 1 }, night: { value: 0 }, gold: { get value() { return SKY.gold || 0; } }
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p; }`,
    fragmentShader: `uniform vec3 top, horizon, sunCol, sunDir; uniform float time, clouds, night, gold; uniform sampler2D tNoise; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, horizon * vec3(0.82, 0.9, 0.8), smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, sunDir), 0.0);
        // sunset/sunrise: warm orange at the horizon rising through pink into violet, strongest toward the sun
        if (gold > 0.01) {
          float azs = pow(max(0.0, dot(normalize(d.xz + 1e-4), normalize(sunDir.xz + 1e-4))) * 0.5 + 0.5, 2.0);
          vec3 ss = mix(vec3(1.0, 0.42, 0.12), vec3(0.98, 0.45, 0.5), smoothstep(0.0, 0.14, h));
          ss = mix(ss, vec3(0.5, 0.36, 0.7), smoothstep(0.12, 0.42, h));
          col = mix(col, ss * (0.55 + 0.75 * azs), gold * (1.0 - smoothstep(0.3, 0.75, h)) * 0.85);
          col += vec3(1.0, 0.5, 0.15) * pow(sd, 4.0) * gold * 0.45;
        }
        col += sunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.25 + pow(sd, 6.0) * 0.12);
        if (clouds > 0.5 && h > 0.0) {
          // volumetric cumulus: ray-march a slab between cloud base (y=1) and top (y=1.38) with jittered steps.
          // Density = 2D noise coverage shaped by height (flat bellies, rounded crowns) and eroded by a height-shifted
          // detail octave. Each step marches 3 samples toward the sun (Beer-Lambert with a powder term), so clouds
          // self-shadow, glow at thin sunlit edges and get dark bellies.
          vec2 wind = vec2(time * 0.0025, time * 0.001); float T = 1.0, c = 0.0; vec3 lit = vec3(0.0);
          vec3 sunC = mix(vec3(1.0, 0.97, 0.92), sunCol, 0.35) * 1.08, shadeC = mix(horizon, top, 0.5) * vec3(0.6, 0.65, 0.78);
          sunC = mix(sunC, vec3(1.0, 0.62, 0.36) * 1.2, gold); shadeC = mix(shadeC, vec3(0.6, 0.38, 0.52), gold * 0.85);
          const float HB = 1.0, HT = 1.38; const int NS = 14;
          float t0 = HB / max(h, 0.04), t1 = min(HT / max(h, 0.04), t0 + 3.0), dt = (t1 - t0) / float(NS);
          float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          float hg = mix(1.0, 1.0 + 1.6 * pow(sd, 6.0), 0.8);   // forward-scattering phase toward the sun
          for (int i = 0; i < NS; i++) {
            vec3 p = d * (t0 + (float(i) + jit) * dt);
            float yf = (p.y - HB) / (HT - HB);
            vec2 uv = p.xz * 0.16 + wind;
            float n = texture2D(tNoise, uv).r * 0.62 + texture2D(tNoise, uv * 2.3 + 0.3).g * 0.38;
            float shape = smoothstep(0.0, 0.12, yf) * (1.0 - smoothstep(0.35, 1.0, yf) * 0.9);
            float den = smoothstep(0.54, 0.68, n * (0.72 + 0.35 * shape) + (shape - 0.6) * 0.2);
            den -= texture2D(tNoise, uv * 6.0 + yf * 0.25 + 0.7).b * 0.25 * (1.0 - den);   // wispy eroded edges
            den = clamp(den, 0.0, 1.0) * dt * 7.0;
            if (den > 0.002) {
              float od = 0.0;
              for (int k = 1; k <= 3; k++) {
                vec3 q = p + sunDir * (0.05 * float(k)); float yq = (q.y - HB) / (HT - HB);
                vec2 uq = q.xz * 0.16 + wind;
                float nq = texture2D(tNoise, uq).r * 0.62 + texture2D(tNoise, uq * 2.3 + 0.3).g * 0.38;
                float sq = smoothstep(0.0, 0.12, yq) * (1.0 - smoothstep(0.35, 1.0, yq) * 0.9) * step(yq, 1.0);
                od += smoothstep(0.54, 0.68, nq * (0.72 + 0.35 * sq) + (sq - 0.6) * 0.2) * sq;
              }
              float beer = exp(-od * 1.4), powder = 1.0 - exp(-den * 6.0);
              float sh = beer * mix(1.0, powder, 0.5) * (0.6 + 0.4 * yf);
              vec3 Lc = mix(shadeC, sunC * hg, sh) + sunCol * pow(sd, 8.0) * beer * 0.5 + vec3(1.0, 0.45, 0.18) * pow(sd, 3.0) * beer * gold * 0.7;
              float a = 1.0 - exp(-den * 2.5);
              lit += T * a * Lc; T *= 1.0 - a;
              if (T < 0.03) break;
            }
          }
          c = (1.0 - T) * smoothstep(0.0, 0.2, h);
          vec3 cc = lit / max(1.0 - T, 1e-3);
          cc *= mix(vec3(1.0), vec3(0.16, 0.2, 0.32), night);
          col = mix(col, cc, c * 0.92);
          // stars and a moon at night (the moon sits opposite the sun)
          vec3 sp = floor(d * 260.0); float r = fract(sin(dot(sp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          col += vec3(0.9, 0.95, 1.0) * step(0.9965, r) * night * smoothstep(0.05, 0.3, h) * (1.0 - c);
          float md = max(dot(d, -sunDir), 0.0); col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.4 + pow(md, 60.0) * 0.15) * night;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  return {
    mesh: sky,
    follow(camera) { sky.position.copy(camera.position); },
    setQuality(q) { mat.uniforms.clouds.value = q === 'low' ? 0 : 1; },
    setNight(n) { mat.uniforms.night.value = n; }
  };
}

// ---------------------------------------------------------------------------
// Terrain material: splat-blends grass / dirt / sand / cobbles from a mask
// texture painted in code, with procedural noise detail. One draw call.
// ---------------------------------------------------------------------------
export function terrainMaterial(maskTex, maskSize) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.tMask = { value: maskTex };
    sh.uniforms.tNoise = { value: getNoiseTexture() };
    sh.uniforms.maskSize = { value: maskSize };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform sampler2D tMask, tNoise; uniform float maskSize;
        vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }`)
      .replace('#include <map_fragment>', `
        vec2 wp = vWPos.xz;
        vec4 mk = texture2D(tMask, wp / maskSize + 0.5);
        float n1 = texture2D(tNoise, wp * 0.012).r;
        float n2 = texture2D(tNoise, wp * 0.07).g;
        float n3 = texture2D(tNoise, wp * 0.45).b;
        float n4 = texture2D(tNoise, wp * 1.9).r;
        vec3 grass = mix(vec3(0.24, 0.37, 0.20), vec3(0.42, 0.54, 0.23), smoothstep(0.3, 0.7, n1));
        grass = mix(grass, vec3(0.12, 0.23, 0.17), smoothstep(0.55, 0.85, n2) * 0.55);
        grass = mix(grass, vec3(0.55, 0.62, 0.24), smoothstep(0.62, 0.9, n3) * 0.3);
        // shader LOD: fine grain fades out with distance (less shimmer on phones)
        float fineK = 1.0 - smoothstep(40.0, 70.0, length(cameraPosition - vWPos));
        n4 = mix(0.5, n4, fineK); n3 = mix(0.5, n3, fineK * 0.5 + 0.5);
        grass *= 0.82 + 0.36 * n4;
        vec3 dirt = mix(vec3(0.47, 0.35, 0.21), vec3(0.58, 0.45, 0.29), n3) * (0.8 + 0.35 * n4);
        dirt = mix(dirt, vec3(0.62, 0.6, 0.55), smoothstep(0.72, 0.8, n4) * 0.6);
        vec3 sand = mix(vec3(0.82, 0.72, 0.5), vec3(0.9, 0.82, 0.6), n2) * (0.9 + 0.18 * n4);
        vec2 cell = wp * 1.35; vec2 ci = floor(cell + vec2(0.0, floor(cell.x) * 0.5)); vec2 cf = fract(cell + vec2(0.0, floor(cell.x) * 0.5));
        float grout = smoothstep(0.0, 0.09, cf.x) * smoothstep(1.0, 0.91, cf.x) * smoothstep(0.0, 0.09, cf.y) * smoothstep(1.0, 0.91, cf.y);
        float cv = texture2D(tNoise, ci * 0.137).g;
        vec3 stone = mix(vec3(0.48, 0.47, 0.44), vec3(0.66, 0.63, 0.57), cv) * (0.9 + 0.15 * n4);
        stone = mix(vec3(0.3, 0.29, 0.27), stone, grout);
        float edge = (n2 - 0.5) * 0.45 + (n4 - 0.5) * 0.15;
        vec3 col = grass;
        col = mix(col, sand, smoothstep(0.35, 0.6, mk.g + edge));
        col = mix(col, dirt, smoothstep(0.38, 0.62, mk.r + edge));
        col = mix(col, stone, smoothstep(0.4, 0.6, mk.b + edge * 0.4));
        // hills beyond the playable area: grass to rock with height
        // elevation: steep slopes and high ground turn to rock, peaks get snow
        vec3 fwc = cross(dFdx(vWPos), dFdy(vWPos)); vec3 fwn = dot(fwc, fwc) > 1e-12 ? normalize(fwc) : vec3(0.0, 1.0, 0.0);
        float slope = 1.0 - abs(fwn.y);
        float hrock = max(smoothstep(11.0, 19.0, vWPos.y + (n2 - 0.5) * 6.0), smoothstep(0.32, 0.5, slope + (n3 - 0.5) * 0.15));
        // triplanar rock: project the noise along all three axes and blend by the surface normal so cliffs do not stretch
        vec3 tw = pow(abs(fwn), vec3(4.0)); tw /= max(tw.x + tw.y + tw.z, 1e-4);
        float r3 = texture2D(tNoise, vWPos.zy * 0.45).b * tw.x + texture2D(tNoise, vWPos.xz * 0.45).b * tw.y + texture2D(tNoise, vWPos.xy * 0.45).b * tw.z;
        float r4 = texture2D(tNoise, vWPos.zy * 1.9).r * tw.x + n4 * tw.y + texture2D(tNoise, vWPos.xy * 1.9).r * tw.z;
        float r2 = texture2D(tNoise, vWPos.zy * 0.07).g * tw.x + n2 * tw.y + texture2D(tNoise, vWPos.xy * 0.07).g * tw.z;
        float strata = 0.5 + 0.5 * sin(vWPos.y * 3.1 + r2 * 6.0);   // horizontal layering on cliff faces
        vec3 rockC = mix(vec3(0.29, 0.29, 0.28), vec3(0.54, 0.53, 0.50), r3) * (0.85 + 0.3 * r4);
        rockC = mix(rockC, vec3(0.29, 0.353, 0.165), smoothstep(0.6, 0.9, fwn.y) * 0.75); // moss on rock tops (#4A5A2A)
        rockC = mix(rockC, vec3(0.32, 0.3, 0.28), smoothstep(0.6, 0.8, r2) * 0.5);
        rockC *= 0.88 + 0.16 * strata * slope;
        col = mix(col, rockC, hrock);
        col = mix(col, mix(col, vec3(0.32, 0.42, 0.16), 0.5), smoothstep(-0.3, -2.5, vWPos.y)); // lush valley floors
        float snow = smoothstep(19.0, 24.0, vWPos.y + (n2 - 0.5) * 5.0) * (1.0 - smoothstep(0.55, 0.75, slope));
        col = mix(col, vec3(0.92, 0.94, 0.97) * (0.92 + 0.1 * n4), snow);
        diffuseColor.rgb *= lin(col);
        // procedural height for bump shading and per-surface roughness
        float isStone = smoothstep(0.4, 0.6, mk.b + edge * 0.4) * (1.0 - hrock), isDirt = smoothstep(0.38, 0.62, mk.r + edge) * (1.0 - hrock);
        tHeight = mix(n4 * 0.6 + n3 * 0.4, (1.0 - grout) * -0.55 + n4 * 0.3, isStone);
        tHeight = mix(tHeight, r4 * 0.6 + r3 * 0.6 + strata * 0.3 * slope, hrock) * (1.0 - snow * 0.7) * fineK;
        tRough = mix(mix(mix(0.95, 0.88, isDirt), 0.72, isStone), 0.8 - 0.15 * r4, hrock);
        tRough = mix(tRough, 0.55, snow) * (1.0 - smoothstep(-0.3, -2.5, vWPos.y) * 0.12);
      `)
      .replace('void main() {', 'float tHeight = 0.0; float tRough = 0.95;\nvoid main() {')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { // screen-space bump from tHeight (Mikkelsen) gives grass clumps, dirt grain, cobble grout and rock strata real relief
          vec3 sp = -vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp);
          float bh = tHeight * 0.14, dhx = dFdx(bh), dhy = dFdy(bh);
          vec3 r1 = cross(dpy, normal), rr2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * rr2);
          vec3 bn = abs(det) * normal - grad; if (dot(bn, bn) > 1e-12) normal = normalize(bn);
        }`);
  };
  return m;
}

// ---------------------------------------------------------------------------
// Water: gentle vertex waves, scrolling ripple normals, sky reflection with
// fresnel, sun glints and foam at the shore. Single cheap shader.
// ---------------------------------------------------------------------------
// Planar reflection shared by every water surface (all sit at y = WATER_Y). High only.
export const WATER_Y = 0.05;
export const WATER_REFL = { tex: { value: null }, mat: { value: new THREE.Matrix4() }, on: { value: 0 } };
export const WATER_MESHES = [];
export function createWaterReflection(renderer, scene, camera) {
  const rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType });
  const cam = new THREE.PerspectiveCamera(), clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y + 0.01)];
  const fwd = new THREE.Vector3(), tgt = new THREE.Vector3(), near = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  WATER_REFL.tex.value = rt.texture;
  return {
    update(enabled) {
      // only when some water is on screen nearby
      let vis = false;
      if (enabled) for (const w of WATER_MESHES) { if (w.parent && near.copy(w.position).distanceTo(camera.position) < 140) { vis = true; break; } }
      WATER_REFL.on.value = vis ? 1 : 0; if (!vis || camera.position.y <= WATER_Y) return;
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); const w = Math.max(2, sz.x >> 1), h = Math.max(2, sz.y >> 1);
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far; cam.updateProjectionMatrix();
      camera.getWorldDirection(fwd); tgt.copy(camera.position).add(fwd);
      cam.position.set(camera.position.x, 2 * WATER_Y - camera.position.y, camera.position.z);
      cam.up.set(0, 1, 0); cam.lookAt(tgt.x, 2 * WATER_Y - tgt.y, tgt.z); cam.updateMatrixWorld();
      WATER_REFL.mat.value.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      for (const m of WATER_MESHES) m.visible = false;
      const prevRT = renderer.getRenderTarget(), prevClip = renderer.clippingPlanes, prevSh = renderer.shadowMap.autoUpdate;
      const prevSc = renderer.getScissor(new THREE.Vector4()), prevVp = renderer.getViewport(new THREE.Vector4()), prevScT = renderer.getScissorTest();
      renderer.shadowMap.autoUpdate = false; renderer.clippingPlanes = clip;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
      renderer.setRenderTarget(prevRT); renderer.clippingPlanes = prevClip; renderer.shadowMap.autoUpdate = prevSh;
      renderer.setViewport(prevVp); renderer.setScissor(prevSc); renderer.setScissorTest(prevScT);
      for (const m of WATER_MESHES) m.visible = true;
    }
  };
}
export function waterMaterial(cx, cz, radius) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { reflOn: WATER_REFL.on, reflMat: WATER_REFL.mat,
      time: { value: 0 }, center: { value: new THREE.Vector2(cx, cz) }, radius: { value: radius },
      sunDir: { value: SUN_DIR }, sunCol: { value: SKY.sun }, skyCol: { value: SKY.horizon }, skyTop: { value: SKY.top }
    }]),
    vertexShader: `uniform float time; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float wLod = 1.0 - smoothstep(45.0, 80.0, length(cameraPosition.xz - w.xz));
        w.y += (sin(w.x * 0.9 + time * 1.3) * 0.025 + sin(w.z * 1.3 - time * 1.7) * 0.02) * wLod;
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time, radius, reflOn; uniform vec2 center; uniform vec3 sunDir, sunCol, skyCol, skyTop; uniform sampler2D tNoise, reflTex; uniform mat4 reflMat; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vW.xz;
        vec2 a = texture2D(tNoise, p * 0.09 + vec2(time * 0.018, time * 0.011)).rg - 0.5;
        vec2 b = texture2D(tNoise, p * 0.21 - vec2(time * 0.025, -time * 0.017)).gb - 0.5;
        vec3 N = normalize(vec3((a.x + b.x) * 0.45, 1.0, (a.y + b.y) * 0.45));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float r = length(p - center) / radius;
        vec3 deep = vec3(0.008, 0.045, 0.10), shallow = vec3(0.025, 0.14, 0.17);
        vec3 col = mix(deep, shallow, smoothstep(0.55, 1.0, r));
        vec3 R = reflect(-V, N);
        vec3 sky = mix(skyCol, skyTop, clamp(R.y, 0.0, 1.0));
        // refraction-style depth: shallows turn clear and pick up the sandy bed tint, rippling with the surface
        float shallowK = smoothstep(0.7, 0.98, r + (a.x + b.x) * 0.15);
        col = mix(col, vec3(0.32, 0.36, 0.26) * (0.8 + 0.4 * texture2D(tNoise, p * 0.8 + N.xz * 0.6).g), shallowK * 0.45);
        if (reflOn > 0.5) {
          // planar reflection of trees, buildings, hills and sky, warped by the ripple normal
          vec4 rc = reflMat * vec4(vW, 1.0); vec2 ruv = rc.xy / rc.w + N.xz * 0.045;
          vec3 rcol = texture2D(reflTex, clamp(ruv, 0.001, 0.999)).rgb;
          col = mix(col, rcol * 0.9, (0.18 + 0.62 * fres) * (1.0 - shallowK * 0.5));
        } else col = mix(col, sky * 0.7, 0.05 + 0.4 * fres);
        vec3 H = normalize(sunDir + V + vec3(0.0, 1e-4, 0.0));
        float spec = pow(max(dot(N, H), 0.0), 220.0) * 3.0 + pow(max(dot(N, H), 0.0), 30.0) * 0.08;
        col += sunCol * spec;
        float fn = texture2D(tNoise, p * 0.6 + time * 0.03).b;
        float foam = smoothstep(0.93, 1.0, r + (fn - 0.5) * 0.08 + sin(time * 1.6 + r * 40.0) * 0.008);
        // lapping shoreline: bands of foam that roll in toward the bank and break up with noise
        float lap = fract(r * 9.0 - time * 0.35); float band = smoothstep(0.0, 0.08, lap) * smoothstep(0.35, 0.1, lap) * smoothstep(0.82, 0.97, r);
        foam = max(foam, band * smoothstep(0.45, 0.75, fn + 0.2 * texture2D(tNoise, p * 2.3 - time * 0.05).r));
        col = mix(col, vec3(0.86, 0.9, 0.93), foam * 0.75);
        gl_FragColor = vec4(col, mix(1.0, 0.72, shallowK));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, fog: true, depthWrite: false
  });
}
export function hookWaterNoise(mat) { mat.uniforms.tNoise = { value: getNoiseTexture() }; mat.uniforms.reflTex = WATER_REFL.tex; mat.uniforms.reflOn = WATER_REFL.on; mat.uniforms.reflMat = WATER_REFL.mat; mat.uniforms.time = TIME; return mat; }

// ---------------------------------------------------------------------------
// Per-frame update.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cheap world-space noise bump for Standard materials that lack UVs.
// Detail fades out past ~55 units so distant props stay cheap on phones.
// ---------------------------------------------------------------------------
export function attachNoiseBump(mat, strength = 0.22) {
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.tNoiseBump = { value: getNoiseTexture() };
    sh.uniforms.bumpStr = { value: strength };
    if (!sh.vertexShader.includes('vBumpW')) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBumpW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvBumpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBumpW; uniform sampler2D tNoiseBump; uniform float bumpStr;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float k = bumpStr * (1.0 - smoothstep(40.0, 70.0, length(cameraPosition - vBumpW)));
          if (k > 0.002) {
            float hx = texture2D(tNoiseBump, vBumpW.xz * 0.18).r;
            float hz = texture2D(tNoiseBump, vBumpW.xz * 0.18 + 0.37).g;
            vec3 nw = normalize(vec3((hx - 0.5) * k * 2.0, 1.0, (hz - 0.5) * k * 2.0));
            // world-space bump normal -> view space (normalMatrix is vertex-only)
            vec3 nt = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
            normal = normalize(mix(normal, nt, 0.55));
          }
        }`);
  };
  mat.customProgramCacheKey = () => prevKey() + '-nb' + strength;
  mat.needsUpdate = true;
  return mat;
}

export function tickGfx(nowMs) { TIME.value = nowMs / 1000; }
