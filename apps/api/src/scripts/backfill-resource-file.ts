/**
 * 실전자료 1건에 GitHub 저장소 파일을 사후 첨부(backfill)하는 일회용 스크립트.
 *
 * 수정 전(발굴이 리스티클을 원본으로 골라 fileSource=null) 생성돼 파일이 없는
 * 자료글에, 실제 공식 저장소 zip을 받아 첨부하고 출처(reference_links)를 교정한다.
 * 첨부 경로는 사람/봇과 동일한 uploadResourceFiles(S3 + ClamAV 스캔 큐)를 재사용한다.
 *
 * 입력(환경변수):
 *   RESOURCE_ID : 대상 resources.id (UUID)
 *   OWNER       : GitHub 저장소 소유자 (예: microsoft)
 *   REPO        : GitHub 저장소 이름   (예: playwright-mcp)
 *   SOURCE_LABEL: 출처 라벨 (선택, 기본 "GitHub - {owner}/{repo}")
 *
 * 실행(운영):
 *   cd ~/aijakdang/deploy && docker compose -f docker-compose.prod.yml --env-file .env \
 *     run --rm -e RESOURCE_ID=... -e OWNER=microsoft -e REPO=playwright-mcp \
 *     api pnpm --filter @ai-jakdang/api exec tsx src/scripts/backfill-resource-file.ts
 */

import { getDb, closeDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { fetchCuratedResourceFile } from "../services/bot/resource-file-fetch.js";
import { uploadResourceFiles } from "../routes/v1/resources/upload.service.js";

async function main(): Promise<void> {
  const resourceId = (process.env.RESOURCE_ID ?? "").trim();
  const owner = (process.env.OWNER ?? "").trim();
  const repo = (process.env.REPO ?? "").trim();
  const sourceLabel = (process.env.SOURCE_LABEL ?? `GitHub - ${owner}/${repo}`).trim();

  if (!resourceId || !owner || !repo) {
    console.error("[backfill] 사용법: RESOURCE_ID·OWNER·REPO 환경변수 필요.");
    process.exit(2);
  }

  const db = getDb();

  const [resource] = await db
    .select({ id: schema.resources.id, title: schema.resources.title })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (!resource) {
    console.error(`[backfill] resource '${resourceId}' 없음.`);
    process.exit(1);
  }

  console.info(`[backfill] ▶ '${resource.title}' ← ${owner}/${repo} 저장소 첨부 시도`);

  const file = await fetchCuratedResourceFile({
    kind: "github-repo",
    owner,
    repo,
    label: `${owner}/${repo}`,
  });

  if (!file) {
    console.error("[backfill] 파일 다운로드 실패(브랜치 없음·과대·비-zip). 중단.");
    process.exit(1);
  }

  await uploadResourceFiles(resourceId, [file]);
  console.info(`[backfill] 파일 첨부 완료: ${file.originalName} (${file.size} bytes)`);

  // 출처(reference_links)를 실제 저장소로 교정.
  const sourceUrl = `https://github.com/${owner}/${repo}`;
  await db
    .update(schema.resources)
    .set({ referenceLinks: [{ label: sourceLabel, url: sourceUrl }], updatedAt: new Date() })
    .where(eq(schema.resources.id, resourceId));
  console.info(`[backfill] 출처 교정 완료: ${sourceUrl}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[backfill] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });
