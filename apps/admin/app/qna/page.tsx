"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type {
  AdminQnaQuestionItem,
  AdminQnaAnswerItem,
} from "@ai-jakdang/contracts/admin/qna";

/**
 * Q&A 관리 페이지 (Story 9.7).
 * 질문 탭 / 답변 탭 전환.
 * 필터: Q&A 상태 · 콘텐츠 상태 · 기간 · 신고여부 — URL 파라미터 동기화.
 * 행 액션: 숨김(staff+), 삭제(super_admin 전용).
 * 가드레일: 내용 직접 수정 UI 없음(UX-DR-A9).
 */

// ── 상수 ──────────────────────────────────────────────────────────────────────

const QNA_STATUS_OPTIONS = [
  { value: "all", label: "Q&A 상태: 전체" },
  { value: "pending", label: "답변대기" },
  { value: "answered", label: "답변있음" },
  { value: "resolved", label: "해결됨" },
] as const;

const QUESTION_CONTENT_STATUS_OPTIONS = [
  { value: "all", label: "콘텐츠 상태: 전체" },
  { value: "published", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제" },
  { value: "draft", label: "초안" },
] as const;

const ANSWER_CONTENT_STATUS_OPTIONS = [
  { value: "all", label: "콘텐츠 상태: 전체" },
  { value: "published", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제" },
] as const;

function qnaStatusBadge(qnaStatus: string): [string, string] {
  switch (qnaStatus) {
    case "pending": return ["badge-orange", "답변대기"];
    case "answered": return ["badge-cyan", "답변있음"];
    case "resolved": return ["badge-green", "해결됨"];
    default: return ["badge-gray", qnaStatus];
  }
}

function contentStatusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-red", "삭제"];
    case "draft": return ["badge-yellow", "초안"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
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

// ── 삭제 확인 모달 ────────────────────────────────────────────────────────────

function DeleteModal({
  targetLabel,
  onConfirm,
  onClose,
}: {
  targetLabel: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--surface)", borderRadius: 8, padding: 24,
          width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>삭제 확인</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 8 }}>
          아래 항목을 삭제합니다. soft-delete이므로 복구 가능합니다.
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, wordBreak: "break-all" }}>
          {targetLabel}
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          삭제 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 질문 탭 ──────────────────────────────────────────────────────────────────

function QuestionsTab({
  isSuperAdmin,
  showToast,
}: {
  isSuperAdmin: boolean;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const qnaStatusParam = searchParams.get("qnaStatus") ?? "all";
  const contentStatusParam = searchParams.get("contentStatus") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const hasReportsParam = searchParams.get("hasReports") === "true";
  const qParam = searchParams.get("q") ?? "";

  const [items, setItems] = useState<AdminQnaQuestionItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (qnaStatusParam && qnaStatusParam !== "all") params.set("qnaStatus", qnaStatusParam);
      if (contentStatusParam && contentStatusParam !== "all") params.set("contentStatus", contentStatusParam);
      if (dateFromParam) params.set("dateFrom", dateFromParam);
      if (dateToParam) params.set("dateTo", dateToParam);
      if (hasReportsParam) params.set("hasReports", "true");
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/questions?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("질문 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, qnaStatusParam, contentStatusParam, dateFromParam, dateToParam, hasReportsParam, qParam, showToast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.set("tab", "questions");
    router.push(`/qna?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/qna?${next.toString()}`);
  }

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/questions/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("질문이 숨김 처리되었습니다.", "success");
      fetchQuestions();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/questions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("질문이 삭제되었습니다.", "success");
      fetchQuestions();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <>
      <article className="card">
        {/* 필터 패널 */}
        <div className="filter-panel">
          <div className="filter-row">
            <div className="input-icon">
              <i className="ri-search-line" />
              <input
                className="control"
                type="search"
                placeholder="질문 제목 검색"
                aria-label="질문 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") updateParams({ q: searchInput }); }}
              />
            </div>

            {/* Q&A 상태 */}
            <div className="custom-select">
              <button className="select-trigger" type="button" aria-expanded="false">
                <span>{QNA_STATUS_OPTIONS.find((o) => o.value === qnaStatusParam)?.label ?? "Q&A 상태: 전체"}</span>
                <i className="ri-arrow-down-s-line" />
              </button>
              <div className="select-menu">
                {QNA_STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`select-option${qnaStatusParam === o.value ? " selected" : ""}`}
                    onClick={() => updateParams({ qnaStatus: o.value })}
                  >
                    {o.label}
                    {qnaStatusParam === o.value ? <i className="ri-check-line" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* 콘텐츠 상태 */}
            <div className="custom-select">
              <button className="select-trigger" type="button" aria-expanded="false">
                <span>{QUESTION_CONTENT_STATUS_OPTIONS.find((o) => o.value === contentStatusParam)?.label ?? "콘텐츠 상태: 전체"}</span>
                <i className="ri-arrow-down-s-line" />
              </button>
              <div className="select-menu">
                {QUESTION_CONTENT_STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`select-option${contentStatusParam === o.value ? " selected" : ""}`}
                    onClick={() => updateParams({ contentStatus: o.value })}
                  >
                    {o.label}
                    {contentStatusParam === o.value ? <i className="ri-check-line" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* 기간 */}
            <input
              className="control"
              type="date"
              value={dateFromParam}
              onChange={(e) => updateParams({ dateFrom: e.target.value })}
              aria-label="기간 시작"
              style={{ maxWidth: 160 }}
            />
            <input
              className="control"
              type="date"
              value={dateToParam}
              onChange={(e) => updateParams({ dateTo: e.target.value })}
              aria-label="기간 종료"
              style={{ maxWidth: 160 }}
            />

            {/* 신고여부 */}
            <label className="choice" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                className="check"
                checked={hasReportsParam}
                onChange={(e) => updateParams({ hasReports: e.target.checked ? "true" : "" })}
              />
              <span>신고있음만</span>
            </label>

            <div className="filter-actions">
              <button
                className="btn btn-outline"
                onClick={() => { setSearchInput(""); router.push("/qna?tab=questions"); }}
              >
                <i className="ri-refresh-line" />
                초기화
              </button>
              <button
                className="btn btn-primary"
                onClick={() => updateParams({ q: searchInput })}
              >
                <i className="ri-search-line" />
                검색
              </button>
            </div>
          </div>
        </div>

        {/* 툴바 */}
        <div className="table-toolbar">
          <div className="toolbar-left">
            <span className="selection-info">총 {meta.totalItems}개의 질문</span>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
              불러오는 중...
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>Q&A 상태</th>
                  <th>콘텐츠 상태</th>
                  <th>답변수</th>
                  <th>조회</th>
                  <th>신고</th>
                  <th style={{ width: 60 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                      질문이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const [qnaBadge, qnaLabel] = qnaStatusBadge(item.qnaStatus);
                    const [contentBadge, contentLabel] = contentStatusBadge(item.status);
                    return (
                      <tr key={item.id} style={item.status === "hidden" || item.status === "deleted" ? { opacity: 0.6 } : undefined}>
                        <td>
                          <Link className="content-title" href={`/qna/${item.id}`}>{item.title}</Link>
                        </td>
                        <td>
                          <div className="author">
                            <span className="author-avatar">
                              {item.authorNickname ? item.authorNickname.slice(0, 1) : "?"}
                            </span>
                            <span>{item.authorNickname ?? "(탈퇴)"}</span>
                          </div>
                        </td>
                        <td className="num">{formatDate(item.createdAt)}</td>
                        <td><span className={`badge ${qnaBadge}`}>{qnaLabel}</span></td>
                        <td><span className={`badge ${contentBadge}`}>{contentLabel}</span></td>
                        <td className="num">{item.answerCount}</td>
                        <td className="num">{item.viewCount.toLocaleString()}</td>
                        <td className="num">
                          {item.reportCount > 0 ? (
                            <span className="badge badge-red">{item.reportCount}</span>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-button row-action-button" aria-label="행 메뉴">
                              <i className="ri-more-2-fill" />
                            </button>
                            <div className="action-menu">
                              <Link href={`/qna/${item.id}`}>
                                <i className="ri-eye-line" />
                                상세 보기
                              </Link>
                              {/* 숨김 처리 — staff 이상 */}
                              {item.status !== "hidden" && item.status !== "deleted" && (
                                <button type="button" onClick={() => handleHide(item.id)}>
                                  <i className="ri-eye-off-line" />
                                  숨김
                                </button>
                              )}
                              {/* 삭제 — super_admin 전용 */}
                              {isSuperAdmin && item.status !== "deleted" && (
                                <button
                                  className="danger"
                                  type="button"
                                  onClick={() => setDeleteModal({ id: item.id, title: item.title })}
                                >
                                  <i className="ri-delete-bin-line" />
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {meta.totalPages > 1 && (
          <div className="pagination">
            <div className="page-info">
              {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}개
            </div>
            <div className="page-buttons">
              <button
                className="page-button"
                aria-label="이전 페이지"
                disabled={meta.page <= 1}
                onClick={() => goPage(meta.page - 1)}
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`page-button${meta.page === p ? " active" : ""}`}
                    onClick={() => goPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="page-button"
                aria-label="다음 페이지"
                disabled={meta.page >= meta.totalPages}
                onClick={() => goPage(meta.page + 1)}
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        )}
      </article>

      {deleteModal && (
        <DeleteModal
          targetLabel={deleteModal.title}
          onConfirm={() => handleDeleteConfirm(deleteModal.id)}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </>
  );
}

// ── 답변 탭 ──────────────────────────────────────────────────────────────────

function AnswersTab({
  isSuperAdmin,
  showToast,
}: {
  isSuperAdmin: boolean;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const contentStatusParam = searchParams.get("contentStatus") ?? "all";
  const hasReportsParam = searchParams.get("hasReports") === "true";

  const [items, setItems] = useState<AdminQnaAnswerItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null);

  const fetchAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (contentStatusParam && contentStatusParam !== "all") params.set("contentStatus", contentStatusParam);
      if (hasReportsParam) params.set("hasReports", "true");

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/answers?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("답변 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, contentStatusParam, hasReportsParam, showToast]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    next.set("tab", "answers");
    router.push(`/qna?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/qna?${next.toString()}`);
  }

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/answers/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("답변이 숨김 처리되었습니다.", "success");
      fetchAnswers();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/qna/answers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("답변이 삭제되었습니다.", "success");
      fetchAnswers();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <>
      <article className="card">
        {/* 필터 */}
        <div className="filter-panel">
          <div className="filter-row">
            {/* 콘텐츠 상태 */}
            <div className="custom-select">
              <button className="select-trigger" type="button" aria-expanded="false">
                <span>{ANSWER_CONTENT_STATUS_OPTIONS.find((o) => o.value === contentStatusParam)?.label ?? "콘텐츠 상태: 전체"}</span>
                <i className="ri-arrow-down-s-line" />
              </button>
              <div className="select-menu">
                {ANSWER_CONTENT_STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    className={`select-option${contentStatusParam === o.value ? " selected" : ""}`}
                    onClick={() => updateParams({ contentStatus: o.value })}
                  >
                    {o.label}
                    {contentStatusParam === o.value ? <i className="ri-check-line" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* 신고여부 */}
            <label className="choice" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                className="check"
                checked={hasReportsParam}
                onChange={(e) => updateParams({ hasReports: e.target.checked ? "true" : "" })}
              />
              <span>신고있음만</span>
            </label>

            <div className="filter-actions">
              <button
                className="btn btn-outline"
                onClick={() => router.push("/qna?tab=answers")}
              >
                <i className="ri-refresh-line" />
                초기화
              </button>
            </div>
          </div>
        </div>

        {/* 툴바 */}
        <div className="table-toolbar">
          <div className="toolbar-left">
            <span className="selection-info">총 {meta.totalItems}개의 답변</span>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
              불러오는 중...
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>소속 질문</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>콘텐츠 상태</th>
                  <th>신고</th>
                  <th style={{ width: 60 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                      답변이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const [contentBadge, contentLabel] = contentStatusBadge(item.status);
                    return (
                      <tr key={item.id} style={item.status === "hidden" || item.status === "deleted" ? { opacity: 0.6 } : undefined}>
                        <td>
                          <Link className="content-title" href={`/qna/${item.questionId}`}>
                            {item.questionTitle ?? `질문 #${item.questionId.slice(0, 8)}`}
                          </Link>
                        </td>
                        <td>
                          <div className="author">
                            <span className="author-avatar">
                              {item.authorNickname ? item.authorNickname.slice(0, 1) : "?"}
                            </span>
                            <span>{item.authorNickname ?? "(탈퇴)"}</span>
                          </div>
                        </td>
                        <td className="num">{formatDate(item.createdAt)}</td>
                        <td><span className={`badge ${contentBadge}`}>{contentLabel}</span></td>
                        <td className="num">
                          {item.reportCount > 0 ? (
                            <span className="badge badge-red">{item.reportCount}</span>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-button row-action-button" aria-label="행 메뉴">
                              <i className="ri-more-2-fill" />
                            </button>
                            <div className="action-menu">
                              <Link href={`/qna/${item.questionId}`}>
                                <i className="ri-eye-line" />
                                질문 보기
                              </Link>
                              {item.status !== "hidden" && item.status !== "deleted" && (
                                <button type="button" onClick={() => handleHide(item.id)}>
                                  <i className="ri-eye-off-line" />
                                  숨김
                                </button>
                              )}
                              {isSuperAdmin && item.status !== "deleted" && (
                                <button
                                  className="danger"
                                  type="button"
                                  onClick={() => setDeleteModal({ id: item.id, label: `답변 #${item.id.slice(0, 8)}` })}
                                >
                                  <i className="ri-delete-bin-line" />
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {meta.totalPages > 1 && (
          <div className="pagination">
            <div className="page-info">
              {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}개
            </div>
            <div className="page-buttons">
              <button
                className="page-button"
                aria-label="이전 페이지"
                disabled={meta.page <= 1}
                onClick={() => goPage(meta.page - 1)}
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`page-button${meta.page === p ? " active" : ""}`}
                    onClick={() => goPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="page-button"
                aria-label="다음 페이지"
                disabled={meta.page >= meta.totalPages}
                onClick={() => goPage(meta.page + 1)}
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        )}
      </article>

      {deleteModal && (
        <DeleteModal
          targetLabel={deleteModal.label}
          onConfirm={() => handleDeleteConfirm(deleteModal.id)}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

function AdminQnaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "questions";

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 관리자 role 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  function switchTab(tab: string) {
    const next = new URLSearchParams();
    next.set("tab", tab);
    router.push(`/qna?${next.toString()}`);
  }

  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">묻고답하기 관리</h1>
          <p className="page-description">질문과 답변을 상태별로 점검하고 숨김·삭제를 처리합니다.</p>
        </div>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            {/* 질문/답변 탭 */}
            <div className="line-tabs" role="tablist" aria-label="관리 대상">
              <button
                className={`line-tab${tabParam === "questions" ? " active" : ""}`}
                role="tab"
                aria-selected={tabParam === "questions"}
                onClick={() => switchTab("questions")}
              >
                <i className="ri-question-answer-line" style={{ marginRight: 6 }} />
                질문 목록
              </button>
              <button
                className={`line-tab${tabParam === "answers" ? " active" : ""}`}
                role="tab"
                aria-selected={tabParam === "answers"}
                onClick={() => switchTab("answers")}
              >
                <i className="ri-chat-3-line" style={{ marginRight: 6 }} />
                답변 목록
              </button>
            </div>
          </div>
        </div>

        {tabParam === "questions" ? (
          <QuestionsTab isSuperAdmin={isSuperAdmin} showToast={showToast} />
        ) : (
          <AnswersTab isSuperAdmin={isSuperAdmin} showToast={showToast} />
        )}
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

export default function AdminQnaPage() {
  return (
    <Suspense>
      <AdminQnaContent />
    </Suspense>
  );
}
