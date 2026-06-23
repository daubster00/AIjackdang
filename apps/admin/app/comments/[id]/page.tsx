import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 댓글·후기 상세 페이지(라우트 /comments/[id]). 요구 3: 목록의 "원문 보기"/"신고 내역 보기"는
 * 모달·드로어가 아니라 이 별도 페이지로 이동한다. 기존 originModal + reportDrawer 의 내용을 옮긴 더미 1건이다.
 * 운영자는 댓글 내용을 직접 수정하지 않는다 — 답글·숨김·삭제·복구만 처리한다.
 * 데이터는 전부 더미이며 이후 단계에서 API 와 연동한다.
 */

// 별점(1~5)을 채워진/빈 별 아이콘 5개로 렌더(색은 토큰 var 사용). rating 0 이면 대시(–).
function Stars({ rating }: { rating: number }) {
  if (!rating) return <span className="content-meta">–</span>;
  return (
    <span aria-label={`5점 만점에 ${rating}점`} style={{ display: "inline-flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={n <= rating ? "ri-star-fill" : "ri-star-line"}
          style={{ color: n <= rating ? "var(--warning)" : "var(--gray-300)" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// 신고 내역(더미). 이 댓글에 누적된 신고 기록.
const REPORTS = [
  { reason: ["badge-red", "광고/스팸"], reporter: "회원 #11023", date: "2026.06.17 18:40", note: "본문과 무관한 외부 결제 링크가 포함되어 있습니다." },
  { reason: ["badge-orange", "욕설/비방"], reporter: "회원 #20984", date: "2026.06.17 12:11", note: "다른 회원을 비방하는 표현이 있습니다." },
] as const;

export default async function CommentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 16 규약: params 는 Promise 이므로 await 로 푼다(id: 댓글 식별자).
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "댓글·후기 관리", "댓글 상세"]} activeKey="comments">
      <div className="page-header">
        <div>
          <h1 className="page-title">댓글·후기 상세</h1>
          <p className="page-description">댓글 원문과 신고 내역을 확인하고 숨김·삭제를 판단합니다. (댓글 #{id})</p>
        </div>
        {/* page-actions: comments 는 수정 없음 — 관련 게시글 / 숨김 / 삭제(danger) / 목록으로 */}
        <div className="page-actions">
          <a className="btn btn-outline" href="/comments">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          <button className="btn btn-outline" type="button">
            <i className="ri-external-link-line" />
            관련 게시글
          </button>
          <button className="btn btn-outline" type="button">
            <i className="ri-eye-off-line" />
            숨김 처리
          </button>
          <button className="btn btn-danger" type="button">
            <i className="ri-delete-bin-line" />
            삭제
          </button>
        </div>
      </div>

      <section className="section">
        {/* 원문 컨텍스트 + 후기/댓글 본문 */}
        <article className="card">
          <div className="card-body">
            <p className="field-help" style={{ marginBottom: "12px" }}>
              운영자는 댓글 내용을 수정할 수 없습니다. 부적절한 내용은 숨김 또는 삭제로 처리하세요.
            </p>
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">유형</div>
                <div className="detail-value"><span className="badge badge-orange">후기</span></div>
              </div>
              <div className="detail-row">
                <div className="detail-label">작성자</div>
                <div className="detail-value">한사용 · user.han@example.com</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">평점</div>
                <div className="detail-value"><Stars rating={5} /></div>
              </div>
              <div className="detail-row">
                <div className="detail-label">관련 게시글(원문 컨텍스트)</div>
                <div className="detail-value">PHP Legacy Code Review Skill · 실전자료</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">작성일</div>
                <div className="detail-value">2026.06.17 14:22</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value"><span className="badge badge-green">공개</span></div>
              </div>
              <div className="detail-row">
                <div className="detail-label">댓글·후기 본문</div>
                <div className="detail-value">
                  윈도우 환경에서 경로 구분자 때문에 막혔는데, 이 스킬 그대로 적용하니 바로 동작했습니다. 강추합니다.
                </div>
              </div>
            </div>

            {/* 답글 작성(디자인만) — comments 는 별도 작성 폼 없이 상세에서 답글만 */}
            <div className="field" style={{ marginTop: "18px" }}>
              <label className="field-label" htmlFor="comment-reply">운영자 답글</label>
              <textarea className="control" id="comment-reply" rows={3} placeholder="필요 시 운영자 답글을 남깁니다(디자인 시안)" />
              <div className="button-showcase" style={{ marginTop: "10px" }}>
                <button className="btn btn-primary btn-sm" type="button">
                  <i className="ri-reply-line" />
                  답글 등록
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* 신고 내역 */}
        <div className="section-heading" style={{ margin: "24px 0 12px" }}>
          <div>
            <h2 className="section-title">신고 내역 ({REPORTS.length})</h2>
            <p className="section-description">이 댓글에 누적된 신고 기록입니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="alert alert-warning" style={{ margin: "16px" }}>
            <i className="ri-alert-line" />
            <div>
              <strong>신고 {REPORTS.length}건</strong>
              <br />
              광고/스팸 및 욕설 사유로 신고가 누적되었습니다. 내용 확인 후 숨김·삭제로 처리하세요.
            </div>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>사유</th>
                  <th>신고자</th>
                  <th>접수일</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((rp, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${rp.reason[0]}`}>{rp.reason[1]}</span></td>
                    <td>{rp.reporter}</td>
                    <td className="num">{rp.date}</td>
                    <td>{rp.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
