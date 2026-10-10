export function createPlayerState() {
  return {
    hp: 10,
    maxHp: 10,
    gold: 0,
    inventory: {},
    equipment: { weapon: null, body: null, legs: null, shield: null },
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
    }
  };
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
