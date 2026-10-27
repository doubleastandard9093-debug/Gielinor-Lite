// Bonds panel (B): companions, faction standing and the errand ledger. Plain DOM, no textures.
export function createBondsUI({ getData, onAct }) {
  const el = document.createElement('div');
  el.id = 'bonds'; el.style.display = 'none';
  document.body.appendChild(el);
  let tab = 'comp', timer = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const left = ms => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
  function render() {
    const d = getData(), now = Date.now();
    let body = '';
    if (tab === 'comp') body = d.companions.map(c => `<div class="b-card${c.recruited ? '' : ' dim'}"><div class="b-h"><span>${c.face} ${esc(c.name)}</span><span>${c.recruited ? `Bond ${c.bond}/10` : 'Not recruited'}</span></div>
      <div class="b-bar"><i style="width:${c.bond * 10}%"></i></div>
      <div class="b-s">${esc(c.role)} · likes ${esc(c.likes)} words and ${esc(c.giftWord)} · helps ${esc(c.skills.join(', '))}</div>
      ${c.recruited ? `<div class="b-s">${c.perks.map(p => `<span class="${c.bond >= p.at ? 'on' : ''}">${p.at}: ${esc(p.desc)}</span>`).join('<br>')}</div>
      <div class="b-row">${c.away ? `<span class="b-s">On an errand, back in ${left(c.away - now)}</span>` : `<button data-a="follow" data-c="${c.id}">${c.active ? 'Send home' : 'Follow me'}</button>`}</div>` : `<div class="b-s">${esc(c.task)}</div>`}</div>`).join('');
    else if (tab === 'rep') body = d.factions.map(f => `<div class="b-card"><div class="b-h"><span>${f.icon} ${esc(f.name)}</span><span>${esc(f.tierName)}</span></div>
      <div class="b-bar"><i style="width:${f.pct}%"></i></div><div class="b-s">${f.rep}${f.next ? ` / ${f.next}` : ' (max)'} · +${f.tier}% XP in ${esc(f.skills.join(', '))}</div></div>`).join('') + '<div class="b-s">Quests in a town (+40), bounties (+25) and errands raise standing. Claim tier rewards from Quartermaster Odile in Falador.</div>';
    else {
      const idle = d.companions.filter(c => c.recruited && !c.active && !c.away);
      body = d.running.map(r => `<div class="b-card"><div class="b-h"><span>${esc(r.name)}</span><span>${r.end <= now ? '<button data-a="collect">Collect</button>' : left(r.end - now)}</span></div><div class="b-s">${esc(r.comp)}</div></div>`).join('');
      body += idle.length ? `<div class="b-s">Send: <select id="b-comp">${idle.map(c => `<option value="${c.id}">${esc(c.name)} (${Math.round(c.chance * 100)}%)</option>`).join('')}</select></div>` + d.errands.map(e => `<div class="b-card"><div class="b-h"><span>${esc(e.name)}</span><span>${left(e.mins * 60000)}</span></div><div class="b-s">${esc(e.items.map(i => i[1] + ' ' + i[0]).join(', '))} to bank · ${e.xp} ${esc(e.skill)} XP · +${e.rep} standing</div><div class="b-row"><button data-a="send" data-e="${e.id}">Send</button></div></div>`).join('')
        : '<div class="b-s">' + (d.companions.some(c => c.recruited) ? 'Every companion is busy. One that follows you cannot run errands.' : 'Recruit a Sworn Companion to run errands.') + '</div>';
    }
    el.innerHTML = `<div class="b-top"><b>Bonds</b><button data-a="close">✕</button></div><div class="b-tabs">${[['comp', 'Companions'], ['rep', 'Standing'], ['err', 'Errands']].map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="b-body">${body}</div>`;
  }
  el.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.t) { tab = b.dataset.t; render(); return; }
    const a = b.dataset.a;
    if (a === 'close') { close(); return; }
    const sel = el.querySelector('#b-comp');
    onAct(a, { comp: b.dataset.c || (sel && sel.value), errand: b.dataset.e });
    render();
  });
  function open(t) { if (t) tab = t; el.style.display = 'flex'; render(); clearInterval(timer); timer = setInterval(render, 5000); }
  function close() { el.style.display = 'none'; clearInterval(timer); }
  return { open, close, toggle: () => (el.style.display === 'none' ? open() : close()), isOpen: () => el.style.display !== 'none', render };
}
