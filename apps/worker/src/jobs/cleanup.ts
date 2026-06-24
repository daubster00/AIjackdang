/**
 * content.cleanup job processor — Story 9.10.
 *
 * BullMQ 'cleanup' 큐에서 'content.cleanup' job 처리.
 *
 * 동작:
 * 1. site_settings에서 content_retention_days 조회 (기본 30)
 * 2. status='deleted' AND deleted_at < NOW() - retention 레코드를 순서대로 hard-delete
 *    - posts, qna_questions, qna_answers, comments, resources
 * 3. resource_files: resource hard-delete 전에 storageKey 목록 수집 → R2 삭제 시도
 *    (R2 삭제 실패 시 DB 삭제는 계속 진행 — 고아 오브젝트 정리는 별도 운영 작업)
 * 4. 멱등성: WHERE 절 조건에만 의존. 이미 없는 레코드는 자연 skip.
 *
 * 큐명: 'cleanup'  (QUEUE_NAMES.cleanup 기존 큐 재사용)
 * job명: 'content.cleanup'
 * cron: '0 3 * * *' (매일 새벽 3시)
 */

import type { Job } from "bullmq";
import { getDb } from "@ai-jakdang/database";
import {
  posts,
  questions,
  answers,
  comments,
  resources,
  resourceFiles,
  siteSettings,
} from "@ai-jakdang/database/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ── R2/S3 클라이언트 (옵션) ─────────────────────────────────────────────────

let _s3: S3Client | null = null;

function getS3OrNull(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null; // S3 미설정 환경(개발) — R2 삭제 skip
  }

  if (!_s3) {
    _s3 = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _s3;
}

async function deleteR2Object(storageKey: string): Promise<void> {
  const s3 = getS3OrNull();
  if (!s3) return; // S3 미설정 시 skip (개발 환경)

  const bucket = process.env.S3_BUCKET_PRIVATE ?? process.env.S3_BUCKET_PUBLIC;
  if (!bucket) return;

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  } catch (err) {
    // R2 삭제 실패는 경고만 — DB 삭제는 계속 진행
    console.warn(`[cleanup] R2 오브젝트 삭제 실패 (${storageKey}):`, (err as Error).message);
  }
}

// ── 보존 기간 조회 ──────────────────────────────────────────────────────────

async function getRetentionDays(): Promise<number> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "content_retention_days"))
      .limit(1);

    if (row?.value != null) {
      const val = Number(row.value);
      if (Number.isFinite(val) && val > 0) return val;
    }
  } catch {
    // site_settings 테이블 미존재 혹은 조회 실패 시 기본값 사용
  }
  return 30;
}

// ── 메인 처리기 ──────────────────────────────────────────────────────────────

export async function contentCleanupProcessor(job: Job): Promise<void> {
  if (job.name !== "content.cleanup") {
    console.warn(`[cleanup] 알 수 없는 job.name: ${job.name} — skip`);
    return;
  }

  const retentionDays = await getRetentionDays();
  console.log(`[cleanup] content.cleanup 시작. 보존 기간: ${retentionDays}일`);

  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;

  // ── 1. posts ──────────────────────────────────────────────────────────────
  const deletedPosts = await db
    .delete(posts)
    .where(
      and(
        eq(posts.status, "deleted"),
        lt(posts.deletedAt, cutoff),
      ),
    )
    .returning({ id: posts.id });

  totalDeleted += deletedPosts.length;
  if (deletedPosts.length > 0) {
    console.log(`[cleanup] posts hard-delete: ${deletedPosts.length}건`);
  }

  // ── 2. qna_questions ──────────────────────────────────────────────────────
  const deletedQuestions = await db
    .delete(questions)
    .where(
      and(
        eq(questions.status, "deleted"),
        lt(questions.deletedAt, cutoff),
      ),
    )
    .returning({ id: questions.id });

  totalDeleted += deletedQuestions.length;
  if (deletedQuestions.length > 0) {
    console.log(`[cleanup] questions hard-delete: ${deletedQuestions.length}건`);
  }

  // ── 3. qna_answers ────────────────────────────────────────────────────────
  const deletedAnswers = await db
    .delete(answers)
    .where(
      and(
        eq(answers.status, "deleted"),
        lt(answers.deletedAt, cutoff),
      ),
    )
    .returning({ id: answers.id });

  totalDeleted += deletedAnswers.length;
  if (deletedAnswers.length > 0) {
    console.log(`[cleanup] answers hard-delete: ${deletedAnswers.length}건`);
  }

  // ── 4. comments ───────────────────────────────────────────────────────────
  const deletedComments = await db
    .delete(comments)
    .where(
      and(
        eq(comments.status, "deleted"),
        lt(comments.deletedAt, cutoff),
      ),
    )
    .returning({ id: comments.id });

  totalDeleted += deletedComments.length;
  if (deletedComments.length > 0) {
    console.log(`[cleanup] comments hard-delete: ${deletedComments.length}건`);
  }

  // ── 5. resources — R2 파일 먼저 삭제 후 레코드 삭제 ─────────────────────
  // 5a. 삭제 예정 resource id 목록 조회
  const expiredResources = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.status, "deleted"),
        lt(resources.deletedAt, cutoff),
      ),
    );

  if (expiredResources.length > 0) {
    const resourceIds = expiredResources.map((r) => r.id);

    // 5b. resource_files storageKey 수집
    const files = await db
      .select({ id: resourceFiles.id, storageKey: resourceFiles.storageKey })
      .from(resourceFiles)
      .where(inArray(resourceFiles.resourceId, resourceIds));

    // 5c. R2 오브젝트 삭제 (실패해도 계속)
    for (const file of files) {
      await deleteR2Object(file.storageKey);
    }

    // 5d. resource_files rows hard-delete
    if (files.length > 0) {
      await db
        .delete(resourceFiles)
        .where(inArray(resourceFiles.resourceId, resourceIds));
      console.log(`[cleanup] resource_files hard-delete: ${files.length}건`);
    }

    // 5e. resources rows hard-delete
    const deletedResources = await db
      .delete(resources)
      .where(inArray(resources.id, resourceIds))
      .returning({ id: resources.id });

    totalDeleted += deletedResources.length;
    console.log(`[cleanup] resources hard-delete: ${deletedResources.length}건`);
  }

  console.log(`[cleanup] content.cleanup 완료. 총 ${totalDeleted}건 hard-delete.`);
}
