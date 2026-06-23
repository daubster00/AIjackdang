# Story 2.7: 게시글 작성 폼 + API (임시저장)

Status: ready-for-dev

## Story

As a 회원,
I want 에디터로 게시글을 작성하고 임시저장·등록하기를,
so that 내 인사이트를 공유하고 필요 시 작업을 이어갈 수 있다(FR-2.4·FR-2.5·UX-DR-U16).

## Acceptance Criteria

1. 비회원이 [글쓰기] 클릭 시 로그인 유도 모달 표시 → 로그인 후 `redirectTo`로 write 페이지 복귀.
2. 회원이 write 페이지 진입 시 제목 입력·`full` 에디터·태그(자유+자동완성)·[임시저장]·[등록]·[취소] 구성. board는 진입 경로로 자동 지정(선택 UI 미노출), SEO 입력 비노출(FR-2.4·UX-DR-U16).
3. [등록] 클릭 시 `POST /api/v1/posts` 호출. API service: `db.transaction()`으로 posts INSERT + taggable INSERT 원자 처리. `slug`=`slugify(title)` + 중복 시 `-{shortid}`. `summary`=`generateSummary(contentJson)` 자동 저장(FR-11.3). 201 응답 후 상세 페이지로 리다이렉트.
4. [임시저장] 클릭 시 `status='draft'` 저장·성공 토스트. 재편집 시 `?draftId=` 쿼리로 복원. 목록에서 미노출(`status='published'`만 목록 노출).
5. 제목/본문 미입력 시 [등록] 클릭 → 인라인 오류 표시, API 미호출. blur 개별 + submit 전체 검증.
6. 비인증 `POST /api/v1/posts` 직접 호출 시 API 401 반환(FR-1.8).
7. 태그 입력 시 기존 태그 `pg_bigm` 유사도 추천 최대 5개 드롭다운, 최대 10개 태그 허용.
8. `packages/utilities`의 `slugify` 함수가 한글+영문+URL-safe 처리 + 중복 shortid 추가.

## Tasks / Subtasks

- [ ] Task 1: packages/utilities slugify 함수 (AC: #8)
  - [ ] `packages/utilities/src/slugify.ts` 확인(기존 있으면 UPDATE, 없으면 NEW)
  - [ ] `slugify(text: string): string` — 한글 로마나이저(예: `korean-romanize` 또는 `hangul-js`) + 소문자 + 특수문자 제거 + 공백→하이픈
  - [ ] `generateUniqueSlug(baseSlug: string, existsCheck: (slug: string) => Promise<boolean>): Promise<string>` — 중복 시 `-{nanoid(6)}` suffix
  - [ ] `packages/utilities/src/index.ts` re-export

- [ ] Task 2: API `POST /api/v1/posts` 구현 (AC: #3, #6)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: POST `/api/v1/posts` 라우트 추가
  - [ ] 인증 미들웨어: `preHandler: [authMiddleware]` — 미인증 시 401
  - [ ] 요청 스키마: `createPostSchema` (`board`, `title`, `contentJson`, `tags[]`, `status?`)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `createPost(input, userId)` 함수
    - `db.transaction()` 내부:
      - `slug` 생성: `slugify(title)` → DB uniqueness 체크 → 중복 시 `-{nanoid(6)}`
      - `summary` = `generateSummary(contentJson)` (server-side, lib/seo에서 import 또는 utilities로 이동)
      - `posts` INSERT
      - `tags` upsert (name 중복 시 기존 tag_id 사용)
      - `taggable` INSERT 배치
    - 반환: 생성된 post `{ id, slug, board, category }`
  - [ ] 응답 201: `{ id, slug, board }`

- [ ] Task 3: API `GET /api/v1/tags?q=` 태그 자동완성 (AC: #7)
  - [ ] `apps/api/src/routes/v1/tags/routes.ts` NEW
  - [ ] `GET /api/v1/tags?q={query}` — `WHERE name LIKE '%{q}%'` (pg_bigm 활성 시 `bigm_similarity` 활용) LIMIT 5
  - [ ] 응답: `{ items: { id, name, slug }[] }`
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE

- [ ] Task 4: API `POST /api/v1/posts` 임시저장 (AC: #4)
  - [ ] `createPost` service: `status` 파라미터 지원. `draft` 시 tags upsert 스킵 가능(또는 포함)
  - [ ] `GET /api/v1/posts/{id}?draft=true` 또는 별도 `GET /api/v1/posts/drafts/{id}` — 본인 draft 복원용
  - [ ] `PATCH /api/v1/posts/{id}` 라우트(2.8 선구현): `status='draft'` 재저장 지원

- [ ] Task 5: write 페이지 클라이언트 폼 컴포넌트 (AC: #2, #5)
  - [ ] **기존 `apps/web/components/board/PostWriteForm.tsx` 완독 필수** (현재 구현 파악)
  - [ ] 현재 PostWriteForm은 `PostWriteFormConfig`(titleLabel, bodyPlaceholder, cancelHref, submitAlert 등) prop을 받음. `submitAlert: "등록 기능은 아직 개발 중입니다."` → 실 API 연동으로 교체
  - [ ] `'use client'` 컴포넌트
  - [ ] 제목: `<input>` + blur 시 검증
  - [ ] 본문: `<Editor preset="full" onChange={...} />` (2.5 구현)
  - [ ] 태그: `TagInput` 컴포넌트 (자유 입력 + API 자동완성 드롭다운)
  - [ ] [등록]: `fetch POST /api/v1/posts` → 201 → `router.push(\`/{category}/{board}/{slug}\`)`
  - [ ] [임시저장]: `fetch POST /api/v1/posts` with `status:'draft'` → toast

- [ ] Task 6: TagInput 컴포넌트 (AC: #7)
  - [ ] `apps/web/components/ui/TagInput/TagInput.tsx` NEW (`'use client'`)
  - [ ] 입력 중 debounce 300ms → `GET /api/v1/tags?q=` → 드롭다운 최대 5개
  - [ ] 방향키+Enter 선택, Backspace 마지막 태그 삭제
  - [ ] 최대 10개 초과 시 입력 비활성

- [ ] Task 7: 비회원 게이팅 (AC: #1)
  - [ ] write 페이지 서버 컴포넌트: 인증 세션 없으면 `redirect(/login?redirectTo=/[category]/[board]/write)`
  - [ ] 또는 클라이언트에서 세션 체크 후 로그인 유도 모달

- [ ] Task 8: typecheck + lint 확인
  - [ ] `pnpm typecheck && pnpm lint`

## Dev Notes

### 아키텍처 패턴
- **트랜잭션**: `db.transaction()` 필수 — posts INSERT + taggable INSERT 원자. route handler 직접 트랜잭션 금지, service 레이어에서만. [Source: project-context.md#패키지 경계]
- **slug 유틸**: `packages/utilities`의 단일 `slugify` 사용. API 라우트에서 직접 구현 금지. [Source: project-context.md#응답 & 데이터 포맷]
- **generateSummary**: 서버 사이드에서 호출 (API service). 2.2에서 `apps/web/lib/seo/generate-summary.ts`로 구현됐으나, API(`apps/api`)에서도 필요하므로 `packages/utilities`로 이동하거나 API에 별도 구현. **web lib을 api에서 직접 import 금지** (패키지 경계). → `packages/utilities/src/generate-summary.ts`로 이동 권장.
- **인증 권위**: API 서버가 최종 통제. `POST /api/v1/posts`에서 세션 검증 후 401 반환. [Source: project-context.md#보안]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
현재 `apps/web/components/board/PostWriteForm.tsx` (구현 상태 직접 확인 필수):
- `PostWriteFormConfig` 인터페이스: `{ titleLabel, titlePlaceholder, bodyLabel, bodyPlaceholder, tagPlaceholder, suggestedTags, dropzoneText, cancelHref, submitLabel, submitAlert }` — `submitAlert`로 mock 처리 중
- `'use client'` 여부, 에디터 구현 방식(textarea? 기존 Tiptap?) 확인
- **보존할 것**: `PostWriteFormConfig` 인터페이스(하위 호환), 레이아웃 구조, CSS 클래스
- **바꾸는 것**: `submitAlert` → 실 API 호출, textarea → `<Editor preset="full" />` (2.5에서 준비됨), 태그 입력 → `<TagInput />`

write 페이지들의 `config.cancelHref` 패턴:
- `/vibe-coding/write` → `cancelHref: "/vibe-coding"` — board URL로 복귀

### generateSummary 위치 결정
`generateSummary`는 클라이언트(web)·서버(api) 양쪽에서 필요:
- `apps/web/lib/seo/generate-summary.ts` (Story 2.2, 클라이언트용)
- `apps/api` 서버에서도 동일 로직 필요
- **권장**: `packages/utilities/src/generate-summary.ts`로 단일화하고 web lib은 utilities에서 re-export

### 태그 upsert 패턴 (Drizzle)
```typescript
// 태그 이름 → 존재 확인 → 없으면 INSERT → tag_id 반환
const tagIds = await Promise.all(tags.map(async (name) => {
  const slug = slugify(name);
  const existing = await db.select().from(tagsTable).where(eq(tagsTable.slug, slug)).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db.insert(tagsTable).values({ name, slug }).returning({ id: tagsTable.id });
  return created.id;
}));
// taggable INSERT 배치
await db.insert(taggableTable).values(tagIds.map(tagId => ({ target_type: 'post', target_id: postId, tag_id: tagId })));
```

### Project Structure Notes
- UPDATE: `apps/web/components/board/PostWriteForm.tsx`
- NEW: `apps/web/components/ui/TagInput/TagInput.tsx`
- NEW: `apps/web/components/ui/TagInput/TagInput.module.css`
- NEW: `apps/web/components/ui/TagInput/index.ts`
- UPDATE: `apps/web/components/ui/index.ts` (TagInput re-export)
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- NEW: `apps/api/src/routes/v1/tags/routes.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`
- UPDATE: `packages/utilities/src/slugify.ts` (또는 NEW)
- UPDATE or NEW: `packages/utilities/src/generate-summary.ts`
- UPDATE: `packages/utilities/src/index.ts`
- Story 2.5 의존: `apps/web/features/editor/` (Editor 컴포넌트)
- Story 2.2 의존: `apps/web/lib/seo/generate-summary.ts` (utilities로 이동 시 대체)

### References
- [Source: epics.md#Story 2.7 AC]
- [Source: architecture.md#Implementation Patterns — Transaction & Data Access]
- [Source: project-context.md#응답 & 데이터 포맷 — slug]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#권한 & 게이팅]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- UPDATE: `apps/web/components/board/PostWriteForm.tsx`
- NEW: `apps/web/components/ui/TagInput/TagInput.tsx`
- NEW: `apps/web/components/ui/TagInput/TagInput.module.css`
- NEW: `apps/web/components/ui/TagInput/index.ts`
- UPDATE: `apps/web/components/ui/index.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- NEW: `apps/api/src/routes/v1/tags/routes.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`
- UPDATE: `packages/utilities/src/slugify.ts`
- NEW: `packages/utilities/src/generate-summary.ts`
- UPDATE: `packages/utilities/src/index.ts`
