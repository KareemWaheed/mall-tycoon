import {
  CART_LITTER, CART_RAIL, CHECKOUT, DISPLAY_SIZE, DISPLAY_UNLOCK, DISPLAYS, PILE_SIZE, PILES, PRODUCT, PRODUCT_UNLOCK,
  STORE, TUNE, UPGRADES, staticSolids,
  type DisplayDef, type PileDef, type ProductId, type UpgradeDef, type UpgradeId,
} from '../config/game';
import { boxAt, dist, grow, inBox, resolveCircle, turnToward, type Box, type Vec2 } from './math';
import { NavGrid } from './nav';
import { Rng } from './rng';
import { Shoppers } from './shoppers';
import { Staff } from './staff';

export interface Pile { def: PileDef; open: boolean; stock: number; t: number }
export interface Display { def: DisplayDef; open: boolean; stock: number; box: Box }
export interface Cart { id: number; x: number; z: number; rot: number }

export type GameEvent =
  | { k: 'pick'; product: ProductId; n: number }
  | { k: 'drop'; product: ProductId; display: number }
  | { k: 'return'; product: ProductId }
  | { k: 'take'; display: number; shopper: number }
  | { k: 'scan'; shopper: number; product: ProductId }
  | { k: 'pay'; amount: number; tip: number; x: number; z: number }
  | { k: 'cash'; amount: number }
  | { k: 'unlock'; id: UpgradeId; level: number; x: number; z: number }
  | { k: 'cartGrab'; id: number }
  | { k: 'cartPark' }
  | { k: 'angry'; shopper: number }
  | { k: 'full' };

export interface Input { x: number; z: number }

export class Player {
  x = -2.6; z = -2.4; rot = Math.PI; speed = 0;
  readonly carry: ProductId[] = [];
  /** Trolleys pushed (nested) in front of the player. */
  train: Cart[] = [];
  trainRot = Math.PI;
  pickT = 0; dropT = 0; parkT = 0;
}

/** A tile's live state. */
export interface Tile { def: UpgradeDef; paid: number }

export class World {
  time = 0;
  money = TUNE.startMoney;
  /** Total earned (stats / pacing). */
  earned = 0;
  readonly rng: Rng;
  readonly player = new Player();
  readonly piles: Pile[] = PILES.map((def) => ({ def, open: PRODUCT_UNLOCK[def.product] === null, stock: 0, t: 0 }));
  readonly displays: Display[] = DISPLAYS.map((def) => ({ def, open: DISPLAY_UNLOCK[def.id] === null, stock: 0, box: boxAt(def.x, def.z, DISPLAY_SIZE.w, DISPLAY_SIZE.d) }));
  readonly levels = Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>;
  readonly tiles: Tile[] = UPGRADES.map((def) => ({ def, paid: 0 }));
  /** Trolleys parked on the rail, and lying about. */
  railCarts = TUNE.carts;
  readonly litter: Cart[] = [];
  private cartId = 1;
  /** Money waiting at the till. */
  cash = 0;
  solids: Box[] = [];
  readonly nav = new NavGrid(STORE.nav);
  readonly shoppers: Shoppers;
  readonly staff: Staff;
  /** Drained by the renderer every frame. */
  events: GameEvent[] = [];
  /** Who is scanning at the till this frame. */
  server: 'player' | 'cashier' | null = null;

  constructor(seed = 1) {
    this.rng = new Rng(seed);
    for (const p of this.piles) if (p.open) p.stock = TUNE.pileCap;
    for (const d of this.displays) if (d.open) d.stock = 6;
    this.shoppers = new Shoppers(this);
    this.staff = new Staff(this);
    this.rebuildSolids();
  }

  newCart(x: number, z: number, rot: number): Cart { return { id: this.cartId++, x, z, rot }; }

  rebuildSolids(): void {
    const s = staticSolids();
    for (const d of this.displays) if (d.open) s.push(d.box);
    for (const p of this.piles) if (p.open) s.push(boxAt(p.def.x, p.def.z, PILE_SIZE.w, PILE_SIZE.d));
    this.solids = s;
    this.nav.build(s);
  }

  // ---------- derived ----------
  carryCap(): number { return TUNE.player.carry + this.levels.carry * TUNE.player.carryStep; }
  playerSpeed(): number { return TUNE.player.speed + this.levels.speed * TUNE.player.speedStep; }
  restockEvery(): number { return TUNE.restockEvery * Math.pow(TUNE.restockStep, this.levels.restock); }
  totalCarts(): number { return TUNE.carts + this.levels.carts * TUNE.cartsStep; }
  /** Free space on the open tables of a product. */
  roomFor(prod: ProductId): number {
    let n = 0;
    for (const d of this.displays) if (d.open && d.def.product === prod) n += TUNE.displayCap - d.stock;
    return n;
  }
  openDisplays(): number { return this.displays.filter((d) => d.open).length; }
  productOpen(p: ProductId): boolean { return this.piles.some((x) => x.open && x.def.product === p); }

  /** Visible tiles: requirements met and not maxed. */
  tileVisible(t: Tile): boolean {
    if (this.levels[t.def.id] >= t.def.costs.length) return false;
    return t.def.requires.every((r) => this.levels[r] > 0);
  }
  tileCost(t: Tile): number { return t.def.costs[this.levels[t.def.id]]; }

  /** Where the trolley at index i of the rail sits. */
  railSlot(i: number): Vec2 { return { x: CART_RAIL.head.x - i * CART_RAIL.step, z: CART_RAIL.head.z }; }

  // ---------- tick ----------
  tick(dt: number, input: Input): void {
    this.time += dt;
    this.restock(dt);
    this.movePlayer(dt, input);
    this.playerActions(dt);
    this.staff.tick(dt);
    this.checkout(dt);
    this.shoppers.tick(dt);
  }

  private restock(dt: number): void {
    const every = this.restockEvery();
    for (const p of this.piles) {
      if (!p.open || p.stock >= TUNE.pileCap) { p.t = 0; continue; }
      p.t += dt;
      while (p.t >= every && p.stock < TUNE.pileCap) { p.t -= every; p.stock++; }
    }
  }

  private movePlayer(dt: number, input: Input): void {
    const p = this.player;
    const m = Math.min(1, Math.hypot(input.x, input.z));
    // pushing a long train is a little slower
    const sp = this.playerSpeed() * (1 - p.train.length * 0.025);
    if (m > 0.05) {
      const k = (sp * m) / Math.hypot(input.x, input.z);
      const ox = p.x, oz = p.z;
      p.x += input.x * k * dt;
      p.z += input.z * k * dt;
      resolveCircle(p, TUNE.player.radius, this.solids, STORE.bounds);
      p.speed = Math.hypot(p.x - ox, p.z - oz) / dt;
      p.rot = turnToward(p.rot, input.x, input.z, 14, dt);
    } else p.speed = 0;
    // the nested train swings round a little behind the player's turn
    p.trainRot = turnToward(p.trainRot, Math.sin(p.rot), Math.cos(p.rot), 7, dt);
    this.layTrain(p.train, p.x, p.z, p.trainRot);
  }

  /** Nested trolleys in a straight line in front of whoever pushes them. */
  layTrain(train: Cart[], x: number, z: number, rot: number): void {
    const sx = Math.sin(rot), sz = Math.cos(rot);
    for (let i = 0; i < train.length; i++) {
      const d = 0.8 + i * CART_RAIL.step;
      train[i].x = x + sx * d; train[i].z = z + sz * d; train[i].rot = rot;
    }
  }

  private playerActions(dt: number): void {
    const p = this.player;
    // ---- trolleys: pick up any lying within reach (hands must be free)
    if (!p.carry.length && p.train.length < TUNE.train) {
      for (let i = this.litter.length - 1; i >= 0; i--) {
        const c = this.litter[i];
        // reach: the player, or the front of the train already pushed
        const fx = p.train.length ? p.train[p.train.length - 1].x : p.x, fz = p.train.length ? p.train[p.train.length - 1].z : p.z;
        if (dist(c.x, c.z, p.x, p.z) < 1.05 || dist(c.x, c.z, fx, fz) < 0.9) {
          this.litter.splice(i, 1);
          p.train.push(c);
          this.events.push({ k: 'cartGrab', id: c.id });
          if (p.train.length >= TUNE.train) break;
        }
      }
    }
    // ---- park the train at the rail
    if (p.train.length && inBox(CART_RAIL.zone, p.x, p.z)) {
      p.parkT += dt;
      while (p.parkT >= 0.12 && p.train.length) {
        p.parkT -= 0.12;
        p.train.pop();
        this.railCarts++;
        this.events.push({ k: 'cartPark' });
      }
    } else p.parkT = 0;
    // ---- pick from a stock pile (not while pushing trolleys), only as many as its tables have room for;
    //      surplus in hands goes back on the pile
    const cap = this.carryCap();
    let picking = false;
    if (!p.train.length) {
      for (const pile of this.piles) {
        if (!pile.open || dist(pile.def.ax, pile.def.az, p.x, p.z) > 1.35) continue;
        const prod = pile.def.product, room = this.roomFor(prod) - p.carry.filter((c) => c === prod).length;
        if (room > 0 && pile.stock > 0 && p.carry.length < cap) {
          picking = true;
          p.pickT += dt;
          while (p.pickT >= TUNE.pickEvery && pile.stock > 0 && p.carry.length < cap && this.roomFor(prod) > p.carry.filter((c) => c === prod).length) {
            p.pickT -= TUNE.pickEvery;
            pile.stock--;
            p.carry.push(prod);
            this.events.push({ k: 'pick', product: prod, n: p.carry.length });
            if (p.carry.length >= cap) this.events.push({ k: 'full' });
          }
        } else if (room < 0 && pile.stock < TUNE.pileCap) {
          picking = true;
          p.pickT += dt;
          while (p.pickT >= TUNE.pickEvery && pile.stock < TUNE.pileCap && this.roomFor(prod) < p.carry.filter((c) => c === prod).length) {
            p.pickT -= TUNE.pickEvery;
            p.carry.splice(p.carry.lastIndexOf(prod), 1);
            pile.stock++;
            this.events.push({ k: 'return', product: prod });
          }
        }
        break;
      }
    }
    if (!picking) p.pickT = Math.min(p.pickT, TUNE.pickEvery * 0.6);
    // ---- drop onto a display
    let dropping = false;
    if (p.carry.length) {
      for (let di = 0; di < this.displays.length; di++) {
        const d = this.displays[di];
        if (!d.open || d.stock >= TUNE.displayCap) continue;
        if (!inBox(grow(d.box, 1.0), p.x, p.z) || !p.carry.includes(d.def.product)) continue;
        dropping = true;
        p.dropT += dt;
        while (p.dropT >= TUNE.dropEvery && d.stock < TUNE.displayCap) {
          p.dropT -= TUNE.dropEvery;
          const i = p.carry.lastIndexOf(d.def.product);
          if (i < 0) break;
          p.carry.splice(i, 1);
          d.stock++;
          this.events.push({ k: 'drop', product: d.def.product, display: di });
        }
        break;
      }
    }
    if (!dropping) p.dropT = Math.min(p.dropT, TUNE.dropEvery * 0.6);
    // ---- collect the till money
    if (this.cash > 0 && dist(CHECKOUT.cash.x, CHECKOUT.cash.z, p.x, p.z) < CHECKOUT.cashR) {
      const take = Math.min(this.cash, Math.max(40, this.cash * 3) * dt);
      const n = Math.ceil(take - 1e-9);
      const amt = Math.min(this.cash, n);
      this.cash -= amt;
      this.money += amt;
      this.events.push({ k: 'cash', amount: amt });
    }
    // ---- tiles: pay while standing (nearly) still on one
    if (p.speed < 0.6) {
      for (const t of this.tiles) {
        if (!this.tileVisible(t)) continue;
        if (Math.abs(p.x - t.def.x) > 0.85 || Math.abs(p.z - t.def.z) > 0.85) continue;
        const cost = this.tileCost(t);
        const pay = Math.min(this.money, cost - t.paid, Math.max(25, cost * TUNE.tilePayRate) * dt);
        if (pay > 0) { t.paid += pay; this.money -= pay; }
        if (t.paid >= cost - 1e-6) this.buy(t);
        break;
      }
    }
  }

  /** Complete an upgrade level and apply it. */
  buy(t: Tile): void {
    const id = t.def.id;
    t.paid = 0;
    const lv = ++this.levels[id];
    this.events.push({ k: 'unlock', id, level: lv, x: t.def.x, z: t.def.z });
    let solids = false;
    for (const d of this.displays) if (DISPLAY_UNLOCK[d.def.id] === id && !d.open) { d.open = true; solids = true; }
    for (const p of this.piles) if (PRODUCT_UNLOCK[p.def.product] === id && !p.open) { p.open = true; p.stock = TUNE.pileCap; solids = true; }
    if (id === 'carts') this.railCarts += TUNE.cartsStep;
    if (id === 'cashier' || id === 'stocker' || id === 'cartboy') this.staff.hire(id);
    if (solids) {
      this.rebuildSolids();
      // don't leave the player inside a new table
      resolveCircle(this.player, TUNE.player.radius, this.solids, STORE.bounds);
    }
  }

  // ---------- checkout ----------
  private scanT = 0;
  private checkout(dt: number): void {
    const p = this.player;
    const playerThere = dist(p.x, p.z, CHECKOUT.serve.x, CHECKOUT.serve.z) < CHECKOUT.serveR && !p.train.length;
    this.server = playerThere ? 'player' : this.staff.cashierReady() ? 'cashier' : null;
    const s = this.shoppers.front();
    if (!s || !this.server) { this.scanT = 0; return; }
    if (s.byPlayer === undefined) s.byPlayer = false;
    if (this.server === 'player') s.byPlayer = true;
    const every = this.server === 'player' ? TUNE.scanPlayer : TUNE.scanCashier;
    this.scanT += dt;
    while (this.scanT >= every && s.scanned < s.got.length) {
      this.scanT -= every;
      this.events.push({ k: 'scan', shopper: s.id, product: s.got[s.scanned] });
      s.scanned++;
    }
    if (s.scanned >= s.got.length) {
      this.scanT = 0;
      let amount = 0;
      for (const it of s.got) amount += PRODUCT[it].price;
      const tip = s.byPlayer ? s.tier.tip * s.got.length : 0;
      this.cash += amount + tip;
      this.earned += amount + tip;
      this.events.push({ k: 'pay', amount, tip, x: s.x, z: s.z });
      this.shoppers.paid(s);
    }
  }

  /** A random spot for an abandoned trolley. */
  litterSpot(): Vec2 {
    const b = this.rng.pick(CART_LITTER);
    return { x: this.rng.range(b.x0, b.x1), z: this.rng.range(b.z0, b.z1) };
  }
}
