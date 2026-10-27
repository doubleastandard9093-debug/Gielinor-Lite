// Contested Wilds: three banners in the scorched wilderness that you and the rival Ashen Company
// fight over. Hold a banner to earn arena tokens and Watch standing. Bot count is capped on phones.
export const WILDS = { x: 122, z: -122, r: 26, near: 70, flags: [[-11, -6], [10, -8], [0, 11]] };
export const RIVAL = { name: 'Ashen Company', mon: 'Ashen raider' };
export const CAP = { ticks: 8, clearR: 6, captureR: 3, payEvery: 100, payTokens: 2, payRep: 5, raidEvery: 60, retake: 0.4, aggroR: 8, killRep: 3 };
export const botCap = (quality, touch) => (quality === 'low' || touch ? 3 : 6);
// held: 'you' | 'rival' | null for each banner.
export function normalizeWilds(w) {
  w = w && typeof w === 'object' ? w : {};
  const ok = v => (v === 'you' || v === 'rival' ? v : 'rival');
  const h = Array.isArray(w.held) ? w.held : [];
  return { held: WILDS.flags.map((_, i) => ok(h[i])), captures: Math.max(0, Math.floor(Number(w.captures) || 0)) };
}
// One tick of capturing banner i. Returns 'captured' when it flips to you.
export function captureStep(W, prog, i, playerNear, rivalsNear) {
  if (W.held[i] === 'you' || !playerNear || rivalsNear) { prog[i] = 0; return null; }
  prog[i] = (prog[i] || 0) + 1;
  if (prog[i] >= CAP.ticks) { W.held[i] = 'you'; W.captures++; prog[i] = 0; return 'captured'; }
  return null;
}
export const heldCount = W => W.held.filter(h => h === 'you').length;
