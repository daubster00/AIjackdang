/**
 * 파일 업로드 서비스 — Story 4.5
 *
 * 첨부파일 업로드 파이프라인:
 * 1. 확장자 화이트리스트 검증 → 실패 시 400 INVALID_FILE_TYPE
 * 2. 매직넘버 검증 → 실패 시 400 INVALID_FILE_SIGNATURE
 * 3. S3(private 버킷) 업로드 → storage_key 획득
 * 4. DB 트랜잭션: resource_files 배치 insert (scan_status='pending')
 * 5. 트랜잭션 후: file-scan BullMQ 큐에 resource.scan job 발행
 *
 * 아키텍처 가드레일:
 * - AR-2: DB insert는 db.transaction() 내, S3 업로드·큐 발행은 트랜잭션 외
 * - AR-4: env는 @ai-jakdang/config 단일 진입점만 사용
 * - AR-16: 큐명 'file-scan', job명 'resource.scan'
 */

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getDb, schema } from "@ai-jakdang/database";
import { validateFileSignature, ALLOWED_EXTENSIONS, type AllowedExtension } from "@ai-jakdang/utilities";
import { getS3Client, getPrivateBucket } from "../../../lib/s3.js";
import { getFileScanQueue, RESOURCE_SCAN_JOB_NAME } from "../../../lib/queues.js";

/** 업로드된 파일 데이터 구조 */
export interface UploadedFileData {
  originalName: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/** 업로드 결과 — 삽입된 resource_file 행 */
export interface UploadedFileResult {
  id: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  allowedExtension: AllowedExtension;
  scanStatus: "pending";
  displayOrder: number;
}

/** 업로드 에러 타입 */
export class UploadValidationError extends Error {
  constructor(
    public readonly code: "INVALID_FILE_TYPE" | "INVALID_FILE_SIGNATURE" | "FILE_TOO_LARGE",
    message: string,
    public readonly filename?: string,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 파일명에서 확장자를 추출한다(소문자, 점 없이).
 * 예: "report.docx" → "docx"
 */
function extractExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

/**
 * 자료 첨부파일 업로드를 처리한다.
 *
 * @param resourceId 소속 자료 ID
 * @param files 업로드된 파일 목록(최대 3개)
 * @returns 삽입된 resource_files 행 목록
 * @throws UploadValidationError 확장자/매직넘버/크기 검증 실패 시
 */
export async function uploadResourceFiles(
  resourceId: string,
  files: UploadedFileData[],
): Promise<UploadedFileResult[]> {
  // ── Step 1 & 2: 모든 파일 검증 (업로드 전 일괄 검증) ─────────────────────────
  for (const file of files) {
    // 파일 크기 검증 (service 레이어 2차 방어 — 라우트에서 1차 차단)
    if (file.size > MAX_FILE_SIZE) {
      throw new UploadValidationError(
        "FILE_TOO_LARGE",
        `파일 크기 초과: ${file.originalName} (최대 50MB)`,
        file.originalName,
      );
    }

    const ext = extractExtension(file.originalName);

    // 확장자 화이트리스트 검증
    if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
      throw new UploadValidationError(
        "INVALID_FILE_TYPE",
        `허용되지 않는 파일 형식: ${file.originalName} (.${ext})`,
        file.originalName,
      );
    }

    // 매직넘버 검증 (첫 512바이트로 실제 파일 형식 확인)
    const valid = validateFileSignature(file.buffer, ext);
    if (!valid) {
      throw new UploadValidationError(
        "INVALID_FILE_SIGNATURE",
        `파일 시그니처 불일치: ${file.originalName}`,
        file.originalName,
      );
    }
  }

  // ── Step 3: S3 업로드 (트랜잭션 외) ──────────────────────────────────────────
  const s3 = getS3Client();
  const bucket = getPrivateBucket();

  const uploadedKeys: Array<{
    storageKey: string;
    file: UploadedFileData;
    ext: AllowedExtension;
  }> = [];

  for (const file of files) {
    const ext = extractExtension(file.originalName) as AllowedExtension;
    const storageKey = `resources/${resourceId}/${randomUUID()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    uploadedKeys.push({ storageKey, file, ext });
  }

  // ── Step 4: DB 트랜잭션 — resource_files 배치 insert ─────────────────────────
  const db = getDb();
  const insertedIds: string[] = [];

  const insertedFiles = await db.transaction(async (tx) => {
    const rows = uploadedKeys.map(({ storageKey, file, ext }, index) => ({
      id: randomUUID(),
      resourceId,
      originalName: file.originalName,
      storageKey,
      fileSize: file.size,
      mimeType: file.mimetype,
      allowedExtension: ext,
      isPrimary: index === 0, // 첫 번째 파일을 대표 파일로 설정
      scanStatus: "pending" as const,
      displayOrder: index,
    }));

    const inserted = await tx
      .insert(schema.resourceFiles)
      .values(rows)
      .returning({
        id: schema.resourceFiles.id,
        originalName: schema.resourceFiles.originalName,
        storageKey: schema.resourceFiles.storageKey,
        fileSize: schema.resourceFiles.fileSize,
        mimeType: schema.resourceFiles.mimeType,
        allowedExtension: schema.resourceFiles.allowedExtension,
        scanStatus: schema.resourceFiles.scanStatus,
        displayOrder: schema.resourceFiles.displayOrder,
      });

    for (const row of inserted) {
      insertedIds.push(row.id);
    }

    return inserted;
  });

  // ── Step 5: BullMQ job 발행 (트랜잭션 커밋 후) ───────────────────────────────
  const queue = getFileScanQueue();
  await queue.add(RESOURCE_SCAN_JOB_NAME, {
    resourceFileIds: insertedIds,
    resourceId,
  });

  return insertedFiles.map((row) => ({
    ...row,
    scanStatus: "pending" as const,
    allowedExtension: row.allowedExtension as AllowedExtension,
  }));
}
