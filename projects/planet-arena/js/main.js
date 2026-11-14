import { W, H, OPPONENTS, ARENAS, SKINS, DIFFICULTY, SAVE_KEY, readSave, blankSave, totalStars, rankFor, nextRank } from './data.js';
import { Match } from './engine.js';
import { Renderer, drawPortrait, drawHeroScene, lookForSkin, lookForOpponent } from './render.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);
const STEP = 1 / 120;
const loaded = (() => { try { return readSave(window.localStorage); } catch { return { save: blankSave(), available: false }; } })();
let save = loaded.save;
let storageOk = loaded.available;

const sfx = new Sfx();
sfx.enabled = save.sound;
const match = new Match(onMatchEvent);
const canvas = $('arena');
const renderer = new Renderer(canvas);
const heroCanvas = $('hero-canvas');
const heroCtx = heroCanvas.getContext('2d');
const modal = $('modal');

let view = 'home';
let modalDismissible = true;
let lastFocus = null;
let toastTimer = 0;
let lastCountdown = 0;
const hudCache = {};

const keysHeld = new Set();
let mouseFire = false;
let touchFire = false;
const joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };

const btn = (extra = '') => `inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 ${extra}`;
const primary = btn('bg-gradient-to-r from-[#ffd166] to-[#ff9f6e] text-[#1a1240] shadow-lg shadow-[#ff9f6e]/20');
const ghost = btn('border border-white/15 bg-white/5 text-[#ece9ff] hover:bg-white/10 font-normal');

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); storageOk = true; }
  catch { storageOk = false; }
  $('save-status').textContent = storageOk ? '进度自动保存在这个浏览器里' : '当前浏览器无法保存进度，关闭页面后成绩可能丢失';
}

function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function clearInput() {
  keysHeld.clear();
  mouseFire = false;
  touchFire = false;
  joy.id = null; joy.dx = 0; joy.dy = 0;
  $('joy-knob').style.transform = 'translate(-50%, -50%)';
  match.input.move = { x: 0, y: 0 };
  match.input.fireHeld = false;
  match.input.touchAim = false;
  match.input.queue.clear();
}

function openModal(title, html, opts = {}) {
  modalDismissible = opts.dismissible !== false;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-close').classList.toggle('hidden', !modalDismissible);
  if (!modal.open) { lastFocus = document.activeElement; modal.showModal(); }
  clearInput();
  if (opts.after) opts.after();
  const first = modal.querySelector('[data-autofocus]');
  if (first) first.focus();
}

function closeModal() {
  if (!modal.open) return;
  modal.close();
  clearInput();
  if (view === 'game') canvas.focus({ preventScroll: true });
  else if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
}

function syncSound() {
  $('sound-button').innerHTML = `<i class="ri-volume-${save.sound ? 'up' : 'mute'}-line text-lg" aria-hidden="true"></i>`;
  $('sound-button').setAttribute('aria-label', save.sound ? '关闭声音' : '开启声音');
  $('sound-button').setAttribute('aria-pressed', String(save.sound));
}

function starsHtml(n, size = 'text-base') {
  return [0, 1, 2].map(i => `<i class="ri-star-${i < n ? 'fill text-[#ffd166]' : 'line text-white/20'} ${size}" aria-hidden="true"></i>`).join('');
}

function nextTarget() {
  const idx = OPPONENTS.findIndex((_, i) => !save.stars[i]);
  if (idx === -1) return OPPONENTS.length - 1;
  return Math.min(idx, save.unlocked - 1);
}

function renderHome() {
  const stars = totalStars(save);
  const rank = rankFor(stars), nr = nextRank(stars);
  $('stat-rank').textContent = rank.name;
  $('stat-rank').style.color = rank.color;
  $('stat-rank-next').textContent = nr ? `再拿 ${nr.need - stars} 颗星升到「${nr.name}」` : '已经是最高段位！';
  $('stat-stars').textContent = stars;
  $('stat-wins').textContent = save.wins;
  $('stat-reflects').textContent = `累计完美反击 ${save.reflects} 次`;
  $('stat-streak').textContent = save.bestStreak;
  const target = nextTarget();
  const allBeaten = OPPONENTS.every((_, i) => save.stars[i]);
  $('play-label').textContent = allBeaten ? '重返星环王座' : save.stars[0] ? `挑战 ${OPPONENTS[target].name}` : '挑战第一位擂主';
  $('hero-next').textContent = `${OPPONENTS[target].name} · ${OPPONENTS[target].title}`;
  $('ladder-grid').innerHTML = OPPONENTS.map((op, i) => {
    const locked = i >= save.unlocked, s = save.stars[i] || 0;
    return `<button data-action="challenge" data-id="${i}" ${locked ? 'disabled' : ''} class="group relative overflow-hidden rounded-3xl border ${i === target && !locked ? 'border-[#ffd166]/60' : 'border-white/10'} bg-white/[0.04] p-4 text-left transition hover:-translate-y-1 hover:border-[#ffd166]/50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:border-white/10">
      <div class="relative overflow-hidden rounded-2xl ${locked ? 'opacity-40 grayscale' : ''}"><canvas data-portrait="${i}" width="320" height="220" class="block aspect-[16/11] w-full" aria-hidden="true"></canvas>
      <span class="absolute left-2 top-2 rounded-full bg-[#140f33]/80 px-2 py-0.5 text-[10px] text-[#cfc9ff]">第 ${i + 1} 擂 · ${ARENAS[op.arena].name}</span>
      ${locked ? '<span class="absolute inset-0 grid place-items-center text-3xl text-white/80"><i class="ri-lock-2-line" aria-hidden="true"></i></span>' : ''}</div>
      <div class="mt-3 flex items-center justify-between"><p class="font-display text-xl">${op.name}</p><span>${starsHtml(s, 'text-sm')}</span></div>
      <p class="text-xs" style="color:${op.color}">${op.title}</p>
      <p class="mt-2 min-h-[2.5rem] text-xs leading-5 text-[#a9a3d9]">${op.trait}</p>
      <p class="mt-3 border-t border-white/10 pt-3 text-xs ${locked ? 'text-[#7c76b2]' : 'text-[#ffe3a1]'}">${locked ? '击败上一位擂主后解锁' : s ? (s === 3 ? '已满星，随时再战' : '已击败 · 还能拿更多星') : '点击发起挑战 →'}</p>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-portrait]').forEach(el => {
    const op = OPPONENTS[Number(el.dataset.portrait)];
    drawPortrait(el, lookForOpponent(op), ARENAS[op.arena].sky);
  });
  $('skin-grid').innerHTML = SKINS.map((skin, i) => {
    const unlocked = stars >= skin.need, active = save.skin === i;
    return `<button data-action="skin" data-id="${i}" ${unlocked ? '' : 'disabled'} class="rounded-3xl border ${active ? 'border-[#6ef0c2]/70 bg-[#6ef0c2]/10' : 'border-white/10 bg-white/[0.04]'} p-3 text-center transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:hover:translate-y-0">
      <canvas data-skin="${i}" width="200" height="150" class="block aspect-[4/3] w-full rounded-2xl ${unlocked ? '' : 'opacity-35 grayscale'}" aria-hidden="true"></canvas>
      <p class="mt-2 text-sm font-bold">${skin.name}</p>
      <p class="mt-1 text-[11px] ${active ? 'text-[#6ef0c2]' : 'text-[#9f98d6]'}">${active ? '使用中' : unlocked ? '点击换上' : `需要 ${skin.need} 颗星`}</p>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-skin]').forEach(el => drawPortrait(el, lookForSkin(SKINS[Number(el.dataset.skin)])));
  persist();
}

function showHome() {
  if (modal.open) modal.close();
  view = 'home';
  match.state = 'idle';
  clearInput();
  $('home-view').classList.remove('hidden');
  $('game-view').classList.add('hidden');
  renderHome();
}

function showGame() {
  view = 'game';
  $('home-view').classList.add('hidden');
  $('game-view').classList.remove('hidden');
  updateTouchPanel();
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  refreshOpponentHud();
  drawPortrait($('hud-p-avatar'), lookForSkin(SKINS[save.skin]));
  $('hud-p-skin').textContent = SKINS[save.skin].name;
  window.scrollTo({ top: 0, behavior: save.reduced ? 'auto' : 'smooth' });
  canvas.focus({ preventScroll: true });
}

function refreshOpponentHud() {
  const op = match.opponent;
  drawPortrait($('hud-e-avatar'), lookForOpponent(op), ARENAS[op.arena].sky);
  $('hud-e-name').textContent = `${op.name} · ${op.title}`;
  $('hud-arena').textContent = match.mode === 'endless' ? `无尽连胜 · ${ARENAS[op.arena].name}` : `第 ${match.opponentIndex + 1} 擂 · ${ARENAS[op.arena].name} · ${match.diff.name}`;
}

function startTournament(index) {
  if (!Number.isInteger(index) || index < 0 || index >= save.unlocked) return;
  sfx.unlock();
  match.playerColor = SKINS[save.skin].body;
  match.start({ mode: 'tournament', opponentIndex: index, difficulty: save.difficulty, assist: save.assist });
  showGame();
  const op = OPPONENTS[index];
  openModal(`第 ${index + 1} 擂 · ${op.name}`, `
    <div class="grid gap-5 sm:grid-cols-[180px_1fr]">
      <canvas id="intro-portrait" width="360" height="300" class="w-full rounded-2xl" aria-hidden="true"></canvas>
      <div>
        <p class="text-sm" style="color:${op.color}">${op.title} · ${ARENAS[op.arena].name}</p>
        <p class="mt-3 rounded-2xl bg-white/5 p-4 text-base leading-7">「${op.quote}」</p>
        <p class="mt-3 text-xs text-[#a9a3d9]">擂主特点：${op.trait}</p>
      </div>
    </div>
    <div class="mt-5 rounded-2xl border border-[#ffd166]/25 bg-[#ffd166]/10 p-4 text-sm leading-6 text-[#ffe9b8]"><i class="ri-lightbulb-flash-line mr-1" aria-hidden="true"></i>${op.tip}</div>
    <div class="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-[#b8b2e6]">
      <div class="rounded-xl bg-white/5 p-3"><i class="ri-star-fill text-[#ffd166]" aria-hidden="true"></i><br>赢下比赛</div>
      <div class="rounded-xl bg-white/5 p-3"><i class="ri-star-fill text-[#ffd166]" aria-hidden="true"></i><br>一局不丢</div>
      <div class="rounded-xl bg-white/5 p-3"><i class="ri-star-fill text-[#ffd166]" aria-hidden="true"></i><br>至少 1 次完美反击</div>
    </div>
    <button data-action="close" data-autofocus class="${primary} mt-6 w-full text-base"><i class="ri-sword-line" aria-hidden="true"></i>开战！</button>`,
    { after: () => drawPortrait($('intro-portrait'), lookForOpponent(op), ARENAS[op.arena].sky) });
}

function startEndless() {
  sfx.unlock();
  match.playerColor = SKINS[save.skin].body;
  match.start({ mode: 'endless', difficulty: save.difficulty, assist: save.assist });
  showGame();
  openModal('无尽连胜挑战', `
    <p class="text-sm leading-7 text-[#cfc9ff]">挑战者会一个接一个上场，每局一局定胜负，而且越来越强。你的生命不会自动回满，<span class="text-[#ff9ecb]">每连胜 3 场回复 1 点</span>。能坚持多久？</p>
    <div class="mt-4 grid grid-cols-2 gap-3 text-center">
      <div class="rounded-2xl bg-white/5 p-4"><p class="text-[11px] text-[#9f98d6]">历史最佳</p><p class="mt-1 font-display text-3xl text-[#ff9f6e]">${save.bestStreak}</p></div>
      <div class="rounded-2xl bg-white/5 p-4"><p class="text-[11px] text-[#9f98d6]">难度</p><p class="mt-1 font-display text-3xl">${DIFFICULTY[save.difficulty].name}</p></div>
    </div>
    <button data-action="close" data-autofocus class="${primary} mt-6 w-full text-base"><i class="ri-fire-line" aria-hidden="true"></i>开始连胜</button>`);
}

function heartsHtml(hp, max) {
  return Array.from({ length: max }, (_, i) => `<i class="ri-heart-${i < hp ? 'fill text-[#ff7a8a]' : 'line text-white/25'} text-base sm:text-lg" aria-hidden="true"></i>`).join('');
}

function setHtml(id, html) {
  if (hudCache[id] === html) return;
  hudCache[id] = html;
  $(id).innerHTML = html;
}

function updateHud() {
  const p = match.player, e = match.enemy;
  setHtml('hud-p-hearts', heartsHtml(p.hp, p.maxHp));
  setHtml('hud-e-hearts', heartsHtml(e.hp, e.maxHp));
  if (match.mode === 'endless') setHtml('hud-rounds', `<span class="font-display text-xl text-[#ff9f6e]"><i class="ri-fire-fill" aria-hidden="true"></i> ${match.streak}</span><span class="text-[11px] text-[#9f98d6]">连胜</span>`);
  else {
    const pip = (on, c) => `<span class="inline-block h-3 w-3 rounded-full ${on ? '' : 'bg-white/15'}" style="${on ? `background:${c}` : ''}"></span>`;
    setHtml('hud-rounds', `${pip(match.wins.p >= 1, '#6ef0c2')}${pip(match.wins.p >= 2, '#6ef0c2')}<span class="mx-1 font-display text-base text-[#cfc9ff]">VS</span>${pip(match.wins.e >= 2, match.opponent.color)}${pip(match.wins.e >= 1, match.opponent.color)}`);
  }
  const pips = Array.from({ length: p.maxEnergy }, (_, i) => {
    const fill = Math.max(0, Math.min(1, p.energy - i));
    return `<span class="relative block h-2.5 w-6 overflow-hidden rounded-full bg-white/10"><span class="absolute inset-y-0 left-0 rounded-full ${fill >= 1 ? 'bg-[#6ef0c2]' : 'bg-[#6ef0c2]/50'}" style="width:${Math.round(fill * 100)}%"></span></span>`;
  }).join('');
  setHtml('hud-energy', pips);
  $('cd-shield').style.setProperty('--p', (1 - Math.max(0, Math.min(1, p.shieldCd / 1.8))).toFixed(3));
  $('cd-dash').style.setProperty('--p', (1 - Math.max(0, Math.min(1, p.dashCd / 1.3))).toFixed(3));
  const powers = [];
  if (p.triple > 0) powers.push(`三连发 ×${p.triple}`);
  if (p.giant) powers.push('巨能球待发');
  if (p.swift > 0) powers.push(`疾风靴 ${Math.ceil(p.swift)}s`);
  setHtml('hud-power', powers.length ? `<i class="ri-flashlight-fill" aria-hidden="true"></i> ${powers.join(' · ')}` : '<span class="text-[#8c86c2]">抢到场地中央的能量星可获得道具</span>');
}

function onMatchEvent({ type, data }) {
  if (view !== 'game') return;
  switch (type) {
    case 'fire': sfx.play('fire', data); break;
    case 'bounce': sfx.play('bounce'); break;
    case 'clash': sfx.play('clash'); break;
    case 'reflect': sfx.play('reflect'); break;
    case 'hit': sfx.play('hit', data); break;
    case 'dash': if (data === 'p') sfx.play('dash'); break;
    case 'shield': if (data === 'p') sfx.play('shield'); break;
    case 'power':
      sfx.play('power');
      if (data.side === 'p') toast(`获得「${data.power.name}」：${data.power.desc}`);
      else toast(`${match.opponent.name} 抢到了「${data.power.name}」，小心！`);
      break;
    case 'fight': sfx.play('fight'); break;
    case 'roundStart':
      lastCountdown = 0;
      refreshOpponentHud();
      Object.keys(hudCache).forEach(k => delete hudCache[k]);
      break;
    case 'round': sfx.play(data === 'p' ? 'roundWin' : 'roundLose'); break;
    case 'matchEnd': handleResult(data); break;
    default: break;
  }
}

function handleResult(result) {
  save.matches++;
  save.reflects += result.stats.reflects;
  if (result.mode === 'endless') {
    const prev = save.bestStreak;
    save.bestStreak = Math.max(prev, result.streak);
    persist();
    sfx.play(result.streak > prev ? 'victory' : 'roundLose');
    openModal(result.streak > prev ? '新的连胜纪录！' : '连胜挑战结束', `
      <div class="text-center">
        <p class="text-sm text-[#b8b2e6]">这次你连续击败了</p>
        <p class="my-2 font-display text-7xl text-[#ff9f6e]">${result.streak}</p>
        <p class="text-sm text-[#b8b2e6]">位挑战者 · 历史最佳 ${save.bestStreak}</p>
      </div>
      ${statsHtml(result.stats)}
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <button data-action="endless" data-autofocus class="${primary}"><i class="ri-restart-line" aria-hidden="true"></i>再挑战一次</button>
        <button data-action="home" class="${ghost}">返回大厅</button>
      </div>`, { dismissible: false });
    return;
  }
  const idx = result.opponentIndex, op = OPPONENTS[idx];
  const beforeStars = totalStars(save), beforeRank = rankFor(beforeStars);
  const prevBest = save.stars[idx] || 0;
  let unlockedNew = false;
  if (result.win) {
    save.wins++;
    save.stars[idx] = Math.max(prevBest, result.stars);
    if (idx + 1 < OPPONENTS.length && save.unlocked < idx + 2) { save.unlocked = idx + 2; unlockedNew = true; }
  }
  const afterStars = totalStars(save), afterRank = rankFor(afterStars);
  const newSkins = SKINS.filter(s => s.need > beforeStars && s.need <= afterStars);
  persist();
  sfx.play(result.win ? 'victory' : 'roundLose');
  const reasons = [['赢下比赛', result.win], ['一局不丢', result.win && result.stats.roundsLost === 0], ['完美反击', result.win && result.stats.reflects > 0]];
  const notes = [];
  if (result.win && result.stars > prevBest && prevBest > 0) notes.push(`刷新了对 ${op.name} 的最佳成绩！`);
  if (unlockedNew) notes.push(`解锁新擂主：${OPPONENTS[idx + 1].name} · ${OPPONENTS[idx + 1].title}`);
  if (afterRank.name !== beforeRank.name) notes.push(`段位提升为「${afterRank.name}」！`);
  newSkins.forEach(s => notes.push(`解锁星球外观「${s.name}」`));
  if (result.win && idx === OPPONENTS.length - 1 && prevBest === 0) notes.push('你击败了星环女王，成为新的擂台冠军！');
  const isLast = idx === OPPONENTS.length - 1;
  openModal(result.win ? `战胜 ${op.name}！` : `${op.name} 赢了这一场`, `
    <div class="text-center">
      <p class="font-display text-5xl ${result.win ? 'text-[#6ef0c2]' : 'text-[#ff8fa3]'}">${result.wins.p} : ${result.wins.e}</p>
      <div class="mt-4 flex justify-center gap-3">${reasons.map(([label, ok]) => `<div class="w-24 rounded-2xl bg-white/5 p-3"><i class="ri-star-${ok ? 'fill text-[#ffd166]' : 'line text-white/20'} text-3xl" aria-hidden="true"></i><p class="mt-1 text-[11px] ${ok ? 'text-[#ffe3a1]' : 'text-[#8c86c2]'}">${label}</p></div>`).join('')}</div>
    </div>
    ${statsHtml(result.stats)}
    ${notes.length ? `<ul class="mt-5 space-y-2">${notes.map(n => `<li class="rounded-xl border border-[#6ef0c2]/25 bg-[#6ef0c2]/10 px-4 py-2 text-sm text-[#cffff0]"><i class="ri-sparkling-2-fill mr-1" aria-hidden="true"></i>${n}</li>`).join('')}</ul>` : ''}
    ${result.win ? '' : `<p class="mt-5 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-[#cfc9ff]"><i class="ri-lightbulb-line mr-1 text-[#ffd166]" aria-hidden="true"></i>${op.tip}${save.difficulty === 'standard' ? ' 也可以在设置里切换到「轻松」难度。' : ''}</p>`}
    <div class="mt-6 flex flex-wrap justify-center gap-3">
      ${result.win && !isLast ? `<button data-action="next-opponent" data-autofocus class="${primary}"><i class="ri-arrow-right-line" aria-hidden="true"></i>挑战下一位</button>` : ''}
      <button data-action="rematch" ${result.win && !isLast ? '' : 'data-autofocus'} class="${result.win && !isLast ? ghost : primary}"><i class="ri-restart-line" aria-hidden="true"></i>${result.win ? '再战拿满星' : '再战一次'}</button>
      <button data-action="home" class="${ghost}">返回天梯</button>
    </div>`, { dismissible: false });
}

function statsHtml(s) {
  const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
  const items = [['命中', s.hits], ['命中率', `${acc}%`], ['完美反击', s.reflects], ['对撞抵消', s.clashes]];
  return `<div class="mt-5 grid grid-cols-4 gap-2 text-center">${items.map(([k, v]) => `<div class="rounded-xl bg-white/5 p-3"><p class="font-display text-xl">${v}</p><p class="mt-1 text-[10px] text-[#9f98d6]">${k}</p></div>`).join('')}</div>`;
}

function pauseMenu() {
  if (view !== 'game' || modal.open || !['fight', 'countdown', 'roundEnd'].includes(match.state)) return;
  openModal('暂停一下', `
    <p class="text-sm leading-7 text-[#cfc9ff]">比赛已暂停，准备好了再继续。</p>
    ${controlsHtml()}
    <div class="mt-6 flex flex-wrap gap-3">
      <button data-action="close" data-autofocus class="${primary}"><i class="ri-play-fill" aria-hidden="true"></i>继续比赛</button>
      <button data-action="restart" class="${ghost}"><i class="ri-restart-line" aria-hidden="true"></i>重新开始</button>
      <button data-action="home" class="${ghost}"><i class="ri-home-4-line" aria-hidden="true"></i>返回大厅</button>
    </div>`);
}

function controlsHtml() {
  const rows = [
    ['WASD / 方向键', '移动'],
    ['鼠标移动', '瞄准（虚线显示第一次反弹）'],
    ['鼠标左键 / J', '发射，按住可以连发'],
    ['鼠标右键 / K / Shift', '护盾：在球碰到你前开启，反弹回去'],
    ['空格 / L', '冲刺：瞬间位移，冲刺中不会被击中'],
    ['Esc / P', '暂停']
  ];
  return `<div class="mt-4 grid gap-2 sm:grid-cols-2">${rows.map(([k, v]) => `<div class="rounded-xl bg-white/5 px-4 py-3"><p class="text-sm text-[#ffe3a1]">${k}</p><p class="mt-1 text-xs text-[#b8b2e6]">${v}</p></div>`).join('')}</div>`;
}

function howTo() {
  const rules = [
    ['ri-focus-3-line', '#6ef0c2', '能量球会反弹', '每颗球最多在墙壁和障碍上弹 3 次。借墙反弹，可以绕过障碍从侧面打中对手。'],
    ['ri-shield-star-line', '#8fe3ff', '护盾完美反击', '在对手的球碰到你之前开护盾，球会加速飞回去！成功后护盾冷却会马上缩短。'],
    ['ri-contrast-drop-2-line', '#ffffff', '对撞抵消', '你的球和对手的球撞在一起会一起消失。用它来挡住危险的来球。'],
    ['ri-battery-2-charge-line', '#ffd166', '能量会自动回复', '最多存 3 发，每 0.85 秒回 1 发。不要一口气打光，留一发应急。'],
    ['ri-star-smile-line', '#ff9ecb', '抢夺能量星', '场地中央会出现能量星：三连发、巨能球、疾风靴、星心。擂主也会来抢！'],
    ['ri-trophy-line', '#ff9f6e', '三局两胜拿星星', '赢下比赛 1 星，一局不丢 1 星，至少一次完美反击 1 星。星星决定你的段位。']
  ];
  openModal('擂台规则', `
    <div class="grid gap-3 sm:grid-cols-2">${rules.map(([icon, color, title, text]) => `<div class="rounded-2xl bg-white/5 p-4"><p class="flex items-center gap-2 font-bold"><i class="${icon} text-xl" style="color:${color}" aria-hidden="true"></i>${title}</p><p class="mt-2 text-xs leading-6 text-[#b8b2e6]">${text}</p></div>`).join('')}</div>
    <h3 class="mt-6 font-display text-xl">操作</h3>
    ${controlsHtml()}
    <p class="mt-4 text-xs leading-6 text-[#9f98d6]">触屏：左侧区域拖动移动，右侧按住「发射」会自动瞄准对手。</p>
    <button data-action="close" data-autofocus class="${primary} mt-6 w-full">明白了</button>`);
}

function settings() {
  openModal('设置', `
    <p class="text-sm font-bold">难度（下一场比赛生效）</p>
    <div class="mt-3 grid gap-3 sm:grid-cols-2">${Object.entries(DIFFICULTY).map(([id, d]) => `<button data-action="difficulty" data-value="${id}" aria-pressed="${save.difficulty === id}" class="rounded-2xl border ${save.difficulty === id ? 'border-[#6ef0c2] bg-[#6ef0c2]/10' : 'border-white/10 bg-white/5'} p-4 text-left"><p class="font-bold">${d.name}</p><p class="mt-1 text-xs text-[#b8b2e6]">${d.desc}</p></button>`).join('')}</div>
    <div class="mt-5 space-y-2">
      ${[['assist', '瞄准辅助', '鼠标靠近对手时轻微吸附；只用键盘时自动瞄准'], ['sound', '音效', '发射、反弹、命中等音效'], ['reduced', '减少特效', '关闭屏幕震动和粒子效果']].map(([key, label, desc]) => `<button data-action="toggle" data-key="${key}" aria-pressed="${save[key]}" class="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left"><span><span class="block text-sm">${label}</span><span class="block text-[11px] text-[#9f98d6]">${desc}</span></span><span class="relative h-6 w-11 rounded-full ${save[key] ? 'bg-[#6ef0c2]' : 'bg-white/15'}"><span class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${save[key] ? 'left-[22px]' : 'left-0.5'}"></span></span></button>`).join('')}
    </div>
    <div class="mt-6 border-t border-white/10 pt-4">
      <p class="text-[11px] leading-5 text-[#8c86c2]">进度只保存在这个浏览器里，不会上传。</p>
      <button data-action="reset-confirm" class="mt-2 text-xs text-[#ff8fa3] hover:underline">清空所有进度</button>
    </div>`);
}

const actions = {
  home: showHome,
  close: closeModal,
  'play-next': () => startTournament(nextTarget()),
  challenge: el => startTournament(Number(el.dataset.id)),
  endless: startEndless,
  howto: howTo,
  settings,
  pause: pauseMenu,
  tip: () => toast(match.mode === 'endless' ? '连胜模式里生命不会回满，多用护盾反击，少硬拼。' : match.opponent.tip, 5000),
  sound: () => { save.sound = !save.sound; sfx.setEnabled(save.sound); syncSound(); persist(); },
  restart: () => {
    if (match.mode === 'endless') startEndless();
    else startTournament(match.opponentIndex);
  },
  rematch: () => startTournament(match.opponentIndex),
  'next-opponent': () => startTournament(Math.min(OPPONENTS.length - 1, match.opponentIndex + 1)),
  skin: el => {
    const i = Number(el.dataset.id);
    if (SKINS[i] && totalStars(save) >= SKINS[i].need) { save.skin = i; persist(); renderHome(); toast(`换上了「${SKINS[i].name}」`); }
  },
  difficulty: el => { if (Object.hasOwn(DIFFICULTY, el.dataset.value)) { save.difficulty = el.dataset.value; persist(); settings(); } },
  toggle: el => {
    const key = el.dataset.key;
    if (!['assist', 'sound', 'reduced'].includes(key)) return;
    save[key] = !save[key];
    if (key === 'sound') { sfx.setEnabled(save.sound); syncSound(); }
    if (key === 'assist') match.assist = save.assist;
    persist();
    settings();
  },
  'reset-confirm': () => openModal('清空所有进度？', `<p class="text-sm leading-7 text-[#cfc9ff]">星星、段位、解锁的擂主和外观、连胜纪录都会被删除，而且无法恢复。</p><div class="mt-6 flex gap-3"><button data-action="reset" class="${ghost} text-[#ff8fa3]">确认清空</button><button data-action="close" data-autofocus class="${primary}">我再想想</button></div>`),
  reset: () => { save = blankSave(); sfx.setEnabled(true); syncSound(); persist(); closeModal(); showHome(); toast('进度已清空，从第一位擂主重新开始吧！'); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (save.sound) sfx.unlock();
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});

modal.addEventListener('cancel', e => { e.preventDefault(); if (modalDismissible) closeModal(); });

const KEY_MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
window.addEventListener('keydown', e => {
  if (view !== 'game') return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (!modal.open) { e.preventDefault(); pauseMenu(); }
    return;
  }
  if (modal.open) return;
  const handled = Object.hasOwn(KEY_MOVE, e.code) || ['KeyJ', 'KeyK', 'KeyL', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code);
  if (!handled) return;
  e.preventDefault();
  if (e.repeat) return;
  keysHeld.add(e.code);
  if (['KeyK', 'ShiftLeft', 'ShiftRight'].includes(e.code)) match.input.queue.add('shield');
  if (['Space', 'KeyL'].includes(e.code)) match.input.queue.add('dash');
  if (e.code === 'KeyJ') match.input.queue.add('fire');
});
window.addEventListener('keyup', e => keysHeld.delete(e.code));

function toArena(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
}
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') match.input.aim = toArena(e); });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || view !== 'game' || modal.open) return;
  sfx.unlock();
  canvas.focus({ preventScroll: true });
  match.input.aim = toArena(e);
  if (e.button === 0) { mouseFire = true; match.input.queue.add('fire'); }
  if (e.button === 2) match.input.queue.add('shield');
});
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) mouseFire = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

const joyZone = $('joy-zone');
joyZone.addEventListener('pointerdown', e => {
  if (view !== 'game' || modal.open) return;
  e.preventDefault();
  sfx.unlock();
  joyZone.setPointerCapture(e.pointerId);
  const rect = joyZone.getBoundingClientRect();
  joy.id = e.pointerId; joy.x = rect.left + rect.width / 2; joy.y = rect.top + rect.height / 2;
  updateJoy(e);
});
function updateJoy(e) {
  if (joy.id !== e.pointerId) return;
  let dx = e.clientX - joy.x, dy = e.clientY - joy.y;
  const max = 42, d = Math.hypot(dx, dy);
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  joy.dx = dx / max; joy.dy = dy / max;
  if (Math.hypot(joy.dx, joy.dy) < 0.18) { joy.dx = 0; joy.dy = 0; }
  $('joy-knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
joyZone.addEventListener('pointermove', updateJoy);
const endJoy = e => { if (joy.id !== e.pointerId) return; joy.id = null; joy.dx = 0; joy.dy = 0; $('joy-knob').style.transform = 'translate(-50%, -50%)'; };
joyZone.addEventListener('pointerup', endJoy);
joyZone.addEventListener('pointercancel', endJoy);

document.querySelectorAll('[data-touch]').forEach(b => {
  b.addEventListener('pointerdown', e => {
    if (view !== 'game' || modal.open) return;
    e.preventDefault();
    sfx.unlock();
    b.setPointerCapture(e.pointerId);
    const kind = b.dataset.touch;
    if (kind === 'fire') { touchFire = true; match.input.queue.add('fire'); }
    else match.input.queue.add(kind);
  });
  const up = () => { if (b.dataset.touch === 'fire') touchFire = false; };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

const coarse = window.matchMedia('(pointer: coarse)');
const narrow = window.matchMedia('(max-width: 900px)');
function updateTouchPanel() {
  const show = coarse.matches || navigator.maxTouchPoints > 0 || narrow.matches;
  $('touch-panel').classList.toggle('hidden', !show);
}
coarse.addEventListener?.('change', updateTouchPanel);
narrow.addEventListener?.('change', updateTouchPanel);
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') $('touch-panel').classList.remove('hidden'); }, { passive: true });

function updateMove() {
  let x = 0, y = 0;
  for (const code of keysHeld) { const v = KEY_MOVE[code]; if (v) { x += v[0]; y += v[1]; } }
  x += joy.dx; y += joy.dy;
  match.input.move = { x, y };
  match.input.fireHeld = mouseFire || touchFire || keysHeld.has('KeyJ');
  match.input.touchAim = touchFire;
}

window.addEventListener('blur', () => { clearInput(); pauseMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pauseMenu(); } });

function resizeHero() {
  const rect = heroCanvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(320, Math.round(rect.width * dpr)), h = Math.max(200, Math.round(rect.height * dpr));
  if (heroCanvas.width !== w || heroCanvas.height !== h) { heroCanvas.width = w; heroCanvas.height = h; }
}
window.addEventListener('resize', resizeHero);

let last = 0, acc = 0, hudTimer = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  if (view === 'game') {
    if (!modal.open && !document.hidden) {
      updateMove();
      acc += dt;
      while (acc >= STEP) { match.step(STEP); acc -= STEP; }
      if (match.state === 'countdown') {
        const n = Math.ceil(match.countdown - 0.5);
        if (n >= 1 && n !== lastCountdown) { lastCountdown = n; sfx.play('count'); }
      }
    } else acc = 0;
    renderer.draw(match, { reduced: save.reduced, playerLook: lookForSkin(SKINS[save.skin]) });
    hudTimer += dt;
    if (hudTimer > 0.08) { updateHud(); hudTimer = 0; }
  } else if (view === 'home' && !document.hidden) {
    resizeHero();
    const t = save.reduced ? 1 : now / 1000;
    drawHeroScene(heroCtx, heroCanvas.width, heroCanvas.height, t, lookForSkin(SKINS[save.skin]), lookForOpponent(OPPONENTS[nextTarget()]));
  }
  requestAnimationFrame(frame);
}

if (new URLSearchParams(location.search).has('qa')) window.__arena = { match, getSave: () => save, startTournament, startEndless, showHome };

syncSound();
showHome();
requestAnimationFrame(frame);
