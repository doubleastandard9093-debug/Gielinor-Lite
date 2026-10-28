// Charter vs Commons: the frontier hamlet of Wellmere. The Wellmere Charter (merchants) and the Commons
// (a breakaway commune) both claim the same spring. Side with one, broker a deal (Persuade), or betray both (Lie).
// The outcome is permanent: it changes who lives there, what is sold, and how your companion feels.
export const HAMLET = { x: 40, z: 90, name: 'Wellmere' };
export const SIDES = {
  charter: { name: 'Wellmere Charter', short: 'the Charter', boon: 'watch', rep: 80 },
  commons: { name: 'Wellmere Commons', short: 'the Commons', boon: 'lantern', rep: 80 },
  deal: { name: 'the Spring Accord', short: 'both sides', rep: 40 },
  betray: { name: 'betrayal', short: 'no one', coins: 5000 }
};
export const DEAL_NEED = 40, BETRAY_NEED = 30;
// Companion approval by the tone they like.
export const APPROVAL = {
  kind: { charter: -1, commons: 3, deal: 3, betray: -5 },
  firm: { charter: 3, commons: -1, deal: 1, betray: -3 },
  cunning: { charter: 1, commons: -1, deal: 2, betray: 3 }
};
export const STALLS = {
  charter: [['Steel bar', 5, 450], ['Rune bar', 1, 2400], ['Coal', 20, 300]],
  commons: [['Grimy ranarr', 3, 600], ['Bread', 10, 120], ['Feather', 50, 150]],
  deal: [['Steel bar', 5, 500], ['Bread', 10, 130], ['Coal', 20, 320]]
};
export function normalizeCharter(c) {
  c = c && typeof c === 'object' ? c : {};
  const r = c.rep || {};
  return { met: !!c.met, side: SIDES[c.side] ? c.side : null, rep: { charter: Math.round(+r.charter || 0), commons: Math.round(+r.commons || 0) }, bought: Math.max(0, Math.floor(+c.bought || 0)) };
}
