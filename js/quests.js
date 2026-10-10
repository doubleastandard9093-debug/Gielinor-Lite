// Quests: data, journal text and dialogue. Pure logic so it can be unit-tested.
// player.quests[id] = { stage, ...counters }. stage 'done' = complete.
//
// Dialogue scripts are arrays of entries:
//   ['npc', 'text'] / ['player', 'text']
//   { choose: [['Option label', [...entries]], ...] }
//   { run: () => {} }   (runs when the conversation reaches it)

export const QUEST_POINTS_TOTAL = 11;

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
  {
    id: 'cook', name: "Cook's Assistant", giver: 'cook', points: 1, start: 'Talk to the Cook in the cookhouse, south-west of the town square.',
    rewards: ['300 Cooking XP', '100 coins', 'Cooked lobster sold at the General Store'],
    bonus: { desc: '+5% Cooking XP and burn food 5% less often', fx: { 'xp.Cooking': 0.05, burnLess: 0.05 } },
    journal(player) {
      const s = q(player, 'cook').stage;
      if (s === 0) return [{ text: this.start }];
      return [
        { text: 'The Cook needs ingredients for the town feast.', done: true },
        { text: `Bring him 2 Raw beef (have ${player.inventory['Raw beef'] || 0}) and 3 Raw shrimp (have ${player.inventory['Raw shrimp'] || 0}).`, done: s === 'done' }
      ];
    },
    reward(g) { g.xp('Cooking', 300); g.gold(100); },
    talk(player, g) {
      const s = q(player, 'cook').stage;
      if (s === 'done') return [['npc', 'Thanks again! The feast was the talk of the town. I sell lobster through the General Store now.']];
      if (s === 0) return [
        ['npc', 'Oh dear, oh dear! The town feast is tonight and I have nothing to cook!'],
        ['player', "What's wrong?"],
        ['npc', 'I need 2 Raw beef and 3 Raw shrimp. Cows are in the field to the north-west, and you can net shrimp at the lake.'],
        { choose: [
          ["I'll get them for you.", [{ run: () => setQ(player, 'cook', { stage: 1 }) }, ['npc', 'Bless you! Hurry back.']]],
          ["Sorry, I'm busy.", [['npc', 'Oh... well, if you change your mind...']]]
        ] }
      ];
      if (g.has('Raw beef', 2) && g.has('Raw shrimp', 3)) return [
        ['player', "I've got your beef and shrimp."],
        { run: () => { g.take('Raw beef', 2); g.take('Raw shrimp', 3); } },
        ['npc', "Wonderful! You've saved the feast! Here, take this for your trouble."],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Remember: 2 Raw beef and 3 Raw shrimp. The feast is tonight!']];
    }
  },
  {
    id: 'fallen', name: 'Rest for the Fallen', giver: 'priest', points: 1, start: 'Talk to Father Elric outside the church, north of the town square.',
    rewards: ['250 Prayer XP', 'Unlocks the Protect from Melee prayer (Prayer 43)', '2 Cooked trout'],
    bonus: { desc: 'Prayers drain 5% slower and you slowly regain prayer points', fx: { drainLess: 0.05, ppRegen: 0.02 } },
    journal(player) {
      const st = q(player, 'fallen');
      if (st.stage === 0) return [{ text: this.start }];
      return [
        { text: `Bury 5 bones to lay the restless dead to rest (${Math.min(5, st.buried || 0)}/5).`, done: st.stage === 'done' || st.stage >= 2 },
        { text: 'Pray at the church altar.', done: st.stage === 'done' || st.stage >= 3 },
        { text: 'Return to Father Elric.', done: st.stage === 'done' }
      ];
    },
    reward(g) { g.xp('Prayer', 250); g.give('Cooked trout', 2); },
    talk(player, g) {
      const st = q(player, 'fallen');
      if (st.stage === 'done') return [['npc', 'The dead sleep soundly thanks to you. May Saradomin guard you in battle.']];
      if (st.stage === 0) return [
        ['npc', 'Welcome, child. Restless spirits stir around Brightwater. Too many have fallen unburied.'],
        ['npc', 'Bury the bones of 5 fallen creatures, then pray at my altar. I will teach you a prayer of protection.'],
        { choose: [
          ['I will help the dead rest.', [{ run: () => setQ(player, 'fallen', { stage: 1, buried: 0 }) }, ['npc', 'Tap bones in your pack to bury them. Go with peace.']]],
          ['Not now, Father.', [['npc', 'The dead are patient. I will be here.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `You have laid ${st.buried || 0} of 5 to rest. Goblins and cows leave bones aplenty.`]];
      if (st.stage === 2) return [['npc', 'Well done. Now pray at the altar beside me.']];
      return [
        ['npc', 'I felt the spirits settle. You have done a holy thing.'],
        ['npc', 'When your faith is strong enough, you may call on Protect from Melee.'],
        { run: () => finish(player, this, g) }
      ];
    }
  },
  {
    id: 'doric', name: "Doric's Quest", giver: 'doric', points: 1, start: 'Talk to Doric at the smithy, south-east of the town square.',
    rewards: ['400 Mining XP', '180 coins', 'Mithril and adamant tools sold at the Tool Shop'],
    bonus: { desc: '+5% Mining and Smithing XP', fx: { 'xp.Mining': 0.05, 'xp.Smithing': 0.05 } },
    journal(player) {
      const s = q(player, 'doric').stage;
      if (s === 0) return [{ text: this.start }];
      const h = i => player.inventory[i] || 0;
      return [{ text: `Bring Doric 4 Copper ore (${h('Copper ore')}), 4 Tin ore (${h('Tin ore')}) and 2 Iron ore (${h('Iron ore')}).`, done: s === 'done' }];
    },
    reward(g) { g.xp('Mining', 400); g.gold(180); },
    talk(player, g) {
      const s = q(player, 'doric').stage;
      if (s === 'done') return [['npc', "Bob's selling my mithril and adamant tools now. Tell him Doric sent you!"]];
      if (s === 0) return [
        ['npc', "Hello traveller. I'm Doric, the town smith. I'm short of ore for a big order."],
        ['npc', "Bring me 4 Copper ore, 4 Tin ore and 2 Iron ore and I'll make it worth your while. The mine's south-east."],
        { choose: [
          ["Sure, I'll mine some.", [{ run: () => setQ(player, 'doric', { stage: 1 }) }, ['npc', "Grand! You'll need a pickaxe on your toolbelt."]]],
          ['No thanks.', [['npc', 'Suit yourself.']]]
        ] }
      ];
      if (g.has('Copper ore', 4) && g.has('Tin ore', 4) && g.has('Iron ore', 2)) return [
        ['player', "Here's your ore."],
        { run: () => { g.take('Copper ore', 4); g.take('Tin ore', 4); g.take('Iron ore', 2); } },
        ['npc', "Lovely stuff! With this I can finish those mithril and adamant tools. I'll send them to Bob's Tool Shop."],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', '4 Copper, 4 Tin and 2 Iron ore. The mine is south-east of town.']];
    }
  },
  {
    id: 'goblins', name: 'Goblin Trouble', giver: 'captain', points: 2, start: 'Talk to Captain Rhea on the south road out of town.',
    rewards: ['600 Attack XP', '600 Strength XP', 'Steel sword'],
    bonus: { desc: '+10% damage against goblins and hill giants, +20 max hitpoints', fx: { 'dmgVs.Goblin': 0.1, 'dmgVs.Hill Giant': 0.1, maxHp: 20 } },
    journal(player) {
      const st = q(player, 'goblins');
      if (st.stage === 0) return [{ text: this.start }];
      return [
        { text: `Kill 5 goblins north-east of town (${Math.min(5, st.kills || 0)}/5).`, done: st.stage === 'done' || st.stage >= 2 },
        { text: 'Report to Captain Rhea.', done: st.stage === 'done' || st.stage >= 3 },
        { text: 'Slay a Hill Giant in the northern hills.', done: st.stage === 'done' || st.stage >= 4 },
        { text: 'Return to Captain Rhea.', done: st.stage === 'done' }
      ];
    },
    reward(g) { g.xp('Attack', 600); g.xp('Strength', 600); g.give('Steel sword', 1); },
    talk(player, g) {
      const st = q(player, 'goblins');
      if (st.stage === 'done') return [['npc', "The roads are safer thanks to you, soldier. That steel suits you."]];
      if (st.stage === 0) return [
        ['npc', 'Halt! Ah, a capable-looking adventurer. Goblins have been raiding our farms to the north-east.'],
        ['npc', 'Thin their numbers: kill 5 of them and report back.'],
        { choose: [
          ["I'll deal with them.", [{ run: () => setQ(player, 'goblins', { stage: 1, kills: 0 }) }, ['npc', 'Good. Keep some food with you.']]],
          ["I'm not a fighter.", [['npc', 'Then train up and come back.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `${st.kills || 0} of 5 goblins down. Keep at it.`]];
      if (st.stage === 2) return [
        ['npc', 'Fine work. But my scouts say the goblins answer to a Hill Giant in the hills north of town.'],
        ['npc', 'Slay one and the raids should stop. Giants hit hard: bring food and use your combat skills.'],
        { run: () => setQ(player, 'goblins', { stage: 3 }) }
      ];
      if (st.stage === 3) return [['npc', 'The Hill Giants live up the north road, past the church.']];
      return [
        ['npc', "A Hill Giant? Ha! You've earned this steel blade."],
        { run: () => finish(player, this, g) }
      ];
    }
  },
  {
    id: 'hides', name: "Farmer's Hides", giver: 'farmer', points: 1, start: 'Talk to Farmer Gil at the cow field gate, north-west of town.',
    rewards: ['350 Crafting XP', '150 coins', 'Fly fishing rod and 30 feathers', 'Oak shortbows sold at the General Store'],
    bonus: { desc: '+5% Crafting XP and 5% off everything in shops', fx: { 'xp.Crafting': 0.05, shopDiscount: 0.05 } },
    journal(player) {
      const s = q(player, 'hides').stage;
      if (s === 0) return [{ text: this.start }];
      return [
        { text: `Bring Farmer Gil 5 Cowhide (have ${player.inventory.Cowhide || 0}).`, done: s === 'done' || s >= 2 },
        { text: 'Tan hide, sew a Leather body (Crafting tab, needs Crafting 14) and bring it to Gil.', done: s === 'done' }
      ];
    },
    reward(g) { g.xp('Crafting', 350); g.gold(150); g.tool('Fly fishing rod'); g.give('Feather', 30); },
    talk(player, g) {
      const s = q(player, 'hides').stage;
      if (s === 'done') return [['npc', 'That leather body keeps me warm every morning. Thank you kindly!']];
      if (s === 0) return [
        ['npc', "Mornin'. My cows are fine, but I'm short of hides for the tanner."],
        ['npc', "Could you bring me 5 Cowhide? There's a reward in it."],
        { choose: [
          ['Happy to help.', [{ run: () => setQ(player, 'hides', { stage: 1 }) }, ['npc', "Great! The cows won't mind. Much."]]],
          ['No.', [['npc', 'Fair enough.']]]
        ] }
      ];
      if (s === 1) {
        if (g.has('Cowhide', 5)) return [
          ['player', 'Here are 5 cowhides.'],
          { run: () => { g.take('Cowhide', 5); setQ(player, 'hides', { stage: 2 }); } },
          ['npc', "Perfect. Now, could you make me a Leather body? Tan a hide, then sew it with a needle. You'll need Crafting 14."]
        ];
        return [['npc', `I still need 5 Cowhide. You have ${player.inventory.Cowhide || 0}.`]];
      }
      if (g.has('Leather body', 1)) return [
        ['player', 'Here is your Leather body.'],
        { run: () => g.take('Leather body', 1) },
        ['npc', "Fits like a glove! Here, take my old fishing rod and some feathers. I'll tell the Merchant to stock oak bows."],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Bring me a Leather body when you can make one.']];
    }
  },
  {
    id: 'tools', name: 'Tools of the Trade', giver: 'bob', points: 1, start: "Talk to Bob at Bob's Brilliant Tools, north-east of the square.",
    rewards: ['300 Smithing XP', '300 Woodcutting XP', '150 coins'],
    bonus: { desc: '+3% success when mining, woodcutting and fishing', fx: { gather: 0.03 } },
    journal(player) {
      const s = q(player, 'tools').stage;
      if (s === 0) return [{ text: this.start }];
      const h = i => player.inventory[i] || 0;
      return [{ text: `Bring Bob 3 Iron bars (${h('Iron bar')}) and 5 Oak logs (${h('Oak logs')}) for new tool handles.`, done: s === 'done' }];
    },
    reward(g) { g.xp('Smithing', 300); g.xp('Woodcutting', 300); g.gold(150); },
    talk(player, g) {
      const s = q(player, 'tools').stage;
      if (s === 'done') return [['npc', 'Those new axes are flying off the shelves! You know your tools, friend.']];
      if (s === 0) return [
        ['npc', "Business is booming but I'm out of stock! I need iron for the heads and oak for the handles."],
        ['npc', 'Bring me 3 Iron bars and 5 Oak logs and I\'ll share a trick or two of the trade.'],
        { choose: [
          ["I'll get them.", [{ run: () => setQ(player, 'tools', { stage: 1 }) }, ['npc', 'Smelt iron ore at the furnace in the smithy. Oaks grow far to the north-east.']]],
          ['Not now.', [['npc', 'Come back when you can.']]]
        ] }
      ];
      if (g.has('Iron bar', 3) && g.has('Oak logs', 5)) return [
        ['player', "Here's the iron and oak."],
        { run: () => { g.take('Iron bar', 3); g.take('Oak logs', 5); } },
        ['npc', 'Perfect! Here\'s the trick: hold your tool like this and swing from the hip. You\'ll gather faster from now on.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', '3 Iron bars and 5 Oak logs, please!']];
    }
  },
  {
    id: 'supply', name: 'Supply Run', giver: 'merchant', points: 1, start: 'Talk to the Merchant at the General Store stall, east of the square.',
    rewards: ['250 Fletching XP', '300 coins', 'Amulet of accuracy'],
    bonus: { desc: 'Shops pay you 10% more and +5% Fletching XP', fx: { sellBonus: 0.1, 'xp.Fletching': 0.05 } },
    journal(player) {
      const s = q(player, 'supply').stage;
      if (s === 0) return [{ text: this.start }];
      const h = i => player.inventory[i] || 0;
      return [{ text: `Bring the Merchant 10 Cooked shrimp (${h('Cooked shrimp')}) and 30 Bronze arrows (${h('Bronze arrows')}) for the guards.`, done: s === 'done' }];
    },
    reward(g) { g.xp('Fletching', 250); g.gold(300); g.give('Amulet of accuracy', 1); },
    talk(player, g) {
      const s = q(player, 'supply').stage;
      if (s === 'done') return [['npc', 'The guards loved those supplies. I\'ll always pay you top coin!']];
      if (s === 0) return [
        ['npc', 'The tower guards ordered food and arrows, and my supplier never came!'],
        ['npc', 'Could you bring me 10 Cooked shrimp and 30 Bronze arrows?'],
        { choose: [
          ['Leave it to me.', [{ run: () => setQ(player, 'supply', { stage: 1 }) }, ['npc', 'Wonderful! Arrows are fletched from bronze bars and logs.']]],
          ['Sorry, no.', [['npc', 'Oh well.']]]
        ] }
      ];
      if (g.has('Cooked shrimp', 10) && g.has('Bronze arrows', 30)) return [
        ['player', 'Here are the supplies.'],
        { run: () => { g.take('Cooked shrimp', 10); g.take('Bronze arrows', 30); } },
        ['npc', "You're a lifesaver! Take this amulet, and from now on I'll pay you extra for your goods."],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', '10 Cooked shrimp and 30 Bronze arrows, if you please.']];
    }
  },
  {
    id: 'archers', name: 'Archers in the Woods', giver: 'ranger', points: 1, start: 'Talk to Ranger Wyn on the western edge of town.',
    rewards: ['600 Ranged XP', 'Archer ring'],
    bonus: { desc: '+2 ranged max hit and +10% damage against dark archers', fx: { rmaxHit: 2, 'dmgVs.Dark Archer': 0.1 } },
    journal(player) {
      const st = q(player, 'archers');
      if (st.stage === 0) return [{ text: this.start }];
      return [
        { text: `Defeat 3 Dark Archers west of the lake (${Math.min(3, st.kills || 0)}/3).`, done: st.stage === 'done' || st.stage >= 2 },
        { text: 'Return to Ranger Wyn.', done: st.stage === 'done' }
      ];
    },
    reward(g) { g.xp('Ranged', 600); g.give('Archer ring', 1); },
    talk(player, g) {
      const st = q(player, 'archers');
      if (st.stage === 'done') return [['npc', 'The woods are quiet again. Keep that ring, it suits a good shot.']];
      if (st.stage === 0) return [
        ['npc', 'Dark archers have set up camp west of the lake. They shoot at anyone gathering wood.'],
        ['npc', 'Defeat 3 of them. Their arrows bite, so wear something with good ranged defence: leather works well.'],
        { choose: [
          ["I'll take care of them.", [{ run: () => setQ(player, 'archers', { stage: 1, kills: 0 }) }, ['npc', 'Good hunting.']]],
          ['Too dangerous for me.', [['npc', 'Come back when you\'re ready.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `${st.kills || 0} of 3 dark archers down.`]];
      return [['npc', 'You did it! Here, a ring fit for an archer.'], { run: () => finish(player, this, g) }];
    }
  },
  {
    id: 'honour', name: "Knight's Honour", giver: 'knight', points: 2, start: 'Talk to Sir Vyvin on the north road, past the church.',
    rewards: ['1000 Defence XP', '500 Attack XP', 'Amulet of glory'],
    bonus: { desc: 'Take 3% less damage, +30 max hitpoints, +10% damage against black knights', fx: { dr: 0.03, maxHp: 30, 'dmgVs.Black Knight': 0.1 } },
    journal(player) {
      const st = q(player, 'honour');
      if (st.stage === 0) return [{ text: this.start }];
      return [
        { text: `Defeat 2 Black Knights in the northern hills (${Math.min(2, st.kills || 0)}/2).`, done: st.stage === 'done' || st.stage >= 2 },
        { text: `Bring Sir Vyvin a Steel full helm as proof of your skill (have ${player.inventory['Steel full helm'] || 0}).`, done: st.stage === 'done' }
      ];
    },
    reward(g) { g.xp('Defence', 1000); g.xp('Attack', 500); g.give('Amulet of glory', 1); },
    talk(player, g) {
      const st = q(player, 'honour');
      if (st.stage === 'done') return [['npc', 'Brightwater is proud of you, knight.']];
      if (st.stage === 0) return [
        ['npc', 'The Black Knights dishonour the northern hills. A true knight would stand against them.'],
        ['npc', 'Defeat 2 of them, then bring me a Steel full helm, smithed or won, and I will name you a knight.'],
        { choose: [
          ['I accept.', [{ run: () => setQ(player, 'honour', { stage: 1, kills: 0 }) }, ['npc', 'For Brightwater!']]],
          ['Not today.', [['npc', 'Honour can wait, but not forever.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `You have bested ${st.kills || 0} of 2 Black Knights.`]];
      if (g.has('Steel full helm', 1)) return [
        ['player', 'I defeated them, and here is a steel helm.'],
        { run: () => g.take('Steel full helm', 1) },
        ['npc', 'Kneel... Rise, a knight of Brightwater! Wear this amulet with pride.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Now bring me a Steel full helm. Doric can show you the anvil.']];
    }
  }
];

export function questById(id) { return QUESTS.find(x => x.id === id); }
export function questForNpc(npc) { return QUESTS.find(x => x.giver === npc); }

// ---- Hooks from the game. Each returns chat messages. ----
export function onKill(player, monName) {
  const out = [];
  for (const [id, mon, need] of [['archers', 'Dark Archer', 3], ['honour', 'Black Knight', 2]]) {
    const st = q(player, id);
    if (st.stage === 1 && monName === mon) {
      const kills = (st.kills || 0) + 1;
      setQ(player, id, { kills, stage: kills >= need ? 2 : 1 });
      const qn = QUESTS.find(x => x.id === id).name;
      out.push(kills >= need ? `${qn}: done! Return to ${id === 'archers' ? 'Ranger Wyn' : 'Sir Vyvin'}.` : `${qn}: ${kills}/${need} ${mon.toLowerCase()}s defeated.`);
    }
  }
  const st = q(player, 'goblins');
  if (st.stage === 1 && monName === 'Goblin') {
    const kills = (st.kills || 0) + 1;
    setQ(player, 'goblins', { kills, stage: kills >= 5 ? 2 : 1 });
    out.push(kills >= 5 ? 'Goblin Trouble: that\'s 5 goblins. Report to Captain Rhea.' : `Goblin Trouble: ${kills}/5 goblins killed.`);
  } else if (st.stage === 3 && monName === 'Hill Giant') {
    setQ(player, 'goblins', { stage: 4 });
    out.push('Goblin Trouble: you slew a Hill Giant! Return to Captain Rhea.');
  }
  return out;
}
export function onBury(player) {
  const st = q(player, 'fallen');
  if (st.stage !== 1) return [];
  const buried = (st.buried || 0) + 1;
  setQ(player, 'fallen', { buried, stage: buried >= 5 ? 2 : 1 });
  return [buried >= 5 ? 'Rest for the Fallen: the spirits are calmer. Pray at the church altar.' : `Rest for the Fallen: ${buried}/5 bones buried.`];
}
export function onPray(player) {
  const st = q(player, 'fallen');
  if (st.stage !== 2) return [];
  setQ(player, 'fallen', { stage: 3 });
  return ['Rest for the Fallen: you feel the spirits settle. Return to Father Elric.'];
}

// Plain talk lines for town NPCs that don't give quests.
export const NPC_INFO = {
  cook: { name: 'Cook', examine: 'The head cook of Brightwater.' },
  priest: { name: 'Father Elric', examine: 'A kindly priest of Saradomin.' },
  doric: { name: 'Doric', examine: 'A dwarven smith with strong arms.' },
  captain: { name: 'Captain Rhea', examine: 'Captain of the Brightwater guard.' },
  farmer: { name: 'Farmer Gil', examine: 'He smells faintly of cow.' },
  bob: { name: 'Bob', examine: 'An expert on axes, pickaxes and other tools.' },
  ranger: { name: 'Ranger Wyn', examine: 'A sharp-eyed ranger of the western woods.' },
  knight: { name: 'Sir Vyvin', examine: 'A knight in shining armour.' },
  merchant: { name: 'Merchant', examine: 'A trader of general goods.' },
  banker: { name: 'Banker', examine: 'Good with money.' }
};

// ---- Lasting quest bonuses ----
// Quest-point milestones give extra bonuses on top of each quest's own bonus.
export const QP_MILESTONES = [
  { qp: 3, desc: 'Run energy restores 25% faster', fx: { runRegen: 0.25 } },
  { qp: 6, desc: '+2% XP in every skill', fx: { 'xp.*': 0.02 } },
  { qp: 9, desc: '+20 max hitpoints', fx: { maxHp: 20 } },
  { qp: 11, desc: 'Every quest done: Quest point cape and +3% XP in every skill', fx: { 'xp.*': 0.03 } }
];
// Sum of one bonus from every completed quest and reached milestone.
export function questFx(player, key) {
  let v = 0;
  for (const x of QUESTS) if (x.bonus && x.bonus.fx[key] && isDone(player, x.id)) v += x.bonus.fx[key];
  const qp = questPoints(player);
  for (const m of QP_MILESTONES) if (qp >= m.qp && m.fx[key]) v += m.fx[key];
  return v;
}
export function activeQuestBonuses(player) {
  const qp = questPoints(player);
  return {
    quests: QUESTS.map(x => ({ name: x.name, desc: x.bonus.desc, active: isDone(player, x.id) })),
    milestones: QP_MILESTONES.map(m => ({ ...m, active: qp >= m.qp }))
  };
}
