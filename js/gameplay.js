// Pure game rules (no rendering), so they can be unit-tested in node.
import { addItem, removeItem, canAdd } from './playerState.js';
import { ITEMS, HEAL_SCALE, slotFor, isRangedWeapon, itemValue, isTool, toolType, FOODS, SETS, SKILL_CAPE_SKILLS, HERBS, grimyOf, METALS, RUNES } from './items.js';
import { boostedLevel, effectFx } from './potions.js';
import { perk, maxPrayer } from './skills.js';
import { prayerFx } from './prayer.js';
import { questFx, isDone, questCapeAllowed } from './quests.js';

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
  Runite:     { level: 85, xp: 125,  item: 'Runite ore',     respawn: 90000 },
  Dragon:     { level: 95, xp: 180,  item: 'Dragon ore',     respawn: 120000 },
  // Rune essence rocks (Varrock mine and a pair near Brightwater): Pure essence from Mining 30.
  Essence:    { level: 1,  xp: 5,    item: 'Rune essence',   respawn: 1000, pureAt: 30, pure: 'Pure essence' }
};
// Herb patches: pick grimy herbs. Never run out.
export const HERB_PATCHES = Object.fromEntries(HERBS.map(([h, lvl, xp]) => [h, { level: lvl, xp: Math.round(xp * 3 * 10) / 10, item: grimyOf(h) }]));
// A fishing spot offers several catches; the best one you can catch is rolled first.
export const FISH_SPOTS = {
  Net:     { verb: 'Net',     tool: 'net',     catches: [{ level: 62, xp: 120, item: 'Raw monkfish' }, { level: 15, xp: 40, item: 'Raw anchovies' }, { level: 1, xp: 20, item: 'Raw shrimp' }] },
  Lure:    { verb: 'Lure',    tool: 'rod',     catches: [{ level: 30, xp: 70, item: 'Raw salmon' }, { level: 20, xp: 50, item: 'Raw trout' }] },
  Cage:    { verb: 'Cage',    tool: 'cage',    catches: [{ level: 40, xp: 90, item: 'Raw lobster' }] },
  Harpoon: { verb: 'Harpoon', tool: 'harpoon', catches: [{ level: 76, xp: 110, item: 'Raw shark' }, { level: 50, xp: 100, item: 'Raw swordfish' }, { level: 35, xp: 80, item: 'Raw tuna' }] }
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
  if (node.type === 'herb') return { skill: 'Herblore', tool: null, ...HERB_PATCHES[node.herb] };
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
  const tool = info.tool ? bestTool(player, skills, info.tool) : 'hands';
  if (!tool) {
    return { error: ownsToolType(player, info.tool) ? `Your ${info.tool} needs a higher ${info.skill} level.` : `You need ${toolName(info.tool)} on your toolbelt. The tool shop sells one.` };
  }
  const gear = equipmentBonuses(player);
  const bonus = ((ITEMS[tool] && ITEMS[tool].toolTier) || 0) * 0.05 + perk(skills, info.skill, 'speed') + prayerFx(player, 'gather') +
    (gear.gather[info.skill] || 0) + questFx(player, 'gather') + effectFx(player, 'gather');
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
  const item = info.pureAt && lvl >= info.pureAt ? info.pure : info.item;
  if (!canAdd(player, item)) return { error: 'Your inventory is too full to hold any more.' };
  if (rng() >= Math.min(0.95, successChance(lvl, info.level) + bonus)) return null;
  // Resources are infinite: trees, rocks and herb patches never run out.
  return { item, qty: doubled(), xp: info.xp * xpMult, skill: info.skill, depleted: false, bank: banked() };
}
// Chain Chop / Rich Vein / Quick Picker: chance the next attempt comes 1 tick sooner (never below 1 tick).
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
  return 1 + questFx(player, 'xp.' + skill) + questFx(player, 'xp.*') + (gear.xp[skill] || 0) + effectFx(player, 'xp');
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
// poison: { chance, dmg }; boss: true (long respawn); respawn in ms; shape: humanoid (default), quad, spider, dragon.
export const MONSTER_TYPES = {
  Wolf:          { name: 'Wolf',          level: 14, hp: 140, maxHit: 18, att: 12, def: 10, speed: 4, color: 0x7a7a80, scale: 0.9, shape: 'quad' },
  Zombie:        { name: 'Zombie',        level: 18, hp: 200, maxHit: 20, att: 14, def: 12, speed: 5, color: 0x4a5a3a, scale: 1.0, skin: 0x7a9a6a },
  Skeleton:      { name: 'Skeleton',      level: 22, hp: 220, maxHit: 24, att: 18, def: 16, speed: 4, color: 0xd8d8c8, scale: 1.0, skin: 0xe8e8d8 },
  'Giant Spider':{ name: 'Giant Spider',  level: 27, hp: 280, maxHit: 22, att: 22, def: 18, speed: 4, color: 0x2a2a2a, scale: 1.1, shape: 'spider', poison: { chance: 0.25, dmg: 20 } },
  Bandit:        { name: 'Bandit',        level: 30, hp: 300, maxHit: 30, att: 26, def: 22, speed: 4, color: 0x5a4a3a, scale: 1.0, skin: 0xc89a74 },
  'Moss Giant':  { name: 'Moss Giant',    level: 42, hp: 450, maxHit: 40, att: 32, def: 30, speed: 5, color: 0x3a6a2a, scale: 1.9, skin: 0x6a9a4a },
  Ogre:          { name: 'Ogre',          level: 53, hp: 600, maxHit: 50, att: 40, def: 36, speed: 5, color: 0x6a5a2a, scale: 1.7, skin: 0x8a9a5a },
  'Ice Giant':   { name: 'Ice Giant',     level: 53, hp: 650, maxHit: 48, att: 40, def: 40, speed: 5, color: 0x8ab0d0, scale: 1.9, skin: 0xb0d0f0 },
  'Green Dragon':{ name: 'Green Dragon',  level: 79, hp: 750, maxHit: 80, att: 60, def: 55, speed: 4, color: 0x2a7a2a, scale: 1.6, shape: 'dragon' },
  'Lesser Demon':{ name: 'Lesser Demon',  level: 82, hp: 790, maxHit: 80, att: 65, def: 50, speed: 4, color: 0x9a1a1a, scale: 1.6, skin: 0xb02a2a },
  Grumsh:        { name: 'Grumsh', title: 'Grumsh the Ogre Chieftain', level: 90, hp: 1600, maxHit: 90, att: 70, def: 60, speed: 5, color: 0x5a3a1a, scale: 2.4, skin: 0x7a8a4a, boss: true, respawn: 180000 },
  Scorchwing:    { name: 'Scorchwing', title: 'Scorchwing the Green Wyrm', level: 150, hp: 3000, maxHit: 140, att: 110, def: 100, speed: 5, color: 0x1a5a2a, scale: 2.6, shape: 'dragon', boss: true, respawn: 300000, ranged: true, range: 5 },
  'Dark Archer': { name: 'Dark Archer', level: 25, hp: 260, maxHit: 30, att: 24, def: 16, speed: 5, color: 0x2a3a2a, scale: 1.0, ranged: true, range: 6 },
  Goblin:        { name: 'Goblin',       level: 2,  hp: 50,  maxHit: 8,  att: 1,  def: 1,  speed: 4, color: 0x4a7a3a, scale: 0.85 },
  Cow:           { name: 'Cow',          level: 2,  hp: 80,  maxHit: 6,  att: 1,  def: 1,  speed: 4, color: 0x8a6a4a, scale: 1.0 },
  Guard:         { name: 'Guard',        level: 21, hp: 220, maxHit: 28, att: 18, def: 18, speed: 4, color: 0x3a3a6a, scale: 1.1 },
  'Hill Giant':  { name: 'Hill Giant',   level: 28, hp: 350, maxHit: 36, att: 22, def: 24, speed: 5, color: 0x8a7a5a, scale: 1.8 },
  'Black Knight':{ name: 'Black Knight', level: 33, hp: 420, maxHit: 42, att: 30, def: 34, speed: 4, color: 0x1a1a22, scale: 1.15 },
  // Sails of Sarim: the Drowned Crew of Wreckers' Reef (undead; silver shot bites them harder)
  'Drowned Deckhand': { name: 'Drowned Deckhand', level: 24, hp: 240, maxHit: 26, att: 20, def: 16, speed: 4, color: 0x3a5a5a, scale: 1.0, skin: 0x7aa898, undead: true, drowned: true },
  'Drowned Gunner':   { name: 'Drowned Gunner', level: 34, hp: 320, maxHit: 34, att: 28, def: 20, speed: 5, color: 0x4a3a2a, scale: 1.05, skin: 0x6a9a8a, ranged: true, range: 6, undead: true, drowned: true },
  'Captain Saltgrave':{ name: 'Captain Saltgrave', title: 'Captain Saltgrave of the Drowned Crew', level: 72, hp: 1500, maxHit: 64, att: 56, def: 48, speed: 4, color: 0x2a1a3a, scale: 1.35, skin: 0x5a8a7a, boss: true, respawn: 180000, undead: true, drowned: true }
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

export const BONUS_KEYS = ['atk', 'str', 'ranged', 'rstr', 'def', 'rdef', 'prayer', 'mag'];
// Specials from unique items, added up from everything worn.
export function gearEffects(player) {
  const out = {};
  for (const it of Object.values(player.equipment || {})) {
    const e = it && ITEMS[it] && ITEMS[it].eff;
    if (!e) continue;
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === 'number') out[k] = (out[k] || 0) + v;
      else out[k] = v;
    }
  }
  return out;
}
// Totals of everything worn, plus extras and set bonus.
export function equipmentBonuses(player) {
  const b = { atk: 0, str: 0, ranged: 0, rstr: 0, def: 0, rdef: 0, prayer: 0, mag: 0, regen: 0, gather: {}, xp: {}, capeSkill: null };
  const eq = player.equipment || {};
  for (const [slot, item] of Object.entries(eq)) {
    const info = item && ITEMS[item];
    if (!info) continue;
    const wm = player.wear && player.wear[item] >= 100 ? 0.7 : 1; // fully worn top-tier gear (economy.js)
    for (const k of BONUS_KEYS) b[k] += Math.floor((info[k] || 0) * wm);
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
export function setFx(player, key) { const st = setStatus(player); return st && st.active ? st.fx[key] || 0 : 0; }
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
    const lvl = boostedLevel(player, skills, 'Ranged') * (1 + prayerFx(player, 'rng'));
    max = 8 + Math.floor((lvl + style.str) * 2) + b.rstr * 3 + perk(skills, 'Ranged', 'rmaxHit') + questFx(player, 'rmaxHit');
  } else {
    const lvl = boostedLevel(player, skills, 'Strength') * (1 + prayerFx(player, 'str'));
    max = 10 + Math.floor((lvl + style.str) * 2) + b.str * 3 + perk(skills, 'Strength', 'maxHit');
  }
  return Math.floor(max * (1 + (mods.dmg || 0)));
}

export function playerAccuracy(player, skills, mon, mods = {}) {
  const b = equipmentBonuses(player);
  const style = currentStyle(player);
  const ranged = isRangedWeapon(player.equipment.weapon);
  const base = ranged ? boostedLevel(player, skills, 'Ranged') * (1 + prayerFx(player, 'rng')) : boostedLevel(player, skills, 'Attack') * (1 + prayerFx(player, 'att'));
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
  const def = (boostedLevel(player, skills, 'Defence') * (1 + prayerFx(player, 'def')) + style.def + 8) * Math.max(16, 64 + armour * 3);
  return hitChance(att, def);
}

// Player swings at a monster. Returns damage dealt (0 = blue splat).
export function rollPlayerHit(player, skills, mon, rng = Math.random, mods = {}) {
  let dmg = 0;
  if (rng() < playerAccuracy(player, skills, mon, mods)) {
    dmg = 1 + Math.floor(rng() * playerMaxHit(player, skills, mods));
    const ranged = isRangedWeapon(player.equipment.weapon);
    const crit = Math.min(0.75, (ranged ? perk(skills, 'Ranged', 'rcrit') : perk(skills, 'Strength', 'crit')) + (gearEffects(player).crit || 0));
    if (rng() < crit) dmg = Math.floor(dmg * (1.5 + perk(skills, 'Strength', 'critMult')));
    const ge = gearEffects(player);
    if (ge.bigHit && rng() < ge.bigHit) { dmg = Math.floor(dmg * 1.5); mods.procs = (mods.procs || []).concat('bigHit'); }
    dmg = Math.floor(dmg * damageMult(player, skills, mon));
  }
  return Math.min(dmg, mon.hp);
}
// Unique weapon specials after a hit lands: { again, heal, poison, stun } (see items.js `eff`).
export function weaponProcs(player, dmg, rng = Math.random) {
  const e = gearEffects(player), out = { again: false, heal: 0, poison: 0, stun: false };
  if (dmg <= 0) return out;
  if (e.doubleHit && rng() < e.doubleHit) out.again = true;
  if (e.lifesteal) out.heal = Math.floor(dmg * e.lifesteal);
  if (e.poison && rng() < e.poison.chance) out.poison = e.poison.dmg;
  if (e.stun && rng() < e.stun) out.stun = true;
  return out;
}
// Quest bonuses against a monster type, and Executioner against weakened targets.
export function damageMult(player, skills, mon) {
  let m = 1 + questFx(player, 'dmgVs.' + mon.name) + questFx(player, 'dmgVs.*') + (gearEffects(player).dmgPct || 0) + setFx(player, 'dmgPct');
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
// herbs: [...] = one random grimy herb from the list.
const LOW_HERBS = ['Guam leaf', 'Marrentill', 'Tarromin'];
const MID_HERBS = ['Harralander', 'Ranarr weed', 'Toadflax', 'Irit leaf'];
const HIGH_HERBS = ['Avantoe', 'Kwuarm', 'Snapdragon', 'Cadantine', 'Dwarf weed', 'Torstol'];
export const LOOT_TABLES = {
  'Drowned Deckhand': [
    { item: 'Bones', chance: 1 }, { item: 'Coins', chance: 0.6, qty: [10, 45] }, { item: 'Lead shot', chance: 0.2, qty: [3, 10] },
    { item: 'Treasure chart', chance: 0.06 }, { item: 'Iron cutlass', chance: 0.04 }, { item: 'Raw swordfish', chance: 0.1 }
  ],
  'Drowned Gunner': [
    { item: 'Bones', chance: 1 }, { item: 'Coins', chance: 0.6, qty: [20, 70] }, { item: 'Lead shot', chance: 0.4, qty: [5, 15] },
    { item: 'Treasure chart', chance: 0.09 }, { item: 'Iron flintlock', chance: 0.03 }, { item: 'Silver shot', chance: 0.1, qty: [2, 6] }
  ],
  'Captain Saltgrave': [
    { item: 'Big bones', chance: 1 }, { item: 'Coins', chance: 1, qty: [400, 1200] }, { item: 'Treasure chart', chance: 0.5 },
    { item: 'Silver shot', chance: 0.5, qty: [10, 25] }, { item: 'Bone rune', chance: 0.4, qty: [10, 30] }, { item: "Saltgrave's tricorn", chance: 1 / 20 }, { item: 'Tidecaller cutlass', chance: 1 / 40 }
  ],
  Wolf: [
    { item: 'Bones', chance: 1 }, { item: 'Goat horn dust', chance: 0.15 }, { item: 'White berries', chance: 0.1 },
    { herbs: LOW_HERBS, chance: 0.2 }, { item: 'Raw beef', chance: 0.3 }, { item: 'Coins', chance: 0.3, qty: [3, 15] }
  ],
  Zombie: [
    { item: 'Bones', chance: 1 }, { item: 'Coins', chance: 0.5, qty: [5, 25] }, { item: 'Eye of newt', chance: 0.25, qty: [1, 3] },
    { herbs: LOW_HERBS, chance: 0.25 }, { item: 'Iron ore', chance: 0.1 }, { item: 'Vampyric blade', chance: 1 / 120 }
  ],
  Skeleton: [
    { item: 'Bones', chance: 1 }, { item: 'Coins', chance: 0.6, qty: [8, 35] }, { item: 'Snape grass', chance: 0.15 }, { item: 'Iron arrows', chance: 0.15, qty: [5, 12] },
    { herbs: [...LOW_HERBS, 'Harralander'], chance: 0.25 }, { item: 'Steel full helm', chance: 0.02 }, { item: 'Vampyric blade', chance: 1 / 150 }
  ],
  'Giant Spider': [
    { item: 'Red spider eggs', chance: 0.6, qty: [1, 2] }, { item: 'Coins', chance: 0.4, qty: [5, 30] }, { herbs: [...LOW_HERBS, ...MID_HERBS.slice(0, 2)], chance: 0.25 },
    { item: 'Venom dagger', chance: 1 / 80 }
  ],
  Bandit: [
    { item: 'Bones', chance: 1 }, { item: 'Coins', chance: 0.9, qty: [20, 80] }, { item: 'Chocolate dust', chance: 0.15 }, { item: 'Unicorn horn dust', chance: 0.08 },
    { herbs: MID_HERBS, chance: 0.2 }, { item: 'Wine of zamorak', chance: 0.03 }, { item: 'Steel arrows', chance: 0.15, qty: [5, 15] },
    { item: 'Ring of recoil', chance: 1 / 60 }, { item: "Captain's cutlass", chance: 1 / 400 }
  ],
  'Moss Giant': [
    { item: 'Big bones', chance: 1 }, { item: 'Coins', chance: 0.8, qty: [30, 100] }, { item: 'Limpwurt root', chance: 0.25 }, { item: 'Snape grass', chance: 0.2 },
    { herbs: MID_HERBS, chance: 0.35 }, { item: 'Mithril ore', chance: 0.08 }, { item: 'Mithril sword', chance: 0.02 }
  ],
  Ogre: [
    { item: 'Big bones', chance: 1 }, { item: 'Coins', chance: 0.8, qty: [40, 140] }, { item: 'Limpwurt root', chance: 0.25 }, { item: 'Goat horn dust', chance: 0.2 },
    { herbs: [...MID_HERBS, 'Avantoe', 'Kwuarm'], chance: 0.35 }, { item: 'Adamantite ore', chance: 0.05 }, { item: 'Granite maul', chance: 1 / 80 }
  ],
  'Ice Giant': [
    { item: 'Big bones', chance: 1 }, { item: 'Coins', chance: 0.8, qty: [40, 150] }, { item: 'White berries', chance: 0.3 }, { item: 'Raw shark', chance: 0.05 },
    { herbs: [...MID_HERBS, 'Avantoe', 'Kwuarm', 'Snapdragon'], chance: 0.35 }, { item: 'Adamant platelegs', chance: 0.02 }, { item: 'Berserker ring', chance: 1 / 200 }
  ],
  'Green Dragon': [
    { item: 'Dragon bones', chance: 1 }, { item: 'Coins', chance: 0.9, qty: [80, 300] }, { item: 'Dragon scale dust', chance: 0.4 },
    { item: 'Dragon ore', chance: 0.08 }, { item: 'Dragon sword', chance: 0.015 }, { item: 'Dragon platelegs', chance: 0.008 },
    { herbs: HIGH_HERBS, chance: 0.3 }, { item: 'Rune arrows', chance: 0.1, qty: [5, 15] }, { item: 'Dragon dagger', chance: 1 / 40 }, { item: 'Dragon longsword', chance: 1 / 120 }
  ],
  'Lesser Demon': [
    { item: 'Big bones', chance: 1 }, { item: 'Coins', chance: 0.9, qty: [100, 350] }, { item: 'Wine of zamorak', chance: 0.3 },
    { herbs: HIGH_HERBS, chance: 0.35 }, { item: 'Rune full helm', chance: 0.02 }, { item: 'Obsidian cape', chance: 1 / 100 }, { item: 'Dark bow', chance: 1 / 120 }
  ],
  Grumsh: [
    { item: 'Big bones', chance: 1, qty: [2, 3] }, { item: 'Coins', chance: 1, qty: [500, 1500] }, { herbs: HIGH_HERBS, chance: 1 }, { item: 'Limpwurt root', chance: 1, qty: [3, 6] },
    { item: 'Granite maul', chance: 1 / 8 }, { item: 'Berserker ring', chance: 1 / 6 }, { item: 'Obsidian cape', chance: 1 / 10 }, { item: 'Rune platelegs', chance: 0.1 }
  ],
  Scorchwing: [
    { item: 'Dragon bones', chance: 1, qty: [3, 5] },
    { item: 'Dragon ore', chance: 0.25 }, { item: 'Dragon sword', chance: 0.06 }, { item: 'Dragon full helm', chance: 0.03 }, { item: 'Dragon platebody', chance: 0.02 },
    { item: 'Coins', chance: 1, qty: [2000, 5000] }, { item: 'Dragon scale dust', chance: 1, qty: [3, 8] }, { herbs: ['Torstol', 'Dwarf weed', 'Snapdragon'], chance: 1 },
    { item: 'Wyrmscale helm', chance: 1 / 5 }, { item: 'Wyrmscale body', chance: 1 / 6 }, { item: 'Wyrmscale legs', chance: 1 / 6 }, { item: 'Wyrmscale shield', chance: 1 / 5 },
    { item: 'Dragon longsword', chance: 1 / 6 }, { item: 'Dark bow', chance: 1 / 15 }
  ],
  Goblin: [
    { herbs: ['Guam leaf', 'Marrentill'], chance: 0.1 },
    { item: 'Eye of newt', chance: 0.08 },
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
    { item: 'Bones', chance: 1 }, { herbs: ['Guam leaf'], chance: 0.05 },
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
    { item: 'Big bones', chance: 1 }, { item: 'Limpwurt root', chance: 0.2 }, { herbs: [...LOW_HERBS, ...MID_HERBS], chance: 0.2 },
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
    { item: 'Bones', chance: 1 }, { herbs: MID_HERBS, chance: 0.2 }, { item: 'Wine of zamorak', chance: 0.05 },
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
    { item: 'Bones', chance: 1 }, { herbs: [...LOW_HERBS, 'Harralander'], chance: 0.15 }, { item: 'White berries', chance: 0.1 },
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

export function rollLoot(monName, rng = Math.random, rareBoost = 0) {
  const drops = [];
  for (const d of LOOT_TABLES[monName] || [{ item: 'Bones', chance: 1 }]) {
    if (rng() < (d.chance < 0.1 ? d.chance * (1 + rareBoost) : d.chance)) {
      const [lo, hi] = d.qty || [1, 1];
      const item = d.herbs ? grimyOf(d.herbs[Math.floor(rng() * d.herbs.length) % d.herbs.length]) : d.item;
      drops.push({ item, qty: lo + Math.floor(rng() * (hi - lo + 1)) });
    }
  }
  return drops;
}
// Unique and rare items get a coloured announcement in chat.
export function isRareDrop(item) { return RARE_DROPS.has(item) || !!(ITEMS[item] && ITEMS[item].unique); }

// ---- Shops ---------------------------------------------------------------
// Supply Run makes shops pay more; Farmer's Hides gives a discount when buying.
export function sellPrice(item, player = null) {
  const base = Math.max(1, Math.floor(itemValue(item) * 0.6) || 1);
  return player ? Math.max(1, Math.floor(base * (1 + questFx(player, 'sellBonus')))) : base;
}
export function buyPrice(price, player = null) {
  return player ? Math.max(1, Math.ceil(price * (1 - questFx(player, 'shopDiscount') - (player.saga && player.saga.flags && player.saga.flags.ashfordFriend ? 0.05 : 0)))) : price;
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

const sell = (item, mult = 1.6) => ({ item, price: Math.max(1, Math.round(itemValue(item) * mult)) });
export const HERB_STOCK = [
  { item: 'Vial of water', price: 5 }, { item: 'Vial', price: 2 }, { item: 'Eye of newt', price: 6 }, { item: 'Unicorn horn dust', price: 25 },
  { item: 'Chocolate dust', price: 18 }, { item: 'Limpwurt root', price: 30 }, { item: 'White berries', price: 45 }, { item: 'Snape grass', price: 40 },
  { item: 'Grimy guam leaf', price: 12 }, { item: 'Grimy marrentill', price: 18 }, { item: 'Grimy tarromin', price: 25 },
  { item: 'Attack potion', price: 60 }, { item: 'Antipoison', price: 90 }, { item: 'Energy potion', price: 120 }, { item: 'Prayer potion', price: 400, unlock: 'apprentice' }
];
const pieces = ['full helm', 'platebody', 'platelegs', 'shield'];
export const ARMOUR_STOCK = [
  ...['Mithril', 'Adamant', 'Rune'].flatMap(m => pieces.map(pc => sell(`${m} ${pc}`))),
  sell('Hard leather body'), sell('Leather cowl'), sell('Leather chaps'), sell('Amulet of defence'), sell('Ring of recoil', 2)
];
export const WEAPON_STOCK = [
  ...['Steel', 'Mithril', 'Adamant', 'Rune'].map(m => sell(`${m} sword`)),
  ...['Willow shortbow', 'Maple shortbow', 'Yew shortbow', 'Magic shortbow'].map(b => sell(b)),
  ...['Iron', 'Steel', 'Mithril', 'Adamant', 'Rune'].map(m => ({ item: `${m} arrows`, price: Math.max(2, Math.round(itemValue(`${m} arrows`) * 1.6)) })),
  sell('Warrior ring'), sell('Archer ring'), sell('Amulet of strength')
];
// Every shop in the game. NPC/stall entities carry shop: '<id>'.
export const SHOPS = {
  shop: { title: "Merchant's General Store", stock: SHOP_STOCK },
  tools: { title: "Bob's Brilliant Tools", stock: TOOL_STOCK },
  herb: { title: "Mira's Remedies", stock: HERB_STOCK },
  herb2: { title: "Nessa's Herb Stall", stock: HERB_STOCK },
  armour: { title: 'Saltmere Armoury', stock: ARMOUR_STOCK },
  weapons: { title: 'Highcrag Weaponsmith', stock: WEAPON_STOCK },
  general2: { title: 'Saltmere General Store', stock: SHOP_STOCK },
  general3: { title: 'Highcrag Trading Post', stock: SHOP_STOCK },
  apothecary: { title: 'Brightwater Apothecary', stock: HERB_STOCK },
  chandlery: { title: 'Gullrest Chandlery', stock: [
    { item: 'Bronze cutlass', price: 50 }, { item: 'Iron cutlass', price: 160 }, { item: 'Steel cutlass', price: 420 }, { item: 'Mithril cutlass', price: 1100 },
    { item: 'Iron flintlock', price: 300 }, { item: 'Steel flintlock', price: 800 }, { item: 'Lead shot', price: 6 }, { item: 'Silver shot', price: 24 },
    { item: 'Spade', price: 8 }, { item: 'Cooked swordfish', price: 75 }] },
  armsBrine: { title: 'Brineholt Gunsmith', stock: [
    { item: 'Adamant cutlass', price: 2600 }, { item: 'Rune cutlass', price: 7000 }, { item: 'Mithril flintlock', price: 2000 }, { item: 'Adamant flintlock', price: 5200 }, { item: 'Lead shot', price: 6 }, { item: 'Silver shot', price: 22 }] },
  hexer: { title: "Mama Sorrel's Hex Shop", stock: [
    { item: 'Bog rune', price: 22 }, { item: 'Bone rune', price: 40 }, { item: 'Hexwood staff', price: 900 }, { item: 'Mind rune', price: 4 }] }
};

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
  const bf = info.buff;
  if (bf && bf.prayer && skills) {
    player.prayerPoints = Math.min(maxPrayer(skills), (player.prayerPoints || 0) + bf.prayer * 10);
    onLog('It restores some prayer points.', 'game');
  } else if (bf && bf.boost && skills) {
    const boost = {};
    for (const [sk, [flat, pct]] of Object.entries(bf.boost)) boost[sk] = flat + Math.floor(skills[sk].level * pct);
    player.effects = (player.effects || []).filter(e => e.id !== item);
    player.effects.push({ id: item, icon: bf.icon, left: bf.ticks, boost, fx: {} });
    onLog(`You feel stronger: ${Object.entries(boost).map(([k, n]) => `${k} +${n}`).join(', ')}.`, 'game');
  }
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
  if (info.questCape && !questCapeAllowed(player)) { onLog('You need to complete every quest to wear this cape.', 'warn'); return false; }
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


// ===========================================================================
// Magic: RuneScape-style combat spells. Each cast uses runes (an elemental staff
// counts as unlimited runes of its element). Damage is 10x classic, like the rest.
// ===========================================================================
const strike = (el, n) => ({ 'Air rune': 1, 'Mind rune': 1, ...(el ? { [el]: n } : {}) });
export const SPELLS = [
  { id: 'wind_strike',  name: 'Wind Strike',  level: 1,  maxHit: 20,  xp: 5.5,  icon: '💨', runes: strike(null) },
  { id: 'water_strike', name: 'Water Strike', level: 5,  maxHit: 40,  xp: 7.5,  icon: '💧', runes: strike('Water rune', 1) },
  { id: 'earth_strike', name: 'Earth Strike', level: 9,  maxHit: 60,  xp: 9.5,  icon: '🪨', runes: strike('Earth rune', 2) },
  { id: 'fire_strike',  name: 'Fire Strike',  level: 13, maxHit: 80,  xp: 11.5, icon: '🔥', runes: { 'Air rune': 2, 'Mind rune': 1, 'Fire rune': 3 } },
  { id: 'wind_bolt',    name: 'Wind Bolt',    level: 17, maxHit: 90,  xp: 13.5, icon: '💨', runes: { 'Air rune': 2, 'Chaos rune': 1 } },
  { id: 'water_bolt',   name: 'Water Bolt',   level: 23, maxHit: 100, xp: 16.5, icon: '💧', runes: { 'Air rune': 2, 'Water rune': 2, 'Chaos rune': 1 } },
  { id: 'earth_bolt',   name: 'Earth Bolt',   level: 29, maxHit: 110, xp: 19.5, icon: '🪨', runes: { 'Air rune': 2, 'Earth rune': 3, 'Chaos rune': 1 } },
  { id: 'fire_bolt',    name: 'Fire Bolt',    level: 35, maxHit: 120, xp: 22.5, icon: '🔥', runes: { 'Air rune': 3, 'Fire rune': 4, 'Chaos rune': 1 } },
  { id: 'wind_blast',   name: 'Wind Blast',   level: 41, maxHit: 130, xp: 25.5, icon: '💨', runes: { 'Air rune': 3, 'Death rune': 1 } },
  { id: 'water_blast',  name: 'Water Blast',  level: 47, maxHit: 140, xp: 28.5, icon: '💧', runes: { 'Air rune': 3, 'Water rune': 3, 'Death rune': 1 } },
  { id: 'earth_blast',  name: 'Earth Blast',  level: 53, maxHit: 150, xp: 31.5, icon: '🪨', runes: { 'Air rune': 3, 'Earth rune': 4, 'Death rune': 1 } },
  { id: 'fire_blast',   name: 'Fire Blast',   level: 59, maxHit: 160, xp: 34.5, icon: '🔥', runes: { 'Air rune': 4, 'Fire rune': 5, 'Death rune': 1 } },
  { id: 'wind_wave',    name: 'Wind Wave',    level: 62, maxHit: 170, xp: 36,   icon: '💨', runes: { 'Air rune': 5, 'Blood rune': 1 } },
  { id: 'water_wave',   name: 'Water Wave',   level: 65, maxHit: 180, xp: 37.5, icon: '💧', runes: { 'Air rune': 5, 'Water rune': 7, 'Blood rune': 1 } },
  { id: 'earth_wave',   name: 'Earth Wave',   level: 70, maxHit: 190, xp: 40,   icon: '🪨', runes: { 'Air rune': 5, 'Earth rune': 7, 'Blood rune': 1 } },
  { id: 'fire_wave',    name: 'Fire Wave',    level: 75, maxHit: 200, xp: 42.5, icon: '🔥', runes: { 'Air rune': 5, 'Fire rune': 7, 'Blood rune': 1 } },
  // Hexcraft (Sails of Sarim): swamp-and-bone hexes taught by Mama Sorrel. Each lands an effect as well as damage.
  { id: 'hex_rot',   name: 'Rotting Hex',  level: 12, maxHit: 50,  xp: 12, icon: '🪲', hex: 'rot',   school: 'Hexcraft', runes: { 'Bog rune': 1, 'Mind rune': 1 }, about: 'rots the target for 4 extra hits over time' },
  { id: 'hex_bind',  name: 'Binding Hex',  level: 25, maxHit: 40,  xp: 18, icon: '🪢', hex: 'bind',  school: 'Hexcraft', runes: { 'Bog rune': 2, 'Bone rune': 1 }, about: 'roots the target so it cannot strike for 4 ticks' },
  { id: 'hex_wither',name: 'Withering Hex',level: 38, maxHit: 70,  xp: 26, icon: '🥀', hex: 'wither',school: 'Hexcraft', runes: { 'Bone rune': 2, 'Bog rune': 1 }, about: 'the target hits 30% softer for 20 seconds' },
  { id: 'hex_leech', name: 'Leeching Hex', level: 52, maxHit: 130, xp: 34, icon: '🩸', hex: 'leech', school: 'Hexcraft', runes: { 'Bone rune': 3, 'Blood rune': 1 }, about: 'half the damage dealt heals you' }
];
export const SPELL_TICKS = 5; // 3 seconds per cast
export function spellById(id) { return SPELLS.find(s => s.id === id) || null; }
// Runes your staff supplies for free.
export function staffRune(player) {
  const w = player.equipment && player.equipment.weapon;
  return (w && ITEMS[w] && ITEMS[w].runeSource) || null;
}
// Which runes a cast actually takes from your inventory.
export function runeCost(spell, player) {
  const free = staffRune(player);
  return Object.entries(spell.runes).filter(([r]) => r !== free);
}
// How many casts your runes allow (Infinity with a staff covering everything).
export function castsLeft(spell, player) {
  let n = Infinity;
  for (const [r, q] of runeCost(spell, player)) n = Math.min(n, Math.floor((player.inventory[r] || 0) / q));
  return n;
}
// { ok, reason }
export function canCast(spell, skills, player) {
  if (!spell) return { ok: false, reason: 'Choose a spell first.' };
  if (skills.Magic.level < spell.level) return { ok: false, reason: `You need a Magic level of ${spell.level} to cast ${spell.name}.` };
  if (castsLeft(spell, player) < 1) {
    const miss = runeCost(spell, player).filter(([r, q]) => (player.inventory[r] || 0) < q).map(([r, q]) => `${q} ${r}`);
    return { ok: false, reason: `You don't have enough runes to cast ${spell.name} (need ${miss.join(', ')}).` };
  }
  return { ok: true };
}
// Best spell you can cast right now (for the Cast option and autocast fallback).
export function bestSpell(skills, player) {
  let best = null;
  for (const sp of SPELLS) if (canCast(sp, skills, player).ok) best = sp;
  return best;
}
export function magicMaxHit(spell, player, skills) {
  const b = equipmentBonuses(player);
  return Math.floor(spell.maxHit * (1 + perk(skills, 'Magic', 'magicDmg') + b.mag * 0.01));
}
export function magicAccuracy(player, skills, mon) {
  const b = equipmentBonuses(player);
  const att = (boostedLevel(player, skills, 'Magic') + 8) * Math.max(16, 64 + b.mag * 3);
  const def = (mon.def + 8) * 64;
  return Math.min(0.98, hitChance(att, def) * (1 + perk(skills, 'Magic', 'magicAcc')));
}
// Cast one spell at a monster: uses runes, rolls the hit. Returns { dmg, xp: { Magic, Hitpoints }, saved }
// or { error } when it can't be cast.
// Elemental weaknesses: spells of that element deal +30% (Magic kit).
export const WEAKNESS = {
  Wolf: 'fire', Zombie: 'fire', Skeleton: 'earth', 'Giant Spider': 'fire', Bandit: 'wind', 'Moss Giant': 'fire', Ogre: 'water', 'Ice Giant': 'fire',
  'Green Dragon': 'water', 'Lesser Demon': 'water', Grumsh: 'earth', Scorchwing: 'water', 'Dark Archer': 'wind', Goblin: 'wind', Cow: 'earth', Guard: 'earth',
  'Hill Giant': 'water', 'Black Knight': 'earth', 'Drowned Deckhand': 'fire', 'Drowned Gunner': 'earth', 'Captain Saltgrave': 'fire'
};
export const WEAK_MULT = 1.3;
export const ELEMENT_ICON = { wind: '💨', water: '💧', earth: '🪨', fire: '🔥' };
export function spellElement(spell) { const m = spell && /^(wind|water|earth|fire)_/.exec(spell.id); return m ? m[1] : null; }
export function weakTo(monName, element) { return !!element && WEAKNESS[monName] === element; }
export function castSpell(spell, skills, player, mon, rng = Math.random) {
  const c = canCast(spell, skills, player);
  if (!c.ok) return { error: c.reason };
  const saved = rng() < perk(skills, 'Magic', 'runeSave');
  if (!saved) for (const [r, q] of runeCost(spell, player)) removeItem(player, r, q);
  let dmg = 0;
  if (rng() < magicAccuracy(player, skills, mon)) {
    dmg = 1 + Math.floor(rng() * magicMaxHit(spell, player, skills));
    dmg = Math.floor(dmg * (1 + questFx(player, 'dmgVs.' + mon.name) + questFx(player, 'dmgVs.*') + (gearEffects(player).dmgPct || 0)));
    if (weakTo(mon.name, spellElement(spell))) dmg = Math.floor(dmg * WEAK_MULT);
  }
  dmg = Math.min(dmg, mon.hp);
  // Like RuneScape, a cast always gives its base XP; damage adds more.
  return { dmg, saved, xp: { Magic: spell.xp * 2 + dmg * 0.6, Hitpoints: dmg * 0.4 } };
}

// ===========================================================================
// Agility: obstacle courses. Do the obstacles in order for a lap bonus.
// ===========================================================================
// course: { name, level, lapXp, obstacles: [{ name, verb, kind, level, xp, failDmg }] }
export const AGILITY_COURSES = {
  brightwater: { name: 'Brightwater Agility Course', level: 1, lapXp: 39, obstacles: [
    { name: 'Log balance', verb: 'Walk-across', kind: 'log', level: 1, xp: 7.5, failDmg: 10 },
    { name: 'Obstacle net', verb: 'Climb-over', kind: 'net', level: 1, xp: 7.5, failDmg: 10 },
    { name: 'Balancing rope', verb: 'Walk-on', kind: 'rope', level: 1, xp: 7.5, failDmg: 10 },
    { name: 'Obstacle pipe', verb: 'Squeeze-through', kind: 'pipe', level: 1, xp: 7.5, failDmg: 10 }] },
  varrock: { name: 'Varrock Agility Course', level: 30, lapXp: 125, obstacles: [
    { name: 'Rough wall', verb: 'Climb', kind: 'wall', level: 30, xp: 12, failDmg: 20 },
    { name: 'Clothes line', verb: 'Cross', kind: 'rope', level: 30, xp: 21, failDmg: 30 },
    { name: 'Gap', verb: 'Leap', kind: 'gap', level: 30, xp: 17, failDmg: 30 },
    { name: 'Wall ledge', verb: 'Balance', kind: 'log', level: 30, xp: 25, failDmg: 30 }] },
  portsarim: { name: 'Port Sarim Docks Course', level: 45, lapXp: 190, obstacles: [
    { name: 'Rigging net', verb: 'Climb-over', kind: 'net', level: 45, xp: 30, failDmg: 40 },
    { name: 'Mast rope', verb: 'Swing-on', kind: 'rope', level: 45, xp: 35, failDmg: 40 },
    { name: 'Crate stack', verb: 'Climb', kind: 'wall', level: 45, xp: 30, failDmg: 40 },
    { name: 'Pier gap', verb: 'Jump', kind: 'gap', level: 45, xp: 40, failDmg: 50 }] },
  falador: { name: 'Falador Agility Course', level: 60, lapXp: 300, obstacles: [
    { name: 'Rough wall', verb: 'Climb', kind: 'wall', level: 60, xp: 45, failDmg: 50 },
    { name: 'Tightrope', verb: 'Cross', kind: 'rope', level: 60, xp: 50, failDmg: 60 },
    { name: 'Hand holds', verb: 'Cross', kind: 'net', level: 60, xp: 55, failDmg: 60 },
    { name: 'Gap', verb: 'Jump', kind: 'gap', level: 60, xp: 50, failDmg: 60 },
    { name: 'Ledge', verb: 'Balance', kind: 'log', level: 60, xp: 60, failDmg: 60 }] }
};
// Flat list (one entry per obstacle) with ids like 'varrock:2'.
export const AGILITY_OBSTACLES = Object.fromEntries(Object.entries(AGILITY_COURSES).flatMap(([cid, c]) =>
  c.obstacles.map((o, i) => [`${cid}:${i}`, { ...o, id: `${cid}:${i}`, course: cid, index: i, last: i === c.obstacles.length - 1 }])));
// Chance to cross an obstacle without slipping.
export function agilitySuccess(level, req, failLess = 0) {
  const fail = Math.max(0.02, Math.min(0.5, 0.25 - (level - req) * 0.012));
  return 1 - fail * (1 - Math.min(0.9, failLess));
}
// One attempt. Updates player.agilityLap. Returns { ok, xp, dmg, lap, msg } or { error }.
export function runObstacle(obs, skills, player, rng = Math.random) {
  if (skills.Agility.level < obs.level) return { error: `You need an Agility level of ${obs.level} to use this course.` };
  const xpMult = 1 + perk(skills, 'Agility', 'agilityXp');
  if (rng() >= agilitySuccess(skills.Agility.level, obs.level, perk(skills, 'Agility', 'failLess'))) {
    player.agilityLap = null;
    return { ok: false, xp: Math.round(obs.xp * 0.25 * xpMult * 10) / 10, dmg: Math.max(1, Math.floor(obs.failDmg * (0.5 + rng() * 0.5))), msg: `You slip and fall off the ${obs.name.toLowerCase()}.` };
  }
  const lap = player.agilityLap && player.agilityLap.course === obs.course ? player.agilityLap : { course: obs.course, next: 0 };
  let lapXp = 0;
  if (obs.index === lap.next) lap.next++; else { lap.next = obs.index === 0 ? 1 : -1; }
  if (obs.last && lap.next === AGILITY_COURSES[obs.course].obstacles.length) { lapXp = AGILITY_COURSES[obs.course].lapXp; lap.next = 0; }
  player.agilityLap = lap;
  return { ok: true, xp: (obs.xp + lapXp) * xpMult, dmg: 0, lap: lapXp > 0, msg: `You ${obs.verb.toLowerCase().replace('-', ' ')} the ${obs.name.toLowerCase()}.` };
}

// ===========================================================================
// Thieving: pickpocket townsfolk (and the guards). Failing stuns you briefly.
// ===========================================================================
// loot: [{ item, qty: [lo, hi], chance }] ('Coins' go to your gold)
export const THIEVE_TARGETS = {
  Man:      { level: 1,  xp: 8,     stun: 5, dmg: 10, loot: [{ item: 'Coins', qty: [3, 3] }] },
  Woman:    { level: 1,  xp: 8,     stun: 5, dmg: 10, loot: [{ item: 'Coins', qty: [3, 3] }] },
  Farmer:   { level: 10, xp: 14.5,  stun: 5, dmg: 10, loot: [{ item: 'Coins', qty: [9, 9] }, { item: 'Raw beef', qty: [1, 1], chance: 0.2 }, { item: 'Grimy guam leaf', qty: [1, 1], chance: 0.15 }] },
  Sailor:   { level: 20, xp: 22,    stun: 5, dmg: 20, loot: [{ item: 'Coins', qty: [12, 18] }, { item: 'Raw shrimp', qty: [1, 2], chance: 0.25 }] },
  Warrior:  { level: 25, xp: 26,    stun: 5, dmg: 20, loot: [{ item: 'Coins', qty: [18, 18] }] },
  Guard:    { level: 40, xp: 46.8,  stun: 5, dmg: 20, loot: [{ item: 'Coins', qty: [30, 30] }, { item: 'Iron arrows', qty: [3, 8], chance: 0.2 }] },
  Knight:   { level: 55, xp: 84.3,  stun: 6, dmg: 30, loot: [{ item: 'Coins', qty: [50, 50] }, { item: 'Chaos rune', qty: [1, 2], chance: 0.15 }] },
  Paladin:  { level: 70, xp: 151.8, stun: 6, dmg: 30, loot: [{ item: 'Coins', qty: [80, 80] }, { item: 'Chaos rune', qty: [2, 2], chance: 0.4 }] },
  Hero:     { level: 80, xp: 273.3, stun: 6, dmg: 40, loot: [{ item: 'Coins', qty: [200, 300] }, { item: 'Death rune', qty: [2, 2], chance: 0.25 }, { item: 'Blood rune', qty: [1, 1], chance: 0.15 }, { item: 'Amulet of glory', qty: [1, 1], chance: 0.01 }] }
};
export function thieveChance(level, req, bonus = 0) {
  return Math.max(0.1, Math.min(0.95, 0.6 + (level - req) * 0.012 + bonus));
}
// One pickpocket attempt. Returns { fail, xp, dmg, stun, drops: [{ item, qty }] } or { error }.
export function thieve(targetType, skills, player, rng = Math.random) {
  const t = THIEVE_TARGETS[targetType];
  if (!t) return { error: 'You can\'t pickpocket that.' };
  if (skills.Thieving.level < t.level) return { error: `You need a Thieving level of ${t.level} to pickpocket a ${targetType.toLowerCase()}.` };
  const lootBonus = perk(skills, 'Thieving', 'lootChance');
  if (rng() >= thieveChance(skills.Thieving.level, t.level, lootBonus * 0.2)) {
    return { fail: true, xp: 0, dmg: Math.max(1, Math.floor(t.dmg * (0.5 + rng() * 0.5))), stun: t.stun, drops: [] };
  }
  const drops = [];
  for (const d of t.loot) {
    if (d.chance !== undefined && rng() >= d.chance * (1 + lootBonus)) continue;
    const [lo, hi] = d.qty;
    let qty = lo + Math.floor(rng() * (hi - lo + 1));
    if (d.item === 'Coins' && rng() < lootBonus) qty *= 2; // Better Loot perks
    drops.push({ item: d.item, qty });
  }
  return { fail: false, xp: t.xp * (1 + perk(skills, 'Thieving', 'thieveXp')), dmg: 0, stun: 0, drops };
}

// ===========================================================================
// Runecrafting: take essence to a rune altar and craft it all into runes at once.
// Higher levels make several runes per essence. Chaos, Death and Blood need Pure essence.
// ===========================================================================
export const RUNE_ALTARS = {
  Air:   { rune: 'Air rune',   level: 1,  xp: 5,    multi: 11, pure: false },
  Mind:  { rune: 'Mind rune',  level: 2,  xp: 5.5,  multi: 14, pure: false },
  Water: { rune: 'Water rune', level: 5,  xp: 6,    multi: 19, pure: false },
  Earth: { rune: 'Earth rune', level: 9,  xp: 6.5,  multi: 26, pure: false },
  Fire:  { rune: 'Fire rune',  level: 14, xp: 7,    multi: 35, pure: false },
  Body:  { rune: 'Body rune',  level: 20, xp: 7.5,  multi: 46, pure: false },
  Chaos: { rune: 'Chaos rune', level: 35, xp: 8.5,  multi: 74, pure: true },
  Death: { rune: 'Death rune', level: 65, xp: 10,   multi: 0,  pure: true },
  Blood: { rune: 'Blood rune', level: 77, xp: 10.5, multi: 0,  pure: true }
};
export function runesPerEssence(altar, level) {
  return altar.multi ? 1 + Math.floor(level / altar.multi) : 1;
}
// Crafts every usable essence in your inventory. Returns { item, qty, xp, used, essence } or { error }.
export function craftRunes(altarName, skills, player, rng = Math.random) {
  const a = RUNE_ALTARS[altarName];
  if (!a) return { error: 'Nothing happens.' };
  const lvl = skills.Runecrafting.level;
  if (lvl < a.level) return { error: `You need a Runecrafting level of ${a.level} to craft ${a.rune.toLowerCase()}s.` };
  const kinds = a.pure ? ['Pure essence'] : ['Pure essence', 'Rune essence'];
  let used = 0;
  const parts = [];
  for (const k of kinds) { const n = player.inventory[k] || 0; if (n) { removeItem(player, k, n); used += n; parts.push(k); } }
  if (!used) return { error: a.pure ? `You need pure essence to craft ${a.rune.toLowerCase()}s. Mine it at Mining 30 in the Varrock essence mine.` : 'You don\'t have any rune essence. Buy some from a magic shop or mine it.' };
  let qty = used * runesPerEssence(a, lvl);
  const dbl = perk(skills, 'Runecrafting', 'runeDouble');
  if (dbl > 0) { let extra = 0; for (let i = 0; i < used; i++) if (rng() < dbl) extra++; qty += extra; }
  addItem(player, a.rune, qty);
  return { item: a.rune, qty, used, essence: parts, xp: used * a.xp * (1 + perk(skills, 'Runecrafting', 'rcXp')) };
}

// ---- Magic shops ----
const runeStock = (list) => list.map(r => ({ item: r, price: Math.max(2, Math.round(itemValue(r) * 1.4)) }));
export const MAGIC_STOCK_BASIC = [
  ...runeStock(['Air rune', 'Mind rune', 'Water rune', 'Earth rune', 'Fire rune']),
  { item: 'Rune essence', price: 8 }, { item: 'Staff', price: 20 }, { item: 'Wizard hat', price: 30 }, { item: 'Wizard robe', price: 45 }
];
export const MAGIC_STOCK = [
  ...runeStock(['Air rune', 'Mind rune', 'Water rune', 'Earth rune', 'Fire rune', 'Body rune', 'Chaos rune']),
  { item: 'Rune essence', price: 8 }, { item: 'Staff', price: 20 },
  { item: 'Staff of air', price: 1500 }, { item: 'Staff of water', price: 1500 }, { item: 'Staff of earth', price: 1500 }, { item: 'Staff of fire', price: 1500 },
  { item: 'Wizard hat', price: 30 }, { item: 'Wizard robe', price: 45 }
];
export const RUNE_STOCK = [
  ...runeStock(['Air rune', 'Mind rune', 'Water rune', 'Earth rune', 'Fire rune', 'Body rune', 'Chaos rune', 'Death rune']),
  { item: 'Rune essence', price: 8 }, { item: 'Pure essence', price: 14 },
  { item: 'Mystic staff', price: 9000 }, { item: 'Mystic hat', price: 3500 }, { item: 'Mystic robe top', price: 14000 }, { item: 'Mystic robe bottom', price: 10500 }
];
Object.assign(SHOPS, {
  magic0: { title: "Mizgog's Magic Supplies", stock: MAGIC_STOCK_BASIC },
  magic: { title: "Betty's Magic Emporium", stock: MAGIC_STOCK },
  runes: { title: "Aubury's Rune Shop", stock: RUNE_STOCK }
});
// The towns that were planned as Saltmere and Highcrag are now Port Sarim and Varrock (plus Falador).
SHOPS.general2.title = 'Port Sarim General Store';
// Ashford Store: Trader Mira's general goods (same stock and prices as the other general stores)
SHOPS.ashford = { title: 'Ashford Store', stock: SHOP_STOCK };
SHOPS.armour.title = 'Falador Armoury';
SHOPS.weapons.title = 'Varrock Weaponsmith';
SHOPS.general3.title = 'Varrock General Store';
SHOPS.herb2.title = "Nessa's Herb Stall (Falador)";

// Rune drops from monsters that cast or carry them.
const addLoot = (mon, ...entries) => { if (LOOT_TABLES[mon]) LOOT_TABLES[mon].push(...entries); };
addLoot('Goblin', { item: 'Air rune', chance: 0.12, qty: [3, 8] }, { item: 'Mind rune', chance: 0.08, qty: [2, 5] });
addLoot('Dark Archer', { item: 'Chaos rune', chance: 0.1, qty: [1, 3] });
addLoot('Skeleton', { item: 'Earth rune', chance: 0.15, qty: [3, 9] });
addLoot('Bandit', { item: 'Chaos rune', chance: 0.15, qty: [2, 5] });
addLoot('Moss Giant', { item: 'Water rune', chance: 0.2, qty: [8, 20] }, { item: 'Chaos rune', chance: 0.12, qty: [3, 6] });
addLoot('Ice Giant', { item: 'Water rune', chance: 0.25, qty: [10, 25] }, { item: 'Death rune', chance: 0.08, qty: [2, 5] });
addLoot('Lesser Demon', { item: 'Fire rune', chance: 0.3, qty: [20, 45] }, { item: 'Death rune', chance: 0.12, qty: [3, 6] }, { item: 'Blood rune', chance: 0.05, qty: [1, 3] });
addLoot('Green Dragon', { item: 'Blood rune', chance: 0.08, qty: [2, 4] });

// Repeatable bounties (the givers stand at points of interest in the wilds)
export const BOUNTIES = [
  Object.assign({ id: 'ruins', mon: 'Skeleton', n: 5, gp: 350, xp: { Prayer: 300, Defence: 400 }, ask: "The dead won't stay down in those ruins. Put five skeletons back in the ground and I'll pay you." }, { giver: 'Ruins Warden', where: 'Old ruins (east)' }),
  Object.assign({ id: 'bandits', mon: 'Bandit', n: 4, gp: 400, xp: { Attack: 350, Strength: 350 }, ask: "Bandits hide out in the rocks north of my tower. Bring four of them to justice and the crown will reward you." }, { giver: 'Captain Brann', where: 'Watchtower (west highlands)' }),
  Object.assign({ id: 'wolves', mon: 'Wolf', n: 5, gp: 300, xp: { Ranged: 400, Agility: 150 }, ask: "Wolves have been taking deer all along the dale. Thin the pack: five wolves, and I'll pay you in coin and know-how." }, { giver: 'Rhea the Hunter', where: "Hunter's camp (south-east)" }),
];
