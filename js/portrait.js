// Painted dialogue portraits: a bust drawn on canvas, seeded from the speaker's name so each person looks the same every time.
const cache = new Map();
function rng(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const SKINS = ['#f2d0b0', '#e8b890', '#d09a70', '#b07850', '#8a5a3a', '#6a4028'];
const HAIR = ['#2a1a10', '#4a2a14', '#7a4a20', '#c08a40', '#e0c070', '#8a8a8a', '#d8d8d8', '#8a2a14'];
const CLOTH = ['#7a1a1a', '#1a3a7a', '#2a5a2a', '#5a3a1a', '#4a2a5a', '#7a6a2a', '#2a2a2a', '#8a8a9a'];
export function portraitURL(name, opts = {}) {
  const key = name + '|' + (opts.kind || '');
  if (cache.has(key)) return cache.get(key);
  const R = rng(name), S = 96;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const low = name.toLowerCase();
  const goblin = /goblin/.test(low), skeleton = /skeleton/.test(low), dwarf = /doric|dwarf|thurgo/.test(low);
  const female = opts.female != null ? opts.female : /(woman|lady|queen|wife|girl|mrs|betty|rhea|anja|sarah|alice|ellie|emma|ella|nan|mother|sister|duchess|aggie|hetty|hilda|grace)/.test(low);
  const skin = goblin ? '#6a9a3a' : skeleton ? '#e8e0c8' : SKINS[(R() * SKINS.length) | 0];
  const hair = HAIR[(R() * HAIR.length) | 0], cloth = opts.cloth || CLOTH[(R() * CLOTH.length) | 0];
  // backdrop
  const bg = c.createRadialGradient(S * .5, S * .4, 4, S * .5, S * .5, S * .7); bg.addColorStop(0, '#5a5040'); bg.addColorStop(1, '#16130e');
  c.fillStyle = bg; c.fillRect(0, 0, S, S);
  // shoulders
  c.beginPath(); c.moveTo(8, S); c.quadraticCurveTo(12, 66, 48, 64); c.quadraticCurveTo(84, 66, 88, S); c.closePath();
  const cg = c.createLinearGradient(0, 62, 0, S); cg.addColorStop(0, cloth); cg.addColorStop(1, '#000'); c.fillStyle = cg; c.fill();
  c.beginPath(); c.moveTo(38, 64); c.lineTo(48, 78); c.lineTo(58, 64); c.fillStyle = skin; c.fill();
  // neck + head
  c.fillStyle = skin; c.fillRect(41, 52, 14, 14);
  const hg = c.createRadialGradient(42, 34, 3, 48, 40, 24); hg.addColorStop(0, '#fff3'); hg.addColorStop(0.3, skin); hg.addColorStop(1, '#0006');
  c.beginPath(); c.ellipse(48, 40, goblin ? 19 : 16, 20, 0, 0, 7); c.fillStyle = skin; c.fill(); c.fillStyle = hg; c.fill();
  if (goblin) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(48 + s * 17, 36); c.lineTo(48 + s * 32, 26); c.lineTo(48 + s * 18, 46); c.fillStyle = skin; c.fill(); } }
  else if (!skeleton) { for (const s of [-1, 1]) { c.beginPath(); c.ellipse(48 + s * 16, 42, 3, 5, 0, 0, 7); c.fillStyle = skin; c.fill(); } }
  // hair
  if (!goblin && !skeleton) {
    c.fillStyle = hair; c.beginPath();
    if (female) { c.moveTo(28, 64); c.quadraticCurveTo(24, 16, 48, 16); c.quadraticCurveTo(72, 16, 68, 64); c.lineTo(62, 64); c.quadraticCurveTo(64, 30, 48, 26); c.quadraticCurveTo(32, 30, 34, 64); }
    else if (R() < 0.2) { c.ellipse(48, 24, 12, 4, 0, 0, 7); }
    else { c.moveTo(31, 40); c.quadraticCurveTo(28, 16, 48, 17); c.quadraticCurveTo(68, 16, 65, 40); c.quadraticCurveTo(60, 26, 48, 27); c.quadraticCurveTo(36, 26, 31, 40); }
    c.fill();
    if (!female && (dwarf || R() < 0.35)) { c.beginPath(); c.moveTo(34, 46); c.quadraticCurveTo(48, dwarf ? 82 : 66, 62, 46); c.quadraticCurveTo(48, 54, 34, 46); c.fill(); }
  }
  // eyes, brows, nose, mouth
  for (const s of [-1, 1]) {
    if (skeleton) { c.beginPath(); c.ellipse(48 + s * 7, 38, 4.5, 5, 0, 0, 7); c.fillStyle = '#1a1208'; c.fill(); continue; }
    c.beginPath(); c.ellipse(48 + s * 7, 38, 3.4, 2.2, 0, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(48 + s * 7, 38, 1.5, 0, 7); c.fillStyle = goblin ? '#d02a1a' : ['#3a6a9a', '#5a3a1a', '#2a5a2a', '#2a1a10'][(R() * 4) | 0]; c.fill();
    c.beginPath(); c.moveTo(48 + s * 3, 33.5); c.lineTo(48 + s * 11, goblin ? 31 : 33); c.lineWidth = 1.8; c.strokeStyle = goblin ? '#2a3a1a' : hair; c.stroke();
  }
  c.beginPath(); c.moveTo(48, 39); c.lineTo(46, 47); c.lineTo(49.5, 47.5); c.lineWidth = 1.2; c.strokeStyle = '#0005'; c.stroke();
  c.beginPath(); c.moveTo(43, 52); c.quadraticCurveTo(48, opts.mood === 'angry' ? 50 : 55, 53, 52); c.lineWidth = 1.6; c.strokeStyle = skeleton ? '#1a1208' : '#6a2a20'; c.stroke();
  // rim light and vignette
  const vg = c.createRadialGradient(S / 2, S / 2, S * .3, S / 2, S / 2, S * .72); vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); c.fillStyle = vg; c.fillRect(0, 0, S, S);
  const u = cv.toDataURL('image/png'); cache.set(key, u); return u;
}
