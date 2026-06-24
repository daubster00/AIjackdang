/**
 * 실전자료 수정·삭제 서비스 — Story 4.8
 *
 * updateResource: PATCH /api/v1/resources/:id
 *   - 소유권 확인 → 403 FORBIDDEN
 *   - resources 필드 업데이트 (트랜잭션)
 *   - 기존 파일 교체 시 resource_files.file_status='deleted' soft-mark
 *     + cleanup BullMQ 큐 발행(// TODO: Epic 9 cleanup worker)
 *
 * deleteResource: DELETE /api/v1/resources/:id
 *   - 소유권 확인 → 403 FORBIDDEN
 *   - resources.status='deleted', resources.deleted_at=now() soft-delete
 *
 * getMyResources: GET /api/v1/me/resources
 *   - 본인 자료 목록 (status 필터 포함, 상태 배지용)
 *
 * 아키텍처 가드레일:
 * - AR-7: soft-delete (status=deleted + deleted_at)
 * - AR-9: API에서 소유권 최종 통제
 * - AR-2: db.transaction() 사용
 */

import { eq, and, inArray } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import type { UpdateResourceInput } from "@ai-jakdang/contracts";
import { revokePoints } from "../gamification/points.service.js";

// ── 에러 타입 ──────────────────────────────────────────────────────────────────

export class MutateServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: 403 | 404 = 403,
  ) {
    super(message);
    this.name = "MutateServiceError";
  }
}

// ── updateResource ─────────────────────────────────────────────────────────────

export interface UpdateResourceResult {
  id: string;
  slug: string;
  resourceType: string;
  status: string;
}

/**
 * 실전자료를 수정한다.
 *
 * @param resourceId 수정 대상 자료 ID
 * @param userId 요청자 ID (소유권 검증)
 * @param input 수정 입력값 (모든 필드 선택적)
 * @param deleteFileIds 삭제할 기존 파일 ID 목록 (optional)
 * @returns 수정된 자료의 기본 정보
 * @throws MutateServiceError 404(미존재) · 403(비소유자)
 */
export async function updateResource(
  resourceId: string,
  userId: string,
  input: UpdateResourceInput,
  deleteFileIds?: string[],
): Promise<UpdateResourceResult> {
  const db = getDb();

  // ── 1. 자료 조회 ──────────────────────────────────────────────────────────
  const [resource] = await db
    .select({
      id: schema.resources.id,
      userId: schema.resources.userId,
      slug: schema.resources.slug,
      resourceType: schema.resources.resourceType,
      status: schema.resources.status,
    })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (!resource || resource.status === "deleted") {
    throw new MutateServiceError("RESOURCE_NOT_FOUND", "자료를 찾을 수 없습니다.", 404);
  }

  // ── 2. 소유권 확인 (AR-9) ─────────────────────────────────────────────────
  if (resource.userId !== userId) {
    throw new MutateServiceError("FORBIDDEN", "이 자료를 수정할 권한이 없습니다.", 403);
  }

  // ── 3. 트랜잭션: resources 업데이트 + 파일 soft-mark ─────────────────────
  const updated = await db.transaction(async (tx) => {
    // resources 필드 업데이트 (제공된 필드만 반영)
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateValues.title = input.title;
    if (input.summary !== undefined) updateValues.summary = input.summary;
    if (input.resourceType !== undefined) updateValues.resourceType = input.resourceType;
    if (input.environment !== undefined) updateValues.environment = input.environment;
    if (input.difficulty !== undefined) updateValues.difficulty = input.difficulty;
    if (input.descriptionJson !== undefined) updateValues.descriptionJson = input.descriptionJson;
    if (input.usageJson !== undefined) updateValues.usageJson = input.usageJson;
    if (input.cautionJson !== undefined) updateValues.cautionJson = input.cautionJson;
    if (input.version !== undefined) updateValues.version = input.version;
    if (input.referenceLinks !== undefined) updateValues.referenceLinks = input.referenceLinks;
    // draft → published 전환 허용 (저작권 동의 시)
    if (input.copyrightAgreed === true && resource.status === "draft") {
      updateValues.status = "published";
    }

    const [result] = await tx
      .update(schema.resources)
      .set(updateValues)
      .where(eq(schema.resources.id, resourceId))
      .returning({
        id: schema.resources.id,
        slug: schema.resources.slug,
        resourceType: schema.resources.resourceType,
        status: schema.resources.status,
      });

    if (!result) {
      throw new Error("자료 업데이트 실패");
    }

    // 파일 soft-mark: 교체/삭제 대상 파일의 file_status를 'deleted'로 변경 (AC #3)
    if (deleteFileIds && deleteFileIds.length > 0) {
      await tx
        .update(schema.resourceFiles)
        .set({ fileStatus: "deleted" })
        .where(inArray(schema.resourceFiles.id, deleteFileIds));
    }

    return result;
  });

  // ── 4. cleanup 큐 발행 (트랜잭션 외) ─────────────────────────────────────
  // TODO: Epic 9 cleanup worker — 교체된 파일의 S3 hard-delete
  // if (deleteFileIds && deleteFileIds.length > 0) {
  //   const storageKeys = await fetchStorageKeys(deleteFileIds);
  //   await cleanupQueue.add('resource.file.cleanup', { storageKeys });
  // }

  return {
    id: updated.id,
    slug: updated.slug,
    resourceType: updated.resourceType,
    status: updated.status,
  };
}

// ── deleteResource ─────────────────────────────────────────────────────────────

/**
 * 실전자료를 soft-delete 한다.
 *
 * @param resourceId 삭제 대상 자료 ID
 * @param userId 요청자 ID (소유권 검증)
 * @throws MutateServiceError 404(미존재) · 403(비소유자)
 */
export async function deleteResource(resourceId: string, userId: string): Promise<void> {
  const db = getDb();

  // ── 1. 자료 조회 ──────────────────────────────────────────────────────────
  const [resource] = await db
    .select({
      id: schema.resources.id,
      userId: schema.resources.userId,
      status: schema.resources.status,
    })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (!resource || resource.status === "deleted") {
    throw new MutateServiceError("RESOURCE_NOT_FOUND", "자료를 찾을 수 없습니다.", 404);
  }

  // ── 2. 소유권 확인 (AR-9) ─────────────────────────────────────────────────
  if (resource.userId !== userId) {
    throw new MutateServiceError("FORBIDDEN", "이 자료를 삭제할 권한이 없습니다.", 403);
  }

  // ── 3. soft-delete + 포인트 회수 (동일 트랜잭션, AR-7) ──────────────────
  await db.transaction(async (tx) => {
    await tx
      .update(schema.resources)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.resources.id, resourceId));

    try {
      await revokePoints(tx, {
        userId,
        reason: "resource.created",
        sourceType: "resource",
        sourceId: resourceId,
      });
    } catch (err) {
      console.error("[points] 자료 회수 실패 (무시):", (err as Error).message);
    }
  });
}

// ── getMyResources ─────────────────────────────────────────────────────────────

export interface MyResourceItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  resourceType: string;
  status: string;
  /** hidden 자료에 대한 사유 안내 (관리자가 숨김 처리한 경우) */
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 본인 자료 목록을 반환한다 (상태 배지·마이페이지 탭용, Story 4.8).
 *
 * - deleted 자료는 제외 (완전히 숨김)
 * - draft/published/hidden 자료 포함
 * - status 필터 파라미터 지원
 *
 * @param userId 요청자 ID
 * @param statuses 필터할 상태 목록 (기본: draft, published, hidden)
 * @returns 본인 자료 목록
 */
export async function getMyResources(
  userId: string,
  statuses?: string[],
): Promise<MyResourceItem[]> {
  const db = getDb();

  const validStatuses = (statuses ?? ["draft", "published", "hidden"]).filter(
    (s) => ["draft", "published", "hidden"].includes(s),
  ) as ("draft" | "published" | "hidden")[];

  const rows = await db
    .select({
      id: schema.resources.id,
      slug: schema.resources.slug,
      title: schema.resources.title,
      summary: schema.resources.summary,
      resourceType: schema.resources.resourceType,
      status: schema.resources.status,
      createdAt: schema.resources.createdAt,
      updatedAt: schema.resources.updatedAt,
    })
    .from(schema.resources)
    .where(
      and(
        eq(schema.resources.userId, userId),
        validStatuses.length > 0
          ? inArray(schema.resources.status, validStatuses)
          : undefined,
      ),
    )
    .orderBy(schema.resources.updatedAt);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    resourceType: r.resourceType,
    status: r.status,
    hiddenReason:
      r.status === "hidden" ? "관리자에 의해 숨김 처리된 자료입니다." : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
