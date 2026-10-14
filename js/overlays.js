import * as THREE from 'three';

// Hitsplats and health bars drawn as pooled HTML elements over the 3D view.
export function createOverlays() {
  const layer = document.createElement('div');
  layer.id = 'overlays';
  document.body.appendChild(layer);
  const v = new THREE.Vector3();

  const splats = [];
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'splat';
    el.style.display = 'none';
    layer.appendChild(el);
    splats.push({ el, ent: null, until: 0, ox: 0, oy: 0 });
  }
  const bars = new Map(); // entity -> element
  function barFor(ent) {
    let el = bars.get(ent);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hpbar';
      el.innerHTML = '<i></i>';
      layer.appendChild(el);
      bars.set(ent, el);
    }
    return el;
  }

  // Nameplates: name, level and a slim HP bar over nearby monsters and townsfolk.
  const plates = [];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div');
    el.className = 'nameplate'; el.style.display = 'none';
    el.innerHTML = '<span class="np-name"></span><span class="np-lvl"></span><i class="np-hp"><b></b></i>';
    layer.appendChild(el);
    plates.push({ el, ent: null, key: '' });
  }
  let plateList = [];
  function setPlates(list) { plateList = list; }

  let w = window.innerWidth, h = window.innerHeight;
  window.addEventListener('resize', () => { w = window.innerWidth; h = window.innerHeight; });

  function toScreen(ent, height, camera) {
    const p = ent.mesh.position;
    v.set(p.x, p.y + height, p.z).project(camera);
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return false;
    v.x = (v.x + 1) * 0.5 * w;
    v.y = (1 - v.y) * 0.5 * h;
    return true;
  }

  // ent needs .mesh and .barHeight
  function splat(ent, dmg, now, poison = false) {
    let s = splats.find(x => !x.ent) || splats.reduce((a, b) => (a.until < b.until ? a : b));
    // Offset splats on the same target so multiple hits don't stack exactly
    const busy = splats.filter(x => x.ent === ent && x !== s).length;
    s.ent = ent;
    s.until = now + 1200;
    s.ox = [0, -16, 16, 0][busy % 4];
    s.oy = [0, 8, 8, 16][busy % 4];
    s.el.textContent = dmg;
    s.el.className = poison ? 'splat poison' : dmg > 0 ? 'splat hit' : 'splat miss';
    s.el.style.display = 'block';
  }

  function update(camera, entities, now) {
    for (const s of splats) {
      if (!s.ent) continue;
      if (now > s.until || !s.ent.mesh.visible) { s.ent = null; s.el.style.display = 'none'; continue; }
      if (!toScreen(s.ent, (s.ent.barHeight || 2) * 0.55, camera)) { s.el.style.display = 'none'; continue; }
      s.el.style.display = 'block';
      s.el.style.transform = `translate(${(v.x + s.ox - 13) | 0}px, ${(v.y + s.oy - 13) | 0}px)`;
    }
    for (const ent of entities) {
      const show = ent.mesh.visible && ent.hp !== undefined && now - (ent.lastHitAt || -1e9) < 6000 && (ent.alive !== false || ent.dying);
      let el = bars.get(ent);
      if (!show) { if (el && el.style.display !== 'none') el.style.display = 'none'; continue; }
      el = barFor(ent);
      if (!toScreen(ent, (ent.barHeight || 2) + 0.35, camera)) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.transform = `translate(${(v.x - 20) | 0}px, ${(v.y - 3) | 0}px)`;
      const pct = Math.max(0, Math.min(100, (ent.hp / ent.maxHp) * 100)) | 0;
      if (el._pct !== pct) { el._pct = pct; el.firstChild.style.width = pct + '%'; }
    }
  }

  function updatePlates(camera, now) {
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i], d = plateList[i];
      if (!d || !d.ent.mesh.visible) { if (p.el.style.display !== 'none') p.el.style.display = 'none'; p.ent = null; continue; }
      const ent = d.ent;
      const key = d.name + '|' + (d.level || '') + '|' + d.color + '|' + (d.kind || '');
      if (p.key !== key) {
        p.key = key; p.el.className = 'nameplate ' + (d.kind || '');
        p.el.children[0].textContent = d.name;
        p.el.children[1].textContent = d.level ? `Lv ${d.level}` : '';
        p.el.children[1].style.background = d.color || '';
        p.el.children[1].style.display = d.level ? '' : 'none';
      }
      const hurt = ent.hp !== undefined && ent.maxHp && ent.hp < ent.maxHp;
      p.el.children[2].style.display = hurt ? 'block' : 'none';
      if (hurt) p.el.children[2].firstChild.style.width = Math.max(0, Math.min(100, ent.hp / ent.maxHp * 100)).toFixed(0) + '%';
      const showBar = now - (ent.lastHitAt || -1e9) < 6000;
      if (!toScreen(ent, (ent.barHeight || 2) + (showBar ? 0.95 : 0.55), camera)) { p.el.style.display = 'none'; continue; }
      p.el.style.display = 'flex';
      p.el.style.transform = `translate(-50%, -100%) translate(${v.x | 0}px, ${v.y | 0}px)`;
      p.ent = ent;
    }
  }

  return { splat, update, setPlates, updatePlates };
}
