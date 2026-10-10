import * as THREE from 'three';

export function setupInput(renderer, camera, ground, player, onLog) {
  const keys = {};
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  function getPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointer(e) {
    e.preventDefault();
    getPointer(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(ground);
    if (hits.length) {
      player.target = hits[0].point.clone();
      player.target.y = 0;
      onLog('Moving...');
    }
  }

  // Touch and mouse
  renderer.domElement.addEventListener('click', onPointer);
  renderer.domElement.addEventListener('touchstart', onPointer, { passive: false });
  renderer.domElement.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  // On-screen D-pad for mobile
  const dpad = document.createElement('div');
  dpad.id = 'dpad';
  dpad.style.cssText = `
    position: absolute; bottom: 100px; left: 10px; display: grid;
    grid-template-columns: 50px 50px 50px; grid-template-rows: 50px 50px 50px;
    gap: 2px; pointer-events: auto; z-index: 10;
  `;
  dpad.innerHTML = `
    <div></div><button data-dir="up">▲</button><div></div>
    <button data-dir="left">◀</button><div></div><button data-dir="right">▶</button>
    <div></div><button data-dir="down">▼</button><div></div>
  `;
  document.body.appendChild(dpad);

  dpad.querySelectorAll('button').forEach(btn => {
    btn.style.cssText = 'background:#333;color:#fff;border:1px solid #666;font-size:18px;';
    const dir = btn.dataset.dir;
    const move = () => {
      if (dir === 'up') keys['w'] = true;
      if (dir === 'down') keys['s'] = true;
      if (dir === 'left') keys['a'] = true;
      if (dir === 'right') keys['d'] = true;
    };
    const stop = () => {
      if (dir === 'up') keys['w'] = false;
      if (dir === 'down') keys['s'] = false;
      if (dir === 'left') keys['a'] = false;
      if (dir === 'right') keys['d'] = false;
    };
    btn.addEventListener('touchstart', e => { e.preventDefault(); move(); }, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('mousedown', move);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
  });

  return keys;
}
