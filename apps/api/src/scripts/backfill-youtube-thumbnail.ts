/**
 * 썸네일이 비어 있는 게시글의 thumbnail_url 을 본문에서 재추출(backfill)하는 일회용 스크립트.
 *
 * 유튜브 임베드 인식(extractFirstImageUrl 개편, 2026-07-23) 배포 전에 퍼온 유튜브 영상 글은
 * 본문에 이미지 노드가 없어 thumbnail_url 이 null 로 남아 목록 카드에 빈 썸네일이 떴다.
 * 이 스크립트는 thumbnail_url 이 없는 글을 훑어 extractFirstImageUrl 로 다시 뽑는다
 * (이제 유튜브 노드는 영상 썸네일 i.ytimg.com 을 반환). 이미지가 든 글도 함께 보정된다.
 *
 * DRY RUN(기본): 무엇이 바뀔지 출력만. 실제 반영은 APPLY=1.
 *
 * 실행(운영):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     exec -e APPLY=1 api pnpm --filter @ai-jakdang/api exec tsx \
 *       src/scripts/backfill-youtube-thumbnail.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { and, eq, isNull } from "drizzle-orm";
import { extractFirstImageUrl } from "../lib/extract-first-image.js";

async function main(): Promise<void> {
  const apply = (process.env.APPLY ?? "").trim() === "1";
  const db = getDb();

  // 썸네일이 없고 삭제되지 않은 게시글만 대상.
  const rows = await db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      contentJson: schema.posts.contentJson,
    })
    .from(schema.posts)
    .where(and(isNull(schema.posts.thumbnailUrl), isNull(schema.posts.deletedAt)));

  console.info(`[backfill-yt-thumb] 썸네일 없는 글 ${rows.length}건 검사 (APPLY=${apply ? "1" : "0(dry-run)"})`);

  let updated = 0;
  for (const row of rows) {
    const thumb = extractFirstImageUrl(row.contentJson);
    if (!thumb) continue;

    console.info(`[backfill-yt-thumb] ${apply ? "적용" : "예정"}: "${row.title}" → ${thumb}`);
    if (apply) {
      await db
        .update(schema.posts)
        .set({ thumbnailUrl: thumb, updatedAt: new Date() })
        .where(eq(schema.posts.id, row.id));
    }
    updated++;
  }

  console.info(
    `[backfill-yt-thumb] 완료 — ${apply ? `${updated}건 반영` : `${updated}건 반영 예정(APPLY=1 로 실행)`}`,
  );
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfill-yt-thumb] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
