"use client";

/**
 * 주제 풀 탭 (Story 11.15 — Task 7).
 *
 * - 봇 주제 목록 표시 (title_seed, board, topic_kind, status, used_at)
 * - 인라인 수정 (title_seed, board, series_group)
 * - 주제 추가 폼 (title_seed, board, topic_kind, series_group)
 * - 주제 삭제 (confirmDialog)
 * - 자동 보충 토글 (bot_settings 전역)
 */

import { useState, useEffect, useCallback } from "react";
import { Select } from "@/components/ui/Select";
import { BOARDS } from "@/lib/boards";
import { confirmDialog } from "@/lib/dialog";
import { API_BASE_URL } from "@/lib/api";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface BotTopic {
  id: string;
  personaId: string;
  board: string;
  titleSeed: string;
  topicKind: "fixed" | "realtime" | "auto";
  status: "unused" | "used" | "cooling";
  usedAt: string | null;
  seriesGroup: string | null;
  createdAt: string;
}

export interface BotTopicsSectionProps {
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

const TOPIC_KIND_OPTIONS = [
  { value: "fixed", label: "고정(fixed)" },
  { value: "realtime", label: "실시간(realtime)" },
  { value: "auto", label: "자동 보충(auto)" },
];

function getBoardLabel(value: string): string {
  return ALL_BOARD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function getStatusBadge(status: BotTopic["status"]) {
  switch (status) {
    case "unused":
      return <span className="badge badge-green">미사용</span>;
    case "used":
      return <span className="badge badge-gray">사용됨</span>;
    case "cooling":
      return <span className="badge badge-orange">재사용대기</span>;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function BotTopicsSection({ botId, showToast }: BotTopicsSectionProps) {
  const [topics, setTopics] = useState<BotTopic[]>([]);
  const [autoRefill, setAutoRefill] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 추가 폼 상태
  const [newTitleSeed, setNewTitleSeed] = useState("");
  const [newBoard, setNewBoard] = useState("");
  const [newTopicKind, setNewTopicKind] = useState<"fixed" | "realtime" | "auto">("fixed");
  const [newSeriesGroup, setNewSeriesGroup] = useState("");

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleSeed, setEditTitleSeed] = useState("");
  const [editBoard, setEditBoard] = useState("");
  const [editSeriesGroup, setEditSeriesGroup] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsRes, refillRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/topics`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/auto-refill`, { credentials: "include" }),
      ]);
      if (!topicsRes.ok) throw new Error("주제 목록 조회 실패");
      const topicsData = await topicsRes.json();
      setTopics(topicsData.items ?? []);

      if (refillRes.ok) {
        const refillData = await refillRes.json();
        setAutoRefill(refillData.bot_auto_refill_topics ?? false);
      }
    } catch {
      showToast("주제 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [botId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 주제 추가 ─────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!newTitleSeed.trim() || !newBoard) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/topics`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: newBoard,
          titleSeed: newTitleSeed.trim(),
          topicKind: newTopicKind,
          seriesGroup: newSeriesGroup.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "주제 추가 실패");
      }
      const created: BotTopic = await res.json();
      setTopics((prev) => [created, ...prev]);
      setNewTitleSeed("");
      setNewBoard("");
      setNewTopicKind("fixed");
      setNewSeriesGroup("");
      showToast("주제가 추가되었습니다.", "success");
    } catch (e) {
      showToast(`추가 실패: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 인라인 수정 시작 ─────────────────────────────────────────────────────

  function startEdit(topic: BotTopic) {
    setEditingId(topic.id);
    setEditTitleSeed(topic.titleSeed);
    setEditBoard(topic.board);
    setEditSeriesGroup(topic.seriesGroup ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave(topicId: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/topics/${topicId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleSeed: editTitleSeed.trim() || undefined,
          board: editBoard || undefined,
          seriesGroup: editSeriesGroup.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "수정 실패");
      }
      const updated: BotTopic = await res.json();
      setTopics((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
      setEditingId(null);
      showToast("주제가 수정되었습니다.", "success");
    } catch (e) {
      showToast(`수정 실패: ${(e as Error).message}`, "error");
    } finally {
      setEditSaving(false);
    }
  }

  // ── 주제 삭제 ─────────────────────────────────────────────────────────────

  async function handleDelete(topicId: string) {
    const ok = await confirmDialog({ title: "주제 삭제", message: "이 주제를 삭제하시겠습니까?", tone: "danger" });
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/topics/${topicId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? "삭제 실패");
      }
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      showToast("주제가 삭제되었습니다.", "success");
    } catch (e) {
      showToast(`삭제 실패: ${(e as Error).message}`, "error");
    }
  }

  // ── 자동 보충 토글 ─────────────────────────────────────────────────────────

  async function handleToggleAutoRefill() {
    const next = !autoRefill;
    setAutoRefill(next); // optimistic
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/auto-refill`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_auto_refill_topics: next }),
      });
      if (!res.ok) {
        setAutoRefill(!next); // rollback
        throw new Error("자동 보충 설정 실패");
      }
      showToast(`주제 자동 보충이 ${next ? "켜졌습니다" : "꺼졌습니다"} (전역 설정).`, "success");
    } catch (e) {
      showToast(`설정 실패: ${(e as Error).message}`, "error");
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--gray-400)" }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="component-stack">

      {/* ── 자동 보충 토글 ────────────────────────────────────────────────── */}
      <section className="section">
        <article className="card">
          <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>주제 자동 보충</div>
              <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                전역 설정 — 모든 봇에 적용됩니다. 주제 풀이 부족할 때 AI가 자동으로 주제를 보충합니다.
              </div>
            </div>
            <button
              type="button"
              className={`btn ${autoRefill ? "btn-primary" : "btn-outline"}`}
              onClick={handleToggleAutoRefill}
              style={{ flexShrink: 0, minWidth: 100 }}
            >
              <i className={`ri-${autoRefill ? "toggle-fill" : "toggle-line"}`} />
              {autoRefill ? "ON" : "OFF"}
            </button>
          </div>
        </article>
      </section>

      {/* ── 주제 목록 테이블 ──────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">주제 풀 ({topics.length})</h2>
        </div>
        <article className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {topics.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--gray-400)" }}>
                등록된 주제가 없습니다.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>주제 텍스트</th>
                      <th style={{ minWidth: 120 }}>게시판</th>
                      <th style={{ minWidth: 80 }}>종류</th>
                      <th style={{ minWidth: 90 }}>상태</th>
                      <th style={{ minWidth: 130 }}>마지막 사용</th>
                      <th style={{ width: 120 }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((topic) =>
                      editingId === topic.id ? (
                        /* 인라인 편집 행 */
                        <tr key={topic.id} style={{ background: "var(--gray-50, #f9fafb)" }}>
                          <td>
                            <input
                              type="text"
                              className="control"
                              value={editTitleSeed}
                              onChange={(e) => setEditTitleSeed(e.target.value)}
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td>
                            <Select
                              options={ALL_BOARD_OPTIONS}
                              value={editBoard}
                              onChange={setEditBoard}
                              placeholder="게시판"
                            />
                          </td>
                          <td style={{ color: "var(--gray-400)", fontSize: 12 }}>
                            {topic.topicKind}
                          </td>
                          <td>{getStatusBadge(topic.status)}</td>
                          <td>
                            <input
                              type="text"
                              className="control"
                              value={editSeriesGroup}
                              onChange={(e) => setEditSeriesGroup(e.target.value)}
                              placeholder="시리즈 그룹 (선택)"
                              style={{ width: "100%" }}
                            />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={editSaving}
                                onClick={() => handleEditSave(topic.id)}
                              >
                                {editSaving ? <i className="ri-loader-4-line" /> : <i className="ri-save-line" />}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={cancelEdit}
                              >
                                <i className="ri-close-line" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        /* 일반 보기 행 */
                        <tr key={topic.id}>
                          <td>
                            <div style={{ maxWidth: 280 }}>
                              <div style={{ fontWeight: 500 }}>{topic.titleSeed}</div>
                              {topic.seriesGroup && (
                                <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 2 }}>
                                  시리즈: {topic.seriesGroup}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{getBoardLabel(topic.board)}</td>
                          <td>
                            <span className="badge badge-blue">
                              {TOPIC_KIND_OPTIONS.find((k) => k.value === topic.topicKind)?.label ?? topic.topicKind}
                            </span>
                          </td>
                          <td>{getStatusBadge(topic.status)}</td>
                          <td style={{ fontSize: 12, color: "var(--gray-500)" }}>
                            {formatDate(topic.usedAt)}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => startEdit(topic)}
                              >
                                <i className="ri-edit-line" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(topic.id)}
                              >
                                <i className="ri-delete-bin-line" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── 주제 추가 폼 ─────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">주제 추가</h2>
        </div>
        <article className="card">
          <div className="card-body">
            <div className="component-stack">
              <div className="field">
                <label className="field-label" htmlFor="new-title-seed">
                  주제 텍스트 (title_seed) <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  id="new-title-seed"
                  type="text"
                  className="control"
                  value={newTitleSeed}
                  onChange={(e) => setNewTitleSeed(e.target.value)}
                  placeholder="예: 바이브코딩으로 SaaS 만드는 법"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Select
                  label="게시판 (board) *"
                  options={ALL_BOARD_OPTIONS}
                  value={newBoard}
                  onChange={setNewBoard}
                  placeholder="게시판 선택"
                />
                <Select
                  label="주제 종류 (topic_kind)"
                  options={TOPIC_KIND_OPTIONS}
                  value={newTopicKind}
                  onChange={(v) => setNewTopicKind(v as "fixed" | "realtime" | "auto")}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="new-series-group">
                  시리즈 그룹 (series_group, 선택)
                </label>
                <input
                  id="new-series-group"
                  type="text"
                  className="control"
                  value={newSeriesGroup}
                  onChange={(e) => setNewSeriesGroup(e.target.value)}
                  placeholder="예: 바이브코딩 입문 시리즈"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !newTitleSeed.trim() || !newBoard}
                  onClick={handleAdd}
                >
                  {saving ? (
                    <>
                      <i className="ri-loader-4-line" />
                      추가 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-add-line" />
                      주제 추가
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
