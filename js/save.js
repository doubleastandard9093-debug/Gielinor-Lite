export function getSaveData(skills, player, playerMesh) {
  return JSON.stringify({
    version: 2,
    skills,
    player: {
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      gold: player.gold,
      inventory: player.inventory,
      equipment: player.equipment,
      skillTrees: player.skillTrees,
      bank: player.bank || {}
    },
    position: playerMesh ? { x: playerMesh.mesh.position.x, z: playerMesh.mesh.position.z } : null,
    timestamp: Date.now()
  });
}

export function applySaveData(data, skills, player, playerMesh) {
  try {
    const saved = typeof data === 'string' ? JSON.parse(data) : data;
    if (saved.skills) Object.assign(skills, saved.skills);
    if (saved.player) {
      Object.assign(player, saved.player);
      if (!player.bank) player.bank = {};
    }
    if (saved.position && playerMesh) {
      playerMesh.mesh.position.x = saved.position.x;
      playerMesh.mesh.position.z = saved.position.z;
    }
    return true;
  } catch (e) {
    console.warn('Save load failed', e);
    return false;
  }
}

export function saveToLocal(skills, player, playerMesh) {
  try {
    localStorage.setItem('gielinor3d', getSaveData(skills, player, playerMesh));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadFromLocal(skills, player, playerMesh) {
  try {
    const data = localStorage.getItem('gielinor3d');
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
  a.click();
  URL.revokeObjectURL(url);
}

export function importSave(file, skills, player, playerMesh, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    const ok = applySaveData(reader.result, skills, player, playerMesh);
    if (onDone) onDone(ok);
  };
  reader.readAsText(file);
}
