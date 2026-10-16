import * as THREE from 'three';
import { PRODUCT, type ProductId } from '../config/game';
import { PRIM, bar, merge, part, shade } from './geo';

const { box, rbox, rboxS, sph, cyl, cylLo, cone, torus } = PRIM;

// ---------- palette ----------
export const C = {
  brand: 0xff6a2b,
  navy: 0x1f2a44,
  wood: 0xe2a46b,
  woodDark: 0xb27645,
  slate: 0x3a3f4b,
  white: 0xf5f5f2,
  steel: 0xb9bec6,
  chrome: 0xdfe3e8,
  dark: 0x26282e,
  green: 0x4caf50,
  leaf: 0x3f9a4a,
  pot: 0xf08a3c,
  bill: 0x72c35a,
};

// ---------- sneakers ----------
/** One shoe, toe toward +z, sitting on y = 0. */
function shoeParts(p: ProductId, x: number, ry: number): THREE.BufferGeometry[] {
  const d = PRODUCT[p];
  const s = Math.sin(ry), c = Math.cos(ry);
  // local (lx, lz) -> world, around (x, 0)
  const P = (g: THREE.BufferGeometry, col: number, lx: number, y: number, lz: number, sx: number, sy: number, sz: number, rx = 0) =>
    part(g, col, x + lx * c + lz * s, y, -lx * s + lz * c, rx, ry, 0, sx, sy, sz);
  const out = [
    // sole + midsole stripe
    P(rbox, d.sole, 0, 0.035, 0.01, 0.17, 0.07, 0.5),
    P(box, shade(d.sole, 0.82), 0, 0.012, 0.01, 0.172, 0.022, 0.48),
    // upper: vamp, toe cap, quarter
    P(rbox, d.upper, 0, 0.12, -0.04, 0.155, 0.12, 0.34),
    P(sph, d.accent === 0xffffff ? d.sole : d.upper, 0, 0.085, 0.15, 0.08, 0.058, 0.11),
    // tongue
    P(rbox, shade(d.upper, 0.85), 0, 0.17, 0.05, 0.09, 0.07, 0.16, -0.5),
    // laces
    P(box, 0xffffff, 0, 0.19, 0.02, 0.1, 0.018, 0.022, -0.45),
    P(box, 0xffffff, 0, 0.175, 0.07, 0.1, 0.018, 0.022, -0.45),
    P(box, 0xffffff, 0, 0.16, 0.115, 0.1, 0.018, 0.022, -0.45),
    // side mark (a bolt, our own logo) on both sides
    P(box, d.accent, 0.079, 0.115, -0.02, 0.01, 0.035, 0.2, 0.45),
    P(box, d.accent, -0.079, 0.115, -0.02, 0.01, 0.035, 0.2, 0.45),
    // heel tab
    P(rbox, d.accent, 0, 0.17, -0.2, 0.06, 0.12, 0.03),
  ];
  if (d.high) {
    out.push(P(rbox, d.upper, 0, 0.24, -0.12, 0.15, 0.17, 0.17));
    out.push(P(rbox, d.accent, 0, 0.3, -0.12, 0.155, 0.04, 0.175));
  } else {
    out.push(P(rbox, shade(d.upper, 0.9), 0, 0.19, -0.13, 0.15, 0.08, 0.15));
  }
  return out;
}

const PAIR_CACHE = new Map<ProductId, THREE.BufferGeometry>();
/** A pair side by side, ~0.42 x 0.5 m (shoes are drawn oversized, so they read on a phone). */
export function pairGeo(p: ProductId): THREE.BufferGeometry {
  let g = PAIR_CACHE.get(p);
  if (!g) {
    g = merge([...shoeParts(p, -0.1, 0.06), ...shoeParts(p, 0.1, -0.04)]);
    g.scale(1.25, 1.25, 1.25);
    // side-on: toes point +x, so the profile faces the camera
    g.rotateY(Math.PI / 2);
    PAIR_CACHE.set(p, g);
  }
  return g;
}

// ---------- shoe boxes ----------
export const BOX_H = 0.2;
const BOX_CACHE = new Map<ProductId, THREE.BufferGeometry>();
/** A sneaker box, bottom at y = 0, 0.46 x 0.2 x 0.32. */
export function shoeBoxGeo(p: ProductId): THREE.BufferGeometry {
  let g = BOX_CACHE.get(p);
  if (!g) {
    const c = PRODUCT[p].box;
    g = merge([
      part(rboxS, c, 0, 0.085, 0, 0, 0, 0, 0.46, 0.17, 0.32),
      part(rboxS, shade(c, 1.18), 0, 0.17, 0, 0, 0, 0, 0.48, 0.06, 0.34),
      part(box, 0xffffff, 0, 0.09, 0.161, 0, 0, 0, 0.28, 0.05, 0.01),
      part(box, PRODUCT[p].upper, 0.19, 0.11, 0.161, 0, 0, 0, 0.05, 0.05, 0.012),
    ]);
    BOX_CACHE.set(p, g);
  }
  return g;
}

// ---------- trolley ----------
/** A shopping trolley, nose toward +z, wheels on y = 0. ~0.56 wide, 0.9 long. */
export function cartGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const W = 0.27, zb = -0.42, zf = 0.44, y0 = 0.42, y1 = 0.9, col = C.chrome, t = 0.022;
  // the basket tapers toward the nose (so they nest)
  const wAt = (z: number) => W - ((z - zb) / (zf - zb)) * 0.06;
  const yb = (z: number) => y0 + ((z - zb) / (zf - zb)) * 0.04;
  // rims
  for (const y of [y0, y1]) {
    parts.push(bar(col, -wAt(zb), y, zb, -wAt(zf), y, zf, t, true));
    parts.push(bar(col, wAt(zb), y, zb, wAt(zf), y, zf, t, true));
    parts.push(bar(col, -wAt(zf), y, zf, wAt(zf), y, zf, t, true));
    parts.push(bar(col, -wAt(zb), y, zb, wAt(zb), y, zb, t, true));
  }
  // side and front verticals
  for (let i = 0; i <= 8; i++) {
    const z = zb + ((zf - zb) * i) / 8;
    parts.push(bar(col, -wAt(z), yb(z), z, -wAt(z), y1, z, t * 0.7, true));
    parts.push(bar(col, wAt(z), yb(z), z, wAt(z), y1, z, t * 0.7, true));
  }
  for (let i = 1; i < 6; i++) {
    const x = -wAt(zf) + (2 * wAt(zf) * i) / 6;
    parts.push(bar(col, x, yb(zf), zf, x, y1, zf, t * 0.7, true));
    const xb = -wAt(zb) + (2 * wAt(zb) * i) / 6;
    parts.push(bar(col, xb, y0, zb, xb, y1, zb, t * 0.7, true));
  }
  // horizontal wires on the sides
  for (const y of [0.58, 0.74]) {
    parts.push(bar(col, -wAt(zb), y, zb, -wAt(zf), y, zf, t * 0.7, true));
    parts.push(bar(col, wAt(zb), y, zb, wAt(zf), y, zf, t * 0.7, true));
    parts.push(bar(col, -wAt(zf), y, zf, wAt(zf), y, zf, t * 0.7, true));
  }
  // basket floor
  parts.push(part(box, shade(col, 0.8), 0, y0 + 0.01, 0.01, 0, 0, 0, 0.5, 0.012, 0.84));
  // chassis, legs and wheels
  parts.push(bar(C.steel, -0.2, 0.1, zb + 0.02, -0.18, 0.1, zf - 0.04, 0.035, true));
  parts.push(bar(C.steel, 0.2, 0.1, zb + 0.02, 0.18, 0.1, zf - 0.04, 0.035, true));
  parts.push(bar(C.steel, -0.2, 0.1, zb + 0.02, -wAt(zb), y0, zb, 0.03, true));
  parts.push(bar(C.steel, 0.2, 0.1, zb + 0.02, wAt(zb), y0, zb, 0.03, true));
  parts.push(bar(C.steel, -0.18, 0.1, zf - 0.04, -wAt(zf), y0 + 0.04, zf, 0.03, true));
  parts.push(bar(C.steel, 0.18, 0.1, zf - 0.04, wAt(zf), y0 + 0.04, zf, 0.03, true));
  for (const [x, z] of [[-0.2, zb + 0.04], [0.2, zb + 0.04], [-0.18, zf - 0.06], [0.18, zf - 0.06]]) {
    parts.push(part(cyl, C.dark, x, 0.05, z, 0, 0, Math.PI / 2, 0.05, 0.035, 0.05));
  }
  // handle with a brand-colored grip
  parts.push(bar(col, -W, y1, zb, -W - 0.01, y1 + 0.1, zb - 0.12, t, true));
  parts.push(bar(col, W, y1, zb, W + 0.01, y1 + 0.1, zb - 0.12, t, true));
  parts.push(bar(C.brand, -W - 0.03, y1 + 0.1, zb - 0.12, W + 0.03, y1 + 0.1, zb - 0.12, 0.05, true));
  return merge(parts);
}

// ---------- display table ----------
export const TABLE_TOP = 0.5;
/** A low sneaker display table (3.0 x 1.7), front (+z) left plain for the label plane. */
export function tableGeo(): THREE.BufferGeometry {
  const parts = [
    part(rbox, C.wood, 0, 0.23, 0, 0, 0, 0, 3.0, 0.46, 1.7),
    part(box, C.woodDark, 0, 0.02, 0, 0, 0, 0, 2.92, 0.04, 1.62),
    part(rbox, shade(C.wood, 1.08), 0, 0.47, 0, 0, 0, 0, 3.04, 0.05, 1.74),
  ];
  // twelve dark pads
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    parts.push(part(rbox, C.slate, (c - 1.5) * 0.7, 0.505, (r - 1) * 0.5, 0, 0, 0, 0.62, 0.03, 0.44));
  }
  return merge(parts);
}

/** Slot i on a table (4 x 3), local coords. */
export function tableSlot(i: number, out: THREE.Vector3): THREE.Vector3 {
  const c = i % 4, r = Math.floor(i / 4) % 3;
  return out.set((c - 1.5) * 0.7, TABLE_TOP + 0.03, (r - 1) * 0.5);
}

// ---------- stock pile ----------
/** Wooden pallet on the floor. */
export function palletGeo(): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (const z of [-0.55, 0, 0.55]) p.push(part(box, C.woodDark, 0, 0.05, z, 0, 0, 0, 1.7, 0.1, 0.16));
  for (let i = 0; i < 7; i++) p.push(part(box, C.wood, -0.75 + i * 0.25, 0.115, 0, 0, 0, 0, 0.2, 0.03, 1.25));
  return merge(p);
}
export const PALLET_TOP = 0.13;
/** Box slot i on a pallet (3 x 2 per layer). */
export function pileSlot(i: number, out: THREE.Vector3): THREE.Vector3 {
  const per = 6, l = Math.floor(i / per), s = i % per;
  return out.set(((s % 3) - 1) * 0.5, PALLET_TOP + l * BOX_H, (Math.floor(s / 3) - 0.5) * 0.36);
}

// ---------- checkout ----------
/** Counter body along z (1.1 x 3.4), customers on -x, till side on +x. Local origin at the box centre. */
export function counterGeo(): THREE.BufferGeometry {
  const p = [
    part(rbox, C.white, 0, 0.45, 0, 0, 0, 0, 1.1, 0.9, 3.4),
    part(rbox, C.steel, 0, 0.92, 0, 0, 0, 0, 1.18, 0.05, 3.48),
    // conveyor on the customer side
    part(box, C.dark, -0.2, 0.955, -0.5, 0, 0, 0, 0.55, 0.02, 2.0),
    part(box, C.steel, -0.2, 0.96, -1.52, 0, 0, 0, 0.6, 0.04, 0.05),
    // scanner glass and scale
    part(box, 0x9fb4c8, -0.15, 0.955, 0.75, 0, 0, 0, 0.5, 0.012, 0.42),
    // register: base, drawer, screen on a post
    part(rbox, C.dark, 0.25, 1.05, 1.0, 0, 0, 0, 0.42, 0.18, 0.42),
    part(cyl, C.steel, 0.25, 1.22, 1.1, 0, 0, 0, 0.025, 0.25, 0.025),
    part(rbox, C.dark, 0.2, 1.38, 1.1, 0, 0, 0.35, 0.05, 0.22, 0.3),
    part(box, 0x5ec8ff, 0.172, 1.39, 1.1, 0, 0, 0.35, 0.01, 0.17, 0.25),
    // brand stripe on the customer face
    part(box, C.brand, -0.556, 0.75, 0, 0, 0, 0, 0.012, 0.12, 3.3),
    // lane light pole
    part(cyl, C.steel, -0.45, 1.45, -1.55, 0, 0, 0, 0.02, 1.0, 0.02),
    part(rbox, C.white, -0.45, 2.0, -1.55, 0, 0, 0, 0.16, 0.24, 0.16),
    part(box, C.brand, -0.45, 2.0, -1.55, 0, 0, 0, 0.165, 0.08, 0.165),
  ];
  // paper bag
  p.push(part(box, 0xd9b48a, 0.0, 1.13, 0.2, 0, 0.2, 0, 0.3, 0.38, 0.18));
  p.push(part(box, 0xc49c70, 0.0, 1.33, 0.2, 0, 0.2, 0, 0.31, 0.02, 0.19));
  return merge(p);
}

/** A bundle of banknotes (0.3 x 0.04 x 0.15), bottom at y = 0. */
export function billGeo(): THREE.BufferGeometry {
  return merge([
    part(rboxS, C.bill, 0, 0.022, 0, 0, 0, 0, 0.3, 0.044, 0.15),
    part(box, 0xeaf4dd, 0, 0.022, 0, 0, 0, 0, 0.07, 0.046, 0.152),
  ]);
}
export const BILL_H = 0.046;

// ---------- props ----------
export function plantGeo(scale = 1, pot = C.pot): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [
    part(cone, pot, 0, 0.22, 0, Math.PI, 0, 0, 0.26, 0.44, 0.26),
    part(cyl, shade(pot, 0.8), 0, 0.45, 0, 0, 0, 0, 0.27, 0.04, 0.27),
    part(cylLo, 0x4b3524, 0, 0.44, 0, 0, 0, 0, 0.24, 0.02, 0.24),
  ];
  // big monstera-ish leaves on stems
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.3, tilt = 0.5 + (i % 3) * 0.25, len = 0.5 + (i % 4) * 0.08;
    const lx = Math.sin(a) * len * 0.75, lz = Math.cos(a) * len * 0.75, ly = 0.75 + (i % 3) * 0.14;
    p.push(bar(0x2f6e35, 0, 0.45, 0, lx * 0.8, ly - 0.05, lz * 0.8, 0.02, true));
    p.push(part(sph, i % 2 ? C.leaf : shade(C.leaf, 1.15), lx, ly, lz, tilt * Math.cos(a), a, -tilt * Math.sin(a) * 0.3, 0.2, 0.025, 0.3));
  }
  const g = merge(p);
  g.scale(scale, scale, scale);
  return g;
}

/** Low cart rail: two posts and a bar per side. Local origin at the rail centre, along x. */
export function railGeo(len: number): THREE.BufferGeometry {
  const p: THREE.BufferGeometry[] = [];
  for (const z of [-0.36, 0.36]) {
    p.push(bar(C.steel, -len / 2, 0.5, z, len / 2, 0.5, z, 0.05, true));
    for (const x of [-len / 2, len / 2]) p.push(bar(C.steel, x, 0, z, x, 0.5, z, 0.06, true));
  }
  p.push(part(box, C.brand, -len / 2 - 0.05, 0.62, 0, 0, 0, 0, 0.12, 0.3, 0.8));
  return merge(p);
}

/** A small round sign on a post (used above the rail). */
export function posterBoardGeo(): THREE.BufferGeometry {
  return merge([part(rbox, C.wood, 0, 0.08, 0, 0, 0, 0, 0.9, 0.16, 0.5), part(box, C.white, 0, 0.9, -0.12, 0, 0, 0, 0.7, 1.4, 0.06)]);
}

/** Ring used under guide arrows and staff spots. */
export const RING = merge([part(torus, 0xffffff, 0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 0.3)]);
