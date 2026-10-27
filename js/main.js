import * as THREE from 'three';
import { agilityStyle, agilityDuration, agilityVariation, agilityPose3 as agilityPose, snapshotRig, applyRigPose, releaseRig, mixPose, smooth, solveLimb } from './agilityAnim.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { updateDay, DAY, dayLabel } from './daycycle.js';
import { poseGait, tailSway } from './gait.js';
import { updateSound, soundStats } from './sound.js';
import { PUSH, FADE } from './models.js';
import { initVfx, updateVfx, addFire, removeFireVfx, burst, setVfxQuality, setLeafSources } from './vfx.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { updateDrizzle } from './weather.js';
import { createSky, tickGfx, resolveQuality, pixelRatioFor, SWAY, enableTexDetail, SUN_DIR, createWaterReflection } from './gfx.js';
import { createScene, createCamera, createRenderer, createLights, followLight, setShadows, tuneLights, IS_TOUCH } from './scene.js';
import { adoptSceneObjects, registerDynamic, updateChunks, setLoadRadius, chunkStats } from './chunk.js';
import { PATHS, terrainHeight, insideLake, WORLD_HALF, TOWNS, CAVE, inCave } from './world.js';
import { createWorld, createPileMesh, SPAWN, setDecorQuality, updateDecorChunks, updateLocalGrass } from './world.js';
import { updateLod, setLodRange, poseHumanoid } from './anatomy.js';
import { createCritters } from './critters.js';
import { createPlayer, updatePlayer, applyEquipmentLook, faceToward, resolveCollisions, blockedAt, moveWithCollision } from './player.js';
import { createCameraRig, rotateRig, zoomRig, updateRig, shakeRig } from './camera.js';
import { setupInput } from './input.js';
import { setupUI } from './ui.js';
import { createOverlays } from './overlays.js';
import { createMinimap } from './minimap.js';
import { createHud } from './hud.js';
import { adrenCost, adrenGain } from './abilities.js';
import { unitPrice, noteBought, stockLeft, restockTick, wearOnHit, repairAll, repairCost, deathFee } from './economy.js';
import { totalLevel } from './skills.js';
import { createSkills, addXP, combatLevel, SKILL_ICONS, perk, perksBetween, maxPrayer, setPerkBoost } from './skills.js';
import { createPlayerState, addItem, removeItem, recalcMaxHp, roomFor, canAdd } from './playerState.js';
import { RECIPES, ITEMS, canCraft, hasInputs, recipeOutputQty, examineItem, isRangedWeapon, slotFor, isTool, toolType, TOOL_TYPES, WOODS, rarityOf, rarityColor } from './items.js';
import {
  TICK_MS, gatherTick, gatherInfo, TREES, ROCKS, FISH_SPOTS, rollPlayerHit, rollMonsterHit, combatXp, rollLoot, RARE_DROPS,
  attackSpeedTicks, attackRange, equip, unequip, eat, sellPrice, bestTool, addTool, ownsToolType, toolName,
  burnChance, saveChance, makeXp, buryXp, reduceIncoming, nextGatherWait, xpMultiplier, makeTicks, doubleMakeChance, buyPrice, capeBoosts, regenBonus, SHOPS, gearEffects, weaponProcs, isRareDrop,
  SPELLS, spellById, canCast, castSpell, bestSpell, magicMaxHit, weakTo, WEAK_MULT, SPELL_TICKS, playerMaxHit, AGILITY_OBSTACLES, AGILITY_COURSES, runObstacle, THIEVE_TARGETS, thieve, RUNE_ALTARS, craftRunes
} from './gameplay.js';
import { POTIONS, isPotion, drinkPotion, effectsTick, applyPoison, poisonTick } from './potions.js';
import { PRAYERS, prayerById, togglePrayer, drainTick, prayerFx, rechargePrayer, ppRegenPerTick } from './prayer.js';
import { ABILITIES, abilityById, unlocked as abilityUnlocked, cooldownTicks } from './abilities.js';
import { QUESTS, questForNpc, questsForNpc, questTalk, onXp, onVisit, questStatus, isDone, onKill, onBury, onPray, NPC_INFO, questPoints, questFx } from './quests.js';
import { QUEST_NPCS } from './questnpcs.js';
import { createInventoryUI } from './inventoryUI.js';
import { COMPANIONS, companionById, normalizeCompanions, companionXpBonus, addBond, toneReaction, assistMax, assistEvery, GIFT_COOLDOWN_MS, BOND_MAX, BOND_PERKS } from './companions.js';
import { FACTIONS, TIERS, TIER_REWARDS, BOUNTY_REP, factionById, factionNear, tierOf, nextTier, addRep, repOf } from './standing.js';
import { ERRANDS, errandById, errandChance, startErrand, collectErrands, crewOf, crewTrain, errandItems, CREW_MAX as CREW_SKILL_MAX } from './errands.js';
import { createBondsUI } from './bondsUI.js';
import { createBossMech } from './bossmech.js';
import { DEED_COST, ROOMS, FURNITURE, BOSS_TROPHIES, normalizeHouse, hasRoom, hasFurn, houseXpBonus, houseBossDamage, houseErrandBonus, takeHarvest, takeBondDay, addTrophy } from './hearth.js';
import { HEARTH, ARENA, inInstance, instanceAt } from './instances.js';
import { ARENA_RULES, ARENA_SHOP, normalizeArena, ladder, rankOf, rateDuel, weekRoll, weekNo, pickOpponent, duellistStats } from './arena.js';
import { TASK, HUNT_SHOP, normalizeTasks, assignTask, taskKill, taskLabel, isDrowned } from './tasks.js';
import { SEA, SARIM_DOCK, HULLS, OFFICERS, CREW_COST, CREW_MAX, ISLANDS, islandAt, normalizeVessel, inSound } from './sea.js';
import { createSailing } from './sailing.js';
import { createCards } from './cards.js';
let sailing = null; // Sails of Sarim runtime (set up after the player loads)
import { CALLINGS, CHAPTERS, ENDINGS, normalizeSaga, currentChapter, sagaXpBonus, objNeed, endingTone } from './saga.js';
import { STEEDS, steedById, normalizeSteeds, grantSteeds, buildSteed, buildBulwarkArmor, poseSteed, ROAD_BONUS, BULWARK } from './steeds.js';
import { createFlow, flowOnSkillHit, flowDecay, tryDodge, dodging, FLOW, FINISHER, flowPerfectDodge } from './flow.js';
import { saveToLocal, loadFromLocal, exportSave, importSave, hasLocalSave, applySaveData } from './save.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
// Tier S #1: the composer's own target needs MSAA or renderer antialias is lost on High. Desktop: 4x MSAA; touch: SMAA pass (cheaper).
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: IS_TOUCH ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
// NaN/Inf guard: one bad pixel from any material (e.g. a degenerate normal on a mobile GPU) gets smeared by the
// bloom blur chain into a large black rectangle. Scrub non-finite and negative values before GTAO/bloom see them.
const NAN_GUARD = { uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float ok(float v){ return (v >= 0.0 && v < 1e4) ? v : 0.0; }   // NaN fails both tests, Inf fails the second
    void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(ok(c.r), ok(c.g), ok(c.b), clamp(ok(c.a), 0.0, 1.0)); }` };
composer.addPass(new ShaderPass(NAN_GUARD));
// Ground-truth ambient occlusion (High only): contact darkening where walls meet ground, under eaves, in folds.
const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.85;
gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.4, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(gtao);
const nanGuard2 = new ShaderPass(NAN_GUARD); composer.addPass(nanGuard2);   // GTAO can also emit NaN at depth discontinuities
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.4, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Final colour grade: a touch more saturation and a soft vignette (High quality only).
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, vig: { value: 0.18 }, sunUV: { value: new THREE.Vector2(0.5, 0.8) }, shaftK: { value: 0 }, shaftCol: { value: new THREE.Color(1, 0.9, 0.7) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig, shaftK; uniform vec2 sunUV; uniform vec3 shaftCol; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      // light shafts: radial march toward the sun gathering bright sky pixels, so rays stream past trees and roofs
      if (shaftK > 0.001) { vec2 dl = (vUv - sunUV) / 28.0; vec2 uv = vUv; float acc = 0.0, w = 1.0;
        for (int i = 0; i < 28; i++) { uv -= dl; vec3 s = texture2D(tDiffuse, uv).rgb; acc += smoothstep(0.82, 1.0, dot(s, vec3(0.33))) * w; w *= 0.95; }
        float fall = 1.0 - smoothstep(0.0, 0.75, length((vUv - sunUV) * vec2(1.6, 1.0)));
        c.rgb += shaftCol * acc / 28.0 * shaftK * fall; }
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = mix(c.rgb, smoothstep(0.0, 1.0, c.rgb), max(sat - 1.12, 0.0) * 0.9);
      // painterly split-tone: cool, slightly lifted shadows and warm highlights, like a hand-painted palette
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += vec3(-0.012, 0.0, 0.03) * (1.0 - smoothstep(0.0, 0.45, lum)) + vec3(0.03, 0.012, -0.02) * smoothstep(0.45, 1.0, lum); vec2 d = vUv - 0.5; c.rgb *= 1.0 - vig * smoothstep(0.25, 0.85, dot(d, d) * 2.2); gl_FragColor = c; }`
});
composer.addPass(gradePass);
const smaa = IS_TOUCH ? new SMAAPass(window.innerWidth, window.innerHeight) : null; if (smaa) composer.addPass(smaa);
document.body.prepend(renderer.domElement);
const lightsRef = createLights(scene);
const waterRefl = createWaterReflection(renderer, scene, camera);
initVfx(scene);
const { dirLight } = lightsRef;
const sky = createSky(scene);
const { nodes, monsters, pickables, ground, buildings, spawnMonster } = createWorld(scene);
setLeafSources(nodes.filter(n => n.type === 'tree'));
const pm = createPlayer(scene);
// Chunk streaming: static props, buildings and NPC stalls attach only near the player.
scene.updateMatrixWorld(true);
const wanderers = nodes.filter(n => n.wander);
const chunkSkip = new Set([ground, pm.mesh, ...monsters.map(m => m.mesh), ...wanderers.map(n => n.mesh)]);
adoptSceneObjects(scene, chunkSkip);
for (const m of monsters) registerDynamic(m.mesh, () => m.mesh.position, scene);
for (const n of wanderers) registerDynamic(n.mesh, () => n.mesh.position, scene);
window.chunkStats = chunkStats;
const updateCritters = createCritters(scene, terrainHeight, (x, z) => insideLake(x, z, 1) || blockedAt(x, z) || Math.abs(x) > WORLD_HALF - 4 || Math.abs(z) > WORLD_HALF - 4 || Object.values(TOWNS).some(t => Math.hypot(t.x - x, t.z - z) < 22));
const skills = createSkills();
const player = createPlayerState();
const flow = createFlow();
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
let caveK = 0, caveShown = null, lightBase = null; // mountain cave lighting state

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
  amount *= 1 + companionXpBonus(player, skill) + standingXp(skill) + sagaXpBonus(player, skill) + houseXpBonus(player.house, skill); // Sworn Companion bond and faction Standing perks
  addXP(skills, skill, amount, (s, l, old) => {
    const perks = perksBetween(s, old, l);
    ui.levelUp(s, SKILL_ICONS[s], l, perks);
    log(`Congratulations, you just advanced a ${s} level. You are now level ${l}.`, 'skill');
    for (const p of perks) log(`New ${s} perk unlocked: ${p.name} (${p.desc}).`, 'skill');
    for (const a of ABILITIES) if (a.skill === s && a.level > old && a.level <= l) log(`New combat skill unlocked: ${a.name}. It's on your quick bar.`, 'skill');
    for (const pr of PRAYERS) if (s === 'Prayer' && pr.level > old && pr.level <= l) log(`You can now use the prayer ${pr.name}.`, 'skill');
    if (s === 'Agility') checkSteeds();
    if (s === 'Hitpoints') { const oldMax = player.maxHp; refreshMaxHp(); player.hp += player.maxHp - oldMax; }
    if (s === 'Prayer') player.prayerPoints = Math.min(maxPrayer(skills), (player.prayerPoints || 0) + (l - old) * 10);
  });
  ui.xpDrop(skill, SKILL_ICONS[skill], amount);
  if (!questHelpers.rewarding) for (const m of onXp(player, skill, amount)) log(m, 'game');
  markDirty();
}

// Graphics quality. High = bloom, colour grade, clouds, sway, full resolution.
// Low = plain render at a lower resolution for slower phones.
const HIGH_FOG_LIFT = [2.8, 3.6, 5.2];   // per-channel daytime fog/horizon lift on High (AgX + grade darken and grey it)
const gfx = { quality: 'high', auto: true, slowFrames: 0, frames: 0, sum: 0 };
function applyGfx() {
  gfx.auto = player.settings.gfx !== 'high' && player.settings.gfx !== 'low';
  gfx.quality = gfx.auto && gfx.autoLow ? 'low' : resolveQuality(player.settings.gfx);
  { const f = new URLSearchParams(location.search).get('gfx'); if (f === 'low' || f === 'high') { gfx.quality = f; gfx.auto = false; } }   // ?gfx=low|high: forced tier (audits, low-end testing)
  renderer.setPixelRatio(pixelRatioFor(gfx.quality));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  gfx.dynScale = 1; if (smaa) smaa.enabled = gfx.quality !== 'low';
  gtao.enabled = gfx.quality !== 'low' && player.settings.ao !== false;
  // High: AgX filmic tone mapping (wider highlight roll-off, no hue shift on bright skies) with a saturation lift; Low keeps ACES
  renderer.toneMapping = gfx.quality === 'low' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  renderer.toneMappingExposure = gfx.quality === 'low' ? 1.05 : 1.05;
  gradePass.uniforms.sat.value = gfx.quality === 'low' ? 1.12 : 1.45;
  sky.setQuality(gfx.quality);
  setDecorQuality(gfx.quality); setVfxQuality(gfx.quality);
  SWAY.value = gfx.quality === 'low' ? 0 : 1;
  enableTexDetail(gfx.quality !== 'low');
  setLodRange(gfx.quality);
  // High: thinner fog and a longer view so the northern mountains read clearly from town
  scene.fog.density = gfx.quality === 'low' ? 0.0064 : 0.0022;
  if (gfx.quality === 'low') DAY.fogLift.setRGB(1, 1, 1); else DAY.fogLift.setRGB(...HIGH_FOG_LIFT);   // High: lift the daytime fog/horizon so AgX + exposure 1.0 lands near #C9D3D6 on screen
  camera.far = gfx.quality === 'low' ? 520 : 760; camera.updateProjectionMatrix();
  setShadows(renderer, dirLight, shadowsOn(), gfx.quality);
  if (lightsRef) tuneLights(lightsRef, gfx.quality);
  lightBase = null;
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
    // Tier S #10: on High touch, step pixel ratio down (to 0.75x) before giving up on High, so phones keep shadows and AO
    if (fps < 26 && gfx.quality !== 'low' && gfx.dynScale > 0.76) { gfx.dynScale = Math.max(0.75, gfx.dynScale - 0.125); const pr = pixelRatioFor(gfx.quality) * gfx.dynScale; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); return; }
    if (fps < 26) { gfx.autoLow = true; applyGfx(); log('Graphics set to Low to keep the game smooth. Change it in Settings.', 'game'); markDirty(); }
  }
}

function shadowsOn() {
  if (gfx.quality === 'low') return false;
  // Default: on for desktop and whenever High is chosen explicitly (console/PC target); phones on Auto start without.
  return player.settings.shadows === null || player.settings.shadows === undefined ? (!IS_TOUCH || player.settings.gfx === 'high') : !!player.settings.shadows;
}

// ---------------------------------------------------------------------------
// Side panel callbacks
// ---------------------------------------------------------------------------
const invUI = createInventoryUI({
  player, skills,
  attackSpeed: () => attackSpeedTicks(player),
  adrenaline: () => (hud ? hud.adrenaline : 0),
  shadowsOn: () => !!dirLight.castShadow,
  shadowsNote: () => gfx.quality === 'low' ? ' (Low graphics)' : '',
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
  repair() { const r = repairAll(player); log(r.msg, r.ok ? 'game' : 'warn'); if (r.ok) { afterEquip(); markDirty(); } },
  repairCost: () => repairCost(player),
  shopMenu(item, price, x, y, shopId) {
    ui.showMenu(x, y, [
      { action: 'Value', target: item, color: '#ff9040', fn: () => log(`${item}: currently costs ${price} coins.`, 'game') },
      ...[1, 5, 10].map(q => ({ action: `Buy ${q}`, target: item, color: '#ff9040', fn: () => buy(item, price, q, shopId) })),
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
  setAutocast: id => setAutocast(id),
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
    } else if (item === 'Treasure chart') { opts.push({ action: 'Read', target: item, color: c, fn: () => readChart() }); opts.push({ action: 'Dig here', target: item, color: c, fn: () => digHere() });
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
  if (player.bank[item] <= 0) {
    delete player.bank[item];
    if (player.settings.placeholders !== false) { const ph = player.settings.bankPh || (player.settings.bankPh = []); if (!ph.includes(item)) ph.push(item); }
  }
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
function buy(item, price, q, shopId) {
  const entry = shopId && SHOPS[shopId] && SHOPS[shopId].stock.find(s => s.item === item);
  if (isTool(item)) {
    if (entry) price = unitPrice(player, shopId, entry, buyPrice(entry.price, player));
    if (player.tools[item]) { log(`You already have a ${item} on your toolbelt.`, 'game'); return; }
    if (player.gold < price) { log("You don't have enough coins.", 'warn'); return; }
    player.gold -= price;
    addTool(player, item);
    const info = ITEMS[item];
    const needs = info.req ? Object.entries(info.req).find(([sk, l]) => skills[sk].level < l) : null;
    log(`You buy a ${item} for ${price} coins. It goes on your toolbelt.${needs ? ` (You need ${needs[0]} ${needs[1]} to use it.)` : ''}`, 'game');
    markDirty(); return;
  }
  let bought = 0, spent = 0;
  for (let i = 0; i < q; i++) {
    if (entry) {
      if (stockLeft(player, shopId, entry) <= 0) { log(`The shop is out of ${item}. Stock comes back over a couple of minutes.`, 'warn'); break; }
      price = unitPrice(player, shopId, entry, buyPrice(entry.price, player), sellPrice(item, player));
    }
    if (player.gold < price) { if (!bought) log("You don't have enough coins.", 'warn'); break; }
    if (!canAdd(player, item)) { log("You don't have enough inventory space.", 'warn'); break; }
    player.gold -= price; spent += price;
    addItem(player, item, 1);
    if (entry) noteBought(player, shopId, item);
    bought++;
  }
  if (bought) log(`You buy ${bought > 1 ? bought + ' x ' : ''}${item} for ${spent} coins.`, 'game');
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
  onEscape: () => { ui.hideMenu(); invUI.close(); bondsUI.close(); minimap.closeMap(); cardsUI.close(); },
  onDpad: () => { if (action && action.kind !== 'craft') stopAction(); },
  onKey: k => { if ('wasd'.includes(k) && action && action.kind !== 'craft') stopAction(); },
  onAction: act => {
    if (/^ab\d$/.test(act)) { const list = ABILITIES.filter(a => abilityUnlocked(skills, a)); const a = list[+act.slice(2) - 1]; if (a) useAbility(a.id); }
    else if (act === 'run') toggleRun();
    else if (act === 'dodge') doDodge();
    else if (act === 'ride') toggleRide();
    else if (act === 'shift') steedShift();
    else if (act === 'bonds') bondsUI.toggle();
    else if (act === 'map') minimap.toggleMap();
    else if (act === 'firePort') sailing.fire('port');
    else if (act === 'fireStar') sailing.fire('star');
    else if (act.startsWith('tab')) invUI.showTab({ tabInv: 'inv', tabEquip: 'equip', tabSkills: 'skills', tabQuests: 'quests', tabPrayer: 'prayer', tabSettings: 'settings' }[act]);
  }
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
  else if (act === 'uiscale') { const opts = [0.85, 1, 1.15, 1.3]; s.uiScale = opts[(opts.indexOf(s.uiScale || 1) + 1) % opts.length]; document.documentElement.style.setProperty('--ui-scale', s.uiScale); window.dispatchEvent(new Event('resize')); }
  else if (act === 'ao') { s.ao = s.ao === false; applyGfx(); }
  else if (act === 'timeofday') { s.timeOfDay = (s.timeOfDay || 'cycle') === 'cycle' ? 'day' : 'cycle'; log(s.timeOfDay === 'day' ? 'Time of day: always morning.' : `Time of day: day/night cycle (it is ${dayLabel()} now).`, 'game'); }
  else if (act === 'nameplates') s.nameplates = s.nameplates === false;
  else if (act === 'sfx') s.sfx = s.sfx === false;
  else if (act === 'sfxvolume') { const opts = [0.25, 0.5, 1]; s.sfxVolume = opts[(opts.indexOf(s.sfxVolume ?? 0.5) + 1) % opts.length]; }
  else if (act === 'ambience') s.ambience = s.ambience === false;
  else if (act === 'shake') { s.shake = s.shake === false; rig.shakeOff = s.shake === false; }
  else if (act === 'uisound') s.uiSound = !s.uiSound;
  else if (act === 'uivolume') { const opts = [0.25, 0.5, 1]; s.uiVolume = opts[(opts.indexOf(s.uiVolume || 0.5) + 1) % opts.length]; }
  else if (act === 'dpad') { s.showDpad = !s.showDpad; inputCtl.setDpadVisible(s.showDpad); }
  else if (act === 'shadows') {
    if (gfx.quality === 'low') { log('Shadows are off on Low graphics. Switch to High to use them.', 'warn'); }
    else { s.shadows = !shadowsOn(); setShadows(renderer, dirLight, s.shadows, gfx.quality); }
  }
  else if (act === 'gfx') { s.gfx = s.gfx === 'high' ? 'low' : s.gfx === 'low' ? null : 'high'; gfx.autoLow = false; applyGfx(); log(`Graphics: ${gfxLabel()}.`, 'game'); }
  else if (act === 'retaliate') s.autoRetaliate = !s.autoRetaliate;
  else if (act === 'run') toggleRun();
  else if (act === 'autoloot') s.autoLoot = !s.autoLoot;
  else if (act === 'camera') { rig.targetYaw = 0; rig.targetPitch = 0.9; applyCamFraming(true); }
  else if (act === 'zoomlimit') { const opts = [18, 30, 45]; player.settings.zoomLimit = opts[(opts.indexOf(player.settings.zoomLimit || 30) + 1) % opts.length]; applyCamFraming(false); }
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

let hud;
const minimap = createMinimap({
  onPrayerOrb: () => invUI.showTab('prayer'),
  onWalk: (x, z) => { stopAction(); walkTo(x, z); },
  onCompass: () => { rig.targetYaw = Math.round(rig.targetYaw / (Math.PI * 2)) * Math.PI * 2; },
  onRunToggle: toggleRun
});
hud = createHud({ player, skills, monsters, levelColor, combatLevelOf: () => combatLevel(skills),
  getTarget: () => (action && action.kind === 'attack' && action.mon && action.mon.alive ? action.mon : null) });
// Words of Choice: every tone you pick is remembered (companions and factions react to it).
ui.onTone(tone => { player.alignment = player.alignment || {}; player.alignment[tone] = (player.alignment[tone] || 0) + 1; const m = compTalking ? null : toneReaction(player, tone, Date.now()); if (m) log(m, 'game'); markDirty(); });
hud.onQuick = q => { if (q === 'dig') digHere(); else if (q === 'port' || q === 'star') sailing.fire(q); else if (q === 'helm') sailing.S.throttle = sailing.S.throttle ? 0 : 1; else if (q === 'dodge') doDodge(); else if (q === 'ride') toggleRide(); else if (q === 'shift') steedShift(); else if (q === 'bonds') bondsUI.toggle(); };
hud.setQuick({});

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
const seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
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
  let point = g.length ? g[0].point : null;
  // The Sound has no terrain mesh: pick on the sea/island plane instead.
  if (!point && inSound(pm.mesh.position.x, pm.mesh.position.z)) { const pt = new THREE.Vector3(); seaPlane.constant = sailing.atSea ? 0 : -1.3; if (raycaster.ray.intersectPlane(seaPlane, pt)) point = pt; }
  if (!ents.length && !point) return null;
  return { ent: ents[0] || null, ents: all ? ents.slice(0, 4) : ents.slice(0, 1), point };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function stunned() {
  if (tick < (player.stunUntil || 0)) { log("You're stunned!", 'warn'); return true; }
  return false;
}
function walkTo(x, z) {
  if (crossing || stunned()) return;
  if (sailing && sailing.atSea) { sailing.steerTo(x, z); return; }
  if (sailing && sailing.moored && sailing.ship) {
    const sp = sailing.ship.mesh.position;
    if (Math.hypot(x - sp.x, z - sp.z) < 6 * sailing.ship.mesh.scale.x) {
      if (Math.hypot(pm.mesh.position.x - sp.x, pm.mesh.position.z - sp.z) < 24) { sailing.reboard(); return; }
      log('Walk to the end of the dock to board your ship.', 'game');
    }
  }
  pm.goal = null;
  pm.target = { x, z, walk: true };
  pm.stopDist = 0.1;
}
// ---- Magic ----
const MAGIC_RANGE = 6;
function autocastSpell() {
  const sp = spellById(player.settings.autocast);
  return sp && canCast(sp, skills, player).ok ? sp : null;
}
function setAutocast(id) {
  const sp = spellById(id);
  if (!sp || player.settings.autocast === id) { player.settings.autocast = null; log('Autocast is off. Use Cast on a monster, or pick a spell to autocast.', 'game'); }
  else {
    const c = canCast(sp, skills, player);
    if (skills.Magic.level < sp.level) { log(c.reason, 'warn'); return; }
    player.settings.autocast = id;
    log(`Autocast: ${sp.name}. Attack a monster to cast it.${c.ok ? '' : ' (You need more runes first.)'}`, 'game');
  }
  markDirty();
  invUI.render();
}
const SPELL_COLOR = { '💨': 0xe8f4ff, '💧': 0x3a8aff, '🪨': 0x9a7a40, '🔥': 0xff6a1a };
const spellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
spellMesh.visible = false;
scene.add(spellMesh);
let spellFlight = null;
// Hexcraft: each hex lands an effect on top of its damage (Hexwood staff adds 15% hex damage).
function applyHex(spell, mon, res) {
  const boost = (ITEMS[player.equipment.weapon] || {}).hexBoost || 0;
  if (boost && res.dmg > 0) res.dmg = Math.min(mon.hp, Math.round(res.dmg * (1 + boost)));
  if (spell.hex === 'rot') { mon.venom = { dmg: Math.max(4, Math.round(spell.maxHit * 0.2)), next: 4, left: 4 }; log(`The ${mon.name} begins to rot.`, 'combat'); }
  else if (spell.hex === 'bind') { mon.stunUntil = tick + 4; log(`Roots of bog-rope bind the ${mon.name}!`, 'combat'); }
  else if (spell.hex === 'wither') { mon.witherUntil = tick + 33; log(`The ${mon.name} withers. It hits softer.`, 'combat'); }
  else if (spell.hex === 'leech' && res.dmg > 0) { player.hp = Math.min(player.maxHp, player.hp + Math.floor(res.dmg / 2)); }
  player.hexCasts = (player.hexCasts || 0) + 1;
}
// Magic kit: element bolts, Surge and Storm ride on top of a spell cast.
function magicKit(special, spell, mon, res, now) {
  const ab = abilityById(special); if (!ab) return 0;
  cooldowns[special] = tick + cooldownTicks(skills, ab);
  for (const [r, q] of Object.entries(ab.runes || {})) if ((player.inventory[r] || 0) < q) { log(`Not enough runes for ${ab.name}.`, 'warn'); return 0; }
  for (const [r, q] of Object.entries(ab.runes || {})) removeItem(player, r, q);
  log(`${ab.name}!`, 'combat');
  const mh = magicMaxHit(spell, player, skills);
  let extra = 0;
  if (ab.element) {
    extra = Math.floor(mh * (0.4 + Math.random() * 0.5) * (ab.element === 'fire' ? 1.1 : ab.element === 'earth' ? 1.0 : 0.9));
    if (weakTo(mon.name, ab.element)) { extra = Math.floor(extra * WEAK_MULT); log(`The ${mon.name} is weak to ${ab.element}!`, 'combat'); }
    if (ab.element === 'earth') mon.witherUntil = Math.max(mon.witherUntil || 0, tick + 8);
    if (ab.element === 'fire' && (!mon.venom || mon.venom.dmg < 6)) mon.venom = { dmg: Math.max(4, Math.round(mh * 0.08)), next: 3, left: 4 };
  } else if (special === 'surge') { buffs.surgeLeft = 3; log('Power surges through your spells (+50% for 3 casts).', 'combat'); }
  else if (special === 'storm') {
    extra = Math.floor(mh * (0.8 + Math.random() * 0.7));
    const mp = mon.mesh.position;
    for (const m of monsters) if (m !== mon && m.alive && m.hp > 0 && m.mesh.position.distanceTo(mp) < 5) {
      const d = Math.min(m.hp, Math.floor(mh * (0.5 + Math.random() * 0.5))); m.hp -= d; overlays.splat(m, d, now + 350);
      if (m.state !== 'fight') { m.state = 'fight'; m.nextAttackTick = tick + 1; }
      giveXP('Magic', d * 0.6); if (m.hp <= 0) killMonster(m, now);
    }
    if (gfx.quality !== 'low') burst('hit', mp.x, mp.y + 2, mp.z, 18);
  }
  // Flow: Magic skills chain like the others.
  const fl = flowOnSkillHit(flow, tick, special);
  if (fl.repeat) log('Flow holds: use a different skill to add a link.', 'combat');
  if (fl.bonus) extra = Math.floor(extra * (1 + fl.bonus));
  if (fl.finisher) {
    extra += Math.floor(mh * FLOW.finisher); log(`${FINISHER.magic.name}!`, 'combat'); if (hud) hud.gain(10);
    const mp = mon.mesh.position; let best = null, bd = FINISHER.magic.range;
    for (const m of monsters) { if (m === mon || !m.alive || m.hp <= 0) continue; const d = m.mesh.position.distanceTo(mp); if (d < bd) { bd = d; best = m; } }
    if (best) { const d = Math.min(best.hp, Math.floor(mh * FINISHER.magic.chain * (0.6 + Math.random() * 0.4))); best.hp -= d; overlays.splat(best, d, now + 400); log(`The spell chains to the ${best.name}!`, 'combat');
      if (best.state !== 'fight') { best.state = 'fight'; best.nextAttackTick = tick + 1; } if (best.hp <= 0) killMonster(best, now); }
  }
  if (flow.best > (player.flowBest || 0)) player.flowBest = flow.best;
  if (hud && hud.setFlow) hud.setFlow(fl.finisher ? FLOW.maxLinks : fl.links);
  return extra;
}
function doMagicTick(a, now) {
  const mon = a.mon;
  const spell = spellById(a.spell);
  const res = castSpell(spell, skills, player, mon);
  if (res.error) { log(res.error, 'warn'); stopAction(); return; }
  if (queuedAbility && (abilityById(queuedAbility) || {}).style === 'magic') { const sp = queuedAbility; queuedAbility = null; res.dmg += magicKit(sp, spell, mon, res, now); invUI.renderBar(); }
  if (buffs.surgeLeft > 0 && res.dmg > 0) { res.dmg = Math.floor(res.dmg * 1.5); buffs.surgeLeft--; }
  { const hb = huntBonus(mon); if (hb && res.dmg > 0) res.dmg = Math.floor(res.dmg * (1 + hb)); }
  res.dmg = Math.min(res.dmg, mon.hp);
  res.xp.Magic = (res.xp.Magic || 0) + res.dmg * 0.2;
  if (spell.hex && res.dmg >= 0) applyHex(spell, mon, res);
  spellMesh.material.color.setHex(SPELL_COLOR[spell.icon] || (spell.hex ? 0x7ad04a : 0xffffff));
  spellFlight = { from: pm.mesh.position.clone().setY(1.3), mon, t: 0 };
  pm.actionAnim = 1; pm.actionKind = 'bow';
  mon.hp -= res.dmg;
  overlays.splat(mon, res.dmg, now + 300);
  if (res.saved) log('Your magic saves your runes.', 'combat');
  for (const [sk, v] of Object.entries(res.xp)) giveXP(sk, v);
  mon.lastHitAt = now;
  lastCombatTick = tick;
  if (mon.state !== 'fight') { mon.state = 'fight'; mon.nextAttackTick = tick + 1; }
  if (mon.hp <= 0) killMonster(mon, now);
  markDirty();
}

// ---- Agility ----
let crossing = null; // { fx, fz, tx, tz, t, dur }
function doAgility(a) {
  const obs = AGILITY_OBSTACLES[a.obstacle];
  const res = runObstacle(obs, skills, player);
  stopAction();
  if (res.error) { log(res.error, 'warn'); return; }
  const n = a.node, style = agilityStyle(obs), L = Math.hypot(n.toX - n.x, n.toZ - n.z) || 1;
  const v = agilityVariation(), failed = !res.ok;
  crossing = { style, L, v, failed, dmg: res.dmg || 0, sx: n.x, sz: n.z, yaw: Math.atan2(n.toX - n.x, n.toZ - n.z),
    ox: pm.mesh.position.x - n.x, oz: pm.mesh.position.z - n.z, snap: snapshotRig(pm), t: 0, gy: n.mesh.position.y, rope: n.rope || null, node: n,
    dur: agilityDuration(style, L) * v.speed * (failed ? 1.35 : 1) };
  pm.target = null; pm.actionAnim = 0;
  if (n.rope && !swingRopes.includes(n.rope)) swingRopes.push(n.rope);
  // frame the obstacle: come in closer and lower for the crossing, then hand the old view back
  if (!camSaved) camSaved = { dist: rig.targetDist, pitch: rig.targetPitch };
  rig.targetDist = Math.min(camSaved.dist, window.innerHeight > window.innerWidth ? 7 : 9.5); rig.targetPitch = Math.min(camSaved.pitch, 0.5);
  pickCrossingCamera(true);
  if (res.ok) {
    log(res.msg, 'skill');
    giveXP('Agility', res.xp);
    if (res.lap) log(`Lap complete! You finish the ${AGILITY_COURSES[obs.course].name} for bonus Agility XP.`, 'skill', '#7aff7a');
  } else {
    log(res.msg, 'warn');
    if (res.xp) giveXP('Agility', res.xp);
  }
  markDirty();
}
// Root motion along the obstacle plus a full-body keyframed pose (js/agilityAnim.js).
const _ikV = new THREE.Vector3();
// Camera during obstacles: try yaws around the player and keep the one with the clearest line of sight,
// so trees, bushes and buildings don't hide the climb. Re-checked a few times a second.
const _ray = new THREE.Raycaster(), _cp = new THREE.Vector3(), _pp = new THREE.Vector3(), _sph = new THREE.Sphere();
let camOccluders = null, camPickAt = 0, camSaved = null;
function pickCrossingCamera(force) {
  const now = performance.now();
  if (!force && now - camPickAt < 600) return; camPickAt = now;
  const P = pm.mesh.position;
  if (force || !camOccluders) {
    camOccluders = [];
    scene.traverseVisible(o => {
      if (!o.isMesh || o === pm.mesh || o.material?.transparent && o.material.opacity < 0.3) return;
      let p = o; while (p) { if (p === pm.mesh) return; p = p.parent; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      _sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (o.isInstancedMesh ? _sph.radius > 400 : (_sph.radius > 60 || _sph.center.distanceTo(P) - _sph.radius > rig.dist + 4)) return;
      camOccluders.push(o);
    });
  }
  const cpitch = Math.cos(rig.targetPitch), sp = Math.sin(rig.targetPitch), base = rig.targetYaw;
  // prefer a side-on view of the obstacle (the wall side is ruled out for ledges), close to the current view
  const py = crossing ? crossing.yaw : base, sides = crossing && crossing.style === 'shimmy' ? [1] : [1, -1];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let best = base, bestScore = Infinity;
  for (const sd of sides) for (const off of [0, 0.4, -0.4, 0.8, -0.8]) {
    const yaw = py + sd * Math.PI / 2 + off; let hits = 0;
    for (const h of [0.9, 1.7, 2.6]) {
      _pp.set(P.x, P.y + h, P.z);
      _cp.set(P.x + Math.sin(yaw) * cpitch * rig.targetDist, P.y + 1 + sp * rig.targetDist, P.z + Math.cos(yaw) * cpitch * rig.targetDist);
      const dir = _pp.clone().sub(_cp), len = dir.length(); _ray.set(_cp, dir.divideScalar(len)); _ray.far = len - 0.6;
      if (_ray.intersectObjects(camOccluders, false).length) hits++;
    }
    const score = hits * 10 + Math.abs(off) + 0.4 * Math.abs(wrap(yaw - rig.targetYaw));
    if (score < bestScore) { bestScore = score; best = rig.targetYaw + wrap(yaw - rig.targetYaw); }
  }
  rig.targetYaw = best;
  hideOccluders();
}
// Anything still between the camera and the player during a crossing (low bushes, branches, props) is hidden
// for the duration: single meshes are toggled off, instanced ones have that one instance collapsed.
const _hidden = new Map(), _m4 = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function hideOccluders() {
  const P = pm.mesh.position, keep = new Set();
  if (crossing && camOccluders) for (const h of [0.5, 1.0, 1.7, 2.6]) {
    _pp.set(P.x, P.y + h, P.z); _cp.copy(camera.position);
    const cp2 = Math.cos(rig.targetPitch); _cp.set(P.x + Math.sin(rig.targetYaw) * cp2 * rig.targetDist, P.y + 1 + Math.sin(rig.targetPitch) * rig.targetDist, P.z + Math.cos(rig.targetYaw) * cp2 * rig.targetDist);
    for (const cam of [camera.position, _cp]) {
      const dir = _pp.clone().sub(cam), len = dir.length(); _ray.set(cam, dir.divideScalar(len)); _ray.far = len - 0.5;
      for (const hit of _ray.intersectObjects(camOccluders, false)) {
        { let a = hit.object, own = false; while (a) { if (a === crossing.node?.mesh || a === crossing.rope) { own = true; break; } a = a.parent; } if (own) continue; }
        const key = hit.object.isInstancedMesh ? hit.object.uuid + ':' + hit.instanceId : hit.object.uuid; keep.add(key);
        if (_hidden.has(key)) continue;
        if (hit.object.isInstancedMesh) {
          const f = scene.userData.instanceEntAt?.(hit.object, hit.instanceId);
          if (f) { f.e.camHidden = true; scene.userData.repackInstance(f.g); _hidden.set(key, { ent: f.e, g: f.g }); keep.add('E' + f.e.x + ',' + f.e.z); _hidden.set('E' + f.e.x + ',' + f.e.z, _hidden.get(key)); }
          else { hit.object.getMatrixAt(hit.instanceId, _m4); _hidden.set(key, { o: hit.object, i: hit.instanceId, m: _m4.clone() }); hit.object.setMatrixAt(hit.instanceId, _zero); hit.object.instanceMatrix.needsUpdate = true; }
        }
        else { _hidden.set(key, { o: hit.object, v: hit.object.visible }); hit.object.visible = false; }
      }
    }
  }
  for (const [key, h] of _hidden) if (!crossing) { // stay hidden for the whole crossing (no flicker), restore after
    if (h.ent) { if (h.ent.camHidden) { h.ent.camHidden = false; scene.userData.repackInstance(h.g); } }
    else if (h.m) { h.o.setMatrixAt(h.i, h.m); h.o.instanceMatrix.needsUpdate = true; } else h.o.visible = h.v;
    _hidden.delete(key);
  }
}
const swingRopes = [];
const lerp3 = (a, b, k) => a + (b - a) * k;
function settleRopes(dt) { // swing ropes keep swinging after you let go, and settle back to hanging
  for (const r of swingRopes) { if (crossing && crossing.rope === r) continue; const u = r.userData; if (!u.a && !u.v) continue;
    u.v = (u.v || 0) - (u.a * 2.2 + u.v * 0.5) * dt; u.a += u.v * dt; if (Math.abs(u.a) < 0.002 && Math.abs(u.v) < 0.002) u.a = u.v = 0; r.rotation.x = -u.a; }
}
function updateCrossing(dt) {
  settleRopes(dt);
  if (!crossing) return;
  const c = crossing;
  c.t = Math.min(1, c.t + dt / c.dur);
  const { pose, impact } = agilityPose(c.style, c.t, c.L, c.v, c.failed);
  if (impact && c.dmg) { hurtPlayer(c.dmg); c.dmg = 0; }
  // blend in from whatever walk/idle pose we started in, and fold the approach offset into the first steps
  const w = smooth(c.t * c.dur / 0.25), o = mixPose({ ...pose, ...c.snap, u: pose.u, y: pose.y, s: pose.s, yaw: pose.yaw }, pose, w);
  const along = pose.u * c.L, side = pose.s, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), app = 1 - smooth(c.t / 0.12);
  pm.mesh.position.x = c.sx + side * cy + along * sy + c.ox * app;
  pm.mesh.position.z = c.sz - side * sy + along * cy + c.oz * app;
  pm.mesh.position.y = lerp3(terrainHeight(pm.mesh.position.x, pm.mesh.position.z), c.gy, smooth(Math.min(c.t, 1 - c.t) * 8)) + pose.y; // obstacle space while on it
  pm.facing = c.yaw; pm.mesh.rotation.y = c.yaw + pose.yaw;
  applyRigPose(pm, o);
  // lock hands and feet onto the obstacle's holds (2-bone IK), targets are in obstacle space
  if (pose.ik) {
    const ik = pose.ik, P = pm.parts, gy = c.gy, wb = Math.min(1, w * 1.2);
    const toW = q => _ikV.set(c.sx + q[0] * cy + q[2] * sy, gy + q[1], c.sz - q[0] * sy + q[2] * cy);
    pm.mesh.updateMatrixWorld(true);
    
    if (ik.lh) solveLimb(P.leftArm, P.leftArm.userData.elbow, 0.34, 0.37, toW(ik.lh), (ik.wh || 0) * wb, true);
    if (ik.rh) solveLimb(P.rightArm, P.rightArm.userData.elbow, 0.34, 0.37, toW(ik.rh), (ik.wh || 0) * wb, true);
    if (ik.lf) solveLimb(P.leftLeg, P.leftLeg.userData.knee, 0.4, 0.28, toW(ik.lf), (ik.wf || 0) * wb, false);
    if (ik.rf) solveLimb(P.rightLeg, P.rightLeg.userData.knee, 0.4, 0.28, toW(ik.rf), (ik.wf || 0) * wb, false);
  }
  pickCrossingCamera(false);
  if (c.rope) { c.rope.rotation.x = -(pose.ropeA ?? 0); c.rope.userData.a = pose.ropeA ?? 0; c.rope.userData.v = 0; }
  if (c.t >= 1) { crossing = null; hideOccluders(); releaseRig(pm); if (camSaved) { rig.targetDist = camSaved.dist; rig.targetPitch = camSaved.pitch; camSaved = null; } pm.facing = c.yaw; pm.mesh.position.y = terrainHeight(pm.mesh.position.x, pm.mesh.position.z); }
}
function hurtPlayer(dmg) {
  if (dmg <= 0) return;
  player.hp = Math.max(0, player.hp - dmg);
  playerEnt.lastHitAt = performance.now();
  overlays.splat(playerEnt, dmg, performance.now());
  if (player.hp <= 0) playerDied();
}

// ---- Thieving ----
function doThieve(a) {
  const res = thieve(a.target, skills, player);
  pm.actionAnim = 1; pm.actionKind = 'tool';
  stopAction();
  if (res.error) { log(res.error, 'warn'); return; }
  if (res.fail) {
    log(`You fail to pick the ${a.target.toLowerCase()}'s pocket. You've been stunned!`, 'warn');
    player.stunUntil = tick + res.stun;
    pm.target = null;
    hurtPlayer(res.dmg);
  } else {
    const got = [];
    for (const d of res.drops) {
      if (d.item === 'Coins') { player.gold += d.qty; got.push(`${d.qty} coins`); }
      else { giveItem(d.item, d.qty); got.push(d.qty > 1 ? `${d.qty} x ${d.item}` : d.item); }
    }
    log(`You pick the ${a.target.toLowerCase()}'s pocket${got.length ? `: ${got.join(', ')}` : ''}.`, 'skill');
    giveXP('Thieving', res.xp);
  }
  markDirty();
}

// ---- Runecrafting ----
function doRunecraft(a) {
  const res = craftRunes(a.altar, skills, player);
  stopAction();
  if (res.error) { log(res.error, 'warn'); return; }
  pm.actionAnim = 1; pm.actionKind = 'tool';
  log(`You bind the temple's power into ${res.qty} ${res.item.toLowerCase()}${res.qty > 1 ? 's' : ''}.`, 'skill');
  giveXP('Runecrafting', res.xp);
  markDirty();
}

// Dodge-roll: rolls the way you are walking, or backwards from your facing when standing still.
function doDodge() {
  if (crossing || stunned() || pm.dodge) return;
  let x = 0, z = 0;
  if (keys.w) z -= 1; if (keys.s) z += 1; if (keys.a) x -= 1; if (keys.d) x += 1;
  if (x || z) { const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw); const rx = x * c + z * s, rz = -x * s + z * c; x = rx; z = rz; }
  else { x = -Math.sin(pm.facing); z = -Math.cos(pm.facing); }
  const l = Math.hypot(x, z) || 1;
  const err = tryDodge(flow, pm, player, { x: x / l, z: z / l }, performance.now(), perk(skills, 'Combat', 'dodgeMs'));
  if (err) log(err, 'warn'); else markDirty();
}
// ---- Shiftsteeds ----
const steedState = { mesh: null, id: null, armorHi: null, bulwarkUntil: 0, shiftReadyAt: 0, t: 0 };
function checkSteeds() {
  player.steeds = normalizeSteeds(player.steeds);
  for (const s of grantSteeds(player.steeds, skills.Agility.level)) log(`New steed: ${s.name}. Press G (or Ride) to ride it. ${s.desc}`, 'skill');
  refreshQuick();
}
function segDist(px, pz, x1, z1, x2, z2) {
  const vx = x2 - x1, vz = z2 - z1, l2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / l2));
  return Math.hypot(px - x1 - vx * t, pz - z1 - vz * t);
}
function riding() { return !!steedState.mesh; }
function refreshQuick() {
  const st = player.steeds || { owned: [] };
  if (hud && sailing && sailing.atSea) { hud.setQuick({ sea: true, sailing: sailing.S.throttle > 0 }); return; }
  if (hud) hud.setQuick({ dig: nearChart(), ride: st.owned.length > 0, riding: riding(), shift: riding() && steedById(steedState.id).shift, bonds: COMPANIONS.some(c => player.companions && player.companions[c.id] && player.companions[c.id].recruited) || !!(player.saga && player.saga.calling) });
}
function mount(id) {
  const def = steedById(id); if (!def) return;
  steedState.mesh = buildSteed(def); steedState.id = id; scene.add(steedState.mesh);
  pm.speedMul = def.speed; pm.rideLift = steedState.mesh.userData.seatY + 0.95;
  player.steeds.active = id;
}
function dismount(msg) {
  if (!steedState.mesh) return;
  scene.remove(steedState.mesh); steedState.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  if (steedState.armorHi) { steedState.armorHi.geometry.dispose(); steedState.armorHi.material.dispose(); steedState.armorHi = null; }
  steedState.mesh = null; steedState.id = null; steedState.bulwarkUntil = 0; pm.speedMul = 1; pm.rideLift = 0;
  const p = pm.parts; p.leftLeg.rotation.set(0, 0, 0); p.rightLeg.rotation.set(0, 0, 0);
  if (player.steeds) player.steeds.active = null;
  if (msg) log(msg, 'game');
  refreshQuick(); markDirty();
}
function toggleRide() {
  const st = player.steeds = normalizeSteeds(player.steeds);
  if (riding()) { dismount('You dismount.'); return; }
  if (!st.owned.length) { log(`You need Agility level ${STEEDS[0].agility} to ride a steed.`, 'warn'); return; }
  if (crossing || stunned() || (action && action.kind === 'attack')) { log('You cannot summon a steed right now.', 'warn'); return; }
  if (pm.mesh.position.y < -5) return;
  // Cycle: ride the last steed, or the next one you own after it.
  const last = st.lastRide && st.owned.includes(st.lastRide) ? st.lastRide : st.owned[st.owned.length - 1];
  mount(last); st.lastRide = last;
  log(`You call your ${steedById(last).name} and climb into the saddle.`, 'game');
  refreshQuick(); markDirty();
}
function steedShift() {
  if (!riding() || !steedById(steedState.id).shift) { log('Only the Ironbristle Boar can shift. Ride it first.', 'warn'); return; }
  const now = performance.now();
  if (now < steedState.shiftReadyAt) { log(`Bulwark form is recharging (${Math.ceil((steedState.shiftReadyAt - now) / 1000)}s).`, 'warn'); return; }
  steedState.bulwarkUntil = now + BULWARK.ms; steedState.shiftReadyAt = now + BULWARK.cdMs;
  const fx = Math.sin(pm.facing), fz = Math.cos(pm.facing);
  pm.dodge = { x: fx, z: fz, left: BULWARK.chargeMs, speed: BULWARK.chargeDist / (BULWARK.chargeMs / 1000) };
  // The charge rams the first monster ahead of you.
  const p = pm.mesh.position; let hit = null, hd = 7;
  for (const m of monsters) {
    if (!m.alive) continue; const dx = m.mesh.position.x - p.x, dz = m.mesh.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < hd && (dx * fx + dz * fz) / (d || 1) > 0.6) { hit = m; hd = d; }
  }
  if (hit) {
    const dmg = Math.min(hit.hp, Math.ceil(2 + skills.Strength.level * 0.25 + Math.random() * 3));
    hit.hp -= dmg; hit.stunUntil = tick + 3; hit.hitT = 1; overlays.splat(hit, dmg, now + 300);
    giveXP('Strength', dmg * 2); giveXP('Agility', 6);
    log(`Bulwark Charge rams the ${hit.name}!`, 'combat');
    if (hit.hp <= 0) killMonster(hit, now);
  } else log('Your boar shifts into Bulwark form!', 'combat');
}
// After movement each frame: pose the steed and rider, set speed, and drop off the steed when fighting or crossing.
function updateSteed(dt, moved) {
  if (!steedState.mesh) return;
  if (crossing || (action && action.kind === 'attack')) { dismount('You dismount to fight.'); return; }
  steedState.t += dt;
  const pos = pm.mesh.position, def = steedById(steedState.id);
  let onRoad = false; for (const pth of PATHS) if (segDist(pos.x, pos.z, ...pth) < 2.2) { onRoad = true; break; }
  pm.speedMul = def.speed * (onRoad ? ROAD_BONUS : 1);
  poseSteed(steedState.mesh, pos, pm.facing, moved, dt, steedState.t);
  pos.y = terrainHeight(pos.x, pos.z) + pm.rideLift;
  const p = pm.parts; p.leftLeg.rotation.x = p.rightLeg.rotation.x = -1.25; p.leftLeg.rotation.z = -0.35; p.rightLeg.rotation.z = 0.35;
  p.leftLeg.userData.knee.rotation.x = p.rightLeg.userData.knee.rotation.x = 1.4; p.body.rotation.x = 0.08;
  // Bulwark armour: a High-only model, built the first time it is shown on a non-Low frame. Low never builds it.
  const armoured = performance.now() < steedState.bulwarkUntil;
  if (armoured && gfx.quality !== 'low' && !steedState.armorHi) { steedState.armorHi = buildBulwarkArmor(); steedState.mesh.add(steedState.armorHi); }
  if (steedState.armorHi) steedState.armorHi.visible = armoured && gfx.quality !== 'low';
}
function stopAction() {
  action = null;
  pm.goal = null;
  pm.actionAnim = 0;
}
function startAction(a) {
  if (crossing || stunned()) return;
  action = a;
  pm.target = null;
  pm.goal = null;
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
  if (ent.type === 'poi' || ent.type === 'cave') return ent.examine;
  if (ent.type === 'chest') return player.caveLoot ? 'The hoard is empty now. You already took everything.' : ent.examine;
  if (ent.type === 'forage') return ent.alive ? `A bush heavy with ${ent.item.toLowerCase()}. (Herblore ${ent.level})` : 'This bush has been picked clean. It will grow back soon.';
  if (ent.companion) return companionById(ent.companion).examine;
  if (ent.saga) return 'An old chronicler with ink-stained fingers. He writes down the stories worth keeping.';
  if (ent.standing) return 'She keeps the faction ledgers for every town.';
  if (ent.type === 'npc') return (NPC_INFO[ent.npc] || {}).examine || `It's ${ent.name}.`;
  if (ent.type === 'tree' && !ent.alive) return 'This tree has been cut down.';
  if (ent.type === 'rock' && !ent.alive) return 'There is currently no ore available in this rock.';
  if (ent.type === 'fish') return EXAMINE[ent.kind];
  if (ent.type === 'herb') return `A herb patch growing ${ent.herb.toLowerCase()}. It never runs out. (Herblore ${HERB_LEVEL(ent.herb)})`;
  if (ent.type === 'well') return ent.examine;
  if (ent.type === 'sign') return 'A wooden signpost. Read it to see which way the towns are.';
  if (ent.type === 'agility') { const o = AGILITY_OBSTACLES[ent.obstacle]; return `${ent.name}: part of the ${AGILITY_COURSES[o.course].name} (Agility ${o.level}). Do every obstacle in order for a lap bonus.`; }
  if (ent.type === 'runealtar') { const a = RUNE_ALTARS[ent.altar]; return `A mysterious ${ent.altar.toLowerCase()} altar. Bring ${a.pure ? 'pure' : 'rune'} essence here to craft ${a.rune.toLowerCase()}s. (Runecrafting ${a.level})`; }
  if (ent.type === 'rock' && ent.ore === 'Essence') return 'Rune essence rock. Mine it for essence (pure essence from Mining 30).';
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
    const auto = autocastSpell();
    const opts = [{ action: auto ? `Attack (${auto.name})` : 'Attack', target: `${ent.variant ? ent.variant + ' the ' + ent.name : ent.name} (level-${ent.level})`, color: levelColor(ent.level), fn: () => startAction({ kind: 'attack', mon: ent, spell: auto ? auto.id : null }) }];
    const sp = auto || bestSpell(skills, player);
    if (sp && !auto) opts.push({ action: `Cast ${sp.name}`, target: ent.name, color: '#a0c0ff', fn: () => startAction({ kind: 'attack', mon: ent, spell: sp.id }) });
    if (THIEVE_TARGETS[ent.name]) opts.push({ action: 'Pickpocket', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'thieve', node: ent, target: ent.name }) });
    opts.push({ action: 'Examine', target: ent.name, color: '#ffff00', fn: () => log(entExamine(ent), 'examine') });
    return opts;
  }
  const ex = { action: 'Examine', target: ent.name, color: cy, fn: () => log(entExamine(ent), 'examine') };
  switch (ent.type) {
    case 'tree': return [{ action: 'Chop down', target: ent.name, color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'rock': return [
      { action: 'Mine', target: ent.name, color: cy, fn: () => startAction({ kind: 'gather', node: ent }) },
      { action: 'Prospect', target: ent.name, color: cy, fn: () => log(ent.ore === 'Essence' ? 'This rock contains rune essence (pure essence from Mining 30).' : ent.alive ? `This rock contains ${ent.ore.toLowerCase()}. (Mining ${ROCKS[ent.ore].level})` : 'There is currently no ore available in this rock.', 'examine') }, ex];
    case 'fish': return [{ action: FISH_SPOTS[ent.kind].verb, target: 'Fishing spot', color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'shop': return [
      { action: 'Trade', target: 'Merchant', color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: 'shop' }) },
      { action: 'Talk-to', target: 'Merchant', color: '#ffff00', fn: () => startAction({ kind: 'talk', node: ent }) },
      { ...ex, color: '#ffff00' }];
    case 'herb': return [{ action: 'Pick', target: ent.name, color: cy, fn: () => startAction({ kind: 'gather', node: ent }) }, ex];
    case 'well': return [{ action: 'Fill vials', target: 'Well', color: cy, fn: () => startAction({ kind: 'well', node: ent }) }, ex];
    case 'bank': return [{ action: 'Bank', target: ent.name || 'Bank booth', color: cy, fn: () => startAction({ kind: 'bank', node: ent }) }, ex];
    case 'npc': {
      const o = [{ action: 'Talk-to', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'talk', node: ent }) }];
      if (ent.npc === 'bob') o.push({ action: 'Trade', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: 'tools' }) });
      else if (ent.shop) o.push({ action: 'Trade', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'shop', node: ent, shop: ent.shop }) });
      const qd = questForNpc(ent.npc, player, questHelpers);
      if (qd) o.push({ action: 'Quest', target: `${qd.name} (${questStatus(player, qd.id)})`, color: '#3ad0ff', fn: () => { invUI.showTab('quests'); } });
      if (ent.thieve) o.push({ action: 'Pickpocket', target: ent.name, color: '#ffff00', fn: () => startAction({ kind: 'thieve', node: ent, target: ent.thieve }) });
      return [...o, { ...ex, color: '#ffff00' }];
    }
    case 'station': {
      const verb = { furnace: 'Smelt', anvil: 'Smith', range: 'Cook' }[ent.kind];
      return [{ action: verb, target: ent.name, color: cy, fn: () => startAction({ kind: 'station', node: ent }) }, ex];
    }
    case 'altar': return [{ action: 'Pray-at', target: 'Altar', color: cy, fn: () => startAction({ kind: 'altar', node: ent }) }, ex];
    case 'forage': return [{ action: 'Pick-from', target: ent.name, color: cy, fn: () => startAction({ kind: 'forage', node: ent }) }, ex];
    case 'sign': return [{ action: 'Read', target: 'Signpost', color: cy, fn: () => log(ent.text, 'examine') }, ex];
    case 'agility': return [{ action: ent.verb, target: ent.name, color: cy, fn: () => startAction({ kind: 'agility', node: ent, obstacle: ent.obstacle }) }, ex];
    case 'runealtar': return [{ action: 'Craft-rune', target: ent.name, color: cy, fn: () => startAction({ kind: 'runecraft', node: ent, altar: ent.altar }) }, ex];
    case 'building': return [ex];
    case 'hearth': return [{ action: 'Use', target: ent.name, color: cy, fn: () => startAction({ kind: 'talk', node: ent }) }, ex];
    case 'cave': return [{ action: ent.verb || (ent.dest === CAVE.inside ? 'Enter' : 'Climb-up'), target: ent.name, color: cy, fn: () => startAction({ kind: 'cave', node: ent }) }, ex];
    case 'chest': return [{ action: 'Search', target: ent.name, color: cy, fn: () => startAction({ kind: 'chest', node: ent }) }, ex];
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
  if (node.syncInstance) node.syncInstance(node);
  else if (node.full) node.full.visible = false;
  if (node.depleted) node.depleted.visible = true;
  node.respawnAt = performance.now() + ms;
}
function respawnNode(node) {
  node.alive = true;
  if (node.syncInstance) node.syncInstance(node);
  else if (node.full) node.full.visible = true;
  if (node.depleted) node.depleted.visible = false;
}

function doGatherTick(a) {
  const node = a.node;
  if (a.wait > 0) { a.wait--; return; }
  // Try every 2 ticks; Chain Chop / Rich Vein sometimes make it 1 tick (never faster).
  const gi = gatherInfo(node);
  a.wait = gi ? nextGatherWait(skills, gi.skill) : 1;
  pm.actionAnim = 1; pm.actionKind = ({ Woodcutting: 'chop', Mining: 'mine', Fishing: 'fish' })[gi?.skill] || 'tool';
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
  pm.actionAnim = 1; pm.actionKind = ({ Smithing: 'smith', Cooking: 'cook', Fletching: 'craft', Crafting: 'craft', Herblore: 'craft' })[r.skill] || 'tool';
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
const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9, metalness: 0.0 });
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
  g.position.set(x, terrainHeight(x, z), z);
  scene.add(g);
  const fire = { mesh: g, flame: fl, type: 'station', kind: 'range', name: 'Fire', isFire: true, alive: true, x, z, radius: 0.5, expires: performance.now() + 60000 };
  g.userData.entity = fire;
  fires.push(fire); fl.scale.setScalar(0.55); addFire(g, 0.9);
  log('The fire catches and the logs begin to burn.', 'game');
  // step aside like RuneScape
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) if (!blockedAt(x + dx, z + dz)) { walkTo(x + dx, z + dz); break; }
  stopAction();
  markDirty();
}
function removeFire(f) {
  removeFireVfx(f.mesh); scene.remove(f.mesh);
  const i = fires.indexOf(f);
  if (i >= 0) fires.splice(i, 1);
}

// ---- Talking ----
const NPC_FACE = { mizgog: '🧙', betty: '🧙‍♀️', aubury: '🧙', man: '👨', woman: '👩', sailor: '🧑‍✈️', vguard: '💂', warrior: '🤺', wknight: '🤺', paladin: '🛡️', hero: '🦸', cassie: '👩‍🔧', nessa: '🧑‍🌾', horvik: '🧔', gerrant: '🧑‍💼', vshop: '🧑‍💼', cook: '👨‍🍳', priest: '🧔', doric: '🧔‍♂️', captain: '💂‍♀️', farmer: '👨‍🌾', bob: '👷', merchant: '🧑‍💼', ranger: '🧝', knight: '🤺', apothecary: '🧑‍⚕️', merchant2: '🧑‍💼', banker: '🏦' };
for (const n of QUEST_NPCS) NPC_FACE[n.id] = n.face;
const SHOP_GREET = { ashford: 'Welcome to the Ashford Store! Farm goods, tools and supplies. I buy what you bring in, too.', magic0: 'Runes for beginners! Wind Strike needs an air rune and a mind rune. Open the Combat tab to pick a spell to autocast.', magic: 'Welcome to my emporium. A staff of an element gives you all the runes of that element you need.', runes: 'Runes and essence! Mine rune essence in the rocks just south-east of here, then take it to an altar.', apothecary: 'Herbs, vials and potions! Fill empty vials at the well. Pick grimy herbs from the patches out back, clean them, then mix herb + vial of water + a secondary.' };
const questHelpers = {
  rewarding: false,
  level: s => (skills[s] ? skills[s].level : 1),
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
// ---- Standing: faction reputation (tiers cached; quests are counted from the save, so old saves keep credit) ----
const standTiers = {};
function refreshStanding(announce) {
  for (const f of FACTIONS) {
    const t = tierOf(repOf(player, f.id));
    if (announce && standTiers[f.id] !== undefined && t > standTiers[f.id]) log(`Your standing with the ${f.name} is now ${TIERS[t][1]}! Visit Quartermaster Odile in Falador for a reward.`, 'skill', '#ffd700');
    standTiers[f.id] = t;
  }
}
refreshStanding(false);
function standingXp(skill) { let b = 0; for (const f of FACTIONS) if (f.skills.includes(skill)) b += (standTiers[f.id] || 0) * 0.01; return b; }
function gainRep(fid, n) { const f = factionById(fid); addRep(player, fid, n); log(`+${n} standing with the ${f.name}.`, 'game'); refreshStanding(true); markDirty(); }
function quartermasterTalk() {
  refreshStanding(true);
  const lines = [];
  for (const f of FACTIONS) {
    const t = standTiers[f.id] || 0, key = 'qm_' + f.id, got = (player.rep && player.rep[key]) || 0;
    for (let i = got + 1; i <= t; i++) {
      const r = TIER_REWARDS[i]; if (!r) continue;
      if (r.item && !canAdd(player, r.item[0], r.item[1])) { lines.push(['npc', `Make room in your pack and I'll give you the ${f.name} ${TIERS[i][1]} reward.`]); break; }
      player.gold += r.gold; if (r.item) addItem(player, r.item[0], r.item[1]);
      player.rep[key] = i;
      lines.push(['npc', `For reaching ${TIERS[i][1]} with the ${f.name}: ${r.gold} coins${r.item ? ` and ${r.item[1]} ${r.item[0]}` : ''}.`]);
    }
  }
  markDirty();
  if (!lines.length) lines.push(['npc', 'Every town keeps a ledger, and I keep the ledgers. Do quests and bounties and errands, and your standing will grow. Come back when it does.']);
  return [['npc', 'Quartermaster Odile, keeper of the ledgers.'], ...lines, { choose: [['How do I stand?', FACTIONS.map(f => { const r = repOf(player, f.id), n = nextTier(r); return ['npc', `${f.icon} ${f.name}: ${TIERS[tierOf(r)][1]} (${r}${n ? ` / ${n}` : ''}).`]; })], ['Goodbye.', []]] }];
}
// ---- Sworn Companions: recruiting, gifts, following and combat assists ----
player.companions = normalizeCompanions(player.companions);
if (player.activeCompanion && !(player.companions[player.activeCompanion] || {}).recruited) player.activeCompanion = null;
const compEnts = {};
let compTalking = null;
for (const n of nodes) if (n.companion) compEnts[n.companion] = n;
function compState(id) { player.companions = player.companions && player.companions[id] ? player.companions : normalizeCompanions(player.companions); return player.companions[id]; }
function compTaskText(d, s) {
  const r = d.recruit;
  if (r.kind === 'kill') return `Defeat ${r.n} ${r.mon}s (${Math.min(s.task, r.n)}/${r.n}).`;
  return `Bring ${r.n} ${r.item}${r.req ? ` and reach ${r.req[0]} ${r.req[1]}` : ''}.`;
}
function setCompanion(id) {
  const prev = player.activeCompanion;
  if (prev && prev !== id && compEnts[prev]) { const e = compEnts[prev], h = e.home; e.mesh.position.set(h.x, terrainHeight(h.x, h.z), h.z); e.x = h.x; e.z = h.z; }
  player.activeCompanion = id;
  if (!id && prev && compEnts[prev]) { const e = compEnts[prev], h = e.home; e.mesh.position.set(h.x, terrainHeight(h.x, h.z), h.z); e.x = h.x; e.z = h.z; }
  markDirty();
}
function giftCompanion(d) {
  const s = compState(d.id), now = Date.now();
  if (now - s.giftAt < GIFT_COOLDOWN_MS) return [['npc', `You already gave me something. Maybe later — in about ${Math.ceil((GIFT_COOLDOWN_MS - (now - s.giftAt)) / 60000)} minutes.`]];
  const item = Object.keys(player.inventory).find(i => d.giftRe.test(i));
  if (!item) return [['npc', `I like ${d.giftWord}. You don't have any on you.`]];
  removeItem(player, item, 1); s.giftAt = now; addBond(player, d.id, 1); markDirty();
  return [['player', `Here, I brought you this ${item}.`], ['npc', `For me? Thank you. (Bond ${s.bond}/${BOND_MAX})`]];
}
function companionTalk(ent) {
  const d = companionById(ent.companion), s = compState(d.id), r = d.recruit;
  if (!s.recruited) {
    if (!s.started) return [['npc', r.ask], { wheel: [
      ['kind', 'I\'d be glad to help.', [['npc', 'You\'re kind. I\'ll remember that.'], { run: () => { s.started = true; s.firstTone = 'kind'; markDirty(); log(`New task: ${compTaskText(d, s)}`, 'game'); } }]],
      ['firm', 'Fine. But you follow my lead.', [['npc', 'Fair enough. Prove it and I\'ll follow.'], { run: () => { s.started = true; s.firstTone = 'firm'; markDirty(); log(`New task: ${compTaskText(d, s)}`, 'game'); } }]],
      ['cunning', 'What\'s in it for me?', [['npc', 'A sharp friend in a tight spot. Deal?'], { run: () => { s.started = true; s.firstTone = 'cunning'; markDirty(); log(`New task: ${compTaskText(d, s)}`, 'game'); } }]],
      ['neutral', 'Not now.', [['npc', 'Come back if you change your mind.']]]
    ] }];
    let ok = r.kind === 'kill' ? s.task >= r.n : (player.inventory[r.item] || 0) >= r.n;
    if (ok && r.req && skills[r.req[0]].level < r.req[1]) return [['npc', `You'll need ${r.req[0]} level ${r.req[1]} first.`]];
    if (!ok) return [['npc', `Still waiting. ${compTaskText(d, s)}`]];
    return [['npc', 'You did it. Then I\'m with you.'], { run: () => {
      if (r.kind === 'item') removeItem(player, r.item, r.n);
      s.recruited = true; s.bond = s.firstTone === d.likes ? 2 : 1;
      log(`${d.name} is now your Sworn Companion. Open Bonds (B) to manage companions.`, 'skill');
      if (!player.activeCompanion) setCompanion(d.id); refreshQuick(); markDirty();
    } }];
  }
  const active = player.activeCompanion === d.id;
  if (awayUntil(d.id)) return [['npc', `I'm about to head out on an errand. Back in ${Math.max(1, Math.ceil((awayUntil(d.id) - Date.now()) / 60000))} minutes.`]];
  const chat = { wheel: [
    ['kind', 'How are you holding up?', [['npc', d.likes === 'kind' ? 'Better for you asking.' : 'I\'m fine. Don\'t fuss.'], { run: () => talkTone(d, 'kind') }]],
    ['firm', 'Stay sharp. We move soon.', [['npc', d.likes === 'firm' ? 'Ha! That\'s the spirit.' : 'Yes, yes.'], { run: () => talkTone(d, 'firm') }]],
    ['cunning', 'Any tricks I should know?', [['npc', d.likes === 'cunning' ? 'Oh, a few. Watch this.' : 'Tricks? Just fight well.'], { run: () => talkTone(d, 'cunning') }]],
    ['neutral', 'Never mind.', []]
  ] };
  return [['npc', `Bond ${s.bond}/${BOND_MAX}. ${active ? 'Lead on.' : 'Need me?'}`], { choose: [
    [active ? 'Wait here.' : 'Follow me.', [{ run: () => { setCompanion(active ? null : d.id); log(active ? `${d.short} heads home.` : `${d.short} follows you.`, 'game'); } }]],
    ['I brought you something.', [{ run: () => giftCompanion(d) }]],
    ['Let\'s talk.', [chat]],
    ['Goodbye.', []]
  ] }];
  function talkTone(d, tone) { const s = compState(d.id), now = Date.now(); if (tone === d.likes && now - (s.talkAt || 0) > GIFT_COOLDOWN_MS) { s.talkAt = now; addBond(player, d.id, 1); log(`${d.short} liked that. (Bond ${s.bond}/${BOND_MAX})`, 'game'); markDirty(); } }
}
function companionKill(name) {
  for (const d of COMPANIONS) { const s = compState(d.id); if (s.started && !s.recruited && d.recruit.kind === 'kill' && name === d.recruit.mon && s.task < d.recruit.n) { s.task++; log(`${d.short}: ${s.task}/${d.recruit.n} ${d.recruit.mon}s defeated.`, 'game'); markDirty(); } }
}
function updateCompanion(dt) {
  const id = player.activeCompanion, e = id && compEnts[id]; if (!e) return;
  const o = e.mesh, p = pm.mesh.position;
  if (action && action.node === e) return;
  const dx = p.x - o.position.x, dz = p.z - o.position.z, d = Math.hypot(dx, dz);
  if (d > 25 || !o.parent) { o.position.set(p.x - 1.5, p.y, p.z - 1.5); }
  else if (d > 2.2) { const st = Math.min(d - 2, dt * Math.max(3, d * 1.6)); o.position.x += dx / d * st; o.position.z += dz / d * st; o.rotation.y = Math.atan2(dx, dz); }
  o.position.y = terrainHeight(o.position.x, o.position.z) + (pm.rideLift && d < 3 ? 0 : 0);
  e.x = o.position.x; e.z = o.position.z;
}
function companionAssist(now) {
  const id = player.activeCompanion, e = id && compEnts[id]; if (!e) return;
  const s = compState(id); if (!(action && action.kind === 'attack' && action.mon && action.mon.alive)) return;
  if (tick % assistEvery(s.bond) !== 0) return;
  const mon = action.mon, mp = mon.mesh.position;
  if (Math.hypot(mp.x - e.mesh.position.x, mp.z - e.mesh.position.z) > 14) return;
  const dmg = Math.min(mon.hp, Math.floor(Math.random() * (assistMax(s.bond, combatLevel(skills)) + 1)));
  mon.hp -= dmg; overlays.splat(mon, dmg, now + 200); if (dmg > 0) mon.hitT = 1;
  e.mesh.rotation.y = Math.atan2(mp.x - e.mesh.position.x, mp.z - e.mesh.position.z);
  if (mon.hp <= 0) killMonster(mon, now);
}
// ---- Sails of Sarim: your ship, the Shipwright, harbours, Drowned Crew rewards ----
player.vessel = normalizeVessel(player.vessel);
sailing = createSailing({
  scene, pm, player, log: (m, k) => log(m, k), quality: () => gfx.quality, burst, markDirty: () => markDirty(),
  onChange: () => { if (sailing && sailing.atSea) rig.targetDist = Math.max(rig.targetDist, 22); refreshQuick(); markDirty(); },
  onSunk: () => { player.vessel.hp = 0; },
  onSinkEnemy: kind => {
    const v = player.vessel; v.sank++; const g = kind.loot[0] + Math.floor(Math.random() * (kind.loot[1] - kind.loot[0]));
    player.gold += g; giveXP('Ranged', 60 + kind.hp * 0.6); giveXP('Smithing', 15);
    if (/Drowned/.test(kind.name)) gainRep('drowned', 40);
    log(`The ${kind.name} sinks! You salvage ${g} coins.`, 'loot');
    if (Math.random() < 0.25) { giveItem('Treasure chart'); log('A sodden Treasure chart floats up from the wreck.', 'loot'); }
  },
  companionsAboard: id => player.activeCompanion === id
});
sailing.restore();
const cardsUI = createCards({ player, log: (m, k) => log(m, k), markDirty: () => markDirty() });
function seaMarks() {
  const p = pm.mesh.position, out = [];
  for (const c of player.vessel.charts) { const i = ISLANDS.find(x => x.id === c.isl); out.push({ x: c.x, z: c.z, label: `Treasure: dig on ${i ? i.name : 'an island'} (X marks the spot)` }); }
  if (inSound(p.x, p.z)) for (const i of ISLANDS) out.push({ x: i.dock.x, z: i.dock.z, label: `${i.name}${i.port ? ' (port)' : ' (Drowned Crew)'}` });
  else if (player.vessel.hull || player.vessel.charts.length) out.push({ x: SARIM_DOCK.x, z: SARIM_DOCK.z, label: 'Port Sarim docks: set sail' });
  return out;
}
const shipName = () => HULLS[player.vessel.hull - 1].name;
function shipwrightTalk() {
  const v = player.vessel, out = [];
  if (!v.hull) {
    out.push(['npc', "Halvard, shipwright. Want to see the Sound? You'll need a hull under you. A Sloop's 2,000 coins: two guns a side, quick on the wind."]);
    out.push({ choose: [['Build me a Sloop (2,000 coins).', [{ run: () => { if (player.gold < 2000) return [['npc', 'Come back with 2,000 coins.']]; player.gold -= 2000; player.vessel = normalizeVessel({ hull: 1 }); refreshQuick(); markDirty(); return [['npc', "She's yours. Talk to me when you want to cast off."]]; } }]], ['Not today.', []]] });
    return out;
  }
  const H = HULLS[v.hull - 1], next = HULLS[v.hull];
  out.push(['npc', `Your ${H.name}: hull ${v.hp}/${H.hp}, ${v.crew}/${CREW_MAX} deckhands${v.officers.length ? ', officers: ' + v.officers.map(o => companionById(o).name.split(' ')[0]).join(', ') : ''}.`]);
  const opts = [['Cast off into the Sound.', [{ run: () => { ui.closeDialogue && setTimeout(() => sailing.setSail(), 0); return []; } }]]];
  if (v.hp < H.hp) { const cost = Math.ceil((H.hp - v.hp) * 4); opts.push([`Patch the hull (${cost} coins).`, [{ run: () => { if (player.gold < cost) return [['npc', 'Not enough coin for the timber.']]; player.gold -= cost; v.hp = H.hp; markDirty(); return [['npc', 'Good as new.']]; } }]]); }
  if (v.crew < CREW_MAX) opts.push([`Hire a deckhand (${CREW_COST} coins).`, [{ run: () => { if (player.gold < CREW_COST) return [['npc', 'Deckhands want paying up front.']]; player.gold -= CREW_COST; v.crew++; markDirty(); return [['npc', `A strong back for the guns. ${v.crew} aboard; each one reloads the broadsides faster.`]]; } }]]);
  if (next) {
    const reqTxt = Object.entries(next.req).map(([k, l]) => `${k} ${l}`).join(', '), mats = next.mats.map(([i, q]) => `${q} ${i}`).join(', ');
    opts.push([`Upgrade to a ${next.name} (${next.cost} coins, ${mats}).`, [{ run: () => {
      for (const [k, l] of Object.entries(next.req)) if (skills[k].level < l) return [['npc', `You'll need ${reqTxt} to help me build a ${next.name}.`]];
      if (player.gold < next.cost) return [['npc', `That's ${next.cost} coins.`]];
      for (const [i, q] of next.mats) if (countItem(i) < q) return [['npc', `Bring me ${mats}.`]];
      player.gold -= next.cost; for (const [i, q] of next.mats) removeItem(player, i, q);
      v.hull++; v.hp = next.hp; giveXP('Smithing', next.n * 300); giveXP('Crafting', next.n * 300); markDirty();
      return [['npc', `There she is: a ${next.name}. ${next.guns} guns a side and a tougher hull.`]];
    } }]]);
  }
  const rec = COMPANIONS.filter(c => player.companions[c.id] && player.companions[c.id].recruited && OFFICERS[c.id]);
  if (rec.length) opts.push(['Appoint officers.', [['npc', 'Companions sworn to you can serve as officers. They only help while they travel with you.'], { choose: rec.map(c => [`${v.officers.includes(c.id) ? 'Stand down' : 'Appoint'} ${c.name} (${OFFICERS[c.id].trait}: ${OFFICERS[c.id].desc})`, [{ run: () => { v.officers = v.officers.includes(c.id) ? v.officers.filter(o => o !== c.id) : [...v.officers, c.id]; markDirty(); return [['npc', 'Done.']]; } }]]) }]]);
  opts.push(['Goodbye.', []]);
  out.push({ choose: opts });
  return out;
}
function countItem(it) { return player.inventory[it] || 0; }
// ---- Hunt tasks (tasks.js): Huntmaster Corvane, Port Sarim ----
player.tasks = normalizeTasks(player.tasks);
player.house = normalizeHouse(player.house);
player.arena = normalizeArena(player.arena);
// ---- The Proving Grounds (Phase 5): duel a bot that copies your loadout in an instanced ring ----
let arenaG = null, arenaGate = null, duellist = null, duel = null;
function buildArena() {
  if (arenaG) return; instanceFloor();
  const G = new THREE.Group(); G.position.set(ARENA.x, 0, ARENA.z); G.name = 'proving-grounds'; scene.add(G); arenaG = G;
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.r, ARENA.r, 0.2, 40), plainMat(0xb8a078)); sand.position.y = -0.1; G.add(sand);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.r + 0.4, ARENA.r + 0.4, 1.6, 40, 1, true), new THREE.MeshLambertMaterial({ color: 0x6a5a4a, side: THREE.DoubleSide })); wall.position.y = 0.8; G.add(wall);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.3), plainMat(0x4a3220)); gate.position.y = 1.2;
  arenaGate = instNode(G, ARENA.gate.x, ARENA.gate.z, gate, { type: 'cave', verb: 'Leave', name: 'Gate (leave)', examine: 'Leaving mid-duel counts as a loss.', dest: { x: 128, z: -31 }, leave: 'You leave the Proving Grounds.', forfeit: true });
  if (gfx.quality !== 'low') for (const a of [0.8, 2.4, 3.9, 5.5]) { const L = new THREE.PointLight(0xffa050, 5, 18, 1.2); L.position.set(Math.cos(a) * (ARENA.r - 1), 3, Math.sin(a) * (ARENA.r - 1)); L.name = 'arena-light-high'; G.add(L); }
}
function myDuelStats() {
  const rangedW = isRangedWeapon(player.equipment.weapon);
  return { maxHp: player.maxHp, maxHit: Math.round(playerMaxHit(player, skills) * 0.4), att: Math.round((rangedW ? skills.Ranged.level : skills.Attack.level) * 0.8), def: Math.round(skills.Defence.level * 0.8), cb: combatLevel(skills), ranged: rangedW };
}
function startDuel(opp) {
  buildArena();
  if (!inInstance(pm.mesh.position.x)) player.instanceReturn = { x: pm.mesh.position.x, z: pm.mesh.position.z };
  arenaGate.dest = player.instanceReturn || { x: 128, z: -31 };
  const st = duellistStats(myDuelStats(), opp.rating), bx = { minX: ARENA.x - ARENA.r + 1, maxX: ARENA.x + ARENA.r - 1, minZ: ARENA.z - ARENA.r + 1, maxZ: ARENA.z + ARENA.r - 1 };
  if (!duellist) duellist = spawnMonster('Duellist', ARENA.x, ARENA.z - 6, 1, bx);
  const m = duellist; Object.assign(m, st, { name: opp.name, title: `${opp.name} (rating ${opp.rating})`, maxHp: st.hp, alive: true, dying: false, state: 'idle', respawnAt: 0, spawnX: ARENA.x, spawnZ: ARENA.z - 6, stunUntil: 0, venom: null });
  m.mesh.visible = true; m.mesh.rotation.set(0, 0, 0); m.mesh.position.set(ARENA.x, 0, ARENA.z - 6);
  duel = { opp, at: tick };
  travelTo(ARENA.x, ARENA.z + 6); player.hp = player.maxHp;
  log(`The Proving Grounds: ${opp.name} (rating ${opp.rating}) copies your loadout. Fight!`, 'warn');
  setTimeout(() => { if (duel && m.alive) { m.state = 'fight'; m.nextAttackTick = tick + 2; } }, 1200);
  markDirty();
}
function arenaResult(win, forfeit = false) {
  if (!duel) return; const A = player.arena, opp = duel.opp; duel = null;
  const d = rateDuel(A, opp.rating, win);
  if (win) gainRep('watch', 10);
  log(win ? `You beat ${opp.name}! Rating ${A.rating} (+${d}), +${ARENA_RULES.winTokens} arena tokens.` : `${forfeit ? 'You forfeit' : `${opp.name} wins`}. Rating ${A.rating} (${d}), +${ARENA_RULES.lossTokens} arena tokens.`, win ? 'loot' : 'warn', win ? '#ffd700' : undefined);
  if (duellist) { duellist.alive = false; duellist.state = 'dead'; duellist.respawnAt = 0; if (!win) duellist.mesh.visible = false; }
  stopAction(); queuedAbility = null;
  if (!forfeit) setTimeout(() => { const r = player.instanceReturn || { x: 128, z: -31 }; travelTo(r.x, r.z); if (duellist) duellist.mesh.visible = false; }, win ? 1800 : 300);
  markDirty();
}
function arenaTalk() {
  const A = player.arena, w = weekNo(Date.now()), roll = weekRoll(A, Date.now()), say = t => [['npc', t]];
  if (roll) log(`New ladder week. Last week you placed #${roll.rank}: +${roll.pay} arena tokens.`, 'loot', '#ffd700');
  const rank = rankOf(A, w), top = ladder(w).slice(0, 3).map((e, i) => `${i + 1}. ${e.name} ${e.rating}`).join(', ');
  const shop = ARENA_SHOP.map(s => [`${s.name} (${s.cost} tokens)${s.rank ? `: ladder top ${s.rank}` : ''}`, [{ run: () => {
    if (A.tokens < s.cost) return say(`That's ${s.cost} tokens. You have ${A.tokens}.`);
    if (s.rank && rank > s.rank) return say(`Only the top ${s.rank} on this week's ladder may buy that. You're #${rank}.`);
    if (s.item && !canAdd(player, s.item, 1)) return say('Make room in your pack first.');
    A.tokens -= s.cost; if (s.item) addItem(player, s.item, 1); if (s.rep) gainRep(s.rep[0], s.rep[1]);
    if (s.xp) { const low = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic'].sort((a, b) => skills[a].xp - skills[b].xp)[0]; giveXP(low, s.xp); }
    markDirty(); return say(`${s.name}: ${s.desc}`);
  } }]]);
  return [['npc', `Sefa, arenamaster. Rating ${A.rating} (best ${A.best}), #${rank} on this week's ladder. ${A.wins} wins, ${A.losses} losses, ${A.tokens} tokens. Leaders: ${top}.`],
    { choose: [['Find me a duel.', [{ run: () => { const o = pickOpponent(A, w); setTimeout(() => startDuel(o), 50); return []; } }]], ['Show me the token shop.', [{ choose: [...shop, ['Never mind.', []]] }]], ['Goodbye.', []]] }];
}
// ---- Hearthstead (Phase 5): an instanced home plot. Low gets plain boxes; High adds two warm lights (capped). ----
let hearthG = null, hearthDyn = null, instFloor = null;
const hearthNodes = {};
const plainMat = c => new THREE.MeshLambertMaterial({ color: c });
function instanceFloor() {
  if (instFloor) return;
  instFloor = new THREE.Mesh(new THREE.PlaneGeometry(260, 460), plainMat(0x26221e)); instFloor.rotation.x = -Math.PI / 2;
  instFloor.position.set(-1000, -0.06, -100); instFloor.name = 'instance-floor'; scene.add(instFloor);
}
function instNode(group, x, z, mesh, data) {
  mesh.position.set(x - group.position.x, mesh.position.y, z - group.position.z); group.add(mesh); pickables.push(mesh);
  const ent = Object.assign({ mesh, alive: true, x, z, radius: 1.3 }, data); mesh.userData.entity = ent; nodes.push(ent); return ent;
}
function buildHearth() {
  if (hearthG) return; instanceFloor();
  const G = new THREE.Group(); G.position.set(HEARTH.x, 0, HEARTH.z); G.name = 'hearthstead'; scene.add(G); hearthG = G;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(HEARTH.hw * 2, 0.2, HEARTH.hd * 2), plainMat(0x6a5440)); fl.position.y = -0.1; G.add(fl);
  const wm = plainMat(0x8a7a64);
  for (const [w, d, x, z] of [[HEARTH.hw * 2, 0.4, 0, -HEARTH.hd], [HEARTH.hw * 2, 0.4, 0, HEARTH.hd], [0.4, HEARTH.hd * 2, -HEARTH.hw, 0], [0.4, HEARTH.hd * 2, HEARTH.hw, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wm); m.position.set(x, 1.5, z); G.add(m); }
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.1, 8), plainMat(0x8a8aa0)); stone.position.y = 0.55;
  hearthNodes.stone = instNode(G, HEARTH.stone.x, HEARTH.stone.z, stone, { type: 'hearth', hearth: 'stone', name: 'Hearthstone', examine: 'The heart of your Hearthstead. Use it to build rooms and furniture.' });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), plainMat(0x4a3220)); door.position.y = 1.2;
  hearthNodes.door = instNode(G, HEARTH.door.x, HEARTH.door.z, door, { type: 'cave', verb: 'Leave', name: 'Door (exit)', examine: 'Back out to Brightwater.', dest: { x: -14, z: 22 }, leave: 'You step out of your Hearthstead.' });
  hearthDyn = new THREE.Group(); G.add(hearthDyn);
  refreshHearth();
}
function refreshHearth() {
  if (!hearthDyn) return;
  for (const c of [...hearthDyn.children]) { hearthDyn.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const H = player.house;
  for (const r of ROOMS) {
    const built = H.rooms.includes(r.id), [rx, rz] = r.pos;
    const patch = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 6.5), plainMat(built ? r.color : 0x4a4038)); patch.position.set(rx, 0.03, rz); hearthDyn.add(patch);
    if (!built) continue;
    FURNITURE.filter(f => f.room === r.id && H.furniture.includes(f.id)).forEach((f, i) => {
      const [w, h, d] = f.size, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plainMat(f.skill === 'Smithing' ? 0x6a6a72 : 0x8a6a42));
      m.position.set(rx + (i ? 2.4 : -2.4), h / 2, rz + (rz < 0 ? -1.8 : 1.8)); m.name = 'hearth-furn'; hearthDyn.add(m);
    });
    if (r.id === 'trophy') H.trophies.forEach((t, i) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 6), plainMat(0xe0d0a0)); m.position.set(rx - 2 + i * 2, 1.35, rz + 2.6); m.name = 'hearth-trophy'; hearthDyn.add(m); const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), plainMat(0x5a4a3a)); b.position.set(rx - 2 + i * 2, 0.5, rz + 2.6); hearthDyn.add(b); });
  }
  if (gfx.quality !== 'low') for (const [x, z] of [[-5, 0], [5, 0]]) { const L = new THREE.PointLight(0xffb070, 6, 16, 1.2); L.position.set(x, 2.6, z); L.name = 'hearth-light-high'; hearthDyn.add(L); }
}
function travelTo(x, z) {
  pm.target = null; pm.goal = null; pm.mesh.position.set(x, terrainHeight(x, z), z);
  if (rig.fx !== undefined) { rig.fx = x; rig.fz = z; }
}
function enterHearth() {
  buildHearth(); refreshHearth();
  if (!inInstance(pm.mesh.position.x)) player.instanceReturn = { x: pm.mesh.position.x, z: pm.mesh.position.z };
  hearthNodes.door.dest = player.instanceReturn || { x: -14, z: 22 };
  travelTo(HEARTH.door.x, HEARTH.door.z - 1.5);
  log('You step into your Hearthstead.', 'game'); markDirty();
}
function countAll(it) { return (player.inventory[it] || 0) + ((player.bank || {})[it] || 0); }
function takeAll(it, n) { const a = Math.min(n, player.inventory[it] || 0); if (a) removeItem(player, it, a); n -= a; if (n > 0) { player.bank[it] -= n; if (player.bank[it] <= 0) delete player.bank[it]; } }
const costText = (gold, items) => [gold ? gold.toLocaleString() + ' coins' : '', ...items.map(([i, n]) => `${n} ${i}`)].filter(Boolean).join(', ');
function payCost(gold, items) {
  if (player.gold < gold) return `You need ${gold.toLocaleString()} coins.`;
  const miss = items.find(([i, n]) => countAll(i) < n); if (miss) return `You need ${miss[1]} ${miss[0]} (pack or bank).`;
  player.gold -= gold; for (const [i, n] of items) takeAll(i, n); return null;
}
function hearthTalk(ent) {
  const H = player.house, say = t => [['npc', t]];
  if (ent.hearth === 'agent') {
    if (!H.deed) return [['npc', `Oswin, deedwarden. There's a plot behind Brightwater going spare: walls, a floor, room for a workshop, a garden, a trophy hall and quarters for your companions. The deed is ${DEED_COST.toLocaleString()} coins.`],
      { choose: [[`Buy the deed (${DEED_COST.toLocaleString()} coins).`, [{ run: () => { if (player.gold < DEED_COST) return say(`${DEED_COST.toLocaleString()} coins, friend.`); player.gold -= DEED_COST; H.deed = true; markDirty(); log('You now own a Hearthstead.', 'loot', '#ffd700'); return say('Signed and sealed. Talk to me any time and I\'ll walk you home.'); } }]], ['Not today.', []]] }];
    return [['npc', 'Your Hearthstead is waiting.'], { choose: [['Take me home.', [{ run: () => { setTimeout(enterHearth, 50); return []; } }]], ['Goodbye.', []]] }];
  }
  const opts = [];
  const unbuilt = ROOMS.filter(r => !H.rooms.includes(r.id));
  if (unbuilt.length) opts.push(['Build a room.', [{ choose: [...unbuilt.map(r => [`${r.name}: ${costText(r.gold, r.items)}`, [{ run: () => { const e = payCost(r.gold, r.items); if (e) return say(e); H.rooms.push(r.id); refreshHearth(); markDirty(); log(`You build the ${r.name}. ${r.desc}.`, 'game', '#7fd4ff'); return say(`${r.name} built: ${r.desc}.`); } }]]), ['Never mind.', []]] }]]);
  const furn = FURNITURE.filter(f => H.rooms.includes(f.room) && !H.furniture.includes(f.id));
  if (furn.length) opts.push(['Make furniture.', [{ choose: [...furn.map(f => [`${f.name} (${f.skill} ${f.level}): ${costText(0, f.items)}`, [{ run: () => {
    if (skills[f.skill].level < f.level) return say(`You need ${f.skill} level ${f.level}.`);
    const e = payCost(0, f.items); if (e) return say(e);
    H.furniture.push(f.id); giveXP(f.skill, f.xp); refreshHearth(); markDirty(); return say(`You make and place the ${f.name}. ${f.desc}.`);
  } }]]), ['Never mind.', []]] }]]);
  if (hasRoom(H, 'garden')) opts.push(['Harvest the herb garden.', [{ run: () => { const n = takeHarvest(H, Date.now()); if (!n) return say('Nothing is ready yet. The garden gives herbs every 12 hours.'); player.bank['Grimy guam leaf'] = (player.bank['Grimy guam leaf'] || 0) + n; giveXP('Herblore', n * 10); markDirty(); return say(`You pick ${n} Grimy guam leaves. They go to your bank.`); } }]]);
  if (hasRoom(H, 'quarters')) opts.push(['Visit the companion quarters.', [{ run: () => { const n = takeBondDay(H, Date.now()); const rec = COMPANIONS.filter(c => player.companions[c.id].recruited); if (!n || !rec.length) return say(rec.length ? 'Your companions are resting. Come back tomorrow.' : 'The bunks are empty. Recruit a companion first.'); for (const c of rec) addBond(player, c.id, n); markDirty(); return say(`${rec.map(c => c.short).join(', ')} share a meal by the stove. (+${n} Bond each)`); } }]]);
  opts.push(['Goodbye.', []]);
  const rooms = H.rooms.length ? H.rooms.map(id => ROOMS.find(r => r.id === id).name).join(', ') : 'no rooms yet';
  return [['npc', `Your Hearthstead: ${rooms}. Furniture ${H.furniture.length}/${FURNITURE.length}. Trophies: ${H.trophies.length ? H.trophies.map(b => BOSS_TROPHIES[b]).join(', ') : 'none yet (slay a boss)'}.`], { choose: opts }];
}
function huntKill(name) {
  const T = player.tasks, r = taskKill(T, name); if (!r) return;
  const c = T.cur;
  if (!r.done) { if (c.got % 5 === 0 || c.n - c.got <= 3) log(`Hunt task: ${c.got}/${c.n} ${c.mon}.`, 'game'); markDirty(); return; }
  log(`Hunt task complete! +${r.pts} Hunt points (${T.points} total, streak ${T.streak}). See Huntmaster Corvane in Port Sarim for another.`, 'loot');
  if (isDrowned(name)) gainRep('drowned', TASK.drownedRep);
  T.cur = null; markDirty();
}
function huntBonus(mon) {
  const T = player.tasks; let b = 0;
  if (T.cur && T.cur.mon === mon.name && T.unlocks.includes('insight')) b += 0.1;
  if (mon.boss) b += houseBossDamage(player.house); // Hearthstead trophy hall
  if (mon.drowned) { if (T.unlocks.includes('reefbane')) b += 0.15; if (player.equipment.neck === 'Reefward amulet') b += 0.08; }
  return b;
}
function huntTalk() {
  const T = player.tasks, cb = combatLevel(skills), dTier = tierOf(repOf(player, 'drowned'));
  const say = t => [['npc', t]];
  const opts = [];
  if (!T.cur) opts.push(['I need a task.', [{ run: () => { const c = assignTask(T, cb); markDirty(); return say(`Hunt down ${taskLabel(c)}.${isDrowned(c.mon) ? ' The Drowned Crew walk the reef south of the Sound. Every one you put down, they fear you more.' : ''}`); } }]]);
  else {
    opts.push([`Skip this task (${TASK.skipCost} points).`, [{ run: () => { if (T.points < TASK.skipCost) return say(`That's ${TASK.skipCost} points. You have ${T.points}.`); T.points -= TASK.skipCost; T.streak = 0; const c = assignTask(T, cb); markDirty(); return say(`Fine. Hunt ${taskLabel(c)} instead. Your streak starts over.`); } }]]);
    if (T.blocked.length < TASK.maxBlocks) opts.push([`Never give me ${T.cur.mon} again (${TASK.blockCost} points).`, [{ run: () => { if (T.points < TASK.blockCost) return say(`Blocking costs ${TASK.blockCost} points.`); T.points -= TASK.blockCost; T.blocked.push(T.cur.mon); const c = assignTask(T, cb); markDirty(); return say(`Struck from my ledger. Now hunt ${taskLabel(c)}.`); } }]]);
    if (!T.extended.includes(T.cur.mon)) opts.push([`Give me longer ${T.cur.mon} tasks (${TASK.extendCost} points).`, [{ run: () => { if (T.points < TASK.extendCost) return say(`Extending costs ${TASK.extendCost} points.`); T.points -= TASK.extendCost; T.extended.push(T.cur.mon); T.cur.n = Math.round(T.cur.n * 1.5); markDirty(); return say(`Longer hunts, bigger rewards: ${T.cur.mon} tasks are half again as long and pay 30% more. This one is now ${T.cur.n}.`); } }]]);
  }
  if (T.blocked.length) opts.push(['Unblock everything.', [{ run: () => { T.blocked = []; markDirty(); return say('Ledger wiped clean.'); } }]]);
  const shopLines = HUNT_SHOP.map(s => {
    const lock = s.drowned && dTier < s.drowned, own = s.unlock && T.unlocks.includes(s.id);
    return [`${own ? '✔ ' : lock ? '🔒 ' : ''}${s.name} (${s.cost} pts)${lock ? `: needs ${TIERS[s.drowned][1]} with the Drowned Crew` : ''}`, [{ run: () => {
      if (own) return say('You already have that.');
      if (lock) return say(`The Drowned Crew don't fear you enough yet. Reach ${TIERS[s.drowned][1]} with them first.`);
      if (T.points < s.cost) return say(`${s.name} costs ${s.cost} points. You have ${T.points}.`);
      if (s.item && !canAdd(player, s.item, s.qty || 1)) return say('Make room in your pack first.');
      T.points -= s.cost;
      if (s.unlock) T.unlocks.push(s.id);
      if (s.item) addItem(player, s.item, s.qty || 1);
      if (s.xp) { const low = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic'].sort((a, b) => skills[a].xp - skills[b].xp)[0]; giveXP(low, s.xp); }
      markDirty(); return say(`${s.name}: ${s.desc}`);
    } }]];
  });
  opts.push(['Show me the points shop.', [{ choose: [...shopLines, ['Never mind.', []]] }]]);
  opts.push(['Goodbye.', []]);
  return [['npc', `Corvane, huntmaster. ${T.cur ? `Your task: ${T.cur.got}/${T.cur.n} ${T.cur.mon}.` : 'No task on you.'} Points: ${T.points}, streak ${T.streak}, ${T.done} done. Drowned Crew standing: ${TIERS[dTier][1]}.`], { choose: opts }];
}
const grimyHerbs = () => Object.keys(player.inventory).filter(k => /^Grimy /.test(k));
function harbourTalk(ent) {
  const v = player.vessel, i = islandAt(ent.x, ent.z, 4);
  const opts = [];
  if (sailing.moored) opts.push(['Ready my ship.', [{ run: () => { sailing.reboard(); return []; } }]]);
  opts.push(['Ferry me back to Port Sarim (30 coins).', [{ run: () => { if (player.gold < 30) return [['npc', "Thirty coins, or swim."]]; player.gold -= 30; setTimeout(() => sailing.homeToSarim('The harbour launch drops you on the Port Sarim docks. Your ship is towed home.'), 0); return []; } }]]);
  opts.push(['Goodbye.', []]);
  return [['npc', `Welcome to ${i ? i.name : 'port'}. ${i ? i.desc : ''} Mind the Drowned Crew south at Wreckers' Reef.`], { choose: opts }];
}
function seaTalk(ent) {
  const face = ent.sea === 'tasks' ? '💀' : ent.sea === 'hexer' ? '🪲' : ent.sea === 'shipwright' ? '⚓' : ent.sea === 'harbour' ? '⚓' : '🃏';
  let script;
  if (ent.sea === 'shipwright') script = shipwrightTalk();
  else if (ent.sea === 'tasks') script = huntTalk();
  else if (ent.sea === 'harbour') script = harbourTalk(ent);
  else if (ent.sea === 'hexer') script = hexerTalk();
  else if (ent.sea === 'crown' || ent.sea === 'tides') { cardsUI.open(ent.sea, ent.name); return; }
  ui.dialogue(ent.name, face, script, () => markDirty());
}
// ---- Hexcraft: Mama Sorrel brews hex runes and sells her wares ----
function hexerTalk() {
  const brew = (rune, from, xp) => [{ run: () => {
    const ess = countItem('Rune essence') + countItem('Pure essence'); const src = from === 'Bones' ? countItem('Bones') : grimyHerbs().reduce((n, k) => n + countItem(k), 0);
    const n = Math.min(ess, src, 10); if (!n) return [['npc', from === 'Bones' ? 'Bring me Bones and Rune essence, child.' : 'Bring me grimy herbs from the bog and Rune essence.']];
    for (let k = 0; k < n; k++) { if (!removeItem(player, 'Rune essence', 1)) removeItem(player, 'Pure essence', 1); if (from === 'Bones') removeItem(player, 'Bones', 1); else removeItem(player, grimyHerbs()[0], 1); }
    addItem(player, rune, n * 3); giveXP('Runecrafting', n * xp); giveXP('Magic', n * xp * 0.5); markDirty();
    return [['npc', `There: ${n * 3} ${rune}s. Hexes take from the bog and the grave; mind what you curse.`]];
  } }];
  return [['npc', "Ah, a seeker. I am Mama Sorrel. Hexcraft is old magic of bog and bone: rotting, binding, withering and leeching hexes. Open your Spellbook to cast them."],
    { choose: [["Let's trade.", [{ run: () => invUI.open('hexer') }]], ['Brew Bog runes (Rune essence + grimy herbs).', brew('Bog rune', 'herb', 6)], ['Brew Bone runes (Rune essence + Bones).', brew('Bone rune', 'Bones', 9)], ['Goodbye.', []]] }];
}
// ---- Treasure charts: read one to mark a dig spot; dig there with a Spade ----
const CHART_SPOTS = { gullrest: [[0.55, 0.2], [-0.5, 0.35], [0.2, 0.6]], brineholt: [[-0.55, -0.45], [0.55, -0.2], [0.35, 0.6]], reef: [[0.6, -0.4], [-0.6, -0.1], [0.3, 0.55]] };
function nearChart() { const p = pm.mesh.position; return !!(player.vessel && player.vessel.charts.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 6)); }
function readChart() {
  const v = player.vessel; if (v.charts.length >= 5) { log('You already carry five marked spots. Dig some up first.', 'warn'); return; }
  if (!removeItem(player, 'Treasure chart', 1)) return;
  const isl = ISLANDS[Math.floor(Math.random() * ISLANDS.length)], sp = CHART_SPOTS[isl.id][Math.floor(Math.random() * 3)];
  const tier = isl.id === 'reef' ? 3 : Math.random() < 0.3 ? 2 : 1;
  v.charts.push({ x: isl.x + sp[0] * isl.r, z: isl.z + sp[1] * isl.r, isl: isl.id, tier });
  log(`The chart shows an X on ${isl.name}. It's marked on your map (M).`, 'game'); markDirty();
}
function digHere() {
  if (!ownsToolType(player, 'spade')) { log('You need a Spade on your toolbelt. The Gullrest Chandlery sells them.', 'warn'); return; }
  const p = pm.mesh.position, v = player.vessel, c = v.charts.find(c => Math.hypot(c.x - p.x, c.z - p.z) < 3);
  pm.actionAnim = 1; pm.actionKind = 'melee';
  if (!c) { log(v.charts.length ? 'Nothing here. The X must be somewhere else.' : 'You dig a hole, but find nothing. Treasure charts show where to dig.', 'game'); return; }
  v.charts.splice(v.charts.indexOf(c), 1); v.dug++;
  const g = [0, 400, 1100, 2600][c.tier] + Math.floor(Math.random() * 400 * c.tier);
  player.gold += g; burst('dust', p.x, p.y, p.z, 14);
  const gems = ['Uncut sapphire', 'Uncut emerald', 'Uncut ruby', 'Uncut diamond'].filter(n => ITEMS[n]);
  const gem = gems[Math.min(gems.length - 1, Math.floor(Math.random() * (c.tier + 1)))];
  if (gem) giveItem(gem);
  if (c.tier >= 2 && Math.random() < 0.5) giveItem('Silver shot', 15);
  if (c.tier === 3 && Math.random() < 0.08) giveItem("Saltgrave's tricorn");
  log(`You dig up a buried chest: ${g} coins${gem ? ' and an ' + gem.toLowerCase() : ''}!`, 'loot'); giveXP('Crafting', 40 * c.tier); markDirty();
}
// ---- The Wanderer's Saga: Chronicler Corwin tells your story; choices are remembered ----
player.saga = normalizeSaga(player.saga);
function sagaGate(ch) { const t = totalLevel(skills), q = questPoints(player); return t >= ch.req.total && q >= ch.req.qp ? null : `You'll need total level ${ch.req.total} and ${ch.req.qp} quest points (you have ${t} and ${q}).`; }
function sagaApply(fx) {
  const sg = player.saga;
  if (fx.flag) sg.flags[fx.flag] = true;
  if (fx.gold) player.gold += fx.gold;
  if (fx.rep) gainRep(fx.rep[0], fx.rep[1]);
  if (fx.xp) giveXP(fx.xp[0], fx.xp[1]);
}
function sagaCompanionTest(tone) {
  const id = player.activeCompanion, d = id && companionById(id); if (!d) return null;
  const s = compState(id);
  if (tone === d.likes) { addBond(player, id, 2); return `${d.short} nods firmly. That's what they'd have done. (Bond ${s.bond}/${BOND_MAX})`; }
  addBond(player, id, -2);
  if (s.bond <= 0) { s.recruited = false; s.started = false; s.task = 0; player.saga.flags['left_' + id] = true; setCompanion(null); refreshQuick(); return `${d.short} shakes their head. "I can't follow someone who'd do that." ${d.short} leaves your side.`; }
  return `${d.short} frowns. They didn't like that. (Bond ${s.bond}/${BOND_MAX})`;
}
function sagaFinish(ch, tone, fx) {
  const sg = player.saga;
  sg.choices.push({ ch: ch.n, tone }); sg.ch++; sg.active = false; sg.prog = 0;
  sagaApply(fx);
  const m = ch.companionTest ? sagaCompanionTest(tone) : null;
  if (m) log(m, 'game');
  log(`Saga: chapter ${ch.n}, "${ch.title}", complete.`, 'skill', '#ffd700');
  markDirty();
}
function sagaTalk() {
  const sg = player.saga, ch = currentChapter(sg);
  if (!ch) return [['npc', sg.title ? `Your story is written, Wanderer ${sg.title}. I read it often.` : 'Your story is written.']];
  if (!sg.active) {
    const g = sagaGate(ch);
    if (g) return [['npc', `Chapter ${ch.n}, "${ch.title}", waits for you. ${g}`]];
    const start = { run: () => { sg.active = true; sg.prog = 0; log(`Saga, chapter ${ch.n}: ${ch.obj.text}.`, 'game'); markDirty(); } };
    if (ch.n === 1 && !sg.calling) return [['npc', 'I am Corwin, and I write down the stories worth keeping. Yours begins today.'], ...ch.intro.map(t => ['npc', t]), ['npc', 'First: who are you, on the road?'],
      { choose: Object.entries(CALLINGS).map(([k, c]) => [`${c.icon} ${c.name}: ${c.desc}`, [{ run: () => { sg.calling = k; log(`You are a ${c.name}. ${c.desc}. Track your story in Bonds (B) → Saga.`, 'skill'); refreshQuick(); markDirty(); } }, start, ['npc', `A ${c.name}, then. ${ch.obj.text}.`]]]) }];
    return [...ch.intro.map(t => ['npc', t]), start, ['npc', `${ch.obj.text}.`]];
  }
  const need = objNeed(ch, sg);
  if (ch.obj.kind === 'item') {
    if ((player.inventory[ch.obj.item] || 0) < need) return [['npc', `${ch.obj.text}${need < ch.obj.n ? ` (Varro found most of it; you need only ${need})` : ''}. You have ${player.inventory[ch.obj.item] || 0}.`]];
  } else if (sg.prog < need) return [['npc', `${ch.obj.text}: ${sg.prog}/${need}.`]];
  const take = { run: () => { if (ch.obj.kind === 'item') removeItem(player, ch.obj.item, need); } };
  if (ch.finale) {
    const t = endingTone(sg), e = ENDINGS[t];
    const extra = [sg.flags.mercy && 'The goblin you once let go slips through the bars and picks Aldric\'s lock.', sg.flags.varro && 'Varro is there too, holding the door. "I said I owed you."', sg.flags.ashfordFriend && 'Ashford sends blankets and bread for the road home.'].filter(Boolean);
    return [take, ['npc', ch.done], ...extra.map(x => ['npc', x]), ['npc', e.say], { run: () => {
      sg.title = e.title; sg.choices.push({ ch: ch.n, tone: t }); sg.ch++; sg.active = false; sg.prog = 0;
      player.gold += 2000; const c = CALLINGS[sg.calling]; if (c) giveXP(c.skills[0], 5000);
      log(`The Wanderer's Saga is complete. You are now known as ${e.title}. (+2000 coins, +5000 ${c ? c.skills[0] : ''} XP)`, 'skill', '#ffd700'); markDirty();
    } }];
  }
  return [take, ['npc', ch.done], { wheel: ch.wheel.map(([tone, label, fx]) => [tone, label, [['npc', fx.say], { run: () => sagaFinish(ch, tone, fx) }]]) }];
}
// Saga goal markers for the minimap and world map: where to go for the current chapter.
const SAGA_ITEM_SOURCE = { Cowhide: 'Cow' };
function sagaMarks() {
  const sg = player.saga, ch = currentChapter(sg), c = nodes.find(n => n.saga); if (!ch || !c) return [];
  const corwin = { x: c.x, z: c.z, label: `Saga: talk to Chronicler Corwin (chapter ${ch.n})` };
  if (!sg.active) return sagaGate(ch) ? [] : [corwin];
  const need = objNeed(ch, sg), p = pm.mesh.position;
  const have = ch.obj.kind === 'item' ? (player.inventory[ch.obj.item] || 0) : sg.prog;
  if (have >= need) return [{ ...corwin, label: 'Saga: return to Chronicler Corwin' }];
  const mon = ch.obj.kind === 'kill' ? ch.obj.mon : SAGA_ITEM_SOURCE[ch.obj.item];
  if (mon) {
    let best = null, bd = Infinity;
    for (const m of monsters) if (m.name === mon && m.alive !== false) { const d = Math.hypot(m.mesh.position.x - p.x, m.mesh.position.z - p.z); if (d < bd) { bd = d; best = m; } }
    if (best) return [{ x: best.mesh.position.x, z: best.mesh.position.z, label: `Saga: ${ch.obj.text} (${have}/${need})` }];
  }
  const src = nodes.find(n => n.type === 'rock' && ch.obj.item && /essence/i.test(ch.obj.item) && /essence/i.test(n.name || ''));
  if (src) return [{ x: src.x, z: src.z, label: `Saga: ${ch.obj.text} (${have}/${need})` }];
  return [{ ...corwin, label: `Saga: ${ch.obj.text} (${have}/${need})` }];
}
function sagaKill(name) {
  const sg = player.saga, ch = currentChapter(sg);
  if (ch && sg.active && ch.obj.kind === 'kill' && ch.obj.mon === name && sg.prog < objNeed(ch, sg)) { sg.prog++; log(`Saga: ${sg.prog}/${objNeed(ch, sg)} ${name}s.`, 'game'); markDirty(); }
}
// ---- Errand Ledger and the Bonds panel ----
player.errands = Array.isArray(player.errands) ? player.errands : [];
function awayUntil(id) { const r = player.errands.find(e => e.comp === id); return r ? r.end : 0; }
function finishErrands() {
  const done = collectErrands(player, Date.now());
  for (const r of done) {
    const e = errandById(r.id), c = companionById(r.comp); if (!e || !c) continue;
    const lvl = crewOf(player, r.comp, e.skill), tr = crewTrain(player, r.comp, e.skill, r.ok ? e.xp : e.xp / 4);
    if (tr.after > tr.before) log(`${c.short}'s ${e.skill} crew skill is now ${tr.after}/${CREW_SKILL_MAX}.`, 'game', '#7fd4ff');
    if (!r.ok) { log(`${c.short} came back from "${e.name}" empty-handed, but learned something. (+${Math.round(e.xp / 4)} ${e.skill} XP)`, 'game'); giveXP(e.skill, e.xp / 4); continue; }
    player.bank = player.bank || {};
    const got = errandItems(e, lvl);
    for (const [it, n] of got) player.bank[it] = (player.bank[it] || 0) + n;
    giveXP(e.skill, e.xp); gainRep(e.fac, e.rep);
    log(`${c.short} finished "${e.name}": ${got.map(i => i[1] + ' ' + i[0]).join(', ')} sent to your bank (crew ${e.skill} ${lvl}).`, 'loot', '#ffd700');
  }
  if (done.length) markDirty();
  return done.length;
}
const bondsUI = createBondsUI({
  getData: () => ({
    companions: COMPANIONS.map(d => { const s = compState(d.id); return { ...d, ...s, active: player.activeCompanion === d.id, away: awayUntil(d.id), crewText: Object.keys(s.crew || {}).map(k => `${k} ${crewOf(player, d.id, k)}`).join(', '), perks: BOND_PERKS, chance: errandChance(s.bond, houseErrandBonus(player.house)), task: s.started ? compTaskText(d, s) : `Talk to ${d.short}. ${d.examine}` }; }),
    factions: FACTIONS.map(f => { const r = repOf(player, f.id), t = tierOf(r), n = nextTier(r), lo = TIERS[t][0]; return { ...f, rep: r, tier: t, tierName: TIERS[t][1], next: n, pct: n ? Math.round((r - lo) / (n - lo) * 100) : 100 }; }),
    running: player.errands.map(r => ({ ...r, name: (errandById(r.id) || {}).name || r.id, comp: (companionById(r.comp) || {}).name || r.comp })),
    errands: ERRANDS,
    saga: (() => { const sg = player.saga, ch = currentChapter(sg); return { calling: sg.calling && CALLINGS[sg.calling], title: sg.title, total: CHAPTERS.length, done: sg.ch, ch: ch && { n: ch.n, title: ch.title, active: sg.active, gate: sagaGate(ch), obj: ch.obj.text, prog: ch.obj.kind === 'kill' ? sg.prog : (player.inventory[ch.obj.item] || 0), need: objNeed(ch, sg) }, choices: sg.choices.map(c => ({ ...c, title: (CHAPTERS[c.ch - 1] || {}).title })) }; })()
  }),
  onAct: (a, o) => {
    if (a === 'follow') { if (awayUntil(o.comp)) return; setCompanion(player.activeCompanion === o.comp ? null : o.comp); }
    else if (a === 'collect') finishErrands();
    else if (a === 'send') { const r = startErrand(player, o.errand, o.comp, Date.now()); if (r) { log(`${companionById(o.comp).short} sets off: ${errandById(o.errand).name}.`, 'game'); markDirty(); } }
  }
});
function talkTo(ent) {
  if (ent.arena) { ui.dialogue(ent.name, '⚔️', arenaTalk(), () => markDirty()); return; }
  if (ent.hearth) { ui.dialogue(ent.name, ent.hearth === 'agent' ? '📜' : '🏠', hearthTalk(ent), () => markDirty()); return; }
  if (ent.sea) { seaTalk(ent); return; }
  if (ent.saga) { ui.dialogue(ent.name, '📖', sagaTalk(), () => markDirty()); return; }
  if (ent.standing) { ui.dialogue(ent.name, '📜', quartermasterTalk(), () => markDirty()); return; }
  if (ent.companion) { const d = companionById(ent.companion); compTalking = d.id; ui.dialogue(d.name, d.face, companionTalk(ent), () => { compTalking = null; markDirty(); }); return; }
  const name = ent.name;
  const face = NPC_FACE[ent.npc] || (ent.type === 'shop' ? NPC_FACE.merchant : '🙂');
  const qd = questForNpc(ent.npc, player, questHelpers);
  const side = questTalk(player, ent.npc, questHelpers);
  let script;
  if (side) { script = side; if (ent.shop) script = [...script, { choose: [["Let's trade.", [{ run: () => invUI.open(ent.shop) }]], ['Goodbye.', []]] }]; }
  else if (qd) {
    script = qd.talk(player, questHelpers);
    // Shopkeepers with quests still offer to trade afterwards.
    const sh = ent.npc === 'bob' ? 'tools' : ent.npc === 'merchant' ? 'shop' : ent.shop;
    if (sh) script = [...script, { choose: [["Let's trade.", [{ run: () => invUI.open(sh) }]], ['Goodbye.', []]] }];
  } else if (ent.bounty) {
    script = bountyTalk(ent);
  } else if (ent.say) {
    script = [['npc', ent.say]];
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
// ---- Wilds: foraging and repeatable bounties ----
function forage(ent) {
  if (!ent.alive) { log('The bush has been picked clean. Come back later.', 'warn'); return; }
  if (skills.Herblore.level < ent.level) { log(`You need a Herblore level of ${ent.level} to pick these.`, 'warn'); return; }
  if (!canAdd(player, ent.item)) { log('Your inventory is too full to hold any more.', 'warn'); return; }
  const n = 1 + (Math.random() < 0.35 ? 1 : 0);
  addItem(player, ent.item, n); giveXP('Herblore', ent.xp * n);
  log(`You pick ${n > 1 ? 'a handful of' : 'some'} ${ent.item.toLowerCase()}.`, 'skill');
  depleteNode(ent, 45000);
  markDirty();
}
function bountyTalk(ent) {
  const B = ent.bounty; player.bounties = player.bounties || {};
  const cur = player.bounties[B.id];
  const take = { run: () => { player.bounties[B.id] = { mon: B.mon, got: 0, n: B.n }; log(`Bounty started: defeat ${B.n} ${B.mon === 'Wolf' ? 'wolves' : B.mon.toLowerCase() + 's'} for ${ent.name}.`, 'game'); markDirty(); } };
  if (!cur) return [['npc', B.ask], { wheel: [
    ['kind', "Of course. Folk shouldn't have to live in fear.", [take, ['npc', 'Bless you. Come back when it is done.']]],
    ['firm', "I'll clear them out. Have the coin ready.", [take, ['npc', 'It will be here. Come back when it is done.']]],
    ['cunning', 'Maybe. What else do you know about them?', [['npc', `They come out near here. ${B.n} should thin them enough.`], { choose: [["Fine, I'll do it.", [take]], ['Not now.', [['npc', 'The offer stands.']]]] }]],
    ['neutral', 'Not now.', [['npc', 'The offer stands.']]]
  ] }];
  if (cur.got < cur.n) return [['npc', `${cur.got} of ${cur.n} so far. Keep at it.`]];
  return [['npc', 'Well done! Here is your reward. Come back any time; there are always more.'], { run: () => {
    player.gold += B.gp; for (const [sk, xp] of Object.entries(B.xp)) giveXP(sk, xp);
    delete player.bounties[B.id]; player.bountiesDone = (player.bountiesDone || 0) + 1;
    { const f = factionNear(ent.x, ent.z); if (f) gainRep(f.id, BOUNTY_REP); }
    log(`Bounty complete! You receive ${B.gp} coins and experience.`, 'loot', '#ffd700'); markDirty();
  } }];
}
function bountyKill(name) {
  if (!player.bounties) return;
  for (const b of Object.values(player.bounties)) if (b.mon === name && b.got < b.n) { b.got++; log(b.got >= b.n ? `Bounty: all ${b.n} ${name === 'Wolf' ? 'wolves' : name.toLowerCase() + 's'} defeated. Return for your reward.` : `Bounty: ${b.got}/${b.n} ${name === 'Wolf' ? 'wolves' : name.toLowerCase() + 's'}.`, 'game');  markDirty(); }
}
function updateQuestMarks() {
  for (const n of nodes) if (n.type === 'npc') n.questMark = questsForNpc(n.npc).some(x => !isDone(player, x.id));
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

// ---- Mountain cave: travel in and out, and the one-time hoard ----
function caveTravel(ent) {
  const d = ent.dest; pm.target = null; pm.goal = null;
  pm.mesh.position.x = d.x; pm.mesh.position.z = d.z; pm.mesh.position.y = terrainHeight(d.x, d.z);
  if (rig.fx !== undefined) { rig.fx = d.x; rig.fz = d.z; }
  if (ent.forfeit && duel) arenaResult(false, true);
  if (ent.leave) { log(ent.leave, 'game'); markDirty(); return; }
  log(d === CAVE.inside ? 'You climb down into the cave. Crystals glitter in the dark, and something skitters in the webs.' : 'You climb back up into the daylight.', 'game');
  markDirty();
}
function searchHoard() {
  if (player.caveLoot) { log('The hoard is empty. Only cobwebs remain.', 'game'); return; }
  const mother = monsters.find(m => m.variant === 'Brood Mother');
  if (mother && mother.alive) { log('The Brood Mother guards her hoard. Defeat her first!', 'warn'); return; }
  player.caveLoot = true;
  player.gold += 2500;
  for (const [it, q] of [['Uncut ruby', 1], ['Uncut diamond', 1], ['Mithril bar', 5], ['Coal', 10]]) if (ITEMS[it]) giveItem(it, q);
  giveXP('Mining', 800); giveXP('Thieving', 300);
  log("You search the Brood Mother's hoard and find 2,500 coins, an uncut ruby, an uncut diamond, mithril bars and coal!", 'loot', '#ffd700');
  markDirty();
}
function updateCave(dt) {
  const p = pm.mesh.position, inside = inCave(p.x, p.z);
  const G = CAVE.group; if (!G) return;
  if (caveShown !== inside) { caveShown = inside; G.userData.inner.visible = inside; G.userData.outer.visible = !inside; for (const L of G.userData.lights) L.intensity = inside ? (L.userData.base ??= L.intensity) : 0; }
  caveK += ((inside ? 1 : 0) - caveK) * Math.min(1, dt * 3);
  if (!lightBase) lightBase = { hemi: lightsRef.hemi.intensity, dir: dirLight.intensity, fill: lightsRef.fill.intensity, exp: renderer.toneMappingExposure };
  updateDay(player.settings.timeOfDay || 'cycle', window.__dayT);
  nightNeutral();
  lightsRef.hemi.intensity = lightBase.hemi * DAY.hemiK * (1 - 0.6 * caveK);
  lightsRef.hemi.color.copy(DAY.hemiCol);
  dirLight.intensity = lightBase.dir * DAY.dirK * (1 - 0.8 * caveK);
  dirLight.color.copy(DAY.lightCol);
  lightsRef.fill.intensity = lightBase.fill * DAY.fillK * (1 - 0.7 * caveK);
  renderer.toneMappingExposure = lightBase.exp * DAY.exposureK;
  sky.setNight?.(DAY.night);
  scene.fog.color.copy(DAY.fog).lerp(_caveFog, caveK);
  scene.background.copy(scene.fog.color);
}
const _caveFog = new THREE.Color(0x0c0a10);
// At night all three lights were saturated blue (moon 0x7f9cff, sky fill 0x5a6fa8, cool fill 0x9ab8ff). Saturated
// blue surfaces, above all the pale-blue Magic tree leaves (0x5aa0f0), reflected nearly all of it while green and grey
// surfaces absorbed it, so a Magic tree read as a glowing neon-blue tree in the dark. Pull the night lights toward their
// own luminance with only a slight cool tint (as the WebGPU release does); brightness is unchanged. ?bluenight keeps the old look.
const _nn = new THREE.Color(), NN_TINT = [0.92, 0.98, 1.1];
let fillBase = null;
function nightNeutral() {
  const k = DAY.night || 0, off = /bluenight/.test(location.search);
  if (!fillBase) fillBase = lightsRef.fill.color.clone();
  lightsRef.fill.color.copy(fillBase);
  if (k <= 0 || off) return;
  for (const c of [DAY.lightCol, DAY.hemiCol, lightsRef.fill.color]) {
    const L = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    _nn.setRGB(L * NN_TINT[0], L * NN_TINT[1], L * NN_TINT[2]);
    c.lerp(_nn, 0.8 * k);
  }
}
const _shaftV = new THREE.Vector3();
function updatePushers() {
  const P = PUSH.value, p = pm.mesh.position; P[0].set(p.x, p.z, 0.9, 1);
  const near = [];
  for (const m of monsters) { if (!m.alive || !m.mesh.visible) continue; const d = Math.hypot(m.mesh.position.x - p.x, m.mesh.position.z - p.z); if (d < 25) near.push([d, m]); }
  near.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < 4; i++) { const n = near[i - 1]; if (n) P[i].set(n[1].mesh.position.x, n[1].mesh.position.z, 0.6 + 0.5 * (n[1].mesh.scale.x || 1), 0.9); else P[i].w = 0; }
}
function updateShafts() {
  const U = gradePass.uniforms; _shaftV.copy(SUN_DIR).multiplyScalar(400).add(camera.position).project(camera);
  const facing = _shaftV.z < 1 ? 1 : 0, on = Math.abs(_shaftV.x) < 1.6 && Math.abs(_shaftV.y) < 1.6 ? 1 : 0;
  U.sunUV.value.set((_shaftV.x + 1) / 2, (_shaftV.y + 1) / 2);
  // strongest at golden hour, gone at night and in the cave
  const gold = 1 - Math.min(1, Math.max(0, (DAY.sunH - 0.1) / 0.5));
  U.shaftK.value = facing * on * (1 - DAY.night) * (1 - caveK) * (0.35 + 0.65 * gold) * 0.9;
  U.shaftCol.value.copy(DAY.lightCol);
}

let ammoMsg = null, pistolShot = null;
function useArrow() {
  ammoMsg = null;
  const wi = ITEMS[player.equipment.weapon];
  if (wi && wi.thrown) return true; // thrown weapons are picked back up
  if (!player.equipment.ammo || player.ammoCount <= 0) return false;
  // crossbows fire bolts, bows fire arrows
  const am = player.equipment.ammo, xbow = /crossbow/i.test(player.equipment.weapon || '');
  const pistol = !!(wi && wi.pistol), isShot = !!(ITEMS[am] && ITEMS[am].shot);
  if (pistol || isShot) {
    if (pistol && !isShot) { ammoMsg = `Your flintlock needs lead or silver shot, not ${am.toLowerCase()}.`; return false; }
    if (!pistol) { ammoMsg = `You can't fire ${am.toLowerCase()} from a bow.`; return false; }
    player.ammoCount--; if (player.ammoCount <= 0) { player.equipment.ammo = null; player.ammoCount = 0; }
    return true;
  }
  const isBolt = /bolts$/i.test(am), isArrow = /arrows?$/i.test(am);
  if (xbow && !isBolt) { ammoMsg = `Your crossbow needs bolts, not ${am.toLowerCase()}.`; return false; }
  if (!xbow && !isArrow) { ammoMsg = `Your bow needs arrows, not ${am.toLowerCase()}.`; return false; }
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
  if (a.style === 'magic') {
    if (!action || action.kind !== 'attack' || !action.spell) { log(`${a.name} is a Magic skill. Attack with a spell (set Autocast) first.`, 'warn'); return; }
    const miss = Object.entries(a.runes || {}).filter(([r, q]) => (player.inventory[r] || 0) < q);
    if (miss.length) { log(`${a.name} needs ${miss.map(([r, q]) => `${q} ${r}`).join(', ')}.`, 'warn'); return; }
  }
  const cost = adrenCost(a);
  const adr = hud ? hud.adrenaline : 0;
  if (cost && adr + 1e-6 < cost) { log(`${a.name} needs ${cost}% adrenaline (you have ${Math.floor(adr)}%). Use basic skills and land hits to build it.`, 'warn'); return; }
  const queuedNeedsTarget = !['fortify', 'rage', 'rejuv'].includes(id);
  if (queuedNeedsTarget && (!action || action.kind !== 'attack' || !action.mon.alive)) { log('Attack something first, then use that.', 'warn'); return; }
  if (hud) { if (cost) hud.spend(cost); else hud.gain(adrenGain(a) * (a.style === 'magic' ? 1 + perk(skills, 'Combat', 'magicAdren') : 1)); }
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
  const special = queuedAbility && (abilityById(queuedAbility) || {}).style !== 'magic' ? queuedAbility : null;
  if (special) queuedAbility = null;
  if (special) cooldowns[special] = tick + cooldownTicks(skills, abilityById(special));
  if (ranged) {
    pistolShot = player.equipment.ammo;
    if (!useArrow()) { log(ammoMsg || (/crossbow/i.test(player.equipment.weapon || '') ? 'You have no bolts left. Equip bolts in your ammo slot.' : 'There is no ammo left in your quiver.'), 'warn'); stopAction(); return; }
    arrowFlight = { from: pm.mesh.position.clone().setY(1.3), mon, t: 0 };
  }
  pm.actionAnim = 1; pm.actionKind = ranged ? 'bow' : 'melee'; pm.swingVar = ((pm.swingVar ?? -1) + 1 + (Math.random() < 0.3 ? 1 : 0)) % 3;
  const rage = tick < buffs.rageUntil;
  const base = { acc: rage ? 0.2 : 0, dmg: rage ? 0.2 : 0 };
  const swings = [];
  if (special === 'power') swings.push({ acc: base.acc + 0.25, dmg: base.dmg + 0.6 });
  else if (special === 'puncture') swings.push({ acc: base.acc + 0.1, dmg: base.dmg }, { acc: base.acc + 0.1, dmg: base.dmg });
  else if (special === 'bash') swings.push({ acc: base.acc + 0.3, dmg: base.dmg - 0.5 });
  else if (special === 'snipe') swings.push({ acc: base.acc + 0.3, dmg: base.dmg + 1.0 });
  else if (special === 'volley') { swings.push({ ...base, acc: base.acc - 0.15 }); for (let i = 0; i < 2; i++) if (useArrow()) swings.push({ ...base, acc: base.acc - 0.15 }); }
  else swings.push(base);
  // Sails of Sarim styles. Cutlass: every 3rd swing on the same foe adds a quick flurry cut.
  // Flintlock: slow but steady at close range; silver shot bites the undead.
  const wInfo = ITEMS[player.equipment.weapon] || {};
  if (wInfo.cutlass && !ranged) {
    pm.cutN = pm.cutMon === mon ? (pm.cutN || 0) + 1 : 1; pm.cutMon = mon;
    if (pm.cutN % 3 === 0) { swings.push({ ...base, acc: base.acc + 0.1, dmg: base.dmg - 0.3, extra: true }); log('Cutlass flurry!', 'combat'); }
  }
  if (wInfo.pistol && ranged) {
    for (const sw of swings) sw.acc = (sw.acc || 0) + 0.15;
    const sh = ITEMS[player.equipment.ammo || ''] || ITEMS[pistolShot] || {};
    if (mon.undead && sh.vsUndead) for (const sw of swings) sw.dmg = (sw.dmg || 0) + sh.vsUndead;
    const pp = pm.mesh.position; burst('dust', pp.x, pp.y + 1.2, pp.z, 6);
  }
  { const hb = huntBonus(mon); if (hb) for (const sw of swings) sw.dmg = (sw.dmg || 0) + hb; } // Hunt task / Drowned Crew bonuses
  // Dark bow: fires extra arrows every shot.
  const ge = gearEffects(player);
  if (ranged && ge.multiArrow) for (let i = 1; i < ge.multiArrow; i++) if (useArrow()) swings.push({ ...base });
  // Double Shot perk: a free second arrow now and then.
  if (ranged && !special && Math.random() < perk(skills, 'Ranged', 'doubleShot')) { swings.push(base); log('Double Shot!', 'combat'); }
  // Swift Strikes perk: sometimes your next melee swing comes a tick early.
  if (!ranged && Math.random() < perk(skills, 'Attack', 'quick')) nextPlayerAttack = Math.max(tick + 1, nextPlayerAttack - 1);
  if (special) log(`${abilityById(special).name}!`, 'combat');
  // Flow Strikes: skills landed back to back build a chain; the 3rd link adds a finisher swing.
  if (special) {
    const fl = flowOnSkillHit(flow, tick, special);
    if (fl.repeat) log('Flow holds: use a different skill to add a link.', 'combat');
    if (fl.bonus) for (const sw of swings) sw.dmg = (sw.dmg || 0) + fl.bonus;
    if (fl.links > 1 && !fl.finisher && !fl.repeat) log(`Flow x${fl.links} (+${Math.round(fl.bonus * 100)}% damage)`, 'combat');
    if (fl.finisher) {
      const fin = ranged ? FINISHER.ranged : FINISHER.melee;
      swings.push({ ...base, dmg: base.dmg + FLOW.finisher + fl.bonus + (fin.dmg || 0), acc: base.acc + 0.2 + (fin.acc || 0), finisher: ranged ? 'pierce' : 'bleed' });
      log(`${fin.name}!`, 'combat'); if (hud) hud.gain(10);
    }
    if (flow.best > (player.flowBest || 0)) player.flowBest = flow.best;
    if (hud && hud.setFlow) hud.setFlow(fl.finisher ? FLOW.maxLinks : fl.links);
  }
  let dmg = 0;
  for (let i = 0; i < swings.length && i < 6; i++) {
    const mods = { ...swings[i] };
    if (mon.hp <= 0) break;
    const d = rollPlayerHit(player, skills, mon, Math.random, mods);
    mon.hp -= d;
    dmg += d;
    if (d > 0) { mon.hitT = 1; mon.hitK = Math.min(1.4, 0.6 + d / Math.max(4, mon.maxHp * 0.25)); } else mon.blockT = 1;
    overlays.splat(mon, d, now + i * 150);
    { const mp = mon.mesh.position, k = Math.min(1, d / Math.max(4, mon.maxHp * 0.3)); const hy = mp.y + Math.min(1.1, (mon.barHeight || 2) * 0.5);
      if (d > 0) { const fire = () => { burst('hit', mp.x, hy, mp.z, 12 + Math.min(24, d * 2)); if (k > 0.5) burst('dust', mp.x, mp.y, mp.z, 5); shakeRig(rig, 0.35 + 0.45 * k); };
        if (i) setTimeout(fire, i * 150); else fire(); }
      else burst('dust', mp.x, mp.y, mp.z, 6); }
    if (mods.finisher === 'bleed' && d > 0 && mon.hp > 0) { mon.venom = { dmg: Math.max(3, Math.round(d * FINISHER.melee.bleed)), next: 2, left: FINISHER.melee.ticks }; log(`The ${mon.name} bleeds!`, 'combat'); }
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
  if (mon.arena) { if (action && action.mon === mon) stopAction(); arenaResult(true); return; }
  log(`You have defeated the ${mon.name}.`, 'combat');
  const kh = perk(skills, 'Hitpoints', 'killHeal');
  if (kh && player.hp > 0 && player.hp < player.maxHp) {
    const heal = Math.max(1, Math.round(player.maxHp * kh));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    log(`Bloodlust: you heal ${heal} hitpoints.`, 'combat');
  }
  for (const m of onKill(player, mon.name)) log(m, 'game');
  bountyKill(mon.name);
  companionKill(mon.name);
  sagaKill(mon.name);
  if (mon.drowned) {
    player.vessel.drowned++;
    if (mon.boss) { log('Captain Saltgrave sinks into the reef... for now.', 'loot'); gainRep('drowned', 100); }
    else { addRep(player, 'drowned', TASK.killRep); refreshStanding(true); }
  }
  huntKill(mon.name);
  if (mon.boss) { const tr = addTrophy(player.house, mon.name); if (tr) log(`Trophy: ${tr}. Mount it in your Hearthstead trophy hall.`, 'loot', '#ffd700'); }
  if (action && action.mon === mon) stopAction();
  const drops = rollLoot(mon.name, Math.random, perk(skills, 'Combat', 'rareDrop'));
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
  overlays.splat(mon, d, now + 120); if (d > 0) { const mp = mon.mesh.position; mon.hitT = 1; mon.hitK = 0.8; burst('hit', mp.x, mp.y + 1, mp.z, 14); shakeRig(rig, 0.4); }
  for (const [s, v] of Object.entries(combatXp(player, d))) giveXP(s, v);
  if (d > 0) log(`${label}!`, 'combat');
  if (mon.hp <= 0) killMonster(mon, now);
}
// Boss mechanics (bossmech.js): telegraphed slams, style switches, enrage.
const bossMech = createBossMech(scene, () => gfx.quality);
function bossEvents(m, now) {
  for (const e of bossMech.tick(m, tick, { playerPos: pm.mesh.position, groundY: () => pm.mesh.position.y, maxHp: player.maxHp })) {
    if (e.kind === 'slam') {
      if (gfx.quality !== 'low') burst('dust', e.x, pm.mesh.position.y, e.z, 14);
      shakeRig(rig, 0.5);
      if (!e.inside) { log('The slam misses you.', 'combat'); continue; }
      if (dodging(flow, now)) { log('You roll through the slam!', 'combat'); onPerfectDodge(); continue; }
      log(`The slam crushes you for ${e.dmg}!`, 'warn'); hurtPlayer(e.dmg);
    } else log(e.text, e.kind === 'telegraph' ? 'warn' : 'combat');
  }
}
function onPerfectDodge() {
  const n = flowPerfectDodge(flow, tick);
  log(`Perfect dodge! Flow x${n}.`, 'combat');
  if (hud && hud.setFlow) hud.setFlow(n);
  if (flow.best > (player.flowBest || 0)) player.flowBest = flow.best;
}
function monsterAttack(mon, now) {
  const raw = rollMonsterHit(mon, player, skills);
  if (mon.ranged) enemyArrow = { from: mon.mesh.position.clone().setY(1.3), t: 0 };
  let dmg = reduceIncoming(raw, player, skills, { fortify: tick < buffs.fortifyUntil, rage: tick < buffs.rageUntil, boss: !!mon.bm });
  if (mon.bm && dmg > 0) dmg = Math.round(dmg * bossMech.prayerMult(mon, id => player.activePrayers.includes(id)));
  if (dmg > 0 && mon.witherUntil > tick) dmg = Math.max(1, Math.floor(dmg * 0.7)); // Withering Hex
  if (dmg > 0 && performance.now() < steedState.bulwarkUntil) dmg = Math.max(1, Math.floor(dmg * (1 - BULWARK.reduce)));
  if (dmg > 0 && dodging(flow, now)) { dmg = 0; overlays.splat(playerEnt, 0, now); log('Dodged!', 'combat'); if (!flow.perfectAt || now - flow.perfectAt > 1500) { flow.perfectAt = now; onPerfectDodge(); } return; }
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
  if (dmg > 0) for (const w of wearOnHit(player)) { log(`Your ${w} is badly worn and loses some of its strength. Repair it at any shop.`, 'warn'); afterEquip(); }
  if (dmg > 0) { shakeRig(rig, 0.45 + 0.5 * Math.min(1, dmg / Math.max(5, player.maxHp * 0.2))); pm.hitT = 1; pm.hitK = Math.min(1.4, 0.5 + dmg / Math.max(5, player.maxHp * 0.2)); pm.hitSide = Math.random() < 0.5 ? -1 : 1; }
  else if (player.equipment.shield || raw > 0) pm.blockT = 1;
  overlays.splat(playerEnt, dmg, now);
  mon.lungeT = 1;
  lastCombatTick = tick;
  markDirty();
  if (player.hp <= 0) playerDied();
  else if (player.settings.autoRetaliate && (!action || action.kind === 'gather' || action.kind === 'craft') && !pm.target && !keys.w && !keys.a && !keys.s && !keys.d) {
    const auto = autocastSpell();
    startAction({ kind: 'attack', mon, spell: auto ? auto.id : null });
  }
}

function playerDied() {
  if (duel) { arenaResult(false); player.hp = player.maxHp; return; }
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
  const fee = deathFee(player);
  player.gold -= fee;
  log(`You wake up back in town. You keep all of your items${fee ? `, but the healers charge ${fee} coins` : ''}.`, 'game');
}

// ---------------------------------------------------------------------------
// Game tick (every 0.6s)
// ---------------------------------------------------------------------------
function inRange(ent, range) { return distTo(ent) <= range + (ent.radius || 0.5); }

function gameTick(now) {
  tick++;
  flowDecay(flow, tick);
  restockTick(player, SHOPS);
  companionAssist(now);
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
  if (!(player.settings.run && pm.moving)) player.runEnergy = Math.min(100, player.runEnergy + 0.45 * (1 + questFx(player, 'runRegen') + skills.Agility.level / 100));

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
    if (m.state !== 'fight' || !m.alive) { if (m.bm) bossMech.reset(m); continue; }
    const d = distTo(m);
    if (m.boss) bossEvents(m, now);
    if (!m.alive || player.hp <= 0) continue;
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
  } else if (a.kind === 'agility') {
    if (inRange(a.node, 1.0)) doAgility(a);
  } else if (a.kind === 'thieve') {
    if (a.node.hp !== undefined && !a.node.alive) { stopAction(); return; }
    if (inRange(a.node, 1.0) && tick >= (player.stunUntil || 0)) doThieve(a);
  } else if (a.kind === 'runecraft') {
    if (inRange(a.node, 1.2)) doRunecraft(a);
  } else if (a.kind === 'attack' && a.spell) {
    const mon = a.mon;
    if (!mon.alive) { stopAction(); return; }
    if (inRange(mon, MAGIC_RANGE) && tick >= nextPlayerAttack) {
      nextPlayerAttack = tick + SPELL_TICKS;
      doMagicTick(a, now);
    }
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
    if (a.wait > 0) { a.wait--; pm.actionAnim = 1; pm.actionKind = 'fire'; } else lightFire(a);
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
  const range = a.kind === 'attack' ? (a.spell ? MAGIC_RANGE : attackRange(player)) : a.kind === 'runecraft' ? 1.2 : a.kind === 'pickup' ? 0.15 : a.kind === 'gather' ? 0.9 : a.kind === 'craft' ? 1.2 : 1.0;
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
  else if (a.kind === 'cave') { stopAction(); caveTravel(ent); }
  else if (a.kind === 'chest') { stopAction(); pm.actionAnim = 1; pm.actionKind = 'tool'; searchHoard(); }
  else if (a.kind === 'forage') { stopAction(); pm.actionAnim = 1; pm.actionKind = 'tool'; forage(ent); }
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
      // death: stagger back, knees buckle, topple sideways with a small bounce, lie still, then sink away
      m.deathT += dt;
      const D = m.deathT, side = m.deathSide ??= (Math.random() < 0.5 ? -1 : 1), ez = k => 1 - (1 - k) * (1 - k);
      const stag = Math.min(1, D / 0.35), fall = Math.min(1, Math.max(0, (D - 0.25) / 0.55)), bounce = D > 0.8 && D < 1.05 ? Math.sin((D - 0.8) / 0.25 * Math.PI) * 0.08 : 0;
      const quad = m.legs && m.legs.length >= 4;
      m.mesh.rotation.z = side * (ez(fall) * (quad ? 1.45 : 1.5) - bounce);
      m.mesh.rotation.x = quad ? 0 : -0.25 * Math.sin(stag * Math.PI) * (1 - fall);
      if (m.body) m.body.position.z = -0.25 * Math.sin(stag * Math.PI * 0.5) * (1 - fall * 0.5);
      if (m.rigHi) { const u = m.rigHi.userData; if (u && u.legs) { u.legs.forEach(l => { if (l.userData.knee) l.userData.knee.rotation.x = 0.9 * Math.min(1, D / 0.5); }); u.arms?.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 0.9 * fall; }); } }
      if (!m.thumped && D > 0.8) { m.thumped = true; burst('dust', pos.x + side * 0.6, pos.y, pos.z, 14); if (Math.hypot(pos.x - pm.mesh.position.x, pos.z - pm.mesh.position.z) < 12) shakeRig(rig, 0.3); }
      m.legs?.forEach((l, i) => { if (l.userData.knee) l.userData.knee.rotation.x = (l.userData.kneeRest || 0) + 0.7 * fall * (i % 2 ? 1 : 0.6); });
      const sink = Math.max(0, (D - 1.6) / 0.6);
      pos.y = terrainHeight(pos.x, pos.z) + (quad ? 0.05 : 0.15) * Math.sin(fall * Math.PI * 0.5) - sink * 0.9;
      const t = Math.min(1, D / 2.2);
      if (t >= 1) { m.mesh.rotation.x = 0; m.deathSide = null; m.thumped = false; if (m.body) m.body.position.z = 0; m.dying = false; m.mesh.visible = false; m.respawnAt = now + (m.respawn || 15000); }
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
        if (m.state !== 'idle') moveWithCollision(pos, dx / d, dz / d, step, { water: false }); // chasing: same walls as the player
        else { pos.x += dx / d * step; pos.z += dz / d * step; }
        moving = step > 0.001;
        m.mesh.rotation.y = Math.atan2(dx, dz);
      } else if (m.state === 'fight') {
        m.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    pos.y = terrainHeight(pos.x, pos.z);
    m.walkT = (m.walkT || 0) + (moving ? dt * 9 : 0);
    const sw = moving ? Math.sin(m.walkT) * 0.6 : 0;
    const hiQuad = m.lod && m.lod.hi && !m.rigHi && m.lod.hi.userData.legs && m.lod.hi.userData.legs === m.legs;
    if (hiQuad) { const sp = moving ? Math.min(speed, Math.hypot(pos.x - (m._px ?? pos.x), pos.z - (m._pz ?? pos.z)) / Math.max(dt, 1e-3) || speed) : 0; poseGait(m, m.lod.hi, dt, sp, now); tailSway(m, m.lod.hi, dt, sp, now); }
    m._px = pos.x; m._pz = pos.z;
    if (!hiQuad) m.legs.forEach((l, i) => {
      const ud = l.userData;
      if (ud.spider) { l.rotation.x = (i % 2 ? sw : -sw) * 0.5 * (((i >> 1) % 2) ? 1 : -1); ud.knee.rotation.x = ud.kneeRest + (moving ? Math.max(0, Math.sin(m.walkT + i)) * 0.3 : 0); return; }
      const ph = i === 1 || i === 2 ? m.walkT + Math.PI : m.walkT;
      l.rotation.x = (ud.rest || 0) + (i % 2 ? sw : -sw) * (ud.rest !== undefined ? 0.8 : 1);
      if (ud.knee) ud.knee.rotation.x = (ud.kneeRest || 0) + (moving ? Math.max(0, Math.sin(ph)) * (ud.kneeRest !== undefined ? 0.6 : 0.8) : 0);
    });
    if (m.rigHi) poseHumanoid(m.rigHi, m.walkT, moving ? 1 : 0, m.lungeT || 0, 0);
    else if (m.lod && m.lod.hi && m.lod.hi.userData.head && moving) m.lod.hi.userData.head.rotation.x = Math.sin(m.walkT * 2) * 0.05;
    if (!hiQuad && m.lod && m.lod.hi && m.lod.hi.userData.wings) { const f = Math.sin(now * 0.003 + m.spawnX) * 0.12; m.lod.hi.userData.wings.forEach((w, k) => { w.rotation.z = (k ? 1 : -1) * (0.25 + f); }); }
    if (m.lungeT > 0) { m.lungeT = Math.max(0, m.lungeT - dt * 3); m.body.position.z = Math.sin(m.lungeT * Math.PI) * 0.35; }
    // hit react: knocked back and rocked by the blow (scaled by damage); a stopped hit is a quick brace instead
    if (m.hitT > 0) { m.hitT = Math.max(0, m.hitT - dt * 3.5); const h = Math.sin(m.hitT * Math.PI) * (m.hitK || 1);
      m.body.position.z = -0.3 * h; m.body.rotation.x = -0.3 * h; m.body.rotation.z = 0.14 * h * Math.sin(m.spawnX);
      { const sq = Math.sin(Math.min(1, (1 - m.hitT) * 3) * Math.PI) * 0.07 * (m.hitK || 1), bs = m.body.userData.bs ??= m.body.scale.clone(); m.body.scale.set(bs.x * (1 + sq * 0.5), bs.y * (1 - sq), bs.z * (1 + sq * 0.5)); }
      if (m.rigHi) { const u = m.rigHi.userData; if (u && u.head) u.head.rotation.x = -0.4 * h; } }
    else if (m.blockT > 0) { m.blockT = Math.max(0, m.blockT - dt * 3); const b = Math.sin(m.blockT * Math.PI);
      m.body.rotation.x = 0.1 * b; if (m.rigHi) { const u = m.rigHi.userData; if (u && u.arms) { u.arms[0].rotation.x = -1.4 * b; u.arms[0].userData.elbow.rotation.x = -1.2 * b; } } }
    else if (m.body && !m.lungeT) { m.body.rotation.x *= 0.8; m.body.rotation.z *= 0.8; }
    if (m.body && !m.hitT && m.body.userData.bs) m.body.scale.copy(m.body.userData.bs);
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
  if (spellFlight && !flyArrow(spellFlight, spellMesh, spellFlight.mon.mesh, dt)) { const mp = spellFlight.mon.mesh.position; burst('magic', mp.x, mp.y + 1.1, mp.z, 26); spellFlight = null; }
}

const ACTION_LABEL = {
  gather: n => ({ tree: '🪓 Woodcutting', rock: '⛏️ Mining', fish: '🎣 Fishing' })[n.node.type], attack: a => a.spell ? `🔮 Casting ${spellById(a.spell).name} at ${a.mon.name}` : `⚔️ Fighting ${a.mon.name}`,
  agility: a => `🏃 ${a.node.verb} ${a.node.name}`, thieve: a => `🦹 Pickpocketing ${a.node.name}`, runecraft: a => `💠 Going to the ${a.node.name}`,
  craft: a => `${SKILL_ICONS[a.recipe.skill]} ${a.recipe.name}${a.left !== Infinity && a.left > 1 ? ` (${a.left})` : ''}`, pickup: () => '✋ Picking up', bank: () => '🏦 Going to bank',
  shop: a => `🛒 Going to ${a.node.name}`, talk: a => `💬 Talking to ${a.node.name}`, altar: () => '🙏 Going to the altar', station: a => `Going to the ${a.node.name.toLowerCase()}`,
  bury: () => '🦴 Burying bones', light: () => '🔥 Lighting a fire',
  cave: a => `🕳️ Going to the ${a.node.name.toLowerCase()}`, chest: a => `🧰 Searching ${a.node.name}`, forage: a => `🫐 Picking from the ${a.node.name.toLowerCase()}`, well: () => '🪣 Going to the well'
};
function updateStatus() {
  let html = '';
  if (hoverText && !IS_TOUCH) html = hoverText;
  else if (action) html = (ACTION_LABEL[action.kind] || (() => ''))(action) || '';
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
  dismount(); checkSteeds();
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
// Narrow (portrait) screens frame the player closer; the zoom-out limit is a setting (Close / Normal / Far).
function applyCamFraming(reset) {
  const portrait = window.innerHeight > window.innerWidth, lim = player.settings?.zoomLimit || 30;
  rig.minDist = portrait ? 4 : 5; rig.maxDist = portrait ? Math.min(lim, 24) : lim;
  if (reset) rig.dist = rig.targetDist = portrait ? 11 : 15;
  rig.targetDist = Math.max(rig.minDist, Math.min(rig.maxDist, rig.targetDist));
}
applyCamFraming(true);
window.addEventListener('resize', () => applyCamFraming(false));

const barEnts = [...monsters, playerEnt];
// Nearby monsters (and close townsfolk) get floating nameplates.
function refreshPlates() {
  const px = pm.mesh.position.x, pz = pm.mesh.position.z, list = [];
  for (const m of monsters) {
    if (!m.alive || !m.mesh.visible) continue;
    const d = Math.hypot(m.mesh.position.x - px, m.mesh.position.z - pz);
    if (d < 18) list.push({ d, ent: m, name: (m.variant ? m.variant + ' the ' : '') + m.name, level: m.level, color: levelColor(m.level), kind: m.variant ? 'named' : 'mob' });
  }
  for (const n of nodes) {
    if (n.type !== 'npc' || !n.mesh || !n.mesh.visible) continue;
    const d = Math.hypot(n.mesh.position.x - px, n.mesh.position.z - pz);
    if (d < 9) list.push({ d: d + 2, ent: n, name: n.name, kind: n.questMark ? 'npc quest' : 'npc' });
  }
  list.sort((a, b) => a.d - b.d);
  overlays.setPlates(list.slice(0, 14));
}
let last = performance.now();
let frame = 0;
// ---- Distance culling: the world is big, so only draw what is near (fog hides the edge) ----
const cullList = [...nodes, ...buildings].filter(e => e && e.mesh);
// ---- Building interiors: walk through doorways and lift the roof when inside ----
const interiorBuildings = buildings.filter(b => b && b.inner && b.door);
const insideOf = (x, z) => interiorBuildings.find(b => x > b.inner.minX && x < b.inner.maxX && z > b.inner.minZ && z < b.inner.maxZ) || null;
function doorWaypoint(b, px, pz, leaving) {
  const d = b.door, lat = Math.abs((px - d.x) * d.nz) + Math.abs((pz - d.z) * d.nx);
  const out = (px - d.x) * d.nx + (pz - d.z) * d.nz; // >0 outside
  const inLane = lat < 0.42 && out > -1.0 && out < 1.2;
  const o = { x: d.x + d.nx * 1.0, z: d.z + d.nz * 1.0 }, i = { x: d.x - d.nx * 0.9, z: d.z - d.nz * 0.9 };
  if (leaving) return inLane ? { x: d.x + d.nx * 1.3, z: d.z + d.nz * 1.3 } : i;
  return inLane ? { x: d.x - d.nx * 1.1, z: d.z - d.nz * 1.1 } : o;
}
function routeThroughDoors() {
  const p = pm.mesh.position;
  if (pm.target && !pm.target.wp) {
    const t = pm.target;
    if (insideOf(p.x, p.z) === insideOf(t.x, t.z)) { pm.goal = null; return; }
    pm.goal = { x: t.x, z: t.z, stop: pm.stopDist, walk: !!t.walk };
  } else if (!pm.goal) return;
  else if (!pm.goal.walk && !pm.target) { pm.goal = null; return; }
  const g = pm.goal, from = insideOf(p.x, p.z), to = insideOf(g.x, g.z);
  if (to && to.guild && !from && skills[to.guild.skill].level < to.guild.level) {
    log(`You need ${to.guild.skill} level ${to.guild.level} to enter the ${to.guild.name}.`, 'warn');
    pm.goal = null; pm.target = null; stopAction(); return;
  }
  if (from === to) { pm.target = { x: g.x, z: g.z, wp: true }; pm.stopDist = g.stop; pm.goal = null; return; }
  const w = from ? doorWaypoint(from, p.x, p.z, true) : doorWaypoint(to, p.x, p.z, false);
  pm.target = { ...w, wp: true }; pm.stopDist = 0.05;
}
// Staff walk a short loop between their work spots (forge/anvil, counter/shelves).
const patrollers = nodes.filter(n => n.patrol);
function updatePatrols(dt, now) {
  for (const n of patrollers) {
    const o = n.mesh;
    if (!o.parent) continue;
    if (action && (action.node === n)) continue;
    n._mv = 0;
    if (n.waitUntil && now < n.waitUntil) continue;
    n._mv = 1;
    n.pi = n.pi || 0;
    const [tx, tz] = n.patrol[n.pi], dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { n.pi = (n.pi + 1) % n.patrol.length; n.waitUntil = now + 2500 + Math.random() * 3000; continue; }
    const st = Math.min(d, dt * 0.9);
    o.position.x += dx / d * st; o.position.z += dz / d * st; n.x = o.position.x; n.z = o.position.z; o.position.y = terrainHeight(n.x, n.z);
    o.rotation.y = Math.atan2(dx, dz);
  }
}
function updateRoofs() {
  const p = pm.mesh.position, inB = insideOf(p.x, p.z);
  if (inB && inB.guild && skills[inB.guild.skill].level < inB.guild.level) {
    // Guild doorman: not high enough level, so you're shown back outside.
    const d = inB.door;
    pm.mesh.position.set(d.x + d.nx * 1.4, p.y, d.z + d.nz * 1.4);
    pm.goal = null; pm.target = null;
    if (!updateRoofs.warned || performance.now() - updateRoofs.warned > 3000) { updateRoofs.warned = performance.now(); log(`You need ${inB.guild.skill} level ${inB.guild.level} to enter the ${inB.guild.name}.`, 'warn'); }
    return;
  }
  for (const b of interiorBuildings) { const r = b.mesh.userData.roof; if (r) r.visible = b !== inB; }
}
window.insideOf = insideOf;
const lodList = nodes.filter(n => n.lod);
// Monsters animate whichever rig (far baked or near detailed) is showing.
function syncMonsterRig(m) {
  const r = m.lod.hi;
  m.legs = r ? (r.userData.legs || m.loLegs) : m.loLegs;
  m.rigHi = r && r.userData.arms ? r : null;
}
// Idle and walking poses for townsfolk shown with the detailed rig.
function updateCharacters(dt, now) {
  for (const n of lodList) {
    const r = n.lod.hi; if (!r || !n.mesh.parent) continue;
    const mv = n._mv || 0;
    n._wt = (n._wt || 0) + dt * 7 * mv;
    poseHumanoid(r, n._wt, mv, 0, 0);
    r.userData.body.position.y = Math.sin(now * 0.002 + r.userData.id) * 0.006;
  }
}
function cullWorld() {
  const R = gfx.quality === 'low' ? 70 : 135, R2 = R * R;
  const px = pm.mesh.position.x, pz = pm.mesh.position.z;
  for (const e of cullList) {
    const o = e.mesh, dx = o.position.x - px, dz = o.position.z - pz, far = dx * dx + dz * dz > R2;
    if (far && !o.userData.culled) { o.visible = false; o.userData.culled = true; }
    else if (!far && o.userData.culled) { o.visible = true; o.userData.culled = false; }
  }
  for (const m of monsters) {
    const o = m.mesh, dx = o.position.x - px, dz = o.position.z - pz, far = dx * dx + dz * dz > R2;
    m.far = far;
    if (far && o.visible && m.alive && !m.dying) { o.visible = false; o.userData.culled = true; }
    else if (!far && o.userData.culled) { o.visible = m.alive || m.dying; o.userData.culled = false; }
  }
  if (scene.userData.packGatherInstances) scene.userData.packGatherInstances();
  if (scene.userData.packImpostors) { const imp = gfx.quality !== 'low' && !IS_TOUCH; scene.userData.packImpostors(imp, px, pz, R - 10, camera.far * 0.9);   // desktop High only
    FADE.c.value.set(px, pz); if (imp) FADE.r.value.set(R - 10, R - 1); else FADE.r.value.set(1e6, 1e6 + 1); }   // 9 m dithered crossfade mesh -> card   // desktop High only
  const cx = camera.position.x, cz = camera.position.z;
  for (const e of lodList) if (e.mesh.parent || e.lod.hi) updateLod(e, px, pz);
  for (const m of monsters) if (m.lod && updateLod(m, px, pz)) syncMonsterRig(m);
  updateDecorChunks(px, pz, gfx.quality === 'low' ? 45 : 80); // fine clutter fades in fog well before this
}

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
  routeThroughDoors();
  const moved = crossing || sailing.atSea ? 0 : updatePlayer(pm, keys, dt, running, rig.yaw);
  sailing.update(dt, keys);
  updateSteed(dt, moved);
  updateSound(pm, dt, player.settings, DAY.night < 0.5);
  updateCrossing(dt);
  if (running && moved > 0) {
    player.runEnergy = Math.max(0, player.runEnergy - moved * 0.7);
    if (player.runEnergy <= 0) { player.settings.run = false; log('You have run out of energy.', 'warn'); markDirty(); }
  }

  bossMech.frame(tick, 1 - Math.max(0, Math.min(1, (nextTickAt - now) / TICK_MS)));
  while (now >= nextTickAt) {
    gameTick(now);
    nextTickAt += TICK_MS;
    if (now - nextTickAt > TICK_MS * 5) nextTickAt = now + TICK_MS;
  }

  if (frame % 15 === 0) cullWorld();
  if (frame % 5 === 2) updateRoofs();
  if (frame % 10 === 3) { setLoadRadius(gfx.quality === 'low' ? 2 : 3); updateChunks(pm.mesh.position.x, pm.mesh.position.z, scene); }
  if (frame % 300 === 11) { refreshStanding(true); finishErrands(); }
  if (frame % 30 === 13) refreshQuick();
  if (frame % 30 === 7) { const vm = onVisit(player, pm.mesh.position.x, pm.mesh.position.z); for (const m of vm) log(m, 'game'); if (vm.length) markDirty(); }
  updateMonsters(dt, now);
  updatePatrols(dt, now);
  updateCompanion(dt);
  updateCharacters(dt, now);
  updateCritters(dt, now, pm.mesh.position.x, pm.mesh.position.z);
  updateFish(dt);
  updateFires(now);
  updateArrow(dt);
  rig.shakeOff = player.settings.shake === false;
  updateRig(rig, camera, pm.mesh.position.x, pm.mesh.position.z, dt, sailing && sailing.atSea ? pm.mesh.position.y - 0.5 : crossing ? pm.mesh.position.y * 0.6 + terrainHeight(pm.mesh.position.x, pm.mesh.position.z) * 0.4 : terrainHeight(pm.mesh.position.x, pm.mesh.position.z));
  updateCave(dt);
  followLight(dirLight, rig.fx, rig.fz, DAY.lightDir);
  sky.follow(camera);
  updatePushers(); updateLocalGrass(scene, pm.mesh.position.x, pm.mesh.position.z, gfx.quality !== 'low' && !inCave(pm.mesh.position.x, pm.mesh.position.z));
  updateDrizzle(scene, camera, dt, gfx.quality, inCave(pm.mesh.position.x, pm.mesh.position.z));
  updateVfx(dt, pm.mesh.position.x, pm.mesh.position.z, camera, now, Math.max(DAY.night, caveK), inCave(pm.mesh.position.x, pm.mesh.position.z));
  if (gfx.quality === 'low') { waterRefl.update(false); renderer.render(scene, camera); } else { updateShafts(); waterRefl.update(true); composer.render(); }

  overlays.update(camera, barEnts, now);
  if (frame % 10 === 4) { if (player.settings.nameplates === false) overlays.setPlates([]); else refreshPlates(); }
  overlays.updatePlates(camera, now);
  if (frame % 3 === 1) hud.update(now);
  if (frame % 3 === 0) {
    if (frame % 20 === 4) minimap.setMarks([...seaMarks(), ...sagaMarks()]);
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
// Keyboard actions (including action bar slots) are routed through keybinds.js and input.js.


// Fade out the title/loading screen once the first frames are drawn.
setTimeout(() => { const ld = document.getElementById('loader'); if (ld) { ld.classList.add('done'); setTimeout(() => ld.remove(), 900); } }, 300);
// UI scale (Settings) applies to every HUD block.
document.documentElement.style.setProperty('--ui-scale', player.settings.uiScale || 1);
// Optional soft UI clicks (WebAudio, generated - no sound files). Off by default.
let uiAudio = null;
document.addEventListener('pointerdown', e => {
  if (!player.settings.uiSound || !e.target.closest || !e.target.closest('button, .slot.item, .ctx-opt, .d-opt')) return;
  try {
    uiAudio = uiAudio || new (window.AudioContext || window.webkitAudioContext)();
    const o = uiAudio.createOscillator(), g = uiAudio.createGain(), t = uiAudio.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((player.settings.uiVolume || 0.5) * 0.12, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(uiAudio.destination); o.start(t); o.stop(t + 0.1);
  } catch (er) { /* audio unavailable */ }
}, true);
window.gielinor = {
  gfx, terrainHeight, applyLook() { applyEquipmentLook(pm, player.equipment); }, setGfx(q) { player.settings.gfx = q; gfx.autoLow = false; applyGfx(); markDirty(); }, scene, camera,
  renderer, player, skills, flow, doDodge, toggleRide, steedShift, steedState, checkSteeds, monsters, nodes, piles, pm, rig, fires, buildings, ui, invUI, get hud() { return hud; }, giveXP, setAutocast, get crossing() { return crossing; }, gtao, get gfxQ() { return gfx.quality; }, useAbility, talkTo, startCraft, stopAction, startAction, useItem, RECIPES, optionsFor, walkTo,
  soundStats, get queued() { return queuedAbility; }, cooldowns, buffs,
  get action() { return action; }, get tick() { return tick; }, startAction, setCompanion, compEnts, sagaTalk, sagaMarks, minimap, sailing, cardsUI, digHere, readChart, seaTalk, talkTo, refreshQuick, bondsUI, finishErrands, refreshStanding,
  bossMech, buy, sell, playerDied, monsterAttack, killMonster, huntTalk, finishErrands, enterHearth, hearthTalk, refreshHearth, arenaTalk, startDuel, get duel() { return duel; }, get duellist() { return duellist; }, spawnMonster, refreshStanding, doMagicTick, set queuedAbility(v) { queuedAbility = v; },
  screenOf(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * window.innerWidth, y: (1 - tmpV.y) / 2 * window.innerHeight }; }
};

