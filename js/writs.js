// Daily Writs and the Weekly Hearthboard: 3 rotating daily writs for each of four factions, plus one weekly
// great deed. Rewards are Standing and coins. Rolls use the wall-clock day, but ignore a clock moved backwards
// and need some real play between rolls, so nudging the device clock doesn't farm writs. Logic and UI only.
export const WRIT_FACTIONS = ['watch', 'mariners', 'circle', 'lantern'];
export const WRIT_POOL = {
  watch: [['kill', 'Goblin', 12], ['kill', 'Bandit', 6], ['kill', 'Hill Giant', 4], ['kill', 'Wolf', 8], ['act', 'Defence', 40], ['kill', 'Black Knight', 3]],
  mariners: [['act', 'Fishing', 25], ['act', 'Cooking', 25], ['kill', 'Drowned Deckhand', 5], ['act', 'Ranged', 40], ['kill', 'Drowned Gunner', 3]],
  circle: [['act', 'Magic', 40], ['act', 'Runecrafting', 20], ['act', 'Herblore', 15], ['kill', 'Skeleton', 6], ['kill', 'Zombie', 8]],
  lantern: [['act', 'Prayer', 15], ['act', 'Smithing', 25], ['act', 'Mining', 30], ['kill', 'Moss Giant', 4], ['kill', 'Giant Spider', 6]]
};
export const WEEKLY_POOL = [['kill', 'Grumsh', 1], ['kill', 'Captain Saltgrave', 1], ['kill', 'Lesser Demon', 5], ['kill', 'Ogre', 10]];
export const WRIT_REWARD = { rep: 20, gold: 150, weeklyRep: 80, weeklyGold: 2000, weeklyTokens: 10 };
export const DAY_MS = 86400000, MIN_PLAY_TICKS = 600; // ~6 minutes of play between rolls
export const dayNo = now => Math.floor(now / DAY_MS);
export const weekNo = now => Math.floor((now / DAY_MS + 3) / 7);
function hash(a, b) { let h = (a * 2654435761 + b * 40503) >>> 0; h ^= h >>> 13; h = Math.imul(h, 2246822519) >>> 0; return h; }
function makeWrit(fac, spec, done = false) { return { fac, kind: spec[0], target: spec[1], n: spec[2], got: 0, done }; }
export function rollDaily(day) {
  const out = [];
  for (const [fi, f] of WRIT_FACTIONS.entries()) {
    const pool = WRIT_POOL[f], start = hash(day, fi) % pool.length;
    for (let k = 0; k < 3; k++) out.push(makeWrit(f, pool[(start + k * 2) % pool.length]));
  }
  return out;
}
export function rollWeekly(week) { const s = WEEKLY_POOL[hash(week, 99) % WEEKLY_POOL.length]; return makeWrit(WRIT_FACTIONS[hash(week, 7) % 4], s); }
export function normalizeWrits(w) {
  w = w && typeof w === 'object' ? w : {};
  const cw = x => x && typeof x === 'object' && WRIT_FACTIONS.includes(x.fac) && (x.kind === 'kill' || x.kind === 'act') && typeof x.target === 'string'
    ? { fac: x.fac, kind: x.kind, target: x.target, n: Math.max(1, Math.floor(Number(x.n) || 1)), got: Math.max(0, Math.floor(Number(x.got) || 0)), done: !!x.done } : null;
  const num = v => Math.max(0, Math.floor(Number(v) || 0));
  return { day: num(w.day), week: num(w.week), lastNow: num(w.lastNow), playTicks: num(w.playTicks), daily: Array.isArray(w.daily) ? w.daily.map(cw).filter(Boolean).slice(0, 12) : [], weekly: cw(w.weekly), done: num(w.done), weeklyDone: num(w.weeklyDone) };
}
// Returns 'daily'/'weekly'/null depending on what rolled. force skips the play-time guard (first roll).
export function maybeRoll(W, now, force = false) {
  if (W.lastNow && now < W.lastNow - 3600000) return null; // clock moved backwards: ignore until it catches up
  W.lastNow = Math.max(W.lastNow, now);
  const d = dayNo(now), wk = weekNo(now); let out = null;
  const first = !W.daily.length;
  if ((d > W.day && (force || first || W.playTicks >= MIN_PLAY_TICKS)) || first) { W.day = d; W.daily = rollDaily(d); W.playTicks = 0; out = 'daily'; }
  if (wk > W.week || !W.weekly) { W.week = wk; W.weekly = rollWeekly(wk); out = out || 'weekly'; }
  return out;
}
// Progress writs matching kind/target. Returns the list of writs that just completed.
export function writProgress(W, kind, target, n = 1) {
  const hit = [];
  for (const w of [...W.daily, W.weekly].filter(Boolean)) if (!w.done && w.kind === kind && w.target === target) {
    w.got = Math.min(w.n, w.got + n); if (w.got >= w.n) { w.done = true; hit.push(w); }
  }
  return hit;
}
export const writLabel = w => `${w.kind === 'kill' ? `Defeat ${w.n} ${w.target}` : `${w.n} ${w.target} actions`} (${w.got}/${w.n})${w.done ? ' ✓' : ''}`;
