import { CART_RAIL, CHECKOUT, TUNE, type ProductId } from '../config/game';
import { dist, inBox, moveToward, type Vec2 } from './math';
import type { Cart, World } from './world';

export type StaffKind = 'cashier' | 'stocker' | 'cartboy';

export interface Worker {
  kind: StaffKind;
  x: number; z: number; rot: number; speed: number;
  path: Vec2[];
  state: string;
  carry: ProductId[];
  train: Cart[];
  /** Target display / pile / cart id. */
  target: number;
  t: number;
}

const DOOR = { x: 0, z: 7.5 };
/** Where the cashier waits while the player is at the till. */
const CASHIER_ASIDE = { x: 8.7, z: 0.2 };
/** Inside the rail zone, where a train gets parked. */
const RAIL_DROP = { x: -5.0, z: 3.5 };

export class Staff {
  readonly list: Worker[] = [];

  constructor(private w: World) {}

  hire(kind: StaffKind): void {
    if (this.list.some((s) => s.kind === kind)) return;
    this.list.push({ kind, x: DOOR.x, z: DOOR.z, rot: Math.PI, speed: 0, path: [], state: 'arrive', carry: [], train: [], target: -1, t: 0 });
  }

  get(kind: StaffKind): Worker | undefined { return this.list.find((s) => s.kind === kind); }

  /** The cashier is at the till and can scan. */
  cashierReady(): boolean {
    const c = this.get('cashier');
    return !!c && c.state === 'till';
  }

  private go(s: Worker, x: number, z: number): void { s.path = this.w.nav.path(s.x, s.z, x, z); }

  private follow(s: Worker, dt: number): boolean {
    while (s.path.length) {
      const t = s.path[0];
      if (moveToward(s, t.x, t.z, TUNE.staff.speed, dt, 0.06)) { s.path.shift(); continue; }
      return false;
    }
    s.speed = 0;
    return true;
  }

  tick(dt: number): void {
    for (const s of this.list) {
      if (s.kind === 'cashier') this.cashier(s, dt);
      else if (s.kind === 'stocker') this.stocker(s, dt);
      else this.cartboy(s, dt);
    }
  }

  private cashier(s: Worker, dt: number): void {
    const p = this.w.player;
    const playerThere = dist(p.x, p.z, CHECKOUT.serve.x, CHECKOUT.serve.z) < CHECKOUT.serveR + 0.3;
    const want = playerThere ? CASHIER_ASIDE : CHECKOUT.serve;
    if (s.state === 'arrive' || dist(s.x, s.z, want.x, want.z) > 0.1) {
      if (s.state !== 'walk' || s.target !== (playerThere ? 1 : 0)) {
        s.state = 'walk';
        s.target = playerThere ? 1 : 0;
        // short hops behind the counter go straight, the first walk in uses the grid
        if (dist(s.x, s.z, want.x, want.z) < 2) s.path = [{ x: want.x, z: want.z }]; else this.go(s, want.x, want.z);
      }
      if (this.follow(s, dt)) s.state = playerThere ? 'aside' : 'till';
    } else {
      s.state = playerThere ? 'aside' : 'till';
      s.speed = 0;
      // face the customers (west)
      s.rot += (-Math.PI / 2 - s.rot) * Math.min(1, dt * 8);
    }
  }

  private stocker(s: Worker, dt: number): void {
    const w = this.w;
    switch (s.state) {
      case 'arrive':
      case 'idle': {
        s.speed = 0;
        // the emptiest open display whose product has stock waiting
        let best = -1, ratio = 0.75;
        for (let i = 0; i < w.displays.length; i++) {
          const d = w.displays[i];
          if (!d.open) continue;
          const pile = w.piles.find((p) => p.def.product === d.def.product);
          if (!pile || !pile.open || pile.stock <= 0) continue;
          const r = d.stock / TUNE.displayCap;
          if (r < ratio) { ratio = r; best = i; }
        }
        if (best < 0) {
          if (s.state === 'arrive') { s.state = 'home'; this.go(s, -8.4, -8.8); }
          break;
        }
        s.target = best;
        const pile = w.piles.find((p) => p.def.product === w.displays[best].def.product)!;
        s.state = 'toPile';
        this.go(s, pile.def.ax, pile.def.az);
        break;
      }
      case 'home':
        if (this.follow(s, dt)) s.state = 'idle';
        break;
      case 'toPile':
        if (this.follow(s, dt)) { s.state = 'pick'; s.t = 0; }
        break;
      case 'pick': {
        const d = w.displays[s.target];
        const pile = w.piles.find((p) => p.def.product === d.def.product)!;
        const want = Math.min(TUNE.staff.carry, TUNE.displayCap - d.stock);
        s.t += dt;
        if (s.t >= TUNE.pickEvery * 2.5 && pile.stock > 0 && s.carry.length < want) { s.t = 0; pile.stock--; s.carry.push(pile.def.product); }
        if (s.carry.length >= want || (pile.stock <= 0 && s.carry.length)) {
          s.state = 'toDisplay';
          this.go(s, d.def.x, d.def.z - 1.4);
        } else if (pile.stock <= 0 && !s.carry.length && s.t > 2) s.state = 'idle';
        break;
      }
      case 'toDisplay':
        if (this.follow(s, dt)) { s.state = 'drop'; s.t = 0; }
        break;
      case 'drop': {
        const d = w.displays[s.target];
        s.rot += (0 - s.rot) * Math.min(1, dt * 8);
        s.t += dt;
        if (s.t >= TUNE.dropEvery * 2.5) {
          s.t = 0;
          if (s.carry.length && d.stock < TUNE.displayCap) {
            s.carry.pop(); d.stock++;
            w.events.push({ k: 'drop', product: d.def.product, display: s.target });
          } else {
            // anything left over goes back on the pile next trip
            s.state = s.carry.length ? 'return' : 'idle';
            if (s.carry.length) { const pile = w.piles.find((p) => p.def.product === d.def.product)!; this.go(s, pile.def.ax, pile.def.az); }
          }
        }
        break;
      }
      case 'return':
        if (this.follow(s, dt)) {
          const pile = w.piles.find((p) => p.def.product === s.carry[0]);
          if (pile) pile.stock = Math.min(TUNE.pileCap, pile.stock + s.carry.length);
          s.carry.length = 0;
          s.state = 'idle';
        }
        break;
    }
  }

  private cartboy(s: Worker, dt: number): void {
    const w = this.w;
    w.layTrain(s.train, s.x, s.z, s.rot);
    switch (s.state) {
      case 'arrive':
      case 'idle': {
        s.speed = 0;
        const c = this.nearestLitter(s);
        if (c) { s.state = 'toCart'; s.target = c.id; this.go(s, c.x, c.z); }
        else if (s.train.length) { s.state = 'toRail'; this.go(s, RAIL_DROP.x, RAIL_DROP.z); }
        else if (s.state === 'arrive') { s.state = 'home'; this.go(s, -3.6, 4.6); }
        break;
      }
      case 'home':
        if (this.follow(s, dt)) s.state = 'idle';
        break;
      case 'toCart': {
        const i = w.litter.findIndex((c) => c.id === s.target);
        if (i < 0) { s.state = 'idle'; break; }
        const c = w.litter[i];
        const reach = s.train.length ? s.train[s.train.length - 1] : s;
        if (dist(reach.x, reach.z, c.x, c.z) < 1.0 || this.follow(s, dt)) {
          w.litter.splice(i, 1);
          s.train.push(c);
          const next = s.train.length < TUNE.staff.cartTrain ? this.nearestLitter(s) : null;
          if (next) { s.target = next.id; this.go(s, next.x, next.z); }
          else { s.state = 'toRail'; this.go(s, RAIL_DROP.x, RAIL_DROP.z); }
        }
        break;
      }
      case 'toRail':
        if (this.follow(s, dt) || inBox(CART_RAIL.zone, s.x, s.z)) {
          s.path.length = 0;
          s.speed = 0;
          s.t += dt;
          if (s.t >= 0.15) {
            s.t = 0;
            if (s.train.length) { s.train.pop(); w.railCarts++; w.events.push({ k: 'cartPark' }); }
            else s.state = 'idle';
          }
        }
        break;
    }
  }

  private nearestLitter(s: Worker): Cart | null {
    let best: Cart | null = null, bd = Infinity;
    for (const c of this.w.litter) {
      const d = dist(c.x, c.z, s.x, s.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
