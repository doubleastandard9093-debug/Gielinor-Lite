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
    reward(g) { g.xp('Cooking', 1500); g.gold(500); },
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
    reward(g) { g.xp('Prayer', 1250); g.give('Cooked trout', 10); },
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
    reward(g) { g.xp('Mining', 2000); g.gold(900); },
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
    reward(g) { g.xp('Attack', 3000); g.xp('Strength', 3000); g.give('Steel sword', 1); },
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
    reward(g) { g.xp('Crafting', 1750); g.gold(750); g.tool('Fly fishing rod'); g.give('Feather', 150); },
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
    reward(g) { g.xp('Smithing', 1500); g.xp('Woodcutting', 1500); g.gold(750); },
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
    reward(g) { g.xp('Fletching', 1250); g.gold(1500); g.give('Amulet of accuracy', 1); },
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
    reward(g) { g.xp('Ranged', 3000); g.give('Archer ring', 1); },
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
    reward(g) { g.xp('Defence', 5000); g.xp('Attack', 2500); g.give('Amulet of glory', 1); },
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
  },
  {
    id: 'fishing', name: "Fisherman's Catch", giver: 'fisherman', points: 1, start: 'Talk to Fisherman Fred by the lake, south-west of town.',
    rewards: ['400 Fishing XP', '200 coins', 'Harpoon (if you lack one)'],
    bonus: { desc: '+5% Fishing XP', fx: { 'xp.Fishing': 0.05 } },
    journal(player) {
      const s = q(player, 'fishing').stage;
      if (s === 0) return [{ text: this.start }];
      const h = i => player.inventory[i] || 0;
      return [{ text: `Bring Fisherman Fred 5 Raw trout (${h('Raw trout')}) and 3 Raw salmon (${h('Raw salmon')}).`, done: s === 'done' }];
    },
    reward(g) { g.xp('Fishing', 2000); g.gold(1000); g.tool('Harpoon'); },
    talk(player, g) {
      const s = q(player, 'fishing').stage;
      if (s === 'done') return [['npc', 'Those trout and salmon were perfect! The lake's been good to us both.']];
      if (s === 0) return [
        ['npc', 'Ahoy! The market wants more fish, but my old bones aren't what they used to be.'],
        ['npc', 'Could you bring me 5 Raw trout and 3 Raw salmon from the lake? Lure spots for trout, harpoon for salmon.'],
        { choose: [
          ['Happy to fish for you.', [{ run: () => setQ(player, 'fishing', { stage: 1 }) }, ['npc', 'Grand! The lake is just south-west.']]],
          ['Maybe later.', [['npc', 'The fish will still be there.']]]
        ] }
      ];
      if (g.has('Raw trout', 5) && g.has('Raw salmon', 3)) return [
        ['player', 'Here are the fish you asked for.'],
        { run: () => { g.take('Raw trout', 5); g.take('Raw salmon', 3); } },
        ['npc', 'Beautiful catch! Take this for your trouble, and a little something to help with future fishing.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Still need 5 Raw trout and 3 Raw salmon. The lake is south-west.']];
    }
  },
  {
    id: 'ashford_help', name: 'Ashford\'s Plea', giver: 'mayor', points: 1, start: 'Talk to Mayor Aldric in Ashford, far to the east.',
    rewards: ['2000 XP in any skill', '1000 coins', 'Steel pickaxe'],
    bonus: { desc: '+3% XP in all skills', fx: { 'xp.*': 0.03 } },
    journal(player) {
      const s = q(player, 'ashford_help').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring the Mayor 10 Copper ore, 10 Tin ore and 5 Iron ore from the eastern mines.', done: s === 'done' }];
    },
    reward(g) { g.xp('Mining', 2000); g.gold(1000); g.tool('Steel pickaxe'); },
    talk(player, g) {
      const s = q(player, 'ashford_help').stage;
      if (s === 'done') return [['npc', 'Ashford thrives again thanks to your ore!']];
      if (s === 0) return [
        ['npc', 'Traveller! Ashford\'s mines are short-staffed and the store shelves are bare.'],
        ['npc', 'Bring me 10 Copper, 10 Tin and 5 Iron ore. The mines lie further east.'],
        { choose: [
          ['I will help Ashford.', [{ run: () => setQ(player, 'ashford_help', { stage: 1 }) }, ['npc', 'Thank you. The path east leads to the mines.']]],
          ['Not today.', [['npc', 'We can wait a little longer.']]]
        ] }
      ];
      if (g.has('Copper ore', 10) && g.has('Tin ore', 10) && g.has('Iron ore', 5)) return [
        ['player', 'Here is the ore you requested.'],
        { run: () => { g.take('Copper ore', 10); g.take('Tin ore', 10); g.take('Iron ore', 5); } },
        ['npc', 'Excellent! Take this pickaxe and gold for your efforts.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'We still need 10 Copper, 10 Tin and 5 Iron ore.']];
    }
  },
  {
    id: 'eastern_guards', name: 'Guard Duty', giver: 'guard2', points: 1, start: 'Talk to Guard Captain Ryn in Ashford.',
    rewards: ['2500 Attack XP', '2500 Strength XP', 'Steel full helm'],
    bonus: { desc: '+5% damage against goblins', fx: { 'dmgVs.Goblin': 0.05 } },
    journal(player) {
      const st = q(player, 'eastern_guards');
      if (st.stage === 0) return [{ text: this.start }];
      return [{ text: `Defeat 8 goblins near Ashford (${Math.min(8, st.kills || 0)}/8).`, done: st.stage === 'done' }];
    },
    reward(g) { g.xp('Attack', 2500); g.xp('Strength', 2500); g.give('Steel full helm', 1); },
    talk(player, g) {
      const st = q(player, 'eastern_guards');
      if (st.stage === 'done') return [['npc', 'The roads are safer. Well done.']];
      if (st.stage === 0) return [
        ['npc', 'Goblins have been raiding the eastern farms. Thin their ranks.'],
        ['npc', 'Defeat 8 goblins and report back.'],
        { choose: [
          ['I accept.', [{ run: () => setQ(player, 'eastern_guards', { stage: 1, kills: 0 }) }, ['npc', 'Good. Stay sharp.']]],
          ['Too busy.', [['npc', 'Come back when you can.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `${st.kills || 0} of 8 goblins defeated.`]];
      if (st.stage === 2) return [
        ['npc', 'You defeated the goblins. The farms are safer.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Report when you have slain 8 goblins.']];
    }
  },
  {
    id: 'herbs_for_wren', name: 'Herb Gathering', giver: 'herbalist', points: 1, start: 'Talk to Herbalist Wren near Ashford.',
    rewards: ['1800 Crafting XP', '800 coins', '50 Feathers'],
    bonus: { desc: '+5% Crafting XP', fx: { 'xp.Crafting': 0.05 } },
    journal(player) {
      const s = q(player, 'herbs_for_wren').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Wren 20 Flax and 10 Cowhide.', done: s === 'done' }];
    },
    reward(g) { g.xp('Crafting', 1800); g.gold(800); g.give('Feather', 50); },
    talk(player, g) {
      const s = q(player, 'herbs_for_wren').stage;
      if (s === 'done') return [['npc', 'These materials will make fine potions and armour. Thank you!']];
      if (s === 0) return [
        ['npc', 'I need flax for potions and cowhide for leatherwork. Can you gather some?'],
        ['npc', 'Bring 20 Flax and 10 Cowhide.'],
        { choose: [
          ['I will gather them.', [{ run: () => setQ(player, 'herbs_for_wren', { stage: 1 }) }, ['npc', 'The fields and cow pens are nearby.']]],
          ['Later.', [['npc', 'The herbs can wait.']]]
        ] }
      ];
      if (g.has('Flax', 20) && g.has('Cowhide', 10)) return [
        ['player', 'Here are the flax and hides.'],
        { run: () => { g.take('Flax', 20); g.take('Cowhide', 10); } },
        ['npc', 'Perfect! Take these feathers and coins.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Still need 20 Flax and 10 Cowhide.']];
    }
  },
  {
    id: 'smith_order', name: 'Torin\'s Order', giver: 'smith2', points: 1, start: 'Talk to Smith Torin in Ashford Smithy.',
    rewards: ['2000 Smithing XP', '1200 coins', 'Mithril bar'],
    bonus: { desc: '+5% Smithing XP', fx: { 'xp.Smithing': 0.05 } },
    journal(player) {
      const s = q(player, 'smith_order').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Torin 8 Iron bars and 4 Coal.', done: s === 'done' }];
    },
    reward(g) { g.xp('Smithing', 2000); g.gold(1200); g.give('Mithril bar', 1); },
    talk(player, g) {
      const s = q(player, 'smith_order').stage;
      if (s === 'done') return [['npc', 'These bars will make fine tools. My thanks!']];
      if (s === 0) return [
        ['npc', 'I have a big order for tools. I need iron bars and coal.'],
        ['npc', 'Bring me 8 Iron bars and 4 Coal.'],
        { choose: [
          ['I can smelt them.', [{ run: () => setQ(player, 'smith_order', { stage: 1 }) }, ['npc', 'The furnace is in the smithy.']]],
          ['Not now.', [['npc', 'Come back later.']]]
        ] }
      ];
      if (g.has('Iron bar', 8) && g.has('Coal', 4)) return [
        ['player', 'Here are the bars and coal.'],
        { run: () => { g.take('Iron bar', 8); g.take('Coal', 4); } },
        ['npc', 'Excellent quality! Take this mithril bar as a bonus.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Need 8 Iron bars and 4 Coal.']];
    }
  },
  {
    id: 'eastern_feast', name: 'Eastern Feast', giver: 'cook2', points: 1, start: 'Talk to Chef Bran in Ashford.',
    rewards: ['1500 Cooking XP', '600 coins', '10 Cooked lobster'],
    bonus: { desc: '+5% Cooking XP', fx: { 'xp.Cooking': 0.05 } },
    journal(player) {
      const s = q(player, 'eastern_feast').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Chef Bran 8 Raw trout and 5 Raw beef.', done: s === 'done' }];
    },
    reward(g) { g.xp('Cooking', 1500); g.gold(600); g.give('Cooked lobster', 10); },
    talk(player, g) {
      const s = q(player, 'eastern_feast').stage;
      if (s === 'done') return [['npc', 'The feast was a success! The town thanks you.']];
      if (s === 0) return [
        ['npc', 'We are preparing a feast for the harvest. I need fish and beef.'],
        ['npc', 'Bring 8 Raw trout and 5 Raw beef.'],
        { choose: [
          ['I will bring them.', [{ run: () => setQ(player, 'eastern_feast', { stage: 1 }) }, ['npc', 'The lake and cow fields are west of here.']]],
          ['Maybe later.', [['npc', 'The feast can wait a day.']]]
        ] }
      ];
      if (g.has('Raw trout', 8) && g.has('Raw beef', 5)) return [
        ['player', 'Here are the trout and beef.'],
        { run: () => { g.take('Raw trout', 8); g.take('Raw beef', 5); } },
        ['npc', 'Wonderful! Take these cooked lobsters and coins.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Still need 8 Raw trout and 5 Raw beef.']];
    }
  },
  {
    id: 'scout_report', name: 'Scout\'s Report', giver: 'ranger2', points: 1, start: 'Talk to Scout Vey near Ashford.',
    rewards: ['2200 Ranged XP', '900 coins', 'Archer ring'],
    bonus: { desc: '+2 ranged max hit', fx: { rmaxHit: 2 } },
    journal(player) {
      const st = q(player, 'scout_report');
      if (st.stage === 0) return [{ text: this.start }];
      return [{ text: `Defeat 4 Dark Archers east of the lake (${Math.min(4, st.kills || 0)}/4).`, done: st.stage === 'done' }];
    },
    reward(g) { g.xp('Ranged', 2200); g.gold(900); g.give('Archer ring', 1); },
    talk(player, g) {
      const st = q(player, 'scout_report');
      if (st.stage === 'done') return [['npc', 'The woods are safer. Keep that ring.']];
      if (st.stage === 0) return [
        ['npc', 'Dark archers have moved further east. I need them dealt with.'],
        ['npc', 'Defeat 4 Dark Archers.'],
        { choose: [
          ['I will hunt them.', [{ run: () => setQ(player, 'scout_report', { stage: 1, kills: 0 }) }, ['npc', 'They are west of Ashford, past the yews.']]],
          ['Too dangerous.', [['npc', 'Come back when ready.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `${st.kills || 0} of 4 dark archers down.`]];
      if (st.stage === 2) return [
        ['npc', 'The archers are defeated. The woods are quieter.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Return when 4 Dark Archers are defeated.']];
    }
  },
  {
    id: 'miner_tools', name: 'Kael\'s Tools', giver: 'miner', points: 1, start: 'Talk to Miner Kael near the eastern mines.',
    rewards: ['1800 Mining XP', '700 coins', 'Adamant pickaxe'],
    bonus: { desc: '+3% mining success', fx: { gather: 0.03 } },
    journal(player) {
      const s = q(player, 'miner_tools').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Kael 6 Iron bars and 4 Oak logs.', done: s === 'done' }];
    },
    reward(g) { g.xp('Mining', 1800); g.gold(700); g.tool('Adamant pickaxe'); },
    talk(player, g) {
      const s = q(player, 'miner_tools').stage;
      if (s === 'done') return [['npc', 'These tools will last years. Thank you!']];
      if (s === 0) return [
        ['npc', 'My pickaxes are worn out. I need new handles and heads.'],
        ['npc', 'Bring 6 Iron bars and 4 Oak logs.'],
        { choose: [
          ['I will make them.', [{ run: () => setQ(player, 'miner_tools', { stage: 1 }) }, ['npc', 'Oaks are west, furnace in the smithy.']]],
          ['Later.', [['npc', 'The mines can wait.']]]
        ] }
      ];
      if (g.has('Iron bar', 6) && g.has('Oak logs', 4)) return [
        ['player', 'Here are the bars and logs.'],
        { run: () => { g.take('Iron bar', 6); g.take('Oak logs', 4); } },
        ['npc', 'Fine work! Take this adamant pickaxe.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Need 6 Iron bars and 4 Oak logs.']];
    }
  },
  {
    id: 'sister_prayers', name: 'Rest for the East', giver: 'priest2', points: 1, start: 'Talk to Sister Lira in Ashford.',
    rewards: ['1500 Prayer XP', '500 coins', 'Holy symbol'],
    bonus: { desc: 'Prayers drain 3% slower', fx: { drainLess: 0.03 } },
    journal(player) {
      const st = q(player, 'sister_prayers');
      if (st.stage === 0) return [{ text: this.start }];
      return [{ text: `Bury 8 bones (${Math.min(8, st.buried || 0)}/8).`, done: st.stage === 'done' }];
    },
    reward(g) { g.xp('Prayer', 1500); g.gold(500); g.give('Holy symbol', 1); },
    talk(player, g) {
      const st = q(player, 'sister_prayers');
      if (st.stage === 'done') return [['npc', 'The spirits of the east rest easier. May Saradomin bless you.']];
      if (st.stage === 0) return [
        ['npc', 'Restless spirits trouble the eastern roads. Help lay them to rest.'],
        ['npc', 'Bury 8 bones, then return to me.'],
        { choose: [
          ['I will help.', [{ run: () => setQ(player, 'sister_prayers', { stage: 1, buried: 0 }) }, ['npc', 'Bones can be found from the fallen near the roads.']]],
          ['Not now.', [['npc', 'The dead are patient.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `You have buried ${st.buried || 0} of 8 bones.`]];
      if (st.stage === 2) return [
        ['npc', 'I feel the spirits of the east settle. You have done a holy thing.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Return when 8 bones are buried.']];
    }
  },
  {
    id: 'trader_supplies', name: 'Supply the Store', giver: 'merchant2', points: 1, start: 'Talk to Trader Mira in Ashford Store.',
    rewards: ['1200 Fletching XP', '1500 coins', 'Amulet of strength'],
    bonus: { desc: 'Shops pay 5% more', fx: { sellBonus: 0.05 } },
    journal(player) {
      const s = q(player, 'trader_supplies').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Mira 20 Bronze arrows and 10 Cooked shrimp.', done: s === 'done' }];
    },
    reward(g) { g.xp('Fletching', 1200); g.gold(1500); g.give('Amulet of strength', 1); },
    talk(player, g) {
      const s = q(player, 'trader_supplies').stage;
      if (s === 'done') return [['npc', 'The store is stocked again. I will pay you better from now on.']];
      if (s === 0) return [
        ['npc', 'The guards need arrows and the workers need food. My supplier is late.'],
        ['npc', 'Bring 20 Bronze arrows and 10 Cooked shrimp.'],
        { choose: [
          ['I can supply them.', [{ run: () => setQ(player, 'trader_supplies', { stage: 1 }) }, ['npc', 'Arrows from fletching, shrimp from the lake.']]],
          ['Not now.', [['npc', 'Come back soon.']]]
        ] }
      ];
      if (g.has('Bronze arrows', 20) && g.has('Cooked shrimp', 10)) return [
        ['player', 'Here are the supplies.'],
        { run: () => { g.take('Bronze arrows', 20); g.take('Cooked shrimp', 10); } },
        ['npc', 'Perfect! Take this amulet and extra coins.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Need 20 Bronze arrows and 10 Cooked shrimp.']];
    }
  },
  {
    id: 'knight_honour_east', name: 'Eastern Honour', giver: 'knight2', points: 2, start: 'Talk to Sir Elric near Ashford.',
    rewards: ['3000 Defence XP', '2000 Attack XP', 'Amulet of glory'],
    bonus: { desc: 'Take 2% less damage', fx: { dr: 0.02 } },
    journal(player) {
      const st = q(player, 'knight_honour_east');
      if (st.stage === 0) return [{ text: this.start }];
      return [
        { text: `Defeat 3 Black Knights (${Math.min(3, st.kills || 0)}/3).`, done: st.stage === 'done' || st.stage >= 2 },
        { text: 'Bring a Mithril full helm.', done: st.stage === 'done' }
      ];
    },
    reward(g) { g.xp('Defence', 3000); g.xp('Attack', 2000); g.give('Amulet of glory', 1); },
    talk(player, g) {
      const st = q(player, 'knight_honour_east');
      if (st.stage === 'done') return [['npc', 'Ashford is proud to call you an ally.']];
      if (st.stage === 0) return [
        ['npc', 'Black Knights threaten the eastern approaches. Prove your honour.'],
        ['npc', 'Defeat 3 Black Knights, then bring a Mithril full helm.'],
        { choose: [
          ['I accept the challenge.', [{ run: () => setQ(player, 'knight_honour_east', { stage: 1, kills: 0 }) }, ['npc', 'For Brightwater and Ashford!']]],
          ['Not yet.', [['npc', 'Honour waits for the ready.']]]
        ] }
      ];
      if (st.stage === 1) return [['npc', `${st.kills || 0} of 3 Black Knights defeated.`]];
      if (g.has('Mithril full helm', 1)) return [
        ['player', 'The knights are defeated. Here is a mithril helm.'],
        { run: () => g.take('Mithril full helm', 1) },
        ['npc', 'Rise, defender of the east! Wear this amulet.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Bring a Mithril full helm when the knights are slain.']];
    }
  },
  {
    id: 'angler_catch', name: 'Tess\'s Catch', giver: 'angler', points: 1, start: 'Talk to Angler Tess near Ashford.',
    rewards: ['1600 Fishing XP', '600 coins', 'Fly fishing rod'],
    bonus: { desc: '+5% Fishing XP', fx: { 'xp.Fishing': 0.05 } },
    journal(player) {
      const s = q(player, 'angler_catch').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Tess 6 Raw salmon and 4 Raw lobster.', done: s === 'done' }];
    },
    reward(g) { g.xp('Fishing', 1600); g.gold(600); g.tool('Fly fishing rod'); },
    talk(player, g) {
      const s = q(player, 'angler_catch').stage;
      if (s === 'done') return [['npc', 'Fine catch! The streams are generous today.']];
      if (s === 0) return [
        ['npc', 'I need more fish for the market. Can you help?'],
        ['npc', 'Bring 6 Raw salmon and 4 Raw lobster.'],
        { choose: [
          ['I will fish for you.', [{ run: () => setQ(player, 'angler_catch', { stage: 1 }) }, ['npc', 'The lake is west of here.']]],
          ['Later.', [['npc', 'The fish will still be there.']]]
        ] }
      ];
      if (g.has('Raw salmon', 6) && g.has('Raw lobster', 4)) return [
        ['player', 'Here are the salmon and lobster.'],
        { run: () => { g.take('Raw salmon', 6); g.take('Raw lobster', 4); } },
        ['npc', 'Excellent! Take this rod and some coins.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Need 6 Raw salmon and 4 Raw lobster.']];
    }
  },
  {
    id: 'carpenter_wood', name: 'Olan\'s Timber', giver: 'carpenter', points: 1, start: 'Talk to Carpenter Olan in Ashford.',
    rewards: ['1400 Woodcutting XP', '500 coins', '50 Oak logs'],
    bonus: { desc: '+3% woodcutting success', fx: { gather: 0.03 } },
    journal(player) {
      const s = q(player, 'carpenter_wood').stage;
      if (s === 0) return [{ text: this.start }];
      return [{ text: 'Bring Olan 15 Oak logs and 8 Willow logs.', done: s === 'done' }];
    },
    reward(g) { g.xp('Woodcutting', 1400); g.gold(500); g.give('Oak logs', 50); },
    talk(player, g) {
      const s = q(player, 'carpenter_wood').stage;
      if (s === 'done') return [['npc', 'This timber will build fine houses. Thank you!']];
      if (s === 0) return [
        ['npc', 'I need more timber for repairs and new buildings.'],
        ['npc', 'Bring 15 Oak logs and 8 Willow logs.'],
        { choose: [
          ['I will chop them.', [{ run: () => setQ(player, 'carpenter_wood', { stage: 1 }) }, ['npc', 'Oaks are north-east, willows by the lake.']]],
          ['Not now.', [['npc', 'The timber can wait.']]]
        ] }
      ];
      if (g.has('Oak logs', 15) && g.has('Willow logs', 8)) return [
        ['player', 'Here are the logs.'],
        { run: () => { g.take('Oak logs', 15); g.take('Willow logs', 8); } },
        ['npc', 'Perfect lengths! Take these extra oak logs and coins.'],
        { run: () => finish(player, this, g) }
      ];
      return [['npc', 'Need 15 Oak logs and 8 Willow logs.']];
    }
  }
];

export function questById(id) { return QUESTS.find(x => x.id === id); }
export function questForNpc(npc) { return QUESTS.find(x => x.giver === npc); }

// ---- Hooks from the game. Each returns chat messages. ----
export function onKill(player, monName) {
  const out = [];
  for (const [id, mon, need, returnTo] of [
    ['archers', 'Dark Archer', 3, 'Ranger Wyn'],
    ['honour', 'Black Knight', 2, 'Sir Vyvin'],
    ['eastern_guards', 'Goblin', 8, 'Guard Captain Ryn'],
    ['scout_report', 'Dark Archer', 4, 'Scout Vey'],
    ['knight_honour_east', 'Black Knight', 3, 'Sir Elric']
  ]) {
    const st = q(player, id);
    if (st.stage === 1 && monName === mon) {
      const kills = (st.kills || 0) + 1;
      setQ(player, id, { kills, stage: kills >= need ? 2 : 1 });
      const qn = QUESTS.find(x => x.id === id).name;
      out.push(kills >= need ? `${qn}: done! Return to ${returnTo}.` : `${qn}: ${kills}/${need} ${mon.toLowerCase()}s defeated.`);
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
  const out = [];
  const st = q(player, 'fallen');
  if (st.stage === 1) {
    const buried = (st.buried || 0) + 1;
    setQ(player, 'fallen', { buried, stage: buried >= 5 ? 2 : 1 });
    out.push(buried >= 5 ? 'Rest for the Fallen: the spirits are calmer. Pray at the church altar.' : `Rest for the Fallen: ${buried}/5 bones buried.`);
  }
  const st2 = q(player, 'sister_prayers');
  if (st2.stage === 1) {
    const buried = (st2.buried || 0) + 1;
    setQ(player, 'sister_prayers', { buried, stage: buried >= 8 ? 2 : 1 });
    out.push(buried >= 8 ? 'Rest for the East: the spirits settle. Return to Sister Lira.' : `Rest for the East: ${buried}/8 bones buried.`);
  }
  return out;
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
  banker: { name: 'Banker', examine: 'Good with money.' },
  fisherman: { name: 'Fisherman Fred', examine: 'An old fisherman who knows the lake well.' },
  mayor: { name: 'Mayor Aldric', examine: 'Mayor of Ashford, worried about the eastern farms.' },
  merchant2: { name: 'Trader Mira', examine: 'A shrewd trader from Ashford.' },
  smith2: { name: 'Smith Torin', examine: 'Ashford\'s blacksmith, always short of ore.' },
  farmer2: { name: 'Farmer Elara', examine: 'Tends the eastern fields.' },
  guard2: { name: 'Guard Captain Ryn', examine: 'Keeps the peace in Ashford.' },
  priest2: { name: 'Sister Lira', examine: 'A priestess of Saradomin in Ashford.' },
  ranger2: { name: 'Scout Vey', examine: 'Scouts the woods east of Ashford.' },
  cook2: { name: 'Chef Bran', examine: 'Cooks for the Ashford inn.' },
  miner: { name: 'Miner Kael', examine: 'Works the eastern mines.' },
  angler: { name: 'Angler Tess', examine: 'Fishes the eastern streams.' },
  knight2: { name: 'Sir Elric', examine: 'A knight stationed near Ashford.' },
  herbalist: { name: 'Herbalist Wren', examine: 'Gathers herbs in the east.' },
  carpenter: { name: 'Carpenter Olan', examine: 'Builds and repairs in Ashford.' }
};

// ---- Lasting quest bonuses ----
// Quest-point milestones give extra bonuses on top of each quest's own bonus.
export const QP_MILESTONES = [
  { qp: 3, desc: 'Run energy restores 25% faster', fx: { runRegen: 0.25 } },
  { qp: 6, desc: '+2% XP in every skill', fx: { 'xp.*': 0.02 } },
  { qp: 9, desc: '+20 max hitpoints', fx: { maxHp: 20 } },
  { qp: 24, desc: 'Every quest done: Quest point cape and +3% XP in every skill', fx: { 'xp.*': 0.03 } }
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

