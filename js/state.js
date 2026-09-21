/* ================= 状态与核心数值 ================= */
(function () {
  const FG = window.FG;
  const SAVE_KEY = 'phantom_isles_save_v1';

  /* ---------- 经验曲线 ---------- */
  FG.expNeed = lv => 30 + lv * lv * 8;           // 升到下一级所需
  FG.trainerExpNeed = lv => 50 + lv * lv * 14;

  /* ---------- 创建幻兽实例 ---------- */
  FG.makePet = function (speciesId, lv, opts = {}) {
    const sp = FG.SPECIES[speciesId];
    let star = opts.star || 1;
    /* 高等级幻兽自动拥有承载其等级所需的星级 */
    while (lv > FG.STAR_CAP[star] && star < 5) star++;
    const pet = {
      uid: FG.uid(), species: speciesId,
      lv: Math.max(1, lv), exp: 0,
      star, skillStar: 1,
      apt: opts.apt || FG.rollApt(star),
      hp: 0, maxHp: 0,
      skills: [],
      role: null,          // 'main' | 'support' | null
      bornAt: Date.now()
    };
    FG.refreshPet(pet, true);
    pet.hp = pet.maxHp;
    return pet;
  };

  /* 基础属性（不含出战/辅战加成） */
  FG.baseStats = function (pet) {
    const sp = FG.SPECIES[pet.species];
    const lv = pet.lv;
    const q = FG.QUALITY[sp.q];
    const g = {};
    for (const k of ['hp', 'atk', 'def', 'spd']) {
      g[k] = Math.floor((sp.base[k] + sp.grow[k] * (lv - 1)) * q.mult * FG.STAR_MULT(pet.star));
    }
    g.atk = Math.floor(g.atk * (1 + FG.aptGrade(pet.apt).bonus));
    g.def = Math.floor(g.def * (1 + FG.aptGrade(pet.apt).bonus));
    return g;
  };

  /* 辅战位等级提供的加成比例 */
  FG.supportRatio = slotLv => 0.04 + slotLv * 0.02;   // Lv1=6% ... Lv10=24%
  FG.SUPPORT_SLOT_MAX = 10;

  /* 某只主战宠获得的全部辅战加成 */
  FG.supportBonusFor = function (state) {
    const bonus = { hp: 0, atk: 0, def: 0, spd: 0 };
    state.supportSlots.forEach(slot => {
      if (!slot.petUid) return;
      const p = state.allPets[slot.petUid];
      if (!p || p.hp <= 0) return;
      const b = FG.baseStats(p);
      const r = FG.supportRatio(slot.lv);
      for (const k in bonus) bonus[k] += Math.floor(b[k] * r);
    });
    return bonus;
  };

  /* 刷新宠物最终属性（主战含辅战加成；辅战宠显示自身基础） */
  FG.refreshPet = function (pet, fullHeal) {
    const b = FG.baseStats(pet);
    const old = pet.maxHp || b.hp;
    pet.maxHp = b.hp;
    pet.atk = b.atk; pet.def = b.def; pet.spd = b.spd;
    if (fullHeal) pet.hp = b.hp;
    else pet.hp = Math.max(0, Math.min(pet.hp + (b.hp - old), b.hp));
    /* 习得技能 */
    pet.skills = FG.SPECIES[pet.species].skills
      .filter(([, needLv]) => pet.lv >= needLv)
      .map(([id, , needStar]) => ({ id, unlocked: pet.skillStar >= needStar }));
  };

  /* 主战宠实际战斗属性（叠加辅战位） */
  FG.combatStats = function (state, pet) {
    const b = FG.baseStats(pet);
    const bonus = FG.supportBonusFor(state);
    return {
      maxHp: b.hp + bonus.hp, atk: b.atk + bonus.atk,
      def: b.def + bonus.def, spd: b.spd + bonus.spd
    };
  };

  /* 训练师战力（三只主战的综合，含辅战加成） */
  FG.teamPower = function (state) {
    let power = 0;
    state.mainSlots.forEach(uid => {
      const p = state.allPets[uid];
      if (!p) return;
      const c = FG.combatStats(state, p);
      power += c.maxHp + c.atk * 4 + c.def * 3 + c.spd * 2;
    });
    return power;
  };

  /* ---------- 升星 ---------- */
  FG.starCost = star => ({ shards: star * 3, gold: star * 600 });

  /* ---------- 洗髓 ---------- */
  FG.washCost = star => ({ gold: 300 * star, gem: star >= 3 ? star - 2 : 0 });
  FG.washRange = star => FG.APT.filter(a => a.needStar <= star).map(a => a.g);

  /* 技能星级升级 */
  FG.skillUpCost = skillStar => ({ gold: 800 * skillStar, gem: skillStar });

  /* ---------- 经验与升级 ---------- */
  FG.gainExp = function (pet, amount) {
    const logs = [];
    pet.exp += amount;
    while (pet.lv < 60 && pet.exp >= FG.expNeed(pet.lv)) {
      const cap = FG.STAR_CAP[pet.star];
      if (pet.lv >= cap) { pet.exp = 0; logs.push({ t: 'cap', lv: cap }); break; }
      pet.exp -= FG.expNeed(pet.lv);
      pet.lv++;
      logs.push({ t: 'lv', lv: pet.lv });
      /* 自动进化检查由调用方处理 */
    }
    FG.refreshPet(pet);
    return logs;
  };

  FG.gainTrainerExp = function (state, amount) {
    state.trainer.exp += amount;
    let ups = [];
    while (state.trainer.exp >= FG.trainerExpNeed(state.trainer.lv)) {
      state.trainer.exp -= FG.trainerExpNeed(state.trainer.lv);
      state.trainer.lv++;
      ups.push(state.trainer.lv);
      FG.onTrainerLvUp && FG.onTrainerLvUp(state.trainer.lv);
    }
    return ups;
  };

  /* ---------- 进化 ---------- */
  FG.canEvolve = pet => {
    const target = FG.evolveTarget(pet.species);
    if (!target) return null;
    const needLv = FG.SPECIES[target].q === 'UR' ? 30 : (FG.SPECIES[pet.species].pre ? 34 : 16);
    return pet.lv >= needLv ? { target, needLv } : null;
  };

  FG.evolvePet = function (pet) {
    const ev = FG.canEvolve(pet);
    if (!ev) return null;
    const hpRatio = pet.hp / pet.maxHp;
    pet.species = ev.target;
    FG.refreshPet(pet);
    pet.hp = Math.max(1, Math.floor(pet.maxHp * hpRatio));
    return ev.target;
  };

  /* ---------- 存档 ---------- */
  FG.newGameState = function () {
    return {
      version: 1,
      started: false,
      trainer: { name: '小启', lv: 1, exp: 0 },
      gold: 500, gems: 2,
      items: { ball: 5, greatball: 1, potion: 3, berry: 1 },
      mainSlots: [null, null, null],     // 主战位（始终3个，空位 null）
      activeUid: null,
      supportSlots: [
        { petUid: null, lv: 1 }, { petUid: null, lv: 1 }, { petUid: null, lv: 1 }
      ],
      supportUnlocked: [false, false, false],
      allPets: {},
      box: [],                           // 存放中宠物 uid（不在任何位上）
      eggs: [],                          // {uid, q, steps, total, islandIdx}
      world: { islandIdx: 0, x: 6, y: 6, steps: 0 },
      followCdUntil: 0,
      nodeCooldowns: {},                 // key islandIdx-x-t -> timestamp
      fog: {},                           // islandIdx -> "x,y" set
      defeatedWild: {},                  // uid -> respawnAt（世界生成的野外）
      stats: { caught: 0, battles: 0, evolutions: 0 }
    };
  };

  FG.save = function (state) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  };
  FG.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.version !== 1) return null;
      return s;
    } catch (e) { return null; }
  };
  FG.wipeSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };

  /* 背包增减 */
  FG.addItem = (state, id, n = 1) => {
    if (id === 'gold') { state.gold += n; return; }
    if (id === 'gem') { state.gems += n; return; }
    state.items[id] = (state.items[id] || 0) + n;
  };
  FG.itemCount = (state, id) => {
    if (id === 'gold') return state.gold;
    if (id === 'gem') return state.gems;
    return state.items[id] || 0;
  };
  FG.spendItem = (state, id, n = 1) => {
    if (id === 'gold') { if (state.gold < n) return false; state.gold -= n; return true; }
    if (id === 'gem') { if (state.gems < n) return false; state.gems -= n; return true; }
    if ((state.items[id] || 0) < n) return false;
    state.items[id] -= n;
    return true;
  };

  /* 队伍工具 */
  FG.mainPets = state => state.mainSlots.map(u => (u ? state.allPets[u] : null));
  FG.supportPets = state => state.supportSlots.map(s => (s.petUid ? state.allPets[s.petUid] : null));
  FG.activePet = state => state.allPets[state.activeUid] || null;

  FG.addPetToState = function (state, pet) {
    state.allPets[pet.uid] = pet;
    const emptyMain = state.mainSlots.findIndex(u => !u);
    if (emptyMain !== -1) {
      state.mainSlots[emptyMain] = pet.uid;
      pet.role = 'main';
      if (!state.activeUid) state.activeUid = pet.uid;
    } else {
      state.box.push(pet.uid);
      pet.role = null;
    }
  };

  /* 更换出战跟随（10 秒 CD） */
  FG.FOLLOW_CD = 10000;
  FG.setActive = function (state, uid) {
    if (uid === state.activeUid) return false;
    if (Date.now() < state.followCdUntil) return false;
    state.activeUid = uid;
    state.followCdUntil = Date.now() + FG.FOLLOW_CD;
    return true;
  };
})();
