import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 질문 상세 페이지(라우트 /qna/[id]). 요구 3: 목록의 제목/보기 클릭 시 드로어가 아니라
 * 이 별도 페이지로 이동한다. 기존 qnaDrawer 의 상세 내용을 이 페이지로 옮긴 더미 1건이다.
 * 운영자는 도움된답변을 "지정"하지 않고, 답변의 숨김·삭제만 처리한다(배지는 표시만).
 * 데이터는 전부 더미이며 이후 단계에서 API 와 연동한다.
 */

// 답변 목록(더미). helpful(도움된답변 여부)은 표시만, hidden(숨김 처리 여부)이면 흐리게 + 복구 액션.
const REPLIES = [
  { author: ["김", "김자동"], body: "Gmail Trigger + Switch 노드로 키워드 분기하면 됩니다. 예시 워크플로우 첨부합니다.", helpful: true, hidden: false },
  { author: ["이", "이코딩"], body: "OpenAI 노드로 본문을 분류 카테고리로 요약시키면 정확도가 더 좋아집니다.", helpful: false, hidden: false },
  { author: ["광", "광고봇"], body: "[외부링크 도배성 답변 — 운영자 숨김 처리됨]", helpful: false, hidden: true },
] as const;

export default async function QnaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 16 규약: params 는 Promise 이므로 await 로 푼다(id: 질문 식별자).
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "질문 상세"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">질문 상세</h1>
          <p className="page-description">질문 내용을 확인하고 답변을 개별 처리합니다. (질문 #{id})</p>
        </div>
        {/* page-actions: 수정 / 삭제(danger) / 목록으로 */}
        <div className="page-actions">
          <a className="btn btn-outline" href="/qna">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          <a className="btn btn-outline" href={`/qna/${id}/edit`}>
            <i className="ri-edit-line" />
            질문 수정
          </a>
          <button className="btn btn-danger" type="button">
            <i className="ri-delete-bin-line" />
            질문 삭제
          </button>
        </div>
      </div>

      <section className="section">
        <article className="card">
          <div className="card-body">
            <div className="alert alert-warning" style={{ marginBottom: "18px" }}>
              <i className="ri-alert-line" />
              <div>
                <strong>운영 안내</strong>
                <br />
                도움된 답변 지정은 질문 작성자만 할 수 있습니다. 운영자는 부적절한 답변의 숨김·삭제만 처리하세요.
              </div>
            </div>

            {/* 질문 메타 */}
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">질문 제목</div>
                <div className="detail-value">n8n으로 Gmail 문의를 자동으로 분류·라벨링할 수 있나요?</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value">
                  <span className="badge badge-cyan">답변있음</span>
                  <span className="badge badge-purple" style={{ marginLeft: "6px" }}>
                    <i className="ri-medal-line" /> 도움된답변 있음
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">카테고리</div>
                <div className="detail-value">AI 자동화 · 워크플로우</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">작성자</div>
                <div className="detail-value">박자동 · auto.park@example.com</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">작성일</div>
                <div className="detail-value">2026.06.18</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">성과</div>
                <div className="detail-value">조회 846 · 좋아요 41 · 답변 3 · 신고 0</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">본문</div>
                <div className="detail-value">
                  Gmail로 들어오는 외주 문의가 많아 라벨로 자동 분류하고 싶습니다. n8n 트리거 구성이 가능한지 궁금합니다.
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">첨부파일</div>
                <div className="detail-value">
                  <span className="content-meta">
                    <i className="ri-file-code-line" aria-hidden="true" /> gmail-classifier-sample.json (12 KB)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* 답변 목록 */}
        <div className="section-heading" style={{ margin: "24px 0 12px" }}>
          <div>
            <h2 className="section-title">답변 목록 ({REPLIES.length})</h2>
            <p className="section-description">답변별로 보기·숨김·삭제만 처리합니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="card-body component-stack">
            {REPLIES.map((r) => (
              <div key={r.author[1]}>
                <div
                  className="detail-list"
                  style={
                    r.hidden
                      ? { opacity: 0.55 }
                      : r.helpful
                        ? { borderLeft: "3px solid var(--primary-600)", paddingLeft: "12px" }
                        : undefined
                  }
                >
                  <div className="detail-row">
                    <div className="detail-label">
                      <div className="author">
                        <span className="author-avatar">{r.author[0]}</span>
                        <span>{r.author[1]}</span>
                      </div>
                    </div>
                    <div className="detail-value">
                      {r.hidden ? (
                        <span className="badge badge-orange">숨김</span>
                      ) : r.helpful ? (
                        <span className="badge badge-purple"><i className="ri-medal-line" /> 도움된답변</span>
                      ) : (
                        <span className="badge badge-green">공개</span>
                      )}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">내용</div>
                    <div className="detail-value">{r.body}</div>
                  </div>
                </div>
                <div className="button-showcase" style={{ marginTop: "10px" }}>
                  <button className="btn btn-ghost btn-sm" type="button"><i className="ri-eye-line" />답변 보기</button>
                  {r.hidden ? (
                    <button className="btn btn-outline btn-sm" type="button"><i className="ri-arrow-go-back-line" />숨김 해제</button>
                  ) : (
                    <button className="btn btn-outline btn-sm" type="button"><i className="ri-eye-off-line" />답변 숨김</button>
                  )}
                  <button className="btn btn-danger btn-sm" type="button"><i className="ri-delete-bin-line" />답변 삭제</button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
