// Combat Paths: at combat level 30 pick Bulwark (tank), Mender (healer/support) or Striker (damage). Each Path adds
// two Path skills to your bar and a passive; every 10 combat levels (30-90) opens a talent row with a 1-of-3 pick.
// Switch for free at your Hearthstead lectern or with Pathwarden Idris in Falador. Logic and UI only.
export const PATH_LEVEL = 30;
export const PATHS = {
  bulwark: { name: 'Bulwark', icon: '🛡️', role: 'tank', desc: 'Take 10% less damage. Skills: Challenge, Stalwart Wall.', red: 0.10, skills: ['challenge', 'wall'] },
  mender: { name: 'Mender', icon: '✚', role: 'healer', desc: 'Regenerate faster. Skills: Mending Light, Warding Hymn.', regen: 1.0, skills: ['mend', 'ward'] },
  striker: { name: 'Striker', icon: '⚔️', role: 'damage', desc: '+8% damage. Skills: Rending Blow, Flurry.', dmg: 0.08, skills: ['rend', 'flurry'] }
};
// 7 rows (combat 30, 40 ... 90), 3 picks each. Effects: red (damage taken), dmg, acc, regen (hp/tick), killHeal (fraction of max hp).
export const TALENTS = [
  [['Thick Hide', { red: 0.04 }], ['Keen Edge', { dmg: 0.04 }], ['Steady Hand', { acc: 0.05 }]],
  [['Second Breath', { regen: 0.5 }], ['Butcher', { killHeal: 0.04 }], ['Iron Will', { red: 0.04 }]],
  [['Precision', { acc: 0.06 }], ['Brutality', { dmg: 0.05 }], ['Bulwark Stance', { red: 0.05 }]],
  [['Field Medic', { regen: 0.8 }], ['Vampiric', { killHeal: 0.06 }], ['Sharpshooter', { acc: 0.07 }]],
  [['Juggernaut', { red: 0.06 }], ['Executioner', { dmg: 0.06 }], ['Lifeblood', { regen: 1.0 }]],
  [['Hawk Eye', { acc: 0.08 }], ['Unbroken', { red: 0.06 }], ['Reaver', { dmg: 0.07, killHeal: 0.03 }]],
  [['Avatar of War', { dmg: 0.1 }], ['Living Fortress', { red: 0.1 }], ['Font of Life', { regen: 1.5, killHeal: 0.05 }]]
];
export const rowsOpen = cl => Math.max(0, Math.min(TALENTS.length, Math.floor((cl - PATH_LEVEL) / 10) + 1));
export function normalizePath(p) {
  p = p && typeof p === 'object' ? p : {};
  const id = PATHS[p.id] ? p.id : null;
  const talents = Array.isArray(p.talents) ? p.talents.slice(0, TALENTS.length).map(v => (v === 0 || v === 1 || v === 2 ? v : null)) : [];
  return { id, talents, switches: Math.max(0, Math.floor(Number(p.switches) || 0)) };
}
// Sum of passive + talent effects for the current path.
export function pathFx(P) {
  const o = { red: 0, dmg: 0, acc: 0, regen: 0, killHeal: 0 };
  if (!P || !P.id) return o;
  const d = PATHS[P.id]; for (const k in o) if (d[k]) o[k] += d[k];
  P.talents.forEach((v, i) => { if (v != null && TALENTS[i]) { const fx = TALENTS[i][v][1]; for (const k in fx) o[k] += fx[k]; } });
  o.red = Math.min(0.45, o.red);
  return o;
}
