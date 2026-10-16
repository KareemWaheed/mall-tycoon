import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Build-time helpers: models are assembled from primitive "parts" (each a transformed, vertex-colored copy)
 * and merged into one BufferGeometry, so a whole trolley or table is one draw call with one shared material.
 */

export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  /** Unit box with soft edges (radius relative to a 1 m box; scaled parts keep it proportional). */
  rbox: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
  rboxS: new RoundedBoxGeometry(1, 1, 1, 2, 0.25),
  sph: new THREE.SphereGeometry(1, 16, 12),
  sphLo: new THREE.SphereGeometry(1, 9, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.CylinderGeometry(0.6, 1, 1, 16),
  cap: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 18),
};

/** The material every merged model uses (soft plastic / painted look). */
export const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
/** Shiny parts (chrome trolleys, glass counters). */
export const MAT_METAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75 });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** A transformed, colored copy of a primitive. Build time only (allocates). */
export function part(
  geo: THREE.BufferGeometry, color: number,
  x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1,
): THREE.BufferGeometry {
  let g = geo.clone();
  _q.setFromEuler(_e.set(rx, ry, rz));
  g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  _c.setHex(color);
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** A bar from a to b (a thin box), for wire frames and rails. */
export function bar(color: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, t = 0.03, round = false): THREE.BufferGeometry {
  const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
  const g = (round ? PRIM.cylLo : PRIM.box).clone();
  if (round) g.scale(t / 2, len, t / 2); else g.scale(t, len, t);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(_m.compose(_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q, _s.set(1, 1, 1)));
  return part(g, color);
}

/** Merge parts (position/normal/color only) into one geometry. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    col.set(g.attributes.color.array as Float32Array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** A mesh with the shared material that casts (and optionally receives) shadows. */
export function mesh(geo: THREE.BufferGeometry, receive = false, mat: THREE.Material = MAT): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = receive;
  return m;
}

/** Shade a hex color (k < 1 darker, > 1 lighter). */
export function shade(hex: number, k: number): number {
  _c.setHex(hex).multiplyScalar(k);
  return _c.getHex();
}
