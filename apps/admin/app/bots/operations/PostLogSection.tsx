"use client";

/**
 * 글 작성 로그 섹션 — 운영 패널.
 *
 * 봇별 글 작성 시도를 시간순으로 나열(간추린 핵심만)하고,
 * 행 클릭 시 오른쪽 드로어에서 상세(검수 시도별 반려 사유·실사용 모델·비용·최종 이벤트)를 보여준다.
 *
 * 데이터: GET /admin/bots/post-logs (목록) · GET /admin/bots/post-logs/:jobId (상세)
 * 드로어: 디자인 시스템 .drawer/.drawer-header/.drawer-body + .detail-list 계열.
 *         배경은 반드시 불투명 흰색 — 투명이면 스크림이 비쳐 보임 (overlay.css .modal 참조).
 */

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { dbBoardToAdminSlug } from "@/lib/boards";
import type { BotPostLogDetail, BotPostLogItem } from "@ai-jakdang/contracts";

// ── 라벨 매핑 ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  pending: { label: "대기", badge: "badge-gray" },
  generating: { label: "생성 중", badge: "badge-cyan" },
  censoring: { label: "검수 중", badge: "badge-cyan" },
  held: { label: "보류", badge: "badge-orange" },
  approved: { label: "승인", badge: "badge-blue" },
  published: { label: "발행 완료", badge: "badge-green" },
  discarded: { label: "폐기", badge: "badge-gray" },
  blocked: { label: "차단", badge: "badge-red" },
};

const CENSOR_KEY_LABEL: Record<string, string> = {
  factuality: "사실성",
  ai_tone: "AI 말투",
  persona: "페르소나",
  safety: "안전성",
  duplicate: "중복",
  context: "맥락",
  insight: "인사이트",
};

const FINAL_EVENT_LABEL: Record<string, string> = {
  "post.published": "발행 완료",
  held: "보류 큐 적재",
  blocked: "게시 차단",
  discarded: "폐기",
};

const FINAL_REASON_LABEL: Record<string, string> = {
  "max-regen-exceeded": "재작성 상한(3회) 초과",
  "generation-model-error": "생성 모델 호출 실패",
  copyright_risk: "저작권 위험",
  ambiguous: "검수 판단 애매",
};

function statusBadge(status: string) {
  const s = STATUS_LABEL[status] ?? { label: status, badge: "badge-gray" };
  return <span className={`badge ${s.badge}`}>{s.label}</span>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 발행 글 상세 링크 (dashboard contentDetailHref 관례). */
function publishedHref(item: { jobKind: string; board: string | null; publishedPostId: string | null }): string | null {
  if (!item.publishedPostId) return null;
  if (item.jobKind === "question") return `/qna/${item.publishedPostId}`;
  if (item.jobKind === "resource") return `/resources/${item.publishedPostId}`;
  return `/posts/${dbBoardToAdminSlug(item.board ?? "general")}/${item.publishedPostId}`;
}

/** lastCensorResult(z.unknown)를 표시용으로 방어적 파싱. */
function parseCensor(raw: unknown): {
  overall: string | null;
  items: { key: string; result: string; reason: string }[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const items = Array.isArray(c.items)
    ? c.items.flatMap((it) => {
        if (!it || typeof it !== "object") return [];
        const o = it as Record<string, unknown>;
        if (typeof o.key !== "string" || typeof o.result !== "string") return [];
        return [{ key: o.key, result: o.result, reason: typeof o.reason === "string" ? o.reason : "" }];
      })
    : [];
  const overall = typeof c.overall === "string" ? c.overall : null;
  if (!overall && items.length === 0) return null;
  return { overall, items };
}

// ── 검수 결과 렌더 (시도 카드 공용) ───────────────────────────────────────────

function CensorItems({ items }: { items: { key: string; result: string; reason: string }[] }) {
  const failed = items.filter((it) => it.result !== "pass");
  if (failed.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--gray-500, #6b7280)" }}>모든 항목 통과</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {failed.map((it, i) => (
        <div key={`${it.key}-${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span className={`badge ${it.result === "fail" ? "badge-red" : "badge-orange"}`}>
            {CENSOR_KEY_LABEL[it.key] ?? it.key}
          </span>
          <span style={{ fontSize: 13, color: "var(--gray-700, #374151)", lineHeight: 1.5 }}>
            {it.reason || "(사유 없음)"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 상세 드로어 ───────────────────────────────────────────────────────────────

function PostLogDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: BotPostLogDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lastCensor = detail ? parseCensor(detail.lastCensorResult) : null;
  const href = detail ? publishedHref(detail) : null;

  return (
    <>
      <div className="overlay open" onClick={onClose} />
      <aside
        className="drawer open"
        aria-label="글 작성 로그 상세"
        style={{
          width: "min(560px, calc(100vw - 24px))",
          // 배경은 반드시 불투명 흰색 — 투명이면 스크림이 비쳐 보임
          background: "var(--gray-0, #ffffff)",
          backgroundColor: "var(--gray-0, #ffffff)",
        }}
      >
        <div className="drawer-header">
          <div className="modal-title">글 작성 로그 상세</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="drawer-body">
          {loading || !detail ? (
            <p style={{ color: "var(--gray-500, #6b7280)", fontSize: 14 }}>불러오는 중...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* 개요 */}
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>개요</h3>
                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">제목 / 주제</div>
                    <div className="detail-value">{detail.title ?? "(제목 없음)"}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">봇</div>
                    <div className="detail-value">{detail.personaNickname ?? "(알 수 없음)"}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">게시판</div>
                    <div className="detail-value">{detail.board ?? "-"}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">작성 시도 시각</div>
                    <div className="detail-value">
                      {formatTime(detail.createdAt)}
                      <span style={{ color: "var(--gray-400, #9ca3af)", fontWeight: 400, marginLeft: 8 }}>
                        (최종 갱신 {formatTime(detail.updatedAt)})
                      </span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">최종 결과</div>
                    <div className="detail-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {statusBadge(detail.status)}
                      {href && (
                        <a href={href} style={{ fontSize: 13, color: "var(--primary-600, #2563eb)" }}>
                          발행 글 보기 <i className="ri-external-link-line" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 모델 정보 */}
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>모델 정보</h3>
                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">생성 모델</div>
                    <div className="detail-value">
                      {detail.genModel ?? "(기록 없음)"}
                      {detail.genModels.length > 1 && (
                        <span style={{ color: "var(--gray-400, #9ca3af)", fontWeight: 400, marginLeft: 6 }}>
                          (전체: {detail.genModels.join(", ")})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">검수 모델</div>
                    <div className="detail-value">
                      {detail.censorModel ?? "(기록 없음)"}
                      {detail.censorModels.length > 1 && (
                        <span style={{ color: "var(--gray-400, #9ca3af)", fontWeight: 400, marginLeft: 6 }}>
                          (전체: {detail.censorModels.join(", ")})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">AI 호출 비용</div>
                    <div className="detail-value">
                      ${detail.usageCost.total.toFixed(4)}
                      <span style={{ color: "var(--gray-400, #9ca3af)", fontWeight: 400, marginLeft: 6 }}>
                        (생성 ${detail.usageCost.generation.toFixed(4)} · 검수 $
                        {detail.usageCost.censor.toFixed(4)} · 이미지 ${detail.usageCost.image.toFixed(4)})
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 검수 이력 */}
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                  검수 이력
                  {detail.regenCount > 0 && (
                    <span className="badge badge-orange" style={{ marginLeft: 8 }}>
                      반려 {detail.attempts.length}회
                    </span>
                  )}
                </h3>
                {detail.attempts.length === 0 && !lastCensor ? (
                  <p style={{ fontSize: 13, color: "var(--gray-500, #6b7280)" }}>검수 이력 없음</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {detail.attempts.map((a) => (
                      <div
                        key={a.attempt}
                        style={{
                          border: "1px solid var(--gray-200, #e5e7eb)",
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span className="badge badge-red">시도 {a.attempt} — 반려</span>
                          <span style={{ fontSize: 12, color: "var(--gray-400, #9ca3af)" }}>
                            {formatTime(a.createdAt)}
                          </span>
                        </div>
                        <CensorItems items={a.items} />
                      </div>
                    ))}
                    {lastCensor && (
                      <div
                        style={{
                          border: "1px solid var(--gray-200, #e5e7eb)",
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span
                            className={`badge ${
                              lastCensor.overall === "pass"
                                ? "badge-green"
                                : lastCensor.overall === "ambiguous"
                                  ? "badge-orange"
                                  : "badge-red"
                            }`}
                          >
                            최종 검수 —{" "}
                            {lastCensor.overall === "pass"
                              ? "통과"
                              : lastCensor.overall === "ambiguous"
                                ? "애매(보류)"
                                : "반려"}
                          </span>
                        </div>
                        <CensorItems items={lastCensor.items} />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 최종 이벤트 */}
              {detail.finalEvent && (
                <section>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>최종 이벤트</h3>
                  <div className="detail-list">
                    <div className="detail-row">
                      <div className="detail-label">
                        {FINAL_EVENT_LABEL[detail.finalEvent.eventType] ?? detail.finalEvent.eventType}
                        <span style={{ marginLeft: 6 }}>{formatTime(detail.finalEvent.createdAt)}</span>
                      </div>
                      <div className="detail-value">
                        {detail.finalEvent.reason
                          ? `${FINAL_REASON_LABEL[detail.finalEvent.reason] ?? detail.finalEvent.reason} (${detail.finalEvent.reason})`
                          : detail.finalEvent.eventType === "held"
                            ? "검수 판단 애매(ambiguous) — 보류 큐에서 결정 대기"
                            : "-"}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── 메인 섹션 ─────────────────────────────────────────────────────────────────

interface ListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface PersonaOption {
  id: string;
  nickname: string;
}

export function PostLogSection() {
  const [items, setItems] = useState<BotPostLogItem[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [listLoading, setListLoading] = useState(true);

  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaFilter, setPersonaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<BotPostLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── 목록 조회 ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (personaFilter) params.set("personaId", personaFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/post-logs?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      if (data.meta) setMeta(data.meta as ListMeta);
    } catch {
      // 조용히 무시
    } finally {
      setListLoading(false);
    }
  }, [page, personaFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── 봇 필터 옵션 조회 ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/admin/bots?status=all&pageSize=100`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.items ?? []) as { id: string; nickname: string }[];
        setPersonas(list.map((p) => ({ id: p.id, nickname: p.nickname })));
      } catch {
        // 조용히 무시
      }
    })();
  }, []);

  // ── 상세 열기 ─────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (jobId: string) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/post-logs/${jobId}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as BotPostLogDetail;
      setDetail(data);
    } catch {
      // 조용히 무시 — 드로어에 로딩만 표시됨
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDetail(null);
  }, []);

  const goPage = (p: number) => {
    if (p < 1 || (meta.totalPages > 0 && p > meta.totalPages)) return;
    setPage(p);
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">글 작성 로그</h2>
          <div className="card-subtitle">봇별 글 작성 시도·검수·게시 결과 (행 클릭 시 상세)</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="control"
            style={{ width: 160, height: 34 }}
            value={personaFilter}
            onChange={(e) => {
              setPersonaFilter(e.target.value);
              setPage(1);
            }}
            aria-label="봇 필터"
          >
            <option value="">전체 봇</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
          <select
            className="control"
            style={{ width: 130, height: 34 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="결과 필터"
          >
            <option value="">전체 결과</option>
            {Object.entries(STATUS_LABEL).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {listLoading ? (
          <p style={{ padding: 20, color: "var(--gray-500, #6b7280)", fontSize: 14 }}>
            불러오는 중...
          </p>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--gray-400, #9ca3af)",
              fontSize: 14,
            }}
          >
            <i className="ri-file-list-3-line" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
            작성 로그 없음
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>봇</th>
                    <th>게시판</th>
                    <th>제목 / 주제</th>
                    <th>생성 모델</th>
                    <th>반려</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontSize: 12, color: "var(--gray-500, #6b7280)", whiteSpace: "nowrap" }}>
                        {formatTime(item.createdAt)}
                      </td>
                      <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                        {item.personaNickname ?? "(알 수 없음)"}
                      </td>
                      <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{item.board ?? "-"}</td>
                      <td
                        style={{
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 13,
                          color: "var(--gray-700, #374151)",
                        }}
                      >
                        {item.title ?? "(제목 없음)"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--gray-600, #4b5563)", whiteSpace: "nowrap" }}>
                        {item.genModel ?? "-"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {item.regenCount > 0 ? (
                          <span className="badge badge-orange">{item.regenCount}회</span>
                        ) : (
                          <span style={{ color: "var(--gray-400, #9ca3af)", fontSize: 13 }}>-</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{statusBadge(item.status)}</td>
                    </tr>
                  ))}
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
                    type="button"
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
                        type="button"
                        className={`page-button${meta.page === p ? " active" : ""}`}
                        onClick={() => goPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
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
          </>
        )}
      </div>

      {drawerOpen && (
        <PostLogDrawer detail={detail} loading={detailLoading} onClose={closeDrawer} />
      )}
    </article>
  );
}
