// Pure game rules (no rendering), so they can be unit-tested in node.
import { addItem, removeItem, canAdd } from './playerState.js';
import { ITEMS, HEAL_SCALE, slotFor, isRangedWeapon } from './items.js';

export const TICK_MS = 600;

// ---- Gathering ----------------------------------------------------------
export const TREES = {
  Tree:   { level: 1,  xp: 25,   item: 'Logs',        deplete: 0.35, respawn: 9000 },
  Oak:    { level: 15, xp: 37.5, item: 'Oak logs',    deplete: 0.15, respawn: 14000 },
  Willow: { level: 30, xp: 67.5, item: 'Willow logs', deplete: 0.12, respawn: 14000 }
};
export const ROCKS = {
  Copper: { level: 1,  xp: 17.5, item: 'Copper ore', respawn: 4000 },
  Tin:    { level: 1,  xp: 17.5, item: 'Tin ore',    respawn: 4000 },
  Iron:   { level: 15, xp: 35,   item: 'Iron ore',   respawn: 7000 },
  Coal:   { level: 30, xp: 50,   item: 'Coal',       respawn: 20000 }
};
// A fishing spot offers several catches; the best one you can catch is rolled first.
export const FISH_SPOTS = {
  Net:  { verb: 'Net',  catches: [{ level: 1, xp: 20, item: 'Raw shrimp' }] },
  Lure: { verb: 'Lure', catches: [{ level: 30, xp: 70, item: 'Raw salmon' }, { level: 20, xp: 50, item: 'Raw trout' }] }
};

export function gatherInfo(node) {
  if (node.type === 'tree') return { skill: 'Woodcutting', ...TREES[node.kind] };
  if (node.type === 'rock') return { skill: 'Mining', ...ROCKS[node.ore] };
  if (node.type === 'fish') {
    const spot = FISH_SPOTS[node.kind];
    const min = spot.catches[spot.catches.length - 1];
    return { skill: 'Fishing', level: min.level, catches: spot.catches };
  }
  return null;
}

export function successChance(level, req) {
  return Math.max(0.05, Math.min(0.92, 0.3 + (level - req) * 0.025));
}

// One gathering attempt on a game tick. Returns { item, xp, depleted } on success,
// null on a failed roll, or { error } when the action can't continue.
export function gatherTick(node, skills, player, rng = Math.random) {
  const info = gatherInfo(node);
  if (!info) return { error: 'You can\'t do that.' };
  const lvl = skills[info.skill].level;
  if (lvl < info.level) return { error: `You need a ${info.skill} level of ${info.level} to do that.` };
  if (node.type === 'fish') {
    for (const c of info.catches) {
      if (lvl < c.level) continue;
      if (!canAdd(player, c.item)) return { error: 'Your inventory is too full to hold any more.' };
      if (rng() < successChance(lvl, c.level) * (c === info.catches[info.catches.length - 1] ? 1 : 0.6)) {
        return { item: c.item, xp: c.xp, skill: info.skill, depleted: false };
      }
    }
    return null;
  }
  if (!canAdd(player, info.item)) return { error: 'Your inventory is too full to hold any more.' };
  if (rng() >= successChance(lvl, info.level)) return null;
  const depleted = node.type === 'rock' ? true : rng() < info.deplete;
  return { item: info.item, xp: info.xp, skill: info.skill, depleted };
}

// ---- Combat --------------------------------------------------------------
export const MONSTER_TYPES = {
  Goblin: { name: 'Goblin', level: 2,  hp: 50,  maxHit: 8,  att: 1,  def: 1,  speed: 4, color: 0x4a7a3a, scale: 0.85 },
  Cow:    { name: 'Cow',    level: 2,  hp: 80,  maxHit: 6,  att: 1,  def: 1,  speed: 4, color: 0x8a6a4a, scale: 1.0 },
  Guard:  { name: 'Guard',  level: 21, hp: 220, maxHit: 28, att: 18, def: 18, speed: 4, color: 0x3a3a6a, scale: 1.1 }
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

export function playerMaxHit(player, skills) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  if (isRangedWeapon(player.equipment.weapon)) {
    return 8 + Math.floor((skills.Ranged.level + style.str) * 2) + b.rstr * 3;
  }
  return 10 + Math.floor((skills.Strength.level + style.str) * 2) + b.str * 3;
}

export function playerAccuracy(player, skills, mon) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const ranged = isRangedWeapon(player.equipment.weapon);
  const lvl = (ranged ? skills.Ranged.level : skills.Attack.level) + style.att + 8;
  const att = lvl * (64 + (ranged ? b.ranged : b.atk) * 3);
  const def = (mon.def + 8) * 64;
  return hitChance(att, def);
}

export function monsterAccuracy(mon, player, skills) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const att = (mon.att + 8) * 64;
  const def = (skills.Defence.level + style.def + 8) * (64 + b.def * 3);
  return hitChance(att, def);
}

// Player swings at a monster. Returns damage dealt (0 = blue splat) and XP gained.
export function rollPlayerHit(player, skills, mon, rng = Math.random) {
  let dmg = 0;
  if (rng() < playerAccuracy(player, skills, mon)) dmg = 1 + Math.floor(rng() * playerMaxHit(player, skills));
  if (player.skillTrees && player.skillTrees.Attack.powerStrike && dmg > 0) dmg += 2;
  dmg = Math.min(dmg, mon.hp);
  return dmg;
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
    { item: 'Iron sword', chance: 0.04 },
    { item: 'Bronze shield', chance: 0.08 }
  ]
};
export const RARE_DROPS = new Set(['Bronze sword', 'Iron sword', 'Bronze shield']);

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

// ---- Shop ----------------------------------------------------------------
export const SELL_PRICES = {
  'Copper ore': 3, 'Tin ore': 3, 'Iron ore': 10, 'Logs': 2, 'Oak logs': 6, 'Willow logs': 12,
  'Raw shrimp': 5, 'Raw trout': 12, 'Raw salmon': 18, 'Cooked shrimp': 4, 'Cooked trout': 10, 'Cooked salmon': 15,
  'Bronze sword': 15, 'Wooden shield': 10, 'Bronze shield': 20,
  'Bones': 2, 'Cowhide': 6, 'Raw beef': 3, 'Cooked meat': 4, 'Feather': 1,
  'Coal': 12, 'Bronze bar': 8, 'Iron bar': 25, 'Steel bar': 50, 'Iron sword': 35, 'Steel sword': 80,
  'Soft leather': 10, 'Leather body': 25, 'Shortbow': 20, 'Oak shortbow': 40,
  'Bronze arrows': 1, 'Iron arrows': 2, 'Bronze platebody': 60, 'Iron platebody': 110, 'Bowstring': 5, 'Flax': 2
};
export function sellPrice(item) { return SELL_PRICES[item] || 1; }

export const SHOP_STOCK = [
  { item: 'Bronze sword', price: 40 },
  { item: 'Wooden shield', price: 25 },
  { item: 'Cooked shrimp', price: 8 },
  { item: 'Shortbow', price: 50 },
  { item: 'Bronze arrows', price: 2 },
  { item: 'Leather body', price: 60 },
  { item: 'Flax', price: 4 }
];

// ---- Items in hand ---------------------------------------------------------
export function eat(player, item, onLog) {
  const info = ITEMS[item];
  if (!info || info.type !== 'food') return false;
  if (!removeItem(player, item, 1)) return false;
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + (info.heal || 3) * HEAL_SCALE);
  onLog(`You eat the ${item.replace(/^Cooked /, '').toLowerCase()}. It heals ${player.hp - before} hitpoints.`, 'game');
  return true;
}

export function equip(player, skills, item, onLog) {
  const info = ITEMS[item];
  if (!info) return false;
  if (info.type === 'food') return eat(player, item, onLog);
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
  if (!canAdd(player, item, slot === 'ammo' ? 1 : 1)) { onLog('You don\'t have enough free inventory space.', 'warn'); return false; }
  addItem(player, item, qty);
  player.equipment[slot] = null;
  if (slot === 'ammo') player.ammoCount = 0;
  onLog(`You remove the ${item}.`, 'game');
  return true;
}
