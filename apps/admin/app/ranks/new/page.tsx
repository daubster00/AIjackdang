import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 새 등급 추가 페이지(/ranks/new).
 * 등급명·달성 기준(작당력 임계값)·뱃지 이미지·설명·혜택·권한을 입력해 등급을 생성한다.
 * 모든 입력은 디자인용 더미이며, "등급 추가" 버튼 동작은 이후 API(@ai-jakdang/api) 와 연동한다.
 */

// 새 등급에서 기본 설정할 권한 목록
const NEW_PERMS = [
  { key: "write", label: "글쓰기", desc: "게시글 작성", on: true },
  { key: "comment", label: "댓글", desc: "댓글 작성", on: true },
  { key: "resource", label: "실전자료 등록", desc: "자료 업로드", on: false },
  { key: "link", label: "링크 첨부", desc: "외부 링크 삽입", on: false },
  { key: "file", label: "파일 첨부", desc: "파일 업로드", on: false },
  { key: "report", label: "신고", desc: "콘텐츠 신고", on: true },
  { key: "limit", label: "일일 작성 제한 완화", desc: "하루 작성 한도 상향", on: false },
] as const;

export default function RankNewPage() {
  return (
    <AdminShell breadcrumb={["관리자", "등급·뱃지 관리", "새 등급"]} activeKey="ranks">
      <div className="page-header">
        <div>
          <h1 className="page-title">새 등급 추가</h1>
          <p className="page-description">
            새 등급의 이름·달성 기준(작당력 임계값)·뱃지 이미지·혜택·권한을 설정합니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/ranks">
            <i className="ri-arrow-left-line" />
            취소
          </Link>
          {/* 등급 추가: 디자인만(백엔드 연동 없음) */}
          <button className="btn btn-primary" type="button">
            <i className="ri-add-line" />
            등급 추가
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="alert alert-info" style={{ marginBottom: "20px" }}>
        <i className="ri-information-line" />
        <div>
          새 등급은 누적 작당력(기여 점수) 기준을 넘으면 <strong>자동으로 부여</strong>됩니다.
          등급 순서(Lv.)는 달성 기준 수치로 자동 결정됩니다.
        </div>
      </div>

      {/* 뱃지 이미지 업로드 + 기본 정보 2단 그리드 */}
      <section className="section">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(220px, 280px) 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* 좌: 뱃지 이미지 업로드 자리 */}
          <article className="card">
            <div
              className="card-body component-stack"
              style={{ alignItems: "center", textAlign: "center" }}
            >
              {/* 이미지 업로드 전 미리보기 자리 */}
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 12,
                  background: "var(--gray-100)",
                  border: "2px dashed var(--gray-300)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 8,
                  color: "var(--gray-400)",
                }}
                aria-label="뱃지 이미지 미리보기"
              >
                <i className="ri-image-add-line" style={{ fontSize: 36 }} />
                <span style={{ fontSize: 12 }}>이미지 없음</span>
              </div>
              {/* 뱃지 이미지 업로드: 디자인만 */}
              <button className="btn btn-outline btn-sm" type="button">
                <i className="ri-upload-line" />
                뱃지 이미지 업로드
              </button>
              <div className="field-help">
                권장 규격: 240×240 px · PNG(투명 배경) · 최대 500 KB.
              </div>
            </div>
          </article>

          {/* 우: 등급 기본 정보 폼 */}
          <article className="card">
            <div className="card-body component-stack">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div>
                  <h2 className="section-title" style={{ fontSize: "18px" }}>기본 정보</h2>
                  <p className="section-description">새 등급의 이름과 달성 기준을 입력합니다.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="newTierLabel">등급명</label>
                  <input
                    className="control"
                    id="newTierLabel"
                    type="text"
                    placeholder="예: 슈퍼마스터"
                  />
                  <div className="field-help">회원 프로필·게시글 작성자 옆 등에 표시됩니다.</div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="newTierThreshold">
                    달성 기준 — 누적 작당력
                  </label>
                  <div className="input-icon">
                    <i className="ri-copper-coin-line" />
                    <input
                      className="control"
                      id="newTierThreshold"
                      type="number"
                      placeholder="예: 10000"
                      min={0}
                    />
                  </div>
                  <div className="field-help">
                    이 수치 이상의 누적 작당력을 가진 회원에게 자동 부여됩니다.
                    기존 등급들과 겹치지 않는 값을 입력하세요.
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="newTierDesc">등급 설명</label>
                <textarea
                  className="control"
                  id="newTierDesc"
                  placeholder="이 등급의 설명을 입력합니다."
                />
                <div className="field-help">등급 안내 툴팁·마이페이지 등에 노출됩니다.</div>
              </div>

              {/* 혜택 태그 입력 */}
              <div className="field">
                <span className="field-label">등급 혜택</span>
                <div className="tag-input">
                  <input type="text" placeholder="혜택 입력 후 Enter" />
                </div>
                <div className="field-help">이 등급부터 사용 가능한 기능·혜택을 추가하세요.</div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 권한 설정 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">권한 설정</h2>
            <p className="section-description">
              이 등급 회원에게 허용할 활동을 선택합니다.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="card-body component-stack">
            {NEW_PERMS.map((perm) => (
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

      {/* 하단 액션 */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
        <Link className="btn btn-outline" href="/ranks">
          <i className="ri-arrow-left-line" />
          취소
        </Link>
        <button className="btn btn-primary" type="button">
          <i className="ri-add-line" />
          등급 추가
        </button>
      </div>
    </AdminShell>
  );
}
