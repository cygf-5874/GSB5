/* ================= world.js ：岛屿地图、实体、移动、主世界渲染 ================= */
"use strict";

/* 简单种子随机（同岛每次布局一致） */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/*
  地形：W 深水  S 沙滩  G 草地  g 草纹  T 树  R 石头
  P 传送门（绘制在地形层之上）  NPC/资源/蛋/野怪为运行时实体
*/
function genMap(island) {
  const [W, Hh] = island.size;
  const rnd = mulberry32(hashStr(island.id) ^ 0x5bd1e995);
  const cx = W / 2 + (rnd() - 0.5) * 4;
  const cy = Hh / 2 + (rnd() - 0.5) * 4;
  const rx = W * (0.36 + rnd() * 0.06);
  const ry = Hh * (0.4 + rnd() * 0.06);
  /* 不规则海岸：若干正弦叠加 */
  const blobs = [];
  for (let i = 0; i < 5; i++) blobs.push({ a: rnd() * Math.PI * 2, f: 1 + Math.floor(rnd() * 3), amp: 0.06 + rnd() * 0.1 });

  const grid = [];
  for (let y = 0; y < Hh; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
      let edge = 1;
      for (const b of blobs) edge += Math.sin(ang * b.f + b.a) * b.amp;
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      let t = "W";
      if (d < edge) t = "G";
      else if (d < edge + 1.15) t = "S";
      row.push(t);
    }
    grid.push(row);
  }
  /* 草纹 */
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x] === "G" && rnd() < 0.16) grid[y][x] = "g";
  }

  /* 清理出生点周围 */
  const spawn = { x: Math.floor(cx), y: Math.floor(cy) };
  const reserved = [
    [spawn.x, spawn.y], [spawn.x - 1, spawn.y], [spawn.x + 1, spawn.y],
    [spawn.x, spawn.y - 1], [spawn.x, spawn.y + 1],
  ];
  const isReserved = (x, y) => reserved.some(([rx2, ry2]) => rx2 === x && ry2 === y);

  /* 撒树与石头（仅草地内部） */
  for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (grid[y][x] !== "G" && grid[y][x] !== "g") continue;
    if (isReserved(x, y)) continue;
    const r = rnd();
    if (r < 0.1) grid[y][x] = "T";
    else if (r < 0.13) grid[y][x] = "R";
  }

  /* 小湖装饰（2~3 个，用深水） */
  const ponds = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < ponds; i++) {
    const px = 2 + Math.floor(rnd() * (W - 4));
    const py = 2 + Math.floor(rnd() * (Hh - 4));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = grid[py + dy] && grid[py + dy][px + dx];
      if (t === "G" || t === "g" || t === "T") grid[py + dy][px + dx] = "W";
    }
  }
  return { grid, w: W, h: Hh, spawn };
}

/* 放置运行时实体（野怪 / 资源 / 蛋 / NPC / 传送门） */
function walkableAt(map, x, y) {
  if (y < 0 || y >= map.h || x < 0 || x >= map.w) return false;
  const t = map.grid[y][x];
  return t === "G" || t === "g" || t === "S";
}
function findWalk(map, rnd, near, minD) {
  for (let tries = 0; tries < 300; tries++) {
    const x = 2 + Math.floor(rnd() * (map.w - 4));
    const y = 2 + Math.floor(rnd() * (map.h - 4));
    if (!walkableAt(map, x, y)) continue;
    if (near) {
      const d = Math.hypot(x - near.x, y - near.y);
      if (d < minD) continue;
    }
    return { x, y };
  }
  return { x: map.spawn.x, y: map.spawn.y };
}
function occupied(run, x, y) {
  return run.wild.some((e) => e.tx === x && e.ty === y)
    || run.res.some((e) => e.tx === x && e.ty === y)
    || run.eggs.some((e) => e.tx === x && e.ty === y)
    || run.npcs.some((e) => e.tx === x && e.ty === y)
    || run.portals.some((e) => e.tx === x && e.ty === y);
}

function initIslandRun(island) {
  const map = genMap(island);
  const rnd = mulberry32(hashStr(island.id + ":ent"));
  const run = { map, wild: [], res: [], eggs: [], npcs: [], portals: [], rnd };
  const findFree = (preferSand) => {
    for (let tries = 0; tries < 400; tries++) {
      const x = 1 + Math.floor(rnd() * (map.w - 2));
      const y = 1 + Math.floor(rnd() * (map.h - 2));
      const t = map.grid[y][x];
      if (preferSand ? t !== "S" : !walkableAt(map, x, y)) continue;
      if (occupied(run, x, y)) continue;
      return { x, y };
    }
    return { x: map.spawn.x, y: map.spawn.y };
  };
  for (let i = 0; i < 9; i++) {
    const p = findFree(false);
    run.wild.push({ tx: p.x, ty: p.y, rx: p.x * TILE + TILE / 2, ry: p.y * TILE + TILE / 2, nextMove: rnd() * 2, mon: null, _handled: false });
  }
  for (let i = 0; i < island.resources; i++) {
    const p = findFree(false);
    run.res.push({ tx: p.x, ty: p.y, kind: RES_KINDS[i % RES_KINDS.length], until: 0 });
  }
  for (let i = 0; i < island.eggs; i++) {
    const p = findFree(false);
    run.eggs.push({ tx: p.x, ty: p.y, until: 0 });
  }
  for (const id of island.npc) {
    const p = findFree(false);
    run.npcs.push({ npc: id, tx: p.x, ty: p.y });
  }
  for (const other of ISLANDS) {
    if (other.id === island.id) continue;
    const p = findFree(true);
    run.portals.push({ to: other.id, tx: p.x, ty: p.y });
  }
  run.islandId = island.id;
  return run;
}
function getRun(id) {
  if (!Game.worldRuns[id]) Game.worldRuns[id] = initIslandRun(ISLANDS.find((i) => i.id === id));
  return Game.worldRuns[id];
}

/* 野怪实例：首次靠近时才生成（性能 & 等级随机） */
function ensureWildMon(run, e) {
  if (!e.mon) {
    const island = ISLANDS.find((x) => x.id === (run.islandId || Game.currentIsland));
    e.mon = spawnWild(island);
  }
  return e.mon;
}

/* 重新生成被打掉的野怪 */
function respawnWild(run, e) {
  e.mon = null;
  const p = findWalk(run.map, run.rnd, run.map.spawn, 3);
  e.tx = p.x; e.ty = p.y;
}

/* ================= 玩家移动与交互 ================= */
const keys = {};
let moving = false;

function tileSolid(map, tx, ty) {
  if (ty < 0 || ty >= map.h || tx < 0 || tx >= map.w) return true;
  const t = map.grid[ty][tx];
  return t === "W" || t === "T" || t === "R";
}
/* 玩家碰撞盒（比一格略小） */
const PLAYER_HALF = 10;
function collide(map, px, py) {
  const pts = [
    [px - PLAYER_HALF, py - 2], [px + PLAYER_HALF, py - 2],
    [px - PLAYER_HALF, py + 12], [px + PLAYER_HALF, py + 12],
  ];
  return pts.some(([x, y]) => tileSolid(map, Math.floor(x / TILE), Math.floor(y / TILE)));
}

let lastStepTile = "";
function updateMovement(dt) {
  if (UI.modalOpen || Battle.active) return;
  const p = Game.player;
  const run = getRun(Game.currentIsland);
  const map = run.map;
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  moving = dx !== 0 || dy !== 0;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  const speed = 135; // px/s
  const nxp = p.px + dx * speed * dt;
  if (!collide(map, nxp, p.py)) p.px = nxp;
  const nyp = p.py + dy * speed * dt;
  if (!collide(map, p.px, nyp)) p.py = nyp;
  p.facing = dy > 0 ? "down" : dy < 0 ? "up" : dx < 0 ? "left" : "right";
  p.walkT = (p.walkT || 0) + (moving ? dt * 8 : 0);

  /* 计步（走满一格） */
  const tileKey = Math.floor(p.px / TILE) + "," + Math.floor(p.py / TILE);
  if (tileKey !== lastStepTile) {
    lastStepTile = tileKey;
    tickSteps(1);
    if (p.steps % 20 === 0) saveGame();
  }
  p.pos = { x: p.px / TILE, y: p.py / TILE };

  /* 野怪在可行走格之间随机游荡（平滑插值） */
  for (const e of run.wild) {
    e.nextMove -= dt;
    if (e.nextMove <= 0) {
      e.nextMove = 2 + run.rnd() * 2.5;
      if (run.rnd() < 0.7) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const d = dirs[Math.floor(run.rnd() * 4)];
        const nx = e.tx + d[0], ny = e.ty + d[1];
        if (!tileSolid(map, nx, ny) && !occupied(run, nx, ny)) { e.tx = nx; e.ty = ny; }
      }
    }
    const txp = e.tx * TILE + TILE / 2, typ = e.ty * TILE + TILE / 2;
    const spd = 60 * dt;
    if (e.rx === undefined) { e.rx = txp; e.ry = typ; }
    e.rx += Math.sign(txp - e.rx) * Math.min(Math.abs(txp - e.rx), spd);
    e.ry += Math.sign(typ - e.ry) * Math.min(Math.abs(typ - e.ry), spd);
  }

  checkTouchInteractions(run);
}

function checkTouchInteractions(run) {
  const p = Game.player;
  const ptx = Math.floor(p.px / TILE), pty = Math.floor(p.py / TILE);
  const near = (tx, ty, r) => Math.abs(tx - ptx) <= r && Math.abs(ty - pty) <= r;

  /* 资源点：踩上即采集 */
  const now = Date.now();
  for (const node of run.res) {
    if (node.until > 0) { if (now >= node.until) node.until = 0; continue; }
    if (near(node.tx, node.ty, 0)) gatherResource(node);
  }
  /* 蛋：踩上即拾取 */
  for (const nest of run.eggs) {
    if (nest.until > 0) { if (now >= nest.until) nest.until = 0; continue; }
    if (near(nest.tx, nest.ty, 0)) pickEgg(nest);
  }
  /* 野怪：相邻即触发遭遇（由 UI 状态防重复弹窗） */
  if (!UI.encounterLock) {
    for (const e of run.wild) {
      if (near(e.tx, e.ty, 1) && !e._handled) {
        e._handled = true;
        const mon = ensureWildMon(run, e);
        UI.openEncounter(e, mon);
        break;
      }
      if (!near(e.tx, e.ty, 1)) e._handled = false;
    }
  }
  /* 传送门：相邻按 E 或自动提示（走上门即传送） */
  for (const portal of run.portals) {
    if (near(portal.tx, portal.ty, 0)) travel(portal.to);
  }
}

function gatherResource(node) {
  const drop = RES_DROPS[node.kind].loot;
  const p = Game.player;
  const lines = [];
  if (drop.gold) { const g = randInt(drop.gold[0], drop.gold[1]); p.gold += g; lines.push("金币 +" + g); }
  if (drop.gem) { const gm = randInt(drop.gem[0], drop.gem[1]); p.gem += gm; lines.push("钻石 +" + gm); }
  if (drop.items) for (const id in drop.items) {
    const n = randInt(drop.items[id][0], drop.items[id][1]);
    p.items[id] = (p.items[id] || 0) + n;
    lines.push(ITEMS[id].name + " ×" + n);
  }
  node.until = Date.now() + RES_RESPAWN_MS;
  toast("采集：" + lines.join("，"));
  saveGame();
}
function pickEgg(nest) {
  if (Game.player.eggs.length >= 6) { toast("幻兽蛋已满（最多 6 枚），先去孵化吧"); return; }
  addEgg();
  nest.until = Date.now() + EGG_NEST_RESPAWN_MS;
  toast("发现一枚幻兽蛋！行走 " + EGG_STEPS + " 步即可孵化（背包查看）", "ok");
  saveGame();
}
function talkNearest() {
  const run = getRun(Game.currentIsland);
  const p = Game.player;
  const ptx = Math.floor(p.px / TILE), pty = Math.floor(p.py / TILE);
  let best = null, bd = 2;
  for (const n of run.npcs) {
    const d = Math.max(Math.abs(n.tx - ptx), Math.abs(n.ty - pty));
    if (d <= bd) { best = n; bd = d; }
  }
  if (best) UI.openDialog(NPCS[best.npc]);
  else toast("附近没有可交谈的对象");
}
function travel(islandId) {
  const island = ISLANDS.find((i) => i.id === islandId);
  if (Game.player.lv < island.needLv) {
    toast(island.name + " 需要训练师 Lv." + island.needLv);
    /* 把玩家推离传送门 */
    const p = Game.player; const run = getRun(Game.currentIsland);
    p.px = run.map.spawn.x * TILE + TILE / 2; p.py = run.map.spawn.y * TILE + TILE / 2;
    return;
  }
  if (Game.currentIsland === islandId) return;
  Game.currentIsland = islandId;
  Game.player.island = islandId;
  if (!Game.player.discovered.includes(islandId)) Game.player.discovered.push(islandId);
  const run = getRun(islandId);
  Game.player.px = run.map.spawn.x * TILE + TILE / 2;
  Game.player.py = run.map.spawn.y * TILE + TILE / 2;
  saveGame();
  toast("抵达 " + island.name, "ok");
}

/* ================= 主世界渲染 ================= */
const camera = { x: 0, y: 0 };
let canvas, ctx, vw, vh;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr);
  canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function drawTile(t, x, y, theme, time, gx, gy) {
  if (t === "W") {
    ctx.fillStyle = theme.water;
    ctx.fillRect(x, y, TILE, TILE);
    const wave = Math.sin(time / 600 + (gx + gy) * 0.7);
    if (wave > 0.55) {
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 8 + wave * 3, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  } else if (t === "S") {
    ctx.fillStyle = theme.sand;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "rgba(200,160,80,.25)";
    circle(ctx, x + 9 + ((gx * 7) % 14), y + 11 + ((gy * 11) % 12), 1.6);
    circle(ctx, x + 22 + ((gx * 3) % 8), y + 23 + ((gy * 5) % 7), 1.3);
  } else if (t === "G" || t === "g") {
    ctx.fillStyle = t === "G" ? theme.grass : theme.grass2;
    ctx.fillRect(x, y, TILE, TILE);
    if ((gx * 13 + gy * 7) % 5 === 0) {
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 22); ctx.lineTo(x + 10, y + 16);
      ctx.moveTo(x + 20, y + 26); ctx.lineTo(x + 22, y + 20);
      ctx.stroke();
    }
    if (t === "g") {
      ctx.fillStyle = "rgba(255,255,255,.18)";
      circle(ctx, x + 16, y + 14, 2.2);
    }
  } else if (t === "T") {
    /* 树下是草地 */
    ctx.fillStyle = theme.grass;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.beginPath(); ctx.ellipse(x + TILE / 2, y + TILE - 6, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8d5a2b";
    rr(ctx, x + 13, y + 16, 6, 12, 2); ctx.fill();
    ctx.fillStyle = theme.treeD;
    circle(ctx, x + TILE / 2, y + 13, 11);
    ctx.fillStyle = theme.tree;
    circle(ctx, x + 12, y + 10, 7);
    circle(ctx, x + 21, y + 11, 7);
    circle(ctx, x + 16, y + 6, 7);
  } else if (t === "R") {
    ctx.fillStyle = theme.grass;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.beginPath(); ctx.ellipse(x + 17, y + 24, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.rock;
    ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 24);
    ctx.lineTo(x + 10, y + 12);
    ctx.lineTo(x + 20, y + 8);
    ctx.lineTo(x + 26, y + 16);
    ctx.lineTo(x + 24, y + 24);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawPlayer(p, sx, sy, time) {
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.beginPath(); ctx.ellipse(sx, sy + 14, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  const step = moving ? Math.sin(p.walkT || 0) * 2 : 0;
  /* 腿 */
  ctx.fillStyle = "#2c3e7a";
  rr(ctx, sx - 6, sy + 6 + Math.max(0, step), 5, 7, 2); ctx.fill();
  rr(ctx, sx + 1, sy + 6 + Math.max(0, -step), 5, 7, 2); ctx.fill();
  /* 身体 */
  ctx.fillStyle = "#3e8ef7";
  rr(ctx, sx - 9, sy - 6, 18, 16, 6); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.25)";
  rr(ctx, sx - 6, sy - 3, 12, 4, 2); ctx.fill();
  /* 头 */
  ctx.fillStyle = "#ffe0bd";
  circle(ctx, sx, sy - 12, 7.5);
  /* 帽子 */
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath(); ctx.arc(sx, sy - 14, 7.5, Math.PI, 0); ctx.fill();
  rr(ctx, sx - 9, sy - 15, 18, 3, 1.5); ctx.fill();
  ctx.fillStyle = "#fff";
  rr(ctx, sx - 2.5, sy - 19, 5, 2.5, 1); ctx.fill();
  /* 朝向小指示（眼睛） */
  ctx.fillStyle = "#3b2f2f";
  const look = p.facing === "left" ? -2 : p.facing === "right" ? 2 : 0;
  const lookY = p.facing === "up" ? -1 : 1;
  if (p.facing !== "up") {
    circle(ctx, sx - 2.5 + look, sy - 11 + (lookY - 1), 1.3);
    circle(ctx, sx + 2.5 + look, sy - 11 + (lookY - 1), 1.3);
  }
}

function drawPortal(x, y, toId, time) {
  const island = ISLANDS.find((i) => i.id === toId);
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  for (let i = 0; i < 3; i++) {
    const r = 6 + i * 4 + Math.sin(time / 300 + i) * 1.5;
    ctx.strokeStyle = ["#a29bfe", "#74b9ff", "#ffeaa7"][i];
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 3;
  ctx.strokeText(island.name, 0, -20); ctx.fillText(island.name, 0, -20);
  ctx.restore();
}

function renderWorld(time) {
  const island = ISLANDS.find((i) => i.id === Game.currentIsland);
  const run = getRun(Game.currentIsland);
  const map = run.map;
  const p = Game.player;
  camera.x = p.px - vw / 2;
  camera.y = p.py - vh / 2;

  ctx.fillStyle = island.theme.water;
  ctx.fillRect(0, 0, vw, vh);

  const x0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const x1 = Math.min(map.w, Math.ceil((camera.x + vw) / TILE) + 1);
  const y1 = Math.min(map.h, Math.ceil((camera.y + vh) / TILE) + 1);

  for (let gy = y0; gy < y1; gy++) for (let gx = x0; gx < x1; gx++) {
    drawTile(map.grid[gy][gx], gx * TILE - camera.x, gy * TILE - camera.y, island.theme, time, gx, gy);
  }

  /* 实体层（按 y 排序，伪纵深） */
  const ents = [];
  for (const e of run.wild) ents.push({ y: e.ty, fn: () => {
    ensureWildMon(run, e);
    const cx = e.rx - camera.x;
    const cy2 = e.ry - camera.y;
    drawMonSmall(ctx, e.mon.sp, cx, cy2, time);
    /* 等级小字 */
    ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2.5;
    const label = "Lv." + e.mon.lv;
    ctx.strokeText(label, cx, cy2 - 18); ctx.fillText(label, cx, cy2 - 18);
  } });
  const now = Date.now();
  for (const node of run.res) if (node.until === 0 || now < node.until ? node.until === 0 : false) {}
  for (const node of run.res) if (node.until === 0) ents.push({ y: node.ty, fn: () =>
    drawResource(ctx, node.kind, node.tx * TILE + TILE / 2 - camera.x, node.ty * TILE + TILE / 2 - camera.y, time) });
  for (const nest of run.eggs) if (nest.until === 0) ents.push({ y: nest.ty, fn: () =>
    drawEgg(ctx, nest.tx * TILE + TILE / 2 - camera.x, nest.ty * TILE + TILE / 2 - camera.y, time) });
  for (const n of run.npcs) ents.push({ y: n.ty, fn: () => {
    drawNPC(ctx, n.npc, n.tx * TILE + TILE / 2 - camera.x, n.ty * TILE + TILE / 2 - camera.y, time);
    ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2.5;
    const nm = NPCS[n.npc].name;
    ctx.strokeText(nm, n.tx * TILE + TILE / 2 - camera.x, n.ty * TILE - 4 - camera.y);
    ctx.fillText(nm, n.tx * TILE + TILE / 2 - camera.x, n.ty * TILE - 4 - camera.y);
  } });
  for (const portal of run.portals) ents.push({ y: portal.ty - 1, fn: () =>
    drawPortal(portal.tx * TILE - camera.x, portal.ty * TILE - camera.y, portal.to, time) });
  ents.push({ y: p.py / TILE, fn: () => drawPlayer(p, p.px - camera.x, p.py - camera.y, time) });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.fn();

  drawMinimap(island, run);
}

function drawMinimap(island, run) {
  const mc = document.getElementById("minimap");
  const mctx = mc.getContext("2d");
  const mw = mc.width, mh = mc.height;
  const sx = mw / run.map.w, sy = mh / run.map.h;
  mctx.fillStyle = island.theme.water; mctx.fillRect(0, 0, mw, mh);
  for (let y = 0; y < run.map.h; y++) for (let x = 0; x < run.map.w; x++) {
    const t = run.map.grid[y][x];
    if (t === "G" || t === "g") mctx.fillStyle = island.theme.grass;
    else if (t === "S") mctx.fillStyle = island.theme.sand;
    else if (t === "T") mctx.fillStyle = island.theme.treeD;
    else if (t === "R") mctx.fillStyle = island.theme.rock;
    else continue;
    mctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
  }
  const now = Date.now();
  mctx.fillStyle = "#ff5252";
  for (const e of run.wild) mctx.fillRect(e.tx * sx - 1.5, e.ty * sy - 1.5, 3, 3);
  mctx.fillStyle = "#ffd93d";
  for (const node of run.res) if (node.until === 0) mctx.fillRect(node.tx * sx - 1.5, node.ty * sy - 1.5, 3, 3);
  mctx.fillStyle = "#00e5ff";
  for (const nest of run.eggs) if (nest.until === 0) mctx.fillRect(nest.tx * sx - 1.5, nest.ty * sy - 1.5, 3, 3);
  mctx.fillStyle = "#9b59b6";
  for (const n of run.npcs) mctx.fillRect(n.tx * sx - 2, n.ty * sy - 2, 4, 4);
  mctx.fillStyle = "#fff";
  for (const portal of run.portals) {
    mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5;
    mctx.strokeRect(portal.tx * sx - 2, portal.ty * sy - 2, 4, 4);
  }
  /* 玩家 */
  const p = Game.player;
  mctx.fillStyle = "#e74c3c";
  mctx.beginPath();
  mctx.arc((p.px / TILE) * sx, (p.py / TILE) * sy, 3.5, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5; mctx.stroke();
}
