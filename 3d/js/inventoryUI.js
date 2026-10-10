import { ITEMS } from './items.js';

export function createInventoryUI(player, skills, onEquip, onLog) {
  const panel = document.createElement('div');
  panel.id = 'advancedInv';
  panel.style.cssText = `
    position: absolute; top: 10px; right: 10px; width: 260px;
    background: rgba(10,10,20,0.85); color: #eee; padding: 8px;
    border-radius: 8px; border: 1px solid #c9a227; font-size: 12px;
    pointer-events: auto; max-height: 70vh; overflow-y: auto;
  `;
  document.body.appendChild(panel);

  // Bank storage
  if (!player.bank) player.bank = {};

  function categorize(item) {
    const info = ITEMS[item] || {};
    if (info.type === 'food') return 'Food';
    if (info.type === 'weapon' || info.type === 'shield' || info.type === 'body') return 'Gear';
    if (info.type === 'resource') return 'Resources';
    if (info.type === 'processed') return 'Processed';
    return 'Other';
  }

  function tooltip(item) {
    const info = ITEMS[item] || {};
    let tip = item;
    if (info.atk) tip += ` | Atk: ${info.atk}`;
    if (info.def) tip += ` | Def: ${info.def}`;
    if (info.heal) tip += ` | Heal: ${info.heal}`;
    if (info.req) tip += ` | Req: ${Object.entries(info.req).map(([k,v]) => `${k} ${v}`).join(', ')}`;
    return tip;
  }

  function render() {
    const cats = {};
    for (const [item, qty] of Object.entries(player.inventory)) {
      const cat = categorize(item);
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ item, qty });
    }

    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong>Inventory</strong>
        <span>HP ${player.hp}/${player.maxHp} | ${player.gold}gp</span>
      </div>
      <div style="font-size:11px; color:#aaa; margin-bottom:4px;">
        Eq: ${player.equipment.weapon || '—'} / ${player.equipment.shield || '—'} / ${player.equipment.body || '—'}
      </div>
      <button onclick="window.toggleBank()" style="font-size:10px; margin-bottom:6px;">Bank</button>
    `;

    for (const [cat, items] of Object.entries(cats)) {
      html += `<div style="margin-top:6px; color:#ffd700; font-size:11px;">${cat}</div>`;
      html += items.map(({ item, qty }) => `
        <div style="display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid #333;"
             title="${tooltip(item)}"
             onmouseenter="this.style.background='#2a2a3a'"
             onmouseleave="this.style.background='transparent'">
          <span style="cursor:pointer;" onclick="window.doEquip('${item}')">${item}</span>
          <span>
            x${qty}
            <button style="font-size:9px; padding:1px 4px;" onclick="window.moveToBank('${item}')">Bank</button>
          </span>
        </div>
      `).join('');
    }

    if (Object.keys(player.inventory).length === 0) html += '<div style="color:#666;">Empty</div>';

    panel.innerHTML = html;
  }

  window.moveToBank = (item) => {
    if (!player.inventory[item]) return;
    player.bank[item] = (player.bank[item] || 0) + player.inventory[item];
    delete player.inventory[item];
    onLog(`Moved ${item} to bank.`);
    render();
  };

  window.withdrawFromBank = (item) => {
    if (!player.bank[item]) return;
    player.inventory[item] = (player.inventory[item] || 0) + 1;
    player.bank[item]--;
    if (player.bank[item] <= 0) delete player.bank[item];
    onLog(`Withdrew ${item}.`);
    render();
    renderBank();
  };

  const bankPanel = document.createElement('div');
  bankPanel.id = 'bankPanel';
  bankPanel.style.cssText = `
    display: none; position: absolute; top: 10px; right: 280px; width: 200px;
    background: rgba(10,10,20,0.9); color: #eee; padding: 8px;
    border-radius: 8px; border: 1px solid #448; font-size: 12px; pointer-events: auto;
  `;
  document.body.appendChild(bankPanel);

  function renderBank() {
    const entries = Object.entries(player.bank);
    bankPanel.innerHTML = `<strong>Bank</strong> <button onclick="window.toggleBank()" style="font-size:9px;">Close</button><br>` +
      (entries.length ? entries.map(([item, qty]) =>
        `<div>${item} x${qty} <button style="font-size:9px;" onclick="window.withdrawFromBank('${item}')">Take</button></div>`
      ).join('') : 'Empty');
  }

  window.toggleBank = () => {
    bankPanel.style.display = bankPanel.style.display === 'none' ? 'block' : 'none';
    if (bankPanel.style.display === 'block') renderBank();
  };

  return { render, panel };
}
