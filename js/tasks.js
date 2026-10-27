// Hunt tasks (Slayer-style): Huntmaster Corvane in Port Sarim assigns kill tasks.
// Finishing tasks earns Hunt points for his shop; points also buy skips, blocks and longer tasks.
// Drowned Crew tasks raise your standing with the Drowned Crew (how much they fear you), which unlocks reef rewards.
import { MONSTER_TYPES } from './gameplay.js';

export const TASK = { skipCost: 30, blockCost: 100, maxBlocks: 4, extendCost: 75, basePts: 12, drownedRep: 60, killRep: 4 };
const plural = n => /s$/.test(n) ? n : n === 'Wolf' ? 'Wolves' : n + 's';
export const taskLabel = t => `${t.n} ${plural(t.mon)}`;

export function normalizeTasks(t) {
  t = t && typeof t === 'object' ? t : {};
  const cur = t.cur && MONSTER_TYPES[t.cur.mon] ? { mon: t.cur.mon, n: Math.max(1, Math.floor(+t.cur.n || 1)), got: Math.max(0, Math.floor(+t.cur.got || 0)) } : null;
  const valid = a => Array.isArray(a) ? a.filter(m => MONSTER_TYPES[m]).slice(0, 8) : [];
  return { cur, points: Math.max(0, Math.floor(+t.points || 0)), streak: Math.max(0, Math.floor(+t.streak || 0)), done: Math.max(0, Math.floor(+t.done || 0)),
    blocked: valid(t.blocked).slice(0, TASK.maxBlocks), extended: valid(t.extended), unlocks: Array.isArray(t.unlocks) ? t.unlocks.filter(u => typeof u === 'string').slice(0, 16) : [] };
}
// Monsters the master may assign at your combat level (no bosses, nothing far above you).
export function taskPool(cb, tasks) {
  return Object.values(MONSTER_TYPES).filter(m => !m.boss && m.name !== 'Cow' && m.name !== 'Guard' && m.level <= cb + 15 && m.level >= Math.min(cb - 40, 20) && !tasks.blocked.includes(m.name)).map(m => m.name);
}
export function assignTask(tasks, cb, rng = Math.random) {
  const pool = taskPool(cb, tasks).filter(m => !tasks.cur || m !== tasks.cur.mon);
  const mon = pool.length ? pool[Math.floor(rng() * pool.length)] : 'Goblin';
  let n = 10 + Math.floor(rng() * 16) + Math.floor(cb / 10);
  if (tasks.extended.includes(mon)) n = Math.round(n * 1.5);
  tasks.cur = { mon, n, got: 0 };
  return tasks.cur;
}
export function isDrowned(mon) { const m = MONSTER_TYPES[mon]; return !!(m && m.drowned); }
// Points for a finished task: base + level, x1.5 for Drowned Crew, x5 every 10th, x2 every 50th (streak).
export function taskPoints(tasks, mon, extended) {
  const m = MONSTER_TYPES[mon]; let p = TASK.basePts + Math.floor((m ? m.level : 10) / 6);
  if (isDrowned(mon)) p = Math.round(p * 1.5);
  if (extended) p = Math.round(p * 1.3);
  const s = tasks.streak + 1;
  if (s % 50 === 0) p *= 15; else if (s % 10 === 0) p *= 5;
  return p;
}
// Returns { done, pts } after a kill of `mon`.
export function taskKill(tasks, mon) {
  const c = tasks.cur; if (!c || c.mon !== mon || c.got >= c.n) return null;
  c.got++;
  if (c.got < c.n) return { done: false };
  const pts = taskPoints(tasks, mon, tasks.extended.includes(mon));
  tasks.points += pts; tasks.streak++; tasks.done++;
  return { done: true, pts };
}
// Points shop. `drowned` = Drowned Crew standing tier needed.
export const HUNT_SHOP = [
  { id: 'insight', name: 'Hunter\'s Insight', cost: 200, unlock: true, desc: '+10% damage against your task monster.' },
  { id: 'ring', name: 'Hunter\'s ring', cost: 150, item: 'Hunter\'s ring', desc: 'A ring of tusk and wire: +5 attack, +5 ranged.' },
  { id: 'fire', name: '100 Fire runes', cost: 25, item: 'Fire rune', qty: 100, desc: 'Runes for the road.' },
  { id: 'lamp', name: 'Combat tutoring', cost: 60, xp: 2500, desc: '2,500 XP in your lowest combat skill.' },
  { id: 'reefward', name: 'Reefward amulet', cost: 300, item: 'Reefward amulet', drowned: 2, desc: 'Ward of drowned coral: +6 defence, +8 vs the Drowned Crew.' },
  { id: 'reefbane', name: 'Reefbane', cost: 400, unlock: true, drowned: 3, desc: '+15% damage against the Drowned Crew.' },
  { id: 'saltring', name: 'Saltgrave\'s signet', cost: 750, item: 'Saltgrave\'s signet', drowned: 4, desc: 'The Captain\'s own ring: +6 attack, +6 strength, +6 ranged.' }
];
