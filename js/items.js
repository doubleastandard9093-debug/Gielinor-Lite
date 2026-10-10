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
  'Bronze bar': { type: 'processed' },
  'Iron bar': { type: 'processed' },
  'Steel bar': { type: 'processed' },
  'Bowstring': { type: 'processed' },
  'Soft leather': { type: 'processed' },
  'Cooked shrimp': { type: 'food', heal: 3 },
  'Cooked trout': { type: 'food', heal: 7 },
  'Cooked salmon': { type: 'food', heal: 9 },
  'Bronze sword': { type: 'weapon', atk: 5, str: 3, req: { Attack: 1 } },
  'Iron sword': { type: 'weapon', atk: 9, str: 6, req: { Attack: 10 } },
  'Steel sword': { type: 'weapon', atk: 14, str: 10, req: { Attack: 20 } },
  'Wooden shield': { type: 'shield', def: 4, req: { Defence: 1 } },
  'Bronze shield': { type: 'shield', def: 7, req: { Defence: 1 } },
  'Bronze platebody': { type: 'body', def: 8, req: { Defence: 1 } },
  'Iron platebody': { type: 'body', def: 14, req: { Defence: 10 } },
  'Leather body': { type: 'body', def: 6, req: { Defence: 1 } },
  'Shortbow': { type: 'weapon', ranged: 8, req: { Ranged: 1 } },
  'Oak shortbow': { type: 'weapon', ranged: 14, req: { Ranged: 15 } },
  'Bronze arrows': { type: 'ammo', count: 15 },
  'Iron arrows': { type: 'ammo', count: 15 }
};

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
  { name: 'Cook salmon', skill: 'Cooking', level: 25, inputs: { 'Raw salmon': 1 }, output: 'Cooked salmon', xp: 90 }
];

export function canCraft(skills, inventory, recipe) {
  if (skills[recipe.skill].level < recipe.level) return false;
  for (const [item, qty] of Object.entries(recipe.inputs)) {
    if ((inventory[item] || 0) < qty) return false;
  }
  return true;
}
