# Gielinor

Browser-based 3D RPG inspired by classic RuneScape (2004 era). Plain static site, no build step.
The original 2D game lives in `/2d/`.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Settings → Pages → Deploy from main branch
3. Live at `https://yourusername.github.io/repo-name/`

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
- **Skills:** tap a skill for XP to next level and its perks (a passive bonus at levels 10, 20 … 90 and 99).
- **Quests:** red = not started, yellow = in progress, green = complete. Tap a quest for its journal and rewards.
- **Inventory:** 28 slots. Identical items stack in one slot. Tap to eat/wield/bury; hold for Bury all, Drop, Drop all, Light (logs), Make all, Examine.
- **Worn equipment:** head, weapon, body, shield, legs, ammo, plus the **toolbelt** (axe, pickaxe, net, rod, lobster pot, harpoon, hammer, knife, needle, tinderbox). Tools on the belt don't use inventory space; the belt always uses the best tool your level allows.
- **Prayer:** tap prayers on/off. They drain prayer points; recharge at the church altar.
- **Crafting:** sub-tabs for Smithing (bars at the furnace, gear at the anvil, bronze → rune), Crafting (leather, spinning, shields), Fletching (bows and arrows) and Cooking (range or a fire). Tap 1 or All; you'll walk to the nearest furnace, anvil or range if needed.
- **Settings:** Save / Export / Import, What's new, D-pad, shadows, auto retaliate, run, auto-pickup loot, reset camera.

## Systems

- **Toolbelt tiers:** bronze, iron, steel, mithril, adamant, rune axes and pickaxes. Each tier gathers 5% more often. Get them from Bob's Tool Shop, smithing or monster drops. New and old characters get bronze starter tools.
- **Perks:** every skill has 10 milestone perks, e.g. faster gathering and double resources (Mining, Woodcutting, Fishing), bar saving (Smithing), material saving (Crafting, Fletching), less burnt food (Cooking), +max hit and critical hits (Strength), accuracy and faster recharge (Attack), damage reduction (Defence), faster regen (Hitpoints), arrow saving (Ranged), slower prayer drain and bonus bury XP (Prayer).
- **Combat skills:** Power Strike (Str 5), Fortify (Def 5), Puncture (Att 10), Rapid Volley (Rng 10), Shield Bash (Def 20), Berserk (Str 30), Snipe (Rng 30), Rejuvenate (Def 40).
- **Prayer:** bury bones (10 XP) or big bones (30 XP). Prayers: Thick Skin, Burst of Strength, Clarity of Thought, Sharp Eye, Rock Skin, Superhuman Strength, Improved Reflexes, Hawk Eye, Rapid Heal, Provident Hands (chance to keep materials), Steel Skin, Ultimate Strength, Incredible Reflexes, Eagle Eye, Nature's Bounty (gathering), Protect from Melee (40% less damage; needs Rest for the Fallen).
- **Quests (6 quest points):** Cook's Assistant (Cook), Rest for the Fallen (Father Elric), Doric's Quest (Doric), Goblin Trouble (Captain Rhea), Farmer's Hides (Farmer Gil).
- **Death:** you keep every item and wake up in town with full hitpoints.

## Map

- **Brightwater** at the centre: bank (west), General Store (east), Bob's Brilliant Tools (north-east), church and altar (north), Doric's smithy with furnace and anvil (south-east), cookhouse with range (south-west), houses and a well
- **Goblins** to the north-east, **cows** in the fenced field to the north-west
- **Lake** with net, lure, cage and harpoon spots and willow trees to the south-west
- **Mine** (copper, tin, iron, coal, mithril, adamantite) to the south-east, **oaks** far north-east, **maples** east, **yews** west
- **Hill Giants**, **Black Knights**, magic trees and a runite rock in the northern hills
- **Guards** (level 21) at the tower to the south
