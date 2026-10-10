export function getSaveData(skills, player) {
  return JSON.stringify({
    version: 1,
    skills,
    player,
    timestamp: Date.now()
  });
}

export function applySaveData(data, skills, player) {
  try {
    const saved = typeof data === 'string' ? JSON.parse(data) : data;
    if (saved.skills) Object.assign(skills, saved.skills);
    if (saved.player) Object.assign(player, saved.player);
    return true;
  } catch (e) {
    return false;
  }
}

export function saveToLocal(skills, player) {
  try {
    localStorage.setItem('gielinorLite', getSaveData(skills, player));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadFromLocal(skills, player) {
  try {
    const data = localStorage.getItem('gielinorLite');
    if (data) return applySaveData(data, skills, player);
  } catch (e) {}
  return false;
}
