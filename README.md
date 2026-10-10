# Gielinor

Browser-based 3D RPG inspired by classic RuneScape (2004 era). Plain static site, no build step.
The original 2D game lives in `/2d/`.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Settings → Pages → Deploy from main branch
3. Live at `https://yourusername.github.io/repo-name/`

## Controls

- **Tap** a tree, rock, fishing spot, monster, item pile, the bank booth or the Merchant to walk there and act.
  Gathering, fighting and crafting repeat every game tick (0.6s) until the resource runs out, your pack is full, or the target dies.
- **Hold** (or right-click) anything for options: Attack, Chop down, Mine, Prospect, Net/Lure, Trade, Bank, Take, Examine, Walk here.
- **Tap ground** to walk. **Tap the minimap** to walk there. **Tap the compass** to face north.
- **Drag** to turn the camera. **Pinch** or **scroll** to zoom. Desktop: WASD to walk, arrow keys to turn the camera, Esc closes menus.
- **Side panel tabs:** Combat (attack style, auto retaliate, run), Skills (tap for XP to next level),
  Inventory (28 slots; tap to eat/wield, hold for Drop/Examine), Worn equipment (tap to remove), Crafting (1 or All), Settings.
  Tap the open tab again to hide the panel.
- **Orbs** by the minimap show hitpoints and run energy. Tap the run orb to switch walk/run.
- **Settings:** Save / Export / Import, optional on-screen D-pad, shadows, auto-pickup loot.

The game saves itself every 15 seconds and whenever you leave the app.

## Map

- Town square at the centre with the **bank booth** (west) and **Merchant** (east)
- **Goblins** to the north-east, **cows** in the fenced field to the north-west
- **Lake** with fishing spots and willow trees to the south-west
- **Mine** (copper, tin, iron, coal) to the south-east, **oak trees** in the far north-east
- **Guards** (level 21) at the tower to the south
