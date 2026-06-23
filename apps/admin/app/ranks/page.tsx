import Image from "next/image";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { RANK_LIST } from "@/lib/ranks";

/**
 * 등급·뱃지 통합 관리 페이지(/ranks).
 * 뱃지는 등급에 귀속된 이미지일 뿐, 별도 개념이 아니다.
 * 등급은 누적 작당력(회원이 활동으로 쌓는 기여 점수)으로 자동 부여(하락 없음).
 * 운영자는 등급 추가·삭제·달성 기준(작당력 임계값)·뱃지 이미지·혜택만 설정한다.
 * 회원에게 수동으로 등급을 지급하거나 변경하는 기능은 없다.
 */

// 등급 분포 요약 통계(더미).
const STATS = [
  { label: "전체 회원", value: "3,318", icon: "ri-team-line", tone: "blue" },
  { label: "활동 등급(작당원+)", value: "1,498", icon: "ri-user-star-line", tone: "green" },
  { label: "이번 주 승급", value: "42", icon: "ri-arrow-up-circle-line", tone: "purple" },
  { label: "등급 단계", value: "5", icon: "ri-medal-line", tone: "orange" },
] as const;

// 등급별 권한 매트릭스(더미). values 순서 = RANK_LIST 순서(새내기~마스터) + 운영자.
const PERMISSIONS = [
  { key: "write", label: "글쓰기", desc: "게시글 작성", values: [true, true, true, true, true, true] },
  { key: "comment", label: "댓글", desc: "댓글 작성", values: [true, true, true, true, true, true] },
  { key: "resource", label: "실전자료 등록", desc: "자료 업로드", values: [false, false, true, true, true, true] },
  { key: "link", label: "링크 첨부", desc: "외부 링크 삽입", values: [false, true, true, true, true, true] },
  { key: "file", label: "파일 첨부", desc: "파일 업로드", values: [false, false, true, true, true, true] },
  { key: "report", label: "신고", desc: "콘텐츠 신고", values: [true, true, true, true, true, true] },
  { key: "limit", label: "일일 작성 제한 완화", desc: "하루 작성 한도 상향", values: [false, false, true, true, true, true] },
] as const;

// 권한 매트릭스 컬럼 헤더(자동 부여 5등급 + 운영자).
const PERM_COLS = ["새내기", "작당원", "실전러", "고수", "마스터", "운영자"] as const;

export default function AdminRanksPage() {
  return (
    <AdminShell breadcrumb={["관리자", "등급·뱃지 관리"]} activeKey="ranks">
      <div className="page-header">
        <div>
          <h1 className="page-title">등급·뱃지 관리</h1>
          <p className="page-description">
            회원 등급 체계·달성 기준·뱃지 이미지·등급별 권한을 설정합니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/ranks/new">
            <i className="ri-add-line" />
            새 등급 추가
          </Link>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            설정 저장
          </button>
        </div>
      </div>

      {/* 운영 안내: 등급은 자동 부여이며 수동 지급 없음 */}
      <div className="alert alert-info" style={{ marginBottom: 18 }}>
        <i className="ri-information-line" />
        <div>
          <strong>자동 부여 등급 체계</strong>
          <br />
          등급은 누적 작당력(회원이 활동으로 쌓는 기여 점수)이 기준을 넘으면 <strong>자동으로 부여</strong>됩니다(하락 없음).
          운영자는 등급을 추가·삭제하고 달성 기준·뱃지 이미지·혜택을 설정합니다. <strong>회원에게 수동으로 등급을 지급·변경하지 않습니다.</strong>
        </div>
      </div>

      {/* 등급 분포 요약 */}
      <section className="grid stats-grid" aria-label="등급 분포 요약">
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
              <span>현재 기준</span>
            </div>
          </article>
        ))}
      </section>

      {/* 1. 등급 목록 — 뱃지 이미지 포함 카드 그리드 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">등급 목록</h2>
            <p className="section-description">
              5단계(새내기 → 마스터). 각 카드의 "설정"에서 달성 기준·뱃지 이미지·혜택을 변경합니다.
            </p>
          </div>
        </div>

        <div className="grid component-grid">
          {RANK_LIST.map((r) => (
            <article className="card" key={r.tier}>
              <div className="card-body component-stack">
                {/* 뱃지 이미지(56px) + 등급명 + 레벨 뱃지 */}
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <Image
                    src={r.badge}
                    alt={`${r.label} 뱃지`}
                    width={56}
                    height={56}
                    style={{ flex: "0 0 auto" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 className="card-title" style={{ margin: 0 }}>{r.label}</h3>
                      <span className="badge badge-gray">Lv.{r.order}</span>
                    </div>
                    <div className="card-subtitle">
                      누적 작당력(기여 점수) {r.threshold.toLocaleString()} 이상
                    </div>
                  </div>
                </div>

                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">보유 회원</div>
                    <div className="detail-value"><strong>{r.holders.toLocaleString()}</strong>명</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">주요 혜택</div>
                    <div className="detail-value">{r.benefits.join(" · ")}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  {/* 삭제: 디자인만(백엔드 연동 없음) */}
                  <button className="btn btn-danger btn-sm" type="button">
                    <i className="ri-delete-bin-line" />
                    삭제
                  </button>
                  {/* 설정 상세 페이지(/ranks/[tier])로 이동 */}
                  <Link className="btn btn-outline btn-sm" href={`/ranks/${r.tier}`}>
                    <i className="ri-settings-3-line" />
                    설정
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 2. 등급별 권한 설정 — 권한 × 등급 매트릭스 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">등급별 권한 설정</h2>
            <p className="section-description">
              등급마다 허용할 활동을 토글로 켜고 끕니다. 초기에는 대부분 허용 상태를 권장합니다.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>권한</th>
                  {PERM_COLS.map((col) => (
                    <th key={col} style={{ textAlign: "center" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div className="content-title">{p.label}</div>
                      <div className="content-meta">{p.desc}</div>
                    </td>
                    {p.values.map((on, i) => (
                      <td key={i} style={{ textAlign: "center" }}>
                        <label className="switch" aria-label={`${PERM_COLS[i]} ${p.label} 허용`}>
                          <input type="checkbox" defaultChecked={on} />
                          <span className="switch-track" />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* 3. 자동 등급 업데이트 설정 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">자동 등급 업데이트</h2>
            <p className="section-description">
              기준 충족 시 회원 등급을 자동으로 올릴지 설정합니다.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="card-body component-stack">
            <div className="choice-row">
              <label className="switch" aria-label="자동 등급 업데이트 사용">
                <input type="checkbox" defaultChecked />
                <span className="switch-track" />
              </label>
              <span style={{ color: "var(--gray-600)" }}>
                <strong>자동 등급 업데이트 사용</strong> — 기준 충족 회원을 자동으로 승급합니다.
              </span>
            </div>
            <div className="choice-row">
              <label className="switch" aria-label="강등 허용">
                <input type="checkbox" />
                <span className="switch-track" />
              </label>
              <span style={{ color: "var(--gray-600)" }}>
                <strong>자동 강등 허용</strong> — 기준 미달 시 하위 등급으로 내립니다. (비활성 권장)
              </span>
            </div>
            <div className="form-grid">
              <div className="field">
                <span className="field-label">업데이트 주기</span>
                <div className="custom-select" data-select="rankCycle">
                  <button className="select-trigger" type="button" aria-expanded="false">
                    <span>매일 새벽 4시</span>
                    <i className="ri-arrow-down-s-line" />
                  </button>
                  <div className="select-menu">
                    <button className="select-option" data-value="hourly">매시간</button>
                    <button className="select-option selected" data-value="daily">
                      매일 새벽 4시<i className="ri-check-line" />
                    </button>
                    <button className="select-option" data-value="weekly">매주 월요일</button>
                  </div>
                </div>
                <div className="field-help">자동 승급 검사를 실행할 주기입니다.</div>
              </div>
              <div className="field">
                <span className="field-label">승급 알림</span>
                <div className="choice-row">
                  <label className="switch" aria-label="승급 알림 발송">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>승급 시 회원에게 알림을 보냅니다.</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
