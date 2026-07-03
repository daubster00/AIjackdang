/**
 * 가이드 강의 시리즈 다음 편 발행 스크립트 (수동 검증/운영 트리거).
 *
 * 관리자 페르소나(isAdminPersona=true)로 가이드 게시판(vibe-coding-guide·automation-guide)에
 * runPostPipeline을 호출한다. 파이프라인이 커리큘럼의 "다음 미발행 편"을 자동 선택해
 * 본문 [[IMG:key]] 마커를 매니페스트 이미지로 치환한 뒤 게시한다.
 *
 * 실행:
 *   pnpm --filter @ai-jakdang/api tsx src/scripts/publish-guide-chapter.ts
 *   BOARDS=vibe-coding-guide pnpm --filter @ai-jakdang/api tsx src/scripts/publish-guide-chapter.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq, and } from "drizzle-orm";
import { runPostPipeline } from "../services/bot/post-pipeline.js";
import { GUIDE_SERIES } from "../services/bot/curriculum.js";

const DEFAULT_BOARDS = GUIDE_SERIES.map((s) => s.board);
const BOARDS = (process.env.BOARDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const targetBoards = BOARDS.length > 0 ? BOARDS : DEFAULT_BOARDS;

async function main(): Promise<void> {
  const db = getDb();

  const [persona] = await db
    .select({ id: schema.botPersonas.id, nickname: schema.botPersonas.nickname })
    .from(schema.botPersonas)
    .where(
      and(
        eq(schema.botPersonas.isAdminPersona, true),
        eq(schema.botPersonas.isActive, true),
      ),
    )
    .limit(1);

  if (!persona) {
    console.error("[publish-guide] 활성 관리자 페르소나가 없습니다.");
    return;
  }

  // 생성·검열 모델 할당 확인(크레딧 소진 프로바이더면 발행 실패 원인 파악용).
  const assignments = await db
    .select({
      purpose: schema.botModelAssignments.purpose,
      provider: schema.botModelAssignments.provider,
      model: schema.botModelAssignments.model,
    })
    .from(schema.botModelAssignments)
    .where(
      and(
        eq(schema.botModelAssignments.personaId, persona.id),
        eq(schema.botModelAssignments.isActive, true),
      ),
    );
  console.info(`[publish-guide] 페르소나: ${persona.nickname} (${persona.id})`);
  for (const a of assignments) {
    console.info(`  모델[${a.purpose}] = ${a.provider}/${a.model}`);
  }
  console.info("");

  for (const board of targetBoards) {
    console.info(`[publish-guide] ▶ ${board} 다음 편 작성 중...`);
    try {
      const result = await runPostPipeline({ personaId: persona.id, board });
      console.info(
        `[publish-guide] ✔ ${board}: ${result.status}` +
          (result.postId ? ` (postId=${result.postId})` : "") +
          (result.reason ? ` (${result.reason})` : ""),
      );
    } catch (err) {
      console.error(`[publish-guide] ✘ ${board} 오류:`, (err as Error).message);
    }
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[publish-guide] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
