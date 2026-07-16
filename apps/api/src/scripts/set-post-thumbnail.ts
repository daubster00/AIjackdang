/**
 * 특정 게시글 1건의 썸네일(thumbnail_url)을 지정한 로컬 이미지 파일로 교체하는 일회용 스크립트.
 *
 * 본문(contentJson)은 건드리지 않고 목록·OG 썸네일로 쓰이는 thumbnail_url 만 바꾼다.
 * (⚠️ 관리자 에디터에서 본문을 다시 저장하면 thumbnail_url 이 "본문 첫 이미지"로 재추출되므로,
 *  본문 첫 이미지와 다른 썸네일을 유지하려면 본문 재저장 후 이 스크립트를 다시 돌려야 한다.)
 *
 * 워터마크는 붙이지 않는다("banners" 서브디렉터리 사용) — 디자인된 썸네일 원본을 그대로 보존.
 *
 * 입력(환경변수):
 *   POST_ID    : 대상 posts.id (UUID)  ─┐ 둘 중 하나 필수
 *   POST_TITLE : 제목 부분일치(ILIKE) ─┘ (여러 건 매칭되면 목록만 출력하고 중단)
 *   THUMB_FILE : 새 썸네일로 쓸 로컬 이미지 파일 경로 (png/jpg/webp/gif)
 *
 * 실행(운영 — 스크립트·이미지 파일을 컨테이너에 마운트해 재배포 없이 실행):
 *   scp -i KEY editable_thumbnail.png set-post-thumbnail.ts ubuntu@HOST:~/
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env run --rm \
 *     -v ~/set-post-thumbnail.ts:/app/apps/api/src/scripts/set-post-thumbnail.ts \
 *     -v ~/editable_thumbnail.png:/tmp/thumb.png \
 *     -e POST_ID=... -e THUMB_FILE=/tmp/thumb.png \
 *     api pnpm --filter @ai-jakdang/api exec tsx src/scripts/set-post-thumbnail.ts
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { uploadImage, type ParsedFile } from "../services/storage/index.js";

/** 확장자 → MIME 타입 (uploadImage 검증·저장 확장자 결정에 사용) */
const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main(): Promise<void> {
  const postId = (process.env.POST_ID ?? "").trim();
  const postTitle = (process.env.POST_TITLE ?? "").trim();
  const thumbFile = (process.env.THUMB_FILE ?? "").trim();

  if (!thumbFile) {
    console.error("[set-thumb] THUMB_FILE(새 썸네일 이미지 경로) 환경변수 필요.");
    process.exit(2);
  }
  if (!postId && !postTitle) {
    console.error("[set-thumb] POST_ID 또는 POST_TITLE 중 하나 필요.");
    process.exit(2);
  }

  const ext = extname(thumbFile).toLowerCase();
  const mimetype = EXT_TO_MIME[ext];
  if (!mimetype) {
    console.error(`[set-thumb] 지원하지 않는 확장자(${ext}). png/jpg/webp/gif 만 가능.`);
    process.exit(2);
  }

  const db = getDb();

  // ── 대상 게시글 조회 (삭제글 제외) ──
  const rows = await db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      board: schema.posts.board,
      thumbnailUrl: schema.posts.thumbnailUrl,
    })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        postId
          ? eq(schema.posts.id, postId)
          : ilike(schema.posts.title, `%${postTitle}%`),
      ),
    );

  if (rows.length === 0) {
    console.error("[set-thumb] 대상 게시글을 찾지 못했습니다.");
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(`[set-thumb] ${rows.length}건이 매칭됩니다. POST_ID 로 특정하세요:`);
    for (const r of rows) console.error(`  - ${r.id} | ${r.title}`);
    process.exit(1);
  }

  const post = rows[0];
  console.info(`[set-thumb] 대상: ${post.id} | ${post.title}`);
  console.info(`[set-thumb] 기존 thumbnail_url: ${post.thumbnailUrl ?? "(없음)"}`);

  // ── 이미지 업로드 (워터마크 미적용 = banners 서브디렉터리) ──
  const data = readFileSync(thumbFile);
  const file: ParsedFile = { filename: basename(thumbFile), mimetype, data };
  const uploaded = await uploadImage(file, "banners");
  console.info(`[set-thumb] 업로드 완료: ${uploaded.url}`);

  // ── thumbnail_url 갱신 (본문 미변경) ──
  await db
    .update(schema.posts)
    .set({ thumbnailUrl: uploaded.url, updatedAt: new Date() })
    .where(eq(schema.posts.id, post.id));

  console.info(`[set-thumb] 완료 — thumbnail_url=${uploaded.url}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[set-thumb] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
