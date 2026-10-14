# Gielinor

Browser-based 3D RPG inspired by classic RuneScape (2004 era). Plain static site, no build step.
The original 2D game lives in `/2d/`.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Settings → Pages → Deploy from main branch
3. Live at `https://yourusername.github.io/repo-name/`

## Interface

The UI is original art made in code: CSS, inline SVG and canvas. There are no image files and no Jagex or Artix assets.

- **Theme** (`css/theme.css`): the "Forged Gold" look. It has colour, type and frame tokens, stone panels with SVG filigree corners, parchment panels, bevelled buttons, gem-set tabs, and hover and press animations. `--ui-scale` (Settings → UI scale: 85, 100, 115 or 130%) zooms every HUD block, and the side panel height adjusts to fit.
- **HUD** (`js/hud.js`):
  - Glass orbs with a liquid fill for hitpoints, prayer, run and adrenaline. Adrenaline builds as you land hits and fades out of combat, and it is display only for now.
  - A target panel with the target's name, a level badge coloured by combat level and an HP bar with damage lag.
  - XP drops and a floating XP tracker showing XP gained, XP to the next level and XP per hour.
  - Buff timer rings.
  - An action bar with conic cooldown sweeps and 1 to 8 keybinds.
- **Icons** (`js/icons.js`): every item is painted on a 64 px canvas. The shape comes from its category (sword, axe, helm, platebody, bow, arrows, bar, ore, logs, fish, potion, rune and so on) and the colour from its metal, wood, rune, potion or rarity. Icons are cached as data URLs. Rarity adds a coloured glow, and epic and legendary items also get a moving shine.
- **Panels** (`js/inventoryUI.js`):
  - Rich tooltips on desktop hover, showing stats, special, requirements and value.
  - An equipment paper doll with slot silhouettes.
  - Skill tiles with XP tooltips.
  - A quest journal with town, status and difficulty filters and a progress bar.
  - A bank with category tabs, search and placeholders (`settings.bankPh`).
- **World UI**:
  - A minimap ring with zoom, a map key and a player arrow (`js/minimap.js`).
  - Nameplates over nearby monsters and townsfolk (`overlays.setPlates` / `updatePlates`).
  - Painted, name-seeded dialogue portraits (`js/portrait.js`).
  - Chat with unread badges and timestamps.
  - A title and loading screen (`#loader` in index.html).
  - Optional interface clicks, synthesised with WebAudio.
- **Adrenaline** (`ADREN` in abilities.js): basic abilities build +9%, thresholds cost 50% and ultimates cost 100%. The HUD owns the gauge, which you can control with `hud.spend` and `hud.gain`.
- **Keybinds** (`js/keybinds.js`): every keyboard action can be rebound in Settings. Binds are saved to localStorage under `gielinor-keybinds`, binding a key unbinds any other action using it, and there's a reset to defaults.
- **Polish:** tab and window transitions, and a level-up banner with a ring flash and spark burst. Safe-area insets are respected, with layouts for phone portrait, phone landscape and desktop.

## Graphics

- **Fog and view distance:** High uses FogExp2 density 0.0025, a 760-unit far plane and a 135-unit cull radius, so the northern mountains stay readable. Low uses 0.0064, 520 and 70.

Modern, RuneScape 3-inspired look made entirely in code (no image files or third-party art): sky dome with sun and clouds, warm sunlight with soft shadows, bloom and a light colour grade, splat-textured terrain (grass, dirt paths, sand, cobbles) with hills beyond the map edge, animated water, swaying layered trees, ore-veined rocks, timber and stone buildings with tiled gable roofs, grass/flower/bush ground clutter, and rounded player, NPC and monster models. Most models are baked into one mesh each to keep draw calls low on phones.

**Character detail** (`js/anatomy.js`): jointed humanoid rigs (shoulder > elbow > hand with fingers and thumb, hip > knee > foot), lathe-shaped muscled limbs and torso, faces (skull with jaw and brow, nose, nostrils, eyes with iris and pupil, eyelids, brows, lips, ears) and eight hair styles. `varyLook` seeds height, build, skin, hair, eyes and clothing per NPC. Distance LOD: a cheap baked mesh far away, and the detailed rig built on demand within 30 units (10 on Low) and freed when you walk away.

**Creature detail** (`js/creatures.js`): close monsters get a detailed rig per type (wolf, cow, spider, dragon, plus muscled humanoids for goblins, giants, ogres, demons, skeletons and zombies). Fur, hide, chitin and scales are painted into vertex colours, and legs have knees, hocks or three spider joints. `rollVariant` seeds size, tint, markings and part differences per spawn. `namedVariant` gives about 1 in 8 spawns a name (display only; quests still count the base type).

**Character shading** (`makeCharMat` in anatomy.js): a triplanar noise bump (skin pores, weave, fur), a Fresnel rim and sheen, and a warm subsurface term on skin-toned vertex colours. There are presets for skin and cloth, fur, hide, scales and chitin. The extra terms switch off on Low. Contact-shadow blobs sit under every character. Shadows are 4096 with a 16-sample soft filter on High and 1024 on Low (`setShadows` / `tuneLights` in scene.js).

**Elevation** (`reliefHeight` / `bakeHeightField` in world.js): hills, ridges, a southern dale, a western plateau and a northern mountain range (about -6 to +26). After placement, a flatness field is stamped from towns, roads, the lake, colliders, non-resource nodes, reserved areas and `FLAT_SPOTS`, then blended over 10 units and baked into a 1-unit grid. `terrainHeight` does a bilinear lookup. Placed objects, trees, rocks and decor instances, piles, fires, the player, monsters, patrolling staff and the camera all sample it. The terrain shader adds rock on steep slopes and high ground, and snow on the peaks.

**The wilds** (POI block at the end of `createWorld`, own rng 5150): the travellers' camp, ruins, watchtower and bandit hideout, hunter's camp, wayside shrine (an `altar`), mountain cave with ore, and a mountain pond (`PONDS`; `waterAt` blocks walking on it). There are also 18+ forage bushes (`type: 'forage'`, Herblore XP, 45 s regrowth), extra outer-ring spawns, a wandering pedlar shop and a pilgrim (`registerDynamic`, so they stream with their position), and `LANDMARKS` on signposts and the minimap. Repeatable bounties (`ent.bounty`, `player.bounties`, saved) come from the Ruins Warden, Captain Brann and Rhea the Hunter. Ambient wildlife (`js/critters.js`): pooled bird flocks, rabbits and deer recycled around the player; they flee when you approach.

**Guilds** (`GUILDS` in world.js): Mining Guild (Mining 60: high-level rocks, furnace, anvil, bank), Cooking Guild (Cooking 32: two ranges, bank) and Crafting Guild (Crafting 40: furnace, anvil, bank). Entry is level-checked at the door.

**Skill content:** Fletching has bows, arrows, crossbows and bolts. Smithing adds thrown daggers and throwing axes (thrown weapons need no ammo) and a Battlestaff. Crafting adds cloth, Wizard and Mystic robes and staves. Fishing adds anchovies, tuna and monkfish. Cooking adds buff dishes (Hearty stew: Strength; Monk's broth: prayer restore; Fisherman's pie: Defence; Warrior's feast: Attack and Strength).

**Building interiors:** buildings are hollow with a doorway facing the town square (wall colliders leave a gap); the roof hides while you're inside. Smithies have a forge and anvil with the smith patrolling between them, shops have a counter and shelves with a pacing shopkeeper, banks have a 2–3 window counter and a Banker. Taps inside or outside a building route you through the door.

**Map size:** `WORLD_HALF = 300` (600 × 600). The terrain mesh resolution scales with it.

**Chunk streaming** (`js/chunk.js`): the world is cut into 32×32 chunks. Buildings, NPC stalls, props and monsters are attached to the scene only in chunks within `LOAD_RADIUS` of the player (2 on Low = 5×5, 3 on High = 7×7) and detached when far; gameplay data (HP, respawns, colliders) is kept. Trees, rocks and ground clutter use instancing and their own decor chunks.

**Settings → Graphics quality** cycles Auto / High / Low. Low skips bloom, colour grade, clouds, sway, grass and shadows and renders at a lower resolution. Auto starts on High and drops to Low once if a phone averages under ~26 fps.

## Controls

- **Tap** a tree, rock, fishing spot, monster, item pile, townsperson, furnace, anvil, range, altar, the bank booth or a shop to walk there and act.
  Gathering, fighting, crafting and burying repeat every game tick (0.6s) until the resource runs out, your pack is full, or the target dies.
- **Hold** (or right-click) anything for options: Attack, Chop down, Mine, Prospect, Net/Lure/Cage/Harpoon, Talk-to, Trade, Pray-at, Smelt, Smith, Cook, Bank, Take, Examine, Walk here.
- **Tap ground** to walk (you walk around buildings). **Tap the minimap** to walk there. **Tap the compass** to face north.
- **Drag** to turn the camera. **Pinch** or **scroll** to zoom. Desktop: WASD to walk, arrow keys to turn the camera, 1-8 for combat skills, Esc closes menus.
- **Orbs** by the minimap show hitpoints, prayer points (tap for the Prayer tab) and run energy (tap to walk/run).
- **Quick bar** (bottom left) holds the combat skills you've unlocked.

The game saves itself every 15 seconds and whenever you leave the app. Old saves upgrade automatically.

## Side panel tabs

- **Combat:** attack style, combat skills with their unlock levels, auto retaliate, run.
- **Skills:** tap a skill for XP to next level, your running total of perk bonuses, and its full perk list (✔ unlocked, 🔒 locked, ★ milestone).
- **Quests:** red = not started, yellow = in progress, green = complete. Filter by town or status with the chips at the top. Tap a quest for its journal, requirements, rewards and lasting bonus. **Quest bonuses** at the bottom lists every bonus you've earned plus the quest-point milestones.
- **Inventory:** 28 slots. Identical items stack in one slot. Tap to eat/wield/bury; hold for Bury all, Drop, Drop all, Light (logs), Make all, Examine.
- **Worn equipment:** head, cape, neck, ammo, weapon, body, shield, legs and ring, with attack / defence / other bonus totals, extras, your armour set status and your hit chance against a Black Knight, plus the **toolbelt** (axe, pickaxe, net, rod, lobster pot, harpoon, hammer, knife, needle, tinderbox). Tools on the belt don't use inventory space; the belt always uses the best tool your level allows.
- **Prayer:** tap prayers on/off. They drain prayer points; recharge at the church altar.
- **Crafting:** sub-tabs for Smithing (bars at the furnace, gear at the anvil, bronze → rune), Crafting (leather, spinning, shields), Fletching (bows and arrows) and Cooking (range or a fire). Tap 1 or All; you'll walk to the nearest furnace, anvil or range if needed.
- **Settings:** Save / Export / Import, What's new, D-pad, shadows, auto retaliate, run, auto-pickup loot, reset camera.

## Systems

- **Ammo:** crossbows fire bolts and bows fire arrows. Thrown daggers and throwing axes need no ammo.
- **Bounties:** three repeatable bounties (Ruins Warden, Captain Brann, Rhea the Hunter) are listed in the Quests tab with their progress. The data is `BOUNTIES` in gameplay.js.
- **Collision:** building walls, counters, shelves, bank windows, forges and anvils are solid colliders. NPC walk spots stay clear of them.

- **Toolbelt tiers:** bronze, iron, steel, mithril, adamant, rune axes and pickaxes. Each tier gathers 5% more often. Get them from Bob's Tool Shop, smithing or monster drops. New and old characters get bronze starter tools.
- **Perks:** every skill unlocks a perk every 5 levels (5 … 95) and at 99, 20 per skill. The small ones stack (+1% gathering, +1 max hit, +2% less burning, +0.5% damage reduction and so on). The ★ milestones at 25, 50, 75 and 99 change how the skill plays:
  - Mining / Woodcutting: Rich Vein / Chain Chop (15% chance the rock or tree isn't used up), Ore Cart / Forester's Cart (5% of resources go straight to the bank), Motherlode / Heartwood (+8% double), Mastery.
  - Fishing: Barbarian Grip (+5% XP), Fish Barrel (auto-bank), Double Haul, Mastery.
  - Smithing / Crafting / Fletching / Cooking: make items a tick faster, chance of a free extra item (Double Cook, Double Smelt, Twin Bows, Masterwork), more saving, Arrowsmith (+3 arrows), Gourmet (food heals more), Cooking 99 never burns.
  - Attack: Riposte (counter-attack when a monster misses), Battle Focus (faster combat-skill recharge), Swift Strikes (some swings come a tick early).
  - Strength: Critical Strikes, Executioner (+25% vs targets under 25% HP), Brutal (bigger crits).
  - Defence: Parry (block a hit completely), Iron Skin, Retribution (reflect 10% of damage).
  - Hitpoints: Bloodlust (heal on kill), Second Wind (double regen below 30% HP), Iron Constitution (+20 max HP).
  - Ranged: Arrow Retrieval, Double Shot (free second arrow), Deadeye (ranged crits).
  - Prayer: Faithful (prayer points regenerate), Blessed Burial (bones restore prayer points), Zealot (slower drain).
  Total damage reduction from perks, quests and sets is capped at 30%.
- **Equipment bonuses:** RS-style melee attack, ranged attack, strength, ranged strength, melee defence, ranged defence and prayer. Metal armour is strong in melee and a bit weaker vs arrows (body and legs slightly hurt your aim); leather is good vs arrows and helps ranged. Accuracy rolls your attack level and attack bonus against the monster's defence; your defence bonus (ranged defence vs Dark Archers) against its attack. Prayer bonus makes prayers last longer (each point ≈ 3.3%).
- **Jewellery and capes:** amulets of accuracy, strength, defence, Holy symbol and Amulet of glory; Warrior, Archer, Miner's, Forester's, Angler's rings and Ring of regeneration; red and blue capes. Sold at the General Store, dropped by monsters (Guards, Hill Giants, Black Knights, Dark Archers) or given by quests. **Skill capes** (General Store, 99 in the skill) boost that skill's perks by 10%. The **Quest point cape** is for completing every quest.
- **Armour sets:** a full matched helm, body, legs and shield of one metal gives a set bonus (2% → 7% less damage by tier, +3% melee accuracy). Full leather (cowl, body or hard body, chaps) gives +5% ranged accuracy and 2% less damage.
- **Combat skills:** Power Strike (Str 5), Fortify (Def 5), Puncture (Att 10), Rapid Volley (Rng 10), Shield Bash (Def 20), Berserk (Str 30), Snipe (Rng 30), Rejuvenate (Def 40).
- **Prayer:** bury bones (10 XP) or big bones (30 XP). Prayers: Thick Skin, Burst of Strength, Clarity of Thought, Sharp Eye, Rock Skin, Superhuman Strength, Improved Reflexes, Hawk Eye, Rapid Heal, Provident Hands (chance to keep materials), Steel Skin, Ultimate Strength, Incredible Reflexes, Eagle Eye, Nature's Bounty (gathering), Protect from Melee (40% less damage; needs Rest for the Fallen).
- **Quests (122 quests, 161 quest points),** each with a lasting bonus. The original 10 Brightwater and 12 Ashford quests are hand-written in `js/quests.js`; the 100 newer ones are data in `js/questdata1-5.js`, run by the step engine in `js/quests2.js` (step types: bring, kill, xp, bury, talk, visit). Their givers are in `js/questnpcs.js`.
  - Brightwater (18 new): Granny's Pie, Wool for Winter, Pip's Pockets, Light Fingers, Unquiet Graves, Rattling Bones, Lamplighter, Into the Dark Wood, Brewer's Errand, Bram's Tonic, Runic Studies, The Wizard's Student, An Old Soldier, Giant Slayer, The Black Outpost, Spider Silk, Rooftop Runner, Over the Wall
  - Port Sarim (18): Pirate's Grog, Treasure of the Tides, Press Gang, Grocer's Stock, Exotic Spices, Mending Nets, Deep Water, The Big One, Lost Cargo, Learning the Ropes, Customs and Excise, Thurgo's Lunch, Imcando Steel, A Runite Blade, Water for Mabel, Cabin Boy Blues, Witch's Brew, Frozen Heart
  - Varrock (18): The Lost Tome, Varrock's History, Demon Lore, Romeo's Letter, A Duel of Hearts, Fur Trade, Hard Bargain, Staff Shortage, Elemental Staves, Mystic Arts, Spare Change, The Phoenix Gang, Palace Guard, Dragon Watch, Gertrude's Cat, Tanner's Apprentice, Varrock Remedies, Frostbite Cure
  - Falador (18): The Knight's Sword, Squire's Honour, Black Knights' Fortress, The Holy Grail, Healing Hands, Saradomin's Relic, Boot's Lost Pick, Deep Delving, Sarah's Harvest, Wolves at the Gate, Wayne's Rush Order, Adamant Order, Party Pete's Bash, Dance Off, Last Orders, The Bowyer's Apprentice, Yew Bows, Magic in the Wood
  - Ashford (18 new): Ashford Stew, Full House, Toy Soldiers, Kites and Bows, The Seer's Vision, Dark Omens, Mind over Matter, Unpaid Debts, The Vault Job, Fen's Arrows, The Great Hunt, Midwife's Herbs, The Fever, Basic Training, Night Patrol, A Thief's Lesson, Special Delivery, Express Post
  - Wilds (10): The Hermit's Hound, Grell's Ward, Mossy Menace, Highway Robbery, Slayer's Challenge, Scorchwing, Ogre Trouble, The Ogre Warlord, Mapping the Realm, Rune Pilgrim
  - Quest givers show as blue dots on the minimap. The Quest tab filters by town and status.
  - Quest-point milestones: 3 QP faster run regen, 6 QP +2% all XP, 9 QP +20 max HP, 25 QP +3% all XP, 50 QP +20 max HP, 80 QP 3% shop discount, 110 QP +3% damage against everything, 140 QP faster run regen and +20 max HP, 161 QP (all quests) Quest point cape and +3% all XP. Players who finished the older 22 quests keep their cape.
- **Magic:** 16 spells (Wind Strike 1 … Fire Wave 75) using air, mind, water, earth, fire, chaos, death and blood runes. Elemental staffs give unlimited runes of their element; wizard and mystic robes add magic attack. Long-press a monster → Cast, or tap a spell in the Combat tab to autocast it.
- **Agility:** courses at Brightwater (1), Varrock (30), Port Sarim (45) and Falador (60). Do the obstacles in order for a lap bonus; failing hurts a little. Agility speeds up run-energy regen.
- **Thieving:** Pickpocket townsfolk (men/women 1, farmers 10, sailors 20, warriors 25, guards 40, White Knights 55, paladins 70, heroes 80) for coins, runes and more. Failing stuns you briefly.
- **Runecrafting:** mine essence south-east of Varrock (pure essence at Mining 30) or buy it, then Craft-rune at an altar: Air (south-west of Brightwater), Mind, Water, Earth, Fire, Body, Chaos, Death, Blood. More runes per essence at higher levels.
- **Death:** you keep every item and wake up in town with full hitpoints.

## Map

- **Mountain cave** (north, through the cave mouth at about 60, -205): an enclosed cavern (the chamber sits in the high peaks at 0, -272). It has coal, iron and mithril, giant spiders and the Brood Mother, plus a one-time hoard (`caveLoot` in the save). The rope by the entrance takes you back out.

- **Brightwater** at the centre: bank (west), General Store (east), Bob's Brilliant Tools (north-east), church and altar (north), Doric's smithy with furnace and anvil (south-east), cookhouse with range (south-west), houses and a well
- **Ashford** far to the east: bank, store, smithy, houses, and 12 new NPCs with quests
- **Goblins** to the north-east, **cows** in the fenced field to the north-west
- **Lake** with net, lure, cage and harpoon spots and willow trees to the south-west
- **Mine** (copper, tin, iron, coal, mithril, adamantite) to the south-east, **oaks** far north-east, **maples** east, **yews** west
- **Hill Giants**, **Black Knights**, magic trees and a runite rock in the northern hills; Sir Vyvin on the north road
- **Dark Archers** (level 25, shoot from range) west of the lake past the yews; Ranger Wyn on the west edge of town
- **Guards** (level 21) at the tower to the south
- **Port Sarim** (south-west): bank, general store, Betty's Magic Emporium, the docks agility course, sailors to pickpocket; bandits and the Chaos altar to the south-east
- **Varrock** (far east): palace, bank, weaponsmith, general store, Aubury's Rune Shop, essence mine, agility course; the scorched wilderness with demons and dragons to the north
- **Falador** (north-west): White Knights' Castle, bank, armoury, inn, Nessa's herb stall, agility course; ogres and Grumsh to the north-west
- Signposts at the town roads point the way. The world is about 600 x 600 (WORLD_HALF = 300); trees/rocks are instanced, decor streams in 64×64 chunks, and distant objects are hidden in the fog to keep phones fast.
