// Combat skills on the quick bar. Unlocked by combat levels; cooldowns are in game ticks (0.6s).
import { perk } from './skills.js';

export const ABILITIES = [
  { id: 'power', tier: 'basic',    name: 'Power Strike',  icon: '💥', skill: 'Strength', level: 5,  cd: 17, style: 'melee', desc: 'Your next hit deals +60% damage and is more accurate.' },
  { id: 'fortify', tier: 'threshold',  name: 'Fortify',       icon: '🛡️', skill: 'Defence',  level: 5,  cd: 50, style: 'any',   desc: 'Take 50% less damage for 6 seconds.' },
  { id: 'puncture', tier: 'basic', name: 'Puncture',      icon: '🗡️', skill: 'Attack',   level: 10, cd: 25, style: 'melee', desc: 'Strike twice at once.' },
  { id: 'volley', tier: 'basic',   name: 'Rapid Volley',  icon: '🏹', skill: 'Ranged',   level: 10, cd: 30, style: 'ranged', desc: 'Fire three arrows at once (uses 3 arrows).' },
  { id: 'bash', tier: 'basic',     name: 'Shield Bash',   icon: '🔰', skill: 'Defence',  level: 20, cd: 34, style: 'melee', desc: 'A light hit that stuns your target for 3 seconds.' },
  { id: 'rage', tier: 'ultimate',     name: 'Berserk',       icon: '😡', skill: 'Strength', level: 30, cd: 84, style: 'any',   desc: '+20% accuracy and damage for 9 seconds, but you take 10% more damage.' },
  { id: 'snipe', tier: 'threshold',    name: 'Snipe',         icon: '🎯', skill: 'Ranged',   level: 30, cd: 40, style: 'ranged', desc: 'One carefully aimed shot with double max hit.' },
  { id: 'rejuv', tier: 'ultimate',    name: 'Rejuvenate',    icon: '✨', skill: 'Defence',  level: 40, cd: 100, style: 'any',  desc: 'Heal 20% of your hitpoints.' }
];

// Adrenaline (RS3-style): basics build it, thresholds cost 50, ultimates cost 100.
export const ADREN = { basic: { gain: 9, cost: 0 }, threshold: { gain: 0, cost: 50 }, ultimate: { gain: 0, cost: 100 } };
export function adrenCost(a) { return ADREN[a.tier || 'basic'].cost; }
export function adrenGain(a) { return ADREN[a.tier || 'basic'].gain; }
export function abilityById(id) { return ABILITIES.find(a => a.id === id); }
export function unlocked(skills, a) { return skills[a.skill].level >= a.level; }
export function cooldownTicks(skills, a) {
  return Math.max(3, Math.round(a.cd * (1 - perk(skills, 'Attack', 'abilityCd'))));
}
