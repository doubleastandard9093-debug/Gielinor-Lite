// Pure game rules (no rendering), so they can be unit-tested in node.
import { addItem, removeItem, canAdd } from './playerState.js';
import { ITEMS, HEAL_SCALE, slotFor, isRangedWeapon, itemValue, isTool, toolType, FOODS, SETS, SKILL_CAPE_SKILLS } from './items.js';
import { perk } from './skills.js';
import { prayerFx } from './prayer.js';
import { questFx, isDone } from './quests.js';

export const TICK_MS = 600;

// ---- Gathering ----------------------------------------------------------
export const TREES = {
  Tree:   { level: 1,  xp: 25,   item: 'Logs',        deplete: 0.35, respawn: 9000 },
  Oak:    { level: 15, xp: 37.5, item: 'Oak logs',    deplete: 0.15, respawn: 14000 },
  Willow: { level: 30, xp: 67.5, item: 'Willow logs', deplete: 0.12, respawn: 14000 },
  Maple:  { level: 45, xp: 100,  item: 'Maple logs',  deplete: 0.10, respawn: 20000 },
  Yew:    { level: 60, xp: 175,  item: 'Yew logs',    deplete: 0.08, respawn: 30000 },
  Magic:  { level: 75, xp: 250,  item: 'Magic logs',  deplete: 0.06, respawn: 45000 }
};
export const ROCKS = {
  Copper:     { level: 1,  xp: 17.5, item: 'Copper ore',     respawn: 4000 },
  Tin:        { level: 1,  xp: 17.5, item: 'Tin ore',        respawn: 4000 },
  Iron:       { level: 15, xp: 35,   item: 'Iron ore',       respawn: 7000 },
  Coal:       { level: 30, xp: 50,   item: 'Coal',           respawn: 20000 },
  Mithril:    { level: 55, xp: 80,   item: 'Mithril ore',    respawn: 30000 },
  Adamantite: { level: 70, xp: 95,   item: 'Adamantite ore', respawn: 50000 },
  Runite:     { level: 85, xp: 125,  item: 'Runite ore',     respawn: 90000 }
};
// A fishing spot offers several catches; the best one you can catch is rolled first.
export const FISH_SPOTS = {
  Net:     { verb: 'Net',     tool: 'net',     catches: [{ level: 1, xp: 20, item: 'Raw shrimp' }] },
  Lure:    { verb: 'Lure',    tool: 'rod',     catches: [{ level: 30, xp: 70, item: 'Raw salmon' }, { level: 20, xp: 50, item: 'Raw trout' }] },
  Cage:    { verb: 'Cage',    tool: 'cage',    catches: [{ level: 40, xp: 90, item: 'Raw lobster' }] },
  Harpoon: { verb: 'Harpoon', tool: 'harpoon', catches: [{ level: 76, xp: 110, item: 'Raw shark' }, { level: 50, xp: 100, item: 'Raw swordfish' }] }
};

// ---- Toolbelt -------------------------------------------------------------
// player.tools is a set of owned tools ({ 'Bronze axe': true }). The belt uses the best
// one of each type that your level allows.
export function bestTool(player, skills, type) {
  let best = null, bestTier = -1;
  for (const item of Object.keys(player.tools || {})) {
    const info = ITEMS[item];
    if (!info || info.tool !== type) continue;
    if (info.req && Object.entries(info.req).some(([s, l]) => skills[s].level < l)) continue;
    const tier = info.toolTier !== undefined ? info.toolTier : 0;
    if (tier > bestTier) { best = item; bestTier = tier; }
  }
  return best;
}
export function ownsToolType(player, type) {
  return Object.keys(player.tools || {}).some(i => toolType(i) === type);
}
// Adds a tool to the belt if you don't own that exact tool yet. Returns true if it went on the belt.
export function addTool(player, item) {
  if (!isTool(item)) return false;
  player.tools = player.tools || {};
  if (player.tools[item]) return false;
  player.tools[item] = true;
  return true;
}
export function toolTierBonus(player, skills, type) {
  const t = bestTool(player, skills, type);
  return t ? (ITEMS[t].toolTier || 0) * 0.05 : 0;
}

const TOOL_NAME = { axe: 'an axe', pickaxe: 'a pickaxe', net: 'a small fishing net', rod: 'a fly fishing rod', cage: 'a lobster pot', harpoon: 'a harpoon', hammer: 'a hammer', knife: 'a knife', needle: 'a needle', tinderbox: 'a tinderbox' };
export function toolName(type) { return TOOL_NAME[type] || type; }

export function gatherInfo(node) {
  if (node.type === 'tree') return { skill: 'Woodcutting', tool: 'axe', ...TREES[node.kind] };
  if (node.type === 'rock') return { skill: 'Mining', tool: 'pickaxe', ...ROCKS[node.ore] };
  if (node.type === 'fish') {
    const spot = FISH_SPOTS[node.kind];
    const min = spot.catches[spot.catches.length - 1];
    return { skill: 'Fishing', tool: spot.tool, level: min.level, catches: spot.catches };
  }
  return null;
}

export function successChance(level, req) {
  return Math.max(0.05, Math.min(0.92, 0.3 + (level - req) * 0.025));
}

// One gathering attempt on a game tick. Returns { item, qty, xp, depleted } on success,
// null on a failed roll, or { error } when the action can't continue.
export function gatherTick(node, skills, player, rng = Math.random) {
  const info = gatherInfo(node);
  if (!info) return { error: 'You can\'t do that.' };
  const lvl = skills[info.skill].level;
  if (lvl < info.level) return { error: `You need a ${info.skill} level of ${info.level} to do that.` };
  const tool = bestTool(player, skills, info.tool);
  if (!tool) {
    return { error: ownsToolType(player, info.tool) ? `Your ${info.tool} needs a higher ${info.skill} level.` : `You need ${toolName(info.tool)} on your toolbelt. The tool shop sells one.` };
  }
  const gear = equipmentBonuses(player);
  const bonus = (ITEMS[tool].toolTier || 0) * 0.05 + perk(skills, info.skill, 'speed') + prayerFx(player, 'gather') +
    (gear.gather[info.skill] || 0) + questFx(player, 'gather');
  const xpMult = 1 + prayerFx(player, 'gather') + perk(skills, info.skill, 'xpBonus');
  const doubled = () => (rng() < perk(skills, info.skill, 'double') ? 2 : 1);
  // Milestone perks: resources sometimes go straight to the bank.
  const banked = () => rng() < perk(skills, info.skill, 'autoBank');
  if (node.type === 'fish') {
    for (const c of info.catches) {
      if (lvl < c.level) continue;
      if (!canAdd(player, c.item)) return { error: 'Your inventory is too full to hold any more.' };
      const last = c === info.catches[info.catches.length - 1];
      if (rng() < Math.min(0.95, successChance(lvl, c.level) + bonus) * (last ? 1 : 0.6)) {
        return { item: c.item, qty: doubled(), xp: c.xp * xpMult, skill: info.skill, depleted: false, bank: banked() };
      }
    }
    return null;
  }
  if (!canAdd(player, info.item)) return { error: 'Your inventory is too full to hold any more.' };
  if (rng() >= Math.min(0.95, successChance(lvl, info.level) + bonus)) return null;
  // Resources are infinite: trees and rocks never run out.
  return { item: info.item, qty: doubled(), xp: info.xp * xpMult, skill: info.skill, depleted: false, bank: banked() };
}
// Chain Chop / Rich Vein: chance the next attempt comes 1 tick sooner (never below 1 tick).
export function nextGatherWait(skills, skill, rng = Math.random) {
  return rng() < perk(skills, skill, 'fastGather') ? 0 : 1;
}

// ---- Making things ---------------------------------------------------------
export function burnChance(recipe, skills, player = null) {
  if (!recipe.burnStop) return 0;
  const lvl = skills.Cooking.level;
  if (lvl >= recipe.burnStop) return 0;
  const base = 0.45 * (recipe.burnStop - lvl) / (recipe.burnStop - recipe.level + 1);
  const less = perk(skills, 'Cooking', 'burnLess') + (player ? questFx(player, 'burnLess') : 0);
  return Math.max(0, base * (1 - Math.min(1, less)));
}
// Milestone perks for making things: 1 tick faster, and a chance of a free extra item.
export function makeTicks(recipe, skills) { return perk(skills, recipe.skill, 'fastMake') > 0 ? 2 : 3; }
export function doubleMakeChance(recipe, skills) { return perk(skills, recipe.skill, 'doubleMake'); }
// Multiplier on all XP from quests (+x% in a skill or all skills) and worn gear.
export function xpMultiplier(player, skill) {
  const gear = equipmentBonuses(player);
  return 1 + questFx(player, 'xp.' + skill) + questFx(player, 'xp.*') + (gear.xp[skill] || 0);
}
// Chance to keep the inputs for one make (perks + Provident Hands prayer).
export function saveChance(recipe, skills, player) {
  const key = recipe.skill === 'Smithing' ? 'saveBar' : 'saveMat';
  const fromPerk = recipe.skill === 'Cooking' ? 0 : perk(skills, recipe.skill, key);
  return Math.min(0.75, fromPerk + prayerFx(player, 'saveMat'));
}
export function makeXp(recipe, skills) {
  return recipe.xp * (1 + perk(skills, recipe.skill, 'xpBonus'));
}

// ---- Prayer: burying bones -----------------------------------------------
export function buryXp(item, skills) {
  const info = ITEMS[item];
  if (!info || !info.prayerXp) return 0;
  return info.prayerXp * (1 + perk(skills, 'Prayer', 'buryXp'));
}

// ---- Combat --------------------------------------------------------------
// ranged: true = attacks from a distance with arrows (your ranged defence counts).
export const MONSTER_TYPES = {
  'Dark Archer': { name: 'Dark Archer', level: 25, hp: 260, maxHit: 30, att: 24, def: 16, speed: 5, color: 0x2a3a2a, scale: 1.0, ranged: true, range: 6 },
  Goblin:        { name: 'Goblin',       level: 2,  hp: 50,  maxHit: 8,  att: 1,  def: 1,  speed: 4, color: 0x4a7a3a, scale: 0.85 },
  Cow:           { name: 'Cow',          level: 2,  hp: 80,  maxHit: 6,  att: 1,  def: 1,  speed: 4, color: 0x8a6a4a, scale: 1.0 },
  Guard:         { name: 'Guard',        level: 21, hp: 220, maxHit: 28, att: 18, def: 18, speed: 4, color: 0x3a3a6a, scale: 1.1 },
  'Hill Giant':  { name: 'Hill Giant',   level: 28, hp: 350, maxHit: 36, att: 22, def: 24, speed: 5, color: 0x8a7a5a, scale: 1.8 },
  'Black Knight':{ name: 'Black Knight', level: 33, hp: 420, maxHit: 42, att: 30, def: 34, speed: 4, color: 0x1a1a22, scale: 1.15 }
};

export const MELEE_STYLES = [
  { name: 'Accurate',   xp: ['Attack'],   att: 3, str: 0, def: 0 },
  { name: 'Aggressive', xp: ['Strength'], att: 0, str: 3, def: 0 },
  { name: 'Defensive',  xp: ['Defence'],  att: 0, str: 0, def: 3 },
  { name: 'Controlled', xp: ['Attack', 'Strength', 'Defence'], att: 1, str: 1, def: 1 }
];
export const RANGED_STYLES = [
  { name: 'Accurate',  xp: ['Ranged'], att: 3, str: 0, def: 0, speed: 0, range: 0 },
  { name: 'Rapid',     xp: ['Ranged'], att: 0, str: 0, def: 0, speed: -1, range: 0 },
  { name: 'Longrange', xp: ['Ranged', 'Defence'], att: 0, str: 0, def: 3, speed: 0, range: 2 }
];

export function stylesFor(player) {
  return isRangedWeapon(player.equipment.weapon) ? RANGED_STYLES : MELEE_STYLES;
}
export function currentStyle(player) {
  const list = stylesFor(player);
  return list[Math.min(list.length - 1, Math.max(0, player.attackStyle | 0))];
}

export const BONUS_KEYS = ['atk', 'str', 'ranged', 'rstr', 'def', 'rdef', 'prayer'];
// Totals of everything worn, plus extras and set bonus.
export function equipmentBonuses(player) {
  const b = { atk: 0, str: 0, ranged: 0, rstr: 0, def: 0, rdef: 0, prayer: 0, regen: 0, gather: {}, xp: {}, capeSkill: null };
  const eq = player.equipment || {};
  for (const [slot, item] of Object.entries(eq)) {
    const info = item && ITEMS[item];
    if (!info) continue;
    for (const k of BONUS_KEYS) b[k] += info[k] || 0;
    b.regen += info.regen || 0;
    for (const [sk, v] of Object.entries(info.gather || {})) b.gather[sk] = (b.gather[sk] || 0) + v;
    for (const [sk, v] of Object.entries(info.xp || {})) b.xp[sk] = (b.xp[sk] || 0) + v;
    if (info.capeSkill && slot === 'cape') b.capeSkill = info.capeSkill;
  }
  b.set = setStatus(player);
  return b;
}
// Which armour set you're closest to completing: { name, have, need, active, fx }.
export function setStatus(player) {
  const eq = player.equipment || {};
  let best = null;
  for (const [name, set] of Object.entries(SETS)) {
    const have = set.pieces.filter(sl => eq[sl] && ITEMS[eq[sl]] && ITEMS[eq[sl]].set === name).length;
    if (!have) continue;
    if (!best || have / set.pieces.length > best.have / best.need) best = { name, have, need: set.pieces.length, fx: set.fx };
  }
  if (best) best.active = best.have >= best.need;
  return best;
}
function setFx(player, key) { const st = setStatus(player); return st && st.active ? st.fx[key] || 0 : 0; }
// Skill capes: worn 99 cape boosts that skill's perks by 10%.
export function capeBoosts(player) {
  const c = player.equipment && player.equipment.cape;
  const sk = c && ITEMS[c] && ITEMS[c].capeSkill;
  return sk ? { [sk]: 0.1 } : {};
}
export function regenBonus(player) { return equipmentBonuses(player).regen; }

export function attackSpeedTicks(player) {
  const w = ITEMS[player.equipment.weapon];
  const style = currentStyle(player);
  return Math.max(2, (w && w.speed || 4) + (style.speed || 0));
}

export function attackRange(player) {
  if (isRangedWeapon(player.equipment.weapon)) return 7 + (currentStyle(player).range || 0);
  return 1.6;
}

export function hitChance(attRoll, defRoll) {
  return attRoll > defRoll ? 1 - (defRoll + 2) / (2 * (attRoll + 1)) : attRoll / (2 * (defRoll + 1));
}

// mods: { acc, dmg } extra multipliers from combat skills and buffs.
export function playerMaxHit(player, skills, mods = {}) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  let max;
  if (isRangedWeapon(player.equipment.weapon)) {
    const lvl = skills.Ranged.level * (1 + prayerFx(player, 'rng'));
    max = 8 + Math.floor((lvl + style.str) * 2) + b.rstr * 3 + perk(skills, 'Ranged', 'rmaxHit') + questFx(player, 'rmaxHit');
  } else {
    const lvl = skills.Strength.level * (1 + prayerFx(player, 'str'));
    max = 10 + Math.floor((lvl + style.str) * 2) + b.str * 3 + perk(skills, 'Strength', 'maxHit');
  }
  return Math.floor(max * (1 + (mods.dmg || 0)));
}

export function playerAccuracy(player, skills, mon, mods = {}) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const ranged = isRangedWeapon(player.equipment.weapon);
  const base = ranged ? skills.Ranged.level * (1 + prayerFx(player, 'rng')) : skills.Attack.level * (1 + prayerFx(player, 'att'));
  const lvl = base + style.att + 8;
  const att = lvl * Math.max(16, 64 + (ranged ? b.ranged : b.atk) * 3);
  const def = (mon.def + 8) * 64;
  const bonus = (ranged ? perk(skills, 'Ranged', 'racc') + setFx(player, 'racc') : perk(skills, 'Attack', 'acc') + setFx(player, 'acc')) + (mods.acc || 0);
  return Math.min(0.98, hitChance(att, def) * (1 + bonus));
}

export function monsterAccuracy(mon, player, skills) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const att = (mon.att + 8) * 64;
  // Arrows are stopped by ranged defence, swords and fists by melee defence.
  const armour = mon.ranged ? b.rdef : b.def;
  const def = (skills.Defence.level * (1 + prayerFx(player, 'def')) + style.def + 8) * Math.max(16, 64 + armour * 3);
  return hitChance(att, def);
}

// Player swings at a monster. Returns damage dealt (0 = blue splat).
export function rollPlayerHit(player, skills, mon, rng = Math.random, mods = {}) {
  let dmg = 0;
  if (rng() < playerAccuracy(player, skills, mon, mods)) {
    dmg = 1 + Math.floor(rng() * playerMaxHit(player, skills, mods));
    const ranged = isRangedWeapon(player.equipment.weapon);
    const crit = ranged ? perk(skills, 'Ranged', 'rcrit') : perk(skills, 'Strength', 'crit');
    if (rng() < crit) dmg = Math.floor(dmg * (1.5 + perk(skills, 'Strength', 'critMult')));
    dmg = Math.floor(dmg * damageMult(player, skills, mon));
  }
  return Math.min(dmg, mon.hp);
}
// Quest bonuses against a monster type, and Executioner against weakened targets.
export function damageMult(player, skills, mon) {
  let m = 1 + questFx(player, 'dmgVs.' + mon.name);
  if (mon.maxHp && mon.hp < mon.maxHp * 0.25 && !isRangedWeapon(player.equipment.weapon)) m += perk(skills, 'Strength', 'execute');
  return m;
}

// XP for damage dealt: 1.2 per point to the style's skill(s), plus 0.4 Hitpoints.
export function combatXp(player, dmg) {
  const style = currentStyle(player);
  const out = {};
  if (dmg <= 0) return out;
  const each = (dmg * 1.2) / style.xp.length;
  for (const s of style.xp) out[s] = (out[s] || 0) + each;
  out.Hitpoints = dmg * 0.4;
  return out;
}

export function rollMonsterHit(mon, player, skills, rng = Math.random) {
  if (rng() >= monsterAccuracy(mon, player, skills)) return 0;
  return Math.floor(rng() * (mon.maxHit + 1));
}

export const DR_CAP = 0.6; // hard cap on damage reduction from perks + quests + sets
// Damage you actually take after Defence perks, Protect from Melee and buffs.
export function reduceIncoming(dmg, player, skills, buffs = {}) {
  if (dmg <= 0) return 0;
  // Damage reduction from Defence perks, quests and armour sets (capped so nothing gets silly).
  let m = 1 - Math.min(DR_CAP, perk(skills, 'Defence', 'dr') + questFx(player, 'dr') + setFx(player, 'dr'));
  m *= 1 - prayerFx(player, 'protect');
  if (buffs.fortify) m *= 0.5;
  if (buffs.rage) m *= 1.1;
  return Math.max(0, Math.round(dmg * m));
}

// ---- Loot ----------------------------------------------------------------
// Each entry rolls separately. chance is 0-1, qty is [min, max]. Coins go to your gold.
export const LOOT_TABLES = {
  Goblin: [
    { item: 'Bones', chance: 1 },
    { item: 'Coins', chance: 0.5, qty: [1, 15] },
    { item: 'Copper ore', chance: 0.25 },
    { item: 'Tin ore', chance: 0.25 },
    { item: 'Raw shrimp', chance: 0.2 },
    { item: 'Feather', chance: 0.2, qty: [2, 6] },
    { item: 'Bronze axe', chance: 0.04 },
    { item: 'Bronze sword', chance: 0.06 },
    { item: 'Amulet of accuracy', chance: 0.01 }
  ],
  Cow: [
    { item: 'Bones', chance: 1 },
    { item: 'Cowhide', chance: 1 },
    { item: 'Raw beef', chance: 1 }
  ],
  Guard: [
    { item: 'Bones', chance: 1 },
    { item: 'Coins', chance: 0.7, qty: [10, 40] },
    { item: 'Iron ore', chance: 0.35, qty: [1, 2] },
    { item: 'Coal', chance: 0.25 },
    { item: 'Iron bar', chance: 0.12 },
    { item: 'Bronze arrows', chance: 0.1, qty: [5, 15] },
    { item: 'Iron pickaxe', chance: 0.04 },
    { item: 'Iron sword', chance: 0.04 },
    { item: 'Bronze shield', chance: 0.08 },
    { item: 'Holy symbol', chance: 0.02 },
    { item: 'Red cape', chance: 0.03 }
  ],
  'Hill Giant': [
    { item: 'Big bones', chance: 1 },
    { item: 'Coins', chance: 0.8, qty: [20, 80] },
    { item: 'Iron arrows', chance: 0.15, qty: [5, 20] },
    { item: 'Coal', chance: 0.2, qty: [1, 3] },
    { item: 'Steel bar', chance: 0.08 },
    { item: 'Steel axe', chance: 0.04 },
    { item: 'Steel full helm', chance: 0.03 },
    { item: 'Mithril ore', chance: 0.05 },
    { item: 'Amulet of strength', chance: 0.02 },
    { item: 'Warrior ring', chance: 0.01 }
  ],
  'Black Knight': [
    { item: 'Bones', chance: 1 },
    { item: 'Coins', chance: 0.8, qty: [30, 120] },
    { item: 'Steel arrows', chance: 0.12, qty: [5, 15] },
    { item: 'Mithril bar', chance: 0.05 },
    { item: 'Steel pickaxe', chance: 0.04 },
    { item: 'Mithril sword', chance: 0.02 },
    { item: 'Adamantite ore', chance: 0.02 },
    { item: 'Steel platelegs', chance: 0.03 },
    { item: 'Amulet of defence', chance: 0.02 },
    { item: 'Ring of regeneration', chance: 0.01 },
    { item: 'Amulet of glory', chance: 0.005 }
  ],
  'Dark Archer': [
    { item: 'Bones', chance: 1 },
    { item: 'Coins', chance: 0.7, qty: [15, 60] },
    { item: 'Iron arrows', chance: 0.5, qty: [5, 15] },
    { item: 'Feather', chance: 0.3, qty: [5, 15] },
    { item: 'Leather cowl', chance: 0.08 },
    { item: 'Hard leather body', chance: 0.03 },
    { item: 'Oak shortbow', chance: 0.04 },
    { item: 'Archer ring', chance: 0.01 }
  ]
};
export const RARE_DROPS = new Set(['Bronze sword', 'Iron sword', 'Bronze shield', 'Bronze axe', 'Iron pickaxe', 'Steel axe', 'Steel full helm',
  'Steel pickaxe', 'Mithril sword', 'Adamantite ore', 'Steel platelegs', 'Amulet of accuracy', 'Holy symbol', 'Red cape', 'Amulet of strength',
  'Warrior ring', 'Amulet of defence', 'Ring of regeneration', 'Amulet of glory', 'Hard leather body', 'Oak shortbow', 'Archer ring']);

export function rollLoot(monName, rng = Math.random) {
  const drops = [];
  for (const d of LOOT_TABLES[monName] || [{ item: 'Bones', chance: 1 }]) {
    if (rng() < d.chance) {
      const [lo, hi] = d.qty || [1, 1];
      drops.push({ item: d.item, qty: lo + Math.floor(rng() * (hi - lo + 1)) });
    }
  }
  return drops;
}

// ---- Shops ---------------------------------------------------------------
// Supply Run makes shops pay more; Farmer's Hides gives a discount when buying.
export function sellPrice(item, player = null) {
  const base = Math.max(1, Math.floor(itemValue(item) * 0.6) || 1);
  return player ? Math.max(1, Math.floor(base * (1 + questFx(player, 'sellBonus')))) : base;
}
export function buyPrice(price, player = null) {
  return player ? Math.max(1, Math.ceil(price * (1 - questFx(player, 'shopDiscount')))) : price;
}
// Shop entries can need a quest (`unlock`), all quests ('all') or a 99 skill (`skill99`).
export function stockVisible(entry, player, skills) {
  if (entry.unlock && !isDone(player, entry.unlock)) return false;
  if (entry.skill99 && (!skills || skills[entry.skill99].level < 99)) return false;
  return true;
}
export const SELL_PRICES = new Proxy({}, { get: (t, k) => sellPrice(k) });

// `unlock` = quest id needed before the item shows up.
export const SHOP_STOCK = [
  { item: 'Bronze sword', price: 40 },
  { item: 'Wooden shield', price: 25 },
  { item: 'Leather body', price: 60 },
  { item: 'Cooked shrimp', price: 8 },
  { item: 'Cooked trout', price: 20 },
  { item: 'Shortbow', price: 50 },
  { item: 'Bronze arrows', price: 2 },
  { item: 'Feather', price: 2 },
  { item: 'Flax', price: 4 },
  { item: 'Cooked lobster', price: 80, unlock: 'cook' },
  { item: 'Oak shortbow', price: 120, unlock: 'hides' },
  { item: 'Red cape', price: 20 }, { item: 'Blue cape', price: 20 },
  { item: 'Amulet of accuracy', price: 200 }, { item: 'Holy symbol', price: 300 },
  { item: 'Amulet of defence', price: 500 }, { item: 'Amulet of strength', price: 900 },
  { item: "Miner's ring", price: 900 }, { item: "Forester's ring", price: 900 }, { item: "Angler's ring", price: 900 },
  { item: 'Ring of regeneration', price: 2000, unlock: 'fallen' },
  { item: 'Quest point cape', price: 99, unlock: 'all' },
  ...SKILL_CAPE_SKILLS.map(sk => ({ item: `${sk} cape`, price: 99000, skill99: sk }))
];
export const TOOL_STOCK = [
  { item: 'Bronze axe', price: 16 }, { item: 'Bronze pickaxe', price: 20 },
  { item: 'Iron axe', price: 56 }, { item: 'Iron pickaxe', price: 70 },
  { item: 'Steel axe', price: 200 }, { item: 'Steel pickaxe', price: 250 },
  { item: 'Mithril axe', price: 520, unlock: 'doric' }, { item: 'Mithril pickaxe', price: 650, unlock: 'doric' },
  { item: 'Adamant axe', price: 1280, unlock: 'doric' }, { item: 'Adamant pickaxe', price: 1600, unlock: 'doric' },
  { item: 'Small fishing net', price: 5 }, { item: 'Fly fishing rod', price: 15 }, { item: 'Lobster pot', price: 40 }, { item: 'Harpoon', price: 60 },
  { item: 'Hammer', price: 3 }, { item: 'Knife', price: 3 }, { item: 'Needle', price: 2 }, { item: 'Tinderbox', price: 2 }
];

// ---- Items in hand ---------------------------------------------------------
export function healAmount(item, skills) {
  const info = ITEMS[item];
  if (!info || !info.heal) return 0;
  const bonus = skills ? Math.min(1, perk(skills, 'Hitpoints', 'healBonus') + perk(skills, 'Cooking', 'healBonus')) : 0;
  return Math.round(info.heal * HEAL_SCALE * (1 + bonus));
}

export function eat(player, item, onLog, skills = null) {
  const info = ITEMS[item];
  if (!info || info.type !== 'food') return false;
  if (!removeItem(player, item, 1)) return false;
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + healAmount(item, skills));
  onLog(`You eat the ${item.replace(/^Cooked /, '').toLowerCase()}. It heals ${player.hp - before} hitpoints.`, 'game');
  return true;
}

export function equip(player, skills, item, onLog) {
  const info = ITEMS[item];
  if (!info) return false;
  if (info.type === 'food') return eat(player, item, onLog, skills);
  const slot = slotFor(item);
  if (!slot) return false;
  if (info.req) {
    for (const [sk, lvl] of Object.entries(info.req)) {
      if (skills[sk].level < lvl) { onLog(`You need a ${sk} level of ${lvl} to wear this.`, 'warn'); return false; }
    }
  }
  if (info.questCape && !isDone(player, 'all')) { onLog('You need to complete every quest to wear this cape.', 'warn'); return false; }
  if (!player.equipment) player.equipment = {};
  const qty = slot === 'ammo' ? (player.inventory[item] || 0) : 1;
  if (!qty) return false;
  const old = player.equipment[slot];
  if (old && old !== item) {
    const oldQty = slot === 'ammo' ? (player.ammoCount || 0) : 1;
    removeItem(player, item, qty);
    addItem(player, old, oldQty);
    player.ammoCount = 0;
  } else {
    removeItem(player, item, qty);
  }
  if (slot === 'ammo') player.ammoCount = (old === item ? (player.ammoCount || 0) : 0) + qty;
  player.equipment[slot] = item;
  onLog(`You ${slot === 'weapon' ? 'wield' : 'wear'} the ${item}.`, 'game');
  return true;
}

export function unequip(player, slot, onLog) {
  const item = player.equipment[slot];
  if (!item) return false;
  const qty = slot === 'ammo' ? (player.ammoCount || 0) : 1;
  if (!canAdd(player, item)) { onLog('You don\'t have enough free inventory space.', 'warn'); return false; }
  addItem(player, item, qty);
  player.equipment[slot] = null;
  if (slot === 'ammo') player.ammoCount = 0;
  onLog(`You remove the ${item}.`, 'game');
  return true;
}
