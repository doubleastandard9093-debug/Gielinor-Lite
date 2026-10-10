import { normalizeSkills } from './skills.js';
import { DEFAULT_SETTINGS, INV_SIZE } from './playerState.js';
import { isStackable } from './items.js';

export const SAVE_VERSION = 3;
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
  p.equipment = Object.assign({ weapon: null, body: null, legs: null, shield: null, ammo: null }, p.equipment || {});
  if (!p.equipment.ammo) p.ammoCount = 0;
  p.settings = Object.assign({}, DEFAULT_SETTINGS, p.settings || {});
  if (typeof p.runEnergy !== 'number') p.runEnergy = 100;
  if (typeof p.attackStyle !== 'number') p.attackStyle = 0;
  if (typeof p.gold !== 'number') p.gold = Number(p.gold) || 0;

  // Old saves had no inventory limit. Anything past 28 slots goes to the bank.
  let used = 0;
  let moved = 0;
  for (const item of Object.keys(p.inventory)) {
    const qty = p.inventory[item];
    if (isStackable(item)) {
      if (used < INV_SIZE) { used++; continue; }
      p.bank[item] = (p.bank[item] || 0) + qty; delete p.inventory[item]; moved += qty; continue;
    }
    const keep = Math.max(0, Math.min(qty, INV_SIZE - used));
    used += keep;
    if (keep < qty) {
      p.bank[item] = (p.bank[item] || 0) + (qty - keep);
      moved += qty - keep;
      if (keep) p.inventory[item] = keep; else delete p.inventory[item];
    }
  }
  if (moved) notes.push(`Your pack now holds 28 items. ${moved} extra item${moved === 1 ? ' was' : 's were'} moved to your bank.`);

  saved.skills = normalizeSkills(saved.skills || {});
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
    for (const k of ['hp', 'maxHp', 'mana', 'maxMana', 'gold', 'inventory', 'equipment', 'ammoCount', 'runEnergy', 'attackStyle', 'settings', 'bank']) {
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
