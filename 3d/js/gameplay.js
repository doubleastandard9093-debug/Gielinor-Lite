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
  'Bronze sword': 15, 'Wooden shield': 10, 'Bronze shield': 20
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
  mon.hp -= dmg;
  onLog(`You hit the ${mon.name} for ${dmg}.`);

  if (mon.hp <= 0) {
    addXP(skills, 'Attack', mon.xp, (s, l) => onLog(`${s} advanced to level ${l}!`));
    addXP(skills, 'Hitpoints', mon.xp);
    player.gold += 5 + mon.level * 2;
    onLog(`You defeat the ${mon.name}! +${5 + mon.level * 2} gold`);
    mon.alive = false;
    mon.mesh.visible = false;
    setTimeout(() => { mon.hp = mon.maxHp; mon.alive = true; mon.mesh.visible = true; }, 12000);
  } else {
    const mDmg = Math.max(0, mon.atk - Math.floor(skills.Defence.level / 4));
    player.hp -= mDmg;
    onLog(`The ${mon.name} hits you for ${mDmg}.`);
    if (player.hp <= 0) {
      player.hp = Math.floor(player.maxHp / 2);
      onLog('You were defeated and respawn with half health.');
    }
  }
}
