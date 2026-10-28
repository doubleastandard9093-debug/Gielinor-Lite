// Warband Siege: a 4-boss raid against the Ashen Warband with you, your companions and hired sellswords.
// Offline only (bots, no network). Caps keep phones smooth: at most 8 friendly and 10 hostile units.
export const SIEGE = { x: -1000, z: -640, r: 16 };
export const FRIEND_CAP = 8, HOSTILE_CAP = 10;
export const SELLSWORDS = ['Garrow the Hired', 'Lisk Ironpay', 'Old Tamberly', 'Wenna Shieldwright', 'Dace the Lamplighter'];
export const BOSSES = [
  { id: 'gorrak', name: 'Gorrak Gatebreaker', base: 'Ogre', scale: 1.8, hp: 2600, maxHit: 60, att: 60, def: 50, mechs: ['fire'] },
  { id: 'matron', name: 'The Cinder Matron', base: 'Lesser Demon', scale: 1.6, hp: 2800, maxHit: 64, att: 64, def: 54, mechs: ['fire', 'adds'] },
  { id: 'ironjaw', name: 'Ironjaw', base: 'Ice Giant', scale: 1.8, hp: 3000, maxHit: 66, att: 66, def: 58, mechs: ['stack', 'fire'] },
  { id: 'warchief', name: 'Warchief Vaskarr', base: 'Black Knight', scale: 1.7, hp: 3600, maxHit: 72, att: 72, def: 62, mechs: ['stack', 'fire', 'adds'] }
];
export const MECH = { every: 8, warn: 3, fireR: 3, fireDmg: 0.3, stackR: 3.2, stackDmg: 0.4, adds: 2, addType: 'Ashen raider' };
export const LOOT = [['Rune full helm', 'Rune shield'], ['Rune platelegs'], ['Rune platebody'], ['Dragon ore', 'Rune bar']];
export const BOSS_COINS = 1500;
export function normalizeSiege(s, week) {
  s = s && typeof s === 'object' ? s : {};
  const same = +s.week === week;
  return { week, downed: same && Array.isArray(s.downed) ? s.downed.filter(id => BOSSES.some(b => b.id === id)) : [], clears: Math.max(0, Math.floor(+s.clears || 0)) };
}
