import { UPGRADES, type UpgradeId } from '../config/game';
import type { World } from './world';

export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  t: number;
  money: number;
  earned: number;
  cash: number;
  levels: Partial<Record<UpgradeId, number>>;
  paid: Partial<Record<UpgradeId, number>>;
  piles: number[];
  displays: number[];
  rail: number;
  litter: [number, number, number][];
  player: [number, number];
  /** Real-world time of the save (ms). */
  at: number;
}

export function toSave(w: World): SaveData {
  const levels: SaveData['levels'] = {}, paid: SaveData['paid'] = {};
  for (const u of UPGRADES) {
    if (w.levels[u.id]) levels[u.id] = w.levels[u.id];
    const t = w.tiles.find((x) => x.def.id === u.id)!;
    if (t.paid > 0) paid[u.id] = Math.round(t.paid);
  }
  // trolleys out with shoppers or pushed count as parked, so none get lost
  const out = w.shoppers.list.filter((s) => s.cart).length + w.player.train.length + w.staff.list.reduce((n, s) => n + s.train.length, 0);
  return {
    v: SAVE_VERSION, t: Math.round(w.time), money: Math.floor(w.money), earned: Math.floor(w.earned), cash: Math.floor(w.cash),
    levels, paid,
    piles: w.piles.map((p) => p.stock),
    displays: w.displays.map((d) => d.stock),
    rail: w.railCarts + out,
    litter: w.litter.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2), +c.rot.toFixed(2)]),
    player: [+w.player.x.toFixed(2), +w.player.z.toFixed(2)],
    at: Date.now(),
  };
}

/** Rebuild a world from a save (upgrades re-applied in order, so their effects match a live purchase). */
export function applySave(w: World, s: SaveData): void {
  for (const u of UPGRADES) {
    const n = s.levels[u.id] ?? 0;
    const t = w.tiles.find((x) => x.def.id === u.id)!;
    for (let i = 0; i < n && w.levels[u.id] < u.costs.length; i++) w.buy(t);
    t.paid = s.paid[u.id] ?? 0;
  }
  w.events.length = 0;
  w.time = s.t;
  w.money = s.money;
  w.earned = s.earned;
  w.cash = s.cash;
  s.piles.forEach((n, i) => { if (w.piles[i]) w.piles[i].stock = n; });
  s.displays.forEach((n, i) => { if (w.displays[i]) w.displays[i].stock = n; });
  w.railCarts = s.rail;
  w.litter.length = 0;
  for (const [x, z, r] of s.litter) w.litter.push(w.newCart(x, z, r));
  w.player.x = s.player[0];
  w.player.z = s.player[1];
  // staff hired by buy() walk in from the door again: fine
}
