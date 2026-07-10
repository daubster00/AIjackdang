/**
 * 실전자료 1건에 썸네일용 헤더 이미지를 사후 추가(backfill)하는 일회용 스크립트.
 *
 * 이미지 기능(2026-07-10) 배포 전에 생성돼 썸네일이 없는 큐레이션 자료글에,
 * post-pipeline 과 동일한 정책(웹 이미지 우선 → AI 상징 이미지 폴백)으로 헤더 이미지
 * 1장을 본문 상단에 넣고 thumbnail_url 을 설정한다.
 *
 * 입력(환경변수):
 *   RESOURCE_ID : 대상 resources.id (UUID)
 *   QUERY       : 웹 이미지 검색어 (선택, 기본 = 자료 제목)
 *
 * 실행(운영):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     exec -e RESOURCE_ID=... api pnpm --filter @ai-jakdang/api exec tsx \
 *       src/scripts/backfill-resource-thumbnail.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import {
  searchWebImage,
  uploadWebImage,
  genImage,
  prependImageWithSourceToTiptapDoc,
} from "@ai-jakdang/server-bot/image";
import { checkCurationCopyrightRisk } from "../services/bot/curation.js";
import { uploadImage } from "../services/storage/index.js";

async function main(): Promise<void> {
  const resourceId = (process.env.RESOURCE_ID ?? "").trim();
  if (!resourceId) {
    console.error("[backfill-thumb] 사용법: RESOURCE_ID 환경변수 필요.");
    process.exit(2);
  }

  const db = getDb();

  const [resource] = await db
    .select({
      id: schema.resources.id,
      title: schema.resources.title,
      descriptionJson: schema.resources.descriptionJson,
      thumbnailUrl: schema.resources.thumbnailUrl,
    })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (!resource) {
    console.error(`[backfill-thumb] resource '${resourceId}' 없음.`);
    process.exit(1);
  }
  if (resource.thumbnailUrl) {
    console.info(`[backfill-thumb] 이미 썸네일 있음(${resource.thumbnailUrl}). 중단.`);
    process.exit(0);
  }

  const query = (process.env.QUERY ?? resource.title).trim();
  const draftJson = resource.descriptionJson as Record<string, unknown>;

  console.info(`[backfill-thumb] ▶ '${resource.title}' 헤더 이미지 조달 (query="${query}")`);

  let imageUrl: string | null = null;
  let sourceLabel: string | undefined;
  let sourceUrl: string | undefined;

  // (1) 웹 이미지 우선 — 자료 관련 실제 이미지(출처 표기).
  try {
    const webImg = await searchWebImage(query);
    if (webImg && !checkCurationCopyrightRisk(webImg.sourcePageUrl)) {
      const uploaded = await uploadWebImage(webImg, uploadImage);
      if (uploaded) {
        imageUrl = uploaded.imageUrl;
        sourceLabel = uploaded.source.label;
        sourceUrl = uploaded.source.url;
        console.info(`[backfill-thumb] 웹 이미지 채택: ${sourceLabel ?? sourceUrl}`);
      }
    }
  } catch (err) {
    console.warn("[backfill-thumb] 웹 이미지 실패:", (err as Error).message);
  }

  // (2) AI 상징 이미지 폴백 — 실사·상징, 텍스트·로고 없음.
  if (!imageUrl) {
    try {
      const aiPrompt = `A clean, modern symbolic header illustration representing "${resource.title}", a widely-used resource for AI developers. Realistic yet conceptual, minimal, professional, soft studio lighting, no text, no logos, no UI screenshots.`;
      const gen = await genImage({ prompt: aiPrompt });
      if (gen) {
        const ext = gen.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const uploaded = await uploadImage(
          { filename: `bot-resource-thumb-${resourceId}.${ext}`, mimetype: gen.mimetype, data: gen.data },
          "editor-images",
        );
        imageUrl = uploaded.url;
        console.info(`[backfill-thumb] AI 상징 이미지 생성: ${imageUrl}`);
      }
    } catch (err) {
      console.warn("[backfill-thumb] AI 이미지 실패:", (err as Error).message);
    }
  }

  if (!imageUrl) {
    console.error("[backfill-thumb] 웹·AI 모두 실패 — 썸네일 미추가.");
    process.exit(1);
  }

  // 본문 상단에 이미지 삽입 + thumbnail_url 설정.
  const newBody = prependImageWithSourceToTiptapDoc(draftJson, imageUrl, {
    sourceLabel,
    sourceUrl,
  });

  await db
    .update(schema.resources)
    .set({ descriptionJson: newBody, thumbnailUrl: imageUrl, updatedAt: new Date() })
    .where(eq(schema.resources.id, resourceId));

  console.info(`[backfill-thumb] 완료 — thumbnail_url=${imageUrl}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfill-thumb] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
