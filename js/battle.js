/* ================= battle.js ：回合制战斗 ================= */
"use strict";

const Battle = {
  active: false,
  ally: null,
  enemy: null,
  enemyEntity: null,
  busy: false,
  ended: false,
};

function startBattle(mon, entity) {
  const ally = activeMon();
  if (!ally) { toast("没有可以出战的幻兽"); return false; }
  Battle.active = true;
  Battle.enemy = mon;
  Battle.enemyEntity = entity || null;
  Battle.busy = false;
  Battle.ended = false;
  setAlly(ally);
  document.getElementById("battle-screen").className = "";
  logBattle("野生的 " + qName(mon) + " 出现了！");
  renderBattle();
  saveGame();
  return true;
}
function setAlly(mon) { Battle.ally = mon; }
function endBattle(result) {
  Battle.ended = true;
  setTimeout(() => {
    Battle.active = false;
    document.getElementById("battle-screen").className = "screen-hidden";
    if (result === "win") afterWin();
    else if (result === "caught") {}
    else { logClear(); }
    saveGame();
  }, 900);
}
function afterWin() {
  const e = Battle.enemy;
  const baseExp = Math.round(18 + e.lv * 5 + QUALITY[e.q].w * 12);
  const p = Game.player;
  /* 出战幻兽全额，主战位其它幻兽 30% */
  const ally = Battle.ally;
  let evos = gainMonExp(ally, baseExp);
  for (const m of p.team) if (m && m !== ally) gainMonExp(m, Math.round(baseExp * 0.3));
  const gold = randInt(20, 45) + e.lv * 3;
  p.gold += gold;
  gainTrainerExp(Math.round(baseExp * 0.5));
  toast("胜利！获得 " + baseExp + " 经验，金币 +" + gold, "ok");
  reportEvos(evos);
  /* 野怪消失并重新刷新 */
  if (Battle.enemyEntity) {
    const run = getRun(Game.currentIsland);
    const idx = run.wild.indexOf(Battle.enemyEntity);
    if (idx >= 0) respawnWild(run, run.wild[idx]);
  }
  healCheck();
}
function reportEvos(evos) {
  for (const ev of evos) {
    if (ev.evolved) setTimeout(() => toast("✨ " + SPECIES[ev.mon.sp].name + " 进化为更强大的形态！", "ok"), 500);
  }
}
function healCheck() {
  /* 不自动回复，需找治愈天使或用药剂 */
}

/* ---------- 伤害 ---------- */
function calcDamage(attacker, defender, skill) {
  const ele = skill.ele || SPECIES[attacker.sp].ele;
  const defEle = SPECIES[defender.sp].ele;
  const mul = typeMul(ele, defEle);
  const base = attacker.atk * skill.pw;
  const dmg = Math.max(1, Math.round((base - monDef(defender) * 0.5) * mul * (0.9 + Math.random() * 0.2)));
  return { dmg, mul };
}
function allyUseSkill(skill) {
  if (Battle.busy || Battle.ended) return;
  Battle.busy = true;
  const { dmg, mul } = calcDamage(Battle.ally, Battle.enemy, skill);
  Battle.enemy.hp = Math.max(0, Battle.enemy.hp - dmg);
  shakeSide("enemy");
  floatDmg("enemy", dmg, mul > 1);
  const adv = mul > 1 ? "效果拔群！" : mul < 1 ? "效果不佳…" : "";
  logBattle(SPECIES[Battle.ally.sp].name + " 使用了 " + skill.name + "，造成 " + dmg + " 伤害 " + adv);
  renderBattle();
  setTimeout(() => {
    if (Battle.enemy.hp <= 0) { logBattle(qName(Battle.enemy) + " 被击败！"); renderBattle(); endBattle("win"); return; }
    enemyTurn();
  }, 650);
}
function enemyTurn() {
  const e = Battle.enemy;
  const eSkills = skillsOf(e);
  const skill = eSkills[Math.floor(Math.random() * Math.min(2, eSkills.length))];
  const { dmg, mul } = calcDamage(e, Battle.ally, skill);
  Battle.ally.hp = Math.max(0, Battle.ally.hp - dmg);
  shakeSide("ally");
  floatDmg("ally", dmg, mul > 1);
  const adv = mul > 1 ? "效果拔群！" : mul < 1 ? "效果不佳…" : "";
  logBattle(qName(e) + " 使用了 " + skill.name + "，造成 " + dmg + " 伤害 " + adv);
  renderBattle();
  setTimeout(() => {
    Battle.busy = false;
    if (Battle.ally.hp <= 0) allyFaint();
  }, 650);
}
function allyFaint() {
  logBattle(SPECIES[Battle.ally.sp].name + " 失去战斗能力！");
  const alive = Game.player.team.map((m, i) => ({ m, i })).filter((x) => x.m && x.m.hp > 0);
  if (alive.length === 0) {
    toast("所有幻兽都筋疲力尽了…被送回了营地");
    Game.player.gold = Math.floor(Game.player.gold * 0.9);
    endBattle("lose");
    setTimeout(() => healAll(), 1200);
  } else {
    logBattle("选择下一只出战幻兽！");
    Battle.busy = true;
    UI.openSwitchInBattle(alive);
  }
}
function switchInBattle(idx) {
  const m = Game.player.team[idx];
  if (!m || m.hp <= 0) return;
  Battle.ally = m;
  Game.player.activeIdx = idx;
  Game.player.switchCdUntil = Date.now() + 8000;
  Battle.busy = false;
  logBattle("去吧，" + SPECIES[m.sp].name + "！");
  renderBattle();
  renderHUD();
}

/* ---------- 战斗内捕捉 / 道具 / 逃跑 ---------- */
function captureInBattle(ballId) {
  if (Battle.busy || Battle.ended) return;
  const p = Game.player;
  if ((p.items[ballId] || 0) <= 0) { toast("没有" + ITEMS[ballId].name + "了"); return; }
  p.items[ballId]--;
  Battle.busy = true;
  const rate = captureRate(Battle.enemy, ballId, p.lv);
  logBattle("投出了" + ITEMS[ballId].name + "…（成功率 " + Math.round(rate * 100) + "%）");
  setTimeout(() => {
    if (Math.random() < rate) {
      logBattle("🎉 太好了！" + qName(Battle.enemy) + " 被成功捕捉！");
      const where = addMon(Battle.enemy);
      gainTrainerExp(20 + Battle.enemy.lv * 3);
      if (Battle.enemyEntity) {
        const run = getRun(Game.currentIsland);
        const idx = run.wild.indexOf(Battle.enemyEntity);
        if (idx >= 0) respawnWild(run, run.wild[idx]);
      }
      toast(where === "team" ? "幻兽加入了队伍！" : "队伍已满，幻兽已存入背包仓库", "ok");
      endBattle("caught");
    } else {
      logBattle("啊！" + qName(Battle.enemy) + " 挣脱了精灵球！");
      setTimeout(enemyTurn, 600);
    }
    saveGame();
  }, 800);
}
function usePotionInBattle() {
  if (Battle.busy || Battle.ended) return;
  const p = Game.player;
  if ((p.items.potion || 0) <= 0) { toast("没有体力药剂了"); return; }
  p.items.potion--;
  const heal = Math.min(40, Battle.ally.maxHp - Battle.ally.hp);
  Battle.ally.hp += heal;
  floatDmg("ally", heal, false, true);
  logBattle(SPECIES[Battle.ally.sp].name + " 恢复了 " + heal + " 点生命");
  Battle.busy = true;
  renderBattle();
  setTimeout(enemyTurn, 600);
}
function fleeBattle() {
  if (Battle.busy || Battle.ended) return;
  if (Math.random() < 0.8) { logBattle("成功脱离了战斗！"); endBattle("flee"); }
  else { logBattle("没能逃走！"); Battle.busy = true; setTimeout(enemyTurn, 400); }
}

/* ---------- 渲染 ---------- */
function qName(mon) {
  return '<span class="q-' + mon.q + '">[' + mon.q + "] " + SPECIES[mon.sp].name + "</span>";
}
function renderBattle() {
  const e = Battle.enemy, a = Battle.ally;
  if (!e || !a) return;
  document.getElementById("e-name").innerHTML = SPECIES[e.sp].name;
  document.getElementById("e-q").className = "q-" + e.q;
  document.getElementById("e-q").textContent = "[" + e.q + "★" + e.star + "]";
  document.getElementById("e-lv").textContent = e.lv;
  document.getElementById("a-name").innerHTML = SPECIES[a.sp].name;
  document.getElementById("a-q").className = "q-" + a.q;
  document.getElementById("a-q").textContent = "[" + a.q + "★" + a.star + "]";
  document.getElementById("a-lv").textContent = a.lv;
  setHp("e", e); setHp("a", a);
  drawMon(document.getElementById("e-canvas"), e.sp, { stars: e.star });
  drawMon(document.getElementById("a-canvas"), a.sp, { stars: a.star });
}
function setHp(side, m) {
  const pct = Math.max(0, (m.hp / m.maxHp) * 100);
  document.getElementById(side + "-hp-fill").style.width = pct + "%";
  document.getElementById(side + "-hp-text").textContent = m.hp + " / " + m.maxHp;
}
function shakeSide(side) {
  const el = document.querySelector("." + side + "-side");
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
}
function floatDmg(side, val, crit, heal) {
  const el = document.querySelector("." + side + "-side");
  const d = document.createElement("div");
  d.className = "float-dmg" + (heal ? " heal" : "");
  d.textContent = (heal ? "+" : "-") + val + (crit ? "!" : "");
  d.style.left = "50%"; d.style.top = "30%";
  el.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
function logBattle(msg) {
  const box = document.getElementById("battle-log");
  const line = document.createElement("div");
  line.innerHTML = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 30) box.removeChild(box.firstChild);
}
function logClear() { document.getElementById("battle-log").innerHTML = ""; }
