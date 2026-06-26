/**
 * 스토리지 서비스 (Story 1.9 + MinIO 연동).
 *
 * 기본: S3 호환 객체 스토리지(로컬 MinIO / 운영 Cloudflare R2)에 업로드.
 * - 공개 버킷(S3_BUCKET_PUBLIC)에 저장하고 외부 접근 URL 을 반환한다.
 * - 아바타/배너는 위험도가 낮아 ClamAV 스캔 없이 크기·확장자 검증만 한다(실전자료는 Epic 4).
 *
 * 폴백: S3 env 미설정 시 로컬 파일시스템(apps/api/uploads/)에 저장(개발 편의).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@ai-jakdang/config";

/** 허용 이미지 MIME 타입 */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** 최대 업로드 크기 (5MB) */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** MIME → 확장자 매핑 */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** 업로드 결과 */
export interface UploadResult {
  url: string;
  filename: string;
}

/** 파싱된 파일 정보 */
export interface ParsedFile {
  filename: string;
  mimetype: string;
  data: Buffer;
}

/** S3 설정이 갖춰졌는지 여부 */
function isS3Configured(): boolean {
  return Boolean(
    env.S3_ENDPOINT &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY &&
      env.S3_BUCKET_PUBLIC,
  );
}

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION ?? "auto",
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return s3Client;
}

/** 공개 객체 베이스 URL: 명시 설정 우선, 없으면 endpoint/bucket 조합 */
function publicBaseUrl(): string {
  if (env.S3_PUBLIC_BASE_URL) return env.S3_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${(env.S3_ENDPOINT ?? "").replace(/\/$/, "")}/${env.S3_BUCKET_PUBLIC}`;
}

function buildKey(file: ParsedFile, subdir: "avatars" | "banners" | "editor-images" | "attachments"): string {
  const ext = MIME_TO_EXT[file.mimetype] ?? extname(file.filename) ?? ".bin";
  return `${subdir}/${randomUUID()}${ext}`;
}

/** S3(MinIO/R2) 공개 버킷에 업로드하고 외부 접근 URL 을 반환한다. */
async function uploadToS3(file: ParsedFile, subdir: "avatars" | "banners" | "editor-images" | "attachments"): Promise<UploadResult> {
  const key = buildKey(file, subdir);
  await getS3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Key: key,
      Body: file.data,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { url: `${publicBaseUrl()}/${key}`, filename: key.split("/").pop() as string };
}

/** 로컬 파일시스템 폴백 저장(S3 미설정 개발 환경). */
function uploadToLocal(file: ParsedFile, subdir: "avatars" | "banners" | "editor-images" | "attachments"): UploadResult {
  const dirUrl = fileURLToPath(new URL(".", import.meta.url));
  const uploadDir = join(dirUrl, "../../../../uploads", subdir);
  mkdirSync(uploadDir, { recursive: true });

  const ext = MIME_TO_EXT[file.mimetype] ?? extname(file.filename) ?? ".bin";
  const filename = `${randomUUID()}${ext}`;
  writeFileSync(join(uploadDir, filename), file.data);

  return { url: `/uploads/${subdir}/${filename}`, filename };
}

/**
 * 이미지 업로드 진입점.
 * S3 설정이 있으면 MinIO/R2, 없으면 로컬 폴백.
 */
export async function uploadImage(
  file: ParsedFile,
  subdir: "avatars" | "banners" | "editor-images" | "attachments",
): Promise<UploadResult> {
  if (isS3Configured()) {
    return uploadToS3(file, subdir);
  }
  return uploadToLocal(file, subdir);
}

/**
 * 게시글 첨부파일 업로드 진입점 — 이미지가 아닌 일반 파일(zip/pdf/문서 등)도 처리한다.
 * 공개 버킷의 `attachments/` 하위에 원본 확장자를 보존하여 저장하고 다운로드 URL 을 반환한다.
 * 확장자 화이트리스트 검증은 호출 측(라우트)에서 관리자 설정 기반으로 수행한다.
 */
export async function uploadAttachment(file: ParsedFile): Promise<UploadResult> {
  if (isS3Configured()) {
    return uploadToS3(file, "attachments");
  }
  return uploadToLocal(file, "attachments");
}

/**
 * 다운로드 프록시용: 공개 버킷 베이스 URL 반환.
 * SSRF 방지 화이트리스트 확인에 사용한다.
 */
export function getPublicBaseUrl(): string {
  return publicBaseUrl();
}

/**
 * 다운로드 프록시용: `/uploads/...` 형태의 로컬 URL을 실제 파일시스템 경로로 변환한다.
 * 경로 조작(path traversal) 공격 방지 검증 포함.
 * S3 URL 또는 잘못된 입력이면 null 반환.
 */
export function resolveLocalFilePath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const dirUrl = fileURLToPath(new URL(".", import.meta.url));
  const uploadsBase = resolve(join(dirUrl, "../../../../uploads"));
  const subPath = url.slice("/uploads/".length);
  // 빈 subPath 또는 상위 경로 탈출 시도 차단
  if (!subPath || subPath.includes("..")) return null;
  const resolved = resolve(join(uploadsBase, subPath));
  // 경로 조작 방지: resolved는 반드시 uploadsBase 하위여야 한다
  const base = uploadsBase.endsWith(sep) ? uploadsBase : uploadsBase + sep;
  if (!resolved.startsWith(base)) return null;
  return resolved;
}
