import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { RANK_LIST, resolveRank } from "@/lib/ranks";

/**
 * 등급 상세·설정 페이지(/ranks/[tier]).
 * tier(등급 키, 예: "expert")로 해당 등급 정보를 조회한다.
 * 없는 tier 면 notFound()로 404 처리.
 *
 * 뱃지 이미지 등록/교체, 달성 기준(작당력 임계값)·혜택·권한 설정을 한 화면에서 다룬다.
 * 모든 입력은 디자인용 더미이며, 이후 API(@ai-jakdang/api) 와 연동한다.
 */

export default async function RankTierSettingsPage({
  params,
}: {
  /** Next 16 규약: params 는 Promise 이므로 반드시 await */
  params: Promise<{ tier: string }>;
}) {
  // tier(등급 키, 예: "practitioner") — URL 세그먼트에서 추출
  const { tier } = await params;
  const rank = resolveRank(tier);
  if (!rank) notFound();

  // prev/next(이전·다음 등급) — 달성 기준 상·하한 안내에 사용
  const prev = RANK_LIST.find((r) => r.order === rank.order - 1);
  const next = RANK_LIST.find((r) => r.order === rank.order + 1);

  return (
    <AdminShell
      breadcrumb={["관리자", "등급·뱃지 관리", rank.label]}
      activeKey="ranks"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">{rank.label} 등급 설정</h1>
          <p className="page-description">
            누적 작당력(기여 점수) 기준·뱃지 이미지·혜택·권한을 설정합니다.
            Lv.{rank.order} — 자동 부여 등급.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/ranks">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          <button className="btn btn-danger" type="button">
            <i className="ri-delete-bin-line" />
            등급 삭제
          </button>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            설정 저장
          </button>
        </div>
      </div>

      {/* 자동 부여 안내 */}
      <div className="alert alert-info" style={{ marginBottom: "20px" }}>
        <i className="ri-information-line" />
        <div>
          이 등급은 회원의 <strong>누적 작당력</strong>이 기준을 넘으면 자동으로 부여됩니다.
          운영자는 수동으로 지급하지 않습니다.
        </div>
      </div>

      {/* 뱃지 이미지 + 기본 설정 2단 그리드 */}
      <section className="section">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(220px, 280px) 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* 좌: 뱃지 이미지 미리보기 + 교체 버튼 */}
          <article className="card">
            <div
              className="card-body component-stack"
              style={{ alignItems: "center", textAlign: "center" }}
            >
              {/* 실제 뱃지 이미지(140px) — public/badges/{tier}.png */}
              <Image
                src={rank.badge}
                alt={`${rank.label} 뱃지`}
                width={140}
                height={140}
              />
              <div>
                <div className="card-title">{rank.label}</div>
                <div className="card-subtitle">
                  Lv.{rank.order} · 누적 작당력 {rank.threshold.toLocaleString()} 이상
                </div>
              </div>
              {/* 뱃지 이미지 등록/교체: 디자인만 */}
              <button className="btn btn-outline btn-sm" type="button">
                <i className="ri-image-edit-line" />
                뱃지 이미지 등록 / 교체
              </button>
              <div className="field-help">
                권장 규격: 240×240 px · PNG(투명 배경) · 최대 500 KB.
              </div>
            </div>
          </article>

          {/* 우: 등급 기본 설정 폼 */}
          <article className="card">
            <div className="card-body component-stack">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: "18px" }}>
                    기본 설정
                  </h2>
                  <p className="section-description">
                    등급명과 자동 부여 기준(작당력 임계값)을 설정합니다.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="tierLabel">
                    등급명
                  </label>
                  <input
                    className="control"
                    id="tierLabel"
                    type="text"
                    defaultValue={rank.label}
                  />
                  <div className="field-help">
                    회원 프로필·게시글 작성자 옆 등에 표시됩니다.
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="tierThreshold">
                    달성 기준 — 누적 작당력
                  </label>
                  <div className="input-icon">
                    <i className="ri-copper-coin-line" />
                    <input
                      className="control"
                      id="tierThreshold"
                      type="number"
                      defaultValue={rank.threshold}
                      min={0}
                    />
                  </div>
                  <div className="field-help">
                    {prev
                      ? `이전 등급 ${prev.label}(작당력 ${prev.threshold.toLocaleString()}) 보다 커야 합니다.`
                      : "가장 낮은 등급입니다. 보통 0으로 둡니다."}
                    {next
                      ? ` 다음 등급 ${next.label}(작당력 ${next.threshold.toLocaleString()}) 미만이어야 합니다.`
                      : ""}
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="tierDesc">
                  등급 설명
                </label>
                <textarea
                  className="control"
                  id="tierDesc"
                  defaultValue={`${rank.label} 등급입니다. 누적 작당력 ${rank.threshold.toLocaleString()} 이상 달성 시 자동 부여됩니다.`}
                />
                <div className="field-help">
                  등급 안내 툴팁·마이페이지 등에 노출됩니다.
                </div>
              </div>

              {/* 혜택 태그 입력 */}
              <div className="field">
                <span className="field-label">등급 혜택</span>
                <div className="tag-input">
                  {rank.benefits.map((b) => (
                    <span className="tag" key={b}>
                      {b}
                      <button type="button" aria-label="혜택 삭제">
                        <i className="ri-close-line" />
                      </button>
                    </span>
                  ))}
                  <input type="text" placeholder="혜택 입력 후 Enter" />
                </div>
                <div className="field-help">
                  이 등급부터 사용 가능한 기능·혜택입니다.
                </div>
              </div>

              {/* 상태 토글 */}
              <div className="field">
                <span className="field-label">상태</span>
                <div className="choice-row">
                  <label className="switch" aria-label="등급 활성화">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>
                    이 등급을 사용합니다(끄면 등급 산정에서 제외).
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 이 등급의 권한 토글 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">{rank.label} 등급 권한</h2>
            <p className="section-description">
              이 등급 회원에게 허용할 활동을 토글로 설정합니다.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="card-body component-stack">
            {[
              { key: "write", label: "글쓰기", desc: "게시글 작성 허용", on: true },
              { key: "comment", label: "댓글", desc: "댓글 작성 허용", on: true },
              { key: "resource", label: "실전자료 등록", desc: "자료 업로드 허용", on: rank.order >= 3 },
              { key: "link", label: "링크 첨부", desc: "외부 링크 삽입 허용", on: rank.order >= 2 },
              { key: "file", label: "파일 첨부", desc: "파일 업로드 허용", on: rank.order >= 3 },
              { key: "report", label: "신고", desc: "콘텐츠 신고 허용", on: true },
              { key: "limit", label: "일일 작성 제한 완화", desc: "하루 작성 한도 상향", on: rank.order >= 3 },
            ].map((perm) => (
              <div className="choice-row" key={perm.key}>
                <label className="switch" aria-label={`${perm.label} 허용`}>
                  <input type="checkbox" defaultChecked={perm.on} />
                  <span className="switch-track" />
                </label>
                <div>
                  <strong>{perm.label}</strong>
                  <span style={{ color: "var(--gray-500)", marginLeft: 8, fontSize: 13 }}>
                    {perm.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* 이 등급 보유 회원 목록(더미) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">이 등급 보유 회원</h2>
            <p className="section-description">
              현재 {rank.label} 등급인 회원입니다(자동 부여 결과, 더미).
            </p>
          </div>
          <span className="badge badge-gray">{rank.holders.toLocaleString()}명</span>
        </div>

        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>회원</th>
                  <th>누적 작당력</th>
                  <th>달성일</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: ["김", "김개발", "kim@dev.io"], pt: rank.threshold + 240, date: "2026.05.21" },
                  { name: ["박", "박자동", "auto@flow.kr"], pt: rank.threshold + 120, date: "2026.06.02" },
                  { name: ["이", "이수익", "lee@saas.dev"], pt: rank.threshold + 30, date: "2026.06.14" },
                ].map((m, i) => (
                  <tr key={i}>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{m.name[0]}</span>
                        <div>
                          <div className="content-title">{m.name[1]}</div>
                          <div className="content-meta">{m.name[2]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{m.pt.toLocaleString()}</td>
                    <td className="num">{m.date}</td>
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
