/* ================= 幻兽群岛 · 数据层 ================= */
(function () {
  const FG = window.FG = window.FG || {};

  /* ---------- 工具 ---------- */
  FG.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  FG.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  FG.rand = (a, b) => a + Math.random() * (b - a);
  FG.randInt = (a, b) => Math.floor(FG.rand(a, b + 1));
  FG.choice = arr => arr[Math.floor(Math.random() * arr.length)];
  FG.weighted = entries => {
    let total = 0;
    for (const e of entries) total += e.w;
    let r = Math.random() * total;
    for (const e of entries) { if ((r -= e.w) <= 0) return e.v; }
    return entries[entries.length - 1].v;
  };
  FG.rng = seed => {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- 元素克制 ----------
     水→火 →风→水 循环；神↔魔互克；神、魔 同时克制水风火 */
  FG.EL = { WATER: 'water', FIRE: 'fire', WIND: 'wind', GOD: 'god', DEMON: 'demon', NONE: 'none' };
  FG.EL_INFO = {
    water: { name: '水', icon: '🌊', cls: 'el-water' },
    fire:  { name: '火', icon: '🔥', cls: 'el-fire' },
    wind:  { name: '风', icon: '🌪️', cls: 'el-wind' },
    god:   { name: '神', icon: '✨', cls: 'el-god' },
    demon: { name: '魔', icon: '🌑', cls: 'el-demon' },
    none:  { name: '无', icon: '⚪', cls: '' }
  };
  FG.COUNTERS = {
    water: ['fire'], fire: ['wind'], wind: ['water'],
    god: ['demon', 'water', 'fire', 'wind'],
    demon: ['god', 'water', 'fire', 'wind']
  };
  FG.counterMult = (atkEl, defEl) => {
    if (atkEl === 'none' || defEl === 'none') return 1;
    return (FG.COUNTERS[atkEl] || []).includes(defEl) ? 1.1 : 1;
  };
  FG.counterText = (atkEl, defEl) => {
    if (FG.counterMult(atkEl, defEl) > 1) return '效果拔群！克制伤害 +10%';
    const rev = FG.counterMult(defEl, atkEl) > 1;
    return rev ? '被克制，效果不佳…' : '';
  };

  /* ---------- 品质 / 资质 / 星级 ---------- */
  FG.QUALITY = {
    N:   { name: 'N',   mult: 1.00, shardCost: 2,  goldCost: 200,  exp: 8  },
    R:   { name: 'R',   mult: 1.12, shardCost: 5,  goldCost: 500,  exp: 11 },
    SR:  { name: 'SR',  mult: 1.27, shardCost: 10, goldCost: 1500, exp: 15 },
    SSR: { name: 'SSR', mult: 1.46, shardCost: 20, goldCost: 4000, exp: 22 },
    UR:  { name: 'UR',  mult: 1.72, shardCost: 40, goldCost: 10000, exp: 32 }
  };
  /* 资质：升星解锁更高级洗髓区间，新获得时在当前星级允许区间内随机 */
  FG.APT = [
    { g: 'D',  bonus: 0.03, needStar: 1 },
    { g: 'C',  bonus: 0.08, needStar: 1 },
    { g: 'B',  bonus: 0.14, needStar: 1 },
    { g: 'A',  bonus: 0.21, needStar: 2 },
    { g: 'S',  bonus: 0.28, needStar: 3 },
    { g: 'SS', bonus: 0.36, needStar: 4 }
  ];
  FG.aptGrade = g => FG.APT.find(a => a.g === g) || FG.APT[0];
  FG.rollApt = star => {
    const pool = FG.APT.filter(a => a.needStar <= star);
    // 高等级资质权重更低
    const w = pool.map((a, i) => ({ v: a.g, w: Math.max(1, 14 - i * 3) }));
    return FG.weighted(w);
  };
  FG.STAR_CAP = [0, 10, 20, 30, 40, 60];           // 星级对应等级上限
  FG.STAR_MULT = s => 1 + (s - 1) * 0.08;          // 每升一星 +8% 全属性

  /* ---------- 技能 ---------- */
  FG.SKILLS = {
    tackle:     { name: '撞击',       icon: '💥', el: 'none',  pwr: 42,  desc: '无属性的朴实一击' },
    watergun:   { name: '水枪',       icon: '🔫', el: 'water', pwr: 48,  desc: '喷射高压水流' },
    bubble:     { name: '泡沫之舞',   icon: '🫧', el: 'water', pwr: 74,  desc: '漫天泡沫切割敌人' },
    tidalwrath: { name: '怒涛吞天',   icon: '🌊', el: 'water', pwr: 112, desc: '召唤巨浪吞噬一切' },
    healmist:   { name: '治愈水雾',   icon: '💧', el: 'water', heal: 1,  desc: '温柔水雾恢复自身生命' },
    ember:      { name: '火花',       icon: '✨', el: 'fire',  pwr: 48,  desc: '弹出灼热火星' },
    flameburst: { name: '烈焰冲击',   icon: '🔥', el: 'fire',  pwr: 74,  desc: '烈焰化身冲撞对手' },
    hellfire:   { name: '焚天炼狱',   icon: '🌋', el: 'fire',  pwr: 112, desc: '降下毁灭的火雨' },
    gust:       { name: '旋风斩',     icon: '🍃', el: 'wind',  pwr: 48,  desc: '风刃高速斩击' },
    storm:      { name: '暴风之怒',   icon: '🌪️', el: 'wind', pwr: 74,  desc: '狂暴风柱席卷战场' },
    tempest:    { name: '寂灭风暴',   icon: '🌀', el: 'wind',  pwr: 112, desc: '撕裂天空的终结风暴' },
    light:      { name: '圣光弹',     icon: '🌟', el: 'god',   pwr: 58,  desc: '凝聚圣光发动轰击' },
    judgment:   { name: '神圣审判',   icon: '⚡', el: 'god',   pwr: 118, desc: '代行神明降下裁决' },
    holyheal:   { name: '圣愈术',     icon: '🕊️', el: 'god',   heal: 1,  desc: '神圣之光大幅恢复' },
    shadow:     { name: '暗影球',     icon: '🌑', el: 'demon', pwr: 58,  desc: '聚集黑暗能量吞噬光明' },
    voidhit:    { name: '虚空吞噬',   icon: '🕳️', el: 'demon', pwr: 118, desc: '撕裂空间湮灭对手' },
    guardup:    { name: '铁壁',       icon: '🛡️', el: 'none', buff: 'def', pct: 0.3, turns: 3, desc: '防御力提升30%（3回合）' }
  };
})();

/* ---------- 幻兽图鉴 ----------
   skills: [技能id, 习得等级, 需要技能星级]  */
const SPECIES = {
  /* 水系线 */
  droplet: {
    name: '水滴仔', face: '💧', el: 'water', q: 'N', line: 'water',
    base: { hp: 46, atk: 12, def: 9, spd: 10 }, grow: { hp: 6, atk: 2.2, def: 1.7, spd: 1.7 },
    skills: [['tackle', 1, 1], ['watergun', 3, 1], ['healmist', 7, 2], ['bubble', 12, 2]],
    bio: '清晨草叶上的露珠化成的小幻兽，性格温柔。'
  },
  ripple: {
    name: '波纹兽', face: '🌊', el: 'water', q: 'R', line: 'water', pre: 'droplet',
    base: { hp: 60, atk: 17, def: 13, spd: 14 }, grow: { hp: 8, atk: 2.9, def: 2.2, spd: 2.2 },
    skills: [['tackle', 1, 1], ['watergun', 1, 1], ['bubble', 16, 2], ['healmist', 20, 2], ['tidalwrath', 32, 3]],
    bio: '能在湖面掀起层层涟漪，是可靠的水系伙伴。'
  },
  leviathan: {
    name: '沧海龙皇', face: '🐉', el: 'water', q: 'SR', line: 'water', pre: 'ripple',
    base: { hp: 82, atk: 24, def: 18, spd: 19 }, grow: { hp: 11, atk: 3.8, def: 3, spd: 2.8 },
    skills: [['watergun', 1, 1], ['bubble', 1, 2], ['tidalwrath', 36, 3], ['healmist', 40, 3]],
    bio: '传说中掀起海啸的沧海龙皇，出现时海面会为之让路。'
  },
  /* 火系线 */
  cinderpup: {
    name: '火绒犬', face: '🐕', el: 'fire', q: 'N', line: 'fire',
    base: { hp: 44, atk: 14, def: 8, spd: 12 }, grow: { hp: 6, atk: 2.5, def: 1.5, spd: 2 },
    skills: [['tackle', 1, 1], ['ember', 3, 1], ['guardup', 7, 2], ['flameburst', 12, 2]],
    bio: '尾巴上的火焰会随心情摇曳，高兴时会喷出小火星。'
  },
  blazehound: {
    name: '烈焰犬', face: '🐺', el: 'fire', q: 'R', line: 'fire', pre: 'cinderpup',
    base: { hp: 58, atk: 19, def: 12, spd: 16 }, grow: { hp: 8, atk: 3.2, def: 2, spd: 2.6},
    skills: [['tackle', 1, 1], ['ember', 1, 1], ['flameburst', 16, 2], ['guardup', 20, 2], ['hellfire', 32, 3]],
    bio: '奔跑时身后拖出火线，速度与爆发力兼备。'
  },
  phoenix: {
    name: '涅槃凤凰', face: '🦅', el: 'fire', q: 'SR', line: 'fire', pre: 'blazehound',
    base: { hp: 80, atk: 27, def: 16, spd: 22 }, grow: { hp: 10, atk: 4.1, def: 2.7, spd: 3.4 },
    skills: [['ember', 1, 1], ['flameburst', 1, 2], ['hellfire', 36, 3], ['guardup', 40, 3]],
    bio: '浴火重生的不死鸟，其羽翼能点燃整片天空。'
  },
  /* 风系线 */
  breezekit: {
    name: '风团狐', face: '🦊', el: 'wind', q: 'N', line: 'wind',
    base: { hp: 42, atk: 13, def: 8, spd: 14 }, grow: { hp: 5.5, atk: 2.3, def: 1.5, spd: 2.3 },
    skills: [['tackle', 1, 1], ['gust', 3, 1], ['guardup', 7, 2], ['storm', 12, 2]],
    bio: '身子轻得像一团风，总是第一个嗅到远方的花香。'
  },
  galefox: {
    name: '疾风狐', face: '🐆', el: 'wind', q: 'R', line: 'wind', pre: 'breezekit',
    base: { hp: 55, atk: 18, def: 12, spd: 19 }, grow: { hp: 7, atk: 3, def: 2, spd: 3 },
    skills: [['tackle', 1, 1], ['gust', 1, 1], ['storm', 16, 2], ['guardup', 20, 2], ['tempest', 32, 3]],
    bio: '踏风而行，几乎看不到它移动时的身影。'
  },
  skyemperor: {
    name: '苍穹翼皇', face: '🦅', el: 'wind', q: 'SR', line: 'wind', pre: 'galefox',
    base: { hp: 78, atk: 25, def: 16, spd: 26 }, grow: { hp: 10, atk: 3.9, def: 2.6, spd: 3.9 },
    skills: [['gust', 1, 1], ['storm', 1, 2], ['tempest', 36, 3], ['guardup', 40, 3]],
    bio: '九天之上的风之皇者，双翼一振便可跨越群岛。'
  }
};
window.FG_SPECIES = SPECIES;

Object.assign(SPECIES, {
  /* 神系 */
  glowsprite: {
    name: '光点精灵', face: '🔆', el: 'god', q: 'SR', line: 'god',
    base: { hp: 70, atk: 22, def: 16, spd: 17 }, grow: { hp: 9, atk: 3.5, def: 2.6, spd: 2.6 },
    skills: [['tackle', 1, 1], ['light', 5, 2], ['holyheal', 12, 2], ['judgment', 24, 3]],
    bio: '由人们的祈愿凝聚而成，夜晚会为迷路者点亮道路。'
  },
  seraph: {
    name: '六翼圣使', face: '👼', el: 'god', q: 'SSR', line: 'god', pre: 'glowsprite',
    base: { hp: 92, atk: 30, def: 22, spd: 23 }, grow: { hp: 12, atk: 4.4, def: 3.3, spd: 3.3 },
    skills: [['light', 1, 2], ['holyheal', 1, 2], ['judgment', 30, 3]],
    bio: '守护群岛秩序的圣使，六翼展开时黑暗退散。'
  },
  /* 魔系 */
  shadeimp: {
    name: '影小鬼', face: '👺', el: 'demon', q: 'SR', line: 'demon',
    base: { hp: 68, atk: 24, def: 14, spd: 19 }, grow: { hp: 8.5, atk: 3.8, def: 2.3, spd: 3 },
    skills: [['tackle', 1, 1], ['shadow', 5, 2], ['guardup', 12, 2], ['voidhit', 24, 3]],
    bio: '喜欢躲在影子里恶作剧的小家伙，本性并不坏。'
  },
  voidlord: {
    name: '虚空魔王', face: '😈', el: 'demon', q: 'SSR', line: 'demon', pre: 'shadeimp',
    base: { hp: 90, atk: 33, def: 20, spd: 25 }, grow: { hp: 11.5, atk: 4.8, def: 3, spd: 3.6 },
    skills: [['shadow', 1, 2], ['guardup', 1, 2], ['voidhit', 30, 3]],
    bio: '执掌虚空深渊的魔王，传说它的凝视能吞噬星辰。'
  },
  /* 普通野外 */
  crablet: {
    name: '钳钳蟹', face: '🦀', el: 'water', q: 'N', line: 'crab',
    base: { hp: 48, atk: 13, def: 12, spd: 7 }, grow: { hp: 7, atk: 2.2, def: 2.2, spd: 1.2 },
    skills: [['tackle', 1, 1], ['watergun', 6, 1], ['guardup', 12, 2]],
    bio: '海滩上横着走的小螃蟹，钳子会夹住任何发光的东西。'
  },
  starfish: {
    name: '海星星', face: '⭐', el: 'water', q: 'N', line: 'star',
    base: { hp: 45, atk: 12, def: 10, spd: 9 }, grow: { hp: 6.5, atk: 2, def: 1.8, spd: 1.5 },
    skills: [['tackle', 1, 1], ['watergun', 6, 1], ['healmist', 12, 2]],
    bio: '身体在夜晚会发出微光，是沙滩上的小星星。'
  },
  sparkmouse: {
    name: '火星鼠', face: '🐭', el: 'fire', q: 'N', line: 'mouse',
    base: { hp: 43, atk: 14, def: 8, spd: 13 }, grow: { hp: 6, atk: 2.5, def: 1.4, spd: 2.2 },
    skills: [['tackle', 1, 1], ['ember', 6, 1], ['flameburst', 16, 2]],
    bio: '跑动时脚底会蹭出火星，尾巴永远冒着烟。'
  },
  lizard: {
    name: '熔岩蜥', face: '🦎', el: 'fire', q: 'R', line: 'lizard',
    base: { hp: 56, atk: 18, def: 14, spd: 11 }, grow: { hp: 8, atk: 3, def: 2.4, spd: 1.8 },
    skills: [['tackle', 1, 1], ['ember', 4, 1], ['guardup', 10, 2], ['flameburst', 18, 2]],
    bio: '栖息在火山岩缝中，皮肤滚烫如熔岩。'
  },
  leafspirit: {
    name: '草叶灵', face: '🌿', el: 'wind', q: 'N', line: 'leaf',
    base: { hp: 44, atk: 12, def: 9, spd: 11 }, grow: { hp: 6, atk: 2, def: 1.6, spd: 1.9 },
    skills: [['tackle', 1, 1], ['gust', 6, 1], ['healmist', 12, 2]],
    bio: '随风旅行的草叶小精灵，落下的地方会长出嫩芽。'
  },
  sparrow: {
    name: '风羽雀', face: '🐦', el: 'wind', q: 'N', line: 'bird',
    base: { hp: 41, atk: 13, def: 8, spd: 15 }, grow: { hp: 5.5, atk: 2.2, def: 1.4, spd: 2.5 },
    skills: [['tackle', 1, 1], ['gust', 6, 1], ['storm', 16, 2]],
    bio: '乘着上升气流翱翔的小雀，几乎从不落地。'
  },
  /* 神秘稀有 */
  cloudwhale: {
    name: '云端鲸', face: '🐳', el: 'wind', q: 'SSR', line: 'whale',
    base: { hp: 96, atk: 26, def: 24, spd: 20 }, grow: { hp: 13, atk: 3.9, def: 3.5, spd: 3 },
    skills: [['gust', 1, 1], ['storm', 8, 2], ['healmist', 16, 2], ['tempest', 28, 3]],
    bio: '只在高空云层中游弋的神秘巨鲸，歌声能平息风暴。'
  },
  aurorabunny: {
    name: '极光兔', face: '🐰', el: 'water', q: 'SSR', line: 'bunny',
    base: { hp: 88, atk: 27, def: 18, spd: 28 }, grow: { hp: 11, atk: 4, def: 2.7, spd: 4.2 },
    skills: [['watergun', 1, 1], ['bubble', 8, 2], ['healmist', 16, 2], ['tidalwrath', 28, 3]],
    bio: '极夜中现身的幻兽，蹦跳时身后会留下极光般的光带。'
  },
  /* UR 传说 */
  creation: {
    name: '创世神龙', face: '🐲', el: 'god', q: 'UR', line: 'creation',
    base: { hp: 110, atk: 36, def: 26, spd: 26 }, grow: { hp: 14, atk: 5.2, def: 3.8, spd: 3.8 },
    skills: [['light', 1, 2], ['holyheal', 10, 2], ['judgment', 22, 3]],
    bio: '开天辟地的创世神龙，万物诞生之初的第一缕光。'
  },
  chaos: {
    name: '混沌魔神', face: '👹', el: 'demon', q: 'UR', line: 'chaos',
    base: { hp: 108, atk: 39, def: 24, spd: 28 }, grow: { hp: 13.5, atk: 5.6, def: 3.5, spd: 4.1 },
    skills: [['shadow', 1, 2], ['guardup', 10, 2], ['voidhit', 22, 3]],
    bio: '自世界诞生前的混沌中苏醒，力量足以扭曲现实。'
  }
});

FG.SPECIES = SPECIES;
FG.speciesByLine = {};
Object.keys(SPECIES).forEach(id => {
  const s = SPECIES[id];
  (FG.speciesByLine[s.line] = FG.speciesByLine[s.line] || []).push(id);
});
/* 进化链的最终形态 id */
function finalOf(id) {
  const s = SPECIES[id];
  if (!s) return id;
  const kids = FG.speciesByLine[s.line].filter(k => SPECIES[k].pre === id);
  return kids.length ? finalOf(kids[0]) : id;
}
FG.finalOf = finalOf;
/* 进化所需等级（阶段1→2：16，阶段2→3：34） */
FG.evolveLevel = id => {
  const target = FG.evolveTarget(id);
  if (!target) return null;
  const cur = SPECIES[id];
  return SPECIES[target].q === 'UR' ? 30 : (cur.pre ? 34 : 16);
};
FG.evolveTarget = id => {
  const s = SPECIES[id];
  const kids = FG.speciesByLine[s.line].filter(k => SPECIES[k].pre === id);
  return kids[0] || null;
};

/* 初始三选一 */
FG.STARTERS = ['droplet', 'cinderpup', 'breezekit'];

/* ---------- 道具 ---------- */
FG.ITEMS = {
  ball:       { name: '精灵球',   icon: '🔴', kind: 'ball', mult: 1.0, price: 50,  desc: '基础捕捉道具，对虚弱的幻兽效果更好。' },
  greatball:  { name: '高级球',   icon: '🔵', kind: 'ball', mult: 1.5, price: 150, desc: '性能更优秀的捕捉球，成功率 ×1.5。' },
  ultraball:  { name: '大师球',   icon: '🟣', kind: 'ball', mult: 3.0, price: 400, desc: '顶级捕捉球，成功率 ×3。' },
  masterball: { name: '至尊球',   icon: '🟡', kind: 'ball', mult: 999, price: 0,   desc: '必定捕捉成功的传说之球。' },
  potion:     { name: '体力药剂', icon: '🧪', kind: 'heal', heal: 40,  price: 60,  desc: '恢复出战幻兽 40 点生命。' },
  superpotion:{ name: '强效药剂', icon: '⚗️', kind: 'heal', heal: 100, price: 180, desc: '恢复出战幻兽 100 点生命。' },
  revive:     { name: '复活水晶', icon: '💠', kind: 'revive', heal: 0.5, price: 300, desc: '复活一只倒下的幻兽并恢复一半生命。' },
  berry:      { name: '诱兽果',   icon: '🍓', kind: 'berry', price: 120, desc: '战斗中投出可使本轮捕捉成功率 +25%。' },
  shard_N:    { name: 'N系碎片',  icon: '🟤', kind: 'shard', q: 'N',   desc: '同品质幻兽升星所需的碎片材料。' },
  shard_R:    { name: 'R系碎片',  icon: '🔷', kind: 'shard', q: 'R',   desc: '同品质幻兽升星所需的碎片材料。' },
  shard_SR:   { name: 'SR系碎片', icon: '🟪', kind: 'shard', q: 'SR',  desc: '同品质幻兽升星所需的碎片材料。' },
  shard_SSR:  { name: 'SSR系碎片',icon: '💜', kind: 'shard', q: 'SSR', desc: '同品质幻兽升星所需的碎片材料。' },
  shard_UR:   { name: 'UR系碎片', icon: '💗', kind: 'shard', q: 'UR',  desc: '同品质幻兽升星所需的碎片材料。' },
  gem:        { name: '钻石',     icon: '💎', kind: 'money', desc: '稀有货币，解锁辅战位等用途。' }
};
FG.shardId = q => 'shard_' + q;
/* 各品质野外掉落碎片概率 */
FG.DROP_SHARD_CHANCE = 0.35;

/* ---------- 岛屿 ----------
   T: 地块 . 草地 , w 浅水(可走), W 深水(阻挡), t 树(阻挡), m 山/岩石(阻挡), s 沙地 */
FG.ISLANDS = [
  {
    id: 'isle1', name: '初心岛', order: 0, w: 40, h: 28,
    palette: 'grass',
    camp: { x: 5, y: 5 },
    portal: { x: 34, y: 23, to: 1, needLv: 3 },
    needTrainerLv: 1,
    wild: [
      { sp: 'crablet', w: 30 }, { sp: 'starfish', w: 30 },
      { sp: 'sparkmouse', w: 22 }, { sp: 'leafspirit', w: 18 }
    ],
    rare: [
      { sp: 'aurorabunny', w: 1 }
    ],
    wildLv: [2, 6], wildCount: 7,
    nodes: [
      { t: 'wood', n: 4 }, { t: 'crystal', n: 2 }, { t: 'chest', n: 1 }, { t: 'egg', n: 1 }
    ],
    desc: '训练师之旅开始的小岛，草长莺飞，适合新手磨练技艺。'
  },
  {
    id: 'isle2', name: '碧波滩', order: 1, w: 44, h: 30,
    palette: 'beach',
    camp: { x: 6, y: 6 },
    portal: { x: 38, y: 25, to: 2, needLv: 5 },
    needTrainerLv: 3,
    wild: [
      { sp: 'crablet', w: 26 }, { sp: 'starfish', w: 24 },
      { sp: 'breezekit', w: 14 }, { sp: 'sparrow', w: 18 },
      { sp: 'glowsprite', w: 8 }
    ],
    rare: [ { sp: 'cloudwhale', w: 1 } ],
    wildLv: [7, 13], wildCount: 9,
    nodes: [
      { t: 'wood', n: 4 }, { t: 'crystal', n: 4 }, { t: 'chest', n: 2 }, { t: 'egg', n: 1 }
    ],
    desc: '碧海环抱的沙滩岛屿，潮声中藏着许多水系幻兽。'
  },
  {
    id: 'isle3', name: '炽焰山', order: 2, w: 44, h: 30,
    palette: 'volcano',
    camp: { x: 6, y: 6 },
    portal: { x: 38, y: 25, to: 3, needLv: 8 },
    needTrainerLv: 5,
    wild: [
      { sp: 'sparkmouse', w: 26 }, { sp: 'lizard', w: 24 },
      { sp: 'cinderpup', w: 16 }, { sp: 'shadeimp', w: 10 }
    ],
    rare: [ { sp: 'phoenix', w: 1 } ],
    wildLv: [13, 20], wildCount: 9,
    nodes: [
      { t: 'wood', n: 3 }, { t: 'crystal', n: 5 }, { t: 'chest', n: 2 }, { t: 'egg', n: 1 }
    ],
    desc: '终年火山喷发的灼热岛屿，岩浆之间栖息着火系强者。'
  },
  {
    id: 'isle4', name: '疾风原', order: 3, w: 46, h: 32,
    palette: 'wind',
    camp: { x: 7, y: 7 },
    portal: { x: 40, y: 27, to: 4, needLv: 12 },
    needTrainerLv: 8,
    wild: [
      { sp: 'sparrow', w: 24 }, { sp: 'leafspirit', w: 22 },
      { sp: 'breezekit', w: 16 }, { sp: 'galefox', w: 12 },
      { sp: 'glowsprite', w: 8 }
    ],
    rare: [ { sp: 'skyemperor', w: 1 }, { sp: 'cloudwhale', w: 1 } ],
    wildLv: [19, 27], wildCount: 10,
    nodes: [
      { t: 'wood', n: 4 }, { t: 'crystal', n: 5 }, { t: 'chest', n: 3 }, { t: 'egg', n: 2 }
    ],
    desc: '狂风呼啸的高原岛屿，风系幻兽在云间追逐嬉戏。'
  },
  {
    id: 'isle5', name: '神魔圣域', order: 4, w: 48, h: 34,
    palette: 'sanctum',
    camp: { x: 7, y: 7 },
    portal: null,
    needTrainerLv: 12,
    wild: [
      { sp: 'glowsprite', w: 26 }, { sp: 'shadeimp', w: 26 },
      { sp: 'seraph', w: 10 }, { sp: 'voidlord', w: 10 }
    ],
    rare: [ { sp: 'creation', w: 1 }, { sp: 'chaos', w: 1 } ],
    wildLv: [26, 38], wildCount: 11,
    nodes: [
      { t: 'crystal', n: 8 }, { t: 'chest', n: 4 }, { t: 'egg', n: 2 }
    ],
    desc: '漂浮于云海尽头的圣域，神与魔的力量在此交汇，传说幻兽在此沉睡。'
  }
];

/* 地块配色 */
FG.TERRAIN = {
  grass:   { ground: '#6fbf5a', ground2: '#63b34e', block: 't', water: 'w' },
  beach:   { ground: '#e8d8a0', ground2: '#dfcf93', block: 't', water: 'w' },
  volcano: { ground: '#a8624b', ground2: '#9c5844', block: 't', water: 'W' },
  wind:    { ground: '#8fcf7e', ground2: '#84c573', block: 't', water: 'w' },
  sanctum: { ground: '#b9a7e0', ground2: '#ad9bd6', block: 'm', water: 'w' }
};

/* 资源点产出 */
FG.NODES = {
  wood:    { name: '古木',     icon: '🌳', cd: 60,  loot: [{ id: 'gold', n: [20, 60], w: 5 }, { id: 'potion', n: 1, w: 2 }, { id: 'berry', n: 1, w: 1 }] },
  crystal: { name: '水晶矿',   icon: '💠', cd: 120, loot: [{ id: 'gem', n: [1, 2], w: 4 }, { id: 'gold', n: [40, 100], w: 4 }, { id: 'revive', n: 1, w: 1 }] },
  chest:   { name: '宝箱',     icon: '🎁', cd: 300, loot: [{ id: 'gold', n: [150, 400], w: 4 }, { id: 'greatball', n: [1, 3], w: 3 }, { id: 'ultraball', n: 1, w: 1 }, { id: 'shard', n: [1, 3], w: 2 }] },
  egg:     { name: '神秘幻兽蛋', icon: '🥚', cd: 900, loot: [{ id: 'egg', n: 1, w: 1 }] }
};

/* 蛋池：品质权重，随岛屿阶位提升 */
FG.EGG_POOLS = [
  [{ q: 'N', w: 60 }, { q: 'R', w: 32 }, { q: 'SR', w: 8 }],
  [{ q: 'N', w: 40 }, { q: 'R', w: 40 }, { q: 'SR', w: 18 }, { q: 'SSR', w: 2 }],
  [{ q: 'R', w: 38 }, { q: 'SR', w: 42 }, { q: 'SSR', w: 18 }, { q: 'UR', w: 2 }],
  [{ q: 'R', w: 25 }, { q: 'SR', w: 45 }, { q: 'SSR', w: 26 }, { q: 'UR', w: 4 }],
  [{ q: 'SR', w: 40 }, { q: 'SSR', w: 45 }, { q: 'UR', w: 15 }]
];
FG.speciesPoolByQ = q => Object.keys(SPECIES).filter(id => SPECIES[id].q === q);
