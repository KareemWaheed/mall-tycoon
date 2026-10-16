import type { Box } from '../sim/math';
import { boxAt } from '../sim/math';

/**
 * All gameplay data for the first store (كوتشي, a sneaker shop): products, shopper tiers, layout and upgrades.
 * World units are metres. x = east (screen right), z = south (toward the camera), y = up.
 */

// ---------- products ----------
export const PRODUCTS = ['red', 'green', 'purple'] as const;
export type ProductId = (typeof PRODUCTS)[number];

export interface ProductDef { id: ProductId; name: string; price: number; upper: number; accent: number; sole: number; box: number; high: boolean }
export const PRODUCT: Record<ProductId, ProductDef> = {
  red: { id: 'red', name: 'كوتشي ستريت', price: 8, upper: 0xe0352b, accent: 0xffffff, sole: 0xf4f1ea, box: 0xe86a3a, high: true },
  green: { id: 'green', name: 'رانر', price: 15, upper: 0x7ee03a, accent: 0x1f2a1a, sole: 0xffffff, box: 0x3a9a5a, high: false },
  purple: { id: 'purple', name: 'هاي توب ليميتد', price: 26, upper: 0x8a3ae0, accent: 0xf3d8ff, sole: 0x262330, box: 0x2b2440, high: true },
};

// ---------- shoppers ----------
export type TierId = 'shaabi' | 'middle' | 'niche';
export interface TierDef {
  id: TierId;
  /** Spawn weight (0 when none of its products is on sale). */
  weight: number;
  wants: Partial<Record<ProductId, number>>;
  /** Chance to take a trolley when the cart rail has one. */
  cartChance: number;
  /** Pairs bought without / with a trolley [min, max]. */
  qty: [number, number];
  qtyCart: [number, number];
  /** Seconds of patience. */
  patience: number;
  tip: number;
  speed: number;
}
export const TIERS: Record<TierId, TierDef> = {
  shaabi: { id: 'shaabi', weight: 5, wants: { red: 1 }, cartChance: 0.75, qty: [1, 1], qtyCart: [2, 4], patience: 45, tip: 0, speed: 2.1 },
  middle: { id: 'middle', weight: 4, wants: { red: 0.35, green: 0.65 }, cartChance: 0.5, qty: [1, 2], qtyCart: [2, 3], patience: 38, tip: 1, speed: 2.4 },
  niche: { id: 'niche', weight: 2, wants: { purple: 1 }, cartChance: 0, qty: [1, 2], qtyCart: [1, 2], patience: 30, tip: 6, speed: 2.2 },
};

// ---------- tuning ----------
export const TUNE = {
  startMoney: 30,
  player: { speed: 5.2, speedStep: 0.7, carry: 4, carryStep: 2, radius: 0.38 },
  /** Seconds between items moving pile -> hands / hands -> display. */
  pickEvery: 0.11,
  dropEvery: 0.09,
  /** Checkout seconds per pair: the player / a cashier. */
  scanPlayer: 0.32,
  scanCashier: 0.85,
  /** Stock pile: cap and seconds per box restocked (level 0, then x restockStep per level). */
  pileCap: 16,
  restockEvery: 1.6,
  restockStep: 0.7,
  displayCap: 12,
  /** Seconds for a shopper to lift a pair off the display. */
  takeEvery: 0.7,
  /** Arrival interval (s) with one display open; each extra open display adds `arrivalPerDisplay` to the rate. */
  arrivalBase: 8,
  arrivalPerDisplay: 0.6,
  maxShoppers: 18,
  /** Trolleys on the rail at the start, extra per level, and the max train the player can push. */
  carts: 3,
  cartsStep: 2,
  /** Chance a shopper leaves the trolley lying about (else they return it to the rail). */
  cartAbandon: 0.85,
  train: 6,
  /** Tiles drain this fraction of the price per second while the player stands on them (min 25/s). */
  tilePayRate: 0.6,
  staff: { speed: 3.2, carry: 4, cartTrain: 4 },
};

// ---------- layout ----------
export const STORE = {
  /** Interior floor. */
  inner: { x0: -9.7, x1: 9.7, z0: -12, z1: 6 } as Box,
  door: { x0: -2.2, x1: 2.2 },
  wallT: 0.3,
  /** Where the player and staff may walk (inside + the plaza in front). */
  bounds: { x0: -12.5, x1: 12.5, z0: -11.6, z1: 13 } as Box,
  /** Where shoppers come from and go back to (off screen along the plaza). */
  spawns: [{ x: -15, z: 11.2 }, { x: 15, z: 11.2 }],
  /** Navigation grid covers this (shoppers walk to the spawns, which are outside the player bounds). */
  nav: { x0: -16, x1: 16, z0: -12, z1: 13.5 } as Box,
};

export interface PileDef { product: ProductId; x: number; z: number; /** Where you stand to pick up. */ ax: number; az: number }
export const PILES: PileDef[] = [
  { product: 'red', x: -7.2, z: -10.6, ax: -7.2, az: -9.2 },
  { product: 'green', x: -4.3, z: -10.6, ax: -4.3, az: -9.2 },
  { product: 'purple', x: -1.4, z: -10.6, ax: -1.4, az: -9.2 },
];
export const PILE_SIZE = { w: 1.8, d: 1.3 };

export interface DisplayDef { id: string; product: ProductId; x: number; z: number }
export const DISPLAYS: DisplayDef[] = [
  { id: 'red1', product: 'red', x: -5.2, z: -5.6 },
  { id: 'red2', product: 'red', x: -5.2, z: -1.6 },
  { id: 'green1', product: 'green', x: 0.4, z: -5.6 },
  { id: 'green2', product: 'green', x: 0.4, z: -1.6 },
  { id: 'purple1', product: 'purple', x: 5.8, z: -8.6 },
  { id: 'purple2', product: 'purple', x: 5.8, z: -5.0 },
];
export const DISPLAY_SIZE = { w: 3.0, d: 1.7 };
/** Shoppers stand on the south side of a display, here (x offsets). */
export const BROWSE_OFF = [-0.75, 0.75];

export const CHECKOUT = {
  counter: boxAt(6.4, 1.6, 1.1, 3.4),
  /** Where the shopper being served stands, then the queue going south and bending west. */
  queue: [
    { x: 5.25, z: 0.6 }, { x: 5.25, z: 1.7 }, { x: 5.25, z: 2.8 }, { x: 5.25, z: 3.9 }, { x: 5.25, z: 5.0 },
    { x: 4.1, z: 5.0 }, { x: 3.0, z: 5.0 }, { x: 3.0, z: 3.9 }, { x: 3.0, z: 2.8 },
  ],
  /** Where the player or the cashier stands to scan. */
  serve: { x: 7.45, z: 0.6 },
  serveR: 0.95,
  cash: { x: 7.6, z: 3.0 },
  cashR: 1.15,
};

export const CART_RAIL = {
  /** Trolleys nest from the head (east end) going west. */
  head: { x: -5.4, z: 4.4 },
  step: 0.42,
  /** Drop zone for a pushed train. */
  zone: boxAt(-7.1, 4.4, 4.4, 2.2),
  rail: boxAt(-7.6, 4.4, 4.0, 0.9),
};
/** Abandoned trolleys end up somewhere in these areas. */
export const CART_LITTER: Box[] = [boxAt(-6, 9.6, 7, 3.4), boxAt(6, 9.6, 7, 3.4), boxAt(-1.0, 3.2, 3.6, 2.0)];

/** Solid boxes that never change (walls, counter, rail). Displays and piles are added when open. */
export function staticSolids(): Box[] {
  const { inner: i, door: d, wallT: t } = STORE;
  return [
    { x0: i.x0 - t, x1: i.x1 + t, z0: i.z0 - t, z1: i.z0 },
    { x0: i.x0 - t, x1: i.x0, z0: i.z0, z1: i.z1 + t },
    { x0: i.x1, x1: i.x1 + t, z0: i.z0, z1: i.z1 + t },
    { x0: i.x0 - t, x1: d.x0, z0: i.z1, z1: i.z1 + t },
    { x0: d.x1, x1: i.x1 + t, z0: i.z1, z1: i.z1 + t },
    CHECKOUT.counter,
    CART_RAIL.rail,
    // planters on the plaza either side of the door
    boxAt(-4.4, 7.2, 2.6, 0.9), boxAt(4.4, 7.2, 2.6, 0.9),
    // the neighbouring units either side of the store (the plaza runs in front of them)
    { x0: -17, x1: i.x0 - t, z0: -13, z1: i.z1 + t }, { x0: i.x1 + t, x1: 17, z0: -13, z1: i.z1 + t },
  ];
}

// ---------- upgrades (floor tiles) ----------
export type UpgradeId =
  | 'red2' | 'green1' | 'green2' | 'purple1' | 'purple2'
  | 'carry' | 'speed' | 'carts' | 'restock'
  | 'cashier' | 'stocker' | 'cartboy';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  /** Icon key drawn on the tile (see render/tileIcons). */
  icon: 'shelf' | 'carry' | 'speed' | 'cart' | 'box' | 'cashier' | 'stocker' | 'cartboy';
  x: number; z: number;
  costs: number[];
  requires: UpgradeId[];
}

const disp = (id: string) => DISPLAYS.find((d) => d.id === id)!;
export const UPGRADES: UpgradeDef[] = [
  { id: 'red2', label: 'ترابيزة كمان', icon: 'shelf', x: disp('red2').x, z: disp('red2').z, costs: [40], requires: [] },
  { id: 'carry', label: 'شيل أكتر', icon: 'carry', x: -6.0, z: 1.6, costs: [60, 220, 650, 1600], requires: [] },
  { id: 'green1', label: 'قسم الرانر', icon: 'shelf', x: disp('green1').x, z: disp('green1').z, costs: [140], requires: ['red2'] },
  { id: 'carts', label: 'عربيات أكتر', icon: 'cart', x: -3.6, z: 2.6, costs: [90, 300, 800], requires: ['red2'] },
  { id: 'cashier', label: 'كاشير', icon: 'cashier', x: 8.3, z: -1.4, costs: [320], requires: ['green1'] },
  { id: 'speed', label: 'جري أسرع', icon: 'speed', x: 2.6, z: 1.0, costs: [150, 450, 1200], requires: ['green1'] },
  { id: 'green2', label: 'ترابيزة رانر', icon: 'shelf', x: disp('green2').x, z: disp('green2').z, costs: [380], requires: ['green1'] },
  { id: 'restock', label: 'توريد أسرع', icon: 'box', x: 1.6, z: -10.3, costs: [250, 700, 1800], requires: ['green1'] },
  { id: 'stocker', label: 'عامل رفوف', icon: 'stocker', x: -8.3, z: -7.6, costs: [700], requires: ['cashier'] },
  { id: 'purple1', label: 'قسم الليميتد', icon: 'shelf', x: disp('purple1').x, z: disp('purple1').z, costs: [900], requires: ['green2'] },
  { id: 'cartboy', label: 'عامل عربيات', icon: 'cartboy', x: -8.3, z: 1.6, costs: [1000], requires: ['stocker'] },
  { id: 'purple2', label: 'ترابيزة ليميتد', icon: 'shelf', x: disp('purple2').x, z: disp('purple2').z, costs: [1800], requires: ['purple1'] },
];
export const UPGRADE: Record<UpgradeId, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

/** Which upgrade opens a display / a product's stock pile. */
export const DISPLAY_UNLOCK: Record<string, UpgradeId | null> = { red1: null, red2: 'red2', green1: 'green1', green2: 'green2', purple1: 'purple1', purple2: 'purple2' };
export const PRODUCT_UNLOCK: Record<ProductId, UpgradeId | null> = { red: null, green: 'green1', purple: 'purple1' };
