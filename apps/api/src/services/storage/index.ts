/**
 * 스토리지 서비스 (Story 1.9).
 *
 * MinIO/S3 env 미설정 시 로컬 파일시스템 폴백.
 * - 없으면 apps/api/uploads/ 디렉터리에 저장하고 /uploads/{subdir}/{filename} URL 반환.
 *
 * 편차: @fastify/multipart 미설치 환경 — Node.js 내장 파서로 대체.
 *       프로덕션 스토리지(MinIO/S3) 미연결 상태에서 로컬 FS 폴백 사용.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

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

/**
 * 로컬 파일시스템에 저장하고 공개 URL 을 반환한다.
 * `subdir`: 'avatars' | 'banners'
 */
export function uploadToLocal(file: ParsedFile, subdir: "avatars" | "banners"): UploadResult {
  // import.meta.url 기준으로 apps/api/uploads/{subdir}/ 디렉터리
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const uploadDir = join(__dirname, "../../../../uploads", subdir);
  mkdirSync(uploadDir, { recursive: true });

  const ext = MIME_TO_EXT[file.mimetype] ?? extname(file.filename) ?? ".bin";
  const filename = `${randomUUID()}${ext}`;
  const dest = join(uploadDir, filename);

  writeFileSync(dest, file.data);

  const url = `/uploads/${subdir}/${filename}`;
  return { url, filename };
}

/**
 * 이미지 업로드 진입점.
 * 현재는 로컬 폴백만; MinIO/S3 env 설정 시 여기서 분기.
 */
export function uploadImage(file: ParsedFile, subdir: "avatars" | "banners"): UploadResult {
  // TODO(스토리지 단계): MINIO_ENDPOINT env 있을 때 MinIO 업로드로 분기
  return uploadToLocal(file, subdir);
}
