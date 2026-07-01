/**
 * 봇 활동 텔레그램 간단 알림 — "어떤 봇이 어디에 글을 썼다" 수준의 사실 통지만 전송한다.
 *
 * 설계 의도(사용자 요청):
 *  - AI가 작성한 요약/보고서를 보내지 않는다. 봇 닉네임·게시 위치·제목만 담은 짧은 사실 통지.
 *  - 부가 기능이므로 어떤 경우에도 throw 하지 않는다(게시 흐름을 절대 막지 않음).
 *  - TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 graceful skip(경고 없이 조용히 skip).
 *
 * env 키는 packages/config env.ts 에 optional 로 등록돼 있으며 부팅 시 process.env 에 주입된다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { BOARDS } from "@ai-jakdang/contracts";

const TELEGRAM_API = "https://api.telegram.org";

/** 봇이 작성한 콘텐츠 종류 */
type BotPublishKind = "post" | "question" | "resource" | "comment" | "reply";

interface NotifyBotPublishInput {
  /** bot_personas.id — 닉네임 조회에 사용 */
  personaId: string;
  kind: BotPublishKind;
  /** 게시글일 때 board 슬러그(라벨 변환용) */
  board?: string;
  /** 글·질문·자료 제목(댓글류는 없음) */
  title?: string;
}

/** board 슬러그 → 한국어 라벨(모르면 슬러그 그대로) */
function boardLabel(board?: string): string {
  if (!board) return "";
  return BOARDS[board]?.label ?? board;
}

/** HTML parse_mode 안전 처리(허용 태그만 쓰므로 <>& 만 이스케이프) */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 실제 전송할 메시지 본문 구성 */
function buildMessage(nickname: string, input: NotifyBotPublishInput): string {
  const who = `🤖 <b>${esc(nickname)}</b> 봇`;
  const titleLine = input.title ? `\n제목: ${esc(input.title)}` : "";

  switch (input.kind) {
    case "post":
      return `${who}이 <b>${esc(boardLabel(input.board))}</b> 게시판에 글을 작성했습니다.${titleLine}`;
    case "question":
      return `${who}이 <b>Q&amp;A</b>에 질문을 작성했습니다.${titleLine}`;
    case "resource":
      return `${who}이 <b>실전자료</b>에 자료를 등록했습니다.${titleLine}`;
    case "comment":
      return `${who}이 댓글을 작성했습니다.`;
    case "reply":
      return `${who}이 대댓글을 작성했습니다.`;
  }
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
      console.error(`[bot-telegram] API 오류 (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("[bot-telegram] 네트워크 오류:", (err as Error).message);
  }
}

/**
 * 봇 게시 알림을 백그라운드로 전송한다(fire-and-forget).
 *
 * 게시 흐름을 지연시키지 않도록 await 하지 않고 호출한다.
 * 닉네임 조회·전송 중 어떤 예외가 나도 무시한다(부가 기능).
 */
export function notifyBotPublish(input: NotifyBotPublishInput): void {
  void (async () => {
    try {
      const db = getDb();
      const [persona] = await db
        .select({ nickname: schema.botPersonas.nickname })
        .from(schema.botPersonas)
        .where(eq(schema.botPersonas.id, input.personaId))
        .limit(1);

      const nickname = persona?.nickname ?? "봇";
      await sendTelegramMessage(buildMessage(nickname, input));
    } catch (err) {
      console.error("[bot-telegram] 알림 전송 실패 (무시):", (err as Error).message);
    }
  })();
}
