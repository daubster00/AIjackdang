import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 묻고답하기 작성/수정 공용 폼(디자인 전용 — 백엔드 연동 없음).
 * mode(폼 모드: "new"=새 질문 작성 / "edit"=기존 질문 수정)에 따라
 * 제목·breadcrumb·버튼 라벨만 달라지고 마크업은 동일하다.
 * edit 모드일 때는 defaults(더미 기본값: 수정 폼에 미리 채워질 값들)를 defaultValue 로 넣는다.
 */

// 카테고리(질문이 속한 게시판) 셀렉트 옵션. value 는 폼 식별자, label 은 화면 표기.
const CATEGORY_OPTIONS = [
  { value: "vibe", label: "바이브 코딩" },
  { value: "automation", label: "AI 자동화" },
  { value: "monetization", label: "AI 수익화" },
] as const;

// 상태(질문의 Q&A 진행 상태) 셀렉트 옵션.
const STATUS_OPTIONS = [
  { value: "waiting", label: "답변대기" },
  { value: "answered", label: "답변있음" },
  { value: "resolved", label: "해결됨" },
] as const;

// 수정 폼에 미리 채울 더미 기본값의 타입(defaults: 폼 기본값 묶음).
type QnaFormDefaults = {
  title: string;
  category: string; // CATEGORY_OPTIONS 의 value
  status: string; // STATUS_OPTIONS 의 value
  body: string;
};

export function QnaForm({
  mode,
  id,
  defaults,
}: {
  /** 폼 모드 — new=새 질문, edit=기존 질문 수정 */
  mode: "new" | "edit";
  /** edit 모드에서 목록/취소 시 돌아갈 질문 id(상세 라우트용) */
  id?: string;
  /** edit 모드의 더미 기본값(미리 채워질 값) */
  defaults?: QnaFormDefaults;
}) {
  const isEdit = mode === "edit";
  // 취소/목록 이동 대상: 수정은 상세로, 작성은 목록으로 돌아간다.
  const backHref = isEdit && id ? `/qna/${id}` : "/qna";

  return (
    <AdminShell
      breadcrumb={["관리자", "묻고답하기 관리", isEdit ? "질문 수정" : "새 질문 작성"]}
      activeKey="qna"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? "질문 수정" : "새 질문 작성"}</h1>
          <p className="page-description">
            {isEdit
              ? "운영자 권한으로 질문 내용을 수정합니다. 디자인 시안 단계입니다."
              : "운영자가 직접 질문을 등록합니다. 디자인 시안 단계입니다."}
          </p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href={backHref}>
            <i className="ri-arrow-left-line" />
            취소
          </a>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            {isEdit ? "변경 저장" : "질문 등록"}
          </button>
        </div>
      </div>

      <section className="section">
        <article className="card">
          <div className="card-body component-stack">
            {/* 제목 */}
            <div className="field">
              <label className="field-label" htmlFor="qna-title">질문 제목</label>
              <input
                className="control"
                id="qna-title"
                type="text"
                placeholder="질문 제목을 입력하세요"
                defaultValue={isEdit ? defaults?.title : undefined}
              />
            </div>

            {/* 카테고리 + 상태(나란히) */}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label className="field-label" htmlFor="qna-category">카테고리</label>
                <select
                  className="control"
                  id="qna-category"
                  defaultValue={isEdit ? defaults?.category : CATEGORY_OPTIONS[0].value}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="qna-status">상태</label>
                <select
                  className="control"
                  id="qna-status"
                  defaultValue={isEdit ? defaults?.status : STATUS_OPTIONS[0].value}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 본문 */}
            <div className="field">
              <label className="field-label" htmlFor="qna-body">질문 본문</label>
              <textarea
                className="control"
                id="qna-body"
                rows={8}
                placeholder="질문 내용을 입력하세요"
                defaultValue={isEdit ? defaults?.body : undefined}
              />
              <p className="field-help">마크다운을 지원합니다(디자인 시안 — 실제 렌더링은 추후 연동).</p>
            </div>

            {/* 첨부파일(디자인만) */}
            <div className="field">
              <label className="field-label" htmlFor="qna-file">첨부파일</label>
              <input className="control" id="qna-file" type="file" />
              <p className="field-help">스크린샷·예제 코드 등을 첨부할 수 있습니다.</p>
            </div>

            {/* 도움된답변 표기 스위치(운영자는 지정 불가 — 안내용 비활성 표기) */}
            <div className="field">
              <label className="field-label">옵션</label>
              <div className="choice-row">
                <label className="choice">
                  <span className="switch">
                    <input type="checkbox" disabled />
                    <span className="switch-track" />
                  </span>
                  <span>도움된답변 지정(질문 작성자만 가능 — 운영자 비활성)</span>
                </label>
              </div>
            </div>
          </div>
        </article>

        {/* 하단 액션(상단과 동일 동작 — 긴 폼 대비) */}
        <div className="page-actions" style={{ marginTop: "16px", justifyContent: "flex-end" }}>
          <a className="btn btn-outline" href={backHref}>취소</a>
          <button className="btn btn-primary" type="button">
            <i className="ri-save-line" />
            {isEdit ? "변경 저장" : "질문 등록"}
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
