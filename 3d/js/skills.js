export const SKILLS = ['Attack','Strength','Defence','Hitpoints','Ranged','Mining','Woodcutting','Fishing','Smithing','Crafting','Cooking','Fletching'];

export function createSkills() {
  const skills = {};
  SKILLS.forEach(s => skills[s] = { level: 1, xp: 0 });
  skills.Hitpoints.level = 10;
  skills.Hitpoints.xp = 1154;
  return skills;
}

export function xpForLevel(level) {
  if (level <= 1) return 0;
  let xp = 0;
  for (let l = 1; l < level; l++) {
    xp += Math.floor(l * 50 + Math.pow(l, 1.6) * 2);
  }
  return xp;
}

export function getLevel(xp) {
  let level = 1;
  while (level < 99 && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function addXP(skills, skill, amount, onLevelUp) {
  skills[skill].xp += amount;
  const newLvl = getLevel(skills[skill].xp);
  if (newLvl > skills[skill].level) {
    skills[skill].level = newLvl;
    if (onLevelUp) onLevelUp(skill, newLvl);
  }
}
