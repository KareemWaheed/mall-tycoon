import * as THREE from 'three';
import { clamp } from '../sim/math';

const ELEVATION = THREE.MathUtils.degToRad(52);
/** The camera looks from the south-west, so the store reads at an angle like a diorama. */
export const YAW = -0.5;
/** Half the visible world width at the player (m); distance adapts to the aspect ratio. */
const HALF_WIDTH = 4.9;
const FOLLOW = 7;

/** Tilted, rotated camera that follows a target smoothly (and can briefly look at something else). */
export class CameraRig {
  readonly target = new THREE.Vector3();
  private off = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private focusAt = new THREE.Vector3();
  private focusT = 0;
  private zoom = 1;
  /** Debug zoom-out factor. */
  scale = 1;

  constructor(private camera: THREE.PerspectiveCamera) {}

  snap(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.update(x, z, 0);
  }

  focus(x: number, z: number, seconds: number): void {
    this.focusAt.set(x, 0, z);
    this.focusT = seconds;
  }

  /** Turn a screen-space stick (x right, z down) into a world direction. */
  stickToWorld(x: number, z: number): { x: number; z: number } {
    const c = Math.cos(YAW), s = Math.sin(YAW);
    return { x: x * c + z * s, z: -x * s + z * c };
  }

  update(x: number, z: number, dt: number): void {
    const cam = this.camera;
    if (this.focusT > 0) this.focusT -= dt;
    const focusing = this.focusT > 0;
    this.zoom += ((focusing ? 0.85 : 1) - this.zoom) * (1 - Math.exp(-dt * 3));
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = clamp(HALF_WIDTH / (tanH * cam.aspect), 15, 34) * this.zoom * this.scale;
    const h = Math.cos(ELEVATION) * d;
    this.off.set(Math.sin(YAW) * h, Math.sin(ELEVATION) * d, Math.cos(YAW) * h);
    // look a little ahead of the player (more of the store above them on a portrait screen)
    this.goal.copy(focusing ? this.focusAt : this.goal.set(x, 0, z - 0.8));
    this.target.lerp(this.goal, dt > 0 ? 1 - Math.exp(-dt * (focusing ? 3 : FOLLOW)) : 1);
    cam.position.copy(this.target).add(this.off);
    cam.lookAt(this.target);
  }
}
