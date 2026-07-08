/**
 * USD→KRW 환율 조회·캐시 헬퍼 — 한국수출입은행(KOREAEXIM) 환율 API 연동.
 *
 * 목적: 관리자 페이지의 모든 달러(USD) 금액을 원화(KRW)로 환산해 표기하기 위한
 *       "오늘자 매매기준율(deal_bas_r)"을 확보한다.
 *
 * 저장 위치: bot_settings 테이블의 key = "usd_krw_rate" (JSONB).
 *   value = { rate: number, baseDate: "YYYY-MM-DD", fetchedAt: "ISO" }
 *   - rate      : USD 1달러 = rate 원 (매매기준율)
 *   - baseDate  : 이 환율의 기준일(수출입은행 searchdate — 영업일)
 *   - fetchedAt : 우리가 API를 마지막으로 호출한 시각(ISO). "하루 1회만 호출" 판단용.
 *
 * 호출 규약:
 *  - Eximbank API는 영업일 11시경 이후에만 당일 데이터를 제공하고, 주말·공휴일·
 *    발표 전에는 빈 배열([])을 준다. 따라서 당일부터 최대 7일 소급하며 첫 유효값을 쓴다.
 *  - 하루 1회만 외부 API를 호출한다(fetchedAt의 KST 날짜가 오늘이면 재호출 안 함).
 *  - getUsdKrwRate()는 절대 throw하지 않는다. 실패 시 캐시값(있으면) 또는 DEFAULT_USD_KRW.
 *  - 첫 조회(캐시 전혀 없음)만 동기 대기, 이후 갱신은 백그라운드(요청 지연 방지).
 */

import { get as httpsGet } from "node:https";
import { getBotSetting, setBotSetting } from "./botSettings.js";

/** bot_settings 저장 키 (달러→원 환율 캐시). */
const RATE_SETTING_KEY = "usd_krw_rate";

/** API 호출·캐시 모두 실패했을 때 쓰는 안전 기본 환율(달러당 원). */
const DEFAULT_USD_KRW = 1400;

/** 수출입은행 API 응답 통화 항목(필요한 필드만). */
interface EximRow {
  result?: number; // 1=성공, 2=DATA오류, 3=인증오류, 4=일일한도초과
  cur_unit?: string; // "USD" 등
  deal_bas_r?: string; // 매매기준율 (예: "1,322.8")
}

/** bot_settings에 저장하는 환율 캐시 형태. */
interface StoredRate {
  rate: number;
  baseDate: string; // YYYY-MM-DD
  fetchedAt: string; // ISO
}

/** getUsdKrwRate 반환 형태. */
export interface UsdKrwRate {
  /** USD 1달러 = usdKrw 원. */
  usdKrw: number;
  /** 이 환율의 기준일(영업일). API를 한 번도 못 받았으면 null. */
  baseDate: string | null;
  /** 오늘자로 갱신되지 못한(과거) 환율이면 true. */
  stale: boolean;
}

// ── KST 날짜 유틸 ─────────────────────────────────────────────────────────────

/** 주어진 시각(UTC)의 KST(UTC+9) 날짜 문자열(YYYYMMDD). */
function kstDateCompact(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** YYYYMMDD → YYYY-MM-DD */
function toDashed(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/** ISO 시각의 KST 날짜(YYYYMMDD). 파싱 실패 시 빈 문자열. */
function kstDateOfIso(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return kstDateCompact(new Date(t));
}

// ── 수출입은행 API 호출 ────────────────────────────────────────────────────────

// 수출입은행 오픈 API 호스트. 구 www.koreaexim.go.kr 는 세션 리다이렉트 루프(302)+중간
// 인증서 누락 문제가 있으나, 신 oapi.koreaexim.go.kr 는 유효 인증서 + 리다이렉트 없이 JSON을
// 바로 반환한다. (fetch 대신 https.get 사용 — 리다이렉트 자동추종·undici 의존 없이 단순 처리)
const EXIM_HOST = "https://oapi.koreaexim.go.kr";

/** https.get으로 JSON을 받아온다(기본 TLS 검증 + 5초 타임아웃). 실패 시 throw. */
function httpsGetJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e as Error);
        }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/**
 * 특정 날짜(YYYYMMDD)의 USD 매매기준율을 수출입은행 API에서 조회한다.
 * 데이터 없음(주말·공휴일·발표 전)·오류 시 null.
 */
async function fetchRateForDate(
  authkey: string,
  searchdate: string,
): Promise<number | null> {
  const url =
    `${EXIM_HOST}/site/program/financial/exchangeJSON` +
    `?authkey=${encodeURIComponent(authkey)}&searchdate=${searchdate}&data=AP01`;

  try {
    const rows = (await httpsGetJson(url)) as EximRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const usd = rows.find((r) => (r.cur_unit ?? "").toUpperCase() === "USD");
    if (!usd || !usd.deal_bas_r) return null;

    const rate = Number(usd.deal_bas_r.replace(/,/g, ""));
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return rate;
  } catch {
    // 네트워크·타임아웃·TLS·JSON 파싱 오류 → 조용히 null (상위에서 소급/폴백)
    return null;
  }
}

/**
 * 오늘(KST)부터 최대 7일 소급하며 첫 유효한 USD 매매기준율을 찾는다.
 * @returns { rate, baseDate } 또는 null(전부 실패).
 */
async function fetchLatestUsdKrw(): Promise<{ rate: number; baseDate: string } | null> {
  const authkey = process.env.KOREAEXIM_API_KEY ?? "";
  if (!authkey) {
    console.warn("[exchange-rate] KOREAEXIM_API_KEY 미설정 — 환율 조회 건너뜀");
    return null;
  }

  const now = new Date();
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getTime() - back * 24 * 60 * 60 * 1000);
    const compact = kstDateCompact(d);
    const rate = await fetchRateForDate(authkey, compact);
    if (rate != null) {
      return { rate, baseDate: toDashed(compact) };
    }
  }
  return null;
}

// ── 캐시 읽기/갱신 ────────────────────────────────────────────────────────────

/** bot_settings에서 저장된 환율 캐시를 읽는다(없으면 null). */
async function readStored(): Promise<StoredRate | null> {
  const raw = await getBotSetting<StoredRate>(RATE_SETTING_KEY);
  if (
    raw &&
    typeof raw.rate === "number" &&
    Number.isFinite(raw.rate) &&
    raw.rate > 0 &&
    typeof raw.baseDate === "string"
  ) {
    return raw;
  }
  return null;
}

// 동시 요청이 중복 API 호출을 하지 않도록 진행 중 갱신 1건만 유지.
let inFlight: Promise<StoredRate | null> | null = null;

/**
 * 수출입은행 API를 실제로 호출해 최신 환율을 bot_settings에 저장한다.
 * 성공 시 저장한 StoredRate 반환, 실패 시 null. (throw 안 함)
 * 내부 크론·엔드포인트에서 강제 갱신용으로 사용.
 */
export async function refreshUsdKrwRate(): Promise<StoredRate | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const fetched = await fetchLatestUsdKrw();
      if (!fetched) return null;
      const stored: StoredRate = {
        rate: fetched.rate,
        baseDate: fetched.baseDate,
        fetchedAt: new Date().toISOString(),
      };
      await setBotSetting(RATE_SETTING_KEY, stored);
      console.info(
        `[exchange-rate] 환율 갱신 완료: USD 1 = ${stored.rate}원 (기준일 ${stored.baseDate})`,
      );
      return stored;
    } catch (err) {
      console.warn("[exchange-rate] 환율 갱신 실패:", (err as Error).message);
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * 현재 적용할 USD→KRW 환율을 반환한다.
 *
 * - 캐시가 오늘(KST) 호출분이면 그대로 사용.
 * - 오늘 호출분이 아니면 백그라운드로 갱신을 트리거하되, 응답은 기존 캐시로 즉시 반환
 *   (요청 지연 방지). 다음 조회부터 새 값 반영.
 * - 캐시가 전혀 없으면 이번엔 동기 대기 후 반환(최초 1회). 그래도 실패면 기본값.
 *
 * 절대 throw하지 않는다.
 */
export async function getUsdKrwRate(): Promise<UsdKrwRate> {
  let stored: StoredRate | null = null;
  try {
    stored = await readStored();
  } catch {
    stored = null;
  }

  const todayKst = kstDateCompact(new Date());
  const isToday = stored ? kstDateOfIso(stored.fetchedAt) === todayKst : false;

  if (stored && isToday) {
    return { usdKrw: stored.rate, baseDate: stored.baseDate, stale: false };
  }

  if (stored) {
    // 과거 캐시 → 백그라운드 갱신(응답 지연 없음), 이번엔 기존값 반환
    void refreshUsdKrwRate();
    return { usdKrw: stored.rate, baseDate: stored.baseDate, stale: true };
  }

  // 캐시 전혀 없음 → 최초 1회 동기 조회
  const fresh = await refreshUsdKrwRate();
  if (fresh) {
    return { usdKrw: fresh.rate, baseDate: fresh.baseDate, stale: false };
  }
  return { usdKrw: DEFAULT_USD_KRW, baseDate: null, stale: true };
}
