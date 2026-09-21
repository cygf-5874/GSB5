const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fp = path.join(root, "..", url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "text/plain" });
    res.end(data);
  });
});
server.listen(8753, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto("http://localhost:8753/index.html");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test/shot-1-starter.png" });

  /* 选初始幻兽：火苗 */
  const starterTitle = await page.locator(".m-head h2").textContent();
  console.log("弹窗标题:", starterTitle);
  await page.locator(".starter", { hasText: "火苗" }).click();
  await page.waitForTimeout(400);
  console.log("HUD 等级:", await page.locator("#t-lv").textContent());
  const slots = await page.locator("#party-slots .slot").count();
  console.log("主战格数:", slots);
  await page.screenshot({ path: "test/shot-2-world.png" });

  /* 移动几秒，在岛上转 */
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyS");
  }
  await page.waitForTimeout(300);
  console.log("步数:", await page.locator("#t-steps").textContent());
  await page.screenshot({ path: "test/shot-3-moved.png" });

  /* 打开背包 */
  await page.locator('[data-act=bag]').click();
  await page.waitForTimeout(300);
  const cells = await page.locator(".cell").count();
  console.log("幻兽格子数:", cells);
  await page.screenshot({ path: "test/shot-4-bag.png" });
  /* 查看详情 */
  await page.locator("[data-detail]").first().click();
  await page.waitForTimeout(300);
  const detailText = await page.locator(".detail-grid").textContent();
  console.log("详情片段:", detailText.replace(/\s+/g, " ").trim().slice(0, 120));
  await page.screenshot({ path: "test/shot-5-detail.png" });
  await page.locator(".m-close").click();

  /* 地图 */
  await page.locator('[data-act=map]').click();
  await page.waitForTimeout(300);
  const cards = await page.locator(".island-card").count();
  console.log("地图岛屿数:", cards);
  await page.screenshot({ path: "test/shot-6-map.png" });
  await page.locator(".m-close").click();

  /* 走到野怪附近并通过快捷战斗按钮触发战斗：尝试点击战斗按钮若干次直到战斗画面出现 */
  /* 随机漫步直到野怪遭遇弹窗或战斗出现 */
  let inBattle = false;
  const dirs = ["KeyW","KeyA","KeyS","KeyD"];
  for (let i = 0; i < 60; i++) {
    const d = dirs[i % 4];
    await page.keyboard.down(d);
    await page.waitForTimeout(450);
    await page.keyboard.up(d);
    if (await page.locator("#battle-screen:not(.screen-hidden)").count()) { inBattle = true; break; }
    /* 若遭遇弹窗弹出，点进入战斗 */
    const fight = page.locator("text=进入战斗");
    if (await fight.count()) { await fight.click(); await page.waitForTimeout(500); inBattle = true; break; }
    /* 附近有怪时用快捷战斗按钮 */
    await page.locator('[data-act=battle]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    if (await page.locator("#battle-screen:not(.screen-hidden)").count()) { inBattle = true; break; }
    if (await page.locator("text=进入战斗").count()) {
      await page.locator("text=进入战斗").click(); await page.waitForTimeout(500); inBattle = true; break;
    }
  }
  console.log("进入战斗:", inBattle);
  if (inBattle) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test/shot-7-battle.png" });
    /* 使用技能直到战斗结束 */
    for (let r = 0; r < 12; r++) {
      const skill = page.locator('[data-bm=skill]');
      if (await skill.count()) { await skill.click(); await page.waitForTimeout(200); }
      const sk = page.locator(".sk-btn").first();
      if (await sk.count()) { await sk.click(); }
      await page.waitForTimeout(1600);
      const still = await page.locator("#battle-screen:not(.screen-hidden)").count();
      if (!still) break;
      /* 可能出现换兽/弹窗（不会），继续 */
    }
    await page.waitForTimeout(800);
    console.log("战斗结束等级:", await page.locator("#t-lv").textContent());
    await page.screenshot({ path: "test/shot-8-afterbattle.png" });
  }

  console.log("页面错误:", errors.length ? errors : "无");
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
});
