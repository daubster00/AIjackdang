# Story 5.7: 북마크 — 저장·해제·마이페이지 목록

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 글·질문·자료를 북마크하고 마이페이지에서 모아보기를,
so that 나중에 다시 찾을 콘텐츠를 저장·접근한다.

## Acceptance Criteria

1. 로그인 회원이 상세 페이지 북마크 버튼 클릭 시 `POST /api/v1/bookmarks` 낙관적 활성, 실패 시 롤백 + danger 토스트(UX-DR-U12).
2. 이미 북마크 상태에서 재클릭 시 `DELETE /api/v1/bookmarks/{id}` 해제.
3. 비회원 북마크 클릭 시 로그인 유도 모달 + 로그인 후 자동 저장(UX-DR-U1).
4. 회원 `/mypage`(북마크 탭) 또는 `/bookmarks` 진입 시 `GET /api/v1/users/me/bookmarks` 호출로 target_type별 필터(글/질문/자료) + 정렬 + 페이지네이션 SSR.
5. 북마크 비어있음 시 EmptyState + 탐색 버튼 표시.
6. 북마크 버튼에 `aria-label` · `aria-pressed` 적용(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — bookmarks (AC: #1, #2, #4) [NEW]
  - [ ] `apps/api/src/routes/v1/bookmarks.ts` 생성
  - [ ] `POST /api/v1/bookmarks`: body `createBookmarkInputSchema`(contracts), UNIQUE 충돌 시 409 ALREADY_BOOKMARKED(멱등 처리), 삽입 후 `bookmarkId` 반환
  - [ ] `DELETE /api/v1/bookmarks/:id`: 소유자 확인(403), 삭제
  - [ ] `GET /api/v1/users/me/bookmarks`: 인증 필요, `page`/`pageSize`/`targetType?` 쿼리 파라미터, 응답 `{ items: BookmarkWithContent[], meta }` — 각 item에 원본 콘텐츠 제목·날짜·링크 포함(JOIN 쿼리, N+1 금지)
  - [ ] `GET /api/v1/users/me/bookmarks/:targetId?targetType=` : 현재 북마크 여부·id 조회(상세 페이지 초기 상태용)
- [ ] Task 2: 프론트 — ReactionBar 북마크 API 연결 (AC: #1, #2, #3, #6) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/ReactionBar.tsx` + 나머지 5개 동일 구조 파일
  - [ ] 기존 `toggleBookmark()` → API 호출 래핑: `POST /api/v1/bookmarks` 또는 `DELETE /api/v1/bookmarks/{id}` 낙관적 호출
  - [ ] 비회원 클릭 시 로그인 유도 모달(redirectTo 포함 URL)
  - [ ] 실패 시 롤백 + danger 토스트
  - [ ] Props 추가: `bookmarkId?: string` (기존 북마크 id, 삭제 API에 필요), `initialBookmarked?: boolean`
  - [ ] `aria-label="북마크"` · `aria-pressed={bookmarked}` — 기존에 `aria-pressed` 없음, 추가 필요
- [ ] Task 3: 프론트 — /bookmarks 또는 /mypage 북마크 탭 SSR 연결 (AC: #4, #5) [UPDATE]
  - [ ] `apps/web/app/bookmarks/BookmarkList.tsx`의 `items` prop을 서버에서 fetch로 채움
  - [ ] `apps/web/app/bookmarks/page.tsx` 서버 컴포넌트에서 `GET /api/v1/users/me/bookmarks` 호출(인증 쿠키 포워딩)
  - [ ] 현재 `BookmarkList`가 `BoardKey` 기반 필터를 로컬로 처리 — `targetType`(post/question/resource)으로 매핑
  - [ ] 빈 경우 기존 EmptyState 컴포넌트 활성화(이미 있음)
  - [ ] `/mypage` 북마크 탭도 동일 데이터 연결(현재 목업 데이터 대체)
- [ ] Task 4: 검증 (AC: #1~6)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과

## Dev Notes

- **기존 ReactionBar 북마크 상태**: `toggleBookmark()` 로컬 state 토글만. API 연결 없음. `bookmarked`/`bookmarkCount` state 이미 있음. `aria-pressed` 없음 → 추가 필요.
- **기존 BookmarkList**: `BookmarkItem[]` props 받아서 렌더. `removeBookmark` 로컬 state 제거. 실제 API 연결 안 됨. `boardKey`/`board` 필드로 필터 처리 → API의 `targetType` 매핑 필요.
- **보존해야 할 것**: `BookmarkList` 내 boardFilter 칩, sort Select, Pagination, EmptyState, removeBtn 클릭 → `removeBookmark` 함수 구조 유지. 단 `removeBookmark` 내부에서 API `DELETE` 호출 추가.
- **targetType 매핑**: API `targetType: 'post'|'question'|'resource'` → `BookmarkItem.boardKey`로 변환. `post` → 게시판명은 `board` 값에서, `question` → "묻고답하기", `resource` → "실전자료".
- **좋아요 수 집계**: `bookmarks` 테이블에 `target_type`·`target_id`만 있음. JOIN으로 원본 제목·링크 추출. N+1 방지: `bookmarks` 조회 후 `post_ids`/`question_ids`/`resource_ids` 분류 → 각 테이블 `WHERE id = ANY(...)`.
- **북마크 페이지 라우트**: 현재 `apps/web/app/bookmarks/` 존재. `/mypage` 북마크 탭과 `/bookmarks` 두 곳 모두 연결.
- **인증**: `GET /api/v1/users/me/bookmarks` — httpOnly 쿠키 세션 필요. Next 서버 컴포넌트에서 `cookies()` 포워딩.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    bookmarks.ts      ← NEW
    index.ts          ← UPDATE
  web/app/
    bookmarks/page.tsx          ← UPDATE (서버 컴포넌트 fetch)
    bookmarks/BookmarkList.tsx  ← UPDATE (API 연결, removeBookmark → DELETE)
    mypage/page.tsx             ← UPDATE (북마크 탭 API 연결)
    vibe-coding/[slug]/ReactionBar.tsx  ← UPDATE (bookmark API 연결, aria-pressed)
    (나머지 5개 ReactionBar 동일)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7 AC]
- [Source: _bmad-output/project-context.md#통신 패턴 — 낙관적 업데이트]
- [Source: _bmad-output/project-context.md#UX / 에러 처리]
- [AR-2: N+1 금지 — ANY() 배치 조회]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
