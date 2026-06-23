# Story 8.8: OG 태그 완성 · GA4 · Search Console · noindex 정책

Status: ready-for-dev

## Story

As a 서비스 운영팀,
I want 모든 공개 SSR 페이지에 완전한 OG/Twitter 태그가 붙고, GA4·GSC가 루트 레이아웃에 연결되며, noindex 판정 로직이 단일 함수로 중앙화되기를,
so that 소셜 공유 미리보기가 완성되고 구글 Analytics·Search Console 연동이 설정되며 저품질 페이지가 색인에서 제외되어 검색 품질(FR-11.4, FR-11.8, FR-11.9)이 확보된다.

## Acceptance Criteria

1. 모든 공개 SSR 페이지의 `generateMetadata`가 `openGraph.title`, `openGraph.description`(160자 이하), `openGraph.url`(절대 URL), `openGraph.type`(`website` 또는 `article`), `openGraph.images`(대표 이미지 또는 `/public/og-default.png` 1200×630 폴백), `openGraph.siteName`(`"AI작당"`), Twitter Card(`twitter.card: "summary_large_image"`, `twitter.title`, `twitter.description`, `twitter.images`)를 반환한다(FR-11.4).
2. 대표 이미지가 없는 페이지는 `openGraph.images`와 `twitter.images` 모두 `/og-default.png`(Next.js `public/` 경로 기준 절대 URL `${NEXT_PUBLIC_SITE_URL}/og-default.png`)를 사용한다.
3. `apps/web/app/layout.tsx`에 `NEXT_PUBLIC_GA4_ID` 환경변수를 참조하는 GA4 `<Script>` 태그(strategy `"afterInteractive"`)가 삽입된다. 환경변수가 비어 있거나 정의되지 않은 경우 스크립트 태그를 전혀 삽입하지 않는다(FR-11.8).
4. `apps/web/app/layout.tsx`의 루트 `generateMetadata`(또는 루트 `page.tsx`의 `generateMetadata`)에 `verification.google: process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN`이 포함된다. 환경변수가 비어 있으면 `verification` 필드 자체를 생략한다(FR-11.8).
5. `apps/web/lib/seo/noindex.ts`가 신규 생성된다. `shouldNoindex(ctx: NoindexContext): boolean` 단일 함수를 export하며, 다음 조건을 모두 평가한다(FR-11.9):
   - `path`가 `/mypage`, `/notifications`, `/messages`, `/inquiries`이거나 `/settings/`로 시작하면 → 항상 `true`
   - `path`가 `/search`이고 `searchQuery`가 비어 있지 않으면 → 항상 `true`
   - `path`가 `/tags/{tag}`이고 `contentCount <= 2`이면 → `true`
   - `path`가 `/u/{nickname}`이고 `contentCount === 0`이면 → `true`
   - `isHidden === true` 또는 `isDeleted === true`이면 → `true`
   - 이외 → `false`
6. `shouldNoindex`가 `true`를 반환하는 경우, 해당 페이지 `generateMetadata`는 `robots: { index: false, follow: true }`를 포함한 `Metadata`를 반환한다. noindex 판정 코드는 `lib/seo/noindex.ts` 외에 분산되지 않는다.
7. `apps/web/public/og-default.png` 플레이스홀더 파일이 존재한다(1200×630px 권장, 개발 단계에서는 더미 파일 허용).
8. `pnpm typecheck` 전 워크스페이스 통과.

## Tasks / Subtasks

- [ ] Task 1: `apps/web/lib/seo/noindex.ts` 신규 생성 (AC: #5, #6)
  - [ ] `apps/web/lib/seo/noindex.ts` NEW
  - [ ] `NoindexContext` 인터페이스 정의: `{ path: string; searchQuery?: string; contentCount?: number; isHidden?: boolean; isDeleted?: boolean }`
  - [ ] `shouldNoindex(ctx: NoindexContext): boolean` 구현 — 조건 5개 순서대로 평가, 일치하는 즉시 `true` 반환
  - [ ] 인증 전용 페이지 판정: `["/mypage", "/notifications", "/messages", "/inquiries"].includes(ctx.path) || ctx.path.startsWith("/settings/")`
  - [ ] `/settings/` 판정: 위 조건에 포함됨 (`ctx.path.startsWith("/settings/")` 공통 처리)
  - [ ] `/search` 판정: `ctx.path === "/search" && !!ctx.searchQuery`
  - [ ] `/tags/{tag}` 판정: `ctx.path.startsWith("/tags/") && (ctx.contentCount ?? 0) <= 2`
  - [ ] `/u/{nickname}` 판정: `ctx.path.startsWith("/u/") && ctx.contentCount === 0`
  - [ ] 삭제/숨김 판정: `ctx.isHidden === true || ctx.isDeleted === true`
  - [ ] `apps/web/lib/seo/index.ts` UPDATE: `export * from "./noindex"` 추가 (Story 2.2에서 생성된 배럴 파일 확장)

- [ ] Task 2: `apps/web/public/og-default.png` 플레이스홀더 추가 (AC: #7)
  - [ ] `apps/web/public/og-default.png` NEW — 1200×630px 더미 PNG 파일 배치 (빌드에 포함되어야 하므로 빈 파일이 아닌 실제 PNG여야 함; 개발 단계에서는 단색 1200×630 PNG 허용)
  - [ ] 실제 디자인 에셋은 디자인 팀 전달 후 교체

- [ ] Task 3: `apps/web/app/layout.tsx` GA4 스크립트 삽입 (AC: #3)
  - [ ] `apps/web/app/layout.tsx` UPDATE
  - [ ] `next/script`에서 `Script` import 추가
  - [ ] `const ga4Id = process.env.NEXT_PUBLIC_GA4_ID` 선언
  - [ ] `<body>` 내부, `<ToastProvider>` 이전에 조건부 GA4 스크립트 삽입:
    ```tsx
    {ga4Id && (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${ga4Id}');
        `}</Script>
      </>
    )}
    ```
  - [ ] 환경변수 미설정 시(undefined/빈 문자열) 스크립트 미삽입 동작 확인

- [ ] Task 4: 루트 레이아웃 `generateMetadata`에 GSC 인증 토큰 추가 (AC: #4)
  - [ ] `apps/web/app/layout.tsx` UPDATE
  - [ ] 기존 `export const metadata: Metadata` 정적 선언을 `export async function generateMetadata(): Promise<Metadata>`로 전환 (또는 정적 객체에 직접 추가)
  - [ ] `const gscToken = process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN`
  - [ ] 반환 객체에 `...(gscToken ? { verification: { google: gscToken } } : {})` 스프레드 추가
  - [ ] 기존 `title.default`, `title.template`, `description` 유지

- [ ] Task 5: 홈 페이지(`apps/web/app/page.tsx`) OG 태그 추가 (AC: #1, #2)
  - [ ] `apps/web/app/page.tsx` UPDATE
  - [ ] `generateMetadata` 함수 추가 (현재 없음 — `layout.tsx`의 default metadata 의존 중)
  - [ ] `openGraph: { type: "website", title: "AI작당 — 실전 AI 커뮤니티", description: "AI로 만들고, 자동화하고, 돈으로 연결하는 실전 AI 커뮤니티", url: \`${process.env.NEXT_PUBLIC_SITE_URL}/\`, siteName: "AI작당", images: [{ url: \`${process.env.NEXT_PUBLIC_SITE_URL}/og-default.png\`, width: 1200, height: 630, alt: "AI작당" }] }`
  - [ ] `twitter: { card: "summary_large_image", title: "AI작당", description: "...", images: [\`${process.env.NEXT_PUBLIC_SITE_URL}/og-default.png\`] }`

- [ ] Task 6: 게시판 목록·상세 페이지 OG 태그 업데이트 (AC: #1, #2, #6)
  - [ ] 아래 페이지 각각의 `generateMetadata`를 UPDATE. 공통 패턴: `buildPostMeta` 헬퍼 (Story 2.2 `apps/web/lib/seo/metadata.ts`) 활용 가능하면 우선 활용
  - [ ] `apps/web/app/vibe-coding/[slug]/page.tsx` UPDATE:
    - `openGraph.type: "article"`, `openGraph.images`: 게시글 대표 이미지 있으면 사용, 없으면 `/og-default.png` 폴백
    - `shouldNoindex({ path: \`/vibe-coding/${slug}\`, isHidden: post.isHidden, isDeleted: post.isDeleted })` 호출 → `true`이면 `robots: { index: false, follow: true }`
    - `twitter.card: "summary_large_image"`
  - [ ] `apps/web/app/questions/[slug]/page.tsx` UPDATE: 동일 패턴, `openGraph.type: "article"`
  - [ ] `apps/web/app/automation/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/monetize/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/lounge/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/lounge/talk/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/lounge/gigs/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/lounge/products/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/resources/mcp-skills/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/resources/prompts/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/resources/rules/[slug]/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/web/app/resources/templates/[slug]/page.tsx` UPDATE: 동일 패턴

- [ ] Task 7: 게시판 목록 페이지 OG 태그 업데이트 (AC: #1, #2)
  - [ ] `apps/web/app/vibe-coding/page.tsx` UPDATE: `openGraph.type: "website"`, 공통 OG + Twitter Card, `/og-default.png` 폴백
  - [ ] `apps/web/app/automation/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/monetize/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/questions/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/lounge/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/lounge/talk/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/lounge/gigs/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/lounge/products/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/resources/mcp-skills/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/resources/prompts/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/resources/rules/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/resources/templates/page.tsx` UPDATE: 동일

- [ ] Task 8: 태그 랜딩 페이지 noindex 정책 적용 (AC: #1, #2, #5, #6)
  - [ ] `apps/web/app/tags/[tag]/page.tsx` UPDATE
  - [ ] `generateMetadata`에서 API로 해당 태그 게시글 수 조회 (`contentCount`)
  - [ ] `shouldNoindex({ path: \`/tags/${tag}\`, contentCount })` 호출
  - [ ] 결과에 따라 `robots: { index: false, follow: true }` 조건부 삽입
  - [ ] OG 태그 추가: `openGraph.type: "website"`, `openGraph.images`: `/og-default.png`, Twitter Card

- [ ] Task 9: 검색 페이지 noindex 정책 적용 (AC: #5, #6)
  - [ ] `apps/web/app/search/page.tsx` UPDATE (Story 8.2에서 생성)
  - [ ] `generateMetadata`에서 `searchParams.q` 파라미터 추출
  - [ ] `shouldNoindex({ path: "/search", searchQuery: searchParams.q })` 호출
  - [ ] 검색어가 있으면 항상 `robots: { index: false, follow: true }` 반환

- [ ] Task 10: 프로필 페이지(`/u/[nickname]`) noindex 정책 적용 (AC: #5, #6)
  - [ ] `apps/web/app/u/[nickname]/page.tsx` UPDATE
  - [ ] `generateMetadata`에서 해당 사용자 게시글 수 조회 (`contentCount`)
  - [ ] `shouldNoindex({ path: \`/u/${nickname}\`, contentCount })` 호출
  - [ ] OG 태그 추가: `openGraph.type: "profile"`, Twitter Card

- [ ] Task 11: 인증 전용 페이지 noindex 확인 (AC: #5, #6)
  - [ ] `apps/web/app/settings/profile/page.tsx` UPDATE: `generateMetadata`에 `robots: { index: false, follow: true }` 정적 삽입 (항상 noindex이므로 `shouldNoindex` 호출 불필요)
  - [ ] `apps/web/app/settings/notifications/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/settings/security/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/mypage/page.tsx` UPDATE: 동일 (로그인 전용 페이지이므로 noindex 정적 삽입. `shouldNoindex` 조건에서 `/mypage` 경로가 직접 매칭됨)
  - [ ] `apps/web/app/bookmarks/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/messages/page.tsx` UPDATE: 동일
  - [ ] `apps/web/app/notifications/page.tsx` UPDATE: 동일

- [ ] Task 12: typecheck 통과 확인 (AC: #8)
  - [ ] `pnpm typecheck` 전 워크스페이스 실행
  - [ ] `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GSC_VERIFICATION_TOKEN`, `NEXT_PUBLIC_SITE_URL` 타입 선언 확인 (`apps/web/env.d.ts` 또는 `next-env.d.ts` 내 `ProcessEnv` 확장)

## Dev Notes

### GA4 스크립트 삽입 방식
- `next/script`의 `strategy="afterInteractive"` 사용: 페이지 인터랙티브 이후 로드되어 LCP(최대 콘텐츠풀 페인트)에 영향 없음.
- `@next/third-parties/google`의 `GoogleAnalytics` 컴포넌트를 사용해도 되지만, 패키지 추가 없이 `next/script` 직접 사용으로도 동일 결과 달성 가능. 패키지가 이미 설치되어 있으면 `GoogleAnalytics` 컴포넌트 우선 사용.
- GA4 스크립트는 `<body>` 태그 안쪽, 다른 콘텐츠보다 먼저 배치하되 React 렌더 트리 밖(즉 `<html>` 직속 자식)에 두는 패턴 권장.
- `NEXT_PUBLIC_GA4_ID` 값 예시: `G-XXXXXXXXXX`.

### GSC 메타 태그
- `generateMetadata`에서 `Metadata.verification.google` 필드를 반환하면 Next.js가 `<meta name="google-site-verification" content="...">` 자동 삽입.
- 루트 레이아웃 `metadata`를 정적 객체로 유지할 경우, `process.env` 참조는 빌드 타임에 평가되므로 정적 객체 내 `verification.google: process.env.NEXT_PUBLIC_GSC_VERIFICATION_TOKEN`으로도 작동. 단 `|| undefined` 처리 필요 (`""` 전달 시 빈 태그 삽입됨).
- 토큰 값 예시: `"abcdef1234567890abcdef1234567890abcdef12"`.

### noindex 중앙화 원칙
- `shouldNoindex` 함수는 `apps/web/lib/seo/noindex.ts` 단 하나에만 존재한다. 각 페이지 `generateMetadata`는 이 함수를 호출하고 결과에 따라 `robots` 필드를 삽입한다. 조건 판정 코드를 페이지 파일에 직접 인라인하지 않는다.
- `lib/seo/index.ts`(Story 2.2 생성)의 배럴에 `noindex.ts` re-export를 추가해 `import { shouldNoindex } from "@/lib/seo"` 단일 경로로 접근 가능하게 한다.

### OG 이미지 폴백 패턴
```ts
const ogImage = post.thumbnailUrl
  ? [{ url: post.thumbnailUrl, width: 1200, height: 630 }]
  : [{ url: `${process.env.NEXT_PUBLIC_SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "AI작당" }];
```
- `NEXT_PUBLIC_SITE_URL` 값 예시: `"https://aijakdang.com"`.
- `/og-default.png`는 `apps/web/public/og-default.png`에 위치. Next.js가 `public/` 폴더를 루트로 서빙하므로 URL 경로는 `/og-default.png`.

### description 160자 제한
- OG description은 160자 이내로 제한. `packages/utilities/src/string.ts`의 `truncate(text, 160)` 함수 활용 가능 (이미 존재).
- 게시글 요약이 없는 경우 제목을 description으로 사용.

### 현재 상태 (기존 파일 분석)
- `apps/web/app/layout.tsx`: `metadata` 정적 객체로 title/description만 있음. GA4·GSC 미설정. UPDATE 필요.
- `apps/web/app/vibe-coding/[slug]/page.tsx`: `metadata` 정적 객체에 title만. OG/Twitter Card 없음. UPDATE 필요.
- `apps/web/app/tags/[tag]/page.tsx`: `generateMetadata` 있으나 OG/Twitter/noindex 없음. UPDATE 필요.
- `apps/web/lib/seo/` 폴더: 현재 미존재 (Story 2.2가 선행 완료되어야 함). 미완료 시 `metadata.ts`·`index.ts` 포함 해당 폴더를 이 스토리에서 병행 생성.
- `apps/web/app/search/page.tsx`: Story 8.2 산출물 (미존재 시 Task 9 건너뜀).

### Project Structure Notes

신규 파일:
- `apps/web/lib/seo/noindex.ts` — NEW
- `apps/web/public/og-default.png` — NEW (플레이스홀더)

수정 파일:
- `apps/web/app/layout.tsx` — GA4 Script 삽입, GSC verification, generateMetadata 전환
- `apps/web/app/page.tsx` — generateMetadata 추가
- `apps/web/app/vibe-coding/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/questions/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/automation/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/monetize/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/lounge/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/lounge/talk/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/lounge/gigs/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/lounge/products/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/resources/mcp-skills/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/resources/prompts/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/resources/rules/[slug]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/resources/templates/[slug]/page.tsx` — OG/Twitter/noindex
- 모든 목록 page.tsx 12개 — OG/Twitter 추가
- `apps/web/app/tags/[tag]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/search/page.tsx` — noindex
- `apps/web/app/u/[nickname]/page.tsx` — OG/Twitter/noindex
- `apps/web/app/settings/**`, `apps/web/app/mypage/page.tsx`, 인증 전용 페이지들 — noindex
- `apps/web/lib/seo/index.ts` — noindex re-export 추가

### References

- [Source: architecture.md#Frontend Architecture — SEO 구현]
- [Source: project-context.md#SEO]
- [FR-11.4: OG/Twitter Card 메타 태그 완성]
- [FR-11.8: GA4 통합, GSC 인증]
- [FR-11.9: noindex 정책 — /mypage, /notifications, /messages, /inquiries, /settings/**, /search?q=*, /tags/{tag}(콘텐츠≤2), /u/{nickname}(콘텐츠 0), hidden/deleted 상세]
- [AR-17: Next SSR route cache 정책 (목록 revalidate=60, 상세 revalidate=300)]
- [Story 2.2: lib/seo 헬퍼 기반 구조 — metadata.ts, index.ts 배럴]
- [Story 8.2: 검색 페이지 /search page.tsx 선행 생성]
- [packages/utilities/src/string.ts: truncate 함수 활용]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `apps/web/lib/seo/noindex.ts`
- NEW: `apps/web/public/og-default.png`
- UPDATE: `apps/web/app/layout.tsx`
- UPDATE: `apps/web/app/page.tsx`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/questions/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/talk/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/products/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/mcp-skills/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/prompts/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/rules/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/templates/[slug]/page.tsx`
- UPDATE: `apps/web/app/vibe-coding/page.tsx`
- UPDATE: `apps/web/app/automation/page.tsx`
- UPDATE: `apps/web/app/monetize/page.tsx`
- UPDATE: `apps/web/app/questions/page.tsx`
- UPDATE: `apps/web/app/lounge/page.tsx`
- UPDATE: `apps/web/app/lounge/talk/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/page.tsx`
- UPDATE: `apps/web/app/lounge/products/page.tsx`
- UPDATE: `apps/web/app/resources/mcp-skills/page.tsx`
- UPDATE: `apps/web/app/resources/prompts/page.tsx`
- UPDATE: `apps/web/app/resources/rules/page.tsx`
- UPDATE: `apps/web/app/resources/templates/page.tsx`
- UPDATE: `apps/web/app/tags/[tag]/page.tsx`
- UPDATE: `apps/web/app/search/page.tsx`
- UPDATE: `apps/web/app/u/[nickname]/page.tsx`
- UPDATE: `apps/web/app/settings/profile/page.tsx`
- UPDATE: `apps/web/app/settings/notifications/page.tsx`
- UPDATE: `apps/web/app/settings/security/page.tsx`
- UPDATE: `apps/web/app/mypage/page.tsx`
- UPDATE: `apps/web/app/bookmarks/page.tsx`
- UPDATE: `apps/web/app/messages/page.tsx`
- UPDATE: `apps/web/app/notifications/page.tsx`
- UPDATE: `apps/web/lib/seo/index.ts`
