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

export function createFlow() { return { links: 0, lastTick: -99, best: 0, dodgeReadyAt: 0, iframeUntil: 0 }; }

// Called when a queued combat skill actually fires. Returns { bonus, finisher, links }.
export function flowOnSkillHit(f, tick) {
  f.links = (tick - f.lastTick <= FLOW.windowTicks) ? f.links + 1 : 1;
  f.lastTick = tick;
  if (f.links > f.best) f.best = f.links;
  const finisher = f.links >= FLOW.maxLinks;
  const out = { bonus: (f.links - 1) * FLOW.perLink, finisher, links: f.links };
  if (finisher) f.links = 0;
  return out;
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
