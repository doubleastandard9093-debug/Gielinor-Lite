// RS-style side panel with tabs, plus the bank, shop and help windows and the combat-skill quick bar.
import { ITEMS, RECIPES, iconFor, CRAFT_TABS, METALS, TOOL_TYPES, statLine, setDesc, rarityColor } from './items.js';
import { SKILLS, SKILL_ICONS, xpToNext, levelProgress, nextLevelXp, combatLevel, totalLevel, PERKS, maxPrayer, perkTotals, CAPS_TEXT } from './skills.js';
import { INV_SIZE, slotsUsed } from './playerState.js';
import { stylesFor, currentStyle, equipmentBonuses, playerMaxHit, playerAccuracy, monsterAccuracy, MONSTER_TYPES, SHOP_STOCK, TOOL_STOCK, sellPrice, buyPrice, stockVisible, bestTool, SHOPS, SPELLS, canCast, castsLeft, runeCost, magicMaxHit, staffRune } from './gameplay.js';
import { boostOf, POTIONS } from './potions.js';
import { PRAYERS, isActive, drainPerTick, prayerBonus } from './prayer.js';
import { ABILITIES, unlocked } from './abilities.js';
import { QUESTS, questStatus, questPoints, QUEST_POINTS_TOTAL, QUEST_TOWNS, activeQuestBonuses } from './quests.js';
import { esc } from './ui.js';

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
<p><b>New skills and towns</b></p>
<p><b>Magic.</b> 16 combat spells from Wind Strike (Magic 1) to Fire Wave (Magic 75). Each cast uses runes; an elemental staff gives unlimited runes of its element. Long-press a monster and choose <b>Cast</b>, or open the Combat tab and tap a spell to <b>autocast</b> it, then tap a monster. Runes come from Wizard Mizgog (by the south tower), Betty in Port Sarim, Aubury in Varrock, monster drops and Runecrafting.</p>
<p><b>Agility.</b> Four courses: Brightwater (level 1, south-east past the mine), Varrock (30), Port Sarim docks (45) and Falador (60). Do the obstacles in order for a lap bonus. Higher Agility also refills run energy faster.</p>
<p><b>Thieving.</b> Long-press townsfolk and choose <b>Pickpocket</b>: men and women (1), farmers (10), sailors (20), warriors (25), guards (40), White Knights (55), paladins (70) and heroes (80). Get caught and you're stunned for a few seconds.</p>
<p><b>Runecrafting.</b> Mine rune essence at the essence mine south-east of Varrock (pure essence from Mining 30), or buy it from the magic shops. Take it to a rune altar (ring of standing stones) and choose <b>Craft-rune</b>. Air altar is just south-west of Brightwater; Mind, Water, Earth, Fire, Body, Chaos, Death and Blood altars are out in the world.</p>
<p><b>Three new towns.</b> Port Sarim (south-west, by the docks), Varrock (far east, past Ashford) and Falador (north-west, the white city), each with a bank, shops and people. Signposts at the roads show the way. Giants, ogres, demons and dragons now roam the wider world.</p>
<p><b>Earlier today</b></p>
<p><b>New look</b></p>
<p><b>Modern graphics.</b> A sky with a warm sun and drifting clouds, textured ground with dirt paths, sandy shores and cobbled squares, hills on the horizon and a rippling lake with foam at the edge. Leafy trees sway in the wind, rocks show their ore veins, and the towns have timber-framed and stone buildings with tiled roofs, windows and chimneys. Grass, flowers and bushes cover the fields. You, the townsfolk and the monsters have new rounded models, and walking, running and attacking animate more smoothly. The panels have a new dark-and-gold look.</p>
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

export function createInventoryUI(api) {
  const { player, skills } = api;
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
  let selectedQuest = null, questTown = 'All', questState = 'all';
  let shopInfo = null;
  let craftTab = 'Smithing';
  let smithGroup = 'Smelting';

  tabBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tab === tab && !collapsed) collapsed = true;
    else { tab = b.dataset.tab; collapsed = false; }
    render();
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
    return `<div class="slot item" data-item="${esc(item)}" ${extra} title="${esc(item)}" style="${tint ? `background-color:${tint};` : ''}${rc ? `box-shadow:inset 0 0 0 2px ${rc};` : ''}">` +
      `<span class="ico">${ic}</span>${showQty && qty > 1 ? `<span class="qty">${qtyLabel(qty)}</span>` : ''}<span class="nm"${rc ? ` style="color:${rc}"` : ''}>${esc(shortName(item))}</span></div>`;
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
      html += `<div class="skill ${selectedSkill === s ? 'sel' : ''}" data-skill="${s}"><span>${SKILL_ICONS[s]}</span><b${bst ? ' class="boosted"' : ''}>${bst ? `${k.level + bst}/${k.level}` : k.level}</b><i style="width:${(levelProgress(k) * 100).toFixed(0)}%"></i></div>`;
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
        return `<div class="ab ${ok ? 'ok' : ''}" ${ok ? `data-ability="${a.id}"` : ''}><span class="abi">${a.icon}</span><div><b>${a.name}</b> <small class="${ok ? 'lvl' : 'need'}">${a.skill} ${a.level}</small><br><small>${a.desc}${cd ? ` <i>(${(cd * 0.6).toFixed(0)}s)</i>` : ''}</small></div></div>`;
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
  const sgn = v => (v >= 0 ? '+' : '') + v;
  function renderEquip() {
    let html = '<div class="tab-head"><b>Worn Equipment</b></div><div class="equipgrid">';
    for (const row of EQUIP_LAYOUT) for (const slot of row) {
      if (!slot) { html += '<div></div>'; continue; }
      const item = player.equipment[slot];
      if (item) html += itemCell(item, slot === 'ammo' ? player.ammoCount : 1, `data-slot="${slot}"`).replace('class="slot item"', 'class="slot item worn"');
      else html += `<div class="slot empty" title="${slot}"><span class="ico ghost">${SLOT_ICON[slot]}</span></div>`;
    }
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
      if (item) html += itemCell(item, 1, `data-tool="${t.id}"`, false).replace('class="slot item"', 'class="slot item tool"');
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
    if (selectedQuest) {
      const qd = QUESTS.find(x => x.id === selectedQuest);
      const st = questStatus(player, qd.id);
      html += `<div class="journal"><b>${esc(qd.name)}</b><div class="qmeta">${esc(qd.town)} · ${esc(qd.diff)}</div>${qd.journal(player).map(l => `<div class="${l.done ? 'done' : ''}">${esc(l.text)}</div>`).join('')}
        ${st === 'complete' ? '<div class="qdone">QUEST COMPLETE!</div>' : ''}
        <div class="rewards">Rewards: ${qd.points} quest point${qd.points > 1 ? 's' : ''}, ${qd.rewards.map(esc).join(', ')}</div>
        <div class="qbonus ${st === 'complete' ? 'on' : ''}">★ Lasting bonus: ${esc(qd.bonus.desc)}${st === 'complete' ? ' (active)' : ''}</div></div>`;
    }
    html += '<div class="questlist">';
    let shown = 0;
    QUESTS.forEach((qd, i) => {
      const st = sts[i];
      if (questTown !== 'All' && qd.town !== questTown) return;
      if (questState !== 'all' && st !== questState) return;
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
    return `<div class="tab-head"><b>Settings</b></div>
      <div class="savebtns"><button data-act="save">💾 Save</button><button data-act="export">Export</button><button data-act="import">Import</button><button data-act="paste">Paste save</button></div>
      <button class="toggle new" data-act="help">✨ What's new</button>
      ${t('dpad', 'On-screen D-pad', s.showDpad)}
      <button class="toggle on" data-act="gfx">Graphics quality: ${api.gfxLabel ? api.gfxLabel() : 'Auto'}</button>
      ${t('shadows', 'Shadows', api.shadowsOn())}
      ${t('retaliate', 'Auto Retaliate', s.autoRetaliate)}
      ${t('run', 'Run', s.run)}
      ${t('autoloot', 'Auto-pickup loot', s.autoLoot)}
      <button class="toggle" data-act="camera">Reset camera</button>
      <div class="help"><b>Controls</b><br>Tap to walk or act · hold (or right-click) for options · drag to turn camera · pinch or scroll to zoom · tap the minimap to walk · tap the compass to face north. Desktop: WASD walk, arrow keys turn the camera, 1-8 use combat skills.</div>`;
  }

  // ---------------- Windows ----------------
  function qtyBar(label) {
    const opts = mode === 'bank' ? [1, 5, 10, 'All'] : [1, 5, 10];
    return `<div class="qtybar">${label}${opts.map(q => `<button data-qty="${q}" class="${qtyMode === q ? 'on' : ''}">${q}</button>`).join('')}</div>`;
  }
  function shopStock() {
    const list = (SHOPS[mode] || SHOPS.shop).stock;
    return list.filter(s => stockVisible(s, player, skills));
  }
  function renderWindow() {
    if (!mode) { win.style.display = 'none'; return; }
    win.style.display = 'flex';
    let html;
    if (mode === 'bank') {
      const entries = Object.entries(player.bank).filter(([, q]) => q > 0);
      html = `<div class="win-head"><b>Bank of Brightwater</b><span>${entries.length} items</span><button class="close" data-act="close">✕</button></div>
        ${qtyBar('Withdraw/deposit: ')}
        <div class="bankgrid">${entries.map(([item, q]) => itemCell(item, q).replace('class="slot item"', 'class="slot item bankitem"')).join('') || '<div class="hint">Your bank is empty.</div>'}</div>
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
          const stats = statLine(s.item);
          return itemCell(s.item, 1).replace('class="slot item"', `class="slot item shopitem ${owned ? 'owned' : ''}" data-price="${price}"`).replace(`title="${esc(s.item)}"`, `title="${esc(s.item + (stats ? ': ' + stats : ''))}"`)
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
    const html = list.map(a => {
      const cd = Math.max(0, (api.cooldowns()[a.id] || 0) - now);
      const total = api.cooldownOf(a);
      const queued = api.queued() === a.id;
      return `<button data-ability="${a.id}" class="${cd ? 'cd' : ''} ${queued ? 'queued' : ''}" title="${esc(a.name)}: ${esc(a.desc)}"><span>${a.icon}</span>${cd ? `<i style="height:${(cd / total * 100).toFixed(0)}%"></i><b>${Math.ceil(cd * 0.6)}</b>` : ''}</button>`;
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
    const act = e.target.closest('[data-act]');
    if (act) { if (act.dataset.act === 'help') open('help'); else api.setting(act.dataset.act); }
  });
  win.addEventListener('click', e => {
    const q = e.target.closest('[data-qty]');
    if (q) { qtyMode = q.dataset.qty === 'All' ? 'All' : +q.dataset.qty; render(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'close') close();
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
