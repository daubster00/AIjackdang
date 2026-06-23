import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { findBoard } from "@/lib/boards";

/**
 * 게시글 상세 페이지 (/posts/[board]/[id]).
 * 더미 게시글 1건을 카드로 보여준다. 메타(.detail-list) + 본문 + 댓글 목록 섹션으로 구성한다.
 * 모든 데이터는 더미이며, "수정/삭제/목록으로" 중 수정·목록은 링크, 삭제는 디자인만(동작 없음)이다.
 */

/** 상세 화면 더미 게시글. 실제로는 id(게시글 식별자)로 조회하지만 여기서는 고정 더미를 쓴다. */
const POST = {
  title: "Claude Code로 기존 PHP 프로젝트 한 번에 분석시키는 프롬프트",
  author: ["김", "김개발"],
  rank: "마스터",
  date: "2026.06.18 14:32",
  views: "3,284",
  comments: "42",
  likes: "187",
  reports: 0,
  status: ["badge-green", "공개"],
  tags: ["ClaudeCode", "PHP", "코드분석", "프롬프트"],
  body: [
    "기존 레거시 PHP 프로젝트를 Claude Code에 통째로 물려서 구조를 파악시키는 방법을 공유합니다.",
    "핵심은 한 번에 전체를 읽히지 말고, 디렉터리 단위로 요약 → 의존성 그래프 → 위험 지점 순으로 단계를 쪼개는 것입니다.",
    "아래 프롬프트를 그대로 붙여넣으면 됩니다. 실제로 5만 줄 규모 프로젝트에서도 안정적으로 동작했습니다.",
  ],
};

/** 상세 화면 더미 댓글. author=닉네임, date=작성시각, body=내용. */
const COMMENTS = [
  { author: "박자동", initial: "박", date: "2026.06.18 15:01", body: "딱 필요했던 내용이네요. 바로 적용해보겠습니다." },
  { author: "최대표", initial: "최", date: "2026.06.18 16:20", body: "디렉터리 단위로 쪼개는 팁 좋네요. 토큰 절약도 되겠어요." },
  { author: "이수익", initial: "이", date: "2026.06.18 18:44", body: "혹시 Laravel 프로젝트에도 비슷하게 쓸 수 있을까요?" },
];

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ board: string; id: string }>;
}) {
  const { board, id } = await params;
  const meta = findBoard(board);
  if (!meta) notFound();

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", meta.label, POST.title]}
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
            게시글 #{id} 의 내용·메타·댓글을 확인하고 관리합니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href={`/posts/${board}`}>
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          <Link className="btn btn-outline" href={`/posts/${board}/${id}/edit`}>
            <i className="ri-edit-line" />
            수정
          </Link>
          {/* 삭제는 디자인만(동작 없음) */}
          <button className="btn btn-danger">
            <i className="ri-delete-bin-line" />
            삭제
          </button>
        </div>
      </div>

      <section className="section" aria-label="게시글 내용">
        <article className="card">
          <div style={{ padding: 20, display: "grid", gap: 18 }}>
            {/* 제목 + 상태 배지 */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className={`badge ${POST.status[0]}`}>{POST.status[1]}</span>
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 720, color: "var(--gray-900)" }}>{POST.title}</h2>
            </div>

            {/* 메타 정보(.detail-list) */}
            <div className="detail-list" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="detail-row">
                <div className="detail-label">작성자</div>
                <div className="detail-value">
                  <span className="author">
                    <span className="author-avatar">{POST.author[0]}</span>
                    <span>{POST.author[1]}</span>
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">등급</div>
                <div className="detail-value">
                  <span className="badge badge-purple">{POST.rank}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value">
                  <span className={`badge ${POST.status[0]}`}>{POST.status[1]}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">작성일</div>
                <div className="detail-value">{POST.date}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">조회 / 댓글 / 좋아요</div>
                <div className="detail-value">
                  {POST.views} / {POST.comments} / {POST.likes}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">신고</div>
                <div className="detail-value">
                  {POST.reports > 0 ? (
                    <span className="badge badge-red">{POST.reports}건</span>
                  ) : (
                    <span style={{ color: "var(--gray-400)" }}>0건</span>
                  )}
                </div>
              </div>
            </div>

            {/* 태그 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {POST.tags.map((t) => (
                <span className="tag" key={t}>
                  #{t}
                </span>
              ))}
            </div>

            {/* 본문 */}
            <div
              style={{
                borderTop: "1px solid var(--gray-100)",
                paddingTop: 16,
                display: "grid",
                gap: 12,
                lineHeight: 1.7,
                color: "var(--gray-800)",
              }}
            >
              {POST.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
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
            댓글 {POST.comments}개
          </div>
          <div style={{ padding: 20, display: "grid", gap: 16 }}>
            {COMMENTS.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  paddingBottom: 16,
                  borderBottom: i < COMMENTS.length - 1 ? "1px solid var(--gray-100)" : "none",
                }}
              >
                <span className="author-avatar">{c.initial}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: "var(--gray-900)" }}>{c.author}</strong>
                    <span style={{ color: "var(--gray-400)", fontSize: 12 }}>{c.date}</span>
                  </div>
                  <p style={{ marginTop: 4, color: "var(--gray-800)" }}>{c.body}</p>
                </div>
                {/* 댓글 삭제(디자인만) */}
                <button className="icon-button" aria-label="댓글 삭제">
                  <i className="ri-delete-bin-line" />
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
