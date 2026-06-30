"use client";

/**
 * ContentPerformanceTable — 게시글·실전자료 통합 성과 테이블 (Item 6+7).
 *
 * - postItems(상위 10개)와 resourceItems(상위 10개)를 하나의 배열로 병합.
 * - Select 드롭다운으로 조회수순 / 댓글순 / 다운로드순 정렬 전환(클라이언트 사이드).
 * - 병합 배열을 선택 기준으로 정렬 후 상위 10개만 표시.
 */

import { useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { dbBoardToAdminSlug } from "@/lib/boards";
import type { PostPerformanceItem, ResourcePerformanceItem } from "@ai-jakdang/contracts";

// ── 타입 ──────────────────────────────────────────────────────────────────────

type SortKey = "views" | "comments" | "downloads";

interface UnifiedRow {
  id:            string;
  kind:          "post" | "resource";
  title:         string;
  /** 게시글: 게시판 슬러그; 실전자료: resource_type */
  subLabel:      string;
  /** 게시글: DB posts.board 원값 (링크 생성용). 실전자료: null. */
  rawBoard:      string | null;
  viewCount:     number;
  commentCount:  number;   // 게시글: 실제값; 실전자료: 0
  downloadCount: number;   // 실전자료: 실제값; 게시글: 0
  avgRating?:    number;   // 실전자료만
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "views",     label: "조회수순" },
  { value: "comments",  label: "댓글순" },
  { value: "downloads", label: "다운로드순" },
];

const BOARD_LABEL: Record<string, string> = {
  automation:    "자동화",
  lounge:        "라운지",
  monetize:      "수익화",
  "vibe-coding": "바이브코딩",
  notice:        "공지",
};

function toBoardLabel(board: string): string {
  return BOARD_LABEL[board] ?? board;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

interface ContentPerformanceTableProps {
  postItems:     PostPerformanceItem[];
  resourceItems: ResourcePerformanceItem[];
}

export function ContentPerformanceTable({
  postItems,
  resourceItems,
}: ContentPerformanceTableProps) {
  const [sort, setSort] = useState<SortKey>("views");

  // 게시글 + 실전자료를 단일 배열로 병합
  const merged: UnifiedRow[] = [
    ...postItems.map((p): UnifiedRow => ({
      id:            p.id,
      kind:          "post",
      title:         p.title,
      subLabel:      toBoardLabel(p.board),
      rawBoard:      p.board,
      viewCount:     p.viewCount,
      commentCount:  p.commentCount,
      downloadCount: 0,
      avgRating:     undefined,
    })),
    ...resourceItems.map((r): UnifiedRow => ({
      id:            r.id,
      kind:          "resource",
      title:         r.title,
      subLabel:      r.resourceType,
      rawBoard:      null,
      viewCount:     r.viewCount,
      commentCount:  0,
      downloadCount: r.downloadCount,
      avgRating:     r.avgRating,
    })),
  ];

  // 선택된 기준으로 정렬 후 상위 10개
  const sorted = merged
    .slice()
    .sort((a, b) => {
      switch (sort) {
        case "views":     return b.viewCount     - a.viewCount;
        case "comments":  return b.commentCount  - a.commentCount;
        case "downloads": return b.downloadCount - a.downloadCount;
      }
    })
    .slice(0, 10);

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2 className="section-title">콘텐츠별 성과</h2>
          <p className="section-description">
            게시글·실전자료 통합 조회·댓글·다운로드 지표입니다. (상위 10개)
          </p>
        </div>
        <div className="section-actions">
          {/* N3: min-width 고정으로 다운로드 버튼 너비(≈140px)에 맞춤 */}
          <div style={{ minWidth: "140px" }}>
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
            />
          </div>
        </div>
      </div>

      <article className="card">
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>유형</th>
                <th>제목</th>
                <th>조회수</th>
                <th>댓글수</th>
                <th>다운로드</th>
                <th>평점</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}
                  >
                    선택한 기간에 콘텐츠 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  // N4: 게시글 → /posts/{adminSlug}/{id}, 실전자료 → /resources/{id}
                  const detailHref = row.kind === "post"
                    ? `/posts/${dbBoardToAdminSlug(row.rawBoard ?? "general")}/${row.id}`
                    : `/resources/${row.id}`;
                  return (
                  <tr key={`${row.kind}-${row.id}`}>
                    {/* 유형 */}
                    <td>
                      <span
                        className={`badge ${row.kind === "post" ? "badge-blue" : "badge-cyan"}`}
                      >
                        {row.kind === "post" ? "게시글" : "실전자료"}
                      </span>
                    </td>

                    {/* 제목 + 부 레이블 */}
                    <td>
                      <Link href={detailHref} className="content-title" style={{ textDecoration: "none", color: "inherit" }}>{row.title}</Link>
                      <div className="content-meta">{row.subLabel}</div>
                    </td>

                    {/* 조회수 */}
                    <td className="num">{row.viewCount.toLocaleString("ko-KR")}</td>

                    {/* 댓글수: 게시글만 실제값, 실전자료는 — */}
                    <td className="num">
                      {row.kind === "post" ? (
                        row.commentCount.toLocaleString("ko-KR")
                      ) : (
                        <span style={{ color: "var(--gray-300)" }}>—</span>
                      )}
                    </td>

                    {/* 다운로드: 실전자료만 실제값, 게시글은 — */}
                    <td className="num">
                      {row.kind === "resource" ? (
                        row.downloadCount.toLocaleString("ko-KR")
                      ) : (
                        <span style={{ color: "var(--gray-300)" }}>—</span>
                      )}
                    </td>

                    {/* 평점: 실전자료만 */}
                    <td className="num">
                      {row.avgRating != null ? (
                        <>
                          <i
                            className="ri-star-fill"
                            style={{ color: "var(--warning)", marginRight: 4 }}
                          />
                          {row.avgRating.toFixed(1)}
                        </>
                      ) : (
                        <span style={{ color: "var(--gray-300)" }}>—</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
