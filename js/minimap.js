import { WORLD_HALF, LAKE, PATHS, BUILDINGS, TOWNS } from './world.js';

// Rotating minimap with compass, hitpoints orb and run orb. Tap the map to walk there.
export function createMinimap({ onWalk, onCompass, onRunToggle, onPrayerOrb }) {
  const wrap = document.createElement('div');
  wrap.id = 'minimapWrap';
  wrap.innerHTML = `
    <div id="orbs">
      <div class="orb" id="hpOrb" title="Hitpoints"><span class="orb-ico">❤️</span><b>10</b></div>
      <div class="orb" id="prayOrb" title="Prayer points - tap for prayers"><span class="orb-ico">🙏</span><b>10</b></div>
      <div class="orb" id="runOrb" title="Run energy - tap to toggle run"><span class="orb-ico">🏃</span><b>100</b></div>
    </div>
    <div id="minimap"><canvas></canvas><div id="compass" title="Face north">N</div>
      <div id="mmZoom"><button data-z="1" title="Zoom in">+</button><button data-z="-1" title="Zoom out">−</button></div>
      <button id="mmLegendBtn" title="Map key">?</button>
      <button id="mmMapBtn" title="World map (M)">🗺</button>
      <div id="mmLegend"></div></div>`;
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const hpOrb = wrap.querySelector('#hpOrb');
  const runOrb = wrap.querySelector('#runOrb');
  const prayOrb = wrap.querySelector('#prayOrb');
  prayOrb.addEventListener('click', () => onPrayerOrb && onPrayerOrb());
  const compass = wrap.querySelector('#compass');
  compass.addEventListener('click', e => { e.stopPropagation(); onCompass(); });
  runOrb.addEventListener('click', () => onRunToggle());

  const SCALE = 3.2;
  let zoom = 1;
  const zoomBox = wrap.querySelector('#mmZoom');
  zoomBox.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-z]'); if (b) zoom = Math.max(0.5, Math.min(2.5, zoom * (+b.dataset.z > 0 ? 1.25 : 0.8))); });
  const legend = wrap.querySelector('#mmLegend');
  legend.innerHTML = '<b>Map key</b>' + [['#ffffff', 'You'], ['#ffff00', 'Monster'], ['#3ad0ff', 'Quest giver'], ['#ffb000', 'Shop / townsfolk'], ['#ffd700', 'Bank'], ['#ff7a1a', 'Furnace, anvil, range'],
    ['#c080ff', 'Altar'], ['#ff60ff', 'Rune altar'], ['#7fd0ff', 'Fishing spot'], ['#8a8a8a', 'Rock'], ['#1f5a1a', 'Tree'], ['#7aff4a', 'Herb patch'], ['#e04060', 'Berry bush'], ['#40e0a0', 'Agility'], ['#c89a5a', 'Signpost'], ['#ff3030', 'Loot']]
    .map(([c, l]) => `<div><i style="background:${c}"></i>${l}</div>`).join('') + '<div><i style="background:#ffd24a;transform:rotate(45deg)"></i>Saga goal</div>';
  wrap.querySelector('#mmLegendBtn').addEventListener('click', e => { e.stopPropagation(); legend.classList.toggle('show'); });
  legend.addEventListener('click', e => { e.stopPropagation(); legend.classList.remove('show'); });   // minimap pixels per world unit (at canvas resolution)
  // Pre-render the static ground once.
  const S = Math.ceil((WORLD_HALF * 2 + 10) * 4);
  const base = document.createElement('canvas');
  base.width = base.height = S;
  const b = base.getContext('2d');
  const W = u => (u + WORLD_HALF + 5) * 4;
  b.fillStyle = '#3f7a35'; b.fillRect(0, 0, S, S);
  b.strokeStyle = '#8a7650'; b.lineWidth = 6; b.lineCap = 'round';
  for (const [x1, z1, x2, z2] of PATHS) {
    b.beginPath(); b.moveTo(W(x1), W(z1)); b.lineTo(W(x2), W(z2)); b.stroke();
  }
  for (const t of Object.values(TOWNS)) { b.fillStyle = '#9a9a8a'; b.beginPath(); b.arc(W(t.x), W(t.z), 18, 0, Math.PI * 2); b.fill(); }
  b.fillStyle = '#c9b77a'; b.beginPath(); b.arc(W(LAKE.x), W(LAKE.z), (LAKE.r + 1.4) * 4, 0, Math.PI * 2); b.fill();
  b.fillStyle = '#2f6fb0'; b.beginPath(); b.arc(W(LAKE.x), W(LAKE.z), LAKE.r * 4, 0, Math.PI * 2); b.fill();
  b.strokeStyle = '#6a4a2a'; b.lineWidth = 2; b.strokeRect(W(-24), W(-21), 48, 40);
  b.fillStyle = '#8a8478'; b.beginPath(); b.arc(W(0), W(29), 9, 0, Math.PI * 2); b.fill();
  for (const [x, z, w, d] of BUILDINGS) {
    b.fillStyle = '#d8d0c0'; b.fillRect(W(x - w / 2), W(z - d / 2), w * 4, d * 4);
    b.strokeStyle = '#5a4a3a'; b.lineWidth = 1.5; b.strokeRect(W(x - w / 2), W(z - d / 2), w * 4, d * 4);
    // doorway gap (same rule as world.js: faces the nearest town centre)
    let tc = TOWNS.Brightwater, bd = Infinity;
    for (const t of Object.values(TOWNS)) { const dd = Math.hypot(t.x - x, t.z - z); if (dd < bd) { bd = dd; tc = t; } }
    const rx = x - tc.x, rz = z - tc.z, onX = Math.abs(rx) > Math.abs(rz), sg = onX ? (Math.sign(-rx) || 1) : (Math.sign(-rz) || 1);
    b.fillStyle = '#b89a6a';
    if (onX) b.fillRect(W(x + sg * w / 2) - 1.5, W(z) - 2.3, 3, 4.6); else b.fillRect(W(x) - 2.3, W(z + sg * d / 2) - 1.5, 4.6, 3);
  }
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
    const k = SCALE * zoom * (size / 140);
    const sx = (e.clientX - r.left - r.width / 2) * (size / r.width) / k;
    const sy = (e.clientY - r.top - r.height / 2) * (size / r.width) / k;
    if (sx * sx + sy * sy > (size / 2 / k) ** 2) return;
    const c = Math.cos(lastYaw), s = Math.sin(lastYaw);
    const dx = sx * c + sy * s, dz = -sx * s + sy * c;
    onWalk(lastPx + dx, lastPz + dz);
  });

  const DOT = {
    tree: '#1f5a1a', rock: '#8a8a8a', fish: '#7fd0ff', monster: '#ffff00', shop: '#ffb000', bank: '#ffd700', pile: '#ff3030',
    npc: '#ffffff', quest: '#3ad0ff', station: '#ff7a1a', altar: '#c080ff'
  };

  function draw(px, pz, yaw, nodes, monsters, piles) {
    if (!size) resize();
    if (!size) return;
    lastYaw = yaw; lastPx = px; lastPz = pz;
    const k = SCALE * zoom * (size / 140); // pixels per world unit
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
      else if (n.type === 'herb') dot(n.x, n.z, '#7aff4a', r * 1.2);
      else if (n.type === 'shop') dot(n.x, n.z, DOT.shop, r * 1.6);
      else if (n.type === 'bank') dot(n.x, n.z, DOT.bank, r * 1.6);
      else if (n.type === 'npc') dot(n.x, n.z, n.questMark ? DOT.quest : DOT.shop, r * 1.4);
      else if (n.type === 'station') dot(n.x, n.z, DOT.station, r * 1.3);
      else if (n.type === 'altar') dot(n.x, n.z, DOT.altar, r * 1.5);
      else if (n.type === 'runealtar') dot(n.x, n.z, '#ff60ff', r * 1.7);
      else if (n.type === 'agility') dot(n.x, n.z, '#40e0a0', r * 1.2);
      else if (n.type === 'sign') dot(n.x, n.z, '#c89a5a', r * 1.2);
      else if (n.type === 'forage') dot(n.x, n.z, n.alive ? '#e04060' : '#6a3a40', r * 1.1);
      else if (n.type === 'poi') dot(n.x, n.z, '#ffffff', r * 1.8);
    }
    for (const p of piles) dot(p.x, p.z, DOT.pile, r);
    for (const mo of monsters) if (mo.alive) dot(mo.mesh.position.x, mo.mesh.position.z, DOT.monster, r);
    // Goal markers (saga etc.): a gold diamond, pinned to the rim with an arrow when off the map.
    for (const mk of marks) {
      const dx = mk.x - px, dz = mk.z - pz;
      let sx = (dx * c - dz * s) * k, sy = (dx * s + dz * c) * k; const d = Math.hypot(sx, sy), lim = half - r * 3;
      const off = d > lim; if (off) { sx *= lim / d; sy *= lim / d; }
      ctx.save(); ctx.translate(sx + half, sy + half);
      if (off) ctx.rotate(Math.atan2(sy, sx) + Math.PI / 4);
      else ctx.rotate(Math.PI / 4);
      const q = r * (off ? 1.7 : 2.1);
      ctx.fillStyle = mk.color || '#ffd24a'; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath(); if (off) { ctx.moveTo(q, -q); ctx.lineTo(q, q); ctx.lineTo(-q, q); } else ctx.rect(-q, -q, q * 2, q * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    // player arrow (points up = camera forward)
    ctx.save(); ctx.translate(half, half);
    ctx.beginPath(); ctx.moveTo(0, -r * 2.4); ctx.lineTo(r * 1.6, r * 1.6); ctx.lineTo(0, r * 0.8); ctx.lineTo(-r * 1.6, r * 1.6); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.45); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
    // inner vignette for depth
    const vg = ctx.createRadialGradient(half, half, half * 0.6, half, half, half);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, size, size);
    compass.style.transform = `rotate(${yaw}rad)`;
  }

  function setOrbs(hp, maxHp, energy, running, pp = 0, maxPp = 10, praying = false) {
    const pb = prayOrb.lastChild, pv = String(Math.ceil(pp));
    if (pb.textContent !== pv) pb.textContent = pv;
    prayOrb.style.setProperty('--fill', (Math.min(1, pp / maxPp) * 100).toFixed(0) + '%');
    prayOrb.classList.toggle('on', praying);
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

  // ---- World map: the whole realm, north up, with goal markers. Tap to close. ----
  let marks = [];
  const mapEl = document.createElement('div'); mapEl.id = 'worldMap'; mapEl.style.display = 'none';
  mapEl.innerHTML = '<div class="wm-head"><b>World map</b><span class="wm-hint">Tap to close</span></div><canvas></canvas><div class="wm-list"></div>';
  document.body.appendChild(mapEl);
  const mc = mapEl.querySelector('canvas'), mctx = mc.getContext('2d');
  function drawMap() {
    const box = Math.min(innerWidth - 24, innerHeight - 140, 720), dpr = Math.min(devicePixelRatio || 1, 2);
    mc.style.width = mc.style.height = box + 'px'; mc.width = mc.height = Math.round(box * dpr);
    const Z = mc.width; mctx.drawImage(base, 0, 0, Z, Z);
    const P = v => (W(v) / S) * Z;
    const star = (x, z, col, rr) => { mctx.save(); mctx.translate(P(x), P(z)); mctx.rotate(Math.PI / 4); mctx.fillStyle = col; mctx.strokeStyle = '#000'; mctx.lineWidth = 2 * dpr; mctx.fillRect(-rr, -rr, rr * 2, rr * 2); mctx.strokeRect(-rr, -rr, rr * 2, rr * 2); mctx.restore(); };
    mctx.font = `${Math.round(11 * dpr)}px sans-serif`; mctx.fillStyle = '#fff'; mctx.textAlign = 'center';
    for (const [n, t] of Object.entries(TOWNS)) { mctx.strokeStyle = '#000'; mctx.lineWidth = 3 * dpr; mctx.strokeText(n, P(t.x), P(t.z) - 10 * dpr); mctx.fillText(n, P(t.x), P(t.z) - 10 * dpr); }
    for (const mk of marks) {
      const inside = Math.abs(mk.x) < WORLD_HALF && Math.abs(mk.z) < WORLD_HALF;
      if (inside) star(mk.x, mk.z, mk.color || '#ffd24a', 6 * dpr);
      else { const x = Math.max(-WORLD_HALF + 8, Math.min(WORLD_HALF - 8, mk.x)), z = Math.max(-WORLD_HALF + 8, Math.min(WORLD_HALF - 8, mk.z)); star(x, z, mk.color || '#ffd24a', 5 * dpr); }
    }
    mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(P(lastPx), P(lastPz), 5 * dpr, 0, 7); mctx.fill(); mctx.lineWidth = 2 * dpr; mctx.strokeStyle = '#000'; mctx.stroke();
    mapEl.querySelector('.wm-list').innerHTML = marks.map(m => `<div><i></i>${String(m.label || '').replace(/[<&]/g, '')}</div>`).join('');
  }
  function openMap() { mapEl.style.display = 'flex'; drawMap(); }
  function closeMap() { mapEl.style.display = 'none'; }
  mapEl.addEventListener('click', closeMap);
  wrap.querySelector('#mmMapBtn').addEventListener('click', e => { e.stopPropagation(); openMap(); });
  addEventListener('resize', () => { if (mapEl.style.display !== 'none') drawMap(); });
  return { draw, setOrbs, setMarks(m) { marks = m || []; if (mapEl.style.display !== 'none') drawMap(); }, openMap, closeMap, toggleMap: () => (mapEl.style.display === 'none' ? openMap() : closeMap()), get marks() { return marks; } };
}
