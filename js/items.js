// Item definitions, tiers, tools and recipes.
// type decides what tapping the item does. Equipment bonuses: atk, str (melee),
// ranged, rstr (arrow damage), def (armour). value = shop sell price.

export const HEAL_SCALE = 10; // hitpoints are 10x classic RuneScape

export const METALS = ['Bronze', 'Iron', 'Steel', 'Mithril', 'Adamant', 'Rune'];
export const METAL_TINT = { Bronze: '#b87333', Iron: '#9a9a9a', Steel: '#d0d8e0', Mithril: '#5a6ad0', Adamant: '#3a9a5a', Rune: '#3ab8d0' };
const TIER_REQ = [1, 10, 20, 30, 40, 50];          // Attack / Defence to wear
const TOOL_REQ = [1, 1, 6, 21, 31, 41];             // Woodcutting / Mining to use
const SMITH_BASE = [1, 15, 30, 50, 70, 85];
const BAR_XP = [12.5, 25, 37.5, 50, 62.5, 75];
const VALUE_MULT = [1, 3, 8, 20, 50, 130];
export const WOODS = ['Logs', 'Oak logs', 'Willow logs', 'Maple logs', 'Yew logs', 'Magic logs'];

export const ITEMS = {};
const def = (name, o) => { ITEMS[name] = { value: 1, ...o }; };

// ---- Resources ----
const ORES = [['Copper ore', 3], ['Tin ore', 3], ['Iron ore', 10], ['Coal', 12], ['Mithril ore', 40], ['Adamantite ore', 90], ['Runite ore', 300]];
for (const [o, v] of ORES) def(o, { type: 'resource', value: v });
WOODS.forEach((w, i) => def(w, { type: 'resource', value: [2, 6, 12, 20, 40, 90][i] }));
for (const [n, v] of [['Flax', 2], ['Cowhide', 6], ['Feather', 1], ['Raw beef', 3], ['Bowstring', 5], ['Soft leather', 10], ['Hard leather', 20]]) def(n, { type: n === 'Bowstring' || /leather/.test(n) ? 'processed' : 'resource', value: v });
def('Bones', { type: 'bones', prayerXp: 10, value: 2 });
def('Big bones', { type: 'bones', prayerXp: 30, value: 15 });
def('Burnt food', { type: 'junk', value: 0 });

// ---- Food: [raw, cooked, cook level, stop-burn level, heal, xp, value] ----
export const FOODS = [
  ['Raw shrimp', 'Cooked shrimp', 1, 34, 3, 30, 4], ['Raw beef', 'Cooked meat', 1, 34, 4, 30, 4],
  ['Raw trout', 'Cooked trout', 15, 50, 7, 70, 10], ['Raw salmon', 'Cooked salmon', 25, 58, 9, 90, 15],
  ['Raw lobster', 'Cooked lobster', 40, 74, 12, 120, 40], ['Raw swordfish', 'Cooked swordfish', 45, 86, 14, 140, 60],
  ['Raw shark', 'Cooked shark', 80, 99, 20, 210, 150]
];
for (const [raw, cooked, , , heal, , v] of FOODS) {
  if (!ITEMS[raw]) def(raw, { type: 'resource', value: Math.max(2, Math.round(v * 1.2)) });
  def(cooked, { type: 'food', heal, value: v });
}

// ---- Metal tiers: bars, gear, tools, arrows ----
const GEAR = {
  sword:  { suffix: 'sword', slot: 'weapon', bars: 1, off: 2,  stat: t => ({ atk: [5, 9, 14, 20, 28, 38][t], str: [3, 6, 10, 15, 22, 32][t], speed: 4, req: { Attack: TIER_REQ[t] } }), val: 15 },
  helm:   { suffix: 'full helm', slot: 'head', bars: 2, off: 4, stat: t => ({ def: [3, 5, 8, 11, 15, 21][t], req: { Defence: TIER_REQ[t] } }), val: 12 },
  shield: { suffix: 'shield', slot: 'shield', bars: 2, off: 6, stat: t => ({ def: [7, 11, 16, 22, 30, 42][t], req: { Defence: TIER_REQ[t] } }), val: 20 },
  legs:   { suffix: 'platelegs', slot: 'legs', bars: 3, off: 12, stat: t => ({ def: [6, 10, 15, 21, 29, 40][t], req: { Defence: TIER_REQ[t] } }), val: 30 },
  body:   { suffix: 'platebody', slot: 'body', bars: 5, off: 16, stat: t => ({ def: [8, 14, 20, 28, 38, 52][t], req: { Defence: TIER_REQ[t] } }), val: 60 },
  axe:    { suffix: 'axe', tool: 'axe', bars: 1, off: 0, stat: t => ({ toolTier: t, req: { Woodcutting: TOOL_REQ[t] } }), val: 10 },
  pickaxe:{ suffix: 'pickaxe', tool: 'pickaxe', bars: 2, off: 1, stat: t => ({ toolTier: t, req: { Mining: TOOL_REQ[t] } }), val: 14 }
};
METALS.forEach((m, t) => {
  def(`${m} bar`, { type: 'processed', value: [8, 25, 50, 120, 300, 900][t] });
  for (const g of Object.values(GEAR)) {
    def(`${m} ${g.suffix}`, { type: g.tool ? 'tool' : g.slot, tool: g.tool, tier: t, metal: m, ...g.stat(t), value: Math.round(g.val * VALUE_MULT[t]) });
  }
  def(`${m} arrows`, { type: 'ammo', count: 15, rstr: [3, 6, 10, 15, 22, 32][t], tier: t, metal: m, value: [1, 2, 4, 8, 16, 40][t] });
});

// ---- Bows ----
export const BOWS = [['Shortbow', 1, 8], ['Oak shortbow', 15, 14], ['Willow shortbow', 20, 20], ['Maple shortbow', 30, 28], ['Yew shortbow', 40, 36], ['Magic shortbow', 50, 48]];
BOWS.forEach(([n, req, r], t) => def(n, { type: 'weapon', ranged: r, speed: 4, tier: t, req: { Ranged: req }, value: [20, 40, 80, 160, 400, 1000][t] }));

// ---- Leather and wood armour ----
def('Leather cowl', { type: 'head', def: 2, req: { Defence: 1 }, value: 8 });
def('Leather body', { type: 'body', def: 6, req: { Defence: 1 }, value: 25 });
def('Leather chaps', { type: 'legs', def: 4, req: { Defence: 1 }, value: 15 });
def('Hard leather body', { type: 'body', def: 12, req: { Defence: 10 }, value: 60 });
def('Wooden shield', { type: 'shield', def: 4, req: { Defence: 1 }, value: 10 });
def('Oak shield', { type: 'shield', def: 6, req: { Defence: 5 }, value: 25 });

// ---- Single-tier tools ----
export const TOOL_TYPES = [
  { id: 'axe', name: 'Axe', icon: '🪓', skill: 'Woodcutting' },
  { id: 'pickaxe', name: 'Pickaxe', icon: '⛏️', skill: 'Mining' },
  { id: 'net', name: 'Fishing net', icon: '🥅' },
  { id: 'rod', name: 'Fishing rod', icon: '🎣' },
  { id: 'cage', name: 'Lobster pot', icon: '🧺' },
  { id: 'harpoon', name: 'Harpoon', icon: '🔱' },
  { id: 'hammer', name: 'Hammer', icon: '🔨' },
  { id: 'knife', name: 'Knife', icon: '🔪' },
  { id: 'needle', name: 'Needle', icon: '🪡' },
  { id: 'tinderbox', name: 'Tinderbox', icon: '🔥' }
];
for (const [n, tool, v] of [['Small fishing net', 'net', 5], ['Fly fishing rod', 'rod', 10], ['Lobster pot', 'cage', 20], ['Harpoon', 'harpoon', 25],
  ['Hammer', 'hammer', 1], ['Knife', 'knife', 1], ['Needle', 'needle', 1], ['Tinderbox', 'tinderbox', 1]]) {
  def(n, { type: 'tool', tool, tier: 0, value: v });
}
export const STARTER_TOOLS = ['Bronze axe', 'Bronze pickaxe', 'Small fishing net', 'Hammer', 'Knife', 'Needle', 'Tinderbox'];

export function isTool(item) { return !!(ITEMS[item] && ITEMS[item].type === 'tool'); }
export function toolType(item) { return ITEMS[item] && ITEMS[item].tool; }

// Every identical item stacks in one slot.
export function isStackable(item) { return true; }

export function slotFor(item) {
  const t = ITEMS[item] && ITEMS[item].type;
  if (['weapon', 'shield', 'body', 'legs', 'head', 'ammo'].includes(t)) return t;
  return null;
}
export function isRangedWeapon(item) { return !!(item && ITEMS[item] && ITEMS[item].ranged); }
export function itemValue(item) { return ITEMS[item] ? ITEMS[item].value : 1; }

// ---- Icons: [emoji, tint] ----
const KIND_ICON = { sword: '🗡️', 'full helm': '⛑️', shield: '🛡️', platelegs: '👖', platebody: '🦺', axe: '🪓', pickaxe: '⛏️', arrows: '➶', bar: '🧱' };
const FIXED_ICONS = {
  Coal: ['🪨', '#11111180'], 'Copper ore': ['🪨', '#b8733340'], 'Tin ore': ['🪨', '#c8c8c840'], 'Iron ore': ['🪨', '#8a4b3a50'],
  'Mithril ore': ['🪨', '#5a6ad060'], 'Adamantite ore': ['🪨', '#3a9a5a60'], 'Runite ore': ['🪨', '#3ab8d060'],
  Flax: ['🌾', ''], Cowhide: ['🐄', ''], Bones: ['🦴', ''], 'Big bones': ['🦴', '#e0d0a060'], 'Raw beef': ['🥩', ''], Feather: ['🪶', ''],
  Bowstring: ['🧵', ''], 'Soft leather': ['🟫', ''], 'Hard leather': ['🟫', '#5a3a1a60'], 'Burnt food': ['🍘', '#22222280'],
  'Raw shrimp': ['🦐', ''], 'Cooked shrimp': ['🍤', ''], 'Raw trout': ['🐟', ''], 'Cooked trout': ['🐠', ''], 'Raw salmon': ['🐟', '#e0806040'],
  'Cooked salmon': ['🍣', ''], 'Cooked meat': ['🍖', ''], 'Raw lobster': ['🦞', '#40608040'], 'Cooked lobster': ['🦞', ''],
  'Raw swordfish': ['🐟', '#6080c040'], 'Cooked swordfish': ['🐡', ''], 'Raw shark': ['🦈', '#6080c040'], 'Cooked shark': ['🦈', ''],
  'Leather cowl': ['🧢', ''], 'Leather body': ['🧥', ''], 'Leather chaps': ['👖', '#7a4a2450'], 'Hard leather body': ['🧥', '#5a3a1a60'],
  'Wooden shield': ['🛡️', '#8a5a2a50'], 'Oak shield': ['🛡️', '#c49a5a50'],
  'Small fishing net': ['🥅', ''], 'Fly fishing rod': ['🎣', ''], 'Lobster pot': ['🧺', ''], Harpoon: ['🔱', ''],
  Hammer: ['🔨', ''], Knife: ['🔪', ''], Needle: ['🪡', ''], Tinderbox: ['🔥', '']
};
const WOOD_TINT = ['', '#c49a5a40', '#7a9a4a40', '#c0702a40', '#4a6a3a50', '#3a5ad050'];
export function iconFor(item) {
  if (FIXED_ICONS[item]) return FIXED_ICONS[item];
  const w = WOODS.indexOf(item);
  if (w >= 0) return ['🪵', WOOD_TINT[w]];
  const bow = BOWS.findIndex(b => b[0] === item);
  if (bow >= 0) return ['🏹', WOOD_TINT[bow]];
  const info = ITEMS[item];
  if (info && info.metal) {
    const kind = item.slice(info.metal.length + 1);
    return [KIND_ICON[kind] || '📦', METAL_TINT[info.metal] + '60'];
  }
  if (/ bar$/.test(item)) { const m = item.split(' ')[0]; return ['🧱', (METAL_TINT[m] || '#888') + '60']; }
  return ['📦', ''];
}
export const ICONS = FIXED_ICONS;

const EXAMINE = {
  Coal: 'Hmm, a non-renewable energy source!', Bones: 'Bones are for burying!', 'Big bones': 'Ew, it\'s a pile of big bones.',
  Feather: 'Used for fly fishing and fletching.', Flax: 'A plant cultivated for fibres.', Cowhide: 'I should take this to the tanner.',
  Bowstring: 'I need a bow stave to attach this to.', 'Burnt food': 'Oops!', Hammer: 'Good for hitting things.', Knife: 'A dangerous looking knife.',
  Needle: 'Used with leather to make armour.', Tinderbox: 'Useful for lighting a fire.', 'Small fishing net': 'Useful for catching small fish.',
  'Fly fishing rod': 'Useful for fly fishing.', 'Lobster pot': 'Useful for catching lobsters.', Harpoon: 'Useful for catching really big fish.'
};
export function examineItem(item) {
  const info = ITEMS[item] || {};
  let text = EXAMINE[item] || (info.type === 'food' ? 'Mmm, this looks tasty.' : info.tool ? `A ${item.toLowerCase()}. It goes on my toolbelt.`
    : /^Raw /.test(item) ? 'I should try cooking this.' : / ore$/.test(item) ? 'This needs refining.' : / bar$/.test(item) ? `It's a bar of ${item.split(' ')[0].toLowerCase()}.`
    : `It's ${/^[aeiou]/i.test(item) ? 'an' : 'a'} ${item.toLowerCase()}.`);
  const bits = [];
  if (info.heal) bits.push(`heals ${info.heal * HEAL_SCALE}`);
  if (info.prayerXp) bits.push(`bury for ${info.prayerXp} Prayer xp`);
  if (info.atk) bits.push(`atk +${info.atk}`);
  if (info.str) bits.push(`str +${info.str}`);
  if (info.ranged) bits.push(`ranged +${info.ranged}`);
  if (info.rstr) bits.push(`arrow str +${info.rstr}`);
  if (info.def) bits.push(`def +${info.def}`);
  if (info.tool && info.toolTier !== undefined) bits.push(`tier ${info.toolTier + 1} tool`);
  if (info.req) bits.push('needs ' + Object.entries(info.req).map(([k, v]) => `${k} ${v}`).join(', '));
  if (bits.length) text += ` (${bits.join(', ')})`;
  return text;
}

// ---- Recipes ----
// cat = Crafting panel sub-tab, group = heading inside it. station: furnace, anvil, range. tool: needed on the belt.
export const RECIPES = [];
const R = r => RECIPES.push({ station: null, tool: null, ...r });
// Smelting
R({ name: 'Smelt Bronze bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 1, inputs: { 'Copper ore': 1, 'Tin ore': 1 }, output: 'Bronze bar', xp: 6, station: 'furnace' });
R({ name: 'Smelt Iron bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 15, inputs: { 'Iron ore': 1 }, output: 'Iron bar', xp: 12, station: 'furnace' });
R({ name: 'Smelt Steel bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 30, inputs: { 'Iron ore': 1, Coal: 2 }, output: 'Steel bar', xp: 17, station: 'furnace' });
R({ name: 'Smelt Mithril bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 50, inputs: { 'Mithril ore': 1, Coal: 4 }, output: 'Mithril bar', xp: 30, station: 'furnace' });
R({ name: 'Smelt Adamant bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 70, inputs: { 'Adamantite ore': 1, Coal: 6 }, output: 'Adamant bar', xp: 37.5, station: 'furnace' });
R({ name: 'Smelt Rune bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 85, inputs: { 'Runite ore': 1, Coal: 8 }, output: 'Rune bar', xp: 50, station: 'furnace' });
// Smithing at the anvil
const BRONZE_LVL = { sword: 1, helm: 3, shield: 5, legs: 10, body: 14, axe: 1, pickaxe: 1 };
METALS.forEach((m, t) => {
  for (const [key, g] of Object.entries(GEAR)) {
    R({ name: `Smith ${m} ${g.suffix}`, cat: 'Smithing', group: m, skill: 'Smithing', level: t === 0 ? BRONZE_LVL[key] : Math.min(99, SMITH_BASE[t] + g.off),
      inputs: { [`${m} bar`]: g.bars }, output: `${m} ${g.suffix}`, xp: BAR_XP[t] * g.bars, station: 'anvil', tool: 'hammer' });
  }
});
// Crafting
R({ name: 'Tan Cowhide', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 1, inputs: { Cowhide: 1 }, output: 'Soft leather', xp: 20 });
R({ name: 'Tan Hard leather', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 28, inputs: { Cowhide: 1 }, output: 'Hard leather', xp: 35 });
R({ name: 'Sew Leather cowl', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 9, inputs: { 'Soft leather': 1 }, output: 'Leather cowl', xp: 18.5, tool: 'needle' });
R({ name: 'Sew Leather body', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 14, inputs: { 'Soft leather': 3 }, output: 'Leather body', xp: 25, tool: 'needle' });
R({ name: 'Sew Leather chaps', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 18, inputs: { 'Soft leather': 2 }, output: 'Leather chaps', xp: 27, tool: 'needle' });
R({ name: 'Sew Hard leather body', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 28, inputs: { 'Hard leather': 2 }, output: 'Hard leather body', xp: 35, tool: 'needle' });
R({ name: 'Spin Flax', cat: 'Crafting', group: 'Spinning', skill: 'Crafting', level: 1, inputs: { Flax: 1 }, output: 'Bowstring', xp: 15 });
R({ name: 'Craft Wooden shield', cat: 'Crafting', group: 'Woodwork', skill: 'Crafting', level: 1, inputs: { Logs: 2 }, output: 'Wooden shield', xp: 10, tool: 'hammer' });
R({ name: 'Craft Oak shield', cat: 'Crafting', group: 'Woodwork', skill: 'Crafting', level: 15, inputs: { 'Oak logs': 2 }, output: 'Oak shield', xp: 25, tool: 'hammer' });
// Fletching
const BOW_LVL = [5, 20, 35, 50, 65, 80], BOW_XP = [5, 16.5, 33.3, 50, 67.5, 83.3];
BOWS.forEach(([n], t) => R({ name: `Fletch ${n}`, cat: 'Fletching', group: 'Bows', skill: 'Fletching', level: BOW_LVL[t], inputs: { [WOODS[t]]: 1, Bowstring: 1 }, output: n, xp: BOW_XP[t], tool: 'knife' }));
const ARROW_LVL = [1, 15, 30, 45, 60, 75], ARROW_XP = [10, 15, 25, 37.5, 50, 62.5];
METALS.forEach((m, t) => R({ name: `Fletch ${m} arrows`, cat: 'Fletching', group: 'Arrows', skill: 'Fletching', level: ARROW_LVL[t], inputs: { [`${m} bar`]: 1, [WOODS[t]]: 1 }, output: `${m} arrows`, xp: ARROW_XP[t], tool: 'knife' }));
// Cooking
for (const [raw, cooked, lvl, stop, , xp] of FOODS) {
  R({ name: `Cook ${cooked.replace('Cooked ', '')}`, cat: 'Cooking', group: 'Range or fire', skill: 'Cooking', level: lvl, inputs: { [raw]: 1 }, output: cooked, xp, station: 'range', burnStop: stop });
}

export const CRAFT_TABS = ['Smithing', 'Crafting', 'Fletching', 'Cooking'];

export function recipeOutputQty(recipe) {
  const info = ITEMS[recipe.output];
  return (info && info.type === 'ammo' && info.count) ? info.count : 1;
}
export function hasInputs(inventory, recipe) {
  for (const [item, qty] of Object.entries(recipe.inputs)) if ((inventory[item] || 0) < qty) return false;
  return true;
}
export function canCraft(skills, inventory, recipe) {
  if (skills[recipe.skill].level < recipe.level) return false;
  return hasInputs(inventory, recipe);
}
