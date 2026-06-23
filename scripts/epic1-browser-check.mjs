import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const WEB = "http://localhost:3003";
const EMAIL = process.argv[2];
const PW = "Test1234!";
const NICK = process.argv[3] || "개발유저";
const OUT = "D:/projects/AIjackdang/scripts/shots";
mkdirSync(OUT, { recursive: true });

const results = [];

async function check(page, name, path, { auth = false } = {}) {
  const errors = [];
  const onErr = (m) => { if (m.type() === "error") errors.push(m.text()); };
  page.on("console", onErr);
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  let status = "?";
  try {
    const resp = await page.goto(WEB + path, { waitUntil: "networkidle", timeout: 30000 });
    status = resp ? resp.status() : "no-resp";
    await page.waitForTimeout(600);
  } catch (e) {
    status = "GOTO_FAIL: " + e.message;
  }
  const finalUrl = page.url().replace(WEB, "");
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  page.off("console", onErr);
  // 실제 콘텐츠 신호: body 텍스트 길이, h1 존재
  const bodyLen = await page.evaluate(() => document.body.innerText.trim().length).catch(() => 0);
  const h1 = await page.evaluate(() => document.querySelector("h1,[role=heading]")?.textContent?.trim() || "").catch(() => "");
  results.push({ name, path, auth, status, finalUrl, bodyLen, h1, errors });
  console.log(`[${name}] status=${status} url=${finalUrl} bodyLen=${bodyLen} h1="${h1}" errors=${errors.length}`);
  if (errors.length) errors.slice(0, 3).forEach((e) => console.log("   ! " + e.slice(0, 160)));
}

const browser = await chromium.launch();

// 1) 비로그인 컨텍스트
const guest = await browser.newContext();
const gp = await guest.newPage();
await check(gp, "01-login", "/login");
await check(gp, "02-signup", "/signup");
await check(gp, "03-forgot-password", "/forgot-password");
await check(gp, "04-reset-password-invalid", "/reset-password?token=invalidtoken123");
await check(gp, "05-public-profile", `/u/${encodeURIComponent(NICK)}`);
await check(gp, "06-mypage-guest-redirect", "/mypage"); // 비로그인 → /login 리다이렉트 기대
await guest.close();

// 2) 로그인 컨텍스트 (프록시로 로그인 → httpOnly 쿠키 컨텍스트에 저장)
const authed = await browser.newContext({ baseURL: WEB });
const loginResp = await authed.request.post("/api/v1/auth/sign-in/email", {
  data: { email: EMAIL, password: PW },
  headers: { "Content-Type": "application/json" },
});
console.log(`\n[login] sign-in status=${loginResp.status()}`);
const ap = await authed.newPage();
await check(ap, "07-mypage", "/mypage", { auth: true });
await check(ap, "08-settings-profile", "/settings/profile", { auth: true });
await check(ap, "09-settings-security", "/settings/security", { auth: true });
await check(ap, "10-settings-account", "/settings/account", { auth: true });
await check(ap, "11-public-profile-self", `/u/${encodeURIComponent(NICK)}`, { auth: true });
await authed.close();

await browser.close();

console.log("\n===== SUMMARY =====");
for (const r of results) {
  const ok = (typeof r.status === "number" && r.status < 400 && r.bodyLen > 30 && r.errors.length === 0);
  console.log(`${ok ? "PASS" : "WARN"}  ${r.name}  status=${r.status}  url=${r.finalUrl}  body=${r.bodyLen}  err=${r.errors.length}`);
}
