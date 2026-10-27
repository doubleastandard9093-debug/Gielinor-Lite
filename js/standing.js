// Standing: reputation with four factions. Quests, bounties and errands raise it.
// Each tier gives +1% XP in the faction's skills, and the Falador Quartermaster hands out a one-time reward per tier.
import { QUEST_DATA } from './quests2.js';
import { TOWNS } from './world.js';

export const FACTIONS = [
  { id: 'watch', name: 'Brightwater Watch', icon: '🛡️', towns: ['Brightwater', 'Ashford', 'Wilds'], skills: ['Attack', 'Defence', 'Strength', 'Hitpoints'] },
  { id: 'mariners', name: 'Sarim Mariners', icon: '⚓', towns: ['Port Sarim'], skills: ['Fishing', 'Cooking', 'Ranged'] },
  { id: 'circle', name: 'Varrock Arcane Circle', icon: '🔮', towns: ['Varrock'], skills: ['Magic', 'Runecrafting', 'Herblore'] },
  { id: 'lantern', name: 'Order of the White Lantern', icon: '🏮', towns: ['Falador'], skills: ['Prayer', 'Smithing', 'Mining'] }
];
export const TIERS = [[0, 'Unknown'], [100, 'Friendly'], [300, 'Trusted'], [700, 'Honoured'], [1500, 'Exalted']];
// One-time Quartermaster rewards for reaching each tier (index 1..4) with any faction.
export const TIER_REWARDS = [null, { gold: 250 }, { gold: 600, item: ['Steel bar', 5] }, { gold: 1200, item: ['Pure essence', 50] }, { gold: 3000, item: ['Iron bar', 20] }];
export const QUEST_REP = 40, BOUNTY_REP = 25;

export function factionById(id) { return FACTIONS.find(f => f.id === id); }
export function factionForTown(town) { return FACTIONS.find(f => f.towns.includes(town)) || null; }
export function factionNear(x, z) {
  let best = 'Brightwater', bd = Infinity;
  for (const [n, t] of Object.entries(TOWNS)) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = n; } }
  return factionForTown(best);
}
export function tierOf(rep) { let t = 0; for (let i = 0; i < TIERS.length; i++) if (rep >= TIERS[i][0]) t = i; return t; }
export function nextTier(rep) { const t = tierOf(rep); return t + 1 < TIERS.length ? TIERS[t + 1][0] : null; }
// Total rep = earned rep (bounties, errands; saved) + 40 per finished quest in the faction's towns (derived, so old saves count).
export function questRep(player, fid) {
  const f = factionById(fid); let n = 0;
  for (const q of QUEST_DATA) if (q.town && f.towns.includes(q.town) && player.quests && player.quests[q.id] && player.quests[q.id].stage === 'done') n++;
  return n * QUEST_REP;
}
export function repOf(player, fid) { return Math.min(99999, ((player.rep && player.rep[fid]) || 0) + questRep(player, fid)); }
export function addRep(player, fid, n) {
  player.rep = player.rep || {};
  const before = tierOf(repOf(player, fid));
  player.rep[fid] = Math.min(99999, (player.rep[fid] || 0) + n);
  const tier = tierOf(repOf(player, fid));
  return { tier, up: tier > before };
}
export function standingXpBonus(player, skill) {
  let b = 0; for (const f of FACTIONS) if (f.skills.includes(skill)) b += tierOf(repOf(player, f.id)) * 0.01;
  return b;
}
