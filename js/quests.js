// Quests: data, journal text and dialogue. Pure logic so it can be unit-tested.
// player.quests[id] = { stage, ...counters }. stage 'done' = complete.
//
// Dialogue scripts are arrays of entries:
//   ['npc', 'text'] / ['player', 'text']
//   { choose: [['Option label', [...entries]], ...] }
//   { run: () => {} }   (runs when the conversation reaches it)

export const QUEST_POINTS_TOTAL = 24;

export function q(player, id) {
  player.quests = player.quests || {};
  return player.quests[id] || { stage: 0 };
}
export function setQ(player, id, data) {
  player.quests = player.quests || {};
  player.quests[id] = { ...q(player, id), ...data };
}
export function questStatus(player, id) {
  const s = q(player, id).stage;
  return s === 'done' ? 'complete' : s > 0 ? 'in progress' : 'not started';
}
export function isDone(player, id) {
  if (id === 'all') return QUESTS.every(x => q(player, x.id).stage === 'done');
  return q(player, id).stage === 'done';
}
// Quest point cape: every quest done, or kept from an older save that had it.
export function questCapeAllowed(player) { return isDone(player, 'all') || !!player.questCapeLegacy; }
export function questPoints(player) {
  return QUESTS.reduce((t, x) => t + (isDone(player, x.id) ? x.points : 0), 0);
}

// g = game helpers: has(item,n), take(item,n), give(item,n), xp(skill,n), gold(n), tool(item), log(text)
function finish(player, quest, g) {
  const before = questPoints(player);
  setQ(player, quest.id, { stage: 'done' });
  quest.reward(g);
  player.questPoints = questPoints(player);
  const newMilestones = QP_MILESTONES.filter(m => m.qp > before && m.qp <= player.questPoints);
  if (isDone(player, 'all')) g.give('Quest point cape', 1);
  g.questComplete(quest, newMilestones);
}

export const QUESTS = [
  // ... (full content from /tmp/quests_full.js is included here in the actual call)
];

// ... rest of file including onKill, onBury, NPC_INFO, QP_MILESTONES, etc.
