import * as THREE from 'three';
import type { TierId } from '../config/game';
import { Rng } from '../sim/rng';
import { MAT, PRIM, merge, part, shade } from './geo';

export type Top = 'tee' | 'hoodie' | 'galabeya' | 'suit' | 'polo' | 'dress' | 'turtle';
export type Hat = 'none' | 'cap' | 'beanie' | 'hijab' | 'kufi';
export type Hair = 'short' | 'long' | 'bun' | 'bald' | 'curly';

export interface Outfit {
  skin: number; hair: number; hairStyle: Hair;
  top: Top; topColor: number; trim: number;
  pants: number; shoes: number;
  hat: Hat; hatColor: number;
  glasses: boolean; bag: number | null;
  /** Height scale. */
  h: number;
}

const SKINS = [0xf1c7a3, 0xe0ac84, 0xc98e66, 0xa8714d, 0x8a5a3c];
const HAIRS = [0x1d1612, 0x2e2018, 0x4a3020, 0x6b4428, 0x2a2a2a];

/** A random outfit for a shopper of this tier (stable for a given seed). */
export function shopperOutfit(tier: TierId, seed: number): Outfit {
  const r = new Rng(seed);
  const base: Outfit = {
    skin: r.pick(SKINS), hair: r.pick(HAIRS), hairStyle: r.pick(['short', 'short', 'curly', 'long', 'bald'] as Hair[]),
    top: 'tee', topColor: 0xffffff, trim: 0xffffff, pants: 0x3a4a6a, shoes: 0x2a2a2a,
    hat: 'none', hatColor: 0, glasses: false, bag: null, h: r.range(0.94, 1.06),
  };
  if (tier === 'shaabi') {
    const kind = r.int(4);
    if (kind === 0) {
      // galabeya, sometimes a kufi
      Object.assign(base, { top: 'galabeya', topColor: r.pick([0xe9e3d3, 0x8f8a7c, 0x5b6b7a, 0x9a7b5a, 0xd8d0bd]), hat: r.chance(0.5) ? 'kufi' : 'none', hatColor: 0xf3f1ea, shoes: 0x5a3a22 });
    } else if (kind === 1) {
      // woman in abaya / long dress with hijab
      Object.assign(base, { top: 'dress', topColor: r.pick([0x2b2b33, 0x5a3d5c, 0x3b4f6b, 0x6b4a3a]), hat: 'hijab', hatColor: r.pick([0xd9a6b5, 0xe8d4b0, 0x7a8fb8, 0x2b2b33, 0xa8c3a0]), hairStyle: 'bald' });
    } else {
      // track suit / football shirt
      const c = r.pick([0xc62828, 0x1565c0, 0x2e7d32, 0x212121, 0xf9a825]);
      Object.assign(base, { top: r.chance(0.5) ? 'hoodie' : 'tee', topColor: c, trim: 0xffffff, pants: r.pick([0x23262e, 0x2f3b55, shade(c, 0.6)]), shoes: 0xf2f2f2 });
    }
  } else if (tier === 'middle') {
    const female = r.chance(0.45);
    Object.assign(base, {
      top: r.pick(['tee', 'polo', 'hoodie', 'tee'] as Top[]),
      topColor: r.pick([0xf5f5f5, 0x90caf9, 0xffcc80, 0xa5d6a7, 0xef9a9a, 0xb39ddb, 0x37474f]),
      pants: r.pick([0x3b5b8c, 0x2f4470, 0xc8b28a, 0x3a3a3a]),
      shoes: r.pick([0xffffff, 0xe0352b, 0x222222]),
      hat: female ? (r.chance(0.5) ? 'hijab' : 'none') : r.chance(0.25) ? 'cap' : 'none',
      hatColor: r.pick([0xf06292, 0xffffff, 0x263238, 0xffb74d, 0x81c784]),
      hairStyle: female ? r.pick(['long', 'bun'] as Hair[]) : base.hairStyle === 'long' ? 'short' : base.hairStyle,
      glasses: r.chance(0.2),
    });
  } else {
    // niche: collectors and creatives
    Object.assign(base, {
      top: r.pick(['turtle', 'hoodie', 'tee'] as Top[]),
      topColor: r.pick([0x1b1b1f, 0x2b2b2b, 0xd8cbb0, 0x4a5a3a, 0x7a2e2e]),
      pants: r.pick([0x1b1b1f, 0xd8cbb0, 0x3a3a3a]),
      shoes: r.pick([0x8a3ae0, 0xffffff, 0x1b1b1f]),
      hat: r.pick(['beanie', 'none', 'cap'] as Hat[]),
      hatColor: r.pick([0xff7043, 0x1b1b1f, 0xd8cbb0]),
      hairStyle: r.pick(['curly', 'bun', 'short', 'long'] as Hair[]),
      glasses: r.chance(0.6),
      bag: r.pick([0xe8dcc0, 0x1b1b1f]),
    });
  }
  return base;
}

export const PLAYER_OUTFIT: Outfit = {
  skin: 0xf1c7a3, hair: 0xc9632a, hairStyle: 'short', top: 'polo', topColor: 0x4f8fe6, trim: 0x2f5fb0,
  pants: 0x23252b, shoes: 0x111111, hat: 'none', hatColor: 0, glasses: false, bag: null, h: 1.04,
};

/** Store staff wear the brand: orange polo, navy trousers, a cap. */
export function staffOutfit(seed: number): Outfit {
  const r = new Rng(seed);
  return {
    skin: r.pick(SKINS), hair: r.pick(HAIRS), hairStyle: 'short', top: 'polo', topColor: 0xff6a2b, trim: 0x1f2a44,
    pants: 0x1f2a44, shoes: 0x111111, hat: 'cap', hatColor: 0x1f2a44, glasses: false, bag: null, h: 1,
  };
}

interface CharGeo { torso: THREE.BufferGeometry; leg: THREE.BufferGeometry; arm: THREE.BufferGeometry; long: boolean }
const CACHE = new Map<string, CharGeo>();

function charGeo(o: Outfit): CharGeo {
  const key = JSON.stringify(o);
  let g = CACHE.get(key);
  if (g) return g;
  const { rbox, sph, cyl, cap, cone, box } = PRIM;
  const long = o.top === 'galabeya' || o.top === 'dress';
  const t: THREE.BufferGeometry[] = [
    // neck and head
    part(cyl, o.skin, 0, 1.5, 0, 0, 0, 0, 0.055, 0.12, 0.055),
    part(sph, o.skin, 0, 1.66, 0, 0, 0, 0, 0.135, 0.15, 0.14),
    // eyes and brows
    part(sph, 0x1d1a1a, -0.045, 1.68, 0.122, 0, 0, 0, 0.017, 0.022, 0.012),
    part(sph, 0x1d1a1a, 0.045, 1.68, 0.122, 0, 0, 0, 0.017, 0.022, 0.012),
    part(box, shade(o.hair, 0.9), -0.047, 1.715, 0.126, 0, 0, 0.12, 0.045, 0.01, 0.01),
    part(box, shade(o.hair, 0.9), 0.047, 1.715, 0.126, 0, 0, -0.12, 0.045, 0.01, 0.01),
    part(sph, shade(o.skin, 0.9), 0, 1.64, 0.14, 0, 0, 0, 0.018, 0.024, 0.02),
    part(sph, o.skin, -0.135, 1.66, 0, 0, 0, 0, 0.022, 0.04, 0.03),
    part(sph, o.skin, 0.135, 1.66, 0, 0, 0, 0, 0.022, 0.04, 0.03),
  ];
  // hair
  if (o.hat !== 'hijab') {
    if (o.hairStyle === 'short') t.push(part(sph, o.hair, 0, 1.71, -0.02, -0.2, 0, 0, 0.142, 0.115, 0.14));
    else if (o.hairStyle === 'curly') t.push(part(sph, o.hair, 0, 1.73, -0.015, 0, 0, 0, 0.16, 0.12, 0.155));
    else if (o.hairStyle === 'long') t.push(part(sph, o.hair, 0, 1.69, -0.03, 0, 0, 0, 0.15, 0.13, 0.15), part(rbox, o.hair, 0, 1.52, -0.08, 0, 0, 0, 0.26, 0.3, 0.12));
    else if (o.hairStyle === 'bun') t.push(part(sph, o.hair, 0, 1.71, -0.02, -0.2, 0, 0, 0.145, 0.12, 0.145), part(sph, o.hair, 0, 1.79, -0.1, 0, 0, 0, 0.07, 0.07, 0.07));
  }
  // headwear
  if (o.hat === 'cap') t.push(part(sph, o.hatColor, 0, 1.73, -0.01, 0, 0, 0, 0.145, 0.1, 0.145), part(box, o.hatColor, 0, 1.745, 0.15, -0.12, 0, 0, 0.2, 0.018, 0.14));
  else if (o.hat === 'beanie') t.push(part(sph, o.hatColor, 0, 1.75, -0.01, 0, 0, 0, 0.15, 0.12, 0.15), part(cyl, shade(o.hatColor, 0.85), 0, 1.7, -0.005, 0, 0, 0, 0.152, 0.04, 0.152));
  else if (o.hat === 'kufi') t.push(part(cyl, o.hatColor, 0, 1.76, -0.01, 0, 0, 0, 0.13, 0.08, 0.13));
  else if (o.hat === 'hijab') t.push(
    part(sph, o.hatColor, 0, 1.68, -0.035, 0, 0, 0, 0.165, 0.175, 0.16),
    part(cone, o.hatColor, 0, 1.42, -0.01, 0, 0, 0, 0.2, 0.2, 0.17),
  );
  if (o.glasses) t.push(
    part(box, 0x111111, 0, 1.685, 0.138, 0, 0, 0, 0.2, 0.012, 0.01),
    part(rbox, 0x222222, -0.05, 1.68, 0.14, 0, 0, 0, 0.07, 0.05, 0.012),
    part(rbox, 0x222222, 0.05, 1.68, 0.14, 0, 0, 0, 0.07, 0.05, 0.012),
  );
  // body
  if (long) {
    // a long robe down to the ankles (legs swing underneath, only the feet show)
    t.push(part(cone, o.topColor, 0, 0.78, 0, 0, 0, 0, 0.24, 1.36, 0.18));
    t.push(part(rbox, o.topColor, 0, 1.3, 0, 0, 0, 0, 0.4, 0.34, 0.24));
    if (o.top === 'galabeya') t.push(part(box, shade(o.topColor, 0.82), 0, 1.36, 0.122, 0, 0, 0, 0.04, 0.2, 0.01));
  } else {
    t.push(part(rbox, o.topColor, 0, 1.2, 0, 0, 0, 0, 0.4, 0.58, 0.24));
    t.push(part(rbox, o.pants, 0, 0.9, 0, 0, 0, 0, 0.38, 0.14, 0.23));
    if (o.top === 'polo') t.push(part(box, o.trim, 0, 1.47, 0.0, 0, 0, 0, 0.26, 0.04, 0.2), part(box, o.trim, 0, 1.38, 0.121, 0, 0, 0, 0.05, 0.14, 0.01));
    if (o.top === 'hoodie') t.push(part(sph, shade(o.topColor, 0.9), 0, 1.5, -0.1, 0, 0, 0, 0.17, 0.1, 0.1), part(box, shade(o.topColor, 0.85), 0, 1.08, 0.122, 0, 0, 0, 0.22, 0.12, 0.01));
    if (o.top === 'turtle') t.push(part(cyl, o.topColor, 0, 1.51, 0, 0, 0, 0, 0.075, 0.08, 0.075));
    if (o.top === 'suit') t.push(part(box, 0xffffff, 0, 1.35, 0.121, 0, 0, 0, 0.1, 0.22, 0.01), part(box, 0xb71c1c, 0, 1.3, 0.125, 0, 0, 0, 0.035, 0.2, 0.01));
    // staff name badge
    if (o.topColor === 0xff6a2b) t.push(part(box, 0xffffff, 0.1, 1.36, 0.122, 0, 0, 0, 0.08, 0.04, 0.01));
  }
  if (o.bag !== null) t.push(part(box, o.bag, 0.22, 0.98, 0.0, 0, 0, 0.12, 0.05, 0.36, 0.3), part(box, o.bag, 0.08, 1.3, 0, 0, 0, 0.55, 0.02, 0.62, 0.03));
  // (the unit capsule is 2 m tall overall, so a y-scale of k gives a limb 2k long)
  const leg = long
    ? merge([part(cap, o.topColor, 0, -0.4, 0, 0, 0, 0, 0.14, 0.38, 0.14), part(rbox, o.shoes, 0, -0.8, 0.04, 0, 0, 0, 0.12, 0.08, 0.24)])
    : merge([part(cap, o.pants, 0, -0.4, 0, 0, 0, 0, 0.16, 0.4, 0.16), part(rbox, o.shoes, 0, -0.8, 0.04, 0, 0, 0, 0.13, 0.09, 0.26)]);
  const sleeve = o.top === 'tee' || o.top === 'polo';
  const arm = merge([
    part(cap, o.topColor, 0, sleeve ? -0.1 : -0.25, 0, 0, 0, 0, 0.13, sleeve ? 0.1 : 0.25, 0.13),
    ...(sleeve ? [part(cap, o.skin, 0, -0.32, 0, 0, 0, 0, 0.1, 0.2, 0.1)] : []),
    part(sph, o.skin, 0, -0.54, 0, 0, 0, 0, 0.055, 0.06, 0.055),
  ]);
  g = { torso: merge(t), leg, arm, long };
  CACHE.set(key, g);
  return g;
}

/** How far the walk cycle advances per metre (radians). Tuned so feet don't slide. */
const STRIDE = 4.6;

/** A walking, carrying person. Pose comes from sim state each frame. */
export class CharacterView {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  /** Things held in front (stacks, items) go here; it follows the body bob. */
  readonly hands = new THREE.Group();
  private legL: THREE.Mesh; private legR: THREE.Mesh;
  private armL: THREE.Mesh; private armR: THREE.Mesh;
  private phase = 0;
  private spd = 0;
  private hold = 0;

  constructor(o: Outfit) {
    const g = charGeo(o);
    this.root.add(this.body);
    this.root.scale.setScalar(o.h);
    const torso = new THREE.Mesh(g.torso, MAT);
    torso.castShadow = true;
    this.body.add(torso, this.hands);
    const limb = (geo: THREE.BufferGeometry, x: number, y: number) => {
      const m = new THREE.Mesh(geo, MAT);
      m.castShadow = true;
      m.position.set(x, y, 0);
      this.body.add(m);
      return m;
    };
    this.legL = limb(g.leg, -0.1, 0.86); this.legR = limb(g.leg, 0.1, 0.86);
    this.armL = limb(g.arm, -0.25, 1.44); this.armR = limb(g.arm, 0.25, 1.44);
    this.hands.position.set(0, 1.0, 0.36);
  }

  /** Raise both arms (cheer). Call after update(). */
  cheer(time: number): void {
    this.armL.rotation.x = this.armR.rotation.x = -2.8;
    this.armL.rotation.z = 0.3 + Math.sin(time * 12) * 0.2;
    this.armR.rotation.z = -0.3 - Math.sin(time * 12) * 0.2;
  }

  /** Stomp and shake fists (angry). Call after update(). */
  fume(time: number): void {
    this.armL.rotation.x = this.armR.rotation.x = -0.5 + Math.sin(time * 18) * 0.25;
    this.body.rotation.z = Math.sin(time * 9) * 0.06;
  }

  /** Pose from sim state. `hold` 0..1: arms forward to carry; `push`: hands on a trolley handle. */
  update(x: number, z: number, rot: number, speed: number, dt: number, hold: number, push = false): void {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = rot;
    this.spd += (speed - this.spd) * Math.min(1, dt * 20);
    this.phase += this.spd * dt * STRIDE;
    const s = Math.min(1, this.spd / 2.6), sw = Math.sin(this.phase) * 0.6 * s;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.hold += (Math.max(hold, push ? 0.75 : 0) - this.hold) * Math.min(1, dt * 10);
    const swing = sw * 0.9 * (1 - this.hold), h = -1.35 * this.hold;
    this.armL.rotation.x = h - swing;
    this.armR.rotation.x = h + swing;
    this.armL.rotation.z = this.armR.rotation.z = 0;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * s;
    this.body.rotation.z = Math.sin(this.phase) * 0.04 * s;
    this.body.rotation.x = 0.08 * s;
  }
}
