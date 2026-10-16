import * as THREE from 'three';
import { MAT, PRIM } from './geo';
import { FONT, canvas, tex } from './textures';

const _v = new THREE.Vector3();

interface Flight { m: THREE.Mesh; from: THREE.Vector3; to: () => THREE.Vector3; t: number; dur: number; h: number; spin: number; done?: () => void }

/** Items that arc from one place to another (pile -> hands, hands -> table, cash -> player). */
export class Flyers {
  private pool: THREE.Mesh[] = [];
  private live: Flight[] = [];
  constructor(private scene: THREE.Scene) {}

  launch(geo: THREE.BufferGeometry, from: THREE.Vector3, to: () => THREE.Vector3, dur = 0.32, h = 0.9, done?: () => void, scale = 1): void {
    let m = this.pool.pop();
    if (!m) { m = new THREE.Mesh(geo, MAT); m.castShadow = true; this.scene.add(m); }
    m.geometry = geo;
    m.visible = true;
    m.scale.setScalar(scale);
    m.position.copy(from);
    this.live.push({ m, from: from.clone(), to, t: 0, dur, h, spin: (Math.random() - 0.5) * 8, done });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.t += dt / f.dur;
      const k = Math.min(1, f.t), e = k * k * (3 - 2 * k);
      const to = f.to();
      f.m.position.lerpVectors(f.from, to, e);
      f.m.position.y += Math.sin(Math.PI * k) * f.h;
      f.m.rotation.y += f.spin * dt;
      if (k >= 1) {
        f.m.visible = false;
        this.pool.push(f.m);
        this.live.splice(i, 1);
        f.done?.();
      }
    }
  }
}

/** "+12" style text that floats up and fades. */
export class FloatText {
  private pool: { s: THREE.Sprite; c: HTMLCanvasElement; t: THREE.CanvasTexture; age: number; life: number }[] = [];
  constructor(private scene: THREE.Scene) {}

  show(text: string, x: number, y: number, z: number, color = '#ffffff', size = 1): void {
    let p = this.pool.find((q) => q.age >= q.life);
    if (!p) {
      const [c] = canvas(256, 96);
      const t = tex(c);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      s.renderOrder = 20;
      this.scene.add(s);
      p = { s, c, t, age: 0, life: 0 };
      this.pool.push(p);
    }
    const ctx = p.c.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 96);
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,30,20,0.85)';
    ctx.strokeText(text, 128, 52);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 52);
    p.t.needsUpdate = true;
    p.s.position.set(x, y, z);
    p.s.scale.set(1.6 * size, 0.6 * size, 1);
    p.age = 0;
    p.life = 1.1;
    p.s.visible = true;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.age >= p.life) { p.s.visible = false; continue; }
      p.age += dt;
      p.s.position.y += dt * 1.3;
      (p.s.material as THREE.SpriteMaterial).opacity = Math.min(1, (p.life - p.age) * 3);
    }
  }
}

/** Confetti burst when something is bought. */
export class Confetti {
  private mesh: THREE.InstancedMesh;
  private n = 160;
  private pos: Float32Array; private vel: Float32Array; private rot: Float32Array; private life: Float32Array;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private s = new THREE.Vector3(1, 1, 1);
  private next = 0;

  constructor(scene: THREE.Scene) {
    const g = PRIM.box.clone().scale(0.09, 0.015, 0.06);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.n);
    this.mesh.frustumCulled = false;
    const cols = [0xff6a2b, 0xffd54f, 0x4fc3f7, 0x81c784, 0xf06292, 0xffffff];
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) this.mesh.setColorAt(i, c.setHex(cols[i % cols.length]));
    this.pos = new Float32Array(this.n * 3); this.vel = new Float32Array(this.n * 3);
    this.rot = new Float32Array(this.n * 3); this.life = new Float32Array(this.n);
    this.mesh.count = this.n;
    for (let i = 0; i < this.n; i++) this.hide(i);
    scene.add(this.mesh);
  }

  private hide(i: number): void { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); }

  burst(x: number, z: number, count = 50): void {
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      this.pos.set([x, 0.4, z], i * 3);
      this.vel.set([Math.cos(a) * sp, 4 + Math.random() * 4, Math.sin(a) * sp], i * 3);
      this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.life[i] = 1.8 + Math.random() * 0.6;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= 12 * dt;
      // flutter: air drag
      this.vel[j] *= 1 - dt * 1.5; this.vel[j + 2] *= 1 - dt * 1.5;
      if (this.vel[j + 1] < -2.2) this.vel[j + 1] = -2.2;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.02) { this.pos[j + 1] = 0.02; this.vel[j] = this.vel[j + 2] = 0; }
      this.rot[j] += dt * 7; this.rot[j + 2] += dt * 5;
      if (this.life[i] <= 0) { this.hide(i); continue; }
      this.q.setFromEuler(this.e.set(this.rot[j], this.rot[j + 1], this.rot[j + 2]));
      this.m.compose(_v.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]), this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
