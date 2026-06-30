import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { UserAvatar } from "@/components/ui/UserAvatar";

/**
 * 포인트 거래 상세 페이지 — 목록(회원별 포인트 내역)의 사유 클릭 시 이동하는 별도 페이지.
 * 한 거래 레코드(회원·사유·변동·잔액·처리자)의 상세를 보여준다.
 * 포인트 거래는 게시글이 아니므로 CRUD 폼은 만들지 않고, 회원/내역으로 이동하는 링크만 둔다.
 * 데이터는 더미(정적)이며, 이후 단계에서 params 의 id(거래 식별자)로 API 조회한다.
 */

// 상세에 표시할 대표 거래(더미). delta 부호로 적립(+)/차감(-) 구분.
const DETAIL = {
  member: "최대표",
  initial: "최",
  email: "ceo.choi@example.com",
  reason: "신고 누적 후 위반확정",
  rule: "포인트 차감 규칙 — 신고 누적 후 위반확정",
  delta: -50,
  before: 460,
  balance: 410,
  date: "2026.06.17 19:48",
  handler: "최고관리자",
  memo: "광고성 댓글 도배 3건 위반 확정에 따른 차감 처리",
};

export default async function PointTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // 거래 식별자(목록의 /points/{id} 경로에서 전달)
}) {
  const { id } = await params;
  const earn = DETAIL.delta >= 0; // 적립이면 true(초록), 차감이면 false(빨강)

  return (
    <AdminShell breadcrumb={["관리자", "포인트 관리", "거래 상세"]} activeKey="points">
      <div className="page-header">
        <div>
          <h1 className="page-title">포인트 거래 상세</h1>
          <p className="page-description">거래 번호 {id} · 단일 포인트 거래 내역입니다.</p>
        </div>
        <div className="page-actions">
          {/* 목록으로 돌아가기 */}
          <Link className="btn btn-outline" href="/points">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          {/* 회원의 전체 포인트 내역으로 이동(디자인만) */}
          <Link className="btn btn-outline" href="/members">
            <i className="ri-user-line" />
            회원 보기
          </Link>
        </div>
      </div>

      {/* 변동 요약 */}
      <section className="grid stats-grid" aria-label="거래 요약">
        <article className="stat-card">
          <div className="stat-head">
            <span className="stat-label">변동</span>
            <span className={`stat-icon ${earn ? "green" : "orange"}`}>
              <i className={earn ? "ri-add-circle-line" : "ri-indeterminate-circle-line"} />
            </span>
          </div>
          <div className="stat-value">
            <span className={`trend ${earn ? "up" : "down"}`}>
              {earn ? "+" : "-"}
              {Math.abs(DETAIL.delta).toLocaleString()} P
            </span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span className="stat-label">변동 전 잔액</span>
            <span className="stat-icon blue"><i className="ri-coins-line" /></span>
          </div>
          <div className="stat-value">{DETAIL.before.toLocaleString()} P</div>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span className="stat-label">변동 후 잔액</span>
            <span className="stat-icon purple"><i className="ri-wallet-3-line" /></span>
          </div>
          <div className="stat-value">{DETAIL.balance.toLocaleString()} P</div>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span className="stat-label">처리자</span>
            <span className="stat-icon orange"><i className="ri-shield-user-line" /></span>
          </div>
          <div className="stat-value" style={{ fontSize: "18px" }}>{DETAIL.handler}</div>
        </article>
      </section>

      {/* 거래 상세 정보 */}
      <section className="section">
        <article className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">거래 정보</h2>
              <div className="card-subtitle">회원·사유·변동·잔액·처리자 상세입니다.</div>
            </div>
            <span className={`badge ${earn ? "badge-green" : "badge-red"}`}>
              {earn ? "적립" : "차감"}
            </span>
          </div>
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">대상 회원</div>
                <div className="detail-value">
                  <div className="author">
                    <UserAvatar size={28} alt={DETAIL.member} />
                    <span>{DETAIL.member} · {DETAIL.email}</span>
                  </div>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">사유</div>
                <div className="detail-value">{DETAIL.reason}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">적용 규칙</div>
                <div className="detail-value">{DETAIL.rule}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">변동 포인트</div>
                <div className="detail-value">
                  <span className={`trend ${earn ? "up" : "down"}`}>
                    <i className={earn ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
                    {earn ? "+" : "-"}
                    {Math.abs(DETAIL.delta).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">변동 전 → 후 잔액</div>
                <div className="detail-value">{DETAIL.before.toLocaleString()} P → {DETAIL.balance.toLocaleString()} P</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">처리자</div>
                <div className="detail-value">
                  <span className="badge badge-blue">{DETAIL.handler}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">처리 일시</div>
                <div className="detail-value">{DETAIL.date}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">처리 메모</div>
                <div className="detail-value">{DETAIL.memo}</div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
