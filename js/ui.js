/* ================= UI 层 ================= */
(function () {
  const FG = window.FG;
  const $ = s => document.querySelector(s);

  /* ---------- Toast ---------- */
  FG.toast = function (text, type) {
    const layer = $('#toast-layer');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = text;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  };

  /* ---------- 模态 ---------- */
  function modal({ title, body, foot, small }) {
    const layer = $('#modal-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = '';
    const m = document.createElement('div');
    m.className = 'modal' + (small ? ' small' : '');
    m.innerHTML =
      '<div class="modal-head"><h2></h2><button class="modal-close">&#10005;</button></div>' +
      '<div class="modal-body"></div>' + (foot ? '<div class="modal-foot"></div>' : '');
    m.querySelector('h2').textContent = title || '';
    m.querySelector('.modal-body').appendChild(typeof body === 'string' ? wrap(body) : body);
    if (foot) {
      (Array.isArray(foot) ? foot : [foot]).forEach(b => m.querySelector('.modal-foot').appendChild(b));
    }
    m.querySelector('.modal-close').onclick = FG.closeModal;
    layer.appendChild(m);
    layer.onclick = e => { if (e.target === layer) FG.closeModal(); };
    return m;
  }
  FG.openModal = modal;
  FG._modal = modal;
  FG.closeModal = function () {
    const layer = $('#modal-layer');
    layer.classList.add('hidden');
    layer.innerHTML = '';
  };
  function wrap(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
  FG.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  FG.btn = (text, cls, onClick) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = text;
    b.onclick = onClick;
    return b;
  };
  FG.elTag = el => {
    const info = FG.EL_INFO[el];
    return '<span class="el-tag ' + info.cls + '">' + info.icon + info.name + '</span>';
  };

  /* ---------- 顶部训练师 HUD ---------- */
  FG.refreshHUD = function (state) {
    const pet = FG.activePet(state);
    $('#tr-level').textContent = 'Lv.' + state.trainer.lv;
    if (pet) {
      $('#hp-text').textContent = Math.max(0, pet.hp) + '/' + pet.maxHp;
      $('#hp-fill').style.width = FG.clamp(pet.hp / pet.maxHp * 100, 0, 100) + '%';
      const need = FG.expNeed(pet.lv);
      $('#exp-text').textContent = pet.exp + '/' + need + (pet.lv >= FG.STAR_CAP[pet.star] ? '（星级上限）' : '');
      $('#exp-fill').style.width = FG.clamp(pet.exp / need * 100, 0, 100) + '%';
      $('#el-text').textContent = FG.EL_INFO[FG.SPECIES[pet.species].el].icon;
    } else {
      $('#hp-text').textContent = '无出战幻兽';
      $('#hp-fill').style.width = '0%';
      $('#exp-fill').style.width = '0%';
      $('#exp-text').textContent = '';
      $('#el-text').textContent = '⚪';
    }
    $('#power-text').textContent = FG.teamPower(state);
    $('#gold-text').textContent = state.gold;
    $('#gem-text').textContent = state.gems;
    $('#map-name').textContent = FG.ISLANDS[state.world.islandIdx].name;
  };

  /* ---------- 队伍栏 ---------- */
  FG.refreshParty = function (state, opts) {
    opts = opts || {};
    const box = $('#party-slots');
    box.innerHTML = '';
    state.mainSlots.forEach((uid, i) => {
      const slot = FG.el('div', 'pet-slot main' + (uid === state.activeUid ? ' active' : '') + (uid ? '' : ' empty'));
      slot.appendChild(FG.el('div', 'slot-tag main', '主' + (i + 1)));
      const pet = uid ? state.allPets[uid] : null;
      if (pet) {
        slot.innerHTML += '<div class="pet-face">' + FG.SPECIES[pet.species].face + '</div>' +
          '<div class="pet-lv q-' + FG.SPECIES[pet.species].q + '">' + FG.SPECIES[pet.species].name + ' Lv.' + pet.lv + '</div>' +
          '<div class="stars">' + '\u2605'.repeat(pet.star) + '\u2606'.repeat(5 - pet.star) + '</div>' +
          '<div class="pet-hpmini"><i style="width:' + FG.clamp(pet.hp / pet.maxHp * 100, 0, 100) + '%"></i></div>';
        slot.onclick = () => {
          if (opts.battleMode) { FG.Battle.onSwitchClick && FG.Battle.onSwitchClick(uid); return; }
          if (FG.setActive(state, uid)) {
            FG.toast('切换出战：' + FG.SPECIES[pet.species].name, 'good');
            FG.refreshAll(state);
          } else {
            const left = Math.ceil((state.followCdUntil - Date.now()) / 1000);
            FG.toast('切换冷却中，还需 ' + left + ' 秒', 'bad');
          }
        };
      } else {
        slot.innerHTML += '<div class="pet-face" style="opacity:.4">\u2795</div><div class="pet-lv">主战位 ' + (i + 1) + '</div>';
        slot.onclick = () => { if (!opts.battleMode) FG.openAssign(state, 'main', i); };
      }
      box.appendChild(slot);
    });

    const unlockCosts = [null, { lv: 5, gem: 3 }, { lv: 15, gem: 6 }, { lv: 30, gem: 12 }];
    state.supportSlots.forEach((s, i) => {
      const unlocked = state.supportUnlocked[i];
      const pet = s.petUid ? state.allPets[s.petUid] : null;
      const slot = FG.el('div', 'pet-slot support' + (unlocked ? '' : ' empty'));
      slot.appendChild(FG.el('div', 'slot-tag support', '辅' + (i + 1)));
      if (unlocked && pet) {
        slot.innerHTML += '<div class="pet-face">' + FG.SPECIES[pet.species].face + '</div>' +
          '<div class="pet-lv">' + FG.SPECIES[pet.species].name + ' Lv' + s.lv + '</div>' +
          '<div class="stars">' + '\u2605'.repeat(pet.star) + '\u2606'.repeat(5 - pet.star) + '</div>';
        slot.onclick = () => { if (!opts.battleMode) FG.openSupportMenu(state, i); };
      } else if (unlocked) {
        slot.innerHTML += '<div class="pet-face" style="opacity:.4">\u2795</div><div class="pet-lv">辅战位 ' + (i + 1) + '</div>';
        slot.onclick = () => { if (!opts.battleMode) FG.openAssign(state, 'support', i); };
      } else {
        const c = unlockCosts[i + 1];
        slot.innerHTML += '<div class="pet-face" style="opacity:.4">\uD83D\uDD12</div><div class="pet-lv">Lv.' + c.lv + ' / \uD83D\uDC8E' + c.gem + '</div>';
        slot.onclick = () => {
          if (state.trainer.lv < c.lv) { FG.toast('训练师达到 Lv.' + c.lv + ' 后可解锁该辅战位', 'bad'); return; }
          if (state.gems < c.gem) { FG.toast('需要 \uD83D\uDC8E' + c.gem + ' 钻石解锁', 'bad'); return; }
          state.gems -= c.gem; state.supportUnlocked[i] = true;
          FG.toast('辅战位已解锁！', 'good');
          FG.refreshAll(state); FG.save(state);
        };
      }
      box.appendChild(slot);
    });

    const left = state.followCdUntil - Date.now();
    $('#follow-cd').textContent = left > 0 ? '出战切换冷却 ' + Math.ceil(left / 1000) + 's' : '';
  };
})();

/* ================= 面板：宠物卡 / 详情 / 背包 / 队伍 ================= */
(function () {
  const FG = window.FG;

  function petCard(pet, state, onClick) {
    const sp = FG.SPECIES[pet.species];
    const card = FG.el('div', 'pet-card qborder-' + sp.q);
    card.innerHTML =
      '<div class="pc-face">' + sp.face + '</div>' +
      '<div class="pc-name q-' + sp.q + '">[' + sp.q + '] ' + sp.name + '</div>' +
      '<div class="pc-meta">' + FG.elTag(sp.el) + ' Lv.' + pet.lv + ' ' +
        '\u2605'.repeat(pet.star) + '\u2606'.repeat(5 - pet.star) +
        ' 资质' + pet.apt + '</div>';
    card.onclick = () => onClick && onClick(pet);
    return card;
  }
  FG.petCard = petCard;

  /* 宠物详情（培养操作） */
  FG.openPetDetail = function (state, uid) {
    const pet = state.allPets[uid];
    if (!pet) return;
    const body = FG.el('div');
    const render = () => {
      FG.refreshPet(pet);
      const sp = FG.SPECIES[pet.species];
      const b = FG.baseStats(pet);
      const ev = FG.canEvolve(pet);
      const starCost = FG.starCost(pet.star);
      const washCost = FG.washCost(pet.star);
      const skillCost = FG.skillUpCost(pet.skillStar);
      const shardId = FG.shardId(sp.q);
      const boxPets = Object.values(state.allPets).filter(p => p.species === pet.species && p.uid !== pet.uid);
      const cap = FG.STAR_CAP[pet.star];
      body.innerHTML =
        '<div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">' +
          '<div style="font-size:64px">' + sp.face + '</div>' +
          '<div>' +
            '<div class="q-' + sp.q + '" style="font-size:18px;font-weight:700">[' + sp.q + '] ' + sp.name +
            ' ' + FG.elTag(sp.el) + '</div>' +
            '<div style="font-size:12px;color:#9fc4e8;margin:4px 0">' + sp.bio + '</div>' +
            '<div style="font-size:12px">等级 <b>Lv.' + pet.lv + '</b>/' + cap +
            ' · 星级 ' + '\u2605'.repeat(pet.star) + '\u2606'.repeat(5 - pet.star) +
            ' · 技能星级 ' + pet.skillStar + '/3 · 资质 <b>' + pet.apt + '</b>（+' +
            Math.round(FG.aptGrade(pet.apt).bonus * 100) + '%攻/防）</div>' +
          '</div>' +
        '</div>' +
        '<div class="stat-lines">' +
          '<div><span class="k">生命</span>' + b.hp + '　<span class="k">攻击</span>' + b.atk + '</div>' +
          '<div><span class="k">防御</span>' + b.def + '　<span class="k">速度</span>' + b.spd + '</div>' +
          '<div><span class="k">经验</span>' + pet.exp + '/' + FG.expNeed(pet.lv) + '</div>' +
        '</div>' +
        '<h3 style="color:#8fe6ff;margin:12px 0 6px;font-size:14px">已学技能</h3><div id="skill-list"></div>' +
        '<h3 style="color:#8fe6ff;margin:12px 0 6px;font-size:14px">培养</h3>' +
        '<div id="cult-actions" style="display:flex;flex-wrap:wrap;gap:8px"></div>';
      const sl = body.querySelector('#skill-list');
      pet.skills.forEach(s => {
        const sk = FG.SKILLS[s.id];
        const row = FG.el('div', 'item-row');
        row.innerHTML = '<div class="it-icon">' + sk.icon + '</div><div class="it-info"><div class="it-name">' +
          sk.name + ' ' + FG.elTag(sk.el === 'none' ? sp.el : sk.el) + (s.unlocked ? '' : ' <span style="color:#ff8a80">（技能星级不足）</span>') +
          '</div><div class="it-desc">' + sk.desc + (sk.pwr ? ' · 威力' + sk.pwr : sk.heal ? ' · 治疗32%生命' : ' · ' + (sk.pct * 100) + '%防御/' + sk.turns + '回合') + '</div></div>';
        sl.appendChild(row);
      });
      const ca = body.querySelector('#cult-actions');

      /* 升星 */
      if (pet.star < 5) {
        const haveShard = FG.itemCount(state, shardId);
        const dup = boxPets[0];
        const canShard = haveShard >= starCost.shards && state.gold >= starCost.gold;
        const b1 = FG.btn('\u2B50 升星（' + FG.ITEMS[shardId].icon + starCost.shards + '+\uD83D\uDCB0' + starCost.gold + '）',
          canShard ? 'gold' : 'gray', () => {
            FG.spendItem(state, shardId, starCost.shards);
            FG.spendItem(state, 'gold', starCost.gold);
            pet.star++;
            FG.refreshPet(pet);
            pet.hp = pet.maxHp;
            FG.toast(sp.name + ' 升至 ' + pet.star + ' 星！解锁新的洗髓区间与等级上限', 'good');
            FG.save(state); render(); FG.refreshAll(state);
          });
        if (!canShard) b1.disabled = true;
        ca.appendChild(b1);
        if (dup) {
          ca.appendChild(FG.btn('用同名幻兽升星（' + FG.SPECIES[dup.species].name + '）', 'gold', () => {
            releasePet(state, dup.uid, true);
            pet.star++; FG.refreshPet(pet); pet.hp = pet.maxHp;
            FG.toast(sp.name + ' 升至 ' + pet.star + ' 星！', 'good');
            FG.save(state); render(); FG.refreshAll(state);
          }));
        }
      } else {
        ca.appendChild(FG.btn('已达最高星级', 'gray', () => {}));
        ca.lastChild.disabled = true;
      }

      /* 洗髓 */
      const range = FG.washRange(pet.star).join('/');
      const canWash = state.gold >= washCost.gold && state.gems >= washCost.gem;
      const wb = FG.btn('\uD83C\uDFB2 洗髓（\uD83D\uDCB0' + washCost.gold + (washCost.gem ? '+\uD83D\uDC8E' + washCost.gem : '') +
        '）区间' + range, canWash ? '' : 'gray', () => {
          FG.spendItem(state, 'gold', washCost.gold);
          FG.spendItem(state, 'gem', washCost.gem);
          const next = FG.rollApt(pet.star);
          FG.toast('洗髓结果：' + pet.apt + ' → ' + next +
            (FG.APT.findIndex(a => a.g === next) > FG.APT.findIndex(a => a.g === pet.apt) ? '（提升！）' : ''),
            'good');
          pet.apt = next;
          FG.refreshPet(pet);
          FG.save(state); render(); FG.refreshAll(state);
        });
      if (!canWash) wb.disabled = true;
      ca.appendChild(wb);

      /* 技能星级 */
      if (pet.skillStar < 3) {
        const canSkill = state.gold >= skillCost.gold && state.gems >= skillCost.gem;
        const sb = FG.btn('\uD83D\uDCD6 技能星级→' + (pet.skillStar + 1) + '（\uD83D\uDCB0' + skillCost.gold + '+\uD83D\uDC8E' + skillCost.gem + '）',
          canSkill ? 'gold' : 'gray', () => {
            FG.spendItem(state, 'gold', skillCost.gold);
            FG.spendItem(state, 'gem', skillCost.gem);
            pet.skillStar++;
            FG.refreshPet(pet);
            FG.toast('技能星级提升！更多技能已解锁', 'good');
            FG.save(state); render(); FG.refreshAll(state);
          });
        if (!canSkill) sb.disabled = true;
        ca.appendChild(sb);
      }

      /* 进化 */
      const evb = ev
        ? FG.btn('\uD83C\uDF1F 进化为 ' + FG.SPECIES[ev.target].name + '（Lv.' + ev.needLv + '）', 'gold', () => {
            FG.evolvePet(pet);
            state.stats.evolutions++;
            FG.toast('进化成功！', 'good');
            FG.save(state); FG.closeModal(); FG.refreshAll(state);
            FG.openPetDetail(state, uid);
          })
        : FG.btn('进化（未达到条件）', 'gray', () => {});
      if (!ev) evb.disabled = true;
      ca.appendChild(evb);

      /* 休息/卸下/重生 */
      if (pet.role === 'main') {
        const idx = state.mainSlots.indexOf(uid);
        ca.appendChild(FG.btn('撤下主战位', 'gray', () => {
          state.mainSlots[idx] = null; pet.role = null;
          if (state.activeUid === uid) state.activeUid = state.mainSlots.find(u => u) || null;
          state.box.push(uid);
          FG.save(state); FG.closeModal(); FG.refreshAll(state);
        }));
      } else if (pet.role === 'support') {
        ca.appendChild(FG.btn('撤下辅战位', 'gray', () => {
          const si = state.supportSlots.findIndex(s => s.petUid === uid);
          state.supportSlots[si].petUid = null; pet.role = null; state.box.push(uid);
          FG.save(state); FG.closeModal(); FG.refreshAll(state);
        }));
      }
    };
    render();
    FG._modal({
      title: '幻兽详情',
      body,
      foot: FG.btn('关闭', 'gray', FG.closeModal)
    });
  };

  function releasePet(state, uid, silent) {
    const pet = state.allPets[uid];
    if (!pet) return;
    const si = state.supportSlots.findIndex(s => s.petUid === uid);
    if (si >= 0) state.supportSlots[si].petUid = null;
    const mi = state.mainSlots.indexOf(uid);
    if (mi >= 0) state.mainSlots[mi] = null;
    state.box = state.box.filter(u => u !== uid);
    delete state.allPets[uid];
    if (state.activeUid === uid) state.activeUid = state.mainSlots.find(u => u) || null;
    if (!silent) FG.refreshAll(state);
  }
  FG.releasePet = releasePet;
})();

/* ================= 面板：分配 / 辅战 / 背包 / 队伍 ================= */
(function () {
  const FG = window.FG;

  /* 从仓库选择幻兽上阵 */
  FG.openAssign = function (state, type, slotIdx) {
    const body = FG.el('div');
    const title = type === 'main' ? '选择幻兽加入主战位' : '选择幻兽加入辅战位';
    const available = state.box.map(u => state.allPets[u]).filter(Boolean)
      .filter(p => type === 'support' ? p.role !== 'main' : true);
    if (!available.length) {
      body.innerHTML = '<div style="text-align:center;padding:24px;color:#9fc4e8">仓库里还没有合适的幻兽。<br>先去野外捕捉更多伙伴吧！</div>';
    } else {
      const grid = FG.el('div', 'card-grid');
      available.forEach(p => {
        const card = FG.petCard(p, state, () => {
          if (type === 'main') {
            state.mainSlots[slotIdx] = p.uid;
            p.role = 'main';
            if (!state.activeUid) state.activeUid = p.uid;
          } else {
            state.supportSlots[slotIdx].petUid = p.uid;
            p.role = 'support';
          }
          state.box = state.box.filter(u => u !== p.uid);
          FG.toast('上阵成功', 'good');
          FG.save(state); FG.closeModal(); FG.refreshAll(state);
        });
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }
    FG.openModal({ title, body, foot: FG.btn('取消', 'gray', FG.closeModal) });
  };

  /* 辅战位菜单：升级 / 查看 / 更换 */
  FG.openSupportMenu = function (state, i) {
    const slot = state.supportSlots[i];
    const pet = state.allPets[slot.petUid];
    if (!pet) { FG.openAssign(state, 'support', i); return; }
    const body = FG.el('div');
    const render = () => {
      const sp = FG.SPECIES[pet.species];
      const b = FG.baseStats(pet);
      const r = FG.supportRatio(slot.lv);
      const upCost = { gold: 400 * slot.lv, gem: slot.lv >= 3 ? 1 : 0 };
      body.innerHTML =
        '<div style="text-align:center;margin-bottom:8px">' +
          '<div style="font-size:54px">' + sp.face + '</div>' +
          '<div class="q-' + sp.q + '" style="font-weight:700">[' + sp.q + '] ' + sp.name + ' Lv.' + pet.lv + '</div>' +
          '<div style="color:#9fc4e8;font-size:12px">辅战位等级 Lv.' + slot.lv + '/' + FG.SUPPORT_SLOT_MAX +
          ' · 提供 <b style="color:#ffd76a">' + Math.round(r * 100) + '%</b> 属性加成</div>' +
        '</div>' +
        '<div class="stat-lines">' +
          '<div><span class="k">贡献生命</span>+' + Math.floor(b.hp * r) +
          '　<span class="k">贡献攻击</span>+' + Math.floor(b.atk * r) + '</div>' +
          '<div><span class="k">贡献防御</span>+' + Math.floor(b.def * r) +
          '　<span class="k">贡献速度</span>+' + Math.floor(b.spd * r) + '</div>' +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap" id="sup-actions"></div>';
      const ac = body.querySelector('#sup-actions');
      if (slot.lv < FG.SUPPORT_SLOT_MAX) {
        const can = state.gold >= upCost.gold && state.gems >= upCost.gem;
        const ub = FG.btn('升级辅战位（\uD83D\uDCB0' + upCost.gold + (upCost.gem ? '+\uD83D\uDC8E' + upCost.gem : '') + '）',
          can ? 'gold' : 'gray', () => {
            FG.spendItem(state, 'gold', upCost.gold);
            FG.spendItem(state, 'gem', upCost.gem);
            slot.lv++;
            FG.toast('辅战位升至 Lv.' + slot.lv + '，属性加成提升！', 'good');
            FG.save(state); render(); FG.refreshAll(state);
          });
        if (!can) ub.disabled = true;
        ac.appendChild(ub);
      }
      ac.appendChild(FG.btn('查看幻兽详情', '', () => FG.openPetDetail(state, pet.uid)));
      ac.appendChild(FG.btn('撤下', 'gray', () => {
        slot.petUid = null; pet.role = null; state.box.push(pet.uid);
        FG.save(state); FG.closeModal(); FG.refreshAll(state);
      }));
    };
    render();
    FG.openModal({ title: '辅战位 ' + (i + 1), body, foot: FG.btn('关闭', 'gray', FG.closeModal) });
  };

  /* 背包 */
  FG.openBag = function (state) {
    const body = FG.el('div');
    const render = () => {
      body.innerHTML = '<div style="margin-bottom:8px;color:#ffd76a">\uD83D\uDCB0 ' + state.gold +
        ' 金币　\uD83D\uDC8E ' + state.gems + ' 钻石</div>';
      const ids = Object.keys(FG.ITEMS).filter(id => FG.ITEMS[id].kind !== 'shard' || (state.items[id] || 0) > 0);
      let any = false;
      ids.forEach(id => {
        const it = FG.ITEMS[id];
        const n = state.items[id] || 0;
        if (it.kind === 'money' || it.kind === 'shard') return;
        if (n <= 0 && it.kind !== 'ball') return;
        any = true;
        const row = FG.el('div', 'item-row');
        row.innerHTML = '<div class="it-icon">' + it.icon + '</div>' +
          '<div class="it-info"><div class="it-name">' + it.name + '</div>' +
          '<div class="it-desc">' + it.desc + '</div></div>' +
          '<div class="it-count">x' + n + '</div>';
        const useBtn = FG.btn('使用', 'gold', () => {
          if (it.kind === 'heal') {
            const p = FG.activePet(state);
            if (!p) { FG.toast('没有出战幻兽', 'bad'); return; }
            if (p.hp >= p.maxHp) { FG.toast('生命已满', 'bad'); return; }
            FG.spendItem(state, id, 1);
            p.hp = Math.min(p.maxHp, p.hp + it.heal);
            FG.toast('恢复了 ' + it.heal + ' 点生命', 'good');
          } else if (it.kind === 'revive') {
            const faint = FG.mainPets(state).find(p => p && p.hp <= 0);
            if (!faint) { FG.toast('没有倒下的主战幻兽', 'bad'); return; }
            FG.spendItem(state, id, 1);
            faint.hp = Math.floor(faint.maxHp / 2);
            FG.toast(FG.SPECIES[faint.species].name + ' 复活了！', 'good');
          } else {
            FG.toast(it.name + ' 需要在战斗中使用', 'bad');
            return;
          }
          FG.save(state); render(); FG.refreshAll(state);
        });
        if (it.kind !== 'heal' && it.kind !== 'revive') useBtn.style.display = 'none';
        row.appendChild(useBtn);
        body.appendChild(row);
      });
      if (!any) body.innerHTML += '<div style="color:#9fc4e8;text-align:center;padding:16px">背包空空如也，去营地找商人补充吧。</div>';
    };
    render();
    FG.openModal({ title: '🎒 背包', body, foot: FG.btn('关闭', 'gray', FG.closeModal) });
  };

  /* 队伍（全部幻兽 + 仓库） */
  FG.openTeam = function (state) {
    const body = FG.el('div');
    const render = () => {
      body.innerHTML = '';
      const mkSec = (title, pets) => {
        if (!pets.length) return;
        body.appendChild(FG.el('h3', '', title));
        body.lastChild.style.cssText = 'color:#8fe6ff;margin:10px 0 6px;font-size:14px';
        const grid = FG.el('div', 'card-grid');
        pets.forEach(p => grid.appendChild(FG.petCard(p, state, () => FG.openPetDetail(state, p.uid))));
        body.appendChild(grid);
      };
      mkSec('主战幻兽（' + state.mainSlots.filter(u => u).length + '/3）',
        FG.mainPets(state).filter(Boolean));
      const sup = FG.supportPets(state).filter(Boolean);
      if (sup.length) mkSec('助阵幻兽', sup);
      const boxPets = state.box.map(u => state.allPets[u]).filter(Boolean);
      mkSec('幻兽仓库（' + boxPets.length + '）', boxPets);
      if (!FG.mainPets(state).filter(Boolean).length && !boxPets.length)
        body.innerHTML = '<div style="color:#9fc4e8;text-align:center;padding:20px">还没有幻兽。</div>';
    };
    render();
    FG.openModal({ title: '🐾 我的幻兽', body, foot: FG.btn('关闭', 'gray', FG.closeModal) });
  };
})();

/* ================= 面板：孵蛋 / 地图 / 帮助 / NPC ================= */
(function () {
  const FG = window.FG;

  /* 孵蛋 */
  FG.openEgg = function (state) {
    const body = FG.el('div');
    const render = () => {
      body.innerHTML = '<div style="color:#9fc4e8;font-size:12px;margin-bottom:10px">在世界中行走可以积累孵化步数，蛋在获得的岛屿阶位决定稀有度倾向。每走 4 步所有蛋 +1 进度。</div>';
      if (!state.eggs.length) {
        body.innerHTML += '<div style="text-align:center;padding:20px;color:#9fc4e8">暂时没有幻兽蛋。<br>去探索地图上的 🥚 神秘幻兽蛋 资源点吧！</div>';
      } else {
        const grid = FG.el('div', 'egg-grid');
        state.eggs.forEach(e => {
          const card = FG.el('div', 'egg-card');
          const pct = Math.min(100, Math.round(e.steps / e.total * 100));
          card.innerHTML = '<div class="eg">\uD83E\uDD5A</div>' +
            '<div><b class="q-' + e.q + '">[' + e.q + ' 倾向]</b></div>' +
            '<div style="font-size:12px;color:#9fc4e8;margin:4px 0">来自：' + FG.ISLANDS[e.islandIdx].name + '</div>' +
            '<div class="bar" style="height:12px"><div class="bar-fill" style="width:' + pct +
              '%;background:linear-gradient(90deg,#ffd76a,#ff9d5c)"></div>' +
              '<span class="bar-text">' + e.steps + '/' + e.total + '</span></div>';
          grid.appendChild(card);
        });
        body.appendChild(grid);
      }
    };
    render();
    FG.openModal({ title: '🥚 幻兽蛋孵化器（' + state.eggs.length + '/4）', body, foot: FG.btn('关闭', 'gray', FG.closeModal) });
  };

  function hatchReadyEggs(state) {
    const remain = [];
    const hatched = [];
    state.eggs.forEach(e => {
      if (e.steps >= e.total) {
        const pool = FG.EGG_POOLS[e.islandIdx];
        const q = FG.weighted(pool.map(x => ({ v: x.q, w: x.w })));
        let candidates = FG.speciesPoolByQ(q);
        if (!candidates.length) candidates = FG.speciesPoolByQ('N');
        const spId = FG.choice(candidates);
        const lv = FG.randInt(1, Math.max(1, FG.ISLANDS[e.islandIdx].wildLv[0]));
        const pet = FG.makePet(spId, lv);
        FG.addPetToState(state, pet);
        hatched.push(pet);
      } else remain.push(e);
    });
    state.eggs = remain;
    return hatched;
  }
  FG.hatchReadyEggs = hatchReadyEggs;

  /* 地图（群岛传送） */
  FG.openMap = function (state) {
    const body = FG.el('div');
    const cur = state.world.islandIdx;
    FG.ISLANDS.forEach((isle, i) => {
      const unlocked = state.trainer.lv >= isle.needTrainerLv;
      const row = FG.el('div', 'item-row' + (i === cur ? ' selected' : ''));
      row.style.border = i === cur ? '2px solid #ffd76a' : '';
      row.innerHTML = '<div class="it-icon">' + ['🏝️', '🏖️', '🌋', '🌬️', '🏛️'][i] + '</div>' +
        '<div class="it-info"><div class="it-name">' + (unlocked ? isle.name : '？？？') +
        (i === cur ? ' <span style="color:#ffd76a">（当前所在）</span>' : '') + '</div>' +
        '<div class="it-desc">' + (unlocked ? isle.desc + ' · 野生 Lv.' + isle.wildLv.join('~')
          : '训练师 Lv.' + isle.needTrainerLv + ' 解锁') + '</div></div>';
      if (i !== cur) {
        const btn = FG.btn(unlocked ? '前往' : '🔒', unlocked ? 'gold' : 'gray', () => {
          if (!unlocked) { FG.toast('训练师等级不足', 'bad'); return; }
          FG.world.enterIsland(state, i, false);
          FG.toast('抵达 ' + isle.name, 'good');
          FG.save(state); FG.closeModal(); FG.refreshAll(state);
        });
        if (!unlocked) btn.disabled = true;
        row.appendChild(btn);
      }
      body.appendChild(row);
    });
    body.appendChild(FG.el('div', '', '提示：除使用地图面板外，走到地图上的 🌀 传送门也可以前往下一岛屿（需要达到指定训练师等级）。'));
    body.lastChild.style.cssText = 'font-size:12px;color:#9fc4e8;margin-top:8px';
    FG.openModal({ title: '🗺️ 群岛地图', body, foot: FG.btn('关闭', 'gray', FG.closeModal) });
  };

  /* 帮助 */
  FG.openHelp = function (state) {
    const body = FG.el('div', 'help-sec');
    body.innerHTML =
      '<h3>🎯 游戏目标</h3>' +
      '<div>在五座岛屿间探险，捕捉与培养幻兽，挑战神魔圣域中的传说幻兽，成为最强精灵大师！</div>' +
      '<h3>🕹️ 操作方式</h3>' +
      '<div>· 点击地图地块自动寻路；或使用 WASD / 方向键移动。<br>' +
      '· 走到 NPC / 资源点 / 传送门旁，点击自身或按 E / 空格 互动。<br>' +
      '· 点击底部主战幻兽可切换出战跟随（10 秒冷却）。</div>' +
      '<h3>⚔️ 元素克制（克制方伤害 +10%）</h3>' +
      '<table><tr><th>关系</th><th>说明</th></tr>' +
      '<tr><td>🌊 水 → 🔥 火</td><td>水克火</td></tr>' +
      '<tr><td>🔥 火 → 🌪️ 风</td><td>火克风（星火燎原）</td></tr>' +
      '<tr><td>🌪️ 风 → 🌊 水</td><td>风克水（风卷狂澜）</td></tr>' +
      '<tr><td>✨ 神 ↔ 🌑 魔</td><td>神魔相互克制</td></tr>' +
      '<tr><td>✨神 / 🌑魔</td><td>均克制 水 / 火 / 风 三系</td></tr></table>' +
      '<h3>🔴 捕捉</h3>' +
      '<div>接触野外幻兽可先尝试捕捉；对方生命越低、精灵球越高级，成功率越高。诱兽果可再 +25%。捕捉失败或选择战斗即进入回合战。</div>' +
      '<h3>🌟 等级 / 星级 / 进化</h3>' +
      '<div>等级上限随星级提升：' + FG.STAR_CAP.slice(1).join('/') + '。升星消耗同品质碎片+金币，或消耗同名幻兽；技能星级（1-3）解锁更强技能，洗髓可刷新资质。' +
      '幻兽达到指定等级可进化为更强形态（16 级、34 级）。</div>' +
      '<h3>🏅 品质与资质</h3>' +
      '<div>N &lt; R &lt; SR &lt; SSR &lt; UR，品质决定基础属性倍率。资质 D/C/B/A/S/SS 直接加成攻击与防御；升星解锁 A/S/SS 洗髓区间，资质在升星后继承。</div>' +
      '<h3>🛡️ 主战与助阵</h3>' +
      '<div>主战位 3 个，场景中 1 只跟随，战斗中可轮换（切换无额外惩罚，由敌人攻击一次）。辅战位 3 个（训练师 Lv.5/15/30 解锁），' +
      '不参战但按辅战位等级（6%→24%）把自身属性叠加给主战幻兽。</div>' +
      '<h3>💾 其他</h3>' +
      '<div>进度自动保存在浏览器本地。护士可免费全队治疗；商人出售精灵球与药剂；资源点会定时刷新。</div>';
    FG.openModal({ title: '❔ 游戏帮助', body, foot: FG.btn('开始冒险', 'gold', FG.closeModal) });
  };

  /* NPC 互动 */
  FG.handleNpc = function (state, npc) {
    if (npc.id === 'nurse') {
      let n = 0;
      Object.values(state.allPets).forEach(p => {
        if (p.role && p.hp < p.maxHp) { p.hp = p.maxHp; n++; }
      });
      const body = wrap3(npc.face + ' ' + npc.say + '<br><br>' + (n ? '✨ 全队幻兽生命已完全恢复！' : '大家看起来都很有精神！'));
      FG.openModal({ title: npc.name, body: body, small: true,
        foot: FG.btn('谢谢铃音', 'gold', FG.closeModal) });
      FG.refreshAll(state); FG.save(state);
    } else if (npc.id === 'merchant') {
      FG.openShop(state);
    } else {
      FG.openModal({ title: npc.face + ' ' + npc.name, body: wrap3(npc.say), small: true,
        foot: FG.btn('知道了', 'gold', FG.closeModal) });
    }
  };
  function wrap3(html) { const d = document.createElement('div'); d.style.lineHeight = '1.9'; d.innerHTML = html; return d; }

  /* 商店 */
  FG.openShop = function (state) {
    const stock = ['ball', 'greatball', 'ultraball', 'potion', 'superpotion', 'revive', 'berry'];
    const body = FG.el('div');
    const render = () => {
      body.innerHTML = '<div style="margin-bottom:8px;color:#ffd76a">\uD83D\uDCB0 ' + state.gold + ' 金币　\uD83D\uDC8E ' + state.gems + ' 钻石</div>';
      stock.forEach(id => {
        const it = FG.ITEMS[id];
        const row = FG.el('div', 'item-row');
        row.innerHTML = '<div class="it-icon">' + it.icon + '</div>' +
          '<div class="it-info"><div class="it-name">' + it.name + ' <span class="it-count">持有x' + (state.items[id] || 0) + '</span></div>' +
          '<div class="it-desc">' + it.desc + '</div></div>';
        const b1 = FG.btn('\uD83D\uDCB0' + it.price, 'gold', () => buy(id, 1));
        const b10 = FG.btn('x10 \uD83D\uDCB0' + it.price * 10, '', () => buy(id, 10));
        row.appendChild(b1); row.appendChild(b10);
        body.appendChild(row);
      });
    };
    function buy(id, n) {
      const total = FG.ITEMS[id].price * n;
      if (state.gold < total) { FG.toast('金币不足', 'bad'); return; }
      state.gold -= total;
      state.items[id] = (state.items[id] || 0) + n;
      FG.toast('购入 ' + FG.ITEMS[id].name + ' x' + n, 'good');
      FG.save(state); render(); FG.refreshAll(state);
    }
    render();
    FG.openModal({ title: '🧔 旅行商人', body, foot: FG.btn('离开', 'gray', FG.closeModal) });
  };

  /* 资源点互动 */
  FG.handleNode = function (state, node) {
    const idx = state.world.islandIdx;
    const key = idx + '-' + node.uid;
    const until = state.nodeCooldowns[key] || 0;
    if (until > Date.now()) {
      FG.toast(FG.NODES[node.type].name + ' 还在恢复中（' + Math.ceil((until - Date.now()) / 1000) + '秒）', 'bad');
      return;
    }
    const def = FG.NODES[node.type];
    const loot = FG.weighted(def.loot.map(l => ({ v: l, w: l.w })));
    let text = '';
    if (loot.id === 'egg') {
      if (state.eggs.length >= 4) { FG.toast('孵化器已满（最多4颗蛋），先孵化一些吧', 'bad'); return; }
      state.eggs.push({ uid: FG.uid(), q: null, steps: 0, total: FG.randInt(220, 320), islandIdx: idx });
      text = '发现了一颗 🥚 神秘幻兽蛋！快去行走积累孵化步数吧。';
    } else if (loot.id === 'shard') {
      const qs = ['N', 'R', 'SR', 'SSR'];
      const q = FG.choice(qs.slice(0, Math.min(4, 1 + idx)));
      const n = FG.randInt(loot.n[0], loot.n[1]);
      FG.addItem(state, FG.shardId(q), n);
      text = '获得 ' + FG.ITEMS[FG.shardId(q)].icon + FG.ITEMS[FG.shardId(q)].name + ' x' + n + '！';
    } else {
      const n = Array.isArray(loot.n) ? FG.randInt(loot.n[0], loot.n[1]) : loot.n;
      FG.addItem(state, loot.id, n);
      const it = FG.ITEMS[loot.id];
      text = '获得 ' + (it ? it.icon + it.name : loot.id) + ' x' + n + '！';
    }
    state.nodeCooldowns[key] = Date.now() + def.cd * 1000;
    FG.toast(text, 'good');
    FG.save(state); FG.refreshAll(state);
  };
})();

/* ================= 遭遇 / 战斗界面 / 新手 ================= */
(function () {
  const FG = window.FG;
  const $ = sel => document.querySelector(sel);

  FG.refreshAll = function (state) {
    Object.values(state.allPets).forEach(p => FG.refreshPet(p));
    FG.refreshHUD(state);
    FG.refreshParty(state, { battleMode: !!(FG.Battle.active && !FG.Battle.active.over) });
  };

  /* 遭遇野生幻兽 */
  FG.encounterWild = function (state, w) {
    const sp = FG.SPECIES[w.pet.species];
    const active = FG.activePet(state);
    if (!active) { FG.toast('你还没有幻兽，无法接触野生幻兽', 'bad'); return; }
    const previewChance = Math.round(FG.previewCatchChance(state, w.pet, 'ball') * 100);
    const body = FG.el('div', '');
    body.style.textAlign = 'center';
    body.innerHTML =
      '<div style="font-size:72px;margin:8px 0">' + sp.face + '</div>' +
      '<div style="font-size:18px;font-weight:700" class="q-' + sp.q + '">野生的 [' + sp.q + '] ' + sp.name +
      ' Lv.' + w.pet.lv + '</div>' +
      '<div style="margin:6px 0;font-size:13px;color:#9fc4e8">' + FG.elTag(sp.el) + ' ' +
      sp.bio + '</div>' +
      '<div style="font-size:13px;margin:8px 0">以当前血量直接使用 🔴精灵球 的预估成功率：<b style="color:#ffd76a">' +
      previewChance + '%</b><br><span style="font-size:11px;color:#9fc4e8">削低对方生命可显著提升捕捉成功率</span></div>';

    const catchBtn = FG.btn('🔴 直接捕捉', 'gold', () => {
      FG.closeModal();
      FG.startBattleUI(state, w, true);
    });
    const battleBtn = FG.btn('⚔️ 发起战斗', '', () => {
      FG.closeModal();
      FG.startBattleUI(state, w, false);
    });
    const leaveBtn = FG.btn('悄悄离开', 'gray', () => {
      FG.toast('你绕开了 ' + sp.name);
      FG.closeModal();
    });
    FG.openModal({ title: '遭遇野生幻兽！', body, foot: [catchBtn, battleBtn, leaveBtn] });
  };

  FG.previewCatchChance = function (state, enemyPet, ballId) {
    const item = FG.ITEMS[ballId];
    const q = FG.QUALITY[FG.SPECIES[enemyPet.species].q];
    const base = 0.92 - (q.mult - 1) * 1.4;
    const ratio = enemyPet.hp / enemyPet.maxHp;
    const lowHp = 1.45 - ratio * 0.85;
    const starPenalty = 1 - (enemyPet.star - 1) * 0.05;
    return FG.clamp(base * lowHp * starPenalty * item.mult, 0.03, 0.95);
  };

  FG.startBattleUI = function (state, w, immediateCatch) {
    const res = FG.Battle.startWild(state, w);
    if (res && res.error === 'no-pet') { FG.toast('所有主战幻兽都倒下了，先去找护士治疗吧', 'bad'); return; }
    FG.openBattleModal(state, w);
    if (immediateCatch) FG.Battle.tryCatch(state, 'ball');
  };

  FG.openBattleModal = function (state, w) {
    const body = FG.el('div', '', '');
    body.id = 'battle-stage';
    let logEl, enemyPlateEl, playerPlateEl;

    const build = () => {
      const b = FG.Battle.active;
      const ePet = w.pet;
      const eSp = FG.SPECIES[ePet.species];
      const pPet = state.allPets[b.playerUid];
      const pSp = FG.SPECIES[pPet.species];
      body.innerHTML =
        '<div class="bs-row">' +
          '<div class="fighter enemy" id="f-enemy">' +
            '<div class="f-face">' + eSp.face + '</div>' +
            '<div class="f-plate"><div class="f-name">[' + eSp.q + '] ' + eSp.name + ' Lv.' + ePet.lv + ' ' + FG.elTag(eSp.el) + '</div>' +
            '<div class="f-hpbar"><i id="e-hp"></i></div><div id="e-hpt" style="font-size:11px"></div></div>' +
          '</div>' +
          '<div style="align-self:center;font-size:22px">⚔️</div>' +
          '<div class="fighter" id="f-player">' +
            '<div class="f-face">' + pSp.face + '</div>' +
            '<div class="f-plate"><div class="f-name">[' + pSp.q + '] ' + pSp.name + ' Lv.' + pPet.lv + ' ' + FG.elTag(pSp.el) + '</div>' +
            '<div class="f-hpbar"><i id="p-hp"></i></div><div id="p-hpt" style="font-size:11px"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="f-log" id="b-log"></div>' +
        '<div id="b-controls"></div>';
      logEl = body.querySelector('#b-log');
      enemyPlateEl = body.querySelector('#f-enemy');
      playerPlateEl = body.querySelector('#f-player');

      const ctrl = body.querySelector('#b-controls');
      const skillsWrap = FG.el('div', 'skill-grid');
      pPet.skills.filter(s => s.unlocked).forEach(s => {
        const sk = FG.SKILLS[s.id];
        const btn = FG.el('button', 'skill-btn');
        btn.innerHTML = '<b>' + sk.icon + ' ' + sk.name + '</b><small>' +
          (sk.pwr ? '威力 ' + sk.pwr : sk.heal ? '恢复 32% 生命' : '防御 +30%') + ' · ' +
          FG.EL_INFO[sk.el === 'none' ? pSp.el : sk.el].name + '系</small>';
        btn.onclick = () => { FG.Battle.playerSkill(state, s.id); };
        skillsWrap.appendChild(btn);
      });
      ctrl.appendChild(skillsWrap);

      const side = FG.el('div', 'battle-side');
      side.style.marginTop = '8px';
      const balls = ['ball', 'greatball', 'ultraball', 'masterball'];
      balls.forEach(id => {
        const n = state.items[id] || 0;
        const bb = FG.btn(FG.ITEMS[id].icon + ' 捕捉' + (n ? ' x' + n : ''), 'gold', () => {
          if (!n) { FG.toast('没有' + FG.ITEMS[id].name, 'bad'); return; }
          FG.Battle.tryCatch(state, id);
        });
        bb.title = '预估成功率 ' + Math.round(FG.Battle.catchChance(state, id) * 100) + '%';
        if (!n) bb.style.opacity = '.5';
        side.appendChild(bb);
      });
      side.appendChild(FG.btn('🍓 诱兽果 x' + (state.items.berry || 0), '', () => {
        if (!(state.items.berry > 0)) { FG.toast('没有诱兽果', 'bad'); return; }
        FG.Battle.useBerry(state);
      }));
      const healIds = ['potion', 'superpotion'];
      healIds.forEach(id => {
        const n = state.items[id] || 0;
        const hb = FG.btn(FG.ITEMS[id].icon + ' x' + n, '', () => {
          if (!n) { FG.toast('没有药剂', 'bad'); return; }
          if (FG.Battle.active.player.hp >= FG.Battle.active.player.maxHp) { FG.toast('生命已满', 'bad'); return; }
          FG.Battle.usePotion(state, id);
        });
        side.appendChild(hb);
      });
      side.appendChild(FG.btn('🔄 换宠', '', () => FG.openSwitchInBattle(state)));
      side.appendChild(FG.btn('🏃 逃跑', 'gray', () => FG.Battle.flee(state)));
      ctrl.appendChild(side);
    };

    const update = () => {
      const b = FG.Battle.active;
      if (!body.isConnected) return;
      if (!logEl) build();
      const e = b.enemy, p = b.player;
      const ehp = body.querySelector('#e-hp'); const php = body.querySelector('#p-hp');
      ehp.style.width = FG.clamp(e.hp / e.maxHp * 100, 0, 100) + '%';
      php.style.width = FG.clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
      ehp.classList.toggle('low', e.hp / e.maxHp < 0.3);
      php.classList.toggle('low', p.hp / p.maxHp < 0.3);
      body.querySelector('#e-hpt').textContent = Math.max(0, e.hp) + '/' + e.maxHp;
      body.querySelector('#p-hpt').textContent = Math.max(0, p.hp) + '/' + p.maxHp;
      body.querySelector('#f-enemy').classList.toggle('faint', e.hp <= 0);
      body.querySelector('#f-player').classList.toggle('faint', p.hp <= 0);
      logEl.innerHTML = b.logs.slice(-12).map(l => '<div class="' + l.cls + '">' + l.text + '</div>').join('');
      logEl.scrollTop = logEl.scrollHeight;
      body.querySelectorAll('.skill-btn, .battle-side .btn').forEach(btn => {
        btn.disabled = !!b.busy || b.over;
      });
      FG.refreshHUD(state);
      FG.refreshParty(state, { battleMode: true });
    };

    FG.Battle.onChange = update;
    FG.Battle.onSwitchClick = uid => FG.openSwitchInBattle(state);
    FG.Battle.onEnd = result => {
      setTimeout(() => {
        const b = FG.Battle.active;
        if (!b) return;
        if (b.over) {
          FG.Battle.onEnd = null;
          if (result.win === false) FG.Battle.gameOverRecover(state);
          FG.save(state);
          FG.closeModal();
          FG.Battle.end();
          FG.refreshAll(state);
          if (result.caught) FG.showCaughtCard(state, result.caught);
        }
      }, result.caught ? 1300 : 1000);
    };
    build();
    FG.openModal({ title: '⚔️ 战斗', body });
    update();
  };

  /* 捕捉成功卡片 */
  FG.showCaughtCard = function (state, pet) {
    const sp = FG.SPECIES[pet.species];
    const body = FG.el('div');
    body.style.textAlign = 'center';
    body.innerHTML = '<div style="font-size:70px;margin:6px">' + sp.face + '</div>' +
      '<div class="q-' + sp.q + '" style="font-size:18px;font-weight:700">捕捉成功！[' + sp.q + '] ' + sp.name +
      ' Lv.' + pet.lv + '</div>' +
      '<div style="color:#9fc4e8;font-size:13px;margin:6px 0">资质 ' + pet.apt + ' · ' +
      '\u2605'.repeat(pet.star) + '\u2606'.repeat(5 - pet.star) + '</div>' +
      '<div style="font-size:12px;color:#9fc4e8">' + sp.bio + '</div>';
    FG.openModal({ title: '🎉 新伙伴加入', body, small: true,
      foot: [FG.btn('查看详情', '', () => { FG.closeModal(); FG.openPetDetail(state, pet.uid); }),
             FG.btn('太棒了', 'gold', FG.closeModal)] });
  };

  /* 战斗中换宠 */
  FG.openSwitchInBattle = function (state) {
    const b = FG.Battle.active;
    if (b.busy) return;
    const body = FG.el('div', 'card-grid');
    FG.mainPets(state).forEach(p => {
      if (!p) return;
      const card = FG.petCard(p, state, () => {
        if (p.uid === b.playerUid) { FG.closeModal(); return; }
        if (p.hp <= 0) { FG.toast('这只幻兽已经倒下了', 'bad'); return; }
        FG.closeModal();
        FG.Battle.switchPet(state, p.uid);
      });
      if (p.uid === b.playerUid) card.classList.add('selected');
      if (p.hp <= 0) card.style.opacity = '.5';
      body.appendChild(card);
    });
    FG.openModal({ title: '选择出战幻兽（敌方将趁机攻击一次）', body, foot: FG.btn('取消', 'gray', FG.closeModal) });
  };

  /* 新手三选一 */
  FG.openStarter = function (state) {
    const body = FG.el('div', 'starter-grid');
    FG.STARTERS.forEach(id => {
      const sp = FG.SPECIES[id];
      const card = FG.el('div', 'starter-card');
      card.innerHTML = '<div class="s-face">' + sp.face + '</div>' +
        '<div style="font-weight:700;margin:6px 0">' + sp.name + ' ' + FG.elTag(sp.el) + '</div>' +
        '<div style="font-size:12px;color:#9fc4e8">' + sp.bio + '</div>';
      card.onclick = () => {
        const pet = FG.makePet(id, 5);
        FG.addPetToState(state, pet);
        state.started = true;
        FG.save(state);
        FG.closeModal();
        FG.refreshAll(state);
        FG.toast('你获得了 ' + sp.name + '！冒险开始！', 'good');
        setTimeout(() => FG.openHelp(state), 300);
      };
      body.appendChild(card);
    });
    FG.openModal({ title: '选择你的第一只幻兽', body });
  };

  /* 统一互动入口 */
  FG.handleInteract = function () {
    const state = FG.State;
    if (!state || !state.started) return;
    if (FG.Battle.active) return;
    if (!$('#modal-layer').classList.contains('hidden')) return;
    const t = FG.world.findInteractTarget(state);
    if (!t) { FG.toast('附近没有可互动的对象'); return; }
    if (t.kind === 'npc') FG.handleNpc(state, t.npc);
    else if (t.kind === 'node') FG.handleNode(state, t.node);
    else if (t.kind === 'portal') {
      const isle = FG.ISLANDS[state.world.islandIdx];
      const to = isle.portal.to;
      if (state.trainer.lv < isle.portal.needLv) {
        FG.toast('传送门需要训练师 Lv.' + isle.portal.needLv + ' 才能激活', 'bad');
        return;
      }
      FG.world.enterIsland(state, to, true);
      FG.toast('穿越传送门，抵达 ' + FG.ISLANDS[to].name + '！', 'good');
      FG.save(state); FG.refreshAll(state);
    }
  };
})();
