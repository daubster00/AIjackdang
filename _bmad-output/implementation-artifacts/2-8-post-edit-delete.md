# Story 2.8: 게시글 수정 + 삭제 (soft-delete)

Status: ready-for-dev

## Story

As a 회원(글 작성자),
I want 내 글을 수정·삭제하기를,
so that 오류를 고치거나 불필요한 글을 직접 관리한다(FR-2.7·AR-7).

## Acceptance Criteria

1. 작성자가 [수정] 클릭 시 `/{category}/{board}/{slug}/edit` 이동. 기존 title·contentJson·tags 채움. board 읽기전용, SEO 입력 비노출.
2. [저장] 클릭 시 `PATCH /api/v1/posts/{id}`. service 트랜잭션: posts UPDATE + taggable 재계산(기존 taggable 삭제 후 재삽입). `summary` 재생성(`generateSummary`), `slug` 불변(NFR-8). 200 응답 후 상세 페이지로 리다이렉트 + 성공 토스트.
3. 작성자 아닌 사용자의 수정/삭제 API 직접 호출 시 403(`user_id` 비교).
4. [삭제] 클릭 시 확인 모달 → 승인 시 `DELETE /api/v1/posts/{id}`. service: `status='deleted'`·`deleted_at=NOW()` soft-delete(AR-7). 응답 200 후 게시판 목록으로 리다이렉트.
5. 삭제 확인 모달: 포커스 트랩·Esc 닫기·danger 버튼·배경 스크롤 잠금(UX-DR-U13).
6. `pnpm typecheck` 통과.

## Tasks / Subtasks

- [ ] Task 1: API `PATCH /api/v1/posts/{id}` 구현 (AC: #2, #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: PATCH `/:id` 라우트
  - [ ] 인증 미들웨어 필수
  - [ ] 요청 스키마: `updatePostSchema` (partial — title, contentJson, tags 선택)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `updatePost(id, input, userId)` 함수
    - posts 조회 → `user_id !== userId` 시 403 throw
    - `db.transaction()`:
      - `summary` 재생성: `generateSummary(input.contentJson)`
      - `slug` 필드 UPDATE 제외 (NFR-8 불변)
      - posts UPDATE: `title`, `contentJson`, `summary`, `updatedAt=NOW()`
      - taggable 재계산: `DELETE WHERE target_type='post' AND target_id=id` → 새 태그 INSERT
    - 반환: 수정된 post `{ id, slug, board, category }`

- [ ] Task 2: API `DELETE /api/v1/posts/{id}` 구현 (AC: #4, #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: DELETE `/:id` 라우트
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `deletePost(id, userId)` 함수
    - posts 조회 → 권한 검증 (403)
    - `UPDATE posts SET status='deleted', deleted_at=NOW() WHERE id={id}` (soft-delete)
    - 반환: 204 또는 `{ success: true }`

- [ ] Task 3: edit 페이지 컴포넌트 (AC: #1)
  - [ ] `apps/web/app/(content)/[category]/[board]/[slug]/edit/page.tsx` NEW 서버 컴포넌트
  - [ ] 서버 컴포넌트: 세션 확인 → 미인증 시 로그인 리다이렉트
  - [ ] API `GET /api/v1/posts/{slug}` 호출 → `isOwner` 확인 → false 시 403 또는 홈 리다이렉트
  - [ ] 클라이언트 컴포넌트 `PostEditForm.tsx`에 `post` 데이터 전달
  - [ ] `apps/web/app/(content)/[category]/[board]/[slug]/edit/PostEditForm.tsx` NEW (`'use client'`)
    - 제목 input: `defaultValue={post.title}`
    - `<Editor preset="full" value={post.contentJson} />` (2.5)
    - 태그 `<TagInput defaultValue={post.tags} />` (2.7)
    - board 표시: 읽기전용 `<span>{board.label}</span>`
    - [저장]: `PATCH /api/v1/posts/{post.id}` → 성공 → `router.push(\`/{category}/{board}/{slug}\`)` + 토스트
    - [취소]: `router.back()`

- [ ] Task 4: 상세 페이지 [수정]·[삭제] 버튼 연동 (AC: #1, #5)
  - [ ] 기존 상세 페이지에서 [수정] 버튼: `href={...\`/${category}/${board}/${slug}/edit\`}` Link로 교체
  - [ ] [삭제] 버튼: `'use client'` 컴포넌트 `DeleteButton.tsx` NEW
    - 클릭 → 확인 모달 open
    - 모달: 포커스 트랩, Esc 닫기, 배경 스크롤 잠금(`document.body.style.overflow='hidden'`)
    - [삭제 확인] danger 버튼 → `DELETE /api/v1/posts/{id}` → 성공 → `router.push(listUrl)` + 토스트

- [ ] Task 5: 삭제 확인 모달 접근성 (AC: #5)
  - [ ] 기존 `Modal` 컴포넌트(`components/ui/Modal`) 재사용 확인
  - [ ] `autoFocus` → [취소] 버튼 포커스(실수 삭제 방지)
  - [ ] `role="dialog"`, `aria-labelledby`, `aria-describedby`
  - [ ] Esc keydown 이벤트 → 모달 닫기
  - [ ] 열릴 때: `document.body.style.overflow = 'hidden'`, 닫힐 때: `''`

- [ ] Task 6: 기존 상세 페이지 [수정]·[삭제] 버튼 교체
  - [ ] `apps/web/app/vibe-coding/[slug]/page.tsx` UPDATE: `<button>수정</button>` → `<Link href={editUrl}>수정</Link>`, 삭제 → `<DeleteButton />`
  - [ ] 동일 패턴을 automation, monetize, lounge 상세 페이지에 적용

- [ ] Task 7: typecheck 통과 (AC: #6)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **AR-7 soft-delete**: `status='deleted'` + `deleted_at=NOW()`. 물리 삭제 금지. 목록 쿼리에서 `status != 'deleted'` 필터 필수. [Source: project-context.md#구조]
- **NFR-8 slug 불변**: PATCH 시 `slug` 컬럼 절대 업데이트 금지. 기존 URL 보호. [Source: epics.md#Story 2.8 AC]
- **트랜잭션**: `updatePost`의 taggable 재계산은 DELETE+INSERT가 원자적이어야 함. [Source: project-context.md#패키지 경계]
- **권한 검증**: API 서버에서 `post.user_id === userId` 비교. 클라이언트 `isOwner` 체크는 UX 편의일 뿐. [Source: project-context.md#보안]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
현재 상세 페이지 `apps/web/app/vibe-coding/[slug]/page.tsx`:
- `<footer className={styles.detailFooter}>` 내부:
  - `<Link href="/vibe-coding">목록으로</Link>` — 유지
  - `<div className={styles.ownerActions}>`: `<button>수정</button>`, `<button>삭제</button>` — **교체 대상**
- 수정: Link 컴포넌트로 교체 (`href="{category}/{board}/{slug}/edit"`)
- 삭제: `DeleteButton` 클라이언트 컴포넌트로 교체

현재 lounge/[slug]/page.tsx:
- 동일 패턴. `isOwner` 기반 버튼 노출은 API `isOwner` 필드 사용.
- 목업에서는 `!!user`(useMockAuth)로 모든 로그인 유저를 본인으로 처리 — **API isOwner로 교체**.

### taggable 재계산 패턴
```typescript
// db.transaction() 내부
await tx.delete(taggable).where(
  and(eq(taggable.target_type, 'post'), eq(taggable.target_id, postId))
);
// 새 태그 upsert + taggable INSERT (2.7 패턴 재사용)
```

### 모달 포커스 트랩 구현
기존 Modal 컴포넌트 확인 후:
- 없으면 `focus-trap-react` 또는 `@radix-ui/react-dialog` 사용 고려
- 있으면 재사용 (UX 계약 불변)
- 수동 구현: `useEffect`로 `focusable` 요소 수집 후 Tab/Shift+Tab 순환

### Project Structure Notes
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/edit/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/edit/PostEditForm.tsx`
- NEW: `apps/web/components/board/DeleteButton.tsx`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- Story 2.7 의존: TagInput, generateSummary, slugify(불변 확인)
- Story 2.5 의존: Editor 컴포넌트

### References
- [Source: epics.md#Story 2.8 AC]
- [Source: architecture.md#Data Architecture — soft-delete]
- [Source: project-context.md#구조 — soft-delete]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Interaction Primitives — 오버레이]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/edit/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/edit/PostEditForm.tsx`
- NEW: `apps/web/components/board/DeleteButton.tsx`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
