// Prayers: unlocked by Prayer level, drain prayer points every game tick while on.
import { perk, maxPrayer } from './skills.js';
import { ITEMS } from './items.js';
import { questFx } from './quests.js';

// fx: att/str/def/rng = level boost, regen = extra HP regen speed, saveMat = chance to keep
// materials when making things, gather = extra gathering success and XP, protect = melee damage cut.
export const PRAYERS = [
  { id: 'thick',    name: 'Thick Skin',           level: 1,  icon: '🛡️', drain: 0.17, group: 'def', fx: { def: 0.05 }, desc: '+5% Defence' },
  { id: 'burst',    name: 'Burst of Strength',    level: 4,  icon: '💪', drain: 0.17, group: 'str', fx: { str: 0.05 }, desc: '+5% Strength' },
  { id: 'clarity',  name: 'Clarity of Thought',   level: 7,  icon: '🎯', drain: 0.17, group: 'att', fx: { att: 0.05 }, desc: '+5% Attack' },
  { id: 'sharp',    name: 'Sharp Eye',            level: 8,  icon: '👁️', drain: 0.17, group: 'rng', fx: { rng: 0.05 }, desc: '+5% Ranged' },
  { id: 'rock',     name: 'Rock Skin',            level: 10, icon: '🪨', drain: 0.33, group: 'def', fx: { def: 0.10 }, desc: '+10% Defence' },
  { id: 'superhuman', name: 'Superhuman Strength', level: 13, icon: '🦾', drain: 0.33, group: 'str', fx: { str: 0.10 }, desc: '+10% Strength' },
  { id: 'reflexes', name: 'Improved Reflexes',    level: 16, icon: '⚡', drain: 0.33, group: 'att', fx: { att: 0.10 }, desc: '+10% Attack' },
  { id: 'hawk',     name: 'Hawk Eye',             level: 19, icon: '🦅', drain: 0.33, group: 'rng', fx: { rng: 0.10 }, desc: '+10% Ranged' },
  { id: 'rapidheal', name: 'Rapid Heal',          level: 22, icon: '💗', drain: 0.12, group: 'heal', fx: { regen: 1 }, desc: 'Hitpoints regenerate twice as fast' },
  { id: 'provident', name: 'Provident Hands',     level: 25, icon: '🤲', drain: 0.25, group: 'hands', fx: { saveMat: 0.1 }, desc: '10% chance to keep materials when smithing, crafting, fletching or cooking' },
  { id: 'steel',    name: 'Steel Skin',           level: 28, icon: '⛓️', drain: 0.5,  group: 'def', fx: { def: 0.15 }, desc: '+15% Defence' },
  { id: 'ultimate', name: 'Ultimate Strength',    level: 31, icon: '🔥', drain: 0.5,  group: 'str', fx: { str: 0.15 }, desc: '+15% Strength' },
  { id: 'incredible', name: 'Incredible Reflexes', level: 34, icon: '🌟', drain: 0.5,  group: 'att', fx: { att: 0.15 }, desc: '+15% Attack' },
  { id: 'eagle',    name: 'Eagle Eye',            level: 37, icon: '🏹', drain: 0.5,  group: 'rng', fx: { rng: 0.15 }, desc: '+15% Ranged' },
  { id: 'bounty',   name: "Nature's Bounty",      level: 40, icon: '🌿', drain: 0.4,  group: 'gather', fx: { gather: 0.1 }, desc: '+10% gathering success and XP' },
  { id: 'protect',  name: 'Protect from Melee',   level: 43, icon: '⚔️', drain: 0.5,  group: 'protect', fx: { protect: 0.4 }, desc: 'Take 40% less damage from monsters', quest: 'fallen' }
];
// Ranged prayers can't be combined with attack/strength prayers (like RuneScape).
const CLASH = { rng: ['att', 'str'], att: ['rng'], str: ['rng'] };

export function prayerById(id) { return PRAYERS.find(p => p.id === id); }

export function isActive(player, id) { return (player.activePrayers || []).includes(id); }

// Turns a prayer on or off. Returns a message when it couldn't.
export function togglePrayer(player, skills, id, questDone = () => true) {
  const p = prayerById(id);
  if (!p) return 'Unknown prayer.';
  player.activePrayers = player.activePrayers || [];
  if (isActive(player, id)) { player.activePrayers = player.activePrayers.filter(x => x !== id); return null; }
  if (skills.Prayer.level < p.level) return `You need a Prayer level of ${p.level} to use ${p.name}.`;
  if (p.quest && !questDone(p.quest)) return `You need to complete Rest for the Fallen to use ${p.name}.`;
  if ((player.prayerPoints || 0) <= 0) return 'You need to recharge your prayer points at an altar.';
  const off = new Set([p.group, ...(CLASH[p.group] || [])]);
  player.activePrayers = player.activePrayers.filter(x => !off.has(prayerById(x).group));
  player.activePrayers.push(id);
  return null;
}

export function prayerBonus(player) {
  let b = 0;
  for (const item of Object.values(player.equipment || {})) if (item && ITEMS[item]) b += ITEMS[item].prayer || 0;
  return b;
}
// Like RuneScape: each prayer bonus point makes prayers last ~3.3% longer.
// Prayer perks and quest bonuses cut the drain further (never below 40%).
export function drainPerTick(player, skills) {
  let d = 0;
  for (const id of player.activePrayers || []) d += prayerById(id).drain;
  const less = Math.min(0.6, perk(skills, 'Prayer', 'drainLess') + questFx(player, 'drainLess'));
  return d * (1 - less) / (1 + Math.max(0, prayerBonus(player)) / 30);
}
// Faithful perk and Rest for the Fallen: prayer points slowly come back.
export function ppRegenPerTick(player, skills) {
  return perk(skills, 'Prayer', 'ppRegen') + questFx(player, 'ppRegen');
}

// Called every game tick. Returns true when points just ran out.
export function drainTick(player, skills) {
  if (!player.activePrayers || !player.activePrayers.length) return false;
  player.prayerPoints = Math.max(0, (player.prayerPoints || 0) - drainPerTick(player, skills));
  if (player.prayerPoints <= 0) { player.activePrayers = []; return true; }
  return false;
}

export function prayerFx(player, key) {
  let v = 0;
  for (const id of player.activePrayers || []) { const p = prayerById(id); if (p && p.fx[key]) v += p.fx[key]; }
  return v;
}

export function rechargePrayer(player, skills) {
  const max = maxPrayer(skills);
  const had = player.prayerPoints || 0;
  player.prayerPoints = max;
  return max - had;
}
