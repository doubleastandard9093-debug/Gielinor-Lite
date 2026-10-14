// Procedural item icons: every item is painted on a small canvas (original art, no image files).
// The shape comes from the item category; colour comes from its metal, wood, rune, potion or rarity.
import { ITEMS, METAL_TINT, WOODS, RUNES, POTION_RECIPES, iconFor } from './items.js';

const S = 64;
const cache = new Map();
const WOOD_COL = ['#9a6a3a', '#c49a5a', '#8aa05a', '#c8702a', '#5a7a3a', '#4a6ad8'];
const GEM = { sapphire: '#3a5aff', emerald: '#2ad060', ruby: '#ff2a4a', diamond: '#e8f4ff' };

function shade(hex, f) {
  const n = parseInt(hex.slice(1, 7), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function metalFill(c, base, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(base, 0.65)); g.addColorStop(0.35, shade(base, 0.15)); g.addColorStop(0.55, shade(base, -0.25)); g.addColorStop(0.8, shade(base, 0.05)); g.addColorStop(1, shade(base, -0.5));
  return g;
}
function radial(c, base, x, y, r) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(base, 0.6)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.55));
  return g;
}
function finish(c, fill) { c.fillStyle = fill; c.fill(); c.lineWidth = 2.2; c.strokeStyle = 'rgba(0,0,0,.85)'; c.stroke(); }
function path(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
function hilite(c, x0, y0, x1, y1, a = 0.55) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = 1.6; c.strokeStyle = `rgba(255,255,255,${a})`; c.stroke(); }
const WOODHANDLE = '#6a4320';

// ---------- shapes ----------
function sword(c, m, long) {
  c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4);
  const L = long ? 26 : 22;
  path(c, [-4, 8, -4, -L, 0, -L - 6, 4, -L, 4, 8]); finish(c, metalFill(c, m, -4, 0, 4, 0)); hilite(c, 0, -L - 2, 0, 6, 0.6);
  c.beginPath(); c.roundRect(-11, 8, 22, 5, 2); finish(c, metalFill(c, '#c8a040', 0, 8, 0, 13));
  c.beginPath(); c.roundRect(-2.5, 13, 5, 11, 1.5); finish(c, WOODHANDLE);
  c.beginPath(); c.arc(0, 27, 3.6, 0, 7); finish(c, radial(c, '#d8b050', 0, 27, 4));
  c.restore();
}
function dagger(c, m) {
  c.save(); c.translate(32, 34); c.rotate(-Math.PI / 4);
  path(c, [-4, 4, -3, -16, 0, -22, 3, -16, 4, 4]); finish(c, metalFill(c, m, -4, 0, 4, 0)); hilite(c, 0, -18, 0, 3);
  c.beginPath(); c.roundRect(-8, 4, 16, 4, 2); finish(c, '#3a3a3a');
  c.beginPath(); c.roundRect(-2.5, 8, 5, 10, 1.5); finish(c, '#4a2a1a'); c.restore();
}
function axe(c, m, pick) {
  c.save(); c.translate(32, 32); c.rotate(-Math.PI / 5);
  c.beginPath(); c.roundRect(-2.6, -22, 5.2, 46, 2); finish(c, WOODHANDLE); hilite(c, -1, -20, -1, 22, 0.25);
  if (pick) { c.beginPath(); c.moveTo(-24, -10); c.quadraticCurveTo(0, -26, 24, -10); c.lineTo(20, -8); c.quadraticCurveTo(0, -18, -20, -8); c.closePath(); finish(c, metalFill(c, m, 0, -24, 0, -8)); }
  else { c.beginPath(); c.moveTo(2, -20); c.quadraticCurveTo(22, -24, 22, -10); c.quadraticCurveTo(22, 2, 2, -2); c.closePath(); finish(c, metalFill(c, m, 2, -20, 22, -2)); hilite(c, 20, -18, 20, -4); }
  c.restore();
}
function helm(c, m, kind) {
  if (kind === 'hat') { path(c, [32, 6, 46, 40, 18, 40]); finish(c, radial(c, m, 32, 26, 22)); c.beginPath(); c.ellipse(32, 44, 22, 6, 0, 0, 7); finish(c, shade(m, -0.2)); c.beginPath(); c.arc(36, 22, 2.5, 0, 7); c.fillStyle = '#ffe680'; c.fill(); return; }
  if (kind === 'cowl') { c.beginPath(); c.moveTo(14, 50); c.quadraticCurveTo(10, 10, 32, 10); c.quadraticCurveTo(54, 10, 50, 50); c.quadraticCurveTo(32, 40, 14, 50); finish(c, radial(c, m, 32, 28, 26)); c.beginPath(); c.ellipse(32, 36, 10, 11, 0, 0, 7); c.fillStyle = '#1a120a'; c.fill(); return; }
  c.beginPath(); c.moveTo(14, 52); c.lineTo(14, 26); c.quadraticCurveTo(14, 8, 32, 8); c.quadraticCurveTo(50, 8, 50, 26); c.lineTo(50, 52); c.lineTo(38, 52); c.lineTo(38, 34); c.lineTo(26, 34); c.lineTo(26, 52); c.closePath();
  finish(c, metalFill(c, m, 14, 10, 50, 52));
  c.fillStyle = '#0a0a0a'; c.fillRect(19, 26, 26, 4); hilite(c, 20, 14, 30, 11, 0.6);
  c.beginPath(); c.moveTo(32, 8); c.lineTo(32, 26); c.lineWidth = 2; c.strokeStyle = shade(m, -0.4); c.stroke();
}
function body(c, m, kind) {
  c.beginPath(); c.moveTo(20, 10); c.lineTo(8, 18); c.lineTo(10, 36); c.lineTo(17, 34); c.lineTo(18, 56); c.lineTo(46, 56); c.lineTo(47, 34); c.lineTo(54, 36); c.lineTo(56, 18); c.lineTo(44, 10); c.quadraticCurveTo(32, 18, 20, 10); c.closePath();
  finish(c, kind === 'plate' ? metalFill(c, m, 8, 10, 56, 56) : radial(c, m, 32, 30, 30));
  if (kind === 'plate') { c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 54); c.strokeStyle = shade(m, -0.45); c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.moveTo(20, 30); c.quadraticCurveTo(32, 36, 44, 30); c.stroke(); hilite(c, 22, 16, 26, 40, 0.5); }
  else if (kind === 'robe') { c.fillStyle = '#ffe680'; c.fillRect(30, 18, 4, 38); c.fillRect(18, 52, 28, 3); }
  else { c.strokeStyle = 'rgba(0,0,0,.35)'; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 55); c.stroke(); c.setLineDash([]); }
}
function legs(c, m, kind) {
  c.beginPath(); c.moveTo(18, 8); c.lineTo(46, 8); c.lineTo(50, 58); c.lineTo(36, 58); c.lineTo(32, 26); c.lineTo(28, 58); c.lineTo(14, 58); c.closePath();
  finish(c, kind === 'plate' ? metalFill(c, m, 14, 0, 50, 0) : radial(c, m, 32, 30, 30));
  c.fillStyle = kind === 'plate' ? shade(m, -0.4) : '#3a2410'; c.fillRect(18, 8, 28, 5);
  if (kind === 'plate') { hilite(c, 20, 16, 18, 54); hilite(c, 44, 16, 46, 54, 0.3); }
}
function shield(c, m, wood) {
  c.beginPath(); c.moveTo(32, 6); c.quadraticCurveTo(50, 12, 54, 12); c.quadraticCurveTo(56, 44, 32, 58); c.quadraticCurveTo(8, 44, 10, 12); c.quadraticCurveTo(14, 12, 32, 6); c.closePath();
  finish(c, wood ? radial(c, m, 32, 30, 28) : metalFill(c, m, 10, 6, 54, 58));
  if (wood) { c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; for (const x of [20, 32, 44]) { c.beginPath(); c.moveTo(x, 10); c.lineTo(x, 52); c.stroke(); } }
  c.beginPath(); c.moveTo(32, 12); c.quadraticCurveTo(46, 16, 48, 17); c.quadraticCurveTo(49, 42, 32, 52); c.quadraticCurveTo(15, 42, 16, 17); c.quadraticCurveTo(18, 16, 32, 12); c.lineWidth = 2; c.strokeStyle = wood ? '#8a8a8a' : shade(m, 0.4); c.stroke();
  c.beginPath(); c.arc(32, 30, 5, 0, 7); finish(c, radial(c, '#d8b050', 32, 30, 5));
}
function bow(c, wcol, cross, m) {
  if (cross) {
    c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4);
    c.beginPath(); c.roundRect(-3, -22, 6, 44, 2); finish(c, wcol);
    c.beginPath(); c.moveTo(-22, -10); c.quadraticCurveTo(0, -20, 22, -10); c.lineWidth = 5; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 3; c.strokeStyle = metalFill(c, m, -22, 0, 22, 0); c.stroke();
    c.beginPath(); c.moveTo(-21, -10); c.lineTo(0, 2); c.lineTo(21, -10); c.lineWidth = 1; c.strokeStyle = '#eee'; c.stroke(); c.restore(); return;
  }
  c.beginPath(); c.moveTo(18, 8); c.quadraticCurveTo(58, 32, 18, 56); c.lineWidth = 7; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = wcol; c.stroke();
  c.beginPath(); c.moveTo(18, 8); c.lineTo(18, 56); c.lineWidth = 1.2; c.strokeStyle = '#f0f0e0'; c.stroke();
  c.beginPath(); c.roundRect(33, 28, 6, 9, 2); finish(c, '#5a3a1a');
}
function arrows(c, m, bolts) {
  for (const [dx, dy] of [[-7, 4], [0, 0], [7, -4]]) {
    c.save(); c.translate(32 + dx, 32 + dy); c.rotate(-Math.PI / 4);
    c.beginPath(); c.moveTo(0, bolts ? 14 : 22); c.lineTo(0, -18); c.lineWidth = 3.2; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 1.8; c.strokeStyle = '#a0784a'; c.stroke();
    path(c, bolts ? [-3, -16, 0, -22, 3, -16] : [-4, -16, 0, -25, 4, -16]); finish(c, metalFill(c, m, -4, 0, 4, 0));
    path(c, [0, bolts ? 10 : 16, -4, bolts ? 16 : 23, 0, bolts ? 14 : 20, 4, bolts ? 16 : 23]); finish(c, bolts ? '#888' : '#e8e0d0');
    c.restore();
  }
}
function bar(c, m) {
  path(c, [10, 40, 20, 26, 54, 26, 44, 40]); finish(c, shade(m, 0.35));
  path(c, [10, 40, 44, 40, 44, 50, 10, 50]); finish(c, metalFill(c, m, 0, 40, 0, 50));
  path(c, [44, 40, 54, 26, 54, 36, 44, 50]); finish(c, shade(m, -0.4)); hilite(c, 22, 29, 48, 29, 0.7);
}
function ore(c, m, coal) {
  c.beginPath(); c.moveTo(12, 42); c.lineTo(16, 22); c.lineTo(30, 12); c.lineTo(48, 18); c.lineTo(54, 36); c.lineTo(44, 52); c.lineTo(22, 54); c.closePath();
  finish(c, radial(c, coal ? '#2a2a2a' : '#6a625a', 32, 32, 26));
  const flecks = coal ? '#111' : m;
  for (const [x, y, r] of [[24, 26, 4], [38, 24, 3], [34, 38, 5], [22, 42, 3], [44, 36, 3]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = radial(c, flecks, x, y, r); c.fill(); }
  if (coal) { hilite(c, 20, 22, 30, 15, 0.35); }
}
function logs(c, w) {
  for (const [y, x] of [[40, 8], [26, 14]]) {
    c.beginPath(); c.roundRect(x, y, 40, 14, 7); finish(c, (() => { const g = c.createLinearGradient(0, y, 0, y + 14); g.addColorStop(0, shade(w, 0.25)); g.addColorStop(1, shade(w, -0.45)); return g; })());
    c.beginPath(); c.ellipse(x + 40, y + 7, 5, 7, 0, 0, 7); finish(c, '#e8c890');
    c.beginPath(); c.ellipse(x + 40, y + 7, 2, 3.5, 0, 0, 7); c.strokeStyle = '#8a6030'; c.lineWidth = 1; c.stroke();
  }
}
function fish(c, col, cooked) {
  c.beginPath(); c.moveTo(8, 32); c.quadraticCurveTo(26, 12, 46, 30); c.lineTo(58, 20); c.lineTo(56, 44); c.lineTo(46, 34); c.quadraticCurveTo(26, 52, 8, 32); c.closePath();
  finish(c, radial(c, cooked ? '#c08a40' : col, 28, 30, 24));
  c.beginPath(); c.arc(16, 29, 2.4, 0, 7); c.fillStyle = cooked ? '#3a2208' : '#111'; c.fill();
  if (cooked) { c.strokeStyle = 'rgba(70,30,0,.6)'; c.lineWidth = 2; for (const x of [22, 30, 38]) { c.beginPath(); c.moveTo(x, 24); c.lineTo(x - 4, 38); c.stroke(); } }
  else hilite(c, 18, 24, 38, 24, 0.45);
}
function crustacean(c, cooked) {
  const col = cooked ? '#e04a2a' : '#3a5a7a';
  c.beginPath(); c.ellipse(32, 36, 9, 16, 0, 0, 7); finish(c, radial(c, col, 32, 34, 16));
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(32 + s * 14, 16, 6, 9, s * 0.4, 0, 7); finish(c, radial(c, col, 32 + s * 14, 16, 9)); }
}
function meat(c, cooked) {
  c.beginPath(); c.ellipse(28, 34, 18, 14, -0.3, 0, 7); finish(c, radial(c, cooked ? '#8a4a1a' : '#d04a4a', 28, 32, 18));
  c.beginPath(); c.roundRect(40, 18, 6, 18, 3); c.save(); c.translate(0, 0); finish(c, '#f0e8d0'); c.restore();
  c.beginPath(); c.arc(46, 18, 4, 0, 7); finish(c, '#f0e8d0');
}
function bowl(c, col) {
  c.beginPath(); c.ellipse(32, 30, 22, 7, 0, 0, 7); finish(c, radial(c, col, 32, 28, 20));
  c.beginPath(); c.moveTo(10, 30); c.quadraticCurveTo(12, 52, 32, 52); c.quadraticCurveTo(52, 52, 54, 30); c.closePath(); finish(c, radial(c, '#8a5a2a', 32, 40, 24));
  for (const x of [24, 32, 40]) { c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + 4, 14, x, 8); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.stroke(); }
}
function potion(c, col) {
  c.beginPath(); c.moveTo(26, 8); c.lineTo(38, 8); c.lineTo(38, 22); c.quadraticCurveTo(52, 28, 50, 44); c.quadraticCurveTo(48, 58, 32, 58); c.quadraticCurveTo(16, 58, 14, 44); c.quadraticCurveTo(12, 28, 26, 22); c.closePath();
  finish(c, 'rgba(200,230,255,.25)');
  if (col) { c.save(); c.clip(); c.beginPath(); c.rect(0, 32, 64, 32); c.fillStyle = radial(c, col, 30, 44, 20); c.fill(); c.restore(); }
  c.beginPath(); c.roundRect(25, 4, 14, 7, 2); finish(c, '#9a6a3a'); hilite(c, 20, 34, 22, 48, 0.7);
}
function rune(c, col, letter) {
  c.beginPath(); c.moveTo(14, 20); c.quadraticCurveTo(18, 8, 32, 8); c.quadraticCurveTo(48, 8, 52, 22); c.lineTo(54, 42); c.quadraticCurveTo(46, 56, 32, 56); c.quadraticCurveTo(14, 56, 10, 42); c.closePath();
  finish(c, radial(c, '#b8b0a8', 32, 30, 26));
  c.font = 'bold 26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 8; c.fillStyle = col; c.fillText(letter, 32, 33); c.shadowBlur = 0;
}
function bones(c, col) {
  c.save(); c.translate(32, 32); c.rotate(-0.6);
  c.beginPath(); c.roundRect(-18, -4, 36, 8, 3); finish(c, col);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); c.arc(sx * 20, sy * 5, 5.5, 0, 7); finish(c, col); }
  c.beginPath(); c.roundRect(-18, -4, 36, 8, 3); c.fillStyle = col; c.fill(); c.restore();
}
function herb(c, col, grimy) {
  for (const [a, l] of [[-0.6, 20], [0, 24], [0.6, 20], [-1.1, 14], [1.1, 14]]) {
    c.save(); c.translate(32, 54); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-8, -l, 0, -l * 1.9); c.quadraticCurveTo(8, -l, 0, 0); finish(c, radial(c, grimy ? '#6a6a2a' : col, 0, -l, l)); c.restore();
  }
}
function cape(c, col, trim) {
  c.beginPath(); c.moveTo(20, 8); c.lineTo(44, 8); c.quadraticCurveTo(52, 34, 54, 58); c.quadraticCurveTo(32, 52, 10, 58); c.quadraticCurveTo(12, 34, 20, 8); c.closePath(); finish(c, radial(c, col, 30, 26, 32));
  c.beginPath(); c.moveTo(20, 8); c.lineTo(44, 8); c.lineWidth = 4; c.strokeStyle = trim || '#d8b050'; c.stroke();
  if (trim) { c.beginPath(); c.moveTo(12, 56); c.quadraticCurveTo(32, 50, 52, 56); c.lineWidth = 3; c.stroke(); }
}
function ring(c, col) {
  c.beginPath(); c.ellipse(32, 38, 16, 12, 0, 0, 7); c.lineWidth = 8; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 5; c.strokeStyle = metalFill(c, '#d8b050', 16, 30, 48, 50); c.stroke();
  c.beginPath(); c.moveTo(32, 14); c.lineTo(40, 22); c.lineTo(32, 30); c.lineTo(24, 22); c.closePath(); finish(c, radial(c, col, 32, 22, 9));
}
function amulet(c, col) {
  c.beginPath(); c.moveTo(14, 8); c.quadraticCurveTo(14, 38, 32, 40); c.quadraticCurveTo(50, 38, 50, 8); c.lineWidth = 2.5; c.strokeStyle = '#c8a040'; c.stroke();
  c.beginPath(); c.arc(32, 46, 10, 0, 7); finish(c, metalFill(c, '#d8b050', 22, 36, 42, 56));
  c.beginPath(); c.arc(32, 46, 6, 0, 7); finish(c, radial(c, col, 32, 46, 6));
}
function staff(c, col, orb) {
  c.save(); c.translate(32, 32); c.rotate(Math.PI / 5);
  c.beginPath(); c.roundRect(-2.6, -18, 5.2, 46, 2); finish(c, WOODHANDLE);
  c.restore();
  if (orb) { c.beginPath(); c.arc(22, 16, 7, 0, 7); c.shadowColor = col; c.shadowBlur = 10; finish(c, radial(c, col, 22, 16, 8)); c.shadowBlur = 0; }
}
function gem(c, col, uncut) {
  if (uncut) { c.beginPath(); c.moveTo(18, 30); c.lineTo(28, 14); c.lineTo(46, 18); c.lineTo(50, 38); c.lineTo(36, 52); c.lineTo(20, 46); c.closePath(); finish(c, radial(c, shade(col, -0.3), 32, 32, 22)); return; }
  path(c, [14, 26, 24, 14, 40, 14, 50, 26, 32, 54]); finish(c, radial(c, col, 32, 28, 26));
  c.beginPath(); c.moveTo(14, 26); c.lineTo(50, 26); c.moveTo(24, 14); c.lineTo(32, 26); c.lineTo(40, 14); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.stroke();
}
function hide(c, col) { c.beginPath(); c.moveTo(12, 14); c.quadraticCurveTo(32, 20, 52, 12); c.quadraticCurveTo(46, 32, 54, 52); c.quadraticCurveTo(32, 44, 10, 52); c.quadraticCurveTo(18, 32, 12, 14); finish(c, radial(c, col, 32, 32, 26)); }
function feather(c) { c.beginPath(); c.moveTo(14, 54); c.quadraticCurveTo(20, 18, 50, 8); c.quadraticCurveTo(44, 36, 14, 54); finish(c, radial(c, '#f4f0e8', 32, 30, 26)); c.beginPath(); c.moveTo(12, 56); c.quadraticCurveTo(30, 30, 48, 10); c.strokeStyle = '#8a8070'; c.lineWidth = 1.2; c.stroke(); }
function coil(c, col) { for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(32, 32, 18 - i * 4, 14 - i * 3, 0.3, 0, 7); c.lineWidth = 3; c.strokeStyle = col; c.stroke(); } }
function hammer(c) { c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4); c.beginPath(); c.roundRect(-2.5, -8, 5, 32, 2); finish(c, WOODHANDLE); c.beginPath(); c.roundRect(-12, -18, 24, 11, 2); finish(c, metalFill(c, '#8a8a8a', 0, -18, 0, -7)); c.restore(); }
function vial(c) { potion(c, null); }
function net(c) {
  c.beginPath(); c.roundRect(29, 34, 5, 26, 2); finish(c, WOODHANDLE);
  c.beginPath(); c.ellipse(32, 22, 20, 15, 0, 0, 7); c.lineWidth = 5; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#8a6a3a'; c.stroke();
  c.save(); c.beginPath(); c.ellipse(32, 22, 18, 13, 0, 0, 7); c.clip(); c.strokeStyle = 'rgba(240,235,215,.85)'; c.lineWidth = 1;
  for (let i = -20; i <= 20; i += 5) { c.beginPath(); c.moveTo(32 + i, 4); c.lineTo(32 + i + 14, 40); c.stroke(); c.beginPath(); c.moveTo(32 + i, 4); c.lineTo(32 + i - 14, 40); c.stroke(); }
  c.restore();
}
function rod(c) {
  c.beginPath(); c.moveTo(12, 58); c.lineTo(54, 6); c.lineWidth = 5; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#a07040'; c.stroke();
  c.beginPath(); c.roundRect(10, 46, 9, 12, 2); c.save(); c.translate(0, 0); finish(c, '#3a2410'); c.restore();
  c.beginPath(); c.arc(22, 44, 5, 0, 7); finish(c, metalFill(c, '#b0b0b8', 17, 39, 27, 49));
  c.beginPath(); c.moveTo(54, 6); c.quadraticCurveTo(58, 30, 50, 46); c.lineWidth = 1; c.strokeStyle = '#eee'; c.stroke();
  c.beginPath(); c.arc(50, 49, 3, 0, 7); finish(c, '#e04a2a'); c.beginPath(); c.moveTo(47, 49); c.lineTo(53, 49); c.strokeStyle = '#fff'; c.stroke();
}
function harpoon(c) {
  c.save(); c.translate(32, 32); c.rotate(Math.PI / 4);
  c.beginPath(); c.roundRect(-2.5, -14, 5, 42, 2); finish(c, WOODHANDLE);
  path(c, [-3, -14, 0, -28, 3, -14]); finish(c, metalFill(c, '#b8b8c0', -3, 0, 3, 0));
  for (const s of [-1, 1]) { path(c, [s * 2, -16, s * 9, -24, s * 4, -12]); finish(c, metalFill(c, '#b8b8c0', -9, 0, 9, 0)); }
  c.restore();
}
function tinderbox(c) {
  c.beginPath(); c.roundRect(10, 26, 44, 28, 4); finish(c, metalFill(c, '#8a7a5a', 10, 26, 54, 54));
  c.beginPath(); c.roundRect(10, 20, 44, 10, 3); finish(c, metalFill(c, '#a89060', 10, 20, 54, 30));
  c.beginPath(); c.arc(32, 40, 4, 0, 7); finish(c, '#3a2a10');
  c.beginPath(); c.moveTo(40, 18); c.quadraticCurveTo(36, 8, 44, 2); c.quadraticCurveTo(52, 10, 46, 18); c.closePath(); c.fillStyle = radial(c, '#ff9a2a', 44, 12, 9); c.fill();
  c.beginPath(); c.moveTo(42, 18); c.quadraticCurveTo(41, 12, 44, 8); c.quadraticCurveTo(48, 13, 45, 18); c.fillStyle = '#ffe680'; c.fill();
}
function lobsterPot(c) {
  c.beginPath(); c.moveTo(8, 52); c.lineTo(8, 30); c.quadraticCurveTo(32, 2, 56, 30); c.lineTo(56, 52); c.closePath(); finish(c, 'rgba(140,100,50,.35)');
  c.save(); c.clip(); c.strokeStyle = '#8a5a2a'; c.lineWidth = 2.5;
  for (let x = 8; x <= 56; x += 8) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, 54); c.stroke(); }
  for (const y of [30, 42]) { c.beginPath(); c.moveTo(4, y); c.lineTo(60, y); c.stroke(); }
  c.restore(); c.beginPath(); c.ellipse(32, 30, 7, 5, 0, 0, 7); finish(c, '#1a120a');
  c.beginPath(); c.rect(8, 50, 48, 5); finish(c, '#6a4020');
}
function needle(c) {
  c.beginPath(); c.moveTo(14, 54); c.lineTo(50, 10); c.lineWidth = 4; c.strokeStyle = '#000'; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#d8d8e0'; c.stroke();
  c.beginPath(); c.ellipse(47, 14, 2, 4, 0.7, 0, 7); c.fillStyle = '#000'; c.fill();
  c.beginPath(); c.moveTo(47, 14); c.bezierCurveTo(60, 30, 20, 30, 34, 50); c.lineWidth = 1.5; c.strokeStyle = '#c03a3a'; c.stroke();
}
function dust(c, col) {
  c.beginPath(); c.moveTo(8, 50); c.quadraticCurveTo(32, 14, 56, 50); c.closePath(); finish(c, radial(c, col, 30, 36, 22));
  for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(16 + (i * 37) % 32, 34 + (i * 13) % 14, 1.5, 1.5); }
}
function eye(c) {
  c.beginPath(); c.arc(32, 32, 18, 0, 7); finish(c, radial(c, '#f4f0e0', 32, 32, 18));
  c.beginPath(); c.arc(36, 30, 8, 0, 7); finish(c, radial(c, '#e0b020', 36, 30, 8));
  c.beginPath(); c.ellipse(36, 30, 2.5, 6, 0, 0, 7); c.fillStyle = '#000'; c.fill();
  c.strokeStyle = 'rgba(200,40,40,.6)'; c.lineWidth = 1; for (const a of [2.5, 3.2, 4]) { c.beginPath(); c.moveTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17); c.lineTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); c.stroke(); }
}
function root(c) {
  c.beginPath(); c.moveTo(24, 8); c.quadraticCurveTo(40, 20, 34, 36); c.quadraticCurveTo(30, 50, 40, 58); c.lineTo(34, 58); c.quadraticCurveTo(22, 46, 28, 34); c.quadraticCurveTo(32, 20, 20, 10); c.closePath(); finish(c, radial(c, '#c89060', 30, 30, 26));
  c.strokeStyle = '#6a4020'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(31, 30); c.lineTo(20, 38); c.moveTo(32, 42); c.lineTo(44, 46); c.stroke();
  herbLeaves(c);
}
function herbLeaves(c) { for (const a of [-0.5, 0.5]) { c.save(); c.translate(22, 10); c.rotate(a); c.beginPath(); c.ellipse(0, -6, 3, 7, 0, 0, 7); finish(c, '#4aa03a'); c.restore(); } }
function berries(c, col) { for (const [x, y] of [[24, 36], [36, 34], [30, 26], [40, 44], [26, 46], [34, 46]]) { c.beginPath(); c.arc(x, y, 7, 0, 7); finish(c, radial(c, col, x, y, 7)); } c.beginPath(); c.ellipse(36, 16, 8, 4, -0.5, 0, 7); finish(c, '#3a8a2a'); }
function eggs(c) { for (const [x, y] of [[22, 40], [34, 36], [44, 44], [28, 50], [40, 52], [32, 26]]) { c.beginPath(); c.arc(x, y, 6, 0, 7); finish(c, radial(c, '#d02a2a', x, y, 6)); } }
function wine(c) {
  c.beginPath(); c.moveTo(27, 6); c.lineTo(37, 6); c.lineTo(37, 20); c.quadraticCurveTo(48, 24, 48, 36); c.lineTo(48, 56); c.lineTo(16, 56); c.lineTo(16, 36); c.quadraticCurveTo(16, 24, 27, 20); c.closePath(); finish(c, radial(c, '#5a0a1a', 30, 38, 26));
  c.beginPath(); c.roundRect(20, 34, 24, 14, 2); finish(c, '#e8dcb8'); c.fillStyle = '#8a1a1a'; c.fillRect(28, 37, 8, 8); hilite(c, 20, 26, 20, 52, 0.4);
}
function nest(c) { c.beginPath(); c.ellipse(32, 40, 24, 13, 0, 0, 7); finish(c, radial(c, '#8a6a3a', 32, 38, 24)); c.strokeStyle = '#4a3010'; c.lineWidth = 1; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(32, 44, 10 + i * 1.6, 3.4, 6); c.stroke(); } for (const x of [26, 36]) { c.beginPath(); c.ellipse(x, 34, 5, 7, 0, 0, 7); finish(c, radial(c, '#e8f0f8', x, 33, 7)); } }
function emojiIcon(c, ch) { c.font = '40px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 32, 35); }

// ---------- dispatcher ----------
function paint(c, item) {
  const info = ITEMS[item] || {};
  const metal = info.metal || (METAL_TINT[item.split(' ')[0]] ? item.split(' ')[0] : null);
  const m = metal ? METAL_TINT[metal] : '#9a9a9a';
  const low = item.toLowerCase();
  const wood = WOODS.indexOf(item);
  if (wood >= 0) return logs(c, WOOD_COL[wood]);
  if (/shortbow|dark bow/.test(low)) { const t = info.tier != null ? info.tier : 4; return bow(c, item === 'Dark bow' ? '#3a2a4a' : WOOD_COL[t] || WOOD_COL[0]); }
  if (/crossbow/.test(low)) return bow(c, '#7a5030', true, m);
  if (/ bolts$/.test(low)) return arrows(c, m, true);
  if (/ arrows$/.test(low)) return arrows(c, m);
  if (/ bar$/.test(low)) return bar(c, item === 'Gold bar' ? '#ffd040' : m);
  if (item === 'Coal') return ore(c, '#111', true);
  if (/ ore$|^runite|^adamantite/.test(low)) { const col = { 'Copper ore': '#d8803a', 'Tin ore': '#d8d8d8', 'Iron ore': '#9a4a3a', 'Gold ore': '#ffd040', 'Mithril ore': '#5a6ad0', 'Adamantite ore': '#3aa05a', 'Runite ore': '#3ac8e0', 'Dragon ore': '#d04040' }[item] || m; return ore(c, col); }
  if (/essence/.test(low)) return ore(c, item === 'Pure essence' ? '#f0f0ff' : '#c0c8d0');
  if (info.type === 'rune') { const r = RUNES.find(x => x[0] === item); return rune(c, r ? r[2] : '#fff', item[0]); }
  if (/(thrown dagger|dagger)$/.test(low)) return dagger(c, item === 'Venom dagger' ? '#5ac04a' : item === 'Dragon dagger' ? '#c04040' : m);
  if (/throwing axe/.test(low)) return axe(c, m);
  if (/pickaxe$/.test(low)) return axe(c, m, true);
  if (/ axe$/.test(low)) return axe(c, m);
  if (/sword$|blade$|cutlass$|longsword$/.test(low)) return sword(c, item === 'Vampyric blade' ? '#8a1a2a' : item === "Captain's cutlass" ? '#c8c8d8' : m, /long/.test(low));
  if (/maul|warhammer/.test(low)) { c.save(); c.translate(32, 32); c.rotate(-Math.PI / 4); c.beginPath(); c.roundRect(-3, -6, 6, 32, 2); finish(c, WOODHANDLE); c.beginPath(); c.roundRect(-16, -22, 32, 17, 3); finish(c, metalFill(c, item === 'Granite maul' ? '#7a7a70' : '#8a8aa0', 0, -22, 0, -5)); c.restore(); return; }
  if (item === 'Battlestaff' || /^staff|staff$/.test(low)) { const r = info.runeSource && RUNES.find(x => x[0] === info.runeSource); return staff(c, r ? r[2] : item === 'Mystic staff' ? '#9a5aff' : '#8a8a9a', !!(r || /mystic|battle/i.test(item))); }
  if (info.type === 'head') return helm(c, /^(Wizard|Mystic)/.test(item) ? (/Mystic/.test(item) ? '#3a5ad0' : '#2a3a9a') : /cowl/i.test(item) ? '#8a5a2a' : item.startsWith('Wyrmscale') ? '#2a8a3a' : m, /hat$/.test(low) ? 'hat' : /cowl/.test(low) ? 'cowl' : 'helm');
  if (info.type === 'body') return body(c, /robe/.test(low) ? (/Mystic/.test(item) ? '#3a5ad0' : '#2a3a9a') : /leather/.test(low) ? (/Hard/.test(item) ? '#6a4020' : '#9a6a3a') : item.startsWith('Wyrmscale') ? '#2a8a3a' : m, /robe/.test(low) ? 'robe' : /leather/.test(low) ? 'leather' : 'plate');
  if (info.type === 'legs') return legs(c, /robe/.test(low) ? (/Mystic/.test(item) ? '#3a5ad0' : '#2a3a9a') : /chaps/.test(low) ? '#8a5a2a' : item.startsWith('Wyrmscale') ? '#2a8a3a' : m, /robe|chaps/.test(low) ? 'cloth' : 'plate');
  if (info.type === 'shield') return shield(c, /Wooden/.test(item) ? '#8a5a2a' : /Oak/.test(item) ? '#c49a5a' : item.startsWith('Wyrmscale') ? '#2a8a3a' : m, /Wooden|Oak/.test(item));
  if (info.type === 'cape') return cape(c, item === 'Red cape' ? '#c03030' : item === 'Blue cape' ? '#3050c0' : item === 'Obsidian cape' ? '#2a2a30' : item === 'Quest point cape' ? '#3060ff' : '#7a2a8a', info.capeSkill || item === 'Quest point cape' ? '#ffd040' : null);
  if (info.type === 'ring') return ring(c, { 'Warrior ring': '#d04a4a', 'Archer ring': '#4ad04a', 'Ring of regeneration': '#ff80c0', "Miner's ring": '#9a9a9a', "Forester's ring": '#3a8a3a', "Angler's ring": '#3a7ad0', 'Berserker ring': '#8a2a2a', 'Ring of recoil': '#c0c0ff' }[item] || '#d0d0ff');
  if (info.type === 'neck') return item === 'Holy symbol' ? (path(c, [28, 8, 36, 8, 36, 22, 48, 22, 48, 30, 36, 30, 36, 56, 28, 56, 28, 30, 16, 30, 16, 22, 28, 22]), finish(c, metalFill(c, '#e8e8f0', 16, 8, 48, 56)))
    : amulet(c, { 'Amulet of accuracy': '#4a8ad0', 'Amulet of strength': '#d04a4a', 'Amulet of defence': '#4ad08a', 'Amulet of glory': '#ff3a3a', "Herbalist's amulet": '#3ad03a' }[item] || '#e0e0e0');
  if (item === 'Lobster pot') return lobsterPot(c);
  if (item === 'Small fishing net') return net(c);
  if (item === 'Fly fishing rod') return rod(c);
  if (item === 'Harpoon') return harpoon(c);
  if (item === 'Tinderbox') return tinderbox(c);
  if (item === 'Needle') return needle(c);
  if (item === 'Bird nest') return nest(c);
  if (/dust$/.test(low)) return dust(c, { 'Unicorn horn dust': '#f0f0f8', 'Chocolate dust': '#6a3a1a', 'Goat horn dust': '#c8b890', 'Dragon scale dust': '#5ac0a0' }[item] || '#ccc');
  if (item === 'Eye of newt') return eye(c);
  if (item === 'Limpwurt root') return root(c);
  if (item === 'White berries') return berries(c, '#f0f0e8');
  if (item === 'Snape grass') return herb(c, '#3a7a3a');
  if (item === 'Red spider eggs') return eggs(c);
  if (item === 'Wine of zamorak') return wine(c);
  if (/lobster/.test(low)) return crustacean(c, /Cooked/.test(item));
  if (/shrimp|anchov/.test(low)) { c.save(); c.translate(32, 32); c.scale(.75, .75); c.translate(-32, -32); fish(c, /Cooked/.test(item) ? '#f08a6a' : '#d0a090', false); c.restore(); return; }
  if (/(raw|cooked) (trout|salmon|swordfish|shark|tuna|monkfish|pike)/.test(low)) return fish(c, { trout: '#8aa06a', salmon: '#e0806a', swordfish: '#6a8ac0', shark: '#7a8aa0', tuna: '#5a6a8a', monkfish: '#8a7a5a', pike: '#7a9a5a' }[low.split(' ')[1]], /^cooked/.test(low));
  if (/beef|meat/.test(low)) return meat(c, /Cooked/.test(item));
  if (info.buff || /stew|broth|pie|feast/.test(low)) return bowl(c, { 'Hearty stew': '#8a4a1a', "Monk's broth": '#c8b060', "Fisherman's pie": '#d8a050', "Warrior's feast": '#a03a1a' }[item] || '#8a4a1a');
  if (item === 'Burnt food') { c.beginPath(); c.ellipse(32, 36, 20, 13, 0, 0, 7); finish(c, radial(c, '#2a2420', 32, 34, 20)); return; }
  if (info.type === 'potion') { const r = POTION_RECIPES.find(p => p[0] === item); return potion(c, r ? r[6] : '#888'); }
  if (item === 'Vial') return vial(c);
  if (item === 'Vial of water') return potion(c, '#4a8ae0');
  if (info.type === 'bones') return bones(c, item === 'Dragon bones' ? '#c8e0b0' : item === 'Big bones' ? '#f0e0b8' : '#ece4d0');
  if (info.type === 'herb' || info.type === 'grimy') return herb(c, ['#3ad03a', '#5ac05a', '#4aa04a', '#6ab03a', '#2a9a5a', '#5a9a8a', '#8ab03a', '#3a8a6a', '#6a8a3a', '#2ab07a', '#4a7a3a', '#5a6a3a', '#7a5a8a'][Math.max(0, ['Guam', 'Marr', 'Tarr', 'Harr', 'Rana', 'Toad', 'Irit', 'Avan', 'Kwua', 'Snap', 'Cada', 'Dwar', 'Tors'].indexOf(item.replace('Grimy ', '').slice(0, 4).replace(/^./, x => x.toUpperCase())))], info.type === 'grimy');
  const g = low.match(/(uncut )?(sapphire|emerald|ruby|diamond)/); if (g) return gem(c, GEM[g[2]], !!g[1]);
  if (item === 'Cowhide' || /leather$/.test(low)) return hide(c, item === 'Cowhide' ? '#e8e0d0' : item === 'Hard leather' ? '#6a4020' : '#a0703a');
  if (item === 'Cloth') return hide(c, '#d8d0c0');
  if (item === 'Feather') return feather(c);
  if (item === 'Bowstring' || item === 'Flax') return item === 'Flax' ? herb(c, '#c8b060') : coil(c, '#e8e0c8');
  if (item === 'Hammer') return hammer(c);
  if (item === 'Knife') return dagger(c, '#c0c0c8');
  return emojiIcon(c, iconFor(item)[0]);
}

// Returns a data URL for the item's icon (cached).
export function iconURL(item) {
  let u = cache.get(item);
  if (u) return u;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  try { paint(c, item); } catch (e) { c.clearRect(0, 0, S, S); emojiIcon(c, iconFor(item)[0]); }
  u = cv.toDataURL('image/png');
  cache.set(item, u);
  return u;
}
export function iconImg(item, cls = 'ico-img') { return `<img class="${cls}" src="${iconURL(item)}" alt="" draggable="false">`; }
