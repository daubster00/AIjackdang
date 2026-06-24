import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";

/**
 * 광고 관리 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * super_admin 전용 페이지: staff 접근 시 PermissionDenied 렌더(AC#4).
 */

const STATS = [
  { label: "총 노출 수", value: "1,284,920", icon: "ri-eye-line", tone: "blue", dir: "up", delta: "9.3%", note: "전주 대비" },
  { label: "총 클릭 수", value: "18,472", icon: "ri-cursor-line", tone: "purple", dir: "up", delta: "4.6%", note: "전주 대비" },
  { label: "평균 CTR", value: "1.44%", icon: "ri-percent-line", tone: "green", dir: "up", delta: "0.12%p", note: "전주 대비" },
  { label: "활성 광고 수", value: "9", icon: "ri-megaphone-line", tone: "orange", dir: "down", delta: "1건", note: "종료된 광고 발생" },
] as const;

const PLACEMENTS = [
  "메인 상단",
  "메인 중간",
  "게시글 목록 상단",
  "게시글 목록 중간",
  "게시글 상세 본문 상단",
  "게시글 상세 본문 하단",
  "실전자료 다운로드 영역",
  "사이드바",
  "모바일 하단",
] as const;

const TYPE_BADGE: Record<string, string> = {
  애드센스: "badge-green",
  직접배너: "badge-blue",
  텍스트: "badge-gray",
  제휴링크: "badge-purple",
  내부홍보: "badge-cyan",
};

const STATUS_BADGE: Record<string, string> = {
  노출중: "badge-green",
  예약: "badge-cyan",
  일시중지: "badge-orange",
  종료: "badge-gray",
};

const ADS = [
  {
    name: "Claude Pro 제휴 프로모션",
    type: "제휴링크",
    placement: "실전자료 다운로드 영역",
    device: "PC·모바일",
    start: "2026.06.01",
    end: "2026.06.30",
    status: "노출중",
    impressions: "284,120",
    clicks: "4,932",
    ctr: "1.74%",
  },
  {
    name: "구글 애드센스 (자동 디스플레이)",
    type: "애드센스",
    placement: "게시글 상세 본문 하단",
    device: "PC·모바일",
    start: "2026.05.10",
    end: "상시",
    status: "노출중",
    impressions: "612,480",
    clicks: "6,210",
    ctr: "1.01%",
  },
  {
    name: "AI 자동화 부트캠프 모집 배너",
    type: "직접배너",
    placement: "메인 상단",
    device: "PC",
    start: "2026.06.05",
    end: "2026.07.05",
    status: "노출중",
    impressions: "142,300",
    clicks: "3,420",
    ctr: "2.40%",
  },
  {
    name: "실전자료 프리미엄 안내",
    type: "내부홍보",
    placement: "사이드바",
    device: "PC",
    start: "2026.06.10",
    end: "2026.06.24",
    status: "노출중",
    impressions: "98,640",
    clicks: "1,508",
    ctr: "1.53%",
  },
  {
    name: "n8n 워크플로 템플릿 판매",
    type: "직접배너",
    placement: "게시글 목록 상단",
    device: "PC·모바일",
    start: "2026.06.20",
    end: "2026.07.20",
    status: "예약",
    impressions: "0",
    clicks: "0",
    ctr: "0.00%",
  },
  {
    name: "외주 매칭 서비스 텍스트 광고",
    type: "텍스트",
    placement: "게시글 상세 본문 상단",
    device: "PC·모바일",
    start: "2026.05.01",
    end: "2026.05.31",
    status: "종료",
    impressions: "176,900",
    clicks: "1,202",
    ctr: "0.68%",
  },
  {
    name: "커뮤니티 후원 모집 (모바일)",
    type: "내부홍보",
    placement: "모바일 하단",
    device: "모바일",
    start: "2026.06.12",
    end: "2026.06.26",
    status: "일시중지",
    impressions: "54,200",
    clicks: "896",
    ctr: "1.65%",
  },
] as const;

export default async function AdminAdsPage() {
  const session = await getAdminSession();
  if (session?.role !== "super_admin") {
    return (
      <AdminShell breadcrumb={["관리자", "광고 관리"]} activeKey="ads" adminUser={session}>
        <PermissionDenied />
      </AdminShell>
    );
  }
  return (
    <AdminShell breadcrumb={["관리자", "광고 관리"]} activeKey="ads" adminUser={session}>
      <div className="page-header">
        <div>
          <h1 className="page-title">광고 관리</h1>
          <p className="page-description">노출 위치별 광고 성과를 확인하고 등록·편집합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            성과 내보내기
          </button>
          <button className="btn btn-primary" data-admin-open="adForm">
            <i className="ri-add-line" />
            광고 등록
          </button>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="광고 성과 요약">
        {STATS.map((s) => (
          <article className="stat-card" key={s.label}>
            <div className="stat-head">
              <span className="stat-label">{s.label}</span>
              <span className={`stat-icon ${s.tone}`}>
                <i className={s.icon} />
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-foot">
              <span className={`trend ${s.dir}`}>
                <i className={s.dir === "up" ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
                {s.delta}
              </span>
              <span>{s.note}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="alert alert-warning" style={{ marginBottom: "18px" }}>
        <i className="ri-alert-line" />
        <div>
          <strong>가독성·신뢰 우선</strong>
          <br />
          실전자료 다운로드 버튼 근처에 광고를 과도하게 배치하면 사용자 신뢰도를 떨어뜨립니다. 다운로드 영역
          광고는 1개 이하로 유지하세요.
        </div>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">광고 목록</h2>
            <p className="section-description">노출 위치·기기·상태별로 광고를 관리합니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="광고명 검색" aria-label="광고명 검색" />
              </div>
              <div className="custom-select" data-select="placement">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>위치: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">
                    위치: 전체
                    <i className="ri-check-line" />
                  </button>
                  {PLACEMENTS.map((p) => (
                    <button className="select-option" data-value={p} key={p}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="custom-select" data-select="adType">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>유형: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">
                    유형: 전체
                    <i className="ri-check-line" />
                  </button>
                  {Object.keys(TYPE_BADGE).map((t) => (
                    <button className="select-option" data-value={t} key={t}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="custom-select" data-select="adStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>상태: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">
                    상태: 전체
                    <i className="ri-check-line" />
                  </button>
                  {Object.keys(STATUS_BADGE).map((st) => (
                    <button className="select-option" data-value={st} key={st}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-actions">
                <button className="btn btn-outline">
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button className="btn btn-primary">
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>
            <div className="active-filters">
              <span className="filter-chip">
                노출중
                <button aria-label="필터 제거">
                  <i className="ri-close-line" />
                </button>
              </span>
            </div>
          </div>

          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {ADS.length}개의 광고</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                일시중지
              </button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm">
                <i className="ri-file-excel-2-line" />
                CSV 다운로드
              </button>
              <button className="btn btn-primary btn-sm" data-admin-open="adForm">
                <i className="ri-add-line" />
                광고 등록
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>광고명</th>
                  <th>유형</th>
                  <th>위치</th>
                  <th>PC/모바일</th>
                  <th>시작일</th>
                  <th>종료일</th>
                  <th>상태</th>
                  <th>노출 수</th>
                  <th>클릭 수</th>
                  <th>CTR</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {ADS.map((ad) => (
                  <tr key={ad.name}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label={`${ad.name} 선택`} />
                    </td>
                    <td>
                      <Link className="content-title" href={`/ads/${encodeURIComponent(ad.name)}`}>
                        {ad.name}
                      </Link>
                      <div className="content-meta">{ad.placement}</div>
                    </td>
                    <td>
                      <span className={`badge ${TYPE_BADGE[ad.type]}`}>{ad.type}</span>
                    </td>
                    <td>{ad.placement}</td>
                    <td>{ad.device}</td>
                    <td className="num">{ad.start}</td>
                    <td className="num">{ad.end}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[ad.status]}`}>{ad.status}</span>
                    </td>
                    <td className="num">{ad.impressions}</td>
                    <td className="num">{ad.clicks}</td>
                    <td className="num">{ad.ctr}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          <Link href={`/ads/${encodeURIComponent(ad.name)}`}>
                            <i className="ri-bar-chart-line" />
                            성과 보기
                          </Link>
                          <button data-admin-open="adForm">
                            <i className="ri-edit-line" />
                            수정
                          </button>
                          <button className="danger">
                            <i className="ri-stop-circle-line" />
                            중지
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="page-info">1–{ADS.length} / 총 {ADS.length}개</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지">
                <i className="ri-arrow-left-s-line" />
              </button>
              <button className="page-button active">1</button>
              <button className="page-button" aria-label="다음 페이지">
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </article>
      </section>

      <div className="overlay" />
      <aside className="drawer" id="adForm" aria-label="광고 등록 패널">
        <div className="drawer-header">
          <div>
            <div className="modal-title">광고 등록 / 편집</div>
            <div className="card-subtitle">노출 위치와 기간, 광고 소재를 입력합니다.</div>
          </div>
          <button className="icon-button close-overlay" aria-label="패널 닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="drawer-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="adName">
                광고명
              </label>
              <input className="control" id="adName" type="text" placeholder="예: AI 자동화 부트캠프 모집 배너" />
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label">광고 유형</label>
                <div className="custom-select" data-select="formType">
                  <button className="select-trigger" type="button" aria-expanded="false">
                    <span>직접배너</span>
                    <i className="ri-arrow-down-s-line" />
                  </button>
                  <div className="select-menu">
                    {Object.keys(TYPE_BADGE).map((t, i) => (
                      <button
                        className={`select-option${i === 1 ? " selected" : ""}`}
                        data-value={t}
                        key={t}
                      >
                        {t}
                        {i === 1 ? <i className="ri-check-line" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label className="field-label">노출 위치</label>
                <div className="custom-select" data-select="formPlacement">
                  <button className="select-trigger" type="button" aria-expanded="false">
                    <span>메인 상단</span>
                    <i className="ri-arrow-down-s-line" />
                  </button>
                  <div className="select-menu">
                    {PLACEMENTS.map((p, i) => (
                      <button
                        className={`select-option${i === 0 ? " selected" : ""}`}
                        data-value={p}
                        key={p}
                      >
                        {p}
                        {i === 0 ? <i className="ri-check-line" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="field">
              <span className="field-label">PC / 모바일 구분</span>
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="adDevice" defaultChecked />
                  PC·모바일 모두
                </label>
                <label className="choice">
                  <input type="radio" name="adDevice" />
                  PC만
                </label>
                <label className="choice">
                  <input type="radio" name="adDevice" />
                  모바일만
                </label>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="adStart">
                  노출 시작일
                </label>
                <div className="input-icon">
                  <i className="ri-calendar-line" />
                  <input className="control" id="adStart" type="text" defaultValue="2026.06.18" />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="adEnd">
                  노출 종료일
                </label>
                <div className="input-icon">
                  <i className="ri-calendar-line" />
                  <input className="control" id="adEnd" type="text" placeholder="비워두면 상시 노출" />
                </div>
              </div>
            </div>

            <div className="field">
              <span className="field-label">노출 상태</span>
              <div className="choice-row">
                <label className="switch">
                  <input type="checkbox" defaultChecked />
                  <span className="switch-track" />
                </label>
                <span style={{ color: "var(--gray-500)" }}>활성화하면 시작일부터 즉시 노출됩니다.</span>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adUrl">
                클릭 URL
              </label>
              <div className="input-icon">
                <i className="ri-links-line" />
                <input className="control" id="adUrl" type="url" placeholder="https://" />
              </div>
              <div className="field-help">광고를 클릭하면 이동할 주소입니다.</div>
            </div>

            <div className="field">
              <span className="field-label">배너 이미지</span>
              <div className="empty-state" style={{ padding: "26px" }}>
                <span className="empty-icon">
                  <i className="ri-image-add-line" />
                </span>
                <div className="empty-title">이미지를 끌어다 놓거나 선택하세요</div>
                <div className="empty-desc">권장 비율 728×90 · 최대 2MB · JPG / PNG</div>
                <button className="btn btn-outline btn-sm" type="button" style={{ marginTop: "14px" }}>
                  <i className="ri-upload-2-line" />
                  파일 선택
                </button>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adCode">
                광고 코드
              </label>
              <textarea
                className="control"
                id="adCode"
                rows={4}
                placeholder="애드센스 등 외부 스크립트 코드를 붙여넣으세요 (직접배너는 비워둠)"
              />
              <div className="field-help">애드센스·제휴 위젯 등 스크립트 기반 광고에 사용합니다.</div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adMemo">
                관리자 메모
              </label>
              <textarea className="control" id="adMemo" rows={2} placeholder="내부 참고용 메모 (사용자에게 노출되지 않음)" />
            </div>
          </div>

          <div className="button-showcase" style={{ marginTop: "18px" }}>
            <button className="btn btn-primary">저장</button>
            <button className="btn btn-outline close-overlay">취소</button>
          </div>
        </div>
      </aside>
    </AdminShell>
  );
}
