import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 실전자료 등록/수정 공용 폼(디자인 전용 — 백엔드 연동 없음).
 * mode(폼 모드: "new"=새 자료 등록 / "edit"=기존 자료 수정)에 따라
 * 제목·breadcrumb·버튼 라벨만 달라지고 마크업은 동일하다.
 * edit 모드일 때는 defaults(더미 기본값: 수정 폼에 미리 채워질 값들)를 defaultValue 로 넣는다.
 */

// 자료유형 셀렉트 옵션. value 는 폼 식별자, label 은 화면 표기.
const TYPE_OPTIONS = [
  { value: "skill", label: "Claude Code Skill" },
  { value: "workflow", label: "n8n 워크플로우" },
  { value: "promptpack", label: "프롬프트팩" },
  { value: "template", label: "코드 템플릿" },
  { value: "dataset", label: "데이터셋" },
] as const;

// 지원환경(자료가 동작하는 실행 환경) 셀렉트 옵션.
const ENV_OPTIONS = [
  { value: "claude-code", label: "Claude Code" },
  { value: "n8n", label: "n8n" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "cursor", label: "Cursor" },
  { value: "cross", label: "환경 무관" },
] as const;

// 난이도(자료 활용에 필요한 숙련도) 셀렉트 옵션.
const LEVEL_OPTIONS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
] as const;

// 상태(공개/숨김) 셀렉트 옵션.
const STATUS_OPTIONS = [
  { value: "public", label: "공개" },
  { value: "hidden", label: "숨김" },
] as const;

// 수정 폼에 미리 채울 더미 기본값의 타입(defaults: 폼 기본값 묶음).
type ResourceFormDefaults = {
  title: string;
  type: string; // TYPE_OPTIONS 의 value
  env: string; // ENV_OPTIONS 의 value
  level: string; // LEVEL_OPTIONS 의 value
  status: string; // STATUS_OPTIONS 의 value
  desc: string;
  price: string; // 판매 가격(원) — 0 이면 무료
  points: string; // 다운로드 시 차감 포인트
};

export function ResourceForm({
  mode,
  id,
  defaults,
}: {
  /** 폼 모드 — new=새 자료 등록, edit=기존 자료 수정 */
  mode: "new" | "edit";
  /** edit 모드에서 취소/목록 시 돌아갈 자료 id(상세 라우트용) */
  id?: string;
  /** edit 모드의 더미 기본값(미리 채워질 값) */
  defaults?: ResourceFormDefaults;
}) {
  const isEdit = mode === "edit";
  // 취소 대상: 수정은 상세로, 등록은 목록으로.
  const backHref = isEdit && id ? `/resources/${id}` : "/resources";

  return (
    <AdminShell
      breadcrumb={["관리자", "실전자료 관리", isEdit ? "자료 수정" : "새 자료 등록"]}
      activeKey="resources"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? "자료 수정" : "새 자료 등록"}</h1>
          <p className="page-description">
            {isEdit
              ? "운영자 권한으로 실전자료 내용을 수정합니다. 디자인 시안 단계입니다."
              : "운영자가 직접 실전자료를 등록합니다. 디자인 시안 단계입니다."}
          </p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href={backHref}>
            <i className="ri-arrow-left-line" />
            취소
          </a>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            {isEdit ? "변경 저장" : "자료 등록"}
          </button>
        </div>
      </div>

      <section className="section">
        <article className="card">
          <div className="card-body component-stack">
            {/* 자료명 */}
            <div className="field">
              <label className="field-label" htmlFor="res-title">자료명</label>
              <input
                className="control"
                id="res-title"
                type="text"
                placeholder="자료명을 입력하세요"
                defaultValue={isEdit ? defaults?.title : undefined}
              />
            </div>

            {/* 자료유형 + 지원환경 */}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label className="field-label" htmlFor="res-type">자료유형</label>
                <select className="control" id="res-type" defaultValue={isEdit ? defaults?.type : TYPE_OPTIONS[0].value}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="res-env">지원환경</label>
                <select className="control" id="res-env" defaultValue={isEdit ? defaults?.env : ENV_OPTIONS[0].value}>
                  {ENV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 난이도 + 상태 */}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label className="field-label" htmlFor="res-level">난이도</label>
                <select className="control" id="res-level" defaultValue={isEdit ? defaults?.level : LEVEL_OPTIONS[0].value}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="res-status">상태</label>
                <select className="control" id="res-status" defaultValue={isEdit ? defaults?.status : STATUS_OPTIONS[0].value}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 자료 설명(본문) */}
            <div className="field">
              <label className="field-label" htmlFor="res-desc">자료 설명</label>
              <textarea
                className="control"
                id="res-desc"
                rows={8}
                placeholder="자료 내용·사용법을 설명하세요"
                defaultValue={isEdit ? defaults?.desc : undefined}
              />
            </div>

            {/* 가격 + 포인트 */}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label className="field-label" htmlFor="res-price">판매 가격(원)</label>
                <input
                  className="control"
                  id="res-price"
                  type="number"
                  placeholder="0 (무료)"
                  defaultValue={isEdit ? defaults?.price : undefined}
                />
                <p className="field-help">0 이면 무료 자료입니다.</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="res-points">다운로드 차감 포인트</label>
                <input
                  className="control"
                  id="res-points"
                  type="number"
                  placeholder="0"
                  defaultValue={isEdit ? defaults?.points : undefined}
                />
              </div>
            </div>

            {/* 첨부파일(디자인만) */}
            <div className="field">
              <label className="field-label" htmlFor="res-file">첨부파일</label>
              <input className="control" id="res-file" type="file" multiple />
              <p className="field-help">.zip / .json / .pdf 등 다운로드형 자료 파일을 첨부하세요.</p>
            </div>
          </div>
        </article>

        {/* 하단 액션(상단과 동일 동작) */}
        <div className="page-actions" style={{ marginTop: "16px", justifyContent: "flex-end" }}>
          <a className="btn btn-outline" href={backHref}>취소</a>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            {isEdit ? "변경 저장" : "자료 등록"}
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
