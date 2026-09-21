/* ================= 主入口 / 游戏循环 ================= */
(function () {
  const FG = window.FG;
  const $ = s => document.querySelector(s);

  const state = FG.load() || FG.newGameState();
  FG.State = state;
  /* 兼容旧实例：补属性 */
  Object.values(state.allPets).forEach(p => FG.refreshPet(p));

  let last = performance.now();
  let saveT = 0, hatchT = 0, tipT = 0;
  let activeWild = null;

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state.started) {
      FG.world.update(dt, state, {
        setInteractTip: showInteractTip,
        onWild: w => {
          if (!FG.Battle.active && !activeWild &&
              $('#modal-layer').classList.contains('hidden')) {
            activeWild = w;
            FG.encounterWild(state, w);
          }
        },
        checkEggs: () => {}
      });
      FG.world.checkRespawns(state);
      /* 交互/战斗结束后放行同一只怪的再次遭遇：只有模态关闭时才允许新遭遇 */
      if (!$('#modal-layer').classList.contains('hidden')) activeWild = null;
      /* 遭遇面板关闭且玩家仍站怪上时，防止立刻重开：移开后清除 */
      if (activeWild) {
        const m = FG.world.getMap(state.world.islandIdx);
        if (!m.wilds.some(x => x === activeWild && x.x === state.world.x && x.y === state.world.y)) {
          activeWild = null;
        }
      }

      /* 孵化检查 */
      hatchT += dt;
      if (hatchT > 1.5) {
        hatchT = 0;
        const hatched = FG.hatchReadyEggs(state);
        if (hatched.length) {
          FG.save(state);
          hatched.forEach((p, i) => setTimeout(() => FG.showCaughtCard(state, p), i * 200));
        }
      }

      /* 自动存档 */
      saveT += dt;
      if (saveT > 5) { saveT = 0; FG.save(state); }

      FG.refreshHUD(state);
      updateFollowCdUI(state);
    }

    FG.world.render(state, now);
    requestAnimationFrame(loop);
  }

  let tipUntil = 0, tipText = '';
  function showInteractTip(t) {
    const el = $('#zone-tip');
    let text = '';
    if (t) {
      if (t.kind === 'npc') text = '按 E / 空格 或点击自己：与 ' + t.npc.name + ' 交谈';
      else if (t.kind === 'node') text = '按 E / 空格 或点击自己：调查 ' + FG.NODES[t.node.type].name;
      else if (t.kind === 'portal') {
        const isle = FG.ISLANDS[state.world.islandIdx];
        text = state.trainer.lv >= isle.portal.needLv
          ? '🌀 通往 ' + FG.ISLANDS[isle.portal.to].name + ' 的传送门（按 E 进入）'
          : '🌀 传送门（训练师 Lv.' + isle.portal.needLv + ' 激活）';
      }
    }
    if (text !== tipText) {
      tipText = text;
      el.textContent = text;
      el.classList.toggle('show', !!text);
    }
  }

  let cdT = 0;
  function updateFollowCdUI(state) {
    cdT += 1 / 60;
    if (cdT < 0.25) return;
    cdT = 0;
    const left = state.followCdUntil - Date.now();
    $('#follow-cd').textContent = left > 0 ? '出战切换冷却 ' + Math.ceil(left / 1000) + 's' : '';
  }

  /* ---------- 按钮 ---------- */
  document.querySelectorAll('.act-btn').forEach(btn => {
    btn.onclick = () => {
      if (!state.started) { FG.toast('请先选择初始幻兽'); return; }
      const act = btn.dataset.act;
      if (act === 'bag') FG.openBag(state);
      else if (act === 'team') FG.openTeam(state);
      else if (act === 'egg') FG.openEgg(state);
      else if (act === 'map') FG.openMap(state);
      else if (act === 'help') {
        const m = FG.el('div');
        const reset = FG.btn('🗑️ 清除存档重新开始', 'warn', () => {
          if (confirm('确定要清除全部存档吗？此操作不可恢复！')) {
            FG.wipeSave();
            location.reload();
          }
        });
        reset.style.fontSize = '12px';
        reset.style.marginTop = '14px';
        FG.openHelp(state);
        const foot = document.querySelector('.modal .modal-foot');
        if (foot) foot.insertBefore(reset, foot.firstChild);
      }
    };
  });

  /* ---------- 启动 ---------- */
  FG.world.initCanvas(state);
  if (!state.started) {
    FG.refreshAll(state);
    FG.openStarter(state);
  } else {
    FG.world.enterIsland(state, state.world.islandIdx, false);
    /* 初始迷雾 */
    FG.world.revealFog(state, state.world.x, state.world.y);
    FG.refreshAll(state);
  }

  window.addEventListener('beforeunload', () => FG.save(state));
  requestAnimationFrame(loop);
})();
