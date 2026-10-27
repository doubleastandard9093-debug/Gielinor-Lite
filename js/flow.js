// Flow Strikes: chaining combat skills builds a Flow chain for bonus damage, and the third link
// fires a Flow Finisher. Plus a dodge-roll with a short window where hits miss you.
// Logic only: no meshes, no textures, so it costs nothing extra on Low.
export const FLOW = {
  windowTicks: 6,        // next skill hit must land within 6 ticks (3.6 s) of the last one
  perLink: 0.08,         // +8% damage per chain link
  maxLinks: 3,           // the 3rd link is the finisher, then the chain resets
  finisher: 0.5,         // finisher adds one extra swing at +50% damage
  dodgeCost: 15,         // run energy
  dodgeCdMs: 2000,
  dodgeMs: 260,          // roll length
  iframeMs: 420,         // hits during this window miss
  dodgeDist: 4.2
};

export function createFlow() { return { links: 0, lastTick: -99, best: 0, dodgeReadyAt: 0, iframeUntil: 0, used: [] }; }
// Finisher by style: melee bleeds, ranged pierces armour, magic chains to a nearby foe.
export const FINISHER = { melee: { name: 'Bleeding Finisher', bleed: 0.12, ticks: 5 }, ranged: { name: 'Piercing Finisher', acc: 0.5, dmg: 0.25 }, magic: { name: 'Chain Finisher', chain: 0.6, range: 6 } };

// Called when a queued combat skill actually fires. Returns { bonus, finisher, links }.
// Links only count with a skill not already in the chain; repeating one holds the chain (repeat: true).
export function flowOnSkillHit(f, tick, id = null) {
  const live = tick - f.lastTick <= FLOW.windowTicks && f.links > 0;
  if (!live) f.used = [];
  if (live && id && (f.used || []).includes(id)) { f.lastTick = tick; return { bonus: (f.links - 1) * FLOW.perLink, finisher: false, links: f.links, repeat: true }; }
  f.links = live ? f.links + 1 : 1;
  f.used = [...(live ? f.used || [] : []), id].filter(Boolean);
  f.lastTick = tick;
  if (f.links > f.best) f.best = f.links;
  const finisher = f.links >= FLOW.maxLinks;
  const out = { bonus: (f.links - 1) * FLOW.perLink, finisher, links: f.links };
  if (finisher) { f.links = 0; f.used = []; }
  return out;
}
// Perfect dodge: rolling through an attack adds a link (never fires the finisher by itself).
export function flowPerfectDodge(f, tick) {
  const live = tick - f.lastTick <= FLOW.windowTicks + 2;
  f.links = Math.min(FLOW.maxLinks - 1, (live ? f.links : 0) + 1); f.lastTick = tick;
  if (!live) f.used = [];
  if (f.links > f.best) f.best = f.links;
  return f.links;
}
export function flowDecay(f, tick) { if (f.links && tick - f.lastTick > FLOW.windowTicks) f.links = 0; }

// Starts a roll if allowed. dir is a unit {x,z}. Returns an error string or null.
export function tryDodge(f, pm, player, dir, now, bonusMs = 0) {
  if (now < f.dodgeReadyAt) return null; // silently ignore mashing
  if (player.runEnergy < FLOW.dodgeCost) return 'You are too tired to roll.';
  player.runEnergy -= FLOW.dodgeCost;
  f.dodgeReadyAt = now + FLOW.dodgeCdMs;
  f.iframeUntil = now + FLOW.iframeMs + bonusMs;
  pm.dodge = { x: dir.x, z: dir.z, left: FLOW.dodgeMs, speed: FLOW.dodgeDist / (FLOW.dodgeMs / 1000) };
  pm.target = null;
  return null;
}
export function dodging(f, now) { return now < f.iframeUntil; }
