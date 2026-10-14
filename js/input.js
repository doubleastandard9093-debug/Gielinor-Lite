import { actionFor, takeCapture } from './keybinds.js';
// Touch, mouse and keyboard input for the game canvas.
// Tap = walk/act, long-press or right-click = options menu,
// one-finger drag = rotate camera, pinch or scroll = zoom.
export function setupInput(canvas, handlers) {
  const keys = {};
  const pointers = new Map();
  let longTimer = null;
  let dragging = false;
  let consumed = false;
  let pinchDist = 0;
  const DRAG_PX = 10;
  const LONG_MS = 480;

  // Movement and camera actions hold a key flag; everything else goes to handlers.onAction.
  const HOLD = { walkN: 'w', walkW: 'a', walkS: 's', walkE: 'd', camU: 'up', camD: 'down', camL: 'left', camR: 'right' };
  const held = new Map(); // physical key -> flag
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (takeCapture(k)) { e.preventDefault(); e.stopPropagation(); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const act = actionFor(k);
    if (act && HOLD[act]) {
      keys[HOLD[act]] = true; held.set(k, HOLD[act]);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      if (handlers.onKey && 'wasd'.includes(HOLD[act])) handlers.onKey(HOLD[act], e);
      return;
    }
    if (act === 'close' && handlers.onEscape) { handlers.onEscape(); return; }
    if (act && handlers.onAction && !e.repeat) handlers.onAction(act, e);
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    const f = held.get(k); if (f) { keys[f] = false; held.delete(k); }
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function clearLong() { if (longTimer) { clearTimeout(longTimer); longTimer = null; } }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, type: e.pointerType });
    handlers.onAnyPointer && handlers.onAnyPointer();
    if (pointers.size === 1) {
      dragging = false;
      consumed = false;
      if (e.pointerType === 'mouse' && e.button === 2) {
        consumed = true;
        handlers.onContext(e.clientX, e.clientY);
        return;
      }
      clearLong();
      if (e.pointerType !== 'mouse') {
        longTimer = setTimeout(() => {
          longTimer = null;
          if (!dragging && pointers.size === 1) { consumed = true; handlers.onContext(e.clientX, e.clientY); }
        }, LONG_MS);
      }
    } else if (pointers.size === 2) {
      clearLong();
      consumed = true;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) { handlers.onHover && handlers.onHover(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && d > 0) handlers.onZoom(pinchDist / d);
      pinchDist = d;
      return;
    }
    if (consumed && !dragging) return;
    if (!dragging && Math.hypot(p.x - p.sx, p.y - p.sy) > DRAG_PX) { dragging = true; clearLong(); }
    if (dragging) handlers.onRotate(-dx * 0.008, dy * 0.006);
  });

  function end(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    clearLong();
    if (pointers.size === 0) {
      if (!dragging && !consumed && !(p.type === 'mouse' && p.button !== 0)) handlers.onTap(p.sx, p.sy);
      dragging = false;
      consumed = false;
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { consumed = true; end(e); });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    handlers.onZoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  // Optional on-screen D-pad (turn on in Settings). Moves relative to the camera.
  const dpad = document.createElement('div');
  dpad.id = 'dpad';
  dpad.innerHTML = `
    <div></div><button data-k="w">▲</button><div></div>
    <button data-k="a">◀</button><div></div><button data-k="d">▶</button>
    <div></div><button data-k="s">▼</button><div></div>`;
  document.body.appendChild(dpad);
  dpad.querySelectorAll('button').forEach(btn => {
    const k = btn.dataset.k;
    const on = e => { e.preventDefault(); keys[k] = true; handlers.onAnyPointer && handlers.onAnyPointer(); handlers.onDpad && handlers.onDpad(); };
    const off = () => { keys[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  });

  return {
    keys,
    setDpadVisible(v) { dpad.style.display = v ? 'grid' : 'none'; document.body.classList.toggle('dpad-on', !!v); }
  };
}
