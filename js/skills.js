export const SKILLS = ["Attack","Strength","Defence","Hitpoints","Ranged","Magic","Prayer","Agility","Thieving","Mining","Woodcutting","Fishing","Smithing","Crafting","Cooking","Fletching","Herblore","Runecrafting"];

export const SKILL_ICONS = {
  Attack: "⚔️", Strength: "💪", Defence: "🛡️", Hitpoints: "❤️", Ranged: "🏹", Magic: "🔮", Prayer: "🙏",
  Agility: "🏃", Thieving: "🦹", Mining: "⛏️", Woodcutting: "🪓", Fishing: "🎣", Smithing: "🔨",
  Crafting: "🧶", Cooking: "🍳", Fletching: "🪶", Herblore: "🌿", Runecrafting: "💠"
};

// v13: OSRS-shaped exponential curve (l + 300*2^(l/7)) / 4, scaled to 30%. Level 99 is about 3.9M XP.
export const XP_SCALE = 0.3;
export function xpForLevel(level) {
  if (level <= 1) return 0;
  let pts = 0;
  for (let l = 1; l < level; l++) pts += Math.floor(l + 300 * Math.pow(2, l / 7));
  return Math.floor(pts / 4 * XP_SCALE);
}
// The pre-v13 curve, kept only to convert old saves level-for-level.
export function xpForLevelV1(level) {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += Math.floor(l * 50 + Math.pow(l, 1.6) * 2);
  return xp;
}
// Convert XP from the old curve keeping the level and the fraction through it.
export function convertXpV1(xp) {
  xp = Math.max(0, Number(xp) || 0);
  let L = 1; while (L < 99 && xp >= xpForLevelV1(L + 1)) L++;
  if (L >= 99) return xpForLevel(99) + Math.max(0, xp - xpForLevelV1(99)) * 10;
  const lo = xpForLevelV1(L), hi = xpForLevelV1(L + 1), f = (xp - lo) / (hi - lo);
  return Math.floor(xpForLevel(L) + f * (xpForLevel(L + 1) - xpForLevel(L)));
}

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

export function normalizeSkills(skills) {
  for (const s of SKILLS) {
    const k = skills[s];
    if (!k || typeof k !== "object") { skills[s] = { level: s === "Hitpoints" ? 10 : 1, xp: s === "Hitpoints" ? XP_TABLE[10] : 0 }; continue; }
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

export function combatLevel(skills) {
  const base = 0.25 * (skills.Defence.level + skills.Hitpoints.level + Math.floor((skills.Prayer ? skills.Prayer.level : 1) / 2));
  const melee = 0.325 * (skills.Attack.level + skills.Strength.level);
  const range = 0.325 * Math.floor(skills.Ranged.level * 1.5);
  const magic = 0.325 * Math.floor((skills.Magic ? skills.Magic.level : 1) * 1.5);
  return Math.floor(base + Math.max(melee, range, magic));
}

export function totalLevel(skills) {
  return SKILLS.reduce((t, s) => t + skills[s].level, 0);
}

export const PERK_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];
export const MILESTONES = [25, 50, 75, 99];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const P = v => `${+(v * 100).toFixed(1)}%`;
export const FX_LABEL = {
  acc: v => `+${P(v)} melee accuracy`, abilityCd: v => `combat skills recharge ${P(v)} faster`, counter: v => `${P(v)} chance to counter-attack when a monster misses`,
  quick: v => `${P(v)} chance your next swing comes a tick sooner`, maxHit: v => `+${v} melee max hit`, crit: v => `${P(v)} critical hit chance`,
  critMult: v => `critical hits deal +${P(v)} more`, execute: v => `+${P(v)} damage to targets under 25% HP`, dr: v => `take ${P(v)} less damage`,
  block: v => `${P(v)} chance to block a hit completely`, reflect: v => `reflect ${P(v)} of damage taken`, regen: v => `HP regenerates ${P(v)} faster`,
  healBonus: v => `food heals ${P(v)} more`, killHeal: v => `heal ${P(v)} of max HP on each kill`, lowRegen: () => "double HP regen below 30% HP",
  maxHp: v => `+${Math.round(v)} max hitpoints`, racc: v => `+${P(v)} ranged accuracy`, ammoSave: v => `${P(v)} chance to keep an arrow`,
  doubleShot: v => `${P(v)} chance of a free second arrow`, rcrit: v => `${P(v)} ranged critical chance`, rmaxHit: v => `+${v} ranged max hit`,
  drainLess: v => `prayers drain ${P(v)} slower`, buryXp: v => `+${P(v)} XP from burying bones`, ppRegen: v => `regain ${(v / 0.6).toFixed(2)} prayer points/sec`,
  buryRestore: v => `burying bones restores ${Math.round(v)} prayer points`, speed: v => `+${P(v)} gathering success`, double: v => `${P(v)} chance of double resources`,
  fastGather: v => `${P(v)} chance your next gather comes a tick sooner`, potionTime: v => `potions last ${P(v)} longer`, autoBank: v => `${P(v)} chance resources go straight to your bank`, xpBonus: v => `+${P(v)} XP`,
  saveBar: v => `${P(v)} chance to save your bars/ore`, saveMat: v => `${P(v)} chance to save materials`, fastMake: () => "make items 1 tick faster",
  doubleMake: v => `${P(v)} chance of a free extra item`, extraArrows: v => `+${Math.round(v)} arrows per batch`, burnLess: v => v >= 1 ? "never burn food" : `burn ${P(v)} less often`,
  magicAcc: v => `+${P(v)} magic accuracy`, magicDmg: v => `+${P(v)} magic damage`, runeSave: v => `${P(v)} chance to save runes`,
  agilityXp: v => `+${P(v)} Agility XP`, failLess: v => `${P(v)} less chance to fail obstacles`,
  thieveXp: v => `+${P(v)} Thieving XP`, lootChance: v => `+${P(v)} chance of better loot`,
  dodgeMs: v => `+${Math.round(v)} ms dodge i-frames`, rareDrop: v => `+${P(v)} rare drop chance`, magicAdren: v => `+${P(v)} adrenaline from Magic skills`,
  rcXp: v => `+${P(v)} Runecrafting XP`, runeDouble: v => `${P(v)} chance of double runes`
};
export const PERK_MULT = 5;
const FLAGS = new Set(["fastMake", "lowRegen"]);
export const PERK_CAPS = {
  double: 0.75, block: 0.75, ammoSave: 0.75, doubleShot: 0.75, counter: 0.75, autoBank: 0.75, fastGather: 0.75, doubleMake: 0.75,
  saveBar: 0.75, saveMat: 0.75, crit: 0.5, rcrit: 0.5, quick: 0.5, reflect: 0.5, dr: 0.6, acc: 0.6, racc: 0.6, speed: 0.6,
  abilityCd: 0.6, drainLess: 0.75, burnLess: 1, critMult: 1, execute: 0.75, healBonus: 1, regen: 2, killHeal: 0.1,
  extraArrows: 15, xpBonus: 1, buryXp: 1, potionTime: 1, ppRegen: 0.3, maxHp: 100, maxHit: 60, rmaxHit: 40,
  magicAcc: 0.6, magicDmg: 0.5, runeSave: 0.75, agilityXp: 1, failLess: 0.75, thieveXp: 1, lootChance: 0.5, rcXp: 1, runeDouble: 0.5, dodgeMs: 120, rareDrop: 0.25, magicAdren: 0.4
};
export const CAPS_TEXT = "Level bonuses are 5x. Caps: chance effects 75% (crits 50%), damage reduction 60% total, accuracy +60%, food heals +100%, HP regen +200%, heal on kill 10% of max HP, actions never faster than 1 tick.";
function describe(fx) { return Object.entries(fx).map(([k, v]) => FX_LABEL[k] ? FX_LABEL[k](v) : k).join(", "); }

function build(small, big) {
  let ia = 0, ib = 0;
  return PERK_LEVELS.map(level => {
    let name, fx, milestone = false;
    if (big[level]) { [name, fx] = big[level]; milestone = true; }
    else if (level % 10 === 5) { name = `${small[0]} ${ROMAN[ia++]}`; fx = small[1]; }
    else { name = `${small[2]} ${ROMAN[ib++]}`; fx = small[3]; }
    fx = Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, FLAGS.has(k) ? v : +(v * PERK_MULT).toFixed(4)]));
    return { level, name, fx, milestone, desc: describe(fx) };
  });
}
export const PERKS = {
  Attack: build(["Steady Hand", { acc: 0.01 }, "Battle Rhythm", { abilityCd: 0.01 }], {
    25: ["Riposte", { counter: 0.1 }], 50: ["Battle Focus", { abilityCd: 0.08 }], 75: ["Swift Strikes", { quick: 0.1 }], 99: ["Attack Mastery", { acc: 0.04, counter: 0.05 }] }),
  Strength: build(["Brawn", { maxHit: 1 }, "Killer Instinct", { crit: 0.005 }], {
    25: ["Critical Strikes", { crit: 0.04 }], 50: ["Executioner", { execute: 0.25 }], 75: ["Brutal", { critMult: 0.25 }], 99: ["Strength Mastery", { maxHit: 4, crit: 0.02 }] }),
  Defence: build(["Tough Hide", { dr: 0.005 }, "Bracing", { dr: 0.005 }], {
    25: ["Parry", { block: 0.05 }], 50: ["Iron Skin", { dr: 0.03 }], 75: ["Retribution", { reflect: 0.1 }], 99: ["Defence Mastery", { dr: 0.03, block: 0.03 }] }),
  Hitpoints: build(["Hardy", { regen: 0.03 }, "Hearty Eater", { healBonus: 0.01 }], {
    25: ["Bloodlust", { killHeal: 0.03 }], 50: ["Second Wind", { lowRegen: 1 }], 75: ["Iron Constitution", { maxHp: 20 }], 99: ["Hitpoints Mastery", { regen: 0.2, killHeal: 0.02 }] }),
  Ranged: build(["Keen Eye", { racc: 0.01 }, "Thrifty Quiver", { ammoSave: 0.01 }], {
    25: ["Arrow Retrieval", { ammoSave: 0.1 }], 50: ["Double Shot", { doubleShot: 0.08 }], 75: ["Deadeye", { rcrit: 0.06 }], 99: ["Ranged Mastery", { racc: 0.04, rmaxHit: 3 }] }),
  Magic: build(["Arcane Focus", { magicAcc: 0.01 }, "Rune Saver", { runeSave: 0.01 }], {
    25: ["Spell Power", { magicDmg: 0.05 }], 50: ["Efficient Casting", { runeSave: 0.1 }], 75: ["Master of Magic", { magicAcc: 0.05 }], 99: ["Magic Mastery", { magicDmg: 0.08, runeSave: 0.05 }] }),
  Prayer: build(["Devout", { drainLess: 0.01 }, "Blessed Rites", { buryXp: 0.01 }], {
    25: ["Faithful", { ppRegen: 0.03 }], 50: ["Blessed Burial", { buryRestore: 2 }], 75: ["Zealot", { drainLess: 0.1 }], 99: ["Prayer Mastery", { ppRegen: 0.03, buryXp: 0.1 }] }),
  Agility: build(["Light Foot", { agilityXp: 0.01 }, "Sure Step", { failLess: 0.01 }], {
    25: ["Course Runner", { agilityXp: 0.05 }], 50: ["Agile", { failLess: 0.1 }], 75: ["Master Acrobat", { agilityXp: 0.05 }], 99: ["Agility Mastery", { failLess: 0.1, agilityXp: 0.05 }] }),
  Thieving: build(["Nimble Fingers", { thieveXp: 0.01 }, "Lucky Pick", { lootChance: 0.01 }], {
    25: ["Pickpocket", { thieveXp: 0.05 }], 50: ["Better Loot", { lootChance: 0.1 }], 75: ["Master Thief", { thieveXp: 0.05 }], 99: ["Thieving Mastery", { lootChance: 0.1, thieveXp: 0.05 }] }),
  Mining: build(["Keen Pick", { speed: 0.01 }, "Lucky Strike", { double: 0.01 }], {
    25: ["Rich Vein", { fastGather: 0.08 }], 50: ["Ore Cart", { autoBank: 0.05 }], 75: ["Motherlode", { double: 0.08 }], 99: ["Mining Mastery", { speed: 0.04, autoBank: 0.05 }] }),
  Woodcutting: build(["Sharp Edge", { speed: 0.01 }, "Bountiful Bough", { double: 0.01 }], {
    25: ["Chain Chop", { fastGather: 0.08 }], 50: ["Forester's Cart", { autoBank: 0.05 }], 75: ["Heartwood", { double: 0.08 }], 99: ["Woodcutting Mastery", { speed: 0.04, autoBank: 0.05 }] }),
  Fishing: build(["Patient Angler", { speed: 0.01 }, "Double Catch", { double: 0.01 }], {
    25: ["Barbarian Grip", { xpBonus: 0.05, fastGather: 0.04 }], 50: ["Fish Barrel", { autoBank: 0.05 }], 75: ["Double Haul", { double: 0.08 }], 99: ["Fishing Mastery", { speed: 0.04, autoBank: 0.05 }] }),
  Smithing: build(["Bar Saver", { saveBar: 0.01 }, "Smith's Insight", { xpBonus: 0.01 }], {
    25: ["Hot Forge", { fastMake: 1 }], 50: ["Double Smelt", { doubleMake: 0.1 }], 75: ["Master Smith", { saveBar: 0.05 }], 99: ["Smithing Mastery", { xpBonus: 0.05, doubleMake: 0.05 }] }),
  Crafting: build(["Nimble Fingers", { saveMat: 0.01 }, "Artisan's Eye", { xpBonus: 0.01 }], {
    25: ["Quick Hands", { fastMake: 1 }], 50: ["Masterwork", { doubleMake: 0.08 }], 75: ["Thrifty", { saveMat: 0.05 }], 99: ["Crafting Mastery", { xpBonus: 0.05, doubleMake: 0.05 }] }),
  Cooking: build(["Careful Cook", { burnLess: 0.02 }, "Hearty Portions", { healBonus: 0.01 }], {
    25: ["Double Cook", { doubleMake: 0.08 }], 50: ["Quick Chef", { fastMake: 1 }], 75: ["Gourmet", { healBonus: 0.1 }], 99: ["Cooking Mastery", { burnLess: 1 }] }),
  Herblore: build(["Green Fingers", { double: 0.01 }, "Steeped", { potionTime: 0.01 }], {
    25: ["Quick Picker", { fastGather: 0.08 }], 50: ["Potion Master", { doubleMake: 0.08 }], 75: ["Lasting Brews", { potionTime: 0.1 }], 99: ["Herblore Mastery", { xpBonus: 0.05, doubleMake: 0.05 }] }),
  Fletching: build(["Whittler", { extraArrows: 1 }, "Careful Cuts", { saveMat: 0.01 }], {
    25: ["Quick Knife", { fastMake: 1 }], 50: ["Twin Bows", { doubleMake: 0.08 }], 75: ["Arrowsmith", { extraArrows: 3 }], 99: ["Fletching Mastery", { xpBonus: 0.05, doubleMake: 0.05 }] }),
  Runecrafting: build(["Rune Focus", { rcXp: 0.01 }, "Efficient", { runeDouble: 0.01 }], {
    25: ["Better Runes", { rcXp: 0.05 }], 50: ["Double Runes", { runeDouble: 0.1 }], 75: ["Master Runecrafter", { rcXp: 0.05 }], 99: ["Runecrafting Mastery", { runeDouble: 0.1, rcXp: 0.05 }] })
};

export function setPerkBoost(skills, boosts) {
  Object.defineProperty(skills, "_boost", { value: boosts, enumerable: false, writable: true, configurable: true });
}
// Skill synergy web: every 10 levels in one skill gives a small passive to a related skill.
// [from, to, key, per 10 levels]
export const SYNERGY = [
  ['Mining', 'Smithing', 'saveBar', 0.002], ['Fishing', 'Cooking', 'burnLess', 0.01], ['Woodcutting', 'Fletching', 'saveMat', 0.004],
  ['Herblore', 'Hitpoints', 'healBonus', 0.005], ['Cooking', 'Hitpoints', 'regen', 0.01], ['Prayer', 'Magic', 'runeSave', 0.004],
  ['Runecrafting', 'Magic', 'magicDmg', 0.003], ['Thieving', 'Ranged', 'ammoSave', 0.004], ['Fletching', 'Ranged', 'racc', 0.002],
  ['Smithing', 'Defence', 'dr', 0.002], ['Agility', 'Attack', 'quick', 0.003], ['Strength', 'Mining', 'speed', 0.003],
  ['Strength', 'Woodcutting', 'speed', 0.003], ['Crafting', 'Runecrafting', 'runeDouble', 0.003], ['Magic', 'Runecrafting', 'rcXp', 0.004],
  ['Attack', 'Thieving', 'thieveXp', 0.004], ['Agility', 'Combat', 'dodgeMs', 12], ['Thieving', 'Combat', 'rareDrop', 0.02],
  ['Prayer', 'Combat', 'magicAdren', 0.04], ['Defence', 'Agility', 'failLess', 0.004], ['Hitpoints', 'Prayer', 'drainLess', 0.004]
];
export function synergy(skills, skill, key) {
  let v = 0;
  for (const [f, t, k, per] of SYNERGY) if (t === skill && k === key && skills[f]) v += Math.floor(skills[f].level / 10) * per;
  return v;
}
export function synergyLines(skills, skill) {
  return SYNERGY.filter(s => s[0] === skill || s[1] === skill).map(([f, t, k, per]) => {
    const v = Math.floor((skills[f] ? skills[f].level : 1) / 10) * per;
    return { from: f, to: t, gives: f === skill, text: `${f} → ${t}: ${FX_LABEL[k] ? FX_LABEL[k](v) : k} (+${FX_LABEL[k] ? FX_LABEL[k](per).replace(/^\+/, '') : per} per 10 ${f} levels)` };
  });
}
export function perk(skills, skill, key) {
  const lvl = skills[skill] ? skills[skill].level : 1;
  let v = 0;
  for (const p of PERKS[skill] || []) { if (p.level > lvl) break; if (p.fx[key]) v += p.fx[key]; }
  const boost = skills._boost && skills._boost[skill];
  if (boost) v *= 1 + boost;
  v += synergy(skills, skill, key);
  return PERK_CAPS[key] !== undefined ? Math.min(PERK_CAPS[key], v) : v;
}
export function perkTotals(skills, skill) {
  const out = {};
  for (const p of PERKS[skill] || []) {
    if (p.level > skills[skill].level) break;
    for (const [k, v] of Object.entries(p.fx)) out[k] = (out[k] || 0) + v;
  }
  const boost = skills._boost && skills._boost[skill];
  if (boost) for (const k of Object.keys(out)) out[k] *= 1 + boost;
  return Object.entries(out).map(([k, v]) => {
    const cap = PERK_CAPS[k];
    const capped = cap !== undefined && v > cap;
    return (FX_LABEL[k] ? FX_LABEL[k](capped ? cap : v) : k) + (capped ? " (capped)" : "");
  });
}
export function perksBetween(skill, fromLvl, toLvl) {
  return (PERKS[skill] || []).filter(p => p.level > fromLvl && p.level <= toLvl);
}
export function maxPrayer(skills) { return skills.Prayer.level * 10; }
