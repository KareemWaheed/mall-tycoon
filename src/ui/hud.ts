import { isMuted, setMuted } from '../audio';
import { fmt } from '../render/textures';

/** Money pill, store badge, mute button, the bottom tip and short toasts. */
export class Hud {
  private moneyEl: HTMLElement;
  private moneyVal: HTMLElement;
  private tip: HTMLElement;
  private toastEl: HTMLElement;
  private shown = -1;
  private tipText = '';
  private toastT = 0;

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML('beforeend', `
      <div id="hud">
        <div id="money"><span class="bill"></span><span id="moneyVal">0</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="brand"><i>⚡</i>كوتشي</div>
          <button id="mute" data-ui aria-label="الصوت">🔊</button>
        </div>
      </div>
      <div id="tip" hidden></div>
      <div id="toast" hidden></div>`);
    this.moneyEl = root.querySelector('#money')!;
    this.moneyVal = root.querySelector('#moneyVal')!;
    this.tip = root.querySelector('#tip')!;
    this.toastEl = root.querySelector('#toast')!;
    const mute = root.querySelector<HTMLButtonElement>('#mute')!;
    try { setMuted(localStorage.getItem('mall.muted') === '1'); } catch { /* storage blocked */ }
    mute.textContent = isMuted() ? '🔇' : '🔊';
    mute.addEventListener('click', () => {
      setMuted(!isMuted());
      mute.textContent = isMuted() ? '🔇' : '🔊';
      try { localStorage.setItem('mall.muted', isMuted() ? '1' : '0'); } catch { /* ignore */ }
    });
  }

  setMoney(v: number): void {
    const m = Math.floor(v);
    if (m === this.shown) return;
    if (m > this.shown && this.shown >= 0) {
      this.moneyEl.classList.add('bump');
      setTimeout(() => this.moneyEl.classList.remove('bump'), 120);
    }
    this.shown = m;
    this.moneyVal.textContent = fmt(m);
  }

  setTip(text: string | null): void {
    const t = text ?? '';
    if (t === this.tipText) return;
    this.tipText = t;
    this.tip.hidden = !t;
    if (t) {
      this.tip.textContent = t;
      // restart the pop-in
      this.tip.style.animation = 'none';
      void this.tip.offsetWidth;
      this.tip.style.animation = '';
    }
  }

  toast(text: string, seconds = 2.2): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastEl.style.animation = 'none';
    void this.toastEl.offsetWidth;
    this.toastEl.style.animation = '';
    this.toastT = seconds;
  }

  update(dt: number): void {
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.toastEl.hidden = true;
  }
}
