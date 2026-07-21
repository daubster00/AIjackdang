/**
 * 특정 봇에게 특정 게시판 글 1개를 **주제 강제 없이** 쓰게 하는 수동 트리거 스크립트.
 *
 * bot-write-topic.ts가 realtimeTopic을 주입해 발굴·큐레이션을 건너뛰고 주제를 강제하는 것과 달리,
 * 이 스크립트는 realtimeTopic 없이 runPostPipeline을 돌려 게시판의 **자동 경로**(작당 수다방=커뮤니티
 * 화제글 큐레이션, 그 외=발굴/주제풀)를 그대로 태운다. 새 큐레이션 경로 수동 검증용.
 *
 * 입력(환경변수 우선, 없으면 argv):
 *   BOT_NICK  / argv[2] : 페르소나 닉네임 (예: 냉장고털이)
 *   BOT_BOARD / argv[3] : 게시판 슬러그   (기본 talk)
 *
 * 실행(운영 — prod DB·MinIO에 실제 게시):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     run --rm -e BOT_NICK=냉장고털이 -e BOT_BOARD=talk \
 *     api tsx src/scripts/bot-write-community.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { runPostPipeline } from "../services/bot/post-pipeline.js";

async function main(): Promise<void> {
  const nickname = (process.env.BOT_NICK ?? process.argv[2] ?? "").trim();
  const board = (process.env.BOT_BOARD ?? process.argv[3] ?? "talk").trim();

  if (!nickname || !board) {
    console.error(
      "[bot-write-community] 사용법: BOT_NICK=<닉네임> [BOT_BOARD=talk] 로 실행하세요.",
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
    console.error(`[bot-write-community] 페르소나 '${nickname}' 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  console.info(
    `[bot-write-community] ▶ '${persona.nickname}' → ${board} (주제 강제 없음 = 자동 경로)\n`,
  );

  const result = await runPostPipeline({
    personaId: persona.id,
    board,
  });

  console.info(
    `[bot-write-community] 결과: ${result.status}` +
      (result.postId ? ` | postId=${result.postId}` : "") +
      (result.reason ? ` | ${result.reason}` : ""),
  );

  if (result.status !== "published") {
    console.warn(
      "[bot-write-community] ⚠ 게시되지 않음. held(검열 보류)·discarded(재생성 초과)·blocked(금칙어)·skipped(소재 없음) 등일 수 있습니다.",
    );
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[bot-write-community] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
