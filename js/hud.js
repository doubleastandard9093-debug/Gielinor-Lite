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
  return { update, get adrenaline() { return adrenaline; } };
}
