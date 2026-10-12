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
  ['grell', 'Hermit Grell', -24, -52, 'hermit', 'He has lived alone in the wilds for years.', '🧙‍♂️'],
  // Port Sarim
  ['redbeard', 'Captain Redbeard', -83, 69, 'pirate', 'A pirate captain with a magnificent beard.', '🏴‍☠️'],
  ['wydin', 'Wydin the Grocer', -73, 57, 'cook', 'Port Sarim\u2019s food merchant.', '🧑‍🍳'],
  ['gerda', 'Net-mender Gerda', -87, 67, 'sailor', 'Her nets have caught more fish than anyone alive.', '🎣'],
  ['brice', 'Harbourmaster Brice', -77, 66, 'noble', 'Nothing enters or leaves the harbour without his say.', '⚓'],
  ['thurgo', 'Thurgo', -91, 53, 'dwarf', 'A dwarf smith who loves pie.', '🧔'],
  ['mabel', 'Old Mabel', -71, 63, 'granny', 'She claims to remember the Water altar being built.', '👵'],
  ['kenn', 'Kennith', -85, 63, 'kid', 'A cabin boy who missed his ship.', '👦'],
  ['velma', 'Velma the Witch', -93, 59, 'wizard', 'She smells of herbs and something stranger.', '🧙‍♀️'],
  ['sorrel', 'Ranger Sorrel', -98, 52, 'ranger', 'She guards the western woods.', '🏹'],
  // Varrock
  ['reldo', 'Reldo the Librarian', 116, -36, 'scholar', 'Varrock\u2019s librarian. He knows a little about everything.', '📖'],
  ['romeo', 'Romeo', 122, -47, 'noble', 'A lovesick young man.', '🌹'],
  ['baraek', 'Baraek', 129, -38, 'worker', 'A fur trader with a keen eye for a bargain.', '🧥'],
  ['zaff', 'Zaff', 111, -41, 'wizard', 'He makes and sells staves.', '🪄'],
  ['charlie', 'Charlie the Tramp', 125, -29, 'hermit', 'He knows the streets of Varrock better than anyone.', '🧔'],
  ['rovin', 'Captain Rovin', 118, -53, 'knight', 'Captain of the Varrock palace guard.', '🛡️'],
  ['gertrude', 'Gertrude', 109, -34, 'granny', 'She is looking for her cat.', '👵'],
  ['ellis', 'Ellis the Tanner', 131, -45, 'worker', 'His hands are stained brown from tanning.', '🧑‍🏭'],
  ['vorn', 'Apothecary Vorn', 114, -28, 'herbal', 'Varrock\u2019s potion maker.', '⚗️'],
  ['vannaka', 'Slayer Master Vannaka', 110, -80, 'soldier', 'A grizzled monster hunter.', '⚔️']
];
export const QUEST_NPCS = RAW.map(([id, name, x, z, look, examine, face]) => ({ id, name, x, z, look: L[look], examine, face }));
