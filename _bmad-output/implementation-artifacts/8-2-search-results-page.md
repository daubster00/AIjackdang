# Story 8.2: 검색 결과 페이지 (`/search`) — SSR · URL 상태 · 통합+영역별 탭

Status: ready-for-dev

## Story

As a 사용자(비회원 포함),
I want 검색어·필터를 URL에 반영한 결과 페이지를 보기를,
so that 뒤로가기·공유로 탐색을 재현하고 검색엔진이 색인하지 않으면서도 사람은 접근 가능하다.

## Acceptance Criteria

1. 헤더(`SiteHeader.tsx`)의 검색 입력에서 Enter 또는 버튼 클릭 시 `/search?q={입력값}&type=all&page=1`로 내비게이션하고, 해당 URL은 서버 컴포넌트 SSR로 렌더된다. 클라이언트 전용 hydration으로 본문 교체 금지 (NFR-1, UX-DR-U2).
2. `/search?q=cursor` SSR 로드 시 `<h1>"cursor" 검색 결과</h1>`가 렌더되고, `generateMetadata`는 고유 `title`과 `robots: { index: false, follow: true }` (noindex) 메타를 반환한다 (FR-11.9).
3. 결과 페이지는 "전체 / 게시글 / 묻고답하기 / 실전자료" 4개 탭을 `role="tablist"` 구조로 렌더한다. 각 탭에는 `byType` 카운트 뱃지를 표시하고, 탭 클릭 시 URL `type` 쿼리가 변경되어 SSR 재렌더된다 (UX-DR-U2, UX-DR-U6).
4. `type=all` 탭(전체) 활성 시 각 결과 항목은 유형 배지(`게시글`/`묻고답하기`/`실전자료`), 제목(상세 페이지 링크), 요약 2줄, 태그 칩, 작성자, 날짜를 표시한다. 검색어는 제목과 요약에서 `<mark>` 태그로 강조된다.
5. 검색 결과가 0건인 경우 `EmptyState` 컴포넌트를 렌더하고, API 응답의 `suggestedTags` 배열로 추천 태그 칩을 표시한다. `<h1>` 및 noindex는 유지된다 (UX-DR-U11).
6. 총 결과가 `pageSize`를 초과하면 오프셋 페이지네이션을 렌더한다. URL `page` 쿼리가 변경되며 현재 페이지 버튼에 `aria-current="page"`가 적용된다 (UX-DR-U3).
7. 서버 컴포넌트가 데이터를 패치하는 동안 리스트 스켈레톤 UI가 표시된다 (`loading.tsx` 또는 Suspense 경계, UX-DR-U11).
8. `SearchAutocomplete.tsx`에 `onSearch` 또는 `hrefFor` 조작으로 Enter/버튼 클릭 시 `/search?q=` 경로로 이동하도록 업데이트된다. 태그 자동완성 클릭은 기존 `/tags/{tag}` 경로 유지.

## Tasks / Subtasks

- [ ] Task 1: `SearchAutocomplete.tsx`에 검색 제출 라우팅 추가 (AC: #1, #8)
  - [ ] `apps/web/components/board/SearchAutocomplete.tsx` UPDATE
  - [ ] 현재 상태: `<form onSubmit={(e) => e.preventDefault()}>` — 제출이 막혀 있음. `hrefFor` prop은 태그 링크용(`/tags/{tag}`)으로 사용 중.
  - [ ] `onSubmit` 핸들러 수정: `query.length >= 1`이면 `router.push(\`/search?q=${encodeURIComponent(query)}&type=all&page=1\`)` 실행. `next/navigation`의 `useRouter` 사용.
  - [ ] 검색 버튼(`<button type="submit">`)이 이미 존재하므로 별도 버튼 추가 불필요.
  - [ ] 드롭다운 내 태그 항목 클릭(`hrefFor` 결과 링크)은 기존 `/tags/{tag}` 유지 — 변경 없음.
  - [ ] `SiteHeader.tsx`에는 `SearchAutocomplete`가 현재 **없음** — 헤더에 검색 진입점 추가 필요.

- [ ] Task 2: `SiteHeader.tsx`에 검색 진입점 추가 (AC: #1)
  - [ ] `apps/web/components/site/SiteHeader.tsx` UPDATE
  - [ ] 현재 상태: 헤더에 검색 컴포넌트 없음. 우측에 `authActions` 영역(로그인/회원가입 또는 사용자 메뉴)만 있음.
  - [ ] `SearchAutocomplete`를 `nav`와 `authActions` 사이 적절한 위치에 삽입. label="전체 검색", placeholder="검색어 입력".
  - [ ] `hrefFor`는 태그 클릭 전용이므로 기본값(`/tags/{tag}`) 유지. 폼 제출은 Task 1에서 수정된 `onSubmit`으로 처리.
  - [ ] 모바일(`<768px`)에서는 아이콘 버튼 클릭 시 검색창 펼침 또는 `/search` 직접 이동 — 기존 모바일 메뉴 레이아웃 깨지지 않도록 주의 (UX-DR-U14).
  - [ ] **보존할 것**: 기존 `navItems` 드롭다운 메뉴, `authActions`, `mobilePanel` 전체 동작.

- [ ] Task 3: `/search` 페이지 서버 컴포넌트 생성 (AC: #2, #3, #4, #5, #6)
  - [ ] `apps/web/app/search/page.tsx` NEW (서버 컴포넌트)
  - [ ] `searchParams` 타입: `Promise<{ q?: string; type?: string; page?: string }>` (Next.js 16 App Router 규약)
  - [ ] `generateMetadata` export: `title: \`"${q}" 검색 결과 · AI작당\``, `robots: { index: false, follow: true }` (FR-11.9, UX-DR-U16)
  - [ ] `q` 없거나 공백만 있을 경우: `<h1>검색어를 입력해 주세요</h1>` + 검색창만 표시하고 API 호출 없음.
  - [ ] API 호출: `fetch(\`${process.env.API_INTERNAL_URL}/api/v1/search?q=...&type=...&page=...\`, { cache: "no-store" })` — 검색 결과는 캐시하지 않음 (동적 쿼리, FR-11.9)
  - [ ] 응답을 `searchResponseSchema.parse()`로 검증 (contracts import)
  - [ ] 탭 렌더링: `<div role="tablist">` 내 4개 `<a>` 태그 (type=all/post/question/resource). 각 `href`는 현재 `q`·`page=1`·`type=탭값`. 현재 탭에 `aria-selected="true"`, 카운트 뱃지는 `byType.{type}` 값.
  - [ ] 결과 항목 렌더: `SearchResultItem` 컴포넌트 (클라이언트 또는 서버, `<mark>` 강조 포함)
  - [ ] EmptyState: `suggestedTags` 배열을 `/tags/{tag}` 링크 칩으로 렌더.
  - [ ] 페이지네이션: 기존 프로젝트 페이지네이션 컴포넌트 재사용 또는 동일 패턴 구현

- [ ] Task 4: 검색 결과 항목 컴포넌트 생성 (AC: #4)
  - [ ] `apps/web/app/search/_components/SearchResultItem.tsx` NEW (서버 또는 클라이언트 컴포넌트)
  - [ ] Props: `item: SearchResultItem` (contracts에서 import한 타입)
  - [ ] 유형 배지: `type === "post"` → `게시글`, `"question"` → `묻고답하기`, `"resource"` → `실전자료`
  - [ ] 상세 링크: `type=post` → `/posts/{slug}` 또는 보드별 경로, `type=question` → `/questions/{slug}`, `type=resource` → `/resources/{slug}`
  - [ ] `<mark>` 강조: 제목·요약에서 `q` 텍스트를 `<mark>` 태그로 감쌈. 순수 텍스트 분할 방식 사용 (`dangerouslySetInnerHTML` 금지, XSS 방지)
  - [ ] 태그 칩: `item.tags` 배열을 `/tags/{tag}` 링크로 렌더
  - [ ] 접근성: 제목은 `<h2>` (페이지 `<h1>` 하위), 링크는 `<a>` 태그

- [ ] Task 5: 로딩 스켈레톤 추가 (AC: #7)
  - [ ] `apps/web/app/search/loading.tsx` NEW
  - [ ] 탭 영역 스켈레톤 + 결과 카드 3~5개 스켈레톤 (레이아웃 일치, UX-DR-U11)
  - [ ] 기존 프로젝트 스켈레톤 CSS 클래스/컴포넌트 재사용 (있는 경우)

- [ ] Task 6: typecheck 및 렌더 확인 (AC: #1~#8)
  - [ ] `pnpm typecheck` 전 워크스페이스 통과
  - [ ] `http://localhost:3003/search?q=Claude&type=all` 브라우저에서 직접 확인: H1, 탭, 결과 항목
  - [ ] `http://localhost:3003/search?q=존재하지않는검색어` — EmptyState + suggestedTags 칩 확인
  - [ ] 헤더 검색창에서 Enter 입력 → URL 변경 확인
  - [ ] 탭 클릭 → URL type 변경, 페이지 SSR 재렌더 확인
  - [ ] 뷰소스에서 결과 항목이 서버 HTML에 포함되어 있는지 확인 (SSR 검증, NFR-1)

## Dev Notes

### 아키텍처 패턴 (AR 인용)
- **NFR-1 (SSR)**: `/search` 페이지는 서버 컴포넌트. `"use client"` 디렉티브 사용 금지. 탭·필터 상태는 URL searchParams로 관리. [Source: epics.md#NFR-1]
- **UX-DR-U2 (딥링크 URL 상태)**: 탭(`type`)·페이지(`page`)·검색어(`q`)는 모두 URL 쿼리에 반영. 뒤로가기·북마크·공유 후 동일 상태 복원. [Source: epics.md#UX-DR-U2]
- **FR-11.9 (noindex 정책)**: `/search?q=*` 검색 결과 페이지는 항상 `robots: index:false, follow:true`. 동적 쿼리 페이지는 색인 대상 아님. [Source: epics.md#FR-11.9]
- **AR-13 (REST 계약)**: 프론트엔드는 `/api/v1/search` API 경유. `process.env.API_INTERNAL_URL`(예: `http://api:4003`) 또는 `NEXT_PUBLIC_API_URL` 환경변수 사용. 서버 컴포넌트에서 내부 URL 사용 권장 (외부 노출 방지).

### 수정 대상 기존 파일 상태
- `apps/web/components/board/SearchAutocomplete.tsx` (UPDATE):
  - **현재 상태**: `"use client"`. `<form onSubmit={(e) => e.preventDefault()}>` — 폼 제출이 막혀 있음. `hrefFor` prop(기본값: `/tags/{term}`)이 드롭다운 항목 링크에만 사용됨. 검색 버튼(`<button type="submit" className={styles.button}>검색</button>`)이 있으나 동작하지 않음.
  - **바꾸는 것**: `onSubmit` 핸들러에서 `value.trim().length > 0`이면 `router.push(\`/search?q=${encodeURIComponent(value.trim())}&type=all&page=1\`)`. `useRouter`는 `next/navigation`에서 import.
  - **보존할 것**: 드롭다운 자동완성 UI 전체(포커스 패널, 최근 검색어, 인기 태그, 매칭 태그 목록). `hrefFor` prop 동작 — 드롭다운 항목 클릭은 여전히 `hrefFor(tag)` 경로로 이동.
- `apps/web/components/site/SiteHeader.tsx` (UPDATE):
  - **현재 상태**: `"use client"`. `navItems`, 우측 `authActions`(로그인 링크 또는 `UserMenu`), 모바일 `menuButton`+`mobilePanel`. `SearchAutocomplete` 미포함.
  - **바꾸는 것**: `SearchAutocomplete` 삽입. 데스크톱 레이아웃에서 `nav`와 `authActions` 사이 또는 `authActions` 내 적절 위치 선택.
  - **보존할 것**: 기존 네비게이션, 드롭다운 서브메뉴, 사용자 메뉴, 모바일 패널 전체.

### `<mark>` 강조 구현 방식
`dangerouslySetInnerHTML`은 XSS 위험이 있으므로 사용 금지 (NFR-2). 대신 문자열을 분할하여 JSX로 렌더:
```tsx
function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i}>{part}</mark>
          : part
      )}
    </>
  );
}
```

### 탭 URL 라우팅 패턴
서버 컴포넌트에서 탭은 `<a>` 태그(Link 컴포넌트)로 구현. `useSearchParams`, `useRouter` 사용 금지(클라이언트 전용). 각 탭의 `href`:
```
/search?q={q}&type=all&page=1
/search?q={q}&type=post&page=1
/search?q={q}&type=question&page=1
/search?q={q}&type=resource&page=1
```
현재 탭 판별: `searchParams.type === 탭값`이면 `aria-selected="true"`.

### 페이지네이션 URL 패턴
이전/다음 페이지 링크:
```
/search?q={q}&type={type}&page={page-1}
/search?q={q}&type={type}&page={page+1}
```
현재 페이지 버튼에 `aria-current="page"`. `meta.totalPages`까지만 렌더 (UX-DR-U3).

### 상세 링크 경로 규칙
- `type=post`: 보드별 경로가 있으나 검색 결과에서는 `/vibe-coding/{slug}` 등 보드 경로보다 API 반환 `board` 값으로 결정. 단순화: 우선 `/{board}/{slug}` 패턴. `board` 값이 없으면 `/posts/{slug}` 폴백.
- `type=question`: `/questions/{slug}`
- `type=resource`: `/resources/{slug}`

### 접근성 (UX-DR-U13)
- `<h1>`: 검색어를 포함한 문장. 페이지 당 1개.
- 탭: `role="tablist"` 부모, 각 탭 `role="tab"`, `aria-selected`. 활성 탭 패널은 `role="tabpanel"`.
- 결과 없음: `EmptyState` 내 "다음 행동" 링크 1개 (예: [인기글 보기] 또는 추천 태그).
- `<mark>` 태그: 스크린리더는 `<mark>`를 별도 읽지 않으므로 시각 강조용으로만 사용.

### Project Structure Notes
- NEW: `apps/web/app/search/page.tsx` (서버 컴포넌트)
- NEW: `apps/web/app/search/loading.tsx` (스켈레톤)
- NEW: `apps/web/app/search/_components/SearchResultItem.tsx`
- UPDATE: `apps/web/components/board/SearchAutocomplete.tsx` — 폼 제출 라우팅 추가
- UPDATE: `apps/web/components/site/SiteHeader.tsx` — 검색 진입점 추가
- 기존 컴포넌트 재사용: `@/components/ui` 내 `Tag`, `Avatar`, `AuthorName`, `Icon`. 페이지네이션 컴포넌트(프로젝트 내 존재 시 재사용).

### References
- [Source: epics.md#Story 8.2 Acceptance Criteria]
- [Source: epics.md#NFR-1 — SSR 렌더링]
- [Source: epics.md#UX-DR-U2 — URL 상태·딥링크]
- [Source: epics.md#UX-DR-U3 — 페이지네이션·aria-current]
- [Source: epics.md#UX-DR-U6 — 탭 role=tablist·aria-selected]
- [Source: epics.md#UX-DR-U11 — 스켈레톤·EmptyState]
- [Source: epics.md#UX-DR-U13 — 접근성 floor]
- [Source: epics.md#FR-11.9 — noindex 정책]
- [Source: apps/web/components/board/SearchAutocomplete.tsx — 현재 구현 상태]
- [Source: apps/web/components/site/SiteHeader.tsx — 현재 구현 상태]
- [Source: apps/web/app/layout.tsx — 루트 레이아웃]
- [Source: packages/contracts/src/common.ts — paginationMetaSchema]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `apps/web/app/search/page.tsx`
- NEW: `apps/web/app/search/loading.tsx`
- NEW: `apps/web/app/search/_components/SearchResultItem.tsx`
- UPDATE: `apps/web/components/board/SearchAutocomplete.tsx`
- UPDATE: `apps/web/components/site/SiteHeader.tsx`
