import * as THREE from 'three';

export function setupUI() {
  const logEl = document.getElementById('log');
  const interactBtn = document.getElementById('interactBtn');

  function log(msg) {
    if (!logEl) return;
    const d = document.createElement('div');
    d.textContent = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 20) logEl.removeChild(logEl.firstChild);
  }

  if (interactBtn) {
    interactBtn.addEventListener('click', () => {
      log('Interact pressed.');
    });
  }

  return { log };
}

export function updateCamera(camera, player) {
  // Smooth RS2-style follow camera
  const targetPos = new THREE.Vector3(
    player.mesh.position.x,
    player.mesh.position.y + 16,
    player.mesh.position.z + 12
  );
  camera.position.lerp(targetPos, 0.08);
  camera.lookAt(player.mesh.position.x, 1, player.mesh.position.z);
}
