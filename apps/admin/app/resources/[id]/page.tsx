"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import type { AdminResourceDetail, AdminResourceReviewItem } from "@ai-jakdang/contracts/admin/resources";

/**
 * 자료 상세 페이지 (Story 9.8).
 * 자료 탭: 기본 정보 + 첨부파일 목록 + 첨부 삭제 모달(사유 필수).
 * 후기 탭: comments WHERE target_type='resource' + 숨김/삭제 액션.
 * 숨김: 즉시 + 토스트. 삭제: 모달 + 사유 필수 + super_admin.
 *
 * 가드레일 UX-DR-A9: "검수됨", "안전한 파일", "공식 인증" 레이블 표시 금지.
 */

// ── 모달 컴포넌트 ─────────────────────────────────────────────────────────────

function ConfirmDeleteModal({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
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
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>{description}</p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유를 입력하세요"
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
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff", borderRadius: 8, padding: "12px 20px",
        fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
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

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  "prompt": "프롬프트",
  "claude-code-skill": "Claude Code Skill",
  "mcp": "MCP",
  "rules-config": "Rules / Config",
  "template-checklist": "템플릿 / 체크리스트",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  "beginner": "입문",
  "intermediate": "중급",
  "advanced": "고급",
};

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-gray", "삭제"];
    case "draft": return ["badge-yellow", "초안"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [resource, setResource] = useState<AdminResourceDetail | null>(null);
  const [reviews, setReviews] = useState<AdminResourceReviewItem[]>([]);
  const [reviewsMeta, setReviewsMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [activeTab, setActiveTab] = useState<"info" | "reviews">("info");
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [fileDeleteModal, setFileDeleteModal] = useState<{ fileId: string; fileName: string } | null>(null);
  const [resourceDeleteModal, setResourceDeleteModal] = useState(false);
  const [reviewDeleteModal, setReviewDeleteModal] = useState<{ commentId: string } | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchResource = useCallback(async (resourceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${resourceId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("자료 조회 실패");
      setResource(await res.json());
    } catch {
      showToast("자료를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchReviews = useCallback(async (resourceId: string, page = 1) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/resources/${resourceId}/reviews?page=${page}&pageSize=20`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReviews(data.items ?? []);
      setReviewsMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("후기를 불러오지 못했습니다.", "error");
    }
  }, [showToast]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      fetchResource(id);
      fetchReviews(id);
    }
  }, [id, fetchResource, fetchReviews]);

  // ── 자료 숨김 ──────────────────────────────────────────────────────────────
  async function handleHideResource() {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("자료가 숨김 처리되었습니다.", "success");
      fetchResource(id);
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 자료 삭제 ──────────────────────────────────────────────────────────────
  async function handleDeleteResource(reason: string) {
    if (!id) return;
    setResourceDeleteModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("자료가 삭제되었습니다.", "success");
      fetchResource(id);
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 첨부파일 삭제 ──────────────────────────────────────────────────────────
  async function handleDeleteFile(fileId: string, reason: string) {
    if (!id) return;
    setFileDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason }),
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("첨부파일이 삭제되었습니다.", "success");
      fetchResource(id);
    } catch {
      showToast("첨부파일 삭제 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 후기 숨김 ──────────────────────────────────────────────────────────────
  async function handleHideReview(commentId: string) {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reviews/${commentId}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("후기가 숨김 처리되었습니다.", "success");
      fetchReviews(id);
    } catch {
      showToast("후기 숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  // ── 후기 삭제 ──────────────────────────────────────────────────────────────
  async function handleDeleteReview(commentId: string, reason: string) {
    if (!id) return;
    setReviewDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reviews/${commentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("후기가 삭제되었습니다.", "success");
      fetchReviews(id);
    } catch {
      showToast("후기 삭제 중 오류가 발생했습니다.", "error");
    }
  }

  if (loading || !resource) {
    return (
      <AdminShell breadcrumb={["관리자", "실전자료 관리", "자료 상세"]} activeKey="resources">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          {loading ? "불러오는 중..." : "자료를 찾을 수 없습니다."}
        </div>
      </AdminShell>
    );
  }

  const [statusClass, statusLabel] = statusBadge(resource.status);

  return (
    <AdminShell
      breadcrumb={["관리자", "실전자료 관리", "자료 상세"]}
      activeKey="resources"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">{resource.title}</h1>
          <p className="page-description">
            {RESOURCE_TYPE_LABEL[resource.resourceType] ?? resource.resourceType}
            {" · "}
            {DIFFICULTY_LABEL[resource.difficulty] ?? resource.difficulty}
            {" · 작성자 "}
            {resource.authorNickname ?? "(탈퇴)"}
          </p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href="/resources">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          {resource.status !== "hidden" && resource.status !== "deleted" && (
            <button className="btn btn-outline" type="button" onClick={handleHideResource}>
              <i className="ri-eye-off-line" />
              숨김
            </button>
          )}
          {isSuperAdmin && resource.status !== "deleted" && (
            <button className="btn btn-danger" type="button" onClick={() => setResourceDeleteModal(true)}>
              <i className="ri-delete-bin-line" />
              자료 삭제
            </button>
          )}
        </div>
      </div>

      {/* 탭 내비게이션 */}
      <div
        style={{
          display: "flex", gap: 4, borderBottom: "2px solid var(--border)",
          marginBottom: 24,
        }}
      >
        {(["info", "reviews"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--primary-600)" : "2px solid transparent",
              marginBottom: -2,
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? "var(--primary-600)" : "var(--gray-600)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {tab === "info" ? `자료 정보 (첨부 ${resource.files.length}개)` : `후기 (${reviewsMeta.totalItems}개)`}
          </button>
        ))}
      </div>

      {/* 자료 탭 */}
      {activeTab === "info" && (
        <section className="section">
          {/* 기본 정보 */}
          <article className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-row">
                  <div className="detail-label">상태</div>
                  <div className="detail-value">
                    <span className={`badge ${statusClass}`}>{statusLabel}</span>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">자료 요약</div>
                  <div className="detail-value">{resource.summary}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">유형 · 난이도</div>
                  <div className="detail-value">
                    {RESOURCE_TYPE_LABEL[resource.resourceType] ?? resource.resourceType}
                    {" · "}
                    {DIFFICULTY_LABEL[resource.difficulty] ?? resource.difficulty}
                  </div>
                </div>
                {resource.environment && resource.environment.length > 0 && (
                  <div className="detail-row">
                    <div className="detail-label">지원 환경</div>
                    <div className="detail-value">{resource.environment.join(", ")}</div>
                  </div>
                )}
                {resource.version && (
                  <div className="detail-row">
                    <div className="detail-label">버전</div>
                    <div className="detail-value">{resource.version}</div>
                  </div>
                )}
                <div className="detail-row">
                  <div className="detail-label">성과</div>
                  <div className="detail-value">
                    다운로드 {resource.downloadCount.toLocaleString()}
                    {" · 평점 "}{resource.avgRating}
                    {" · 후기 "}{resource.reviewCount}
                    {" · 신고 "}{resource.reportCount}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">등록 / 업데이트</div>
                  <div className="detail-value">
                    {formatDate(resource.createdAt)} / {formatDate(resource.updatedAt)}
                    {resource.deletedAt ? ` / 삭제: ${formatDate(resource.deletedAt)}` : ""}
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* 첨부파일 목록 */}
          <div className="section-heading" style={{ margin: "0 0 12px" }}>
            <div>
              <h2 className="section-title">첨부파일 ({resource.files.length})</h2>
              <p className="section-description">
                부적절한 첨부는 내용 확인 후 삭제할 수 있습니다.
                삭제된 파일은 서버 cleanup worker가 30일 후 실제 제거합니다.
              </p>
            </div>
          </div>
          <article className="card">
            <div className="card-body">
              {resource.files.length === 0 ? (
                <p style={{ color: "var(--gray-400)", fontSize: 13 }}>첨부파일이 없습니다.</p>
              ) : (
                <div className="detail-list">
                  {resource.files.map((f) => (
                    <div className="detail-row" key={f.id}>
                      <div className="detail-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className="ri-attachment-2" aria-hidden="true" />
                        <span style={{ wordBreak: "break-all" }}>{f.originalName}</span>
                        {f.isPrimary && (
                          <span className="badge badge-blue" style={{ fontSize: 11 }}>대표</span>
                        )}
                        {f.fileStatus === "deleted" && (
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>삭제됨</span>
                        )}
                      </div>
                      <div
                        className="detail-value"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          justifyContent: "space-between",
                        }}
                      >
                        <span className="content-meta">
                          {formatFileSize(f.fileSize)} · {f.allowedExtension.toUpperCase()}
                        </span>
                        {f.fileStatus === "active" && (
                          <button
                            className="btn btn-danger btn-sm"
                            type="button"
                            onClick={() =>
                              setFileDeleteModal({ fileId: f.id, fileName: f.originalName })
                            }
                          >
                            <i className="ri-delete-bin-line" />
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>
      )}

      {/* 후기 탭 */}
      {activeTab === "reviews" && (
        <section className="section">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="section-title">후기 ({reviewsMeta.totalItems})</h2>
              <p className="section-description">
                부적절한 후기는 숨김·삭제로 처리합니다.
                숨김과 삭제 모두 soft-delete 처리됩니다.
              </p>
            </div>
          </div>

          {reviews.length === 0 ? (
            <article className="card">
              <div className="card-body" style={{ color: "var(--gray-400)", fontSize: 13 }}>
                후기가 없습니다.
              </div>
            </article>
          ) : (
            <div className="component-stack">
              {reviews.map((rv) => (
                <div className="card" key={rv.id}>
                  <div className="card-body">
                    <div
                      style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 8,
                      }}
                    >
                      <div className="author">
                        <span className="author-avatar">
                          {rv.authorNickname ? rv.authorNickname.slice(0, 1) : "?"}
                        </span>
                        <span>{rv.authorNickname ?? "(탈퇴)"}</span>
                        <span className="content-meta" style={{ marginLeft: 8 }}>
                          {formatDate(rv.createdAt)}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {rv.reportCount > 0 && (
                          <span className="badge badge-red">신고 {rv.reportCount}</span>
                        )}
                        {rv.status === "deleted" && (
                          <span className="badge badge-gray">삭제됨</span>
                        )}
                      </div>
                    </div>
                    <p
                      className="type-body"
                      style={{
                        margin: "8px 0 0",
                        color: rv.status === "deleted" ? "var(--gray-400)" : undefined,
                        fontStyle: rv.status === "deleted" ? "italic" : undefined,
                      }}
                    >
                      {rv.status === "deleted" ? "(삭제된 후기)" : rv.content}
                    </p>
                    {rv.status !== "deleted" && (
                      <div className="button-showcase" style={{ marginTop: 10 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => handleHideReview(rv.id)}
                        >
                          <i className="ri-eye-off-line" />
                          숨김
                        </button>
                        {isSuperAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            type="button"
                            onClick={() => setReviewDeleteModal({ commentId: rv.id })}
                          >
                            <i className="ri-delete-bin-line" />
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 후기 페이지네이션 */}
          {reviewsMeta.totalPages > 1 && id && (
            <div className="pagination" style={{ marginTop: 16 }}>
              <div className="page-buttons">
                {Array.from({ length: Math.min(reviewsMeta.totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      className={`page-button${reviewsMeta.page === p ? " active" : ""}`}
                      onClick={() => fetchReviews(id, p)}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 첨부파일 삭제 모달 */}
      {fileDeleteModal && (
        <ConfirmDeleteModal
          title={`첨부파일 삭제: ${fileDeleteModal.fileName}`}
          description="이 첨부파일에 대한 접근을 비활성화합니다. 실제 파일 제거는 cleanup worker가 30일 후 처리합니다."
          onConfirm={(reason) => handleDeleteFile(fileDeleteModal.fileId, reason)}
          onClose={() => setFileDeleteModal(null)}
        />
      )}

      {/* 자료 삭제 모달 */}
      {resourceDeleteModal && (
        <ConfirmDeleteModal
          title="자료 삭제"
          description="이 자료를 삭제(soft-delete)합니다. 삭제 사유를 반드시 입력하세요."
          onConfirm={handleDeleteResource}
          onClose={() => setResourceDeleteModal(false)}
        />
      )}

      {/* 후기 삭제 모달 */}
      {reviewDeleteModal && (
        <ConfirmDeleteModal
          title="후기 삭제"
          description="이 후기를 삭제(soft-delete)합니다. 사유를 입력하세요."
          onConfirm={(reason) => handleDeleteReview(reviewDeleteModal.commentId, reason)}
          onClose={() => setReviewDeleteModal(null)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}
