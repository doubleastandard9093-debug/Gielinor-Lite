import { normalizeSaga } from './saga.js';
import { normalizeShopState, normalizeWear } from './economy.js';
import { normalizeTasks } from './tasks.js';
import { normalizeVessel, inSea } from './sea.js';
import { normalizeCompanions } from './companions.js';
import { normalizeSkills, convertXpV1, xpForLevel } from './skills.js';
import { DEFAULT_SETTINGS, INV_SIZE } from './playerState.js';
import { ITEMS, isTool, STARTER_TOOLS } from './items.js';
import { PRAYERS } from './prayer.js';
import { questPoints } from './quests.js';
import { normalizeSteeds } from './steeds.js';
import { normalizeHouse } from './hearth.js';
import { normalizeArena } from './arena.js';
import { normalizeWilds } from './wilds.js';
import { inInstance } from './instances.js';
import { normalizeTongue } from './tongue.js';
import { normalizeQuirks } from './quirks.js';
import { normalizeWrits } from './writs.js';
import { normalizeStill } from './stillwatch.js';
import { normalizePath } from './paths.js';
import { normalizeDelves } from './delves.js';
import { normalizeCodex } from './codex.js';
import { normalizeAim } from './aim.js';
import { normalizeColossi } from './colossi.js';

export const SAVE_VERSION = 17;
export const POS_LIMIT = 146; // world half-size (150) minus a margin
const KEY = 'gielinor3d';
// Wanderer's Horizons (v15+): extra player fields saved and loaded as-is (normalized in migrateSave).
export const EXTRA_KEYS = ['tongue', 'quirks', 'writs', 'still', 'path', 'delves', 'codex', 'aim', 'colossi'];

export function getSaveData(skills, player, playerMesh) {
  return JSON.stringify({
    version: SAVE_VERSION,
    skills,
    player: {
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      gold: player.gold,
      inventory: player.inventory,
      equipment: player.equipment,
      ammoCount: player.ammoCount || 0,
      runEnergy: player.runEnergy,
      attackStyle: player.attackStyle || 0,
      settings: player.settings,
      tools: player.tools || {},
      prayerPoints: player.prayerPoints,
      activePrayers: player.activePrayers || [],
      quests: player.quests || {},
      questPoints: player.questPoints || 0,
      effects: player.effects || [],
      poison: player.poison || null,
      poisonImmune: player.poisonImmune || 0,
      questCapeLegacy: !!player.questCapeLegacy,
      skillTrees: player.skillTrees,
      bank: player.bank || {},
      bounties: player.bounties || {},
      bountiesDone: player.bountiesDone || 0,
      caveLoot: !!player.caveLoot,
      steeds: normalizeSteeds(player.steeds),
      flowBest: player.flowBest || 0,
      alignment: player.alignment || {},
      companions: player.companions || {}, activeCompanion: player.activeCompanion || null, rep: player.rep || {}, errands: player.errands || [], saga: player.saga || null, vessel: player.vessel || null, house: player.house || null, arena: player.arena || null, wilds: player.wilds || null,
      shopState: player.shopState || {}, wear: player.wear || {}, tasks: player.tasks || null,
      ...Object.fromEntries(EXTRA_KEYS.map(k => [k, player[k] ?? null]))
    },
    position: playerMesh ? (inInstance(playerMesh.mesh.position.x) ? (player.instanceReturn || { x: 0, z: 0 }) : { x: playerMesh.mesh.position.x, z: playerMesh.mesh.position.z }) : null,
    timestamp: Date.now()
  });
}

// Brings any older save up to the current format. Returns notes for the chat log.
export function migrateSave(saved) {
  const notes = [];
  const p = saved.player || (saved.player = {});
  const cleanBag = bag => {
    const out = {};
    if (bag && typeof bag === 'object') {
      for (const [k, v] of Object.entries(bag)) {
        const n = Math.floor(Number(v));
        if (n > 0) out[k] = n;
      }
    }
    return out;
  };
  p.inventory = cleanBag(p.inventory);
  p.bank = cleanBag(p.bank);
  p.equipment = Object.assign({ weapon: null, body: null, legs: null, shield: null, head: null, ammo: null, neck: null, ring: null, cape: null }, p.equipment || {});
  if (!p.equipment.ammo) p.ammoCount = 0;
  // Graphics default (settings v2): the game now starts on Low. A save still on Auto (null/missing) moves to Low once;
  // an explicit High or Low is kept, and whatever the player picks afterwards (including Auto) is remembered.
  const rawS = (p.settings && typeof p.settings === 'object') ? p.settings : {};
  if (!(Number(rawS.gfxV) >= 2)) {
    if (rawS.gfx !== 'high' && rawS.gfx !== 'low') { rawS.gfx = 'low'; notes.push('Graphics now start on Low for a smoother game. For more detail, switch Graphics quality to High or Auto in Settings.'); }
    rawS.gfxV = 2;
  }
  p.settings = Object.assign({}, DEFAULT_SETTINGS, rawS);
  if (typeof p.runEnergy !== 'number') p.runEnergy = 100;
  if (typeof p.attackStyle !== 'number') p.attackStyle = 0;
  if (typeof p.gold !== 'number') p.gold = Number(p.gold) || 0;

  const fromVersion = Number(saved.version) || 1;

  // Toolbelt (v4). Older saves get the starter tools, and any tools in the pack move onto the belt.
  if (!p.tools || typeof p.tools !== 'object') {
    p.tools = Object.fromEntries(STARTER_TOOLS.map(t => [t, true]));
    if (fromVersion < 4) notes.push('New: a toolbelt with starter tools (axe, pickaxe, net, hammer, knife, needle, tinderbox). See Worn Equipment.');
  }
  for (const item of Object.keys(p.tools)) if (!isTool(item)) delete p.tools[item];
  for (const item of Object.keys(p.inventory)) {
    if (isTool(item)) {
      const extra = p.inventory[item] - (p.tools[item] ? 0 : 1);
      p.tools[item] = true;
      if (extra > 0) p.bank[item] = (p.bank[item] || 0) + extra;
      delete p.inventory[item];
    }
  }
  // Drop items that no longer exist so the pack never shows broken slots.
  for (const bag of [p.inventory, p.bank]) for (const item of Object.keys(bag)) if (!ITEMS[item]) delete bag[item];
  for (const [slot, item] of Object.entries(p.equipment)) if (item && !ITEMS[item]) p.equipment[slot] = null;

  // Every identical item stacks now, so the 28 slots count different items.
  // Anything past 28 different items goes to the bank.
  const keys = Object.keys(p.inventory);
  if (keys.length > INV_SIZE) {
    let moved = 0;
    for (const item of keys.slice(INV_SIZE)) { p.bank[item] = (p.bank[item] || 0) + p.inventory[item]; moved++; delete p.inventory[item]; }
    notes.push(`Your pack holds 28 different items. ${moved} kind${moved === 1 ? ' was' : 's were'} moved to your bank.`);
  }

  // Prayer and quests (v4)
  if (!Array.isArray(p.activePrayers)) p.activePrayers = [];
  p.activePrayers = p.activePrayers.filter(id => PRAYERS.some(x => x.id === id));
  if (!p.quests || typeof p.quests !== 'object') p.quests = {};
  p.questPoints = questPoints(p);

  // v13: steeper XP curve. Convert XP level-for-level so nobody loses a level.
  if (fromVersion < 13 && saved.skills && typeof saved.skills === 'object') {
    for (const k of Object.values(saved.skills)) if (k && typeof k === 'object') { const lv = Math.floor(Number(k.level) || 1); k.xp = Math.max(convertXpV1(k.xp), xpForLevel(Math.min(99, lv))); }
    notes.push('XP curve updated (steeper, like the old classics). Your levels are unchanged and XP was converted.');
  }
  saved.skills = normalizeSkills(saved.skills || {});
  if (typeof p.prayerPoints !== 'number' || !(p.prayerPoints >= 0)) p.prayerPoints = saved.skills.Prayer.level * 10;
  p.prayerPoints = Math.min(p.prayerPoints, saved.skills.Prayer.level * 10);
  if (fromVersion < 4) notes.push('New in this update: stacking items, a toolbelt, quests, prayer and combat skills. See Settings → What\'s new.');
  // v6: potions/poison state, Herblore skill (added by normalizeSkills), quest cape for earlier finishers.
  if (!Array.isArray(p.effects)) p.effects = [];
  p.effects = p.effects.filter(e => e && ITEMS[e.id] && e.left > 0);
  if (!p.poison || typeof p.poison !== 'object' || !(p.poison.dmg > 0)) p.poison = null;
  p.poisonImmune = Math.max(0, Number(p.poisonImmune) || 0);
  if (fromVersion < 6) {
    const OLD_QUESTS = ['cook', 'fallen', 'doric', 'goblins', 'hides', 'tools', 'supply', 'archers', 'honour'];
    const hadAll = OLD_QUESTS.every(id => p.quests[id] && p.quests[id].stage === 'done');
    const ownsCape = p.inventory['Quest point cape'] || p.bank['Quest point cape'] || p.equipment.cape === 'Quest point cape';
    if (hadAll || ownsCape) { p.questCapeLegacy = true; notes.push('You keep your Quest point cape, even as new quests are added.'); }
  }
  p.questCapeLegacy = !!p.questCapeLegacy;
  if (fromVersion < 6) notes.push('New: Herblore and potions, endless trees, rocks and fishing spots, and 5x level bonuses. See Settings → What\'s new.');
  if (fromVersion < 5) notes.push('New: perks every 5 levels, gear bonuses with jewellery, capes and armour sets, and lasting quest bonuses. See Settings → What\'s new.');
  // v7: Magic, Agility, Thieving and Runecrafting (normalizeSkills starts them at level 1).
  if (fromVersion < 7) notes.push('New skills: Magic, Agility, Thieving and Runecrafting, plus the towns of Port Sarim, Varrock and Falador. See Settings → What\'s new.');
  // v8: 100 new quests. Anyone who had finished all 22 earlier quests keeps the Quest point cape.
  if (fromVersion < 8) {
    const OLD22 = ['cook', 'fallen', 'doric', 'goblins', 'hides', 'tools', 'supply', 'archers', 'honour', 'fishing', 'ashford_help', 'eastern_guards', 'herbs_for_wren', 'smith_order', 'eastern_feast', 'scout_report', 'miner_tools', 'sister_prayers', 'trader_supplies', 'knight_honour_east', 'angler_catch', 'carpenter_wood'];
    if (OLD22.every(id => p.quests[id] && p.quests[id].stage === 'done') && !p.questCapeLegacy) { p.questCapeLegacy = true; notes.push('You keep your Quest point cape, even with the new quests.'); }
    notes.push('New: 100 new quests across every town and the wilds. Look for blue dots on the minimap. See Settings → What\'s new.');
  }
  // v9 (Flow & Steeds): steeds and best Flow chain. Old saves start with none; Agility grants steeds on load.
  p.steeds = normalizeSteeds(p.steeds);
  p.flowBest = Math.max(0, Math.floor(Number(p.flowBest) || 0));
  if (fromVersion < 9) notes.push('New: Flow Strikes (chain combat skills, dodge-roll with Space) and Shiftsteeds (rides unlocked by Agility 10 and 30, G to ride). See Settings → What\'s new.');
  // v10 (Bonds & Choices): dialogue-wheel tone counts.
  { const a = p.alignment && typeof p.alignment === 'object' ? p.alignment : {}; p.alignment = {}; for (const t of ['kind', 'firm', 'cunning']) p.alignment[t] = Math.max(0, Math.floor(Number(a[t]) || 0)); }
  p.companions = normalizeCompanions(p.companions);
  if (fromVersion < 10) notes.push('New: Bonds & Choices. Recruit Sworn Companions, earn faction Standing and send errands (press B). See Settings → What\'s new.');
  // v11 (The Wanderer's Saga): your story, calling and choices.
  p.saga = normalizeSaga(p.saga);
  if (fromVersion < 11) notes.push('New: The Wanderer\'s Saga. Talk to Chronicler Corwin in Brightwater to begin your story.');
  // v12 (Sails of Sarim): your ship, crew, officers, treasure charts and card-table record.
  p.vessel = normalizeVessel(p.vessel);
  // v13: shop stock bought down and gear wear.
  p.shopState = normalizeShopState(p.shopState); p.wear = normalizeWear(p.wear);
  p.tasks = normalizeTasks(p.tasks);
  // v14 (Hearth & Arena): Hearthstead deed, rooms, furniture and trophies.
  p.house = normalizeHouse(p.house); p.arena = normalizeArena(p.arena); p.wilds = normalizeWilds(p.wilds);
  // v15 (Wanderer's Horizons, phase 6): Silver Tongue checks, Quirks, Daily Writs, Stillwatch.
  p.tongue = normalizeTongue(p.tongue);
  p.quirks = normalizeQuirks(p.quirks);
  p.writs = normalizeWrits(p.writs);
  p.still = normalizeStill(p.still);
  // v16 (Wanderer's Horizons, phase 7): Combat Paths, Delves of Three, Stable Codex.
  p.path = normalizePath(p.path);
  p.delves = normalizeDelves(p.delves);
  p.codex = normalizeCodex(p.codex);
  p.aim = normalizeAim(p.aim);
  p.colossi = normalizeColossi(p.colossi);
  if (fromVersion < 16) notes.push('New: Wanderer\'s Horizons part 2. Combat Paths, Delves of Three and the Stable Codex. See Settings → What\'s new.');
  if (fromVersion < 15) notes.push('New: Wanderer\'s Horizons part 1. Silver Tongue checks, Quirks, Daily Writs and Stillwatch. See Settings → What\'s new.');
  if (fromVersion < 14) notes.push('New: Hearth & Arena. Deedwarden Oswin behind Brightwater sells a Hearthstead deed. See Settings → What\'s new.');
  if (fromVersion < 12) notes.push('New: Sails of Sarim. See the Shipwright on the Port Sarim docks for a ship, then sail the Sound. Cutlasses, flintlocks, Hexcraft and card tables too. Press M for the world map.');
  if (!p.activeCompanion || !p.companions[p.activeCompanion] || !p.companions[p.activeCompanion].recruited) p.activeCompanion = null;
  { const r = p.rep && typeof p.rep === 'object' ? p.rep : {}; p.rep = {}; for (const k of Object.keys(r)) { const v = Math.floor(Number(r[k]) || 0); if (v > 0) p.rep[k] = Math.min(99999, v); } }
  p.errands = Array.isArray(p.errands) ? p.errands.filter(e => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.comp === 'string').slice(0, 8) : [];
  saved.version = SAVE_VERSION;
  return notes;
}

export function applySaveData(data, skills, player, playerMesh) {
  try {
    const saved = typeof data === 'string' ? JSON.parse(data) : data;
    if (!saved || typeof saved !== 'object') return false;
    const notes = migrateSave(saved);
    Object.assign(skills, saved.skills);
    const p = saved.player;
    for (const k of ['hp', 'maxHp', 'mana', 'maxMana', 'gold', 'inventory', 'equipment', 'ammoCount', 'runEnergy', 'attackStyle', 'settings', 'bank', 'tools', 'prayerPoints', 'activePrayers', 'quests', 'questPoints', 'effects', 'poison', 'poisonImmune', 'questCapeLegacy', 'bounties', 'bountiesDone', 'caveLoot', 'steeds', 'flowBest', 'alignment', 'companions', 'activeCompanion', 'rep', 'errands', 'saga', 'vessel', 'house', 'arena', 'wilds', 'shopState', 'wear', 'tasks', ...EXTRA_KEYS]) {
      if (p[k] !== undefined) player[k] = p[k];
    }
    if (p.skillTrees) {
      for (const [tree, perks] of Object.entries(p.skillTrees)) {
        if (player.skillTrees[tree]) Object.assign(player.skillTrees[tree], perks);
      }
    }
    if (typeof player.hp !== 'number' || !(player.hp > 0)) player.hp = player.maxHp || 100;
    if (saved.position && playerMesh && isFinite(saved.position.x) && isFinite(saved.position.z) && inSea(saved.position.x, saved.position.z)) {
      playerMesh.mesh.position.x = saved.position.x; playerMesh.mesh.position.z = saved.position.z;
    } else if (saved.position && playerMesh && isFinite(saved.position.x) && isFinite(saved.position.z)) {
      playerMesh.mesh.position.x = Math.max(-POS_LIMIT, Math.min(POS_LIMIT, saved.position.x));
      playerMesh.mesh.position.z = Math.max(-POS_LIMIT, Math.min(POS_LIMIT, saved.position.z));
    }
    applySaveData.lastNotes = notes;
    return true;
  } catch (e) {
    console.warn('Save load failed', e);
    return false;
  }
}
applySaveData.lastNotes = [];

export function saveToLocal(skills, player, playerMesh) {
  try {
    localStorage.setItem(KEY, getSaveData(skills, player, playerMesh));
    return true;
  } catch (e) {
    return false;
  }
}

export function hasLocalSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function loadFromLocal(skills, player, playerMesh) {
  try {
    const data = localStorage.getItem(KEY);
    if (data) return applySaveData(data, skills, player, playerMesh);
  } catch (e) {}
  return false;
}

export function exportSave(skills, player, playerMesh) {
  const data = getSaveData(skills, player, playerMesh);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gielinor-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importSave(file, skills, player, playerMesh, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    const ok = applySaveData(reader.result, skills, player, playerMesh);
    if (onDone) onDone(ok);
  };
  reader.readAsText(file);
}
