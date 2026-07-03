/**
 * 운영 이벤트 텔레그램 알림 — 신고 접수 / 회원가입 / 1:1 문의 발생을 운영자에게 즉시 통지한다.
 *
 * 설계 의도(봇 알림 telegram-notify.ts·크레딧 알림 credit-alert.ts 와 동일 원칙):
 *  - 부가 기능이므로 어떤 경우에도 throw 하지 않는다(fire-and-forget). 본 흐름(가입/신고/문의)을 절대 막지 않음.
 *  - TELEGRAM_BOT_TOKEN(텔레그램 봇 토큰) / TELEGRAM_CHAT_ID(수신 채팅 ID) 미설정 시 graceful skip.
 *  - 봇 게시 알림과 동일한 2개 키를 공유한다(별도 설정 불필요).
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org";

/** HTML parse_mode 안전 처리(허용 태그만 쓰므로 <>& 만 이스케이프). */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 텔레그램 sendMessage 호출 — 실패해도 throw 하지 않는다. */
async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 미설정 — graceful skip

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ops-telegram] API 오류 (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("[ops-telegram] 네트워크 오류:", (err as Error).message);
  }
}

/** userId → 표시 라벨(닉네임, 없으면 이메일, 그도 없으면 축약 id). 조회 실패해도 던지지 않는다. */
async function userLabel(userId: string): Promise<string> {
  try {
    const db = getDb();
    const [u] = await db
      .select({ nickname: schema.users.nickname, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return u?.nickname || u?.email || userId.slice(0, 8);
  } catch {
    return userId.slice(0, 8);
  }
}

// ── 신고 접수 알림 ─────────────────────────────────────────────────────────────

/** 신고 대상 타입 → 한국어 라벨. */
const REPORT_TARGET_LABEL: Record<string, string> = {
  post: "게시글",
  question: "질문",
  answer: "답변",
  resource: "자료",
  comment: "댓글",
  message: "쪽지",
  user: "회원",
};

/** 신고 사유 코드 → 한국어 라벨(콘텐츠·회원 사유 합집합). */
const REPORT_REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  privacy: "개인정보 노출",
  misinformation: "허위정보",
  profile: "부적절한 프로필",
  impersonation: "사칭",
  other: "기타",
};

/**
 * 신고가 접수되면 텔레그램으로 알린다(fire-and-forget·throw 금지).
 */
export function notifyNewReport(input: {
  reporterId: string;
  targetType: string;
  reasonCode: string;
  detail?: string | null;
}): void {
  void (async () => {
    try {
      const reporter = await userLabel(input.reporterId);
      const targetLabel = REPORT_TARGET_LABEL[input.targetType] ?? input.targetType;
      const reasonLabel = REPORT_REASON_LABEL[input.reasonCode] ?? input.reasonCode;
      const detailLine = input.detail?.trim()
        ? `\n상세: ${esc(input.detail.trim().slice(0, 300))}`
        : "";
      const text =
        `🚨 <b>신고 접수</b>\n` +
        `대상: <b>${esc(targetLabel)}</b>\n` +
        `사유: ${esc(reasonLabel)}\n` +
        `신고자: ${esc(reporter)}` +
        detailLine;
      await sendTelegramMessage(text);
    } catch (err) {
      console.error("[ops-telegram] 신고 알림 실패 (무시):", (err as Error).message);
    }
  })();
}

// ── 회원가입 알림 ──────────────────────────────────────────────────────────────

/**
 * 신규 회원가입이 발생하면 텔레그램으로 알린다(fire-and-forget·throw 금지).
 * 이메일 가입·소셜 가입 공통(user.create.after 훅에서 호출).
 */
export function notifyNewSignup(input: {
  email?: string | null;
  nickname?: string | null;
  /** 가입 경로: 'email' | 'google' | 'naver' | 'kakao' 등(선택). */
  provider?: string;
}): void {
  void (async () => {
    try {
      const who = input.nickname || input.email || "신규 회원";
      const emailLine = input.email ? `\n이메일: ${esc(input.email)}` : "";
      const providerLine = input.provider ? `\n경로: ${esc(input.provider)}` : "";
      const text =
        `🎉 <b>신규 회원가입</b>\n` +
        `닉네임: <b>${esc(who)}</b>` +
        emailLine +
        providerLine;
      await sendTelegramMessage(text);
    } catch (err) {
      console.error("[ops-telegram] 가입 알림 실패 (무시):", (err as Error).message);
    }
  })();
}

// ── 1:1 문의 알림 ──────────────────────────────────────────────────────────────

/**
 * 1:1 문의가 접수되면 텔레그램으로 알린다(fire-and-forget·throw 금지).
 */
export function notifyNewInquiry(input: {
  userId: string;
  title: string;
}): void {
  void (async () => {
    try {
      const who = await userLabel(input.userId);
      const text =
        `📩 <b>1:1 문의 접수</b>\n` +
        `제목: <b>${esc(input.title)}</b>\n` +
        `작성자: ${esc(who)}`;
      await sendTelegramMessage(text);
    } catch (err) {
      console.error("[ops-telegram] 문의 알림 실패 (무시):", (err as Error).message);
    }
  })();
}
