"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RowActionMenu, type RowActionItem } from "@/components/ui/RowActionMenu";
import { API_BASE_URL } from "../../lib/api";
import { notifyDialog } from "@/lib/dialog";
import { SanctionModal } from "@/app/members/_components/SanctionModal";
import type { AdminReportItem } from "@ai-jakdang/contracts";

// 서비스가 추가로 반환하는 필드 (계약 타입 확장)
type ReportItemExtended = AdminReportItem & {
  targetBoard?: string | null;
  reporterAvatarUrl?: string | null;
  reporterImage?: string | null;
  reporterDefaultAvatarIndex?: number | null;
  reportedUserId?: string | null;
};

/**
 * 신고 관리 페이지 (Story 9.10).
 * GET /api/v1/admin/reports 실제 API 연동.
 * URL 파라미터: page, status, targetType, dateFrom, dateTo, q
 * 상태 탭: 전체/접수/확인중/처리완료/반려
 * 행 클릭 → /reports/{id} 상세페이지 이동
 */

// ── 상수 ─────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "접수" },
  { key: "reviewing", label: "확인중" },
  { key: "resolved", label: "처리완료" },
  { key: "dismissed", label: "반려" },
  { key: "auto_hidden", label: "자동 숨김" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

const TARGET_OPTIONS = [
  { value: "all", label: "대상 유형: 전체" },
  { value: "post", label: "게시글" },
  { value: "comment", label: "댓글" },
  { value: "question", label: "질문" },
  { value: "answer", label: "답변" },
  { value: "resource", label: "실전자료" },
  { value: "message", label: "쪽지" },
  { value: "user", label: "회원" },
] as const;

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "pending": return ["badge-gray", "접수"];
    case "reviewing": return ["badge-purple", "확인중"];
    case "resolved": return ["badge-green", "처리완료"];
    case "dismissed": return ["badge-blue", "반려"];
    default: return ["badge-gray", status];
  }
}

function targetBadge(targetType: string): [string, string] {
  switch (targetType) {
    case "post": return ["badge-blue", "게시글"];
    case "comment": return ["badge-purple", "댓글"];
    case "question": return ["badge-blue", "질문"];
    case "answer": return ["badge-purple", "답변"];
    case "resource": return ["badge-cyan", "실전자료"];
    case "message": return ["badge-gray", "쪽지"];
    case "user": return ["badge-teal", "회원"];
    default: return ["badge-gray", targetType];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 반려 모달 ─────────────────────────────────────────────────────────────────

function RejectModal({
  reportId,
  onConfirm,
  onClose,
}: {
  reportId: string;
  onConfirm: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)",
          borderRadius: 8,
          padding: 24,
          width: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>신고 반려</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          반려 처리 후 복구가 어렵습니다. 반려 사유를 반드시 입력해주세요.
        </p>
        <label
          style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}
        >
          반려 사유 (필수)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="반려 사유를 입력하세요. (운영진만 열람)"
          rows={4}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-outline" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-danger"
            disabled={!note.trim()}
            onClick={() => onConfirm(reportId, note.trim())}
          >
            반려 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ──────────────────────────────────────────────────────

function AdminReportsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터
  const statusParam = (searchParams.get("status") ?? "all") as StatusTab;
  const targetTypeParam = searchParams.get("targetType") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const qParam = searchParams.get("q") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1");

  // 로컬 필터 상태 (검색 버튼 누를 때 URL 반영)
  const [localQ, setLocalQ] = useState(qParam);
  const [localTargetType, setLocalTargetType] = useState(targetTypeParam);
  const [localDateFrom, setLocalDateFrom] = useState(dateFromParam);
  const [localDateTo, setLocalDateTo] = useState(dateToParam);

  // 데이터
  const [reports, setReports] = useState<ReportItemExtended[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI 상태
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [sanctionTarget, setSanctionTarget] = useState<{ reportId: string; targetId: string } | null>(null);

  // ── 목록 조회 ────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    // "auto_hidden"은 API status enum에 없는 가상 탭 — autoHidden=true 파라미터로 변환
    if (statusParam === "auto_hidden") {
      params.set("autoHidden", "true");
    } else if (statusParam !== "all") {
      params.set("status", statusParam);
    }
    if (targetTypeParam !== "all") params.set("targetType", targetTypeParam);
    if (dateFromParam) params.set("dateFrom", dateFromParam);
    if (dateToParam) params.set("dateTo", dateToParam);
    if (qParam) params.set("q", qParam);
    params.set("page", String(pageParam));
    params.set("pageSize", "20");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        items: ReportItemExtended[];
        meta: typeof meta;
      };
      setReports(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusParam, targetTypeParam, dateFromParam, dateToParam, qParam, pageParam]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // ── URL 업데이트 헬퍼 ─────────────────────────────────────────────────────
  const updateUrl = useCallback(
    (patch: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v) p.set(k, v);
        else p.delete(k);
      });
      p.set("page", "1");
      router.push(`/reports?${p.toString()}`);
    },
    [searchParams, router],
  );

  const handleSearch = () => {
    updateUrl({
      q: localQ,
      targetType: localTargetType === "all" ? "" : localTargetType,
      dateFrom: localDateFrom,
      dateTo: localDateTo,
    });
  };

  const handleReset = () => {
    setLocalQ("");
    setLocalTargetType("all");
    setLocalDateFrom("");
    setLocalDateTo("");
    router.push("/reports");
  };

  // ── 상태 변경 액션 ────────────────────────────────────────────────────────
  const handleReview = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/review`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await notifyDialog("확인중으로 변경되었습니다.");
      void fetchReports();
    } catch {
      await notifyDialog("처리 중 오류가 발생했습니다.", "danger");
    }
  };

  const handleHide = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await notifyDialog("숨김 처리되었습니다.");
      void fetchReports();
    } catch {
      await notifyDialog("처리 중 오류가 발생했습니다.", "danger");
    }
  };

  const handleReject = async (id: string, note: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await notifyDialog("신고가 반려되었습니다.");
      setRejectTarget(null);
      void fetchReports();
    } catch {
      await notifyDialog("처리 중 오류가 발생했습니다.", "danger");
    }
  };

  // 자동 숨김 복구 (Story 9.11, AC #2)
  const handleRestoreAutoHide = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/restore-auto-hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await notifyDialog("콘텐츠가 복구되었습니다.");
      void fetchReports();
    } catch {
      await notifyDialog("복구 중 오류가 발생했습니다.", "danger");
    }
  };

  // ── 회원 신고 제재 처리 (Story 12.5) ────────────────────────────────────────
  const handleSanctionFromList = async (
    reportId: string,
    targetId: string,
    type: "warning" | "suspend" | "permaban",
    reason: string,
    endsAt: string | null,
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${reportId}/sanction-member`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetId, type, reason, endsAt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await notifyDialog("회원 제재가 적용되고 신고가 처리완료 되었습니다.");
      setSanctionTarget(null);
      void fetchReports();
    } catch {
      await notifyDialog("제재 처리 중 오류가 발생했습니다.", "danger");
    }
  };

  return (
    <AdminShell breadcrumb={["관리자", "신고 관리"]} activeKey="reports">
      <div className="page-header">
        <div>
          <h1 className="page-title">신고 관리</h1>
          <p className="page-description">회원이 접수한 신고를 한 곳에서 확인하고 처리합니다.</p>
        </div>
      </div>

      {/* 운영 원칙 안내 */}
      <div className="alert alert-warning" role="note" style={{ marginBottom: "20px" }}>
        <i className="ri-alert-line" />
        <div>
          <strong>처리 원칙</strong>
          <br />
          신고가 들어왔다고 무조건 삭제하지 않습니다. 신고 대상과 사유를 먼저 확인한 뒤
          숨김 · 반려 중 적절한 조치를 선택하세요.
        </div>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">신고 목록</h2>
            <p className="section-description">
              처리 상태 · 대상 유형 · 기간으로 좁혀 확인할 수 있습니다.
            </p>
          </div>
        </div>

        <article className="card">
          {/* 처리 상태 탭 */}
          <div className="line-tabs" role="tablist" aria-label="처리 상태">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                className={`line-tab${statusParam === t.key ? " active" : ""}`}
                onClick={() =>
                  updateUrl({ status: t.key === "all" ? "" : t.key })
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="대상 내용 또는 신고자 검색"
                  aria-label="신고 검색"
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              <Select
                options={[...TARGET_OPTIONS]}
                value={localTargetType}
                onChange={(v) => setLocalTargetType(v)}
                placeholder="대상 유형: 전체"
              />

              <input
                className="control"
                type="date"
                value={localDateFrom}
                onChange={(e) => setLocalDateFrom(e.target.value)}
                aria-label="시작 날짜"
                placeholder="시작 날짜"
              />
              <input
                className="control"
                type="date"
                value={localDateTo}
                onChange={(e) => setLocalDateTo(e.target.value)}
                aria-label="종료 날짜"
                placeholder="종료 날짜"
              />

              <div className="filter-actions">
                <button className="btn btn-outline" onClick={handleReset}>
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button className="btn btn-primary" onClick={handleSearch}>
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>
          </div>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">
                총 {meta.totalItems}건의 신고
              </span>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="alert alert-error" style={{ margin: "0 20px 16px" }}>
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          {/* 신고 테이블 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>신고 대상</th>
                  <th>신고 사유</th>
                  <th>신고자</th>
                  <th>신고일</th>
                  <th>처리 상태</th>
                  <th>처리자</th>
                  <th style={{ width: "60px" }}>처리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                      불러오는 중...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--gray-500)" }}>
                      신고가 없습니다.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const [sb, sl] = statusBadge(r.status);
                    const [tb, tl] = targetBadge(r.targetType);
                    const canAct = r.status !== "resolved" && r.status !== "dismissed";
                    const isUserReport = r.targetType === "user";
                    const actionItems: RowActionItem[] = [
                      { label: "상세보기", icon: "ri-eye-line", href: `/reports/${r.id}` },
                      // 자동 숨김 복구: 콘텐츠 전용 (user 제외)
                      ...(!isUserReport && r.autoHidden && canAct
                        ? [{ label: "자동 숨김 복구", icon: "ri-refresh-line", onClick: () => void handleRestoreAutoHide(r.id) }]
                        : []),
                      // 확인중으로 변경: 공통
                      ...(canAct && r.status === "pending"
                        ? [{ label: "확인중으로 변경", icon: "ri-search-eye-line", onClick: () => void handleReview(r.id) }]
                        : []),
                      // user: "회원 제재" / content: "대상 숨김"
                      ...(canAct
                        ? isUserReport
                          ? [{ label: "회원 제재", icon: "ri-user-forbid-line", onClick: () => setSanctionTarget({ reportId: r.id, targetId: r.targetId }) }]
                          : [{ label: "대상 숨김", icon: "ri-eye-off-line", onClick: () => void handleHide(r.id) }]
                        : []),
                      // 신고 반려: 공통
                      ...(canAct
                        ? [{ label: "신고 반려", icon: "ri-close-circle-line", danger: true, onClick: () => setRejectTarget(r.id) }]
                        : []),
                    ];
                    return (
                      <tr
                        key={r.id}
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          // 행 액션 영역(삼점 메뉴) 클릭은 상세 이동에서 제외
                          if ((e.target as HTMLElement).closest(".row-actions")) return;
                          router.push(`/reports/${r.id}`);
                        }}
                      >
                        <td>
                          <span className="content-title">
                            {r.targetPreview ?? "(미리보기 없음)"}
                          </span>
                          <div className="content-meta">
                            <span className={`badge ${tb}`}>{tl}</span>
                            {r.autoHidden && (
                              <span className="badge badge-orange" style={{ marginLeft: 4 }}>자동 숨김</span>
                            )}
                          </div>
                        </td>
                        <td>{r.reasonCode}</td>
                        <td>
                          <div className="author">
                            <UserAvatar
                              avatarUrl={r.reporterAvatarUrl}
                              image={r.reporterImage}
                              defaultAvatarIndex={r.reporterDefaultAvatarIndex ?? 0}
                              alt={r.reporterNickname ?? "?"}
                              size={24}
                            />
                            <span>{r.reporterNickname ?? "(알 수 없음)"}</span>
                          </div>
                        </td>
                        <td className="num">{formatDate(r.createdAt)}</td>
                        <td>
                          <span className={`badge ${sb}`}>{sl}</span>
                        </td>
                        <td>{r.reviewedByName ?? "-"}</td>
                        <td>
                          <RowActionMenu items={actionItems} ariaLabel="신고 처리 메뉴" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–
                {Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}건
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() =>
                    updateUrl({ page: String(meta.page - 1) })
                  }
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      className={`page-button${meta.page === p ? " active" : ""}`}
                      onClick={() => updateUrl({ page: String(p) })}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() =>
                    updateUrl({ page: String(meta.page + 1) })
                  }
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* 반려 모달 */}
      {rejectTarget && (
        <RejectModal
          reportId={rejectTarget}
          onConfirm={(id, note) => void handleReject(id, note)}
          onClose={() => setRejectTarget(null)}
        />
      )}

      {/* 회원 제재 모달 (user 신고 전용, Story 12.5) */}
      {sanctionTarget && (
        <SanctionModal
          onClose={() => setSanctionTarget(null)}
          onConfirm={(type, reason, endsAt) =>
            void handleSanctionFromList(sanctionTarget.reportId, sanctionTarget.targetId, type, reason, endsAt)
          }
        />
      )}
    </AdminShell>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={null}>
      <AdminReportsPageInner />
    </Suspense>
  );
}
