"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { findBoard, dbBoardToAdminSlug } from "@/lib/boards";
import { API_BASE_URL } from "@/lib/api";

/**
 * 게시글 상세 페이지 (/posts/[board]/[id]).
 * GET /api/v1/admin/posts/:id 실데이터 연동(신고 관리 "신고 대상 보기" 진입점).
 * 메타(.detail-list) + 본문 + 댓글 목록 섹션으로 구성한다.
 */

// ── API 응답 타입 ─────────────────────────────────────────────────────────────
type AdminPostDetail = {
  id: string;
  board: string;
  category: string | null;
  title: string;
  slug: string;
  contentJson: unknown;
  /** 서버에서 변환된 본문 HTML(이미지·영상·코드블록 포함). */
  contentHtml?: string;
  status: string;
  userId: string | null;
  authorNickname: string | null;
  authorAvatarUrl?: string | null;
  authorImage?: string | null;
  authorDefaultAvatarIndex?: number | null;
  isNotice: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  isMainFeatured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: string[];
  comments: AdminPostComment[];
};

type AdminPostComment = {
  id: string;
  content: string;
  authorNickname: string | null;
  authorAvatarUrl?: string | null;
  authorImage?: string | null;
  authorDefaultAvatarIndex?: number | null;
  status: string;
  createdAt: string;
};

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/** 게시글 status → 배지 [className, label]. */
function statusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "draft": return ["badge-gray", "임시저장"];
    case "hidden": return ["badge-orange", "숨김"];
    case "deleted": return ["badge-red", "삭제됨"];
    default: return ["badge-gray", status];
  }
}

function formatDateTime(iso: string): string {
  const d = iso.slice(0, 10).replace(/-/g, ".");
  const t = iso.slice(11, 16);
  return t ? `${d} ${t}` : d;
}

/**
 * contentJson → 렌더 가능한 HTML 문자열 (폴백).
 * 서버가 contentHtml 을 주지 않는 경우에만 사용. LightEditor 래퍼 `{ html }` 우선.
 * 이미지/영상은 서버 변환(contentHtml) 경로에서만 완전히 렌더된다.
 */
function contentJsonToHtml(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.html === "string") return obj.html;

  function extractParagraphs(node: Record<string, unknown>): string[] {
    if (node.type === "paragraph" || node.type === "heading") {
      const text = extractText(node);
      return text ? [`<p>${text}</p>`] : [];
    }
    if (Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[]).flatMap((child) =>
        extractParagraphs(child),
      );
    }
    return [];
  }
  function extractText(node: Record<string, unknown>): string {
    if (node.type === "text") return String(node.text ?? "");
    if (Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[])
        .map((child) => extractText(child))
        .join("");
    }
    return "";
  }

  const paras = extractParagraphs(obj);
  if (paras.length > 0) return paras.join("");
  const fallback = extractText(obj);
  return fallback ? `<p>${fallback}</p>` : "";
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board, id } = use(params);
  // 큐레이션 목록에 없는 board(예: 'talk'/라운지)도 상세는 id로 조회 가능하므로
  // 폴백 메타로 렌더한다.
  const meta = findBoard(board) ?? { label: board, badge: "badge-gray" };

  const [post, setPost] = useState<AdminPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AdminPostDetail;
      setPost(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchPost();
  }, [fetchPost]);

  // 서버가 변환한 contentHtml(이미지·영상·코드블록 포함) 우선, 없으면 클라 폴백.
  const bodyHtml = post ? (post.contentHtml || contentJsonToHtml(post.contentJson)) : "";
  const comments = post?.comments ?? [];

  // post.board 는 DB board 값(예: "monetization-tips").
  // 목록/수정 버튼 href 에는 관리자 URL slug(예: "money-case")를 써야 한다.
  // URL 파라미터 board 는 진입 경로에 따라 DB값일 수 있으므로 post.board 기준으로 변환한다.
  const adminBoard = post ? dbBoardToAdminSlug(post.board) : board;

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", meta.label, post?.title ?? `#${id}`]}
      activeKey="posts"
      activeSubKey={board}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">게시글 상세</h1>
          <p className="page-description">
            <span className={`badge ${meta.badge}`} style={{ marginRight: 6 }}>
              {meta.label}
            </span>
            게시글의 내용·메타·댓글을 확인하고 관리합니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href={`/posts/${adminBoard}`}>
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          <Link className="btn btn-outline" href={`/posts/${adminBoard}/${id}/edit`}>
            <i className="ri-edit-line" />
            수정
          </Link>
        </div>
      </div>

      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line" />
          게시글을 불러오지 못했습니다. ({error})
        </div>
      )}

      {post && (
        <>
          <section className="section" aria-label="게시글 내용">
            <article className="card">
              <div style={{ padding: 20, display: "grid", gap: 18 }}>
                {/* 제목 + 상태 배지 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {(() => {
                      const [sb, sl] = statusBadge(post.status);
                      return <span className={`badge ${sb}`}>{sl}</span>;
                    })()}
                    <span className={`badge ${meta.badge}`}>{meta.label}</span>
                    {post.isNotice && <span className="badge badge-purple">공지</span>}
                    {post.isPinned && <span className="badge badge-blue">고정</span>}
                    {post.isFeatured && <span className="badge badge-cyan">추천</span>}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 720, color: "var(--gray-900)" }}>
                    {post.title}
                  </h2>
                </div>

                {/* 메타 정보(.detail-list) */}
                <div
                  className="detail-list"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
                >
                  <div className="detail-row">
                    <div className="detail-label">작성자</div>
                    <div className="detail-value">
                      <span className="author">
                        <UserAvatar
                          size={28}
                          alt={post.authorNickname ?? "운영자"}
                          avatarUrl={post.authorAvatarUrl}
                          image={post.authorImage}
                          defaultAvatarIndex={post.authorDefaultAvatarIndex ?? 0}
                        />
                        <span>{post.authorNickname ?? "(운영자)"}</span>
                      </span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">상태</div>
                    <div className="detail-value">
                      {(() => {
                        const [sb, sl] = statusBadge(post.status);
                        return <span className={`badge ${sb}`}>{sl}</span>;
                      })()}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">작성일</div>
                    <div className="detail-value">{formatDateTime(post.createdAt)}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">조회수</div>
                    <div className="detail-value">{post.viewCount.toLocaleString()}</div>
                  </div>
                </div>

                {/* 태그 */}
                {post.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {post.tags.map((t) => (
                      <span className="tag" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* 본문 */}
                <div
                  style={{
                    borderTop: "1px solid var(--gray-100)",
                    paddingTop: 16,
                    lineHeight: 1.7,
                    color: "var(--gray-800)",
                  }}
                >
                  {bodyHtml ? (
                    <div
                      className="admin-post-body"
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  ) : (
                    <p style={{ color: "var(--gray-400)" }}>(본문 없음)</p>
                  )}
                </div>
              </div>
            </article>
          </section>

          {/* 댓글 목록 섹션 */}
          <section className="section" aria-label="댓글 목록">
            <article className="card">
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--gray-200)",
                  fontWeight: 700,
                  color: "var(--gray-900)",
                }}
              >
                댓글 {comments.length}개
              </div>
              <div style={{ padding: 20, display: "grid", gap: 16 }}>
                {comments.length === 0 && (
                  <p style={{ color: "var(--gray-400)" }}>등록된 댓글이 없습니다.</p>
                )}
                {comments.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      paddingBottom: 16,
                      borderBottom:
                        i < comments.length - 1 ? "1px solid var(--gray-100)" : "none",
                    }}
                  >
                    <UserAvatar
                      size={28}
                      alt={c.authorNickname ?? "?"}
                      avatarUrl={c.authorAvatarUrl}
                      image={c.authorImage}
                      defaultAvatarIndex={c.authorDefaultAvatarIndex ?? 0}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ color: "var(--gray-900)" }}>
                          {c.authorNickname ?? "(알 수 없음)"}
                        </strong>
                        <span style={{ color: "var(--gray-400)", fontSize: 12 }}>
                          {formatDateTime(c.createdAt)}
                        </span>
                        {c.status === "hidden" && (
                          <span className="badge badge-orange">숨김</span>
                        )}
                      </div>
                      <p style={{ marginTop: 4, color: "var(--gray-800)" }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </AdminShell>
  );
}
