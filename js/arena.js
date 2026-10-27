// The Proving Grounds: offline duels against bot duellists that copy your loadout, an Elo rating,
// arena tokens and a weekly ladder kept on this device. Logic and data only.
import { makeRng } from './rng.js';
export const LADDER_NAMES = ['Sela Thorn', 'Garrick Vane', 'Old Dunmore', 'Pip Ashcombe', 'Rhosyn Vale', 'Tobiah Marsh', 'Ilka Brand', 'Corwen Hale', 'Mabry Fenn'];
export const WEEK_MS = 7 * 24 * 3600 * 1000;
export const ARENA_RULES = { start: 1000, k: 32, winTokens: 10, lossTokens: 2, weekly: [40, 25, 15, 5] }; // weekly: rank 1, 2-3, 4-6, rest
export const ARENA_SHOP = [
  { id: 'cape', name: "Duellist's cape", cost: 60, item: "Duellist's cape", desc: 'A cape for proven fighters (+4 attack, +4 defence).' },
  { id: 'band', name: "Victor's band", cost: 120, item: "Victor's band", desc: 'A ring for ladder champions (+6 strength).', rank: 3 },
  { id: 'watch', name: 'Commendation to the Watch', cost: 25, rep: ['watch', 100], desc: '+100 Brightwater Watch standing.' },
  { id: 'tutor', name: 'Sparring lessons', cost: 15, xp: 2500, desc: '2,500 XP in your lowest combat skill.' }
];
export const weekNo = now => Math.floor(now / WEEK_MS);
export function normalizeArena(a) {
  a = a && typeof a === 'object' ? a : {};
  const n = (v, d = 0) => Math.max(0, Math.floor(Number(v) || d));
  return { rating: Math.min(3000, n(a.rating, ARENA_RULES.start)) || ARENA_RULES.start, tokens: Math.min(1e6, n(a.tokens)), wins: n(a.wins), losses: n(a.losses), best: n(a.best, ARENA_RULES.start), week: n(a.week) };
}
// The other names on this week's ladder (seeded by week number, so the same all week).
export function ladder(week) {
  const r = makeRng(9000 + week);
  return LADDER_NAMES.map(name => ({ name, rating: Math.round(850 + r() * 750) })).sort((a, b) => b.rating - a.rating);
}
export function rankOf(A, week) { return 1 + ladder(week).filter(e => e.rating > A.rating).length; }
export const expected = (r, o) => 1 / (1 + Math.pow(10, (o - r) / 400));
export function rateDuel(A, opp, win) {
  const d = Math.round(ARENA_RULES.k * ((win ? 1 : 0) - expected(A.rating, opp)));
  A.rating = Math.max(100, A.rating + d); A.best = Math.max(A.best, A.rating);
  if (win) { A.wins++; A.tokens += ARENA_RULES.winTokens; } else { A.losses++; A.tokens += ARENA_RULES.lossTokens; }
  return d;
}
// New week: pay out last week's ladder tokens and pull the rating halfway back to 1000.
export function weekRoll(A, now) {
  const w = weekNo(now); if (A.week === w) return null;
  let out = null;
  if (A.week && A.wins + A.losses > 0) {
    const rank = rankOf(A, A.week), W = ARENA_RULES.weekly, pay = rank === 1 ? W[0] : rank <= 3 ? W[1] : rank <= 6 ? W[2] : W[3];
    A.tokens += pay; A.rating = Math.round(ARENA_RULES.start + (A.rating - ARENA_RULES.start) / 2); out = { rank, pay };
  }
  A.week = w; return out;
}
// Pick an opponent close to your rating (slightly above when possible).
export function pickOpponent(A, week, rnd = Math.random) {
  const L = ladder(week), above = L.filter(e => e.rating >= A.rating - 60).reverse();
  const pool = (above.length ? above : L).slice(0, 3);
  return pool[Math.floor(rnd() * pool.length)];
}
// Bot stats that mimic your loadout, scaled by the opponent's rating.
export function duellistStats(me, oppRating) {
  const k = Math.max(0.7, Math.min(1.25, 0.85 + (oppRating - 1000) / 2000));
  return { hp: Math.round(me.maxHp * k), maxHit: Math.max(6, Math.round(me.maxHit * k)), att: Math.max(5, Math.round(me.att * k)), def: Math.max(5, Math.round(me.def * k)),
    level: Math.max(3, Math.round(me.cb * k)), ranged: !!me.ranged, range: me.ranged ? 6 : undefined, speed: me.ranged ? 5 : 4 };
}
