// Rebindable keyboard controls, saved in localStorage (separate from the game save).
const STORE = 'gielinor-keybinds';
export const KEY_ACTIONS = [
  ['walkN', 'Walk forward', 'w'], ['walkS', 'Walk back', 's'], ['walkW', 'Walk left', 'a'], ['walkE', 'Walk right', 'd'],
  ['camL', 'Turn camera left', 'arrowleft'], ['camR', 'Turn camera right', 'arrowright'], ['camU', 'Tilt camera up', 'arrowup'], ['camD', 'Tilt camera down', 'arrowdown'],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => [`ab${i}`, `Action bar slot ${i}`, String(i)]),
  ['tabInv', 'Open inventory', 'i'], ['tabEquip', 'Open equipment', 'e'], ['tabSkills', 'Open skills', 'k'], ['tabQuests', 'Open quests', 'q'],
  ['tabPrayer', 'Open prayer', 'p'], ['tabSettings', 'Open settings', 'o'], ['run', 'Toggle run', 'r'], ['dodge', 'Dodge-roll', ' '], ['ride', 'Ride or dismount steed', 'g'], ['shift', 'Steed shift (Bulwark)', 'f'], ['bonds', 'Open Bonds (companions, standing, errands)', 'b'], ['close', 'Close windows and menus', 'escape']
];
export const DEFAULT_BINDS = Object.fromEntries(KEY_ACTIONS.map(([id, , k]) => [id, k]));
let binds = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && typeof s === 'object') return { ...DEFAULT_BINDS, ...s }; } catch (e) { /* bad data */ }
  return { ...DEFAULT_BINDS };
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(binds)); } catch (e) { /* private mode */ } }
export function getBinds() { return binds; }
// Bind key to action. A key can only do one thing, so any other action using it is left unbound.
export function setBind(action, key) {
  for (const a in binds) if (binds[a] === key && a !== action) binds[a] = '';
  binds[action] = key; save();
}
export function resetBinds() { binds = { ...DEFAULT_BINDS }; save(); }
export function actionFor(key) { for (const a in binds) if (binds[a] === key) return a; return null; }
const NICE = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', ' ': 'Space', enter: 'Enter', tab: 'Tab', shift: 'Shift', control: 'Ctrl', alt: 'Alt' };
export function keyLabel(k) { return !k ? '—' : NICE[k] || (k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)); }
// While set, the next key press goes to this function instead of the game (used by Settings to rebind).
let capture = null;
export function captureNextKey(fn) { capture = fn || null; }
export function takeCapture(k) { if (!capture) return false; const f = capture; capture = null; f(k); return true; }
export function capturing() { return !!capture; }
