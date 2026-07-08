"use client";

/**
 * 챕터 상세 페이지 — Story 13.5 Task 5 (이미지 인터랙티브 개편)
 *
 * 리스트=상세 규약: 별도 페이지(모달 금지).
 * "use client" — next/headers, cookies() import 금지 (RSC 빌드 크래시).
 *
 * 구성:
 *  A. 초안 본문 편집 (AI 생성 / JSON 편집)
 *  B. 본문 미리보기 & 이미지 — 글 중간중간 이미지 자리를 점선 박스로 표시.
 *     각 박스에 프롬프트 + [AI 생성]·[이미지 업로드] 두 버튼. 채워지면 이미지+[삭제].
 *     비워 두면 실제 발행 시 그 자리는 이미지 없이 렌더된다.
 *  C. 예약시각 지정
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
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

/** 인터랙티브 미리보기 세그먼트 (API editor-segments 응답). */
interface EditorSegment {
  kind: "html" | "slot";
  html?: string;
  slot?: ImageSlot;
}
interface SegmentsResponse {
  hasDraft: boolean;
  segments: EditorSegment[];
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

function formatSchedule(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 저장 시 new Date(로컬입력).toISOString() 으로 UTC 변환하므로, 표시할 때도
  // UTC 인스턴트를 브라우저 로컬 벽시계로 되돌려야 입력값과 왕복 일치한다.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

// ── 이미지 자리 박스 (점선 박스 / 채워진 이미지) ──────────────────────────────

function SlotBox({
  slot,
  busy,
  readOnly,
  onGenerate,
  onUpload,
  onClear,
}: {
  slot: ImageSlot;
  busy: boolean;
  readOnly: boolean;
  onGenerate: () => void;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const promptText =
    slot.diagramPrompt?.trim() ||
    slot.guidance?.trim() ||
    slot.caption?.trim() ||
    "이 자리에 들어갈 이미지";

  const pickFile = () => fileRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  // ── 채워진 이미지 ──
  if (slot.imageUrl) {
    return (
      <figure style={{ margin: "20px 0" }}>
        <img
          src={slot.imageUrl}
          alt={slot.alt ?? slot.assetKey}
          style={{ maxWidth: "100%", borderRadius: 8, display: "block", marginInline: "auto" }}
        />
        {slot.caption && (
          <figcaption style={{ textAlign: "center", fontSize: 13, color: "var(--gray-500)", marginTop: 6 }}>
            {slot.caption}
          </figcaption>
        )}
        {!readOnly && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            <input type="file" accept="image/*" style={{ display: "none" }} ref={fileRef} onChange={onFileChange} />
            <button className="btn btn-sm btn-outline" type="button" disabled={busy} onClick={pickFile}>
              <i className="ri-upload-line" /> 교체 업로드
            </button>
            <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={onGenerate}>
              {busy ? <i className="ri-loader-4-line" /> : <i className="ri-magic-line" />} AI 재생성
            </button>
            <button
              className="btn btn-sm btn-outline"
              type="button"
              disabled={busy}
              onClick={onClear}
              style={{ color: "var(--danger, #dc2626)", borderColor: "var(--danger, #dc2626)" }}
            >
              <i className="ri-delete-bin-line" /> 삭제
            </button>
          </div>
        )}
      </figure>
    );
  }

  // ── 빈 자리 (점선 박스) ──
  return (
    <div
      style={{
        border: "2px dashed var(--gray-300, #d1d5db)",
        borderRadius: 10,
        padding: 20,
        margin: "20px 0",
        background: "var(--gray-50, #f9fafb)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--gray-500)",
          marginBottom: 6,
          display: "flex",
          gap: 6,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <i className="ri-image-add-line" /> 이미지 자리
      </div>
      <p style={{ fontSize: 13, color: "var(--gray-600)", margin: "0 auto 14px", maxWidth: 560, whiteSpace: "pre-wrap" }}>
        {promptText}
      </p>
      {readOnly ? (
        <p style={{ fontSize: 12, color: "var(--gray-400)", margin: 0 }}>(비어 있음 — 발행 시 이미지 없이 표시됩니다)</p>
      ) : (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={onGenerate}>
            {busy ? <i className="ri-loader-4-line" /> : <i className="ri-magic-line" />} AI 생성
          </button>
          <input type="file" accept="image/*" style={{ display: "none" }} ref={fileRef} onChange={onFileChange} />
          <button className="btn btn-sm btn-outline" type="button" disabled={busy} onClick={pickFile}>
            <i className="ri-upload-line" /> 이미지 업로드
          </button>
        </div>
      )}
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

  // 섹션 A — 초안 편집
  const [draftText, setDraftText] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  // 섹션 B — 미리보기 세그먼트 + 슬롯 액션 로딩
  const [segData, setSegData] = useState<SegmentsResponse | null>(null);
  const [loadingSeg, setLoadingSeg] = useState(true);
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});

  // 섹션 C — 예약
  const [scheduleDatetime, setScheduleDatetime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 챕터 로드 (silent=true면 전체 스피너 표시 안 함)
  const loadChapter = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
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
        if (!silent) setLoading(false);
      }
    },
    [chapterId, showToast],
  );

  // 미리보기 세그먼트 로드
  const loadSegments = useCallback(async () => {
    setLoadingSeg(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/editor-segments`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("미리보기 로드 실패");
      setSegData((await res.json()) as SegmentsResponse);
    } catch {
      setSegData(null);
    } finally {
      setLoadingSeg(false);
    }
  }, [chapterId]);

  // 액션 후 화면 갱신 (챕터 요약 + 미리보기)
  const refresh = useCallback(async () => {
    await Promise.all([loadChapter(true), loadSegments()]);
  }, [loadChapter, loadSegments]);

  useEffect(() => {
    if (chapterId) {
      loadChapter(false);
      loadSegments();
    }
  }, [chapterId, loadChapter, loadSegments]);

  const isPublished = chapter?.status === "published";

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
      showToast("초안이 저장되었습니다.", "success");
      await refresh();
    } catch {
      showToast("초안 저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSavingDraft(false);
    }
  }

  // ── 섹션 A: 초안 AI 생성 트리거 ──────────────────────────────────────────

  async function handleGenerateDraft() {
    setGeneratingDraft(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/generate-draft`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "초안 생성 실패");
      }
      const result = data as { status: string; reason?: string };
      if (result.status === "drafted") {
        showToast("AI 초안이 생성되었습니다.", "success");
      } else if (result.status === "skipped") {
        showToast(`건너뜀: ${result.reason ?? "처리 대상 아님"}`, "error");
      } else {
        showToast(`생성 실패: ${result.reason ?? "오류"}`, "error");
      }
      await refresh();
    } catch (e) {
      showToast((e as Error).message || "초안 생성 중 오류가 발생했습니다.", "error");
    } finally {
      setGeneratingDraft(false);
    }
  }

  // ── 섹션 B: 슬롯 액션 (업로드 / AI 생성 / 비우기) ─────────────────────────

  const setBusy = (slotId: string, v: boolean) =>
    setSlotLoading((prev) => ({ ...prev, [slotId]: v }));

  async function handleUpload(slotId: string, file: File) {
    setBusy(slotId, true);
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
      await refresh();
    } catch (e) {
      showToast((e as Error).message || "업로드 중 오류가 발생했습니다.", "error");
    } finally {
      setBusy(slotId, false);
    }
  }

  async function handleGenerate(slotId: string) {
    setBusy(slotId, true);
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
      await refresh();
    } catch (e) {
      showToast((e as Error).message || "생성 중 오류가 발생했습니다.", "error");
    } finally {
      setBusy(slotId, false);
    }
  }

  async function handleClear(slotId: string) {
    setBusy(slotId, true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters/${chapterId}/slots/${slotId}/clear`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "삭제 실패");
      }
      showToast("이미지를 삭제했습니다.", "success");
      await refresh();
    } catch (e) {
      showToast((e as Error).message || "삭제 중 오류가 발생했습니다.", "error");
    } finally {
      setBusy(slotId, false);
    }
  }

  // ── 섹션 C: 예약 설정/해제 ───────────────────────────────────────────────

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
            <div>
              이미지:{" "}
              <strong style={{ color: chapter.readySlots > 0 ? "var(--success)" : "inherit" }}>
                {chapter.readySlots}/{chapter.totalSlots}
              </strong>{" "}
              채움 <span style={{ color: "var(--gray-400)" }}>(빈 자리는 이미지 없이 발행)</span>
            </div>
            <div style={{ marginTop: 4 }}>
              예약: {chapter.scheduledAt ? formatSchedule(chapter.scheduledAt).replace("T", " ") : "미예약"}
            </div>
          </div>
        </div>
      </article>

      {/* 섹션 A — 초안 본문 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div
          className="section-heading"
          style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
        >
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>A. 초안 본문</h2>
          {chapter.draftContent !== null && (
            <div style={{ display: "flex", gap: 8 }}>
              {!isPublished && (chapter.status === "planned" || chapter.status === "drafted" || chapter.status === "ready") && (
                <button className="btn btn-sm btn-outline" type="button" disabled={generatingDraft} onClick={handleGenerateDraft}>
                  {generatingDraft ? <i className="ri-loader-4-line" /> : <i className="ri-magic-line" />} AI로 다시 생성
                </button>
              )}
              <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowJson((v) => !v)}>
                <i className="ri-code-line" /> {showJson ? "JSON 닫기" : "JSON 편집"}
              </button>
            </div>
          )}
        </div>

        {chapter.draftContent === null ? (
          <div>
            <p style={{ color: "var(--gray-400)", fontSize: 13, marginBottom: 12 }}>
              아직 초안이 없습니다. 아래 버튼을 누르면 AI가 이 편의 학습목표·소주제를 바탕으로 본문 초안과 이미지 자리를 만듭니다.
            </p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={generatingDraft || isPublished}
              onClick={handleGenerateDraft}
            >
              {generatingDraft ? <i className="ri-loader-4-line" /> : <i className="ri-magic-line" />} AI 초안 생성
            </button>
          </div>
        ) : (
          showJson && (
            <>
              <textarea
                className="control"
                rows={16}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Tiptap JSON 초안 (편집 가능)"
                style={{ fontFamily: "monospace", fontSize: 12, width: "100%", resize: "vertical" }}
              />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-primary" type="button" disabled={savingDraft} onClick={handleSaveDraft}>
                  {savingDraft ? <i className="ri-loader-4-line" /> : <i className="ri-save-line" />} 초안 저장
                </button>
              </div>
            </>
          )
        )}
        {chapter.draftContent !== null && !showJson && (
          <p style={{ color: "var(--gray-400)", fontSize: 13, margin: 0 }}>
            초안이 아래 미리보기에 표시됩니다. 본문을 직접 수정하려면 &lsquo;JSON 편집&rsquo;을 누르세요.
          </p>
        )}
      </article>

      {/* 섹션 B — 본문 미리보기 & 이미지 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>B. 본문 미리보기 &amp; 이미지</h2>
        </div>

        {loadingSeg ? (
          <p style={{ color: "var(--gray-400)", fontSize: 13 }}>미리보기 불러오는 중...</p>
        ) : !segData?.hasDraft ? (
          <p style={{ color: "var(--gray-400)", fontSize: 13 }}>
            초안을 생성하면 여기에 글과 이미지 자리(점선 박스)가 표시됩니다.
          </p>
        ) : (
          <div
            className="post-content"
            style={{
              border: "1px solid var(--gray-200, #e5e7eb)",
              borderRadius: 8,
              padding: 20,
              background: "#fff",
              minHeight: 80,
            }}
          >
            {segData.segments.map((seg, i) =>
              seg.kind === "html" ? (
                <div key={`html-${i}`} dangerouslySetInnerHTML={{ __html: seg.html ?? "" }} />
              ) : seg.slot ? (
                <SlotBox
                  key={seg.slot.id}
                  slot={seg.slot}
                  busy={!!slotLoading[seg.slot.id]}
                  readOnly={isPublished}
                  onGenerate={() => handleGenerate(seg.slot!.id)}
                  onUpload={(file) => handleUpload(seg.slot!.id, file)}
                  onClear={() => handleClear(seg.slot!.id)}
                />
              ) : null,
            )}
          </div>
        )}
      </article>

      {/* 섹션 C — 예약시각 지정 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>C. 예약시각 지정</h2>
        </div>
        {chapter.status === "planned" && (
          <p style={{ color: "var(--warning, #d97706)", fontSize: 12, marginBottom: 12 }}>
            ⚠️ 아직 초안이 없습니다 — 예약해도 초안이 생성되기 전까지는 게시되지 않습니다.
          </p>
        )}
        {(chapter.status === "drafted" || chapter.status === "ready") && (
          <p style={{ color: "var(--gray-500)", fontSize: 12, marginBottom: 12 }}>
            예약 시각이 지나면 자동 게시됩니다. 비어 있는 이미지 자리는 이미지 없이 발행됩니다.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            className="control"
            value={scheduleDatetime}
            onChange={(e) => setScheduleDatetime(e.target.value)}
            disabled={isPublished}
            style={{ width: "auto", minWidth: 220 }}
          />
          <button
            className="btn btn-primary"
            type="button"
            disabled={savingSchedule || !scheduleDatetime || isPublished}
            onClick={() => {
              if (scheduleDatetime) handleSchedule(new Date(scheduleDatetime).toISOString());
            }}
          >
            {savingSchedule ? <i className="ri-loader-4-line" /> : <i className="ri-calendar-check-line" />} 예약 설정
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={savingSchedule || !chapter.scheduledAt || isPublished}
            onClick={() => handleSchedule(null)}
          >
            <i className="ri-calendar-close-line" /> 예약 해제
          </button>
        </div>
      </article>

      {/* 토스트 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}
