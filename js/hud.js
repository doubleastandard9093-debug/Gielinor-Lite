// HUD extras: adrenaline orb, target info panel, floating XP tracker and buff timer rings.
import { esc } from './ui.js';
import { SKILL_ICONS, levelProgress, xpToNext } from './skills.js';

const fmt = n => Math.floor(n).toLocaleString('en-US');
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : fmt(n);

export function createHud({ player, skills, monsters, getTarget, levelColor, combatLevelOf }) {
  // ---- Adrenaline orb (builds as you land hits, fades out of combat) ----
  const orbs = document.getElementById('orbs');
  const adr = document.createElement('div');
  adr.className = 'orb'; adr.id = 'adrOrb'; adr.title = 'Adrenaline: builds as you fight, fades out of combat';
  adr.innerHTML = '<span class="orb-ico">⚡</span><b>0</b>';
  if (orbs) orbs.appendChild(adr);
  let adrenaline = 0, lastFight = -1e9;
  const seenHits = new WeakMap();

  // ---- Target panel ----
  const tp = document.createElement('div');
  tp.id = 'targetPanel';
  tp.innerHTML = '<div class="tp-head"><span class="tp-lvl"></span><b class="tp-name"></b></div><div class="tp-bar"><i class="tp-lag"></i><i class="tp-fill"></i><span class="tp-num"></span></div><div class="tp-sub"></div>';
  document.body.appendChild(tp);
  const tpName = tp.querySelector('.tp-name'), tpLvl = tp.querySelector('.tp-lvl'), tpFill = tp.querySelector('.tp-fill'), tpLag = tp.querySelector('.tp-lag'), tpNum = tp.querySelector('.tp-num'), tpSub = tp.querySelector('.tp-sub');
  let lastTarget = null, lag = 1;

  // ---- XP tracker ----
  const tr = document.createElement('div');
  tr.id = 'xpTracker';
  document.body.appendChild(tr);
  const session = {}; // skill -> { gained, at, start }
  const t0 = performance.now();
  let trHtml = '';
  window.addEventListener('xpdrop', e => {
    const { skill, amount } = e.detail;
    const s = session[skill] || (session[skill] = { gained: 0, start: performance.now() });
    s.gained += amount; s.at = performance.now();
  });

  // ---- Buff timer rings ----
  const maxLeft = new Map();

  function update(now) {
    // adrenaline: +6 per hit landed on a monster, decays out of combat
    for (const m of monsters) {
      if (!m.lastHitAt) continue;
      if (seenHits.get(m) !== m.lastHitAt) { const had = seenHits.has(m); seenHits.set(m, m.lastHitAt); if (had || now - m.lastHitAt < 400) { adrenaline = Math.min(100, adrenaline + 6); lastFight = now; } }
    }
    if (now - lastFight > 6000) adrenaline = Math.max(0, adrenaline - 0.25);
    adr.style.setProperty('--fill', adrenaline.toFixed(0) + '%');
    const av = String(Math.floor(adrenaline)); if (adr.lastChild.textContent !== av) adr.lastChild.textContent = av;
    adr.classList.toggle('full', adrenaline >= 100);

    // target
    let t = getTarget();
    if (!t && lastTarget && lastTarget.alive !== false && now - (lastTarget.lastHitAt || 0) < 6000) t = lastTarget;
    if (t !== lastTarget) { lag = t ? t.hp / t.maxHp : 1; lastTarget = t; if (t) { tp.classList.remove('in'); void tp.offsetWidth; tp.classList.add('in'); } }
    tp.classList.toggle('show', !!t);
    if (t) {
      const frac = Math.max(0, Math.min(1, t.hp / t.maxHp));
      lag = lag > frac ? Math.max(frac, lag - 0.01) : frac;
      const name = (t.variant ? t.variant + ' the ' : '') + t.name;
      if (tpName.textContent !== name) tpName.textContent = name;
      const lv = `Lv ${t.level}`; if (tpLvl.textContent !== lv) { tpLvl.textContent = lv; tpLvl.style.background = levelColor(t.level); }
      tpFill.style.width = (frac * 100).toFixed(1) + '%'; tpLag.style.width = (lag * 100).toFixed(1) + '%';
      const nv = `${Math.max(0, Math.ceil(t.hp))} / ${t.maxHp}`; if (tpNum.textContent !== nv) tpNum.textContent = nv;
      const d = t.level - combatLevelOf();
      const sub = (t.ranged ? 'Ranged · ' : t.magic ? 'Magic · ' : 'Melee · ') + (d >= 10 ? 'Deadly' : d >= 3 ? 'Tough' : d > -3 ? 'Even match' : d > -10 ? 'Easy' : 'Trivial');
      if (tpSub.textContent !== sub) tpSub.textContent = sub;
      tp.classList.toggle('low', frac < 0.25);
    }

    // xp tracker: skills gained in the last 2 minutes
    const rows = Object.entries(session).filter(([, s]) => now - s.at < 120000).sort((a, b) => b[1].at - a[1].at).slice(0, 3);
    const html = rows.map(([sk, s]) => {
      const k = skills[sk]; if (!k) return '';
      const hrs = Math.max(1 / 60, (now - s.start) / 3.6e6);
      return `<div class="xt-row"><span class="xt-ico">${SKILL_ICONS[sk] || '★'}</span><div class="xt-body"><div class="xt-top"><b>${esc(sk)} ${k.level}</b><span>+${short(s.gained)}</span></div>` +
        `<div class="xt-bar"><i style="width:${(levelProgress(k) * 100).toFixed(1)}%"></i></div><div class="xt-sub">${k.level >= 99 ? 'Max level' : short(xpToNext(k)) + ' to go'} · ${short(s.gained / hrs)}/hr</div></div></div>`;
    }).join('');
    if (html !== trHtml) { trHtml = html; tr.innerHTML = html; tr.classList.toggle('show', !!html); }

    // buff rings
    const fx = document.querySelectorAll('#effects .fx[title]');
    for (const e of player.effects || []) { if ((maxLeft.get(e.id) || 0) < e.left) maxLeft.set(e.id, e.left); }
    fx.forEach(el => {
      const e = (player.effects || []).find(x => x.id === el.title);
      const m = e && maxLeft.get(e.id);
      el.style.setProperty('--p', e && m ? ((e.left / m) * 100).toFixed(1) + '%' : '100%');
    });
  }
  // Flow chain chip (Flow Strikes): pops up on a chain and fades out.
  const flowEl = document.createElement('div');
  flowEl.id = 'flowchip';
  flowEl.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);font:700 22px/1 Georgia,serif;color:#ffd77a;text-shadow:0 2px 4px #000;pointer-events:none;opacity:0;transition:opacity .4s;z-index:30';
  document.body.appendChild(flowEl);
  let flowHide = 0;
  function setFlow(n) {
    if (n < 2) return;
    flowEl.textContent = n >= 3 ? 'FLOW FINISHER' : `Flow x${n}`;
    flowEl.style.opacity = '1'; clearTimeout(flowHide); flowHide = setTimeout(() => { flowEl.style.opacity = '0'; }, 1300);
  }
  // Quick buttons for touch and mouse: Roll, Ride and Shift (Ride and Shift appear once you own a steed).
  const qb = document.createElement('div');
  qb.id = 'flowbtns';
  qb.style.cssText = 'position:fixed;right:calc(12px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;z-index:25';
  const mk = (id, label, tip) => `<button data-q="${id}" title="${tip}" style="width:52px;height:52px;border-radius:50%;border:2px solid #c8a040;background:radial-gradient(#5a4632,#2a2018);color:#ffe9b0;font:700 12px sans-serif;opacity:.88">${label}</button>`;
  function setQuick(opts) {
    const html = mk('dodge', 'Roll', 'Dodge-roll (Space)') + (opts.ride ? mk('ride', opts.riding ? 'Off' : 'Ride', 'Ride or dismount (G)') : '') + (opts.shift ? mk('shift', 'Shift', 'Bulwark shift (F)') : '') + (opts.bonds ? mk('bonds', 'Bonds', 'Companions, standing, errands (B)') : '');
    if (qb._h !== html) { qb._h = html; qb.innerHTML = html; layoutQuick(); }
  }
  document.body.appendChild(qb);
  // Place the quick buttons in free space so they never cover the d-pad, action bar, side panel, minimap or chat.
  // Scans right edge then left edge, bottom-up (thumb reach), as a column then as a row. Hidden during dialogue.
  const OBST = ['#chat', '#sidePanel', '#minimapWrap', '#abilityBar', '#dpad', '#targetPanel', '#effects', '#xpTracker'];
  function layoutQuick() {
    const n = qb.children.length; if (!n) return;
    const dlgEl = document.getElementById('dialogue');
    if (dlgEl && dlgEl.style.display === 'flex') { qb.style.visibility = 'hidden'; return; }
    const W = innerWidth, H = innerHeight, B = 52, G = 8, M = 6;
    const rects = [];
    for (const sel of OBST) { const el = document.querySelector(sel); if (!el) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = el.getBoundingClientRect(); if (r.width * r.height > 1) rects.push(r); }
    const hit = (x, y, w, h) => x < 4 || y < 4 || x + w > W - 4 || y + h > H - 4 || rects.some(r => x < r.right + M && x + w > r.left - M && y < r.bottom + M && y + h > r.top - M);
    for (const dir of ['column', 'row']) {
      const w = dir === 'column' ? B : n * B + (n - 1) * G, h = dir === 'column' ? n * B + (n - 1) * G : B;
      const xs = [W - w - 10, 10]; for (let x = W - w - 16; x > 16; x -= 12) xs.push(x); // edges first, then sweep inwards from the right
      for (const x of xs) for (let y = H - h - 10; y >= 60; y -= 6) {
        if (!hit(x, y, w, h)) { qb.style.flexDirection = dir; qb.style.left = x + 'px'; qb.style.top = y + 'px'; qb.style.right = qb.style.bottom = 'auto'; qb.style.visibility = 'visible'; qb.dataset.fit = '1'; return; }
      }
    }
    qb.dataset.fit = '0'; qb.style.visibility = 'visible'; // no free spot: keep last position
  }
  addEventListener('resize', () => setTimeout(layoutQuick, 50));
  setInterval(layoutQuick, 400);

  let onQuick = null;
  qb.addEventListener('pointerdown', e => { const b = e.target.closest('[data-q]'); if (b && onQuick) { e.preventDefault(); e.stopPropagation(); onQuick(b.dataset.q); } });
  return {
    setFlow, setQuick, layoutQuick, set onQuick(f) { onQuick = f; },
    update, get adrenaline() { return adrenaline; },
    spend(n) { if (adrenaline + 1e-6 < n) return false; adrenaline = Math.max(0, adrenaline - n); lastFight = performance.now(); return true; },
    gain(n) { adrenaline = Math.min(100, adrenaline + n); lastFight = performance.now(); }
  };
}
