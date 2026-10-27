// Silver Tongue: dialogue checks (Persuade, Lie, Intimidate) worked out from skills you already have plus how
// you've spoken on the Words of Choice wheel. No dice: if your score meets the bar, it works. Logic and UI only.
export const CHECKS = {
  persuade: { name: 'Persuade', skill: 'Prayer', tone: 'kind', icon: '🕊️' },
  lie: { name: 'Lie', skill: 'Thieving', tone: 'cunning', icon: '🎭' },
  intimidate: { name: 'Intimidate', skill: 'Strength', tone: 'firm', icon: '✊' }
};
export const BOND_HELP = { bond: 6, bonus: 10 };
// 15 existing quests get a check with their giver. Pass: a bonus purse and XP (once). Fail: that check is spent.
export const QUEST_CHECKS = {
  hilda_pie: ['persuade', 20, 'Talk Granny Hilda into paying for the berries up front'],
  pip_pockets: ['lie', 20, 'Tell Pip you already know who took the purse'],
  osric_graves: ['persuade', 30, 'Convince Osric the dead deserve a fee for their peace'],
  lena_dark: ['intimidate', 30, 'Insist on danger money for the Dark Wood'],
  bram_brew: ['lie', 25, 'Claim the last brewer paid you double'],
  tamsin_tower: ['persuade', 35, 'Ask Tamsin to share a spare rune pouch'],
  aldo_giant: ['intimidate', 40, 'Tell Aldo the giant is worth more than he offers'],
  mara_silk: ['lie', 35, 'Say the spiders took your last pair of gloves'],
  grell_hound: ['persuade', 40, 'Promise Grell you will look after the hound'],
  red_grog: ['intimidate', 35, 'Stare down Redbeard over the price of grog'],
  red_crew: ['lie', 50, 'Pretend to be a navy recruiter to rattle the press gang'],
  wydin_spice: ['persuade', 40, 'Win a merchant\'s discount from Wydin'],
  brice_customs: ['lie', 55, 'Bluff the customs ledger in your favour'],
  thurgo_steel: ['persuade', 50, 'Flatter Thurgo\'s smithing until he adds a bar'],
  velma_brew: ['intimidate', 55, 'Refuse to drink anything until she pays first']
};
export const QUEST_PRIZE = { goldPer: 12, xp: 150 };
export function normalizeTongue(t) {
  t = t && typeof t === 'object' ? t : {};
  const done = {}; const d = t.done && typeof t.done === 'object' ? t.done : {};
  for (const [k, v] of Object.entries(d)) if (v === 'pass' || v === 'fail') done[k] = v;
  return { done, passes: Math.max(0, Math.floor(Number(t.passes) || 0)), fails: Math.max(0, Math.floor(Number(t.fails) || 0)) };
}
// Score = half the skill level + 2 per matching tone used (max +30) + 10 if a high-Bond companion follows you.
export function checkScore(kind, skills, player) {
  const c = CHECKS[kind]; if (!c) return 0;
  const lv = (skills[c.skill] && skills[c.skill].level) || 1;
  const tone = Math.min(30, 2 * ((player.alignment && player.alignment[c.tone]) || 0));
  const comp = player.activeCompanion && player.companions && player.companions[player.activeCompanion];
  return Math.floor(lv / 2) + tone + (comp && comp.bond >= BOND_HELP.bond ? BOND_HELP.bonus : 0);
}
export function checkLabel(kind, need, skills, player, text) {
  const c = CHECKS[kind]; return `${c.icon} [${c.name} ${checkScore(kind, skills, player)}/${need}] ${text}`;
}
export function resolveCheck(T, key, kind, need, skills, player) {
  const ok = checkScore(kind, skills, player) >= need;
  if (key) T.done[key] = ok ? 'pass' : 'fail';
  if (ok) T.passes++; else T.fails++;
  return ok;
}
// The quest check (if any) still open for this NPC: in-progress or finished quests only.
export function openQuestCheck(T, npc, player, questData) {
  for (const [id, chk] of Object.entries(QUEST_CHECKS)) {
    if (T.done['q:' + id]) continue;
    const q = questData.find(x => x.id === id); if (!q || q.giver !== npc) continue;
    if (!(player.quests && player.quests[id])) continue;
    return { id, q, kind: chk[0], need: chk[1], text: chk[2] };
  }
  return null;
}
