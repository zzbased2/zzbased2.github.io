import { BOUNDS, BALL_SPEED, ARENAS, OPPONENTS, POWERUPS, DIFFICULTY, endlessOpponent } from './data.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const BASE_SPEED = 245;
const BALL_R = 8;
const SPAWN = { p: { x: 160, y: 300 }, e: { x: 800, y: 300 } };

function segmentHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1);
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy) < r;
}

export function rayHit(x, y, dx, dy, obstacles, r = BALL_R) {
  let best = Infinity, nx = 0, ny = 0;
  if (dx > 0) { const t = (BOUNDS.r - r - x) / dx; if (t < best) { best = t; nx = -1; ny = 0; } }
  if (dx < 0) { const t = (BOUNDS.l + r - x) / dx; if (t < best) { best = t; nx = 1; ny = 0; } }
  if (dy > 0) { const t = (BOUNDS.b - r - y) / dy; if (t < best) { best = t; nx = 0; ny = -1; } }
  if (dy < 0) { const t = (BOUNDS.t + r - y) / dy; if (t < best) { best = t; nx = 0; ny = 1; } }
  for (const o of obstacles) {
    const R = o.r + r, fx = x - o.x, fy = y - o.y;
    const b = fx * dx + fy * dy, c = fx * fx + fy * fy - R * R;
    const disc = b * b - c;
    if (disc <= 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0.001 && t < best) {
      best = t;
      nx = (x + dx * t - o.x) / R;
      ny = (y + dy * t - o.y) / R;
    }
  }
  if (!Number.isFinite(best)) best = 0;
  return { t: best, x: x + dx * best, y: y + dy * best, nx, ny };
}

function makeFighter(side, hp) {
  return { side, x: SPAWN[side].x, y: SPAWN[side].y, r: 21, vx: 0, vy: 0, hp, maxHp: hp, energy: 3, maxEnergy: 3, fireCd: 0, shield: 0, shieldCd: 0, dash: 0, dashCd: 0, dashDir: 0, invuln: 0, hurt: 0, swift: 0, triple: 0, giant: false, facing: side === 'p' ? 0 : Math.PI, aim: side === 'p' ? 0 : Math.PI, speedMul: 1, trail: [], brain: null };
}

export class Match {
  constructor(notify = () => {}) {
    this.notify = notify;
    this.state = 'idle';
    this.mode = 'tournament';
    this.balls = [];
    this.particles = [];
    this.floaters = [];
    this.obstacles = [];
    this.time = 0;
    this.obsTime = 0;
    this.nextId = 1;
    this.shake = 0;
    this.powerup = null;
    this.input = { move: { x: 0, y: 0 }, aim: null, fireHeld: false, touchAim: false, queue: new Set() };
    this.diff = DIFFICULTY.easy;
    this.setOpponent(OPPONENTS[0]);
    this.player = makeFighter('p', 3);
  }

  emit(type, data) { this.notify({ type, data, match: this }); }

  start(config) {
    this.mode = config.mode === 'endless' ? 'endless' : 'tournament';
    this.diff = DIFFICULTY[config.difficulty] || DIFFICULTY.easy;
    this.assist = config.assist !== false;
    this.opponentIndex = clamp(Number.isInteger(config.opponentIndex) ? config.opponentIndex : 0, 0, OPPONENTS.length - 1);
    this.wins = { p: 0, e: 0 };
    this.round = 0;
    this.streak = 0;
    this.lastWinner = null;
    this.result = null;
    this.stats = { shots: 0, hits: 0, taken: 0, reflects: 0, clashes: 0, roundsLost: 0, powerups: 0 };
    this.player = makeFighter('p', this.diff.hp);
    this.setOpponent(this.mode === 'endless' ? endlessOpponent(0) : OPPONENTS[this.opponentIndex]);
    this.newRound(true);
  }

  setOpponent(op) {
    this.opponent = op;
    this.arena = ARENAS[op.arena];
    this.obstacles = this.arena.obstacles.map(o => ({ ...o, x: o.x ?? 0, y: o.y ?? 0 }));
    this.updateObstacles(0);
    this.enemy = makeFighter('e', this.mode === 'endless' ? 2 : 3);
    this.enemy.speedMul = (op.ai.speed / BASE_SPEED) * this.diff.aiMul;
  }

  resetFighter(f) {
    Object.assign(f, { x: SPAWN[f.side].x, y: SPAWN[f.side].y, vx: 0, vy: 0, energy: f.maxEnergy, fireCd: 0, shield: 0, shieldCd: 0, dash: 0, dashCd: 0, invuln: 0, hurt: 0, swift: 0, triple: 0, giant: false, facing: f.side === 'p' ? 0 : Math.PI, aim: f.side === 'p' ? 0 : Math.PI, trail: [] });
  }

  newRound(resetPlayerHp = true) {
    this.resetFighter(this.player);
    this.resetFighter(this.enemy);
    if (resetPlayerHp) this.player.hp = this.player.maxHp;
    this.enemy.hp = this.enemy.maxHp;
    this.enemy.brain = { strafeDir: Math.random() < 0.5 ? -1 : 1, strafeT: rand(0.6, 1.4), fireT: rand(0.9, 1.5), dodgeT: 0, dodgeX: 0, dodgeY: 0, decisions: new Map() };
    this.balls = [];
    this.powerup = null;
    this.powerTimer = rand(5, 7);
    this.round++;
    this.state = 'countdown';
    this.countdown = 2.6;
    this.fightTime = 0;
    this.input.queue.clear();
    this.emit('roundStart', { round: this.round });
  }

  burst(x, y, color, count = 12, speed = 160, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color, size: size * (0.6 + Math.random() * 0.7) });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.1 });
    if (this.floaters.length > 12) this.floaters.shift();
  }

  updateObstacles(dt) {
    this.obsTime += dt;
    for (const o of this.obstacles) {
      if (!o.orbit) continue;
      const a = o.orbit.phase + o.orbit.speed * this.obsTime;
      o.x = o.orbit.cx + Math.cos(a) * o.orbit.radius;
      o.y = o.orbit.cy + Math.sin(a) * o.orbit.radius;
    }
  }

  updateEffects(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.y -= 34 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  step(dt) {
    this.time += dt;
    this.updateEffects(dt);
    if (this.state === 'countdown') {
      this.updateObstacles(dt);
      this.countdown -= dt;
      if (this.countdown <= 0) { this.state = 'fight'; this.emit('fight'); }
      this.input.queue.clear();
      return;
    }
    if (this.state === 'roundEnd') {
      this.updateObstacles(dt);
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) this.afterRound();
      this.input.queue.clear();
      return;
    }
    if (this.state !== 'fight') { this.input.queue.clear(); return; }
    this.fightTime += dt;
    this.updateObstacles(dt);
    const playerIntent = this.playerIntent();
    const enemyIntent = this.aiIntent(dt);
    this.applyFighter(this.player, playerIntent, dt);
    this.applyFighter(this.enemy, enemyIntent, dt);
    this.separate();
    this.updateBalls(dt);
    if (this.state === 'fight') this.updatePowerup(dt);
    this.input.queue.clear();
  }

  autoAim(from, target, lead = 0.5) {
    const t = Math.hypot(target.x - from.x, target.y - from.y) / BALL_SPEED * lead;
    return Math.atan2(target.y + target.vy * t - from.y, target.x + target.vx * t - from.x);
  }

  playerIntent() {
    const p = this.player, e = this.enemy, q = this.input.queue;
    let mx = this.input.move.x || 0, my = this.input.move.y || 0;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    let aim;
    if (this.input.touchAim) aim = this.autoAim(p, e);
    else if (this.input.aim) {
      aim = Math.atan2(this.input.aim.y - p.y, this.input.aim.x - p.x);
      if (this.assist) { const a = this.autoAim(p, e); if (Math.abs(angleDiff(aim, a)) < 0.14) aim = a; }
    } else aim = this.assist ? this.autoAim(p, e) : p.facing;
    return { mx, my, aim, fire: q.has('fire') || this.input.fireHeld, shield: q.has('shield'), dash: q.has('dash') };
  }

  applyFighter(f, it, dt) {
    f.energy = Math.min(f.maxEnergy, f.energy + dt / 0.85);
    f.fireCd -= dt; f.shieldCd -= dt; f.dashCd -= dt;
    f.shield = Math.max(0, f.shield - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.hurt = Math.max(0, f.hurt - dt);
    f.swift = Math.max(0, f.swift - dt);
    if (Number.isFinite(it.aim)) f.aim = it.aim;
    const moving = Math.abs(it.mx) > 0.05 || Math.abs(it.my) > 0.05;
    if (moving) f.facing = Math.atan2(it.my, it.mx);
    if (it.dash && f.dashCd <= 0 && f.dash <= 0) {
      f.dash = 0.17; f.dashCd = 1.3;
      f.dashDir = moving ? Math.atan2(it.my, it.mx) : f.facing;
      this.burst(f.x, f.y, '#ffffff', 8, 120, 2.5);
      this.emit('dash', f.side);
    }
    if (it.shield && f.shieldCd <= 0) {
      f.shield = 0.4; f.shieldCd = 1.8;
      this.emit('shield', f.side);
    }
    if (it.fire && f.fireCd <= 0 && f.energy >= 1 && f.shield <= 0) this.fire(f, f.aim);
    if (f.dash > 0) {
      f.dash -= dt;
      f.vx = Math.cos(f.dashDir) * 760;
      f.vy = Math.sin(f.dashDir) * 760;
      f.trail.push({ x: f.x, y: f.y });
      if (f.trail.length > 8) f.trail.shift();
    } else {
      const speed = BASE_SPEED * f.speedMul * (f.swift > 0 ? 1.35 : 1) * (f.shield > 0 ? 0.55 : 1);
      const k = Math.min(1, dt * 14);
      f.vx += (it.mx * speed - f.vx) * k;
      f.vy += (it.my * speed - f.vy) * k;
      if (f.trail.length) f.trail.shift();
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    this.collideBody(f);
  }

  collideBody(f) {
    for (const o of this.obstacles) {
      const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 0.001, min = f.r + o.r;
      if (d < min) { f.x = o.x + dx / d * min; f.y = o.y + dy / d * min; }
    }
    f.x = clamp(f.x, BOUNDS.l + f.r, BOUNDS.r - f.r);
    f.y = clamp(f.y, BOUNDS.t + f.r, BOUNDS.b - f.r);
  }

  separate() {
    const a = this.player, b = this.enemy;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, min = a.r + b.r;
    if (d < min) {
      const push = (min - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      this.collideBody(a); this.collideBody(b);
    }
  }

  fire(f, angle) {
    f.energy -= 1;
    f.fireCd = 0.24;
    const spawn = (a, giant) => {
      const r = giant ? 17 : BALL_R, sp = giant ? BALL_SPEED * 0.78 : BALL_SPEED;
      this.balls.push({ id: this.nextId++, owner: f.side, x: f.x + Math.cos(a) * (f.r + r + 2), y: f.y + Math.sin(a) * (f.r + r + 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, giant, bounces: 0, maxBounces: giant ? 2 : 3, life: 4, reflected: false, trail: [], dead: false });
    };
    if (f.giant) { f.giant = false; spawn(angle, true); }
    else if (f.triple > 0) { f.triple--; for (const offset of [-0.2, 0, 0.2]) spawn(angle + offset, false); }
    else spawn(angle, false);
    if (f.side === 'p') this.stats.shots++;
    this.emit('fire', f.side);
  }

  updateBalls(dt) {
    for (const b of this.balls) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
      let bounced = false;
      if (b.x - b.r < BOUNDS.l) { b.x = BOUNDS.l + b.r; b.vx = Math.abs(b.vx); bounced = true; }
      if (b.x + b.r > BOUNDS.r) { b.x = BOUNDS.r - b.r; b.vx = -Math.abs(b.vx); bounced = true; }
      if (b.y - b.r < BOUNDS.t) { b.y = BOUNDS.t + b.r; b.vy = Math.abs(b.vy); bounced = true; }
      if (b.y + b.r > BOUNDS.b) { b.y = BOUNDS.b - b.r; b.vy = -Math.abs(b.vy); bounced = true; }
      for (const o of this.obstacles) {
        const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy) || 0.001;
        if (d < b.r + o.r) {
          const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
          if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
          b.x = o.x + nx * (b.r + o.r + 0.5);
          b.y = o.y + ny * (b.r + o.r + 0.5);
          bounced = true;
        }
      }
      if (bounced) {
        b.bounces++;
        if (b.bounces > b.maxBounces) { b.dead = true; this.burst(b.x, b.y, this.ballColor(b), 6, 90, 2); }
        else { this.burst(b.x, b.y, this.ballColor(b), 3, 70, 2); this.emit('bounce'); }
      }
      if (b.life <= 0) b.dead = true;
    }
    for (let i = 0; i < this.balls.length; i++) {
      const a = this.balls[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.balls.length; j++) {
        const b = this.balls[j];
        if (b.dead || a.owner === b.owner) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) {
          if (a.giant && !b.giant) b.dead = true;
          else if (b.giant && !a.giant) a.dead = true;
          else { a.dead = true; b.dead = true; }
          this.stats.clashes++;
          this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffffff', 14, 190, 2.5);
          this.emit('clash');
          if (a.dead) break;
        }
      }
    }
    if (this.state === 'fight') {
      for (const b of this.balls) {
        if (b.dead) continue;
        for (const f of [this.player, this.enemy]) {
          if (b.owner === f.side || this.state !== 'fight') continue;
          if (Math.hypot(b.x - f.x, b.y - f.y) >= b.r + f.r) continue;
          if (f.shield > 0) this.reflect(b, f);
          else if (f.invuln <= 0 && f.dash <= 0) this.damage(b, f);
          if (b.dead) break;
        }
      }
    }
    this.balls = this.balls.filter(b => !b.dead);
  }

  ballColor(b) {
    return b.owner === 'p' ? (this.playerColor || '#6ee7c2') : this.opponent.color;
  }

  reflect(b, f) {
    const target = f.side === 'p' ? this.enemy : this.player;
    const speed = Math.min(720, Math.hypot(b.vx, b.vy) * 1.15);
    const a = Math.atan2(target.y - f.y, target.x - f.x) + rand(-0.06, 0.06);
    b.owner = f.side;
    b.vx = Math.cos(a) * speed;
    b.vy = Math.sin(a) * speed;
    b.x = f.x + Math.cos(a) * (f.r + b.r + 3);
    b.y = f.y + Math.sin(a) * (f.r + b.r + 3);
    b.bounces = 0;
    b.life = 4;
    b.reflected = true;
    f.shieldCd = Math.min(f.shieldCd, 0.5);
    if (f.side === 'p') this.stats.reflects++;
    this.burst(b.x, b.y, '#bff4ff', 16, 210, 2.6);
    this.floater(f.x, f.y - 42, '完美反击！', '#bff4ff');
    this.emit('reflect', f.side);
  }

  damage(b, f) {
    b.dead = true;
    f.hp -= 1;
    f.invuln = 1.0;
    f.hurt = 0.5;
    const s = Math.hypot(b.vx, b.vy) || 1;
    f.vx += b.vx / s * 280;
    f.vy += b.vy / s * 280;
    if (f.side === 'p') { this.stats.taken++; this.shake = 0.6; }
    else { this.stats.hits++; this.shake = Math.max(this.shake, 0.25); }
    this.burst(f.x, f.y, f.side === 'p' ? '#ff8fa3' : '#ffd166', 18, 220, 3);
    this.floater(f.x, f.y - 40, f.side === 'p' ? '-1' : '命中！', f.side === 'p' ? '#ff8fa3' : '#ffd166');
    this.emit('hit', f.side);
    if (f.hp <= 0) this.endRound(f.side === 'p' ? 'e' : 'p');
  }

  endRound(winner) {
    if (this.state !== 'fight') return;
    this.state = 'roundEnd';
    this.roundTimer = 2.1;
    this.lastWinner = winner;
    this.wins[winner]++;
    if (winner === 'e') this.stats.roundsLost++;
    const loser = winner === 'p' ? this.enemy : this.player;
    this.burst(loser.x, loser.y, '#ffffff', 30, 260, 3.5);
    for (const b of this.balls) this.burst(b.x, b.y, this.ballColor(b), 3, 60, 2);
    this.balls = [];
    this.powerup = null;
    this.emit('round', winner);
  }

  afterRound() {
    if (this.mode === 'tournament') {
      if (this.wins.p >= 2 || this.wins.e >= 2) {
        const win = this.wins.p >= 2;
        const stars = win ? 1 + (this.stats.roundsLost === 0 ? 1 : 0) + (this.stats.reflects > 0 ? 1 : 0) : 0;
        this.state = 'over';
        this.result = { mode: 'tournament', win, stars, opponentIndex: this.opponentIndex, stats: { ...this.stats }, wins: { ...this.wins } };
        this.emit('matchEnd', this.result);
      } else this.newRound(true);
      return;
    }
    if (this.lastWinner === 'p') {
      this.streak++;
      if (this.streak % 3 === 0 && this.player.hp < this.player.maxHp) {
        this.player.hp++;
        this.floater(this.player.x, this.player.y - 42, '+1 生命', '#ff9ecb');
      }
      const hp = this.player.hp;
      this.setOpponent(endlessOpponent(this.streak));
      this.player.hp = hp;
      this.newRound(false);
    } else {
      this.state = 'over';
      this.result = { mode: 'endless', win: false, streak: this.streak, stats: { ...this.stats } };
      this.emit('matchEnd', this.result);
    }
  }

  updatePowerup(dt) {
    if (!this.powerup) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) this.spawnPowerup();
      return;
    }
    const pu = this.powerup;
    pu.life -= dt;
    if (pu.life <= 0) { this.powerup = null; this.powerTimer = rand(4, 6); return; }
    for (const f of [this.player, this.enemy]) {
      if (Math.hypot(f.x - pu.x, f.y - pu.y) < f.r + 16) { this.applyPowerup(f, pu); break; }
    }
  }

  spawnPowerup() {
    const choices = POWERUPS.filter(p => p.id !== 'heart' || this.player.hp < this.player.maxHp || this.enemy.hp < this.enemy.maxHp);
    const type = choices[Math.floor(Math.random() * choices.length)];
    for (let i = 0; i < 30; i++) {
      const x = rand(320, 640), y = rand(130, 470);
      const blocked = this.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 34) || Math.hypot(this.player.x - x, this.player.y - y) < 90 || Math.hypot(this.enemy.x - x, this.enemy.y - y) < 90;
      if (!blocked) { this.powerup = { ...type, x, y, life: 9 }; this.emit('powerSpawn'); return; }
    }
    this.powerTimer = 1;
  }

  applyPowerup(f, pu) {
    if (pu.id === 'triple') f.triple = 3;
    if (pu.id === 'giant') f.giant = true;
    if (pu.id === 'swift') f.swift = 6;
    if (pu.id === 'heart') f.hp = Math.min(f.maxHp, f.hp + 1);
    if (f.side === 'p') this.stats.powerups++;
    this.burst(pu.x, pu.y, pu.color, 18, 180, 3);
    this.floater(pu.x, pu.y - 26, pu.name, pu.color);
    this.powerup = null;
    this.powerTimer = rand(6, 8.5);
    this.emit('power', { side: f.side, power: pu });
  }

  lineClear(ax, ay, bx, by, pad = 9) {
    return !this.obstacles.some(o => segmentHitsCircle(ax, ay, bx, by, o.x, o.y, o.r + pad));
  }

  bankShot(me, tx, ty) {
    const r = BALL_R, options = [];
    const walls = [
      { axis: 'x', v: BOUNDS.l + r }, { axis: 'x', v: BOUNDS.r - r },
      { axis: 'y', v: BOUNDS.t + r }, { axis: 'y', v: BOUNDS.b - r }
    ];
    for (const w of walls) {
      const mx = w.axis === 'x' ? 2 * w.v - tx : tx;
      const my = w.axis === 'y' ? 2 * w.v - ty : ty;
      const denom = w.axis === 'x' ? mx - me.x : my - me.y;
      if (Math.abs(denom) < 1) continue;
      const s = ((w.axis === 'x' ? w.v - me.x : w.v - me.y)) / denom;
      if (s <= 0.05 || s >= 0.95) continue;
      const hx = me.x + (mx - me.x) * s, hy = me.y + (my - me.y) * s;
      if (w.axis === 'x' && (hy < BOUNDS.t + 24 || hy > BOUNDS.b - 24)) continue;
      if (w.axis === 'y' && (hx < BOUNDS.l + 24 || hx > BOUNDS.r - 24)) continue;
      if (!this.lineClear(me.x, me.y, hx, hy) || !this.lineClear(hx, hy, tx, ty)) continue;
      options.push({ angle: Math.atan2(my - me.y, mx - me.x), length: Math.hypot(mx - me.x, my - me.y) });
    }
    if (!options.length) return null;
    options.sort((a, b) => a.length - b.length);
    return options[Math.random() < 0.7 ? 0 : Math.min(1, options.length - 1)].angle;
  }

  aiAim(me, foe, ai, mul) {
    const dist = Math.hypot(foe.x - me.x, foe.y - me.y);
    const t = dist / BALL_SPEED;
    const tx = clamp(foe.x + foe.vx * t * ai.lead, BOUNDS.l + 20, BOUNDS.r - 20);
    const ty = clamp(foe.y + foe.vy * t * ai.lead, BOUNDS.t + 20, BOUNDS.b - 20);
    const err = (Math.random() * 2 - 1) * ai.aimError / mul;
    const clear = this.lineClear(me.x, me.y, tx, ty);
    if (clear && Math.random() >= ai.bank) return Math.atan2(ty - me.y, tx - me.x) + err;
    const bank = this.bankShot(me, tx, ty);
    if (bank !== null) return bank + err * 0.6;
    if (clear) return Math.atan2(ty - me.y, tx - me.x) + err;
    return null;
  }

  aiIntent(dt) {
    const me = this.enemy, foe = this.player, ai = this.opponent.ai, st = me.brain, mul = this.diff.aiMul;
    st.strafeT -= dt;
    if (st.strafeT <= 0) { if (Math.random() < 0.6) st.strafeDir *= -1; st.strafeT = rand(0.9, 2.1); }
    st.fireT -= dt;
    st.dodgeT = Math.max(0, st.dodgeT - dt);
    if (st.decisions.size > 40) {
      const alive = new Set(this.balls.map(b => b.id));
      for (const id of st.decisions.keys()) if (!alive.has(id)) st.decisions.delete(id);
    }
    let dash = false, shield = false, fire = false, threat = null;
    for (const b of this.balls) {
      if (b.owner === me.side) continue;
      const dx = b.x - me.x, dy = b.y - me.y, vv = b.vx * b.vx + b.vy * b.vy || 1;
      const t = -(dx * b.vx + dy * b.vy) / vv;
      if (t < 0 || t > 0.75) continue;
      const cx = dx + b.vx * t, cy = dy + b.vy * t;
      if (Math.hypot(cx, cy) > me.r + b.r + 18) continue;
      if (!st.decisions.has(b.id)) {
        let act = 'none';
        if (Math.random() < Math.min(0.95, ai.shield * mul)) act = 'shield';
        else if (Math.random() < Math.min(0.95, ai.dash * mul)) act = 'dash';
        else if (Math.random() < Math.min(0.95, ai.dodge * mul)) act = 'dodge';
        st.decisions.set(b.id, act);
      }
      if (!threat || t < threat.t) threat = { b, t, cx, cy, act: st.decisions.get(b.id) };
    }
    if (threat) {
      if (threat.act === 'shield' && threat.t < 0.2 && me.shieldCd <= 0) shield = true;
      if (threat.act === 'dash' && me.dashCd <= 0) dash = true;
      if (threat.act === 'dodge' || threat.act === 'dash' || (threat.act === 'shield' && me.shieldCd > 0)) {
        const bl = Math.hypot(threat.b.vx, threat.b.vy) || 1;
        let px = -threat.b.vy / bl, py = threat.b.vx / bl;
        if (px * threat.cx + py * threat.cy > 0) { px = -px; py = -py; }
        st.dodgeX = px; st.dodgeY = py; st.dodgeT = 0.35;
      }
    }
    let mx = 0, my = 0;
    if (st.dodgeT > 0) { mx = st.dodgeX; my = st.dodgeY; }
    else {
      const pu = this.powerup;
      const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy) || 1;
      if (pu && Math.hypot(pu.x - me.x, pu.y - me.y) < Math.hypot(pu.x - foe.x, pu.y - foe.y) + 40 + 80 * ai.aggression) {
        mx = pu.x - me.x; my = pu.y - me.y;
      } else {
        const ux = dx / d, uy = dy / d;
        const radial = d > ai.range + 50 ? 1 : d < ai.range - 50 ? -1 : 0;
        mx = ux * radial - uy * st.strafeDir * 0.85;
        my = uy * radial + ux * st.strafeDir * 0.85;
      }
    }
    const margin = 80;
    if (me.x < BOUNDS.l + margin) mx += 1.2;
    if (me.x > BOUNDS.r - margin) mx -= 1.2;
    if (me.y < BOUNDS.t + margin) my += 1.2;
    if (me.y > BOUNDS.b - margin) my -= 1.2;
    for (const o of this.obstacles) {
      const ox = me.x - o.x, oy = me.y - o.y, od = Math.hypot(ox, oy) || 1;
      if (od < o.r + me.r + 45) { mx += ox / od * 1.4; my += oy / od * 1.4; }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0.1) { mx /= ml; my /= ml; } else { mx = 0; my = 0; }
    let aim = Math.atan2(foe.y - me.y, foe.x - me.x);
    if (st.fireT <= 0 && me.energy >= 1 && !shield) {
      const plan = this.aiAim(me, foe, ai, mul);
      if (plan !== null) { aim = plan; fire = true; st.fireT = rand(ai.fireGap[0], ai.fireGap[1]) / mul; }
      else st.fireT = 0.25;
    }
    return { mx, my, aim, fire, shield, dash };
  }
}
