import Link from "next/link";
import { BOARDS } from "@/lib/boards";

/**
 * 게시글 작성/수정 공통 폼.
 * 새 글(new)과 수정(edit) 페이지가 함께 쓴다. mode(폼 모드: "new"=새 글, "edit"=수정)에 따라
 * 하단 버튼 구성만 달라진다.
 * 모든 입력은 디자인용 정적 마크업이며 동작(서버 액션/제출)은 연결하지 않는다.
 * 모든 버튼은 type="button"(폼 제출을 막는 일반 버튼)으로 둔다.
 */

/** PostForm 에 넘기는 더미 기본값. edit(수정) 모드에서 기존 글 값을 채울 때 사용한다. */
export type PostFormDefaults = {
  /** title(게시글 제목) 기본값 */
  title?: string;
  /** content(본문 텍스트) 기본값 */
  content?: string;
  /** tags(태그 문자열 배열) 기본값 */
  tags?: string[];
  /** notice(공지 여부) 기본값 */
  notice?: boolean;
  /** pinned(상단고정 여부) 기본값 */
  pinned?: boolean;
  /** featured(추천 여부) 기본값 */
  featured?: boolean;
  /** main(메인노출 여부) 기본값 */
  main?: boolean;
  /** visibility(공개 상태) 기본값: "public"=공개, "hidden"=숨김 */
  visibility?: "public" | "hidden";
};

export function PostForm({
  mode,
  /** board(현재 게시판 slug, 게시판 URL 식별 영문 키) — 셀렉트 기본 선택값/목록 링크에 쓰인다. */
  board,
  defaults = {},
}: {
  mode: "new" | "edit";
  board: string;
  defaults?: PostFormDefaults;
}) {
  const {
    title = "",
    content = "",
    tags = [],
    notice = false,
    pinned = false,
    featured = false,
    main = false,
    visibility = "public",
  } = defaults;

  // 속성 토글(공지/상단고정/추천/메인노출) 정의. key=내부 식별자, label=화면 표기, on=초기 on 여부.
  const TOGGLES = [
    { key: "notice", label: "공지글로 등록", help: "게시판 상단에 공지로 노출됩니다.", on: notice },
    { key: "pinned", label: "상단 고정", help: "목록 최상단에 고정됩니다.", on: pinned },
    { key: "featured", label: "추천글 지정", help: "추천글 영역에 노출됩니다.", on: featured },
    { key: "main", label: "메인 노출", help: "사이트 메인 페이지에 노출됩니다.", on: main },
  ] as const;

  return (
    <form className="card">
      <div style={{ padding: "20px", display: "grid", gap: 18 }}>
        {/* 제목 */}
        <div className="field">
          <label className="field-label" htmlFor="post-title">
            제목
          </label>
          <input
            id="post-title"
            className="control"
            type="text"
            placeholder="게시글 제목을 입력하세요"
            defaultValue={title}
          />
        </div>

        {/* 게시판 선택(네이티브 select 로 단순화 — 디자인용) */}
        <div className="field">
          <label className="field-label" htmlFor="post-board">
            게시판
          </label>
          <select id="post-board" className="control" defaultValue={board}>
            {BOARDS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* 본문 */}
        <div className="field">
          <label className="field-label" htmlFor="post-content">
            본문
          </label>
          <textarea
            id="post-content"
            className="control"
            style={{ minHeight: 240 }}
            placeholder="본문 내용을 입력하세요"
            defaultValue={content}
          />
          <p className="field-help">이미지·코드블록 등 리치 에디터는 추후 연동됩니다.</p>
        </div>

        {/* 태그 입력 */}
        <div className="field">
          <span className="field-label">태그</span>
          <div className="tag-input">
            {tags.map((t) => (
              <span className="tag" key={t}>
                {t}
                <button type="button" aria-label={`${t} 태그 제거`}>
                  <i className="ri-close-line" />
                </button>
              </span>
            ))}
            <input type="text" placeholder="태그 입력 후 Enter" aria-label="태그 추가" />
          </div>
          <p className="field-help">쉼표 또는 Enter 로 태그를 구분합니다.</p>
        </div>

        {/* 속성 토글(공지/상단고정/추천/메인노출) */}
        <div className="field">
          <span className="field-label">게시글 속성</span>
          <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
            {TOGGLES.map((t) => (
              <div
                key={t.key}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
              >
                <div>
                  <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>{t.label}</div>
                  <div className="field-help" style={{ marginTop: 2 }}>
                    {t.help}
                  </div>
                </div>
                <label className="switch">
                  <input type="checkbox" defaultChecked={t.on} aria-label={t.label} />
                  <span className="switch-track" />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* 상태(공개/숨김 라디오) */}
        <div className="field">
          <span className="field-label">상태</span>
          <div className="choice-row" style={{ marginTop: 4 }}>
            <label className="choice">
              <input type="radio" name="post-visibility" defaultChecked={visibility === "public"} />
              공개
            </label>
            <label className="choice">
              <input type="radio" name="post-visibility" defaultChecked={visibility === "hidden"} />
              숨김
            </label>
          </div>
        </div>
      </div>

      {/* 하단 액션: 취소(목록 링크) + 모드별 저장 버튼 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          padding: "16px 20px",
          borderTop: "1px solid var(--gray-200)",
        }}
      >
        <Link className="btn btn-outline" href={`/posts/${board}`}>
          취소
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "new" ? (
            <>
              <button className="btn btn-outline" type="button">
                <i className="ri-draft-line" />
                임시저장
              </button>
              <button className="btn btn-primary" type="button">
                <i className="ri-send-plane-line" />
                발행
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" type="button">
                <i className="ri-delete-bin-line" />
                삭제
              </button>
              <button className="btn btn-primary" type="button">
                <i className="ri-save-line" />
                수정 저장
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
