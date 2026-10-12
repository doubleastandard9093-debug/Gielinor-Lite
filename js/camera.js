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

export function updateRig(rig, camera, px, pz, dt) {
  const k = Math.min(1, dt * 10);
  rig.yaw += (rig.targetYaw - rig.yaw) * k;
  rig.pitch += (rig.targetPitch - rig.pitch) * k;
  rig.dist += (rig.targetDist - rig.dist) * k;
  const f = Math.min(1, dt * 8);
  rig.fx += (px - rig.fx) * f;
  rig.fz += (pz - rig.fz) * f;
  const cp = Math.cos(rig.pitch);
  camera.position.set(
    rig.fx + Math.sin(rig.yaw) * cp * rig.dist,
    1 + Math.sin(rig.pitch) * rig.dist,
    rig.fz + Math.cos(rig.yaw) * cp * rig.dist
  );
  camera.lookAt(rig.fx, 1, rig.fz);
}
