const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css" };
const server = http.createServer((req,res)=>{
  const fp = path.join(__dirname, "..", req.url === "/" ? "/index.html" : req.url);
  fs.readFile(fp,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{"Content-Type":types[path.extname(fp)]||"text/plain"});res.end(d); });
});
server.listen(8756, async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1280,height:720} });
  const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8756/index.html");
  await p.evaluate(()=>localStorage.clear());
  await p.reload();
  await p.waitForTimeout(300);
  await p.locator(".starter",{hasText:"水滴"}).count() === 0;
  await p.locator(".starter").first().click();
  await p.waitForTimeout(300);
  await p.locator('[data-act=help]').click();
  await p.waitForTimeout(300);
  const title = await p.locator(".m-head h2").textContent();
  const lines = await p.locator(".help-body").count();
  console.log("帮助弹窗:", title, "内容存在:", lines === 1);
  await p.locator(".m-close").click();
  await p.waitForTimeout(200);
  console.log("关闭后:", await p.locator(".modal-show").count() === 0 ? "已关闭" : "未关闭");
  console.log("错误:", errs.length ? errs : "无");
  await b.close(); server.close(); process.exit(errs.length?1:0);
});
