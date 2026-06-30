"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { API_BASE_URL } from "../../../lib/api";
import { Select } from "@/components/ui/Select";

/**
 * 사이트 설정 응답 타입 (로컬 정의 — 오케스트레이터가 packages/contracts/src/index.ts 에
 * `export * from "./admin/settings"` 를 추가한 후에는 @ai-jakdang/contracts 에서 import 가능).
 */
interface AdminSettingsResponse {
  site_name?: unknown;
  operator_email?: unknown;
  site_description?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  og_image?: unknown;
  favicon_url?: unknown;
  auto_hide_enabled?: unknown;
  auto_hide_threshold?: unknown;
  report_reasons?: unknown;
  forbidden_words?: unknown;
  content_retention_days?: unknown;
  popular_post_metric?: unknown;
  popular_resource_metric?: unknown;
  file_allowed_extensions?: unknown;
  max_upload_mb?: unknown;
  image_extensions?: unknown;
  resource_extensions?: unknown;
}

/**
 * 사이트 설정 탭 패널 전환 + 실제 API 연동 클라이언트 컴포넌트 (Story 9.15).
 *
 * - GET /api/v1/admin/settings → 실제 DB 값으로 각 탭 필드를 채운다.
 * - 탭별 저장 버튼 → PATCH /api/v1/admin/settings → 성공/실패 토스트.
 * - activeTab React 상태로 탭 패널 가시성을 제어한다.
 *   (DOM 직접 조작 방식 대신 admin:tab-change 이벤트를 수신해 activeTab 상태 업데이트 →
 *   패널 section에 style.display를 조건부로 적용. useEffect 레이스 컨디션 방지)
 */

// ── 토스트 ─────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "14px 24px",
        fontSize: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 금칙어 태그 입력 ───────────────────────────────────────────────────────────

function TagInput({
  tags,
  placeholder,
  onChange,
}: {
  tags: string[];
  placeholder?: string;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button type="button" aria-label="태그 삭제" onClick={() => removeTag(tag)}>
            <i className="ri-close-line" />
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder={placeholder ?? "입력 후 Enter"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
        }}
      />
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function SettingsTabPanels() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── 활성 탭 (React 상태로 관리 — DOM 조작 레이스 컨디션 방지) ──────────────
  const [activeTab, setActiveTab] = useState<string>("basic");

  // ── 탭별 로컬 상태 ─────────────────────────────────────────────────────────

  // 기본 설정
  const [siteName, setSiteName] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  // 이미지 업로드 상태
  const [ogImageUploading, setOgImageUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const ogImageInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // 콘텐츠 설정
  const [contentRetentionDays, setContentRetentionDays] = useState(365);
  const [popularPostMetric, setPopularPostMetric] = useState("views");
  const [popularResourceMetric, setPopularResourceMetric] = useState("downloads");

  // 파일 설정
  const [fileAllowedExtensions, setFileAllowedExtensions] = useState("zip, pdf, json, md, txt, csv, xlsx");
  const [maxUploadMb, setMaxUploadMb] = useState(50);
  const [imageExtensions, setImageExtensions] = useState("jpg, jpeg, png, webp, gif");
  const [resourceExtensions, setResourceExtensions] = useState("zip, json, md, py, ts, sh");

  // 신고 설정
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const [autoHideThreshold, setAutoHideThreshold] = useState(5);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [reportReasons, setReportReasons] = useState<string[]>([
    "스팸/광고",
    "욕설/비방",
    "음란/선정성",
    "허위정보",
    "저작권 침해",
    "기타",
  ]);

  // ── API 설정 로드 ────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/settings`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("설정 로드 실패");
      const data = (await res.json()) as AdminSettingsResponse;

      // 기본 설정
      if (data.site_name != null) setSiteName(String(data.site_name));
      if (data.operator_email != null) setOperatorEmail(String(data.operator_email));
      if (data.site_description != null) setSiteDescription(String(data.site_description));
      if (data.seo_title != null) setSeoTitle(String(data.seo_title));
      if (data.seo_description != null) setSeoDescription(String(data.seo_description));
      if (data.og_image != null) setOgImage(String(data.og_image));
      if (data.favicon_url != null) setFaviconUrl(String(data.favicon_url));

      // 콘텐츠 설정
      if (data.content_retention_days != null)
        setContentRetentionDays(Number(data.content_retention_days));
      if (data.popular_post_metric != null)
        setPopularPostMetric(String(data.popular_post_metric));
      if (data.popular_resource_metric != null)
        setPopularResourceMetric(String(data.popular_resource_metric));

      // 파일 설정
      if (data.file_allowed_extensions != null)
        setFileAllowedExtensions(String(data.file_allowed_extensions));
      if (data.max_upload_mb != null) setMaxUploadMb(Number(data.max_upload_mb));
      if (data.image_extensions != null)
        setImageExtensions(String(data.image_extensions));
      if (data.resource_extensions != null)
        setResourceExtensions(String(data.resource_extensions));

      // 신고 설정
      if (data.auto_hide_enabled != null)
        setAutoHideEnabled(Boolean(data.auto_hide_enabled));
      if (data.auto_hide_threshold != null)
        setAutoHideThreshold(Number(data.auto_hide_threshold));
      if (Array.isArray(data.forbidden_words)) setForbiddenWords(data.forbidden_words as string[]);
      if (Array.isArray(data.report_reasons)) setReportReasons(data.report_reasons as string[]);
    } catch {
      setToast({ message: "설정을 불러오지 못했습니다.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── 탭 전환: admin:tab-change 이벤트 → activeTab 상태 업데이트 ──────────────
  // DOM 직접 조작(display 토글) 대신 React 상태 기반으로 전환하여
  // loading → 패널 렌더 전 useEffect 실행으로 인한 레이스 컨디션을 완전 차단한다.
  useEffect(() => {
    const onTabChange = (e: Event) => {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      if (value) setActiveTab(value);
    };
    document.addEventListener("admin:tab-change", onTabChange as EventListener);
    return () => document.removeEventListener("admin:tab-change", onTabChange as EventListener);
  }, []);

  // 초기 로드
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── 저장 함수 ────────────────────────────────────────────────────────────────

  async function saveSettings(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      setToast({ message: "설정이 저장되었습니다.", type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setToast({ message: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ── 탭별 저장 핸들러 ────────────────────────────────────────────────────────

  async function saveBasic() {
    await saveSettings({
      site_name: siteName,
      operator_email: operatorEmail,
      site_description: siteDescription,
      seo_title: seoTitle,
      seo_description: seoDescription,
      og_image: ogImage,
      favicon_url: faviconUrl,
    });
  }

  async function saveContent() {
    await saveSettings({
      content_retention_days: contentRetentionDays,
      popular_post_metric: popularPostMetric,
      popular_resource_metric: popularResourceMetric,
    });
  }

  async function saveFile() {
    await saveSettings({
      file_allowed_extensions: fileAllowedExtensions,
      max_upload_mb: maxUploadMb,
      image_extensions: imageExtensions,
      resource_extensions: resourceExtensions,
    });
  }

  async function saveReport() {
    await saveSettings({
      auto_hide_enabled: autoHideEnabled,
      auto_hide_threshold: autoHideThreshold,
      forbidden_words: forbiddenWords,
      report_reasons: reportReasons,
    });
  }

  // ── 이미지 업로드 (OG / 파비콘) ─────────────────────────────────────────────

  async function uploadSettingImage(
    field: "og_image" | "favicon_url",
    file: File,
  ): Promise<void> {
    const setUploading = field === "og_image" ? setOgImageUploading : setFaviconUploading;
    const setter = field === "og_image" ? setOgImage : setFaviconUrl;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/settings/upload-image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("업로드 실패");
      const data = (await res.json()) as { url: string };
      setter(data.url);
    } catch {
      setToast({ message: "이미지 업로드에 실패했습니다.", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
        설정을 불러오는 중...
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── 기본 설정 패널 ── */}
      <section
        className="section"
        data-tab-panel="basic"
        aria-label="기본 설정"
        style={{ display: activeTab === "basic" ? "" : "none" }}
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title">기본 설정</h2>
            <p className="section-description">사이트 정체성과 검색/공유 시 기본 정보를 설정합니다.</p>
          </div>
        </div>

        <div className="component-stack">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="siteName">사이트명</label>
              <input
                className="control"
                id="siteName"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />
              <div className="field-help">상단바·탭 제목·이메일 등에 표시되는 이름입니다.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="operatorEmail">운영자 이메일</label>
              <div className="input-icon">
                <i className="ri-mail-line" />
                <input
                  className="control"
                  id="operatorEmail"
                  type="email"
                  value={operatorEmail}
                  onChange={(e) => setOperatorEmail(e.target.value)}
                />
              </div>
              <div className="field-help">신고/문의 알림이 이 주소로 전송됩니다.</div>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="siteDescription">사이트 설명</label>
            <textarea
              className="control"
              id="siteDescription"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
            />
            <div className="field-help">사이트 소개와 메타 설명의 기본값으로 사용됩니다.</div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="seoTitle">기본 SEO title</label>
            <input
              className="control"
              id="seoTitle"
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
            />
            <div className="field-help">검색 결과와 브라우저 탭에 표시되는 기본 제목입니다.</div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="seoDescription">기본 SEO description</label>
            <textarea
              className="control"
              id="seoDescription"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
            <div className="field-help">검색 결과 미리보기 문구로 사용됩니다(권장 150자 이내).</div>
          </div>

          <div className="field">
            <label className="field-label">기본 OG 이미지</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="control"
                type="text"
                readOnly
                value={ogImage}
                placeholder="이미지를 업로드하면 URL이 자동 입력됩니다"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={ogImageUploading}
                onClick={() => ogImageInputRef.current?.click()}
              >
                <i className="ri-upload-2-line" />
                {ogImageUploading ? "업로드 중..." : "업로드"}
              </button>
              <input
                ref={ogImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadSettingImage("og_image", file);
                  e.target.value = "";
                }}
              />
            </div>
            {ogImage && (
              <div style={{ marginTop: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ogImage}
                  alt="OG 이미지 미리보기"
                  style={{ maxWidth: 240, maxHeight: 126, border: "1px solid var(--gray-200)", borderRadius: 4, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div className="field-help">SNS 공유 시 표시될 대표 이미지입니다(권장 1200×630px).</div>
          </div>

          <div className="field">
            <label className="field-label">파비콘(Favicon)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="control"
                type="text"
                readOnly
                value={faviconUrl}
                placeholder="이미지를 업로드하면 URL이 자동 입력됩니다"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={faviconUploading}
                onClick={() => faviconInputRef.current?.click()}
              >
                <i className="ri-upload-2-line" />
                {faviconUploading ? "업로드 중..." : "업로드"}
              </button>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/x-icon,image/svg+xml"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadSettingImage("favicon_url", file);
                  e.target.value = "";
                }}
              />
            </div>
            {faviconUrl && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconUrl}
                  alt="파비콘 미리보기"
                  width={32}
                  height={32}
                  style={{ border: "1px solid var(--gray-200)", borderRadius: 4, objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <span style={{ fontSize: 12, color: "var(--gray-500)" }}>미리보기</span>
              </div>
            )}
            <div className="field-help">
              브라우저 탭·북마크에 표시되는 사이트 아이콘입니다. .ico / .png / .svg를 지원합니다.
              변경 후 저장하면 웹 메타데이터에 즉시 반영됩니다.
            </div>
          </div>
        </div>

        <div className="filter-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-outline" type="button" onClick={loadSettings}>
            취소
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={saveBasic}
          >
            <i className="ri-save-line" />
            {saving ? "저장 중..." : "기본 설정 저장"}
          </button>
        </div>
      </section>

      {/* ── 콘텐츠 설정 패널 ── */}
      <section
        className="section"
        data-tab-panel="content"
        aria-label="콘텐츠 설정"
        style={{ display: activeTab === "content" ? "" : "none" }}
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title">콘텐츠 설정</h2>
            <p className="section-description">게시글·댓글 정책과 콘텐츠 보존 기간을 관리합니다.</p>
          </div>
        </div>

        <div className="component-stack">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="contentRetentionDays">
                콘텐츠 보존 기간(일)
              </label>
              <input
                className="control"
                id="contentRetentionDays"
                type="number"
                min={1}
                value={contentRetentionDays}
                onChange={(e) => setContentRetentionDays(Number(e.target.value))}
              />
              <div className="field-help">
                소프트 삭제된 콘텐츠를 완전 삭제하기까지의 보존 기간입니다. cleanup worker 다음 실행 시 반영됩니다.
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label">인기 게시글 기준 지표</label>
              <Select
                id="popularPostMetric"
                value={popularPostMetric}
                onChange={setPopularPostMetric}
                options={[
                  { value: "views", label: "조회수" },
                  { value: "likes", label: "좋아요" },
                  { value: "comments", label: "댓글수" },
                  { value: "recent", label: "최신순" },
                ]}
              />
              <div className="field-help">
                인기 게시글 순위 집계 기준입니다. Redis 캐시 만료(최대 1시간) 후 반영됩니다.
              </div>
            </div>
            <div className="field">
              <label className="field-label">인기 자료 기준 지표</label>
              <Select
                id="popularResourceMetric"
                value={popularResourceMetric}
                onChange={setPopularResourceMetric}
                options={[
                  { value: "downloads", label: "다운로드수" },
                  { value: "views", label: "조회수" },
                  { value: "rating", label: "평점" },
                  { value: "recent", label: "최신순" },
                ]}
              />
              <div className="field-help">
                인기 실전자료 순위 집계 기준입니다. Redis 캐시 만료(최대 1시간) 후 반영됩니다.
              </div>
            </div>
          </div>
        </div>

        <div className="filter-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-outline" type="button" onClick={loadSettings}>
            취소
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={saveContent}
          >
            <i className="ri-save-line" />
            {saving ? "저장 중..." : "콘텐츠 설정 저장"}
          </button>
        </div>
      </section>

      {/* ── 파일 설정 패널 ── */}
      <section
        className="section"
        data-tab-panel="file"
        aria-label="파일 설정"
        style={{ display: activeTab === "file" ? "" : "none" }}
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title">파일 설정</h2>
            <p className="section-description">업로드 가능한 확장자와 용량 제한을 관리합니다.</p>
          </div>
        </div>

        <div className="component-stack">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="allowedExt">허용 파일 확장자</label>
              <input
                className="control"
                id="allowedExt"
                type="text"
                value={fileAllowedExtensions}
                onChange={(e) => setFileAllowedExtensions(e.target.value)}
              />
              <div className="field-help">쉼표(,)로 구분합니다. 점(.)은 생략합니다.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="maxUpload">최대 업로드 용량</label>
              <div className="input-icon">
                <i className="ri-hard-drive-2-line" />
                <input
                  className="control"
                  id="maxUpload"
                  type="number"
                  min={1}
                  value={maxUploadMb}
                  onChange={(e) => setMaxUploadMb(Number(e.target.value))}
                />
              </div>
              <div className="field-help">파일 1개당 최대 용량(MB)입니다.</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="imageExt">이미지 허용 확장자</label>
              <input
                className="control"
                id="imageExt"
                type="text"
                value={imageExtensions}
                onChange={(e) => setImageExtensions(e.target.value)}
              />
              <div className="field-help">본문 이미지·썸네일 업로드에 허용됩니다.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="resourceExt">자료실 허용 확장자</label>
              <input
                className="control"
                id="resourceExt"
                type="text"
                value={resourceExtensions}
                onChange={(e) => setResourceExtensions(e.target.value)}
              />
              <div className="field-help">실전자료 업로드에만 허용되는 확장자입니다.</div>
            </div>
          </div>
        </div>

        <div className="filter-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-outline" type="button" onClick={loadSettings}>
            취소
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={saveFile}
          >
            <i className="ri-save-line" />
            {saving ? "저장 중..." : "파일 설정 저장"}
          </button>
        </div>
      </section>

      {/* ── 신고 설정 패널 ── */}
      <section
        className="section"
        data-tab-panel="report"
        aria-label="신고 설정"
        style={{ display: activeTab === "report" ? "" : "none" }}
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title">신고 설정</h2>
            <p className="section-description">신고 사유와 누적·자동 숨김 정책을 관리합니다.</p>
          </div>
        </div>

        <div className="component-stack">
          <div className="field">
            <div className="choice-row" style={{ justifyContent: "space-between" }}>
              <span className="field-label" style={{ margin: 0 }}>금칙어 관리</span>
            </div>
            <TagInput
              tags={forbiddenWords}
              placeholder="금칙어 입력 후 Enter"
              onChange={setForbiddenWords}
            />
            <div className="field-help">
              금칙어로 등록된 단어는 게시글·댓글 작성 시 즉시 차단됩니다. 재배포 없이 즉시 반영됩니다.
            </div>
          </div>

          <div className="field">
            <div className="choice-row" style={{ justifyContent: "space-between" }}>
              <span className="field-label" style={{ margin: 0 }}>신고 사유 관리</span>
            </div>
            <TagInput
              tags={reportReasons}
              placeholder="신고 사유 입력 후 Enter"
              onChange={setReportReasons}
            />
            <div className="field-help">사용자가 신고할 때 선택하는 사유 목록입니다.</div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="reportThreshold">자동 숨김 임계치</label>
              <div className="input-icon">
                <i className="ri-alarm-warning-line" />
                <input
                  className="control"
                  id="reportThreshold"
                  type="number"
                  min={1}
                  value={autoHideThreshold}
                  onChange={(e) => setAutoHideThreshold(Number(e.target.value))}
                />
              </div>
              <div className="field-help">
                이 횟수 이상 신고되면 콘텐츠가 자동으로 숨김 처리됩니다.
              </div>
            </div>
            <div className="field">
              <span className="field-label">자동 숨김 기준 사용</span>
              <div className="choice-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoHideEnabled}
                    onChange={(e) => setAutoHideEnabled(e.target.checked)}
                  />
                  <span className="switch-track" />
                </label>
                <span style={{ color: "var(--gray-500)" }}>
                  누적 기준 도달 시 콘텐츠를 자동 숨김 처리
                </span>
              </div>
            </div>
          </div>

          {autoHideEnabled && (
            <div className="alert alert-warning">
              <i className="ri-alert-line" />
              <div>
                <strong>주의</strong>
                <br />
                자동 숨김은 잘못된 신고로 정상 글이 숨겨질 수 있습니다. 신중히 사용하고, 숨김 처리된 글은 반드시 운영자가 다시 확인하세요.
              </div>
            </div>
          )}
        </div>

        <div className="filter-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-outline" type="button" onClick={loadSettings}>
            취소
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={saveReport}
          >
            <i className="ri-save-line" />
            {saving ? "저장 중..." : "신고 설정 저장"}
          </button>
        </div>
      </section>
    </>
  );
}
