import * as THREE from 'three';
import { Rng } from '../sim/rng';

export const FONT = '"Baloo Bhaijaan 2", "Arial Rounded MT Bold", Tahoma, sans-serif';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

export function tex(c: HTMLCanvasElement, srgb = true, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Rounded-rect path. */
export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Light oak planks (one texture tile = 4 m x 4 m). */
export function woodFloor(): THREE.CanvasTexture {
  const S = 1024, [cv, c] = canvas(S, S), r = new Rng(7);
  const rows = 16, rh = S / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r.next() * 400;
    while (x < S) {
      const len = 260 + r.next() * 320;
      const l = 72 + r.next() * 10;
      c.fillStyle = `hsl(${30 + r.next() * 6}, ${32 + r.next() * 10}%, ${l}%)`;
      c.fillRect(x, i * rh, len, rh);
      // grain
      c.globalAlpha = 0.08;
      for (let g = 0; g < 7; g++) {
        c.strokeStyle = r.chance(0.5) ? '#7a5634' : '#ffffff';
        c.lineWidth = 1 + r.next() * 1.5;
        c.beginPath();
        const y = i * rh + 4 + r.next() * (rh - 8);
        c.moveTo(x, y);
        c.bezierCurveTo(x + len * 0.3, y + r.range(-4, 4), x + len * 0.7, y + r.range(-4, 4), x + len, y + r.range(-3, 3));
        c.stroke();
      }
      c.globalAlpha = 1;
      // plank joints
      c.fillStyle = 'rgba(90,60,35,0.35)';
      c.fillRect(x, i * rh, 2, rh);
      x += len;
    }
    c.fillStyle = 'rgba(90,60,35,0.3)';
    c.fillRect(0, i * rh, S, 2);
  }
  const t = tex(cv, true, true);
  return t;
}

/** Pale stone paving for the plaza (one tile = 4 m). */
export function paving(): THREE.CanvasTexture {
  const S = 512, [cv, c] = canvas(S, S), r = new Rng(3);
  c.fillStyle = '#9ea4ae';
  c.fillRect(0, 0, S, S);
  const n = 4, q = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 70 + r.next() * 7;
    c.fillStyle = `hsl(218, 9%, ${l}%)`;
    c.fillRect(i * q + 3, j * q + 3, q - 6, q - 6);
  }
  return tex(cv, true, true);
}

export function grass(): THREE.CanvasTexture {
  const S = 256, [cv, c] = canvas(S, S), r = new Rng(5);
  c.fillStyle = '#6cc04a';
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    c.fillStyle = r.chance(0.5) ? '#5fae40' : '#7fd05a';
    c.fillRect(r.next() * S, r.next() * S, 2, 3 + r.next() * 3);
  }
  return tex(cv, true, true);
}

/** Corrugated shutter for closed units. */
export function shutter(): THREE.CanvasTexture {
  const S = 256, [cv, c] = canvas(S, S);
  for (let y = 0; y < S; y += 16) {
    const g = c.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, '#c3c7cf'); g.addColorStop(0.5, '#e4e7ec'); g.addColorStop(1, '#9fa4ad');
    c.fillStyle = g;
    c.fillRect(0, y, S, 16);
  }
  return tex(cv, true, true);
}

/** Text label texture: bold text on a transparent or filled background. */
export function label(text: string, opts: { w?: number; h?: number; fg?: string; bg?: string | null; size?: number; stroke?: string; rtl?: boolean; radius?: number } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 512, h = opts.h ?? 128, [cv, c] = canvas(w, h);
  if (opts.bg) { rr(c, 0, 0, w, h, opts.radius ?? 0); c.fillStyle = opts.bg; c.fill(); }
  let size = opts.size ?? Math.round(h * 0.7);
  c.font = `800 ${size}px ${FONT}`;
  while (size > 10 && c.measureText(text).width > w * 0.92) c.font = `800 ${--size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (opts.rtl) c.direction = 'rtl';
  if (opts.stroke) { c.lineWidth = size * 0.16; c.strokeStyle = opts.stroke; c.lineJoin = 'round'; c.strokeText(text, w / 2, h / 2 + size * 0.06); }
  c.fillStyle = opts.fg ?? '#ffffff';
  c.fillText(text, w / 2, h / 2 + size * 0.06);
  return tex(cv);
}

/** The KOTSHY logo: a bolt in a rounded badge + the wordmark. */
export function logo(w = 1024, h = 256, dark = false): THREE.CanvasTexture {
  const [cv, c] = canvas(w, h);
  const fg = dark ? '#1f2a44' : '#ffffff';
  // badge
  const s = h * 0.78, bx = h * 0.11, by = h * 0.11;
  rr(c, bx, by, s, s, s * 0.28);
  c.fillStyle = '#ff6a2b';
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  const X = (v: number) => bx + v * s, Y = (v: number) => by + v * s;
  c.moveTo(X(0.58), Y(0.12)); c.lineTo(X(0.26), Y(0.56)); c.lineTo(X(0.47), Y(0.56));
  c.lineTo(X(0.38), Y(0.9)); c.lineTo(X(0.76), Y(0.42)); c.lineTo(X(0.54), Y(0.42)); c.closePath();
  c.fill();
  c.fillStyle = fg;
  c.font = `800 ${Math.round(h * 0.62)}px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText('KOTSHY', h * 1.05, h * 0.54);
  return tex(cv);
}

/** SALE poster. */
export function salePoster(): THREE.CanvasTexture {
  const [cv, c] = canvas(256, 384);
  c.fillStyle = '#e53935';
  c.fillRect(0, 0, 256, 384);
  c.strokeStyle = '#fff';
  c.lineWidth = 8;
  c.strokeRect(14, 14, 228, 356);
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.font = `800 92px ${FONT}`;
  c.fillText('SALE', 128, 120);
  c.font = `800 46px ${FONT}`;
  c.direction = 'rtl';
  c.fillText('تخفيضات', 128, 200);
  c.direction = 'ltr';
  c.font = `800 80px ${FONT}`;
  c.fillStyle = '#ffeb3b';
  c.fillText('-50%', 128, 300);
  return tex(cv);
}

// ---------- floor price tiles ----------
export type IconKey = 'shelf' | 'carry' | 'speed' | 'cart' | 'box' | 'cashier' | 'stocker' | 'cartboy';

/** Simple pictograms drawn in white (like the in-store floor stickers). */
export function drawIcon(c: CanvasRenderingContext2D, key: IconKey, cx: number, cy: number, s: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(s / 100, s / 100);
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineWidth = 7;
  c.lineJoin = c.lineCap = 'round';
  const person = (x: number, y: number, k = 1) => {
    c.beginPath(); c.arc(x, y - 30 * k, 11 * k, 0, Math.PI * 2); c.fill();
    rr(c, x - 16 * k, y - 16 * k, 32 * k, 40 * k, 10 * k); c.fill();
  };
  switch (key) {
    case 'shelf':
      c.strokeRect(-42, -34, 84, 68);
      c.beginPath(); c.moveTo(-42, 0); c.lineTo(42, 0); c.stroke();
      c.fillRect(-32, -24, 22, 16); c.fillRect(4, -24, 26, 16); c.fillRect(-30, 10, 26, 16); c.fillRect(8, 10, 22, 16);
      break;
    case 'carry':
      for (let i = 0; i < 4; i++) { rr(c, -30, 22 - i * 20, 60, 16, 4); c.fill(); }
      c.beginPath(); c.moveTo(0, -78); c.lineTo(-18, -56); c.lineTo(18, -56); c.closePath(); c.fill();
      break;
    case 'speed':
      c.beginPath(); c.moveTo(-10, -44); c.lineTo(-34, 6); c.lineTo(-4, 6); c.lineTo(-16, 46); c.lineTo(30, -12); c.lineTo(2, -12); c.lineTo(14, -44); c.closePath(); c.fill();
      break;
    case 'cart':
      c.beginPath(); c.moveTo(-46, -32); c.lineTo(-30, -32); c.lineTo(-18, 18); c.lineTo(34, 18); c.lineTo(44, -18); c.lineTo(-24, -18); c.stroke();
      c.beginPath(); c.arc(-12, 34, 8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(28, 34, 8, 0, Math.PI * 2); c.fill();
      break;
    case 'box':
      c.strokeRect(-36, -20, 72, 52);
      c.beginPath(); c.moveTo(-36, -20); c.lineTo(-20, -42); c.lineTo(52, -42); c.lineTo(36, -20); c.stroke();
      c.beginPath(); c.moveTo(52, -42); c.lineTo(52, 10); c.lineTo(36, 32); c.stroke();
      break;
    case 'cashier':
      rr(c, -44, 4, 88, 36, 6); c.stroke();
      c.fillRect(-20, -16, 40, 18);
      c.fillRect(-4, -34, 26, 16);
      break;
    case 'stocker':
      person(-14, 12);
      rr(c, 10, -6, 34, 26, 4); c.fill();
      break;
    case 'cartboy':
      person(-26, 14, 0.85);
      c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.lineTo(14, 22); c.lineTo(44, 22); c.lineTo(50, -2); c.lineTo(10, -2); c.stroke();
      break;
  }
  c.restore();
}

/** Draw a floor tile: dark rounded square with corner brackets, icon, price and fill progress. */
export function drawTile(c: CanvasRenderingContext2D, S: number, key: IconKey, price: number, progress: number, label: string, level: string): void {
  c.clearRect(0, 0, S, S);
  const m = S * 0.12, w = S - 2 * m;
  rr(c, m, m, w, w, S * 0.07);
  c.fillStyle = 'rgba(48,46,44,0.82)';
  c.fill();
  if (progress > 0) {
    c.save();
    rr(c, m, m, w, w, S * 0.07);
    c.clip();
    c.fillStyle = 'rgba(92,200,88,0.9)';
    c.fillRect(m, m + w * (1 - progress), w, w * progress);
    c.restore();
  }
  // corner brackets
  c.strokeStyle = '#ffffff';
  c.lineWidth = S * 0.035;
  c.lineCap = 'round';
  const k = S * 0.14, o = S * 0.04;
  for (const [x, y, sx, sy] of [[o, o, 1, 1], [S - o, o, -1, 1], [o, S - o, 1, -1], [S - o, S - o, -1, -1]]) {
    c.beginPath(); c.moveTo(x + sx * k, y); c.lineTo(x, y); c.lineTo(x, y + sy * k); c.stroke();
  }
  drawIcon(c, key, S / 2, S * 0.4, S * 0.36);
  // price with a bill icon
  c.font = `800 ${Math.round(S * 0.15)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const txt = fmt(price);
  const tw = c.measureText(txt).width, bw = S * 0.13, gap = S * 0.03, total = tw + bw + gap;
  const x0 = S / 2 - total / 2;
  rr(c, x0, S * 0.66, bw, S * 0.08, S * 0.015);
  c.fillStyle = '#72c35a';
  c.fill();
  c.fillStyle = '#ffffff';
  c.fillText(txt, x0 + bw + gap + tw / 2, S * 0.705);
  c.font = `700 ${Math.round(S * 0.065)}px ${FONT}`;
  c.direction = 'rtl';
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fillText(level ? `${label} · ${level}` : label, S / 2, S * 0.8);
  c.direction = 'ltr';
}

export function fmt(n: number): string {
  n = Math.max(0, Math.ceil(n));
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return n.toLocaleString('en-US');
}
