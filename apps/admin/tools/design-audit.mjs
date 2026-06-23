// 디자인 자동 검수기 — 눈대중 대신 computed 스타일을 측정해 흔한 디자인 오류를 검출한다.
// 사용: node tools/design-audit.mjs            (기본 라우트 전체)
//      node tools/design-audit.mjs /ranks /members   (특정 라우트만)
// dev 서버(localhost:3004)가 떠 있어야 한다. 위반이 있으면 exit code 1.
//
// 검출 항목(이번에 실제로 터진 유형 중심):
//  1) .card-body/패딩 없는 .card → 내용이 테두리에 붙음
//  2) .card-body 의 좌/상 패딩이 8px 미만 (예: padding:"16px 0")
//  3) .component-stack/.form-grid 의 gap 이 0 (미정의 간격 토큰 의심)
//  4) 가로 오버플로(스크롤)
//  5) 콘솔/페이지 에러, 4xx 리소스
//  6) 항목이 부모 .card 경계에 6px 미만으로 붙음(flush)

import { chromium } from "playwright";

const BASE = "http://localhost:3004";
const DEFAULT_ROUTES = [
  "/dashboard", "/stats", "/posts", "/posts/vibe-guide", "/posts/vibe-guide/p1",
  "/posts/vibe-guide/new", "/posts/vibe-guide/p1/edit",
  "/qna", "/qna/1", "/qna/new", "/qna/1/edit",
  "/resources", "/resources/1", "/resources/new", "/resources/1/edit",
  "/comments", "/comments/1",
  "/reports", "/reports/1", "/messages", "/messages/m1",
  "/members", "/members/ceo.choi%40example.com",
  "/admin-members", "/admin-members/op-1", "/admin-members/grades", "/admin-members/permissions",
  "/points", "/points/tx-1", "/ranks", "/ranks/expert", "/ranks/new",
  "/ads", "/ads/1", "/settings",
];

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;

// 페이지 안에서 실행되는 측정 함수. DOM 을 직접 재서 위반 목록을 만든다.
function auditInPage() {
  const v = [];
  const rect = (el) => el.getBoundingClientRect();
  const cs = (el) => getComputedStyle(el);
  const num = (s) => parseFloat(s) || 0;
  const label = (el) => {
    const cls = (el.className || "").toString().split(" ").slice(0, 2).join(".");
    const txt = (el.textContent || "").trim().slice(0, 24).replace(/\s+/g, " ");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${txt ? ` "${txt}"` : ""}`;
  };

  // 구조상 전폭이라 패딩이 없어도 되는(테이블/탭/필터 등) 직속 자식 클래스
  const STRUCTURAL = ["card-body", "card-header", "card-footer", "table-wrap", "filter-panel", "line-tabs", "pagination", "table-toolbar"];
  const isStructural = (el) => STRUCTURAL.some((c) => el.classList.contains(c));
  // 요소 자체가 내부 패딩을 가졌는지(클래스 무관, computed 측정 — 인라인 padding 도 인정)
  const hasPad = (el) => num(cs(el).paddingLeft) >= 8 && num(cs(el).paddingTop) >= 8;

  // 1)+2) 카드 패딩: 카드 자체 패딩도 없고, 직속 자식이 (구조요소도 아니고 자체 패딩도 없으면) 내용이 테두리에 붙는다.
  document.querySelectorAll(".card").forEach((card) => {
    const hasOwnPad = num(cs(card).paddingLeft) >= 8 && num(cs(card).paddingTop) >= 8;
    if (hasOwnPad) return;
    const kids = [...card.children];
    const okHolder = kids.some((k) => isStructural(k) || hasPad(k));
    if (!okHolder && kids.length) {
      v.push(`[card-no-padding] ${label(card)} — .card 에 .card-body/패딩이 없어 내용이 테두리에 붙음`);
    }
    // .card-body 가 있으면 좌/상 패딩이 충분한지(예: padding:"16px 0" 같은 한 축 0 검출)
    card.querySelectorAll(":scope > .card-body").forEach((body) => {
      const pl = num(cs(body).paddingLeft), pt = num(cs(body).paddingTop);
      if (pl < 8 || pt < 8) v.push(`[card-body-thin-padding] ${label(card)} — .card-body 패딩 부족 (L:${pl} T:${pt})`);
    });
  });

  // 3) stack/grid gap 0
  document.querySelectorAll(".component-stack, .form-grid").forEach((el) => {
    if (el.children.length < 2) return;
    const g = cs(el);
    const rg = g.rowGap === "normal" ? "0px" : g.rowGap;
    if (num(rg) === 0) v.push(`[zero-gap] ${label(el)} — ${el.classList.contains("form-grid") ? "form-grid" : "component-stack"} 의 간격(gap)이 0 (미정의 토큰 의심)`);
  });

  // 6) 카드 경계에 붙은 콘텐츠: 직속 자식이 구조요소도 아니고 자체 패딩도 없는데 카드 테두리에 붙으면 위반.
  document.querySelectorAll(".card").forEach((card) => {
    if (num(cs(card).paddingLeft) >= 8 && num(cs(card).paddingTop) >= 8) return; // 카드 자체 패딩 있으면 OK
    const cr = rect(card);
    for (const child of card.children) {
      if (isStructural(child) || hasPad(child)) continue; // 전폭 구조요소/자체 패딩 보유 → 정상
      const ch = rect(child);
      if (ch.width === 0 || ch.height === 0) continue;
      const gapL = ch.left - cr.left, gapT = ch.top - cr.top;
      if (gapL < 6 || gapT < 6) {
        v.push(`[flush-to-border] ${label(card)} > ${label(child)} — 카드 테두리에 붙음 (L:${Math.round(gapL)} T:${Math.round(gapT)})`);
        break;
      }
    }
  });

  // 4) 가로 오버플로
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 2) v.push(`[h-overflow] 가로 스크롤 발생 (scrollW ${de.scrollWidth} > clientW ${de.clientWidth})`);

  return v;
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let total = 0;
const report = [];

for (const route of routes) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 120)));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("localhost:3004") && !r.url().includes("favicon")) errs.push(`http ${r.status()}: ${r.url().replace(BASE, "")}`); });
  let viols = [];
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (resp && resp.status() >= 400) errs.push(`page http ${resp.status()}`);
    await page.waitForTimeout(1200);
    viols = await page.evaluate(auditInPage);
  } catch (e) {
    viols = [`[load-failed] ${String(e).slice(0, 120)}`];
  }
  const all = [...viols, ...errs.filter((e) => !e.includes("status of 404"))];
  total += all.length;
  report.push({ route, count: all.length, issues: all });
  console.log(`${all.length === 0 ? "✓" : "✗ " + all.length} ${route}`);
  all.forEach((i) => console.log("    - " + i));
  await page.close();
}

await browser.close();
console.log(`\n=== 총 위반 ${total}건 / ${routes.length}개 페이지 ===`);
process.exit(total > 0 ? 1 : 0);
