export const SKILLS = ['Attack','Strength','Defence','Hitpoints','Ranged','Prayer','Mining','Woodcutting','Fishing','Smithing','Crafting','Cooking','Fletching'];

export const SKILL_ICONS = {
  Attack: '⚔️', Strength: '💪', Defence: '🛡️', Hitpoints: '❤️', Ranged: '🏹', Prayer: '🙏', Mining: '⛏️',
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
    const old = skills[skill].level;
    skills[skill].level = newLvl;
    if (onLevelUp) onLevelUp(skill, newLvl, old);
  }
}

// Classic RuneScape combat level formula (no Prayer or Magic in this game).
export function combatLevel(skills) {
  const base = 0.25 * (skills.Defence.level + skills.Hitpoints.level + Math.floor((skills.Prayer ? skills.Prayer.level : 1) / 2));
  const melee = 0.325 * (skills.Attack.level + skills.Strength.level);
  const range = 0.325 * Math.floor(skills.Ranged.level * 1.5);
  return Math.floor(base + Math.max(melee, range));
}

export function totalLevel(skills) {
  return SKILLS.reduce((t, s) => t + skills[s].level, 0);
}

// ---------------------------------------------------------------------------
// Tiered perks: every skill unlocks a passive bonus at 10, 20 ... 90 and 99.
// Odd milestones (10, 30, 50, 70, 90) give one bonus, even ones (20, 40, 60, 80)
// another, and 99 gives a bigger boost to both.
// ---------------------------------------------------------------------------
export const PERK_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];
const pct = v => Math.round(v * 100) + '%';
function build(names, odd, even, cape) {
  // odd/even/cape: [fx object, description]
  return PERK_LEVELS.map((level, i) => {
    const [fx, desc] = level === 99 ? cape : (i % 2 === 0 ? odd : even);
    return { level, name: names[i], fx, desc };
  });
}
export const PERKS = {
  Attack: build(['Steady Hand', 'Battle Focus', 'Keen Edge', 'Swift Recovery', 'Precision', 'Veteran', 'True Strike', 'War Cry', 'Weapon Master', 'Attack Cape'],
    [{ acc: 0.03 }, '+3% melee accuracy'], [{ abilityCd: 0.05 }, 'combat skills recharge 5% faster'], [{ acc: 0.05, abilityCd: 0.05 }, '+5% accuracy, 5% faster recharge']),
  Strength: build(['Brawn', 'Crushing Blow', 'Muscle', 'Heavy Hitter', 'Might', 'Savage Blow', 'Titan Grip', 'Executioner', 'Juggernaut', 'Strength Cape'],
    [{ maxHit: 2 }, '+2 melee max hit'], [{ crit: 0.02 }, '+2% chance of a critical hit (x1.5)'], [{ maxHit: 5, crit: 0.03 }, '+5 max hit, +3% critical chance']),
  Defence: build(['Tough Hide', 'Bracing', 'Iron Will', 'Stalwart', 'Bulwark', 'Unyielding', 'Fortress', 'Rampart', 'Impervious', 'Defence Cape'],
    [{ dr: 0.02 }, 'take 2% less damage'], [{ dr: 0.02 }, 'take 2% less damage'], [{ dr: 0.04 }, 'take 4% less damage']),
  Hitpoints: build(['Hardy', 'Second Wind', 'Vigour', 'Hearty Meal', 'Resilience', 'Lifeblood', 'Vitality', 'Well Fed', 'Undying', 'Hitpoints Cape'],
    [{ regen: 0.15 }, 'hitpoints regenerate 15% faster'], [{ healBonus: 0.05 }, 'food heals 5% more'], [{ regen: 0.25, healBonus: 0.1 }, '25% faster regen, food heals 10% more']),
  Ranged: build(['Keen Eye', 'Fletcher\'s Thrift', 'Steady Aim', 'Quiver Craft', 'Deadeye', 'Arrow Saver', 'Eagle Sight', 'Recycler', 'Marksman', 'Ranged Cape'],
    [{ racc: 0.03, rmaxHit: 1 }, '+3% ranged accuracy, +1 max hit'], [{ ammoSave: 0.08 }, '8% chance to keep an arrow'], [{ racc: 0.05, rmaxHit: 3, ammoSave: 0.1 }, '+5% accuracy, +3 max hit, 10% arrow saving']),
  Prayer: build(['Devout', 'Blessed Rites', 'Faithful', 'Gravedigger', 'Pious', 'Sacred Burial', 'Zealot', 'Bone Collector', 'Saint', 'Prayer Cape'],
    [{ drainLess: 0.05 }, 'prayers drain 5% slower'], [{ buryXp: 0.05 }, '+5% XP from burying bones'], [{ drainLess: 0.1, buryXp: 0.1 }, '10% slower drain, +10% bury XP']),
  Mining: build(['Keen Pick', 'Rich Vein', 'Steady Strikes', 'Prospector', 'Deep Delver', 'Motherlode', 'Stonebreaker', 'Gem Sense', 'Master Miner', 'Mining Cape'],
    [{ speed: 0.04 }, 'mine 4% faster'], [{ double: 0.05 }, '5% chance of double ore'], [{ speed: 0.06, double: 0.05 }, 'mine 6% faster, +5% double ore']),
  Woodcutting: build(['Sharp Edge', 'Bountiful Bough', 'Steady Swing', 'Woodsman\'s Luck', 'Lumberjack', 'Heartwood', 'Timber!', 'Forest Friend', 'Master Feller', 'Woodcutting Cape'],
    [{ speed: 0.04 }, 'chop 4% faster'], [{ double: 0.05 }, '5% chance of double logs'], [{ speed: 0.06, double: 0.05 }, 'chop 6% faster, +5% double logs']),
  Fishing: build(['Patient Angler', 'Double Catch', 'Quick Reflexes', 'Bountiful Waters', 'Expert Caster', 'Teeming Shoals', 'Lure Master', 'Fisher King', 'Master Fisher', 'Fishing Cape'],
    [{ speed: 0.04 }, 'fish 4% faster'], [{ double: 0.05 }, '5% chance of double catch'], [{ speed: 0.06, double: 0.05 }, 'fish 6% faster, +5% double catch']),
  Smithing: build(['Apprentice', 'Efficient Hammer', 'Journeyman', 'Hot Forge', 'Artisan', 'Bar Saver', 'Master Smith', 'Smith\'s Insight', 'Grandmaster', 'Smithing Cape'],
    [{ saveBar: 0.03 }, '3% chance to save a bar or ore'], [{ xpBonus: 0.03 }, '+3% Smithing XP'], [{ saveBar: 0.05, xpBonus: 0.05 }, '+5% bar saving, +5% XP']),
  Crafting: build(['Nimble Fingers', 'Tanner\'s Eye', 'Fine Stitching', 'Thrifty', 'Artisan', 'Patternmaker', 'Master Crafter', 'Leatherworker', 'Grand Artisan', 'Crafting Cape'],
    [{ saveMat: 0.03 }, '3% chance to save materials'], [{ xpBonus: 0.03 }, '+3% Crafting XP'], [{ saveMat: 0.05, xpBonus: 0.05 }, '+5% material saving, +5% XP']),
  Cooking: build(['Kitchen Hand', 'Hearty Portions', 'Line Cook', 'Seasoned', 'Sous Chef', 'Rich Broth', 'Head Chef', 'Feast Maker', 'Master Chef', 'Cooking Cape'],
    [{ burnLess: 0.1 }, 'burn food 10% less often'], [{ healBonus: 0.05 }, 'food you eat heals 5% more'], [{ burnLess: 1 }, 'never burn food']),
  Fletching: build(['Whittler', 'Thrifty Knife', 'Bowyer', 'Careful Cuts', 'Fletcher', 'Waste Not', 'Master Bowyer', 'Arrowsmith', 'Grand Fletcher', 'Fletching Cape'],
    [{ extraArrows: 1 }, '+1 arrow per batch'], [{ saveMat: 0.03 }, '3% chance to save materials'], [{ extraArrows: 3, saveMat: 0.05 }, '+3 arrows per batch, +5% saving'])
};

export function perk(skills, skill, key) {
  const lvl = skills[skill] ? skills[skill].level : 1;
  let v = 0;
  for (const p of PERKS[skill] || []) { if (p.level > lvl) break; if (p.fx[key]) v += p.fx[key]; }
  return v;
}
export function perksBetween(skill, fromLvl, toLvl) {
  return (PERKS[skill] || []).filter(p => p.level > fromLvl && p.level <= toLvl);
}
export function maxPrayer(skills) { return skills.Prayer.level * 10; }
