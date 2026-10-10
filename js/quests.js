// Quests: data, journal text and dialogue. Pure logic so it can be unit-tested.
// player.quests[id] = { stage, ...counters }. stage 'done' = complete.
//
// Dialogue scripts are arrays of entries:
//   ['npc', 'text'] / ['player', 'text']
//   { choose: [['Option label', [...entries]], ...] }
//   { run: () => {} }   (runs when the conversation reaches it)

export const QUEST_POINTS_TOTAL = 6;

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
export function isDone(player, id) { return q(player, id).stage === 'done'; }
export function questPoints(player) {
  return QUESTS.reduce((t, x) => t + (isDone(player, x.id) ? x.points : 0), 0);
}

// g = game helpers: has(item,n), take(item,n), give(item,n), xp(skill,n), gold(n), tool(item), log(text)
function finish(player, quest, g) {
  setQ(player, quest.id, { stage: 'done' });
  quest.reward(g);
  player.questPoints = questPoints(player);
  g.questComplete(quest);
}

export const QUESTS = [
  {
    id: 'cook', name: "Cook's Assistant", giver: 'cook', points: 1, start: 'Talk to the Cook in the cookhouse, south-west of the town square.',
    rewards: ['300 Cooking XP', '100 coins', 'Cooked lobster sold at the General Store'],
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
  }
];

export function questById(id) { return QUESTS.find(x => x.id === id); }
export function questForNpc(npc) { return QUESTS.find(x => x.giver === npc); }

// ---- Hooks from the game. Each returns chat messages. ----
export function onKill(player, monName) {
  const out = [];
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
  merchant: { name: 'Merchant', examine: 'A trader of general goods.' },
  banker: { name: 'Banker', examine: 'Good with money.' }
};
