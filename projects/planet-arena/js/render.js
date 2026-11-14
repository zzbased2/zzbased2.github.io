import { W, H, BOUNDS } from './data.js';
import { rayHit } from './engine.js';

const TAU = Math.PI * 2;

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function starPath(ctx, x, y, outer, inner, spin = 0, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = spin + i * Math.PI / points - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export function lookForSkin(skin) { return { body: skin.body, ring: skin.ring, deco: 'player' }; }
export function lookForOpponent(op) { return { body: op.color, ring: op.accent, deco: op.id }; }

function drawDeco(ctx, r, deco, t) {
  if (deco === 'player') {
    ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.92); ctx.quadraticCurveTo(r * 0.15, -r * 1.25, r * 0.05, -r * 1.42); ctx.stroke();
    ctx.fillStyle = '#fff1a8'; starPath(ctx, r * 0.05, -r * 1.5, r * 0.26, r * 0.11, t * 1.5); ctx.fill();
  } else if (deco === 0) {
    circle(ctx, -r * 0.45, -r * 0.82, r * 0.22, '#c98a52');
    circle(ctx, r * 0.3, -r * 0.9, r * 0.16, '#d99a62');
  } else if (deco === 1) {
    ctx.fillStyle = '#e6f7ff';
    for (const [x, h] of [[-0.4, 0.45], [0, 0.65], [0.4, 0.45]]) {
      ctx.beginPath(); ctx.moveTo(r * (x - 0.14), -r * 0.8); ctx.lineTo(r * x, -r * (0.8 + h)); ctx.lineTo(r * (x + 0.14), -r * 0.8); ctx.fill();
    }
  } else if (deco === 2) {
    const flick = Math.sin(t * 14) * r * 0.06;
    for (const [x, s, c] of [[-0.3, 0.32, '#ffb347'], [0.3, 0.32, '#ffb347'], [0, 0.45, '#ffd166']]) {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(r * (x - s * 0.6), -r * 0.78);
      ctx.quadraticCurveTo(r * x, -r * (0.8 + s * 2.2) + flick, r * (x + s * 0.6), -r * 0.78);
      ctx.fill();
    }
  } else if (deco === 3) {
    ctx.strokeStyle = '#e8fff2'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = i / 20 * TAU * 1.3 + t * 3, rr = r * 0.05 + i / 20 * r * 0.28;
      const x = Math.cos(a) * rr, y = -r * 1.25 + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.92); ctx.lineTo(0, -r * 1.1); ctx.stroke();
  } else if (deco === 4) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.78);
    ctx.lineTo(-r * 0.55, -r * 1.25); ctx.lineTo(-r * 0.25, -r * 1.0); ctx.lineTo(0, -r * 1.4);
    ctx.lineTo(r * 0.25, -r * 1.0); ctx.lineTo(r * 0.55, -r * 1.25); ctx.lineTo(r * 0.5, -r * 0.78); ctx.closePath(); ctx.fill();
    circle(ctx, 0, -r * 1.42, r * 0.09, '#ff7ad9');
  }
}

export function drawCreature(ctx, x, y, r, look, opts = {}) {
  const t = opts.t || 0, aim = opts.aim ?? 0, hurt = opts.hurt || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, r * 1.0, r * 0.85, r * 0.24, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.rotate(-0.35);
  ctx.strokeStyle = look.ring; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.42, 0, Math.PI, TAU); ctx.stroke();
  ctx.restore();
  drawDeco(ctx, r, look.deco, t);
  circle(ctx, 0, 0, r, look.body);
  const hi = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, -r * 0.2, -r * 0.2, r * 1.1);
  hi.addColorStop(0, 'rgba(255,255,255,0.55)'); hi.addColorStop(0.45, 'rgba(255,255,255,0.08)'); hi.addColorStop(1, 'rgba(0,0,0,0.22)');
  circle(ctx, 0, 0, r, hi);
  ctx.globalAlpha *= 0.16;
  circle(ctx, r * 0.45, r * 0.38, r * 0.18, '#000');
  circle(ctx, -r * 0.5, r * 0.45, r * 0.11, '#000');
  ctx.globalAlpha /= 0.16;
  const ex = Math.cos(aim) * r * 0.12, ey = Math.sin(aim) * r * 0.1;
  const blink = (t % 3.3) < 0.12 ? 0.15 : 1;
  if (hurt > 0) {
    ctx.strokeStyle = '#2b2346'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const cx = s * r * 0.33 + ex, cy = -r * 0.12 + ey;
      ctx.beginPath(); ctx.moveTo(cx - r * 0.12, cy - r * 0.1); ctx.lineTo(cx + r * 0.05 * s, cy); ctx.lineTo(cx - r * 0.12, cy + r * 0.1); ctx.stroke();
    }
    circle(ctx, ex * 0.6, r * 0.32 + ey * 0.5, r * 0.11, '#2b2346');
  } else {
    for (const s of [-1, 1]) {
      const cx = s * r * 0.33 + ex, cy = -r * 0.12 + ey;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.2, r * 0.25 * blink, 0, 0, TAU); ctx.fill();
      if (blink > 0.5) {
        circle(ctx, cx + Math.cos(aim) * r * 0.07, cy + Math.sin(aim) * r * 0.07, r * 0.11, '#2b2346');
        circle(ctx, cx + Math.cos(aim) * r * 0.07 - r * 0.04, cy + Math.sin(aim) * r * 0.07 - r * 0.05, r * 0.04, '#fff');
      }
    }
    ctx.strokeStyle = '#2b2346'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ex * 0.6, r * 0.22 + ey * 0.5, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.globalAlpha *= 0.45;
  circle(ctx, -r * 0.58 + ex * 0.5, r * 0.15, r * 0.12, '#ff7a9a');
  circle(ctx, r * 0.58 + ex * 0.5, r * 0.15, r * 0.12, '#ff7a9a');
  ctx.globalAlpha /= 0.45;
  ctx.save(); ctx.rotate(-0.35);
  ctx.strokeStyle = look.ring; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.42, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function drawPortrait(canvas, look, bg = ['#2a1d5c', '#140f33']) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.5; circle(ctx, (i * 53.7) % w, (i * 31.3) % h, i % 4 === 0 ? 1.6 : 0.9, '#fff'); }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(w / 2, h * 0.56, 4, w / 2, h * 0.56, h * 0.55);
  glow.addColorStop(0, look.body + '55'); glow.addColorStop(1, look.body + '00');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  drawCreature(ctx, w / 2, h * 0.58, Math.min(w, h) * 0.24, look, { t: 0.6, aim: Math.PI / 2 * 0.3 });
}

export function drawHeroScene(ctx, w, h, t, playerLook, enemyLook) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#22165a'); g.addColorStop(1, '#120c30');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + i));
    circle(ctx, (i * 97.3) % w, (i * 47.9) % h, i % 6 === 0 ? 1.8 : 0.9, '#fff');
  }
  ctx.globalAlpha = 1;
  const neb = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.5);
  neb.addColorStop(0, '#ff7ad933'); neb.addColorStop(1, '#ff7ad900');
  ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
  const fx = w * 0.06, fy = h * 0.14, fw = w * 0.88, fh = h * 0.74;
  roundRectPath(ctx, fx, fy, fw, fh, 26);
  ctx.fillStyle = '#1d1550cc'; ctx.fill();
  ctx.strokeStyle = '#ffd16655'; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke();
  ctx.setLineDash([6, 10]); ctx.strokeStyle = '#ffffff22';
  ctx.beginPath(); ctx.moveTo(w / 2, fy + 12); ctx.lineTo(w / 2, fy + fh - 12); ctx.stroke();
  ctx.setLineDash([]);
  const x1 = fx + fw * 0.2, x2 = fx + fw * 0.8;
  const top = fy + 22, bottom = fy + fh - 22;
  const pos = time => {
    const phase = ((time * 0.45) % 2 + 2) % 2;
    const s = phase < 1 ? phase : 2 - phase;
    const v = (s * 3) % 2;
    const tri = v < 1 ? v : 2 - v;
    return { x: x1 + 40 + (x2 - x1 - 80) * s, y: top + (bottom - top) * tri, dir: phase < 1 ? 1 : -1 };
  };
  const now = pos(t);
  const color = now.dir > 0 ? playerLook.body : enemyLook.body;
  for (let k = 10; k >= 1; k--) {
    const p = pos(t - k * 0.018);
    ctx.globalAlpha = (1 - k / 11) * 0.5;
    circle(ctx, p.x, p.y, 7 * (1 - k / 14), color);
  }
  ctx.globalAlpha = 1;
  const bg = ctx.createRadialGradient(now.x, now.y, 1, now.x, now.y, 22);
  bg.addColorStop(0, color + 'aa'); bg.addColorStop(1, color + '00');
  ctx.fillStyle = bg; ctx.fillRect(now.x - 22, now.y - 22, 44, 44);
  circle(ctx, now.x, now.y, 8, '#fff');
  circle(ctx, now.x, now.y, 5.5, color);
  const r = Math.min(w, h) * 0.085;
  drawCreature(ctx, x1, h * 0.55 + Math.sin(t * 2) * 6, r, playerLook, { t, aim: Math.atan2(now.y - h * 0.55, now.x - x1) });
  drawCreature(ctx, x2, h * 0.5 + Math.sin(t * 2 + 1.5) * 6, r, enemyLook, { t: t + 1, aim: Math.atan2(now.y - h * 0.5, now.x - x2) });
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    this.scale = dpr;
    this.stars = Array.from({ length: 110 }, (_, i) => ({ x: (i * 137.51) % W, y: (i * 91.73 + i * i * 0.37) % H, s: i % 9 === 0 ? 1.9 : i % 3 === 0 ? 1.2 : 0.7, p: i * 1.7 }));
  }

  draw(m, opts = {}) {
    const ctx = this.ctx, s = this.scale;
    const reduced = !!opts.reduced;
    let sx = 0, sy = 0;
    if (m.shake > 0 && !reduced) { sx = (Math.random() - 0.5) * m.shake * 16; sy = (Math.random() - 0.5) * m.shake * 16; }
    ctx.setTransform(s, 0, 0, s, sx * s, sy * s);
    const arena = m.arena;
    const t = reduced ? 0 : m.time;
    this.background(ctx, arena, t);
    this.floor(ctx, arena);
    for (const o of m.obstacles) this.obstacle(ctx, o, arena.style, t);
    if (m.powerup) this.powerup(ctx, m.powerup, m.time);
    const playerLook = opts.playerLook, enemyLook = lookForOpponent(m.opponent);
    if (m.state === 'fight' && opts.showAim !== false) this.aimLine(ctx, m, playerLook.body);
    for (const b of m.balls) this.ball(ctx, b, b.owner === 'p' ? playerLook.body : enemyLook.body);
    this.fighter(ctx, m.enemy, enemyLook, m.time);
    this.fighter(ctx, m.player, playerLook, m.time);
    if (!reduced) for (const p of m.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      circle(ctx, p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Fredoka, "ZCOOL KuaiLe", "Noto Sans SC", sans-serif';
    for (const f of m.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      ctx.lineWidth = 4; ctx.strokeStyle = '#140f33'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    this.banner(ctx, m);
    ctx.textAlign = 'left';
  }

  background(ctx, arena, t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, arena.sky[0]); g.addColorStop(1, arena.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    const neb = ctx.createRadialGradient(W * 0.78, H * 0.2, 10, W * 0.78, H * 0.2, 420);
    neb.addColorStop(0, arena.line + '30'); neb.addColorStop(1, arena.line + '00');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    const neb2 = ctx.createRadialGradient(W * 0.15, H * 0.85, 10, W * 0.15, H * 0.85, 360);
    neb2.addColorStop(0, '#ff7ad922'); neb2.addColorStop(1, '#ff7ad900');
    ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
    for (const st of this.stars) {
      ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 0.9 + st.p));
      circle(ctx, st.x, st.y, st.s, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  floor(ctx, arena) {
    const { l, t, r, b } = BOUNDS;
    roundRectPath(ctx, l - 6, t - 6, r - l + 12, b - t + 12, 30);
    ctx.fillStyle = arena.floor + 'd9'; ctx.fill();
    ctx.save();
    roundRectPath(ctx, l - 6, t - 6, r - l + 12, b - t + 12, 30);
    ctx.clip();
    ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1;
    for (let x = l; x <= r; x += 48) { ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, b); ctx.stroke(); }
    for (let y = t; y <= b; y += 48) { ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke(); }
    ctx.restore();
    ctx.setLineDash([8, 12]); ctx.strokeStyle = '#ffffff26'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, t + 10); ctx.lineTo(W / 2, b - 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 74, 0, TAU); ctx.stroke();
    roundRectPath(ctx, l - 6, t - 6, r - l + 12, b - t + 12, 30);
    ctx.strokeStyle = arena.line + '40'; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = arena.line; ctx.lineWidth = 3; ctx.stroke();
  }

  obstacle(ctx, o, style, t) {
    const { x, y, r } = o;
    if (style === 'ice') {
      ctx.fillStyle = '#9fdcff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6f7ff';
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.6); ctx.lineTo(x + r * 0.1, y - r * 0.2); ctx.lineTo(x - r * 0.45, y + r * 0.1); ctx.fill();
      ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 2; ctx.stroke();
      return;
    }
    const palettes = { rock: ['#6e5a7e', '#8f7aa1'], lava: ['#40232c', '#ff7a59'], storm: ['#3f6a7e', '#9dffb0'], crown: ['#5a3d8f', '#ffd166'] };
    const [base, accent] = palettes[style] || palettes.rock;
    circle(ctx, x, y + 4, r, '#00000040');
    circle(ctx, x, y, r, base);
    const hi = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r);
    hi.addColorStop(0, 'rgba(255,255,255,0.3)'); hi.addColorStop(1, 'rgba(0,0,0,0.25)');
    circle(ctx, x, y, r, hi);
    if (style === 'rock') {
      circle(ctx, x + r * 0.3, y + r * 0.2, r * 0.2, '#00000030');
      circle(ctx, x - r * 0.35, y - r * 0.1, r * 0.13, '#00000030');
      circle(ctx, x + r * 0.05, y - r * 0.45, r * 0.1, '#00000030');
    } else if (style === 'lava') {
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + Math.sin(t * 3 + x) * 0.3;
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.1); ctx.lineTo(x - r * 0.1, y + r * 0.15); ctx.lineTo(x + r * 0.2, y - r * 0.3); ctx.lineTo(x + r * 0.6, y + r * 0.05); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent + '66'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.stroke();
    } else if (style === 'storm') {
      ctx.strokeStyle = accent + 'aa'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y, r * (0.35 + i * 0.22), t * (2 + i) + i, t * (2 + i) + i + Math.PI * 0.9); ctx.stroke(); }
    } else if (style === 'crown') {
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.35, r * 0.38, -0.3, 0, TAU); ctx.stroke();
      ctx.fillStyle = accent; starPath(ctx, x, y, r * 0.32, r * 0.14, t); ctx.fill();
    }
  }

  powerup(ctx, pu, time) {
    if (pu.life < 2.5 && Math.floor(time * 8) % 2 === 0) return;
    const bob = Math.sin(time * 4) * 3;
    const glow = ctx.createRadialGradient(pu.x, pu.y + bob, 2, pu.x, pu.y + bob, 34);
    glow.addColorStop(0, pu.color + '88'); glow.addColorStop(1, pu.color + '00');
    ctx.fillStyle = glow; ctx.fillRect(pu.x - 34, pu.y - 34 + bob, 68, 68);
    ctx.fillStyle = pu.color; starPath(ctx, pu.x, pu.y + bob, 18, 9, time * 1.6); ctx.fill();
    ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a1240'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pu.glyph, pu.x, pu.y + bob + 1);
    ctx.textBaseline = 'alphabetic';
  }

  aimLine(ctx, m, color) {
    const p = m.player;
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
    const sx = p.x + dx * (p.r + 10), sy = p.y + dy * (p.r + 10);
    const hit = rayHit(sx, sy, dx, dy, m.obstacles);
    ctx.save();
    ctx.setLineDash([3, 9]); ctx.lineCap = 'round';
    ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hit.x, hit.y); ctx.stroke();
    const dot = dx * hit.nx + dy * hit.ny;
    const rx = dx - 2 * dot * hit.nx, ry = dy - 2 * dot * hit.ny;
    const len = Math.min(150, rayHit(hit.x + rx * 0.5, hit.y + ry * 0.5, rx, ry, m.obstacles).t);
    ctx.strokeStyle = color + '55';
    ctx.beginPath(); ctx.moveTo(hit.x, hit.y); ctx.lineTo(hit.x + rx * len, hit.y + ry * len); ctx.stroke();
    ctx.setLineDash([]);
    circle(ctx, hit.x, hit.y, 4, color + 'cc');
    ctx.restore();
  }

  ball(ctx, b, color) {
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i];
      ctx.globalAlpha = (i / b.trail.length) * 0.45;
      circle(ctx, p.x, p.y, b.r * (0.4 + 0.6 * i / b.trail.length), color);
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r * 2.6);
    g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.fillRect(b.x - b.r * 2.6, b.y - b.r * 2.6, b.r * 5.2, b.r * 5.2);
    circle(ctx, b.x, b.y, b.r + 1.5, b.reflected ? '#ffffff' : '#ffffffdd');
    circle(ctx, b.x, b.y, b.r - 1, color);
    if (b.giant) { ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, TAU); ctx.stroke(); }
  }

  fighter(ctx, f, look, time) {
    for (let i = 0; i < f.trail.length; i++) {
      ctx.globalAlpha = (i / f.trail.length) * 0.3;
      circle(ctx, f.trail[i].x, f.trail[i].y, f.r, look.body);
    }
    ctx.globalAlpha = 1;
    if (f.invuln > 0 && Math.floor(time * 16) % 2 === 0) ctx.globalAlpha = 0.4;
    if (f.swift > 0) {
      ctx.strokeStyle = '#6ef0c2aa'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(f.x - Math.cos(f.facing) * (f.r + 6) + i * 6, f.y - Math.sin(f.facing) * (f.r + 6) + i * 6); ctx.lineTo(f.x - Math.cos(f.facing) * (f.r + 22) + i * 6, f.y - Math.sin(f.facing) * (f.r + 22) + i * 6); ctx.stroke(); }
    }
    drawCreature(ctx, f.x, f.y, f.r, look, { t: time + (f.side === 'e' ? 1.3 : 0), aim: f.aim, hurt: f.hurt });
    ctx.globalAlpha = 1;
    if (f.shield > 0) {
      const a = Math.min(1, f.shield / 0.12);
      ctx.fillStyle = `rgba(143,227,255,${0.2 * a})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(200,245,255,${0.9 * a})`; ctx.lineWidth = 3; ctx.stroke();
    }
    for (let i = 0; i < f.maxEnergy; i++) {
      const fill = Math.max(0, Math.min(1, f.energy - i));
      const px = f.x + (i - (f.maxEnergy - 1) / 2) * 11, py = f.y + f.r + 14;
      circle(ctx, px, py, 3.6, '#ffffff22');
      if (fill > 0) { ctx.globalAlpha = fill >= 1 ? 1 : 0.45; circle(ctx, px, py, 3.6 * (fill >= 1 ? 1 : fill), look.body); ctx.globalAlpha = 1; }
    }
    if (f.giant || f.triple > 0) {
      ctx.fillStyle = f.giant ? '#ff7a8a' : '#ffd166';
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.giant ? '巨能' : `散射×${f.triple}`, f.x, f.y - f.r - 30);
    }
  }

  banner(ctx, m) {
    let text = '', sub = '', color = '#ffffff';
    if (m.state === 'countdown') {
      const n = Math.ceil(m.countdown - 0.5);
      text = n >= 1 ? String(n) : '开战！';
      sub = m.mode === 'endless' ? `连胜挑战 · 第 ${m.streak + 1} 位挑战者` : `第 ${m.round} 局 · 三局两胜`;
      color = n >= 1 ? '#ffffff' : '#ffd166';
    } else if (m.state === 'roundEnd') {
      const win = m.lastWinner === 'p';
      text = win ? '这一局你赢了！' : '这一局被拿下了';
      sub = m.mode === 'endless' ? (win ? '下一位挑战者正在入场' : '连胜挑战结束') : `比分 ${m.wins.p} : ${m.wins.e}`;
      color = win ? '#6ef0c2' : '#ff8fa3';
    } else return;
    ctx.fillStyle = 'rgba(13,11,38,0.45)';
    ctx.fillRect(0, H / 2 - 70, W, 130);
    ctx.textAlign = 'center';
    ctx.font = `${m.state === 'countdown' && text.length < 3 ? 72 : 48}px Fredoka, "ZCOOL KuaiLe", "Noto Sans SC", sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#140f33'; ctx.strokeText(text, W / 2, H / 2 + 16);
    ctx.fillStyle = color; ctx.fillText(text, W / 2, H / 2 + 16);
    ctx.font = '16px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#d9d4ff';
    ctx.fillText(sub, W / 2, H / 2 + 46);
  }
}
