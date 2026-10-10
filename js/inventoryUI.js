// RS-style side panel with tabs (Combat, Skills, Inventory, Equipment, Craft, Settings)
// plus the bank and shop windows.
import { ITEMS, RECIPES, iconFor, isStackable, canCraft } from './items.js';
import { SKILLS, SKILL_ICONS, xpToNext, levelProgress, nextLevelXp, combatLevel, totalLevel } from './skills.js';
import { INV_SIZE, slotsUsed } from './playerState.js';
import { stylesFor, currentStyle, equipmentBonuses, playerMaxHit, SHOP_STOCK, sellPrice } from './gameplay.js';
import { esc } from './ui.js';

const TABS = [
  { id: 'combat', icon: '⚔️', title: 'Combat options' },
  { id: 'skills', icon: '📊', title: 'Skills' },
  { id: 'inv', icon: '🎒', title: 'Inventory' },
  { id: 'equip', icon: '🛡️', title: 'Worn equipment' },
  { id: 'craft', icon: '🔨', title: 'Crafting' },
  { id: 'settings', icon: '⚙️', title: 'Settings' }
];

const fmt = n => Math.floor(n).toLocaleString('en-US');
const qtyLabel = n => n >= 10000000 ? Math.floor(n / 1000000) + 'M' : n >= 100000 ? Math.floor(n / 1000) + 'K' : String(n);

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

  let tab = 'inv';
  let collapsed = false;
  let mode = null;          // null | 'bank' | 'shop'
  let qtyMode = 1;          // bank / shop quantity
  let selectedSkill = null;

  tabBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tab === tab && !collapsed) collapsed = true;
    else { tab = b.dataset.tab; collapsed = false; }
    render();
  }));

  // ---------------- Tabs ----------------
  function invCells() {
    const cells = [];
    for (const [item, qty] of Object.entries(player.inventory)) {
      if (isStackable(item)) cells.push({ item, qty });
      else for (let i = 0; i < qty && cells.length < INV_SIZE; i++) cells.push({ item, qty: 1 });
    }
    while (cells.length < INV_SIZE) cells.push(null);
    return cells.slice(0, INV_SIZE);
  }
  function itemCell(item, qty, extra = '') {
    const [ic, tint] = iconFor(item);
    return `<div class="slot item" data-item="${esc(item)}" ${extra} title="${esc(item)}" style="${tint ? `background-color:${tint}` : ''}">` +
      `<span class="ico">${ic}</span>${qty > 1 || isStackable(item) ? `<span class="qty">${qtyLabel(qty)}</span>` : ''}<span class="nm">${esc(shortName(item))}</span></div>`;
  }
  function shortName(item) {
    return item.replace(' logs', '').replace('Cooked ', '').replace('Raw ', 'Raw ').replace(' platebody', ' plate');
  }

  function renderInv() {
    const used = slotsUsed(player);
    const hint = mode === 'bank' ? 'Tap an item to bank it' : mode === 'shop' ? 'Tap an item to sell it' : 'Tap to use · hold for options';
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
        `<div class="bar"><i style="width:${(levelProgress(k) * 100).toFixed(1)}%"></i></div></div>`;
    } else {
      html += '<div class="hint">Tap a skill to see its XP</div>';
    }
    return html;
  }

  function renderCombat() {
    const styles = stylesFor(player);
    const cur = currentStyle(player);
    const w = player.equipment.weapon || 'Unarmed';
    return `<div class="tab-head"><b>${esc(w)}</b><span>Combat Lvl: ${combatLevel(skills)}</span></div>
      <div class="styles">${styles.map((s, i) => `<button class="style ${s === cur ? 'on' : ''}" data-style="${i}"><b>${s.name}</b><small>${s.xp.join(', ')} XP</small></button>`).join('')}</div>
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
      else html += `<div class="slot empty ${slot === 'head' ? 'na' : ''}" title="${slot}"><span class="ico ghost">${SLOT_ICON[slot]}</span></div>`;
    }
    const b = equipmentBonuses(player);
    html += `</div><div class="bonuses">
      <div>Attack <b>+${b.atk}</b></div><div>Strength <b>+${b.str}</b></div>
      <div>Ranged <b>+${b.ranged}</b></div><div>Arrow str <b>+${b.rstr}</b></div>
      <div>Defence <b>+${b.def}</b></div><div>Max hit <b>${playerMaxHit(player, skills)}</b></div></div>
      <div class="hint">Tap an item to take it off</div>`;
    return html;
  }

  function renderCraft() {
    let html = '<div class="tab-head"><b>Crafting</b><span>tap 1 or All</span></div><div class="craftlist">';
    let lastSkill = null;
    for (const r of RECIPES) {
      if (r.skill !== lastSkill) { html += `<div class="craftskill">${SKILL_ICONS[r.skill]} ${r.skill} (${skills[r.skill].level})</div>`; lastSkill = r.skill; }
      const lvlOk = skills[r.skill].level >= r.level;
      const ok = canCraft(skills, player.inventory, r);
      const inputs = Object.entries(r.inputs).map(([it, q]) => {
        const have = player.inventory[it] || 0;
        return `<span class="${have >= q ? 'have' : 'need'}">${q} ${esc(it)}</span>`;
      }).join(' + ');
      html += `<div class="recipe ${ok ? 'ok' : ''}">
        <div class="rname">${iconFor(r.output)[0]} ${esc(r.output)} <span class="${lvlOk ? 'lvl' : 'need'}">Lv ${r.level}</span><br><small>${inputs}</small></div>
        <div class="rbtn"><button data-craft="${esc(r.name)}" data-n="1" ${ok ? '' : 'disabled'}>1</button><button data-craft="${esc(r.name)}" data-n="all" ${ok ? '' : 'disabled'}>All</button></div></div>`;
    }
    return html + '</div>';
  }

  function renderSettings() {
    const s = player.settings;
    const t = (act, label, on) => `<button class="toggle ${on ? 'on' : ''}" data-act="${act}">${label}: ${on ? 'On' : 'Off'}</button>`;
    return `<div class="tab-head"><b>Settings</b></div>
      <div class="savebtns"><button data-act="save">💾 Save</button><button data-act="export">Export</button><button data-act="import">Import</button></div>
      ${t('dpad', 'On-screen D-pad', s.showDpad)}
      ${t('shadows', 'Shadows', api.shadowsOn())}
      ${t('retaliate', 'Auto Retaliate', s.autoRetaliate)}
      ${t('run', 'Run', s.run)}
      ${t('autoloot', 'Auto-pickup loot', s.autoLoot)}
      <button class="toggle" data-act="camera">Reset camera</button>
      <div class="help"><b>Controls</b><br>Tap to walk or act · hold (or right-click) for options · drag to turn camera · pinch or scroll to zoom · tap the minimap to walk · tap the compass to face north. Desktop: WASD walk, arrow keys turn the camera.</div>`;
  }

  // ---------------- Bank & shop windows ----------------
  function qtyBar(label) {
    const opts = mode === 'shop' ? [1, 5, 10] : [1, 5, 10, 'All'];
    return `<div class="qtybar">${label}${opts.map(q => `<button data-qty="${q}" class="${qtyMode === q ? 'on' : ''}">${q}</button>`).join('')}</div>`;
  }
  function renderWindow() {
    if (!mode) { win.style.display = 'none'; return; }
    win.style.display = 'flex';
    if (mode === 'bank') {
      const entries = Object.entries(player.bank).filter(([, q]) => q > 0);
      const count = entries.length;
      win.innerHTML = `<div class="win-head"><b>Bank of Gielinor</b><span>${count} items</span><button class="close" data-act="close">✕</button></div>
        ${qtyBar('Withdraw/deposit: ')}
        <div class="bankgrid">${entries.map(([item, q]) => itemCell(item, q).replace('class="slot item"', 'class="slot item bankitem"')).join('') || '<div class="hint">Your bank is empty.</div>'}</div>
        <div class="win-foot"><button data-act="depinv">Deposit inventory</button><button data-act="depworn">Deposit worn items</button></div>`;
    } else {
      win.innerHTML = `<div class="win-head"><b>Merchant's General Store</b><span class="gold">${fmt(player.gold)} gp</span><button class="close" data-act="close">✕</button></div>
        ${qtyBar('Buy/sell: ')}
        <div class="bankgrid">${SHOP_STOCK.map(s => itemCell(s.item, 1).replace('class="slot item"', `class="slot item shopitem" data-price="${s.price}"`).replace('</div>', `<span class="price">${s.price}</span></div>`)).join('')}</div>
        <div class="hint">Tap stock to buy · tap your items to sell</div>`;
    }
  }

  function render() {
    tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === tab && !collapsed));
    panel.classList.toggle('collapsed', collapsed);
    if (!collapsed) {
      const html = tab === 'inv' ? renderInv() : tab === 'skills' ? renderSkills() : tab === 'combat' ? renderCombat()
        : tab === 'equip' ? renderEquip() : tab === 'craft' ? renderCraft() : renderSettings();
      if (content._html !== html) { content._html = html; content.innerHTML = html; }
    }
    renderWindow();
  }

  // ---------------- Events ----------------
  // Inventory items
  bindPress(content, '.slot.item:not(.worn)', el => {
    const item = el.dataset.item;
    if (mode === 'bank') api.deposit(item, qtyMode);
    else if (mode === 'shop') api.sell(item, qtyMode);
    else api.useItem(item);
  }, (el, x, y) => api.itemMenu(el.dataset.item, x, y, mode));
  // Worn items
  bindPress(content, '.slot.item.worn', el => api.unequip(el.dataset.slot), (el, x, y) => api.wornMenu(el.dataset.slot, x, y));
  // Bank and shop stock
  bindPress(win, '.slot.bankitem', el => api.withdraw(el.dataset.item, qtyMode), (el, x, y) => api.bankMenu(el.dataset.item, x, y));
  bindPress(win, '.slot.shopitem', el => api.buy(el.dataset.item, +el.dataset.price, qtyMode), (el, x, y) => api.shopMenu(el.dataset.item, +el.dataset.price, x, y));

  content.addEventListener('click', e => {
    const sk = e.target.closest('[data-skill]');
    if (sk) { selectedSkill = selectedSkill === sk.dataset.skill ? null : sk.dataset.skill; render(); return; }
    const st = e.target.closest('[data-style]');
    if (st) { player.attackStyle = +st.dataset.style; render(); return; }
    const cr = e.target.closest('[data-craft]');
    if (cr && !cr.disabled) { api.craft(cr.dataset.craft, cr.dataset.n === 'all' ? Infinity : 1); return; }
    const act = e.target.closest('[data-act]');
    if (act) api.setting(act.dataset.act);
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
    tab = 'inv';
    collapsed = false;
    render();
  }
  function close() { mode = null; render(); }

  return {
    render, open, close, panel,
    get mode() { return mode; },
    showTab(t) { tab = t; collapsed = false; render(); }
  };
}
