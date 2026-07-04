"use client";

/**
 * 커리큘럼 플랜 목록 페이지 — Story 13.5 Task 4
 *
 * 시리즈 단위 섹션으로 챕터 목록 나열.
 * useSearchParams → Suspense 래핑 필수 (Next.js 15).
 * Select: @/components/ui/Select 커스텀 드롭다운 (native select 금지).
 */

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { API_BASE_URL } from "@/lib/api";

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

interface ChapterItem {
  id: string;
  seriesId: string;
  orderIndex: number;
  title: string;
  goal: string;
  status: "planned" | "drafted" | "ready" | "published" | "skipped";
  scheduledAt: string | null;
  publishedPostId: string | null;
  totalSlots: number;
  readySlots: number;
  createdAt: string;
  updatedAt: string;
}

interface SeriesItem {
  id: string;
  title: string;
  board: string;
  tool: string;
  intro: string | null;
  isActive: boolean;
  createdAt: string;
  totalChapters: number;
  publishedChapters: number;
  readyChapters: number;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDatetime(iso: string | null): string {
  if (!iso) return "미예약";
  return iso.slice(0, 16).replace("T", " ");
}

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

// ── 메인 콘텐츠 ────────────────────────────────────────────────────────────────

function CurriculumContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const statusFilter = searchParams.get("status") ?? "";

  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [chaptersMap, setChaptersMap] = useState<Record<string, ChapterItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 시리즈 목록
      const seriesRes = await fetch(`${API_BASE_URL}/api/v1/admin/bots/curriculum/series?pageSize=100`, {
        credentials: "include",
      });
      if (!seriesRes.ok) throw new Error("시리즈 목록 조회 실패");
      const seriesData = await seriesRes.json();
      const series: SeriesItem[] = seriesData.items ?? [];
      setSeriesList(series);

      // 챕터 목록 (전체, 필터 포함)
      // 계약 스키마 상한(pageSize<=100) 준수 — 가이드 커리큘럼 전편 조회에 충분.
      const chaptersParams = new URLSearchParams({ pageSize: "100" });
      if (statusFilter) chaptersParams.set("status", statusFilter);

      const chaptersRes = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/curriculum/chapters?${chaptersParams.toString()}`,
        { credentials: "include" },
      );
      if (!chaptersRes.ok) throw new Error("챕터 목록 조회 실패");
      const chaptersData = await chaptersRes.json();
      const allChapters: ChapterItem[] = chaptersData.items ?? [];

      // seriesId별 챕터 맵
      const map: Record<string, ChapterItem[]> = {};
      for (const c of allChapters) {
        if (!map[c.seriesId]) map[c.seriesId] = [];
        map[c.seriesId]!.push(c);
      }
      setChaptersMap(map);
    } catch {
      showToast("데이터를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateStatus(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    router.push(`/bots/curriculum?${next.toString()}`);
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜"]}
      activeKey="bots"
      activeSubKey="curriculum"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">커리큘럼 플랜</h1>
          <p className="page-description">
            강의 시리즈의 챕터별 초안 본문·이미지 슬롯·예약 시각을 관리합니다.
          </p>
        </div>
      </div>

      <section className="section">
        {/* 상태 필터 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: "var(--gray-500)" }}>상태 필터:</span>
          <div style={{ minWidth: 180 }}>
            <Select
              value={statusFilter}
              onChange={updateStatus}
              options={[
                { value: "", label: "전체" },
                { value: "planned", label: "초안 전" },
                { value: "drafted", label: "초안 완료" },
                { value: "ready", label: "이미지 완료" },
                { value: "published", label: "게시 완료" },
                { value: "skipped", label: "스킵" },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
            불러오는 중...
          </div>
        ) : seriesList.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
            등록된 커리큘럼 시리즈가 없습니다.
          </div>
        ) : (
          seriesList.map((series) => {
            const chapters = chaptersMap[series.id] ?? [];
            return (
              <article key={series.id} className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{series.title}</h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--gray-400)" }}>
                      게시판: {series.board} / 도구: {series.tool} /
                      총 {series.totalChapters}강 (게시 {series.publishedChapters} / 준비 {series.readyChapters})
                    </p>
                  </div>
                  {!series.isActive && (
                    <span className="badge badge-gray" style={{ marginLeft: "auto" }}>비활성</span>
                  )}
                </div>

                {chapters.length === 0 ? (
                  <p style={{ padding: "8px 0", color: "var(--gray-400)", fontSize: 13 }}>
                    {statusFilter ? "필터 조건에 맞는 챕터가 없습니다." : "챕터가 없습니다."}
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>순서</th>
                          <th>챕터 제목</th>
                          <th style={{ width: 100 }}>상태</th>
                          <th style={{ width: 100 }}>이미지</th>
                          <th style={{ width: 140 }}>예약시각</th>
                          <th style={{ width: 80 }}>상세</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapters.map((chapter) => (
                          <tr key={chapter.id}>
                            <td className="num">{chapter.orderIndex}강</td>
                            <td>
                              <Link
                                href={`/bots/curriculum/${chapter.id}`}
                                className="content-title"
                              >
                                {chapter.title}
                              </Link>
                            </td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[chapter.status] ?? "badge-gray"}`}>
                                {STATUS_LABEL[chapter.status] ?? chapter.status}
                              </span>
                            </td>
                            <td className="num" style={{ fontSize: 12 }}>
                              {chapter.readySlots}/{chapter.totalSlots} 완료
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {formatDatetime(chapter.scheduledAt)}
                            </td>
                            <td>
                              <Link
                                href={`/bots/curriculum/${chapter.id}`}
                                className="btn btn-sm btn-outline"
                              >
                                상세보기
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

// ── 페이지 (Suspense 필수 — useSearchParams) ─────────────────────────────────

export default function AdminCurriculumPage() {
  return (
    <Suspense>
      <CurriculumContent />
    </Suspense>
  );
}
