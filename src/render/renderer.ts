import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Shadow box half-size around the player (m). */
const SHADOW_R = 14;

/**
 * WebGL renderer with soft shadows from one sun that follows the player, a neutral environment map for soft
 * reflections, and adaptive resolution (drops pixel ratio when frames are slow, never below 1x).
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 120);
  readonly sun: THREE.DirectionalLight;
  readonly maxPR = Math.min(window.devicePixelRatio || 1, 2);
  pixelRatio = this.maxPR;
  fps = 60;
  private fAcc = 0; private fN = 0; private slow = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NeutralToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xcfe6f5);
    const pmrem = new THREE.PMREMGenerator(this.gl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c2a8, 0.65));
    this.sun = new THREE.DirectionalLight(0xfff4e5, 2.8);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = s.camera.bottom = -SHADOW_R;
    s.camera.right = s.camera.top = SHADOW_R;
    s.camera.near = 1; s.camera.far = 60;
    s.bias = -0.0004;
    s.normalBias = 0.03;
    s.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Keep the shadow box centred on what the camera looks at. */
  follow(x: number, z: number): void {
    // snap to texel steps so shadows don't shimmer while moving
    const step = (SHADOW_R * 2) / 2048;
    const sx = Math.round(x / step) * step, sz = Math.round(z / step) * step;
    this.sun.position.set(sx - 13, 17, sz + 9);
    this.sun.target.position.set(sx, 0, sz);
  }

  resize(): void {
    this.gl.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Feed real frame time; once a second, lower the pixel ratio after 3 slow seconds in a row. */
  measure(real: number): void {
    this.fAcc += real; this.fN++;
    if (this.fAcc < 1) return;
    this.fps = this.fN / this.fAcc;
    this.fAcc = 0; this.fN = 0;
    if (document.hidden) return;
    if (this.fps < 45 && this.pixelRatio > 1) {
      if (++this.slow >= 3) {
        this.slow = 0;
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
        this.gl.setPixelRatio(this.pixelRatio);
        this.resize();
      }
    } else this.slow = 0;
  }

  render(): void { this.gl.render(this.scene, this.camera); }
}
