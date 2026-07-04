"use client";

/**
 * 챕터 상세 페이지 — Story 13.5 Task 5
 *
 * 리스트=상세 규약: 별도 페이지(모달 금지).
 * "use client" — next/headers, cookies() import 금지 (RSC 빌드 크래시).
 * 섹션 A: 초안 편집 / 섹션 B: 이미지 슬롯 / 섹션 C: 미리보기 / 섹션 D: 예약
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { confirmDialog } from "@/lib/dialog";
import { API_BASE_URL } from "@/lib/api";

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

interface ImageSlot {
  id: string;
  chapterId: string;
  assetKey: string;
  sourceKind: "ai_diagram" | "web_download" | "capture" | "user_upload";
  status: "pending" | "ready";
  caption: string | null;
  alt: string | null;
  guidance: string | null;
  positionHint: string | null;
  imageUrl: string | null;
  diagramPrompt: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChapterDetail {
  id: string;
  seriesId: string;
  orderIndex: number;
  title: string;
  goal: string;
  outline: unknown;
  draftContent: unknown | null;
  draftTextEditable: string | null;
  status: "planned" | "drafted" | "ready" | "published" | "skipped";
  scheduledAt: string | null;
  publishedPostId: string | null;
  totalSlots: number;
  readySlots: number;
  createdAt: string;
  updatedAt: string;
  slots: ImageSlot[];
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  planned: "초안 전",
  drafted: "초안 완료",
  ready: "이미지 완료",
  published: "게시 완료",
  skipped: "스킵",
};

const STATUS_BADGE: Record<string, string> = {
  planned: "badge-gray",
  drafted: "badge-blue",
  ready: "badge-green",
  published: "badge-purple",
  skipped: "badge-orange",
};

const SOURCE_KIND_LABEL: Record<string, string> = {
  ai_diagram: "자동(AI 도식)",
  web_download: "자동(웹 다운로드)",
  capture: "세팅필요(캡처)",
  user_upload: "업로드 필요",
};

const SOURCE_KIND_BADGE: Record<string, string> = {
  ai_diagram: "badge-green",
  web_download: "badge-green",
  capture: "badge-orange",
  user_upload: "badge-blue",
};

function formatSchedule(iso: string | null): string {
  if (!iso) return "";
  // datetime-local 형식으로 변환: "2026-07-15T14:30"
  return iso.slice(0, 16);
}

// ── 토스트 (화면 중앙) ────────────────────────────────────────────────────────

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
        padding: "12px 20px",
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

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default function ChapterDetailPage() {
  const params = useParams();
  const chapterId = params?.chapterId as string;

  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // 섹션 A — 초안 편집 상태
  const [draftText, setDraftText] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // 섹션 B — 슬롯 액션 로딩 상태
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 섹션 C — 미리보기
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 섹션 D — 예약
  const [scheduleDatetime, setScheduleDatetime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 챕터 로드
  const fetchChapter = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}`, {
        credentials: "include",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("챕터 조회 실패");
      const data: ChapterDetail = await res.json();
      setChapter(data);
      setDraftText(data.draftContent ? JSON.stringify(data.draftContent, null, 2) : "");
      setScheduleDatetime(formatSchedule(data.scheduledAt));
    } catch {
      showToast("챕터 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [chapterId, showToast]);

  useEffect(() => {
    if (chapterId) fetchChapter();
  }, [fetchChapter, chapterId]);

  // ── 섹션 A: 초안 저장 ─────────────────────────────────────────────────────

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      let parsedContent: unknown;
      try {
        parsedContent = draftText ? JSON.parse(draftText) : null;
      } catch {
        showToast("유효하지 않은 JSON 형식입니다.", "error");
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/draft`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ draftContent: parsedContent }),
        },
      );
      if (!res.ok) throw new Error("초안 저장 실패");
      const data: ChapterDetail = await res.json();
      setChapter(data);
      showToast("초안이 저장되었습니다.", "success");
    } catch {
      showToast("초안 저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSavingDraft(false);
    }
  }

  // ── 섹션 B: 슬롯 이미지 업로드 ───────────────────────────────────────────

  async function handleUpload(slotId: string, file: File) {
    setSlotLoading((prev) => ({ ...prev, [slotId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/slots/${slotId}/upload`,
        { method: "POST", credentials: "include", body: formData },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "업로드 실패");
      }
      showToast("이미지가 업로드되었습니다.", "success");
      await fetchChapter();
    } catch (e) {
      showToast((e as Error).message || "업로드 중 오류가 발생했습니다.", "error");
    } finally {
      setSlotLoading((prev) => ({ ...prev, [slotId]: false }));
    }
  }

  // ── 섹션 B: 슬롯 자동 생성 ───────────────────────────────────────────────

  async function handleGenerate(slotId: string) {
    setSlotLoading((prev) => ({ ...prev, [slotId]: true }));
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/slots/${slotId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "생성 실패");
      }
      const result = data as { ok: boolean; outcome: string; reason?: string };
      if (result.ok && result.outcome === "filled") {
        showToast("이미지가 생성되었습니다.", "success");
      } else {
        showToast(result.reason ?? "이미지 생성에 실패했습니다.", "error");
      }
      await fetchChapter();
    } catch (e) {
      showToast((e as Error).message || "생성 중 오류가 발생했습니다.", "error");
    } finally {
      setSlotLoading((prev) => ({ ...prev, [slotId]: false }));
    }
  }

  // ── 섹션 B: 슬롯 완료 처리 ───────────────────────────────────────────────

  async function handleComplete(slotId: string) {
    const confirmed = await confirmDialog({
      title: "슬롯 완료 처리",
      message: "이 슬롯을 완료로 표시하겠습니까?",
    });
    if (!confirmed) return;

    setSlotLoading((prev) => ({ ...prev, [slotId]: true }));
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/slots/${slotId}/complete`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "완료 처리 실패");
      }
      showToast("슬롯이 완료 처리되었습니다.", "success");
      await fetchChapter();
    } catch (e) {
      showToast((e as Error).message || "완료 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setSlotLoading((prev) => ({ ...prev, [slotId]: false }));
    }
  }

  // ── 섹션 C: 미리보기 ──────────────────────────────────────────────────────

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/preview`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("미리보기 로드 실패");
      const data = await res.json();
      setPreviewHtml((data as { html: string }).html);
    } catch {
      showToast("미리보기를 불러오지 못했습니다.", "error");
    } finally {
      setLoadingPreview(false);
    }
  }

  // ── 섹션 D: 예약 설정/해제 ───────────────────────────────────────────────

  async function handleSchedule(scheduledAt: string | null) {
    setSavingSchedule(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scheduledAt }),
        },
      );
      if (!res.ok) throw new Error("예약 설정 실패");
      const data: ChapterDetail = await res.json();
      setChapter(data);
      setScheduleDatetime(formatSchedule(data.scheduledAt));
      showToast(scheduledAt ? "예약이 설정되었습니다." : "예약이 해제되었습니다.", "success");
    } catch {
      showToast("예약 설정 중 오류가 발생했습니다.", "error");
    } finally {
      setSavingSchedule(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜", "로딩 중..."]} activeKey="bots" activeSubKey="curriculum">
        <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>불러오는 중...</div>
      </AdminShell>
    );
  }

  if (notFound || !chapter) {
    return (
      <AdminShell breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜", "없음"]} activeKey="bots" activeSubKey="curriculum">
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--gray-400)", marginBottom: 16 }}>존재하지 않는 챕터입니다.</p>
          <Link href="/bots/curriculum" className="btn btn-outline">← 목록으로</Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜", chapter.title]}
      activeKey="bots"
      activeSubKey="curriculum"
    >
      {/* 뒤로가기 */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/bots/curriculum" className="btn btn-outline btn-sm">
          <i className="ri-arrow-left-line" /> 목록으로
        </Link>
      </div>

      {/* 상단 요약 카드 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className={`badge ${STATUS_BADGE[chapter.status] ?? "badge-gray"}`}>
                {STATUS_LABEL[chapter.status] ?? chapter.status}
              </span>
              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{chapter.orderIndex}강</span>
            </div>
            <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{chapter.title}</h1>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--gray-500)" }}>{chapter.goal}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--gray-500)" }}>
            <div>이미지: <strong style={{ color: chapter.readySlots === chapter.totalSlots && chapter.totalSlots > 0 ? "var(--success)" : "inherit" }}>{chapter.readySlots}/{chapter.totalSlots}</strong> 완료</div>
            <div style={{ marginTop: 4 }}>
              예약: {chapter.scheduledAt ? chapter.scheduledAt.slice(0, 16).replace("T", " ") : "미예약"}
            </div>
          </div>
        </div>
      </article>

      {/* 섹션 A — 초안 본문 편집 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>A. 초안 본문 편집</h2>
        </div>
        {chapter.draftContent === null ? (
          <p style={{ color: "var(--gray-400)", fontSize: 13 }}>
            (초안 미생성 — 13.3 스테이징 파이프라인 실행 필요)
          </p>
        ) : (
          <>
            <textarea
              className="control"
              rows={16}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Tiptap JSON 초안 (편집 가능)"
              style={{ fontFamily: "monospace", fontSize: 12, width: "100%", resize: "vertical" }}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={savingDraft}
                onClick={handleSaveDraft}
              >
                {savingDraft ? <i className="ri-loader-4-line" /> : <i className="ri-save-line" />}
                초안 저장
              </button>
            </div>
          </>
        )}
      </article>

      {/* 섹션 B — 이미지 슬롯 목록 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>B. 이미지 슬롯</h2>
        </div>
        {chapter.slots.length === 0 ? (
          <p style={{ color: "var(--gray-400)", fontSize: 13 }}>이미지 슬롯이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {chapter.slots.map((slot) => (
              <div
                key={slot.id}
                style={{
                  border: "1px solid var(--gray-200, #e5e7eb)",
                  borderRadius: 8,
                  padding: 16,
                  background: slot.status === "ready" ? "var(--success-50, #f0fdf4)" : "var(--gray-50, #f9fafb)",
                }}
              >
                {/* 슬롯 헤더 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <code style={{ fontSize: 12, background: "var(--gray-100, #f3f4f6)", padding: "2px 6px", borderRadius: 4 }}>
                    {slot.assetKey}
                  </code>
                  <span className={`badge ${SOURCE_KIND_BADGE[slot.sourceKind] ?? "badge-gray"}`}>
                    {SOURCE_KIND_LABEL[slot.sourceKind] ?? slot.sourceKind}
                  </span>
                  <span className={`badge ${slot.status === "ready" ? "badge-green" : "badge-gray"}`}>
                    {slot.status === "ready" ? "완료" : "미준비"}
                  </span>
                </div>

                {/* 안내 */}
                {slot.guidance && (
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--gray-500)" }}>{slot.guidance}</p>
                )}

                {/* 이미지 미리보기 */}
                {slot.imageUrl && (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={slot.imageUrl}
                      alt={slot.alt ?? slot.assetKey}
                      style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4, border: "1px solid var(--gray-200, #e5e7eb)" }}
                    />
                  </div>
                )}

                {/* 액션 버튼들 */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {/* 업로드 버튼 (모든 슬롯) */}
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      ref={(el) => { fileInputRefs.current[slot.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(slot.id, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      type="button"
                      disabled={slotLoading[slot.id]}
                      onClick={() => fileInputRefs.current[slot.id]?.click()}
                    >
                      {slotLoading[slot.id] ? <i className="ri-loader-4-line" /> : <i className="ri-upload-line" />}
                      이미지 업로드
                    </button>
                  </>

                  {/* 자동 생성 (🟢 슬롯 전용) */}
                  {(slot.sourceKind === "ai_diagram" || slot.sourceKind === "web_download") && (
                    <button
                      className="btn btn-sm btn-primary"
                      type="button"
                      disabled={slotLoading[slot.id]}
                      onClick={() => handleGenerate(slot.id)}
                    >
                      {slotLoading[slot.id] ? <i className="ri-loader-4-line" /> : <i className="ri-magic-line" />}
                      지금 생성
                    </button>
                  )}

                  {/* 완료 처리 (이미지 있고 pending인 경우) */}
                  {slot.imageUrl && slot.status === "pending" && (
                    <button
                      className="btn btn-sm btn-outline"
                      type="button"
                      disabled={slotLoading[slot.id]}
                      onClick={() => handleComplete(slot.id)}
                    >
                      <i className="ri-check-line" /> 완료 처리
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* 섹션 C — 최종 미리보기 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>C. 최종 미리보기</h2>
        </div>
        <button
          className="btn btn-outline"
          type="button"
          disabled={loadingPreview}
          onClick={handlePreview}
          style={{ marginBottom: 16 }}
        >
          {loadingPreview ? <i className="ri-loader-4-line" /> : <i className="ri-eye-line" />}
          미리보기 새로고침
        </button>
        {previewHtml !== null && (
          <div
            className="post-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            style={{
              border: "1px solid var(--gray-200, #e5e7eb)",
              borderRadius: 8,
              padding: 20,
              background: "#fff",
              minHeight: 80,
            }}
          />
        )}
      </article>

      {/* 섹션 D — 예약시각 지정 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>D. 예약시각 지정</h2>
        </div>
        {chapter.status !== "ready" && chapter.status !== "published" && (
          <p style={{ color: "var(--warning, #d97706)", fontSize: 12, marginBottom: 12 }}>
            ⚠️ 이미지 미완료 — 예약 설정해도 챕터가 준비 완료 상태가 될 때까지 게시되지 않습니다.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            className="control"
            value={scheduleDatetime}
            onChange={(e) => setScheduleDatetime(e.target.value)}
            style={{ width: "auto", minWidth: 220 }}
          />
          <button
            className="btn btn-primary"
            type="button"
            disabled={savingSchedule || !scheduleDatetime}
            onClick={() => {
              if (scheduleDatetime) {
                handleSchedule(new Date(scheduleDatetime).toISOString());
              }
            }}
          >
            {savingSchedule ? <i className="ri-loader-4-line" /> : <i className="ri-calendar-check-line" />}
            예약 설정
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={savingSchedule || !chapter.scheduledAt}
            onClick={() => handleSchedule(null)}
          >
            <i className="ri-calendar-close-line" /> 예약 해제
          </button>
        </div>
      </article>

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}
