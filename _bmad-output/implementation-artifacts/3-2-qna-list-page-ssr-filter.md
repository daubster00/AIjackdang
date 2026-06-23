# Story 3.2: Q&A 목록 페이지 (SSR · 상태 필터 칩 · URL 상태)

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want `/questions`에서 질문 목록을 상태 필터·정렬로 탐색하고 URL로 공유하기를,
so that 답변 대기 질문이나 해결된 사례를 빠르게 발견한다.

## Acceptance Criteria

1. 비회원이 `/questions` 진입 시 SSR로 질문 목록이 서버 컴포넌트로 렌더된다: 상태 배지·제목·요약(excerpt)·태그·작성자·작성일·답변수가 즉시 노출. `<h1>묻고답하기</h1>` 1개·breadcrumb(JSON-LD BreadcrumbList)·고유 title(`"묻고답하기 | AI작당"`)·description·canonical 포함. 검색엔진이 본문을 즉시 파싱 가능해야 함(NFR-1).
2. 상태 필터 칩 5개(전체/답변대기/답변있음/해결됨/인기질문)가 `role="group"`으로 묶이고, 칩 클릭 시 URL 쿼리(`?status=all|waiting|answered|resolved|popular`)가 반영되어 SSR 재요청으로 목록이 필터링된다. 뒤로가기 후 필터·스크롤 복원(UX-DR-U2·U6).
3. API `GET /api/v1/qna/questions` 엔드포인트가 구현된다: `questionListQuerySchema`(`page`, `pageSize`, `status`, `sort`) 검증, 응답 `{ items, meta }` 오프셋 페이지네이션. `status` 필터는 answers 공개 건수 + `is_resolved` 조합으로 서버 필터링(`deriveQuestionStatus` 로직과 동일). `sort=popular`는 `view_count` 기준.
4. 빈 목록(결과 0건) 시 `EmptyState` — "조건에 맞는 질문이 없어요." + [질문하기] primary 버튼(UX-DR-U11).
5. 페이지네이션: `aria-current="page"` 표시, 이전/다음 버튼, 모바일 축약형(현재/전체+이전·다음)(UX-DR-U3). URL `?page=` 파라미터 반영.
6. 목록 아이템 상태 배지: `deriveQuestionStatus` 결과가 색상+텍스트 동반 배지로 렌더됨. 색만으로 상태 전달 금지(UX-DR-U13). 배지 tone: waiting→warning, answered→info, resolved→success.
7. [질문하기] 버튼이 `/questions/write` 링크로 연결된다. 비회원 클릭 시 로그인 유도 모달 + `redirectTo=/questions/write`(UX-DR-U1).
8. 목록 로딩 중 스켈레톤 표시(SSR이므로 초기 로드는 이미 렌더됨, 필터 교체 시 클라이언트 전환 중 레이아웃 일치 스켈레톤)(UX-DR-U11).

## Tasks / Subtasks

- [ ] Task 1: API 엔드포인트 구현 (AC: #3) [NEW]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` 생성: `GET /api/v1/qna/questions` 라우트
  - [ ] `questionListQuerySchema` import from `@ai-jakdang/contracts`
  - [ ] DB 쿼리: `questions` 테이블 join `answers`(공개 건수 집계), `users`(닉네임), `taggable`→`tags`
  - [ ] `status` 필터 SQL: `waiting` → `answer_count=0 AND is_resolved=false`, `answered` → `answer_count>0 AND is_resolved=false`, `resolved` → `is_resolved=true`, `popular` → `view_count` DESC 상위(또는 `answer_count + view_count` 합산 기준)
  - [ ] `sort=latest` → `created_at DESC`, `sort=popular` → `view_count DESC`
  - [ ] 오프셋 페이지네이션: `LIMIT pageSize OFFSET (page-1)*pageSize`
  - [ ] 응답: `{ items: QuestionListItem[], meta: PaginationMeta }`
  - [ ] `apps/api/src/routes/v1/index.ts` [UPDATE]: qna 라우트 등록

- [ ] Task 2: 페이지 컴포넌트 — 서버 컴포넌트 SSR 전환 (AC: #1, #6, #7, #8) [UPDATE]
  - [ ] `apps/web/app/questions/page.tsx` [UPDATE]: 현행 하드코딩 더미 데이터 → API 호출로 교체
  - [ ] `searchParams` props 받아 `status`·`sort`·`page` 파라미터 추출
  - [ ] API fetch: `fetch('/api/v1/qna/questions?...')` — 서버 컴포넌트에서 직접 호출(Next SSR)
  - [ ] **보존할 것**: 현행 `statusFilters` 배열 구조, `statusBadge` 매핑, `BoardHero menu="questions"` 호출, `SearchAutocomplete` 컴포넌트 사용, `BoardSidebar` 레이아웃, 아이템 레이아웃(`answerCount` 블록 + `questionBody`), `questions.module.css` 스타일
  - [ ] **교체할 것**: 하드코딩 `questions` 배열 → API 응답 `items` 배열
  - [ ] `generateMetadata` 확장: `{ title: '묻고답하기 | AI작당', description: 'AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간', alternates: { canonical: '/questions' } }`
  - [ ] breadcrumb 데이터 구성: `[{ name: 'AI작당', url: '/' }, { name: '묻고답하기', url: '/questions' }]`
  - [ ] BreadcrumbList JSON-LD script 태그 추가(`<script type="application/ld+json">`)

- [ ] Task 3: 상태 필터 칩 URL 연동 (AC: #2, #5) [NEW]
  - [ ] `apps/web/app/questions/FilterChips.tsx` 생성 (Client Component): 현행 `page.tsx`의 정적 filter chip → URL 쿼리 반영하는 인터랙티브 버튼으로 교체
  - [ ] `useRouter`, `useSearchParams` 사용: 칩 클릭 → `router.push('/questions?status=xxx')`
  - [ ] 활성 칩: `aria-pressed="true"` + 시각적 강조
  - [ ] 페이지네이션도 URL 기반: `apps/web/app/questions/Pagination.tsx` 생성 (Client Component)
  - [ ] `aria-current="page"` 현재 페이지 표시

- [ ] Task 4: 빈 상태 + 스켈레톤 (AC: #4, #8) [NEW]
  - [ ] `apps/web/app/questions/page.tsx`에 빈 목록 처리: `items.length === 0` → `EmptyState` 렌더
  - [ ] `EmptyState` 컴포넌트: `components/ui/EmptyState` 확인 후 재사용. 없으면 NEW 생성.
  - [ ] `apps/web/app/questions/loading.tsx` 생성 (Next 14+ loading.tsx 패턴): 스켈레톤 레이아웃

- [ ] Task 5: [질문하기] 비회원 게이팅 (AC: #7)
  - [ ] 현행 `<Link href="/questions/write"><Button>질문하기</Button></Link>` 유지
  - [ ] `/questions/write` 페이지에서 비회원 접근 시 로그인 유도 모달 처리 — Story 3.3에서 구현(이 스토리는 버튼 링크만)

## Dev Notes

### 현행 코드 분석 (`apps/web/app/questions/page.tsx` 읽음)
- 현재 상태: 하드코딩 더미 데이터 6개, `statusFilters` 배열, `statusBadge` 매핑, `BoardHero`, `SearchAutocomplete`, `BoardSidebar` 사용 중
- 보존: CSS module(`questions.module.css`), 레이아웃 구조(`listLayout`, `listHeader`, `mainCol`), 아이템 마크업(`answerCount` 블록 + `questionBody`), `boardHero menu="questions"`, `SearchAutocomplete`, `BoardSidebar`
- 교체: 하드코딩 배열 → API 데이터, 정적 필터 칩 → URL 기반 FilterChips, 정적 페이지네이션 → URL 기반 Pagination
- `statusBadge` 매핑 `solved` 키가 `"solved"`인데 API 응답에서 derived status는 `"resolved"`. 교체 시 키 통일 필요: **API 응답은 `deriveQuestionStatus` 반환값인 `'waiting'|'answered'|'resolved'`를 사용**. 현행 프론트 코드의 `solved` → `resolved`로 정렬.

### SSR 패턴 (Epic 2에서 확립, 재사용)
- `page.tsx`는 서버 컴포넌트. `searchParams: Promise<{ status?: string; page?: string; sort?: string }>` props 받음.
- API는 Next 서버 컴포넌트에서 직접 호출(`fetch`). credentials 처리 주의: 쿠키 포워딩 필요 시 `cookies()` → `headers()`.
- 공개 목록은 `{ cache: 'no-store' }` 또는 Next revalidation 전략 사용.

### URL 상태 설계 (UX-DR-U2)
- `?status=waiting&sort=latest&page=2` 형태
- 필터 교체 시 `page` 파라미터 리셋 (page=1로 돌아감)
- 필터 칩 클릭: Client Component(`FilterChips.tsx`)가 `router.push` 호출

### API 경계 (AR-2)
- DB 쿼리는 `apps/api` service layer에서만. Next web 서버 컴포넌트에서 Drizzle 직접 import 금지.
- 응답 타입: `packages/contracts`의 `questionDetailResponseSchema` 재사용

### JSON-LD BreadcrumbList 패턴 (Epic 2 재사용)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "AI작당", "item": "https://aijakdang.com" },
    { "@type": "ListItem", "position": 2, "name": "묻고답하기", "item": "https://aijakdang.com/questions" }
  ]
}
```
- `lib/seo/` 헬퍼가 있으면 재사용, 없으면 인라인 구성 후 3.9에서 헬퍼로 추출

### 보안·성능
- 목록 API 응답 캐싱: Next route cache 활용(짧은 TTL). 공개 목록이므로 세션 불필요.
- N+1 방지: 단일 SQL JOIN으로 answers count, user nickname, tags 한 번에 조회(`inArray` 또는 서브쿼리)

### Project Structure Notes
- 신규 파일: `apps/api/src/routes/v1/qna/questions.ts`, `apps/web/app/questions/FilterChips.tsx`, `apps/web/app/questions/Pagination.tsx`, `apps/web/app/questions/loading.tsx`
- 수정 파일: `apps/web/app/questions/page.tsx`, `apps/api/src/routes/v1/index.ts`

### References
- [Source: epics.md#Story 3.2 AC] 목록 요구사항
- [Source: apps/web/app/questions/page.tsx] 현행 목록 페이지 구현 (읽어 확인)
- [Source: _bmad-output/project-context.md#UX/에러처리] EmptyState, 스켈레톤 패턴
- [Source: _bmad-output/project-context.md#SEO] SSR, generateMetadata, JSON-LD
- [Source: _bmad-output/project-context.md#응답&데이터포맷] 오프셋 페이지네이션, { items, meta }
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U2] URL 상태 반영
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U3] 페이지네이션 접근성
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U6] 칩 필터 행동
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U11] EmptyState, 스켈레톤

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
