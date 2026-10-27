// Hearthstead: an instanced home plot behind Brightwater. Buy a deed, build four rooms, then
// place furniture made with Crafting or Smithing. Rooms give small lasting perks. Logic and data only.
export const DEED_COST = 25000;
export const ROOMS = [
  { id: 'workshop', name: 'Workshop', gold: 15000, items: [['Oak logs', 20], ['Iron bar', 10]], skills: ['Smithing', 'Crafting', 'Fletching'], desc: '+5% XP in Smithing, Crafting and Fletching', pos: [-6, -4.5], color: 0x8a6a4a },
  { id: 'garden', name: 'Herb garden', gold: 10000, items: [['Logs', 20]], skills: ['Herblore'], desc: '+5% Herblore XP and a herb harvest every 12 hours', pos: [6, -4.5], color: 0x4a7a3a },
  { id: 'trophy', name: 'Trophy hall', gold: 30000, items: [['Steel bar', 10]], skills: [], desc: '+2% damage against bosses for each boss trophy you mount', pos: [-6, 4.5], color: 0x7a3a3a },
  { id: 'quarters', name: 'Companion quarters', gold: 20000, items: [['Oak logs', 30]], skills: [], desc: '+10% errand success, and companions gain a Bond point each day they live here', pos: [6, 4.5], color: 0x3a4a7a }
];
export const FURNITURE = [
  { id: 'bench', room: 'workshop', name: 'Oak workbench', skill: 'Crafting', level: 20, items: [['Oak logs', 6]], xp: 300, desc: 'Workshop XP bonus +2%', size: [1.8, 0.9, 0.8] },
  { id: 'anvil', room: 'workshop', name: 'Anvil stand', skill: 'Smithing', level: 30, items: [['Iron bar', 6]], xp: 400, desc: 'Workshop XP bonus +2%', size: [0.8, 0.8, 0.6] },
  { id: 'planter', room: 'garden', name: 'Herb planter', skill: 'Crafting', level: 15, items: [['Logs', 10]], xp: 200, desc: '+2 herbs per harvest', size: [2.0, 0.5, 0.9] },
  { id: 'trough', room: 'garden', name: 'Watering trough', skill: 'Smithing', level: 20, items: [['Iron bar', 4]], xp: 250, desc: '+2 herbs per harvest', size: [1.4, 0.6, 0.6] },
  { id: 'plinth', room: 'trophy', name: 'Mounting plinth', skill: 'Smithing', level: 40, items: [['Steel bar', 6]], xp: 600, desc: '+1% extra boss damage per trophy', size: [1.0, 1.0, 1.0] },
  { id: 'banners', room: 'trophy', name: 'Banner rack', skill: 'Crafting', level: 30, items: [['Cowhide', 4], ['Logs', 4]], xp: 350, desc: '+2% boss damage', size: [1.6, 2.0, 0.3] },
  { id: 'bunks', room: 'quarters', name: 'Bunks', skill: 'Crafting', level: 25, items: [['Oak logs', 10]], xp: 350, desc: '+5% errand success', size: [2.0, 1.2, 0.9] },
  { id: 'stove', room: 'quarters', name: 'Hearth stove', skill: 'Smithing', level: 25, items: [['Iron bar', 5]], xp: 350, desc: '+1 more Bond per day', size: [0.9, 1.1, 0.8] }
];
export const BOSS_TROPHIES = { Grumsh: "Grumsh's tusk", Scorchwing: "Scorchwing's horn", 'Captain Saltgrave': "Saltgrave's tricorn" };
export const HARVEST_MS = 12 * 3600 * 1000, BOND_DAY_MS = 20 * 3600 * 1000;

export function normalizeHouse(h) {
  h = h && typeof h === 'object' ? h : {};
  const ids = (a, ok) => Array.isArray(a) ? [...new Set(a.filter(x => ok.includes(x)))] : [];
  return { deed: !!h.deed, rooms: ids(h.rooms, ROOMS.map(r => r.id)), furniture: ids(h.furniture, FURNITURE.map(f => f.id)),
    trophies: ids(h.trophies, Object.keys(BOSS_TROPHIES)), harvestAt: Number(h.harvestAt) || 0, bondAt: Number(h.bondAt) || 0 };
}
export const hasRoom = (h, id) => !!(h && h.deed && h.rooms.includes(id));
export const hasFurn = (h, id) => !!(h && h.furniture.includes(id));
export function houseXpBonus(h, skill) {
  if (hasRoom(h, 'workshop') && ROOMS[0].skills.includes(skill)) return 0.05 + (hasFurn(h, 'bench') ? 0.02 : 0) + (hasFurn(h, 'anvil') ? 0.02 : 0);
  if (hasRoom(h, 'garden') && skill === 'Herblore') return 0.05;
  return 0;
}
export function houseBossDamage(h) {
  if (!hasRoom(h, 'trophy')) return 0;
  return h.trophies.length * (0.02 + (hasFurn(h, 'plinth') ? 0.01 : 0)) + (hasFurn(h, 'banners') ? 0.02 : 0);
}
export function houseErrandBonus(h) { return hasRoom(h, 'quarters') ? 0.1 + (hasFurn(h, 'bunks') ? 0.05 : 0) : 0; }
// Herbs ready to pick (0 if not yet). Marks the harvest taken.
export function takeHarvest(h, now) {
  if (!hasRoom(h, 'garden') || now - h.harvestAt < HARVEST_MS) return 0;
  h.harvestAt = now; return 4 + (hasFurn(h, 'planter') ? 2 : 0) + (hasFurn(h, 'trough') ? 2 : 0);
}
// Daily Bond for companions living in the quarters (0 if not yet).
export function takeBondDay(h, now) {
  if (!hasRoom(h, 'quarters') || now - h.bondAt < BOND_DAY_MS) return 0;
  h.bondAt = now; return 1 + (hasFurn(h, 'stove') ? 1 : 0);
}
// Records a first boss kill. Returns the trophy name, or null.
export function addTrophy(h, boss) {
  if (!BOSS_TROPHIES[boss] || h.trophies.includes(boss)) return null;
  h.trophies.push(boss); return BOSS_TROPHIES[boss];
}
