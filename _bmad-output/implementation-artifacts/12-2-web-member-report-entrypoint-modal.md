# Story 12.2: 유저 웹 — 회원 프로필 신고 진입점 + 회원 신고 모달

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 작성자 메뉴·공개 프로필에서 부적절한 회원을 신고하기를,
so that 개별 글이 아니라 회원 자체(프로필·사칭·반복 행위)의 문제를 운영진에 알릴 수 있다.

## Acceptance Criteria

1. `apps/web/components/ui/AuthorName/AuthorName.tsx`의 클릭 메뉴(현재 쪽지 → 팔로우 → 차단 → 계정 바로가기 4항목)에 [신고하기] 항목을 추가한다. 삽입 위치는 "차단하기"와 "계정 바로가기" 사이. `isSelf`(=`user.nickname === name || user.id === authorId`)가 참이면 렌더하지 않는다. `authorId` prop이 `undefined`이면 "신고 대상 정보를 찾을 수 없습니다." warning 토스트 후 중단(쪽지/팔로우 누락 처리 패턴 일관성).

2. [신고하기] 클릭 시: 비회원(`user === null`)이면 `useGating().requireAuth('report')` 호출 → 로그인 유도 모달(UX-DR-U1)이 열리고 회원 신고 모달은 열리지 않는다. 로그인 회원(타인)이면 `MemberReportModal`을 열고 `targetUserId=authorId`, `targetNickname=name`을 전달한다.

3. `MemberReportModal` 컴포넌트를 `apps/web/features/report/MemberReportModal.tsx`에 신규 생성한다. 사유 세트(`MEMBER_REPORT_REASONS`): `profile`(프로필 부적절: 닉네임/소개/아바타) · `impersonation`(사칭) · `spam`(도배/광고) · `abuse`(욕설/괴롭힘) · `other`(기타). 사유 선택 UI는 `<fieldset>` + `<input type="radio">` (네이티브 `<select>` 절대 금지). `other` 선택 시 `detail` textarea를 표시하고, 미입력 후 제출 시 "기타 사유를 입력해주세요." 인라인 에러.

4. 신고 제출: `POST /api/v1/reports { targetType: 'user', targetId: targetUserId, reasonCode, detail? }` (상대경로 `/api/v1`, `credentials: 'include'`). 201 응답 → 성공 토스트("신고가 접수되었습니다.")(화면 정중앙) + 모달 닫기. 409 응답 → "이미 신고한 회원입니다." 인라인 에러(토스트 아님). 기타 오류 → "신고 제출에 실패했습니다." 인라인 에러.

5. `MemberReportModal`은 네이티브 `<dialog>` 요소로 구현한다. `useRef<HTMLDialogElement>` + `showModal()`/`close()` 방식(기존 `vibe-coding/[slug]/ReportModal.tsx` 패턴). `dialog` 요소에 `aria-labelledby="member-report-modal-title"`, 제목 `<h3 id="member-report-modal-title">신고하기</h3>` 필수. `dialog` `close` 이벤트 리스너 → `onClose()` 연계(Esc 자동 지원). 포커스 트랩은 native `<dialog>` `showModal()`이 제공 (UX-DR-U13).

6. 공개 프로필 페이지(`apps/web/app/u/[nickname]/ProfileInteraction.tsx`)에 [신고하기] 버튼을 추가한다. `isSelf`(`user.id === profileId`)가 참이면 미노출. 비회원은 클릭 시 `requireAuth('report')` 게이팅. 로그인 회원은 `MemberReportModal`을 열고 `targetUserId=profileId`, `targetNickname=targetNickname` 전달.

## Tasks / Subtasks

- [ ] Task 1: MemberReportModal 컴포넌트 + CSS 신규 생성 (AC: #3, #4, #5) [NEW]
  - [ ] `apps/web/features/report/` 디렉터리 생성
  - [ ] `apps/web/features/report/MemberReportModal.tsx` 생성
    - [ ] `"use client"` 선언
    - [ ] `import { useEffect, useRef, useState } from "react"` + `useToast` from `@/components/ui/Toast/Toast` + `Icon` from `@/components/ui`
    - [ ] Props 타입: `{ isOpen: boolean; onClose: () => void; targetUserId: string; targetNickname: string }`
    - [ ] `MEMBER_REPORT_REASONS` 상수: `profile`·`impersonation`·`spam`·`abuse`·`other` (12.1 계약의 `userReportReasonCodeSchema` 값과 동일)
    - [ ] state: `selected: ReasonCode | ""`, `detail: string`, `submitting: boolean`, `error: string | null`
    - [ ] `useEffect([isOpen])`: `isOpen` 전환 시 상태 초기화(`selected/detail/error` 리셋) + `showModal()`/`close()` 호출
    - [ ] `useEffect`: `dialog` `close` 이벤트 → `onClose()` (Esc 닫기 연계)
    - [ ] `handleSubmit()`: 유효성 검사(`!selected` → early return; `selected==='other' && !detail.trim()` → 인라인 에러) → `fetch('/api/v1/reports', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ targetType:'user', targetId:targetUserId, reasonCode:selected, detail: selected==='other' ? detail.trim() : undefined }) })` → 201: `toast({ tone:'success', title:'신고가 접수되었습니다.' })` + `onClose()` → 409: `setError('이미 신고한 회원입니다.')` → 기타: `setError('신고 제출에 실패했습니다.')`
    - [ ] JSX: `<dialog ref={dialogRef} aria-labelledby="member-report-modal-title">` → header(`id=member-report-modal-title`·닫기 버튼 `aria-label="닫기"`) → 설명 `<p>` → `<fieldset><legend className="sr-only">신고 사유</legend>{MEMBER_REPORT_REASONS.map(r => <label><input type="radio" .../><span>{r.label}</span></label>)}</fieldset>` → `{selected==='other' && <textarea .../>}` → `{error && <p role="alert">}` → footer(취소·신고하기 버튼)
    - [ ] 제출 버튼 `disabled={!selected || submitting}`
  - [ ] `apps/web/features/report/MemberReportModal.module.css` 생성
    - [ ] 모든 색·여백·radius는 `var(--...)` 토큰 참조 (하드코딩 금지)
    - [ ] dialog backdrop, modal box, header, fieldset, radio label, textarea, footer 스타일
    - [ ] `input[type=radio]` 선택 상태 강조: `var(--color-primary)` 계열 토큰

- [ ] Task 2: AuthorName 메뉴에 [신고하기] 항목 추가 (AC: #1, #2) [UPDATE]
  - [ ] `apps/web/components/ui/AuthorName/AuthorName.tsx` 수정
  - [ ] import 추가: `import { useGating } from "@/hooks/useGating"` + `import { MemberReportModal } from "@/features/report/MemberReportModal"`
  - [ ] `const { requireAuth } = useGating()` 추가 (기존 `useAuth`·`useToast` 유지)
  - [ ] `const [reportOpen, setReportOpen] = useState(false)` 추가
  - [ ] 메뉴 항목 삽입 (차단하기 `<button>` 바로 아래, 계정 바로가기 `<Link>` 바로 위):
    ```tsx
    {!isSelf && (
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={() => {
          setMenuOpen(false);
          if (!authorId) {
            toast({ tone: "warning", title: "신고 대상 정보를 찾을 수 없습니다." });
            return;
          }
          if (!requireAuth("report")) return;
          setReportOpen(true);
        }}
      >
        <Icon name="spam-2-line" />
        신고하기
      </button>
    )}
    ```
  - [ ] return 문 맨 끝(MessageModal 하단)에 MemberReportModal 마운트:
    ```tsx
    <MemberReportModal
      isOpen={reportOpen}
      onClose={() => setReportOpen(false)}
      targetUserId={authorId ?? ""}
      targetNickname={name}
    />
    ```
  - [ ] 기존 메뉴 항목(쪽지·팔로우·차단·계정 바로가기)·isSelf 로직·CSS 회귀 없음 확인

- [ ] Task 3: ProfileInteraction에 [신고하기] 버튼 추가 (AC: #6, #2) [UPDATE]
  - [ ] `apps/web/app/u/[nickname]/ProfileInteraction.tsx` 수정
  - [ ] import 추가: `import { useGating } from "@/hooks/useGating"` + `import { MemberReportModal } from "@/features/report/MemberReportModal"`
  - [ ] `const { requireAuth } = useGating()` + `const [reportOpen, setReportOpen] = useState(false)` 추가
  - [ ] `isSelf`가 `false`인 분기(현재 `<FollowButton .../>`)에 [신고하기] 버튼 병렬 추가:
    ```tsx
    {!isSelf && (
      <>
        <FollowButton ... />
        <button
          type="button"
          className={styles.reportBtn}
          onClick={() => {
            if (!requireAuth("report")) return;
            setReportOpen(true);
          }}
        >
          신고하기
        </button>
        <MemberReportModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetUserId={profileId}
          targetNickname={targetNickname}
        />
      </>
    )}
    ```
  - [ ] `apps/web/app/u/[nickname]/profile.module.css`에 `.reportBtn` 스타일 추가:
    - secondary/ghost 버튼 스타일 (`var(--color-border)` 테두리·`var(--color-text-sub)` 색·hover 시 `var(--color-danger-soft)` 배경)
    - 기존 `.followBtn`, `.editBtn` 레이아웃과 시각적 일관성 유지
  - [ ] 기존 팔로워수·팔로잉수 표시·편집 링크·FollowButton 동작 회귀 없음

- [ ] Task 4: 검증 (AC: #1~#6)
  - [ ] `pnpm typecheck` (web) 통과
  - [ ] 로그인 상태로 타인 글 작성자명 클릭 → 메뉴에 [신고하기] 항목 노출 확인
  - [ ] 본인 글 작성자명 클릭 → [신고하기] 미노출 확인 (isSelf)
  - [ ] 비회원이 [신고하기] 클릭 → 로그인 유도 모달만 열림 (회원 신고 모달 미오픈) 확인
  - [ ] 신고 모달에서 사유 선택 UI = 라디오 `<input>` (네이티브 select 아님 직접 DOM 확인)
  - [ ] `other` 선택 → textarea 출현 → 미입력 제출 → "기타 사유를 입력해주세요." 인라인 에러 확인
  - [ ] 신고 제출 (12.1 배포 후) → 201 성공 토스트 화면 정중앙 표시 + 모달 닫힘 확인
  - [ ] 동일 회원 재신고 → 409 → "이미 신고한 회원입니다." 인라인 에러 (토스트 아님) 확인
  - [ ] Esc 키 → 모달 닫기 확인
  - [ ] `/u/{nickname}` 공개 프로필에서 타인 프로필 → [신고하기] 버튼 노출, 본인 프로필 → 미노출 확인
  - [ ] 브라우저로 모달 렌더·접근성(aria-labelledby·포커스 트랩) 직접 확인

## Dev Notes

### 선행 의존
- **Story 12.1 머지 필수.** `report_target_type='user'` enum 추가·`userReportReasonCodeSchema`·`POST /api/v1/reports` user 분기가 없으면 서버가 400 반환. 12.1 배포 전 12.2는 UI 구현만 진행하고 실 제출 테스트는 12.1 이후 수행.
- 12.1에서 확정된 reasonCode 열거값: `profile | impersonation | spam | abuse | other` — `MEMBER_REPORT_REASONS` 상수와 1:1 일치 유지.

### AuthorName 현재 상태 (완독 확인)
- **실제 경로**: `apps/web/components/ui/AuthorName/AuthorName.tsx` (폴더형 컴포넌트)
- 기존 메뉴 항목 4개: 쪽지 보내기 → 팔로우 → 차단하기 → 계정 바로가기
- `isSelf` 로직: `!!user && ((!!user.nickname && user.nickname === name) || (!!authorId && user.id === authorId))` — 닉네임·userId 이중 체크. 신고도 동일 조건으로 미렌더.
- `authorId` prop: 이미 존재하며 쪽지/팔로우 API 호출에 사용 중. **신고도 동일 prop 재사용**. authorId가 없는 호출 경로에서는 토스트 후 중단 (쪽지/팔로우 누락 패턴과 동일 한계 — 추가 처리 불필요).
- `useGating`이 현재 미임포트 — Task 2에서 최초 추가.
- 기존 `window.confirm` (차단 흐름)·`blocking` 상태 건드리지 않음 — UI 계약 불변.
- `MemberReportModal`은 `<MessageModal>` 마운트 직후에 배치 (return문 끝, portal 외부).

### 공개 프로필 현재 상태 (완독 확인)
- **실제 라우트 파라미터**: `[nickname]` (epics.md가 `[id]`로 표기했으나 **실제 코드는 `[nickname]`**). 구현은 `apps/web/app/u/[nickname]/` 기준.
- `page.tsx`: 서버 컴포넌트. API에서 `profile.id`(UUID) 조회 → `isOwner = meUser.id === profile.id` 서버에서 판단.
- `ProfileInteraction.tsx`: 클라이언트 컴포넌트. `profileId`(UUID)·`targetNickname` props 수신. 내부에서 `isSelf = !!user && user.id === profileId` 재판단 (클라이언트 auth 기준).
- [신고하기] 버튼: `isSelf`가 false인 분기(현재 `<FollowButton>`)에 나란히 추가. `profileId`를 `targetUserId`로 전달.
- `profile.module.css`에 `.reportBtn` 스타일 추가 필요 (기존 `.followBtn`·`.editBtn` 토큰 참고).

### MemberReportModal 설계 (콘텐츠 ReportModal 패턴 기반)
- `apps/web/app/vibe-coding/[slug]/ReportModal.tsx` 완독 → 동일 구조 적용:
  - Native `<dialog>` + `showModal()`/`close()` (포커스 트랩 자동 제공)
  - `<fieldset>` + `<input type="radio">` (네이티브 select 절대 금지)
  - `dialog.addEventListener("close", onClose)` → Esc 자동 지원
  - `isOpen` 변경 시 상태 초기화(selected/detail/error 리셋) 필수
- **콘텐츠 ReportModal 7벌과 독립**: 사유 세트·targetType 다름 + 게시판별 CSS 의존 없음 → 단일 `features/report/` 컴포넌트로 분리. 공유 추상화 불필요.
- 다이얼로그 헤더에 `targetNickname` 표시 권장: `"${targetNickname} 님 신고"` 또는 부제목으로 사용 (콘텍스트 명확화).

### 배치 위치 결정 근거
- **NEW**: `apps/web/features/report/MemberReportModal.tsx`
  - `apps/web/features/`는 도메인 기능 단위 (messages · inquiry · notification · editor · gamification). `report` 서브디렉터리 신규 생성.
  - `apps/web/components/ui/`에 두지 않는 이유: `components/ui/`는 도메인 비종속 원자 컴포넌트. 회원 신고는 API 호출·사유 enum·비즈니스 게이팅 포함 → `features/` 적합.
- 콘텐츠 신고 `ReportModal`(게시판별 7벌)은 수정하지 않음. 회원 신고 진입점은 독립.

### 토스트·에러 처리 규칙
- 성공 토스트: `toast({ tone: "success", title: "신고가 접수되었습니다." })` — `useToast` hook 사용 (화면 정중앙, 우측 하단 금지, 메모 toast-notifications-center)
- 409 중복 신고: **인라인 에러** `setError("이미 신고한 회원입니다.")` — 토스트 아님. 폼 귀속 오류는 인라인 원칙 (project-context §UX/에러처리).
- 기타 서버 오류: 인라인 에러 `setError("신고 제출에 실패했습니다.")`
- 에러 표시 요소: `<p role="alert" className={styles.errorMsg}>` — 색만으로 상태 전달 금지(아이콘 또는 텍스트 동반).

### fetch 패턴
- 상대경로 `/api/v1/reports` (Next rewrite → API 서버 내부 경유)
- `credentials: 'include'` 반드시 포함 (댓글 fetch 누락 이력, 메모 revision-batch3)
- 요청 바디: `{ targetType: 'user', targetId: targetUserId, reasonCode: selected, detail: selected === 'other' ? detail.trim() : undefined }`

### authorId 배선 주의 (메모 message-follow-authorid-plumbing)
- AuthorName에 `authorId`가 흘러와야 신고 버튼이 의미를 가짐. `authorId` 없는 호출 경로(일부 게시판 목록·댓글)에서는 쪽지/팔로우와 동일하게 신고도 "정보 없음" 토스트+중단.
- 신규 authorId 배선이 필요한 파일은 이 스토리 범위가 아님 (기존 쪽지/팔로우 데이터 파이프라인이 이미 authorId를 흘리는 경로에서만 신고 활성화).

### Project Structure Notes

- NEW: `apps/web/features/report/MemberReportModal.tsx` (도메인 기능 컴포넌트)
- NEW: `apps/web/features/report/MemberReportModal.module.css`
- UPDATE: `apps/web/components/ui/AuthorName/AuthorName.tsx` (메뉴 항목 추가·useGating·reportOpen 상태)
- UPDATE: `apps/web/app/u/[nickname]/ProfileInteraction.tsx` (신고 버튼·MemberReportModal 마운트)
- UPDATE: `apps/web/app/u/[nickname]/profile.module.css` (`.reportBtn` 스타일 추가)
- 콘텐츠 ReportModal 7벌(`vibe-coding/[slug]`·`monetize/[slug]`·`automation/[slug]`·`lounge/*/[slug]`·`resources/[slug]`) 수정하지 않음

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2 AC]
- [Source: _bmad-output/implementation-artifacts/12-1-user-report-target-schema-contracts-api.md] — AC#3 user 신고 API 계약 (targetType·reasonCode·400 SELF_REPORT·409 ALREADY_REPORTED)
- [Source: apps/web/app/vibe-coding/[slug]/ReportModal.tsx] — `<dialog>` native·radio fieldset·close 이벤트·409·toast 기존 패턴 (완독)
- [Source: apps/web/components/ui/AuthorName/AuthorName.tsx] — 기존 메뉴 4항목·isSelf 로직·authorId prop·useAuth 현황 (완독)
- [Source: apps/web/app/u/[nickname]/page.tsx] — SSR 서버 컴포넌트·profileId·isOwner·ProfileInteraction props 구조 (완독). 실제 라우트 파라미터: `[nickname]` (epics.md의 `[id]` 표기와 불일치 — 코드 우선)
- [Source: apps/web/app/u/[nickname]/ProfileInteraction.tsx] — 클라이언트 인터랙션 현황: FollowButton·편집 링크·isSelf 클라이언트 재판단 (완독)
- [Source: apps/web/contexts/GatingContext.tsx] — `requireAuth(action) → boolean`, 비회원 로그인 유도 모달 전역 마운트 패턴
- [Source: apps/web/hooks/useGating.ts] — `useGating()` 훅 구조
- [UX-DR-U1: 비회원 행동 게이팅 — 로그인 유도 모달, 차단 화면 아님]
- [UX-DR-U13: 모달 접근성 — 포커스 트랩·Esc·aria-labelledby]
- [AR-6: report 다형 모델]
- [메모: select-must-be-design-system-dropdown — 네이티브 select 절대 금지]
- [메모: toast-notifications-center — 토스트는 화면 정중앙]
- [메모: message-follow-authorid-plumbing — authorId 없으면 관련 기능 비활성]
- [메모: verify-ui-by-opening-page — 검증 시 브라우저 직접 확인 필수]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
