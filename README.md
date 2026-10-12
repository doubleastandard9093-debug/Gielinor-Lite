# Gielinor

Browser-based 3D RPG inspired by classic RuneScape (2004 era). Plain static site, no build step.
The original 2D game lives in `/2d/`.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Settings → Pages → Deploy from main branch
3. Live at `https://yourusername.github.io/repo-name/`

## Graphics

Modern, RuneScape 3-inspired look made entirely in code (no image files or third-party art): sky dome with sun and clouds, warm sunlight with soft shadows, bloom and a light colour grade, splat-textured terrain (grass, dirt paths, sand, cobbles) with hills beyond the map edge, animated water, swaying layered trees, ore-veined rocks, timber and stone buildings with tiled gable roofs, grass/flower/bush ground clutter, and rounded player, NPC and monster models. Most models are baked into one mesh each to keep draw calls low on phones.

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
- **Quests:** red = not started, yellow = in progress, green = complete. Tap a quest for its journal, rewards and lasting bonus. **Quest bonuses** at the bottom lists every bonus you've earned plus the quest-point milestones.
- **Inventory:** 28 slots. Identical items stack in one slot. Tap to eat/wield/bury; hold for Bury all, Drop, Drop all, Light (logs), Make all, Examine.
- **Worn equipment:** head, cape, neck, ammo, weapon, body, shield, legs and ring, with attack / defence / other bonus totals, extras, your armour set status and your hit chance against a Black Knight, plus the **toolbelt** (axe, pickaxe, net, rod, lobster pot, harpoon, hammer, knife, needle, tinderbox). Tools on the belt don't use inventory space; the belt always uses the best tool your level allows.
- **Prayer:** tap prayers on/off. They drain prayer points; recharge at the church altar.
- **Crafting:** sub-tabs for Smithing (bars at the furnace, gear at the anvil, bronze → rune), Crafting (leather, spinning, shields), Fletching (bows and arrows) and Cooking (range or a fire). Tap 1 or All; you'll walk to the nearest furnace, anvil or range if needed.
- **Settings:** Save / Export / Import, What's new, D-pad, shadows, auto retaliate, run, auto-pickup loot, reset camera.

## Systems

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
- **Quests (22 quests, 24 quest points),** each with a lasting bonus. Original 10 quests in Brightwater plus 12 new ones in the eastern town of Ashford. All rewards (XP and gold) have been increased 5×.
  - Cook's Assistant, Rest for the Fallen, Doric's Quest, Goblin Trouble, Farmer's Hides, Tools of the Trade, Supply Run, Archers in the Woods, Knight's Honour, Fisherman's Catch
  - Ashford’s Plea, Guard Duty, Herb Gathering, Torin’s Order, Eastern Feast, Scout’s Report, Kael’s Tools, Rest for the East, Supply the Store, Eastern Honour, Tess’s Catch, Olan’s Timber
  - Quest-point milestones: 3 QP faster run regen, 6 QP +2% all XP, 9 QP +20 max HP, 24 QP (all quests) Quest point cape and +3% all XP.
- **Magic:** 16 spells (Wind Strike 1 … Fire Wave 75) using air, mind, water, earth, fire, chaos, death and blood runes. Elemental staffs give unlimited runes of their element; wizard and mystic robes add magic attack. Long-press a monster → Cast, or tap a spell in the Combat tab to autocast it.
- **Agility:** courses at Brightwater (1), Varrock (30), Port Sarim (45) and Falador (60). Do the obstacles in order for a lap bonus; failing hurts a little. Agility speeds up run-energy regen.
- **Thieving:** Pickpocket townsfolk (men/women 1, farmers 10, sailors 20, warriors 25, guards 40, White Knights 55, paladins 70, heroes 80) for coins, runes and more. Failing stuns you briefly.
- **Runecrafting:** mine essence south-east of Varrock (pure essence at Mining 30) or buy it, then Craft-rune at an altar: Air (south-west of Brightwater), Mind, Water, Earth, Fire, Body, Chaos, Death, Blood. More runes per essence at higher levels.
- **Death:** you keep every item and wake up in town with full hitpoints.

## Map

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
- Signposts at the town roads point the way. The world is 300 x 300 (WORLD_HALF = 150); distant objects are hidden in the fog to keep phones fast.
