/**
 * 크롤러/봇 판별 유틸 — 조회수 집계 제외용.
 *
 * 검색엔진 크롤러(구글봇·네이버 예티·빙봇 등)와 SNS 링크 미리보기 봇,
 * 각종 스크래퍼는 User-Agent 로 식별해 조회수 집계에서 제외한다.
 * (요즘 크롤러는 JS를 실행해 클라이언트 조회 비콘까지 발화시키므로 서버에서 걸러야 한다.)
 *
 * 완벽한 차단은 불가능하지만(UA 위조 가능), 실 트래픽의 대부분을 차지하는
 * 정직하게 UA를 밝히는 크롤러는 이 목록으로 걸러진다.
 */

/**
 * 흔한 크롤러/봇 UA 토큰(소문자). 부분 문자열 매칭.
 * - 검색엔진: googlebot, bingbot, yeti(naver), daum, yandex, baiduspider, duckduckbot, applebot
 * - SNS 미리보기: facebookexternalhit, facebot, twitterbot, slackbot, telegrambot,
 *                 whatsapp, discordbot, linkedinbot, kakaotalk-scrap, embedly, skypeuripreview
 * - SEO/스크래퍼: ahrefsbot, semrushbot, mj12bot, dotbot, petalbot, bytespider
 * - 일반 도구: python-requests, curl, wget, go-http-client, headless, phantomjs, scrapy
 */
const BOT_UA_TOKENS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "yeti",
  "daum",
  "yandex",
  "baiduspider",
  "duckduckbot",
  "applebot",
  "facebookexternalhit",
  "facebot",
  "whatsapp",
  "embedly",
  "skypeuripreview",
  "kakaotalk-scrap",
  "petalbot",
  "bytespider",
  "python-requests",
  "python-httpx",
  "curl/",
  "wget",
  "go-http-client",
  "node-fetch",
  "axios",
  "headless",
  "phantomjs",
  "scrapy",
  "http.rb",
  "okhttp",
  "libwww-perl",
];

/**
 * User-Agent 문자열이 크롤러/봇으로 판단되면 true.
 * UA가 비어 있는 경우(정상 브라우저는 항상 UA를 보냄)도 봇으로 간주한다.
 */
export function isCrawlerUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return BOT_UA_TOKENS.some((token) => ua.includes(token));
}
