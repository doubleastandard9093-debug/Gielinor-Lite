// Data-driven quests (the 100 added in the "100 quests" update).
// Each quest is plain data (see questdata*.js); buildQuest() turns it into the
// same shape as the hand-written quests in quests.js (journal / talk / reward).
//
// Step types (player.quests[id].stage = index of the current step + 1, c = counter):
//   { t: 'bring', items: { Item: n }, to?: npcId }   hand over items (to the giver unless `to`)
//   { t: 'kill', mon: 'Goblin', n: 5 }               defeat monsters
//   { t: 'xp', skill: 'Agility', n: 500 }            gain XP in a skill (any way you like)
//   { t: 'bury', n: 5 }                              bury bones
//   { t: 'talk', npc: 'doric', say: ['line', ...] }  speak to someone
//   { t: 'visit', place: 'airAltar' }                walk to a place
// After the last step you return to the giver to finish.
import { QUEST_NPCS } from './questnpcs.js';
import { QDATA1 } from './questdata1.js';
import { QDATA2 } from './questdata2.js';
import { QDATA3 } from './questdata3.js';
import { QDATA4 } from './questdata4.js';
import { QDATA5 } from './questdata5.js';

export const QUEST_DATA = [...QDATA1, ...QDATA2, ...QDATA3, ...QDATA4, ...QDATA5];

export const PLACES = {
  airAltar: { x: -26, z: 34, r: 4, name: 'the Air altar south-west of Brightwater' },
  mindAltar: { x: -40, z: -102, r: 4, name: 'the Mind altar north-east of Falador' },
  waterAltar: { x: -104, z: 76, r: 4, name: 'the Water altar south-west of Port Sarim' },
  earthAltar: { x: 100, z: -66, r: 4, name: 'the Earth altar north-west of Varrock' },
  fireAltar: { x: 143, z: -72, r: 4, name: 'the Fire altar north-east of Varrock' },
  bodyAltar: { x: -28, z: -64, r: 4, name: 'the Body altar between Brightwater and Falador' },
  chaosAltar: { x: -44, z: 100, r: 4, name: 'the dark Chaos altar south-east of Port Sarim' },
  deathAltar: { x: 98, z: -126, r: 5, name: 'the Death altar deep in the north-eastern wilds' },
  bloodAltar: { x: -128, z: -134, r: 5, name: 'the Blood altar in the far north-west' },
  essMine: { x: 132, z: -22, r: 6, name: 'the rune essence mine south-east of Varrock' },
  bwMine: { x: 22, z: 20, r: 6, name: 'the Brightwater mine south-east of town' },
  highMine: { x: -9, z: -28, r: 4, name: 'the high-level mine north of Brightwater' },
  tower: { x: 0, z: 29, r: 5, name: 'the wizard tower south of Brightwater' },
  lake: { x: -20, z: 16, r: 10, name: 'the shore of Brightwater lake' },
  bwCourse: { x: 22, z: 37, r: 7, name: 'the Brightwater agility course' },
  vCourse: { x: 105, z: -20, r: 7, name: 'the Varrock agility course' },
  psCourse: { x: -60, z: 71, r: 7, name: 'the Port Sarim rigging course' },
  fCourse: { x: -81, z: -60, r: 7, name: 'the Falador agility course' },
  bandits: { x: -50, z: 91, r: 8, name: 'the bandit camp south-east of Port Sarim' },
  mossGiants: { x: -108, z: 43, r: 8, name: 'the Moss Giant woods west of Port Sarim' },
  iceWest: { x: -113, z: 100, r: 8, name: 'the frozen hollow south-west of Port Sarim' },
  iceEast: { x: 137, z: -12, r: 8, name: 'the icy ridge east of Varrock' },
  ogres: { x: -100, z: -113, r: 9, name: 'the ogre hills north-west of Falador' },
  demons: { x: 117, z: -98, r: 9, name: 'the demon ruins north of Varrock' },
  dragons: { x: 120, z: -122, r: 10, name: 'the dragon lair far north of Varrock' },
  scorch: { x: 134, z: -136, r: 7, name: "Scorchwing's nest at the edge of the world" },
  goblinField: { x: 13, z: -13, r: 6, name: 'the goblin camp north-east of Brightwater' },
  giants: { x: -1, z: -31, r: 6, name: 'the Hill Giant slopes north of Brightwater' },
  blackKnights: { x: -17, z: -33, r: 5, name: 'the Black Knight outpost north of Brightwater' },
  darkWood: { x: -34, z: 6, r: 6, name: 'the dark archers\u2019 wood west of the lake' },
  wolfDen: { x: 38, z: -11, r: 6, name: 'the wolf den east of Brightwater' },
  graveyard: { x: -26, z: -28, r: 5, name: 'the old graveyard north-west of Brightwater' },
  boneyard: { x: 26, z: -37, r: 5, name: 'the skeleton boneyard north-east of Brightwater' },
  spiderNest: { x: -37, z: -20, r: 5, name: 'the spider nest north-west of Brightwater' },
  magicGrove: { x: 10, z: -33, r: 5, name: 'the magic tree grove north of Brightwater' },
  yewGrove: { x: -31, z: -1, r: 5, name: 'the yew grove west of Brightwater' },
  mapleWood: { x: 31, z: 4, r: 5, name: 'the maple wood east of Brightwater' },
  willowBank: { x: -98, z: 66, r: 6, name: 'the willows west of Port Sarim' },
  docks: { x: -80, z: 72, r: 6, name: 'the Port Sarim docks' },
  varrockSquare: { x: 120, z: -40, r: 6, name: 'Varrock square' },
  faladorSquare: { x: -60, z: -80, r: 6, name: 'Falador square' },
  ashfordSquare: { x: 50, z: -24, r: 6, name: 'Ashford square' },
  sarimSquare: { x: -80, z: 60, r: 6, name: 'Port Sarim square' },
  bwSquare: { x: 0, z: 0, r: 5, name: 'Brightwater town square' },
  yewFalador: { x: -38, z: -88, r: 6, name: 'the yew trees east of Falador' },
  magicVarrock: { x: 104, z: -112, r: 5, name: 'the magic trees north of Varrock' },
  mapleVarrock: { x: 100, z: -6, r: 6, name: 'the maple trees south-west of Varrock' },
  grumsh: { x: -112, z: -124, r: 6, name: "Grumsh's camp beyond the ogre hills" }
};

const NPC_NAME = {};
for (const n of QUEST_NPCS) NPC_NAME[n.id] = n.name;
export function npcName(id, info) { return NPC_NAME[id] || (info && info[id] && info[id].name) || id; }

const plural = (s, n) => n === 1 ? s : /s$/.test(s) ? s : /y$/.test(s) && !/[aeiou]y$/.test(s) ? s.slice(0, -1) + 'ies' : /(ch|sh|x)$/.test(s) ? s + 'es' : s + 's';
const itemsText = items => Object.entries(items).map(([k, v]) => `${v} ${k}`).join(', ');

// Reward text for the journal.
function rewardList(d) {
  const r = [];
  for (const [s, n] of Object.entries(d.xp || {})) r.push(`${n} ${s} XP`);
  if (d.gold) r.push(`${d.gold} coins`);
  for (const [k, v] of Object.entries(d.items || {})) r.push(v > 1 ? `${v} x ${k}` : k);
  return r;
}

export function stepText(d, s, st, info) {
  const c = Math.min(st.c || 0, s.n || 0);
  switch (s.t) {
    case 'bring': return `Bring ${npcName(s.to || d.giver, info)} ${itemsText(s.items)}.`;
    case 'kill': return `Defeat ${s.n} ${plural(s.mon, s.n)} (${c}/${s.n}).`;
    case 'xp': return `Gain ${s.n} ${s.skill} XP (${Math.floor(c)}/${s.n}).${s.hint ? ' ' + s.hint : ''}`;
    case 'bury': return `Bury ${s.n} bones (${c}/${s.n}).`;
    case 'talk': return `Speak to ${npcName(s.npc, info)}${s.where ? ' ' + s.where : ''}.`;
    case 'visit': return `Go to ${PLACES[s.place].name}.`;
  }
  return '';
}

export function reqText(d, info) {
  const r = [];
  for (const [s, n] of Object.entries(d.req?.lvl || {})) r.push(`${s} ${n}`);
  for (const id of d.req?.q || []) r.push(`the quest "${info.questName(id)}"`);
  return r;
}

// Build a quest object. lib = { q, setQ, finish, questName, isDone, NPC_INFO }
export function buildQuest(d, lib) {
  const { q, setQ, finish } = lib;
  const giverName = () => npcName(d.giver, lib.NPC_INFO);
  const quest = {
    id: d.id, name: d.name, giver: d.giver, town: d.town, diff: d.diff, points: d.points, data: d,
    get start() { return `Talk to ${npcName(d.giver, lib.NPC_INFO)} ${d.where}.`; },
    rewards: rewardList(d),
    bonus: d.bonus,
    reqsMet(player, g) {
      for (const [s, n] of Object.entries(d.req?.lvl || {})) if (g.level(s) < n) return false;
      for (const id of d.req?.q || []) if (!lib.isDone(player, id)) return false;
      return true;
    },
    journal(player) {
      const st = q(player, d.id);
      const req = reqText(d, lib);
      if (st.stage === 0) return [{ text: this.start }, ...(req.length ? [{ text: 'Requires: ' + req.join(', ') + '.' }] : [])];
      const out = [{ text: d.story || d.intro[0], done: true }];
      const cur = st.stage === 'done' ? Infinity : st.stage;
      d.steps.forEach((s, i) => { if (i + 1 <= cur) out.push({ text: stepText(d, s, i + 1 === cur ? st : { c: s.n }, lib.NPC_INFO), done: i + 1 < cur }); });
      if (st.stage === 'done' || cur > d.steps.length) out.push({ text: `Return to ${giverName()}.`, done: st.stage === 'done' });
      return out;
    },
    reward(g) {
      g.rewarding = true;
      for (const [s, n] of Object.entries(d.xp || {})) g.xp(s, n);
      if (d.gold) g.gold(d.gold);
      for (const [k, v] of Object.entries(d.items || {})) g.give(k, v);
      g.rewarding = false;
    },
    talk(player, g) {
      const st = q(player, d.id);
      if (st.stage === 'done') return [['npc', d.thanks || 'Thank you again for your help.']];
      if (st.stage === 0) {
        if (!this.reqsMet(player, g)) return [['npc', d.intro[0]], ['npc', `Come back when you have ${reqText(d, lib).join(' and ')}.`]];
        return [...d.intro.map(t => ['npc', t]),
          { choose: [[d.accept || "I'll help.", [{ run: () => { setQ(player, d.id, { stage: 1, c: 0 }); g.log(`Quest started: ${d.name}.`); } }, ['npc', d.go || 'Thank you! Check your quest journal if you forget what to do.']]],
            ["Not right now.", [['npc', 'Very well. I will be here.']]]] }];
      }
      const i = st.stage - 1;
      const s = d.steps[i];
      if (!s) return [['player', "It's done."], ['npc', d.end || 'Wonderful! You have my thanks. Here is your reward.'], { run: () => finish(player, this, g) }];
      if (s.t === 'bring' && !s.to) {
        if (Object.entries(s.items).every(([k, v]) => g.has(k, v))) return [
          ['player', `Here you are: ${itemsText(s.items)}.`],
          { run: () => { for (const [k, v] of Object.entries(s.items)) g.take(k, v); advance(player, d, lib); } },
          ...(d.steps[i + 1] ? [['npc', s.reply || 'Just what I needed. Now, there is more to do.'], ['npc', stepText(d, d.steps[i + 1], { c: 0 }, lib.NPC_INFO)]] :
            [['npc', d.end || 'Wonderful! You have my thanks. Here is your reward.'], { run: () => finish(player, this, g) }])
        ];
      }
      return [['npc', s.nag || stepText(d, s, st, lib.NPC_INFO)]];
    }
  };
  return quest;
}

// Move to the next step (or to "return to the giver").
function advance(player, d, lib) {
  const st = lib.q(player, d.id);
  lib.setQ(player, d.id, { stage: st.stage + 1, c: 0 });
}

// Progress hooks. kind: 'kill' (arg = monster), 'xp' (arg = skill, amt), 'bury', 'visit' (arg = x, amt = z)
export function progress(player, quests, kind, arg, amt, lib) {
  const out = [];
  for (const qd of quests) {
    const d = qd.data;
    if (!d) continue;
    const st = lib.q(player, d.id);
    if (typeof st.stage !== 'number' || st.stage < 1) continue;
    const s = d.steps[st.stage - 1];
    if (!s || s.t !== kind) continue;
    let hit = false, c = st.c || 0;
    if (kind === 'kill' && s.mon === arg) { c++; hit = true; }
    else if (kind === 'xp' && s.skill === arg) { c += amt; hit = true; }
    else if (kind === 'bury') { c++; hit = true; }
    else if (kind === 'visit') { const p = PLACES[s.place]; if (Math.hypot(arg - p.x, amt - p.z) <= p.r) { c = 1; hit = true; } }
    if (!hit) continue;
    const need = s.n || 1;
    if (c >= need) {
      advance(player, d, lib);
      const nx = d.steps[st.stage];
      out.push(`${d.name}: ${s.t === 'visit' ? 'you reach ' + PLACES[s.place].name : 'step complete'}! ${nx ? 'Next: ' + stepText(d, nx, { c: 0 }, lib.NPC_INFO) : 'Return to ' + npcName(d.giver, lib.NPC_INFO) + '.'}`);
    } else {
      lib.setQ(player, d.id, { c });
      if (kind !== 'xp') out.push(`${d.name}: ${stepText(d, s, { c }, lib.NPC_INFO)}`);
    }
  }
  return out;
}

// Someone other than the giver may be part of a quest step (talk / bring to).
export function talkOverride(player, quests, npc, g, lib) {
  for (const qd of quests) {
    const d = qd.data;
    if (!d) continue;
    const st = lib.q(player, d.id);
    if (typeof st.stage !== 'number' || st.stage < 1) continue;
    const s = d.steps[st.stage - 1];
    if (!s) continue;
    const nx = () => d.steps[st.stage] ? stepText(d, d.steps[st.stage], { c: 0 }, lib.NPC_INFO) : `Return to ${npcName(d.giver, lib.NPC_INFO)}.`;
    if (s.t === 'talk' && s.npc === npc) return [
      ...s.say.map(t => Array.isArray(t) ? t : ['npc', t]),
      { run: () => { advance(player, d, lib); g.log(`${d.name}: ${nx()}`); } }
    ];
    if (s.t === 'bring' && s.to === npc) {
      if (Object.entries(s.items).every(([k, v]) => g.has(k, v))) return [
        ['player', `${d.name}: I have ${itemsText(s.items)} for you.`],
        { run: () => { for (const [k, v] of Object.entries(s.items)) g.take(k, v); advance(player, d, lib); g.log(`${d.name}: ${nx()}`); } },
        ['npc', s.reply || 'Thank you, that is exactly right.']
      ];
      return [['npc', s.nag || `For ${d.name}, I need ${itemsText(s.items)}.`]];
    }
  }
  return null;
}
