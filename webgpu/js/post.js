// WebGPU release: post-processing as one node graph (three/webgpu PostProcessing) replacing the EffectComposer chain:
// scene pass with a normal MRT -> NaN/Inf guard -> GTAO -> bloom -> tone mapping (AgX/ACES from the renderer) ->
// light shafts + saturation + split-tone + vignette grade.
import * as THREE from 'three';
import { pass, mrt, output, normalView, directionToColor, colorToDirection, sample, uniform, float, vec2, vec3, vec4, mix, smoothstep, dot, length, select,
  uv, Fn, Loop, renderOutput, max } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
export const POSTFX = { bloom: null };
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { bayer16 } from 'three/addons/tsl/math/Bayer.js';
import { screenUV, screenCoordinate, positionWorld, exp, texture } from 'three/tsl';
import { BACKEND } from './scene.js';
import { getNoiseTexture, TIME } from './gfx.js';

// Stage 6 volumetric light: a VolumeNodeMaterial box that follows the camera is raymarched (dithered, 1/4 resolution,
// then blurred) against every light on VOL.layer, sampling their shadow maps, so sun shafts through trees and roofs and
// torch halos are true 3D in-scattering that keeps working when the sun is off-screen. Occluded by the scene depth.
export const VOL = { layer: 10, mesh: null, on: false, intensity: uniform(0.22), density: uniform(1), tint: uniform(new THREE.Color(1.0, 0.92, 0.8)) };

const okc = (v) => select(v.greaterThanEqual(0.0).and(v.lessThan(1e4)), v, float(0));   // NaN fails both tests, Inf the second
const guard = (c) => vec4(okc(c.r), okc(c.g), okc(c.b), okc(c.a).clamp(0, 1));

export function createPost(renderer, scene, camera) {
  const post = new THREE.PostProcessing(renderer);
  post.outputColorTransform = false;   // tone mapping happens inside the graph so the grade runs in display space like the WebGL game
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, normal: directionToColor(normalView) }));
  const col = scenePass.getTextureNode('output'), depth = scenePass.getTextureNode('depth'), nrm = scenePass.getTextureNode('normal');
  const sceneNormal = sample((u) => colorToDirection(nrm.sample(u)));
  const aoPass = ao(depth, sceneNormal, camera);
  aoPass.resolutionScale = 0.5; aoPass.radius.value = 0.9; aoPass.distanceExponent.value = 1.6; aoPass.thickness.value = 1.4; aoPass.scale.value = 1.0; aoPass.samples.value = 16;
  const aoOn = uniform(1);
  const clean = guard(col);
  const aoV = okc(aoPass.getTextureNode().x).clamp(0, 1);
  const lit = clean.rgb.mul(mix(1.0, aoV, aoOn.mul(0.85)));
  let litV = lit;
  const Qs = new URLSearchParams(location.search);
  if (BACKEND.name === 'WebGPU' && !Qs.has('novol')) {   // on by default (hidden on Low by stage6); ?novol disables
    try {
      const vm = new THREE.VolumeNodeMaterial();
      vm.steps = +(Qs.get('volsteps') || 8); vm.fog = false;
      vm.offsetNode = bayer16(screenCoordinate);
      vm.scatteringNode = Fn(({ positionRay }) => {
        const n = texture(getNoiseTexture(), positionRay.xz.mul(0.035).add(vec2(TIME.mul(0.006), TIME.mul(0.003)))).level(0).r;
        const h = exp(max(positionRay.y, 0.0).mul(-0.09));   // thick in valleys and at ground level, thin up high
        return h.mul(n.mul(0.8).add(0.4)).mul(VOL.density).mul(0.035);
      });
      vm.depthNode = depth.sample(screenUV);
      const box = new THREE.Mesh(new THREE.BoxGeometry(140, 40, 140), vm);
      box.receiveShadow = true; box.frustumCulled = false;
      box.layers.disableAll(); box.layers.enable(VOL.layer);
      scene.add(box); VOL.mesh = box;
      const layers = new THREE.Layers(); layers.disableAll(); layers.enable(VOL.layer);
      // The blue wash was the sky background being drawn into the volume pass and added on top of the frame.
      // The volume pass gets its own camera; when the scene renders through it the background is suppressed.
      const volCam = camera.clone(); VOL.cam = volCam;
      const prevB = scene.onBeforeRender, prevA = scene.onAfterRender; let savedBg = null;
      scene.onBeforeRender = function (r, s, cam, rt) {
        if (cam === volCam) { volCam.copy(camera, false); volCam.matrixWorld.copy(camera.matrixWorld); volCam.matrixWorldInverse.copy(camera.matrixWorldInverse); volCam.projectionMatrix.copy(camera.projectionMatrix); volCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
          savedBg = s.background; s.background = null; }
        if (prevB) prevB.apply(this, arguments);
      };
      scene.onAfterRender = function (r, s, cam) {
        if (cam === volCam) s.background = savedBg;
        if (prevA) prevA.apply(this, arguments);
      };
      const vPass = pass(scene, volCam, { depthBuffer: false });
      vPass.setLayers(layers); vPass.setResolution(+(Qs.get('volres') || 0.25));
      const vol = guard(gaussianBlur(vPass, 1.0)).rgb;
      // keep the in-scatter warm/neutral: drive it by luminance, tinted by the light's own hue, so no colour cast leaks in
      const vl = dot(vol, vec3(0.2126, 0.7152, 0.0722));
      litV = lit.add(mix(vec3(vl), vol, 0.35).mul(VOL.tint).mul(VOL.intensity));
      VOL.on = true;
    } catch (e) { console.warn('[webgpu] volumetric light unavailable', e); }
  }
  const bl = bloom(vec4(litV, 1), 0.3, 0.45, 0.9);
  POSTFX.bloom = bl;   // strength/threshold are retuned per frame by stage7.js (day/night, cave)
  const hdr = vec4(litV.add(guard(bl).rgb), 1);
  const GRADE = { sat: uniform(1.12), vig: uniform(0.32), sunUV: uniform(new THREE.Vector2(0.5, 0.8)), shaftK: uniform(0), shaftCol: uniform(new THREE.Color(1, 0.9, 0.7)) };
  const graded = Fn(() => {
    const c = renderOutput(hdr).toVar();
    const vUv = uv();
    // light shafts: march toward the sun gathering bright sky pixels from the scene colour
    const dl = vUv.sub(GRADE.sunUV).div(24.0), suv = vUv.toVar(), acc = float(0).toVar(), w = float(1).toVar();
    Loop(24, () => { suv.subAssign(dl); const sc = guard(col.sample(suv)).rgb; acc.addAssign(smoothstep(0.82, 1.0, dot(sc, vec3(0.33))).mul(w)); w.mulAssign(0.95); });
    const fall = float(1).sub(smoothstep(0.0, 0.75, length(vUv.sub(GRADE.sunUV).mul(vec2(1.6, 1.0)))));
    c.rgb.addAssign(GRADE.shaftCol.mul(acc.div(24.0)).mul(GRADE.shaftK).mul(fall));
    const l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb.assign(mix(vec3(l), c.rgb, GRADE.sat));
    c.rgb.assign(mix(c.rgb, smoothstep(0.0, 1.0, c.rgb), GRADE.sat.sub(1.12).mul(0.9)));
    const lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb.addAssign(vec3(-0.012, 0.0, 0.03).mul(float(1).sub(smoothstep(0.0, 0.45, lum))).add(vec3(0.03, 0.012, -0.02).mul(smoothstep(0.45, 1.0, lum))));
    const d = vUv.sub(0.5);
    c.rgb.mulAssign(float(1).sub(GRADE.vig.mul(smoothstep(0.25, 0.85, dot(d, d).mul(2.2)))));
    return vec4(c.rgb, 1);
  })();
  post.outputNode = graded;
  return {
    GRADE,
    gtao: { set enabled(v) { aoOn.value = v ? 1 : 0; }, get enabled() { return aoOn.value > 0.5; }, node: aoPass },
    bloom: bl,
    render() { post.render(); },
    needsUpdate() { post.needsUpdate = true; }
  };
}
