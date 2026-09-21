/* 冒烟测试：在 Node 中模拟最小浏览器环境，验证核心逻辑 */
const fs = require("fs");
const vm = require("vm");

function makeCtx2d() {
  return new Proxy({}, { get: (t, k) => {
    if (k === "canvas") return { width: 120, height: 120 };
    if (k === "measureText") return () => ({ width: 10 });
    return typeof k === "string" ? () => {} : undefined;
  }, set: () => true });
}
const elements = {};
function el(id) {
  if (!elements[id]) elements[id] = {
    id, style: {}, dataset: {}, children: [], className: "", innerHTML: "", textContent: "",
    width: 120, height: 120,
    appendChild(c) { this.children.push(c); }, removeChild() {}, querySelector: () => ({ style: {}, classList: { remove() {}, add() {} }, remove() {} }),
    querySelectorAll: () => [], addEventListener() {}, getContext: () => makeCtx2d(), closest: () => null,
  };
  return elements[id];
}
const sandbox = {
  console, Math, Date, JSON, localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  document: {
    getElementById: el,
    querySelector: () => ({ style: {}, classList: { remove() {}, add() {} } }),
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, getContext: () => makeCtx2d() }),
    addEventListener() {},
  },
  window: { addEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ["data.js", "sprite.js", "state.js", "world.js", "battle.js", "ui.js"]) {
  vm.runInContext(fs.readFileSync("js/" + f, "utf8"), sandbox, { filename: f });
}
vm.runInContext(`
  globalThis.__D = { STAR_CAP_LV, APT_RANGE, SPECIES, ISLANDS, ITEMS, ELEMENTS, QUALITY, EGG_STEPS, TILE, SKILLS, Game, makeMon, typeMul, skillsOf, newPlayer, activeMon, trainerStats, recalcMon, gainMonExp, canStarUp, doStarUp, rerollApt, captureRate, addEgg, hatchEgg, moveToSupport, upgradeSupport, calcDamage, initIslandRun, walkableAt };
`, sandbox);
const D = sandbox.__D;

const g = sandbox;
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log("  OK " + name); } else { fail++; console.log("  FAIL " + name); } }

console.log("[1] 属性克制");
check("水克火 1.1", D.typeMul("water", "fire") === 1.1);
check("火克风 1.1", D.typeMul("fire", "wind") === 1.1);
check("风克水 1.1", D.typeMul("wind", "water") === 1.1);
check("神克魔 1.1", D.typeMul("god", "demon") === 1.1);
check("魔克神 1.1", D.typeMul("demon", "god") === 1.1);
check("神克水火风", D.typeMul("god", "water") === 1.1 && D.typeMul("god", "fire") === 1.1 && D.typeMul("god", "wind") === 1.1);
check("水打风 0.9", D.typeMul("water", "wind") === 0.9);
check("同系 1.0", D.typeMul("water", "water") === 1);

console.log("[2] 幻兽属性");
const n1 = D.makeMon("spri", 5, "N", 1);
const ur1 = D.makeMon("spri", 5, "UR", 1);
check("UR 强于 N", ur1.maxHp > n1.maxHp && ur1.atk > n1.atk);
const s3 = D.makeMon("spri", 10, "N", 3);
check("3星等级上限30", D.STAR_CAP_LV[3] === 30);
check("5星洗髓上限100", D.APT_RANGE[5][1] === 100 && D.APT_RANGE[1][0] === 10);
check("1星技能2个", D.skillsOf(n1).length === 2);
check("3星技能3个", D.skillsOf(s3).length === 3);
const s5 = D.makeMon("spri", 10, "N", 5);
check("5星技能4个", D.skillsOf(s5).length === 4);

console.log("[3] 岛屿生成");
for (const isl of D.ISLANDS) {
  const run = D.initIslandRun(isl);
  check(isl.id + " 野怪9", run.wild.length === 9);
  check(isl.id + " 资源" + isl.resources, run.res.length === isl.resources);
  check(isl.id + " 蛋" + isl.eggs, run.eggs.length === isl.eggs);
  check(isl.id + " 传送门" + (D.ISLANDS.length - 1), run.portals.length === D.ISLANDS.length - 1);
  check(isl.id + " NPC" + isl.npc.length, run.npcs.length === isl.npc.length);
  const pos = new Set();
  let ok = true;
  for (const e of [...run.wild, ...run.res, ...run.eggs, ...run.npcs, ...run.portals]) {
    const key = e.tx + "," + e.ty;
    if (pos.has(key)) ok = false;
    pos.add(key);
    const t = run.map.grid[e.ty][e.tx];
    if (t !== "G" && t !== "g" && t !== "S") ok = false;
  }
  check(isl.id + " 实体不重叠/合法", ok);
  check(isl.id + " 出生点可行走", D.walkableAt(run.map, run.map.spawn.x, run.map.spawn.y));
}

console.log("[4] 状态与资质加成");
D.Game.player = D.newPlayer("ember");
check("初始2只", D.Game.player.team.filter(Boolean).length === 2);
check("出战第1只", D.activeMon() === D.Game.player.team[0]);
const atk0 = D.trainerStats().atk;
D.Game.player.team[0].apt += 20;
check("资质提升训练师攻击", D.trainerStats().atk > atk0);

console.log("[5] 成长/进化/升星");
const m = D.Game.player.team[0];
m.star = 2; D.recalcMon(m, true);
D.gainMonExp(m, 999999);
check("2星封顶 Lv20", m.lv === 20);
check("Lv12+ 已进化一阶段", m.sp === "pyros");
m.star = 5; D.recalcMon(m, true);
D.gainMonExp(m, 9999999);
check("5星封顶 Lv50", m.lv === 50);
check("进化至 infern", m.sp === "infern");
D.Game.player.gold = 99999; D.Game.player.gem = 999;
D.Game.player.items.herb = 99; D.Game.player.items.crystal = 99;
const m2 = D.makeMon("leaf", 1, "N", 1);
D.Game.player.box.push(m2);
check("1星满足升星条件", D.canStarUp(m2).ok === true);
D.doStarUp(m2);
check("升星后2星", m2.star === 2);
const oldApt = m2.apt;
D.rerollApt(m2);
check("洗髓花费金币", D.Game.player.gold < 99999);

console.log("[6] 捕捉率");
const w = D.makeMon("leaf", 5, "N", 1);
const full = D.captureRate(w, "ball", 1);
w.hp = Math.floor(w.maxHp / 2);
const half = D.captureRate(w, "ball", 1);
check("残血捕捉率更高", half > full);
const w2 = D.makeMon("leaf", 20, "SSR", 1);
check("高级球>普通球", D.captureRate(w2, "gball", 1) > D.captureRate(w2, "ball", 1));

console.log("[7] 蛋");
D.addEgg();
D.Game.player.eggs[0].steps = D.Game.player.eggs[0].stepsNeed;
const h = D.hatchEgg(0);
check("孵化出幻兽", !!h && !!h.mon);

console.log("[8] 辅战位");
D.Game.player.flags.support1 = true;
const sup = D.Game.player.team[1];
const base = D.trainerStats().atk;
D.moveToSupport(0, 1);
check("进入辅战位", !!D.Game.player.support[0]);
const withSup = D.trainerStats().atk;
check("辅战加攻击", withSup >= base);
D.upgradeSupport(0);
check("辅战升级Lv2", D.Game.player.supportLv[0] === 2);
check("升级后加成更高", D.trainerStats().atk >= withSup);

console.log("[9] 战斗克制伤害");
const a = D.makeMon("spri", 10, "R", 1);
const f = D.makeMon("ember", 10, "R", 1);
check("水打火1.1/火打水0.9",
  D.calcDamage(a, f, { pw: 1, ele: "water" }).mul === 1.1 &&
  D.calcDamage(f, a, { pw: 1, ele: "fire" }).mul === 0.9);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
