export const W = 960;
export const H = 600;
export const BOUNDS = { l: 36, t: 36, r: 924, b: 564 };
export const BALL_SPEED = 470;
export const SAVE_KEY = 'planet-arena-v1';
const VERSION = 1;

export const ARENAS = [
  { name: '碎石带', sky: ['#1a1240', '#3a1f5c'], floor: '#231a4d', line: '#ff9f6e', style: 'rock', obstacles: [{ x: 480, y: 300, r: 46 }] },
  { name: '冰晶湖', sky: ['#0d1d45', '#1f4d7a'], floor: '#14305a', line: '#8fe3ff', style: 'ice', obstacles: [{ x: 330, y: 200, r: 36 }, { x: 630, y: 400, r: 36 }, { x: 480, y: 300, r: 20 }] },
  { name: '熔岩谷', sky: ['#2a0f22', '#5c1f2a'], floor: '#3a1526', line: '#ff7a59', style: 'lava', obstacles: [{ x: 480, y: 165, r: 42 }, { x: 480, y: 435, r: 42 }] },
  { name: '风暴环', sky: ['#0f1a36', '#2c3f6e'], floor: '#18264a', line: '#9dffb0', style: 'storm', obstacles: [{ x: 480, y: 300, r: 24 }, { orbit: { cx: 480, cy: 300, radius: 130, speed: 0.7, phase: 0 }, r: 26 }, { orbit: { cx: 480, cy: 300, radius: 130, speed: 0.7, phase: Math.PI }, r: 26 }] },
  { name: '星环王座', sky: ['#1c0f3a', '#47286e'], floor: '#27184b', line: '#ffd166', style: 'crown', obstacles: [{ x: 250, y: 300, r: 28 }, { x: 710, y: 300, r: 28 }, { orbit: { cx: 480, cy: 300, radius: 175, speed: -0.55, phase: Math.PI / 2 }, r: 22 }, { orbit: { cx: 480, cy: 300, radius: 175, speed: -0.55, phase: -Math.PI / 2 }, r: 22 }] }
];

export const OPPONENTS = [
  { id: 0, name: '波波', title: '陨石新兵', color: '#f2a65a', accent: '#ffe0b0', arena: 0, quote: '嘿嘿，我才刚学会发射，别笑我哦！', trait: '动作慢一点，适合熟悉操作', tip: '先练习移动和瞄准：用冲刺躲开她慢悠悠的球，再对准她发射。', ai: { speed: 150, fireGap: [1.3, 2.0], aimError: 0.32, lead: 0, dodge: 0.15, shield: 0, dash: 0, bank: 0, range: 320, aggression: 0.3 } },
  { id: 1, name: '雪莉', title: '冰晶狙击手', color: '#8fd3ff', accent: '#e6f7ff', arena: 1, quote: '墙壁是我的好朋友，你猜得到球从哪来吗？', trait: '喜欢借墙反弹偷袭', tip: '留意墙边！雪莉的球常常从墙上弹过来。你也可以看着瞄准线学她打反弹球。', ai: { speed: 175, fireGap: [1.0, 1.6], aimError: 0.16, lead: 0.4, dodge: 0.35, shield: 0.1, dash: 0, bank: 0.55, range: 380, aggression: 0.35 } },
  { id: 2, name: '烈烈', title: '熔岩冲锋者', color: '#ff7a59', accent: '#ffd166', arena: 2, quote: '近一点！再近一点！火力全开！', trait: '贴身猛攻，射速很快', tip: '烈烈喜欢贴脸连射。在球快碰到你时开护盾，就能把它反弹回去。', ai: { speed: 215, fireGap: [0.55, 0.95], aimError: 0.2, lead: 0.3, dodge: 0.3, shield: 0.15, dash: 0.25, bank: 0.1, range: 170, aggression: 0.8 } },
  { id: 3, name: '疾疾', title: '风暴舞者', color: '#7ff0b5', accent: '#e8fff2', arena: 3, quote: '追得上风吗？我可是很会躲的！', trait: '冲刺闪避高手，很难打中', tip: '疾疾很会闪。等她冲刺完（冷却期间）再出手，或者用反弹球从侧面偷袭。', ai: { speed: 230, fireGap: [0.8, 1.3], aimError: 0.14, lead: 0.6, dodge: 0.7, shield: 0.15, dash: 0.75, bank: 0.2, range: 280, aggression: 0.5 } },
  { id: 4, name: '诺娃', title: '星环女王', color: '#c49bff', accent: '#ffd166', arena: 4, quote: '能走到王座前的人不多。让我看看你的全部本领。', trait: '会预判走位，也会护盾反击', tip: '诺娃会用护盾反弹直线球。多用反弹球和三连发打乱她，抓住她护盾冷却的瞬间。', ai: { speed: 235, fireGap: [0.6, 1.0], aimError: 0.08, lead: 0.85, dodge: 0.6, shield: 0.55, dash: 0.45, bank: 0.35, range: 300, aggression: 0.6 } }
];

export const POWERUPS = [
  { id: 'triple', name: '三连发', desc: '接下来 3 次发射变成散射', color: '#ffd166', glyph: '≡' },
  { id: 'giant', name: '巨能球', desc: '下一发是巨型能量球，能吞掉对手的小球', color: '#ff7a8a', glyph: '●' },
  { id: 'swift', name: '疾风靴', desc: '6 秒内移动速度提升', color: '#6ef0c2', glyph: '»' },
  { id: 'heart', name: '星心', desc: '恢复 1 点生命', color: '#ff9ecb', glyph: '♥' }
];

export const SKINS = [
  { name: '薄荷星', body: '#6ee7c2', ring: '#fff1a8', need: 0 },
  { name: '樱桃星', body: '#ff8fa3', ring: '#ffe3ea', need: 3 },
  { name: '葡萄星', body: '#a98bff', ring: '#d9ccff', need: 6 },
  { name: '柠檬星', body: '#ffd84d', ring: '#fff6c9', need: 9 },
  { name: '极光星', body: '#5fd4ff', ring: '#ff9ef0', need: 13 }
];

export const RANKS = [
  { name: '新星', need: 0, color: '#9fb3ff' },
  { name: '流星', need: 3, color: '#6ef0c2' },
  { name: '彗星', need: 6, color: '#ffd166' },
  { name: '恒星', need: 10, color: '#ff9f6e' },
  { name: '星系守护者', need: 15, color: '#ff7ad9' }
];

export const DIFFICULTY = {
  easy: { name: '轻松', hp: 4, aiMul: 0.82, desc: '你有 4 点生命，对手反应慢一点' },
  standard: { name: '标准', hp: 3, aiMul: 1, desc: '你有 3 点生命，擂主全力以赴' }
};

export function totalStars(save) {
  return Object.values(save.stars).reduce((sum, value) => sum + value, 0);
}

export function rankFor(stars) {
  let rank = RANKS[0];
  for (const item of RANKS) if (stars >= item.need) rank = item;
  return rank;
}

export function nextRank(stars) {
  return RANKS.find(item => item.need > stars) || null;
}

export function endlessOpponent(level) {
  const base = OPPONENTS[level % OPPONENTS.length];
  const tier = Math.floor(level / OPPONENTS.length);
  const fireBoost = Math.min(1.45, 0.9 + level * 0.03);
  const ai = {
    ...base.ai,
    speed: base.ai.speed * Math.min(1.25, 0.92 + tier * 0.08),
    fireGap: base.ai.fireGap.map(value => value / fireBoost),
    aimError: base.ai.aimError * Math.max(0.45, 1.1 - level * 0.04),
    dodge: Math.min(0.85, base.ai.dodge + tier * 0.08),
    shield: Math.min(0.7, base.ai.shield + tier * 0.06),
    dash: Math.min(0.85, base.ai.dash + tier * 0.06)
  };
  return { ...base, ai, title: `第 ${level + 1} 位挑战者`, endless: true };
}

export function blankSave() {
  return { version: VERSION, unlocked: 1, stars: {}, bestStreak: 0, wins: 0, matches: 0, reflects: 0, difficulty: 'easy', assist: true, skin: 0, sound: true, reduced: false };
}

export function readSave(storage) {
  const clean = blankSave();
  let raw;
  try { raw = storage.getItem(SAVE_KEY); } catch { return { save: clean, available: false }; }
  if (!raw) return { save: clean, available: true };
  let value;
  try { value = JSON.parse(raw); } catch { return { save: clean, available: true }; }
  if (!value || typeof value !== 'object' || value.version !== VERSION) return { save: clean, available: true };
  const int = (x, min, max, fallback) => Number.isInteger(x) ? Math.min(max, Math.max(min, x)) : fallback;
  clean.unlocked = int(value.unlocked, 1, OPPONENTS.length, 1);
  if (value.stars && typeof value.stars === 'object' && !Array.isArray(value.stars)) {
    for (let i = 0; i < OPPONENTS.length; i++) {
      const s = value.stars[i];
      if (Number.isInteger(s) && s > 0) clean.stars[i] = Math.min(3, s);
    }
  }
  clean.bestStreak = int(value.bestStreak, 0, 9999, 0);
  clean.wins = int(value.wins, 0, 999999, 0);
  clean.matches = int(value.matches, 0, 999999, 0);
  clean.reflects = int(value.reflects, 0, 999999, 0);
  if (Object.hasOwn(DIFFICULTY, value.difficulty)) clean.difficulty = value.difficulty;
  for (const key of ['assist', 'sound', 'reduced']) if (typeof value[key] === 'boolean') clean[key] = value[key];
  clean.skin = int(value.skin, 0, SKINS.length - 1, 0);
  if (SKINS[clean.skin].need > totalStars(clean)) clean.skin = 0;
  return { save: clean, available: true };
}
