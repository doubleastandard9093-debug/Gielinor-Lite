// Potion effects, timers, boosted levels and poison. Pure logic (unit-tested in node).
// player.effects = [{ id, name, icon, left (ticks), boost: { Skill: n }, fx: { gather, xp } }]
// player.poison = { dmg, next } while poisoned; player.poisonImmune = ticks left.
import { perk, maxPrayer } from './skills.js';
import { ITEMS } from './items.js';
import { questFx } from './quests.js';

export const POTION_TICKS = 500; // 5 minutes at 0.6s per tick
const B = (flat, pct) => ({ flat, pct });
// boost: { Skill: B(flat, pct) }, fx: timed extras, instant: one-off effects
export const POTIONS = {
  'Attack potion': { icon: '🗡️', boost: { Attack: B(3, 0.10) } },
  'Strength potion': { icon: '💪', boost: { Strength: B(3, 0.10) } },
  'Defence potion': { icon: '🛡️', boost: { Defence: B(3, 0.10) } },
  'Combat potion': { icon: '⚔️', boost: { Attack: B(3, 0.10), Strength: B(3, 0.10) } },
  'Super attack': { icon: '🗡️', boost: { Attack: B(5, 0.15) } },
  'Super strength': { icon: '💪', boost: { Strength: B(5, 0.15) } },
  'Super defence': { icon: '🛡️', boost: { Defence: B(5, 0.15) } },
  'Ranging potion': { icon: '🏹', boost: { Ranged: B(4, 0.10) } },
  'Super combat potion': { icon: '⚔️', boost: { Attack: B(5, 0.15), Strength: B(5, 0.15), Defence: B(5, 0.15) } },
  "Prospector's brew": { icon: '⛏️', fx: { gather: 0.1 } },
  "Sage's brew": { icon: '📖', fx: { xp: 0.1 } },
  Antipoison: { icon: '💚', instant: 'antipoison', ticks: 150 },
  'Energy potion': { icon: '🏃', instant: 'energy' },
  'Prayer potion': { icon: '🙏', instant: 'prayer' },
  'Super restore': { icon: '✨', instant: 'restore' }
};
export function isPotion(item) { return !!POTIONS[item]; }

// Potion duration: Herblore perks, gear (Herbalist's amulet) and quest bonuses make it longer.
export function potionTicks(player, skills, base = POTION_TICKS) {
  let more = perk(skills, 'Herblore', 'potionTime') + questFx(player, 'potionTime');
  for (const it of Object.values(player.equipment || {})) if (it && ITEMS[it] && ITEMS[it].eff && ITEMS[it].eff.potionTime) more += ITEMS[it].eff.potionTime;
  return Math.round(base * (1 + more));
}

// Drink one potion (the caller removes it from the pack). Returns chat text.
export function drinkPotion(player, skills, item) {
  const p = POTIONS[item];
  if (!p) return null;
  player.effects = player.effects || [];
  if (p.instant === 'energy') { player.runEnergy = Math.min(100, (player.runEnergy || 0) + 30); return 'You drink the energy potion. You feel refreshed.'; }
  if (p.instant === 'prayer' || p.instant === 'restore') {
    const lvl = skills.Prayer.level, max = maxPrayer(skills);
    const amt = Math.floor((p.instant === 'prayer' ? 7 : 8) + lvl / 4) * 10;
    player.prayerPoints = Math.min(max, (player.prayerPoints || 0) + amt);
    if (p.instant === 'restore') player.runEnergy = Math.min(100, (player.runEnergy || 0) + 20);
    return `You drink the ${item.toLowerCase()}. Your prayer points are restored.`;
  }
  if (p.instant === 'antipoison') {
    player.poison = null;
    player.poisonImmune = potionTicks(player, skills, p.ticks);
    return 'You drink the antipoison. You are cured and protected from poison for a while.';
  }
  const boost = {};
  for (const [sk, b] of Object.entries(p.boost || {})) boost[sk] = b.flat + Math.floor(skills[sk].level * b.pct);
  player.effects = player.effects.filter(e => e.id !== item);
  player.effects.push({ id: item, icon: p.icon, left: potionTicks(player, skills), boost, fx: { ...(p.fx || {}) } });
  const bits = Object.entries(boost).map(([sk, n]) => `${sk} +${n}`);
  return `You drink the ${item.toLowerCase()}.${bits.length ? ' ' + bits.join(', ') + '.' : ''}`;
}

// Boosts from different potions don't stack: the biggest one counts (like RS).
export function boostOf(player, skill) {
  let b = 0;
  for (const e of (player && player.effects) || []) if (e.boost && e.boost[skill] > b) b = e.boost[skill];
  return b;
}
export function boostedLevel(player, skills, skill) { return skills[skill].level + boostOf(player, skill); }
export function effectFx(player, key) {
  let v = 0;
  for (const e of (player && player.effects) || []) if (e.fx && e.fx[key]) v = Math.max(v, e.fx[key]);
  return v;
}

// Called every game tick. Returns chat messages (effects ending, poison damage etc).
export function effectsTick(player) {
  const out = [];
  player.effects = (player.effects || []).filter(e => {
    e.left--;
    if (e.left === 50) out.push({ text: `Your ${e.id.toLowerCase()} is wearing off.`, cls: 'warn' });
    if (e.left <= 0) { out.push({ text: `Your ${e.id.toLowerCase()} has worn off.`, cls: 'warn' }); return false; }
    return true;
  });
  if (player.poisonImmune > 0) { player.poisonImmune--; if (!player.poisonImmune) out.push({ text: 'Your poison protection has worn off.', cls: 'warn' }); }
  return out;
}

// ---- Poison (player or monster): { dmg, next } ----
export const POISON_EVERY = 10; // ticks between poison hits
export function applyPoison(target, dmg, isPlayer = false) {
  if (isPlayer && target.poisonImmune > 0) return false;
  if (target.poison && target.poison.dmg >= dmg) return false;
  target.poison = { dmg, next: POISON_EVERY };
  return true;
}
// Returns damage to deal this tick (0 most ticks). resist = fraction of damage ignored.
export function poisonTick(target, resist = 0) {
  const p = target.poison;
  if (!p) return 0;
  if (--p.next > 0) return 0;
  p.next = POISON_EVERY;
  const d = Math.max(1, Math.round(p.dmg * (1 - resist)));
  p.dmg -= 2;
  if (p.dmg <= 0) target.poison = null;
  return d;
}
