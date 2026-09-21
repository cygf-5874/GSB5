/* ================= 世界：地图 / 移动 / 渲染 ================= */
(function () {
  const FG = window.FG;
  const TILE = 36;
  FG.TILE = TILE;

  const world = {
    maps: {},        // islandIdx -> {grid, wilds, nodes, npcs}
    path: null,
    moveT: 0,
    keys: {},
    interactTarget: null
  };
  FG.world = world;

  /* ---------- 地图生成 ---------- */
  function makeMap(idx) {
    const isle = FG.ISLANDS[idx];
    const rnd = FG.rng(1000 + idx * 77);
    const W = isle.w, H = isle.h;
    const T = FG.TERRAIN[isle.palette];
    const grid = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        let c = rnd() < 0.12 ? ',' : '.';          // 地面深浅变化
        row.push(c);
      }
      grid.push(row);
    }
    const set = (x, y, c) => {
      if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = c;
    };
    const walkable = c => c === '.' || c === ',' || c === 'w' || c === 's';

    /* 海岸线（深水阻挡） */
    for (let x = 0; x < W; x++) {
      set(x, 0, 'W'); set(x, 1, rnd() < 0.5 ? 'w' : 'W'); set(x, H - 1, 'W'); set(x, H - 2, rnd() < 0.5 ? 'w' : 'W');
    }
    for (let y = 0; y < H; y++) {
      set(0, y, 'W'); set(1, y, rnd() < 0.5 ? 'w' : 'W'); set(W - 1, y, 'W'); set(W - 2, y, rnd() < 0.5 ? 'w' : 'W');
    }
    /* 沙滩/火山岛：散布浅水 */
    if (isle.palette === 'beach') {
      for (let i = 0; i < 46; i++) {
        const x = 3 + Math.floor(rnd() * (W - 6));
        const y = 3 + Math.floor(rnd() * (H - 6));
        if (walkable(grid[y][x])) set(x, y, 'w');
      }
    }
    if (isle.palette === 'volcano') {
      for (let i = 0; i < 20; i++) {
        const x = 3 + Math.floor(rnd() * (W - 6));
        const y = 3 + Math.floor(rnd() * (H - 6));
        if (walkable(grid[y][x])) set(x, y, 'm');
      }
    }
    /* 随机阻挡：树/岩 + 小簇 */
    const clusters = Math.floor((W * H) / 60);
    for (let i = 0; i < clusters; i++) {
      const cx = 4 + Math.floor(rnd() * (W - 8));
      const cy = 4 + Math.floor(rnd() * (H - 8));
      const n = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) {
        const x = cx + Math.floor(rnd() * 3) - 1;
        const y = cy + Math.floor(rnd() * 3) - 1;
        if (x > 2 && y > 2 && x < W - 3 && y < H - 3 && rnd() < 0.7) set(x, y, T.block);
      }
    }

    const clearArea = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++)
        for (let x = cx - r; x <= cx + r; x++)
          if (x > 1 && y > 1 && x < W - 2 && y < H - 2) set(x, y, '.');
    };
    clearArea(isle.camp.x, isle.camp.y, 2);
    if (isle.portal) clearArea(isle.portal.x, isle.portal.y, 2);

    /* 尝试打开连通（从营地 BFS，若有过多孤立阻挡边的格子则清掉一些） */
    ensureConnected(grid, isle.camp.x, isle.camp.y, walkable, set);

    /* NPC（营地里） */
    const npcs = [
      { id: 'nurse', name: '护士·铃音', face: '👩‍⚕️', x: isle.camp.x - 1, y: isle.camp.y + 1,
        say: '队伍里的幻兽都恢复精神啦！受伤了随时来找我哦。' },
      { id: 'merchant', name: '旅行商人·阿卷', face: '🧔', x: isle.camp.x + 2, y: isle.camp.y,
        say: '来看看最新的精灵球和药剂吧，童叟无欺！' },
      { id: 'elder', name: '岛屿长老', face: '🧙', x: isle.camp.x, y: isle.camp.y - 2,
        say: isle.desc }
    ];
    npcs.forEach(n => {
      if (!walkable(grid[n.y] && grid[n.y][n.x])) { n.x = isle.camp.x + 1; n.y = isle.camp.y + 1; }
    });

    /* 资源点：随机放置在可行走格上，远离营地 */
    const nodes = [];
    isle.nodes.forEach(group => {
      for (let i = 0; i < group.n; i++) {
        let tries = 0, x, y;
        do {
          x = 3 + Math.floor(rnd() * (W - 6));
          y = 3 + Math.floor(rnd() * (H - 6));
          tries++;
        } while ((!walkable(grid[y][x]) || near(x, y, isle.camp.x, isle.camp.y, 5) ||
                  nodes.some(n => n.x === x && n.y === y) ||
                  npcs.some(n => n.x === x && n.y === y)) && tries < 200);
        if (tries < 200) nodes.push({ type: group.t, x, y, uid: 'node-' + idx + '-' + nodes.length });
      }
    });

    /* 野生幻兽 */
    const wilds = [];
    for (let i = 0; i < isle.wildCount; i++) {
      wilds.push(spawnWild(idx, grid, isle, wilds, rnd, true));
    }

    return { grid, wilds, nodes, npcs, W, H };
  }
  world.makeMap = makeMap;

  function near(x, y, cx, cy, r) { return Math.abs(x - cx) <= r && Math.abs(y - cy) <= r; }

  function ensureConnected(grid, sx, sy, walkable, set) {
    const H = grid.length, W = grid[0].length;
    const seen = Array.from({ length: H }, () => new Array(W).fill(false));
    const q = [[sx, sy]]; seen[sy][sx] = true;
    let count = 0;
    while (q.length) {
      const [x, y] = q.shift(); count++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny][nx]) continue;
        if (walkable(grid[ny][nx])) { seen[ny][nx] = true; q.push([nx, ny]); }
      }
    }
    if (count > (W * H) * 0.55) return; // 大部分可走即可
    /* 从营地随机向四周开几条路 */
    for (let k = 0; k < 12; k++) {
      let x = sx, y = sy;
      const steps = 10 + Math.floor(Math.random() * 14);
      for (let s = 0; s < steps; s++) {
        x += FG.choice([1, -1, 0, 0]); y += FG.choice([0, 0, 1, -1]);
        if (x > 2 && y > 2 && x < W - 3 && y < H - 3 && !walkable(grid[y][x])) set(x, y, '.');
      }
    }
  }

  function spawnWild(idx, grid, isle, existing, rnd, initial) {
    const W = isle.w, H = isle.h;
    let x, y, tries = 0;
    do {
      x = 3 + Math.floor(rnd() * (W - 6));
      y = 3 + Math.floor(rnd() * (H - 6));
      tries++;
    } while ((!isWalkable(grid[y][x]) || near(x, y, isle.camp.x, isle.camp.y, 4) ||
              existing.some(w => w.x === x && w.y === y) ||
              (isle.portal && near(x, y, isle.portal.x, isle.portal.y, 1))) && tries < 200);
    const rare = rnd() < 0.06;
    const table = rare ? isle.rare : isle.wild;
    const sp = FG.weighted(table.map(e => ({ v: e.sp, w: e.w })));
    const lv = FG.randInt(isle.wildLv[0], isle.wildLv[1]);
    const pet = FG.makePet(sp, lv);
    return { uid: pet.uid, pet, x, y, rare, respawnAt: 0, homeX: x, homeY: y };
  }
  world.spawnWild = spawnWild;

  function isWalkable(c) { return c === '.' || c === ',' || c === 'w' || c === 's'; }
  world.isWalkableAt = function (idx, x, y) {
    const m = getMap(idx);
    if (!m) return false;
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) return false;
    return isWalkable(m.grid[y][x]);
  };
  function getMap(idx) {
    if (!world.maps[idx]) world.maps[idx] = makeMap(idx);
    return world.maps[idx];
  }
  world.getMap = getMap;
})();

/* ---------- BFS 寻路 ---------- */
(function () {
  const FG = window.FG;
  const world = FG.world;

  world.findPath = function (idx, sx, sy, tx, ty) {
    const m = world.getMap(idx);
    if (!world.isWalkableAt(idx, tx, ty)) return null;
    const W = m.W, H = m.H;
    const key = (x, y) => y * W + x;
    const prev = new Map();
    const q = [[sx, sy]];
    prev.set(key(sx, sy), -1);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++];
      if (x === tx && y === ty) break;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!world.isWalkableAt(idx, nx, ny)) continue;
        const k = key(nx, ny);
        if (prev.has(k)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = [];
    let cur = key(tx, ty), start = key(sx, sy);
    while (cur !== -1 && cur !== start) {
      path.push([cur % W, Math.floor(cur / W)]);
      cur = prev.get(cur);
    }
    path.reverse();
    return path;
  };

  /* ---------- 移动 ---------- */
  world.update = function (dt, state, hooks) {
    const m = world.getMap(state.world.islandIdx);
    /* 野生游荡 */
    if (!world._wanderT) world._wanderT = 0;
    world._wanderT += dt;
    if (world._wanderT > 2.2) {
      world._wanderT = 0;
      m.wilds.forEach(w => {
        if (w.respawnAt) return;
        if (Math.random() < 0.35) {
          const d = FG.choice([[1,0],[-1,0],[0,1],[0,-1],[0,0]]);
          const nx = w.x + d[0], ny = w.y + d[1];
          if (world.isWalkableAt(state.world.islandIdx, nx, ny) &&
              !(nx === state.world.x && ny === state.world.y)) {
            w.x = nx; w.y = ny;
          }
        }
      });
    }

    /* 键盘移动：方向键 / WASD */
    let kdx = 0, kdy = 0;
    if (world.keys['arrowup'] || world.keys['w']) kdy -= 1;
    if (world.keys['arrowdown'] || world.keys['s']) kdy += 1;
    if (world.keys['arrowleft'] || world.keys['a']) kdx -= 1;
    if (world.keys['arrowright'] || world.keys['d']) kdx += 1;
    if (kdx || kdy) world.path = null;

    world.moveT += dt;
    const STEP = 0.16;   // 每格 0.16s
    if (world.moveT >= STEP) {
      world.moveT = 0;
      let nx = state.world.x, ny = state.world.y;
      if (world.path && world.path.length) {
        [nx, ny] = world.path.shift();
      } else if (kdx || kdy) {
        if (kdx && kdy) { kdx = 0; }   // 避免斜穿阻挡
        nx += kdx; ny += kdy;
      }
      if (nx !== state.world.x || ny !== state.world.y) {
        if (world.isWalkableAt(state.world.islandIdx, nx, ny)) {
          state.world.x = nx; state.world.y = ny;
          onStep(state, hooks);
        } else {
          world.path = null;
        }
      }
      if (world.path && !world.path.length) world.path = null;
    }

    /* 交互目标提示 */
    world.interactTarget = findInteractTarget(state);
    hooks && hooks.setInteractTip(world.interactTarget);
  };

  function onStep(state, hooks) {
    state.world.steps++;
    revealFog(state, state.world.x, state.world.y);
    /* 孵蛋步数 */
    if (state.eggs.length && state.world.steps % 4 === 0) {
      state.eggs.forEach(e => { e.steps++; });
      hooks && hooks.checkEggs && hooks.checkEggs();
    }
    /* 遭遇野生 */
    const m = world.getMap(state.world.islandIdx);
    const w = m.wilds.find(w => !w.respawnAt && w.x === state.world.x && w.y === state.world.y);
    if (w && hooks && hooks.onWild) hooks.onWild(w);
  }

  world.revealFog = revealFog;
  function revealFog(state, cx, cy) {
    const idx = state.world.islandIdx;
    if (!state.fog[idx]) state.fog[idx] = {};
    const f = state.fog[idx];
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 3; x <= cx + 3; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= 11) f[x + ',' + y] = 1;
  }

  function findInteractTarget(state) {
    const idx = state.world.islandIdx;
    const m = world.getMap(idx);
    const { x, y } = state.world;
    for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const tx = x + dx, ty = y + dy;
      const npc = m.npcs.find(n => n.x === tx && n.y === ty);
      if (npc) return { kind: 'npc', npc };
      const node = m.nodes.find(n => n.x === tx && n.y === ty);
      if (node) return { kind: 'node', node };
      const isle = FG.ISLANDS[idx];
      if (isle.portal && isle.portal.x === tx && isle.portal.y === ty) return { kind: 'portal' };
    }
    return null;
  }
  world.findInteractTarget = findInteractTarget;

  /* 进入岛屿（定位在营地） */
  world.enterIsland = function (state, idx, atPortal) {
    state.world.islandIdx = idx;
    const isle = FG.ISLANDS[idx];
    if (atPortal) { state.world.x = isle.portal.x; state.world.y = isle.portal.y + 1; }
    else { state.world.x = isle.camp.x; state.world.y = isle.camp.y; }
    world.path = null;
    revealFog(state, state.world.x, state.world.y);
  };

  /* 野生被击败/捕捉后的重生调度 */
  world.scheduleRespawn = function (state, w) {
    w.respawnAt = Date.now() + FG.rand(45, 90) * 1000;
  };
  world.checkRespawns = function (state) {
    const m = world.getMap(state.world.islandIdx);
    const isle = FG.ISLANDS[state.world.islandIdx];
    const now = Date.now();
    m.wilds.forEach(w => {
      if (w.respawnAt && now >= w.respawnAt) {
        const fresh = world.spawnWild(state.world.islandIdx, m.grid, isle, m.wilds, Math.random, false);
        w.uid = fresh.uid; w.pet = fresh.pet; w.x = fresh.x; w.y = fresh.y;
        w.rare = fresh.rare; w.homeX = fresh.x; w.homeY = fresh.y; w.respawnAt = 0;
      }
    });
  };
})();

/* ---------- 渲染 ---------- */
(function () {
  const FG = window.FG;
  const world = FG.world;
  let canvas, ctx, miniCanvas, miniCtx;
  let viewW = 0, viewH = 0;

  world.initCanvas = function (state) {
    canvas = document.getElementById('world-canvas');
    ctx = canvas.getContext('2d');
    miniCanvas = document.getElementById('minimap-canvas');
    miniCtx = miniCanvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      viewW = canvas.clientWidth; viewH = canvas.clientHeight;
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '20px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    };
    window.addEventListener('resize', resize);
    resize();
    bindInput(state);
  };

  function tileColor(palette, c, x, y) {
    const base = FG.TERRAIN[palette];
    const checker = (x + y) % 2 === 0;
    switch (c) {
      case ',': return base.ground2;
      case 'w': return checker ? '#4aa6d9' : '#439bd0';
      case 'W': return '#23618e';
      case 't': return checker ? '#2f7d3a' : '#357f3d';
      case 'm': return checker ? '#7a6f66' : '#70665e';
      case 's': return checker ? '#f0e0a8' : '#e8d89e';
      default: return base.ground;
    }
  }

  world.render = function (state, time) {
    if (!ctx) return;
    const idx = state.world.islandIdx;
    const isle = FG.ISLANDS[idx];
    const m = world.getMap(idx);
    ctx.fillStyle = '#10233a';
    ctx.fillRect(0, 0, viewW, viewH);

    /* 相机跟随 */
    const camX = state.world.x * FG.TILE + FG.TILE / 2 - viewW / 2;
    const camY = state.world.y * FG.TILE + FG.TILE / 2 - viewH / 2;

    const x0 = Math.max(0, Math.floor(camX / FG.TILE));
    const y0 = Math.max(0, Math.floor(camY / FG.TILE));
    const x1 = Math.min(m.W - 1, Math.ceil((camX + viewW) / FG.TILE));
    const y1 = Math.min(m.H - 1, Math.ceil((camY + viewH) / FG.TILE));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = m.grid[y][x];
        ctx.fillStyle = tileColor(isle.palette, c, x, y);
        ctx.fillRect(Math.floor(x * FG.TILE - camX), Math.floor(y * FG.TILE - camY), FG.TILE, FG.TILE);
        if (c === 't') {
          ctx.font = '24px serif';
          ctx.fillText('🌳', x * FG.TILE - camX + FG.TILE / 2, y * FG.TILE - camY + FG.TILE / 2 + 1);
        } else if (c === 'm') {
          ctx.font = '24px serif';
          ctx.fillText('🪨', x * FG.TILE - camX + FG.TILE / 2, y * FG.TILE - camY + FG.TILE / 2 + 1);
        } else if (c === 'w') {
          ctx.fillStyle = 'rgba(255,255,255,.12)';
          ctx.fillRect(x * FG.TILE - camX + 4, y * FG.TILE - camY + 8, 8, 2);
        }
      }
    }

    /* 营地 & 传送门 */
    drawEmoji('🏕️', isle.camp.x, isle.camp.y, camX, camY, 26);
    if (isle.portal) {
      const pulse = 1 + Math.sin(time / 300) * 0.08;
      ctx.save();
      ctx.translate(isle.portal.x * FG.TILE - camX + FG.TILE / 2, isle.portal.y * FG.TILE - camY + FG.TILE / 2);
      ctx.scale(pulse, pulse);
      ctx.font = '28px serif';
      ctx.fillText('🌀', 0, 0);
      ctx.restore();
    }

    /* 资源点 */
    m.nodes.forEach(n => {
      const cdKey = idx + '-' + n.uid;
      const until = state.nodeCooldowns[cdKey] || 0;
      if (until > time) {
        ctx.globalAlpha = 0.35;
        drawEmoji(FG.NODES[n.type].icon, n.x, n.y, camX, camY, 22);
        ctx.globalAlpha = 1;
        const left = Math.ceil((until - time) / 1000);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#dfefff';
        ctx.fillText(left + 's', n.x * FG.TILE - camX + FG.TILE / 2, n.y * FG.TILE - camY + FG.TILE - 4);
      } else {
        const bob = Math.sin(time / 500 + n.x) * 2;
        drawEmoji(FG.NODES[n.type].icon, n.x, n.y + 0, camX, camY - bob, 24);
      }
    });

    /* NPC */
    m.npcs.forEach(n => drawEmoji(n.face, n.x, n.y, camX, camY, 25));

    /* 野生幻兽 */
    m.wilds.forEach(w => {
      if (w.respawnAt) return;
      const bob = Math.sin(time / 350 + w.x + w.y) * 2;
      const px = w.x * FG.TILE - camX + FG.TILE / 2;
      const py = w.y * FG.TILE - camY + FG.TILE / 2 + bob;
      ctx.font = (w.rare ? '30px' : '26px') + ' serif';
      if (w.rare) {
        ctx.save();
        ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 12;
        ctx.fillText(FG.SPECIES[w.pet.species].face, px, py);
        ctx.restore();
      } else {
        ctx.fillText(FG.SPECIES[w.pet.species].face, px, py);
      }
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      const label = FG.SPECIES[w.pet.species].name + ' Lv.' + w.pet.lv;
      ctx.strokeText(label, px, py - 18); ctx.fillText(label, px, py - 18);
    });

    /* 跟随幻兽（玩家身后一格方向近似：显示在玩家上方） */
    const active = FG.activePet(state);
    /* 玩家 */
    const ppx = state.world.x * FG.TILE - camX + FG.TILE / 2;
    const ppy = state.world.y * FG.TILE - camY + FG.TILE / 2;
    if (active) {
      ctx.font = '22px serif';
      ctx.globalAlpha = .9;
      ctx.fillText(FG.SPECIES[active.species].face, ppx - 10, ppy - 14);
      ctx.globalAlpha = 1;
    }
    ctx.font = '26px serif';
    ctx.fillText('🧑‍🎤', ppx, ppy);

    /* 点击目标路径点提示 */
    if (world.path && world.path.length) {
      const [tx, ty] = world.path[world.path.length - 1];
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tx * FG.TILE - camX + 3, ty * FG.TILE - camY + 3, FG.TILE - 6, FG.TILE - 6);
    }

    drawMinimap(state);
  };

  function drawEmoji(ch, gx, gy, camX, camY, size) {
    ctx.font = size + 'px serif';
    ctx.fillText(ch, gx * FG.TILE - camX + FG.TILE / 2, gy * FG.TILE - camY + FG.TILE / 2);
  }

  /* ---------- 小地图 + 迷雾 ---------- */
  function drawMinimap(state) {
    const idx = state.world.islandIdx;
    const isle = FG.ISLANDS[idx];
    const m = world.getMap(idx);
    const mw = miniCanvas.width, mh = miniCanvas.height;
    const sx = mw / m.W, sy = mh / m.H;
    miniCtx.clearRect(0, 0, mw, mh);
    const fog = state.fog[idx] || {};
    for (let y = 0; y < m.H; y++) {
      for (let x = 0; x < m.W; x++) {
        if (!fog[x + ',' + y]) {
          miniCtx.fillStyle = '#091525';
          miniCtx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
          continue;
        }
        const c = m.grid[y][x];
        miniCtx.fillStyle = c === 'W' ? '#23618e' : c === 'w' ? '#4aa6d9'
          : c === 't' || c === 'm' ? '#3a4a5a' : FG.TERRAIN[isle.palette].ground2;
        miniCtx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    /* 刷新点 */
    m.wilds.forEach(w => {
      if (w.respawnAt || !fog[w.x + ',' + w.y]) return;
      miniCtx.fillStyle = w.rare ? '#ffd76a' : '#ff7a6e';
      miniCtx.fillRect(w.x * sx - 1, w.y * sy - 1, 3, 3);
    });
    /* 营地 */
    miniCtx.font = '8px serif'; miniCtx.textAlign = 'center';
    miniCtx.fillText('🏕', isle.camp.x * sx + sx / 2, isle.camp.y * sy + sy);
    if (isle.portal) miniCtx.fillText('🌀', isle.portal.x * sx + sx / 2, isle.portal.y * sy + sy);
    /* 玩家 */
    miniCtx.fillStyle = '#ffffff';
    miniCtx.beginPath();
    miniCtx.arc(state.world.x * sx + sx / 2, state.world.y * sy + sy / 2, 2.6, 0, Math.PI * 2);
    miniCtx.fill();
  }

  /* ---------- 输入 ---------- */
  function bindInput(state) {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      world.keys[k] = true;
      if (k === 'e' || k === ' ') {
        e.preventDefault();
        FG.handleInteract && FG.handleInteract();
      }
    });
    window.addEventListener('keyup', e => { world.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
      const camX = state.world.x * FG.TILE + FG.TILE / 2 - viewW / 2;
      const camY = state.world.y * FG.TILE + FG.TILE / 2 - viewH / 2;
      const gx = Math.floor((vx + camX) / FG.TILE);
      const gy = Math.floor((vy + camY) / FG.TILE);
      if (gx === state.world.x && gy === state.world.y) {
        FG.handleInteract && FG.handleInteract();
        return;
      }
      const path = world.findPath(state.world.islandIdx, state.world.x, state.world.y, gx, gy);
      if (path) world.path = path;
      else FG.toast && FG.toast('无法到达那里', 'bad');
    });
  }
})();
