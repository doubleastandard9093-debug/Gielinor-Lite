import { WORLD_HALF, LAKE } from './world.js';

// Rotating minimap with compass, hitpoints orb and run orb. Tap the map to walk there.
export function createMinimap({ onWalk, onCompass, onRunToggle }) {
  const wrap = document.createElement('div');
  wrap.id = 'minimapWrap';
  wrap.innerHTML = `
    <div id="orbs">
      <div class="orb" id="hpOrb" title="Hitpoints"><span class="orb-ico">❤️</span><b>10</b></div>
      <div class="orb" id="runOrb" title="Run energy - tap to toggle run"><span class="orb-ico">🏃</span><b>100</b></div>
    </div>
    <div id="minimap"><canvas></canvas><div id="compass" title="Face north">N</div></div>`;
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hpOrb = wrap.querySelector('#hpOrb');
  const runOrb = wrap.querySelector('#runOrb');
  const compass = wrap.querySelector('#compass');
  compass.addEventListener('click', e => { e.stopPropagation(); onCompass(); });
  runOrb.addEventListener('click', () => onRunToggle());

  const SCALE = 3.2;   // minimap pixels per world unit (at canvas resolution)
  // Pre-render the static ground once.
  const S = Math.ceil((WORLD_HALF * 2 + 10) * 4);
  const base = document.createElement('canvas');
  base.width = base.height = S;
  const b = base.getContext('2d');
  const W = u => (u + WORLD_HALF + 5) * 4;
  b.fillStyle = '#3f7a35'; b.fillRect(0, 0, S, S);
  b.strokeStyle = '#8a7650'; b.lineWidth = 6; b.lineCap = 'round';
  for (const [x1, z1, x2, z2] of [[0, 0, 13, -12], [0, 0, -15, -13], [0, 0, -15, 12], [0, 0, 20, 17], [0, 0, 0, 24]]) {
    b.beginPath(); b.moveTo(W(x1), W(z1)); b.lineTo(W(x2), W(z2)); b.stroke();
  }
  b.fillStyle = '#9a9a8a'; b.beginPath(); b.arc(W(0), W(0), 18, 0, Math.PI * 2); b.fill();
  b.fillStyle = '#c9b77a'; b.beginPath(); b.arc(W(LAKE.x), W(LAKE.z), (LAKE.r + 1.4) * 4, 0, Math.PI * 2); b.fill();
  b.fillStyle = '#2f6fb0'; b.beginPath(); b.arc(W(LAKE.x), W(LAKE.z), LAKE.r * 4, 0, Math.PI * 2); b.fill();
  b.strokeStyle = '#6a4a2a'; b.lineWidth = 2; b.strokeRect(W(-24), W(-21), 48, 40);
  b.fillStyle = '#8a8478'; b.beginPath(); b.arc(W(0), W(29), 9, 0, Math.PI * 2); b.fill();
  b.strokeStyle = '#000'; b.lineWidth = 4; b.strokeRect(0, 0, S, S);

  let size = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.max(60, Math.round(r.width * dpr));
    if (s !== size) { size = s; canvas.width = canvas.height = s; }
  }
  window.addEventListener('resize', resize);
  setTimeout(resize, 0);

  let lastYaw = 0, lastPx = 0, lastPz = 0;
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const k = SCALE * (size / 140);
    const sx = (e.clientX - r.left - r.width / 2) * (size / r.width) / k;
    const sy = (e.clientY - r.top - r.height / 2) * (size / r.width) / k;
    if (sx * sx + sy * sy > (size / 2 / k) ** 2) return;
    const c = Math.cos(lastYaw), s = Math.sin(lastYaw);
    const dx = sx * c + sy * s, dz = -sx * s + sy * c;
    onWalk(lastPx + dx, lastPz + dz);
  });

  const DOT = {
    tree: '#1f5a1a', rock: '#8a8a8a', fish: '#7fd0ff', monster: '#ffff00', shop: '#ffb000', bank: '#ffd700', pile: '#ff3030'
  };

  function draw(px, pz, yaw, nodes, monsters, piles) {
    if (!size) resize();
    if (!size) return;
    lastYaw = yaw; lastPx = px; lastPz = pz;
    const k = SCALE * (size / 140); // pixels per world unit
    const half = size / 2;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(half, half, half, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    ctx.translate(half, half);
    ctx.rotate(yaw);
    const m = k / 4;
    ctx.drawImage(base, -W(px) * m, -W(pz) * m, S * m, S * m);
    ctx.restore();

    const c = Math.cos(yaw), s = Math.sin(yaw);
    const r = Math.max(2, size / 70);
    const dot = (x, z, color, rr = r) => {
      const dx = x - px, dz = z - pz;
      const sx = (dx * c - dz * s) * k + half, sy = (dx * s + dz * c) * k + half;
      if ((sx - half) ** 2 + (sy - half) ** 2 > half * half) return;
      ctx.fillStyle = color;
      ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    };
    for (const n of nodes) {
      if (n.type === 'tree') dot(n.x, n.z, n.alive ? DOT.tree : '#4a3a1a', r * 1.4);
      else if (n.type === 'rock') dot(n.x, n.z, n.alive ? DOT.rock : '#555', r);
      else if (n.type === 'fish') dot(n.x, n.z, DOT.fish, r);
      else if (n.type === 'shop') dot(n.x, n.z, DOT.shop, r * 1.6);
      else if (n.type === 'bank') dot(n.x, n.z, DOT.bank, r * 1.6);
    }
    for (const p of piles) dot(p.x, p.z, DOT.pile, r);
    for (const mo of monsters) if (mo.alive) dot(mo.mesh.position.x, mo.mesh.position.z, DOT.monster, r);
    ctx.fillStyle = '#fff';
    ctx.fillRect(half - r, half - r, r * 2, r * 2);
    compass.style.transform = `rotate(${yaw}rad)`;
  }

  function setOrbs(hp, maxHp, energy, running) {
    const hb = hpOrb.lastChild, rb = runOrb.lastChild;
    const hv = String(hp), rv = String(Math.floor(energy));
    if (hb.textContent !== hv) hb.textContent = hv;
    if (rb.textContent !== rv) rb.textContent = rv;
    const frac = hp / maxHp;
    hpOrb.style.setProperty('--fill', (frac * 100).toFixed(0) + '%');
    hpOrb.classList.toggle('low', frac < 0.3);
    runOrb.style.setProperty('--fill', energy.toFixed(0) + '%');
    runOrb.classList.toggle('on', running);
  }

  return { draw, setOrbs };
}
