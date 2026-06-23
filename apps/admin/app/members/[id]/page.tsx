import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { MemberActivityTabs } from "../_components/MemberActivityTabs";

/**
 * 유저 회원 상세 페이지.
 * - 상단 프로필 헤더: 아바타 + 닉네임(크게) + 등급 뱃지 + 보유 포인트(큰 숫자) + 상태/로그인(우측)
 * - 유저 기본 정보 카드: 이름·연락처·이메일·성별·생년월일·마케팅 수신 동의
 * - 처리 액션: 포인트 조정 / 쪽지 발송 / 이용제한 (권한변경·등급변경·뱃지 제거됨)
 * - 활동내역 탭: 작성글 / 작성댓글 / 다운로드 / 신고당한 이력 / 제재 이력
 * 모든 데이터는 더미 값이며 이후 API 연동 예정.
 */

// 등급(grade) → 배지 색 매핑.
const GRADE_BADGE: Record<string, string> = {
  "새내기": "badge-gray",
  "작당원": "badge-blue",
  "실전러": "badge-cyan",
  "고수": "badge-purple",
  "마스터": "badge-orange",
};

// 상태(status) → 배지 색.
const STATUS_BADGE: Record<string, string> = {
  "정상": "badge-green",
  "이용제한": "badge-red",
  "탈퇴": "badge-gray",
};

// 상세에 표시할 대표 유저 회원(더미).
const DETAIL = {
  initial: "최",
  nickname: "최대표",
  email: "ceo.choi@example.com",
  joinedAt: "2025.09.21",
  lastLogin: "2026.06.17",
  // 유저 기본 정보(더미)
  realName: "최민준",
  phone: "010-1234-5678",
  gender: "남성",
  birthDate: "1988.03.15",
  marketingConsent: true, // 마케팅 수신 동의 여부
  // 활동 지표
  posts: 51,
  comments: 96,
  questions: 5,
  answers: 12,
  resources: 18,
  downloads: 3120,
  points: 24050,
  grade: "마스터",
  badges: 19,
  reports: 4,
  status: "이용제한",
};

// 활동내역 탭 — 작성글(더미).
const DUMMY_POSTS = [
  { title: "AI 외주 견적을 잡을 때 주의할 점 5가지", board: "자유게시판", date: "2026.06.10", views: 1240 },
  { title: "ChatGPT API 비용 절감 실전 팁", board: "실전자료", date: "2026.05.28", views: 980 },
  { title: "작당 이후 첫 프리랜서 수입 인증", board: "자유게시판", date: "2026.04.15", views: 432 },
] as const;

// 활동내역 탭 — 작성 댓글(더미).
const DUMMY_COMMENTS = [
  { content: "저도 같은 경험이 있어요. 계약서에 꼭 범위 명시하세요!", targetPost: "AI 외주 계약 주의사항", date: "2026.06.11" },
  { content: "이 방법 써봤는데 토큰 30% 절감됐습니다.", targetPost: "ChatGPT API 비용 절감 실전 팁", date: "2026.05.29" },
  { content: "질문이 있는데 DM 드려도 될까요?", targetPost: "n8n 자동화 소개", date: "2026.05.01" },
] as const;

// 활동내역 탭 — 다운로드(더미).
const DUMMY_DOWNLOADS = [
  { resourceName: "AI 자동화 견적서 템플릿 v2", type: "템플릿", date: "2026.06.12" },
  { resourceName: "ChatGPT 프롬프트 라이브러리 100선", type: "자료집", date: "2026.05.30" },
  { resourceName: "n8n 워크플로우 샘플팩", type: "패키지", date: "2026.04.20" },
] as const;

// 활동내역 탭 — 신고당한 이력(더미).
const DUMMY_REPORTED = [
  { reason: "광고성 댓글 도배", target: "댓글 · 'AI 자동화 외주 견적…'", date: "2026.06.10", processState: ["badge-orange", "검토중"] },
  { reason: "허위 정보 작성", target: "게시글 · 'AI 외주 견적을 잡을 때…'", date: "2026.05.28", processState: ["badge-blue", "처리완료"] },
  { reason: "타인 비방", target: "댓글 · '그건 틀린 말입니다…'", date: "2026.05.12", processState: ["badge-blue", "처리완료"] },
  { reason: "스팸 링크 삽입", target: "게시글 · '외주 단가표 공유'", date: "2026.04.03", processState: ["badge-gray", "무혐의"] },
] as const;

// 활동내역 탭 — 제재 이력(더미).
const DUMMY_SANCTIONS = [
  { type: "7일 이용정지", reason: "반복 광고성 게시물", handler: "운영지기", date: "2026.06.10" },
  { type: "경고", reason: "허위 정보 작성", handler: "운영지기", date: "2026.05.28" },
] as const;

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // 회원 식별자(이메일을 encodeURIComponent 처리한 값)
}) {
  const { id } = await params;
  const email = decodeURIComponent(id);

  return (
    <AdminShell breadcrumb={["관리자", "유저 회원 관리", DETAIL.nickname]} activeKey="members">
      {/* 클라이언트 탭 컨트롤러 — 렌더 없음, 이벤트 리스닝만 */}
      <MemberActivityTabs />

      <div className="page-header">
        <div>
          <h1 className="page-title">유저 회원 상세</h1>
          <p className="page-description">{email} · 활동 내역을 확인하고 처리 액션을 수행합니다.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/members">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          <button className="btn btn-outline" data-admin-open="memberPoint">
            <i className="ri-coin-line" />
            포인트 조정
          </button>
          <button className="btn btn-outline" data-admin-open="memberMessage">
            <i className="ri-mail-send-line" />
            쪽지 발송
          </button>
          <button className="btn btn-danger">
            <i className="ri-user-forbid-line" />
            이용제한
          </button>
        </div>
      </div>

      {/* ========== (a) 프로필 헤더 — 시각적 위계 재배치 ========== */}
      <section className="section">
        <article className="card">
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}>
              {/* 좌측: 아바타 + 닉네임 + 등급 뱃지 + 아이디/가입일 */}
              <div style={{ display: "flex", gap: "20px", flex: 1, alignItems: "center" }}>
                {/* 큰 아바타 */}
                <span
                  className="author-avatar"
                  style={{ width: "72px", height: "72px", fontSize: "28px", flexShrink: 0 }}
                >
                  {DETAIL.initial}
                </span>

                <div>
                  {/* 닉네임 + 등급 뱃지 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.2 }}>
                      {DETAIL.nickname}
                    </span>
                    <span className={`badge ${GRADE_BADGE[DETAIL.grade]}`}>{DETAIL.grade}</span>
                  </div>

                  {/* 아이디(이메일) + 가입일 */}
                  <div className="content-meta" style={{ marginBottom: "10px" }}>
                    <span>{DETAIL.email}</span>
                    <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
                    <span>가입 {DETAIL.joinedAt}</span>
                  </div>

                  {/* 보유 포인트 큰 강조 숫자 */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-primary, #6366f1)", lineHeight: 1 }}>
                      {DETAIL.points.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.6 }}>P 보유</span>
                  </div>
                </div>
              </div>

              {/* 우측: 상태 뱃지 + 최근 로그인 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                <span className={`badge ${STATUS_BADGE[DETAIL.status]}`} style={{ fontSize: "13px", padding: "4px 12px" }}>
                  {DETAIL.status}
                </span>
                <span className="content-meta" style={{ fontSize: "12px" }}>
                  최근 로그인 {DETAIL.lastLogin}
                </span>
                {/* 활동 요약 수치 */}
                <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                  <span className="content-meta" style={{ fontSize: "12px" }}>
                    <i className="ri-article-line" style={{ marginRight: "4px" }} />
                    글 {DETAIL.posts}
                  </span>
                  <span className="content-meta" style={{ fontSize: "12px" }}>
                    <i className="ri-chat-3-line" style={{ marginRight: "4px" }} />
                    댓글 {DETAIL.comments}
                  </span>
                  <span className="content-meta" style={{ fontSize: "12px" }}>
                    <i className="ri-download-2-line" style={{ marginRight: "4px" }} />
                    다운로드 {DETAIL.downloads.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ========== (b) 유저 기본 정보 섹션 ========== */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">기본 정보</h2>
            <p className="section-description">회원이 등록한 개인 정보입니다.</p>
          </div>
        </div>
        <article className="card">
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">이름(실명)</div>
                <div className="detail-value">{DETAIL.realName}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">연락처(휴대폰)</div>
                <div className="detail-value">{DETAIL.phone}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">이메일</div>
                <div className="detail-value">{DETAIL.email}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">성별</div>
                <div className="detail-value">{DETAIL.gender}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">생년월일</div>
                <div className="detail-value">{DETAIL.birthDate}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">마케팅 수신 동의</div>
                <div className="detail-value">
                  {DETAIL.marketingConsent ? (
                    <span className="badge badge-green">동의</span>
                  ) : (
                    <span className="badge badge-gray">거부</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ========== (d) 활동내역 탭 영역 ========== */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">활동 내역</h2>
            <p className="section-description">작성글·댓글·다운로드·신고 및 제재 이력을 탭으로 확인합니다.</p>
          </div>
        </div>

        <article className="card" id="member-activity-tabs">
          {/* 탭 헤더 — 첫 번째 탭(posts, 작성글)이 active */}
          <div className="line-tabs" role="tablist" aria-label="활동 내역">
            <button className="line-tab active" data-tab="posts">작성글</button>
            <button className="line-tab" data-tab="comments">작성 댓글</button>
            <button className="line-tab" data-tab="downloads">다운로드</button>
            <button className="line-tab" data-tab="reported">신고당한 이력</button>
            <button className="line-tab" data-tab="sanctions">제재 이력</button>
          </div>

          {/* 패널 1: 작성글 — 초기 표시(display: "") */}
          <div data-tab-panel="posts">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>제목</th><th>게시판</th><th>작성일</th><th className="num">조회</th></tr>
                </thead>
                <tbody>
                  {DUMMY_POSTS.map((p) => (
                    <tr key={p.title}>
                      <td><div className="content-title">{p.title}</div></td>
                      <td><span className="badge badge-gray">{p.board}</span></td>
                      <td className="num">{p.date}</td>
                      <td className="num">{p.views.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 패널 2: 작성 댓글 — 초기 숨김 */}
          <div data-tab-panel="comments" style={{ display: "none" }}>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>댓글 내용</th><th>대상 글</th><th>작성일</th></tr>
                </thead>
                <tbody>
                  {DUMMY_COMMENTS.map((c) => (
                    <tr key={c.content}>
                      <td><div className="content-title">{c.content}</div></td>
                      <td><div className="content-meta">{c.targetPost}</div></td>
                      <td className="num">{c.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 패널 3: 다운로드 — 초기 숨김 */}
          <div data-tab-panel="downloads" style={{ display: "none" }}>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>자료명</th><th>유형</th><th>다운로드일</th></tr>
                </thead>
                <tbody>
                  {DUMMY_DOWNLOADS.map((d) => (
                    <tr key={d.resourceName}>
                      <td><div className="content-title">{d.resourceName}</div></td>
                      <td><span className="badge badge-blue">{d.type}</span></td>
                      <td className="num">{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 패널 4: 신고당한 이력 — 초기 숨김 */}
          <div data-tab-panel="reported" style={{ display: "none" }}>
            {DETAIL.reports > 0 && (
              <div style={{ padding: "12px 16px" }}>
                <div className="alert alert-warning">
                  <i className="ri-alert-line" />
                  <div>총 <strong>{DETAIL.reports}건</strong>의 신고를 받았습니다.</div>
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>신고 사유</th><th>대상 콘텐츠</th><th>신고일</th><th>처리 상태</th></tr>
                </thead>
                <tbody>
                  {DUMMY_REPORTED.map((r) => (
                    <tr key={r.reason + r.date}>
                      <td><div className="content-title">{r.reason}</div></td>
                      <td><div className="content-meta">{r.target}</div></td>
                      <td className="num">{r.date}</td>
                      <td><span className={`badge ${r.processState[0]}`}>{r.processState[1]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 패널 5: 제재 이력 — 초기 숨김 */}
          <div data-tab-panel="sanctions" style={{ display: "none" }}>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>제재 유형</th><th>사유</th><th>처리자</th><th>일자</th></tr>
                </thead>
                <tbody>
                  {DUMMY_SANCTIONS.length > 0 ? (
                    DUMMY_SANCTIONS.map((s) => (
                      <tr key={s.type + s.date}>
                        <td><span className="badge badge-red">{s.type}</span></td>
                        <td><div className="content-title">{s.reason}</div></td>
                        <td><div className="content-meta">{s.handler}</div></td>
                        <td className="num">{s.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "24px", opacity: 0.5 }}>
                        제재 이력이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>

      {/* ===== 액션 폼 모달 ===== */}
      <div className="overlay" />

      {/* 포인트 수동 지급/차감 모달 */}
      <section className="modal" id="memberPoint" role="dialog" aria-modal="true" aria-labelledby="memberPointTitle">
        <div className="modal-header">
          <div className="modal-title" id="memberPointTitle">포인트 조정</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-info">
              <i className="ri-information-line" />
              <div>현재 보유 포인트: <strong>{DETAIL.points.toLocaleString()} P</strong></div>
            </div>
            <div className="field">
              <span className="field-label">조정 유형</span>
              <div className="choice-row">
                <label className="choice"><input type="radio" name="pointType" defaultChecked />지급(+)</label>
                <label className="choice"><input type="radio" name="pointType" />차감(-)</label>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pointAmount">포인트 수량</label>
              <input className="control" id="pointAmount" type="number" placeholder="예: 500" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pointReason">사유</label>
              <textarea className="control" id="pointReason" placeholder="이벤트 보상, 우수 답변 등 조정 사유를 남기세요" />
              <div className="field-help">조정 내역은 회원에게 알림으로 안내됩니다.</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">적용하기</button>
        </div>
      </section>

      {/* 쪽지 발송 모달 */}
      <section className="modal" id="memberMessage" role="dialog" aria-modal="true" aria-labelledby="memberMessageTitle">
        <div className="modal-header">
          <div className="modal-title" id="memberMessageTitle">쪽지 발송</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="detailMsgRecipient">받는 회원</label>
              <div className="input-icon">
                <i className="ri-user-search-line" />
                <input
                  className="control"
                  id="detailMsgRecipient"
                  type="search"
                  placeholder="닉네임 또는 이메일로 검색"
                  defaultValue={DETAIL.nickname}
                />
              </div>
              <div className="field-help">{DETAIL.nickname} ({DETAIL.email})</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="detailMsgSubject">제목</label>
              <input className="control" id="detailMsgSubject" type="text" placeholder="쪽지 제목을 입력하세요" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="detailMsgBody">내용</label>
              <textarea
                className="control"
                id="detailMsgBody"
                rows={5}
                placeholder="쪽지 내용을 입력하세요"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">
            <i className="ri-mail-send-line" />
            보내기
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
