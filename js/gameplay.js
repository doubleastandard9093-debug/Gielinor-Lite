import * as THREE from 'three';
import { addXP } from './skills.js';
import { addItem, removeItem } from './playerState.js';
import { ITEMS } from './items.js';

export function gather(node, skills, player, onLog) {
  if (!node.alive) return;
  const dist = Math.hypot(node.mesh.position.x - player.mesh.position.x, node.mesh.position.z - player.mesh.position.z);
  if (dist > 3) { onLog('Get closer.'); return; }

  if (node.type === 'tree') {
    addXP(skills, 'Woodcutting', 25, (s, l) => onLog(`${s} advanced to level ${l}!`));
    addItem(player, 'Logs', 1);
    onLog('You chop some logs.');
    node.alive = false;
    node.mesh.visible = false;
    setTimeout(() => { node.alive = true; node.mesh.visible = true; }, 8000);
  } else if (node.type === 'rock') {
    addXP(skills, 'Mining', 17, (s, l) => onLog(`${s} advanced to level ${l}!`));
    addItem(player, node.ore + ' ore', 1);
    onLog(`You mine some ${node.ore.toLowerCase()} ore.`);
    node.alive = false;
    node.mesh.visible = false;
    setTimeout(() => { node.alive = true; node.mesh.visible = true; }, 6000);
  } else if (node.type === 'fish') {
    addXP(skills, 'Fishing', 20, (s, l) => onLog(`${s} advanced to level ${l}!`));
    addItem(player, 'Raw ' + node.fish, 1);
    onLog(`You catch a ${node.fish}.`);
    node.alive = false;
    node.mesh.visible = false;
    setTimeout(() => { node.alive = true; node.mesh.visible = true; }, 5000);
  }
}

export const SELL_PRICES = {
  'Copper ore': 3, 'Tin ore': 3, 'Iron ore': 10, 'Logs': 2,
  'Raw shrimp': 5, 'Raw trout': 12, 'Cooked shrimp': 4, 'Cooked trout': 10,
  'Bronze sword': 15, 'Wooden shield': 10, 'Bronze shield': 20,
  'Bones': 2, 'Cowhide': 6, 'Raw beef': 3, 'Cooked meat': 4, 'Feather': 1,
  'Coal': 12, 'Iron bar': 25, 'Iron sword': 35
};

export const SHOP_STOCK = [
  { item: 'Bronze sword', price: 40 },
  { item: 'Wooden shield', price: 25 },
  { item: 'Cooked shrimp', price: 8 }
];

export function equip(player, skills, item, onLog) {
  const info = ITEMS[item];
  if (!info) return;
  if (info.type === 'food') {
    if (removeItem(player, item, 1)) {
      player.hp = Math.min(player.maxHp, player.hp + (info.heal || 3));
      onLog(`You eat ${item} and heal.`);
    }
    return;
  }
  if (!['weapon','body','shield'].includes(info.type)) return;
  if (info.req) {
    for (const [sk, lvl] of Object.entries(info.req)) {
      if (skills[sk].level < lvl) {
        onLog(`Need ${sk} ${lvl}.`);
        return;
      }
    }
  }
  const slot = info.type === 'weapon' ? 'weapon' : info.type;
  if (player.equipment[slot]) addItem(player, player.equipment[slot], 1);
  player.equipment[slot] = item;
  removeItem(player, item, 1);
  onLog(`Equipped ${item}.`);
}

// Loot tables: each entry rolls separately. chance is 0-1, qty is [min, max].
export const LOOT_TABLES = {
  Goblin: [
    { item: 'Bones', chance: 1 },
    { item: 'Copper ore', chance: 0.25 },
    { item: 'Tin ore', chance: 0.25 },
    { item: 'Raw shrimp', chance: 0.2 },
    { item: 'Bronze sword', chance: 0.06 }
  ],
  Cow: [
    { item: 'Bones', chance: 1 },
    { item: 'Cowhide', chance: 1 },
    { item: 'Raw beef', chance: 1 }
  ],
  Guard: [
    { item: 'Bones', chance: 1 },
    { item: 'Iron ore', chance: 0.35, qty: [1, 2] },
    { item: 'Coal', chance: 0.25 },
    { item: 'Iron bar', chance: 0.12 },
    { item: 'Iron sword', chance: 0.04 },
    { item: 'Bronze shield', chance: 0.08 }
  ]
};

function rollLoot(mon) {
  const drops = [];
  for (const d of LOOT_TABLES[mon.name] || [{ item: 'Bones', chance: 1 }]) {
    if (Math.random() < d.chance) {
      const [lo, hi] = d.qty || [1, 1];
      drops.push({ item: d.item, qty: lo + Math.floor(Math.random() * (hi - lo + 1)) });
    }
  }
  return drops;
}

const lvlUp = onLog => (s, l) => onLog(`${s} advanced to level ${l}!`);

export function attackMonster(mon, skills, player, onLog) {
  if (!mon.alive) return;
  const dist = Math.hypot(mon.mesh.position.x - player.mesh.position.x, mon.mesh.position.z - player.mesh.position.z);
  if (dist > 3) { onLog('Get closer.'); return; }

  let dmg = 1 + Math.floor(skills.Strength.level / 3);
  const weapon = player.equipment.weapon;
  if (weapon && ITEMS[weapon]?.atk) {
    dmg = ITEMS[weapon].atk + Math.floor(skills.Strength.level / 2);
    if (player.skillTrees.Attack.powerStrike) dmg += 2;
  }
  dmg = Math.min(dmg, mon.hp);
  mon.hp -= dmg;
  onLog(`You hit the ${mon.name} for ${dmg}.`);

  // Combat XP for every point of damage dealt
  addXP(skills, 'Attack', dmg * 2, lvlUp(onLog));
  addXP(skills, 'Strength', dmg * 2, lvlUp(onLog));
  addXP(skills, 'Hitpoints', Math.ceil(dmg * 1.33), lvlUp(onLog));

  if (mon.hp <= 0) {
    // Kill bonus XP
    addXP(skills, 'Attack', mon.xp, lvlUp(onLog));
    addXP(skills, 'Strength', Math.ceil(mon.xp / 2), lvlUp(onLog));
    addXP(skills, 'Hitpoints', Math.ceil(mon.xp / 2), lvlUp(onLog));
    const gold = 5 + mon.level * 2;
    player.gold += gold;

    const drops = rollLoot(mon);
    for (const d of drops) addItem(player, d.item, d.qty);
    const lootText = drops.map(d => d.qty > 1 ? `${d.qty} ${d.item}` : d.item).join(', ');
    onLog(`You defeat the ${mon.name}! +${gold} gold, +${mon.xp} XP.`);
    if (lootText) onLog(`Loot: ${lootText}.`);
    if (drops.some(d => /sword|shield/i.test(d.item))) onLog('Rare drop!');

    mon.alive = false;
    mon.mesh.visible = false;
    setTimeout(() => { mon.hp = mon.maxHp; mon.alive = true; mon.mesh.visible = true; }, 12000);
  } else {
    const mDmg = Math.max(0, mon.atk - Math.floor(skills.Defence.level / 4));
    player.hp -= mDmg;
    onLog(`The ${mon.name} hits you for ${mDmg}.`);
    // Defence XP for taking hits
    if (mDmg > 0) addXP(skills, 'Defence', mDmg * 2, lvlUp(onLog));
    if (player.hp <= 0) {
      player.hp = Math.floor(player.maxHp / 2);
      onLog('You were defeated and respawn with half health.');
    }
  }
}
