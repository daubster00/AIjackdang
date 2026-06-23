import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 광고 상세(성과) 페이지 — 목록의 광고명/성과 보기 클릭 시 이동하는 별도 페이지(드로어/모달 대체).
 * 소재 미리보기, 노출 위치/기간, 노출·클릭·CTR 통계와 상태 변경 버튼(디자인만)을 보여준다.
 * 데이터는 더미(정적)이며, 이후 단계에서 params 의 id(광고명/광고 식별자)로 API 조회한다.
 * 광고 등록/편집 폼은 요구 4 영역이므로 여기서는 폼을 만들지 않고 목록의 등록 드로어에서 처리한다.
 */

// 광고 유형 → 배지 색(목록과 동일 규칙).
const TYPE_BADGE: Record<string, string> = {
  애드센스: "badge-green",
  직접배너: "badge-blue",
  텍스트: "badge-gray",
  제휴링크: "badge-purple",
  내부홍보: "badge-cyan",
};

// 상세에 표시할 대표 광고(더미). 실제로는 id 로 조회된 광고 데이터로 채워진다.
const DETAIL = {
  name: "AI 자동화 부트캠프 모집 배너",
  type: "직접배너",
  placement: "메인 상단",
  device: "PC",
  start: "2026.06.05",
  end: "2026.07.05",
  status: "노출중",
  url: "https://camp.aijakdang.com/automation",
  impressions: "142,300",
  clicks: "3,420",
  ctr: "2.40%",
};

// CTR(클릭률 = 클릭 수 / 노출 수) 등 성과 요약 카드(더미).
const PERF = [
  { label: "총 노출 수", value: DETAIL.impressions, icon: "ri-eye-line", tone: "blue" },
  { label: "총 클릭 수", value: DETAIL.clicks, icon: "ri-cursor-line", tone: "purple" },
  { label: "CTR", value: DETAIL.ctr, icon: "ri-percent-line", tone: "green" },
  { label: "노출 상태", value: DETAIL.status, icon: "ri-megaphone-line", tone: "orange" },
] as const;

// 최근 일자별 성과(더미). 노출/클릭/CTR 추이를 테이블로 보여준다.
const DAILY = [
  { date: "2026.06.18", impressions: "12,840", clicks: "318", ctr: "2.48%" },
  { date: "2026.06.17", impressions: "13,210", clicks: "302", ctr: "2.29%" },
  { date: "2026.06.16", impressions: "11,960", clicks: "291", ctr: "2.43%" },
  { date: "2026.06.15", impressions: "12,510", clicks: "274", ctr: "2.19%" },
] as const;

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // 광고 식별자(목록의 /ads/{광고명} 경로에서 전달)
}) {
  const { id } = await params;
  const name = decodeURIComponent(id);

  return (
    <AdminShell breadcrumb={["관리자", "광고 관리", "광고 상세"]} activeKey="ads">
      <div className="page-header">
        <div>
          <h1 className="page-title">광고 상세</h1>
          <p className="page-description">{name} · 노출 위치·기간과 성과를 확인합니다.</p>
        </div>
        <div className="page-actions">
          {/* 목록으로 돌아가기 */}
          <Link className="btn btn-outline" href="/ads">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          {/* 상태 변경 버튼(디자인만) */}
          <button className="btn btn-outline">
            <i className="ri-pause-circle-line" />
            일시중지
          </button>
          <button className="btn btn-danger">
            <i className="ri-stop-circle-line" />
            노출 종료
          </button>
        </div>
      </div>

      {/* 성과 요약 카드 */}
      <section className="grid stats-grid" aria-label="광고 성과 요약">
        {PERF.map((p) => (
          <article className="stat-card" key={p.label}>
            <div className="stat-head">
              <span className="stat-label">{p.label}</span>
              <span className={`stat-icon ${p.tone}`}>
                <i className={p.icon} />
              </span>
            </div>
            <div className="stat-value">{p.value}</div>
          </article>
        ))}
      </section>

      {/* 소재 미리보기 + 기본 정보 */}
      <section className="section">
        <div className="grid component-grid">
          {/* 소재 미리보기 */}
          <article className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">소재 미리보기</h2>
                <div className="card-subtitle">실제 노출되는 배너 이미지입니다.</div>
              </div>
              <span className={`badge ${TYPE_BADGE[DETAIL.type]}`}>{DETAIL.type}</span>
            </div>
            <div className="card-body">
              {/* 배너 미리보기 자리(더미). 실제 이미지는 이후 연동. */}
              <div className="empty-state" style={{ padding: "40px" }}>
                <span className="empty-icon">
                  <i className="ri-image-line" />
                </span>
                <div className="empty-title">728 × 90 배너</div>
                <div className="empty-desc">AI 자동화 부트캠프 모집 — 6월 한정 모집</div>
              </div>
              <div className="button-showcase" style={{ marginTop: "14px" }}>
                <button className="btn btn-outline btn-sm">
                  <i className="ri-external-link-line" />
                  클릭 URL 열기
                </button>
                <button className="btn btn-outline btn-sm">
                  <i className="ri-edit-line" />
                  소재 편집
                </button>
              </div>
            </div>
          </article>

          {/* 기본 정보 */}
          <article className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">노출 설정</h2>
                <div className="card-subtitle">위치·기간·대상 기기입니다.</div>
              </div>
            </div>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-row">
                  <div className="detail-label">광고 유형</div>
                  <div className="detail-value"><span className={`badge ${TYPE_BADGE[DETAIL.type]}`}>{DETAIL.type}</span></div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">노출 위치</div>
                  <div className="detail-value">{DETAIL.placement}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">대상 기기</div>
                  <div className="detail-value">{DETAIL.device}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">노출 기간</div>
                  <div className="detail-value">{DETAIL.start} ~ {DETAIL.end}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">클릭 URL</div>
                  <div className="detail-value">{DETAIL.url}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">노출 상태</div>
                  <div className="detail-value"><span className="badge badge-green">{DETAIL.status}</span></div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 일자별 성과 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">일자별 성과</h2>
            <p className="section-description">최근 노출·클릭·CTR 추이입니다.</p>
          </div>
          <button className="btn btn-outline btn-sm">
            <i className="ri-file-excel-2-line" />
            성과 내보내기
          </button>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>일자</th>
                  <th>노출 수</th>
                  <th>클릭 수</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {DAILY.map((d) => (
                  <tr key={d.date}>
                    <td className="num">{d.date}</td>
                    <td className="num">{d.impressions}</td>
                    <td className="num">{d.clicks}</td>
                    <td className="num">{d.ctr}</td>
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
