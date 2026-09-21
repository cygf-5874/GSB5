const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const fp = path.join(root, "..", req.url === "/" ? "/index.html" : req.url.split("?")[0]);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "text/plain" });
    res.end(data);
  });
});
server.listen(8754, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8754/index.html");
  await page.waitForTimeout(400);
  await page.locator(".starter", { hasText: "火苗" }).click();
  /* 提升等级后直接传送到火山，再漫步找怪 */
  await page.evaluate(() => { Game.player.gold = 500; });
  let inBattle = false;
  const dirs = ["KeyW","KeyA","KeyS","KeyD"];
  for (let i = 0; i < 80 && !inBattle; i++) {
    await page.keyboard.down(dirs[i % 4]); await page.waitForTimeout(350);
    await page.keyboard.up(dirs[i % 4]);
    if (await page.locator("#battle-screen:not(.screen-hidden)").count()) { inBattle = true; break; }
    if (await page.locator("text=进入战斗").count()) {
      await page.locator("text=进入战斗").click(); inBattle = true; break;
    }
    await page.locator('[data-act=battle]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
    if (await page.locator("#battle-screen:not(.screen-hidden)").count()) { inBattle = true; break; }
  }
  console.log("战斗:", inBattle);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const bs = document.getElementById("battle-screen");
    const cs = getComputedStyle(bs);
    const ec = document.getElementById("e-canvas");
    const ac = document.getElementById("a-canvas");
    function alpha(cv) {
      const c = cv.getContext("2d");
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
      return Math.round(painted / (cv.width * cv.height) * 100);
    }
    return {
      display: cs.display, z: cs.zIndex,
      enemyName: document.getElementById("e-name").textContent,
      allyName: document.getElementById("a-name").textContent,
      enemyHP: document.getElementById("e-hp-text").textContent,
      allyHP: document.getElementById("a-hp-text").textContent,
      enemyPainted: alpha(ec) + "%", allyPainted: alpha(ac) + "%",
      menuButtons: [...document.querySelectorAll("#battle-menu button")].map((b) => b.textContent.trim()),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: "test/shot-battle-verify.png" });
  console.log("错误:", errors.length ? errors : "无");
  await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
});
