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
  // RS2-style elevated follow camera
  const offsetX = 0;
  const offsetY = 16;
  const offsetZ = 12;
  camera.position.x = player.mesh.position.x + offsetX;
  camera.position.y = player.mesh.position.y + offsetY;
  camera.position.z = player.mesh.position.z + offsetZ;
  camera.lookAt(player.mesh.position.x, 1, player.mesh.position.z);
}
