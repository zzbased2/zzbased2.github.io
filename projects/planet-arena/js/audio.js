export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastBounce = 0;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, duration, volume, type = 'sine', delay = 0, slide = 0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  play(type, side) {
    if (!this.enabled) return;
    switch (type) {
      case 'fire': this.tone(side === 'p' ? 620 : 420, 0.09, side === 'p' ? 0.035 : 0.02, 'triangle', 0, 260); break;
      case 'bounce': {
        const now = performance.now();
        if (now - this.lastBounce < 60) return;
        this.lastBounce = now;
        this.tone(900, 0.04, 0.012, 'sine');
        break;
      }
      case 'clash': this.tone(300, 0.12, 0.04, 'square', 0, -150); this.tone(1200, 0.08, 0.02, 'sine', 0.02); break;
      case 'reflect': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 0.035, 'triangle', i * 0.04)); break;
      case 'hit': if (side === 'p') this.tone(220, 0.25, 0.05, 'sawtooth', 0, -120); else { this.tone(520, 0.1, 0.04, 'square'); this.tone(780, 0.14, 0.03, 'triangle', 0.06); } break;
      case 'dash': this.tone(300, 0.12, 0.025, 'sine', 0, 500); break;
      case 'shield': this.tone(500, 0.18, 0.025, 'sine', 0, 300); break;
      case 'power': [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 0.03, 'triangle', i * 0.05)); break;
      case 'fight': this.tone(392, 0.12, 0.04, 'square'); this.tone(784, 0.25, 0.04, 'square', 0.12); break;
      case 'count': this.tone(440, 0.08, 0.03, 'square'); break;
      case 'roundWin': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 0.035, 'triangle', i * 0.08)); break;
      case 'roundLose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.2, 0.03, 'triangle', i * 0.1)); break;
      case 'victory': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 0.04, 'triangle', i * 0.09)); break;
      default: break;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.unlock();
    else if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
}
