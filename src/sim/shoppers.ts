import { BROWSE_OFF, CART_RAIL, CHECKOUT, STORE, TIERS, TUNE, type ProductId, type TierDef } from '../config/game';
import { moveToward, type Vec2 } from './math';
import type { Cart, World } from './world';

export type ShopperState = 'toCart' | 'toDisplay' | 'browse' | 'toQueue' | 'queue' | 'leave' | 'gone';

export interface Shopper {
  id: number;
  tier: TierDef;
  /** Outfit seed. */
  look: number;
  x: number; z: number; rot: number; speed: number;
  state: ShopperState;
  path: Vec2[];
  wantCart: boolean;
  cart: Cart | null;
  lines: { product: ProductId; qty: number }[];
  li: number;
  got: ProductId[];
  scanned: number;
  patience: number;
  patienceMax: number;
  display: number;
  slot: number;
  takeT: number;
  /** Queue position (index into CHECKOUT.queue, clamped). */
  qi: number;
  arrived: boolean;
  byPlayer?: boolean;
  mood: 'ok' | 'wait' | 'angry' | 'happy';
  /** Leaving: 0 = dropping the trolley, 1 = heading out. */
  leg: number;
  exit: Vec2;
  /** Seconds since spawning (animation offsets). */
  age: number;
}

export class Shoppers {
  readonly list: Shopper[] = [];
  readonly queue: Shopper[] = [];
  private nextId = 1;
  private spawnT = 3;

  constructor(private w: World) {}

  front(): Shopper | null {
    const s = this.queue[0];
    return s && s.arrived && s.qi === 0 ? s : null;
  }

  private interval(): number {
    return TUNE.arrivalBase / (1 + TUNE.arrivalPerDisplay * (this.w.openDisplays() - 1));
  }

  tick(dt: number): void {
    const w = this.w;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = this.interval() * w.rng.range(0.6, 1.4);
      if (this.list.length < TUNE.maxShoppers) this.spawn();
    }
    for (const s of this.list) { s.age += dt; this.step(s, dt); }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].state === 'gone') this.list.splice(i, 1);
    // queue slots follow the line
    for (let i = 0; i < this.queue.length; i++) {
      const s = this.queue[i], qi = Math.min(i, CHECKOUT.queue.length - 1);
      if (s.qi === qi) continue;
      s.qi = qi;
      const slot = CHECKOUT.queue[qi];
      if (s.state === 'queue') { s.arrived = false; s.path = [{ x: slot.x, z: slot.z }]; }
      else if (s.path.length) s.path[s.path.length - 1] = { x: slot.x, z: slot.z };
    }
  }

  private spawn(): void {
    const w = this.w, rng = w.rng;
    const tiers = Object.values(TIERS).filter((t) => Object.keys(t.wants).some((p) => w.productOpen(p as ProductId)));
    let tot = 0;
    for (const t of tiers) tot += t.weight;
    let r = rng.next() * tot, tier = tiers[0];
    for (const t of tiers) { r -= t.weight; if (r <= 0) { tier = t; break; } }
    const from = rng.pick(STORE.spawns);
    const s: Shopper = {
      id: this.nextId++, tier, look: rng.int(1 << 30),
      x: from.x, z: from.z + rng.range(-0.8, 0.8), rot: from.x < 0 ? Math.PI / 2 : -Math.PI / 2, speed: 0,
      state: 'toDisplay', path: [], wantCart: rng.chance(tier.cartChance), cart: null,
      lines: [], li: 0, got: [], scanned: 0,
      patience: tier.patience, patienceMax: tier.patience,
      display: -1, slot: 0, takeT: 0, qi: 0, arrived: false, mood: 'ok', leg: 0,
      exit: rng.pick(STORE.spawns), age: 0,
    };
    if (s.wantCart && w.railCarts > 0) {
      s.state = 'toCart';
      s.path = w.nav.path(s.x, s.z, CART_RAIL.head.x + 0.85, CART_RAIL.head.z);
    } else {
      this.plan(s, false);
      this.goDisplay(s);
    }
    this.list.push(s);
  }

  /** Pick what to buy (more with a trolley, sometimes two products). */
  private plan(s: Shopper, cart: boolean): void {
    const w = this.w, rng = w.rng;
    const [a, b] = cart ? s.tier.qtyCart : s.tier.qty;
    const qty = a + rng.int(b - a + 1);
    const open = (Object.entries(s.tier.wants) as [ProductId, number][]).filter(([p]) => w.productOpen(p));
    const pick = (): ProductId => {
      let tot = 0;
      for (const [, wt] of open) tot += wt;
      let r = rng.next() * tot;
      for (const [p, wt] of open) { r -= wt; if (r <= 0) return p; }
      return open[0][0];
    };
    const first = pick();
    if (qty >= 2 && open.length > 1 && rng.chance(0.4)) {
      const second = open.find(([p]) => p !== first)![0];
      const q1 = Math.ceil(qty / 2);
      s.lines = [{ product: first, qty: q1 }, { product: second, qty: qty - q1 }];
    } else s.lines = [{ product: first, qty }];
    s.li = 0;
  }

  /** Head for the best open display of the current line's product. */
  private goDisplay(s: Shopper): void {
    const w = this.w, want = s.lines[s.li].product;
    let best = -1, score = Infinity;
    for (let i = 0; i < w.displays.length; i++) {
      const d = w.displays[i];
      if (!d.open || d.def.product !== want) continue;
      const crowd = this.list.filter((o) => o !== s && o.display === i && (o.state === 'browse' || o.state === 'toDisplay')).length;
      const sc = (d.stock > 0 ? 0 : 6) + crowd + w.rng.next() * 0.5;
      if (sc < score) { score = sc; best = i; }
    }
    s.display = best;
    if (best < 0) { this.leave(s, true); return; }
    const d = w.displays[best];
    const taken = this.list.filter((o) => o !== s && o.display === best && o.state !== 'leave').map((o) => o.slot);
    s.slot = taken.filter((x) => x === 0).length <= taken.filter((x) => x === 1).length ? 0 : 1;
    const jitter = (taken.length > 1 ? w.rng.range(-0.25, 0.25) : 0);
    s.state = 'toDisplay';
    s.path = w.nav.path(s.x, s.z, d.def.x + BROWSE_OFF[s.slot] + jitter, d.def.z + 1.35 + (taken.length > 1 ? 0.35 : 0));
  }

  private follow(s: Shopper, dt: number, speed = s.tier.speed): boolean {
    while (s.path.length) {
      const t = s.path[0];
      if (moveToward(s, t.x, t.z, speed, dt, 0.06)) { s.path.shift(); continue; }
      return false;
    }
    s.speed = 0;
    return true;
  }

  private step(s: Shopper, dt: number): void {
    const w = this.w;
    switch (s.state) {
      case 'toCart':
        if (this.follow(s, dt)) {
          if (w.railCarts > 0) {
            w.railCarts--;
            const h = w.railSlot(0);
            s.cart = w.newCart(h.x, h.z, s.rot);
          }
          this.plan(s, !!s.cart);
          this.goDisplay(s);
        }
        break;
      case 'toDisplay':
        if (this.follow(s, dt)) { s.state = 'browse'; s.takeT = 0; }
        break;
      case 'browse': {
        s.rot += (Math.PI - s.rot) * Math.min(1, dt * 8);
        const d = w.displays[s.display], line = s.lines[s.li];
        if (d.stock > 0) {
          s.mood = 'ok';
          s.takeT += dt;
          if (s.takeT >= TUNE.takeEvery) {
            s.takeT = 0;
            d.stock--;
            s.got.push(line.product);
            line.qty--;
            w.events.push({ k: 'take', display: s.display, shopper: s.id });
            if (line.qty <= 0) {
              if (++s.li < s.lines.length) this.goDisplay(s);
              else this.joinQueue(s);
            }
          }
        } else {
          s.mood = 'wait';
          s.patience -= dt;
          // another display of the same product has stock: go there
          const other = w.displays.findIndex((o, i) => i !== s.display && o.open && o.def.product === line.product && o.stock > 0);
          if (other >= 0 && s.takeT <= 0) { s.takeT = -1; this.goDisplay(s); }
          if (s.patience <= 0) {
            // settle for what's in the basket, or walk out
            if (s.got.length) this.joinQueue(s); else this.leave(s, true);
          }
        }
        break;
      }
      case 'toQueue':
      case 'queue': {
        const slot = CHECKOUT.queue[s.qi];
        if (!s.arrived) {
          if (s.path.length === 0) s.path = [{ x: slot.x, z: slot.z }];
          if (this.follow(s, dt)) { s.arrived = true; s.state = 'queue'; }
        } else {
          s.rot += (Math.PI - s.rot) * Math.min(1, dt * 8);
          s.speed = 0;
        }
        const served = s.qi === 0 && s.arrived && w.server;
        if (!served) {
          s.patience -= dt * 0.55;
          s.mood = s.patience < s.patienceMax * 0.35 ? 'wait' : 'ok';
          if (s.patience <= 0) this.leave(s, true);
        }
        break;
      }
      case 'leave':
        if (this.follow(s, dt, s.tier.speed * 1.1)) {
          if (s.leg === 0 && s.cart) {
            const c = s.cart;
            s.cart = null;
            if (dist2(s.x, s.z, CART_RAIL.head.x + 0.85, CART_RAIL.head.z) < 0.5) w.railCarts++;
            else { c.rot = s.rot + w.rng.range(-0.6, 0.6); w.litter.push(c); }
            s.leg = 1;
            s.path = w.nav.path(s.x, s.z, s.exit.x, s.exit.z);
          } else s.state = 'gone';
        }
        break;
      case 'gone':
        break;
    }
    // the trolley rolls in front (beside them while they browse or queue)
    if (s.cart) {
      const c = s.cart;
      if (s.state === 'browse' || s.state === 'queue') {
        const tx = s.x - 0.8, tz = s.z + 0.15;
        c.x += (tx - c.x) * Math.min(1, dt * 6); c.z += (tz - c.z) * Math.min(1, dt * 6);
        c.rot += (Math.PI - c.rot) * Math.min(1, dt * 6);
      } else {
        c.x = s.x + Math.sin(s.rot) * 0.8; c.z = s.z + Math.cos(s.rot) * 0.8; c.rot = s.rot;
      }
    }
  }

  private joinQueue(s: Shopper): void {
    this.queue.push(s);
    s.qi = Math.min(this.queue.length - 1, CHECKOUT.queue.length - 1);
    s.state = 'toQueue';
    s.arrived = false;
    s.display = -1;
    const slot = CHECKOUT.queue[s.qi];
    s.path = this.w.nav.path(s.x, s.z, slot.x, slot.z);
    // patience refills a bit on reaching the till
    s.patience = Math.max(s.patience, s.patienceMax * 0.8);
  }

  /** Paid at the till. */
  paid(s: Shopper): void {
    s.mood = 'happy';
    this.leave(s, false);
  }

  private leave(s: Shopper, angry: boolean): void {
    const w = this.w;
    const qi = this.queue.indexOf(s);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (angry) { s.mood = 'angry'; s.got.length = 0; w.events.push({ k: 'angry', shopper: s.id }); }
    s.state = 'leave';
    s.display = -1;
    s.arrived = false;
    if (s.cart) {
      s.leg = 0;
      const back = !w.rng.chance(TUNE.cartAbandon);
      const to = back ? { x: CART_RAIL.head.x + 0.85, z: CART_RAIL.head.z } : w.litterSpot();
      s.path = w.nav.path(s.x, s.z, to.x, to.z);
    } else {
      s.leg = 1;
      s.path = w.nav.path(s.x, s.z, s.exit.x, s.exit.z);
    }
  }
}

const dist2 = (ax: number, az: number, bx: number, bz: number) => (ax - bx) ** 2 + (az - bz) ** 2;
