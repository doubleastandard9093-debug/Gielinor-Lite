// The Wanderer's Saga: a six-chapter personal story told by Chronicler Corwin in Brightwater.
// You pick a calling, your choices are remembered, and they come back later (discounts, a spared bandit,
// a companion who may walk away, and the ending you get). Logic and data only; no new models or textures.
export const CALLINGS = {
  warden: { name: 'Warden', icon: '🛡️', skills: ['Attack', 'Strength', 'Defence'], desc: 'a shield for the weak; +5% melee XP' },
  arcanist: { name: 'Arcanist', icon: '🔮', skills: ['Magic', 'Runecrafting'], desc: 'a seeker of old power; +5% Magic and Runecrafting XP' },
  ranger: { name: 'Ranger', icon: '🏹', skills: ['Ranged', 'Agility'], desc: 'a wanderer of the wilds; +5% Ranged and Agility XP' }
};
// obj: kill | item | visit. Effects: flag, gold, rep [faction, n], bond (active companion), xp.
export const CHAPTERS = [
  { n: 1, title: 'The Ember Letter', req: { total: 0, qp: 0 },
    intro: ['A letter came for you, sealed with an ember. It is from Aldric, the one who taught you to hold a blade.', '"If you read this, I am gone. Something stirs under Falador. Find your calling, and follow the road I left."'],
    obj: { kind: 'kill', mon: 'Goblin', n: 5, text: 'Drive off 5 Goblins troubling the Brightwater farms' },
    done: 'One of the goblins you beat is caught alive, clutching a scrap of Aldric\'s cloak.',
    wheel: [['kind', 'Let it go. It\'s only scared.', { flag: 'mercy', say: 'It bows and scurries off. Somewhere, someone will remember that.' }],
      ['firm', 'Hand it to the Watch.', { rep: ['watch', 40], say: 'The Watch thanks you. The goblin will face a fair hearing.' }],
      ['cunning', 'Tell me where you found that cloak.', { gold: 100, flag: 'clue', say: 'It squeaks out "ash town" and a purse of stolen coin.' }]] },
  { n: 2, title: 'Ashes at Ashford', req: { total: 50, qp: 2 },
    intro: ['Aldric passed through Ashford before it burned. The refugees there are sleeping in the cold.'],
    obj: { kind: 'item', item: 'Cowhide', n: 5, text: 'Bring 5 Cowhide for the refugees\' tents' },
    done: 'The refugees stare at the hides. Their elder asks what you want for them.',
    wheel: [['kind', 'Nothing. Keep warm.', { flag: 'ashfordFriend', say: 'Word spreads. Merchants everywhere give you 5% off from now on.' }],
      ['firm', 'Rebuild the wall, and stand your own watch.', { rep: ['watch', 60], say: 'They raise a palisade that same night.' }],
      ['cunning', 'Coin, and anything you know about Aldric.', { gold: 400, say: 'They pay, and mention a bandit called Varro who robbed him.' }]] },
  { n: 3, title: 'The Bandit Road', req: { total: 80, qp: 5 },
    intro: ['Varro\'s bandits hold the road west. Aldric\'s satchel is with them.'],
    obj: { kind: 'kill', mon: 'Bandit', n: 6, text: 'Break Varro\'s gang: defeat 6 Bandits' },
    done: 'Varro kneels in the dirt and hands back Aldric\'s satchel. Inside: a map of the Port Sarim docks.',
    wheel: [['kind', 'Go, and do better.', { flag: 'varro', say: '"I owe you my life," Varro says. "I won\'t forget it."' }],
      ['firm', 'You\'ll answer to the Watch.', { rep: ['watch', 80], say: 'Captain Brann locks him up with a nod of respect for you.' }],
      ['cunning', 'Work for me now.', { flag: 'varro', gold: 200, say: 'Varro grins and tosses you his share of the loot. "Boss."' }]] },
  { n: 4, title: 'Salt and Smoke', req: { total: 110, qp: 8 },
    intro: ['The map leads to a wreck off Port Sarim, where the drowned dead walk the hold.'],
    obj: { kind: 'kill', mon: 'Skeleton', n: 8, text: 'Clear 8 Skeletons from the wreck-haunted shore' },
    done: 'Among the bones is Aldric\'s journal. The Mariners want it for their records, but it names their harbour master as a smuggler.',
    companionTest: true,
    wheel: [['kind', 'Give them the journal. Let them judge their own.', { rep: ['mariners', 60], say: 'The harbour master is quietly replaced.' }],
      ['firm', 'Arrest the harbour master. Now.', { rep: ['mariners', 30], gold: 300, say: 'The docks go quiet as he is led away.' }],
      ['cunning', 'Sell the page to the harbour master.', { gold: 600, flag: 'smuggler', say: 'He pays well, and owes you one.' }]] },
  { n: 5, title: 'The Lantern Archive', req: { total: 140, qp: 12 },
    intro: ['Aldric\'s journal speaks of an archive under Varrock, sealed with rune-light.'],
    obj: { kind: 'item', item: 'Rune essence', n: 20, text: 'Bring 20 Rune essence to wake the archive seals' },
    varroHelp: 5,
    done: 'The seals open. Aldric\'s last page: he went into the Black Knights\' keep near Falador and never came out.',
    wheel: [['kind', 'Share the archive with the Circle.', { rep: ['circle', 80], say: 'The Arcane Circle names you a friend of the archive.' }],
      ['firm', 'Seal it again. Some things should stay buried.', { rep: ['lantern', 60], say: 'The White Lantern approves.' }],
      ['cunning', 'Copy the best spells for yourself.', { xp: ['Magic', 1500], say: 'Your mind fills with old patterns.' }]] },
  { n: 6, title: 'Aldric\'s Ember', req: { total: 180, qp: 16 },
    intro: ['Falador. The keep of the Black Knights. Whatever happened to Aldric is inside.'],
    obj: { kind: 'kill', mon: 'Black Knight', n: 5, text: 'Fight through 5 Black Knights to reach Aldric' },
    done: 'Aldric is alive, chained and thin. He smiles. "You came. Now: who did you become?"',
    finale: true }
];
export const ENDINGS = {
  kind: { title: 'the Hearthbound', say: 'You became someone people run toward, not away from. Aldric weeps with pride.' },
  firm: { title: 'the Unbroken', say: 'You held the line every time. Aldric says the realm is safer for it.' },
  cunning: { title: 'the Silver-Tongued', say: 'You bent every deal your way. Aldric laughs: "Better than I ever did."' }
};
export function normalizeSaga(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    calling: CALLINGS[s.calling] ? s.calling : null,
    ch: Math.max(0, Math.min(CHAPTERS.length, Math.floor(Number(s.ch) || 0))), // chapters finished
    active: !!s.active, prog: Math.max(0, Math.floor(Number(s.prog) || 0)),
    flags: s.flags && typeof s.flags === 'object' ? Object.fromEntries(Object.entries(s.flags).filter(([, v]) => v === true)) : {},
    choices: Array.isArray(s.choices) ? s.choices.filter(c => c && typeof c.ch === 'number' && typeof c.tone === 'string').slice(0, 12) : [],
    title: typeof s.title === 'string' ? s.title.slice(0, 40) : null
  };
}
export function currentChapter(saga) { return CHAPTERS[saga.ch] || null; }
export function sagaXpBonus(player, skill) { const c = player.saga && CALLINGS[player.saga.calling]; return c && c.skills.includes(skill) ? 0.05 : 0; }
export function objNeed(ch, saga) { return ch.varroHelp && saga.flags.varro ? ch.varroHelp : ch.obj.n; }
// Ending tone: the one you chose most during the saga (ties go to the latest choice).
export function endingTone(saga) {
  const c = { kind: 0, firm: 0, cunning: 0 }; let last = 'kind';
  for (const x of saga.choices) if (c[x.tone] !== undefined) { c[x.tone]++; last = x.tone; }
  const max = Math.max(c.kind, c.firm, c.cunning);
  return c[last] === max ? last : Object.keys(c).find(k => c[k] === max);
}
