# Story 9.17: 공지 관리 (FR-10.7)

Status: ready-for-dev

## Story

As a 관리자(staff·super_admin),
I want 공지 게시글을 전용 뷰에서 작성·수정·고정·숨김·삭제하기를,
So that 사이트 공지를 일반 회원 게시글과 분리하여 전담 운영한다.

## Acceptance Criteria

1. 게시글 관리에서 `board='notice'` 필터 또는 `/posts/notices` 전용 뷰 → `board='notice'` 게시글만 표시.
2. 신규 공지 작성(제목·Tiptap full·태그·이미지) → `posts`(`board='notice'`, 작성자=관리자 연계) 생성·`/notice` 즉시 공개. 작성 권한 운영자 한정·일반 회원 공지 작성 불가(FR-10.7·15.1).
3. 상단 고정·메인/배너 토글 → 즉시+토스트(undo).
4. 공지 수정 → `posts` 갱신·토스트.
5. 공지 숨김/삭제 → 9.6 위험도별 확인 동일(숨김=저위험 즉시+토스트, 삭제=위험 모달+사유).

## Tasks / Subtasks

- [ ] Task 1: API 인가 — 공지 작성 권한 (AC: #2)
  - [ ] `apps/api/src/routes/posts/` UPDATE: `POST /api/v1/posts` 핸들러에서 `board='notice'` 일 때 요청자가 admin 세션인지 검사
  - [ ] 일반 회원이 `board='notice'`로 게시글 생성 시도 → 403 `FORBIDDEN` ("공지 게시판은 운영자만 작성 가능합니다.")
  - [ ] admin 세션에서 공지 생성 시 `author_id`를 `admin_users.id` 연계 OR `users`에 연계된 운영자 계정으로 처리 (ADR-0003 검토 후 결정)

- [ ] Task 2: API — 공지 목록·상세 (AC: #1)
  - [ ] `GET /api/v1/admin/posts?board=notice` 기존 게시글 관리 API 재사용 (board 파라미터로 필터)
  - [ ] 또는 `GET /api/v1/admin/notices` 별도 라우트 신규 — 기존 `/posts` API에 board 필터 지원 여부 확인 후 결정
  - [ ] `packages/contracts/src/admin/notices.ts` NEW(필요 시) 또는 기존 posts 계약 재사용

- [ ] Task 3: API — 공지 플래그 토글 (AC: #3)
  - [ ] `PATCH /api/v1/admin/posts/:id/flags` 기존 API 재사용 (9.6에서 구현됨 여부 확인)
  - [ ] 없으면 NEW: `{ pinned?: boolean, mainBanner?: boolean }` → posts.pinned / posts.main_banner 업데이트
  - [ ] 트랜잭션: `pinned=true`이면 같은 board의 기존 pinned 글 해제(단일 고정 정책 여부 기획 확인)

- [ ] Task 4: 프런트 — 공지 전용 뷰 (AC: #1~#5)
  - [ ] 방법 A: 기존 `/posts/[board]` 동적 라우트에 `board='notices'` 추가 → `apps/admin/lib/boards.ts` UPDATE: notices 보드 항목 추가
  - [ ] 방법 B: 기존 `/posts/page.tsx`의 FLAGS 속성 필터 "공지글만" 클릭 시 자동 필터 → 별도 페이지 없음
  - [ ] **권장**: 방법 A — `/posts/notices` URL로 접근 가능한 전용 뷰 (AdminShell 서브메뉴에 "공지관리" 추가)
  - [ ] `apps/admin/lib/boards.ts` UPDATE: `{ slug: 'notices', label: '공지', badge: 'badge-red' }` 추가
  - [ ] AdminShell NAV_GROUPS UPDATE: "게시글 관리" 하위에 "공지" 서브메뉴 추가(key: 'notices', href: '/posts/notices')

- [ ] Task 5: 프런트 — 공지 작성 (AC: #2)
  - [ ] `apps/admin/app/posts/notices/new/page.tsx` NEW 또는 기존 `[board]/new/page.tsx` 활용
  - [ ] `PostForm` 컴포넌트 UPDATE: `mode="new"` + `board="notices"` prop 전달 시 동작
  - [ ] 현재 `PostForm`의 textarea 에디터 → Tiptap full 에디터 교체(또는 연결) 지시
  - [ ] 발행 → `POST /api/v1/posts` `{ board: 'notice', title, content, tags }` 어드민 세션 쿠키로 전송
  - [ ] 성공 시 `/posts/notices` 목록으로 redirect + 토스트

- [ ] Task 6: 프런트 — 공지 수정·숨김·삭제 (AC: #3~#5)
  - [ ] `apps/admin/app/posts/notices/[id]/edit/page.tsx` NEW 또는 기존 `[board]/[id]/edit` 활용
  - [ ] 수정 → `PATCH /api/v1/admin/posts/:id` → 토스트
  - [ ] 상단고정 토글 → `PATCH /api/v1/admin/posts/:id/flags` `{ pinned: true }` → 즉시+토스트(undo)
  - [ ] 메인/배너 토글 → `{ mainBanner: true }` → 즉시+토스트(undo)
  - [ ] 숨김 → 즉시+토스트(undo) [저위험, 9.6 동일 패턴]
  - [ ] 삭제 → 모달+사유 필수 [위험, 9.6 동일 패턴]

## Dev Notes

### 의존성
- **9.6 완료 필수**: 게시글 관리 API(`/api/v1/admin/posts/:id`, `PATCH .../flags`, `PATCH .../hide`, `DELETE ...`), 위험도별 확인 패턴
- **9.3 완료**: AdminShell, adminGuard

### 공지 board 값
- DB: `board = 'notice'` (단수)
- URL slug: `notices` (복수, 관리 뷰용)
- `findBoard('notices')` 에서 `board='notice'` 쿼리로 매핑

### 작성자 연계 (ADR-0003 기반)
어드민 세션(`admin_users`)과 유저 테이블(`users`)은 분리됨.
공지 게시글의 `posts.user_id` 처리 방안:
1. **운영자 시스템 계정 방법**: `admin_users`에 연결된 `users` 레코드(별도 시스템 계정) 존재 시 그 id 사용
2. **admin_id 컬럼 방법**: `posts`에 `admin_author_id`(nullable) 컬럼 추가, `user_id=null`
3. **권장**: 아키텍처 ADR-0003 재확인 후 결정. 기존 공지 게시글이 있다면 기존 방법 따르기.

### 공지 일반 회원 작성 차단 (FR-10.7, 15.1)
```ts
// apps/api/src/routes/posts/handler.ts
if (body.board === 'notice') {
  const isAdmin = await validateAdminSession(request);
  if (!isAdmin) throw { statusCode: 403, code: 'FORBIDDEN', message: '공지 게시판은 운영자만 작성 가능합니다.' };
}
```

### Tiptap full 에디터
현재 `PostForm`의 textarea는 플레인 텍스트. 공지 작성에는 Tiptap full 에디터 필요.
- `apps/web` 의 공유 에디터(`components/board/PostWriteForm.tsx`)와 달리 어드민용은 별도 구성
- `@tiptap/react` `@tiptap/starter-kit` `@tiptap/extension-image` 는 이미 설치된 것으로 가정 (없으면 설치)
- 어드민 에디터: `apps/admin/components/editor/NoticeEditor.tsx` NEW

### 위험도별 확인 (9.6 동일)
| 액션 | 위험도 | 패턴 |
|---|---|---|
| 공지 작성 | 저 | 즉시+토스트 |
| 상단 고정 토글 | 저 | 즉시+토스트(undo) |
| 메인/배너 토글 | 저 | 즉시+토스트(undo) |
| 수정 저장 | 저 | 즉시+토스트 |
| 숨김 | 저(undo 가능) | 즉시+토스트(undo) |
| 삭제 | 위험 | 모달+사유 필수 |

### Project Structure Notes
- NEW: `apps/admin/app/posts/notices/new/page.tsx` (또는 [board] 라우트 재사용), `apps/admin/components/editor/NoticeEditor.tsx`, `packages/contracts/src/admin/notices.ts`(필요 시)
- UPDATE: `apps/admin/lib/boards.ts`, `apps/admin/components/layout/AdminShell.tsx`(notices 서브메뉴), `apps/api/src/routes/posts/` (board='notice' 인가 추가)

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L3037-3055] — AC 원문
- [Source: apps/admin/app/posts/page.tsx] — 현재 게시글 관리 더미 FLAGS 필터("공지글만" 이미 있음)
- [Source: apps/admin/app/posts/_components/PostForm.tsx] — 현재 PostForm 구조(textarea 에디터)
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md] — admin_users 분리 정책
- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6] — 위험도별 확인 패턴 원본

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
