export const SKILLS = ['Attack','Strength','Defence','Hitpoints','Ranged','Mining','Woodcutting','Fishing','Smithing','Crafting','Cooking','Fletching'];

export const SKILL_ICONS = {
  Attack: '⚔️', Strength: '💪', Defence: '🛡️', Hitpoints: '❤️', Ranged: '🏹', Mining: '⛏️',
  Woodcutting: '🪓', Fishing: '🎣', Smithing: '🔨', Crafting: '🧶', Cooking: '🍳', Fletching: '🪶'
};

export function xpForLevel(level) {
  if (level <= 1) return 0;
  let xp = 0;
  for (let l = 1; l < level; l++) {
    xp += Math.floor(l * 50 + Math.pow(l, 1.6) * 2);
  }
  return xp;
}

// Cached table so XP lookups don't loop every frame.
const XP_TABLE = [0, 0];
for (let l = 2; l <= 100; l++) XP_TABLE[l] = xpForLevel(l);

export function getLevel(xp) {
  let level = 1;
  while (level < 99 && xp >= XP_TABLE[level + 1]) level++;
  return level;
}

export function createSkills() {
  const skills = {};
  SKILLS.forEach(s => skills[s] = { level: 1, xp: 0 });
  skills.Hitpoints.level = 10;
  skills.Hitpoints.xp = XP_TABLE[10];
  return skills;
}

// Makes sure every skill exists and that level and XP agree (older saves started
// Hitpoints at level 10 with too little XP, which froze Hitpoints levelling).
export function normalizeSkills(skills) {
  for (const s of SKILLS) {
    const k = skills[s];
    if (!k || typeof k !== 'object') { skills[s] = { level: s === 'Hitpoints' ? 10 : 1, xp: s === 'Hitpoints' ? XP_TABLE[10] : 0 }; continue; }
    k.level = Math.max(1, Math.min(99, Math.floor(Number(k.level) || 1)));
    k.xp = Math.max(0, Number(k.xp) || 0);
    if (k.xp < XP_TABLE[k.level]) k.xp = XP_TABLE[k.level];
    k.level = Math.max(k.level, getLevel(k.xp));
  }
  return skills;
}

export function xpToNext(skill) {
  if (skill.level >= 99) return 0;
  return Math.max(0, XP_TABLE[skill.level + 1] - skill.xp);
}

export function levelProgress(skill) {
  if (skill.level >= 99) return 1;
  const lo = XP_TABLE[skill.level], hi = XP_TABLE[skill.level + 1];
  return Math.max(0, Math.min(1, (skill.xp - lo) / (hi - lo)));
}

export function nextLevelXp(skill) {
  return skill.level >= 99 ? XP_TABLE[99] : XP_TABLE[skill.level + 1];
}

export function addXP(skills, skill, amount, onLevelUp) {
  skills[skill].xp += amount;
  const newLvl = getLevel(skills[skill].xp);
  if (newLvl > skills[skill].level) {
    skills[skill].level = newLvl;
    if (onLevelUp) onLevelUp(skill, newLvl);
  }
}

// Classic RuneScape combat level formula (no Prayer or Magic in this game).
export function combatLevel(skills) {
  const base = 0.25 * (skills.Defence.level + skills.Hitpoints.level);
  const melee = 0.325 * (skills.Attack.level + skills.Strength.level);
  const range = 0.325 * Math.floor(skills.Ranged.level * 1.5);
  return Math.floor(base + Math.max(melee, range));
}

export function totalLevel(skills) {
  return SKILLS.reduce((t, s) => t + skills[s].level, 0);
}
