// NPCs who give the data-driven quests (quests2.js). world.js spawns them near
// (x, z) on a free spot; looks reuse the shared townsperson model.
const L = {
  elder: { body: 0x6a5a7a, legs: 0x3a3a4a, hat: null, beard: 0xdddddd },
  granny: { body: 0x8a5a7a, legs: 0x5a3a4a, apron: 0xe0d8c8, hat: 0xd0c8c0, hatH: 0.14 },
  kid: { body: 0x7a8a3a, legs: 0x4a3a2a, hat: 0x5a3a1a, hatH: 0.12 },
  worker: { body: 0x8a6a4a, legs: 0x5a4a3a, apron: 0x6a4a2a },
  scholar: { body: 0x3a3a7a, legs: 0x2a2a4a, hat: 0x3a3a7a, hatH: 0.35, hatW: 0.36 },
  soldier: { body: 0x8a2a2a, legs: 0x3a3a4a, hat: 0x9a9aa8, hatH: 0.25 },
  knight: { body: 0xb0b0c0, legs: 0x8a8a9a, hat: 0xc0c0d0, hatH: 0.3, apron: 0x2a4aa0 },
  priest: { body: 0x2a2a3a, legs: 0x2a2a3a, apron: 0xd4af37, beard: 0x8a8a8a },
  ranger: { body: 0x2a5a2a, legs: 0x3a2a1a, hat: 0x1e4a1e, hatH: 0.2 },
  sailor: { body: 0x2a4a7a, legs: 0xe0e0e0, hat: 0xf0f0f0, hatH: 0.12 },
  pirate: { body: 0x6a1a1a, legs: 0x2a2a2a, hat: 0x1a1a1a, hatH: 0.2, beard: 0x3a2a1a },
  cook: { body: 0xf0f0f0, hat: 0xffffff, hatH: 0.4, apron: 0xe0e0e0 },
  smith: { body: 0x6a3a2a, beard: 0xa06a2a, apron: 0x3a3a3a },
  farmer: { body: 0x6a8a3a, legs: 0x4a5a8a, hat: 0xd8c070, hatW: 0.75, hatH: 0.12 },
  noble: { body: 0x7a1a4a, legs: 0x3a1a2a, hat: 0xd4af37, hatH: 0.15 },
  wizard: { body: 0x5a2a8a, legs: 0x3a1a5a, hat: 0x5a2a8a, hatH: 0.5, hatW: 0.42, beard: 0xcccccc },
  dwarf: { body: 0x5a4a3a, legs: 0x3a2a1a, hat: 0x6a5a4a, hatH: 0.2, beard: 0xc06a2a },
  herbal: { body: 0x4a7a5a, legs: 0x3a3a2a, hat: 0x2a5a3a, hatH: 0.22, apron: 0xe0e0d0 },
  hermit: { body: 0x5a4a2a, legs: 0x3a2a1a, beard: 0xbbbbbb },
  thief: { body: 0x2a2a2a, legs: 0x1a1a1a, hat: 0x1a1a1a, hatH: 0.15 }
};
// [id, name, x, z, look, examine, face]
const RAW = [
  // Brightwater
  ['hilda', 'Granny Hilda', -10, 6, 'granny', 'A sweet old lady with flour on her sleeves.', '👵'],
  ['mara', 'Mara the Weaver', -9, -6, 'worker', 'Her fingers never stop moving.', '🧶'],
  ['pip', 'Pip', 6, 5, 'kid', 'A scruffy street urchin. Watch your coin purse.', '🧒'],
  ['osric', 'Osric the Gravedigger', -12, -12, 'hermit', 'He smells of fresh earth.', '⚰️'],
  ['lena', 'Lena the Lamplighter', 10, -3, 'worker', 'She keeps Brightwater\u2019s lamps burning.', '🏮'],
  ['bram', 'Bram the Brewer', -11, 1, 'cook', 'A jolly man with a barrel-shaped belly.', '🍺'],
  ['tamsin', 'Tamsin the Scholar', 4, 15, 'scholar', 'She is never seen without a book.', '📚'],
  ['aldo', 'Old Aldo', 11, 12, 'soldier', 'A retired soldier with many scars.', '👴'],
  ['dell', 'Coach Dell', 14, 30, 'ranger', 'Brightwater\u2019s agility coach. Fit as a fiddle.', '🏃'],
  // Wilds
  ['grell', 'Hermit Grell', -24, -52, 'hermit', 'He has lived alone in the wilds for years.', '🧙‍♂️']
];
export const QUEST_NPCS = RAW.map(([id, name, x, z, look, examine, face]) => ({ id, name, x, z, look: L[look], examine, face }));
