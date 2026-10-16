import { CART_RAIL, CHECKOUT, TUNE } from '../config/game';
import { dist, inBox, type Vec2 } from './math';
import type { Input, World } from './world';

/**
 * A reasonably efficient player, used by the pacing simulator (and the debug autopilot).
 * Picks a goal a few times a second and walks the nav path to it.
 */
export class Bot {
  private goal: Vec2 | null = null;
  private path: Vec2[] = [];
  private think = 0;
  task = '';

  constructor(private w: World) {}

  private set(task: string, x: number, z: number): void {
    if (this.task === task && this.goal && dist(this.goal.x, this.goal.z, x, z) < 0.2) return;
    this.task = task;
    this.goal = { x, z };
    this.path = this.w.nav.path(this.w.player.x, this.w.player.z, x, z);
  }

  private decide(): void {
    const w = this.w, p = w.player;
    const cashierOk = w.staff.cashierReady();
    if (p.train.length) {
      const more = w.litter.length && p.train.length < TUNE.train;
      if (more) { const c = nearest(w.litter, p.x, p.z)!; return this.set('carts', c.x, c.z); }
      return this.set('park', CART_RAIL.zone.x1 - 0.4, CART_RAIL.head.z - 0.7);
    }
    const front = w.shoppers.front();
    const starving = w.shoppers.list.some((s) => s.state === 'browse' && w.displays[s.display]?.stock === 0);
    if (front && !cashierOk && !p.carry.length && (!starving || w.shoppers.queue.length >= 3)) {
      return this.set('serve', CHECKOUT.serve.x, CHECKOUT.serve.z);
    }
    if (p.carry.length) {
      let best = -1, low = Infinity;
      w.displays.forEach((d, i) => {
        if (!d.open || d.stock >= TUNE.displayCap || !p.carry.includes(d.def.product)) return;
        if (d.stock < low) { low = d.stock; best = i; }
      });
      if (best >= 0) { const d = w.displays[best]; return this.set(`drop${best}`, d.def.x, d.def.z + 1.25); }
    }
    if (w.cash >= 40 || (w.cash > 0 && !front)) return this.set('cash', CHECKOUT.cash.x, CHECKOUT.cash.z);
    for (const t of w.tiles) {
      if (!w.tileVisible(t)) continue;
      if (w.money + t.paid >= w.tileCost(t)) return this.set(`tile-${t.def.id}`, t.def.x, t.def.z);
    }
    if (p.carry.length < w.carryCap()) {
      // keep picking while standing at a pile that still has stock
      // (only as many as the tables have room for)
      const need = (prod: string) => w.displays.reduce((n, d) => n + (d.open && d.def.product === prod ? TUNE.displayCap - d.stock : 0), 0) - p.carry.filter((c) => c === prod).length;
      if (p.carry.length && this.task.startsWith('pile') && w.piles.some((x) => x.open && x.stock > 0 && need(x.def.product) > 0 && dist(x.def.ax, x.def.az, p.x, p.z) < 1.3)) return;
      // fill the emptiest display whose pile has stock
      let best = -1, low = TUNE.displayCap * 0.6;
      w.displays.forEach((d, i) => {
        const pile = w.piles.find((x) => x.def.product === d.def.product)!;
        if (!d.open || !pile.open || pile.stock <= 0 || need(d.def.product) <= 0) return;
        if (d.stock < low) { low = d.stock; best = i; }
      });
      if (best >= 0) {
        const pile = w.piles.find((x) => x.def.product === w.displays[best].def.product)!;
        return this.set(`pile-${pile.def.product}`, pile.def.ax, pile.def.az);
      }
    }
    // trolleys need free hands
    if (w.litter.length && w.railCarts < 2 && !p.carry.length) { const c = nearest(w.litter, p.x, p.z)!; return this.set('carts', c.x, c.z); }
    if (!cashierOk) return this.set('serve', CHECKOUT.serve.x, CHECKOUT.serve.z);
    return this.set('cash', CHECKOUT.cash.x, CHECKOUT.cash.z);
  }

  input(dt: number): Input {
    this.think -= dt;
    if (this.think <= 0) { this.think = 0.25; this.decide(); }
    const p = this.w.player;
    while (this.path.length) {
      const t = this.path[0];
      const d = dist(t.x, t.z, p.x, p.z);
      if (d < (this.path.length > 1 ? 0.3 : 0.15)) { this.path.shift(); continue; }
      return { x: (t.x - p.x) / d, z: (t.z - p.z) / d };
    }
    // in the rail zone, keep still while the train parks
    if (this.task === 'park' && !inBox(CART_RAIL.zone, p.x, p.z) && this.goal) return { x: this.goal.x - p.x, z: this.goal.z - p.z };
    return { x: 0, z: 0 };
  }
}

function nearest<T extends Vec2>(arr: readonly T[], x: number, z: number): T | null {
  let best: T | null = null, bd = Infinity;
  for (const a of arr) { const d = dist(a.x, a.z, x, z); if (d < bd) { bd = d; best = a; } }
  return best;
}
