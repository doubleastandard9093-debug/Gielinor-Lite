// Sails of Sarim: tavern card tables at Brineholt's Salted Lantern. Played for in-game coins only.
// "Twenty-One Tides" (blackjack-style) and "Crown & Anchor" (five-card draw, poker-style). DOM only, no textures.
export const SUITS = ['⚓', '🐚', '☠', '🧭'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const BET_MIN = 10, BET_MAX = 500;
export function newDeck(rng = Math.random) {
  const d = []; for (const s of SUITS) for (let r = 0; r < 13; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function tideTotal(hand) {
  let t = 0, aces = 0;
  for (const c of hand) { if (c.r === 12) { aces++; t += 11; } else t += c.r >= 8 ? 10 : c.r + 2; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
// Poker hand rank: [category, ...tiebreakers]. 8 straight flush ... 0 high card.
export function crownRank(hand) {
  const rs = hand.map(c => c.r).sort((a, b) => b - a), cnt = {};
  for (const r of rs) cnt[r] = (cnt[r] || 0) + 1;
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = hand.every(c => c.s === hand[0].s);
  const uniq = [...new Set(rs)];
  let straightHi = -1;
  if (uniq.length === 5) { if (rs[0] - rs[4] === 4) straightHi = rs[0]; else if (rs.join() === '12,3,2,1,0') straightHi = 3; }
  const kick = groups.map(g => g[1]);
  if (straightHi >= 0 && flush) return [8, straightHi];
  if (groups[0][0] === 4) return [7, ...kick];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...kick];
  if (flush) return [5, ...rs];
  if (straightHi >= 0) return [4, straightHi];
  if (groups[0][0] === 3) return [3, ...kick];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...kick];
  if (groups[0][0] === 2) return [1, ...kick];
  return [0, ...rs];
}
export const CROWN_NAMES = ['High card', 'A pair', 'Two pair', 'Three of a kind', 'A straight', 'A flush', 'A full house', 'Four of a kind', 'A straight flush'];
export function cmpRank(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
// Dealer draw rule: keep pairs or better; otherwise keep the top two cards.
export function dealerHolds(hand) {
  const rk = crownRank(hand);
  if (rk[0] >= 4) return [0, 1, 2, 3, 4];
  const cnt = {}; for (const c of hand) cnt[c.r] = (cnt[c.r] || 0) + 1;
  if (rk[0] >= 1) return hand.map((c, i) => cnt[c.r] > 1 ? i : -1).filter(i => i >= 0);
  return hand.map((c, i) => [c.r, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]);
}

export function createCards({ player, log, markDirty }) {
  const el = document.createElement('div');
  el.id = 'cardTable';
  el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;background:rgba(0,0,0,.55)';
  document.body.appendChild(el);
  let G = null, bet = 50;
  const card = (c, i, held) => `<span data-c="${i ?? ''}" style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:46px;height:64px;margin:3px;border-radius:6px;background:${c ? '#f4ead2' : '#5a2a1a'};color:${c && (c.s === '🐚' || c.s === '🧭') ? '#8a1a1a' : '#1a1a1a'};font:700 15px sans-serif;border:2px solid ${held ? '#e0b030' : '#2a1a10'};cursor:${i != null ? 'pointer' : 'default'}">${c ? RANKS[c.r] + '<small>' + c.s + '</small>' : '?'}</span>`;
  const btn = (id, label, on = true) => `<button data-a="${id}" ${on ? '' : 'disabled'} style="min-width:72px;min-height:44px;margin:4px;border-radius:8px;border:2px solid #c8a040;background:#3a2a1a;color:#ffe9b0;font:700 14px sans-serif;opacity:${on ? 1 : 0.4}">${label}</button>`;
  function settle(mult, msg) {
    const won = Math.round(G.bet * mult);
    if (won > 0) player.gold += G.bet + won; else if (mult === 0) player.gold += G.bet;
    const v = player.vessel; if (v && v.cards) { if (mult > 0) v.cards.won += won; else if (mult < 0) v.cards.lost += G.bet; }
    G.done = msg + (mult > 0 ? ` You win ${won} coins.` : mult === 0 ? ' Push: your stake comes back.' : ` You lose ${G.bet} coins.`);
    log(`${G.title}: ${G.done}`, mult > 0 ? 'loot' : 'game'); markDirty();
  }
  function start(kind) {
    if (player.gold < bet) { G = { kind, title: G.title, dealer: G.dealer, msg: `You need ${bet} coins to sit in.` }; render(); return; }
    player.gold -= bet; markDirty();
    const deck = newDeck();
    G = { kind, title: G.title, dealer: G.dealer, bet, deck, done: null, held: new Set() };
    if (kind === 'tides') {
      G.you = [deck.pop(), deck.pop()]; G.house = [deck.pop(), deck.pop()];
      if (tideTotal(G.you) === 21) { const h = tideTotal(G.house) === 21; settle(h ? 0 : 1.5, h ? 'Both of you hold twenty-one.' : 'Twenty-one on the deal!'); }
    } else { G.you = Array.from({ length: 5 }, () => deck.pop()); G.house = Array.from({ length: 5 }, () => deck.pop()); G.stage = 'hold'; }
    render();
  }
  function houseTides() {
    while (tideTotal(G.house) < 17) G.house.push(G.deck.pop());
    const y = tideTotal(G.you), h = tideTotal(G.house);
    if (h > 21) settle(1, `The house busts on ${h}.`); else if (y > h) settle(1, `${y} beats ${h}.`); else if (y === h) settle(0, `Both on ${y}.`); else settle(-1, `The house's ${h} beats your ${y}.`);
  }
  function act(a) {
    if (a === 'close') { close(); return; }
    if (a === 'bet-') { bet = Math.max(BET_MIN, bet - (bet > 100 ? 50 : 10)); render(); return; }
    if (a === 'bet+') { bet = Math.min(BET_MAX, bet + (bet >= 100 ? 50 : 10)); render(); return; }
    if (a === 'deal') { start(G.kind); return; }
    if (!G.you || G.done) return;
    if (G.kind === 'tides') {
      if (a === 'hit') { G.you.push(G.deck.pop()); if (tideTotal(G.you) > 21) settle(-1, `Bust on ${tideTotal(G.you)}.`); else if (tideTotal(G.you) === 21) houseTides(); }
      else if (a === 'stand') houseTides();
      else if (a === 'double' && G.you.length === 2 && player.gold >= G.bet) { player.gold -= G.bet; G.bet *= 2; G.you.push(G.deck.pop()); if (tideTotal(G.you) > 21) settle(-1, `Bust on ${tideTotal(G.you)}.`); else houseTides(); }
    } else if (a === 'draw') {
      G.you = G.you.map((c, i) => G.held.has(i) ? c : G.deck.pop());
      const keep = new Set(dealerHolds(G.house)); G.house = G.house.map((c, i) => keep.has(i) ? c : G.deck.pop());
      const y = crownRank(G.you), h = crownRank(G.house), d = cmpRank(y, h);
      settle(d > 0 ? (y[0] >= 6 ? 2 : 1) : d === 0 ? 0 : -1, `${CROWN_NAMES[y[0]]} against the house's ${CROWN_NAMES[h[0]].toLowerCase()}.`);
    }
    render();
  }
  function render() {
    if (!G) return;
    const tides = G.kind === 'tides', live = G.you && !G.done;
    let h = `<div style="background:#1e3a2a;border:3px solid #c8a040;border-radius:12px;padding:12px;max-width:min(94vw,420px);color:#ffe9b0;font:14px sans-serif;text-align:center">`;
    h += `<div style="font:700 17px serif">${G.title}</div><div style="opacity:.8;margin:2px 0 8px">${G.dealer} · coins only · you have ${player.gold} gp</div>`;
    if (G.you) {
      const showHouse = !live || false;
      h += `<div>House${tides && G.done ? ' (' + tideTotal(G.house) + ')' : ''}</div><div>${G.house.map((c, i) => card(tides && live && i > 0 ? null : (!tides && live ? null : c))).join('')}</div>`;
      h += `<div style="margin-top:6px">You${tides ? ' (' + tideTotal(G.you) + ')' : ''}${!tides && live ? ' · tap cards to hold' : ''}</div><div>${G.you.map((c, i) => card(c, !tides && live ? i : null, G.held && G.held.has(i))).join('')}</div>`;
      void showHouse;
    } else h += `<div style="margin:8px 0">${tides ? 'Get closer to 21 than the house without going over. The house stands on 17. Twenty-one on the deal pays 3 to 2.' : 'Five-card draw against the house. Hold what you like, draw once; best hand wins. A full house or better pays double.'}</div>`;
    if (G.msg) h += `<div style="color:#f0a080">${G.msg}</div>`;
    if (G.done) h += `<div style="margin:6px 0;font-weight:700">${G.done}</div>`;
    h += '<div style="margin-top:6px">';
    if (live) h += tides ? btn('hit', 'Hit') + btn('stand', 'Stand') + btn('double', 'Double', G.you.length === 2 && player.gold >= G.bet) : btn('draw', 'Draw');
    else h += btn('bet-', '−') + `<b style="display:inline-block;min-width:70px">Bet ${bet}</b>` + btn('bet+', '+') + '<br>' + btn('deal', 'Deal', player.gold >= bet);
    h += btn('close', 'Leave') + '</div></div>';
    el.innerHTML = h;
  }
  el.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-a]'); if (b && !b.disabled) { e.preventDefault(); act(b.dataset.a); return; }
    const c = e.target.closest('[data-c]'); if (c && c.dataset.c !== '' && G && G.kind === 'crown' && !G.done) { const i = +c.dataset.c; G.held.has(i) ? G.held.delete(i) : G.held.add(i); render(); }
  });
  function open(kind, dealer) { G = { kind, dealer, title: kind === 'tides' ? 'Twenty-One Tides' : 'Crown & Anchor' }; el.style.display = 'flex'; render(); }
  function close() { el.style.display = 'none'; G = null; }
  return { open, close, act, get state() { return G; }, get isOpen() { return el.style.display !== 'none'; } };
}
