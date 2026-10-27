// Skywing: a free-flying steed. Unlock at Agility 70 plus Exalted with any one faction.
// Flight is the normal walk controller with a height lift; dives spend run energy.
export const SKYWING = { agility: 70, cruise: 18, max: 30, min: 6, step: 6, speed: 1.9, diveCost: 12, farLow: 300, farHigh: 420 };
export function normalizeSkywing(s) { s = s && typeof s === 'object' ? s : {}; return { unlocked: !!s.unlocked, flights: Math.max(0, Math.floor(+s.flights || 0)) }; }
