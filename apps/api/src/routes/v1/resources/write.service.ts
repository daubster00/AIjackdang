/**
 * 실전자료 등록 서비스 — Story 4.4
 *
 * createResource: 실전자료 등록 및 임시저장.
 * - `db.transaction()` 으로 resources INSERT + (파일 있을 경우) resource_files INSERT 원자 처리.
 * - slug: `slugify(title)` → DB uniqueness 체크 → 중복 시 `-{nanoid6}` suffix.
 * - 파일 실제 S3 업로드·ClamAV 스캔은 Story 4.5 파이프라인(`POST /resources/:id/files`) 담당.
 *   이 서비스는 파일 메타 DB insert만 처리한다 (storageKey='pending', scanStatus='pending').
 * - copyrightAgreed=true 강제 (Zod literal(true) 검증 후 도달).
 * - status: 'published' (등록) or 'draft' (임시저장).
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { CreateResourceInput } from "@ai-jakdang/contracts";
import { eq } from "drizzle-orm";
import { slugify, generateUniqueSlug } from "@ai-jakdang/utilities";
import { earnPoints, getTodayCount } from "../gamification/points.service.js";
import { extractFirstImageUrl } from "../../../lib/extract-first-image.js";

export interface CreateResourceParams {
  input: CreateResourceInput & { status?: "published" | "draft" };
  userId: string;
}

export interface CreateResourceResult {
  id: string;
  slug: string;
  resourceType: string;
  status: "published" | "draft";
}

/**
 * 실전자료를 등록(published) 또는 임시저장(draft)한다.
 *
 * @returns 생성된 resource의 `{ id, slug, resourceType, status }`
 */
export async function createResource({
  input,
  userId,
}: CreateResourceParams): Promise<CreateResourceResult> {
  const db = getDb();

  const {
    title,
    summary,
    resourceType,
    environment,
    difficulty,
    descriptionJson,
    usageJson,
    cautionJson,
    version,
    referenceLinks,
    copyrightAgreed,
    tags = [],
    status = "published",
  } = input;

  // ── slug 생성 ──────────────────────────────────────────────────────────────
  const baseSlug = slugify(title) || slugify(resourceType) || "resource";

  const slug = await generateUniqueSlug(baseSlug, async (candidate: string) => {
    const rows = await db
      .select({ id: schema.resources.id })
      .from(schema.resources)
      .where(eq(schema.resources.slug, candidate))
      .limit(1);
    return rows.length > 0;
  });

  // ── 썸네일 URL: descriptionJson 첫 번째 이미지 src 추출 ─────────────────────
  const thumbnailUrl = extractFirstImageUrl(descriptionJson);

  // ── 트랜잭션: resources INSERT + tags upsert + taggable INSERT ─────────────
  return await db.transaction(async (tx) => {
    // 1) resources INSERT
    const [resource] = await tx
      .insert(schema.resources)
      .values({
        userId,
        slug,
        title,
        summary,
        resourceType,
        environment: environment ?? [],
        difficulty,
        descriptionJson,
        usageJson,
        cautionJson: cautionJson ?? null,
        version: version ?? null,
        referenceLinks: referenceLinks ?? null,
        copyrightAgreed,
        status,
        thumbnailUrl: thumbnailUrl ?? null,
      })
      .returning({
        id: schema.resources.id,
        slug: schema.resources.slug,
        resourceType: schema.resources.resourceType,
        status: schema.resources.status,
      });

    if (!resource) {
      throw new Error("실전자료 INSERT 실패");
    }

    // 2) tags upsert + taggable INSERT (태그가 있을 때만)
    if (tags.length > 0) {
      const tagIds: string[] = [];

      for (const tagName of tags) {
        const tagSlug = slugify(tagName) || tagName.toLowerCase();

        // 기존 태그 조회
        const existing = await tx
          .select({ id: schema.tags.id })
          .from(schema.tags)
          .where(eq(schema.tags.slug, tagSlug))
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          tagIds.push(existing[0].id);
        } else {
          // 새 태그 INSERT
          const [created] = await tx
            .insert(schema.tags)
            .values({ name: tagName, slug: tagSlug })
            .onConflictDoNothing()
            .returning({ id: schema.tags.id });

          if (created) {
            tagIds.push(created.id);
          } else {
            // onConflictDoNothing 으로 반환이 없을 경우 재조회
            const [refetched] = await tx
              .select({ id: schema.tags.id })
              .from(schema.tags)
              .where(eq(schema.tags.slug, tagSlug))
              .limit(1);
            if (refetched) tagIds.push(refetched.id);
          }
        }
      }

      // taggable INSERT (resource 타입)
      if (tagIds.length > 0) {
        await tx.insert(schema.taggable).values(
          tagIds.map((tagId) => ({
            targetType: "resource" as const,
            targetId: resource.id,
            tagId,
          })),
        );
      }
    }

    // 포인트 적립 (published 자료만, 실패해도 자료 저장 유지)
    if (resource.status === "published") {
      try {
        const todayCount = await getTodayCount(tx, { userId, reason: "resource.created" });
        await earnPoints(tx, {
          userId,
          reason: "resource.created",
          sourceType: "resource",
          sourceId: resource.id,
          todayCount,
        });
      } catch (err) {
        console.error("[points] 자료 적립 실패 (무시):", (err as Error).message);
      }
    }

    return {
      id: resource.id,
      slug: resource.slug,
      resourceType: resource.resourceType,
      // resources.status는 DB enum("draft"|"published"|"hidden"|"deleted") 이지만
      // createResource 호출 시 status는 항상 "draft"|"published"로 전달되므로 단언 안전
      status: resource.status as "draft" | "published",
    };
  });
}

/**
 * resourceType 에서 URL 페이지 경로 세그먼트를 반환한다.
 * 등록 성공 후 `/resources/{pageType}/{slug}` 로 이동할 때 사용.
 */
export function getResourcePageType(resourceType: string): string {
  const map: Record<string, string> = {
    "prompt": "prompts",
    "claude-code-skill": "mcp-skills",
    "mcp": "mcp-skills",
    "rules-config": "rules",
    "template-checklist": "templates",
  };
  return map[resourceType] ?? "prompts";
}
