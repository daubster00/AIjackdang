/**
 * 특정 봇에게 특정 게시글로 댓글 1개를 달게 하는 수동 트리거 스크립트.
 *
 * runCommentPipeline에 forcePersonaId를 주입하면 랜덤 페르소나 선택과
 * 30% 랜덤 스킵을 건너뛰고 지정한 봇으로 댓글을 생성·게시한다.
 * (요약→생성→검열 단계는 자동 스케줄과 동일하게 거친다.)
 *
 * 입력(환경변수 우선, 없으면 argv):
 *   BOT_NICK / argv[2] : 페르소나 닉네임 (예: wolse99)
 *   POST_ID  / argv[3] : 대상 게시글 UUID
 *
 * 실행(운영 — prod DB에 실제 게시):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     run --rm -e BOT_NICK=wolse99 -e POST_ID=<uuid> \
 *     api tsx src/scripts/bot-comment-post.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { runCommentPipeline } from "../services/bot/comment-pipeline.js";

async function main(): Promise<void> {
  const nickname = (process.env.BOT_NICK ?? process.argv[2] ?? "").trim();
  const postId = (process.env.POST_ID ?? process.argv[3] ?? "").trim();

  if (!nickname || !postId) {
    console.error(
      "[bot-comment-post] 사용법: BOT_NICK=<닉네임> POST_ID=<게시글UUID> 로 실행하세요.",
    );
    process.exit(2);
  }

  const db = getDb();

  const [persona] = await db
    .select({ id: schema.botPersonas.id, nickname: schema.botPersonas.nickname })
    .from(schema.botPersonas)
    .where(eq(schema.botPersonas.nickname, nickname))
    .limit(1);

  if (!persona) {
    console.error(`[bot-comment-post] 페르소나 '${nickname}' 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const [post] = await db
    .select({ id: schema.posts.id, title: schema.posts.title, board: schema.posts.board })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!post) {
    console.error(`[bot-comment-post] 게시글 '${postId}' 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  console.info(
    `[bot-comment-post] ▶ '${persona.nickname}' → [${post.board}] ${post.title}\n`,
  );

  const result = await runCommentPipeline({
    targetPostId: post.id,
    targetBoard: post.board,
    forcePersonaId: persona.id,
  });

  console.info(
    `[bot-comment-post] 결과: ${result.outcome}` +
      (result.commentId ? ` | commentId=${result.commentId}` : "") +
      (result.jobId ? ` | jobId=${result.jobId}` : ""),
  );

  if (result.outcome !== "published") {
    console.warn(
      "[bot-comment-post] ⚠ 게시되지 않음. censor_held(검열 보류)·discarded·content_blocked 등일 수 있습니다.",
    );
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[bot-comment-post] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
