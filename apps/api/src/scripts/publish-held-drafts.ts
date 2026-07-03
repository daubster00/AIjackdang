/**
 * 보류(held) 상태 봇 초안을 실제 게시하는 스크립트 (수동 검증용).
 *
 * 배경: bot-write-once 실행 시 생성 모델이 OpenAI인 봇은 초안 생성에 성공했으나,
 * 자기검열(censor) 모델이 Anthropic/Google(크레딧 소진)이라 검열이 실패 →
 * ambiguous 폴백 → 보류 큐(held)에 남았다. 검열만 못했을 뿐 초안 본문은 정상이다.
 *
 * 이 스크립트는 held + 미결정(decided=false) + 초안 존재 잡을 찾아
 * createPostAsBot 으로 실제 게시하고 보류 큐를 approved 로 닫는다.
 *
 * ⚠️ 기존 approve 라우트(hold-queue-actions.ts)는 draft_content 를
 *    {board,title,contentJson} 구조로 기대하지만, 실제 파이프라인은
 *    draft_content 에 Tiptap doc({type:"doc",content})만 저장한다.
 *    따라서 이 스크립트가 board/title/tags 를 잡·주제에서 재구성해 게시한다.
 *
 * 실행: pnpm --filter @ai-jakdang/api exec tsx src/scripts/publish-held-drafts.ts
 */

import { eq, and } from "drizzle-orm";
import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { createPostAsBot } from "../services/bot/write.js";

/** title_seed 기반 태그 추출 — post-pipeline 과 동일 규칙(2글자 이상 단어 최대 5개). */
function tagsFromSeed(seed: string): string[] {
  return seed
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 5);
}

async function main(): Promise<void> {
  const db = getDb();

  const rows = await db
    .select({
      holdId: schema.botHoldQueue.id,
      jobId: schema.botGenerationJobs.id,
      jobKind: schema.botGenerationJobs.jobKind,
      board: schema.botGenerationJobs.targetBoard,
      draftContent: schema.botGenerationJobs.draftContent,
      personaId: schema.botPersonas.id,
      personaUserId: schema.botPersonas.userId,
      nickname: schema.botPersonas.nickname,
      titleSeed: schema.botTopics.titleSeed,
    })
    .from(schema.botHoldQueue)
    .innerJoin(
      schema.botGenerationJobs,
      eq(schema.botHoldQueue.jobId, schema.botGenerationJobs.id),
    )
    .innerJoin(
      schema.botPersonas,
      eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
    )
    .leftJoin(
      schema.botTopics,
      eq(schema.botGenerationJobs.topicId, schema.botTopics.id),
    )
    .where(
      and(
        eq(schema.botHoldQueue.decided, false),
        eq(schema.botGenerationJobs.status, "held"),
      ),
    );

  console.info(`[publish-held] 보류 초안 ${rows.length}건 게시 시작\n`);

  let published = 0;
  for (const r of rows) {
    if (r.jobKind !== "post") {
      console.warn(`[publish-held] '${r.nickname}' job_kind=${r.jobKind} → 이 스크립트는 post만 처리, skip`);
      continue;
    }
    if (!r.draftContent) {
      console.warn(`[publish-held] '${r.nickname}' 초안 없음 → skip`);
      continue;
    }
    if (!r.personaUserId) {
      console.warn(`[publish-held] '${r.nickname}' 봇 userId 없음 → skip`);
      continue;
    }
    if (!r.board) {
      console.warn(`[publish-held] '${r.nickname}' 대상 게시판 없음 → skip`);
      continue;
    }

    // 제목: 주제 title_seed(파이프라인이 쓰는 값) → 없으면 doc 첫 heading 텍스트 폴백
    const doc = r.draftContent as { content?: { type?: string; content?: { text?: string }[] }[] };
    const firstHeading = doc.content?.find((n) => n.type === "heading");
    const title =
      r.titleSeed ?? firstHeading?.content?.[0]?.text ?? "봇 작성 글";
    const tags = tagsFromSeed(title);

    console.info(`[publish-held] ▶ '${r.nickname}' → ${r.board} : "${title}" 게시 중...`);
    try {
      const result = await createPostAsBot({
        botUserId: r.personaUserId,
        personaId: r.personaId,
        jobId: r.jobId,
        postInput: {
          board: r.board,
          title,
          contentJson: r.draftContent as Record<string, unknown>,
          status: "published",
          tags,
        },
      });

      if (result.status === "published") {
        // 보류 큐 닫기 (approved)
        await db
          .update(schema.botHoldQueue)
          .set({ decided: true, decision: "approved", decidedAt: new Date() })
          .where(eq(schema.botHoldQueue.id, r.holdId));
        published++;
        console.info(`[publish-held] ✔ '${r.nickname}' 게시 완료 (postId=${result.refId})`);
      } else {
        console.warn(`[publish-held] ✘ '${r.nickname}' contentGuard 차단(blocked) → 보류 유지`);
      }
    } catch (err) {
      console.error(`[publish-held] ✘ '${r.nickname}' 오류:`, (err as Error).message);
    }
  }

  console.info(`\n[publish-held] 게시 완료 ${published}/${rows.length}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[publish-held] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
