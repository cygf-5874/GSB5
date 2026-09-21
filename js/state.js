/* ================= state.js ：全局状态 / 存档 / 养成逻辑 ================= */
"use strict";

const SAVE_KEY = "monster_isles_save_v1";

const Game = {
  player: null,
  worldRuns: {},   // 每座岛的运行时实体（野怪/资源/蛋），不存档
  currentIsland: "begin",
  started: false,
};

function newPlayer(starterSp) {
  const starter = makeMon(starterSp, 5, "R", 1);
  const second = makeMon("fluff", 3, "N", 1);
  return {
    lv: 1, exp: 0,
    gold: 120, gem: 3,
    steps: 0,
    items: { ball: 8, gball: 1, potion: 3, herb: 1, crystal: 0 },
    team: [starter, second, null, null, null, null], // 主战位 6 格（其中前3为可战斗位）
    support: [null, null],                            // 辅战位
    supportLv: [1, 1],
    box: [],          // 存放额外幻兽
    eggs: [],
    activeIdx: 0,
    switchCdUntil: 0,
    island: "begin",
    discovered: ["begin"],
    flags: {},
    pos: { x: 17, y: 18 },
  };
}

/* ---------- 存档 ---------- */
function saveGame() {
  if (!Game.player) return;
  try {
    const data = { v: 1, p: Game.player };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 存储不可用时静默 */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !data.p) return false;
    Game.player = data.p;
    Game.currentIsland = Game.player.island || "begin";
    Game.started = true;
    let maxUid = MON_UID;
    for (const m of allMons()) maxUid = Math.max(maxUid, m.uid + 1);
    MON_UID = maxUid;
    return true;
  } catch (e) { return false; }
}
function resetSave() { localStorage.removeItem(SAVE_KEY); }

/* ---------- 遍历 ---------- */
function allMons() {
  const p = Game.player;
  return [...p.team.filter(Boolean), ...p.support.filter(Boolean), ...p.box, ...p.eggs.filter(Boolean)].filter(Boolean);
}
function activeMon() { return Game.player.team[Game.player.activeIdx] || Game.player.team.find(Boolean); }

/* ---------- 训练师派生属性（资质加成直接作用于角色） ---------- */
/* 主战位幻兽：资质 ×(0.25) → 攻击加成；每点资质 0.6 生命加成 */
/* 辅战位幻兽：资质 ×(0.30 × 辅战位等级) → 攻击；0.8 × 等级 → 生命 */
function trainerStats() {
  const p = Game.player;
  let atkBonus = 0, hpBonus = 0;
  for (const m of p.team) {
    if (!m) continue;
    atkBonus += m.apt * 0.25;
    hpBonus += m.apt * 0.6;
  }
  for (let i = 0; i < p.support.length; i++) {
    const m = p.support[i];
    if (!m) continue;
    const lv = p.supportLv[i] || 1;
    atkBonus += m.apt * 0.30 * lv;
    hpBonus += m.apt * 0.8 * lv;
  }
  const maxHp = 100 + p.lv * 12 + Math.round(hpBonus);
  return {
    maxHp,
    hp: Math.min(p.hp || maxHp, maxHp),
    atk: 8 + p.lv * 2 + Math.round(atkBonus),
  };
}
function trainerExpNeed() { return trainerExpToNext(Game.player.lv); }

/* ---------- 升级 / 经验 ---------- */
function gainTrainerExp(amount) {
  const p = Game.player;
  p.exp += amount;
  let need = trainerExpNeed();
  while (p.exp >= need) {
    p.exp -= need;
    p.lv++;
    need = trainerExpNeed();
    toast("训练师升级！现在是 Lv." + p.lv, "ok");
    checkUnlocks();
  }
}
function checkUnlocks() {
  const lv = Game.player.lv;
  if (lv === 5 && !Game.player.flags.support1) { Game.player.flags.support1 = true; toast("解锁辅战位 1！可在背包中安排幻兽助阵", "ok"); }
  if (lv === 10 && !Game.player.flags.support2) { Game.player.flags.support2 = true; toast("解锁辅战位 2！", "ok"); }
}
function supportSlotCount() {
  return (Game.player.flags.support1 ? 1 : 0) + (Game.player.flags.support2 ? 1 : 0);
}

/* 战斗胜利经验：出战幻兽得 100%，其余主战位 30% */
function gainMonExp(mon, amount) {
  if (!mon) return [];
  const evos = [];
  mon.exp += amount;
  let need = expToNextLv(mon.lv);
  while (mon.exp >= need) {
    if (mon.lv >= STAR_CAP_LV[mon.star]) { mon.exp = need; break; }
    mon.exp -= need;
    mon.lv++;
    recalcMon(mon, false);
    const hpGain = 0;
    evos.push({ mon, lvUp: true });
    need = expToNextLv(mon.lv);
    /* 检查进化 */
    const sp = SPECIES[mon.sp];
    if (sp.evoTo && mon.lv >= sp.evoLv) {
      mon.sp = sp.evoTo;
      recalcMon(mon, true);
      evos.push({ mon, evolved: true });
    }
  }
  return evos;
}
function recalcMon(mon, fullHeal) {
  const oldMax = mon.maxHp || 0;
  mon.maxHp = monMaxHp(mon);
  mon.atk = monAtk(mon);
  if (fullHeal) mon.hp = mon.maxHp;
  else mon.hp = Math.min(mon.maxHp, mon.hp + (mon.maxHp - oldMax));
}

/* ---------- 升星 ---------- */
function canStarUp(mon) {
  if (!mon || mon.star >= 5) return { ok: false, reason: "已满 5 星" };
  const cost = starUpCost(mon.star + 1);
  const p = Game.player;
  if (p.gold < cost.gold) return { ok: false, reason: "金币不足" };
  if (p.gem < cost.gem) return { ok: false, reason: "钻石不足" };
  const herbNeed = mon.star;
  const cryNeed = mon.star >= 3 ? mon.star - 2 : 0;
  if ((p.items.herb || 0) < herbNeed) return { ok: false, reason: "星辉草不足" };
  if ((p.items.crystal || 0) < cryNeed) return { ok: false, reason: "幻兽水晶不足" };
  return { ok: true, cost, herbNeed, cryNeed };
}
function doStarUp(mon) {
  const c = canStarUp(mon);
  if (!c.ok) return c.reason;
  const p = Game.player;
  p.gold -= c.cost.gold; p.gem -= c.cost.gem;
  p.items.herb -= c.herbNeed; p.items.crystal -= c.cryNeed;
  mon.star++;
  recalcMon(mon, false);
  mon.skillExp = mon.skillExp || 0;
  saveGame();
  return null;
}
/* 洗髓：重新随资质，范围由当前星级决定，评级（品质）继承 */
function rerollCost(star) { return 150 * star; }
function rerollApt(mon) {
  const cost = rerollCost(mon.star);
  if (Game.player.gold < cost) return "金币不足";
  Game.player.gold -= cost;
  mon.apt = aptFor(mon.star, mon.q);
  recalcMon(mon, false);
  saveGame();
  return null;
}

/* ---------- 队伍管理 ---------- */
function addMon(mon) {
  const p = Game.player;
  const empty = p.team.findIndex((x) => !x);
  if (empty >= 0) { p.team[empty] = mon; return "team"; }
  p.box.push(mon);
  return "box";
}
function moveBoxToTeam(idx) {
  const p = Game.player;
  const empty = p.team.findIndex((x) => !x);
  if (empty < 0) return false;
  p.team[empty] = p.box[idx];
  p.box.splice(idx, 1);
  return true;
}
function moveTeamToBox(idx) {
  const p = Game.player;
  if (!p.team[idx]) return false;
  if (p.team.filter(Boolean).length <= 1) return false;
  p.box.push(p.team[idx]);
  p.team[idx] = null;
  if (idx === p.activeIdx) p.activeIdx = p.team.findIndex(Boolean);
  return true;
}
function moveToSupport(where, idx) {
  const p = Game.player;
  if (p.support[where]) return false;
  p.support[where] = p.team[idx];
  p.team[idx] = null;
  if (idx === p.activeIdx) p.activeIdx = p.team.findIndex(Boolean);
  saveGame();
  return true;
}
function supportBack(where) {
  const p = Game.player;
  if (!p.support[where]) return false;
  const empty = p.team.findIndex((x) => !x);
  if (empty < 0) { p.box.push(p.support[where]); }
  else { p.team[empty] = p.support[where]; if (!activeMon()) p.activeIdx = empty; }
  p.support[where] = null;
  saveGame();
  return true;
}
function supportUpgradeCost(lv) { return { gold: 300 * lv, gem: lv }; }
function upgradeSupport(where) {
  const p = Game.player;
  const lv = p.supportLv[where] || 1;
  if (lv >= 10 || !p.support[where]) return false;
  const c = supportUpgradeCost(lv);
  if (p.gold < c.gold || p.gem < c.gem) return false;
  p.gold -= c.gold; p.gem -= c.gem;
  p.supportLv[where] = lv + 1;
  saveGame();
  return true;
}

/* ---------- 蛋 ---------- */
function addEgg() {
  Game.player.eggs.push({ id: MON_UID++, steps: 0, stepsNeed: EGG_STEPS });
}
function tickSteps(n) {
  const p = Game.player;
  p.steps += n;
  for (const egg of p.eggs) if (egg.steps < egg.stepsNeed) egg.steps = Math.min(egg.stepsNeed, egg.steps + n);
}
function hatchEgg(eggIdx) {
  const p = Game.player;
  const egg = p.eggs[eggIdx];
  if (!egg || egg.steps < egg.stepsNeed) return null;
  const e = pickWeighted(EGG_TABLE);
  const q = rollQuality(EGG_Q_ROLLS);
  const mon = makeMon(e.sp, 1, q, 1);
  p.eggs.splice(eggIdx, 1);
  const where = addMon(mon);
  return { mon, where };
}

/* 全队回复 */
function healAll() {
  for (const m of allMons()) { if (m.maxHp) m.hp = m.maxHp; }
  const ts = trainerStats();
  Game.player.hp = ts.maxHp;
  saveGame();
}
