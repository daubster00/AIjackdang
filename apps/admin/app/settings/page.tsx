import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabPanels } from "./_components/SettingsTabPanels";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";

/**
 * 사이트 설정.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * 4개 그룹(기본/콘텐츠/파일/신고)을 .line-tabs 로 나눈 설정 폼이며, 초기값은 모두 더미다.
 * 저장 로직은 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 *
 * 탭 전환: .line-tabs JS 는 active 클래스 토글 + 'admin:tab-change' 이벤트만 담당한다.
 * 각 패널(data-tab-panel)은 기본 설정 외에는 display:none 으로 숨겨 두고,
 * SettingsTabPanels(클라이언트 컨트롤러)가 선택된 탭의 패널만 보이게 토글한다(탭별 기능 분리 노출).
 */

// 콘텐츠 설정 > 추천 태그 관리 초기 태그(더미). 메인/검색에서 밀어주는 추천 태그.
const RECOMMENDED_TAGS = ["Claude Code", "n8n", "바이브코딩", "AI자동화", "수익화", "외주"] as const;

// 파일 설정 초기값(더미). 업로드 허용 확장자/용량 정책.
const FILE_SETTINGS = {
  allowedExtensions: "zip, pdf, json, md, txt, csv, xlsx", // 자료실 전체 허용 확장자
  maxUploadMb: "50", // 1개 파일 최대 업로드 용량(MB)
  imageExtensions: "jpg, jpeg, png, webp, gif", // 본문/썸네일 이미지 허용 확장자
  resourceExtensions: "zip, json, md, py, ts, sh", // 실전자료 업로드 허용 확장자
} as const;

// 신고 설정 > 신고 사유 관리 목록(더미). 사용자가 신고 시 선택하는 사유.
const REPORT_REASONS = [
  "스팸/광고",
  "욕설/비방",
  "음란/선정성",
  "허위정보",
  "저작권 침해",
  "기타",
] as const;

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (session?.role !== "super_admin") {
    return (
      <AdminShell breadcrumb={["관리자", "사이트 설정"]} activeKey="settings" adminUser={session}>
        <PermissionDenied />
      </AdminShell>
    );
  }
  return (
    <AdminShell breadcrumb={["관리자", "사이트 설정"]} activeKey="settings" adminUser={session}>
      <div className="page-header">
        <div>
          <h1 className="page-title">사이트 설정</h1>
          <p className="page-description">AI작당 사이트 운영에 필요한 기본 정책을 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-refresh-line" />
            기본값으로 되돌리기
          </button>
          <button className="btn btn-primary">
            <i className="ri-save-line" />
            설정 저장
          </button>
        </div>
      </div>

      <article className="card">
        {/* 4개 설정 그룹 탭. 라이브러리 JS 가 active 토글만 담당하므로 아래 패널은 모두 표시한다. */}
        <div className="line-tabs" role="tablist" aria-label="설정 그룹">
          <button className="line-tab active" data-tab="basic">기본 설정</button>
          <button className="line-tab" data-tab="content">콘텐츠 설정</button>
          <button className="line-tab" data-tab="file">파일 설정</button>
          <button className="line-tab" data-tab="report">신고 설정</button>
        </div>

        {/* 탭 클릭 시 해당 패널만 노출하도록 토글하는 클라이언트 컨트롤러(렌더 출력 없음) */}
        <SettingsTabPanels />

        <div className="card-body component-stack">
          {/* ───────── 1. 기본 설정 ───────── */}
          <section className="section" data-tab-panel="basic" aria-label="기본 설정">
            <div className="section-heading">
              <div>
                <h2 className="section-title">기본 설정</h2>
                <p className="section-description">사이트 정체성과 검색/공유 시 기본 정보를 설정합니다.</p>
              </div>
            </div>

            {/* 패널 내부 필드 묶음. component-stack(세로 간격 14px)으로 라벨·help 가 다음 필드와 붙지 않게 한다. */}
            <div className="component-stack">
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="siteName">사이트명</label>
                <input className="control" id="siteName" type="text" defaultValue="AI작당" />
                <div className="field-help">상단바·탭 제목·이메일 등에 표시되는 이름입니다.</div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="operatorEmail">운영자 이메일</label>
                <div className="input-icon">
                  <i className="ri-mail-line" />
                  <input className="control" id="operatorEmail" type="email" defaultValue="help@aijakdang.com" />
                </div>
                <div className="field-help">신고/문의 알림이 이 주소로 전송됩니다.</div>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="siteDescription">사이트 설명</label>
              <textarea
                className="control"
                id="siteDescription"
                defaultValue="바이브코딩·AI 자동화·수익화 실전 노하우를 나누는 개발자 커뮤니티"
              />
              <div className="field-help">사이트 소개와 메타 설명의 기본값으로 사용됩니다.</div>
            </div>

            <div className="form-grid">
              <div className="field">
                <span className="field-label">사이트 로고</span>
                {/* 로고 업로드 자리(더미). 이후 단계에서 실제 업로드 연동. */}
                <div className="choice-row">
                  <span className="avatar brand-logo" aria-hidden="true">AI</span>
                  <button className="btn btn-outline btn-sm" type="button">
                    <i className="ri-upload-2-line" />
                    로고 업로드
                  </button>
                </div>
                <div className="field-help">권장 240×60px · PNG/SVG.</div>
              </div>
              <div className="field">
                <span className="field-label">파비콘</span>
                {/* 파비콘 업로드 자리(더미). */}
                <div className="choice-row">
                  <span className="stat-icon blue" aria-hidden="true"><i className="ri-flask-line" /></span>
                  <button className="btn btn-outline btn-sm" type="button">
                    <i className="ri-upload-2-line" />
                    파비콘 업로드
                  </button>
                </div>
                <div className="field-help">권장 32×32px · ICO/PNG.</div>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="seoTitle">기본 SEO title</label>
              <input
                className="control"
                id="seoTitle"
                type="text"
                defaultValue="AI작당 — 바이브코딩·AI 자동화 실전 커뮤니티"
              />
              <div className="field-help">검색 결과와 브라우저 탭에 표시되는 기본 제목입니다.</div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="seoDescription">기본 SEO description</label>
              <textarea
                className="control"
                id="seoDescription"
                defaultValue="Claude Code, n8n 등 실전 도구로 AI 자동화와 수익화를 만드는 개발자들의 작당 모의."
              />
              <div className="field-help">검색 결과 미리보기 문구로 사용됩니다(권장 150자 이내).</div>
            </div>

            <div className="field">
              <span className="field-label">기본 OG 이미지</span>
              {/* 기본 OG 이미지 업로드 자리(더미). SNS 공유 시 노출되는 대표 이미지. */}
              <div className="choice-row">
                <span className="stat-icon purple" aria-hidden="true"><i className="ri-image-line" /></span>
                <button className="btn btn-outline btn-sm" type="button">
                  <i className="ri-upload-2-line" />
                  OG 이미지 업로드
                </button>
              </div>
              <div className="field-help">SNS 공유 시 표시될 대표 이미지입니다(권장 1200×630px).</div>
            </div>
            </div>
          </section>

          {/* ───────── 2. 콘텐츠 설정 ───────── */}
          <section className="section" data-tab-panel="content" aria-label="콘텐츠 설정" style={{ display: "none" }}>
            <div className="section-heading">
              <div>
                <h2 className="section-title">콘텐츠 설정</h2>
                <p className="section-description">게시글·댓글·묻고답하기 작성 정책과 추천/인기 기준을 관리합니다.</p>
              </div>
            </div>

            {/* 콘텐츠 정책 필드 묶음. component-stack(세로 간격 14px)으로 각 그룹·필드 간격을 일정하게 유지. */}
            <div className="component-stack">
              {/* ── 게시글 설정 ── */}
              <span className="field-label">게시글 설정</span>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="postTitleMax">제목 최대 글자수</label>
                  <input className="control" id="postTitleMax" type="number" defaultValue="60" />
                  <div className="field-help">게시글 제목에 입력할 수 있는 최대 글자수입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="postBodyMin">본문 최소 글자수</label>
                  <input className="control" id="postBodyMin" type="number" defaultValue="20" />
                  <div className="field-help">이 글자수 미만이면 게시글을 등록할 수 없습니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="postBodyMax">본문 최대 글자수</label>
                  <input className="control" id="postBodyMax" type="number" defaultValue="10000" />
                  <div className="field-help">게시글 본문에 입력할 수 있는 최대 글자수입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="postDailyLimit">1인 1일 게시글 작성 제한</label>
                  <input className="control" id="postDailyLimit" type="number" defaultValue="10" />
                  <div className="field-help">한 사용자가 하루에 작성할 수 있는 게시글 수입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="postImageMax">이미지 첨부 최대 개수</label>
                  <input className="control" id="postImageMax" type="number" defaultValue="10" />
                  <div className="field-help">게시글 하나에 첨부할 수 있는 이미지 개수입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="postEditWindow">게시글 수정 가능 시간(분)</label>
                  <input className="control" id="postEditWindow" type="number" defaultValue="0" />
                  <div className="field-help">작성 후 수정 가능한 시간(분)입니다. 0이면 제한 없음.</div>
                </div>
              </div>

              {/* ── 댓글 설정 ── */}
              <span className="field-label">댓글 설정</span>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="commentMax">댓글 최대 글자수</label>
                  <input className="control" id="commentMax" type="number" defaultValue="500" />
                  <div className="field-help">댓글에 입력할 수 있는 최대 글자수입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="commentMin">댓글 최소 글자수</label>
                  <input className="control" id="commentMin" type="number" defaultValue="1" />
                  <div className="field-help">이 글자수 미만이면 댓글을 등록할 수 없습니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="commentEditWindow">댓글 수정 가능 시간(분)</label>
                  <input className="control" id="commentEditWindow" type="number" defaultValue="5" />
                  <div className="field-help">작성 후 댓글을 수정할 수 있는 시간(분)입니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="commentInterval">연속 댓글 최소 간격(초)</label>
                  <input className="control" id="commentInterval" type="number" defaultValue="10" />
                  <div className="field-help">도배 방지를 위한 연속 댓글 사이 최소 간격(초)입니다.</div>
                </div>
              </div>
              {/* 댓글 정책 토글들(.choice-row + .switch). */}
              <div className="field">
                <span className="field-label">대댓글(답글) 허용</span>
                <div className="choice-row">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>댓글에 답글(대댓글)을 달 수 있도록 허용</span>
                </div>
              </div>
              <div className="field">
                <span className="field-label">비속어 자동 필터</span>
                <div className="choice-row">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>등록된 금칙어를 자동으로 가림 처리</span>
                </div>
              </div>
              <div className="field">
                <span className="field-label">비회원 댓글 허용</span>
                <div className="choice-row">
                  <label className="switch">
                    <input type="checkbox" />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>로그인하지 않은 사용자의 댓글 작성 허용</span>
                </div>
              </div>

              {/* ── 묻고답하기 설정 ── */}
              <span className="field-label">묻고답하기 설정</span>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="answerMin">답변 최소 글자수</label>
                  <input className="control" id="answerMin" type="number" defaultValue="10" />
                  <div className="field-help">이 글자수 미만이면 답변을 등록할 수 없습니다.</div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="questionAutoClose">답변 없는 질문 자동 마감(일)</label>
                  <input className="control" id="questionAutoClose" type="number" defaultValue="30" />
                  <div className="field-help">답변이 없는 질문을 이 기간(일) 후 자동 마감합니다.</div>
                </div>
              </div>
              <div className="field">
                <span className="field-label">질문당 채택 답변 1개로 제한</span>
                <div className="choice-row">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>하나의 질문에서 답변을 1개만 채택 가능</span>
                </div>
              </div>

              {/* ── 추천 태그 관리(콘텐츠 정책) ── */}
              <div className="field">
                <span className="field-label">추천 태그 관리</span>
                <div className="tag-input">
                  {RECOMMENDED_TAGS.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                      <button type="button" aria-label="태그 삭제"><i className="ri-close-line" /></button>
                    </span>
                  ))}
                  <input type="text" placeholder="태그 입력 후 Enter" />
                </div>
                <div className="field-help">메인·검색에서 우선 노출되는 추천 태그입니다.</div>
              </div>

              {/* ── 인기글/인기자료 기준 ── */}
              <div className="form-grid">
                {/* 인기글 기준 설정. 인기글로 분류하는 집계 기준. */}
                <div className="field">
                  <label className="field-label">인기글 기준 설정</label>
                  <div className="custom-select" data-select="popularPost">
                    <button className="select-trigger" type="button" aria-expanded="false">
                      <span>최근 7일 조회수</span>
                      <i className="ri-arrow-down-s-line" />
                    </button>
                    <div className="select-menu">
                      <button className="select-option selected" data-value="views7">최근 7일 조회수<i className="ri-check-line" /></button>
                      <button className="select-option" data-value="likes7">최근 7일 좋아요</button>
                      <button className="select-option" data-value="comments7">최근 7일 댓글수</button>
                      <button className="select-option" data-value="mixed">조회+좋아요 가중치</button>
                    </div>
                  </div>
                  <div className="field-help">메인 "인기글" 영역 선정에 사용됩니다.</div>
                </div>

                {/* 인기자료 기준 설정. 인기자료로 분류하는 집계 기준. */}
                <div className="field">
                  <label className="field-label">인기자료 기준 설정</label>
                  <div className="custom-select" data-select="popularResource">
                    <button className="select-trigger" type="button" aria-expanded="false">
                      <span>최근 30일 다운로드</span>
                      <i className="ri-arrow-down-s-line" />
                    </button>
                    <div className="select-menu">
                      <button className="select-option selected" data-value="downloads30">최근 30일 다운로드<i className="ri-check-line" /></button>
                      <button className="select-option" data-value="bookmarks30">최근 30일 북마크</button>
                      <button className="select-option" data-value="rating">평점 높은 순</button>
                    </div>
                  </div>
                  <div className="field-help">메인 "인기자료" 영역 선정에 사용됩니다.</div>
                </div>
              </div>
            </div>
          </section>

          {/* ───────── 3. 파일 설정 ───────── */}
          <section className="section" data-tab-panel="file" aria-label="파일 설정" style={{ display: "none" }}>
            <div className="section-heading">
              <div>
                <h2 className="section-title">파일 설정</h2>
                <p className="section-description">업로드 가능한 확장자와 용량 제한을 관리합니다.</p>
              </div>
            </div>

            {/* 패널 내부 필드 묶음. component-stack(세로 간격 14px)으로 form-grid 행 간격을 일정하게 유지. */}
            <div className="component-stack">
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="allowedExt">허용 파일 확장자</label>
                <input className="control" id="allowedExt" type="text" defaultValue={FILE_SETTINGS.allowedExtensions} />
                <div className="field-help">쉼표(,)로 구분합니다. 점(.)은 생략합니다.</div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="maxUpload">최대 업로드 용량</label>
                <div className="input-icon">
                  <i className="ri-hard-drive-2-line" />
                  <input className="control" id="maxUpload" type="number" defaultValue={FILE_SETTINGS.maxUploadMb} />
                </div>
                <div className="field-help">파일 1개당 최대 용량(MB)입니다.</div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="imageExt">이미지 허용 확장자</label>
                <input className="control" id="imageExt" type="text" defaultValue={FILE_SETTINGS.imageExtensions} />
                <div className="field-help">본문 이미지·썸네일 업로드에 허용됩니다.</div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="resourceExt">자료실 허용 확장자</label>
                <input className="control" id="resourceExt" type="text" defaultValue={FILE_SETTINGS.resourceExtensions} />
                <div className="field-help">실전자료 업로드에만 허용되는 확장자입니다.</div>
              </div>
            </div>
            </div>
          </section>

          {/* ───────── 4. 신고 설정 ───────── */}
          <section className="section" data-tab-panel="report" aria-label="신고 설정" style={{ display: "none" }}>
            <div className="section-heading">
              <div>
                <h2 className="section-title">신고 설정</h2>
                <p className="section-description">신고 사유와 누적·자동 숨김 정책을 관리합니다.</p>
              </div>
            </div>

            {/* 패널 내부 필드 묶음. component-stack(세로 간격 14px)으로 필드·경고 블록 간격을 일정하게 유지. */}
            <div className="component-stack">
            <div className="field">
              <div className="choice-row" style={{ justifyContent: "space-between" }}>
                <span className="field-label" style={{ margin: 0 }}>신고 사유 관리</span>
                <button className="btn btn-outline btn-sm" type="button">
                  <i className="ri-add-line" />
                  사유 추가
                </button>
              </div>
              {/* 신고 사유 목록 편집(더미). 각 사유는 태그 형태로 삭제 가능. */}
              <div className="tag-input">
                {REPORT_REASONS.map((reason) => (
                  <span className="tag" key={reason}>
                    {reason}
                    <button type="button" aria-label="사유 삭제"><i className="ri-close-line" /></button>
                  </span>
                ))}
                <input type="text" placeholder="신고 사유 입력 후 Enter" />
              </div>
              <div className="field-help">사용자가 신고할 때 선택하는 사유 목록입니다.</div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="reportThreshold">신고 누적 기준</label>
                <div className="input-icon">
                  <i className="ri-alarm-warning-line" />
                  <input className="control" id="reportThreshold" type="number" defaultValue="5" />
                </div>
                <div className="field-help">이 횟수 이상 신고되면 운영자 검토 대상으로 표시됩니다.</div>
              </div>
              <div className="field">
                <span className="field-label">자동 숨김 기준 사용</span>
                {/* 자동 숨김 사용 여부 토글(.switch). */}
                <div className="choice-row">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="switch-track" />
                  </label>
                  <span style={{ color: "var(--gray-500)" }}>누적 기준 도달 시 콘텐츠를 자동 숨김 처리</span>
                </div>
              </div>
            </div>

            <div className="alert alert-warning">
              <i className="ri-alert-line" />
              <div>
                <strong>주의</strong>
                <br />
                자동 숨김은 잘못된 신고로 정상 글이 숨겨질 수 있습니다. 신중히 사용하고, 숨김 처리된 글은 반드시 운영자가 다시 확인하세요.
              </div>
            </div>
            </div>
          </section>

          {/* 하단 저장 영역 */}
          <div className="filter-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-outline" type="button">취소</button>
            <button className="btn btn-primary" type="button">
              <i className="ri-save-line" />
              설정 저장
            </button>
          </div>
        </div>
      </article>
    </AdminShell>
  );
}
