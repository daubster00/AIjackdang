import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const API = "http://localhost:4003";
const ADMIN = "http://localhost:3004";
const EMAIL = "aijackdang@gmail.com";
const PW = process.env.SUPER_ADMIN_PASSWORD;
const OUT = "D:/projects/AIjackdang/scripts/shots";
mkdirSync(OUT, { recursive: true });

if (!PW) { console.error("SUPER_ADMIN_PASSWORD env 비어있음"); process.exit(1); }

// 1) 관리자 sign-in → Set-Cookie 수집
const resp = await fetch(`${API}/api/v1/admin/auth/sign-in`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PW }),
});
console.log("sign-in status:", resp.status);
const setCookie = resp.headers.getSetCookie?.() ?? [];
console.log("Set-Cookie count:", setCookie.length);
const cookies = setCookie.map((c) => {
  const [pair] = c.split(";");
  const idx = pair.indexOf("=");
  return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim(), domain: "localhost", path: "/" };
}).filter((c) => c.name);
console.log("cookie names:", cookies.map((c) => c.name).join(", "));

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies(cookies);
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(`${ADMIN}/admin-members`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
console.log("URL after load:", page.url().replace(ADMIN, ""));
await page.screenshot({ path: `${OUT}/gm-1-list.png`, fullPage: true });

// 행 메뉴(삼점) 열기 → "역할 변경" 클릭
const menuBtns = await page.locator('[aria-label="관리회원 메뉴"]').count();
console.log("row menu buttons:", menuBtns);

// 모달 래퍼는 5개 모달 타입(승인/반려/정지/재활성/역할변경) 공용 → 어떤 모달이든
// 열어서 가시성을 검증하면 동일한 .modal 래퍼 수정이 증명됨.
// admin:reset 직후엔 마스터(자기자신·active)만 존재 → 역할변경은 !isSelf 게이팅으로 미노출,
// 대신 "정지"가 노출되므로 그 모달로 래퍼 가시성을 검증한다(확정 클릭은 하지 않음).
const MENU_TARGETS = ["역할 변경", "정지", "승인 처리"];
let opened = false;
let openedVia = null;
for (let i = 0; i < menuBtns && !opened; i++) {
  await page.locator('[aria-label="관리회원 메뉴"]').nth(i).click();
  await page.waitForTimeout(250);
  for (const label of MENU_TARGETS) {
    // .action-menu.open 안의 menuitem 만 대상(필터 탭 "정지" 등 오탐 방지)
    const item = page.locator('.action-menu.open [role="menuitem"]', { hasText: label });
    if (await item.count()) {
      await item.first().click();
      opened = true;
      openedVia = label;
      break;
    }
  }
  if (!opened) await page.keyboard.press("Escape").catch(() => {});
}
console.log("모달 오픈 트리거:", openedVia, "| opened:", opened);
await page.waitForTimeout(500);

// 모달 가시성 측정
const modal = page.locator('section.modal[role="dialog"]');
const exists = await modal.count();
let metrics = null;
if (exists) {
  metrics = await modal.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      visibility: cs.visibility,
      display: cs.display,
      hasOpenClass: el.classList.contains("open"),
      rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
      titleText: el.querySelector(".modal-title")?.textContent ?? null,
    };
  });
}
console.log("modal exists:", exists);
console.log("modal metrics:", JSON.stringify(metrics, null, 2));
await page.screenshot({ path: `${OUT}/gm-2-role-modal.png`, fullPage: true });

console.log("console/page errors:", errors.length);
if (errors.length) console.log(errors.slice(0, 10).join("\n"));

// 판정
const pass =
  opened &&
  metrics &&
  metrics.opacity === "1" &&
  metrics.pointerEvents !== "none" &&
  metrics.visibility !== "hidden" &&
  metrics.rect.w > 0 &&
  metrics.rect.h > 0 &&
  metrics.hasOpenClass &&
  !!metrics.titleText;
console.log("\n==== RESULT:", pass ? `PASS ✅ (모달 가시·상호작용 가능 — "${metrics?.titleText}")` : "FAIL ❌", "====");

await browser.close();
process.exit(pass ? 0 : 1);
