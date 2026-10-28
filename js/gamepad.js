// Xbox / standard gamepad (Bluetooth or USB) via the Gamepad API, for both the WebGL and WebGPU builds.
// Idle cost: a 1 s probe until a pad appears; then one rAF poll per frame.
const BT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const SKEY = 'gielinor-pad';
export const pad = { connected: false, active: false, id: '', sens: 1, invertY: false, dz: 0.18, rumbleOn: true };
try { Object.assign(pad, JSON.parse(localStorage.getItem(SKEY) || '{}')); pad.connected = pad.active = false; } catch (e) {}
export function savePad() { try { localStorage.setItem(SKEY, JSON.stringify({ sens: pad.sens, invertY: pad.invertY, dz: pad.dz, rumbleOn: pad.rumbleOn })); } catch (e) {} }
export const PAD_LEGEND = 'Left stick walk · Right stick camera · LT/RT zoom out/in (hold LB: RT = True Aim) · A interact/talk/gather nearest · X attack nearest enemy · B dodge-roll (closes menus) · Y options for nearest · D-pad action bar 1–4, hold LB for 5–8 · RB Stillwatch · L3 toggle run · R3 ride/dismount · View world map · Start opens the side panel on Inventory (hold: Settings) · in menus/panel: D-pad or left stick move, A select, LB/RB switch tab, B back.';
const pads = () => { try { return Array.from(navigator.getGamepads?.() || []).filter(Boolean); } catch (e) { return []; } };
let gp = null, prev = [], loop = false, last = 0, startT = 0;
export function rumble(s = 0.5, w = 0.3, ms = 80) { if (!pad.rumbleOn || !pad.active || !gp) return; try { gp.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: w })?.catch?.(() => {}); } catch (e) {} }
const MENUS = ['#ctxMenu', '#dialogue', '#bonds', '#window'];
const vis = e => e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
function menuRoot() { if (pad.panel) { const sp = document.querySelector('#sidePanel'); if (vis(sp) && !sp.classList.contains('collapsed')) return sp; pad.panel = false; } for (const s of MENUS) { const e = document.querySelector(s); if (vis(e) && e.querySelector('button,[data-i],.opt,li,a')) return e; } return null; }
function nav(root, dir) {
  const els = [...root.querySelectorAll('button:not([disabled]),[data-i],li,a,.opt,input,select,[onclick]')].filter(vis); if (!els.length) return;
  els.forEach(e => { if (e.tabIndex < 0) e.tabIndex = 0; });
  let i = els.indexOf(document.activeElement); const cur = els[i];
  if (dir === 'ok') { (cur || els[0]).click(); return; }
  if (i < 0) { els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2; let best = null, bd = 1e9;
  for (const e of els) { if (e === cur) continue; const q = e.getBoundingClientRect(), dx = q.x + q.width / 2 - cx, dy = q.y + q.height / 2 - cy;
    if (!(dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4)) continue;
    const d = dir === 'up' || dir === 'down' ? Math.abs(dy) + 2 * Math.abs(dx) : Math.abs(dx) + 2 * Math.abs(dy); if (d < bd) { bd = d; best = e; } }
  (best || els[(i + (dir === 'down' || dir === 'right' ? 1 : els.length - 1)) % els.length]).focus();
}
export function setupGamepad(keys, h) {
  const toast = m => (h.toast || console.log)(m);
  const setActive = on => { if (pad.active === on) return; pad.active = on; document.body.classList.toggle('pad', on); };
  const connect = g => { if (pad.connected) return; pad.connected = true; pad.id = g.id; setActive(true); toast('🎮 Controller connected'); if (!loop) { loop = true; last = performance.now(); requestAnimationFrame(tick); } };
  addEventListener('gamepadconnected', e => connect(e.gamepad));
  addEventListener('gamepaddisconnected', () => { if (!pads().length) { pad.connected = false; setActive(false); for (const k of 'wasd') keys[k] = false; toast('Controller disconnected'); } });
  addEventListener('touchstart', () => setActive(false), { passive: true, capture: true });
  setInterval(() => { if (!pad.connected) { const g = pads()[0]; if (g) connect(g); } }, 1000);
  function tick(now) { if (!pad.connected) { loop = false; return; } requestAnimationFrame(tick); const dt = Math.min(0.05, (now - last) / 1000); last = now; poll(dt, now); }
  function poll(dt, now) {
    gp = pads()[0]; if (!gp) return; const g = gp;
    const cur = g.buttons.map(b => !!b && (b.pressed || b.value > 0.5)), dn = i => cur[i] && !prev[i], up = i => !cur[i] && prev[i], val = i => g.buttons[i]?.value || 0;
    const dz = (x, y) => { const m = Math.hypot(x, y); if (m < pad.dz) return [0, 0]; const s = Math.min(1, (m - pad.dz) / (1 - pad.dz)) / m; return [x * s, y * s]; };
    const [lx, ly] = dz(g.axes[0] || 0, g.axes[1] || 0), [rx, ry] = dz(g.axes[2] || 0, g.axes[3] || 0);
    if (cur.some(Boolean) || lx || ly || rx || ry) setActive(true);
    const menu = menuRoot();
    if (menu) {
      for (const k of 'wasd') if (pad.held?.[k]) { keys[k] = false; pad.held[k] = false; }
      const sy = Math.abs(ly) > 0.6 ? Math.sign(ly) : 0, sx = Math.abs(lx) > 0.6 ? Math.sign(lx) : 0;
      if ((sx || sy) && now - (pad.st || 0) > 220) { pad.st = now; nav(menu, sy ? (sy > 0 ? 'down' : 'up') : (sx > 0 ? 'right' : 'left')); }
      if (dn(BT.UP)) nav(menu, 'up'); if (dn(BT.DOWN)) nav(menu, 'down'); if (dn(BT.LEFT)) nav(menu, 'left'); if (dn(BT.RIGHT)) nav(menu, 'right');
      if (dn(BT.A)) nav(menu, 'ok');
      if (menu.id === 'sidePanel') { const tabs = [...document.querySelectorAll('[data-tab]')].filter(vis), ti = tabs.findIndex(t => t.classList.contains('on'));
        if (tabs.length && (dn(BT.LB) || dn(BT.RB))) tabs[(ti + (dn(BT.RB) ? 1 : tabs.length - 1)) % tabs.length].click();
        if (dn(BT.B) || dn(BT.START)) { pad.panel = false; document.activeElement?.blur?.(); } }
      else if (dn(BT.B) || dn(BT.START)) h.onEscape?.();
      prev = cur; return;
    }
    // walk: left stick -> WASD flags (8-way), only touch flags the pad owns so the keyboard still works
    pad.held = pad.held || {}; const want = { w: ly < -0.35, s: ly > 0.35, a: lx < -0.35, d: lx > 0.35 };
    for (const k in want) if (want[k] !== !!pad.held[k]) { pad.held[k] = want[k]; keys[k] = want[k]; if (want[k]) h.onKey?.(k); }
    if (rx || ry) h.onRotate?.(-rx * Math.abs(rx) * 2.6 * pad.sens * dt, ry * Math.abs(ry) * 1.6 * pad.sens * dt * (pad.invertY ? -1 : 1));
    const lb = cur[BT.LB];
    if (val(BT.LT) > 0.2) h.onZoom?.(1 + val(BT.LT) * 1.5 * dt);
    if (lb && dn(BT.RT)) h.onAction?.('aim'); else if (!lb && val(BT.RT) > 0.2) h.onZoom?.(1 / (1 + val(BT.RT) * 1.5 * dt));
    if (dn(BT.A)) h.onInteract?.('any'); if (dn(BT.X)) { h.onInteract?.('attack'); rumble(0.3, 0.2, 50); }
    if (dn(BT.B)) { h.onAction?.('dodge'); rumble(0.2, 0.4, 90); } if (dn(BT.Y)) h.onOptions?.();
    const off = lb ? 4 : 0; [BT.UP, BT.RIGHT, BT.DOWN, BT.LEFT].forEach((b, i) => { if (dn(b)) h.onAction?.('ab' + (i + 1 + off)); });
    if (dn(BT.RB)) h.onAction?.('stillwatch'); if (dn(BT.L3)) h.onAction?.('run'); if (dn(BT.R3)) h.onAction?.('ride');
    if (dn(BT.BACK)) h.onAction?.('map');
    if (dn(BT.START)) startT = now; if (cur[BT.START] && startT && now - startT > 500) { h.onAction?.('tabSettings'); pad.panel = true; startT = 0; } if (up(BT.START) && startT) { h.onAction?.('tabInv'); pad.panel = true; startT = 0; }
    prev = cur;
  }
  return pad;
}
