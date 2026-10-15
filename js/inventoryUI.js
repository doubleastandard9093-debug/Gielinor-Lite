// RS-style side panel with tabs, plus the bank, shop and help windows and the combat-skill quick bar.
import { ITEMS, RECIPES, iconFor, CRAFT_TABS, METALS, TOOL_TYPES, statLine, setDesc, rarityColor } from './items.js';
import { SKILLS, SKILL_ICONS, xpToNext, levelProgress, nextLevelXp, combatLevel, totalLevel, PERKS, maxPrayer, perkTotals, CAPS_TEXT } from './skills.js';
import { INV_SIZE, slotsUsed } from './playerState.js';
import { stylesFor, currentStyle, equipmentBonuses, playerMaxHit, playerAccuracy, monsterAccuracy, MONSTER_TYPES, SHOP_STOCK, TOOL_STOCK, sellPrice, buyPrice, stockVisible, bestTool, SHOPS, SPELLS, canCast, castsLeft, runeCost, magicMaxHit, staffRune, BOUNTIES } from './gameplay.js';
import { boostOf, POTIONS } from './potions.js';
import { PRAYERS, isActive, drainPerTick, prayerBonus } from './prayer.js';
import { ABILITIES, unlocked, adrenCost, adrenGain } from './abilities.js';
import { QUESTS, questStatus, questPoints, QUEST_POINTS_TOTAL, QUEST_TOWNS, activeQuestBonuses } from './quests.js';
import { esc } from './ui.js';
import { iconImg } from './icons.js';
import { KEY_ACTIONS, getBinds, setBind, resetBinds, keyLabel, captureNextKey } from './keybinds.js';

const TABS = [
  { id: 'combat', icon: '⚔️', title: 'Combat options' },
  { id: 'skills', icon: '📊', title: 'Skills' },
  { id: 'quests', icon: '📜', title: 'Quest list' },
  { id: 'inv', icon: '🎒', title: 'Inventory' },
  { id: 'equip', icon: '🛡️', title: 'Worn equipment & toolbelt' },
  { id: 'prayer', icon: '🙏', title: 'Prayer' },
  { id: 'craft', icon: '🔨', title: 'Crafting' },
  { id: 'settings', icon: '⚙️', title: 'Settings' }
];

const fmt = n => Math.floor(n).toLocaleString('en-US');
const qtyLabel = n => n >= 10000000 ? Math.floor(n / 1000000) + 'M' : n >= 100000 ? Math.floor(n / 1000) + 'K' : String(n);
const STATION_LABEL = { furnace: '🔥 Furnace', anvil: '⚒️ Anvil', range: '🍳 Range/fire' };

export const WHATS_NEW = `
<p><b>Day and night.</b> The sun now crosses the sky over a 30-minute day. Mornings are bright, evenings turn gold and orange with long shadows, and at night the world is lit by a blue moon under a starry sky. The sky, fog, water reflections and sunlight all follow the time of day. If you prefer the old look, set Settings → Time of day to <b>Always morning</b>.</p>
<p><b>Ambient occlusion.</b> On High, corners, building bases, the well, eaves and the folds of characters now get soft contact shading (ground-truth AO), so objects sit in the world instead of floating on it. You can switch it off in Settings.</p>
<p><b>Planted hands and feet.</b> Feet now stay planted through wall mantles, the roll over the net's top bar, gap take-offs and landings, and every landing after monkey bars and the rope swing. In pipes you crawl on hands and knees on the pipe floor, and after a fall your palms and heels rest on the ground. Bushes and trees between the camera and you are hidden during an obstacle. On a phone in portrait the camera starts closer, so your character is bigger, and Settings has a new <b>Zoom-out limit</b> (Close, Normal or Far).</p>
<p><b>Agility, hands-on.</b> Your character now has jointed fingers (three segments each plus a thumb) that wrap around ropes, rungs, holds and weapon grips. On walls, nets, monkey bars, tightropes, ledges and the rope swing, hands and feet now lock onto the actual holds, so you climb the wall instead of sinking into it. The Port Sarim mast rope swings with you and keeps swinging after you let go. Course frames, posts and walls are solid now, without blocking the routes. During an obstacle the camera moves in for a side-on view and picks an angle that trees and bushes don't block.</p>
<p><b>Realistic Agility.</b> Every obstacle now has its own full-body animation that follows the obstacle: arms out and careful steps with the odd wobble on logs, hands sliding along the rope on tightropes, hand-over-hand net climbs that roll over the top bar, alternating hand and foot holds up rough walls with a mantle and drop, a crouch-and-crawl through pipes, a wind-up, tucked jump and landing over gaps, a run-up, grab and pendulum swing on the Port Sarim mast rope, swinging hand to hand on Falador's new monkey bars, and a face-the-wall shimmy along ledges. Failing now shows a stumble and a fall before you take damage. Each crossing varies a little, and the camera follows you up and over.</p>
<p><b>Adrenaline and keybinds.</b> Basic combat skills now build adrenaline (+9%). Fortify and Snipe cost 50%, and Berserk and Rejuvenate cost 100%. The action bar shows each cost and greys out skills you can't afford yet. You can change every key in Settings → Keybinds and reset them to defaults. New painted icons for the tinderbox, net, rod, harpoon, lobster pot, needle, bird nest and Herblore secondaries. The Shadows setting now shows whether shadows are really on, and on a phone the side panel no longer covers the orbs.</p>
<p><b>A whole new interface.</b></p>
<ul>
<li><b>New look.</b> Panels are framed in gold over dark stone, with filigree corners, parchment journals, and buttons and tabs that light up when you touch them.</li>
<li><b>Orbs and target panel.</b> Hitpoints, prayer, run and a new <b>adrenaline</b> orb fill like glass flasks. Adrenaline builds as you land hits. It's a gauge only for now and doesn't power anything yet. When you fight, a panel shows your target's name, level (coloured by how tough it is) and health.</li>
<li><b>XP tracker.</b> XP drops show the skill's badge. A tracker lists the skills you've trained recently, with XP gained, XP to the next level and XP per hour.</li>
<li><b>Buffs and action bar.</b> Buffs have a ring that counts down. The action bar has cooldown sweeps and number keys.</li>
<li><b>Item art.</b> Every item has its own painted icon: swords, helms, platebodies, bows, arrows, bars, ores, logs, fish, potions, runes and more. Each is coloured by its metal or wood. Rare, epic and legendary items glow, and the best ones shimmer. On a computer, hover over an item to see its stats, special, requirements and value.</li>
<li><b>Panels.</b>
  <ul>
  <li>Equipment is shown on a paper doll with outlines for empty slots.</li>
  <li>Skills show their XP to the next level when you hover.</li>
  <li>Quests can be filtered by difficulty and show a progress bar.</li>
  <li>The bank has tabs (weapons, armour, food and potions, runes, skilling, misc), a search box and placeholders.</li>
  </ul></li>
<li><b>Out in the world.</b>
  <ul>
  <li>Nearby monsters and townsfolk have nameplates. Monsters show their level, quest givers have a blue mark, and named monsters have a star.</li>
  <li>The minimap has a gold ring, zoom buttons and a <b>?</b> map key.</li>
  <li>Conversations show a painted portrait of whoever is speaking.</li>
  <li>The chat tabs show how many new messages you've missed.</li>
  <li>There's a title screen while the game loads.</li>
  </ul></li>
<li><b>Settings.</b> UI scale (85 to 130%), nameplates on or off, optional interface click sounds, and a keybind list.</li>
<li><b>Level-ups.</b> A burst of sparks and a big banner when you level up.</li>
</ul>
<p><b>Earlier today</b></p>
<p><b>Rough edges smoothed.</b></p>
<ul>
<li><b>The Mountain cave is open.</b> Enter it from the cave mouth in the northern foothills (torches mark the way) and climb down into a cavern lit by torches and glowing crystals. Inside are stalactites and stalagmites, webs, coal, iron and mithril seams and four giant spiders. The <b>Brood Mother</b> guards a hoard at the back: defeat her and search it once for 2,500 coins, an uncut ruby, an uncut diamond, mithril bars and coal. Climb the rope to leave.</li>
<li><b>Monster weapons swing with the arm.</b> Swords, daggers, spears, clubs, bows and shields are held in the hand and move with every attack. Metal blades have a proper metallic shine.</li>
<li><b>Skeletons are made of bones:</b> a skull with eye sockets, jaw and teeth, a spine of vertebrae, a curved ribcage with sternum, collarbones and shoulder blades, a pelvis, and jointed arm, hand, finger, leg and foot bones.</li>
<li><b>Aprons and hats fit.</b> Aprons wrap the body with a bib, waist tie and draped skirt. Chef's hats, straw hats and caps sit on the head and turn with it.</li>
<li><b>Bounties in the quest tab.</b> All three repeatable bounties show at the top of the Quests tab, with where to find the giver, your progress bar and the reward.</li>
<li><b>Solid furniture.</b> Counters, shelves, crates, bank windows, forges and anvils inside buildings are solid now. Doorways stay open, and you can still talk, bank and trade across the counter.</li>
<li><b>Ammo matters.</b> Crossbows need bolts and bows need arrows. If the wrong ammo is equipped, the chat tells you what you need. Thrown weapons still need no ammo.</li>
<li><b>Clearer mountains.</b> On High, the fog is lighter and the view distance is longer, so the snow-capped northern range reads clearly from town. Low keeps the shorter, foggier view for phones.</li>
</ul>
<p><b>The wilds come alive.</b> The outer ring of the map now has places to find, each with a signpost pointing the way and a white dot on the minimap:</p>
<ul>
<li><b>Travellers' camp</b> (far north-west): tents, a campfire you can cook on, a traveller, a bard, and a <b>Wandering Pedlar</b> who trades on the road.</li>
<li><b>Old ruins</b> (east): skeletons and zombies, plus the <b>Ruins Warden</b>, who pays a repeatable bounty for 5 skeletons.</li>
<li><b>Watchtower</b> (west highlands): <b>Captain Brann</b> pays a repeatable bounty for 4 bandits from the hideout to the north.</li>
<li><b>Hunter's camp</b> (south-east): <b>Rhea the Hunter</b> pays a repeatable bounty for 5 wolves from the pack in the dale.</li>
<li><b>Wayside shrine</b> (south): pray here to restore your prayer.</li>
<li><b>Mountain cave</b> (north): guarded by giant spiders, with coal, iron and mithril rocks outside and Ice Giants on the slopes.</li>
<li><b>Mountain pond</b> (north-east): Lure, Net and Cage fishing, and an old angler.</li>
</ul>
<p>Redberry and white berry bushes grow across the countryside; pick them for Herblore XP. Moss Giants roam the southern dale, Hill Giants the east and Dark Archers the far west. Birds fly overhead, and rabbits and deer graze in the open and bolt when you get close.</p>
<p><b>Hills, valleys and mountains.</b> The land now rolls. Gentle hills start just outside town and grow toward the edge of the map, with winding ridges, a low dale in the south, a raised plateau in the far west and a snow-capped mountain range across the far north. Steep slopes show bare rock and the peaks have snow. Towns, roads, buildings, the lake and every work spot stay level, and you, the townsfolk and the monsters all walk on the ground. The camera follows you up and down.</p>
<p><b>Richer shading.</b> Characters have their own materials. Skin has fine pore detail and a warm glow where light passes through it, fur has a soft sheen and a rim of sky light, dragon scales are glossier, and spider shells shine. Every character has a soft contact shadow underneath. On High, sun shadows are sharper and higher resolution (4096), and the light balance shows form better. Low keeps the cheap path.</p>
<p><b>Detailed monsters.</b> Up close, every mob uses a new detailed model. Wolves have shaggy fur, a neck ruff, teeth, amber eyes and jointed legs with paws. Cows have patterned hides, udders, split hooves and sometimes horns. Giant spiders have eight three-jointed legs, eight eyes, fangs and hourglass, banded or spotted markings. Dragons have scales, belly plates, curved horns, back spines and boned wing membranes. Goblins are wiry with pointed ears and claws, and giants and ogres are heavily muscled. No two spawns look the same: size, colour, markings, ears, tails and horns vary. Watch out for rare named ones such as <i>Scarface the Wolf</i>, <i>Old Bessie the Cow</i> and <i>Snaggletooth the Goblin</i>.</p>
<p><b>Detailed people.</b> You and every townsperson now have jointed arms and legs (shoulder, elbow, wrist, hip, knee, ankle), hands with four fingers and a thumb, shaped muscles, a neck, and a real face with nose, brows, eyelids, eyes and lips. Each NPC is a little different: height, build, skin tone, hair colour and style, eye colour, sleeve length and boots. Close characters use the detailed model; distant ones switch to a simple one.</p>
<p><b>Guilds.</b> Three new guild halls, each with a level check at the door. <b>Mining Guild</b> (Mining 60, south of Brightwater): coal, mithril, adamantite and runite rocks, a furnace, an anvil and a bank. <b>Cooking Guild</b> (Cooking 32, north past the tower): two ranges and a bank. <b>Crafting Guild</b> (Crafting 40, north-west): a furnace, an anvil and a bank. Nearby signposts point the way.</p>
<p><b>Skill expansions.</b> <b>Fletching</b>: crossbows (bar + logs + bowstring) and bolts (bar + 5 feathers), Bronze to Rune, alongside bows and arrows. <b>Smithing</b>: thrown daggers and throwing axes. These ranged weapons need no ammo. You can also smith a Battlestaff (staff + steel bar). <b>Crafting</b>: weave cloth from flax, sew Wizard and Mystic robes, and carve a Staff from oak logs. <b>Fishing</b>: anchovies (Net 15), tuna (Harpoon 35) and monkfish (Net 62). <b>Cooking</b>: new dishes that heal and buff you. Hearty stew gives Strength, Monk's broth restores prayer, Fisherman's pie gives Defence, and Warrior's feast gives Attack and Strength.</p>
<p><b>Walk-in buildings.</b> Every building now has an open doorway facing its town square, and the roof lifts away when you step inside. Smithies have a glowing forge and an anvil, with the smith walking between them. Shops have a counter and stocked shelves, with the shopkeeper pacing behind it (Brightwater's General Store has a new Shopkeeper). Banks have a long counter with two or three teller windows and a Banker you can bank with. Tap anywhere inside and you'll walk round to the door. Doorways show on the minimap.</p>
<p><b>Better wolves.</b> Wolves have a proper head, pointed snout, upright ears, slimmer legs and a bushy tail instead of a stretched blob.</p>
<p><b>World streaming (RuneScape-style chunks)</b></p>
<p>The map is now <b>600 × 600</b> (was 440). The new outer ring is open country with trees and grass, and no monsters yet.</p>
<p>The map is now split into 32×32 chunks. Buildings, stalls, props and monsters only load in the chunks around you (5×5 on Low, 7×7 on High) and unload as you walk away, so the world can keep growing without slowing your phone. Monsters keep their health and respawn timers while unloaded.</p>
<p><b>Bigger world, smoother graphics</b></p>
<p>The map is now about <b>440 × 440</b>. Grass and flowers load in nearby chunks only, and trees and rocks share draw calls so your phone stays smooth. Materials catch the light better, and distant trees stop swaying past about 50 steps. Graphics quality (Auto / High / Low) still controls the glow, clouds and shadows.</p>
<p><b>100 new quests</b></p>
<p>There are now <b>122 quests</b> and <b>161 quest points</b>. The new quests are spread over Brightwater, Port Sarim, Varrock, Falador, Ashford and the wilds, from Novice to Master. Each one has several steps: fetching or making items, fighting monsters, gaining XP in a skill (including Magic, Agility, Thieving and Runecrafting), burying bones, visiting places and talking to other people. Many people now give two or three quests in a row, and later ones need earlier quests or skill levels.</p>
<p><b>Finding quests.</b> Quest givers have a <b>blue dot</b> on the minimap and a Quest option when you long-press them. The Quest tab can be filtered by town and by status, and each journal shows the town, difficulty, requirements and your progress.</p>
<p><b>New milestones.</b> 25 QP: +3% XP in every skill. 50 QP: +20 max hitpoints. 80 QP: 3% off in shops. 110 QP: +3% damage against every monster. 140 QP: faster run energy and +20 max hitpoints. 161 QP (every quest): Quest point cape and +3% XP. If you had already finished all 22 older quests, you keep your cape.</p>
<p><b>New skills and towns</b></p>
<p><b>Magic.</b> 16 combat spells from Wind Strike (Magic 1) to Fire Wave (Magic 75). Each cast uses runes; an elemental staff gives unlimited runes of its element. Long-press a monster and choose <b>Cast</b>, or open the Combat tab and tap a spell to <b>autocast</b> it, then tap a monster. Runes come from Wizard Mizgog (by the south tower), Betty in Port Sarim, Aubury in Varrock, monster drops and Runecrafting.</p>
<p><b>Agility.</b> Four courses: Brightwater (level 1, south-east past the mine), Varrock (30), Port Sarim docks (45) and Falador (60). Do the obstacles in order for a lap bonus. Higher Agility also refills run energy faster.</p>
<p><b>Thieving.</b> Long-press townsfolk and choose <b>Pickpocket</b>: men and women (1), farmers (10), sailors (20), warriors (25), guards (40), White Knights (55), paladins (70) and heroes (80). Get caught and you're stunned for a few seconds.</p>
<p><b>Runecrafting.</b> Mine rune essence at the essence mine south-east of Varrock (pure essence from Mining 30), or buy it from the magic shops. Take it to a rune altar (ring of standing stones) and choose <b>Craft-rune</b>. Air altar is just south-west of Brightwater; Mind, Water, Earth, Fire, Body, Chaos, Death and Blood altars are out in the world.</p>
<p><b>Three new towns.</b> Port Sarim (south-west, by the docks), Varrock (far east, past Ashford) and Falador (north-west, the white city), each with a bank, shops and people. Signposts at the roads show the way. Giants, ogres, demons and dragons now roam the wider world.</p>
<p><b>Earlier today</b></p>
<p><b>New look</b></p>
<p><b>Modern graphics.</b> A sky with a warm sun and drifting clouds, textured ground with dirt paths, sandy shores and cobbled squares, hills on the horizon and a rippling lake with foam at the edge. Leafy trees sway in the wind (and ease off in the distance), rocks show their ore veins, and the towns have timber-framed and stone buildings with tiled roofs, windows and chimneys. Grass, flowers and bushes cover the fields in nearby chunks. You, the townsfolk and the monsters have new rounded models, and walking, running and attacking animate more smoothly. The panels have a new dark-and-gold look.</p>
<p><b>Graphics quality</b> (Settings): Auto, High or Low. Low turns off the glow, clouds, swaying, grass and shadows and lowers the resolution, for older phones. On Auto the game switches to Low by itself if your phone can't keep up.</p>
<p><b>Earlier this week</b></p>
<p><b>More perks.</b> Every skill now unlocks a perk every 5 levels (5, 10 … 95) and at 99. Small ones stack up; the gold ★ milestones at 25, 50, 75 and 99 change how the skill plays: Chain Chop and Rich Vein keep trees and rocks going, resources can go straight to your bank, Double Cook, critical hits, Riposte counters, Parry blocks, Bloodlust heals on kills, Double Shot, prayer point regen and more. Tap a skill in the Skills tab to see the full list and your running totals.</p>
<p><b>Equipment bonuses.</b> Gear now has melee and ranged attack, strength, ranged strength, melee and ranged defence and prayer bonuses. Prayer bonus makes prayers last longer. Leather is good against arrows (watch out for the new Dark Archers west of the lake). New amulets, rings and capes: some are sold at the General Store, some drop from monsters, some come from quests. Wear a full matched metal set (helm, body, legs, shield) or a full leather set for a set bonus. Skill capes are for 99s and boost that skill's perks by 10%.</p>
<p><b>Quest bonuses.</b> Every quest now gives a lasting bonus (more XP in a skill, extra max HP, damage against a monster type, shop discounts and more). There are 9 quests and 11 quest points now: Bob, the Merchant, Ranger Wyn and Sir Vyvin have new ones. Quest point milestones at 3, 6, 9 and 11 give extra bonuses, and finishing every quest earns the Quest point cape. See them all under Quest bonuses in the Quest tab.</p>
<p><b>Earlier</b></p>
<p><b>Stacking.</b> Identical items share one slot. <b>Toolbelt</b> in Worn Equipment. <b>Crafting tabs</b> for Smithing, Crafting, Fletching and Cooking. <b>Combat skills</b> on the quick bar. <b>Prayer</b>: bury bones, pray at the church altar.</p>
<p>When you die you keep all your items and wake up in town.</p>`;

// Tap and long-press on elements matching selector inside root.
function bindPress(root, selector, onTap, onLong) {
  let timer = null, startX = 0, startY = 0, target = null, longFired = false;
  root.addEventListener('pointerdown', e => {
    const el = e.target.closest(selector);
    if (!el || !root.contains(el)) return;
    target = el; longFired = false; startX = e.clientX; startY = e.clientY;
    if (e.pointerType === 'mouse' && e.button === 2) { longFired = true; onLong(el, e.clientX, e.clientY); return; }
    clearTimeout(timer);
    if (e.pointerType !== 'mouse') timer = setTimeout(() => { longFired = true; onLong(el, startX, startY); }, 450);
  });
  root.addEventListener('pointermove', e => {
    if (target && Math.hypot(e.clientX - startX, e.clientY - startY) > 12) { clearTimeout(timer); target = null; }
  });
  root.addEventListener('pointerup', e => {
    clearTimeout(timer);
    const el = e.target.closest(selector);
    if (target && el === target && !longFired && !(e.pointerType === 'mouse' && e.button !== 0)) onTap(el);
    target = null;
  });
  root.addEventListener('pointercancel', () => { clearTimeout(timer); target = null; });
  root.addEventListener('contextmenu', e => { if (e.target.closest(selector)) e.preventDefault(); });
}

// Rich tooltip for an item: name in rarity colour, type, stats, special, requirements and value.
const TYPE_LABEL = { weapon: 'Weapon', head: 'Head', body: 'Body', legs: 'Legs', shield: 'Shield', cape: 'Cape', neck: 'Neck', ring: 'Ring', ammo: 'Ammunition', tool: 'Tool',
  food: 'Food', potion: 'Potion', rune: 'Rune', resource: 'Resource', processed: 'Material', bones: 'Bones', herb: 'Herb', grimy: 'Grimy herb', secondary: 'Herblore secondary', vial: 'Vial', junk: 'Junk' };
export function itemTooltip(item, qty) {
  const info = ITEMS[item] || {};
  const rc = rarityColor(item);
  const st = statLine(item);
  const req = info.req ? Object.entries(info.req).map(([k, v]) => `${k} ${v}`).join(', ') : '';
  return `<div class="tt-name" style="color:${rc || 'var(--c-title)'}">${esc(item)}</div>` +
    `<div class="tt-type">${info.rarity ? `<span style="color:${rc}">${info.rarity[0].toUpperCase() + info.rarity.slice(1)}</span> · ` : ''}${TYPE_LABEL[info.type] || 'Item'}${info.metal ? ' · ' + info.metal : ''}</div>` +
    (st ? `<div class="tt-stats">${st.split(', ').map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '') +
    (info.heal ? `<div class="tt-line">Heals ${info.heal}</div>` : '') +
    (info.special ? `<div class="tt-special">${esc(info.special)}</div>` : '') +
    (req ? `<div class="tt-req">Requires ${esc(req)}</div>` : '') +
    `<div class="tt-val">${qty > 1 ? `${fmt(qty)} × ` : ''}${fmt(info.value || 1)} gp${qty > 1 ? ` = ${fmt((info.value || 1) * qty)} gp` : ''}</div>`;
}
let tipEl = null;
function setupTooltips() {
  tipEl = document.createElement('div'); tipEl.id = 'uiTip'; document.body.appendChild(tipEl);
  let cur = null;
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('[data-tip],[data-tiphtml]');
    if (el === cur) return; cur = el;
    if (!el) { tipEl.classList.remove('show'); return; }
    const slotItem = el.dataset.item;
    tipEl.innerHTML = el.dataset.tiphtml || (slotItem ? itemTooltip(slotItem, +(el.querySelector('.qty') ? el.dataset.qty || 1 : 1)) : esc(el.dataset.tip));
    tipEl.classList.add('show');
  });
  document.addEventListener('pointermove', e => {
    if (!tipEl.classList.contains('show')) return;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(4, Math.min(innerWidth - w - 4, e.clientX - w - 14)) + 'px';
    tipEl.style.top = Math.max(4, Math.min(innerHeight - h - 4, e.clientY + 14)) + 'px';
  });
  document.addEventListener('pointerdown', () => tipEl.classList.remove('show'), true);
}

export function createInventoryUI(api) {
  const { player, skills } = api;
  if (!tipEl) setupTooltips();
  const panel = document.createElement('div');
  panel.id = 'sidePanel';
  panel.innerHTML = `<div id="tabContent"></div><div id="tabBar">${TABS.map(t => `<button data-tab="${t.id}" title="${t.title}">${t.icon}</button>`).join('')}</div>`;
  document.body.appendChild(panel);
  const content = panel.querySelector('#tabContent');
  const tabBtns = panel.querySelectorAll('#tabBar button');

  const win = document.createElement('div');
  win.id = 'window';
  win.style.display = 'none';
  document.body.appendChild(win);

  const bar = document.createElement('div');
  bar.id = 'abilityBar';
  document.body.appendChild(bar);

  let tab = 'inv';
  let collapsed = false;
  let mode = null;          // null | 'bank' | 'shop' | 'tools' | 'help'
  let qtyMode = 1;          // bank / shop quantity
  let selectedSkill = null;
  let selectedQuest = null, questTown = 'All', questState = 'all', questDiff = 'All';
  let bankTab = 'all', bankSearch = '';
  let rebinding = null;
  let shopInfo = null;
  let craftTab = 'Smithing';
  let smithGroup = 'Smelting';

  tabBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tab === tab && !collapsed) collapsed = true;
    else { tab = b.dataset.tab; collapsed = false; }
    render();
    if (!collapsed) { content.classList.remove('tab-in'); void content.offsetWidth; content.classList.add('tab-in'); content.scrollTop = 0; }
  }));

  // ---------------- Tabs ----------------
  function invCells() {
    const cells = Object.entries(player.inventory).map(([item, qty]) => ({ item, qty }));
    while (cells.length < INV_SIZE) cells.push(null);
    return cells.slice(0, INV_SIZE);
  }
  function itemCell(item, qty, extra = '', showQty = true) {
    const [ic, tint] = iconFor(item);
    const rc = rarityColor(item);
    const rr = ITEMS[item] && ITEMS[item].rarity;
    return `<div class="slot item${rr ? ' r-' + rr : ''}" data-item="${esc(item)}" data-qty="${qty}" ${extra} data-tip="${esc(item)}">` +
      `<span class="ico">${iconImg(item)}</span>${showQty && qty > 1 ? `<span class="qty">${qtyLabel(qty)}</span>` : ''}<span class="nm"${rc ? ` style="color:${rc}"` : ''}>${esc(shortName(item))}</span></div>`;
  }
  function shortName(item) {
    return item.replace(' logs', '').replace('Cooked ', '').replace(' platebody', ' plate').replace(' platelegs', ' legs').replace(' full helm', ' helm').replace(' shortbow', ' bow');
  }

  function renderInv() {
    const used = slotsUsed(player);
    const hint = mode === 'bank' ? 'Tap an item to bank it' : SHOPS[mode] ? 'Tap an item to sell it' : 'Tap to use · hold for options';
    return `<div class="tab-head"><b>Inventory</b><span>${used}/${INV_SIZE} · <span class="gold">${fmt(player.gold)} gp</span></span></div>
      <div class="invgrid">${invCells().map(c => c ? itemCell(c.item, c.qty) : '<div class="slot"></div>').join('')}</div>
      <div class="hint">${hint}</div>`;
  }

  function perkPanel(skill, k) {
    const list = PERKS[skill] || [];
    const got = list.filter(p => k.level >= p.level).length;
    const next = list.find(p => k.level < p.level);
    const totals = perkTotals(skills, skill);
    return `<div class="perktotal"><b>Your ${skill} bonuses</b> (${got}/${list.length} perks)` +
      (totals.length ? totals.map(t => `<div>• ${esc(t)}</div>`).join('') : '<div>None yet. First perk at level 5.</div>') +
      (next ? `<div class="nextperk">Next: ${esc(next.name)} at level ${next.level}</div>` : '') + `<div class="nextperk">${esc(CAPS_TEXT)}</div></div>` +
      `<div class="perks">${list.map(p => `<div class="perk ${k.level >= p.level ? 'got' : 'locked'} ${p.milestone ? 'big' : ''}"><span>${p.level}</span> ${k.level >= p.level ? '✔' : '🔒'} <b>${p.milestone ? '★ ' : ''}${esc(p.name)}</b>: ${esc(p.desc)}</div>`).join('')}</div>`;
  }
  function renderSkills() {
    let html = `<div class="tab-head"><b>Skills</b><span>Total ${totalLevel(skills)}</span></div><div class="skillgrid">`;
    for (const s of SKILLS) {
      const k = skills[s];
      const bst = boostOf(player, s);
      const tip = `<div class="tt-name">${s}</div><div class="tt-type">Level ${k.level}${bst ? ` (boosted ${k.level + bst})` : ''}</div><div class="tt-line">XP ${fmt(k.xp)}</div>` + (k.level >= 99 ? '<div class="tt-special">Maximum level</div>' : `<div class="tt-line">Next level at ${fmt(nextLevelXp(k))}</div><div class="tt-special">${fmt(xpToNext(k))} XP to level ${k.level + 1}</div>`);
      html += `<div class="skill ${selectedSkill === s ? 'sel' : ''} ${k.level >= 99 ? 'maxed' : ''}" data-skill="${s}" data-tiphtml="${esc(tip)}"><span class="sk-ico">${SKILL_ICONS[s]}</span><b${bst ? ' class="boosted"' : ''}>${bst ? `${k.level + bst}/${k.level}` : k.level}</b><i style="width:${(levelProgress(k) * 100).toFixed(0)}%"></i></div>`;
    }
    html += '</div>';
    if (selectedSkill) {
      const k = skills[selectedSkill];
      const bst = boostOf(player, selectedSkill);
      html += `<div class="skilldetail"><b>${selectedSkill}</b> level ${bst ? `<span class="boosted">${k.level + bst}</span>/${k.level} (potion boost)` : k.level}<br>XP: ${fmt(k.xp)}<br>` +
        (selectedSkill === 'Herblore' ? '<small>Herblore (herbology): pick grimy herbs from patches, clean them, then brew potions with a vial of water and a secondary from monster drops.</small><br>' : '') +
        (k.level >= 99 ? 'Maximum level!' : `Next level at: ${fmt(nextLevelXp(k))}<br>Remaining: ${fmt(xpToNext(k))}`) +
        `<div class="bar"><i style="width:${(levelProgress(k) * 100).toFixed(1)}%"></i></div>
        ${perkPanel(selectedSkill, k)}</div>`;
    } else {
      html += '<div class="hint">Tap a skill to see its XP and perks</div>';
    }
    return html;
  }

  function renderCombat() {
    const styles = stylesFor(player);
    const cur = currentStyle(player);
    const w = player.equipment.weapon || 'Unarmed';
    const now = api.tick();
    return `<div class="tab-head"><b>${esc(w)}</b><span>Combat Lvl: ${combatLevel(skills)}</span></div>
      <div class="styles">${styles.map((s, i) => `<button class="style ${s === cur ? 'on' : ''}" data-style="${i}"><b>${s.name}</b><small>${s.xp.join(', ')} XP</small></button>`).join('')}</div>
      <div class="craftskill">Combat skills</div>
      <div class="ablist">${ABILITIES.map(a => {
        const ok = unlocked(skills, a);
        const cd = Math.max(0, (api.cooldowns()[a.id] || 0) - now);
        return `<div class="ab ${ok ? 'ok' : ''}" ${ok ? `data-ability="${a.id}"` : ''}><span class="abi">${a.icon}</span><div><b>${a.name}</b> <small class="${ok ? 'lvl' : 'need'}">${a.skill} ${a.level}</small> <small class="tier t-${a.tier || 'basic'}">${(a.tier || 'basic')}${adrenCost(a) ? ` · ${adrenCost(a)}% adrenaline` : ` · +${adrenGain(a)}%`}</small><br><small>${a.desc}${cd ? ` <i>(${(cd * 0.6).toFixed(0)}s)</i>` : ''}</small></div></div>`;
      }).join('')}</div>
      <button class="toggle ${player.settings.autoRetaliate ? 'on' : ''}" data-act="retaliate">Auto Retaliate: ${player.settings.autoRetaliate ? 'On' : 'Off'}</button>
      <button class="toggle ${player.settings.run ? 'on' : ''}" data-act="run">Run: ${player.settings.run ? 'On' : 'Off'} (${Math.floor(player.runEnergy)}%)</button>
      <div class="hint">Max hit ${playerMaxHit(player, skills)} · attack speed ${(api.attackSpeed() * 0.6).toFixed(1)}s</div>
      ${renderSpellbook()}`;
  }
  // Spellbook: tap a spell to autocast it (Attack then casts it). Tap again to turn autocast off.
  function renderSpellbook() {
    const free = staffRune(player);
    const auto = player.settings.autocast;
    let html = `<div class="craftskill">Spellbook · Magic ${skills.Magic.level}${free ? ` · ${esc(free)}s from your staff` : ''}</div><div class="ablist">`;
    for (const sp of SPELLS) {
      const lvlOk = skills.Magic.level >= sp.level;
      const n = castsLeft(sp, player);
      const cost = Object.entries(sp.runes).map(([r, q]) => `${q} ${r.replace(' rune', '')}${r === free ? ' (staff)' : ''}`).join(', ');
      html += `<div class="ab ${lvlOk ? 'ok' : ''} ${auto === sp.id ? 'on' : ''}" ${lvlOk ? `data-spell="${sp.id}"` : ''}><span class="abi">${sp.icon}</span><div><b>${esc(sp.name)}</b>${auto === sp.id ? ' <small class="lvl">AUTOCAST</small>' : ''} <small class="${lvlOk ? 'lvl' : 'need'}">Magic ${sp.level}</small><br>` +
        `<small>${cost} · max hit ${magicMaxHit(sp, player, skills)} · ${n === Infinity ? 'unlimited' : n} casts</small></div></div>`;
    }
    return html + `</div><div class="hint">Tap a spell to autocast it, then tap a monster to attack with it. Runes: magic shops (Wizard Mizgog by the tower, Betty in Port Sarim, Aubury in Varrock) or craft them at rune altars.</div>`;
  }

  const EQUIP_LAYOUT = [
    [null, 'head', null],
    ['cape', 'neck', 'ammo'],
    ['weapon', 'body', 'shield'],
    [null, 'legs', 'ring']
  ];
  const SLOT_ICON = { head: '⛑️', ammo: '➶', weapon: '🗡️', body: '👕', shield: '🛡️', legs: '👖', neck: '📿', ring: '💍', cape: '🧣' };
  const SLOT_GHOST = { head: 'Iron full helm', ammo: 'Iron arrows', weapon: 'Iron sword', body: 'Iron platebody', shield: 'Iron shield', legs: 'Iron platelegs', neck: 'Amulet of accuracy', ring: 'Warrior ring', cape: 'Red cape' };
  const SLOT_NAME = { head: 'Head', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', neck: 'Neck', ring: 'Ring', cape: 'Cape' };
  const sgn = v => (v >= 0 ? '+' : '') + v;
  function renderEquip() {
    const worn = Object.values(player.equipment).filter(Boolean).length;
    let html = `<div class="tab-head"><b>Worn Equipment</b><span>${worn}/9 worn</span></div><div class="paperdoll"><div class="equipgrid">`;
    for (const row of EQUIP_LAYOUT) for (const slot of row) {
      if (!slot) { html += '<div></div>'; continue; }
      const item = player.equipment[slot];
      if (item) html += itemCell(item, slot === 'ammo' ? player.ammoCount : 1, `data-slot="${slot}"`).replace('class="slot item', 'class="slot item worn');
      else html += `<div class="slot empty" data-tip="${SLOT_NAME[slot]} slot (empty)"><span class="ico ghost">${iconImg(SLOT_GHOST[slot], 'ico-img ghost')}</span></div>`;
    }
    html += '</div>';
    const b = equipmentBonuses(player);
    const extras = [];
    if (b.regen) extras.push(`HP regen +${Math.round(b.regen * 100)}%`);
    for (const [sk, v] of Object.entries(b.gather)) extras.push(`${sk} speed +${Math.round(v * 100)}%`);
    for (const [sk, v] of Object.entries(b.xp)) extras.push(`${sk} XP +${Math.round(v * 100)}%`);
    if (b.capeSkill) extras.push(`${b.capeSkill} perks +10%`);
    const st = b.set;
    const setHtml = st ? `<div class="setbonus ${st.active ? 'on' : ''}">${st.active ? '✔' : '◻'} <b>${st.name} set</b> ${st.have}/${st.need}: ${esc(setDesc(st.fx))}${st.active ? '' : ' (wear the full set)'}</div>`
      : '<div class="setbonus">Wear a full matched set (helm, body, legs, shield) for a set bonus</div>';
    // Chance to hit a Black Knight / get hit by one, so bonuses mean something.
    const bk = MONSTER_TYPES['Black Knight'];
    html += `</div><div class="bonushead">Attack bonus</div><div class="bonuses">
      <div>Melee <b>${sgn(b.atk)}</b></div><div>Ranged <b>${sgn(b.ranged)}</b></div><div>Magic <b>${sgn(b.mag)}</b></div></div>
      <div class="bonushead">Defence bonus</div><div class="bonuses">
      <div>Melee <b>${sgn(b.def)}</b></div><div>Ranged <b>${sgn(b.rdef)}</b></div></div>
      <div class="bonushead">Other bonuses</div><div class="bonuses">
      <div>Strength <b>${sgn(b.str)}</b></div><div>Ranged str <b>${sgn(b.rstr)}</b></div>
      <div>Prayer <b>${sgn(b.prayer)}</b></div><div>Max hit <b>${playerMaxHit(player, skills)}</b></div></div>
      ${extras.length ? `<div class="setbonus on">${extras.map(esc).join(' · ')}</div>` : ''}${setHtml}
      <div class="hint">vs Black Knight: you hit ${Math.round(playerAccuracy(player, skills, bk) * 100)}% · it hits you ${Math.round(monsterAccuracy(bk, player, skills) * 100)}%</div>
      <div class="craftskill">Toolbelt</div><div class="toolgrid">`;
    for (const t of TOOL_TYPES) {
      const item = bestTool(player, skills, t.id);
      if (item) html += itemCell(item, 1, `data-tool="${t.id}"`, false).replace('class="slot item', 'class="slot item tool');
      else html += `<div class="slot empty tool" data-tool="${t.id}" title="${t.name}: none"><span class="ico ghost">${t.icon}</span></div>`;
    }
    return html + '</div><div class="hint">Tap worn items to remove · tap a tool for details</div>';
  }

  function renderPrayer() {
    const max = maxPrayer(skills);
    const pp = player.prayerPoints || 0;
    const drain = drainPerTick(player, skills);
    let html = `<div class="tab-head"><b>Prayer</b><span>${Math.ceil(pp)} / ${max} · bonus ${prayerBonus(player) >= 0 ? '+' : ''}${prayerBonus(player)}</span></div>
      <div class="bar praybar"><i style="width:${(Math.min(1, pp / max) * 100).toFixed(1)}%"></i></div><div class="praygrid">`;
    for (const p of PRAYERS) {
      const can = skills.Prayer.level >= p.level && (!p.quest || api.questDone(p.quest));
      html += `<button class="pray ${isActive(player, p.id) ? 'on' : ''} ${can ? '' : 'locked'}" data-prayer="${p.id}" title="${esc(p.name)}: ${esc(p.desc)}"><span>${p.icon}</span><small>${p.level}</small></button>`;
    }
    html += `</div><div class="hint">${drain ? `Draining ${(drain / 0.6).toFixed(2)} points/sec` : 'Tap a prayer to turn it on · hold for details'}<br>Bury bones for XP · recharge at the church altar</div>`;
    return html;
  }

  function renderQuests() {
    const qp = questPoints(player);
    const sts = QUESTS.map(qd => questStatus(player, qd.id));
    const count = st => sts.filter(x => x === st).length;
    let html = `<div class="tab-head"><b>Quests</b><span>Quest Points: ${qp}/${QUEST_POINTS_TOTAL}</span></div>`;
    html += `<div class="qcount">${count('complete')} done · ${count('in progress')} started · ${QUESTS.length} quests</div>`;
    html += '<div class="qfilters">' + ['All', ...QUEST_TOWNS].map(t => `<span class="qchip ${questTown === t ? 'on' : ''}" data-qtown="${t}">${t}</span>`).join('') + '</div>';
    html += '<div class="qfilters">' + [['all', 'Any status'], ['not started', 'Not started'], ['in progress', 'In progress'], ['complete', 'Complete']].map(([k, l]) => `<span class="qchip ${questState === k ? 'on' : ''}" data-qstate="${k}">${l}</span>`).join('') + '</div>';
    const DIFFS = ['All', ...new Set(QUESTS.map(q => q.diff))];
    html += '<div class="qfilters">' + DIFFS.map(d => `<span class="qchip ${questDiff === d ? 'on' : ''}" data-qdiff="${esc(d)}">${d === 'All' ? 'Any difficulty' : esc(d)}</span>`).join('') + '</div>';
    if (selectedQuest) {
      const qd = QUESTS.find(x => x.id === selectedQuest);
      const st = questStatus(player, qd.id);
      const lines = qd.journal(player); const doneN = lines.filter(l => l.done).length;
      html += `<div class="journal"><button class="jback" data-quest="${qd.id}">← All quests</button><b>${esc(qd.name)}</b><div class="jprog"><i style="width:${st === 'complete' ? 100 : Math.round(100 * doneN / Math.max(1, lines.length))}%"></i></div><div class="qmeta">${esc(qd.town)} · ${esc(qd.diff)}</div>${qd.journal(player).map(l => `<div class="${l.done ? 'done' : ''}">${esc(l.text)}</div>`).join('')}
        ${st === 'complete' ? '<div class="qdone">QUEST COMPLETE!</div>' : ''}
        <div class="rewards">Rewards: ${qd.points} quest point${qd.points > 1 ? 's' : ''}, ${qd.rewards.map(esc).join(', ')}</div>
        <div class="qbonus ${st === 'complete' ? 'on' : ''}">★ Lasting bonus: ${esc(qd.bonus.desc)}${st === 'complete' ? ' (active)' : ''}</div></div>`;
    }
    // repeatable bounties: status and progress
    const bs = player.bounties || {}, plural = m => /f$/.test(m) ? m.slice(0, -1) + 'ves' : m + 's';
    html += `<div class="craftskill">Bounties <small>(repeatable · ${player.bountiesDone || 0} completed)</small></div><div class="questlist">` + BOUNTIES.map(B => {
      const cur = bs[B.id], st = !cur ? 'not started' : cur.got >= cur.n ? 'complete' : 'in progress';
      const prog = !cur ? `Talk to ${esc(B.giver)}` : cur.got >= cur.n ? `Done! Return to ${esc(B.giver)} for ${B.gp} coins` : `${cur.got}/${cur.n} ${esc(plural(B.mon).toLowerCase())} defeated`;
      const pct = cur ? Math.round(100 * Math.min(1, cur.got / cur.n)) : 0;
      return `<div class="quest q-${st.replace(' ', '-')} bounty">Bounty: ${B.n} ${esc(plural(B.mon))}<small>${esc(B.where)} · ${prog} · reward ${B.gp} coins</small><div style="height:4px;background:#0006;border-radius:2px;margin-top:3px"><div style="height:4px;width:${pct}%;background:${st === 'complete' ? '#4c4' : '#dc4'};border-radius:2px"></div></div></div>`;
    }).join('') + '</div>';
    html += '<div class="questlist">';
    let shown = 0;
    QUESTS.forEach((qd, i) => {
      const st = sts[i];
      if (questTown !== 'All' && qd.town !== questTown) return;
      if (questState !== 'all' && st !== questState) return;
      if (questDiff !== 'All' && qd.diff !== questDiff) return;
      shown++;
      html += `<div class="quest q-${st.replace(' ', '-')} ${selectedQuest === qd.id ? 'sel' : ''}" data-quest="${qd.id}">${esc(qd.name)}<small>${esc(qd.town)} · ${esc(qd.diff)}</small></div>`;
    });
    if (!shown) html += '<div class="hint">No quests match this filter.</div>';
    html += '</div>';
    if (!selectedQuest) html += '<div class="hint">Red: not started · Yellow: in progress · Green: complete. Tap a quest for its journal. Quest givers have a blue dot on the minimap.</div>';
    const qb = activeQuestBonuses(player);
    const on = qb.quests.filter(x => x.active);
    html += `<div class="craftskill">Quest bonuses</div><div class="qbonuses">` +
      (on.length ? on.map(x => `<div class="on">✔ <b>${esc(x.name)}</b>: ${esc(x.desc)}</div>`).join('') : '<div>Finish quests to earn lasting bonuses.</div>') +
      qb.milestones.map(m => `<div class="${m.active ? 'on' : ''}">${m.active ? '✔' : '🔒'} <b>${m.qp} QP</b>: ${esc(m.desc)}</div>`).join('') + '</div>';
    return html;
  }

  function recipeRow(r) {
    const st = api.recipeState(r);
    const inputs = Object.entries(r.inputs).map(([it, q]) => {
      const have = player.inventory[it] || 0;
      return `<span class="${have >= q ? 'have' : 'need'}">${q} ${esc(it)}</span>`;
    }).join(' + ');
    const where = [r.station ? STATION_LABEL[r.station] : '', r.tool ? (st.tool ? '' : `<span class="need">needs ${r.tool}</span>`) : ''].filter(Boolean).join(' · ');
    return `<div class="recipe ${st.ok ? 'ok' : ''}">
      <div class="rname">${iconFor(r.output)[0]} ${esc(r.output)}${r.output.endsWith('arrows') ? ` x${api.arrowQty(r)}` : ''} <span class="${st.level ? 'lvl' : 'need'}">Lv ${r.level}</span><br><small>${inputs}${where ? `<br>${where}` : ''}</small></div>
      <div class="rbtn"><button data-craft="${esc(r.name)}" data-n="1" ${st.ok ? '' : 'disabled'}>1</button><button data-craft="${esc(r.name)}" data-n="all" ${st.ok ? '' : 'disabled'}>All</button></div></div>`;
  }
  function renderCraft() {
    let html = `<div class="subtabs">${CRAFT_TABS.map(t => `<button data-ctab="${t}" class="${craftTab === t ? 'on' : ''}">${SKILL_ICONS[t]}<small>${t}</small></button>`).join('')}</div>`;
    html += `<div class="tab-head"><b>${craftTab}</b><span>Level ${skills[craftTab].level}</span></div>`;
    let list = RECIPES.filter(r => r.cat === craftTab);
    if (craftTab === 'Smithing') {
      html += `<div class="chips">${['Smelting', ...METALS].map(g => `<button data-sgroup="${g}" class="${smithGroup === g ? 'on' : ''}">${g === 'Smelting' ? 'Bars' : g}</button>`).join('')}</div>`;
      list = list.filter(r => r.group === smithGroup);
    }
    html += '<div class="craftlist">';
    let lastGroup = null;
    for (const r of list) {
      if (craftTab !== 'Smithing' && r.group !== lastGroup) { html += `<div class="craftskill">${esc(r.group)}</div>`; lastGroup = r.group; }
      html += recipeRow(r);
    }
    return html + '</div><div class="hint">Tap 1 or All. If you need a furnace, anvil or range you\'ll walk to the nearest one.</div>';
  }

  function renderSettings() {
    const s = player.settings;
    const t = (act, label, on) => `<button class="toggle ${on ? 'on' : ''}" data-act="${act}">${label}: ${on ? 'On' : 'Off'}</button>`;
    const v = (act, label, val) => `<button class="toggle on" data-act="${act}">${label}: <b>${val}</b></button>`;
    const KEYS = [['Click / tap', 'Walk or do the default action'], ['Right-click / hold', 'All options'], ['Mouse wheel / pinch', 'Zoom'], ['Drag', 'Rotate the camera']];
    const B = getBinds();
    return `<div class="tab-head"><b>Settings</b></div>
      <div class="savebtns"><button data-act="save">💾 Save</button><button data-act="export">Export</button><button data-act="import">Import</button><button data-act="paste">Paste save</button></div>
      <button class="toggle new" data-act="help">✨ What's new</button>
      <div class="craftskill">Graphics</div>
      <button class="toggle on" data-act="gfx">Graphics quality: <b>${api.gfxLabel ? api.gfxLabel() : 'Auto'}</b></button>
      <button class="toggle ${api.shadowsOn() ? 'on' : ''}" data-act="shadows">Shadows: ${api.shadowsOn() ? 'On' : 'Off'}${api.shadowsNote ? api.shadowsNote() : ''}</button>
      <div class="craftskill">Interface</div>
      ${v('timeofday', 'Time of day', (s.timeOfDay || 'cycle') === 'cycle' ? 'Day/night cycle' : 'Always morning')}
      ${v('ao', 'Ambient occlusion', s.ao === false ? 'Off' : 'On (High)')}
      ${v('zoomlimit', 'Zoom-out limit', ({ 18: 'Close', 30: 'Normal', 45: 'Far' })[s.zoomLimit || 30])}
      ${v('uiscale', 'UI scale', Math.round((s.uiScale || 1) * 100) + '%')}
      ${t('nameplates', 'Nameplates', s.nameplates !== false)}
      ${t('dpad', 'On-screen D-pad', s.showDpad)}
      <button class="toggle" data-act="camera">Reset camera</button>
      <div class="craftskill">Sound</div>
      ${t('uisound', 'Interface sounds', !!s.uiSound)}
      ${s.uiSound ? v('uivolume', 'Volume', Math.round((s.uiVolume || 0.5) * 100) + '%') : ''}
      <div class="craftskill">Gameplay</div>
      ${t('retaliate', 'Auto Retaliate', s.autoRetaliate)}
      ${t('run', 'Run', s.run)}
      ${t('autoloot', 'Auto-pickup loot', s.autoLoot)}
      <div class="craftskill">Keybinds &amp; controls</div>
      <div class="keybinds">${KEY_ACTIONS.map(([id, label]) => `<div class="kb-row"><span>${label}</span><button class="kb-key ${rebinding === id ? 'listening' : ''} ${B[id] ? '' : 'unbound'}" data-rebind="${id}">${rebinding === id ? 'Press a key…' : keyLabel(B[id])}</button></div>`).join('')}</div>
      <button class="toggle" data-keyreset="1">Reset keybinds to defaults</button>
      <div class="keybinds fixed">${KEYS.map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>
      <div class="help">Tap the minimap to walk there, + and − zoom it, ? shows the map key, and the compass faces north.</div>`;
  }

  // ---------------- Windows ----------------
  const BANK_TABS = [['all', '∞', 'All'], ['weapons', '⚔️', 'Weapons'], ['armour', '🛡️', 'Armour'], ['supplies', '🍖', 'Food & potions'], ['magic', '🔮', 'Runes'], ['skilling', '⛏️', 'Skilling'], ['misc', '📦', 'Misc']];
  function bankCat(it) {
    const t = (ITEMS[it] || {}).type;
    if (t === 'weapon' || t === 'ammo') return 'weapons';
    if (['head', 'body', 'legs', 'shield', 'cape', 'neck', 'ring'].includes(t)) return 'armour';
    if (['food', 'potion', 'vial'].includes(t)) return 'supplies';
    if (t === 'rune' || /essence/i.test(it)) return 'magic';
    if (['resource', 'processed', 'herb', 'grimy', 'secondary', 'bones', 'tool'].includes(t)) return 'skilling';
    return 'misc';
  }
  function qtyBar(label) {
    const opts = mode === 'bank' ? [1, 5, 10, 'All'] : [1, 5, 10];
    return `<div class="qtybar">${label}${opts.map(q => `<button data-qty="${q}" class="${qtyMode === q ? 'on' : ''}">${q}</button>`).join('')}</div>`;
  }
  function shopStock() {
    const list = (SHOPS[mode] || SHOPS.shop).stock;
    return list.filter(s => stockVisible(s, player, skills));
  }
  function renderWindow() {
    if (!mode) { if (win.style.display !== 'none') { win.style.display = 'none'; win._html = ''; } return; }
    if (win.style.display !== 'flex') { win.style.display = 'flex'; win.classList.remove('win-in'); void win.offsetWidth; win.classList.add('win-in'); }
    let html;
    if (mode === 'bank') {
      const all = Object.entries(player.bank).filter(([, q]) => q > 0);
      const ph = (player.settings.bankPh || []).filter(it => !(player.bank[it] > 0));
      const q = bankSearch.trim().toLowerCase();
      const inTab = it => bankTab === 'all' || bankCat(it) === bankTab;
      const shown = all.filter(([it]) => inTab(it) && (!q || it.toLowerCase().includes(q)));
      const shownPh = ph.filter(it => inTab(it) && (!q || it.toLowerCase().includes(q)));
      const worth = all.reduce((a, [it, n]) => a + ((ITEMS[it] && ITEMS[it].value) || 1) * n, 0);
      html = `<div class="win-head"><b>Bank of Gielinor</b><span>${all.length} items · ${qtyLabel(worth)} gp</span><button class="close" data-act="close">✕</button></div>
        <div class="banktabs">${BANK_TABS.map(([id, ic, lbl]) => `<button data-btab="${id}" class="${bankTab === id ? 'on' : ''}" data-tip="${lbl}">${ic}<small>${lbl}</small></button>`).join('')}</div>
        <div class="banksearch"><input id="bankSearch" type="search" placeholder="Search bank…" value="${esc(bankSearch)}" autocomplete="off"><button data-act="phtoggle" class="${player.settings.placeholders !== false ? 'on' : ''}" data-tip="Leave a greyed placeholder when you withdraw the last of an item">Placeholders</button></div>
        ${qtyBar('Withdraw/deposit: ')}
        <div class="bankgrid">${shown.map(([item, n]) => itemCell(item, n).replace('class="slot item', 'class="slot item bankitem')).join('')}${shownPh.map(it => `<div class="slot placeholder" data-ph="${esc(it)}" data-tip="${esc(it)} (placeholder, tap to clear)"><span class="ico">${iconImg(it, 'ico-img ghost')}</span><span class="qty">0</span></div>`).join('') || (shown.length ? '' : `<div class="hint">${q ? 'Nothing matches your search.' : 'Nothing in this tab.'}</div>`)}</div>
        <div class="win-foot"><button data-act="depinv">Deposit inventory</button><button data-act="depworn">Deposit worn items</button></div>`;
    } else if (mode === 'help') {
      html = `<div class="win-head"><b>What's new in Gielinor</b><button class="close" data-act="close">✕</button></div><div class="helptext">${WHATS_NEW}</div>`;
    } else {
      const title = (SHOPS[mode] || SHOPS.shop).title;
      html = `<div class="win-head"><b>${title}</b><span class="gold">${fmt(player.gold)} gp</span><button class="close" data-act="close">✕</button></div>
        ${qtyBar('Buy/sell: ')}
        <div class="bankgrid">${shopStock().map(s => {
          const owned = ITEMS[s.item] && ITEMS[s.item].tool && player.tools && player.tools[s.item];
          const price = buyPrice(s.price, player);
          return itemCell(s.item, 1).replace('class="slot item', `data-price="${price}" class="slot item shopitem ${owned ? 'owned' : ''}`)
            .replace(/<\/div>$/, `<span class="price">${qtyLabel(price)}</span>${owned ? '<span class="own">✔</span>' : ''}</div>`);
        }).join('')}</div>
        <div class="shopinfo">${shopInfo ? esc(shopInfo) : 'Hold an item to see its bonuses'}</div>
        <div class="hint">Tap stock to buy · tap your items to sell${mode === 'tools' ? ' · tools go straight onto your toolbelt (✔ = owned)' : ''}${buyPrice(100, player) < 100 ? ` · quest discount ${100 - buyPrice(100, player)}%` : ''}</div>`;
    }
    if (win._html !== html) { win._html = html; win.innerHTML = html; }
  }

  // ---------------- Quick bar ----------------
  function renderBar() {
    const now = api.tick();
    const list = ABILITIES.filter(a => unlocked(skills, a));
    const html = list.map((a, i) => {
      const cd = Math.max(0, (api.cooldowns()[a.id] || 0) - now);
      const total = api.cooldownOf(a);
      const queued = api.queued() === a.id;
      const cost = adrenCost(a), low = cost && (api.adrenaline ? api.adrenaline() : 0) < cost;
      return `<button data-ability="${a.id}" class="${cd ? 'cd' : ''} ${queued ? 'queued' : ''} t-${a.tier || 'basic'} ${low ? 'noadr' : ''}" data-tip="${esc(a.name)} (${a.tier || 'basic'}${cost ? `, costs ${cost}% adrenaline` : `, +${adrenGain(a)}% adrenaline`}): ${esc(a.desc)}"><span>${a.icon}</span>${cost ? `<em>${cost}</em>` : ''}${cd ? `<i style="--cd:${(cd / total * 100).toFixed(1)}%"></i><b>${Math.ceil(cd * 0.6)}</b>` : ''}${i < 8 ? `<kbd>${i + 1}</kbd>` : ''}</button>`;
    }).join('');
    bar.style.display = list.length ? 'grid' : 'none';
    if (bar._html !== html) { bar._html = html; bar.innerHTML = html; }
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-ability]');
    if (b) api.useAbility(b.dataset.ability);
  });

  function render() {
    tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === tab && !collapsed));
    panel.classList.toggle('collapsed', collapsed);
    if (!collapsed) {
      const html = tab === 'inv' ? renderInv() : tab === 'skills' ? renderSkills() : tab === 'combat' ? renderCombat()
        : tab === 'equip' ? renderEquip() : tab === 'craft' ? renderCraft() : tab === 'prayer' ? renderPrayer()
        : tab === 'quests' ? renderQuests() : renderSettings();
      if (content._html !== html) { content._html = html; content.innerHTML = html; }
    }
    renderWindow();
    renderBar();
  }

  // ---------------- Events ----------------
  bindPress(content, '.slot.item:not(.worn):not(.tool)', el => {
    const item = el.dataset.item;
    if (mode === 'bank') api.deposit(item, qtyMode);
    else if (SHOPS[mode]) api.sell(item, qtyMode);
    else api.useItem(item);
  }, (el, x, y) => api.itemMenu(el.dataset.item, x, y, mode));
  bindPress(content, '.slot.item.worn', el => api.unequip(el.dataset.slot), (el, x, y) => api.wornMenu(el.dataset.slot, x, y));
  bindPress(content, '.slot.tool', el => api.toolInfo(el.dataset.tool), el => api.toolInfo(el.dataset.tool));
  bindPress(content, '[data-prayer]', el => api.prayerToggle(el.dataset.prayer), el => api.prayerInfo(el.dataset.prayer));
  bindPress(win, '.slot.bankitem', el => api.withdraw(el.dataset.item, qtyMode), (el, x, y) => api.bankMenu(el.dataset.item, x, y));
  bindPress(win, '.slot.shopitem', el => api.buy(el.dataset.item, +el.dataset.price, qtyMode), (el, x, y) => {
    const st = statLine(el.dataset.item);
    shopInfo = `${el.dataset.item}: ${st || 'no bonuses'} · ${el.dataset.price} gp`;
    renderWindow();
    api.shopMenu(el.dataset.item, +el.dataset.price, x, y);
  });

  content.addEventListener('click', e => {
    const sk = e.target.closest('[data-skill]');
    if (sk) { selectedSkill = selectedSkill === sk.dataset.skill ? null : sk.dataset.skill; render(); return; }
    const qq = e.target.closest('[data-quest]');
    if (qq) { selectedQuest = selectedQuest === qq.dataset.quest ? null : qq.dataset.quest; render(); if (selectedQuest) { const j = content.querySelector('.journal'); if (j) j.scrollIntoView({ block: 'nearest' }); } return; }
    const qt = e.target.closest('[data-qtown]');
    if (qt) { questTown = qt.dataset.qtown; render(); return; }
    const qdf = e.target.closest('[data-qdiff]');
    if (qdf) { questDiff = qdf.dataset.qdiff; render(); return; }
    const qs = e.target.closest('[data-qstate]');
    if (qs) { questState = qs.dataset.qstate; render(); return; }
    const st = e.target.closest('[data-style]');
    if (st) { player.attackStyle = +st.dataset.style; render(); return; }
    const ct = e.target.closest('[data-ctab]');
    if (ct) { craftTab = ct.dataset.ctab; render(); return; }
    const sg = e.target.closest('[data-sgroup]');
    if (sg) { smithGroup = sg.dataset.sgroup; render(); return; }
    const ab = e.target.closest('[data-ability]');
    if (ab) { api.useAbility(ab.dataset.ability); return; }
    const spl = e.target.closest('[data-spell]');
    if (spl) { api.setAutocast(spl.dataset.spell); return; }
    const cr = e.target.closest('[data-craft]');
    if (cr && !cr.disabled) { api.craft(cr.dataset.craft, cr.dataset.n === 'all' ? Infinity : 1); return; }
    const rb = e.target.closest('[data-rebind]');
    if (rb) {
      const id = rb.dataset.rebind;
      if (rebinding === id) { rebinding = null; captureNextKey(null); render(); return; }
      rebinding = id; render();
      captureNextKey(k => {
        rebinding = null;
        if (k !== 'escape' || id === 'close') { if (k === 'backspace' || k === 'delete') setBind(id, ''); else setBind(id, k); }
        render();
      });
      return;
    }
    if (e.target.closest('[data-keyreset]')) { resetBinds(); rebinding = null; captureNextKey(null); render(); api.log && api.log('Keybinds reset to defaults.'); return; }
    const act = e.target.closest('[data-act]');
    if (act) { if (act.dataset.act === 'help') open('help'); else api.setting(act.dataset.act); }
  });
  win.addEventListener('input', e => {
    if (e.target.id !== 'bankSearch') return;
    bankSearch = e.target.value; const pos = e.target.selectionStart;
    renderWindow(); const inp = win.querySelector('#bankSearch'); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (er) { /* search inputs */ } }
  });
  win.addEventListener('click', e => {
    const bt = e.target.closest('[data-btab]');
    if (bt) { bankTab = bt.dataset.btab; render(); return; }
    const phEl = e.target.closest('[data-ph]');
    if (phEl) { player.settings.bankPh = (player.settings.bankPh || []).filter(x => x !== phEl.dataset.ph); render(); return; }
    const q = e.target.closest('[data-qty]');
    if (q) { qtyMode = q.dataset.qty === 'All' ? 'All' : +q.dataset.qty; render(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'close') close();
    else if (act.dataset.act === 'phtoggle') { player.settings.placeholders = player.settings.placeholders === false; if (player.settings.placeholders === false) player.settings.bankPh = []; render(); }
    else if (act.dataset.act === 'depinv') api.depositAll();
    else if (act.dataset.act === 'depworn') api.depositWorn();
  });

  function open(m) {
    mode = m;
    shopInfo = null;
    qtyMode = 1;
    if (m !== 'help') { tab = 'inv'; collapsed = false; }
    render();
  }
  function close() { mode = null; render(); }

  return {
    render, renderBar, open, close, panel,
    get mode() { return mode; },
    get tab() { return collapsed ? null : tab; },
    showTab(t, sub) { tab = t; collapsed = false; if (t === 'craft' && sub) craftTab = sub; render(); }
  };
}
