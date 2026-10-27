// Errand Ledger: send recruited companions (not the one following you) on real-time errands.
// Results go to the bank, plus XP and faction standing. Success is rolled when the errand starts.
export const ERRANDS = [
  { id: 'e_copper', name: 'Dig copper at the east mine', mins: 15, skill: 'Mining', xp: 120, items: [['Copper ore', 12]], fac: 'watch', rep: 10 },
  { id: 'e_logs', name: 'Cut firewood for the Watch', mins: 20, skill: 'Woodcutting', xp: 140, items: [['Logs', 15]], fac: 'watch', rep: 12 },
  { id: 'e_shrimp', name: 'Net shrimp off the docks', mins: 20, skill: 'Fishing', xp: 140, items: [['Raw shrimp', 15]], fac: 'mariners', rep: 12 },
  { id: 'e_hides', name: 'Trade for cowhides', mins: 30, skill: 'Crafting', xp: 180, items: [['Cowhide', 8]], fac: 'watch', rep: 15 },
  { id: 'e_feathers', name: 'Gather feathers on the farms', mins: 30, skill: 'Fletching', xp: 160, items: [['Feather', 60]], fac: 'watch', rep: 15 },
  { id: 'e_trout', name: 'Fish the river for trout', mins: 45, skill: 'Fishing', xp: 300, items: [['Raw trout', 15]], fac: 'mariners', rep: 20 },
  { id: 'e_iron', name: 'Haul iron from the deep seams', mins: 60, skill: 'Mining', xp: 420, items: [['Iron ore', 15], ['Coal', 10]], fac: 'lantern', rep: 25 },
  { id: 'e_oak', name: 'Fell oaks for the shipwrights', mins: 60, skill: 'Woodcutting', xp: 400, items: [['Oak logs', 20]], fac: 'mariners', rep: 25 },
  { id: 'e_herbs', name: 'Forage herbs in the wilds', mins: 90, skill: 'Herblore', xp: 500, items: [['Grimy guam leaf', 10]], fac: 'circle', rep: 30 },
  { id: 'e_runes', name: 'Ferry essence to the Circle', mins: 120, skill: 'Runecrafting', xp: 650, items: [['Rune essence', 60]], fac: 'circle', rep: 40 },
  { id: 'e_bars', name: 'Work the Falador forges', mins: 240, skill: 'Smithing', xp: 1400, items: [['Iron bar', 12], ['Steel bar', 4]], fac: 'lantern', rep: 70 },
  { id: 'e_patrol', name: 'Ride the long border patrol', mins: 480, skill: 'Defence', xp: 2600, items: [['Bones', 30]], fac: 'watch', rep: 120 }
];
// Crew skills: each companion keeps their own level per errand skill (1-30), earned on errands.
// Yield scales +4% per level above 1 (x2.16 at 30); level = 1 + floor(sqrt(xp / 40)).
export const CREW_MAX = 30;
export function crewLevel(xp) { return Math.min(CREW_MAX, 1 + Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 40))); }
export function crewYield(lvl) { return 1 + 0.04 * (Math.max(1, lvl) - 1); }
export function crewOf(player, comp, skill) { const s = player.companions && player.companions[comp]; return crewLevel(s && s.crew ? s.crew[skill] : 0); }
// Items an errand returns for this companion's crew level.
export function errandItems(e, lvl) { const m = crewYield(lvl); return e.items.map(([it, n]) => [it, Math.max(1, Math.round(n * m))]); }
// Crew XP earned on return (a failed errand still teaches a quarter). Returns { before, after }.
export function crewTrain(player, comp, skill, xp) {
  const s = player.companions[comp]; s.crew = s.crew || {};
  const before = crewLevel(s.crew[skill]); s.crew[skill] = (s.crew[skill] || 0) + Math.round(xp);
  return { before, after: crewLevel(s.crew[skill]) };
}
export function errandById(id) { return ERRANDS.find(e => e.id === id); }
export function errandChance(bond) { return Math.min(1, 0.7 + 0.03 * bond); }
export function startErrand(player, eid, comp, now, rnd = Math.random) {
  const e = errandById(eid), s = player.companions[comp];
  if (!e || !s || !s.recruited || player.activeCompanion === comp) return null;
  if (player.errands.some(r => r.comp === comp)) return null;
  const run = { id: eid, comp, start: now, end: now + e.mins * 60000, ok: rnd() < errandChance(s.bond) };
  player.errands.push(run); return run;
}
// Finished errands (removed from the list), for the caller to reward.
export function collectErrands(player, now) {
  const done = player.errands.filter(r => r.end <= now);
  player.errands = player.errands.filter(r => r.end > now);
  return done;
}
