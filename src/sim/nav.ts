import type { Box, Vec2 } from './math';

const CELL = 0.5;
/** Agents keep this far from solids. */
const PAD = 0.38;

/** Grid A* over the walkable area, with line-of-sight smoothing. Rebuilt whenever the solids change. */
export class NavGrid {
  readonly w: number;
  readonly h: number;
  private blocked: Uint8Array;
  // scratch for A*
  private g: Float32Array;
  private f: Float32Array;
  private from: Int32Array;
  private state: Uint8Array;
  private heap: number[] = [];

  constructor(private area: Box) {
    this.w = Math.ceil((area.x1 - area.x0) / CELL);
    this.h = Math.ceil((area.z1 - area.z0) / CELL);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.state = new Uint8Array(n);
  }

  build(solids: readonly Box[]): void {
    this.blocked.fill(0);
    for (const s of solids) {
      const cx0 = Math.max(0, Math.floor((s.x0 - PAD - this.area.x0) / CELL));
      const cx1 = Math.min(this.w - 1, Math.floor((s.x1 + PAD - this.area.x0) / CELL));
      const cz0 = Math.max(0, Math.floor((s.z0 - PAD - this.area.z0) / CELL));
      const cz1 = Math.min(this.h - 1, Math.floor((s.z1 + PAD - this.area.z0) / CELL));
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
        const px = this.area.x0 + (x + 0.5) * CELL, pz = this.area.z0 + (z + 0.5) * CELL;
        if (px > s.x0 - PAD && px < s.x1 + PAD && pz > s.z0 - PAD && pz < s.z1 + PAD) this.blocked[z * this.w + x] = 1;
      }
    }
  }

  private cell(x: number, z: number): number {
    const cx = Math.min(this.w - 1, Math.max(0, Math.floor((x - this.area.x0) / CELL)));
    const cz = Math.min(this.h - 1, Math.max(0, Math.floor((z - this.area.z0) / CELL)));
    return cz * this.w + cx;
  }

  private cx(i: number): number { return this.area.x0 + ((i % this.w) + 0.5) * CELL; }
  private cz(i: number): number { return this.area.z0 + (Math.floor(i / this.w) + 0.5) * CELL; }

  /** Nearest free cell to i (ring search). */
  private free(i: number): number {
    if (!this.blocked[i]) return i;
    const x0 = i % this.w, z0 = Math.floor(i / this.w);
    for (let r = 1; r < 12; r++) {
      let best = -1, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = x0 + dx, z = z0 + dz;
        if (x < 0 || z < 0 || x >= this.w || z >= this.h) continue;
        const j = z * this.w + x;
        if (this.blocked[j]) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) return best;
    }
    return i;
  }

  /** True if the straight segment a->b stays on free cells. */
  clear(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (CELL * 0.4));
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      if (this.blocked[this.cell(ax + (bx - ax) * t, az + (bz - az) * t)]) return false;
    }
    return true;
  }

  /** Waypoints from (ax, az) to (bx, bz), excluding the start, ending exactly at the goal. */
  path(ax: number, az: number, bx: number, bz: number): Vec2[] {
    if (this.clear(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    const s = this.free(this.cell(ax, az)), t = this.free(this.cell(bx, bz));
    const { g, f, from, state, w } = this;
    state.fill(0);
    const heap = this.heap;
    heap.length = 0;
    const tx = t % w, tz = Math.floor(t / w);
    const hfn = (i: number) => {
      const dx = Math.abs((i % w) - tx), dz = Math.abs(Math.floor(i / w) - tz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[s] = 0; f[s] = hfn(s); from[s] = -1; state[s] = 1;
    push(heap, f, s);
    let found = false;
    while (heap.length) {
      const i = pop(heap, f);
      if (state[i] === 2) continue;
      state[i] = 2;
      if (i === t) { found = true; break; }
      const x = i % w, z = Math.floor(i / w);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= this.h) continue;
        const j = nz * w + nx;
        if (this.blocked[j] || state[j] === 2) continue;
        // no corner cutting
        if (dx && dz && (this.blocked[z * w + nx] || this.blocked[nz * w + x])) continue;
        const ng = g[i] + (dx && dz ? 1.414 : 1);
        if (state[j] === 1 && ng >= g[j]) continue;
        g[j] = ng; f[j] = ng + hfn(j); from[j] = i; state[j] = 1;
        push(heap, f, j);
      }
    }
    if (!found) return [{ x: bx, z: bz }];
    const cells: number[] = [];
    for (let i = t; i >= 0; i = from[i]) cells.push(i);
    cells.reverse();
    // string-pull: keep only the points where line of sight breaks
    const out: Vec2[] = [];
    let px = ax, pz = az;
    for (let k = 1; k < cells.length; k++) {
      const nx = this.cx(cells[k]), nz = this.cz(cells[k]);
      if (!this.clear(px, pz, nx, nz)) {
        const prev = cells[k - 1];
        px = this.cx(prev); pz = this.cz(prev);
        out.push({ x: px, z: pz });
      }
    }
    out.push({ x: bx, z: bz });
    return out;
  }
}

function push(h: number[], f: Float32Array, i: number): void {
  h.push(i);
  let k = h.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (f[h[p]] <= f[h[k]]) break;
    [h[p], h[k]] = [h[k], h[p]];
    k = p;
  }
}

function pop(h: number[], f: Float32Array): number {
  const top = h[0], last = h.pop()!;
  if (h.length) {
    h[0] = last;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < h.length && f[h[l]] < f[h[m]]) m = l;
      if (r < h.length && f[h[r]] < f[h[m]]) m = r;
      if (m === k) break;
      [h[m], h[k]] = [h[k], h[m]];
      k = m;
    }
  }
  return top;
}
