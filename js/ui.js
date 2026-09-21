/* ================= ui.js ：HUD、弹窗、背包、养成界面 ================= */
"use strict";

const UI = { modalOpen: false, encounterLock: false };

function toast(msg, kind) {
  const layer = document.getElementById("toast-layer");
  const t = document.createElement("div");
  t.className = "toast";
  if (kind === "ok") t.style.background = "rgba(38,222,129,.92)";
  t.textContent = msg;
  layer.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- 通用弹窗 ---------- */
function modal(title, bodyHTML, footHTML) {
  const m = document.getElementById("modal");
  m.className = "modal-show";
  m.innerHTML =
    '<div class="m-card"><div class="m-head"><h2>' + title + '</h2>' +
    '<button class="m-close" onclick="UI.closeModal()">✕</button></div>' +
    '<div class="m-body">' + bodyHTML + '</div>' +
    (footHTML ? '<div class="m-foot">' + footHTML + "</div>" : "") + "</div>";
  UI.modalOpen = true;
}
UI.closeModal = function () {
  const m = document.getElementById("modal");
  m.className = "modal-hidden";
  m.innerHTML = "";
  UI.modalOpen = false;
  UI.encounterLock = false;
};

/* ---------- HUD ---------- */
function renderHUD() {
  const p = Game.player;
  const ts = trainerStats();
  document.getElementById("t-lv").textContent = p.lv;
  const expNeed = trainerExpNeed();
  document.getElementById("t-exp-fill").style.width = Math.min(100, (p.exp / expNeed) * 100) + "%";
  document.getElementById("t-exp-text").textContent = p.exp + "/" + expNeed;
  document.getElementById("t-hp-fill").style.width = (ts.hp / ts.maxHp) * 100 + "%";
  document.getElementById("t-hp-text").textContent = ts.hp + "/" + ts.maxHp;
  document.getElementById("t-atk").textContent = ts.atk;
  document.getElementById("t-gold").textContent = p.gold;
  document.getElementById("t-gem").textContent = p.gem;
  document.getElementById("t-steps").textContent = p.steps;
  document.getElementById("map-name").textContent = ISLANDS.find((i) => i.id === Game.currentIsland).name;

  renderSlots();
}

function monSlotHTML(mon, idx, isSub, subIdx) {
  const s = SPECIES[mon.sp];
  const lead = !isSub && idx === p_activeIdx();
  const cdLeft = !isSub && idx === p_activeIdx() ? 0 : Math.max(0, Game.player.switchCdUntil - Date.now());
  let cd = "";
  if (!isSub && idx !== p_activeIdx() && cdLeft > 0) {
    cd = '<div class="cd">' + Math.ceil(cdLeft / 1000) + "</div>";
  }
  const cid = "slotcv" + (isSub ? "s" + subIdx : idx) + "_" + mon.uid;
  return '<div class="slot ' + (isSub ? "sub-slot" : "") + (lead ? " lead" : "") +
    '" data-idx="' + idx + '" data-sub="' + (isSub ? subIdx : "") + '">' +
    '<canvas id="' + cid + '" width="54" height="54"></canvas>' +
    '<div class="mini-hp"><i style="width:' + Math.max(0, (mon.hp / mon.maxHp) * 100) + '%"></i></div>' +
    '<div class="lv q-' + mon.q + '">Lv' + mon.lv + " " + mon.q + "</div>" + cd + "</div>";
}
function p_activeIdx() { return Game.player.activeIdx; }

function renderSlots() {
  const p = Game.player;
  const bar = document.getElementById("party-slots");
  bar.innerHTML = "";
  p.team.forEach((mon, idx) => {
    const d = document.createElement("div");
    if (!mon) {
      d.className = "slot empty";
      d.innerHTML = "＋";
      d.onclick = () => openBag("team");
    } else {
      d.outerHTML = "";
      const wrap = document.createElement("div");
      wrap.innerHTML = monSlotHTML(mon, idx, false);
      const el = wrap.firstChild;
      el.onclick = () => {
        if (idx === p.activeIdx()) { openMonDetail(mon, { where: "team", idx }); return; }
        switchLead(idx);
      };
      bar.appendChild(el);
      requestAnimationFrame(() => {
        const cv = document.getElementById("slotcv" + idx + "_" + mon.uid);
        if (cv) drawMon(cv, mon.sp, { stars: mon.star });
      });
      return;
    }
    bar.appendChild(d);
  });

  /* 辅战位 */
  const sub = document.getElementById("support-slots");
  sub.innerHTML = "";
  const count = supportSlotCount();
  for (let i = 0; i < 2; i++) {
    const d = document.createElement("div");
    if (i >= count) {
      d.className = "slot sub-slot empty";
      d.style.opacity = 0.45;
      d.innerHTML = "🔒";
      d.title = i === 0 ? "Lv.5 解锁" : "Lv.10 解锁";
      d.onclick = () => toast(i === 0 ? "训练师 Lv.5 解锁辅战位 1" : "训练师 Lv.10 解锁辅战位 2");
    } else {
      const mon = p.support[i];
      if (!mon) {
        d.className = "slot sub-slot empty";
        d.innerHTML = "＋";
        d.onclick = () => openSupportAssign(i);
      } else {
        const wrap = document.createElement("div");
        wrap.innerHTML = monSlotHTML(mon, -1, true, i);
        const el = wrap.firstChild;
        el.title = "辅战 Lv." + p.supportLv[i];
        el.onclick = () => openSupportDetail(i);
        sub.appendChild(el);
        requestAnimationFrame(() => {
          const cv = document.getElementById("slotcvs" + i + "_" + mon.uid);
          if (cv) drawMon(cv, mon.sp, { stars: mon.star });
        });
        return;
      }
    }
    sub.appendChild(d);
  }
}

function switchLead(idx) {
  const p = Game.player;
  if (!p.team[idx]) return;
  if (Date.now() < p.switchCdUntil) { toast("出战切换冷却中：" + Math.ceil((p.switchCdUntil - Date.now()) / 1000) + " 秒"); return; }
  p.activeIdx = idx;
  p.switchCdUntil = Date.now() + 8000;
  toast("出战幻兽切换为 " + SPECIES[p.team[idx].sp].name, "ok");
  saveGame();
  renderHUD();
}

/* ---------- 遭遇野生幻兽 ---------- */
UI.openEncounter = function (entity, mon) {
  UI.encounterLock = true;
  const s = SPECIES[mon.sp];
  const body =
    '<div class="enc-box"><canvas id="enc-cv" width="130" height="130"></canvas>' +
    '<div class="enc-info">' +
    "<div><b class='q-" + mon.q + "'>" + mon.q + " 级</b> <b>" + s.name + "</b> " +
    '<span class="chip" style="background:' + ELEMENTS[mon.ele].color + '">' + ELEMENTS[mon.ele].name + "系</span></div>" +
    "<div>等级 Lv." + mon.lv + "　生命 " + mon.maxHp + "</div>" +
    "<div>攻击 " + mon.atk + "　资质 " + mon.apt + "</div>" +
    "<div style='font-size:12px;color:#70869c;max-width:320px'>" + s.dex + "</div>" +
    "<div style='font-size:12px'>🎯 直接捕捉成功率：<b>" + Math.round(captureRate(mon, "ball", Game.player.lv) * 100) + "%</b></div>" +
    "</div></div>";
  modal("遭遇野生幻兽", body,
    '<button class="btn orange" onclick="UI.tryCaptureWorld()">🎯 直接捕捉</button>' +
    '<button class="btn red" onclick="UI.startFight()">⚔️ 进入战斗</button>' +
    '<button class="btn gray" onclick="UI.leaveEncounter()">悄悄离开</button>');
  requestAnimationFrame(() => {
    const cv = document.getElementById("enc-cv");
    if (cv) drawMon(cv, mon.sp, { stars: 1 });
  });
  UI._entity = entity;
  UI._mon = mon;
};
UI.tryCaptureWorld = function () {
  const p = Game.player;
  const mon = UI._mon;
  if ((p.items.ball || 0) <= 0) { toast("精灵球不足，去商店买一些吧"); return; }
  p.items.ball--;
  const rate = captureRate(mon, "ball", p.lv);
  if (Math.random() < rate) {
    const where = addMon(mon);
    gainTrainerExp(15 + mon.lv * 2);
    toast("捕捉成功！" + SPECIES[mon.sp].name + (where === "team" ? " 加入队伍！" : " 存入仓库！"), "ok");
    const run = getRun(Game.currentIsland);
    const idx = run.wild.indexOf(UI._entity);
    if (idx >= 0) respawnWild(run, run.wild[idx]);
    saveGame();
    UI.closeModal();
    renderHUD();
  } else {
    toast("捕捉失败！进入战斗削弱它吧");
    const entity = UI._entity;
    UI.closeModal();
    startBattle(mon, entity);
  }
};
UI.startFight = function () {
  const entity = UI._entity, mon = UI._mon;
  UI.closeModal();
  startBattle(mon, entity);
};
UI.leaveEncounter = function () {
  if (UI._entity) UI._entity._handled = false;
  UI.closeModal();
};

/* ---------- NPC 对话 ---------- */
UI.openDialog = function (npc) {
  const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
  const isHeal = npc.name === "治愈天使";
  modal(npc.name,
    '<div class="dialog-portrait"><canvas id="npc-cv" width="72" height="72"></canvas></div>' +
    '<div class="dialog-text">「' + line + "」</div>",
    (isHeal ? '<button class="btn green" onclick="UI.doHeal()">💚 回复全队</button>' : "") +
    '<button class="btn" onclick="UI.closeModal()">再见</button>');
  const cv = document.getElementById("npc-cv");
  const c = cv.getContext("2d");
  c.fillStyle = "#eaf7ff"; rr(c, 0, 0, 72, 72, 14); c.fill();
  drawNPC(c, npc === NPCS.heal ? "heal" : npc === NPCS.sage ? "sage" : "prof", 36, 36, 0);
};
UI.doHeal = function () { healAll(); toast("全队幻兽已完全恢复！", "ok"); UI.closeModal(); renderHUD(); };

/* ---------- 背包 ---------- */
let bagTab = "mons";
function openBag(tab) {
  if (tab) bagTab = tab;
  renderBag();
}
function renderBag() {
  let body = '<div class="tabs">' +
    tabBtn("mons", "幻兽") + tabBtn("eggs", "幻兽蛋 (" + Game.player.eggs.length + "/6)") +
    tabBtn("items", "道具") + tabBtn("shop", "商店") + "</div><div id='bag-content'></div>";
  modal("🎒 背包", body, '<button class="btn gray" onclick="UI.closeModal()">关闭</button>');
  const box = document.getElementById("bag-content");
  if (bagTab === "items") box.innerHTML = itemsHTML();
  if (bagTab === "shop") box.innerHTML = shopHTML();
  if (bagTab === "eggs") box.innerHTML = eggsHTML();
  if (bagTab === "mons") box.innerHTML = monsHTML();
  bindMonCells();
}
function tabBtn(id, label) {
  return '<button class="tab ' + (bagTab === id ? "on" : "") + '" onclick="setBagTab(\'' + id + '\')">' + label + "</button>";
}
window.setBagTab = function (t) { bagTab = t; renderBag(); };

function itemsHTML() {
  const p = Game.player;
  let h = "";
  for (const id in ITEMS) {
    const it = ITEMS[id];
    const count = p.items[id] || 0;
    h += '<div class="item-row"><div class="item-ico">' + it.ico + "</div><div>" +
      '<div class="it-name">' + it.name + "</div>" +
      '<div class="it-desc">' + it.desc + "</div></div>" +
      '<div class="it-count">×' + count + "</div></div>";
  }
  return h;
}
function shopHTML() {
  const p = Game.player;
  const goods = [
    { id: "ball", n: 1 }, { id: "ball", n: 5 }, { id: "gball", n: 1 },
    { id: "potion", n: 1 }, { id: "potion", n: 5 },
  ];
  let h = '<p style="font-size:12px;color:#70869c;margin-bottom:8px">当前金币：<b style="color:#e67e22">' + p.gold + "</b>　钻石：<b>" + p.gem + "</b></p>";
  goods.forEach((g, i) => {
    const it = ITEMS[g.id];
    const price = it.price * g.n;
    h += '<div class="item-row shop-row"><div class="item-ico">' + it.ico + "</div><div>" +
      '<div class="it-name">' + it.name + " ×" + g.n + '</div><div class="it-desc">' + it.desc + "</div></div>" +
      '<button class="btn ' + (p.gold >= price ? "green" : "gray") + '" onclick="buyItem(' + i + ')">' + price + " 金币</button></div>";
  });
  window._shop = goods;
  return h;
}
window.buyItem = function (i) {
  const g = window._shop[i];
  const price = ITEMS[g.id].price * g.n;
  const p = Game.player;
  if (p.gold < price) return toast("金币不足");
  p.gold -= price;
  p.items[g.id] = (p.items[g.id] || 0) + g.n;
  toast("购买成功：" + ITEMS[g.id].name + " ×" + g.n, "ok");
  saveGame(); renderBag(); renderHUD();
};

function eggsHTML() {
  const eggs = Game.player.eggs;
  if (eggs.length === 0) return '<p style="text-align:center;color:#70869c;padding:30px">还没有幻兽蛋～去岛上寻找发光的蛋巢吧！<br>（行走可累积孵化步数）</p>';
  return eggs.map((egg, i) => {
    const pct = Math.round((egg.steps / egg.stepsNeed) * 100);
    const ready = egg.steps >= egg.stepsNeed;
    return '<div class="item-row"><div class="item-ico">🥚</div><div style="flex:1">' +
      '<div class="it-name">神秘幻兽蛋 #' + (i + 1) + "</div>" +
      '<div class="egg-prog"><i style="width:' + pct + '%"></i></div>' +
      '<div class="it-desc">孵化进度 ' + egg.steps + "/" + egg.stepsNeed + " 步（" + pct + "%）</div></div>" +
      (ready ? '<button class="btn green" onclick="doHatch(' + i + ')">✨ 孵化</button>' : '<button class="btn gray" disabled>行走中…</button>') +
      "</div>";
  }).join("");
}
window.doHatch = function (i) {
  const res = hatchEgg(i);
  if (!res) return;
  const s = SPECIES[res.mon.sp];
  saveGame(); renderHUD();
  modal("🎉 孵化成功",
    '<div class="enc-box"><canvas id="hatch-cv" width="130" height="130"></canvas>' +
    '<div class="enc-info"><div><b class="q-' + res.mon.q + '">[' + res.mon.q + "] " + s.name + "</b></div>" +
    "<div>等级 Lv." + res.mon.lv + "　资质 " + res.mon.apt + "</div>" +
    '<div class="chip" style="background:' + ELEMENTS[s.ele].color + '">' + ELEMENTS[s.ele].name + "系</div>" +
    '<div style="font-size:12px;color:#70869c;max-width:280px">' + s.dex + "</div>" +
    "<div style='margin-top:6px;font-size:12px'>已" + (res.where === "team" ? "加入出战队伍" : "存入背包仓库") + "</div></div></div>" +
    '<button class="btn" onclick="renderBag()">继续查看</button>');
  requestAnimationFrame(() => drawMon(document.getElementById("hatch-cv"), res.mon.sp));
};

/* ---------- 幻兽列表 ---------- */
function monsHTML() {
  const p = Game.player;
  let h = '<h3 style="font-size:14px;margin-bottom:8px">🏅 主战位（前 3 只参与战斗，资质加成 100%）</h3><div class="grid">';
  p.team.forEach((m, idx) => {
    h += m ? monCell(m, "team", idx) : '<div class="cell" style="color:#9bb3c8;justify-content:center">空位</div>';
  });
  h += "</div>";
  if (supportSlotCount() > 0) {
    h += '<h3 style="font-size:14px;margin:14px 0 8px">🛡️ 辅战位（提供资质加成，等级越高加成越多）</h3><div class="grid">';
    for (let i = 0; i < supportSlotCount(); i++) {
      h += p.support[i] ? monCell(p.support[i], "support", i) :
        '<div class="cell" style="color:#9bb3c8;justify-content:center;cursor:pointer" onclick="openSupportAssign(' + i + ')">＋ 安排幻兽</div>';
    }
    h += "</div>";
  }
  h += '<h3 style="font-size:14px;margin:14px 0 8px">📦 仓库（' + p.box.length + " 只）</h3><div class='grid'>";
  if (p.box.length === 0) h += '<p style="color:#9bb3c8;font-size:13px;grid-column:1/-1">仓库空空如也</p>';
  p.box.forEach((m, idx) => { h += monCell(m, "box", idx); });
  h += "</div>";
  return h;
}
function monCell(m, where, idx) {
  const s = SPECIES[m.sp];
  const need = m.lv >= STAR_CAP_LV[m.star] ? '<div style="color:#e67e22;font-size:10px">达到等级上限，升星可继续成长</div>' : "";
  return '<div class="cell" data-sp="' + m.sp + '" data-uid="' + m.uid + '">' +
    '<canvas width="72" height="72" data-draw="' + m.sp + '" data-star="' + m.star + '"></canvas>' +
    '<div class="cname q-' + m.q + '">[' + m.q + "★" + m.star + "] " + s.name + "</div>" +
    '<div class="cmeta">Lv.' + m.lv + "　HP " + m.hp + "/" + m.maxHp + "<br>攻 " + m.atk + "　资质 " + m.apt +
    (where === "support" ? "<br>辅战 Lv." + Game.player.supportLv[idx] : "") + "</div>" + need +
    '<div class="cta"><button class="mini-btn" data-detail="' + where + ":" + idx + '">详情</button></div></div>';
}
function bindMonCells() {
  document.querySelectorAll("[data-draw]").forEach((cv) => {
    drawMon(cv, cv.dataset.draw, { stars: parseInt(cv.dataset.star, 10) });
  });
  document.querySelectorAll("[data-detail]").forEach((btn) => {
    btn.onclick = () => {
      const [where, idx] = btn.dataset.detail.split(":");
      const m = where === "team" ? Game.player.team[idx] : where === "support" ? Game.player.support[idx] : Game.player.box[idx];
      openMonDetail(m, { where, idx: parseInt(idx, 10) });
    };
  });
}

/* ---------- 幻兽详情：升星 / 洗髓 / 进化信息 / 调配 ---------- */
function findMonRef(uid) {
  const p = Game.player;
  for (let i = 0; i < p.team.length; i++) if (p.team[i] && p.team[i].uid === uid) return { m: p.team[i], where: "team", idx: i };
  for (let i = 0; i < p.support.length; i++) if (p.support[i] && p.support[i].uid === uid) return { m: p.support[i], where: "support", idx: i };
  for (let i = 0; i < p.box.length; i++) if (p.box[i].uid === uid) return { m: p.box[i], where: "box", idx: i };
  return null;
}
function openMonDetail(m, ref) {
  if (!ref) ref = findMonRef(m.uid) || { where: "box", idx: 0 };
  const s = SPECIES[m.sp];
  const ele = ELEMENTS[m.ele];
  const expNeed = expToNextLv(m.lv);
  const capped = m.lv >= STAR_CAP_LV[m.star];
  const skills = skillsOf(m).map((sk) =>
    '<span class="sk-tag">' + sk.name + "（" + Math.round(sk.pw * 100) + "%）</span>").join("");
  const lockedCount = 3 - (skillsOf(m).length - 1);
  const locked = lockedCount > 0 ? '<span class="sk-tag locked">🔒 ' + (m.star < 3 ? "3星" : "5星") + "解锁</span>" : "";
  const can = canStarUp(m);
  const evoText = s.evoTo
    ? (m.lv >= s.evoLv ? "已满进化条件（继续升级即可进化；进化线需要足够的等级上限）"
      : "Lv." + s.evoLv + " 进化为 <b>" + SPECIES[s.evoTo].name + "</b>（需先升星提高等级上限）")
    : "已为最终形态";
  const cost = starUpCost(m.star + 1);
  const starReq = "需要：" + cost.gold + " 金币、" + cost.gem + " 钻石、星辉草×" + m.star +
    (m.star >= 3 ? "、幻兽水晶×" + (m.star - 2) : "");
  const rc = rerollCost(m.star);
  const [alo, ahi] = APT_RANGE[m.star];

  let actions = "";
  if (ref.where === "team") {
    if (ref.idx !== Game.player.activeIdx)
      actions += '<button class="btn orange" onclick="setLeadFromDetail(' + m.uid + ')">设为出战</button>';
    if (supportSlotCount() > 0) {
      const free = Game.player.support.findIndex((x) => !x);
      if (free >= 0 && Game.player.team.filter(Boolean).length > 1)
        actions += '<button class="btn" onclick="sendSupport(' + m.uid + ')">放入辅战位</button>';
    }
    actions += '<button class="btn gray" onclick="sendBox(' + m.uid + ')">存入仓库</button>';
  } else if (ref.where === "support") {
    actions += '<button class="btn" onclick="supportBackToTeam(' + ref.idx + ')">取回</button>' +
      supportUpBtn(m, ref.idx);
  } else {
    actions += '<button class="btn green" onclick="boxToTeam(' + ref.idx + ')">加入队伍</button>';
  }

  const body =
    '<div class="detail"><div class="enc-box">' +
    '<canvas id="dt-cv" width="120" height="120"></canvas>' +
    '<div style="flex:1">' +
    '<div style="font-size:17px"><b class="q-' + m.q + '">[' + m.q + "★" + m.star + "] " + s.name + "</b> " +
    '<span class="chip" style="background:' + ele.color + '">' + ele.name + "系</span></div>" +
    '<div class="detail-grid">' +
    "<div>等级：<b>Lv." + m.lv + "</b> / 上限 " + STAR_CAP_LV[m.star] + "</div>" +
    "<div>资质：<b>" + m.apt + "</b></div>" +
    "<div>生命：<b>" + m.hp + "/" + m.maxHp + "</b></div>" +
    "<div>攻击：<b>" + m.atk + "</b></div>" +
    "<div>防御：<b>" + monDef(m) + "</b></div>" +
    "<div>战力：<b>" + monPower(m) + "</b></div>" +
    "<div>经验：" + (capped ? "已满级" : m.exp + "/" + expNeed) + "</div>" +
    "<div>形态：第 " + s.stage + " 阶段</div></div>" +
    '<div class="skills" style="margin-top:8px">' + skills + locked + "</div>" +
    '<div style="font-size:12px;color:#70869c;margin-top:8px">✨ 进化：' + evoText + "</div>" +
    '<div style="font-size:12px;color:#70869c;margin-top:4px">📖 ' + s.dex + "</div>" +
    "</div></div>" +
    '<div style="margin-top:12px;border-top:2px dashed #d5e3ef;padding-top:10px">' +
    '<div style="font-weight:bold;font-size:13px">⭐ 升星（提升等级上限 / 解锁技能星级 / 扩大洗髓区间）</div>' +
    '<div style="font-size:12px;color:#70869c;margin:4px 0">' + starReq + "</div>" +
    '<button class="btn ' + (can.ok ? "orange" : "gray") + '" ' + (can.ok ? "" : "disabled") +
    ' onclick="doStarUpDetail(' + m.uid + ')" style="margin-bottom:10px">' +
    (m.star >= 5 ? "已达 5 星" : can.ok ? "升星到 " + (m.star + 1) + " 星" : can.reason) + "</button>" +
    '<div style="font-weight:bold;font-size:13px">🧪 洗髓（重新评定资质，品质 ' + m.q + " 评级继承）</div>" +
    ('<div style="font-size:12px;color:#70869c;margin:4px 0">当前 ' + m.star + ' 星资质区间：' + alo + "~" + ahi) +
    "（品质附加）　花费：" + rc + " 金币</div>" +
    '<button class="btn" onclick="doRerollDetail(' + m.uid + ')">洗髓一次</button>' +
    "</div></div>";
  modal("幻兽详情", body, actions + '<button class="btn gray" onclick="renderBag()">返回</button>');
  requestAnimationFrame(() => drawMon(document.getElementById("dt-cv"), m.sp, { stars: m.star }));
  UI._detailRef = ref;
}
function supportUpBtn(m, idx) {
  const lv = Game.player.supportLv[idx] || 1;
  if (lv >= 10) return '<button class="btn gray" disabled>辅战已满级</button>';
  const c = supportUpgradeCost(lv);
  const ok = Game.player.gold >= c.gold && Game.player.gem >= c.gem;
  return '<button class="btn ' + (ok ? "green" : "gray") + '" ' + (ok ? "" : "disabled") +
    ' onclick="upSupport(' + idx + ')">升级辅战 Lv.' + (lv + 1) + "（" + c.gold + "金/" + c.gem + "钻）</button>";
}
function refreshDetail(uid) {
  const ref = findMonRef(uid);
  if (ref) openMonDetail(ref.m, ref);
  renderHUD();
}
window.doStarUpDetail = function (uid) {
  const ref = findMonRef(uid); if (!ref) return;
  const err = doStarUp(ref.m);
  if (err) return toast(err);
  toast("⭐ 升星成功！" + SPECIES[ref.m.sp].name + " 升至 " + ref.m.star + " 星", "ok");
  refreshDetail(uid);
};
window.doRerollDetail = function (uid) {
  const ref = findMonRef(uid); if (!ref) return;
  const err = rerollApt(ref.m);
  if (err) return toast(err);
  toast("洗髓完成！新资质：" + ref.m.apt, "ok");
  refreshDetail(uid);
};
window.setLeadFromDetail = function (uid) {
  const ref = findMonRef(uid); if (!ref || ref.where !== "team") return;
  switchLead(ref.idx); renderBag();
};
window.sendSupport = function (uid) {
  const ref = findMonRef(uid); if (!ref || ref.where !== "team") return;
  const free = Game.player.support.findIndex((x) => !x);
  if (free < 0) return toast("辅战位已满");
  if (Game.player.team.filter(Boolean).length <= 1) return toast("至少保留一只主战幻兽");
  moveToSupport(free, ref.idx);
  toast(SPECIES[ref.m.sp].name + " 已进入辅战位", "ok");
  renderBag(); renderHUD();
};
window.sendBox = function (uid) {
  const ref = findMonRef(uid); if (!ref || ref.where !== "team") return;
  if (!moveTeamToBox(ref.idx)) return toast("至少保留一只主战幻兽");
  toast("已存入仓库"); renderBag(); renderHUD();
};
window.boxToTeam = function (idx) {
  if (!moveBoxToTeam(idx)) return toast("主战位已满");
  toast("已加入队伍", "ok"); renderBag(); renderHUD();
};
window.supportBackToTeam = function (idx) {
  supportBack(idx); renderBag(); renderHUD();
};
window.upSupport = function (idx) {
  if (!upgradeSupport(idx)) return toast("材料不足或已满级");
  toast("辅战位升级！属性加成提升", "ok");
  const uid = Game.player.support[idx] && Game.player.support[idx].uid;
  if (uid) refreshDetail(uid); else renderBag();
};

function openSupportAssign(slot) {
  if (Game.player.support[slot]) return;
  openBag("mons");
  toast("在主战位中选择「放入辅战位」（详情页）");
}

/* ---------- 地图选择 ---------- */
function openMap() {
  const p = Game.player;
  const cards = ISLANDS.map((isl) => {
    const locked = p.lv < isl.needLv;
    const current = isl.id === Game.currentIsland;
    return '<div class="island-card' + (locked ? " locked" : "") + '">' +
      '<canvas width="90" height="60" id="isl-' + isl.id + '"></canvas>' +
      "<div><h3>" + isl.name + (current ? "（当前位置）" : "") + "</h3>" +
      "<p>" + isl.desc + "</p>" +
      "<p style='color:" + (locked ? "#e74c3c" : "#27ae60") + "'>" +
      (locked ? "🔒 需训练师 Lv." + isl.needLv + "（当前 Lv." + p.lv + "）" :
        "✅ 可探索 · 野怪 Lv." + islandLvText(isl)) + "</p></div>" +
      (current ? '<button class="btn gray" disabled>所在岛屿</button>' :
        locked ? '<button class="btn gray" disabled>未解锁</button>' :
        '<button class="btn green" onclick="UI.travelTo(\'' + isl.id + '\')">前往</button>') +
      "</div>";
  }).join("");
  modal("🗺️ 群岛地图",
    '<p style="font-size:12px;color:#70869c;margin-bottom:10px">也可以在岛上走入发光的<b>传送门</b>直接前往相邻岛屿。</p>' + cards,
    '<button class="btn gray" onclick="UI.closeModal()">关闭</button>');
  ISLANDS.forEach((isl) => {
    const cv = document.getElementById("isl-" + isl.id);
    if (cv) drawIslandThumb(cv, isl);
  });
}
function islandLvText(isl) {
  const mins = isl.wild.map((x) => x.min), maxs = isl.wild.concat(isl.rare).map((x) => x.max);
  return Math.min.apply(null, mins) + "~" + Math.max.apply(null, maxs);
}
UI.travelTo = function (id) {
  UI.closeModal();
  travel(id);
  renderHUD();
};

/* ---------- 新手选择初始幻兽 ---------- */
function openStarterSelect() {
  const cards = STARTERS.map((sp) => {
    const s = SPECIES[sp];
    return '<div class="starter" onclick="UI.pickStarter(\'' + sp + '\')">' +
      '<canvas width="100" height="100" id="st-' + sp + '"></canvas>' +
      "<h3>" + s.name + "</h3>" +
      '<span class="chip" style="background:' + ELEMENTS[s.ele].color + '">' + ELEMENTS[s.ele].name + "系</span>" +
      "<p>" + s.dex + "<br><b>Lv.5 [R]</b> 起步</p></div>";
  }).join("");
  modal("✨ 选择你的第一只幻兽",
    '<div class="starter-row">' + cards + "</div>" +
    '<p style="text-align:center;font-size:12px;color:#70869c;margin-top:12px">水克火 · 火克风 · 风克水；神与魔互克并克制三系。</p>',
    "");
  STARTERS.forEach((sp) => requestAnimationFrame(() => {
    const cv = document.getElementById("st-" + sp);
    if (cv) drawMon(cv, sp);
  }));
}
UI.pickStarter = function (sp) {
  Game.player = newPlayer(sp);
  Game.currentIsland = "begin";
  Game.started = true;
  const run = getRun("begin");
  Game.player.px = run.map.spawn.x * TILE + TILE / 2;
  Game.player.py = run.map.spawn.y * TILE + TILE / 2;
  saveGame();
  UI.closeModal();
  toast("冒险开始！靠近野生幻兽来捕捉或战斗吧", "ok");
  renderHUD();
};

/* ---------- 战斗中菜单 ---------- */
UI.openSkills = function () {
  const list = skillsOf(Battle.ally);
  const menu = document.getElementById("battle-menu");
  menu.innerHTML = list.map((sk, i) =>
    '<button class="sk-btn" onclick="UI.pickSkill(' + i + ')">' + sk.name +
    '<span class="pw">威力 ' + Math.round(sk.pw * 100) + "%" +
    (sk.ele ? " · " + ELEMENTS[sk.ele].name + "系" : "") + "</span></button>").join("") +
    '<button class="bm-btn" style="grid-column:1/3" onclick="UI.resetBattleMenu()">← 返回</button>';
};
UI.pickSkill = function (i) {
  const sk = skillsOf(Battle.ally)[i];
  UI.resetBattleMenu();
  allyUseSkill(sk);
};
UI.openSwitch = function () {
  if (Battle.busy) return;
  const alive = Game.player.team.map((m, i) => ({ m, i })).filter((x) => x.m && x.m.hp > 0);
  UI.openSwitchInBattle(alive);
};
UI.openSwitchInBattle = function (alive) {
  const items = alive.map(({ m, i }) =>
    '<button class="sk-btn" style="opacity:' + (i === Game.player.activeIdx ? 0.5 : 1) +
    '" onclick="UI.doSwitch(' + i + ')">' + SPECIES[m.sp].name +
    '<span class="pw">Lv.' + m.lv + " HP " + m.hp + "/" + m.maxHp + "</span></button>").join("");
  const menu = document.getElementById("battle-menu");
  menu.className = "skills-menu";
  menu.innerHTML = items + '<button class="bm-btn" style="grid-column:1/3" onclick="UI.resetBattleMenu()">← 返回</button>';
};
UI.doSwitch = function (idx) {
  if (idx === Game.player.activeIdx) { UI.resetBattleMenu(); return; }
  if (Date.now() < Game.player.switchCdUntil && !Battle.ally.hp <= 0) {
    toast("切换冷却中"); return;
  }
  UI.resetBattleMenu();
  switchInBattle(idx);
};
UI.openCaptureMenu = function () {
  const p = Game.player;
  const rateB = Math.round(captureRate(Battle.enemy, "ball", p.lv) * 100);
  const rateG = Math.round(captureRate(Battle.enemy, "gball", p.lv) * 100);
  const menu = document.getElementById("battle-menu");
  menu.className = "skills-menu";
  menu.innerHTML =
    '<button class="sk-btn" style="background:linear-gradient(180deg,#ffb26b,#ff9f43)" onclick="UI.doCapture(\'ball\')">🔴 精灵球<span class="pw">拥有 ×' + (p.items.ball || 0) + " · " + rateB + "%</span></button>" +
    '<button class="sk-btn" style="background:linear-gradient(180deg,#74b9ff,#0984e3)" onclick="UI.doCapture(\'gball\')">🔵 高级球<span class="pw">拥有 ×' + (p.items.gball || 0) + " · " + rateG + "%</span></button>" +
    '<button class="sk-btn" style="background:linear-gradient(180deg,#7bed9f,#2ed573)" onclick="UI.doPotion()">🧪 药剂<span class="pw">拥有 ×' + (p.items.potion || 0) + " · 回复40</span></button>" +
    '<button class="bm-btn" onclick="UI.resetBattleMenu()">← 返回</button>';
};
UI.doCapture = function (id) { UI.resetBattleMenu(); captureInBattle(id); };
UI.doPotion = function () { UI.resetBattleMenu(); usePotionInBattle(); };
UI.resetBattleMenu = function () {
  const menu = document.getElementById("battle-menu");
  menu.className = "";
  menu.innerHTML =
    '<button class="bm-btn" data-bm="skill">技能</button>' +
    '<button class="bm-btn" data-bm="switch">换兽</button>' +
    '<button class="bm-btn" data-bm="capture">捕捉</button>' +
    '<button class="bm-btn" data-bm="flee">逃跑</button>';
};
