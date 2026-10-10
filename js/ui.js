// Chat box, options menu, tap markers, XP drops and level-up messages.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

const FILTERS = [
  { id: 'all', label: 'All', types: null },
  { id: 'game', label: 'Game', types: ['game', 'warn', 'examine'] },
  { id: 'combat', label: 'Combat', types: ['combat'] },
  { id: 'skill', label: 'Skills', types: ['skill'] },
  { id: 'loot', label: 'Loot', types: ['loot'] }
];

export function setupUI(settings) {
  const chat = document.getElementById('chat');
  chat.innerHTML = `
    <div id="chatLines"></div>
    <div id="chatTabs">${FILTERS.map(f => `<button data-f="${f.id}">${f.label}</button>`).join('')}<button data-f="toggle" title="Show more or less chat">▾</button></div>`;
  const linesEl = document.getElementById('chatLines');
  const tabs = chat.querySelectorAll('#chatTabs button');
  const messages = [];
  let filter = FILTERS.find(f => f.id === (settings.chatFilter || 'all')) || FILTERS[0];

  function matches(m) { return !filter.types || filter.types.includes(m.type); }
  function lineEl(m) {
    const d = document.createElement('div');
    d.className = 'c-' + m.type;
    d.textContent = m.text;
    return d;
  }
  function renderAll() {
    linesEl.textContent = '';
    for (const m of messages) if (matches(m)) linesEl.appendChild(lineEl(m));
    linesEl.scrollTop = linesEl.scrollHeight;
    tabs.forEach(b => b.classList.toggle('on', b.dataset.f === filter.id));
    chat.classList.toggle('collapsed', !!settings.chatCollapsed);
  }
  tabs.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.f === 'toggle') { settings.chatCollapsed = !settings.chatCollapsed; renderAll(); return; }
    filter = FILTERS.find(f => f.id === b.dataset.f);
    settings.chatFilter = filter.id;
    renderAll();
  }));

  let lastText = '', lastAt = 0;
  function log(text, type = 'game') {
    const now = performance.now();
    if (text === lastText && now - lastAt < 400) return; // drop exact duplicates fired together
    lastText = text; lastAt = now;
    const m = { text, type };
    messages.push(m);
    if (messages.length > 150) {
      messages.shift();
      if (linesEl.firstChild && linesEl.children.length > 150) linesEl.removeChild(linesEl.firstChild);
    }
    if (matches(m)) {
      linesEl.appendChild(lineEl(m));
      while (linesEl.children.length > 150) linesEl.removeChild(linesEl.firstChild);
      linesEl.scrollTop = linesEl.scrollHeight;
    }
  }
  renderAll();

  // ---- Options menu ----
  const menu = document.createElement('div');
  menu.id = 'ctxMenu';
  document.body.appendChild(menu);
  function hideMenu() { menu.style.display = 'none'; }
  // options: [{ action, target, color, fn }]
  function showMenu(x, y, options) {
    const all = [...options, { action: 'Cancel', fn: () => {} }];
    menu.innerHTML = '<div class="ctx-title">Choose Option</div>' + all.map((o, i) =>
      `<div class="ctx-opt" data-i="${i}">${esc(o.action)}${o.target ? ` <span style="color:${o.color || '#ff0'}">${esc(o.target)}</span>` : ''}</div>`).join('');
    menu.style.display = 'block';
    menu.style.left = '0px'; menu.style.top = '0px';
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, x - w / 2)) + 'px';
    menu.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, y - 10)) + 'px';
    menu.querySelectorAll('.ctx-opt').forEach(el => {
      el.addEventListener('pointerup', e => {
        e.stopPropagation();
        hideMenu();
        all[+el.dataset.i].fn();
      });
    });
  }
  document.addEventListener('pointerdown', e => { if (menu.style.display === 'block' && !menu.contains(e.target)) hideMenu(); }, true);

  // ---- Tap marker (yellow = walk, red = action) ----
  const marker = document.createElement('div');
  marker.id = 'tapMarker';
  document.body.appendChild(marker);
  function tapMarker(x, y, red) {
    marker.className = '';
    void marker.offsetWidth;
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.className = red ? 'show red' : 'show';
  }

  // ---- Top-left action text ----
  const status = document.getElementById('status');
  function setStatus(html) { if (status._v !== html) { status._v = html; status.innerHTML = html; } }

  // ---- XP drops ----
  const drops = document.getElementById('xpdrops');
  function xpDrop(skill, icon, amount) {
    const d = document.createElement('div');
    d.className = 'xpdrop';
    d.textContent = `${icon} +${Math.round(amount * 10) / 10} xp`;
    d.title = skill;
    drops.appendChild(d);
    setTimeout(() => d.remove(), 1700);
    while (drops.children.length > 6) drops.removeChild(drops.firstChild);
  }

  // ---- Level up banner ----
  const bannerEl = document.getElementById('levelup');
  const queue = [];
  let showing = false;
  function nextBanner() {
    if (!queue.length) { showing = false; bannerEl.style.display = 'none'; return; }
    showing = true;
    bannerEl.innerHTML = queue.shift();
    bannerEl.style.display = 'block';
    bannerEl.classList.remove('pop'); void bannerEl.offsetWidth; bannerEl.classList.add('pop');
    setTimeout(nextBanner, 2800);
  }
  function banner(html) {
    queue.push(html);
    if (!showing) nextBanner();
  }
  function levelUp(skill, icon, level, perks = []) {
    queue.push(`<div class="lu-icon">${icon}</div><div><b>Congratulations!</b> You just advanced a ${esc(skill)} level.<br>Your ${esc(skill)} level is now ${level}.` +
      // Milestones first; long lists (big XP jumps) are trimmed here but every perk is named in chat.
      [...perks].sort((x, y) => (y.milestone ? 1 : 0) - (x.milestone ? 1 : 0)).slice(0, 4)
        .map(p => `<br><span class="lu-perk">New perk: ${p.milestone ? '★ ' : ''}${esc(p.name)} (${esc(p.desc)})</span>`).join('') +
      (perks.length > 4 ? `<br><span class="lu-perk">…and ${perks.length - 4} more (see chat)</span>` : '') + '</div>');
    if (!showing) nextBanner();
  }
  bannerEl.addEventListener('click', () => { nextBanner(); });

  // ---- RS-style dialogue box ----
  // script entries: ['npc'|'player', text], { choose: [[label, entries]] }, { run: fn }
  const dlg = document.createElement('div');
  dlg.id = 'dialogue';
  document.body.appendChild(dlg);
  let dq = null, dName = '', dIcon = '', dEnd = null;
  function dialogueNext() {
    if (!dq) return;
    while (dq.length) {
      const e = dq.shift();
      if (Array.isArray(e)) {
        const who = e[0] === 'npc' ? dName : 'You';
        dlg.innerHTML = `<div class="d-face">${e[0] === 'npc' ? dIcon : '🧑'}</div><div class="d-body"><div class="d-name">${esc(who)}</div>
          <div class="d-text">${esc(e[1])}</div><div class="d-cont">Tap here to continue</div></div>`;
        dlg.dataset.kind = 'line';
        dlg.style.display = 'flex';
        return;
      }
      if (e.run) { e.run(); continue; }
      if (e.choose) {
        dlg.innerHTML = `<div class="d-body"><div class="d-name">Select an Option</div>${e.choose.map((c, i) => `<button class="d-opt" data-i="${i}">${esc(c[0])}</button>`).join('')}</div>`;
        dlg.dataset.kind = 'choose';
        dlg._choose = e.choose;
        dlg.style.display = 'flex';
        return;
      }
    }
    closeDialogue();
  }
  function closeDialogue() {
    dlg.style.display = 'none';
    const end = dEnd;
    dq = null; dEnd = null;
    if (end) end();
  }
  function dialogue(name, icon, script, onEnd) {
    dq = [...script]; dName = name; dIcon = icon || '🙂'; dEnd = onEnd || null;
    dialogueNext();
  }
  dlg.addEventListener('click', e => {
    e.stopPropagation();
    if (dlg.dataset.kind === 'choose') {
      const b = e.target.closest('.d-opt');
      if (!b) return;
      const branch = dlg._choose[+b.dataset.i][1];
      dq.unshift(['player', dlg._choose[+b.dataset.i][0]], ...branch);
      dialogueNext();
    } else dialogueNext();
  });

  return { log, showMenu, hideMenu, tapMarker, setStatus, xpDrop, levelUp, banner, dialogue, closeDialogue, get inDialogue() { return !!dq; } };
}
