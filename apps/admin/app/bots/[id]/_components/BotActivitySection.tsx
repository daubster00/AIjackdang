"use client";

/**
 * 활동 설정 탭 (Story 11.15 — Task 6).
 *
 * - 활동 리듬(글/주·댓글/주·활동시간대·요일가중치) 편집
 * - 담당 게시판(board + weight) 추가/삭제
 * - 저장 → PATCH /rhythm + PUT /boards 순차 호출
 */

import { useState, useEffect, useCallback } from "react";
import { Select } from "@/components/ui/Select";
import { BOARDS } from "@/lib/boards";
import { API_BASE_URL } from "@/lib/api";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface ActiveHour {
  from: number;
  to: number;
  crossesMidnight: boolean;
}

interface ActiveDays {
  weekday: number;
  weekend: number;
}

interface BoardEntry {
  board: string;
  weight: number;
}

export interface BotActivitySectionProps {
  botId: string;
  showToast: (message: string, type: "success" | "error") => void;
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const SPECIAL_BOARD_OPTIONS = [
  { value: "qna", label: "묻고답하기 (Q&A)" },
  { value: "resource:prompt", label: "실전자료 · 프롬프트" },
  { value: "resource:mcp", label: "실전자료 · MCP" },
  { value: "resource:rules-config", label: "실전자료 · 룰/설정" },
  { value: "resource:template-checklist", label: "실전자료 · 템플릿/체크리스트" },
];

const ALL_BOARD_OPTIONS = [
  ...BOARDS.map((b) => ({ value: b.apiBoard ?? b.slug, label: b.label })),
  ...SPECIAL_BOARD_OPTIONS,
];

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function BotActivitySection({ botId, showToast }: BotActivitySectionProps) {
  // 리듬 상태
  const [postsPerWeek, setPostsPerWeek] = useState(0);
  const [commentsPerWeek, setCommentsPerWeek] = useState(0);
  const [activeHours, setActiveHours] = useState<ActiveHour[]>([]);
  const [activeDays, setActiveDays] = useState<ActiveDays>({ weekday: 0.7, weekend: 0.3 });

  // 게시판 상태
  const [boards, setBoards] = useState<BoardEntry[]>([]);
  const [addBoardValue, setAddBoardValue] = useState("");
  const [addBoardWeight, setAddBoardWeight] = useState(5);

  // 새 활동 시간대 추가 폼
  const [addFrom, setAddFrom] = useState(21);
  const [addTo, setAddTo] = useState(23);
  const [addCrossesMidnight, setAddCrossesMidnight] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/rhythm`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      if (data.rhythm) {
        setPostsPerWeek(data.rhythm.postsPerWeek ?? 0);
        setCommentsPerWeek(data.rhythm.commentsPerWeek ?? 0);
        setActiveHours(
          (data.rhythm.activeHours ?? []).map((h: ActiveHour) => ({
            from: h.from,
            to: h.to,
            crossesMidnight: h.crossesMidnight ?? false,
          })),
        );
        const days = data.rhythm.activeDays as Record<string, number> | null;
        setActiveDays({
          weekday: days?.weekday ?? 0.7,
          weekend: days?.weekend ?? 0.3,
        });
      }
      setBoards(data.boards ?? []);
    } catch {
      showToast("활동 설정을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [botId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 활동 시간대 ────────────────────────────────────────────────────────────

  function addHour() {
    if (addTo > 24) return;
    setActiveHours((prev) => [
      ...prev,
      { from: addFrom, to: addTo, crossesMidnight: addCrossesMidnight },
    ]);
    setAddFrom(21);
    setAddTo(23);
    setAddCrossesMidnight(false);
  }

  function removeHour(index: number) {
    setActiveHours((prev) => prev.filter((_, i) => i !== index));
  }

  // ── 담당 게시판 ────────────────────────────────────────────────────────────

  function addBoard() {
    if (!addBoardValue) return;
    if (boards.some((b) => b.board === addBoardValue)) return;
    setBoards((prev) => [...prev, { board: addBoardValue, weight: addBoardWeight }]);
    setAddBoardValue("");
    setAddBoardWeight(5);
  }

  function removeBoard(board: string) {
    setBoards((prev) => prev.filter((b) => b.board !== board));
  }

  const availableBoardOptions = ALL_BOARD_OPTIONS.filter(
    (opt) => !boards.some((b) => b.board === opt.value),
  );

  // ── 저장 ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      // 1. PATCH /rhythm
      const rhythmRes = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/rhythm`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postsPerWeek,
          commentsPerWeek,
          activeHours,
          activeDays,
        }),
      });
      if (!rhythmRes.ok) {
        const err = await rhythmRes.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "리듬 저장 실패");
      }

      // 2. PUT /boards
      const boardsRes = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/boards`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boards }),
      });
      if (!boardsRes.ok) {
        const err = await boardsRes.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "게시판 저장 실패");
      }

      showToast("활동 설정이 저장되었습니다.", "success");
    } catch (e) {
      showToast(`저장 실패: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 게시판 레이블 조회 헬퍼 ─────────────────────────────────────────────────

  function getBoardLabel(value: string): string {
    return ALL_BOARD_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--gray-400)" }}>
        불러오는 중...
      </div>
    );
  }

  const dayTotal = activeDays.weekday + activeDays.weekend;

  return (
    <div className="component-stack">

      {/* ── 활동 빈도 ─────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">활동 빈도</h2>
        </div>
        <article className="card">
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field">
                <label className="field-label" htmlFor="posts-per-week">글 / 주</label>
                <input
                  id="posts-per-week"
                  type="number"
                  min={0}
                  className="control"
                  value={postsPerWeek}
                  onChange={(e) => setPostsPerWeek(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ maxWidth: 160 }}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="comments-per-week">댓글 / 주</label>
                <input
                  id="comments-per-week"
                  type="number"
                  min={0}
                  className="control"
                  value={commentsPerWeek}
                  onChange={(e) => setCommentsPerWeek(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ maxWidth: 160 }}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ── 활동 시간대 ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">활동 시간대</h2>
          <p className="section-description">시작 시·종료 시 쌍으로 추가. to &gt; 23 입력 불가.</p>
        </div>
        <article className="card">
          <div className="card-body">
            {/* 현재 목록 */}
            {activeHours.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>시작 (from)</th>
                      <th>종료 (to)</th>
                      <th>자정 넘김</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHours.map((h, i) => (
                      <tr key={i}>
                        <td>{h.from}시</td>
                        <td>{h.to}시</td>
                        <td>{h.crossesMidnight ? "✓" : "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeHour(i)}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* 추가 폼 */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ marginBottom: 0, flex: "0 0 120px" }}>
                <label className="field-label">시작 (0~23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="control"
                  value={addFrom}
                  onChange={(e) => setAddFrom(Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                />
              </div>
              <div className="field" style={{ marginBottom: 0, flex: "0 0 120px" }}>
                <label className="field-label">종료 (0~23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="control"
                  value={addTo}
                  onChange={(e) => setAddTo(Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                />
              </div>
              <div
                className="field"
                style={{ marginBottom: 0, flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, paddingTop: 24 }}
              >
                <input
                  id="add-crosses-midnight"
                  type="checkbox"
                  checked={addCrossesMidnight}
                  onChange={(e) => setAddCrossesMidnight(e.target.checked)}
                />
                <label htmlFor="add-crosses-midnight" style={{ fontSize: 13 }}>자정 넘김</label>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flexShrink: 0, marginBottom: 1 }}
                onClick={addHour}
              >
                <i className="ri-add-line" />
                시간대 추가
              </button>
            </div>
          </div>
        </article>
      </section>

      {/* ── 활동 요일 가중치 ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">활동 요일 가중치</h2>
          <p className="section-description">
            합계 1.0 권장 (현재: {dayTotal.toFixed(2)})
            {Math.abs(dayTotal - 1) > 0.01 && (
              <span style={{ color: "var(--warning, #d97706)", marginLeft: 8 }}>
                ⚠ 합계가 1.0이 아닙니다
              </span>
            )}
          </p>
        </div>
        <article className="card">
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field">
                <label className="field-label" htmlFor="weekday-weight">
                  주중 가중치 (weekday)
                </label>
                <input
                  id="weekday-weight"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="control"
                  value={activeDays.weekday}
                  onChange={(e) =>
                    setActiveDays((prev) => ({ ...prev, weekday: parseFloat(e.target.value) || 0 }))
                  }
                  style={{ maxWidth: 160 }}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="weekend-weight">
                  주말 가중치 (weekend)
                </label>
                <input
                  id="weekend-weight"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="control"
                  value={activeDays.weekend}
                  onChange={(e) =>
                    setActiveDays((prev) => ({ ...prev, weekend: parseFloat(e.target.value) || 0 }))
                  }
                  style={{ maxWidth: 160 }}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ── 담당 게시판 ─────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">담당 게시판</h2>
          <p className="section-description">
            이 봇이 글을 올릴 게시판과 배분 가중치(1~10)를 설정합니다.
          </p>
        </div>
        <article className="card">
          <div className="card-body">
            {/* 현재 담당 목록 */}
            {boards.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>게시판</th>
                      <th>가중치</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((b) => (
                      <tr key={b.board}>
                        <td>{getBoardLabel(b.board)}</td>
                        <td>{b.weight}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeBoard(b.board)}
                          >
                            <i className="ri-delete-bin-line" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* 추가 행 */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <Select
                  label="게시판 선택"
                  options={availableBoardOptions}
                  value={addBoardValue}
                  onChange={setAddBoardValue}
                  placeholder="게시판 선택"
                />
              </div>
              <div className="field" style={{ marginBottom: 0, flex: "0 0 100px" }}>
                <label className="field-label">가중치 (1~10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="control"
                  value={addBoardWeight}
                  onChange={(e) =>
                    setAddBoardWeight(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                />
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flexShrink: 0, marginBottom: 1 }}
                onClick={addBoard}
                disabled={!addBoardValue}
              >
                <i className="ri-add-line" />
                추가
              </button>
            </div>
          </div>
        </article>
      </section>

      {/* ── 저장 버튼 ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 0 24px" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <>
              <i className="ri-loader-4-line" />
              저장 중...
            </>
          ) : (
            <>
              <i className="ri-save-line" />
              활동 설정 저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
