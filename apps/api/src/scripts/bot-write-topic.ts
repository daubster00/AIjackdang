/**
 * 특정 봇에게 특정 주제로 글 1개를 쓰게 하는 수동 트리거 스크립트.
 *
 * bot-write-once.ts가 8봇을 각자 담당 게시판에 (발굴 주제로) 1회씩 돌리는 것과 달리,
 * 이 스크립트는 **운영자가 지정한 페르소나·게시판·주제**로 딱 1개를 생성·게시한다.
 * runPostPipeline에 realtimeTopic을 주입하면 발굴·주제풀을 건너뛰고 그 주제를 강제한다
 * (post-pipeline Step 4의 forced-topic 분기).
 *
 * 입력(환경변수 우선, 없으면 argv):
 *   BOT_NICK   / argv[2] : 페르소나 닉네임 (예: latte2x)
 *   BOT_BOARD  / argv[3] : 게시판 슬러그   (예: vibe-coding-tips)
 *   BOT_TOPIC  / argv[4..]: 강제 주제 문자열 (제목 씨앗 겸 그라운딩 질의)
 *
 * 실행(로컬):
 *   BOT_NICK=latte2x BOT_BOARD=vibe-coding-tips BOT_TOPIC="..." \
 *     pnpm --filter @ai-jakdang/api tsx src/scripts/bot-write-topic.ts
 *
 * 실행(운영 — prod DB·MinIO에 실제 게시):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     run --rm -e BOT_NICK=latte2x -e BOT_BOARD=vibe-coding-tips -e BOT_TOPIC="..." \
 *     api tsx src/scripts/bot-write-topic.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { runPostPipeline } from "../services/bot/post-pipeline.js";

async function main(): Promise<void> {
  const nickname = (process.env.BOT_NICK ?? process.argv[2] ?? "").trim();
  const board = (process.env.BOT_BOARD ?? process.argv[3] ?? "").trim();
  const topic = (process.env.BOT_TOPIC ?? process.argv.slice(4).join(" ")).trim();

  if (!nickname || !board || !topic) {
    console.error(
      "[bot-write-topic] 사용법: BOT_NICK=<닉네임> BOT_BOARD=<게시판> BOT_TOPIC=<주제> 로 실행하세요.",
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
    console.error(`[bot-write-topic] 페르소나 '${nickname}' 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  console.info(
    `[bot-write-topic] ▶ '${persona.nickname}' → ${board}\n  주제: ${topic}\n`,
  );

  const result = await runPostPipeline({
    personaId: persona.id,
    board,
    realtimeTopic: topic,
  });

  console.info(
    `[bot-write-topic] 결과: ${result.status}` +
      (result.postId ? ` | postId=${result.postId}` : "") +
      (result.reason ? ` | ${result.reason}` : ""),
  );

  if (result.status !== "published") {
    console.warn(
      "[bot-write-topic] ⚠ 게시되지 않음. held(검열 보류)·discarded(재생성 초과)·blocked(금칙어) 등일 수 있습니다. " +
        "존재하지 않거나 검색으로 근거를 못 찾은 주제면 사실성 검열에서 반려될 수 있습니다.",
    );
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[bot-write-topic] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
