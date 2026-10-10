// RS-style side panel with tabs, plus the bank, shop and help windows and the combat-skill quick bar.
import { ITEMS, RECIPES, iconFor, CRAFT_TABS, METALS, TOOL_TYPES } from './items.js';
import { SKILLS, SKILL_ICONS, xpToNext, levelProgress, nextLevelXp, combatLevel, totalLevel, PERKS, maxPrayer } from './skills.js';
import { INV_SIZE, slotsUsed } from './playerState.js';
import { stylesFor, currentStyle, equipmentBonuses, playerMaxHit, SHOP_STOCK, TOOL_STOCK, sellPrice, bestTool } from './gameplay.js';
import { PRAYERS, isActive, drainPerTick } from './prayer.js';
import { ABILITIES, unlocked } from './abilities.js';
import { QUESTS, questStatus, questPoints, QUEST_POINTS_TOTAL } from './quests.js';
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
<p><b>Stacking.</b> Identical items now share one slot, so the 28 slots count different items. Tap bones to bury one, or hold for Bury all / Drop all.</p>
<p><b>Toolbelt.</b> Tools live on the toolbelt in Worn Equipment and don't take inventory space. Better axes and pickaxes gather faster. Bob's Tool Shop (north of the square) sells more.</p>
<p><b>Crafting tabs.</b> Smithing (bars at the furnace, gear at the anvil), Crafting, Fletching and Cooking (range or a fire you light from logs). Tiers run bronze → rune.</p>
<p><b>Combat skills.</b> Power Strike, Puncture, Rapid Volley and more unlock with your combat levels. Use them from the quick bar while fighting.</p>
<p><b>Perks.</b> Every skill unlocks a passive bonus at levels 10, 20 … 90 and 99. See them in the Skills tab.</p>
<p><b>Brightwater.</b> The town now has a bank, general store, tool shop, smithy, cookhouse and church.</p>
<p><b>Quests.</b> Five quests (6 quest points) from town folk. Look for the blue dots on the minimap.</p>
<p><b>Prayer.</b> Bury bones for Prayer XP and turn on prayers in the Prayer tab. Recharge at the church altar.</p>
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
  let selectedQuest = null;
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
    return `<div class="slot item" data-item="${esc(item)}" ${extra} title="${esc(item)}" style="${tint ? `background-color:${tint}` : ''}">` +
      `<span class="ico">${ic}</span>${showQty && qty > 1 ? `<span class="qty">${qtyLabel(qty)}</span>` : ''}<span class="nm">${esc(shortName(item))}</span></div>`;
  }
  function shortName(item) {
    return item.replace(' logs', '').replace('Cooked ', '').replace(' platebody', ' plate').replace(' platelegs', ' legs').replace(' full helm', ' helm').replace(' shortbow', ' bow');
  }

  function renderInv() {
    const used = slotsUsed(player);
    const hint = mode === 'bank' ? 'Tap an item to bank it' : (mode === 'shop' || mode === 'tools') ? 'Tap an item to sell it' : 'Tap to use · hold for options';
    return `<div class="tab-head"><b>Inventory</b><span>${used}/${INV_SIZE} · <span class="gold">${fmt(player.gold)} gp</span></span></div>
      <div class="invgrid">${invCells().map(c => c ? itemCell(c.item, c.qty) : '<div class="slot"></div>').join('')}</div>
      <div class="hint">${hint}</div>`;
  }

  function renderSkills() {
    let html = `<div class="tab-head"><b>Skills</b><span>Total ${totalLevel(skills)}</span></div><div class="skillgrid">`;
    for (const s of SKILLS) {
      const k = skills[s];
      html += `<div class="skill ${selectedSkill === s ? 'sel' : ''}" data-skill="${s}"><span>${SKILL_ICONS[s]}</span><b>${k.level}</b><i style="width:${(levelProgress(k) * 100).toFixed(0)}%"></i></div>`;
    }
    html += '</div>';
    if (selectedSkill) {
      const k = skills[selectedSkill];
      html += `<div class="skilldetail"><b>${selectedSkill}</b> level ${k.level}<br>XP: ${fmt(k.xp)}<br>` +
        (k.level >= 99 ? 'Maximum level!' : `Next level at: ${fmt(nextLevelXp(k))}<br>Remaining: ${fmt(xpToNext(k))}`) +
        `<div class="bar"><i style="width:${(levelProgress(k) * 100).toFixed(1)}%"></i></div>
        <div class="perks"><b>Perks</b>${(PERKS[selectedSkill] || []).map(p => `<div class="perk ${k.level >= p.level ? 'got' : ''}"><span>${p.level}</span> <b>${esc(p.name)}</b>: ${esc(p.desc)}</div>`).join('')}</div></div>`;
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
      <div class="hint">Max hit ${playerMaxHit(player, skills)} · attack speed ${(api.attackSpeed() * 0.6).toFixed(1)}s</div>`;
  }

  const EQUIP_LAYOUT = [
    [null, 'head', 'ammo'],
    ['weapon', 'body', 'shield'],
    [null, 'legs', null]
  ];
  const SLOT_ICON = { head: '⛑️', ammo: '➶', weapon: '🗡️', body: '👕', shield: '🛡️', legs: '👖' };
  function renderEquip() {
    let html = '<div class="tab-head"><b>Worn Equipment</b></div><div class="equipgrid">';
    for (const row of EQUIP_LAYOUT) for (const slot of row) {
      if (!slot) { html += '<div></div>'; continue; }
      const item = player.equipment[slot];
      if (item) html += itemCell(item, slot === 'ammo' ? player.ammoCount : 1, `data-slot="${slot}"`).replace('class="slot item"', 'class="slot item worn"');
      else html += `<div class="slot empty" title="${slot}"><span class="ico ghost">${SLOT_ICON[slot]}</span></div>`;
    }
    const b = equipmentBonuses(player);
    html += `</div><div class="bonuses">
      <div>Attack <b>+${b.atk}</b></div><div>Strength <b>+${b.str}</b></div>
      <div>Ranged <b>+${b.ranged}</b></div><div>Arrow str <b>+${b.rstr}</b></div>
      <div>Defence <b>+${b.def}</b></div><div>Max hit <b>${playerMaxHit(player, skills)}</b></div></div>
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
    let html = `<div class="tab-head"><b>Prayer</b><span>${Math.ceil(pp)} / ${max}</span></div>
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
    let html = `<div class="tab-head"><b>Quests</b><span>Quest Points: ${qp}/${QUEST_POINTS_TOTAL}</span></div><div class="questlist">`;
    for (const qd of QUESTS) {
      const st = questStatus(player, qd.id);
      html += `<div class="quest q-${st.replace(' ', '-')} ${selectedQuest === qd.id ? 'sel' : ''}" data-quest="${qd.id}">${esc(qd.name)}</div>`;
    }
    html += '</div>';
    if (selectedQuest) {
      const qd = QUESTS.find(x => x.id === selectedQuest);
      const st = questStatus(player, qd.id);
      html += `<div class="journal"><b>${esc(qd.name)}</b>${qd.journal(player).map(l => `<div class="${l.done ? 'done' : ''}">${esc(l.text)}</div>`).join('')}
        ${st === 'complete' ? '<div class="qdone">QUEST COMPLETE!</div>' : ''}
        <div class="rewards">Rewards: ${qd.points} quest point${qd.points > 1 ? 's' : ''}, ${qd.rewards.map(esc).join(', ')}</div></div>`;
    } else html += '<div class="hint">Red: not started · Yellow: in progress · Green: complete. Tap a quest for its journal.</div>';
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
      <div class="savebtns"><button data-act="save">💾 Save</button><button data-act="export">Export</button><button data-act="import">Import</button></div>
      <button class="toggle new" data-act="help">✨ What's new</button>
      ${t('dpad', 'On-screen D-pad', s.showDpad)}
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
    const list = mode === 'tools' ? TOOL_STOCK : SHOP_STOCK;
    return list.filter(s => !s.unlock || api.questDone(s.unlock));
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
      const title = mode === 'tools' ? "Bob's Brilliant Tools" : "Merchant's General Store";
      html = `<div class="win-head"><b>${title}</b><span class="gold">${fmt(player.gold)} gp</span><button class="close" data-act="close">✕</button></div>
        ${qtyBar('Buy/sell: ')}
        <div class="bankgrid">${shopStock().map(s => {
          const owned = ITEMS[s.item] && ITEMS[s.item].tool && player.tools && player.tools[s.item];
          return itemCell(s.item, 1).replace('class="slot item"', `class="slot item shopitem ${owned ? 'owned' : ''}" data-price="${s.price}"`).replace(/<\/div>$/, `<span class="price">${s.price}</span>${owned ? '<span class="own">✔</span>' : ''}</div>`);
        }).join('')}</div>
        <div class="hint">Tap stock to buy · tap your items to sell${mode === 'tools' ? ' · tools go straight onto your toolbelt (✔ = owned)' : ''}</div>`;
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
    else if (mode === 'shop' || mode === 'tools') api.sell(item, qtyMode);
    else api.useItem(item);
  }, (el, x, y) => api.itemMenu(el.dataset.item, x, y, mode));
  bindPress(content, '.slot.item.worn', el => api.unequip(el.dataset.slot), (el, x, y) => api.wornMenu(el.dataset.slot, x, y));
  bindPress(content, '.slot.tool', el => api.toolInfo(el.dataset.tool), el => api.toolInfo(el.dataset.tool));
  bindPress(content, '[data-prayer]', el => api.prayerToggle(el.dataset.prayer), el => api.prayerInfo(el.dataset.prayer));
  bindPress(win, '.slot.bankitem', el => api.withdraw(el.dataset.item, qtyMode), (el, x, y) => api.bankMenu(el.dataset.item, x, y));
  bindPress(win, '.slot.shopitem', el => api.buy(el.dataset.item, +el.dataset.price, qtyMode), (el, x, y) => api.shopMenu(el.dataset.item, +el.dataset.price, x, y));

  content.addEventListener('click', e => {
    const sk = e.target.closest('[data-skill]');
    if (sk) { selectedSkill = selectedSkill === sk.dataset.skill ? null : sk.dataset.skill; render(); return; }
    const qq = e.target.closest('[data-quest]');
    if (qq) { selectedQuest = selectedQuest === qq.dataset.quest ? null : qq.dataset.quest; render(); return; }
    const st = e.target.closest('[data-style]');
    if (st) { player.attackStyle = +st.dataset.style; render(); return; }
    const ct = e.target.closest('[data-ctab]');
    if (ct) { craftTab = ct.dataset.ctab; render(); return; }
    const sg = e.target.closest('[data-sgroup]');
    if (sg) { smithGroup = sg.dataset.sgroup; render(); return; }
    const ab = e.target.closest('[data-ability]');
    if (ab) { api.useAbility(ab.dataset.ability); return; }
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
