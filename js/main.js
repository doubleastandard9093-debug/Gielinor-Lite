import * as THREE from 'three';
import { createScene, createCamera, createRenderer, createLights, followLight, setShadows, IS_TOUCH } from './scene.js';
import { createWorld, createPileMesh, SPAWN } from './world.js';
import { createPlayer, updatePlayer, applyEquipmentLook, faceToward } from './player.js';
import { createCameraRig, rotateRig, zoomRig, updateRig } from './camera.js';
import { setupInput } from './input.js';
import { setupUI } from './ui.js';
import { createOverlays } from './overlays.js';
import { createMinimap } from './minimap.js';
import { createSkills, addXP, combatLevel, SKILL_ICONS } from './skills.js';
import { createPlayerState, addItem, removeItem, recalcMaxHp, roomFor, canAdd, slotsUsed } from './playerState.js';
import { RECIPES, ITEMS, canCraft, recipeOutputQty, examineItem, isRangedWeapon, slotFor, isStackable } from './items.js';
import {
  TICK_MS, gatherTick, gatherInfo, TREES, ROCKS, FISH_SPOTS, rollPlayerHit, rollMonsterHit, combatXp, rollLoot, RARE_DROPS,
  attackSpeedTicks, attackRange, equip, unequip, eat, sellPrice
} from './gameplay.js';
import { createInventoryUI } from './inventoryUI.js';
import { saveToLocal, loadFromLocal, exportSave, importSave, hasLocalSave, applySaveData } from './save.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
document.body.prepend(renderer.domElement);
const { dirLight } = createLights(scene);
const { nodes, monsters, pickables, ground } = createWorld(scene);
const pm = createPlayer(scene);
const skills = createSkills();
const player = createPlayerState();
player.mesh = pm.mesh;
const rig = createCameraRig();

const hadSave = hasLocalSave();
const loaded = hadSave && loadFromLocal(skills, player, pm);

const ui = setupUI(player.settings);
const log = ui.log;
const overlays = createOverlays();

const playerEnt = {
  mesh: pm.mesh, barHeight: 2.3, lastHitAt: -1e9,
  get hp() { return player.hp; }, get maxHp() { return player.maxHp; }
};

let action = null;          // what the player is doing
let tick = 0;
let nextTickAt = performance.now() + TICK_MS;
let nextPlayerAttack = 0;
let lastCombatTick = -100;
const piles = [];
let dirty = true;
const markDirty = () => { dirty = true; };

function giveXP(skill, amount) {
  if (amount <= 0) return;
  addXP(skills, skill, amount, (s, l) => {
    ui.levelUp(s, SKILL_ICONS[s], l);
    log(`Congratulations, you just advanced a ${s} level. You are now level ${l}.`, 'skill');
    if (s === 'Hitpoints') { const old = player.maxHp; recalcMaxHp(player, skills); player.hp += player.maxHp - old; }
  });
  ui.xpDrop(skill, SKILL_ICONS[skill], amount);
  markDirty();
}

function shadowsOn() {
  return player.settings.shadows === null || player.settings.shadows === undefined ? !IS_TOUCH : !!player.settings.shadows;
}

// ---------------------------------------------------------------------------
// Side panel callbacks
// ---------------------------------------------------------------------------
const invUI = createInventoryUI({
  player, skills,
  attackSpeed: () => attackSpeedTicks(player),
  shadowsOn,
  useItem(item) { useItem(item); },
  itemMenu(item, x, y, mode) { itemMenu(item, x, y, mode); },
  unequip(slot) { if (unequip(player, slot, log)) afterEquip(); },
  wornMenu(slot, x, y) {
    const item = player.equipment[slot];
    ui.showMenu(x, y, [
      { action: 'Remove', target: item, color: '#ff9040', fn: () => { if (unequip(player, slot, log)) afterEquip(); } },
      { action: 'Examine', target: item, color: '#ff9040', fn: () => log(examineItem(item), 'examine') }
    ]);
  },
  deposit, withdraw, depositAll, depositWorn,
  bankMenu(item, x, y) {
    ui.showMenu(x, y, [
      ...[1, 5, 10, 'All'].map(q => ({ action: `Withdraw-${q}`, target: item, color: '#ff9040', fn: () => withdraw(item, q) })),
      { action: 'Examine', target: item, color: '#ff9040', fn: () => log(examineItem(item), 'examine') }
    ]);
  },
  buy, sell,
  shopMenu(item, price, x, y) {
    ui.showMenu(x, y, [
      { action: 'Value', target: item, color: '#ff9040', fn: () => log(`${item}: currently costs ${price} coins.`, 'game') },
      ...[1, 5, 10].map(q => ({ action: `Buy ${q}`, target: item, color: '#ff9040', fn: () => buy(item, price, q) })),
      { action: 'Examine', target: item, color: '#ff9040', fn: () => log(examineItem(item), 'examine') }
    ]);
  },
  craft(name, n) {
    const recipe = RECIPES.find(r => r.name === name);
    if (!recipe) return;
    startAction({ kind: 'craft', recipe, left: n, wait: 0 });
    craftOne();
  },
  setting(act) { setting(act); }
});

function afterEquip() {
  applyEquipmentLook(pm, player.equipment);
  markDirty();
}

function useItem(item) {
  const info = ITEMS[item];
  if (!info) return;
  if (info.type === 'food') {
    if (eat(player, item, log)) {
      if (tick - lastCombatTick < 8) nextPlayerAttack = Math.max(nextPlayerAttack, tick + 2); // eating delays your next hit
      markDirty();
    }
  } else if (slotFor(item)) {
    if (equip(player, skills, item, log)) afterEquip();
  } else {
    // No direct use: show what it's for
    const r = RECIPES.find(rc => rc.inputs[item] && canCraft(skills, player.inventory, rc));
    log(examineItem(item) + (r ? ` (Craft tab: ${r.name})` : ''), 'examine');
  }
}

function itemMenu(item, x, y, mode) {
  const info = ITEMS[item] || {};
  const c = '#ff9040';
  const opts = [];
  if (mode === 'bank') {
    for (const q of [1, 5, 10, 'All']) opts.push({ action: `Deposit-${q}`, target: item, color: c, fn: () => deposit(item, q) });
  } else if (mode === 'shop') {
    opts.push({ action: 'Value', target: item, color: c, fn: () => log(`${item}: shop will buy for ${sellPrice(item)} coins.`, 'game') });
    for (const q of [1, 5, 'All']) opts.push({ action: `Sell ${q}`, target: item, color: c, fn: () => sell(item, q) });
  } else {
    if (info.type === 'food') opts.push({ action: 'Eat', target: item, color: c, fn: () => useItem(item) });
    else if (slotFor(item)) opts.push({ action: info.type === 'weapon' ? 'Wield' : 'Wear', target: item, color: c, fn: () => useItem(item) });
    const recipes = RECIPES.filter(r => r.inputs[item] && canCraft(skills, player.inventory, r)).slice(0, 3);
    for (const r of recipes) opts.push({ action: r.name.split(' ')[0], target: r.output, color: c, fn: () => { startAction({ kind: 'craft', recipe: r, left: Infinity, wait: 0 }); craftOne(); } });
    opts.push({ action: 'Drop', target: item, color: c, fn: () => dropItem(item, isStackable(item) ? player.inventory[item] : 1) });
    if (!isStackable(item) && (player.inventory[item] || 0) > 1) opts.push({ action: 'Drop all', target: item, color: c, fn: () => dropItem(item, player.inventory[item]) });
  }
  opts.push({ action: 'Examine', target: item, color: c, fn: () => log(examineItem(item), 'examine') });
  ui.showMenu(x, y, opts);
}

function dropItem(item, qty) {
  if (!qty || !removeItem(player, item, qty)) return;
  addToPile(pm.mesh.position.x, pm.mesh.position.z, [{ item, qty }]);
  log(`You drop ${qty > 1 ? qty + ' x ' : 'the '}${item}.`, 'game');
  markDirty();
}

// ---- Bank ----
function qtyOf(have, q) { return q === 'All' ? have : Math.min(have, q); }
function deposit(item, q) {
  const n = qtyOf(player.inventory[item] || 0, q);
  if (!n) return;
  removeItem(player, item, n);
  player.bank[item] = (player.bank[item] || 0) + n;
  markDirty();
}
function withdraw(item, q) {
  const have = player.bank[item] || 0;
  let n = Math.min(qtyOf(have, q), roomFor(player, item, qtyOf(have, q)));
  if (!n) { log("You don't have enough inventory space.", 'warn'); return; }
  player.bank[item] -= n;
  if (player.bank[item] <= 0) delete player.bank[item];
  addItem(player, item, n);
  markDirty();
}
function depositAll() {
  const items = Object.keys(player.inventory);
  if (!items.length) { log('You have nothing to deposit.', 'game'); return; }
  for (const it of items) deposit(it, 'All');
  log('You deposit your inventory.', 'game');
}
function depositWorn() {
  let any = false;
  for (const [slot, item] of Object.entries(player.equipment)) {
    if (!item) continue;
    const n = slot === 'ammo' ? player.ammoCount : 1;
    player.bank[item] = (player.bank[item] || 0) + n;
    player.equipment[slot] = null;
    if (slot === 'ammo') player.ammoCount = 0;
    any = true;
  }
  if (any) { log('You deposit your worn items.', 'game'); afterEquip(); }
}

// ---- Shop ----
function buy(item, price, q) {
  let bought = 0;
  for (let i = 0; i < q; i++) {
    if (player.gold < price) { if (!bought) log("You don't have enough coins.", 'warn'); break; }
    if (!canAdd(player, item)) { log("You don't have enough inventory space.", 'warn'); break; }
    player.gold -= price;
    addItem(player, item, 1);
    bought++;
  }
  if (bought) log(`You buy ${bought > 1 ? bought + ' x ' : ''}${item} for ${bought * price} coins.`, 'game');
  markDirty();
}
function sell(item, q) {
  const n = qtyOf(player.inventory[item] || 0, q);
  if (!n) return;
  removeItem(player, item, n);
  const gp = sellPrice(item) * n;
  player.gold += gp;
  log(`You sell ${n > 1 ? n + ' x ' : ''}${item} for ${gp} coins.`, 'game');
  markDirty();
}

// ---- Settings ----
const inputCtl = setupInput(renderer.domElement, {
  onTap, onContext, onHover,
  onRotate: (dy, dp) => rotateRig(rig, dy, dp),
  onZoom: f => zoomRig(rig, f),
  onEscape: () => { ui.hideMenu(); invUI.close(); },
  onDpad: () => { if (action && action.kind !== 'craft') stopAction(); },
  onKey: k => { if ('wasd'.includes(k) && action && action.kind !== 'craft') stopAction(); }
});
const keys = inputCtl.keys;

function setting(act) {
  const s = player.settings;
  if (act === 'save') { if (saveToLocal(skills, player, pm)) log('Game saved.', 'game'); }
  else if (act === 'export') { exportSave(skills, player, pm); log('Save exported.', 'game'); }
  else if (act === 'import') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      if (!input.files[0]) return;
      importSave(input.files[0], skills, player, pm, ok => {
        if (ok) { afterLoad(); log('Save imported.', 'game'); } else log('Import failed.', 'warn');
      });
    };
    input.click();
  }
  else if (act === 'dpad') { s.showDpad = !s.showDpad; inputCtl.setDpadVisible(s.showDpad); }
  else if (act === 'shadows') { s.shadows = !shadowsOn(); setShadows(renderer, dirLight, s.shadows); }
  else if (act === 'retaliate') s.autoRetaliate = !s.autoRetaliate;
  else if (act === 'run') toggleRun();
  else if (act === 'autoloot') s.autoLoot = !s.autoLoot;
  else if (act === 'camera') { rig.targetYaw = 0; rig.targetPitch = 0.9; rig.targetDist = window.innerHeight > window.innerWidth ? 19 : 17; }
  markDirty();
}
function toggleRun() {
  if (!player.settings.run && player.runEnergy < 1) { log('You have no run energy left.', 'warn'); return; }
  player.settings.run = !player.settings.run;
  markDirty();
}

const minimap = createMinimap({
  onWalk: (x, z) => { stopAction(); walkTo(x, z); },
  onCompass: () => { rig.targetYaw = Math.round(rig.targetYaw / (Math.PI * 2)) * Math.PI * 2; },
  onRunToggle: toggleRun
});

// ---------------------------------------------------------------------------
// Picking what was tapped
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpV = new THREE.Vector3();
const pickList = [];

function entityOf(obj) {
  while (obj) { if (obj.userData && obj.userData.entity) return obj.userData.entity; obj = obj.parent; }
  return null;
}
function interactive(ent) {
  if (!ent) return false;
  if (ent.isPile) return true;
  if (ent.hp !== undefined) return ent.alive;
  return true;
}
function pick(cx, cy, all = false) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  pickList.length = 0;
  for (const p of pickables) if (p.visible) pickList.push(p);
  for (const p of piles) pickList.push(p.mesh);
  const ents = [];
  const hits = raycaster.intersectObjects(pickList, true);
  for (const h of hits) {
    const ent = entityOf(h.object);
    if (interactive(ent) && !ents.includes(ent)) { ents.push(ent); if (!all) break; }
  }
  // Forgiving search for small things on a phone screen: anything within ~30px.
  if (all || !ents.length) {
    const near = [];
    const maxD = IS_TOUCH ? 34 : 22;
    const consider = (ent, x, y, z) => {
      if (ents.includes(ent)) return;
      tmpV.set(x, y, z).project(camera);
      if (tmpV.z > 1) return;
      const sx = (tmpV.x + 1) / 2 * rect.width + rect.left, sy = (1 - tmpV.y) / 2 * rect.height + rect.top;
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < maxD) near.push({ ent, d });
    };
    for (const m of monsters) if (m.alive) consider(m, m.mesh.position.x, 0.9, m.mesh.position.z);
    for (const p of piles) consider(p, p.x, 0.15, p.z);
    for (const n of nodes) if (n.type === 'fish' || n.type === 'rock') consider(n, n.x, 0.4, n.z);
    near.sort((a, b) => a.d - b.d);
    for (const n of near) ents.push(n.ent);
  }
  const g = raycaster.intersectObject(ground);
  const point = g.length ? g[0].point : null;
  if (!ents.length && !point) return null;
  return { ent: ents[0] || null, ents: all ? ents.slice(0, 4) : ents.slice(0, 1), point };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function walkTo(x, z) {
  pm.target = { x, z };
  pm.stopDist = 0.1;
}
function stopAction() {
  action = null;
  pm.actionAnim = 0;
}
function startAction(a) {
  action = a;
  pm.target = null;
}

function levelColor(lvl) {
  const d = lvl - combatLevel(skills);
  if (d >= 10) return '#ff0000'; if (d >= 6) return '#ff3000'; if (d >= 3) return '#ff7000'; if (d > 0) return '#ffb000';
  if (d === 0) return '#ffff00'; if (d > -3) return '#c0ff00'; if (d > -6) return '#80ff00'; return '#00ff00';
}
const EXAMINE = {
  Tree: 'A commonly found tree. I can chop it down.', Oak: 'A beautiful old oak.', Willow: 'A droopy tree.',
  Rocks: 'A rocky outcrop.', Net: 'I can see small fish swimming in the water. (Net: shrimp)',
  Lure: 'I can see fish leaping in the water. (Lure: trout at 20, salmon at 30 Fishing)',
  Merchant: 'A trader of general goods.', 'Bank booth': 'The bank teller will serve you here.',
  Goblin: 'An ugly green creature.', Cow: 'Converts grass to beef.', Guard: 'He tries to keep order around here.'
};
function entExamine(ent) {
  if (ent.type === 'tree' && !ent.alive) return 'This tree has been cut down.';
  if (ent.type === 'rock' && !ent.alive) return 'There is currently no ore available in this rock.';
  if (ent.type === 'fish') return EXAMINE[ent.kind];
  return EXAMINE[ent.kind] || EXAMINE[ent.name] || `It's a ${ent.name}.`;
}

function optionsFor(ent) {
  const cy = '#00ffff';
  if (ent.isPile) {
    const opts = Object.keys(ent.items).map(item => ({ action: 'Take', target: item + (ent.items[item] > 1 ? ` (${ent.items[item]})` : ''), color: '#ff9040', fn: () => startAction({ kind: 'pickup', pile: ent, item }) }));
    if (opts.length > 1) opts.unshift({ action: 'Take all', target: '', fn: () => startAction({ kind: 'pickup', pile: ent }) });
    return opts;
  }
  if (ent.hp !== undefined) {
    return [
      { action: 'Attack', target: `${ent.name} (level-${ent.level})`, color: levelColor(ent.level), fn: () => startAction({ kind: 'attack', mon: ent }) },
      { action: 'Examine', target: ent.name, color: '#ffff00', fn: () => log(entExamine(ent), 'examine') }
    ];
  }
  const ex = { action: 'Examine', target: ent.name, color: cy, fn: () => log(entExamine(ent), 'examine') };
  switch (ent.type) {
    case 'tree': return [{ action: 'Chop down', target: ent.name, color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'rock': return [
      { action: 'Mine', target: 'Rocks', color: cy, fn: () => startAction({ kind: 'gather', node: ent }) },
      { action: 'Prospect', target: 'Rocks', color: cy, fn: () => log(ent.alive ? `This rock contains ${ent.ore.toLowerCase()}. (Mining ${ROCKS[ent.ore].level})` : 'There is currently no ore available in this rock.', 'examine') }, ex];
    case 'fish': return [{ action: FISH_SPOTS[ent.kind].verb, target: 'Fishing spot', color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'shop': return [
      { action: 'Trade', target: 'Merchant', color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent }) },
      { action: 'Talk-to', target: 'Merchant', color: '#ffff00', fn: () => log('Merchant: "Welcome! I buy and sell all sorts. Tap Trade to see my wares."', 'game') },
      { ...ex, color: '#ffff00' }];
    case 'bank': return [{ action: 'Bank', target: 'Bank booth', color: cy, fn: () => startAction({ kind: 'bank', node: ent }) }, ex];
  }
  return [ex];
}

function onTap(x, y) {
  ui.hideMenu();
  const hit = pick(x, y);
  if (!hit) return;
  if (hit.ent) {
    ui.tapMarker(x, y, true);
    optionsFor(hit.ent)[0].fn();
    if (invUI.mode && !['bank', 'shop'].includes(action && action.kind)) invUI.close();
  } else {
    ui.tapMarker(x, y, false);
    stopAction();
    if (invUI.mode) invUI.close();
    walkTo(hit.point.x, hit.point.z);
  }
}
function onContext(x, y) {
  const hit = pick(x, y, true);
  if (!hit) return;
  // Like RuneScape, list the options for everything under your finger.
  const opts = [];
  for (const ent of hit.ents) opts.push(...optionsFor(ent));
  const point = hit.point;
  if (point) opts.push({ action: 'Walk here', fn: () => { stopAction(); walkTo(point.x, point.z); ui.tapMarker(x, y, false); } });
  if (opts.length) ui.showMenu(x, y, opts);
}
let hoverAt = 0;
function onHover(x, y) {
  const now = performance.now();
  if (now - hoverAt < 120) return;
  hoverAt = now;
  const hit = pick(x, y);
  hoverText = null;
  if (hit && hit.ent) {
    const o = optionsFor(hit.ent);
    hoverText = `${o[0].action} <span style="color:${o[0].color || '#ff0'}">${o[0].target}</span>${o.length > 1 ? ` <small>/ ${o.length} more options</small>` : ''}`;
  }
  renderer.domElement.style.cursor = hit && hit.ent ? 'pointer' : 'default';
}
let hoverText = null;

// ---- Ground items ----
function addToPile(x, z, drops) {
  let pile = piles.find(p => Math.hypot(p.x - x, p.z - z) < 0.6);
  if (!pile) {
    if (piles.length >= 25) removePile(piles[0]);
    const mesh = createPileMesh(scene, x, z);
    pile = { isPile: true, name: 'Items', x, z, items: {}, mesh, expires: 0 };
    mesh.userData.entity = pile;
    piles.push(pile);
  }
  for (const d of drops) pile.items[d.item] = (pile.items[d.item] || 0) + d.qty;
  pile.expires = performance.now() + 120000;
  return pile;
}
function removePile(p) {
  scene.remove(p.mesh);
  const i = piles.indexOf(p);
  if (i >= 0) piles.splice(i, 1);
}
function takeFromPile(pile, only) {
  const got = [];
  let full = false;
  for (const item of Object.keys(pile.items)) {
    if (only && item !== only) continue;
    const qty = pile.items[item];
    if (item === 'Coins') { player.gold += qty; got.push(`${qty} coins`); delete pile.items[item]; continue; }
    const n = roomFor(player, item, qty);
    if (n < qty) full = true;
    if (!n) continue;
    addItem(player, item, n);
    pile.items[item] -= n;
    if (pile.items[item] <= 0) delete pile.items[item];
    got.push(n > 1 ? `${n} x ${item}` : item);
  }
  if (got.length) log(`You pick up: ${got.join(', ')}.`, 'loot');
  if (full) log("You don't have enough inventory space.", 'warn');
  if (!Object.keys(pile.items).length) removePile(pile);
  markDirty();
}

// ---- Gathering ----
const SKILL_VERB = { Woodcutting: 'You swing your axe at the tree.', Mining: 'You swing your pick at the rock.', Fishing: 'You attempt to catch a fish.' };
const GOT = { 'Logs': 'You get some logs.', 'Oak logs': 'You get some oak logs.', 'Willow logs': 'You get some willow logs.' };
function depleteNode(node, ms) {
  node.alive = false;
  node.full.visible = false;
  if (node.depleted) node.depleted.visible = true;
  node.respawnAt = performance.now() + ms;
}
function respawnNode(node) {
  node.alive = true;
  node.full.visible = true;
  if (node.depleted) node.depleted.visible = false;
}

function doGatherTick(a) {
  const node = a.node;
  if (!node.alive) {
    log(node.type === 'tree' ? 'This tree has been cut down.' : 'There is currently no ore available in this rock.', 'game');
    stopAction(); return;
  }
  if (a.wait > 0) { a.wait--; return; }
  a.wait = 1; // try every 2 ticks
  pm.actionAnim = 1; pm.actionKind = 'tool';
  const r = gatherTick(node, skills, player);
  if (!a.started) { a.started = true; const info = gatherInfo(node); if (info && !r?.error) log(SKILL_VERB[info.skill], 'skill'); }
  if (!r) return;
  if (r.error) { log(r.error, 'warn'); stopAction(); return; }
  addItem(player, r.item, 1);
  giveXP(r.skill, r.xp);
  log(GOT[r.item] || (node.type === 'rock' ? `You manage to mine some ${r.item.replace(' ore', '').toLowerCase()}.` : `You catch some ${r.item.replace('Raw ', '')}.`), 'skill');
  if (r.depleted) {
    depleteNode(node, node.type === 'tree' ? TREES[node.kind].respawn : ROCKS[node.ore].respawn);
    stopAction();
  } else if (!canAdd(player, r.item)) {
    log('Your inventory is too full to hold any more.', 'warn');
    stopAction();
  }
}

// ---- Crafting ----
function craftOne() {
  const a = action;
  if (!a || a.kind !== 'craft') return;
  const r = a.recipe;
  if (skills[r.skill].level < r.level) { log(`You need a ${r.skill} level of ${r.level} to do that.`, 'warn'); stopAction(); return; }
  if (!canCraft(skills, player.inventory, r)) { if (!a.made) log(`You don't have the materials for that.`, 'warn'); stopAction(); return; }
  // Inputs free their slots first, so check room afterwards.
  for (const [item, qty] of Object.entries(r.inputs)) removeItem(player, item, qty);
  const outQty = recipeOutputQty(r);
  if (!canAdd(player, r.output, outQty)) {
    for (const [item, qty] of Object.entries(r.inputs)) addItem(player, item, qty);
    log("You don't have enough inventory space.", 'warn'); stopAction(); return;
  }
  addItem(player, r.output, outQty);
  giveXP(r.skill, r.xp);
  a.made = (a.made || 0) + 1;
  log(`You make ${outQty > 1 ? outQty + ' ' : ''}${r.output}.`, 'skill');
  pm.actionAnim = 1; pm.actionKind = 'tool';
  a.left--;
  a.wait = 2;
  if (a.left <= 0) stopAction();
  markDirty();
}

// ---- Combat ----
const arrowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: 0x5a3a1a }));
arrowMesh.visible = false;
scene.add(arrowMesh);
let arrowFlight = null;

function distTo(ent) {
  return Math.hypot(ent.mesh.position.x - pm.mesh.position.x, ent.mesh.position.z - pm.mesh.position.z);
}

function playerAttack(mon, now) {
  const ranged = isRangedWeapon(player.equipment.weapon);
  if (ranged) {
    if (!player.equipment.ammo || player.ammoCount <= 0) { log('There is no ammo left in your quiver.', 'warn'); stopAction(); return; }
    player.ammoCount--;
    if (player.ammoCount <= 0) { player.equipment.ammo = null; player.ammoCount = 0; }
    arrowFlight = { from: pm.mesh.position.clone().setY(1.3), mon, t: 0 };
  }
  pm.actionAnim = 1; pm.actionKind = ranged ? 'bow' : 'melee';
  const dmg = rollPlayerHit(player, skills, mon);
  mon.hp -= dmg;
  mon.lastHitAt = now;
  overlays.splat(mon, dmg, now);
  const xp = combatXp(player, dmg);
  for (const [s, v] of Object.entries(xp)) giveXP(s, v);
  lastCombatTick = tick;
  if (mon.state !== 'fight') { mon.state = 'fight'; mon.nextAttackTick = tick + 1; }
  if (mon.hp <= 0) killMonster(mon, now);
  markDirty();
}

function killMonster(mon, now) {
  mon.alive = false;
  mon.dying = true;
  mon.deathT = 0;
  mon.state = 'dead';
  mon.respawnAt = 0;
  log(`You have defeated the ${mon.name}.`, 'combat');
  if (action && action.mon === mon) stopAction();
  const drops = rollLoot(mon.name);
  const x = mon.mesh.position.x, z = mon.mesh.position.z;
  if (drops.some(d => RARE_DROPS.has(d.item))) log('Rare drop! Check the loot pile.', 'loot');
  if (player.settings.autoLoot) {
    const pile = addToPile(x, z, drops);
    takeFromPile(pile);
  } else {
    setTimeout(() => addToPile(x, z, drops), 900);
  }
}

function monsterAttack(mon, now) {
  const dmg = rollMonsterHit(mon, player, skills);
  player.hp = Math.max(0, player.hp - dmg);
  playerEnt.lastHitAt = now;
  overlays.splat(playerEnt, dmg, now);
  mon.lungeT = 1;
  lastCombatTick = tick;
  markDirty();
  if (player.hp <= 0) playerDied();
  else if (player.settings.autoRetaliate && (!action || action.kind === 'gather' || action.kind === 'craft') && !pm.target && !keys.w && !keys.a && !keys.s && !keys.d) {
    startAction({ kind: 'attack', mon });
  }
}

function playerDied() {
  log('Oh dear, you are dead!', 'warn');
  ui.banner('<div class="lu-icon">💀</div><div><b>Oh dear, you are dead!</b><br>You wake up in town with full health.</div>');
  stopAction();
  pm.target = null;
  pm.mesh.position.set(SPAWN.x + 1, 0, SPAWN.z + 1);
  rig.fx = pm.mesh.position.x; rig.fz = pm.mesh.position.z;
  recalcMaxHp(player, skills);
  player.hp = player.maxHp;
  player.runEnergy = 100;
  for (const m of monsters) if (m.state === 'fight') m.state = 'return';
  log('You wake up back in town. You keep all of your items.', 'game');
}

// ---------------------------------------------------------------------------
// Game tick (every 0.6s)
// ---------------------------------------------------------------------------
function inRange(ent, range) { return distTo(ent) <= range + (ent.radius || 0.5); }

function gameTick(now) {
  tick++;
  // Hitpoint regen and run energy
  if (tick % 6 === 0 && player.hp < player.maxHp && player.hp > 0) { player.hp++; markDirty(); }
  if (!(player.settings.run && pm.moving)) player.runEnergy = Math.min(100, player.runEnergy + 0.45);

  // Respawns
  for (const n of nodes) if (!n.alive && n.respawnAt && now >= n.respawnAt) respawnNode(n);
  for (const m of monsters) {
    if (m.state === 'dead' && now >= m.respawnAt && m.respawnAt) {
      m.alive = true; m.dying = false; m.hp = m.maxHp; m.state = 'idle';
      m.mesh.visible = true; m.mesh.rotation.set(0, 0, 0); m.mesh.position.set(m.spawnX, 0, m.spawnZ);
    }
  }
  for (let i = piles.length - 1; i >= 0; i--) if (now > piles[i].expires) removePile(piles[i]);

  // Monster combat
  for (const m of monsters) {
    if (m.state !== 'fight' || !m.alive) continue;
    const d = distTo(m);
    const leash = Math.hypot(m.mesh.position.x - m.spawnX, m.mesh.position.z - m.spawnZ);
    if (d > 13 || leash > 16) { m.state = 'return'; continue; }
    if (d <= 1.7 && tick >= m.nextAttackTick) {
      m.nextAttackTick = tick + m.speed;
      monsterAttack(m, now);
    }
  }

  // Player action
  const a = action;
  if (!a) return;
  if (a.kind === 'gather') {
    if (inRange(a.node, 0.9)) doGatherTick(a);
  } else if (a.kind === 'attack') {
    const mon = a.mon;
    if (!mon.alive) { stopAction(); return; }
    if (inRange(mon, attackRange(player)) && tick >= nextPlayerAttack) {
      nextPlayerAttack = tick + attackSpeedTicks(player);
      playerAttack(mon, now);
    }
  } else if (a.kind === 'craft') {
    if (a.wait > 0) a.wait--; else craftOne();
  }
}

// Called every frame: walk toward the action target and handle arrivals.
function updateAction() {
  const a = action;
  if (!a) return;
  let ent = a.node || a.mon || a.pile;
  if (!ent) return;
  if (a.kind === 'pickup' && !piles.includes(a.pile)) { stopAction(); return; }
  const range = a.kind === 'attack' ? attackRange(player) : a.kind === 'pickup' ? 0.15 : a.kind === 'gather' ? 0.9 : 1.0;
  const ex = ent.mesh.position.x, ez = ent.mesh.position.z;
  if (!inRange(ent, range)) {
    pm.target = { x: ex, z: ez };
    pm.stopDist = range + (ent.radius || 0.5) - 0.15;
    return;
  }
  pm.target = null;
  faceToward(pm, ex, ez);
  if (a.kind === 'pickup') { takeFromPile(a.pile, a.item); stopAction(); }
  else if (a.kind === 'bank') { invUI.open('bank'); stopAction(); }
  else if (a.kind === 'shop') { log('Merchant: "Have a look at my wares."', 'game'); invUI.open('shop'); stopAction(); }
}

// ---------------------------------------------------------------------------
// Per-frame updates
// ---------------------------------------------------------------------------
function updateMonsters(dt, now) {
  for (const m of monsters) {
    const pos = m.mesh.position;
    if (m.dying) {
      m.deathT += dt;
      const t = Math.min(1, m.deathT / 0.9);
      m.mesh.rotation.z = t * Math.PI / 2;
      pos.y = -t * 0.6;
      if (t >= 1) { m.dying = false; m.mesh.visible = false; m.respawnAt = now + 15000; }
      continue;
    }
    if (!m.alive) continue;
    let tx = null, tz = null, speed = 1.4, stop = 0.1;
    if (m.state === 'fight') { tx = pm.mesh.position.x; tz = pm.mesh.position.z; speed = 3.0; stop = 1.3; }
    else if (m.state === 'return') {
      tx = m.spawnX; tz = m.spawnZ; speed = 3.0;
      if (Math.hypot(pos.x - tx, pos.z - tz) < 0.4) { m.state = 'idle'; m.hp = m.maxHp; }
    } else {
      if (now > m.wanderAt) {
        m.wanderAt = now + 3000 + Math.random() * 6000;
        m.wx = m.spawnX + (Math.random() - 0.5) * 2 * m.roam;
        m.wz = m.spawnZ + (Math.random() - 0.5) * 2 * m.roam;
        if (m.bounds) {
          m.wx = Math.max(m.bounds.minX, Math.min(m.bounds.maxX, m.wx));
          m.wz = Math.max(m.bounds.minZ, Math.min(m.bounds.maxZ, m.wz));
        }
      }
      if (m.wx !== undefined) { tx = m.wx; tz = m.wz; }
    }
    let moving = false;
    if (tx !== null) {
      const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
      if (d > stop) {
        const step = Math.min(d - stop, speed * dt);
        pos.x += dx / d * step; pos.z += dz / d * step;
        moving = step > 0.001;
        m.mesh.rotation.y = Math.atan2(dx, dz);
      } else if (m.state === 'fight') {
        m.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    m.walkT = (m.walkT || 0) + (moving ? dt * 9 : 0);
    const sw = moving ? Math.sin(m.walkT) * 0.6 : 0;
    m.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? sw : -sw); });
    if (m.lungeT > 0) { m.lungeT = Math.max(0, m.lungeT - dt * 3); m.body.position.z = Math.sin(m.lungeT * Math.PI) * 0.35; }
  }
}

function updateFish(dt) {
  for (const n of nodes) {
    if (n.type !== 'fish') continue;
    const a = n.anim;
    a.t += dt;
    const s = 1 + Math.sin(a.t * 2.4) * 0.15;
    a.ring.scale.set(s, s, s);
    const s2 = 0.6 + Math.sin(a.t * 3.1 + 1) * 0.12;
    a.ring2.scale.set(s2, s2, s2);
    a.bubble.position.y = 0.1 + ((a.t * 0.6) % 1) * 0.3;
  }
}

function updateArrow(dt) {
  if (!arrowFlight) return;
  const f = arrowFlight;
  f.t += dt / 0.35;
  if (f.t >= 1 || !f.mon.mesh.visible) { arrowMesh.visible = false; arrowFlight = null; return; }
  const to = f.mon.mesh.position;
  arrowMesh.visible = true;
  arrowMesh.position.set(f.from.x + (to.x - f.from.x) * f.t, 1.3 + Math.sin(f.t * Math.PI) * 0.6 - f.t * 0.3, f.from.z + (to.z - f.from.z) * f.t);
  arrowMesh.lookAt(to.x, 1, to.z);
}

const ACTION_LABEL = { gather: n => ({ tree: '🪓 Woodcutting', rock: '⛏️ Mining', fish: '🎣 Fishing' })[n.node.type], attack: a => `⚔️ Fighting ${a.mon.name}`, craft: a => `🔨 ${a.recipe.name}`, pickup: () => '✋ Picking up', bank: () => '🏦 Going to bank', shop: () => '🛒 Going to Merchant' };
function updateStatus() {
  let html = '';
  if (hoverText && !IS_TOUCH) html = hoverText;
  else if (action) html = ACTION_LABEL[action.kind](action) || '';
  else if (pm.target) html = 'Walking';
  ui.setStatus(html);
}

// ---------------------------------------------------------------------------
// Load / start
// ---------------------------------------------------------------------------
function afterLoad() {
  recalcMaxHp(player, skills);
  applyEquipmentLook(pm, player.equipment);
  inputCtl.setDpadVisible(!!player.settings.showDpad);
  setShadows(renderer, dirLight, shadowsOn());
  rig.fx = pm.mesh.position.x; rig.fz = pm.mesh.position.z;
  for (const note of applySaveData.lastNotes || []) log(note, 'warn');
  applySaveData.lastNotes = [];
  markDirty();
}

if (loaded) {
  log('Welcome back to Gielinor.', 'game');
} else {
  // Fresh start: a small starter kit like RuneScape's tutorial gear.
  addItem(player, 'Bronze sword', 1);
  addItem(player, 'Wooden shield', 1);
  addItem(player, 'Cooked shrimp', 3);
  player.gold = 25;
  log('Welcome to Gielinor.', 'game');
  log('You have been given a sword, a shield and some food. Tap them to equip or eat.', 'game');
}
log('Tap to walk or act. Hold for more options. Drag to turn the camera, pinch to zoom.', 'game');
afterLoad();

// Save every 15 seconds and whenever the app goes to the background.
setInterval(() => saveToLocal(skills, player, pm), 15000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveToLocal(skills, player, pm);
  else { last = performance.now(); nextTickAt = last + TICK_MS; }
});
window.addEventListener('pagehide', () => saveToLocal(skills, player, pm));

// Shift the view so your character sits in the open part of the screen,
// not underneath the side panel or chat box.
let viewKey = '';
function updateViewOffset() {
  const W = window.innerWidth, H = window.innerHeight;
  const pr = invUI.panel.getBoundingClientRect();
  const chatTop = document.getElementById('chat').getBoundingClientRect().top;
  let cx = W / 2, cy = H / 2;
  if (H >= W) {
    // Portrait: centre in the space above the panel.
    cy = Math.max(H * 0.3, Math.min(H * 0.5, (pr.top + 0) / 2 + 20));
  } else {
    // Landscape: centre in the space left of the panel.
    cx = Math.max(W * 0.3, Math.min(W * 0.5, pr.left / 2));
    cy = Math.max(H * 0.35, Math.min(H * 0.5, chatTop / 2 + 20));
  }
  const key = `${W}x${H}:${cx | 0},${cy | 0}`;
  if (key === viewKey) return;
  viewKey = key;
  camera.aspect = W / H;
  // Portrait phones: widen the view so you can see more than a few steps to each side.
  camera.fov = camera.aspect < 1 ? Math.min(70, 2 * Math.atan(Math.tan(17 * Math.PI / 180) / camera.aspect) * 180 / Math.PI) : 50;
  camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateViewOffset();
});
if (window.innerHeight > window.innerWidth) { rig.dist = rig.targetDist = 19; }

const barEnts = [...monsters, playerEnt];
let last = performance.now();
let frame = 0;
function animate(now) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  now = now || performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frame++;

  // Arrow keys turn the camera
  if (keys.left) rotateRig(rig, dt * 1.8, 0);
  if (keys.right) rotateRig(rig, -dt * 1.8, 0);
  if (keys.up) rotateRig(rig, 0, dt * 1.2);
  if (keys.down) rotateRig(rig, 0, -dt * 1.2);

  updateAction();
  const running = player.settings.run && player.runEnergy > 0;
  const moved = updatePlayer(pm, keys, dt, running, rig.yaw);
  if (running && moved > 0) {
    player.runEnergy = Math.max(0, player.runEnergy - moved * 0.7);
    if (player.runEnergy <= 0) { player.settings.run = false; log('You have run out of energy.', 'warn'); markDirty(); }
  }

  while (now >= nextTickAt) {
    gameTick(now);
    nextTickAt += TICK_MS;
    if (now - nextTickAt > TICK_MS * 5) nextTickAt = now + TICK_MS;
  }

  updateMonsters(dt, now);
  updateFish(dt);
  updateArrow(dt);
  updateRig(rig, camera, pm.mesh.position.x, pm.mesh.position.z, dt);
  followLight(dirLight, rig.fx, rig.fz);
  renderer.render(scene, camera);

  overlays.update(camera, barEnts, now);
  if (frame % 3 === 0) {
    minimap.draw(pm.mesh.position.x, pm.mesh.position.z, rig.yaw, nodes, monsters, piles);
    minimap.setOrbs(player.hp, player.maxHp, player.runEnergy, player.settings.run);
    updateStatus();
  }
  if (dirty || frame % 30 === 0) { dirty = false; invUI.render(); }
  if (frame % 10 === 1) updateViewOffset();
}
requestAnimationFrame(animate);

// Handy for testing in the browser console.
window.gielinor = {
  renderer, player, skills, monsters, nodes, piles, pm, rig,
  get action() { return action; }, get tick() { return tick; },
  screenOf(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * window.innerWidth, y: (1 - tmpV.y) / 2 * window.innerHeight }; }
};
