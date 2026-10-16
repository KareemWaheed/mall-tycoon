import '@fontsource/baloo-bhaijaan-2/600.css';
import '@fontsource/baloo-bhaijaan-2/800.css';
import './ui/style.css';
import { UPGRADE, type UpgradeId } from './config/game';
import { unlockAudio } from './audio';
import { CameraRig } from './render/camera';
import { Renderer } from './render/renderer';
import { buildStore } from './render/store';
import { WorldView } from './render/view';
import { Bot } from './sim/bot';
import { guide } from './sim/guide';
import { applySave, toSave, type SaveData } from './sim/save';
import { World } from './sim/world';
import { Hud } from './ui/hud';
import { Input } from './ui/input';

const SAVE_KEY = 'mall-tycoon-save';
const params = new URLSearchParams(location.search);

function loadSave(): SaveData | null {
  if (params.has('fresh')) return null;
  try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) as SaveData : null; } catch { return null; }
}

async function start(): Promise<void> {
  const ui = document.getElementById('ui')!;
  ui.insertAdjacentHTML('beforeend', '<div id="loading">⚡ KOTSHY</div>');
  // canvas textures need the font before they are drawn
  try { await Promise.race([document.fonts.load('800 32px "Baloo Bhaijaan 2"'), new Promise((r) => setTimeout(r, 2500))]); } catch { /* draw with the fallback */ }

  const r = new Renderer(document.getElementById('c') as HTMLCanvasElement);
  const w = new World(Date.now() % 100000);
  const save = loadSave();
  if (save) { try { applySave(w, save); } catch (e) { console.warn('save ignored', e); } }
  if (params.has('money')) w.money += Number(params.get('money'));
  const { facade, facadeMats } = buildStore(r.scene);
  const view = new WorldView(r.scene, w);
  const cam = new CameraRig(r.camera);
  const input = new Input(ui);
  input.onGesture = unlockAudio;
  const hud = new Hud(ui);
  const bot = params.has('bot') ? new Bot(w) : null;
  // debug: fast-forward N sim seconds with the autopilot (screenshots, balance checks)
  if (params.has('warp')) {
    const auto = bot ?? new Bot(w);
    for (let t = 0; t < Number(params.get('warp')); t += 1 / 30) w.tick(1 / 30, auto.input(1 / 30));
    w.events.length = 0;
  }
  const speed = Number(params.get('speed') ?? 1);
  if (params.has('at')) { const [x, z] = params.get('at')!.split(',').map(Number); w.player.x = x; w.player.z = z; }
  if (params.has('zoom')) cam.scale = Number(params.get('zoom'));
  cam.snap(w.player.x, w.player.z);

  const names: Partial<Record<UpgradeId, string>> = { cashier: 'وصل الكاشير!', stocker: 'وصل عامل الرفوف!', cartboy: 'وصل عامل العربيات!' };
  view.unlockCb = (id) => {
    const u = UPGRADE[id];
    hud.toast(names[id] ?? `✨ ${u.label}`);
    if (u.icon === 'shelf') cam.focus(u.x, u.z, 1.4);
  };

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(w))); } catch { /* storage full or blocked */ } };
  setInterval(persist, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  addEventListener('pagehide', persist);
  (window as unknown as { game: unknown }).game = { w, view, reset: () => { localStorage.removeItem(SAVE_KEY); location.search = '?fresh'; } };

  let last = performance.now();
  let fadeK = 1;
  const loading = document.getElementById('loading')!;
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 450);

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    r.measure(real);
    const dt = Math.min(0.05, real);
    input.poll();
    const move = bot ? null : cam.stickToWorld(input.x, input.z);
    // a few sub-steps keep fast play stable
    const steps = Math.max(1, Math.ceil(speed));
    for (let i = 0; i < steps; i++) w.tick((dt * speed) / steps, bot ? bot.input((dt * speed) / steps) : move!);
    const g = guide(w);
    view.guide = g.at;
    view.update(dt);
    hud.setTip(g.tip);
    hud.setMoney(w.money);
    hud.update(dt);
    // the brand header fades while the player is inside, so it never hides them
    const want = w.player.z < 6.4 ? 0 : 1;
    fadeK += (want - fadeK) * Math.min(1, dt * 6);
    for (const m of facadeMats) m.opacity = fadeK;
    facade.visible = fadeK > 0.02;
    cam.update(w.player.x, w.player.z, dt);
    r.follow(cam.target.x, cam.target.z);
    r.render();
  };
  requestAnimationFrame(frame);
}

void start();
