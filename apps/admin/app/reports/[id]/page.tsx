import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 신고 상세 페이지 — 목록의 제목/상세보기 클릭 시 이동하는 별도 페이지(드로어 대체).
 * 한 신고 "건"에 대한 대상 콘텐츠/대상자, 사유·횟수·신고자 목록, 처리 상태와
 * 처리 액션 버튼(디자인만)을 보여준다.
 * 데이터는 더미(정적)이며, 이후 단계에서 params 의 id(신고 건 식별자)로 API 조회한다.
 * CRUD 폼은 만들지 않는다(신고는 게시글이 아니므로 처리 액션 버튼만 둔다).
 */

// 같은 대상에 누적된 신고 목록(더미). 신고자별 사유·일시.
// reasonBadge: 사유 배지 [클래스, 라벨].
const REPORTER_LOG = [
  { reporter: ["정", "정클린"], email: "clean@example.com", reasonBadge: ["badge-orange", "스팸·광고"], date: "2026.06.18 09:12" },
  { reporter: ["김", "김개발"], email: "kim.dev@example.com", reasonBadge: ["badge-orange", "스팸·광고"], date: "2026.06.18 08:40" },
  { reporter: ["이", "이코딩"], email: "lee.coding@example.com", reasonBadge: ["badge-blue", "저작권"], date: "2026.06.17 21:05" },
  { reporter: ["한", "한사용"], email: "han.user@example.com", reasonBadge: ["badge-gray", "기타"], date: "2026.06.17 18:33" },
] as const;

// 처리 이력(더미). 한 신고 건에 대한 운영 처리 로그.
const HANDLE_LOG = [
  { action: ["badge-purple", "확인중"], by: "운영자A", date: "2026.06.18 10:02", note: "원문 확인 시작" },
  { action: ["badge-gray", "접수"], by: "시스템", date: "2026.06.18 09:12", note: "신규 신고 자동 접수" },
] as const;

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // 신고 건 식별자(목록의 /reports/{id} 경로에서 전달)
}) {
  const { id } = await params;

  return (
    <AdminShell breadcrumb={["관리자", "신고 관리", "신고 상세"]} activeKey="reports">
      <div className="page-header">
        <div>
          <h1 className="page-title">신고 상세</h1>
          <p className="page-description">신고 번호 {id} · 대상과 사유를 확인하고 조치를 선택합니다.</p>
        </div>
        <div className="page-actions">
          {/* 목록으로 돌아가기 */}
          <Link className="btn btn-outline" href="/reports">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          {/* 처리 액션 버튼(디자인만) */}
          <button className="btn btn-outline">
            <i className="ri-close-circle-line" />
            신고 반려
          </button>
          <button className="btn btn-secondary">
            <i className="ri-eye-off-line" />
            대상 숨김
          </button>
          <button className="btn btn-danger">
            <i className="ri-delete-bin-line" />
            대상 삭제
          </button>
        </div>
      </div>

      {/* 누적 신고 경고 */}
      <div className="alert alert-warning" style={{ marginBottom: "18px" }}>
        <i className="ri-alert-line" />
        <div>
          <strong>같은 대상에 누적 신고 7건</strong>
          <br />
          삭제 전 반드시 원문을 확인하세요. 신고가 들어왔다고 무조건 삭제하지 않습니다.
        </div>
      </div>

      {/* 신고 대상/대상자 기본 정보 */}
      <section className="section">
        <article className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">신고 대상 정보</h2>
              <div className="card-subtitle">신고된 콘텐츠와 작성자(대상자) 정보입니다.</div>
            </div>
            <button className="btn btn-outline btn-sm">
              <i className="ri-external-link-line" />
              원문 보기
            </button>
          </div>
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">신고 대상</div>
                <div className="detail-value">
                  <span className="badge badge-blue">게시글</span> AI 수익화 게시판
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">대상 내용</div>
                <div className="detail-value">무료 자동화 강의 신청하면 100만원 환급! 지금 링크 클릭</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">대표 신고 사유</div>
                <div className="detail-value">
                  <span className="badge badge-orange">스팸·광고</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">누적 신고 횟수</div>
                <div className="detail-value">
                  <span className="badge badge-red">7</span> 건
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">대상자(작성자)</div>
                <div className="detail-value">
                  <div className="author">
                    <span className="author-avatar">광</span>
                    <span>광고왕 · ad@example.com</span>
                  </div>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">처리 상태</div>
                <div className="detail-value">
                  <span className="badge badge-purple">확인중</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">최초 신고일</div>
                <div className="detail-value">2026.06.18</div>
              </div>
            </div>

            {/* 대상자 활동 이력 바로가기(디자인만) */}
            <div className="button-showcase" style={{ marginTop: "16px" }}>
              <button className="btn btn-outline btn-sm">
                <i className="ri-user-line" />
                작성자 활동 이력
              </button>
              <button className="btn btn-outline btn-sm">
                <i className="ri-user-forbid-line" />
                작성자 이용 제한
              </button>
            </div>
          </div>
        </article>
      </section>

      {/* 신고자 목록 — 누가 어떤 사유로 신고했는지 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">신고자 목록</h2>
            <p className="section-description">이 대상에 대해 접수된 신고자와 각자의 사유입니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>신고자</th>
                  <th>이메일</th>
                  <th>신고 사유</th>
                  <th>신고 일시</th>
                </tr>
              </thead>
              <tbody>
                {REPORTER_LOG.map((r) => (
                  <tr key={r.email + r.date}>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{r.reporter[0]}</span>
                        <span>{r.reporter[1]}</span>
                      </div>
                    </td>
                    <td>{r.email}</td>
                    <td>
                      <span className={`badge ${r.reasonBadge[0]}`}>{r.reasonBadge[1]}</span>
                    </td>
                    <td className="num">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* 처리 상태 변경 + 관리자 메모(디자인만, 저장은 이후 연동) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">처리</h2>
            <p className="section-description">상태를 변경하고 처리 사유를 기록합니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="card-body component-stack">
            <div className="field">
              <span className="field-label">처리 상태 변경</span>
              <div className="custom-select" data-select="detailStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>확인중</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option" data-value="received">접수</button>
                  <button className="select-option selected" data-value="reviewing">
                    확인중<i className="ri-check-line" />
                  </button>
                  <button className="select-option" data-value="resolved">처리완료</button>
                  <button className="select-option" data-value="rejected">반려</button>
                </div>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reportMemo">관리자 메모</label>
              <textarea
                className="control"
                id="reportMemo"
                placeholder="처리 사유·판단 근거를 기록하세요. (운영진만 열람)"
              />
              <div className="field-help">메모는 처리 이력에 함께 저장됩니다.</div>
            </div>
          </div>

          {/* 처리 이력 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>상태</th>
                  <th>처리자</th>
                  <th>일시</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {HANDLE_LOG.map((h) => (
                  <tr key={h.date}>
                    <td>
                      <span className={`badge ${h.action[0]}`}>{h.action[1]}</span>
                    </td>
                    <td>{h.by}</td>
                    <td className="num">{h.date}</td>
                    <td>
                      <div className="content-meta">{h.note}</div>
                    </td>
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
