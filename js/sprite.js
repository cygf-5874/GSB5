/* ================= sprite.js ：程序化绘制幻兽 / 训练师 / 图标 ================= */
"use strict";

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return "rgb(" + r + "," + g + "," + b + ")";
}

/* 在 canvas 上绘制幻兽。canvas 任意尺寸，以中心为基准 */
function drawMon(canvas, sp, opts) {
  opts = opts || {};
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const s = SPECIES[sp];
  const bob = opts.bobY || 0;
  const scale = (W / 120) * (s.size || 1) * (opts.scale || 1);
  ctx.save();
  ctx.translate(W / 2, H / 2 + bob);
  ctx.scale(scale, scale);

  /* 地面阴影 */
  if (opts.shadow !== false) {
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(0, 42, 34, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = s.c1;
  ctx.strokeStyle = shade(s.c1, 0.62);
  ctx.lineWidth = 3;
  const shape = s.shape;

  /* ===== 身体 ===== */
  if (shape === "blob") {
    rr(ctx, -28, -24, 56, 50, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.25)";
    circle(ctx, -12, -12, 7);
  } else if (shape === "bird") {
    circle(ctx, 0, 4, 30);                      // 身体
    ctx.beginPath();
    ctx.ellipse(-24, 8, 16, 10, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // 左翼
    ctx.beginPath();
    ctx.ellipse(24, 8, 16, 10, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();  // 右翼
    circle(ctx, 0, -18, 20);                    // 头
    ctx.fillStyle = "#ff9f43";
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(14, -14); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (shape === "beast") {
    circle(ctx, 0, 6, 32);
    rr(ctx, -8, 30, 16, 12, 5); ctx.fill(); ctx.stroke();   // 脚
    circle(ctx, 0, -20, 23);                                // 头
    ctx.beginPath(); ctx.arc(20, 20, 10, -0.6, 1.2); ctx.lineWidth = 7; ctx.stroke(); ctx.lineWidth = 3; // 尾
  } else if (shape === "reptile") {
    rr(ctx, -30, -18, 60, 42, 18); ctx.fill(); ctx.stroke();
    circle(ctx, 18, -16, 19);
    ctx.fillStyle = s.ac;
    rr(ctx, -26, 6, 20, 14, 7); ctx.fill();                 // 腹甲
  } else if (shape === "bug") {
    circle(ctx, 0, 6, 28);
    circle(ctx, 0, -18, 17);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    circle(ctx, -20, 2, 10); circle(ctx, 20, 2, 10);
  } else if (shape === "sprite") {
    ctx.save();
    ctx.globalAlpha = 0.95;
    circle(ctx, 0, 0, 29);
    ctx.fillStyle = "rgba(255,255,255,.3)";
    circle(ctx, -10, -10, 9);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-16, 24); ctx.quadraticCurveTo(0, 40, 16, 24); ctx.lineWidth = 5; ctx.strokeStyle = s.c2; ctx.stroke();
  } else if (shape === "fish") {
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(-46, -14); ctx.lineTo(-46, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = s.ac;
    circle(ctx, 10, -4, 6);
  } else if (shape === "dragon") {
    rr(ctx, -32, -10, 62, 42, 20); ctx.fill(); ctx.stroke();  // 躯干
    circle(ctx, 20, -20, 22);                                  // 头
    rr(ctx, -20, 24, 14, 14, 5); ctx.fill(); ctx.stroke();
    rr(ctx, 14, 24, 14, 14, 5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-32, 0); ctx.quadraticCurveTo(-56, -6, -50, -26); ctx.lineWidth = 8; ctx.stroke(); ctx.lineWidth = 3;
  }
  ctx.restore();

  /* 特征装饰 + 眼睛（在另一层，不受上面 restore 影响） */
  drawFeature(ctx, W, H, scale, s, bob, opts);
}

function drawFeature(ctx, W, H, scale, s, bob, opts) {
  ctx.save();
  ctx.translate(W / 2, H / 2 + bob);
  ctx.scale(scale, scale);
  ctx.strokeStyle = shade(s.c1, 0.55);
  ctx.lineWidth = 3;
  ctx.fillStyle = s.ac;
  const f = s.feature;
  if (f === "horn") {
    ctx.beginPath(); ctx.moveTo(26, -34); ctx.lineTo(32, -52); ctx.lineTo(38, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -38); ctx.lineTo(10, -54); ctx.lineTo(18, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (f === "fin") {
    ctx.beginPath(); ctx.moveTo(-4, -28); ctx.quadraticCurveTo(2, -50, 12, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (f === "ears") {
    ctx.beginPath(); ctx.moveTo(-16, -34); ctx.lineTo(-10, -52); ctx.lineTo(-2, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -34); ctx.lineTo(10, -52); ctx.lineTo(16, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (f === "spikes") {
    for (const x of [-16, 0, 16]) {
      ctx.beginPath(); ctx.moveTo(x - 6, -24); ctx.lineTo(x, -40); ctx.lineTo(x + 6, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (f === "halo") {
    ctx.strokeStyle = "#f9e79f"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, -40, 16, 6, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (f === "flame") {
    ctx.fillStyle = "#ffb74d";
    ctx.beginPath();
    ctx.moveTo(0, -40); ctx.quadraticCurveTo(-10, -52, -2, -62);
    ctx.quadraticCurveTo(6, -54, 2, -46);
    ctx.quadraticCurveTo(12, -52, 10, -38); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (f === "shell") {
    ctx.strokeStyle = shade(s.c2, 0.9); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -4, 20, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath(); ctx.moveTo(0, 20);
      ctx.quadraticCurveTo(Math.sin(a) * 14, -2, Math.sin(a * 1.4) * 20, -22 + Math.cos(a) * 6);
      ctx.stroke();
    }
  }

  /* 眼睛 */
  const ex = s.shape === "fish" ? 18 : (s.shape === "reptile" || s.shape === "dragon") ? 22 : 8;
  ctx.fillStyle = "#fff";
  circle(ctx, -ex, -12 - (s.shape === "sprite" ? 6 : 0), 6.5);
  circle(ctx, ex, -12 - (s.shape === "sprite" ? 6 : 0), 6.5);
  ctx.fillStyle = "#263238";
  circle(ctx, -ex + 1.5, -11 - (s.shape === "sprite" ? 6 : 0), 3.4);
  circle(ctx, ex + 1.5, -11 - (s.shape === "sprite" ? 6 : 0), 3.4);
  ctx.fillStyle = "#fff";
  circle(ctx, -ex + 0.5, -12.5 - (s.shape === "sprite" ? 6 : 0), 1.2);
  circle(ctx, ex + 0.5, -12.5 - (s.shape === "sprite" ? 6 : 0), 1.2);

  /* 腮红（非神/魔） */
  if (s.ele !== "god" && s.ele !== "demon" && s.shape !== "dragon") {
    ctx.fillStyle = "rgba(255,120,130,.35)";
    circle(ctx, -ex - 10, -4, 4); circle(ctx, ex + 10, -4, 4);
  }

  /* 属性徽记 */
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = ELEMENTS[s.ele].color;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 30, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ELEMENTS[s.ele].name, 0, 31);

  /* 星级（右上角小星） */
  if (opts.stars) {
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "#e67e22"; ctx.lineWidth = 1.5;
    drawStar(ctx, 30, -38, 5, 7, 3.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(opts.stars, 30, -37);
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, points, rOut, rIn) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* 训练师头像 */
function drawTrainer(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = "#ffe8b3"; circle(ctx, W / 2, W / 2, W / 2 - 1);
  /* 帽子 */
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath(); ctx.arc(W / 2, W * 0.42, W * 0.26, Math.PI, 0); ctx.fill();
  rr(ctx, W * 0.2, W * 0.4, W * 0.6, W * 0.09, 4); ctx.fill();
  ctx.fillStyle = "#fff"; rr(ctx, W * 0.42, W * 0.36, W * 0.16, W * 0.06, 3); ctx.fill();
  /* 脸 */
  ctx.fillStyle = "#ffe0bd"; circle(ctx, W / 2, W * 0.52, W * 0.2);
  /* 眼睛 */
  ctx.fillStyle = "#3b2f2f"; circle(ctx, W * 0.44, W * 0.52, 1.8); circle(ctx, W * 0.56, W * 0.52, 1.8);
  ctx.strokeStyle = "#b9530c"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(W / 2, W * 0.57, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  /* 身体 */
  ctx.fillStyle = "#3e8ef7";
  rr(ctx, W * 0.26, W * 0.72, W * 0.48, W * 0.3, 10); ctx.fill();
}

/* 世界地图中的小幻兽（带轻微浮动） */
function drawMonSmall(ctx, sp, cx, cy, t) {
  const bob = Math.sin(t / 350 + cx * 0.05) * 2.5;
  ctx.save();
  ctx.translate(cx, cy + bob);
  const s = SPECIES[sp];
  const r = 13 * (s.size || 1);
  /* 圈底 */
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.beginPath(); ctx.ellipse(0, r - 1, r + 3, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = s.c1;
  ctx.strokeStyle = shade(s.c1, 0.6); ctx.lineWidth = 2;
  const sh = s.shape;
  if (sh === "bird" || sh === "bug") {
    circle(ctx, 0, -2, r * 0.85);
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, 2, r * 0.4, r * 0.28, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.7, 2, r * 0.4, r * 0.28, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (sh === "dragon") {
    rr(ctx, -r, -r * 0.6, r * 1.8, r * 1.2, 7); ctx.fill(); ctx.stroke();
  } else {
    rr(ctx, -r * 0.85, -r * 0.8, r * 1.7, r * 1.55, r * 0.7); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  circle(ctx, -r * 0.28, -r * 0.25, 2.6); circle(ctx, r * 0.28, -r * 0.25, 2.6);
  ctx.fillStyle = "#263238";
  circle(ctx, -r * 0.28, -r * 0.2, 1.4); circle(ctx, r * 0.28, -r * 0.2, 1.4);
  ctx.fillStyle = ELEMENTS[s.ele].color;
  circle(ctx, 0, r * 0.42, 4.2);
  ctx.restore();
}

/* 幻兽蛋 */
function drawEgg(ctx, cx, cy, t) {
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t / 400) * 2);
  ctx.fillStyle = "rgba(0,0,0,.15)";
  ctx.beginPath(); ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fdfdfd";
  ctx.strokeStyle = "#c9d6e3"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.bezierCurveTo(12, -15, 12, 6, 0, 15);
  ctx.bezierCurveTo(-12, 6, -12, -15, 0, -15);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a29bfe";
  ctx.beginPath(); ctx.ellipse(-4, -2, 3, 5, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, 3, 2.4, 4, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 9, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* 资源点图标 */
function drawResource(ctx, kind, cx, cy, t) {
  ctx.save();
  ctx.translate(cx, cy);
  const pulse = 1 + Math.sin(t / 300) * 0.06;
  ctx.scale(pulse, pulse);
  if (kind === "coin") {
    ctx.fillStyle = "#f1c40f"; ctx.strokeStyle = "#b7950b"; ctx.lineWidth = 2;
    circle(ctx, 0, 4, 9); ctx.stroke();
    ctx.fillStyle = "#f9e154"; circle(ctx, -2, 2, 3);
  } else if (kind === "herb") {
    ctx.strokeStyle = "#27ae60"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(0, -2, 0, -12); ctx.stroke();
    ctx.fillStyle = "#58d68d";
    for (const [a, dy] of [[-1, -4], [1, -8], [-1, -12]]) {
      ctx.save(); ctx.translate(0, dy); ctx.rotate(a * 0.7);
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (kind === "crystal") {
    ctx.fillStyle = "#85c1e9"; ctx.strokeStyle = "#2e86c1"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, -2); ctx.lineTo(4, 11); ctx.lineTo(-4, 11); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(2, -8); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  } else if (kind === "ball") {
    ctx.fillStyle = "#e74c3c"; ctx.strokeStyle = "#922b21"; ctx.lineWidth = 2;
    circle(ctx, 0, 0, 10);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/* NPC 小人 */
function drawNPC(ctx, npc, cx, cy, t) {
  const col = NPCS[npc].color;
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t / 500 + cx) * 1.5);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath(); ctx.ellipse(0, 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  rr(ctx, -8, -2, 16, 16, 6); ctx.fill();
  ctx.fillStyle = "#ffe0bd"; circle(ctx, 0, -9, 7);
  ctx.fillStyle = shade(col, 0.75);
  ctx.beginPath(); ctx.arc(0, -11, 7, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#3b2f2f"; circle(ctx, -2.5, -9, 1.2); circle(ctx, 2.5, -9, 1.2);
  ctx.restore();
}

/* 岛屿缩略图 */
function drawIslandThumb(canvas, island) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = island.theme.water; rr(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.fillStyle = island.theme.grass;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, W * 0.38, H * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = island.theme.sand;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, W * 0.38, H * 0.42, 0, 0, Math.PI * 2);
  ctx.lineWidth = 7; ctx.strokeStyle = island.theme.sand; ctx.stroke();
  ctx.fillStyle = island.theme.grass;
  ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.32, H * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = i * 1.3, r = W * 0.2 + (i % 3) * 8;
    ctx.fillStyle = island.theme.tree;
    circle(ctx, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.8, 5);
  }
}
