/**
 * 실전자료 상세 서비스 — Story 4.3
 *
 * getResourceBySlug: slug로 published 자료 단건 조회.
 * - status=deleted → 404 (null 반환)
 * - status=hidden  → 비회원/일반 회원에게 404 (null 반환, 4.8에서 admin 예외 연결)
 * - status=published → 전체 공개
 * - files 배열: isPrimary=true 우선 정렬 후 displayOrder 오름차순
 * - avgRating: DB numeric(문자열) → number 변환
 * - userIsOwner: userId === resource.userId
 * - commentCount: Epic 5 이전 0 고정
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { ResourceDetail } from "@ai-jakdang/contracts";
import { eq, asc, desc } from "drizzle-orm";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";

export interface GetResourceBySlugParams {
  slug: string;
  userId?: string;
}

/**
 * slug로 실전자료 상세 조회.
 *
 * @returns `ResourceDetail & { userIsOwner: boolean }` 또는 null (404 대상)
 */
/** 상세 응답 확장 타입 (HTML 변환본 + userIsOwner 포함) */
export type ResourceDetailExtended = ResourceDetail & {
  userIsOwner: boolean;
  descriptionHtml: string;
  usageHtml: string;
  cautionHtml: string | null;
};

export async function getResourceBySlug({
  slug,
  userId,
}: GetResourceBySlugParams): Promise<ResourceDetailExtended | null> {
  const db = getDb();

  // ── 자료 + 작성자 LEFT JOIN ──────────────────────────────────────────────────
  const rows = await db
    .select({
      // resources 컬럼
      id: schema.resources.id,
      slug: schema.resources.slug,
      title: schema.resources.title,
      summary: schema.resources.summary,
      resourceType: schema.resources.resourceType,
      environment: schema.resources.environment,
      difficulty: schema.resources.difficulty,
      descriptionJson: schema.resources.descriptionJson,
      usageJson: schema.resources.usageJson,
      cautionJson: schema.resources.cautionJson,
      version: schema.resources.version,
      referenceLinks: schema.resources.referenceLinks,
      status: schema.resources.status,
      downloadCount: schema.resources.downloadCount,
      avgRating: schema.resources.avgRating,
      ratingCount: schema.resources.ratingCount,
      createdAt: schema.resources.createdAt,
      updatedAt: schema.resources.updatedAt,
      userId: schema.resources.userId,
      // 작성자 정보 (탈퇴 시 null)
      authorNickname: schema.users.nickname,
      authorAvatarIndex: schema.users.defaultAvatarIndex,
    })
    .from(schema.resources)
    .leftJoin(schema.users, eq(schema.resources.userId, schema.users.id))
    .where(eq(schema.resources.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const resource = rows[0];

  // ── 운영 상태 검증 ────────────────────────────────────────────────────────────
  if (resource.status === "deleted") return null;
  // hidden: 소유자에게는 공개 (AC #7, Story 4.8), 타인·비회원은 404
  if (resource.status === "hidden") {
    const isOwner = !!userId && !!resource.userId && userId === resource.userId;
    if (!isOwner) return null;
  }
  // draft: 소유자에게만 공개 (수정 페이지에서 prefill 필요)
  if (resource.status === "draft") {
    const isOwner = !!userId && !!resource.userId && userId === resource.userId;
    if (!isOwner) return null;
  }

  // ── 파일 목록 조회 ────────────────────────────────────────────────────────────
  const files = await db
    .select({
      id: schema.resourceFiles.id,
      originalName: schema.resourceFiles.originalName,
      storageKey: schema.resourceFiles.storageKey,
      fileSize: schema.resourceFiles.fileSize,
      mimeType: schema.resourceFiles.mimeType,
      allowedExtension: schema.resourceFiles.allowedExtension,
      isPrimary: schema.resourceFiles.isPrimary,
      scanStatus: schema.resourceFiles.scanStatus,
      displayOrder: schema.resourceFiles.displayOrder,
    })
    .from(schema.resourceFiles)
    .where(eq(schema.resourceFiles.resourceId, resource.id))
    .orderBy(desc(schema.resourceFiles.isPrimary), asc(schema.resourceFiles.displayOrder));

  // ── avgRating: DB numeric → number 변환 ──────────────────────────────────────
  const avgRatingNum =
    resource.avgRating != null ? parseFloat(String(resource.avgRating)) : 0;

  // ── userIsOwner 판단 ──────────────────────────────────────────────────────────
  const userIsOwner = !!userId && !!resource.userId && userId === resource.userId;

  // ── Tiptap JSON → 안전 HTML 변환 (AR-8) ─────────────────────────────────────
  const descriptionHtml = tiptapJsonToHtml(resource.descriptionJson);
  const usageHtml = tiptapJsonToHtml(resource.usageJson);
  const cautionHtml = resource.cautionJson ? tiptapJsonToHtml(resource.cautionJson) : null;

  return {
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    summary: resource.summary,
    resourceType: resource.resourceType,
    environment: resource.environment ?? [],
    difficulty: resource.difficulty,
    authorId: resource.userId ?? null,
    authorNickname: resource.authorNickname ?? null,
    authorAvatarIndex: resource.authorAvatarIndex ?? 0,
    avgRating: avgRatingNum,
    ratingCount: resource.ratingCount,
    downloadCount: resource.downloadCount,
    commentCount: 0, // TODO: Epic 5 활성화 전 0 고정
    tagNames: [], // TODO: tags 도메인 연결 후 채움
    updatedAt: resource.updatedAt.toISOString(),
    createdAt: resource.createdAt.toISOString(),
    status: resource.status,
    descriptionJson: resource.descriptionJson as Record<string, unknown>,
    usageJson: resource.usageJson as Record<string, unknown>,
    cautionJson: resource.cautionJson as Record<string, unknown> | null,
    version: resource.version ?? null,
    referenceLinks: resource.referenceLinks as { label: string; url: string }[] | null,
    files,
    userIsOwner,
    // HTML 변환본 — web SSR에서 dangerouslySetInnerHTML로 렌더 (AR-8 sanitize-html 처리됨)
    descriptionHtml,
    usageHtml,
    cautionHtml,
  };
}
