import { CART_RAIL, CHECKOUT, TUNE } from '../config/game';
import { dist, type Vec2 } from './math';
import type { World } from './world';

export interface Guide { at: Vec2 | null; tip: string | null }

/**
 * What to do next. A step-by-step tutorial until the first table is bought, then only nudges:
 * shoppers stuck at an unmanned till, no trolleys left on the rail, or an upgrade the player can afford.
 */
export function guide(w: World): Guide {
  const p = w.player;
  const near = (v: Vec2, r = 2) => dist(v.x, v.z, p.x, p.z) < r;
  const front = w.shoppers.front();
  const nobodyAtTill = !w.staff.cashierReady();
  const tutorial = w.levels.red2 === 0;

  if (tutorial) {
    const red2 = w.tiles.find((t) => t.def.id === 'red2')!;
    if (w.money + red2.paid >= w.tileCost(red2)) return { at: red2.def, tip: 'اقف على المربع واشتري ترابيزة كمان' };
    if (p.train.length) return { at: { x: CART_RAIL.zone.x1 - 0.6, z: CART_RAIL.head.z }, tip: 'رجّع العربيات مكانها' };
    if (w.cash > 0 && !front) return { at: CHECKOUT.cash, tip: 'لمّ الفلوس' };
    if (front && nobodyAtTill && !p.carry.length) return { at: CHECKOUT.serve, tip: 'اقف ورا الكاشير وحاسب الزبون' };
    if (p.carry.length) {
      const d = w.displays.find((x) => x.open && x.def.product === p.carry[0])!;
      return { at: { x: d.def.x, z: d.def.z + 1.3 }, tip: 'رصّ الكوتشيات على الترابيزة' };
    }
    const pile = w.piles[0];
    if (w.roomFor('red') > 0 && pile.stock > 0) return { at: { x: pile.def.ax, z: pile.def.az }, tip: 'شيل كوتشيات من المخزن' };
    if (w.cash > 0) return { at: CHECKOUT.cash, tip: 'لمّ الفلوس' };
    return { at: null, tip: null };
  }

  if (front && nobodyAtTill && w.shoppers.queue.length >= 3 && !near(CHECKOUT.serve, 3)) return { at: CHECKOUT.serve, tip: 'الزباين مستنيين عند الكاشير!' };
  if (w.railCarts === 0 && w.litter.length >= 3 && !p.carry.length && !w.staff.get('cartboy')) {
    if (p.train.length >= Math.min(TUNE.train, w.litter.length + p.train.length) || p.train.length >= 3) return { at: { x: CART_RAIL.zone.x1 - 0.6, z: CART_RAIL.head.z }, tip: 'رجّع العربيات — من غيرها بيشتروا أقل' };
    let best = w.litter[0];
    for (const c of w.litter) if (dist(c.x, c.z, p.x, p.z) < dist(best.x, best.z, p.x, p.z)) best = c;
    return { at: best, tip: 'لمّ العربيات — من غيرها بيشتروا أقل' };
  }
  if (!p.carry.length && !p.train.length) {
    for (const t of w.tiles) {
      if (!w.tileVisible(t) || w.money + t.paid < w.tileCost(t)) continue;
      return { at: t.def, tip: near(t.def, 1.2) ? null : `معاك تشتري: ${t.def.label}` };
    }
  }
  return { at: null, tip: null };
}
