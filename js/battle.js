/* ================= 战斗系统 ================= */
(function () {
  const FG = window.FG;
  const B = FG.Battle = {};

  B.active = null;   // 当前战斗对象

  /* 开启与野生幻兽的战斗 */
  B.startWild = function (state, worldWild) {
    const enemyPet = worldWild.pet;
    const main = FG.mainPets(state).filter(p => p && p.hp > 0);
    if (!main.length) return { error: 'no-pet' };
    const active = FG.activePet(state);
    const playerPet = active && active.hp > 0 ? active : main[0];
    state.activeUid = playerPet.uid;

    B.active = {
      type: 'wild',
      worldWild,
      enemy: makeSide(enemyPet, null),
      player: makeSide(playerPet, state),
      playerUid: playerPet.uid,
      berryBonus: 0,
      over: false,
      logs: [],
      busy: false,
      round: 0
    };
    state.stats.battles++;
    log('sys', `遭遇了野生的 ${qname(enemyPet)} Lv.${enemyPet.lv}！`);
    log('sys', hint(enemyPet, playerPet));
    return B.active;
  };

  function makeSide(pet, state) {
    const cs = state ? FG.combatStats(state, pet) : null;
    return {
      uid: pet.uid, species: pet.species, lv: pet.lv, star: pet.star,
      hp: pet.hp, maxHp: cs ? cs.maxHp : pet.maxHp,
      atk: cs ? cs.atk : pet.atk, def: cs ? cs.def : pet.def, spd: cs ? cs.spd : pet.spd,
      buffs: {}
    };
  }

  function log(cls, text) {
    B.active.logs.push({ cls, text });
    if (B.active.logs.length > 40) B.active.logs.shift();
  }
  B.log = log;
  function qname(pet) {
    const sp = FG.SPECIES[pet.species];
    return `[${sp.q}] ${FG.EL_INFO[sp.el].icon}${sp.name}`;
  }
  function hint(enemy, pet) {
    const aEl = FG.SPECIES[pet.species].el, dEl = FG.SPECIES[enemy.species].el;
    const m = FG.counterMult(aEl, dEl);
    if (m > 1) return '你的幻兽克制对手，战斗中伤害 +10%！';
    if (FG.counterMult(dEl, aEl) > 1) return '属性不利，小心应对，也可以尝试直接捕捉。';
    return '双方属性互不相克，放手一战吧！';
  }

  function sideHpRatio(side) { return side.hp / side.maxHp; }

  /* 计算一次技能伤害 */
  function calcDamage(attacker, defender, skill) {
    const aEl = skill.el === 'none' ? FG.SPECIES[attacker.species].el : skill.el;
    const dEl = FG.SPECIES[defender.species].el;
    const mult = FG.counterMult(aEl, dEl);
    const atkBuff = attacker.buffs.atk ? 1 + attacker.buffs.atk.pct : 1;
    const defBuff = defender.buffs.def ? 1 + defender.buffs.def.pct : 1;
    let dmg = skill.pwr + attacker.atk * 1.5 - defender.def * 1.1 * defBuff;
    dmg *= attacker.lv / (defender.lv * 0.8 + 2) * 0.9 + 0.55;
    dmg *= mult * atkBuff;
    dmg *= FG.rand(0.9, 1.1);
    return { dmg: Math.max(3, Math.round(dmg)), counter: mult > 1 };
  }

  function skillList(pet) {
    return pet.skills.filter(s => s.unlocked).map(s => s.id);
  }

  /* 玩家使用技能 */
  B.playerSkill = function (state, skillId) {
    const b = B.active;
    if (b.busy || b.over) return;
    const pet = state.allPets[b.playerUid];
    const skill = FG.SKILLS[skillId];
    b.busy = true;

    /* 治疗/Buff 技能 */
    if (skill.heal) {
      const heal = Math.round(b.player.maxHp * 0.32);
      b.player.hp = Math.min(b.player.maxHp, b.player.hp + heal);
      log('heal', `${FG.SPECIES[pet.species].name} 使用了 ${skill.icon}${skill.name}，恢复 ${heal} 点生命。`);
    } else if (skill.buff) {
      b.player.buffs[skill.buff] = { pct: skill.pct, turns: skill.turns };
      log('sys', `${FG.SPECIES[pet.species].name} 使用了 ${skill.icon}${skill.name}，防御提升！`);
    } else {
      const r = calcDamage(b.player, b.enemy, skill);
      b.enemy.hp = Math.max(0, b.enemy.hp - r.dmg);
      log('hit', `${FG.SPECIES[pet.species].name} 使用 ${skill.icon}${skill.name}，造成 ${r.dmg} 点伤害。` +
        (r.counter ? '（克制 +10%）' : ''));
    }

    if (b.enemy.hp <= 0) { syncAndEnd(state, true); return; }
    enemyTurn(state);
  };

  function enemyTurn(state) {
    const b = B.active;
    setTimeout(() => {
      const enemyPet = b.worldWild.pet;
      const ids = skillList(enemyPet).filter(id => !FG.SKILLS[id].heal);
      const dmgIds = ids.length ? ids : ['tackle'];
      const skill = FG.SKILLS[FG.choice(dmgIds)];
      const r = calcDamage(b.enemy, b.player, skill);
      b.player.hp = Math.max(0, b.player.hp - r.dmg);
      log('hit', `野生 ${FG.SPECIES[enemyPet.species].name} 使用 ${skill.icon}${skill.name}，造成 ${r.dmg} 点伤害。` +
        (r.counter ? '（克制 +10%）' : ''));
      tickBuffs(b.player); tickBuffs(b.enemy);
      b.round++;
      b.berryBonus = 0;
      syncSides(state);
      b.busy = false;
      if (b.player.hp <= 0) endBattle(state, false);
      B.onChange && B.onChange();
    }, 550);
  }

  function tickBuffs(side) {
    for (const k in side.buffs) {
      side.buffs[k].turns--;
      if (side.buffs[k].turns <= 0) delete side.buffs[k];
    }
  }

  function syncSides(state) {
    const p = state.allPets[B.active.playerUid];
    if (p) {
      p.hp = B.active.player.hp;
      const cs = FG.combatStats(state, p);
      B.active.player.maxHp = cs.maxHp;
      B.active.player.atk = cs.atk;
      B.active.player.def = cs.def;
      B.active.player.spd = cs.spd;
    }
    B.active.worldWild.pet.hp = B.active.enemy.hp;
  }

  function syncAndEnd(state, win) {
    syncSides(state);
    setTimeout(() => endBattle(state, win), 600);
  }

  /* ---------- 捕捉 ---------- */
  B.catchChance = function (state, ballId) {
    const b = B.active;
    if (!b) return 0;
    const item = FG.ITEMS[ballId];
    if (ballId === 'masterball') return 1;
    const q = FG.QUALITY[FG.SPECIES[b.enemy.species].q];
    const base = 0.92 - (q.mult - 1) * 1.4;                 // 品质越高越难
    const lowHp = 1.45 - sideHpRatio(b.enemy) * 0.85;       // 残血更易
    const starPenalty = 1 - (b.enemy.star - 1) * 0.05;
    let chance = base * lowHp * starPenalty * item.mult;
    chance *= 1 + b.berryBonus;
    return FG.clamp(chance, 0.03, 0.95);
  };

  B.tryCatch = function (state, ballId) {
    const b = B.active;
    if (b.busy || b.over) return;
    if (!FG.spendItem(state, ballId, 1)) { log('sys', '没有这种精灵球了！'); return; }
    b.busy = true;
    const chance = B.catchChance(state, ballId);
    log('cap', `投出了 ${FG.ITEMS[ballId].icon}${FG.ITEMS[ballId].name}！（成功率 ${Math.round(chance * 100)}%）`);
    setTimeout(() => {
      if (Math.random() < chance) {
        catchSuccess(state);
      } else {
        log('bad', '精灵球剧烈晃动后…幻兽挣脱了出来！');
        syncSides(state);
        b.busy = false;
        B.onChange && B.onChange();
        enemyTurn(state);
      }
      B.onChange && B.onChange();
    }, 900);
  };

  function catchSuccess(state) {
    const b = B.active;
    b.over = true;
    const w = b.worldWild;
    const pet = w.pet;
    pet.hp = Math.max(1, Math.round(pet.maxHp * 0.5));
    let location = null;
    const emptyMain = state.mainSlots.findIndex(u => !u);
    if (emptyMain !== -1) {
      state.mainSlots[emptyMain] = pet.uid; pet.role = 'main'; location = '主战位';
      if (!state.activeUid) state.activeUid = pet.uid;
    } else {
      state.box.push(pet.uid); pet.role = null; location = '幻兽仓库';
    }
    if (!state.allPets[pet.uid]) state.allPets[pet.uid] = pet;
    state.stats.caught++;
    w.caught = true;
    FG.world.scheduleRespawn(state, w);
    log('cap', `🎉 成功捕捉了 ${qname(pet)}！已放入${location}。`);
    B.result = { win: true, caught: pet };
    syncSides(state);
    B.busy = false;
    B.onChange && B.onChange();
    B.onEnd && B.onEnd(B.result);
  }

  B.useBerry = function (state) {
    const b = B.active;
    if (b.busy || b.over) return;
    if (!FG.spendItem(state, 'berry', 1)) { log('sys', '没有诱兽果了！'); return; }
    b.berryBonus += 0.25;
    log('cap', '投出诱兽果！野生幻兽放松了警惕，本次捕捉成功率 +25%。');
    B.onChange && B.onChange();
  };

  /* 药剂 */
  B.usePotion = function (state, itemId) {
    const b = B.active;
    if (b.busy || b.over) return;
    if (!FG.spendItem(state, itemId, 1)) return;
    const heal = FG.ITEMS[itemId].heal;
    b.player.hp = Math.min(b.player.maxHp, b.player.hp + heal);
    log('heal', `使用 ${FG.ITEMS[itemId].icon}${FG.ITEMS[itemId].name}，恢复 ${heal} 点生命。`);
    b.busy = true;
    enemyTurn(state);
  };

  /* 切换主战 */
  B.switchPet = function (state, uid) {
    const b = B.active;
    if (b.busy || b.over || uid === b.playerUid) return;
    const pet = state.allPets[uid];
    if (!pet || pet.role !== 'main' || pet.hp <= 0) return;
    b.playerUid = uid;
    state.activeUid = uid;
    b.player = makeSide(pet, state);
    log('sys', `换上了 ${FG.SPECIES[pet.species].name}！`);
    b.busy = true;
    enemyTurn(state);
  };

  B.flee = function (state) {
    const b = B.active;
    if (b.busy || b.over) return;
    if (Math.random() < 0.7) {
      log('sys', '成功脱离了战斗！');
      endBattle(state, null);
    } else {
      log('sys', '逃跑失败！');
      b.busy = true;
      enemyTurn(state);
    }
  };

  function endBattle(state, win) {
    const b = B.active;
    b.over = true;
    b.busy = false;
    syncSides(state);
    if (win === true) {
      const w = b.worldWild;
      w.defeated = true;
      FG.world.scheduleRespawn(state, w);
      grantRewards(state, w.pet);
      B.result = { win: true };
    } else if (win === false) {
      log('sys', '出战幻兽倒下了…被护士铃音救回了营地。');
      B.result = { win: false };
    } else {
      B.active.worldWild.pet.hp = B.active.worldWild.pet.maxHp;
      B.result = { fled: true };
    }
    B.onChange && B.onChange();
    B.onEnd && B.onEnd(B.result);
  }
  B.end = () => { B.active = null; B.result = null; B.onEnd = null; B.onChange = null; };

  function grantRewards(state, enemyPet) {
    const q = FG.QUALITY[FG.SPECIES[enemyPet.species].q];
    const gold = Math.round(enemyPet.lv * 6 * q.mult * FG.rand(0.85, 1.15));
    const petExp = Math.round(22 * q.exp / 8 * enemyPet.lv / 3 + 14);
    const trainerExp = Math.round(10 + enemyPet.lv * 2.4 * q.mult);
    state.gold += gold;
    log('sys', `战斗胜利！获得 💰${gold} 金币。`);
    const p = state.allPets[B.active.playerUid];
    if (p) {
      const logs = FG.gainExp(p, petExp);
      log('sys', `${FG.SPECIES[p.species].name} 获得 ${petExp} 经验。`);
      logs.forEach(l => {
        if (l.t === 'lv') log('heal', `✨ 等级提升至 Lv.${l.lv}！`);
        if (l.t === 'cap') log('sys', `已达到 ${l.lv} 级星级上限，升星后可继续成长。`);
      });
      const ev = FG.canEvolve(p);
      if (ev) {
        const old = p.species;
        FG.evolvePet(p);
        state.stats.evolutions++;
        log('cap', `🌟 ${FG.SPECIES[old].name} 进化为 ${FG.SPECIES[p.species].name}！`);
      }
    }
    const ups = FG.gainTrainerExp(state, trainerExp);
    ups.forEach(lv => log('cap', `🎓 训练师等级提升至 Lv.${lv}！`));
    if (Math.random() < FG.DROP_SHARD_CHANCE) {
      const sid = FG.shardId(FG.SPECIES[enemyPet.species].q);
      FG.addItem(state, sid, 1);
      log('sys', `掉落了 ${FG.ITEMS[sid].icon}${FG.ITEMS[sid].name} ×1。`);
    }
  }

  /* 战败送回营地并治疗 */
  B.gameOverRecover = function (state) {
    FG.mainPets(state).forEach(p => { if (p) { p.hp = Math.max(1, Math.round(p.maxHp * 0.5)); } });
    FG.world.enterIsland(state, state.world.islandIdx, false);
  };
})();
