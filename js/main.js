/* ================= main.js ：初始化、主循环、输入 ================= */
"use strict";

window.addEventListener("load", () => {
  canvas = document.getElementById("world");
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  drawTrainer(document.getElementById("avatar"));

  /* 键盘 */
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (UI.modalOpen || Battle.active) return;
    if (k === "e" || k === " ") talkNearest();
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  /* 右下角操作按钮 */
  document.getElementById("hud-actions").addEventListener("click", (e) => {
    const btn = e.target.closest(".act-btn");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "capture") quickNearestCapture();
    if (act === "battle") quickNearestBattle();
    if (act === "bag") openBag("mons");
    if (act === "map") openMap();
    if (act === "help") openHelp();
  });

  /* 战斗菜单（事件委托） */
  document.getElementById("battle-menu").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.bm;
    if (act === "skill") UI.openSkills();
    if (act === "switch") UI.openSwitch();
    if (act === "capture") UI.openCaptureMenu();
    if (act === "flee") fleeBattle();
  });

  
/* 玩法帮助 */
function openHelp() {
  const body =
    '<div class="help-body" style="font-size:13px;line-height:2">' +
    '<b>🎯 目标</b>：在群岛间冒险，捕捉、培养幻兽，成为幻兽大师！<br>' +
    '<b>🕹️ 操作</b>：WASD / 方向键移动（手机用左下摇杆）；靠近野生幻兽自动遭遇；靠近 NPC 后按 E/空格 交谈。<br>' +
    '<b>🎯 捕捉</b>：直接投球有几率成功；失败则进入战斗——把对手打到残血后捕捉率会大幅提升，高级球更稳。<br>' +
    '<b>⚔️ 属性克制</b>：水→火→风→水循环克制；神↔魔互克，且神魔都克制水火风。克制方伤害 +10%。<br>' +
    '<b>⭐ 等级/升星</b>：战斗得经验升级；星级决定等级上限（10×星级），升星还解锁更强技能与更高洗髓资质区间。<br>' +
    '<b>🧬 进化</b>：达到特定等级会进化（需先升星打开等级上限）。<br>' +
    '<b>🏅 品质/资质</b>：N&lt;R&lt;SR&lt;SSR&lt;UR，品质乘算属性；资质直接加成训练师攻击/生命。<br>' +
    '<b>🛡️ 出战/助阵</b>：主战最多 6 格（前 3 只为战斗位），场景跟随 1 只，切换有 8 秒 CD；Lv.5/10 解锁两个辅战位，可升级提升加成。<br>' +
    '<b>🥚 幻兽蛋</b>：岛上蛋巢拾取，行走 500 步孵化，可能孵出稀有幻兽。<br>' +
    '<b>💊 回复</b>：找治愈天使免费治疗全队，或战斗中用药剂。<br>' +
    '<b>🗺️ 岛屿</b>：踏入发光传送门或点地图前往，新岛屿有等级要求（Lv.5/12/20）。<br>' +
    '<b>💾 存档</b>：进度自动保存在浏览器本地。</div>';
  modal('❓ 玩法说明', body, '<button class="btn green" onclick="UI.closeModal()">开始冒险</button>');
}

/* 触屏摇杆（半屏滑动移动） */
  setupTouchControls();

  /* 启动 */
  if (loadGame()) {
    const run = getRun(Game.currentIsland);
    if (Game.player.pos) {
      Game.player.px = Game.player.pos.x * TILE;
      Game.player.py = Game.player.pos.y * TILE;
    } else {
      Game.player.px = run.map.spawn.x * TILE + TILE / 2;
      Game.player.py = run.map.spawn.y * TILE + TILE / 2;
    }
    if (typeof Game.player.hp !== "number") {
      const ts = trainerStats();
      Game.player.hp = ts.maxHp;
    }
    renderHUD();
  } else {
    openStarterSelect();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (Game.started && !UI.modalOpen && !Battle.active) {
      updateMovement(dt);
      updateCooldownUI();
      renderHUDStatsOnly();
    }
    if (Game.started) renderWorld(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});

/* 仅刷新高频变化的 HUD（避免每帧重建队伍 canvas） */
let hudTick = 0;
function renderHUDStatsOnly() {
  hudTick++;
  if (hudTick % 6 !== 0) return;
  const p = Game.player;
  const ts = trainerStats();
  document.getElementById("t-gold").textContent = p.gold;
  document.getElementById("t-gem").textContent = p.gem;
  document.getElementById("t-steps").textContent = p.steps;
  document.getElementById("t-atk").textContent = ts.atk;
  /* HP 条（跟随幻兽受伤/治疗变化） */
  document.getElementById("t-hp-fill").style.width = (ts.hp / ts.maxHp) * 100 + "%";
  document.getElementById("t-hp-text").textContent = ts.hp + "/" + ts.maxHp;
  /* 队伍小血条 & CD 数字 */
  document.querySelectorAll("#party-slots .slot").forEach((el) => {
    const idx = parseInt(el.dataset.idx, 10);
    const m = p.team[idx];
    if (!m) return;
    const hpBar = el.querySelector(".mini-hp i");
    if (hpBar) hpBar.style.width = Math.max(0, (m.hp / m.maxHp) * 100) + "%";
    let cd = el.querySelector(".cd");
    const left = p.switchCdUntil - Date.now();
    if (idx !== p.activeIdx && left > 0) {
      if (!cd) {
        cd = document.createElement("div");
        cd.className = "cd";
        el.appendChild(cd);
      }
      cd.textContent = Math.ceil(left / 1000);
    } else if (cd) cd.remove();
  });
}
function updateCooldownUI() { /* CD 显示由 renderHUDStatsOnly 处理 */ }

/* 附近野怪快捷操作 */
function nearestWild(maxDist) {
  const run = getRun(Game.currentIsland);
  const p = Game.player;
  const ptx = Math.floor(p.px / TILE), pty = Math.floor(p.py / TILE);
  let best = null, bd = maxDist;
  for (const e of run.wild) {
    const d = Math.max(Math.abs(e.tx - ptx), Math.abs(e.ty - pty));
    if (d <= bd) { best = e; bd = d; }
  }
  return best;
}
function quickNearestCapture() {
  if (UI.modalOpen) return;
  const e = nearestWild(2);
  if (!e) return toast("附近没有野生幻兽，走过去靠近它吧");
  e._handled = true;
  UI.openEncounter(e, ensureWildMon(getRun(Game.currentIsland), e));
}
function quickNearestBattle() {
  if (UI.modalOpen) return;
  const e = nearestWild(2);
  if (!e) return toast("附近没有野生幻兽");
  UI.encounterLock = true;
  const mon = ensureWildMon(getRun(Game.currentIsland), e);
  startBattle(mon, e);
}

/* 触屏：左下虚拟摇杆 */
function setupTouchControls() {
  let stick = null;
  const base = document.createElement("div");
  base.id = "stick-base";
  Object.assign(base.style, {
    position: "absolute", left: "26px", bottom: "96px", width: "96px", height: "96px",
    borderRadius: "50%", background: "rgba(255,255,255,.25)", border: "3px solid rgba(255,255,255,.5)",
    zIndex: "20", touchAction: "none", display: "none",
  });
  const knob = document.createElement("div");
  Object.assign(knob.style, {
    position: "absolute", left: "26px", top: "26px", width: "38px", height: "38px",
    borderRadius: "50%", background: "rgba(255,255,255,.7)",
  });
  base.appendChild(knob);
  document.getElementById("game").appendChild(base);
  if ("ontouchstart" in window) base.style.display = "block";

  const setKeys = (dx, dy) => {
    keys["w"] = dy < -0.35; keys["s"] = dy > 0.35;
    keys["a"] = dx < -0.35; keys["d"] = dx > 0.35;
  };
  base.addEventListener("touchstart", (e) => {
    stick = { id: e.changedTouches[0].identifier, cx: e.changedTouches[0].clientX, cy: e.changedTouches[0].clientY };
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (!stick) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== stick.id) continue;
      let dx = t.clientX - stick.cx, dy = t.clientY - stick.cy;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(30, len);
      knob.style.transform = "translate(" + (dx / len) * cl + "px," + (dy / len) * cl + "px)";
      setKeys(dx / len, dy / len);
      e.preventDefault();
    }
  }, { passive: false });
  const end = (e) => {
    if (!stick) return;
    stick = null;
    knob.style.transform = "";
    setKeys(0, 0);
  };
  base.addEventListener("touchend", end);
  base.addEventListener("touchcancel", end);
}
