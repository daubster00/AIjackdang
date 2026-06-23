import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 쪽지 상세 페이지(라우트 /messages/[id]).
 * 쪽지는 일회성 발송 메시지 — 대화 스레드(말풍선)는 없다.
 * 발송된 쪽지 1건의 메타·본문·신고 정보를 심플하게 표시하고,
 * 운영자는 수정·숨김·삭제 처리만 한다. 데이터는 전부 더미이며 이후 API 와 연동한다.
 */

// 쪽지 1건 더미 데이터.
// statusKey: 상태 식별자("normal"|"reported"|"hidden"|"deleted"). status: 배지 클래스·한글명.
const MESSAGE = {
  title: "💰 단기 고수익 부업 모집",
  body: "💰 단기 고수익 부업 모집합니다! 하루 30분 투자로 월 300 보장. 지금 바로 링크 클릭 → bit.ly/xxxx",
  sender: { nickname: "스팸계정01", email: "spam01@example.com" },
  receiver: { nickname: "한창작", email: "han.art@example.com" },
  sentAt: "2026.06.18 09:47",
  statusKey: "reported" as "normal" | "reported" | "hidden" | "deleted",
  status: ["badge-red", "신고됨"] as [string, string],
  spam: true,
  reports: 6,
  reportReasons: [
    { reason: ["badge-red", "광고/스팸"] as [string, string], reporter: "한창작 (받는 회원)", date: "2026.06.18 09:49", note: "외부 결제 유도 링크가 포함된 스팸 쪽지입니다." },
    { reason: ["badge-orange", "사기 의심"] as [string, string], reporter: "회원 #30412", date: "2026.06.18 10:02", note: "동일 계정에서 비슷한 쪽지를 여러 명에게 받았습니다." },
  ],
};

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 16 규약: params(라우트 파라미터)는 Promise 이므로 await 로 푼다(id: 쪽지 식별자).
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "쪽지 관리", "쪽지 상세"]} activeKey="messages">
      {/* ─── 페이지 헤더 ─── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">쪽지 상세</h1>
          <p className="page-description">발송된 쪽지 1건의 내용과 신고 정보를 확인하고 처리합니다. (쪽지 #{id})</p>
        </div>
        {/* page-actions(페이지 우상단 버튼 영역): 목록으로 / 수정 / 숨김 처리 / 삭제(danger) */}
        <div className="page-actions">
          <a className="btn btn-outline" href="/messages">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          {/* "수정" 버튼: data-admin-open(모달 열기) 속성으로 #modal-edit-message 모달을 엽니다 */}
          <button className="btn btn-outline" type="button" data-admin-open="modal-edit-message">
            <i className="ri-edit-line" />
            수정
          </button>
          {/* statusKey(상태 식별자)가 "hidden"이면 "숨김 해제", 그 외에는 "숨김 처리" */}
          {MESSAGE.statusKey === "hidden" ? (
            <button className="btn btn-outline" type="button">
              <i className="ri-eye-line" />
              숨김 해제
            </button>
          ) : (
            <button className="btn btn-outline" type="button">
              <i className="ri-eye-off-line" />
              숨김 처리
            </button>
          )}
          <button className="btn btn-danger" type="button">
            <i className="ri-delete-bin-line" />
            삭제
          </button>
        </div>
      </div>

      {/* ─── 쪽지 상세 정보 ─── */}
      <section className="section">
        <article className="card">
          <div className="card-body">
            {/* detail-list / detail-row: 디자인 시스템 레이블-값 목록 패턴 */}
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">제목</div>
                <div className="detail-value">
                  {MESSAGE.spam
                    ? <span className="badge badge-purple" style={{ marginRight: 8 }}>스팸 의심</span>
                    : null}
                  {MESSAGE.title}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">발신자</div>
                <div className="detail-value">
                  {MESSAGE.sender.nickname}
                  <span className="content-meta" style={{ marginLeft: 8 }}>{MESSAGE.sender.email}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">수신자</div>
                <div className="detail-value">
                  {MESSAGE.receiver.nickname}
                  <span className="content-meta" style={{ marginLeft: 8 }}>{MESSAGE.receiver.email}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">발송 시각</div>
                <div className="detail-value">{MESSAGE.sentAt}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value">
                  <span className={`badge ${MESSAGE.status[0]}`}>{MESSAGE.status[1]}</span>
                </div>
              </div>
              {MESSAGE.reports > 0 && (
                <div className="detail-row">
                  <div className="detail-label">신고 누적</div>
                  <div className="detail-value">
                    <span className="badge badge-red">{MESSAGE.reports}건</span>
                  </div>
                </div>
              )}
            </div>

            {/* 쪽지 본문 — 카드 본문 단락으로 표시 */}
            <div style={{ marginTop: "24px" }}>
              <div className="field-label" style={{ marginBottom: "8px" }}>본문 내용</div>
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  background: "var(--gray-50)",
                  borderColor: "var(--gray-200)",
                  lineHeight: 1.7,
                  fontSize: "14px",
                  color: "var(--gray-800)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {MESSAGE.body}
              </div>
            </div>
          </div>
        </article>

        {/* 신고 사유·내역 — 신고가 있는 쪽지만 표시 */}
        {MESSAGE.reports > 0 && (
          <>
            <div className="section-heading" style={{ margin: "24px 0 12px" }}>
              <div>
                <h2 className="section-title">신고 내역 ({MESSAGE.reportReasons.length})</h2>
                <p className="section-description">이 쪽지에 누적된 신고 기록입니다.</p>
              </div>
            </div>
            <article className="card">
              <div className="alert alert-warning" style={{ margin: "16px 16px 0" }}>
                <i className="ri-alert-line" />
                <div>
                  <strong>신고 {MESSAGE.reports}건{MESSAGE.spam ? " · 스팸 의심" : ""}</strong>
                  <br />
                  내용 확인 후 숨김·삭제로 처리하세요.
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
                    {MESSAGE.reportReasons.map((rp, i) => (
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
          </>
        )}
      </section>

      {/* ─── 수정 모달 ─── */}
      {/*
        .overlay + .modal: 디자인 시스템 모달 마크업 규약.
        data-admin-open="modal-edit-message" 버튼 클릭 시 AdminInteractions 가 이 overlay 를 표시한다.
        close-overlay(모달 닫기) 클래스가 붙은 요소(배경 클릭·닫기 버튼)를 클릭하면 모달이 닫힌다.
      */}
      {/* 공통 배경(overlay)과 모달(modal)은 형제로 분리한다(디자인 시스템 규약).
          data-admin-open="modal-edit-message" 버튼이 아래 .modal(id) 을 열고, close-overlay 가 닫는다.
          모달 안 클릭은 .modal 밖으로 전파되지 않으므로 별도 onClick(이벤트 핸들러)이 필요 없다. */}
      <div className="overlay" />
      <section className="modal" id="modal-edit-message" role="dialog" aria-modal="true" aria-label="쪽지 수정">
          <div className="modal-header">
            <h2 className="modal-title">쪽지 수정</h2>
            <button className="icon-button close-overlay" type="button" aria-label="닫기">
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="modal-body">
            {/* field-group(폼 필드 묶음): 제목 + 본문 수정 입력 */}
            <div className="field-group">
              <label className="field-label" htmlFor="msg-edit-title">제목</label>
              <input
                id="msg-edit-title"
                className="control"
                type="text"
                defaultValue={MESSAGE.title}
                placeholder="쪽지 제목을 입력하세요"
              />
            </div>
            <div className="field-group" style={{ marginTop: "16px" }}>
              <label className="field-label" htmlFor="msg-edit-body">본문 내용</label>
              <textarea
                id="msg-edit-body"
                className="control"
                rows={6}
                defaultValue={MESSAGE.body}
                placeholder="쪽지 본문을 입력하세요"
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline close-overlay" type="button">취소</button>
            <button className="btn btn-primary" type="button">저장</button>
          </div>
      </section>
    </AdminShell>
  );
}
