import { isStackable } from './items.js';

export const INV_SIZE = 28;

export const DEFAULT_SETTINGS = {
  run: true,
  autoRetaliate: true,
  showDpad: false,
  autoLoot: false,   // send drops straight to the pack instead of the ground
  shadows: null,     // null = pick automatically (off on phones)
  chatFilter: 'all',
  chatCollapsed: false
};

export function createPlayerState() {
  return {
    hp: 100,
    maxHp: 100,
    mana: 10,
    maxMana: 100,
    gold: 0,
    inventory: {},
    equipment: { weapon: null, body: null, legs: null, shield: null, ammo: null },
    ammoCount: 0,
    runEnergy: 100,
    attackStyle: 0,
    settings: { ...DEFAULT_SETTINGS },
    skillTrees: {
      Attack: { powerStrike: false, criticalHit: false, dualWield: false },
      Strength: { heavyBlow: false, intimidate: false, berserk: false },
      Defence: { thickSkin: false, block: false, fortify: false },
      Hitpoints: { vitality: false, regeneration: false, lastStand: false },
      Ranged: { sharpEye: false, rapidFire: false, sniper: false },
      Mining: { doubleOre: false, prospect: false, richVein: false },
      Woodcutting: { doubleLogs: false, axeMaster: false, lumberjack: false },
      Fishing: { doubleCatch: false, betterBait: false, autoCook: false },
      Smithing: { efficientSmelt: false, masterSmith: false, alloy: false },
      Crafting: { quickCraft: false, masterwork: false, enchant: false },
      Cooking: { betterHeal: false, noBurn: false, bulkCook: false },
      Fletching: { quickFletch: false, masterFletcher: false, specialAmmo: false }
    },
    bank: {}
  };
}

// Slots used in the 28-slot pack. Stackable items (arrows, feathers) take one slot;
// everything else takes one slot per item, like RuneScape.
export function slotsUsed(player) {
  let n = 0;
  for (const [item, qty] of Object.entries(player.inventory)) n += isStackable(item) ? 1 : qty;
  return n;
}

export function freeSlots(player) {
  return Math.max(0, INV_SIZE - slotsUsed(player));
}

export function canAdd(player, item, qty = 1) {
  if (isStackable(item)) return !!player.inventory[item] || freeSlots(player) >= 1;
  return freeSlots(player) >= qty;
}

// How many of this item fit right now.
export function roomFor(player, item, qty) {
  if (isStackable(item)) return canAdd(player, item) ? qty : 0;
  return Math.min(qty, freeSlots(player));
}

export function addItem(player, item, qty = 1) {
  player.inventory[item] = (player.inventory[item] || 0) + qty;
}

export function removeItem(player, item, qty = 1) {
  if (!player.inventory[item] || player.inventory[item] < qty) return false;
  player.inventory[item] -= qty;
  if (player.inventory[item] <= 0) delete player.inventory[item];
  return true;
}

export function recalcMaxHp(player, skills) {
  let bonus = 0;
  if (player.skillTrees.Defence.fortify) bonus += 5;
  if (player.skillTrees.Hitpoints.vitality) bonus += 10;
  player.maxHp = skills.Hitpoints.level * 10 + bonus;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}
