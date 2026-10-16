/**
 * Headless pacing run: an efficient bot plays the store for N minutes and we print when each upgrade
 * is bought, money per minute and how many shoppers left angry. `--check` exits 1 on a missed target.
 *   npm run simulate -- --minutes 40 --seed 3 --check
 */
import { UPGRADES } from '../src/config/game';
import { Bot } from '../src/sim/bot';
import { World } from '../src/sim/world';

const args = process.argv.slice(2);
const arg = (name: string, def: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : def; };
const minutes = arg('minutes', 45);
const seed = arg('seed', 1);
const check = args.includes('--check');

const w = new World(seed);
const bot = new Bot(w);
const dt = 1 / 30;
const bought: { id: string; level: number; t: number }[] = [];
let served = 0, angry = 0, carts = 0;
const perMin: number[] = [];
let lastEarned = 0;

for (let step = 0; step < minutes * 60 * 30; step++) {
  w.tick(dt, bot.input(dt));
  for (const e of w.events) {
    if (e.k === 'unlock') bought.push({ id: e.id, level: e.level, t: w.time });
    else if (e.k === 'pay') served++;
    else if (e.k === 'angry') angry++;
    else if (e.k === 'cartPark') carts++;
  }
  w.events.length = 0;
  if (step % (60 * 30) === 60 * 30 - 1) { perMin.push(Math.round(w.earned - lastEarned)); lastEarned = w.earned; }
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
console.log(`seed ${seed}, ${minutes} min`);
for (const b of bought) console.log(`  ${mmss(b.t).padStart(6)}  ${b.id}${b.level > 1 ? ` L${b.level}` : ''}`);
const total = UPGRADES.reduce((n, u) => n + u.costs.length, 0);
console.log(`bought ${bought.length}/${total} levels, earned ${Math.round(w.earned)}, served ${served}, angry ${angry} (${Math.round((angry / Math.max(1, served + angry)) * 100)}%), trolleys parked ${carts}`);
console.log(`per minute: ${perMin.join(' ')}`);
console.log(`end: shoppers ${w.shoppers.list.length}, queue ${w.shoppers.queue.length}, litter ${w.litter.length}, rail ${w.railCarts}, money ${Math.round(w.money)}`);

if (check) {
  const fails: string[] = [];
  const at = (id: string) => bought.find((b) => b.id === id)?.t ?? Infinity;
  if (at('red2') > 90) fails.push(`first table at ${mmss(at('red2'))} (want < 1:30)`);
  if (at('cashier') > 12 * 60) fails.push(`cashier at ${mmss(at('cashier'))} (want < 12:00)`);
  if (at('purple2') > 40 * 60) fails.push(`last table at ${mmss(at('purple2'))} (want < 40:00)`);
  if (angry / Math.max(1, served + angry) > 0.15) fails.push(`too many angry shoppers`);
  // trolleys are never lost
  const out = w.shoppers.list.filter((s) => s.cart).length + w.player.train.length + w.staff.list.reduce((n, s) => n + s.train.length, 0);
  if (w.railCarts + w.litter.length + out !== w.totalCarts()) fails.push(`trolleys: ${w.railCarts + w.litter.length + out} != ${w.totalCarts()}`);
  if (fails.length) { console.error('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('pacing OK');
}
