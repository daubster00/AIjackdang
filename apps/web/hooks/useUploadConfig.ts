"use client";

/**
 * useUploadConfig — 업로드 허용 확장자·크기 설정을 공개 API에서 동적으로 조회하는 훅.
 *
 * GET /api/v1/settings/public 에서 file_allowed_extensions · resource_extensions ·
 * image_extensions · max_upload_mb 를 받아 정규화(소문자, 앞 '.' 제거, trim)한다.
 *
 * 응답 전·오류 시에는 하드코딩된 폴백값을 반환하므로 항상 안전하게 사용 가능.
 *
 * [갱신 정책 — stale-while-revalidate]
 * 마운트(=폼 페이지로 이동)할 때마다 새로 fetch 하되, 직전에 성공한 값(_cached)을
 * 즉시 보여 주고 백그라운드 재요청 결과로 갱신한다. 동시 마운트한 여러 컴포넌트는
 * 진행 중(_inflight) fetch 를 공유해 중복 요청을 막는다.
 * → 관리자가 허용 확장자를 바꾸면, 사용자는 **전체 새로고침 없이 다음 페이지 이동만으로**
 *    갱신된 값을 본다(모듈 캐시를 영구 고정하던 기존 버그를 해소).
 */

import { useEffect, useState } from "react";

// ── 폴백 기본값 ──────────────────────────────────────────────────────────────
/** 게시글 첨부파일 기본 허용 확장자 (file_allowed_extensions 폴백) */
const FILE_EXT_FALLBACK = ["zip", "pdf", "json", "md", "txt", "csv", "xlsx", "docx"];
/** 실전자료 첨부파일 기본 허용 확장자 (resource_extensions 폴백) */
const RESOURCE_EXT_FALLBACK = ["zip", "md", "txt", "json", "pdf", "docx", "xlsx"];
/** 기본 최대 업로드 크기 (MB) */
const MAX_MB_FALLBACK = 10;

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface UploadConfig {
  /** 게시글 첨부 허용 확장자 배열 (점 없음, 소문자). 예: ["zip","pdf","docx"] */
  fileExtensions: string[];
  /** 실전자료 첨부 허용 확장자 배열 (점 없음, 소문자). 예: ["zip","md","json"] */
  resourceExtensions: string[];
  /** 파일당 최대 업로드 크기 (MB) */
  maxUploadMb: number;
  /**
   * accept 속성 문자열 생성 헬퍼.
   * 예: toAccept(fileExtensions) → ".zip,.pdf,.json,.md"
   */
  toAccept: (exts: string[]) => string;
}

// ── 내부 정규화 유틸 ──────────────────────────────────────────────────────────
function normalizeExts(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}

function toAccept(exts: string[]): string {
  return exts.map((e) => `.${e}`).join(",");
}

const DEFAULT_CONFIG: UploadConfig = {
  fileExtensions: FILE_EXT_FALLBACK,
  resourceExtensions: RESOURCE_EXT_FALLBACK,
  maxUploadMb: MAX_MB_FALLBACK,
  toAccept,
};

// ── 모듈 수준 캐시 (stale-while-revalidate) ────────────────────────────────────
/** 직전에 성공한 설정 — 다음 마운트에서 즉시 표시(재요청 결과로 곧 갱신). */
let _cached: UploadConfig | null = null;
/** 진행 중인 fetch — 동시 마운트가 공유해 중복 요청을 막는다. 끝나면 null 로 리셋. */
let _inflight: Promise<UploadConfig> | null = null;

/** 진행 중 요청이 있으면 재사용, 없으면 새로 시작. 성공 결과는 _cached 에 보관. */
function refreshUploadConfig(): Promise<UploadConfig> {
  if (!_inflight) {
    _inflight = fetchUploadConfig()
      .then((result) => {
        _cached = result;
        return result;
      })
      .catch(() => _cached ?? DEFAULT_CONFIG)
      .finally(() => {
        _inflight = null;
      });
  }
  return _inflight;
}

async function fetchUploadConfig(): Promise<UploadConfig> {
  const res = await fetch("/api/v1/settings/public");
  if (!res.ok) return DEFAULT_CONFIG;

  const data = (await res.json()) as Record<string, unknown>;

  const fileExts = normalizeExts(data["file_allowed_extensions"]);
  const resourceExts = normalizeExts(data["resource_extensions"]);
  const rawMb = data["max_upload_mb"];
  const maxMb =
    typeof rawMb === "number"
      ? rawMb
      : typeof rawMb === "string"
        ? parseFloat(rawMb) || MAX_MB_FALLBACK
        : MAX_MB_FALLBACK;

  return {
    fileExtensions: fileExts.length > 0 ? fileExts : FILE_EXT_FALLBACK,
    resourceExtensions: resourceExts.length > 0 ? resourceExts : RESOURCE_EXT_FALLBACK,
    maxUploadMb: maxMb > 0 ? maxMb : MAX_MB_FALLBACK,
    toAccept,
  };
}

// ── 훅 ───────────────────────────────────────────────────────────────────────
/**
 * 업로드 설정 훅.
 *
 * @example
 * const { fileExtensions, toAccept } = useUploadConfig();
 * // accept 속성: toAccept(fileExtensions)  → ".zip,.pdf,.docx"
 * // 안내 문구:   fileExtensions.join(", ") → "zip, pdf, docx"
 */
export function useUploadConfig(): UploadConfig {
  // 직전 성공값(_cached)이 있으면 깜빡임 없이 즉시 표시, 없으면 폴백
  const [config, setConfig] = useState<UploadConfig>(() => _cached ?? DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    // 마운트(=폼 페이지 진입)마다 재요청 → 관리자 설정 변경이 새로고침 없이 반영
    refreshUploadConfig().then((result) => {
      if (!cancelled) setConfig(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
