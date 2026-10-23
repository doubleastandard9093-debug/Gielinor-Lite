// RS2-style orbit camera: rotate around the player, zoom in/out, clamped pitch.
export function createCameraRig() {
  return {
    yaw: 0,            // 0 = camera south of the player looking north
    pitch: 0.9,        // radians above the horizon
    dist: 17,
    targetYaw: 0, targetPitch: 0.9, targetDist: 17,
    minPitch: 0.3, maxPitch: 1.38,
    minDist: 7, maxDist: 30,
    fx: 0, fz: 0       // smoothed follow point
  };
}

export function rotateRig(rig, dYaw, dPitch) {
  rig.targetYaw += dYaw;
  rig.targetPitch = Math.max(rig.minPitch, Math.min(rig.maxPitch, rig.targetPitch + dPitch));
}

export function zoomRig(rig, factor) {
  rig.targetDist = Math.max(rig.minDist, Math.min(rig.maxDist, rig.targetDist * factor));
}

export function updateRig(rig, camera, px, pz, dt, py = 0) {
  const k = Math.min(1, dt * 10);
  rig.yaw += (rig.targetYaw - rig.yaw) * k;
  rig.pitch += (rig.targetPitch - rig.pitch) * k;
  rig.dist += (rig.targetDist - rig.dist) * k;
  const f = Math.min(1, dt * 8);
  rig.fx += (px - rig.fx) * f;
  rig.fz += (pz - rig.fz) * f;
  rig.fy = (rig.fy ?? py) + (py - (rig.fy ?? py)) * f;
  const cp = Math.cos(rig.pitch);
  camera.position.set(
    rig.fx + Math.sin(rig.yaw) * cp * rig.dist,
    rig.fy + 1 + Math.sin(rig.pitch) * rig.dist,
    rig.fz + Math.cos(rig.yaw) * cp * rig.dist
  );
  camera.lookAt(rig.fx, rig.fy + 1, rig.fz);
  // light screen shake: a short, decaying jitter (never more than ~6 cm / 0.6 degrees)
  if (rig.shake > 0.001) {
    rig.shakeT = (rig.shakeT || 0) + dt; const s = rig.shake * rig.shake, t = rig.shakeT * 38;
    camera.position.x += Math.sin(t * 1.3) * 0.06 * s; camera.position.y += Math.sin(t * 1.7 + 1) * 0.05 * s;
    camera.rotation.z += Math.sin(t * 1.1 + 2) * 0.011 * s;
    rig.shake = Math.max(0, rig.shake - dt * 3.2);
  }
}
export function shakeRig(rig, amt) { if (rig.shakeOff) return; rig.shake = Math.min(1, Math.max(rig.shake || 0, amt)); }
