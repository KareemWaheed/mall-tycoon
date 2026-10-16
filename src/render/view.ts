import * as THREE from 'three';
import { CHECKOUT, PRODUCT, TUNE, type ProductId, type UpgradeId } from '../config/game';
import { sfx } from '../audio';
import type { Shopper } from '../sim/shoppers';
import type { Worker } from '../sim/staff';
import type { Cart, GameEvent, Tile, World } from '../sim/world';
import { CharacterView, PLAYER_OUTFIT, shopperOutfit, staffOutfit } from './character';
import { Confetti, FloatText, Flyers } from './fx';
import { MAT, MAT_METAL, PRIM, merge, mesh, part } from './geo';
import {
  BILL_H, BOX_H, RING, billGeo, cartGeo, pairGeo, palletGeo, pileSlot, shoeBoxGeo, tableGeo, tableSlot,
} from './models';
import { InstancedStack, easeOutBack } from './stacks';
import { FONT, canvas, drawTile, label, rr, tex } from './textures';

const _w = new THREE.Vector3();
const PAIR_SCALE_HELD = 0.62;

// ---------- tables ----------
class DisplayView {
  readonly group = new THREE.Group();
  readonly stack: InstancedStack;
  private table: THREE.Mesh;
  private shownOpen = false;
  private openT = 1;

  constructor(scene: THREE.Scene, x: number, z: number, product: ProductId) {
    this.group.position.set(x, 0, z);
    this.table = mesh(tableGeo(), true);
    this.group.add(this.table);
    const name = { red: 'STREET', green: 'RUNNER', purple: 'LIMITED' }[product];
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4), new THREE.MeshBasicMaterial({ map: label(name, { w: 768, h: 128, fg: '#ffffff', stroke: '#5a3416' }), transparent: true }));
    lab.position.set(0, 0.24, 0.856);
    this.group.add(lab);
    this.stack = new InstancedStack(pairGeo(product), TUNE.displayCap, (i, o) => tableSlot(i, o), 0.18, x * 13 + z);
    this.group.add(this.stack.mesh);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(open: boolean, stock: number, dt: number): void {
    if (open && !this.shownOpen) { this.shownOpen = true; this.openT = 0; this.group.visible = true; }
    if (!open) { this.group.visible = false; this.shownOpen = false; return; }
    if (this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 2.2);
      this.group.scale.setScalar(Math.max(0.01, easeOutBack(this.openT)));
    }
    this.stack.set(stock);
    this.stack.update(dt);
  }
}

// ---------- stock piles ----------
class PileView {
  readonly group = new THREE.Group();
  readonly stack: InstancedStack;
  constructor(scene: THREE.Scene, x: number, z: number, product: ProductId) {
    this.group.position.set(x, 0, z);
    this.group.add(mesh(palletGeo(), true));
    this.stack = new InstancedStack(shoeBoxGeo(product), 18, (i, o) => pileSlot(i, o), 0.05, x * 7);
    this.group.add(this.stack.mesh);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: label(PRODUCT[product].name, { w: 640, h: 144, bg: hex(PRODUCT[product].box), fg: '#ffffff', rtl: true, radius: 36 }), transparent: true }));
    tag.position.set(0, 1.7, -1.37);
    this.group.add(tag);
    this.group.visible = false;
    scene.add(this.group);
  }
}

// ---------- floor tiles ----------
class TileView {
  readonly mesh: THREE.Mesh;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tx: THREE.CanvasTexture;
  private key = '';
  private popT = 0;
  constructor(scene: THREE.Scene, readonly t: Tile) {
    [this.cv, this.ctx] = canvas(256, 256);
    this.tx = tex(this.cv);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.tx, transparent: true, depthWrite: false }));
    this.mesh.position.set(t.def.x, 0.012, t.def.z);
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  update(w: World, dt: number, time: number): void {
    const vis = w.tileVisible(this.t);
    if (!vis) { this.mesh.visible = false; this.popT = 0; return; }
    this.mesh.visible = true;
    const lv = w.levels[this.t.def.id], cost = w.tileCost(this.t), max = this.t.def.costs.length;
    const remain = Math.ceil(cost - this.t.paid);
    const prog = Math.min(1, this.t.paid / cost);
    const key = `${remain}|${lv}|${Math.round(prog * 60)}`;
    if (key !== this.key) {
      this.key = key;
      drawTile(this.ctx, 256, this.t.def.icon, remain, prog, this.t.def.label, max > 1 ? `${lv + 1}/${max}` : '');
      this.tx.needsUpdate = true;
    }
    if (this.popT < 1) this.popT = Math.min(1, this.popT + dt * 2.5);
    // affordable tiles breathe
    const pulse = w.money + this.t.paid >= cost ? 1 + Math.sin(time * 5) * 0.035 : 1;
    this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(this.popT)) * pulse);
  }
}

// ---------- bubbles over shoppers ----------
const BUBBLES = new Map<string, THREE.SpriteMaterial>();
function bubble(kind: string, draw: (c: CanvasRenderingContext2D) => void): THREE.SpriteMaterial {
  let m = BUBBLES.get(kind);
  if (!m) {
    const [cv, c] = canvas(160, 160);
    rr(c, 10, 8, 140, 112, 34);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath(); c.moveTo(62, 116); c.lineTo(80, 150); c.lineTo(98, 116); c.closePath(); c.fill();
    draw(c);
    m = new THREE.SpriteMaterial({ map: tex(cv), transparent: true, depthTest: false });
    BUBBLES.set(kind, m);
  }
  return m;
}
function shoeIcon(c: CanvasRenderingContext2D, col: string, x: number, y: number, s: number): void {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-30, 10); c.lineTo(-30, -22); c.quadraticCurveTo(-28, -28, -18, -28); c.lineTo(-6, -28);
  c.lineTo(-2, -14); c.quadraticCurveTo(14, -10, 28, -2); c.quadraticCurveTo(36, 2, 34, 10); c.closePath(); c.fill();
  c.fillStyle = '#ffffff';
  rr(c, -32, 8, 68, 10, 4); c.fill();
  c.restore();
}
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const emojiFont = `56px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${FONT}`;
function wantBubble(p: ProductId): THREE.SpriteMaterial {
  return bubble(`want-${p}`, (c) => { shoeIcon(c, hex(PRODUCT[p].upper), 80, 70, 1.25); c.fillStyle = '#e53935'; c.font = `800 44px ${FONT}`; c.textAlign = 'center'; c.fillText('!', 132, 56); });
}
function emojiBubble(e: string): THREE.SpriteMaterial {
  return bubble(`e-${e}`, (c) => { c.font = emojiFont; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 80, 66); });
}

interface ShopperView { ch: CharacterView; bubble: THREE.Sprite; held: THREE.Mesh[]; happyT: number; angry: boolean }
interface CartView { m: THREE.Mesh; load: THREE.Mesh[]; seen: boolean }

export class WorldView {
  private displays: DisplayView[];
  private piles: PileView[];
  private tiles: TileView[];
  private player = new CharacterView(PLAYER_OUTFIT);
  private playerStack: THREE.Mesh[] = [];
  private shoppers = new Map<number, ShopperView>();
  private staff = new Map<Worker, { ch: CharacterView; stack: THREE.Mesh[] }>();
  private carts = new Map<number, CartView>();
  private railCarts: THREE.Mesh[] = [];
  private cartGeo = cartGeo();
  private cash: InstancedStack;
  readonly flyers: Flyers;
  readonly floats: FloatText;
  readonly confetti: Confetti;
  private arrow: THREE.Group;
  private ring: THREE.Mesh;
  /** Chevron on the floor at the player's feet, pointing at a far guide target. */
  private pointer: THREE.Mesh;
  private time = 0;
  /** Shown count of carried items (lags the sim while a box is in flight). */
  private shownCarry = 0;
  guide: { x: number; z: number } | null = null;

  constructor(private scene: THREE.Scene, private w: World) {
    this.displays = w.displays.map((d) => new DisplayView(scene, d.def.x, d.def.z, d.def.product));
    this.piles = w.piles.map((p) => new PileView(scene, p.def.x, p.def.z, p.def.product));
    this.tiles = w.tiles.map((t) => new TileView(scene, t));
    scene.add(this.player.root);
    this.cash = new InstancedStack(billGeo(), 60, (i, o) => {
      const l = Math.floor(i / 6), s = i % 6;
      return o.set(((s % 3) - 1) * 0.33, l * BILL_H, (Math.floor(s / 3) - 0.5) * 0.18);
    }, 0.1, 5);
    this.cash.mesh.position.set(CHECKOUT.cash.x, 0.01, CHECKOUT.cash.z);
    this.cash.mesh.rotation.y = 0.3;
    scene.add(this.cash.mesh);
    this.flyers = new Flyers(scene);
    this.floats = new FloatText(scene);
    this.confetti = new Confetti(scene);
    // guide: a bouncing arrow and a ring on the floor
    this.arrow = new THREE.Group();
    const ag = merge([
      part(PRIM.cone, 0xffd54f, 0, 0.3, 0, Math.PI, 0, 0, 0.42, 0.6, 0.42),
      part(PRIM.cyl, 0xffd54f, 0, 0.95, 0, 0, 0, 0, 0.14, 0.75, 0.14),
    ]);
    const am = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffa000, emissiveIntensity: 0.35, roughness: 0.4 }));
    am.castShadow = true;
    this.arrow.add(am);
    this.arrow.visible = false;
    scene.add(this.arrow);
    this.ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.9 }));
    this.ring.visible = false;
    scene.add(this.ring);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.55); sh.lineTo(0.42, 0.05); sh.lineTo(0.2, 0.05); sh.lineTo(0.2, -0.35); sh.lineTo(-0.2, -0.35); sh.lineTo(-0.2, 0.05); sh.lineTo(-0.42, 0.05); sh.closePath();
    this.pointer = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.95, depthWrite: false }));
    this.pointer.renderOrder = 3;
    this.pointer.visible = false;
    scene.add(this.pointer);
  }

  // ---------- trolleys ----------
  private cartView(c: Cart): CartView {
    let v = this.carts.get(c.id);
    if (!v) {
      const m = new THREE.Mesh(this.cartGeo, MAT_METAL);
      m.castShadow = true;
      m.position.set(c.x, 0, c.z);
      m.rotation.y = c.rot;
      this.scene.add(m);
      v = { m, load: [], seen: true };
      this.carts.set(c.id, v);
    }
    v.seen = true;
    return v;
  }

  private placeCart(c: Cart, dt: number, items: ProductId[] = []): void {
    const v = this.cartView(c), k = Math.min(1, dt * 16);
    v.m.position.x += (c.x - v.m.position.x) * k;
    v.m.position.z += (c.z - v.m.position.z) * k;
    let d = c.rot - v.m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.m.rotation.y += d * k;
    // pairs riding in the basket
    for (let i = 0; i < Math.max(items.length, v.load.length); i++) {
      if (i < items.length) {
        let m = v.load[i];
        if (!m) { m = new THREE.Mesh(pairGeo(items[i]), MAT); v.m.add(m); v.load.push(m); }
        m.geometry = pairGeo(items[i]);
        m.visible = true;
        m.scale.setScalar(0.62);
        m.position.set(((i % 2) - 0.5) * 0.24, 0.47 + Math.floor(i / 4) * 0.12, (Math.floor(i / 2) % 2 - 0.5) * 0.36);
        m.rotation.y = i * 0.7;
      } else v.load[i].visible = false;
    }
  }

  private syncCarts(dt: number): void {
    const w = this.w;
    for (const v of this.carts.values()) v.seen = false;
    for (const c of w.litter) this.placeCart(c, dt);
    for (const c of w.player.train) this.placeCart(c, dt);
    for (const s of w.staff.list) for (const c of s.train) this.placeCart(c, dt);
    for (const s of w.shoppers.list) if (s.cart) this.placeCart(s.cart, dt, s.got);
    for (const [id, v] of this.carts) if (!v.seen) { this.scene.remove(v.m); this.carts.delete(id); }
    // parked on the rail
    while (this.railCarts.length < w.railCarts) {
      const m = new THREE.Mesh(this.cartGeo, MAT_METAL);
      m.castShadow = true;
      this.scene.add(m);
      this.railCarts.push(m);
    }
    this.railCarts.forEach((m, i) => {
      m.visible = i < w.railCarts;
      const p = w.railSlot(i);
      m.position.set(p.x, 0, p.z);
      // nose toward the head of the rail (east)
      m.rotation.y = Math.PI / 2;
    });
  }

  // ---------- people ----------
  private holdStack(arr: THREE.Mesh[], parent: THREE.Object3D, items: readonly ProductId[], kind: 'box' | 'pair', sway: number): void {
    for (let i = 0; i < Math.max(items.length, arr.length); i++) {
      if (i >= items.length) { arr[i].visible = false; continue; }
      let m = arr[i];
      const geo = kind === 'box' ? shoeBoxGeo(items[i]) : pairGeo(items[i]);
      if (!m) { m = new THREE.Mesh(geo, MAT); m.castShadow = true; parent.add(m); arr.push(m); }
      m.geometry = geo;
      m.visible = true;
      if (kind === 'box') {
        m.position.set(Math.sin(i * 0.9) * 0.01 + sway * i * i * 0.004, i * BOX_H, 0);
        m.rotation.set(0, Math.sin(i * 2.1) * 0.08, 0);
        m.scale.setScalar(1);
      } else {
        m.position.set(sway * i * 0.01, i * 0.13, 0);
        m.rotation.set(0, Math.sin(i * 1.7) * 0.2, 0);
        m.scale.setScalar(PAIR_SCALE_HELD);
      }
    }
  }

  private syncShoppers(dt: number): void {
    const w = this.w, seen = new Set<number>();
    for (const s of w.shoppers.list) {
      seen.add(s.id);
      let v = this.shoppers.get(s.id);
      if (!v) {
        const ch = new CharacterView(shopperOutfit(s.tier.id, s.look));
        const b = new THREE.Sprite(emojiBubble('🙂'));
        b.scale.set(0.75, 0.75, 1);
        b.renderOrder = 15;
        b.visible = false;
        ch.root.add(b);
        b.position.set(0, 2.25, 0);
        this.scene.add(ch.root);
        v = { ch, bubble: b, held: [], happyT: 0, angry: false };
        this.shoppers.set(s.id, v);
      }
      const holding = !s.cart && s.got.length > 0 && s.state !== 'leave' ? 1 : 0;
      v.ch.update(s.x, s.z, s.rot, s.speed, dt, holding, !!s.cart);
      this.holdStack(v.held, v.ch.hands, holding ? s.got : [], 'pair', 0);
      this.bubbleFor(s, v, dt);
    }
    for (const [id, v] of this.shoppers) if (!seen.has(id)) { this.scene.remove(v.ch.root); this.shoppers.delete(id); }
  }

  private bubbleFor(s: Shopper, v: ShopperView, dt: number): void {
    const b = v.bubble;
    v.happyT = Math.max(0, v.happyT - dt);
    if (s.mood === 'angry') { b.material = emojiBubble('😡'); b.visible = s.state !== 'gone'; v.ch.fume(this.time); return; }
    if (s.mood === 'happy') {
      if (v.happyT === 0 && !v.angry) { v.happyT = 1.6; v.angry = true; }
      b.material = emojiBubble(s.byPlayer && s.tier.tip ? '🤩' : '😊');
      b.visible = v.happyT > 0;
      return;
    }
    if (s.state === 'browse' && s.mood === 'wait') { b.material = wantBubble(s.lines[s.li].product); b.visible = true; }
    else if (s.state === 'queue' && s.mood === 'wait') { b.material = emojiBubble('⏳'); b.visible = true; }
    else b.visible = false;
    // bob
    b.position.y = 2.25 + Math.sin(this.time * 4 + s.id) * 0.04;
  }

  private syncStaff(dt: number): void {
    for (const s of this.w.staff.list) {
      let v = this.staff.get(s);
      if (!v) {
        v = { ch: new CharacterView(staffOutfit(s.kind.length * 97 + 3)), stack: [] };
        this.scene.add(v.ch.root);
        this.staff.set(s, v);
      }
      v.ch.update(s.x, s.z, s.rot, s.speed, dt, s.carry.length ? 1 : 0, s.train.length > 0);
      this.holdStack(v.stack, v.ch.hands, s.carry, 'box', 0);
    }
  }

  // ---------- events ----------
  private handle(e: GameEvent): void {
    const w = this.w, p = w.player;
    switch (e.k) {
      case 'pick': {
        sfx.pick(e.n);
        const pile = this.piles[w.piles.findIndex((x) => x.def.product === e.product)];
        const from = pile.stack.topWorld(new THREE.Vector3(), 1);
        const target = () => this.player.hands.localToWorld(_w.set(0, this.shownCarry * BOX_H, 0));
        this.flyers.launch(shoeBoxGeo(e.product), from, target, 0.22, 0.6, () => { this.shownCarry = Math.min(this.shownCarry + 1, w.player.carry.length); });
        break;
      }
      case 'return':
        sfx.drop();
        this.shownCarry = Math.min(this.shownCarry, w.player.carry.length);
        break;
      case 'drop': {
        sfx.drop();
        const dv = this.displays[e.display];
        this.shownCarry = Math.min(this.shownCarry, w.player.carry.length);
        const from = this.player.hands.localToWorld(new THREE.Vector3(0, this.shownCarry * BOX_H, 0));
        const to = dv.stack.topWorld(new THREE.Vector3());
        // the pair lands, then the table count catches up (it's already counted in the sim)
        this.flyers.launch(pairGeo(e.product), from, () => to, 0.24, 0.5, undefined, 1);
        break;
      }
      case 'take':
        break;
      case 'scan':
        sfx.sell();
        break;
      case 'pay': {
        sfx.kaching();
        if (e.tip) sfx.tip();
        this.floats.show(`+${e.amount + e.tip}`, CHECKOUT.counter.x0 + 0.5, 2.0, CHECKOUT.counter.z0 + 1.6, e.tip ? '#ffd54f' : '#b9f6a4');
        break;
      }
      case 'cash': {
        if (Math.random() < 0.5) sfx.coin();
        const from = this.cash.topWorld(new THREE.Vector3());
        this.flyers.launch(billGeo(), from, () => _w.set(p.x, 1.4, p.z), 0.3, 1.0);
        break;
      }
      case 'unlock': {
        sfx.buy();
        this.confetti.burst(e.x, e.z, 60);
        if (e.id === 'cashier' || e.id === 'stocker' || e.id === 'cartboy') sfx.fanfare();
        this.unlockCb?.(e.id);
        break;
      }
      case 'cartGrab': sfx.pick(this.w.player.train.length + 2); break;
      case 'cartPark': sfx.drop(); break;
      case 'angry': sfx.angry(); break;
      case 'full':
        this.floats.show('MAX', p.x, 2.8, p.z, '#ffd54f', 0.8);
        break;
    }
  }
  unlockCb: ((id: UpgradeId) => void) | null = null;

  update(dt: number): void {
    const w = this.w, p = w.player;
    this.time += dt;
    for (const e of w.events) this.handle(e);
    w.events.length = 0;
    // tables and piles
    w.displays.forEach((d, i) => this.displays[i].update(d.open, d.stock, dt));
    w.piles.forEach((pl, i) => {
      const v = this.piles[i];
      v.group.visible = pl.open;
      v.stack.set(pl.stock);
      v.stack.update(dt);
    });
    for (const t of this.tiles) t.update(w, dt, this.time);
    // player
    this.player.update(p.x, p.z, p.rot, p.speed, dt, p.carry.length ? 1 : 0, p.train.length > 0);
    this.shownCarry = Math.min(Math.max(this.shownCarry, 0), p.carry.length);
    // anything picked but still flying isn't drawn in the hands yet
    const lean = -Math.min(1, p.speed / 5) * 0.6;
    this.holdStack(this.playerStack, this.player.hands, p.carry.slice(0, this.shownCarry), 'box', lean);
    this.syncShoppers(dt);
    this.syncStaff(dt);
    this.syncCarts(dt);
    // till money
    this.cash.set(Math.min(60, Math.ceil(w.cash / 4)));
    this.cash.update(dt);
    this.flyers.update(dt);
    this.floats.update(dt);
    this.confetti.update(dt);
    // guide arrow
    const g = this.guide;
    this.arrow.visible = this.ring.visible = !!g;
    if (g) {
      const b = Math.abs(Math.sin(this.time * 4));
      this.arrow.position.set(g.x, 1.9 + b * 0.45, g.z);
      this.arrow.rotation.y += dt * 2;
      this.ring.position.set(g.x, 0.03, g.z);
      this.ring.scale.setScalar(0.75 + Math.sin(this.time * 5) * 0.08);
    }
    const dx = g ? g.x - p.x : 0, dz = g ? g.z - p.z : 0, d = Math.hypot(dx, dz);
    this.pointer.visible = !!g && d > 3.2;
    if (this.pointer.visible) {
      const r = 1.25 + Math.sin(this.time * 6) * 0.12;
      this.pointer.position.set(p.x + (dx / d) * r, 0.02, p.z + (dz / d) * r);
      // the shape points along -z before rotation (its +y became -z)
      this.pointer.rotation.y = Math.atan2(-dx, -dz);
    }
  }

  /** The player's model (camera and HUD use it). */
  get playerRoot(): THREE.Object3D { return this.player.root; }
}
