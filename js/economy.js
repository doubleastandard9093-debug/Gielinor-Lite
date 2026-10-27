// Economy sinks: finite shop stock that restocks, buy prices that climb as you buy,
// wear and repair on top-tier gear, and a small death fee. Pure logic, no rendering.
import { ITEMS, itemValue, isTool, slotFor } from './items.js';

export const ECON = {
  restockTicks: 200,     // a shop line refills completely in about 2 minutes (0.6 s ticks)
  priceClimb: 0.6,       // price is up to +60% when a line is nearly sold out
  arbMargin: 1.15,       // buy price is never below 115% of what the shop pays you back
  wearPerHit: 0.25,      // % wear per hit taken on each top-tier item (400 hits = fully worn)
  wornMult: 0.7,         // fully worn gear keeps 70% of its bonuses
  repairRate: 0.002,     // repair cost = value * rate * wear%
  deathFee: 0.05, deathFeeCap: 50000
};

export function stockCap(entry) {
  if (entry.stock) return entry.stock;
  const p = entry.price;
  return p <= 10 ? 500 : p <= 100 ? 100 : p <= 1000 ? 25 : p <= 20000 ? 6 : 2;
}
const key = (shop, item) => `${shop}:${item}`;
function state(player) { return player.shopState || (player.shopState = {}); }
export function boughtOf(player, shop, item) { return state(player)[key(shop, item)] || 0; }
export function stockLeft(player, shop, entry) {
  if (isTool(entry.item)) return Infinity;
  return Math.max(0, stockCap(entry) - Math.ceil(boughtOf(player, shop, entry.item)));
}
// sellBack: what the shop pays you for one (sellPrice with your bonuses).
export function unitPrice(player, shop, entry, base, sellBack = 0) {
  const cap = stockCap(entry), b = isTool(entry.item) ? 0 : boughtOf(player, shop, entry.item);
  const climbed = Math.ceil(base * (1 + ECON.priceClimb * Math.min(1, b / cap)));
  return Math.max(climbed, Math.ceil(sellBack * ECON.arbMargin));
}
export function noteBought(player, shop, item, n = 1) { const s = state(player), k = key(shop, item); s[k] = (s[k] || 0) + n; }
// Called each game tick. Each line regains its full stock over restockTicks.
export function restockTick(player, shops) {
  const s = state(player);
  for (const k of Object.keys(s)) {
    const [shop, item] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    const entry = shops[shop] && shops[shop].stock.find(e => e.item === item);
    const cap = entry ? stockCap(entry) : 10;
    s[k] -= cap / ECON.restockTicks;
    if (s[k] <= 0) delete s[k];
  }
}
export function normalizeShopState(s) {
  const out = {};
  if (s && typeof s === 'object') for (const [k, v] of Object.entries(s)) { const n = Number(v); if (k.includes(':') && n > 0) out[k] = Math.min(9999, n); }
  return out;
}

// ---- Wear & repair ----
export function isTopTier(item) {
  const info = ITEMS[item];
  if (!info || !slotFor(item) || info.tool) return false;
  if (info.unique) return true;
  return Object.values(info.req || {}).some(l => l >= 40);
}
export function wearOf(player, item) { return (player.wear && player.wear[item]) || 0; }
export function wearMult(player, item) { return wearOf(player, item) >= 100 ? ECON.wornMult : 1; }
// Returns the names of items that just became fully worn.
export function wearOnHit(player) {
  const out = [];
  for (const item of Object.values(player.equipment || {})) {
    if (!item || !isTopTier(item)) continue;
    const w = player.wear || (player.wear = {}), was = w[item] || 0;
    w[item] = Math.min(100, was + ECON.wearPerHit);
    if (was < 100 && w[item] >= 100) out.push(item);
  }
  return out;
}
export function repairCost(player) {
  let c = 0;
  for (const [item, w] of Object.entries(player.wear || {})) c += Math.ceil(itemValue(item) * ECON.repairRate * w);
  return c;
}
export function repairAll(player) {
  const c = repairCost(player);
  if (!c) return { ok: false, msg: 'Nothing needs repairing.' };
  if (player.gold < c) return { ok: false, msg: `Repairs cost ${c} coins. You don't have enough.` };
  player.gold -= c; player.wear = {};
  return { ok: true, msg: `Your gear is repaired for ${c} coins.`, cost: c };
}
export function normalizeWear(w) {
  const out = {};
  if (w && typeof w === 'object') for (const [k, v] of Object.entries(w)) { const n = Number(v); if (ITEMS[k] && n > 0) out[k] = Math.min(100, n); }
  return out;
}
export function deathFee(player) {
  return Math.min(ECON.deathFeeCap, Math.floor((player.gold || 0) * ECON.deathFee));
}
// Audit: shop lines priced below what the shop pays back (buy-low/sell-high).
export function auditArbitrage(shops, sellPriceFn) {
  const bad = [];
  for (const [id, s] of Object.entries(shops)) for (const e of s.stock) if (!isTool(e.item) && e.price < sellPriceFn(e.item)) bad.push({ shop: id, item: e.item, price: e.price, sell: sellPriceFn(e.item) });
  return bad;
}
