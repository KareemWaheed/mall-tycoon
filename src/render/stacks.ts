import * as THREE from 'three';
import { MAT } from './geo';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

export const easeOutBack = (x: number) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

export type SlotFn = (i: number, out: THREE.Vector3) => THREE.Vector3;

/**
 * A table's pairs / a pile's boxes / the till's cash as ONE InstancedMesh (one draw call).
 * New items pop in with an overshoot; matrices are only rewritten while something animates.
 */
export class InstancedStack {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private popT: Float32Array;
  private rot: Float32Array;
  private animating = false;

  constructor(geo: THREE.BufferGeometry, readonly max: number, private slot: SlotFn, rotJitter = 0, seed = 1) {
    this.mesh = new THREE.InstancedMesh(geo, MAT, max);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.popT = new Float32Array(max).fill(1);
    this.rot = new Float32Array(max);
    let r = seed;
    for (let i = 0; i < max; i++) { r = (r * 16807) % 2147483647; this.rot[i] = ((r / 2147483647) * 2 - 1) * rotJitter; }
  }

  get count(): number { return this.n; }

  private write(i: number, sc: number): void {
    this.slot(i, _p);
    _q.setFromEuler(_e.set(0, this.rot[i], 0));
    this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(Math.max(0.001, sc))));
  }

  /** Set the item count; `pop` animates newly added items. */
  set(n: number, pop = true): void {
    n = Math.max(0, Math.min(this.max, n));
    if (n === this.n) return;
    for (let i = this.n; i < n; i++) { this.popT[i] = pop ? 0 : 1; this.write(i, pop ? 0.001 : 1); }
    if (pop && n > this.n) this.animating = true;
    this.n = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Top item's world position (for flyers). */
  topWorld(out: THREE.Vector3, offset = 0): THREE.Vector3 {
    this.slot(Math.max(0, Math.min(this.max - 1, this.n - 1 + offset)), out);
    return this.mesh.localToWorld(out);
  }

  update(dt: number): void {
    if (!this.animating) return;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.popT[i] >= 1) continue;
      this.popT[i] = Math.min(1, this.popT[i] + dt * 5);
      this.write(i, easeOutBack(this.popT[i]));
      any = true;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.animating = any;
  }
}
