/**
 * 봇 글 작성 1회 실행 스크립트 (수동 검증용).
 *
 * 각 봇 페르소나가 담당 게시판에 실제로 글 1개를 생성·게시하도록
 * runPostPipeline(글 생성 파이프라인: 주제선정→그라운딩→생성→자기검열→게시)을
 * 페르소나마다 1회씩 호출한다.
 *
 * "봇이 얼마나 자연스럽게 글을 쓰는지" 확인 목적의 일회성 트리거.
 * (평소에는 daily-plan cron이 이 파이프라인을 돌리지만 write 워커 프로세서가
 *  아직 stub이라 수동 게시가 안 됨 → 이 스크립트로 직접 파이프라인 호출.)
 *
 * .env 는 @ai-jakdang/config 가 import 시점에 자동 로드한다.
 *
 * 실행: pnpm --filter @ai-jakdang/api tsx src/scripts/bot-write-once.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { runPostPipeline } from "../services/bot/post-pipeline.js";

// ── 페르소나별 대상 게시판 (검색 발굴이 가능한 게시판으로 선택) ─────────────────────
// 주제풀을 비웠으므로 발굴 대상 게시판이어야 글이 나온다(gigs·ai-creation은 발굴 제외).
const BOARD_BY_NICKNAME: Record<string, string> = {
  감자세개: "qna",
  냉장고털이: "talk",
  AI작당지기: "automation-guide",
  dubu_2: "automation-cases",
  latte2x: "automation-cases",
  rainy03: "ai-products",
  semo_k: "vibe-coding-tips",
  wolse99: "monetization-tips",
};

async function main(): Promise<void> {
  const db = getDb();

  const personas = await db
    .select({
      id: schema.botPersonas.id,
      nickname: schema.botPersonas.nickname,
      isActive: schema.botPersonas.isActive,
    })
    .from(schema.botPersonas)
    .orderBy(schema.botPersonas.nickname);

  console.info(`[bot-write-once] 페르소나 ${personas.length}개 대상으로 글 작성 시작\n`);

  const results: {
    nickname: string;
    board: string;
    status: string;
    postId?: string;
    reason?: string;
  }[] = [];

  for (const persona of personas) {
    const board = BOARD_BY_NICKNAME[persona.nickname];
    if (!board) {
      console.warn(`[bot-write-once] '${persona.nickname}' 게시판 매핑 없음 → skip`);
      results.push({ nickname: persona.nickname, board: "(none)", status: "skipped", reason: "no-board-map" });
      continue;
    }

    console.info(`[bot-write-once] ▶ '${persona.nickname}' → ${board} 작성 중...`);
    try {
      const result = await runPostPipeline({ personaId: persona.id, board });
      console.info(
        `[bot-write-once] ✔ '${persona.nickname}': ${result.status}` +
          (result.postId ? ` (postId=${result.postId})` : "") +
          (result.reason ? ` (${result.reason})` : ""),
      );
      results.push({
        nickname: persona.nickname,
        board,
        status: result.status,
        postId: result.postId,
        reason: result.reason,
      });
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`[bot-write-once] ✘ '${persona.nickname}' 오류:`, msg);
      results.push({ nickname: persona.nickname, board, status: "error", reason: msg });
    }
  }

  // ── 결과 요약 ────────────────────────────────────────────────────────────────
  console.info("\n[bot-write-once] ===== 결과 요약 =====");
  for (const r of results) {
    console.info(
      `  ${r.nickname.padEnd(12)} | ${r.board.padEnd(20)} | ${r.status}` +
        (r.postId ? ` | ${r.postId}` : "") +
        (r.reason ? ` | ${r.reason}` : ""),
    );
  }
  const published = results.filter((r) => r.status === "published").length;
  console.info(`\n[bot-write-once] 게시 성공 ${published}/${results.length}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[bot-write-once] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
