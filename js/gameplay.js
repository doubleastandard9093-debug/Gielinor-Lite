// Pure game rules (no rendering), so they can be unit-tested in node.
import { addItem, removeItem, canAdd } from './playerState.js';
import { ITEMS, HEAL_SCALE, slotFor, isRangedWeapon, itemValue, isTool, toolType, FOODS } from './items.js';
import { perk } from './skills.js';
import { prayerFx } from './prayer.js';

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
  const bonus = (ITEMS[tool].toolTier || 0) * 0.05 + perk(skills, info.skill, 'speed') + prayerFx(player, 'gather');
  const xpMult = 1 + prayerFx(player, 'gather');
  const doubled = () => (rng() < perk(skills, info.skill, 'double') ? 2 : 1);
  if (node.type === 'fish') {
    for (const c of info.catches) {
      if (lvl < c.level) continue;
      if (!canAdd(player, c.item)) return { error: 'Your inventory is too full to hold any more.' };
      const last = c === info.catches[info.catches.length - 1];
      if (rng() < Math.min(0.95, successChance(lvl, c.level) + bonus) * (last ? 1 : 0.6)) {
        return { item: c.item, qty: doubled(), xp: c.xp * xpMult, skill: info.skill, depleted: false };
      }
    }
    return null;
  }
  if (!canAdd(player, info.item)) return { error: 'Your inventory is too full to hold any more.' };
  if (rng() >= Math.min(0.95, successChance(lvl, info.level) + bonus)) return null;
  const depleted = node.type === 'rock' ? true : rng() < info.deplete;
  return { item: info.item, qty: doubled(), xp: info.xp * xpMult, skill: info.skill, depleted };
}

// ---- Making things ---------------------------------------------------------
export function burnChance(recipe, skills) {
  if (!recipe.burnStop) return 0;
  const lvl = skills.Cooking.level;
  if (lvl >= recipe.burnStop) return 0;
  const base = 0.45 * (recipe.burnStop - lvl) / (recipe.burnStop - recipe.level + 1);
  return Math.max(0, base * (1 - Math.min(1, perk(skills, 'Cooking', 'burnLess'))));
}
// Chance to keep the inputs for one make (perks + Provident Hands prayer).
export function saveChance(recipe, skills, player) {
  const key = recipe.skill === 'Smithing' ? 'saveBar' : 'saveMat';
  const fromPerk = recipe.skill === 'Cooking' ? 0 : perk(skills, recipe.skill, key);
  return fromPerk + prayerFx(player, 'saveMat');
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
export const MONSTER_TYPES = {
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

export function equipmentBonuses(player) {
  const b = { atk: 0, str: 0, ranged: 0, rstr: 0, def: 0 };
  for (const item of Object.values(player.equipment || {})) {
    const info = item && ITEMS[item];
    if (!info) continue;
    for (const k of Object.keys(b)) b[k] += info[k] || 0;
  }
  return b;
}

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
    max = 8 + Math.floor((lvl + style.str) * 2) + b.rstr * 3 + perk(skills, 'Ranged', 'rmaxHit');
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
  const att = lvl * (64 + (ranged ? b.ranged : b.atk) * 3);
  const def = (mon.def + 8) * 64;
  const bonus = (ranged ? perk(skills, 'Ranged', 'racc') : perk(skills, 'Attack', 'acc')) + (mods.acc || 0);
  return Math.min(0.98, hitChance(att, def) * (1 + bonus));
}

export function monsterAccuracy(mon, player, skills) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const att = (mon.att + 8) * 64;
  const def = (skills.Defence.level * (1 + prayerFx(player, 'def')) + style.def + 8) * (64 + b.def * 3);
  return hitChance(att, def);
}

// Player swings at a monster. Returns damage dealt (0 = blue splat).
export function rollPlayerHit(player, skills, mon, rng = Math.random, mods = {}) {
  let dmg = 0;
  if (rng() < playerAccuracy(player, skills, mon, mods)) {
    dmg = 1 + Math.floor(rng() * playerMaxHit(player, skills, mods));
    if (!isRangedWeapon(player.equipment.weapon) && rng() < perk(skills, 'Strength', 'crit')) dmg = Math.floor(dmg * 1.5);
  }
  return Math.min(dmg, mon.hp);
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

// Damage you actually take after Defence perks, Protect from Melee and buffs.
export function reduceIncoming(dmg, player, skills, buffs = {}) {
  if (dmg <= 0) return 0;
  let m = 1 - perk(skills, 'Defence', 'dr');
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
    { item: 'Bronze sword', chance: 0.06 }
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
    { item: 'Bronze shield', chance: 0.08 }
  ],
  'Hill Giant': [
    { item: 'Big bones', chance: 1 },
    { item: 'Coins', chance: 0.8, qty: [20, 80] },
    { item: 'Iron arrows', chance: 0.15, qty: [5, 20] },
    { item: 'Coal', chance: 0.2, qty: [1, 3] },
    { item: 'Steel bar', chance: 0.08 },
    { item: 'Steel axe', chance: 0.04 },
    { item: 'Steel full helm', chance: 0.03 },
    { item: 'Mithril ore', chance: 0.05 }
  ],
  'Black Knight': [
    { item: 'Bones', chance: 1 },
    { item: 'Coins', chance: 0.8, qty: [30, 120] },
    { item: 'Steel arrows', chance: 0.12, qty: [5, 15] },
    { item: 'Mithril bar', chance: 0.05 },
    { item: 'Steel pickaxe', chance: 0.04 },
    { item: 'Mithril sword', chance: 0.02 },
    { item: 'Adamantite ore', chance: 0.02 },
    { item: 'Steel platelegs', chance: 0.03 }
  ]
};
export const RARE_DROPS = new Set(['Bronze sword', 'Iron sword', 'Bronze shield', 'Bronze axe', 'Iron pickaxe', 'Steel axe', 'Steel full helm',
  'Steel pickaxe', 'Mithril sword', 'Adamantite ore', 'Steel platelegs']);

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
export function sellPrice(item) { return Math.max(1, Math.floor(itemValue(item) * 0.6) || 1); }
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
  { item: 'Oak shortbow', price: 120, unlock: 'hides' }
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
  const bonus = skills ? perk(skills, 'Hitpoints', 'healBonus') + perk(skills, 'Cooking', 'healBonus') : 0;
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
