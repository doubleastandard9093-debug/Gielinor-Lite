// Stillwatch: a focus meter that fills from Flow finishers and perfect dodges. Trigger it to slow the world to 35%
// for 4 seconds (2 seconds against bosses, who resist) while you keep full speed, and aim at weak spots:
// legs slow the foe's attacks, arms weaken its blows, head lands a crit. Logic is a timescale; no extra draws.
export const STILL = { max: 100, finisher: 35, perfect: 25, ms: 4000, bossMs: 2000, scale: 0.35, spots: ['head', 'legs', 'arms'] };
export const SPOT = {
  head: { name: 'Head', icon: '🎯', dmg: 0.6, acc: 0.2, desc: 'critical hit' },
  legs: { name: 'Legs', icon: '🦵', slowTicks: 3, desc: 'slows its attacks' },
  arms: { name: 'Arms', icon: '💪', weakTicks: 10, desc: 'weakens its blows' }
};
export function normalizeStill(s) { s = s && typeof s === 'object' ? s : {}; return { meter: Math.max(0, Math.min(STILL.max, Number(s.meter) || 0)), uses: Math.max(0, Math.floor(Number(s.uses) || 0)), spot: STILL.spots.includes(s.spot) ? s.spot : 'head' }; }
export function addFocus(S, n) { S.meter = Math.min(STILL.max, S.meter + n); return S.meter >= STILL.max; }
