// WebGPU release: post-processing as one node graph (three/webgpu PostProcessing) replacing the EffectComposer chain:
// scene pass with a normal MRT -> NaN/Inf guard -> GTAO -> bloom -> tone mapping (AgX/ACES from the renderer) ->
// light shafts + saturation + split-tone + vignette grade.
import * as THREE from 'three';
import { pass, mrt, output, normalView, directionToColor, colorToDirection, sample, uniform, float, vec2, vec3, vec4, mix, smoothstep, dot, length, select,
  uv, Fn, Loop, renderOutput, max } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

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
  const bl = bloom(vec4(lit, 1), 0.3, 0.45, 0.9);
  const hdr = vec4(lit.add(guard(bl).rgb), 1);
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
