/* ================= data.js ：静态游戏数据 ================= */
"use strict";

/* 属性与克制：神↔魔互克，且神/魔克制水火风；水火风循环克制 */
const ELEMENTS = {
  water: { name: "水", color: "#3da9fc", bg: "#d6efff", adv: ["fire"] },
  fire:  { name: "火", color: "#ff6b4a", bg: "#ffe6dd", adv: ["wind"] },
  wind:  { name: "风", color: "#2ecc71", bg: "#e0fbe9", adv: ["water"] },
  god:   { name: "神", color: "#f7b731", bg: "#fff7d6", adv: ["demon", "water", "fire", "wind"] },
  demon: { name: "魔", color: "#8854d0", bg: "#efe4ff", adv: ["god", "water", "fire", "wind"] },
};

/* 伤害系数：克制 1.1（需求：克制方额外 10% 伤害），被克制 0.9，其余 1 */
const DMG_RULES = {
  water: { fire: 1.1, wind: 0.9, god: 0.9, demon: 0.9 },
  fire:  { wind: 1.1, water: 0.9, god: 0.9, demon: 0.9 },
  wind:  { water: 1.1, fire: 0.9, god: 0.9, demon: 0.9 },
  god:   { demon: 1.1, water: 1.1, fire: 1.1, wind: 1.1 },
  demon: { god: 1.1, water: 1.1, fire: 1.1, wind: 1.1 },
};
function typeMul(atkEle, defEle) {
  return (DMG_RULES[atkEle] && DMG_RULES[atkEle][defEle]) || 1;
}

/* 技能：通用撞击 + 各系三档（1/3/5 星解锁） */
const SKILLS = {
  basic: { name: "撞击", pw: 1.0, desc: "无属性物理攻击" },
  water: [
    { name: "水流弹", pw: 1.15, desc: "凝聚水流冲击对手" },
    { name: "惊涛骇浪", pw: 1.45, desc: "召唤巨浪吞噬敌人" },
    { name: "深海裁决", pw: 1.8, desc: "深海之力的终极审判" },
  ],
  fire: [
    { name: "火花", pw: 1.15, desc: "喷出炽热火花" },
    { name: "烈焰风暴", pw: 1.45, desc: "卷起烈焰旋风" },
    { name: "焚天烈焰", pw: 1.8, desc: "焚尽万物的神火" },
  ],
  wind: [
    { name: "风刃", pw: 1.15, desc: "高速风刃切割" },
    { name: "疾风龙卷", pw: 1.45, desc: "召唤龙卷席卷战场" },
    { name: "虚空风暴", pw: 1.8, desc: "撕裂天空的风暴" },
  ],
  god: [
    { name: "圣光击", pw: 1.2, desc: "神圣光辉打击" },
    { name: "神圣审判", pw: 1.5, desc: "降下光之审判" },
    { name: "神罚·万象", pw: 1.95, desc: "代行神明之力" },
  ],
  demon: [
    { name: "暗影球", pw: 1.2, desc: "压缩暗影轰击" },
    { name: "深渊吞噬", pw: 1.5, desc: "深渊之口吞噬一切" },
    { name: "末日审判", pw: 1.95, desc: "召唤终焉之力" },
  ],
};
/* 返回某幻兽当前可用技能列表 */
function skillsOf(mon) {
  const list = [{ ...SKILLS.basic, ele: null }];
  const arr = SKILLS[mon.ele] || [];
  const tiers = [1, 3, 5]; // 升星解锁技能星级
  for (let i = 0; i < arr.length; i++) if (mon.star >= tiers[i]) list.push({ ...arr[i], ele: mon.ele });
  return list;
}

/* 品质：N < R < SR < SSR < UR —— 品质系数作用于属性 */
const QUALITY = {
  N:   { name: "N",   mul: 1.00, color: "#6b7c8f", w: 0 },
  R:   { name: "R",   mul: 1.12, color: "#2980b9", w: 1 },
  SR:  { name: "SR",  mul: 1.26, color: "#8e44ad", w: 2 },
  SSR: { name: "SSR", mul: 1.46, color: "#e67e22", w: 3 },
  UR:  { name: "UR",  mul: 1.72, color: "#e84393", w: 4 },
};
/* 星级：等级上限 = 星级×10；洗髓区间随星级提升 */
const STAR_CAP_LV = [0, 10, 20, 30, 40, 50];
const APT_RANGE = [null, [10, 40], [20, 55], [35, 70], [50, 85], [65, 100]];
function starUpCost(star) { return { gold: 200 * star, gem: (star - 1) * 2 }; }

/* ================= 幻兽图鉴 =================
   shape: blob / bird / beast / reptile / bug / sprite / fish / dragon
   feature: horn / crown / fin / ears / spikes / halo / flame / shell / null
*/
const SPECIES = {
  // —— 水之进化链 ——
  spri:    { name: "滴仔",     ele: "water", stage: 1, shape: "blob",    c1: "#56ccf2", c2: "#2f80ed", ac: "#dff6ff", feature: null,    size: 0.8,  base: { hp: 46, atk: 11 }, evoTo: "spry",    evoLv: 12, dex: "身体由清水凝成，紧张时会冒出水泡。" },
  spry:    { name: "滴汐",     ele: "water", stage: 2, shape: "blob",    c1: "#3da9fc", c2: "#2b6cb0", ac: "#bde7ff", feature: "fin",   size: 0.98, base: { hp: 64, atk: 16 }, evoTo: "pose",    evoLv: 28, dex: "能操控潮汐的方向，头顶长着小鳍。" },
  pose:    { name: "潮汐领主", ele: "water", stage: 3, shape: "dragon",  c1: "#2f80ed", c2: "#1b4f9c", ac: "#9ad1ff", feature: "horn",  size: 1.28, base: { hp: 96, atk: 25 }, dex: "怒涛的化身，一声咆哮可掀起巨浪。" },
  // —— 火之进化链 ——
  ember:   { name: "火苗",     ele: "fire",  stage: 1, shape: "reptile", c1: "#ff8a65", c2: "#d84315", ac: "#ffe082", feature: null,    size: 0.8,  base: { hp: 42, atk: 13 }, evoTo: "pyros",   evoLv: 12, dex: "尾巴上有一簇不会熄灭的小火苗。" },
  pyros:   { name: "炎兽",     ele: "fire",  stage: 2, shape: "beast",   c1: "#ff5722", c2: "#bf360c", ac: "#ffcc80", feature: "ears",  size: 0.98, base: { hp: 60, atk: 19 }, evoTo: "infern",  evoLv: 28, dex: "奔跑时脚下会留下燃烧的脚印。" },
  infern:  { name: "烈焰君王", ele: "fire",  stage: 3, shape: "dragon",  c1: "#e64a19", c2: "#8d1f00", ac: "#ffb74d", feature: "flame", size: 1.28, base: { hp: 92, atk: 29 }, dex: "火山深处的君王，吐息能融化岩石。" },
  // —— 风之进化链 ——
  bree:    { name: "风雏",     ele: "wind",  stage: 1, shape: "bird",    c1: "#81c784", c2: "#388e3c", ac: "#dcedc8", feature: null,    size: 0.78, base: { hp: 40, atk: 14 }, evoTo: "gust",    evoLv: 12, dex: "刚出生就能乘着微风滑行。" },
  gust:    { name: "疾风隼",   ele: "wind",  stage: 2, shape: "bird",    c1: "#4caf50", c2: "#1b5e20", ac: "#b9f6ca", feature: "spikes",size: 0.98, base: { hp: 57, atk: 20 }, evoTo: "tempest", evoLv: 28, dex: "俯冲速度超过疾风，几乎无法被捕捉。" },
  tempest: { name: "风暴之主", ele: "wind",  stage: 3, shape: "dragon",  c1: "#00b894", c2: "#00695c", ac: "#a7ffeb", feature: "horn",  size: 1.28, base: { hp: 88, atk: 31 }, dex: "翼展遮天，振翅即化作风暴。" },
  // —— 神 / 魔 ——
  lumi:    { name: "圣光灵",   ele: "god",   stage: 1, shape: "sprite",  c1: "#ffe66d", c2: "#f39c12", ac: "#fffde7", feature: "halo",  size: 0.92, base: { hp: 56, atk: 18 }, dex: "由纯粹的光汇聚而成，传说能带来好运。" },
  tianlu:  { name: "天禄·麒麟",ele: "god",   stage: 1, shape: "beast",   c1: "#ffd93d", c2: "#e67e22", ac: "#fff8e1", feature: "horn",  size: 1.22, base: { hp: 100, atk: 27 }, dex: "神兽麒麟，踏过之处万物生长。" },
  shade:   { name: "暗影子",   ele: "demon", stage: 1, shape: "sprite",  c1: "#9b59b6", c2: "#4a235a", ac: "#e1bee7", feature: null,    size: 0.92, base: { hp: 55, atk: 18 }, dex: "从影子里诞生，喜欢躲在训练师身后。" },
  hundun:  { name: "混沌魔神", ele: "demon", stage: 1, shape: "dragon",  c1: "#6c5ce7", c2: "#2c1668", ac: "#d1c4e9", feature: "spikes",size: 1.22, base: { hp: 98, atk: 28 }, dex: "自混沌中苏醒的远古魔神。" },
  // —— 野生伙伴 ——
  leaf:    { name: "叶耳兽",   ele: "wind",  stage: 1, shape: "beast",   c1: "#7cb342", c2: "#33691e", ac: "#dcedc8", feature: "ears",  size: 0.86, base: { hp: 52, atk: 12 }, dex: "耳朵是两片大叶子，能进行光合作用。" },
  rock:    { name: "岩甲龟",   ele: "water", stage: 1, shape: "reptile", c1: "#8d6e63", c2: "#4e342e", ac: "#bcaaa4", feature: "shell", size: 0.9,  base: { hp: 62, atk: 10 }, evoTo: "aegis",   evoLv: 22, dex: "背壳坚硬如岩，缩起来就像块石头。" },
  aegis:   { name: "玄甲龙龟", ele: "water", stage: 2, shape: "reptile", c1: "#6d4c41", c2: "#2d1b14", ac: "#a1887f", feature: "shell", size: 1.16, base: { hp: 94, atk: 18 }, dex: "传说之盾，背壳上刻着古老纹路。" },
  magma:   { name: "熔岩石灵", ele: "fire",  stage: 1, shape: "blob",    c1: "#a1887f", c2: "#5d4037", ac: "#ff8a65", feature: null,    size: 0.84, base: { hp: 50, atk: 13 }, dex: "火山岩里的小精怪，身体暖烘烘的。" },
  moth:    { name: "霓羽蛾",   ele: "wind",  stage: 1, shape: "bug",     c1: "#ce93d8", c2: "#6a1b9a", ac: "#f3e5f5", feature: "spikes",size: 0.84, base: { hp: 48, atk: 15 }, dex: "翅膀上的鳞粉会折射出霓虹光芒。" },
  fluff:   { name: "毛团团",   ele: "wind",  stage: 1, shape: "blob",    c1: "#f48fb1", c2: "#c2185b", ac: "#fce4ec", feature: "ears",  size: 0.76, base: { hp: 44, atk: 12 }, dex: "一团会跳的棉花糖，生气时会炸毛。" },
  finny:   { name: "泡泡鱼",   ele: "water", stage: 1, shape: "fish",    c1: "#4dd0e1", c2: "#00838f", ac: "#b2ebf2", feature: "fin",   size: 0.78, base: { hp: 43, atk: 13 }, dex: "吐出的泡泡很久都不会破。" },
  cinder:  { name: "小灯灵",   ele: "fire",  stage: 1, shape: "sprite",  c1: "#ffb74d", c2: "#e65100", ac: "#fff9c4", feature: "flame", size: 0.82, base: { hp: 47, atk: 14 }, dex: "提着一盏永不熄灭的小灯。" },
};
const STARTERS = ["spri", "ember", "bree"];

/* ================= 岛屿 ================= */
const ISLANDS = [
  {
    id: "begin", name: "初心岛", needLv: 1, size: [34, 24],
    theme: { grass: "#8bdc6c", grass2: "#7ed361", sand: "#f4e0a0", tree: "#4e9e3d", treeD: "#3d7e30", water: "#5fb8ee", waterD: "#3d9adc", rock: "#b0a99a" },
    desc: "微风阵阵的新手岛屿，生活着温顺的草系与水系幻兽。",
    wild: [
      { sp: "leaf", w: 30, min: 2, max: 6 },
      { sp: "finny", w: 24, min: 2, max: 6 },
      { sp: "fluff", w: 22, min: 2, max: 6 },
      { sp: "spri", w: 10, min: 3, max: 6 },
      { sp: "ember", w: 8, min: 3, max: 6 },
      { sp: "bree", w: 6, min: 3, max: 6 },
    ],
    rare: [{ sp: "lumi", w: 1, min: 4, max: 7 }, { sp: "shade", w: 1, min: 4, max: 7 }],
    qRolls: [["N", 60], ["R", 32], ["SR", 7], ["SSR", 1], ["UR", 0]],
    eggs: 2, npc: ["prof", "heal"], resources: 6,
  },
  {
    id: "fire", name: "落日火山", needLv: 5, size: [34, 24],
    theme: { grass: "#c9a86a", grass2: "#bd9a5d", sand: "#e8b878", tree: "#9c6b3a", treeD: "#7a5230", water: "#4f9bc4", waterD: "#3577a0", rock: "#8d8076" },
    desc: "遍布熔岩与温泉的火山岛，火系幻兽在此栖息。",
    wild: [
      { sp: "magma", w: 28, min: 10, max: 16 },
      { sp: "cinder", w: 22, min: 10, max: 16 },
      { sp: "ember", w: 16, min: 11, max: 16 },
      { sp: "pyros", w: 12, min: 13, max: 18 },
      { sp: "rock", w: 12, min: 11, max: 16 },
      { sp: "finny", w: 10, min: 11, max: 15 },
    ],
    rare: [{ sp: "infern", w: 1, min: 15, max: 18 }, { sp: "hundun", w: 1, min: 16, max: 19 }],
    qRolls: [["N", 40], ["R", 38], ["SR", 16], ["SSR", 5], ["UR", 1]],
    eggs: 3, npc: ["heal", "sage"], resources: 7,
  },
  {
    id: "wind", name: "风语高地", needLv: 12, size: [34, 24],
    theme: { grass: "#6fcf97", grass2: "#5ec288", sand: "#dfe9c0", tree: "#2f8f6b", treeD: "#226b50", water: "#4aa8d8", waterD: "#2f7fae", rock: "#9aa89b" },
    desc: "终年劲风的高原岛屿，风系幻兽在空中盘旋。",
    wild: [
      { sp: "gust", w: 24, min: 20, max: 28 },
      { sp: "moth", w: 20, min: 20, max: 27 },
      { sp: "bree", w: 14, min: 20, max: 26 },
      { sp: "aegis", w: 12, min: 22, max: 29 },
      { sp: "tempest", w: 8, min: 25, max: 31 },
      { sp: "leaf", w: 12, min: 20, max: 25 },
      { sp: "fluff", w: 10, min: 20, max: 25 },
    ],
    rare: [{ sp: "tianlu", w: 1, min: 26, max: 32 }, { sp: "hundun", w: 1, min: 26, max: 32 }],
    qRolls: [["N", 25], ["R", 35], ["SR", 25], ["SSR", 12], ["UR", 3]],
    eggs: 3, npc: ["sage", "heal"], resources: 8,
  },
  {
    id: "saint", name: "神魔圣域", needLv: 20, size: [34, 24],
    theme: { grass: "#b8a9d9", grass2: "#a999cc", sand: "#ece0f5", tree: "#6a4c93", treeD: "#4e3570", water: "#8e7cc3", waterD: "#674ea7", rock: "#7d6f96" },
    desc: "漂浮在云海尽头的圣域，神魔系传说幻兽偶现于此。",
    wild: [
      { sp: "lumi", w: 22, min: 28, max: 36 },
      { sp: "shade", w: 22, min: 28, max: 36 },
      { sp: "tianlu", w: 8, min: 32, max: 40 },
      { sp: "hundun", w: 8, min: 32, max: 40 },
      { sp: "tempest", w: 14, min: 28, max: 35 },
      { sp: "infern", w: 14, min: 28, max: 35 },
      { sp: "pose", w: 12, min: 28, max: 35 },
    ],
    rare: [{ sp: "tianlu", w: 2, min: 34, max: 42 }, { sp: "hundun", w: 2, min: 34, max: 42 }],
    qRolls: [["N", 10], ["R", 28], ["SR", 32], ["SSR", 22], ["UR", 8]],
    eggs: 4, npc: ["sage", "prof"], resources: 8,
  },
];
/* 蛋的出宠表 */
const EGG_TABLE = [
  { sp: "spri", w: 16 }, { sp: "ember", w: 16 }, { sp: "bree", w: 16 },
  { sp: "leaf", w: 14 }, { sp: "finny", w: 12 }, { sp: "fluff", w: 12 },
  { sp: "rock", w: 8 }, { sp: "magma", w: 6 },
  { sp: "lumi", w: 2 }, { sp: "shade", w: 2 },
  { sp: "pyros", w: 2 }, { sp: "gust", w: 2 },
];
const EGG_Q_ROLLS = [["N", 45], ["R", 35], ["SR", 14], ["SSR", 5], ["UR", 1]];
const EGG_STEPS = 500;

/* NPC 台词 */
const NPCS = {
  prof: { name: "幻兽博士", color: "#f39c12", lines: ["欢迎来到幻兽群岛！靠近野生幻兽，就能尝试捕捉或战斗。", "幻兽升星后会解锁新技能、提升等级上限，还能扩大洗髓范围哦。"] },
  heal: { name: "治愈天使", color: "#26de81", lines: ["需要回复吗？你的幻兽马上就能元气满满！", "每只幻兽都有自己的资质，资质会直接加成到你的属性上。"] },
  sage: { name: "流浪贤者", color: "#8854d0", lines: ["神与魔相互克制，并同时克制水、火、风三系。", "水克火、火克风、风克水——掌握克制，伤害提升 10%。", "多去辅战位培养幻兽，它们的资质会让你更强大！"] },
};

/* ================= 道具 ================= */
const ITEMS = {
  ball:   { name: "精灵球", ico: "🔴", desc: "捕捉野生幻兽，捕捉失败会进入战斗。", price: 50 },
  gball:  { name: "高级球", ico: "🔵", desc: "更高的捕捉成功率（1.6 倍）。", price: 200 },
  potion: { name: "体力药剂", ico: "🧪", desc: "战斗中为出战幻兽恢复 40 点生命。", price: 60 },
  herb:   { name: "星辉草", ico: "🌿", desc: "升星的必需材料。", price: 0 },
  crystal:{ name: "幻兽水晶", ico: "💠", desc: "高级升星所需的稀有材料。", price: 0 },
  gem:    { name: "钻石", ico: "💎", desc: "珍贵货币，用于高级升星。", price: 0 },
};
/* 资源点掉落 */
const RES_DROPS = {
  coin: { name: "金币堆", ico: "🪙", loot: { gold: [60, 160] } },
  herb: { name: "星辉草丛", ico: "🌿", loot: { items: { herb: [1, 2] } } },
  crystal: { name: "水晶矿", ico: "💠", loot: { items: { crystal: [1, 1] }, gem: [1, 2] } },
  ball: { name: "补给箱", ico: "📦", loot: { items: { ball: [2, 3], potion: [1, 1] } } },
};
const RES_RESPAWN_MS = 45000;
const EGG_NEST_RESPAWN_MS = 120000;
const RES_KINDS = ["coin", "herb", "crystal", "ball"];

/* ================= 数值公式 ================= */
const TILE = 32;
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pickWeighted(list) {
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const item of list) { r -= item.w; if (r < 0) return item; }
  return list[list.length - 1];
}
function rollQuality(rolls) { return pickWeighted(rolls.map(([q, w]) => ({ sp: q, w }))).sp; }
function aptFor(star, q) {
  const [lo, hi] = APT_RANGE[star];
  const qBonus = QUALITY[q].w * 2;
  return Math.min(100, randInt(lo, hi) + qBonus);
}
/* 幻兽属性 = 基础 × 品质系数 × 星级 × (1 + 等级×0.08 + 资质/100) */
function monMaxHp(mon) {
  const s = SPECIES[mon.sp];
  return Math.round(s.base.hp * QUALITY[mon.q].mul * mon.star * (1 + (mon.lv - 1) * 0.09 + mon.apt / 100) + 10);
}
function monAtk(mon) {
  const s = SPECIES[mon.sp];
  return Math.round(s.base.atk * QUALITY[mon.q].mul * mon.star * (1 + (mon.lv - 1) * 0.085 + mon.apt / 100));
}
function monDef(mon) { return Math.round(monAtk(mon) * 0.35); }
function monPower(mon) { return monMaxHp(mon) + monAtk(mon) * 4 + mon.star * 30 + QUALITY[mon.q].w * 60; }

function expToNextLv(lv) { return 40 + lv * lv * 6; }
function trainerExpToNext(lv) { return 80 + lv * 25; }

let MON_UID = 1;
function makeMon(sp, lv, q, star) {
  star = star || 1;
  q = q || "N";
  const apt = aptFor(star, q);
  const mon = { uid: MON_UID++, sp, ele: SPECIES[sp].ele, lv: Math.max(1, lv), q, star, apt, exp: 0, skillExp: 0 };
  mon.maxHp = monMaxHp(mon);
  mon.hp = mon.maxHp;
  mon.atk = monAtk(mon);
  return mon;
}
function spawnWild(island) {
  const useRare = Math.random() < 0.06;
  const pool = useRare ? island.rare : island.wild;
  const e = pickWeighted(pool);
  const q = rollQuality(island.qRolls);
  return makeMon(e.sp, randInt(e.min, e.max), q, 1);
}

/* 捕捉率：基础 0.5，受品质（越稀有越难）、血量、等级差、球种影响 */
function captureRate(wild, ballId, trainerLv) {
  const hpFactor = 1 + (1 - wild.hp / wild.maxHp) * 1.1; // 残血大幅提升
  const qFactor = 1 - QUALITY[wild.q].w * 0.08;
  const lvFactor = Math.max(0.7, 1.2 - (wild.lv - trainerLv) * 0.02);
  const ball = ballId === "gball" ? 1.6 : 1.0;
  return Math.min(0.95, 0.5 * hpFactor * qFactor * lvFactor * ball);
}
