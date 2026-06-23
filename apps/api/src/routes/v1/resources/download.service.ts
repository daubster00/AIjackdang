/**
 * 실전자료 다운로드 서비스 — Story 4.6
 *
 * downloadResource(resourceId, userId):
 *   - 대표 파일(is_primary=true) presigned URL 반환 + download_count 원자적 +1
 *   - scan_status 분기: clean만 허용, pending→409, infected→403, error→503
 *
 * downloadFile(resourceId, fileId, userId):
 *   - 비대표 파일 presigned URL 반환 (download_count 미집계)
 *   - scan_status=clean 확인
 *
 * 아키텍처 가드레일:
 * - AR-15: 다운로드 API는 회원 전용(requireAuthHook가 401 처리)
 * - presigned URL 만료: 60초
 * - 카운트 집계: 대표 파일만, 원자적 SQL 업데이트(NFR-6·AR-16 TODO주석)
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getPresignedDownloadUrl } from "../../../lib/s3.js";

export interface DownloadResult {
  url: string;
  expiresAt: string; // ISO 8601 UTC
  fileName: string;
}

/** scan_status 기반 에러 분류 */
export class DownloadBlockedError extends Error {
  constructor(
    public readonly code: "RESOURCE_SCAN_PENDING" | "RESOURCE_INFECTED" | "RESOURCE_SCAN_ERROR",
    public readonly statusCode: 409 | 403 | 503,
    message: string,
  ) {
    super(message);
    this.name = "DownloadBlockedError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message = "자료를 찾을 수 없습니다.") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class FileNotFoundError extends Error {
  constructor(message = "파일을 찾을 수 없습니다.") {
    super(message);
    this.name = "FileNotFoundError";
  }
}

/**
 * 대표 파일 다운로드: presigned URL 반환 + download_count 원자적 +1.
 *
 * @param resourceId - resources.id (UUID)
 * @param _userId    - 인증 사용자 ID (requireAuthHook 이후 보장; 로깅 예약)
 */
export async function downloadResource(
  resourceId: string,
  _userId: string,
): Promise<DownloadResult> {
  const db = getDb();

  // ── 1. resource 존재 확인 ────────────────────────────────────────────────────
  const resources = await db
    .select({ id: schema.resources.id })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (resources.length === 0) {
    throw new ResourceNotFoundError();
  }

  // ── 2. 대표 파일 조회 ────────────────────────────────────────────────────────
  const files = await db
    .select({
      id: schema.resourceFiles.id,
      storageKey: schema.resourceFiles.storageKey,
      originalName: schema.resourceFiles.originalName,
      scanStatus: schema.resourceFiles.scanStatus,
    })
    .from(schema.resourceFiles)
    .where(
      and(
        eq(schema.resourceFiles.resourceId, resourceId),
        eq(schema.resourceFiles.isPrimary, true),
      ),
    )
    .limit(1);

  if (files.length === 0) {
    throw new FileNotFoundError("대표 파일을 찾을 수 없습니다.");
  }

  const file = files[0];

  // ── 3. scan_status 분기 ──────────────────────────────────────────────────────
  if (file.scanStatus === "pending") {
    throw new DownloadBlockedError(
      "RESOURCE_SCAN_PENDING",
      409,
      "파일 보안 검사가 진행 중입니다. 잠시 후 다시 시도해주세요.",
    );
  }
  if (file.scanStatus === "infected") {
    throw new DownloadBlockedError(
      "RESOURCE_INFECTED",
      403,
      "보안 검사에서 문제가 발견된 파일입니다.",
    );
  }
  if (file.scanStatus === "error") {
    throw new DownloadBlockedError(
      "RESOURCE_SCAN_ERROR",
      503,
      "파일 보안 검사 중 오류가 발생했습니다. 관리자에게 문의해주세요.",
    );
  }

  // ── 4. presigned URL 생성 (60초 만료) ────────────────────────────────────────
  const expiresIn = 60;
  const presignedUrl = await getPresignedDownloadUrl(file.storageKey, expiresIn);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // ── 5. download_count 원자적 증가 ────────────────────────────────────────────
  // TODO: 고트래픽 시 stats BullMQ 큐로 전환 (AR-16)
  await db
    .update(schema.resources)
    .set({ downloadCount: sql`${schema.resources.downloadCount} + 1` })
    .where(eq(schema.resources.id, resourceId));

  return {
    url: presignedUrl,
    expiresAt,
    fileName: file.originalName,
  };
}

/**
 * 비대표 파일 다운로드: presigned URL 반환. download_count 미집계.
 *
 * @param resourceId - resources.id (UUID)
 * @param fileId     - resource_files.id (UUID)
 * @param _userId    - 인증 사용자 ID (requireAuthHook 이후 보장; 로깅 예약)
 */
export async function downloadFile(
  resourceId: string,
  fileId: string,
  _userId: string,
): Promise<DownloadResult> {
  const db = getDb();

  // ── 파일 조회 (resourceId + fileId 일치 확인) ────────────────────────────────
  const files = await db
    .select({
      id: schema.resourceFiles.id,
      storageKey: schema.resourceFiles.storageKey,
      originalName: schema.resourceFiles.originalName,
      scanStatus: schema.resourceFiles.scanStatus,
    })
    .from(schema.resourceFiles)
    .where(
      and(
        eq(schema.resourceFiles.id, fileId),
        eq(schema.resourceFiles.resourceId, resourceId),
      ),
    )
    .limit(1);

  if (files.length === 0) {
    throw new FileNotFoundError();
  }

  const file = files[0];

  // ── scan_status 분기 ────────────────────────────────────────────────────────
  if (file.scanStatus === "pending") {
    throw new DownloadBlockedError(
      "RESOURCE_SCAN_PENDING",
      409,
      "파일 보안 검사가 진행 중입니다. 잠시 후 다시 시도해주세요.",
    );
  }
  if (file.scanStatus === "infected") {
    throw new DownloadBlockedError(
      "RESOURCE_INFECTED",
      403,
      "보안 검사에서 문제가 발견된 파일입니다.",
    );
  }
  if (file.scanStatus === "error") {
    throw new DownloadBlockedError(
      "RESOURCE_SCAN_ERROR",
      503,
      "파일 보안 검사 중 오류가 발생했습니다. 관리자에게 문의해주세요.",
    );
  }

  // ── presigned URL 생성 (60초 만료) ──────────────────────────────────────────
  const expiresIn = 60;
  const presignedUrl = await getPresignedDownloadUrl(file.storageKey, expiresIn);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // 비대표 파일: download_count 미집계

  return {
    url: presignedUrl,
    expiresAt,
    fileName: file.originalName,
  };
}
