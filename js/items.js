// Item definitions. type decides what tapping the item does.
// Equipment bonuses: atk (melee accuracy), str (melee damage), ranged, rstr (arrow damage), def (armour).
export const ITEMS = {
  'Copper ore': { type: 'resource' },
  'Tin ore': { type: 'resource' },
  'Iron ore': { type: 'resource' },
  'Coal': { type: 'resource' },
  'Logs': { type: 'resource' },
  'Oak logs': { type: 'resource' },
  'Willow logs': { type: 'resource' },
  'Raw shrimp': { type: 'resource' },
  'Raw trout': { type: 'resource' },
  'Raw salmon': { type: 'resource' },
  'Flax': { type: 'resource' },
  'Cowhide': { type: 'resource' },
  'Bones': { type: 'resource' },
  'Raw beef': { type: 'resource' },
  'Feather': { type: 'resource', stackable: true },
  'Bronze bar': { type: 'processed' },
  'Iron bar': { type: 'processed' },
  'Steel bar': { type: 'processed' },
  'Bowstring': { type: 'processed' },
  'Soft leather': { type: 'processed' },
  'Cooked shrimp': { type: 'food', heal: 3 },
  'Cooked trout': { type: 'food', heal: 7 },
  'Cooked salmon': { type: 'food', heal: 9 },
  'Cooked meat': { type: 'food', heal: 4 },
  'Bronze sword': { type: 'weapon', atk: 5, str: 3, speed: 4, req: { Attack: 1 } },
  'Iron sword': { type: 'weapon', atk: 9, str: 6, speed: 4, req: { Attack: 10 } },
  'Steel sword': { type: 'weapon', atk: 14, str: 10, speed: 4, req: { Attack: 20 } },
  'Wooden shield': { type: 'shield', def: 4, req: { Defence: 1 } },
  'Bronze shield': { type: 'shield', def: 7, req: { Defence: 1 } },
  'Bronze platebody': { type: 'body', def: 8, req: { Defence: 1 } },
  'Iron platebody': { type: 'body', def: 14, req: { Defence: 10 } },
  'Leather body': { type: 'body', def: 6, req: { Defence: 1 } },
  'Shortbow': { type: 'weapon', ranged: 8, speed: 4, req: { Ranged: 1 } },
  'Oak shortbow': { type: 'weapon', ranged: 14, speed: 4, req: { Ranged: 15 } },
  'Bronze arrows': { type: 'ammo', count: 15, rstr: 3, stackable: true },
  'Iron arrows': { type: 'ammo', count: 15, rstr: 6, stackable: true }
};

// Food heals this many times its listed value (hitpoints here are 10x classic RuneScape).
export const HEAL_SCALE = 10;

export function isStackable(item) {
  return !!(ITEMS[item] && ITEMS[item].stackable);
}

export function slotFor(item) {
  const t = ITEMS[item] && ITEMS[item].type;
  if (t === 'weapon' || t === 'shield' || t === 'body' || t === 'legs' || t === 'ammo') return t;
  return null;
}

export function isRangedWeapon(item) {
  return !!(item && ITEMS[item] && ITEMS[item].ranged);
}

// [emoji, tint] used for inventory, bank and shop icons.
export const ICONS = {
  'Copper ore': ['🪨', '#b8733340'], 'Tin ore': ['🪨', '#c8c8c840'], 'Iron ore': ['🪨', '#8a4b3a50'],
  'Coal': ['🪨', '#11111180'], 'Logs': ['🪵', ''], 'Oak logs': ['🪵', '#c49a5a40'], 'Willow logs': ['🪵', '#7a9a4a40'],
  'Raw shrimp': ['🦐', ''], 'Raw trout': ['🐟', ''], 'Raw salmon': ['🐟', '#e0806040'], 'Flax': ['🌾', ''],
  'Cowhide': ['🐄', ''], 'Bones': ['🦴', ''], 'Raw beef': ['🥩', ''], 'Feather': ['🪶', ''],
  'Bronze bar': ['🧱', '#b8733350'], 'Iron bar': ['🧱', '#9a9a9a50'], 'Steel bar': ['🧱', '#d0d8e050'],
  'Bowstring': ['🧵', ''], 'Soft leather': ['🟫', ''],
  'Cooked shrimp': ['🍤', ''], 'Cooked trout': ['🐠', ''], 'Cooked salmon': ['🍣', ''], 'Cooked meat': ['🍖', ''],
  'Bronze sword': ['🗡️', '#b8733350'], 'Iron sword': ['🗡️', '#9a9a9a50'], 'Steel sword': ['🗡️', '#d0d8e050'],
  'Wooden shield': ['🛡️', '#8a5a2a50'], 'Bronze shield': ['🛡️', '#b8733350'],
  'Bronze platebody': ['🦺', '#b8733350'], 'Iron platebody': ['🦺', '#9a9a9a50'], 'Leather body': ['🧥', ''],
  'Shortbow': ['🏹', ''], 'Oak shortbow': ['🏹', '#c49a5a40'],
  'Bronze arrows': ['➶', '#b8733350'], 'Iron arrows': ['➶', '#9a9a9a50']
};

export function iconFor(item) {
  return ICONS[item] || ['📦', ''];
}

export const ITEM_EXAMINE = {
  'Copper ore': 'This needs refining.', 'Tin ore': 'This needs refining.', 'Iron ore': 'This needs refining.',
  'Coal': 'Hmm, a non-renewable energy source!', 'Logs': 'A number of wooden logs.', 'Oak logs': 'Logs cut from an oak tree.',
  'Willow logs': 'Logs cut from a willow tree.', 'Raw shrimp': 'I should try cooking this.', 'Raw trout': 'I should try cooking this.',
  'Raw salmon': 'I should try cooking this.', 'Flax': 'A plant cultivated for fibres.', 'Cowhide': 'I should take this to the tanner.',
  'Bones': 'Bones are for burying!', 'Raw beef': 'I need to cook this first.', 'Feather': 'Used for fly fishing and fletching.',
  'Bronze bar': "It's a bar of bronze.", 'Iron bar': "It's a bar of iron.", 'Steel bar': "It's a bar of steel.",
  'Bowstring': 'I need a bow stave to attach this to.', 'Soft leather': 'I can make an armour with this.',
  'Cooked shrimp': 'Some nicely cooked shrimp.', 'Cooked trout': 'Some nicely cooked trout.', 'Cooked salmon': 'Some nicely cooked salmon.',
  'Cooked meat': 'Mmm, this looks tasty.', 'Bronze sword': 'A razor sharp sword.', 'Iron sword': 'A razor sharp sword.',
  'Steel sword': 'A razor sharp sword.', 'Wooden shield': 'A solid wooden shield.', 'Bronze shield': 'A medium square shield.',
  'Bronze platebody': 'Provides excellent protection.', 'Iron platebody': 'Provides excellent protection.',
  'Leather body': 'Better than no armour!', 'Shortbow': 'Short but effective.', 'Oak shortbow': 'A shortbow made out of oak, still effective.',
  'Bronze arrows': 'Arrows with bronze heads.', 'Iron arrows': 'Arrows with iron heads.'
};

export function examineItem(item) {
  const info = ITEMS[item] || {};
  let text = ITEM_EXAMINE[item] || `It's ${item.toLowerCase()}.`;
  const bits = [];
  if (info.heal) bits.push(`heals ${info.heal * HEAL_SCALE}`);
  if (info.atk) bits.push(`atk +${info.atk}`);
  if (info.str) bits.push(`str +${info.str}`);
  if (info.ranged) bits.push(`ranged +${info.ranged}`);
  if (info.rstr) bits.push(`arrow str +${info.rstr}`);
  if (info.def) bits.push(`def +${info.def}`);
  if (info.req) bits.push('needs ' + Object.entries(info.req).map(([k, v]) => `${k} ${v}`).join(', '));
  if (bits.length) text += ` (${bits.join(', ')})`;
  return text;
}

export const RECIPES = [
  { name: 'Smelt Bronze bar', skill: 'Smithing', level: 1, inputs: { 'Copper ore': 1, 'Tin ore': 1 }, output: 'Bronze bar', xp: 6 },
  { name: 'Smelt Iron bar', skill: 'Smithing', level: 15, inputs: { 'Iron ore': 1 }, output: 'Iron bar', xp: 12 },
  { name: 'Smelt Steel bar', skill: 'Smithing', level: 30, inputs: { 'Iron ore': 1, 'Coal': 2 }, output: 'Steel bar', xp: 17 },
  { name: 'Smith Bronze sword', skill: 'Smithing', level: 1, inputs: { 'Bronze bar': 1 }, output: 'Bronze sword', xp: 12 },
  { name: 'Smith Iron sword', skill: 'Smithing', level: 15, inputs: { 'Iron bar': 1 }, output: 'Iron sword', xp: 25 },
  { name: 'Smith Steel sword', skill: 'Smithing', level: 30, inputs: { 'Steel bar': 1 }, output: 'Steel sword', xp: 37 },
  { name: 'Smith Bronze shield', skill: 'Smithing', level: 5, inputs: { 'Bronze bar': 1 }, output: 'Bronze shield', xp: 15 },
  { name: 'Smith Bronze platebody', skill: 'Smithing', level: 18, inputs: { 'Bronze bar': 5 }, output: 'Bronze platebody', xp: 62 },
  { name: 'Smith Iron platebody', skill: 'Smithing', level: 33, inputs: { 'Iron bar': 5 }, output: 'Iron platebody', xp: 125 },
  { name: 'Craft Wooden shield', skill: 'Crafting', level: 1, inputs: { 'Logs': 2 }, output: 'Wooden shield', xp: 10 },
  { name: 'Spin Flax', skill: 'Crafting', level: 1, inputs: { 'Flax': 1 }, output: 'Bowstring', xp: 15 },
  { name: 'Tan Cowhide', skill: 'Crafting', level: 1, inputs: { 'Cowhide': 1 }, output: 'Soft leather', xp: 20 },
  { name: 'Craft Leather body', skill: 'Crafting', level: 14, inputs: { 'Soft leather': 3 }, output: 'Leather body', xp: 25 },
  { name: 'Fletch Shortbow', skill: 'Fletching', level: 5, inputs: { 'Logs': 1, 'Bowstring': 1 }, output: 'Shortbow', xp: 5 },
  { name: 'Fletch Oak shortbow', skill: 'Fletching', level: 20, inputs: { 'Oak logs': 1, 'Bowstring': 1 }, output: 'Oak shortbow', xp: 16 },
  { name: 'Fletch Bronze arrows', skill: 'Fletching', level: 1, inputs: { 'Bronze bar': 1, 'Logs': 1 }, output: 'Bronze arrows', xp: 10 },
  { name: 'Fletch Iron arrows', skill: 'Fletching', level: 15, inputs: { 'Iron bar': 1, 'Oak logs': 1 }, output: 'Iron arrows', xp: 15 },
  { name: 'Cook shrimp', skill: 'Cooking', level: 1, inputs: { 'Raw shrimp': 1 }, output: 'Cooked shrimp', xp: 30 },
  { name: 'Cook trout', skill: 'Cooking', level: 15, inputs: { 'Raw trout': 1 }, output: 'Cooked trout', xp: 70 },
  { name: 'Cook beef', skill: 'Cooking', level: 1, inputs: { 'Raw beef': 1 }, output: 'Cooked meat', xp: 30 },
  { name: 'Cook salmon', skill: 'Cooking', level: 25, inputs: { 'Raw salmon': 1 }, output: 'Cooked salmon', xp: 90 }
];

export function recipeOutputQty(recipe) {
  const info = ITEMS[recipe.output];
  return (info && info.type === 'ammo' && info.count) ? info.count : 1;
}

export function hasInputs(inventory, recipe) {
  for (const [item, qty] of Object.entries(recipe.inputs)) {
    if ((inventory[item] || 0) < qty) return false;
  }
  return true;
}

export function canCraft(skills, inventory, recipe) {
  if (skills[recipe.skill].level < recipe.level) return false;
  return hasInputs(inventory, recipe);
}
