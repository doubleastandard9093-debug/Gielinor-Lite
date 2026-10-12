import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createSky, tickGfx, resolveQuality, pixelRatioFor, SWAY } from './gfx.js';
import { createScene, createCamera, createRenderer, createLights, followLight, setShadows, IS_TOUCH } from './scene.js';
import { createWorld, createPileMesh, SPAWN, setDecorQuality } from './world.js';
import { createPlayer, updatePlayer, applyEquipmentLook, faceToward, resolveCollisions, blockedAt } from './player.js';
import { createCameraRig, rotateRig, zoomRig, updateRig } from './camera.js';
import { setupInput } from './input.js';
import { setupUI } from './ui.js';
import { createOverlays } from './overlays.js';
import { createMinimap } from './minimap.js';
import { createSkills, addXP, combatLevel, SKILL_ICONS, perk, perksBetween, maxPrayer, setPerkBoost } from './skills.js';
import { createPlayerState, addItem, removeItem, recalcMaxHp, roomFor, canAdd } from './playerState.js';
import { RECIPES, ITEMS, canCraft, hasInputs, recipeOutputQty, examineItem, isRangedWeapon, slotFor, isTool, toolType, TOOL_TYPES, WOODS, rarityOf, rarityColor } from './items.js';
import {
  TICK_MS, gatherTick, gatherInfo, TREES, ROCKS, FISH_SPOTS, rollPlayerHit, rollMonsterHit, combatXp, rollLoot, RARE_DROPS,
  attackSpeedTicks, attackRange, equip, unequip, eat, sellPrice, bestTool, addTool, ownsToolType, toolName,
  burnChance, saveChance, makeXp, buryXp, reduceIncoming, nextGatherWait, xpMultiplier, makeTicks, doubleMakeChance, buyPrice, capeBoosts, regenBonus, SHOPS, gearEffects, weaponProcs, isRareDrop
} from './gameplay.js';
import { POTIONS, isPotion, drinkPotion, effectsTick, applyPoison, poisonTick } from './potions.js';
import { PRAYERS, prayerById, togglePrayer, drainTick, prayerFx, rechargePrayer, ppRegenPerTick } from './prayer.js';
import { ABILITIES, abilityById, unlocked as abilityUnlocked, cooldownTicks } from './abilities.js';
import { QUESTS, questForNpc, questStatus, isDone, onKill, onBury, onPray, NPC_INFO, questPoints, questFx } from './quests.js';
import { createInventoryUI } from './inventoryUI.js';
import { saveToLocal, loadFromLocal, exportSave, importSave, hasLocalSave, applySaveData } from './save.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.45, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Final colour grade: a touch more saturation and a soft vignette (High quality only).
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, vig: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat); vec2 d = vUv - 0.5; c.rgb *= 1.0 - vig * smoothstep(0.25, 0.85, dot(d, d) * 2.2); gl_FragColor = c; }`
});
composer.addPass(gradePass);
document.body.prepend(renderer.domElement);
const { dirLight } = createLights(scene);
const sky = createSky(scene);
const { nodes, monsters, pickables, ground, buildings } = createWorld(scene);
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

// Combat skill state
const cooldowns = {};        // ability id -> tick when ready
let queuedAbility = null;    // fires on your next swing
let queuedAt = 0;
const buffs = { fortifyUntil: 0, rageUntil: 0 };
const fires = [];

// Max HP = Hitpoints level + Iron Constitution perk + quest bonuses.
function refreshMaxHp() {
  recalcMaxHp(player, skills, perk(skills, 'Hitpoints', 'maxHp') + questFx(player, 'maxHp'));
}
function giveXP(skill, amount) {
  if (amount <= 0) return;
  amount *= xpMultiplier(player, skill); // quest + gear XP bonuses
  addXP(skills, skill, amount, (s, l, old) => {
    const perks = perksBetween(s, old, l);
    ui.levelUp(s, SKILL_ICONS[s], l, perks);
    log(`Congratulations, you just advanced a ${s} level. You are now level ${l}.`, 'skill');
    for (const p of perks) log(`New ${s} perk unlocked: ${p.name} (${p.desc}).`, 'skill');
    for (const a of ABILITIES) if (a.skill === s && a.level > old && a.level <= l) log(`New combat skill unlocked: ${a.name}. It's on your quick bar.`, 'skill');
    for (const pr of PRAYERS) if (s === 'Prayer' && pr.level > old && pr.level <= l) log(`You can now use the prayer ${pr.name}.`, 'skill');
    if (s === 'Hitpoints') { const oldMax = player.maxHp; refreshMaxHp(); player.hp += player.maxHp - oldMax; }
    if (s === 'Prayer') player.prayerPoints = Math.min(maxPrayer(skills), (player.prayerPoints || 0) + (l - old) * 10);
  });
  ui.xpDrop(skill, SKILL_ICONS[skill], amount);
  markDirty();
}

// Graphics quality. High = bloom, colour grade, clouds, sway, full resolution.
// Low = plain render at a lower resolution for slower phones.
const gfx = { quality: 'high', auto: true, slowFrames: 0, frames: 0, sum: 0 };
function applyGfx() {
  gfx.auto = player.settings.gfx !== 'high' && player.settings.gfx !== 'low';
  gfx.quality = gfx.auto && gfx.autoLow ? 'low' : resolveQuality(player.settings.gfx);
  renderer.setPixelRatio(pixelRatioFor(gfx.quality));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  sky.setQuality(gfx.quality);
  setDecorQuality(gfx.quality);
  SWAY.value = gfx.quality === 'low' ? 0 : 1;
  setShadows(renderer, dirLight, shadowsOn());
}
function gfxLabel() {
  return player.settings.gfx === 'high' ? 'High' : player.settings.gfx === 'low' ? 'Low' : `Auto (${gfx.quality === 'low' ? 'Low' : 'High'})`;
}
// Auto mode on phones: if frames stay slow after loading, drop to Low once.
function watchFrameRate(dt) {
  if (!gfx.auto || gfx.autoLow || !IS_TOUCH) return;
  gfx.frames++;
  if (gfx.frames < 90) return;
  gfx.sum += dt;
  if (gfx.frames >= 390) {
    const fps = 300 / gfx.sum;
    gfx.frames = 0; gfx.sum = 0;
    if (fps < 26) { gfx.autoLow = true; applyGfx(); log('Graphics set to Low to keep the game smooth. Change it in Settings.', 'game'); markDirty(); }
  }
}

function shadowsOn() {
  if (gfx.quality === 'low') return false;
  return player.settings.shadows === null || player.settings.shadows === undefined ? !IS_TOUCH : !!player.settings.shadows;
}

// ---------------------------------------------------------------------------
// Side panel callbacks
// ---------------------------------------------------------------------------
const invUI = createInventoryUI({
  player, skills,
  attackSpeed: () => attackSpeedTicks(player),
  shadowsOn,
  gfxLabel: () => gfxLabel(),
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
    if (recipe) startCraft(recipe, n);
  },
  setting(act) { setting(act); },
  tick: () => tick,
  cooldowns: () => cooldowns,
  cooldownOf: a => cooldownTicks(skills, a),
  queued: () => queuedAbility,
  useAbility(id) { useAbility(id); },
  questDone: id => isDone(player, id),
  recipeState,
  arrowQty: r => recipeOutputQty(r) + perk(skills, 'Fletching', 'extraArrows'),
  toolInfo(type) {
    const t = TOOL_TYPES.find(x => x.id === type);
    const owned = Object.keys(player.tools || {}).filter(i => toolType(i) === type);
    const best = bestTool(player, skills, type);
    if (!owned.length) log(`${t.name}: none on your toolbelt. Bob's Tool Shop sells one.`, 'examine');
    else log(`${t.name}: using ${best || 'nothing (level too low)'}. Owned: ${owned.join(', ')}.`, 'examine');
  },
  prayerToggle(id) {
    const msg = togglePrayer(player, skills, id, q => isDone(player, q));
    if (msg) log(msg, 'warn');
    markDirty();
  },
  prayerInfo(id) {
    const p = prayerById(id);
    log(`${p.name} (Prayer ${p.level}${p.quest ? ', needs Rest for the Fallen' : ''}): ${p.desc}.`, 'examine');
  }
});

function afterEquip() {
  setPerkBoost(skills, capeBoosts(player)); // skill capes boost their skill's perks
  refreshMaxHp();
  applyEquipmentLook(pm, player.equipment);
  markDirty();
}

function useItem(item) {
  const info = ITEMS[item];
  if (!info) return;
  if (info.type === 'bones') { startBury(item, 1); return; }
  if (info.type === 'tool') { beltFromInventory(item); return; }
  if (isPotion(item)) { drink(item); return; }
  if (info.type === 'grimy') { const r = RECIPES.find(rc => rc.name === `Clean ${info.clean}`); if (r) startCraft(r, 1); return; }
  if (info.type === 'food') {
    if (eat(player, item, log, skills)) {
      if (tick - lastCombatTick < 8) nextPlayerAttack = Math.max(nextPlayerAttack, tick + 2); // eating delays your next hit
      markDirty();
    }
  } else if (slotFor(item)) {
    if (equip(player, skills, item, log)) afterEquip();
  } else {
    // No direct use: show what it's for
    const r = RECIPES.find(rc => rc.inputs[item] && canCraft(skills, player.inventory, rc));
    log(examineItem(item) + (r ? ` (Craft tab: ${r.name})` : WOODS.includes(item) ? ' (Hold for Light)' : ''), 'examine');
  }
}

// Active potion boosts as small icons with countdowns (top-left).
const effectsEl = document.createElement('div');
effectsEl.id = 'effects';
document.body.appendChild(effectsEl);
let effectsHtml = '';
function renderEffects() {
  const mmss = t => { const sec = Math.ceil(t * TICK_MS / 1000); return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : sec + 's'; };
  const parts = (player.effects || []).map(e => `<div class="fx${e.left <= 50 ? ' low' : ''}" title="${e.id}"><span>${e.icon}</span><small>${mmss(e.left)}</small></div>`);
  if (player.poisonImmune > 0) parts.push(`<div class="fx" title="Poison protection"><span>💚</span><small>${mmss(player.poisonImmune)}</small></div>`);
  if (player.poison) parts.push(`<div class="fx low" title="Poisoned"><span>☠️</span><small>${player.poison.dmg}</small></div>`);
  const html = parts.join('');
  if (html !== effectsHtml) { effectsHtml = html; effectsEl.innerHTML = html; }
}
function drink(item) {
  if (!removeItem(player, item, 1)) return;
  log(drinkPotion(player, skills, item), 'game');
  addItem(player, 'Vial', 1); // the empty vial goes back in your pack (same slot space)
  pm.actionAnim = 1; pm.actionKind = 'tool';
  if (tick - lastCombatTick < 8) nextPlayerAttack = Math.max(nextPlayerAttack, tick + 1);
  markDirty();
}
function fillVials() {
  const n = player.inventory['Vial'] || 0;
  if (!n) { log('You need an empty vial to fill. The apothecary sells them.', 'game'); return; }
  removeItem(player, 'Vial', n); addItem(player, 'Vial of water', n);
  log(`You fill ${n > 1 ? n + ' vials' : 'the vial'} with water.`, 'game');
  markDirty();
}

function beltFromInventory(item) {
  if (addTool(player, item)) {
    removeItem(player, item, 1);
    log(`You put the ${item} on your toolbelt.`, 'game');
  } else log(`You already have a ${item} on your toolbelt. You could sell this one.`, 'game');
  markDirty();
}
// Tools you pick up, buy or get as rewards go on the belt if you don't have one yet.
function giveItem(item, qty = 1) {
  if (isTool(item) && addTool(player, item)) {
    log(`The ${item} goes on your toolbelt.`, 'game');
    if (qty > 1) addItem(player, item, qty - 1);
    return true;
  }
  if (!canAdd(player, item)) { player.bank[item] = (player.bank[item] || 0) + qty; log(`Your pack is full, so the ${item} was sent to your bank.`, 'warn'); return true; }
  addItem(player, item, qty);
  return true;
}

function itemMenu(item, x, y, mode) {
  const info = ITEMS[item] || {};
  const c = rarityColor(item) || '#ff9040';
  const opts = [];
  if (mode === 'bank') {
    for (const q of [1, 5, 10, 'All']) opts.push({ action: `Deposit-${q}`, target: item, color: c, fn: () => deposit(item, q) });
  } else if (SHOPS[mode]) {
    opts.push({ action: 'Value', target: item, color: c, fn: () => log(`${item}: shop will buy for ${sellPrice(item, player)} coins.`, 'game') });
    for (const q of [1, 5, 'All']) opts.push({ action: `Sell ${q}`, target: item, color: c, fn: () => sell(item, q) });
  } else {
    const have = player.inventory[item] || 0;
    if (info.type === 'food') opts.push({ action: 'Eat', target: item, color: c, fn: () => useItem(item) });
    else if (isPotion(item)) opts.push({ action: 'Drink', target: item, color: c, fn: () => drink(item) });
    else if (info.type === 'grimy') {
      const r = RECIPES.find(rc => rc.name === `Clean ${info.clean}`);
      if (r) { opts.push({ action: 'Clean', target: item, color: c, fn: () => startCraft(r, 1) }); if (have > 1) opts.push({ action: 'Clean all', target: `${item} (${have})`, color: c, fn: () => startCraft(r, Infinity) }); }
    }
    else if (info.type === 'bones') {
      opts.push({ action: 'Bury', target: item, color: c, fn: () => startBury(item, 1) });
      if (have > 1) opts.push({ action: 'Bury all', target: `${item} (${have})`, color: c, fn: () => startBury(item, Infinity) });
    } else if (info.type === 'tool') opts.push({ action: 'Add to toolbelt', target: item, color: c, fn: () => beltFromInventory(item) });
    else if (slotFor(item)) opts.push({ action: info.type === 'weapon' ? 'Wield' : 'Wear', target: item, color: c, fn: () => useItem(item) });
    if (WOODS.includes(item)) opts.push({ action: 'Light', target: item, color: c, fn: () => startAction({ kind: 'light', item, wait: 2 }) });
    const recipes = RECIPES.filter(r => r.inputs[item] && skills[r.skill].level >= r.level && hasInputs(player.inventory, r)).slice(0, 3);
    for (const r of recipes) opts.push({ action: r.name.split(' ')[0] + ' all', target: r.output, color: c, fn: () => startCraft(r, Infinity) });
    opts.push({ action: 'Drop', target: have > 1 ? `${item} (1)` : item, color: c, fn: () => dropItem(item, 1) });
    if (have > 1) opts.push({ action: 'Drop all', target: `${item} (${have})`, color: c, fn: () => dropItem(item, player.inventory[item]) });
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
  if (have && isTool(item) && addTool(player, item)) {
    player.bank[item]--; if (player.bank[item] <= 0) delete player.bank[item];
    log(`The ${item} goes on your toolbelt.`, 'game');
    markDirty(); return;
  }
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
  if (isTool(item)) {
    if (player.tools[item]) { log(`You already have a ${item} on your toolbelt.`, 'game'); return; }
    if (player.gold < price) { log("You don't have enough coins.", 'warn'); return; }
    player.gold -= price;
    addTool(player, item);
    const info = ITEMS[item];
    const needs = info.req ? Object.entries(info.req).find(([sk, l]) => skills[sk].level < l) : null;
    log(`You buy a ${item} for ${price} coins. It goes on your toolbelt.${needs ? ` (You need ${needs[0]} ${needs[1]} to use it.)` : ''}`, 'game');
    markDirty(); return;
  }
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
  const gp = sellPrice(item, player) * n;
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
    // iPhone Safari needs the file input to live in the page and not filter file types too strictly.
    let input = document.getElementById('saveFileInput');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'saveFileInput';
      input.accept = '.json,application/json,text/plain,text/*';
      input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f) return;
        importSave(f, skills, player, pm, ok => finishImport(ok));
      });
    }
    input.value = '';
    input.click();
  }
  else if (act === 'paste') {
    const text = window.prompt('Paste your save text here (open the .json file, Select All, Copy):');
    if (text && text.trim()) finishImport(applySaveData(text.trim(), skills, player, pm));
  }
  else if (act === 'dpad') { s.showDpad = !s.showDpad; inputCtl.setDpadVisible(s.showDpad); }
  else if (act === 'shadows') { s.shadows = !shadowsOn(); setShadows(renderer, dirLight, s.shadows); }
  else if (act === 'gfx') { s.gfx = s.gfx === 'high' ? 'low' : s.gfx === 'low' ? null : 'high'; gfx.autoLow = false; applyGfx(); log(`Graphics: ${gfxLabel()}.`, 'game'); }
  else if (act === 'retaliate') s.autoRetaliate = !s.autoRetaliate;
  else if (act === 'run') toggleRun();
  else if (act === 'autoloot') s.autoLoot = !s.autoLoot;
  else if (act === 'camera') { rig.targetYaw = 0; rig.targetPitch = 0.9; rig.targetDist = window.innerHeight > window.innerWidth ? 19 : 17; }
  markDirty();
}
function finishImport(ok) {
  if (ok) { afterLoad(); saveToLocal(skills, player, pm); log('Save imported.', 'game'); }
  else log('Import failed: that file is not a Gielinor save.', 'warn');
}
function toggleRun() {
  if (!player.settings.run && player.runEnergy < 1) { log('You have no run energy left.', 'warn'); return; }
  player.settings.run = !player.settings.run;
  markDirty();
}

const minimap = createMinimap({
  onPrayerOrb: () => invUI.showTab('prayer'),
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
  for (const f of fires) pickList.push(f.mesh);
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
    for (const n of nodes) if (n.type === 'fish' || n.type === 'rock' || n.type === 'npc') consider(n, n.x, n.type === 'npc' ? 1.2 : 0.4, n.z);
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
  Tree: 'A commonly found tree. I can chop it down.', Oak: 'A beautiful old oak. (Woodcutting 15)', Willow: 'A droopy tree. (Woodcutting 30)',
  Maple: 'A tree with bright autumn leaves. (Woodcutting 45)', Yew: 'A tough old yew. (Woodcutting 60)', Magic: 'The tree shimmers with magic. (Woodcutting 75)',
  Rocks: 'A rocky outcrop.', Net: 'I can see small fish swimming in the water. (Net: shrimp. Needs a small fishing net)',
  Lure: 'I can see fish leaping in the water. (Lure: trout at 20, salmon at 30 Fishing. Needs a fly fishing rod)',
  Cage: 'Lobsters lurk below. (Cage: lobster at 40 Fishing. Needs a lobster pot)',
  Harpoon: 'Big fish swim here. (Harpoon: swordfish at 50, shark at 76 Fishing. Needs a harpoon)',
  Merchant: 'A trader of general goods.', 'Bank booth': 'The bank teller will serve you here.',
  Goblin: 'An ugly green creature.', Cow: 'Converts grass to beef.', Guard: 'He tries to keep order around here.',
  'Hill Giant': 'A very large foe. Drops big bones.', 'Black Knight': 'A sinister knight in black armour.',
  Furnace: 'Smelts ore into bars.', Anvil: 'Used with a hammer to smith bars into gear.', Range: 'A hot range for cooking food.',
  Fire: 'Hot! You can cook on it.', Altar: 'An altar to Saradomin. Pray here to recharge your prayer points.'
};
function entExamine(ent) {
  if (ent.type === 'building') return `${ent.name}: ${ent.examine}`;
  if (ent.type === 'npc') return (NPC_INFO[ent.npc] || {}).examine || `It's ${ent.name}.`;
  if (ent.type === 'tree' && !ent.alive) return 'This tree has been cut down.';
  if (ent.type === 'rock' && !ent.alive) return 'There is currently no ore available in this rock.';
  if (ent.type === 'fish') return EXAMINE[ent.kind];
  if (ent.type === 'herb') return `A herb patch growing ${ent.herb.toLowerCase()}. It never runs out. (Herblore ${HERB_LEVEL(ent.herb)})`;
  if (ent.type === 'well') return ent.examine;
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
      { action: 'Trade', target: 'Merchant', color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: 'shop' }) },
      { action: 'Talk-to', target: 'Merchant', color: '#ffff00', fn: () => startAction({ kind: 'talk', node: ent }) },
      { ...ex, color: '#ffff00' }];
    case 'herb': return [{ action: 'Pick', target: ent.name, color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'well': return [{ action: 'Fill vials', target: 'Well', color: cy, fn: () => startAction({ kind: 'well', node: ent }) }, ex];
    case 'bank': return [{ action: 'Bank', target: 'Bank booth', color: cy, fn: () => startAction({ kind: 'bank', node: ent }) }, ex];
    case 'npc': {
      const o = [{ action: 'Talk-to', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'talk', node: ent }) }];
      if (ent.npc === 'bob') o.push({ action: 'Trade', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: 'tools' }) });
      else if (ent.shop) o.push({ action: 'Trade', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: ent.shop }) });
      const qd = questForNpc(ent.npc);
      if (qd) o.push({ action: 'Quest', target: `${qd.name} (${questStatus(player, qd.id)})`, color: '#3ad0ff', fn: () => { invUI.showTab('quests'); } });
      return [...o, { ...ex, color: '#ffff00' }];
    }
    case 'station': {
      const verb = { furnace: 'Smelt', anvil: 'Smith', range: 'Cook' }[ent.kind];
      return [{ action: verb, target: ent.name, color: cy, fn: () => startAction({ kind: 'station', node: ent }) }, ex];
    }
    case 'altar': return [{ action: 'Pray-at', target: 'Altar', color: cy, fn: () => startAction({ kind: 'altar', node: ent }) }, ex];
    case 'building': return [ex];
  }
  return [ex];
}

function onTap(x, y) {
  ui.hideMenu();
  const hit = pick(x, y);
  if (!hit) return;
  if (ui.inDialogue) ui.closeDialogue();
  if (hit.ent && hit.ent.type === 'building') {
    // Tapping a wall walks toward that spot; you'll slide around the building.
    ui.tapMarker(x, y, false);
    stopAction();
    if (hit.point) walkTo(hit.point.x, hit.point.z);
    return;
  }
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
    if (isTool(item) && !player.tools[item]) {
      addTool(player, item);
      got.push(`${item} (to toolbelt)`);
      pile.items[item]--; if (pile.items[item] <= 0) delete pile.items[item];
      if (!pile.items[item]) continue;
    }
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
const SKILL_VERB = { Woodcutting: 'You swing your axe at the tree.', Mining: 'You swing your pick at the rock.', Fishing: 'You attempt to catch a fish.', Herblore: 'You start picking herbs.' };
const GOT = item => WOODS.includes(item) ? `You get some ${item.toLowerCase()}.` : ITEMS[item] && ITEMS[item].type === 'grimy' ? `You pick a ${item.toLowerCase()}.` : null;
const HERB_LEVEL = herb => (ITEMS[herb] && ITEMS[herb].herbLevel) || 1;
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
  if (a.wait > 0) { a.wait--; return; }
  // Try every 2 ticks; Chain Chop / Rich Vein sometimes make it 1 tick (never faster).
  const gi = gatherInfo(node);
  a.wait = gi ? nextGatherWait(skills, gi.skill) : 1;
  pm.actionAnim = 1; pm.actionKind = 'tool';
  const r = gatherTick(node, skills, player);
  if (!a.started) { a.started = true; const info = gatherInfo(node); if (info && !r?.error) log(SKILL_VERB[info.skill].replace('your axe', 'your ' + (bestTool(player, skills, 'axe') || 'axe').toLowerCase()).replace('your pick', 'your ' + (bestTool(player, skills, 'pickaxe') || 'pickaxe').toLowerCase()), 'skill'); }
  if (!r) return;
  if (r.error) { log(r.error, 'warn'); stopAction(); return; }
  if (r.bank) player.bank[r.item] = (player.bank[r.item] || 0) + (r.qty || 1);
  else addItem(player, r.item, r.qty || 1);
  giveXP(r.skill, r.xp);
  log((GOT(r.item) || (node.type === 'rock' ? `You manage to mine some ${r.item.replace(' ore', '').toLowerCase()}.` : `You catch some ${r.item.replace('Raw ', '').toLowerCase()}.`)) +
    (r.qty > 1 ? ' Your perk doubles it!' : '') + (r.bank ? ' It is sent straight to your bank.' : ''), 'skill');
  // Resources never run out: keep going until the pack is full.
  if (!r.bank && !canAdd(player, r.item)) {
    log('Your inventory is too full to hold any more.', 'warn');
    stopAction();
  }
}

// ---- Crafting ----
function stationsOf(kind) {
  const list = nodes.filter(n => n.type === 'station' && n.kind === kind);
  if (kind === 'range') list.push(...fires);
  return list;
}
function nearestStation(kind) {
  let best = null, bd = Infinity;
  for (const n of stationsOf(kind)) { const d = distTo(n); if (d < bd) { bd = d; best = n; } }
  return best;
}
function recipeState(r) {
  const level = skills[r.skill].level >= r.level;
  const inputs = hasInputs(player.inventory, r);
  const tool = !r.tool || !!bestTool(player, skills, r.tool);
  return { level, inputs, tool, ok: level && inputs && tool };
}
function startCraft(recipe, n) {
  const st = recipeState(recipe);
  if (!st.level) { log(`You need a ${recipe.skill} level of ${recipe.level} to do that.`, 'warn'); return; }
  if (!st.tool) { log(`You need ${toolName(recipe.tool)} on your toolbelt.`, 'warn'); return; }
  if (!st.inputs) { log("You don't have the materials for that.", 'warn'); return; }
  let station = null;
  if (recipe.station) {
    station = nearestStation(recipe.station);
    if (!station) { log('There is nowhere nearby to do that.', 'warn'); return; }
    if (!inRange(station, 1.2)) log(`You head to the ${station.name.toLowerCase()}.`, 'game');
  }
  startAction({ kind: 'craft', recipe, left: n, wait: 0, station, node: station });
  if (!station || inRange(station, 1.2)) craftOne();
}
function craftOne() {
  const a = action;
  if (!a || a.kind !== 'craft') return;
  const r = a.recipe;
  const st = recipeState(r);
  if (!st.level) { log(`You need a ${r.skill} level of ${r.level} to do that.`, 'warn'); stopAction(); return; }
  if (!st.tool) { log(`You need ${toolName(r.tool)} on your toolbelt.`, 'warn'); stopAction(); return; }
  if (!st.inputs) { if (!a.made) log(`You don't have the materials for that.`, 'warn'); else log(`You run out of materials.`, 'game'); stopAction(); return; }
  if (a.station && (!a.station.alive || (a.station.isFire && !fires.includes(a.station)))) { log('The fire has gone out.', 'warn'); stopAction(); return; }
  const burnt = Math.random() < burnChance(r, skills, player);
  const output = burnt ? 'Burnt food' : r.output;
  let outQty = burnt ? 1 : recipeOutputQty(r);
  if (!burnt && ITEMS[r.output].type === 'ammo') outQty += perk(skills, 'Fletching', 'extraArrows');
  const extra = !burnt && Math.random() < doubleMakeChance(r, skills);
  if (extra) outQty += recipeOutputQty(r);
  const saved = !burnt && Math.random() < saveChance(r, skills, player);
  if (!saved) for (const [item, qty] of Object.entries(r.inputs)) removeItem(player, item, qty);
  if (!canAdd(player, output)) {
    if (!saved) for (const [item, qty] of Object.entries(r.inputs)) addItem(player, item, qty);
    log("You don't have enough inventory space.", 'warn'); stopAction(); return;
  }
  addItem(player, output, outQty);
  a.made = (a.made || 0) + 1;
  if (burnt) log(`You accidentally burn the ${r.output.replace('Cooked ', '').toLowerCase()}.`, 'warn');
  else {
    giveXP(r.skill, makeXp(r, skills));
    log(`You make ${outQty > 1 ? outQty + ' ' : ''}${output}.${saved ? ' You manage to save your materials!' : ''}${extra ? ' Your perk makes a free extra one!' : ''}`, 'skill');
  }
  pm.actionAnim = 1; pm.actionKind = 'tool';
  a.left--;
  a.wait = makeTicks(r, skills) - 1;
  if (a.left <= 0) stopAction();
  else if (!hasInputs(player.inventory, r)) { if (a.left !== Infinity || a.made > 1) log(`You have run out of materials.`, 'game'); stopAction(); }
  markDirty();
}

// ---- Prayer: burying bones ----
function startBury(item, n) {
  if (!player.inventory[item]) return;
  if (action && action.kind === 'bury' && action.item === item) { action.left = n === Infinity ? Infinity : action.left; return; }
  startAction({ kind: 'bury', item, left: n, wait: 0 });
  buryOne();
}
function buryOne() {
  const a = action;
  if (!a || a.kind !== 'bury') return;
  if (!removeItem(player, a.item, 1)) { stopAction(); return; }
  pm.actionAnim = 1; pm.actionKind = 'tool';
  log(`You dig a hole in the ground... You bury the ${a.item.toLowerCase()}.`, 'skill');
  giveXP('Prayer', buryXp(a.item, skills));
  const restore = perk(skills, 'Prayer', 'buryRestore');
  if (restore) player.prayerPoints = Math.min(maxPrayer(skills), (player.prayerPoints || 0) + restore);
  for (const m of onBury(player)) log(m, 'game');
  a.left--;
  a.wait = 1;
  if (a.left <= 0 || !player.inventory[a.item]) stopAction();
  markDirty();
}

// ---- Fires (light logs with your tinderbox; cook on them) ----
const fireGeo = new THREE.ConeGeometry(0.35, 0.8, 6);
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a1a });
const logGeo = new THREE.BoxGeometry(0.9, 0.15, 0.15);
const logMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
function lightFire(a) {
  if (!bestTool(player, skills, 'tinderbox')) { log('You need a tinderbox on your toolbelt.', 'warn'); stopAction(); return; }
  const x = pm.mesh.position.x, z = pm.mesh.position.z;
  if (Math.hypot(x, z) < 4.5 || fires.some(f => Math.hypot(f.x - x, f.z - z) < 1.2) || nodes.some(n => n.type === 'station' && Math.hypot(n.x - x, n.z - z) < 1.5)) {
    log("You can't light a fire here.", 'warn'); stopAction(); return;
  }
  if (!removeItem(player, a.item, 1)) { stopAction(); return; }
  const g = new THREE.Group();
  const l1 = new THREE.Mesh(logGeo, logMat); l1.rotation.y = 0.5; l1.position.y = 0.08;
  const l2 = new THREE.Mesh(logGeo, logMat); l2.rotation.y = -0.6; l2.position.y = 0.08;
  const fl = new THREE.Mesh(fireGeo, fireMat); fl.position.y = 0.5;
  g.add(l1, l2, fl);
  g.position.set(x, 0, z);
  scene.add(g);
  const fire = { mesh: g, flame: fl, type: 'station', kind: 'range', name: 'Fire', isFire: true, alive: true, x, z, radius: 0.5, expires: performance.now() + 60000 };
  g.userData.entity = fire;
  fires.push(fire);
  log('The fire catches and the logs begin to burn.', 'game');
  // step aside like RuneScape
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) if (!blockedAt(x + dx, z + dz)) { walkTo(x + dx, z + dz); break; }
  stopAction();
  markDirty();
}
function removeFire(f) {
  scene.remove(f.mesh);
  const i = fires.indexOf(f);
  if (i >= 0) fires.splice(i, 1);
}

// ---- Talking ----
const NPC_FACE = { cook: '👨‍🍳', priest: '🧔', doric: '🧔‍♂️', captain: '💂‍♀️', farmer: '👨‍🌾', bob: '👷', merchant: '🧑‍💼', ranger: '🧝', knight: '🤺', apothecary: '🧑‍⚕️' };
const SHOP_GREET = { apothecary: 'Herbs, vials and potions! Fill empty vials at the well. Pick grimy herbs from the patches out back, clean them, then mix herb + vial of water + a secondary.' };
const questHelpers = {
  has: (item, n) => (player.inventory[item] || 0) >= n,
  take: (item, n) => { removeItem(player, item, n); markDirty(); },
  give: (item, n) => { giveItem(item, n); markDirty(); },
  xp: (skill, n) => giveXP(skill, n),
  gold: n => { player.gold += n; markDirty(); },
  tool: item => { if (!addTool(player, item)) giveItem(item, 1); else log(`The ${item} goes on your toolbelt.`, 'game'); },
  log: t => log(t, 'game'),
  questComplete(qd, milestones = []) {
    log(`Congratulations! Quest complete: ${qd.name}. You gain ${qd.points} quest point${qd.points > 1 ? 's' : ''}.`, 'skill');
    log(`Lasting quest bonus: ${qd.bonus.desc}.`, 'skill');
    for (const m of milestones) log(`Quest point milestone (${m.qp} QP): ${m.desc}.`, 'skill');
    if (isDone(player, 'all')) log('You have completed every quest! The Quest point cape is yours.', 'skill');
    refreshMaxHp();
    ui.banner(`<div class="lu-icon">📜</div><div><b>Quest complete!</b><br>${qd.name}<br><small>${qd.rewards.join(' · ')}</small>` +
      `<div class="lu-perk">★ Lasting bonus: ${qd.bonus.desc}</div>` + milestones.map(m => `<div class="lu-perk">★ ${m.qp} QP: ${m.desc}</div>`).join('') + '</div>');
    updateQuestMarks();
    markDirty();
  }
};
function talkTo(ent) {
  const name = ent.name;
  const face = NPC_FACE[ent.npc] || (ent.type === 'shop' ? NPC_FACE.merchant : '🙂');
  const qd = questForNpc(ent.npc);
  let script;
  if (qd) {
    script = qd.talk(player, questHelpers);
    // Shopkeepers with quests still offer to trade afterwards.
    const sh = ent.npc === 'bob' ? 'tools' : ent.npc === 'merchant' ? 'shop' : ent.shop;
    if (sh) script = [...script, { choose: [["Let's trade.", [{ run: () => invUI.open(sh) }]], ['Goodbye.', []]] }];
  } else if (ent.shop) {
    script = [['npc', SHOP_GREET[ent.shop] || 'Welcome! Have a look at my wares.'], { choose: [["Let's trade.", [{ run: () => invUI.open(ent.shop) }]], ['No thanks.', []]] }];
  } else if (ent.npc === 'bob') script = [
    ['npc', "Welcome to Bob's Brilliant Tools! Axes, pickaxes, fishing gear: it all goes straight on your toolbelt."],
    { choose: [['Let\'s trade.', [{ run: () => { invUI.open('tools'); } }]], ['Just looking.', [['npc', 'Better tools gather faster. Come back any time!']]]] }
  ];
  else script = [
    ['npc', 'Welcome! I buy and sell all sorts of things.'],
    { choose: [['Let\'s trade.', [{ run: () => invUI.open('shop') }]], ['No thanks.', [['npc', 'Suit yourself.']]]] }
  ];
  ui.dialogue(name, face, script, () => { updateQuestMarks(); markDirty(); });
}
function updateQuestMarks() {
  for (const n of nodes) if (n.type === 'npc') { const qd = questForNpc(n.npc); n.questMark = !!qd && !isDone(player, qd.id); }
}

// ---- Combat ----
const arrowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: 0x5a3a1a }));
arrowMesh.visible = false;
scene.add(arrowMesh);
let arrowFlight = null;
// Dark archers shoot back.
const enemyArrowMesh = new THREE.Mesh(arrowMesh.geometry, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
enemyArrowMesh.visible = false;
scene.add(enemyArrowMesh);
let enemyArrow = null;

function distTo(ent) {
  return Math.hypot(ent.mesh.position.x - pm.mesh.position.x, ent.mesh.position.z - pm.mesh.position.z);
}

function useArrow() {
  if (!player.equipment.ammo || player.ammoCount <= 0) return false;
  if (Math.random() < perk(skills, 'Ranged', 'ammoSave')) return true; // perk: arrow saved
  player.ammoCount--;
  if (player.ammoCount <= 0) { player.equipment.ammo = null; player.ammoCount = 0; }
  return true;
}

// Combat skills (quick bar)
function useAbility(id) {
  const a = abilityById(id);
  if (!a) return;
  if (!abilityUnlocked(skills, a)) { log(`You need ${a.skill} level ${a.level} to use ${a.name}.`, 'warn'); return; }
  const left = (cooldowns[id] || 0) - tick;
  if (left > 0) { log(`${a.name} is recharging (${Math.ceil(left * 0.6)}s).`, 'warn'); return; }
  const ranged = isRangedWeapon(player.equipment.weapon);
  if (a.style === 'melee' && ranged) { log(`${a.name} needs a melee weapon.`, 'warn'); return; }
  if (a.style === 'ranged' && !ranged) { log(`${a.name} needs a bow.`, 'warn'); return; }
  const cd = cooldownTicks(skills, a);
  if (id === 'fortify') { buffs.fortifyUntil = tick + 10; cooldowns[id] = tick + cd; log('You brace yourself. (Fortify: 50% less damage)', 'combat'); }
  else if (id === 'rage') { buffs.rageUntil = tick + 15; cooldowns[id] = tick + cd; log('You fly into a rage! (Berserk)', 'combat'); }
  else if (id === 'rejuv') {
    const heal = Math.round(player.maxHp * 0.2);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    cooldowns[id] = tick + cd;
    log(`You feel rejuvenated. (+${heal} hitpoints)`, 'combat');
  } else {
    if (!action || action.kind !== 'attack' || !action.mon.alive) { log('Attack something first, then use that.', 'warn'); return; }
    queuedAbility = id; queuedAt = tick;
    if (inRange(action.mon, attackRange(player))) nextPlayerAttack = Math.min(nextPlayerAttack, tick + 1);
    log(`${a.name} is ready: it fires on your next attack.`, 'combat');
  }
  markDirty();
  invUI.renderBar();
}

function playerAttack(mon, now) {
  const ranged = isRangedWeapon(player.equipment.weapon);
  const special = queuedAbility;
  queuedAbility = null;
  if (special) cooldowns[special] = tick + cooldownTicks(skills, abilityById(special));
  if (ranged) {
    if (!useArrow()) { log('There is no ammo left in your quiver.', 'warn'); stopAction(); return; }
    arrowFlight = { from: pm.mesh.position.clone().setY(1.3), mon, t: 0 };
  }
  pm.actionAnim = 1; pm.actionKind = ranged ? 'bow' : 'melee';
  const rage = tick < buffs.rageUntil;
  const base = { acc: rage ? 0.2 : 0, dmg: rage ? 0.2 : 0 };
  const swings = [];
  if (special === 'power') swings.push({ acc: base.acc + 0.25, dmg: base.dmg + 0.6 });
  else if (special === 'puncture') swings.push({ acc: base.acc + 0.1, dmg: base.dmg }, { acc: base.acc + 0.1, dmg: base.dmg });
  else if (special === 'bash') swings.push({ acc: base.acc + 0.3, dmg: base.dmg - 0.5 });
  else if (special === 'snipe') swings.push({ acc: base.acc + 0.3, dmg: base.dmg + 1.0 });
  else if (special === 'volley') { swings.push({ ...base, acc: base.acc - 0.15 }); for (let i = 0; i < 2; i++) if (useArrow()) swings.push({ ...base, acc: base.acc - 0.15 }); }
  else swings.push(base);
  // Dark bow: fires extra arrows every shot.
  const ge = gearEffects(player);
  if (ranged && ge.multiArrow) for (let i = 1; i < ge.multiArrow; i++) if (useArrow()) swings.push({ ...base });
  // Double Shot perk: a free second arrow now and then.
  if (ranged && !special && Math.random() < perk(skills, 'Ranged', 'doubleShot')) { swings.push(base); log('Double Shot!', 'combat'); }
  // Swift Strikes perk: sometimes your next melee swing comes a tick early.
  if (!ranged && Math.random() < perk(skills, 'Attack', 'quick')) nextPlayerAttack = Math.max(tick + 1, nextPlayerAttack - 1);
  if (special) log(`${abilityById(special).name}!`, 'combat');
  let dmg = 0;
  for (let i = 0; i < swings.length && i < 6; i++) {
    const mods = { ...swings[i] };
    if (mon.hp <= 0) break;
    const d = rollPlayerHit(player, skills, mon, Math.random, mods);
    mon.hp -= d;
    dmg += d;
    overlays.splat(mon, d, now + i * 150);
    if (mods.procs && mods.procs.includes('bigHit')) log(`${ITEMS[player.equipment.weapon].special.split(':')[0]}!`, 'combat');
    // Unique weapon specials
    const pr = weaponProcs(player, d);
    if (pr.again && !mods.extra) { swings.push({ ...base, extra: true }); log('Your weapon strikes twice!', 'combat'); }
    if (pr.heal > 0 && player.hp > 0) { player.hp = Math.min(player.maxHp, player.hp + pr.heal); }
    if (pr.poison && mon.hp > 0 && (!mon.venom || mon.venom.dmg < pr.poison)) { mon.venom = { dmg: pr.poison, next: 10 }; log(`You poison the ${mon.name}!`, 'combat'); }
    if (pr.stun && mon.hp > 0) { mon.stunUntil = tick + 5; log(`The ${mon.name} is stunned!`, 'combat'); }
  }
  if (special === 'bash') { mon.stunUntil = tick + 5; log(`The ${mon.name} is stunned!`, 'combat'); }
  mon.lastHitAt = now;
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
  const kh = perk(skills, 'Hitpoints', 'killHeal');
  if (kh && player.hp > 0 && player.hp < player.maxHp) {
    const heal = Math.max(1, Math.round(player.maxHp * kh));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    log(`Bloodlust: you heal ${heal} hitpoints.`, 'combat');
  }
  for (const m of onKill(player, mon.name)) log(m, 'game');
  if (action && action.mon === mon) stopAction();
  const drops = rollLoot(mon.name);
  const x = mon.mesh.position.x, z = mon.mesh.position.z;
  // Drop announcements: uniques in their rarity colour, other rares in gold.
  for (const d of drops) {
    if (!isRareDrop(d.item)) continue;
    const r = rarityOf(d.item);
    log(r ? `${r[0].toUpperCase() + r.slice(1)} drop: ${d.item}!` : `Rare drop: ${d.item}!`, 'loot', rarityColor(d.item) || '#ffd84a');
  }
  if (mon.boss) log(`You have slain ${mon.title || mon.name}! It will return in ${Math.round((mon.respawn || 15000) / 60000)} minutes.`, 'loot', '#ff9a2a');
  if (player.settings.autoLoot) {
    const pile = addToPile(x, z, drops);
    takeFromPile(pile);
  } else {
    setTimeout(() => addToPile(x, z, drops), 900);
  }
}

// A free hit from a perk (Riposte counter-attack). Gives normal combat XP.
function bonusHit(mon, now, label) {
  if (!mon.alive || mon.hp <= 0) return;
  const d = rollPlayerHit(player, skills, mon);
  mon.hp -= d;
  overlays.splat(mon, d, now + 120);
  for (const [s, v] of Object.entries(combatXp(player, d))) giveXP(s, v);
  if (d > 0) log(`${label}!`, 'combat');
  if (mon.hp <= 0) killMonster(mon, now);
}
function monsterAttack(mon, now) {
  const raw = rollMonsterHit(mon, player, skills);
  if (mon.ranged) enemyArrow = { from: mon.mesh.position.clone().setY(1.3), t: 0 };
  let dmg = reduceIncoming(raw, player, skills, { fortify: tick < buffs.fortifyUntil, rage: tick < buffs.rageUntil });
  if (dmg > 0 && Math.random() < perk(skills, 'Defence', 'block')) { dmg = 0; log('Parry: you block the attack!', 'combat'); }
  // Retribution: reflect some damage back.
  const refl = dmg > 0 ? Math.floor(dmg * Math.min(0.6, perk(skills, 'Defence', 'reflect') + (gearEffects(player).reflect || 0))) : 0;
  if (refl > 0 && mon.alive) {
    mon.hp -= Math.min(refl, mon.hp); overlays.splat(mon, refl, now + 150);
    if (mon.hp <= 0) { killMonster(mon, now); }
  }
  // Riposte: counter when a melee monster misses and you're fighting it up close.
  if (raw === 0 && !mon.ranged && mon.alive && !isRangedWeapon(player.equipment.weapon) && action && action.kind === 'attack' && action.mon === mon &&
      Math.random() < perk(skills, 'Attack', 'counter')) bonusHit(mon, now, 'Riposte');
  if (dmg > 0 && mon.poison && Math.random() < mon.poison.chance && applyPoison(player, mon.poison.dmg, true)) log(`You have been poisoned by the ${mon.name}!`, 'warn');
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
  refreshMaxHp();
  player.hp = player.maxHp;
  player.runEnergy = 100;
  player.activePrayers = [];
  queuedAbility = null;
  buffs.fortifyUntil = buffs.rageUntil = 0;
  for (const m of monsters) if (m.state === 'fight') m.state = 'return';
  log('You wake up back in town. You keep all of your items.', 'game');
}

// ---------------------------------------------------------------------------
// Game tick (every 0.6s)
// ---------------------------------------------------------------------------
function inRange(ent, range) { return distTo(ent) <= range + (ent.radius || 0.5); }

function gameTick(now) {
  tick++;
  // Hitpoint regen (faster with Hitpoints perks and Rapid Heal) and run energy
  if (player.hp < player.maxHp && player.hp > 0) {
    let rate = 1 + perk(skills, 'Hitpoints', 'regen') + prayerFx(player, 'regen') + regenBonus(player);
    if (player.hp < player.maxHp * 0.3) rate *= 1 + perk(skills, 'Hitpoints', 'lowRegen'); // Second Wind
    player.regenAcc = (player.regenAcc || 0) + rate / 6;
    while (player.regenAcc >= 1) { player.regenAcc--; player.hp = Math.min(player.maxHp, player.hp + 1); markDirty(); }
  }
  // Prayer drain
  if (player.activePrayers.length) {
    if (drainTick(player, skills)) log('You have run out of prayer points. Recharge them at an altar.', 'warn');
    if (tick % 3 === 0 || !player.activePrayers.length) markDirty();
  }
  // Faithful perk / Rest for the Fallen: slow prayer point regen.
  const ppr = ppRegenPerTick(player, skills), ppMax = maxPrayer(skills);
  if (ppr > 0 && player.prayerPoints < ppMax) {
    const before = Math.floor(player.prayerPoints);
    player.prayerPoints = Math.min(ppMax, player.prayerPoints + ppr);
    if (Math.floor(player.prayerPoints) !== before) markDirty();
  }
  // Potion timers, poison
  for (const m of effectsTick(player)) log(m.text, m.cls);
  if (player.poison && player.hp > 0) {
    const pd = poisonTick(player);
    if (pd > 0) { player.hp = Math.max(0, player.hp - pd); overlays.splat(playerEnt, pd, now, true); if (!player.poison) log('The poison has worn off.', 'game'); if (player.hp <= 0) playerDied(); }
  }
  for (const m of monsters) if (m.venom && m.alive) { // poison you put on monsters (venom weapons)
    const w = { poison: m.venom }; const md = poisonTick(w); m.venom = w.poison;
    if (md > 0) { m.hp -= Math.min(md, m.hp); overlays.splat(m, md, now, true); if (m.hp <= 0) killMonster(m, now); }
  }
  if (tick % 2 === 0) renderEffects();
  if (queuedAbility && tick - queuedAt > 12) queuedAbility = null;
  for (let i = fires.length - 1; i >= 0; i--) if (now > fires[i].expires) { removeFire(fires[i]); }
  if (!(player.settings.run && pm.moving)) player.runEnergy = Math.min(100, player.runEnergy + 0.45 * (1 + questFx(player, 'runRegen')));

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
    if (d <= (m.range || 1.7 + (m.radius - 0.7)) && tick >= m.nextAttackTick && !(m.stunUntil > tick)) {
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
    if (a.station && !inRange(a.station, 1.2)) return;
    if (a.wait > 0) a.wait--; else craftOne();
  } else if (a.kind === 'bury') {
    if (a.wait > 0) a.wait--; else buryOne();
  } else if (a.kind === 'light') {
    if (a.wait > 0) { a.wait--; pm.actionAnim = 1; pm.actionKind = 'tool'; } else lightFire(a);
  }
}

// Called every frame: walk toward the action target and handle arrivals.
function updateAction() {
  const a = action;
  if (!a) return;
  let ent = a.node || a.mon || a.pile;
  if (!ent) return;
  if (a.kind === 'pickup' && !piles.includes(a.pile)) { stopAction(); return; }
  if (a.kind === 'craft' && !a.station) return;
  const range = a.kind === 'attack' ? attackRange(player) : a.kind === 'pickup' ? 0.15 : a.kind === 'gather' ? 0.9 : a.kind === 'craft' ? 1.2 : 1.0;
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
  else if (a.kind === 'shop') { log(`${ent.name}: "Have a look at my wares."`, 'game'); invUI.open(a.shop || 'shop'); stopAction(); }
  else if (a.kind === 'talk') { stopAction(); talkTo(ent); }
  else if (a.kind === 'well') { stopAction(); pm.actionAnim = 1; pm.actionKind = 'tool'; fillVials(); }
  else if (a.kind === 'altar') {
    stopAction();
    pm.actionAnim = 1; pm.actionKind = 'tool';
    const got = rechargePrayer(player, skills);
    log(got > 0 ? 'You pray to Saradomin. You recharge your prayer points.' : 'You already have full prayer points.', 'game');
    for (const m of onPray(player)) log(m, 'game');
    markDirty();
  } else if (a.kind === 'station') {
    stopAction();
    const sub = ent.kind === 'range' ? 'Cooking' : 'Smithing';
    invUI.showTab('craft', sub);
    log(ent.kind === 'furnace' ? 'Choose a bar to smelt from the Smithing tab.' : ent.kind === 'anvil' ? 'Choose what to smith from the Smithing tab.' : 'Choose what to cook from the Cooking tab.', 'game');
  }
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
      if (t >= 1) { m.dying = false; m.mesh.visible = false; m.respawnAt = now + (m.respawn || 15000); }
      continue;
    }
    if (!m.alive) continue;
    let tx = null, tz = null, speed = 1.4, stop = 0.1;
    if (m.state === 'fight') { tx = pm.mesh.position.x; tz = pm.mesh.position.z; speed = 3.0; stop = m.range ? m.range - 1 : 1.3; }
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
        if (m.state !== 'idle') resolveCollisions(pos);
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

function updateFires(now) {
  for (const f of fires) { const s = 0.85 + Math.sin(now * 0.02 + f.x) * 0.15; f.flame.scale.set(s, 0.9 + Math.sin(now * 0.031) * 0.2, s); }
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

function flyArrow(f, mesh, target, dt) {
  f.t += dt / 0.35;
  if (f.t >= 1 || !target.visible) { mesh.visible = false; return false; }
  const to = target.position;
  mesh.visible = true;
  mesh.position.set(f.from.x + (to.x - f.from.x) * f.t, 1.3 + Math.sin(f.t * Math.PI) * 0.6 - f.t * 0.3, f.from.z + (to.z - f.from.z) * f.t);
  mesh.lookAt(to.x, 1, to.z);
  return true;
}
function updateArrow(dt) {
  if (arrowFlight && !flyArrow(arrowFlight, arrowMesh, arrowFlight.mon.mesh, dt)) arrowFlight = null;
  if (enemyArrow && !flyArrow(enemyArrow, enemyArrowMesh, pm.mesh, dt)) enemyArrow = null;
}

const ACTION_LABEL = {
  gather: n => ({ tree: '🪓 Woodcutting', rock: '⛏️ Mining', fish: '🎣 Fishing' })[n.node.type], attack: a => `⚔️ Fighting ${a.mon.name}`,
  craft: a => `${SKILL_ICONS[a.recipe.skill]} ${a.recipe.name}${a.left !== Infinity && a.left > 1 ? ` (${a.left})` : ''}`, pickup: () => '✋ Picking up', bank: () => '🏦 Going to bank',
  shop: a => `🛒 Going to ${a.node.name}`, talk: a => `💬 Talking to ${a.node.name}`, altar: () => '🙏 Going to the altar', station: a => `Going to the ${a.node.name.toLowerCase()}`,
  bury: () => '🦴 Burying bones', light: () => '🔥 Lighting a fire'
};
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
  setPerkBoost(skills, capeBoosts(player));
  refreshMaxHp();
  applyEquipmentLook(pm, player.equipment);
  inputCtl.setDpadVisible(!!player.settings.showDpad);
  applyGfx();
  rig.fx = pm.mesh.position.x; rig.fz = pm.mesh.position.z;
  resolveCollisions(pm.mesh.position);
  player.questPoints = questPoints(player);
  player.prayerPoints = Math.min(player.prayerPoints || 0, maxPrayer(skills));
  updateQuestMarks();
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
  log('Your starter tools are on your toolbelt (Worn Equipment tab). Talk to the townsfolk for quests.', 'game');
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
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
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
  tickGfx(now);
  watchFrameRate(dt);

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
  updateFires(now);
  updateArrow(dt);
  updateRig(rig, camera, pm.mesh.position.x, pm.mesh.position.z, dt);
  followLight(dirLight, rig.fx, rig.fz);
  sky.follow(camera);
  if (gfx.quality === 'low') renderer.render(scene, camera); else composer.render();

  overlays.update(camera, barEnts, now);
  if (frame % 3 === 0) {
    minimap.draw(pm.mesh.position.x, pm.mesh.position.z, rig.yaw, nodes, monsters, piles);
    minimap.setOrbs(player.hp, player.maxHp, player.runEnergy, player.settings.run, player.prayerPoints, maxPrayer(skills), player.activePrayers.length > 0);
    updateStatus();
  }
  if (dirty || frame % 30 === 0) { dirty = false; invUI.render(); }
  else if (frame % 10 === 5) invUI.renderBar();
  if (frame % 10 === 1) updateViewOffset();
}
requestAnimationFrame(animate);

// Handy for testing in the browser console.
// Number keys 1-8 fire combat skills on desktop.
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const n = +e.key;
  if (n >= 1 && n <= 8) { const list = ABILITIES.filter(a => abilityUnlocked(skills, a)); if (list[n - 1]) useAbility(list[n - 1].id); }
});

window.gielinor = {
  gfx, setGfx(q) { player.settings.gfx = q; gfx.autoLow = false; applyGfx(); markDirty(); }, scene, camera,
  renderer, player, skills, monsters, nodes, piles, pm, rig, fires, buildings, ui, invUI, giveXP, useAbility, talkTo, startCraft, stopAction, startAction, useItem, RECIPES, optionsFor,
  get queued() { return queuedAbility; }, cooldowns, buffs,
  get action() { return action; }, get tick() { return tick; },
  screenOf(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * window.innerWidth, y: (1 - tmpV.y) / 2 * window.innerHeight }; }
};

