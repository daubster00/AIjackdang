"use client";

/**
 * 커리큘럼 플랜 직접 생성 페이지.
 *
 * 관리자가 시리즈(제목·게시판·도구·소개) + 챕터들 + 챕터별 이미지 슬롯을
 * 직접 작성해 POST /admin/bots/curriculum/plan 으로 저장한다.
 * 저장된 챕터는 전부 status=planned — 이후 상세 페이지에서 초안·이미지·예약을 진행한다.
 *
 * Select: @/components/ui/Select 커스텀 드롭다운 (native select 금지).
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { API_BASE_URL } from "@/lib/api";
import { BOARDS } from "@/lib/boards";

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

type SourceKind = "ai_diagram" | "web_download" | "capture" | "user_upload";

interface SlotForm {
  assetKey: string;
  caption: string;
  alt: string;
  sourceKind: SourceKind;
  diagramPrompt: string;
  sourceUrl: string;
}

interface ChapterForm {
  title: string;
  goal: string;
  outlineText: string; // 줄바꿈 구분
  slots: SlotForm[];
}

// ── 게시판 옵션 (apiBoard = DB posts.board 실제값) ────────────────────────────

const BOARD_OPTIONS = BOARDS.map((b) => ({
  value: b.apiBoard ?? b.slug,
  label: `${b.label} (${b.apiBoard ?? b.slug})`,
}));

const SOURCE_KIND_OPTIONS = [
  { value: "ai_diagram", label: "자동(AI 도식)" },
  { value: "web_download", label: "자동(웹 다운로드)" },
  { value: "capture", label: "세팅필요(캡처)" },
  { value: "user_upload", label: "업로드 필요" },
];

function emptySlot(): SlotForm {
  return { assetKey: "", caption: "", alt: "", sourceKind: "ai_diagram", diagramPrompt: "", sourceUrl: "" };
}

function emptyChapter(): ChapterForm {
  return { title: "", goal: "", outlineText: "", slots: [] };
}

// ── 토스트 (화면 중앙) ────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", color: "#fff",
        borderRadius: 8, padding: "12px 20px", fontSize: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex", alignItems: "center", gap: 10, minWidth: 240,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default function NewCurriculumPlanPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [board, setBoard] = useState(BOARD_OPTIONS[0]?.value ?? "");
  const [tool, setTool] = useState("");
  const [intro, setIntro] = useState("");
  const [chapters, setChapters] = useState<ChapterForm[]>([emptyChapter()]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => setToast({ message, type }), []);

  // ── 챕터 조작 ──────────────────────────────────────────────────────────────
  function updateChapter(idx: number, patch: Partial<ChapterForm>) {
    setChapters((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addChapter() {
    setChapters((prev) => [...prev, emptyChapter()]);
  }
  function removeChapter(idx: number) {
    setChapters((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── 슬롯 조작 ──────────────────────────────────────────────────────────────
  function updateSlot(cIdx: number, sIdx: number, patch: Partial<SlotForm>) {
    setChapters((prev) =>
      prev.map((c, i) =>
        i === cIdx ? { ...c, slots: c.slots.map((s, j) => (j === sIdx ? { ...s, ...patch } : s)) } : c,
      ),
    );
  }
  function addSlot(cIdx: number) {
    setChapters((prev) => prev.map((c, i) => (i === cIdx ? { ...c, slots: [...c.slots, emptySlot()] } : c)));
  }
  function removeSlot(cIdx: number, sIdx: number) {
    setChapters((prev) =>
      prev.map((c, i) => (i === cIdx ? { ...c, slots: c.slots.filter((_, j) => j !== sIdx) } : c)),
    );
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    // 클라이언트 사전 검증
    if (!title.trim()) return showToast("시리즈 제목을 입력하세요.", "error");
    if (!board) return showToast("게시판을 선택하세요.", "error");
    if (!tool.trim()) return showToast("주력 도구명을 입력하세요.", "error");
    if (!intro.trim()) return showToast("시리즈 소개를 입력하세요.", "error");
    if (chapters.length === 0) return showToast("챕터를 최소 1개 추가하세요.", "error");
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i]!;
      if (!c.title.trim()) return showToast(`${i + 1}강 제목을 입력하세요.`, "error");
      if (!c.goal.trim()) return showToast(`${i + 1}강 학습목표를 입력하세요.`, "error");
      for (let j = 0; j < c.slots.length; j++) {
        const s = c.slots[j]!;
        if (!s.assetKey.trim() || !s.caption.trim() || !s.alt.trim()) {
          return showToast(`${i + 1}강 이미지 슬롯 ${j + 1}의 키·캡션·대체텍스트를 채우세요.`, "error");
        }
      }
    }

    const payload = {
      title: title.trim(),
      board,
      tool: tool.trim(),
      intro: intro.trim(),
      chapters: chapters.map((c) => ({
        title: c.title.trim(),
        goal: c.goal.trim(),
        outline: c.outlineText.split("\n").map((l) => l.trim()).filter(Boolean),
        slots: c.slots.map((s) => ({
          assetKey: s.assetKey.trim(),
          caption: s.caption.trim(),
          alt: s.alt.trim(),
          sourceKind: s.sourceKind,
          ...(s.diagramPrompt.trim() ? { diagramPrompt: s.diagramPrompt.trim() } : {}),
          ...(s.sourceUrl.trim() ? { sourceUrl: s.sourceUrl.trim() } : {}),
        })),
      })),
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/curriculum/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "저장 실패");
      }
      showToast("커리큘럼 플랜이 생성되었습니다.", "success");
      setTimeout(() => router.push("/bots/curriculum"), 800);
    } catch (e) {
      showToast((e as Error).message || "저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜", "새 플랜"]} activeKey="bots" activeSubKey="curriculum">
      <div style={{ marginBottom: 16 }}>
        <Link href="/bots/curriculum" className="btn btn-outline btn-sm">
          <i className="ri-arrow-left-line" /> 목록으로
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">새 커리큘럼 플랜</h1>
          <p className="page-description">
            시리즈 정보와 챕터·이미지 슬롯을 직접 작성해 플랜을 생성합니다. 초안 본문·이미지·예약은 생성 후 상세 페이지에서 진행합니다.
          </p>
        </div>
      </div>

      {/* 시리즈 헤더 */}
      <article className="card" style={{ marginBottom: 24, padding: 18 }}>
        <h2 className="section-title" style={{ margin: "0 0 16px", fontSize: 16 }}>시리즈 정보</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, color: "var(--gray-500)" }}>시리즈 제목 *</span>
            <input className="control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 제로부터 바이브코딩" style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, color: "var(--gray-500)" }}>게시판 *</span>
            <div style={{ marginTop: 4 }}>
              <Select value={board} onChange={setBoard} options={BOARD_OPTIONS} />
            </div>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, color: "var(--gray-500)" }}>주력 도구명 *</span>
            <input className="control" value={tool} onChange={(e) => setTool(e.target.value)} placeholder="예: Claude Code" style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block", gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 13, color: "var(--gray-500)" }}>시리즈 소개 *</span>
            <textarea className="control" value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="시리즈 한 줄 소개" style={{ width: "100%", marginTop: 4, resize: "vertical" }} />
          </label>
        </div>
      </article>

      {/* 챕터들 */}
      {chapters.map((chapter, cIdx) => (
        <article key={cIdx} className="card" style={{ marginBottom: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0, fontSize: 15 }}>{cIdx + 1}강</h2>
            {chapters.length > 1 && (
              <button className="btn btn-sm btn-outline" type="button" style={{ marginLeft: "auto" }} onClick={() => removeChapter(cIdx)}>
                <i className="ri-delete-bin-line" /> 이 강 삭제
              </button>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, color: "var(--gray-500)" }}>편 제목 *</span>
              <input className="control" value={chapter.title} onChange={(e) => updateChapter(cIdx, { title: e.target.value })} placeholder="예: 바이브코딩이 대체 뭔가" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, color: "var(--gray-500)" }}>학습목표 *</span>
              <textarea className="control" value={chapter.goal} onChange={(e) => updateChapter(cIdx, { goal: e.target.value })} rows={2} placeholder="이 편이 다뤄야 할 범위" style={{ width: "100%", marginTop: 4, resize: "vertical" }} />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, color: "var(--gray-500)" }}>소주제 (한 줄에 하나)</span>
              <textarea className="control" value={chapter.outlineText} onChange={(e) => updateChapter(cIdx, { outlineText: e.target.value })} rows={3} placeholder={"이 편에서 순서대로 다룰 소주제\n한 줄에 하나씩"} style={{ width: "100%", marginTop: 4, resize: "vertical", fontSize: 13 }} />
            </label>
          </div>

          {/* 이미지 슬롯 */}
          <div style={{ marginTop: 16, borderTop: "1px solid var(--gray-200, #e5e7eb)", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-600)" }}>이미지 슬롯 ({chapter.slots.length})</span>
              <button className="btn btn-sm btn-outline" type="button" style={{ marginLeft: "auto" }} onClick={() => addSlot(cIdx)}>
                <i className="ri-add-line" /> 슬롯 추가
              </button>
            </div>
            {chapter.slots.map((slot, sIdx) => (
              <div key={sIdx} style={{ border: "1px solid var(--gray-200, #e5e7eb)", borderRadius: 8, padding: 12, marginBottom: 8, background: "var(--gray-50, #f9fafb)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-500)" }}>assetKey *</span>
                    <input className="control" value={slot.assetKey} onChange={(e) => updateSlot(cIdx, sIdx, { assetKey: e.target.value })} placeholder="vibe-concept-flow" style={{ width: "100%", marginTop: 3, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-500)" }}>출처 종류 *</span>
                    <div style={{ marginTop: 3 }}>
                      <Select value={slot.sourceKind} onChange={(v) => updateSlot(cIdx, sIdx, { sourceKind: v as SourceKind })} options={SOURCE_KIND_OPTIONS} />
                    </div>
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-500)" }}>캡션 *</span>
                    <input className="control" value={slot.caption} onChange={(e) => updateSlot(cIdx, sIdx, { caption: e.target.value })} placeholder="본문 캡션" style={{ width: "100%", marginTop: 3, fontSize: 13 }} />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, color: "var(--gray-500)" }}>대체 텍스트 *</span>
                    <input className="control" value={slot.alt} onChange={(e) => updateSlot(cIdx, sIdx, { alt: e.target.value })} placeholder="접근성·SEO 대체텍스트" style={{ width: "100%", marginTop: 3, fontSize: 13 }} />
                  </label>
                  {slot.sourceKind === "ai_diagram" && (
                    <label style={{ display: "block", gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "var(--gray-500)" }}>AI 도식 프롬프트 (영문 권장)</span>
                      <textarea className="control" value={slot.diagramPrompt} onChange={(e) => updateSlot(cIdx, sIdx, { diagramPrompt: e.target.value })} rows={2} placeholder="A clean minimal flat infographic..." style={{ width: "100%", marginTop: 3, resize: "vertical", fontSize: 12 }} />
                    </label>
                  )}
                  {(slot.sourceKind === "web_download" || slot.sourceKind === "capture") && (
                    <label style={{ display: "block", gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, color: "var(--gray-500)" }}>원본 URL (sourceUrl)</span>
                      <input className="control" value={slot.sourceUrl} onChange={(e) => updateSlot(cIdx, sIdx, { sourceUrl: e.target.value })} placeholder="https://..." style={{ width: "100%", marginTop: 3, fontSize: 13 }} />
                    </label>
                  )}
                </div>
                <button className="btn btn-sm btn-outline" type="button" style={{ marginTop: 8 }} onClick={() => removeSlot(cIdx, sIdx)}>
                  <i className="ri-delete-bin-line" /> 슬롯 삭제
                </button>
              </div>
            ))}
          </div>
        </article>
      ))}

      {/* 챕터 추가 + 저장 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
        <button className="btn btn-outline" type="button" onClick={addChapter}>
          <i className="ri-add-line" /> 강 추가
        </button>
        <button className="btn btn-primary" type="button" disabled={saving} style={{ marginLeft: "auto" }} onClick={handleSubmit}>
          {saving ? <i className="ri-loader-4-line" /> : <i className="ri-save-line" />} 플랜 생성
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}
