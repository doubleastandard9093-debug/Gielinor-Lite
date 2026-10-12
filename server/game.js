// Server-authoritative game state: players, shared resource nodes, shared monsters.
// Uses the same pure game-logic modules as the browser (../js/*.js).
import { NODES, MONSTER_SPAWNS, WORLD_HALF, SPAWN, insideLake, resolveCollisions } from './world.js';
import {
  TICK_MS, gatherTick, gatherInfo, nextGatherWait, rollPlayerHit, rollMonsterHit, combatXp, rollLoot, reduceIncoming,
  attackRange, attackSpeedTicks, xpMultiplier, eat, equip, unequip, capeBoosts, regenBonus, isRareDrop, weaponProcs, stylesFor
} from '../js/gameplay.js';
import { createSkills, addXP, perk, setPerkBoost, combatLevel, perksBetween } from '../js/skills.js';
import { createPlayerState, addItem, canAdd, recalcMaxHp } from '../js/playerState.js';
import { applySaveData, getSaveData } from '../js/save.js';
import { ITEMS, isRangedWeapon } from '../js/items.js';
import { questFx, onKill, questPoints } from '../js/quests.js';
import { prayerFx } from '../js/prayer.js';

export { TICK_MS };
export const VIEW_RANGE = 60;          // interest radius
const RUN_SPEED = 6.2;                 // must match js/player.js
const GATHER_REACH = 1.6, MELEE_SLACK = 0.8;
// Online-only depletion so players share and compete for nodes. Offline stays infinite.
const DEPLETE = { tree: { chance: 1 / 6, ms: [12000, 20000] }, rock: { chance: 1 / 3, ms: [8000, 15000] } };
const NAME_RE = /^[A-Za-z0-9 _-]{3,12}$/;

const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createGame({ db, log = () => {} }) {
  const players = new Map();          // id -> session
  const nodes = NODES.map(n => ({ ...n }));
  const mons = MONSTER_SPAWNS.map(s => ({ ...s, maxHp: s.hp, hp: s.hp, alive: true, x: s.spawnX, z: s.spawnZ, state: 'idle', target: null, nextAttackTick: 0, wanderAt: 0, respawnAt: 0, dmgBy: {} }));
  let tick = 0, nextId = 1;
  const nodeChanges = [];

  // ---- helpers -----------------------------------------------------------
  const send = (s, msg) => { if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(msg)); };
  const say = (s, text, cls = 'game', color) => send(s, { t: 'log', text, cls, color });
  const near = (pt, r = VIEW_RANGE) => [...players.values()].filter(o => dist(o, pt) <= r);
  function refreshMaxHp(s) { recalcMaxHp(s.player, s.skills, perk(s.skills, 'Hitpoints', 'maxHp') + questFx(s.player, 'maxHp')); }
  function afterEquip(s) { setPerkBoost(s.skills, capeBoosts(s.player)); refreshMaxHp(s); s.player.hp = Math.min(s.player.hp, s.player.maxHp); s.look = true; }
  function giveXP(s, skill, amount) {
    if (!(amount > 0)) return;
    amount *= xpMultiplier(s.player, skill);
    addXP(s.skills, skill, amount, (sk, l, old) => {
      say(s, `Congratulations, you just advanced a ${sk} level. You are now level ${l}.`, 'skill');
      for (const p of perksBetween(sk, old, l)) say(s, `New ${sk} perk unlocked: ${p.name} (${p.desc}).`, 'skill');
      send(s, { t: 'levelup', skill: sk, level: l, old });
      if (sk === 'Hitpoints') { const o = s.player.maxHp; refreshMaxHp(s); s.player.hp += s.player.maxHp - o; }
      if (sk === 'Prayer') s.player.prayerPoints = Math.min(s.skills.Prayer.level * 10, (s.player.prayerPoints || 0) + (l - old) * 10);
      s.look = true;
    });
    send(s, { t: 'xp', skill, amount });
    s.dirty = true;
  }
  function grant(s, item, qty) {
    if (item === 'Coins') { s.player.gold += qty; return 'inv'; }
    if (canAdd(s.player, item)) { addItem(s.player, item, qty); return 'inv'; }
    s.player.bank[item] = (s.player.bank[item] || 0) + qty; return 'bank';
  }
  function publicInfo(s) {
    return { id: s.id, name: s.name, x: +s.x.toFixed(2), z: +s.z.toFixed(2), eq: s.player.equipment, cb: combatLevel(s.skills), hp: s.player.hp, maxHp: s.player.maxHp, act: s.action ? s.action.kind : null };
  }
  function selfState(s) {
    const p = s.player;
    return { t: 'self', skills: s.skills, p: { hp: p.hp, maxHp: p.maxHp, gold: p.gold, inventory: p.inventory, equipment: p.equipment, bank: p.bank, ammoCount: p.ammoCount, prayerPoints: p.prayerPoints, quests: p.quests, questPoints: p.questPoints, tools: p.tools, attackStyle: p.attackStyle, effects: p.effects } };
  }
  function saveDataOf(s) { return getSaveData(s.skills, s.player, { mesh: { position: { x: s.x, z: s.z } } }); }
  function persist(s) { db.setSave(s.name, saveDataOf(s)); s.savedAt = Date.now(); }

  // ---- sessions ----------------------------------------------------------
  function join(ws, account) {
    for (const o of players.values()) if (o.name.toLowerCase() === account.name.toLowerCase()) { say(o, 'You logged in somewhere else.', 'warn'); leave(o); try { o.ws.close(4000, 'replaced'); } catch (e) {} }
    const skills = createSkills(), player = createPlayerState();
    const fake = { mesh: { position: { x: SPAWN.x + 1, z: SPAWN.z + 1 } } };
    if (account.save) applySaveData(account.save, skills, player, fake);
    else { addItem(player, 'Bronze sword', 1); addItem(player, 'Wooden shield', 1); addItem(player, 'Cooked shrimp', 3); player.gold = 25; }
    player.questPoints = questPoints(player);
    const s = { id: nextId++, name: account.name, ws, skills, player, x: fake.mesh.position.x, z: fake.mesh.position.z, lastPosAt: Date.now(), action: null, nextAttack: 0, regenAcc: 0, dirty: true, look: true, savedAt: Date.now() };
    setPerkBoost(skills, capeBoosts(player));
    refreshMaxHp(s);
    if (!(player.hp > 0)) player.hp = player.maxHp;
    player.hp = Math.min(player.hp, player.maxHp);
    { const pos = { x: s.x, z: s.z }; resolveCollisions(pos); s.x = pos.x; s.z = pos.z; }
    players.set(s.id, s);
    send(s, { t: 'welcome', id: s.id, name: s.name, tick, x: s.x, z: s.z, save: saveDataOf(s), deadNodes: nodes.filter(n => !n.alive).map(n => n.id) });
    for (const o of near(s)) if (o !== s) say(o, `${s.name} has logged in.`, 'game');
    log(`join ${s.name} (#${s.id})`);
    return s;
  }
  function leave(s) {
    if (!players.has(s.id)) return;
    persist(s);
    players.delete(s.id);
    for (const m of mons) if (m.target === s.id) { m.target = null; m.state = 'return'; }
    log(`leave ${s.name}`);
  }

  // ---- intents (all validated) ------------------------------------------
  function onMove(s, x, z, run) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const now = Date.now();
    const dt = Math.min(1.2, Math.max(0.05, (now - s.lastPosAt) / 1000));
    s.lastPosAt = now;
    const maxStep = RUN_SPEED * 1.3 * dt + 0.6;
    let dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    let nx = x, nz = z, corrected = false;
    if (d > maxStep) { nx = s.x + dx / d * maxStep; nz = s.z + dz / d * maxStep; corrected = true; }
    nx = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, nx));
    nz = Math.max(-WORLD_HALF + 1, Math.min(WORLD_HALF - 1, nz));
    if (insideLake(nx, nz, -0.3)) { nx = s.x; nz = s.z; corrected = true; }
    const pos = { x: nx, z: nz }; resolveCollisions(pos);
    if (Math.hypot(pos.x - x, pos.z - z) > 0.5) corrected = true;
    s.x = pos.x; s.z = pos.z; s.run = !!run;
    if (corrected) { s.strikes = (s.strikes || 0) + 1; send(s, { t: 'pos', x: s.x, z: s.z }); }
  }
  function onGather(s, id) {
    const n = nodes[id];
    if (!n || !['tree', 'rock', 'fish', 'herb'].includes(n.type)) return say(s, "You can't do that.", 'warn');
    s.action = { kind: 'gather', node: n, wait: 0, started: false };
  }
  function onAttack(s, id) {
    const m = mons[id];
    if (!m || !m.alive) return;
    if (isRangedWeapon(s.player.equipment.weapon) && !(s.player.ammoCount > 0)) return say(s, 'There is no ammo left in your quiver.', 'warn');
    s.action = { kind: 'attack', mon: m };
  }
  function onItem(s, kind, item, slot) {
    const p = s.player;
    if (kind === 'eat') { if (typeof item === 'string' && p.inventory[item] && eat(p, item, (t, c) => say(s, t, c), s.skills)) { s.nextAttack = Math.max(s.nextAttack, tick + 2); s.dirty = true; } }
    else if (kind === 'equip') { if (typeof item === 'string' && p.inventory[item] && equip(p, s.skills, item, (t, c) => say(s, t, c))) { afterEquip(s); s.dirty = true; } }
    else if (kind === 'unequip') { if (typeof slot === 'string' && slot in p.equipment && unequip(p, slot, (t, c) => say(s, t, c))) { afterEquip(s); s.dirty = true; } }
    else if (kind === 'style') { const i = Math.floor(item); if (i >= 0 && i < stylesFor(p).length) { p.attackStyle = i; s.dirty = true; } }
  }
  function onChat(s, text) {
    text = String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);
    if (!text) return;
    const now = Date.now();
    if (now - (s.lastChat || 0) < 800) return say(s, 'You are sending messages too quickly.', 'warn');
    s.lastChat = now;
    for (const o of near(s)) send(o, { t: 'chat', id: s.id, from: s.name, text });
  }
  function handle(s, msg) {
    switch (msg.t) {
      case 'move': return onMove(s, +msg.x, +msg.z, msg.run);
      case 'gather': return onGather(s, msg.id | 0);
      case 'attack': return onAttack(s, msg.id | 0);
      case 'stop': s.action = null; return;
      case 'eat': case 'equip': case 'unequip': case 'style': return onItem(s, msg.t, msg.item, msg.slot);
      case 'chat': return onChat(s, msg.text);
    }
  }

  // ---- tick ---------------------------------------------------------------
  function doGather(s) {
    const a = s.action, n = a.node;
    if (!n.alive) { say(s, 'There is nothing left to gather here right now.', 'warn'); s.action = null; return; }
    if (dist(s, n) > n.radius + GATHER_REACH) return;
    if (a.wait > 0) { a.wait--; return; }
    const gi = gatherInfo(n);
    a.wait = gi ? nextGatherWait(s.skills, gi.skill) : 1;
    const r = gatherTick(n, s.skills, s.player);
    if (!r) return;
    if (r.error) { say(s, r.error, 'warn'); s.action = null; return; }
    if (r.bank) s.player.bank[r.item] = (s.player.bank[r.item] || 0) + (r.qty || 1); else addItem(s.player, r.item, r.qty || 1);
    giveXP(s, r.skill, r.xp);
    say(s, `You get ${r.qty > 1 ? r.qty + ' x ' : 'some '}${r.item}.${r.bank ? ' It is sent straight to your bank.' : ''}`, 'skill');
    const dep = DEPLETE[n.type];
    if (dep && Math.random() < dep.chance) {
      n.alive = false; n.respawnAt = Date.now() + rnd(...dep.ms);
      nodeChanges.push([n.id, false]);
      for (const o of players.values()) if (o.action && o.action.node === n) { o.action = null; if (o !== s) say(o, `Someone else got the last of that ${n.type === 'tree' ? 'tree' : 'rock'}.`, 'warn'); }
      say(s, n.type === 'tree' ? 'The tree falls. It will grow back soon.' : 'The rock is mined out. It will refill soon.', 'game');
    }
    if (!r.bank && !canAdd(s.player, r.item)) { say(s, 'Your inventory is too full to hold any more.', 'warn'); s.action = null; }
  }
  function hitMonster(s, m) {
    const p = s.player;
    const ranged = isRangedWeapon(p.equipment.weapon);
    if (ranged) {
      if (!p.equipment.ammo || !(p.ammoCount > 0)) { say(s, 'There is no ammo left in your quiver.', 'warn'); s.action = null; return; }
      if (Math.random() >= perk(s.skills, 'Ranged', 'ammoSave')) { p.ammoCount--; if (p.ammoCount <= 0) { p.equipment.ammo = null; p.ammoCount = 0; s.look = true; } }
    }
    let dmg = 0;
    const swings = [{}];
    for (let i = 0; i < swings.length && i < 3 && m.hp > 0; i++) {
      const d = Math.min(m.hp, rollPlayerHit(p, s.skills, m, Math.random, swings[i]));
      m.hp -= d; dmg += d;
      const pr = weaponProcs(p, d);
      if (pr.again && !swings[i].extra) swings.push({ extra: true });
      if (pr.heal > 0) p.hp = Math.min(p.maxHp, p.hp + pr.heal);
    }
    m.dmgBy[s.id] = (m.dmgBy[s.id] || 0) + dmg;
    for (const o of near(m)) send(o, { t: 'hit', k: 'm', id: m.id, d: dmg, by: s.id, rng: ranged ? 1 : 0 });
    for (const [sk, v] of Object.entries(combatXp(p, dmg))) giveXP(s, sk, v);
    s.lastCombatTick = tick;
    if (m.state !== 'fight' || m.target == null || !players.has(m.target)) { m.state = 'fight'; m.target = s.id; m.nextAttackTick = Math.max(m.nextAttackTick, tick + 1); }
    if (m.hp <= 0) killMonster(m);
    s.dirty = true;
  }
  function killMonster(m) {
    m.alive = false; m.state = 'dead'; m.hp = 0;
    m.respawnAt = Date.now() + (m.respawn || 15000) + 900;
    // Loot goes to whoever did the most damage (like RuneScape), rolled here on the server only.
    let best = null, bd = -1;
    for (const [id, d] of Object.entries(m.dmgBy)) if (players.has(+id) && d > bd) { bd = d; best = players.get(+id); }
    m.dmgBy = {};
    for (const o of players.values()) if (o.action && o.action.mon === m) o.action = null;
    if (!best) return;
    say(best, `You have defeated the ${m.name}.`, 'combat');
    for (const t of onKill(best.player, m.name)) say(best, t, 'game');
    const kh = perk(best.skills, 'Hitpoints', 'killHeal');
    if (kh && best.player.hp > 0) best.player.hp = Math.min(best.player.maxHp, best.player.hp + Math.max(1, Math.round(best.player.maxHp * kh)));
    const drops = rollLoot(m.name);
    const got = [];
    for (const d of drops) {
      const where = grant(best, d.item, d.qty);
      got.push(`${d.qty > 1 ? d.qty + ' x ' : ''}${d.item}${where === 'bank' ? ' (to bank)' : ''}`);
      if (isRareDrop(d.item)) for (const o of players.values()) say(o, `${best.name} received a rare drop: ${d.item}!`, 'loot', '#ffd84a');
    }
    if (got.length) say(best, `Loot: ${got.join(', ')}.`, 'loot');
    best.dirty = true;
  }
  function monsterAttack(m, s) {
    const p = s.player;
    const raw = rollMonsterHit(m, p, s.skills);
    let dmg = reduceIncoming(raw, p, s.skills, {});
    if (dmg > 0 && Math.random() < perk(s.skills, 'Defence', 'block')) dmg = 0;
    p.hp = Math.max(0, p.hp - dmg);
    for (const o of near(s)) send(o, { t: 'hit', k: 'p', id: s.id, d: dmg, from: m.id });
    s.lastCombatTick = tick; s.dirty = true;
    if (p.hp <= 0) return playerDied(s);
    if (p.settings.autoRetaliate && !s.action) s.action = { kind: 'attack', mon: m };
  }
  function playerDied(s) {
    say(s, 'Oh dear, you are dead! You wake up in town. You keep all of your items.', 'warn');
    s.action = null;
    s.x = SPAWN.x + 1; s.z = SPAWN.z + 1;
    refreshMaxHp(s); s.player.hp = s.player.maxHp; s.player.activePrayers = [];
    for (const m of mons) if (m.target === s.id) { m.target = null; m.state = 'return'; }
    send(s, { t: 'pos', x: s.x, z: s.z, died: true });
  }
  function moveToward(m, tx, tz, step, stop) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d <= stop) return;
    const k = Math.min(d - stop, step) / d;
    m.x += dx * k; m.z += dz * k;
    if (m.state !== 'idle') { const pos = { x: m.x, z: m.z }; resolveCollisions(pos); m.x = pos.x; m.z = pos.z; }
  }
  function updateMonster(m, now) {
    if (!m.alive) {
      if (now >= m.respawnAt) { m.alive = true; m.hp = m.maxHp; m.state = 'idle'; m.x = m.spawnX; m.z = m.spawnZ; m.target = null; m.dmgBy = {}; }
      return;
    }
    const dt = TICK_MS / 1000;
    if (m.state === 'fight') {
      const s = players.get(m.target);
      if (!s) { m.state = 'return'; m.target = null; return; }
      const d = dist(m, s), leash = Math.hypot(m.x - m.spawnX, m.z - m.spawnZ);
      if (d > 13 || leash > 16) { m.state = 'return'; m.target = null; return; }
      const reach = m.range || 1.7 + (m.radius - 0.7);
      moveToward(m, s.x, s.z, 3.0 * dt, m.range ? m.range - 1 : 1.3);
      if (dist(m, s) <= reach + 0.3 && tick >= m.nextAttackTick) { m.nextAttackTick = tick + m.speed; monsterAttack(m, s); }
    } else if (m.state === 'return') {
      moveToward(m, m.spawnX, m.spawnZ, 3.0 * dt, 0.1);
      if (Math.hypot(m.x - m.spawnX, m.z - m.spawnZ) < 0.4) { m.state = 'idle'; m.hp = m.maxHp; m.dmgBy = {}; }
    } else {
      if (now > m.wanderAt) {
        m.wanderAt = now + 3000 + Math.random() * 6000;
        m.wx = m.spawnX + (Math.random() - 0.5) * 2 * m.roam;
        m.wz = m.spawnZ + (Math.random() - 0.5) * 2 * m.roam;
        if (m.bounds) { m.wx = Math.max(m.bounds.minX, Math.min(m.bounds.maxX, m.wx)); m.wz = Math.max(m.bounds.minZ, Math.min(m.bounds.maxZ, m.wz)); }
      }
      if (m.wx !== undefined) moveToward(m, m.wx, m.wz, 1.4 * dt, 0.1);
    }
  }
  function tickPlayer(s) {
    const p = s.player;
    if (p.hp < p.maxHp && p.hp > 0) {
      s.regenAcc += (1 + perk(s.skills, 'Hitpoints', 'regen') + prayerFx(p, 'regen') + regenBonus(p)) / 6;
      while (s.regenAcc >= 1) { s.regenAcc--; p.hp = Math.min(p.maxHp, p.hp + 1); s.dirty = true; }
    }
    const a = s.action;
    if (!a) return;
    if (a.kind === 'gather') doGather(s);
    else if (a.kind === 'attack') {
      const m = a.mon;
      if (!m.alive) { s.action = null; return; }
      if (dist(s, m) <= attackRange(p) + m.radius + MELEE_SLACK && tick >= s.nextAttack) { s.nextAttack = tick + attackSpeedTicks(p); hitMonster(s, m); }
    }
  }
  function step() {
    tick++;
    const now = Date.now();
    for (const n of nodes) if (!n.alive && now >= n.respawnAt) { n.alive = true; nodeChanges.push([n.id, true]); }
    for (const s of players.values()) tickPlayer(s);
    for (const m of mons) updateMonster(m, now);
    // Interest management: each client only hears about what is within VIEW_RANGE.
    const changes = nodeChanges.splice(0);
    for (const s of players.values()) {
      const ps = near(s).filter(o => o !== s).map(publicInfo);
      const ms = mons.filter(m => dist(m, s) <= VIEW_RANGE).map(m => [m.id, +m.x.toFixed(2), +m.z.toFixed(2), m.hp, m.maxHp, m.alive ? 1 : 0, m.state === 'fight' ? m.target : 0]);
      send(s, { t: 'snap', tick, me: { hp: s.player.hp, maxHp: s.player.maxHp, act: s.action ? s.action.kind : null }, players: ps, mons: ms, nodes: changes });
      if (s.dirty) { s.dirty = false; send(s, selfState(s)); }
      if (now - s.savedAt > 30000) persist(s);
    }
  }
  const timer = setInterval(step, TICK_MS);
  return {
    players, nodes, mons, join, leave, handle, step, NAME_RE,
    get tick() { return tick; },
    stop() { clearInterval(timer); for (const s of players.values()) persist(s); }
  };
}
