import * as THREE from 'three';
import { CART_RAIL, CHECKOUT, STORE } from '../config/game';
import { PRIM, merge, mesh, part, shade } from './geo';
import { C, counterGeo, pairGeo, plantGeo, railGeo } from './models';
import { grass, label, logo, paving, salePoster, shutter, woodFloor } from './textures';

const WALL_H = 3.0;
/** The front and west walls are low with glass above, so they never hide the floor from the camera. */
const LOW_H = 1.0;

/** Everything that never moves. Returns the facade group (faded while the player is inside). */
export function buildStore(scene: THREE.Scene): { facade: THREE.Group; facadeMats: THREE.Material[] } {
  const { inner: i, door, wallT: t } = STORE;
  const { box, rbox } = PRIM;

  // ---------- ground ----------
  const wood = woodFloor();
  wood.repeat.set((i.x1 - i.x0) / 4, (i.z1 - i.z0) / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(i.x1 - i.x0, i.z1 - i.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
  floor.position.set((i.x0 + i.x1) / 2, 0, (i.z0 + i.z1) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  // the mall's paved ground all around (the plaza in front, service yards elsewhere)
  const pave = paving();
  pave.repeat.set(200 / 3, 200 / 3);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pave, roughness: 0.85 }));
  plaza.position.set(0, -0.01, 0);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // ---------- walls ----------
  const wallCol = 0xd5d8e0, base = C.navy, trim = C.brand;
  const parts: THREE.BufferGeometry[] = [];
  const wall = (x0: number, x1: number, z0: number, z1: number, h: number) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    parts.push(part(box, wallCol, cx, h / 2, cz, 0, 0, 0, w, h, d));
    // navy skirting and an orange top trim on the inner faces
    parts.push(part(box, base, cx, 0.16, cz, 0, 0, 0, w + 0.04, 0.32, d + 0.04));
    parts.push(part(box, trim, cx, h - 0.055, cz, 0, 0, 0, w + 0.04, 0.13, d + 0.04));
  };
  wall(i.x0 - t, i.x1 + t, i.z0 - t, i.z0, WALL_H); // back
  wall(i.x1, i.x1 + t, i.z0, i.z1 + t, WALL_H); // east
  wall(i.x0 - t, i.x0, i.z0, i.z1 + t, LOW_H); // west (low)
  wall(i.x0 - t, door.x0, i.z1, i.z1 + t, LOW_H); // front left
  wall(door.x1, i.x1 + t, i.z1, i.z1 + t, LOW_H); // front right
  const walls = mesh(merge(parts), true);
  walls.castShadow = true;
  scene.add(walls);

  // glass above the low walls, with thin mullions
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const glass = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, WALL_H - LOW_H, z1 - z0), glassMat);
    g.position.set((x0 + x1) / 2, LOW_H + (WALL_H - LOW_H) / 2, (z0 + z1) / 2);
    g.renderOrder = 2;
    scene.add(g);
  };
  glass(i.x0 - t / 2 - 0.02, i.x0 - t / 2 + 0.02, i.z0, i.z1);
  glass(i.x0, door.x0, i.z1 + t / 2 - 0.02, i.z1 + t / 2 + 0.02);
  glass(door.x1, i.x1, i.z1 + t / 2 - 0.02, i.z1 + t / 2 + 0.02);
  const mull: THREE.BufferGeometry[] = [];
  for (let x = i.x0; x <= door.x0 + 0.01; x += (door.x0 - i.x0) / 4) mull.push(part(box, C.navy, x, (LOW_H + WALL_H) / 2, i.z1 + t / 2, 0, 0, 0, 0.08, WALL_H - LOW_H, 0.1));
  for (let x = door.x1; x <= i.x1 + 0.01; x += (i.x1 - door.x1) / 4) mull.push(part(box, C.navy, x, (LOW_H + WALL_H) / 2, i.z1 + t / 2, 0, 0, 0, 0.08, WALL_H - LOW_H, 0.1));
  for (let z = i.z0; z <= i.z1 + 0.01; z += (i.z1 - i.z0) / 6) mull.push(part(box, C.navy, i.x0 - t / 2, (LOW_H + WALL_H) / 2, z, 0, 0, 0, 0.1, WALL_H - LOW_H, 0.08));
  mull.push(part(box, C.navy, (i.x0 + door.x0) / 2, WALL_H - 0.04, i.z1 + t / 2, 0, 0, 0, door.x0 - i.x0, 0.08, 0.12));
  mull.push(part(box, C.navy, (door.x1 + i.x1) / 2, WALL_H - 0.04, i.z1 + t / 2, 0, 0, 0, i.x1 - door.x1, 0.08, 0.12));
  mull.push(part(box, C.navy, i.x0 - t / 2, WALL_H - 0.04, (i.z0 + i.z1) / 2, 0, 0, 0, 0.12, 0.08, i.z1 - i.z0));
  scene.add(mesh(merge(mull)));

  // ---------- facade: brand header over the door ----------
  const facade = new THREE.Group();
  const facadeMats: THREE.Material[] = [];
  const fMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true });
  facadeMats.push(fMat);
  const header = new THREE.Mesh(merge([
    part(rbox, C.navy, 0, 3.55, 0, 0, 0, 0, 8.4, 1.3, 0.5),
    part(box, C.brand, 0, 2.86, 0.0, 0, 0, 0, 8.4, 0.12, 0.54),
    // door posts
    part(rbox, C.navy, door.x0 - 0.15, 1.5, 0, 0, 0, 0, 0.3, 3.0, 0.5),
    part(rbox, C.navy, door.x1 + 0.15, 1.5, 0, 0, 0, 0, 0.3, 3.0, 0.5),
  ]), fMat);
  header.castShadow = true;
  facade.add(header);
  const logoMat = new THREE.MeshBasicMaterial({ map: logo(1024, 256), transparent: true });
  facadeMats.push(logoMat);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), logoMat);
  sign.position.set(-0.1, 3.55, 0.26);
  facade.add(sign);
  facade.position.set(0, 0, i.z1 + t / 2);
  scene.add(facade);
  // door mat
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c3140, roughness: 1 }));
  mat.position.set(0, 0.006, i.z1 - 0.5);
  mat.receiveShadow = true;
  scene.add(mat);

  // ---------- inside decor ----------
  // big logo on the back wall
  const backLogo = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: logo(1024, 256, true), transparent: true }));
  backLogo.position.set(3.0, 2.05, i.z0 + 0.02);
  scene.add(backLogo);
  // SALE posters on the east wall
  const poster = salePoster();
  for (const z of [-9.5, -8.3]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05), new THREE.MeshBasicMaterial({ map: poster }));
    p.position.set(i.x1 - 0.02, 1.9, z);
    p.rotation.set(0, -Math.PI / 2, (z === -8.3 ? 0.12 : -0.06));
    scene.add(p);
  }
  // wall shelves with showcase sneakers on the east wall
  const shelf: THREE.BufferGeometry[] = [];
  for (const [z, y] of [[-4.6, 1.5], [-3.2, 1.5], [-4.6, 2.1], [-3.2, 2.1]]) shelf.push(part(rbox, C.dark, i.x1 - 0.25, y, z, 0, 0, 0, 0.5, 0.06, 1.1));
  scene.add(mesh(merge(shelf)));
  const showcase = [['purple', -4.6, 1.53], ['green', -3.2, 1.53], ['red', -4.6, 2.13], ['red', -3.2, 2.13]] as const;
  for (const [p, z, y] of showcase) {
    const m = mesh(pairGeo(p));
    m.position.set(i.x1 - 0.28, y, z);
    m.rotation.y = -Math.PI / 2 + 0.3;
    m.scale.setScalar(0.8);
    scene.add(m);
  }
  // stock room marking behind the piles
  const stockSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: label('المخزن', { w: 512, h: 112, bg: '#1f2a44', fg: '#ffffff', rtl: true, radius: 24 }), transparent: true }));
  stockSign.position.set(-4.3, 2.35, i.z0 + 0.02);
  scene.add(stockSign);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
  stripe.position.set(-4.3, 0.006, -9.65);
  scene.add(stripe);
  // plants
  for (const [x, z, s] of [[-9.0, -11.3, 1.25], [9.0, -11.3, 1.1], [9.0, 5.3, 1.0], [-2.9, 5.4, 0.8], [2.9, 5.4, 0.8]] as const) {
    const m = mesh(plantGeo(s));
    m.position.set(x, 0, z);
    m.rotation.y = x * 1.7;
    scene.add(m);
  }

  // ---------- checkout ----------
  const counter = mesh(counterGeo(), true);
  const cb = CHECKOUT.counter;
  counter.position.set((cb.x0 + cb.x1) / 2, 0, (cb.z0 + cb.z1) / 2);
  scene.add(counter);
  const tillSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45), new THREE.MeshBasicMaterial({ map: label('الكاشير', { w: 512, h: 144, bg: '#ff6a2b', fg: '#ffffff', rtl: true, radius: 30 }), transparent: true, side: THREE.DoubleSide }));
  tillSign.position.set((cb.x0 + cb.x1) / 2, 2.55, cb.z0 - 0.1);
  tillSign.rotation.y = -Math.PI / 2 + 0.6;
  scene.add(tillSign);
  // money mat behind the counter
  const cashMat = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9 }));
  cashMat.position.set(CHECKOUT.cash.x, 0.007, CHECKOUT.cash.z);
  scene.add(cashMat);
  // queue lane posts with a rope along the first slots
  const posts: THREE.BufferGeometry[] = [];
  for (const z of [0.1, 1.6, 3.1, 4.6]) posts.push(part(PRIM.cyl, C.chrome, 4.55, 0.45, z, 0, 0, 0, 0.04, 0.9, 0.04), part(PRIM.cyl, C.dark, 4.55, 0.02, z, 0, 0, 0, 0.16, 0.04, 0.16));
  posts.push(part(PRIM.cyl, 0xd32f2f, 4.55, 0.82, 2.35, Math.PI / 2, 0, 0, 0.02, 4.5, 0.02));
  scene.add(mesh(merge(posts)));

  // ---------- cart rail ----------
  const rb = CART_RAIL.rail;
  const rail = mesh(railGeo(rb.x1 - rb.x0));
  rail.position.set((rb.x0 + rb.x1) / 2, 0, (rb.z0 + rb.z1) / 2);
  scene.add(rail);
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(CART_RAIL.zone.x1 - CART_RAIL.zone.x0, CART_RAIL.zone.z1 - CART_RAIL.zone.z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.1, depthWrite: false }));
  zone.position.set((CART_RAIL.zone.x0 + CART_RAIL.zone.x1) / 2, 0.008, (CART_RAIL.zone.z0 + CART_RAIL.zone.z1) / 2);
  scene.add(zone);

  // ---------- plaza ----------
  const g = grass();
  g.repeat.set(1, 0.4);
  const planterMat = new THREE.MeshStandardMaterial({ map: g, roughness: 1 });
  for (const x of [-4.4, 4.4]) {
    const edge = mesh(merge([part(rbox, 0xeceff3, 0, 0.22, 0, 0, 0, 0, 2.6, 0.44, 0.9)]), true);
    edge.position.set(x, 0, 7.2);
    scene.add(edge);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7).rotateX(-Math.PI / 2), planterMat);
    top.position.set(x, 0.445, 7.2);
    top.receiveShadow = true;
    scene.add(top);
    for (const dx of [-0.7, 0.0, 0.7]) {
      const p = mesh(plantGeo(0.55, 0xeceff3));
      p.position.set(x + dx, 0.22, 7.2);
      p.rotation.y = dx * 3 + x;
      scene.add(p);
    }
  }
  // the far edge of the plaza: a grass strip with trees
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: (() => { const t2 = grass(); t2.repeat.set(20, 1); return t2; })(), roughness: 1 }));
  strip.position.set(0, 0.004, 15);
  strip.receiveShadow = true;
  scene.add(strip);
  const treeGeo = merge([
    part(PRIM.cyl, 0x7a5232, 0, 0.9, 0, 0, 0, 0, 0.12, 1.8, 0.12),
    part(PRIM.sph, 0x4a9e45, 0, 2.3, 0, 0, 0, 0, 1.0, 0.95, 1.0),
    part(PRIM.sph, 0x58b051, 0.35, 2.7, 0.2, 0, 0, 0, 0.65, 0.6, 0.65),
    part(PRIM.sph, 0x3f8f3a, -0.4, 2.15, -0.1, 0, 0, 0, 0.6, 0.55, 0.6),
  ]);
  for (let x = -22; x <= 22; x += 5.5) {
    const tr = mesh(treeGeo);
    tr.position.set(x + (x % 2), 0, 15.2);
    tr.scale.setScalar(0.9 + ((x * 7) % 3) * 0.08);
    scene.add(tr);
  }

  // ---------- neighbouring units: the rest of the mall, shuttered for now ----------
  const sh = shutter();
  sh.repeat.set(2, 1);
  const shMat = new THREE.MeshStandardMaterial({ map: sh, roughness: 0.5, metalness: 0.3 });
  const units = [
    { x: -14.2, name: 'هدوم', col: 0x8e44ad },
    { x: 14.2, name: 'إلكترونيات', col: 0x16a085 },
  ];
  for (const u of units) {
    const body = mesh(merge([
      // only the shop fronts: the units are a few metres deep, roofed in grey
      part(box, 0xc9ccd4, 0, WALL_H / 2 + 0.3, 3.3, 0, 0, 0, 8.4, WALL_H + 0.6, 6.0),
      part(box, 0x9aa3b2, 0, WALL_H + 0.62, 3.3, 0, 0, 0, 8.5, 0.05, 6.1),
      part(box, shade(u.col, 0.9), 0, 3.45, 6.1, 0, 0, 0, 8.4, 0.9, 0.5),
      part(box, C.brand, 0, 2.95, 6.1, 0, 0, 0, 8.4, 0.1, 0.52),
    ]), true);
    body.position.x = u.x;
    scene.add(body);
    const door2 = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), shMat);
    door2.position.set(u.x, 1.4, 6.31);
    scene.add(door2);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.8), new THREE.MeshBasicMaterial({ map: label(u.name, { w: 640, h: 128, fg: '#ffffff', rtl: true }), transparent: true }));
    nm.position.set(u.x, 3.45, 6.36);
    scene.add(nm);
    const soon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.75), new THREE.MeshBasicMaterial({ map: label('قريباً', { w: 448, h: 128, bg: '#ffd54f', fg: '#1f2a44', rtl: true, radius: 28 }), transparent: true }));
    soon.position.set(u.x, 1.6, 6.34);
    soon.rotation.z = 0.06;
    scene.add(soon);
  }
  return { facade, facadeMats };
}
