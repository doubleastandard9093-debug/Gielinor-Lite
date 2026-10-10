import { normalizeSkills } from './skills.js';
import { DEFAULT_SETTINGS, INV_SIZE } from './playerState.js';
import { ITEMS, isTool, STARTER_TOOLS } from './items.js';
import { PRAYERS } from './prayer.js';
import { questPoints } from './quests.js';

export const SAVE_VERSION = 4;
const KEY = 'gielinor3d';

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
      skillTrees: player.skillTrees,
      bank: player.bank || {}
    },
    position: playerMesh ? { x: playerMesh.mesh.position.x, z: playerMesh.mesh.position.z } : null,
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
  p.equipment = Object.assign({ weapon: null, body: null, legs: null, shield: null, head: null, ammo: null }, p.equipment || {});
  if (!p.equipment.ammo) p.ammoCount = 0;
  p.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings || {});
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

  saved.skills = normalizeSkills(saved.skills || {});
  if (typeof p.prayerPoints !== 'number' || !(p.prayerPoints >= 0)) p.prayerPoints = saved.skills.Prayer.level * 10;
  p.prayerPoints = Math.min(p.prayerPoints, saved.skills.Prayer.level * 10);
  if (fromVersion < 4) notes.push('New in this update: stacking items, a toolbelt, quests, prayer and combat skills. See Settings → What\'s new.');
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
    for (const k of ['hp', 'maxHp', 'mana', 'maxMana', 'gold', 'inventory', 'equipment', 'ammoCount', 'runEnergy', 'attackStyle', 'settings', 'bank', 'tools', 'prayerPoints', 'activePrayers', 'quests', 'questPoints']) {
      if (p[k] !== undefined) player[k] = p[k];
    }
    if (p.skillTrees) {
      for (const [tree, perks] of Object.entries(p.skillTrees)) {
        if (player.skillTrees[tree]) Object.assign(player.skillTrees[tree], perks);
      }
    }
    if (typeof player.hp !== 'number' || !(player.hp > 0)) player.hp = player.maxHp || 100;
    if (saved.position && playerMesh && isFinite(saved.position.x) && isFinite(saved.position.z)) {
      playerMesh.mesh.position.x = Math.max(-38, Math.min(38, saved.position.x));
      playerMesh.mesh.position.z = Math.max(-38, Math.min(38, saved.position.z));
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
