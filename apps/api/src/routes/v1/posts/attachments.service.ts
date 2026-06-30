/**
 * 게시글 첨부파일 업로드 서비스.
 *
 * 자료실(resource_files)의 ClamAV 스캔 파이프라인과 달리, 게시글 첨부는 공개 버킷에
 * 직접 저장하고 URL 로 바로 다운로드한다. 허용 확장자는 관리자 설정
 * site_settings.file_allowed_extensions(쉼표 구분 문자열)로 제어한다.
 *
 * 검증 순서: 확장자 화이트리스트(관리자 설정) → 공개 버킷 업로드 → 메타 반환.
 * 파일당 10MB·게시글당 최대 5개 제한은 라우트 레이어에서 1차 차단한다.
 */

import { extname } from "node:path";
import type { AttachmentInput } from "@ai-jakdang/contracts";
import { getSiteSetting } from "../../../lib/siteSettings.js";
import { uploadAttachment } from "../../../services/storage/index.js";

/** 게시글 첨부파일 기본 허용 확장자 (관리자 UI 기본값·file_allowed_extensions 미지정 시). */
const DEFAULT_ALLOWED_EXTENSIONS = ["zip", "pdf", "json", "md", "txt", "csv", "xlsx"];

/** 실전자료 첨부파일 기본 허용 확장자 (resource_extensions·file_allowed_extensions 미지정 시). */
const DEFAULT_RESOURCE_EXTENSIONS = ["zip", "docx", "xlsx", "pdf", "md", "txt", "json"];

/** 기본 업로드 크기 제한 (MB). max_upload_mb 미지정 시 사용. */
const DEFAULT_MAX_UPLOAD_MB = 10;

/** 멀티파트에서 수집한 업로드 파일 1개. */
export interface UploadedAttachmentData {
  originalName: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/** 첨부 검증 실패. 라우트에서 400 으로 변환한다. */
export class AttachmentValidationError extends Error {
  constructor(
    public readonly code: "INVALID_FILE_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

/** 파일명에서 확장자를 추출한다(소문자, 점 없이). 예: "report.PDF" → "pdf" */
function extractExtension(filename: string): string {
  return extname(filename).replace(/^\./, "").toLowerCase();
}

/**
 * 관리자 설정(file_allowed_extensions)에서 허용 확장자 목록을 읽는다.
 * "zip, pdf, json" 같은 쉼표 구분 문자열을 파싱한다. 미설정 시 기본값.
 */
export async function getAllowedAttachmentExtensions(): Promise<string[]> {
  const raw = await getSiteSetting<string>("file_allowed_extensions");
  if (typeof raw !== "string" || raw.trim() === "") {
    return DEFAULT_ALLOWED_EXTENSIONS;
  }
  const parsed = raw
    .split(",")
    .map((e) => e.trim().replace(/^\./, "").toLowerCase())
    .filter((e) => e.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_EXTENSIONS;
}

/**
 * 관리자 설정(resource_extensions)에서 실전자료 허용 확장자 목록을 읽는다.
 * resource_extensions 미설정 시 file_allowed_extensions 로 폴백, 그것도 미설정이면 기본값 사용.
 */
export async function getAllowedResourceExtensions(): Promise<string[]> {
  // resource_extensions 전용 설정 우선 조회
  const resRaw = await getSiteSetting<string>("resource_extensions");
  if (typeof resRaw === "string" && resRaw.trim() !== "") {
    const parsed = resRaw
      .split(",")
      .map((e) => e.trim().replace(/^\./, "").toLowerCase())
      .filter((e) => e.length > 0);
    if (parsed.length > 0) return parsed;
  }

  // resource_extensions 미설정 → file_allowed_extensions 폴백
  const raw = await getSiteSetting<string>("file_allowed_extensions");
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = raw
      .split(",")
      .map((e) => e.trim().replace(/^\./, "").toLowerCase())
      .filter((e) => e.length > 0);
    if (parsed.length > 0) return parsed;
  }

  return DEFAULT_RESOURCE_EXTENSIONS;
}

/**
 * 관리자 설정(max_upload_mb)에서 파일당 최대 업로드 크기를 바이트 단위로 읽는다.
 * @param fallbackMb max_upload_mb 미설정 시 사용할 기본값(MB). 기본 10MB.
 */
export async function getMaxUploadBytes(fallbackMb = DEFAULT_MAX_UPLOAD_MB): Promise<number> {
  const raw = await getSiteSetting<number>("max_upload_mb");
  const mb = typeof raw === "number" && raw > 0 ? raw : fallbackMb;
  return mb * 1024 * 1024;
}

/**
 * 게시글 첨부파일들을 검증 후 공개 버킷에 업로드하고 메타데이터를 반환한다.
 * 반환값은 그대로 createPost 본문의 attachments 필드로 전달된다.
 */
export async function uploadPostAttachments(
  files: UploadedAttachmentData[],
): Promise<AttachmentInput[]> {
  const allowed = await getAllowedAttachmentExtensions();

  // ── 1) 확장자 화이트리스트 검증 (업로드 전 일괄) ────────────────────────────
  for (const file of files) {
    const ext = extractExtension(file.originalName);
    if (!ext || !allowed.includes(ext)) {
      throw new AttachmentValidationError(
        "INVALID_FILE_TYPE",
        `허용되지 않는 파일 형식입니다: ${file.originalName}. 허용 확장자: ${allowed.join(", ")}`,
      );
    }
  }

  // ── 2) 공개 버킷 업로드 → 메타 수집 ────────────────────────────────────────
  const results: AttachmentInput[] = [];
  for (const file of files) {
    const { url } = await uploadAttachment({
      filename: file.originalName,
      mimetype: file.mimetype,
      data: file.buffer,
    });
    results.push({
      url,
      name: file.originalName,
      size: file.size,
      mimeType: file.mimetype,
    });
  }

  return results;
}
