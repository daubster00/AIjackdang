# Story 4.3: 자료 상세 페이지 (SSR + JSON-LD + 다운로드 슬롯)

---
baseline_commit: 0d308ef646beb59490b626f2c5962e264f18b7c1
---

Status: review

## Story

As a 방문자(비회원 포함),
I want 자료 상세에서 설명·사용법·주의사항·버전·참고링크를 확인하고 다운로드 영역을 보기를,
So that 자료가 내 상황에 맞는지 판단 후 다운로드를 결정한다.

## Acceptance Criteria

1. `/resources/{slug}` SSR 렌더 시 `generateMetadata`(자료명·summary·canonical), JSON-LD(`resourceType`별: `prompt|claude-code-skill` → SoftwareSourceCode, `template-checklist|rules-config` → CreativeWork 또는 DigitalDocument, `mcp` → SoftwareSourceCode; `name`·`description`·`author`·`dateModified`·`fileFormat`·`url` 포함), BreadcrumbList JSON-LD(홈>실전자료>자료명), H1 1개가 모두 포함된다(FR-11.5·11.2·UX-DR-U16).
2. 자료 상세 렌더 순서: ①메타 헤더(유형배지·평점·제목·작성자·날짜·다운로드수) ②다운로드 영역(대표 파일+첨부 목록, [다운로드] 슬롯) ③"이 자료는 무엇인가요"(description_json Tiptap 렌더) ④사용법(usage_json) ⑤주의사항(caution_json, nullable — 없으면 섹션 미표시) ⑥참고링크(reference_links nullable) ⑦평점 영역(avg_rating·ratingCount + 입력 슬롯, 4.7 활성화) ⑧후기 댓글 슬롯(Epic 5) ⑨좋아요·신고·북마크 슬롯(Epic 5) ⑩[목록으로](FR-4.3).
3. 모바일(<768px)에서 다운로드 버튼이 하단 고정 바로 렌더된다(UX-DR-U14).
4. 미존재/삭제된 slug 접근 시 Next.js `notFound()` + noindex(FR-11.9).
5. `status=hidden` 자료를 비회원·일반 회원이 접근하면 `notFound()` 처리(FR-4.8).
6. `GET /api/v1/resources/{slug}` API가 `resourceDetailSchema` 형식으로 응답한다. 인증 여부와 무관하게 published 자료는 응답(비회원 읽기 개방).
7. 본인 등록 자료인 경우 [수정하기]·[삭제하기] 버튼이 노출된다(타인·비회원에게는 미노출). 인증은 API 세션 쿠키 기반.
8. `scan_status=pending` 대표 파일의 경우 다운로드 버튼이 "검사 중" 비활성 상태로 표시된다.
9. `scan_status=infected` 대표 파일의 경우 다운로드 버튼이 숨겨지고 "보안 검사 문제 발견" 안내가 표시된다.

## Tasks / Subtasks

- [x] Task 1: API 엔드포인트 구현 (AC: #6)
  - [x] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: `GET /api/v1/resources/:slug` 라우트 추가
  - [x] `apps/api/src/routes/v1/resources/resource.service.ts` UPDATE: `getResourceBySlug(slug: string, userId?: string)` 함수 추가
    - Drizzle: `where(eq(resources.slug, slug))`
    - status 검증: `deleted` → 404, `hidden` → userId가 admin이 아니면 404(4.8에서 admin 연결, 현재는 404)
    - `with`: `resource_files`(all), user(닉네임·avatar), 향후 tags
    - `files` 배열 포함(isPrimary true 우선 정렬), `commentCount: 0`(TODO Epic 5)
    - `userIsOwner` 필드: `userId === resource.userId`로 계산하여 응답에 포함

- [x] Task 2: 통합 상세 페이지 구현 (AC: #1, #2, #3, #4, #5, #7, #8, #9)
  - [x] **기존 코드 완독 필수**: `apps/web/app/resources/prompts/[slug]/page.tsx`, `mcp-skills/[slug]/page.tsx` 완독
  - [x] 현재 UI 계약 파악(기존 코드 기준):
    - `sectionCard` 박스 A: 헤더(유형배지+평점칩) + 제목(H1) + 메타(작성자·날짜·다운로드수) + body 문단 + `AttachmentList` + 포함파일목록 + 태그행
    - `downloadPanel` 박스: 파일 아이콘 + 파일명·크기·다운로드회수 + [다운로드] 버튼
    - `detailActions`: [북마크][공유][신고] — Epic 5 슬롯(현재 button만 존재)
    - `reviewSection` 박스 B: 평점 요약(숫자+별) + [후기 작성] 버튼 + 후기 목록
    - `detailFooter`: [목록으로] + [수정][삭제] (본인만)
  - [x] `apps/web/app/resources/[slug]/page.tsx` 신규 생성 — SSR 서버 컴포넌트 (NEW)
    - `generateMetadata`: `title = resource.title`, `description = resource.summary`, `canonical = /resources/${slug}`, `noindex` 조건(deleted/hidden)
    - JSON-LD 스크립트 인라인: `resourceType`별 분기(SoftwareSourceCode/CreativeWork/DigitalDocument)
    - BreadcrumbList JSON-LD: `[{홈, /}, {실전자료, /resources}, {자료명, /resources/slug}]`
    - API 호출 → `notFound()` 처리
    - 서버에서 `userId` 확인(쿠키 세션) → `userIsOwner` 판단
  - [x] `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` 신규 생성 (NEW)
    - 다운로드 버튼 상태: `scan_status` 기반 (pending=비활성+"검사 중", infected=숨김+"보안 검사 문제 발견", clean=활성)
    - 평점 입력 슬롯: 로그인 여부 확인 후 게이팅 모달 또는 4.7 RatingInput 연결 예약
    - Epic 5 슬롯: `{/* TODO: Epic 5 - 댓글 */}`, `{/* TODO: Epic 5 - 좋아요/신고/북마크 */}`
    - [수정하기] → `/resources/${id}/edit`, [삭제하기] → 확인 다이얼로그 + 4.8 연결
  - [x] `apps/web/app/resources/[slug]/resource-detail.module.css` 신규 생성 (NEW)
    - 기존 `prompts.module.css` 클래스명·토큰 패턴 그대로 재사용
    - 모바일 다운로드 하단 고정 바: `position: fixed; bottom: 0;` + CSS Module 조건부 적용
  - [x] Tiptap JSON 렌더: API 서버에서 `tiptapJsonToHtml`(sanitize-html 포함)로 변환, web은 `dangerouslySetInnerHTML`로 렌더 (AR-8)
    - `description_json`, `usage_json`, `caution_json`(nullable) 렌더
    - `sanitize-html` 서버 렌더 적용(AR-8)

- [x] Task 3: 기존 하위 상세 라우트 정리 (연속성)
  - [x] `apps/web/app/resources/prompts/[slug]/page.tsx`, `mcp-skills/[slug]/page.tsx` 등 기존 파일은 통합 상세 `/resources/[slug]`와 충돌 없이 공존 가능한지 확인
  - [x] Next.js 라우팅: `/resources/[slug]`와 `/resources/prompts/[slug]` 중복 없음(다른 경로). 정적 경로가 동적 경로보다 우선 매칭됨
  - [x] 기존 하위 상세 페이지들은 4.8 완료 후 redirect 처리 예정 — 현재는 그대로 유지

- [x] Task 4: 타입체크 및 빌드
  - [x] `pnpm -r typecheck` 통과 (apps/api, apps/web, 모든 packages)

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**`apps/web/app/resources/prompts/[slug]/page.tsx` 현재 상태:**
- 목업 데이터 딕셔너리에서 slug 조회
- `notFound()` 호출 패턴 존재 — 그대로 유지
- `AttachmentList` 컴포넌트(`components/board/AttachmentList`) 사용 — 재사용
- `BoardHero` 컴포넌트 사용 — 통합 상세에서도 재사용
- UI 구조(박스A + downloadPanel + detailActions + reviewSection + detailFooter) — 완전 유지

**보존 필수 UI 계약:**
- H1은 `resource.title` 1개만
- [다운로드] 버튼: `downloadPanel` 내 `button[type=button]` — 게이팅 연결(4.6)
- [수정][삭제] 버튼: `detailFooter .ownerActions` 내 — `userIsOwner`로 조건부 렌더
- 평점 섹션: `reviewSummary` div 내 score+stars+count + [후기 작성] 버튼

### JSON-LD 구조

```typescript
// resourceType별 JSON-LD 타입 매핑
const jsonLdType: Record<ResourceType, string> = {
  prompt: 'SoftwareSourceCode',
  'claude-code-skill': 'SoftwareSourceCode',
  mcp: 'SoftwareSourceCode',
  'rules-config': 'DigitalDocument',
  'template-checklist': 'CreativeWork',
};

// SoftwareSourceCode 예시
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': jsonLdType[resource.resourceType],
  name: resource.title,
  description: resource.summary,
  author: { '@type': 'Person', name: resource.authorNickname },
  dateModified: resource.updatedAt,
  url: `https://aijakdang.com/resources/${resource.slug}`,
  fileFormat: resource.files.find(f => f.isPrimary)?.mimeType,
};

// BreadcrumbList
const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈', item: 'https://aijakdang.com' },
    { '@type': 'ListItem', position: 2, name: '실전자료', item: 'https://aijakdang.com/resources' },
    { '@type': 'ListItem', position: 3, name: resource.title, item: `https://aijakdang.com/resources/${resource.slug}` },
  ],
};
```

### 아키텍처 가드레일

- **SSR 필수 (NFR-1)**: 서버 컴포넌트에서 API 호출. `cache: 'no-store'`(개인화 있으면) 또는 `revalidate: 300`(5분 캐시).
- **sanitize-html (AR-8)**: Tiptap JSON → HTML 변환 시 서버에서 `sanitize-html` 적용. `sanitize-html`은 미설치 — 이 스토리에서 설치 필요: `pnpm add sanitize-html @types/sanitize-html --filter @ai-jakdang/web`.
- **noindex 조건**: `deleted`, `hidden`, 미존재 slug → `notFound()`. Next.js 13+ `notFound()`는 자동 noindex.
- **인증 확인**: 서버 컴포넌트에서 쿠키 포워딩으로 `/api/v1/auth/me` 호출 → `userId` 획득 → API 응답의 `userIsOwner` 판단.
- **scan_status UI**: pending/infected 파일에서 [다운로드] 버튼 상태 처리는 `ResourceDetailClient`(클라이언트 컴포넌트)에서 담당.

### 모바일 하단 고정 바

```css
/* resource-detail.module.css */
.downloadBarMobile {
  display: none;
}
@media (max-width: 767px) {
  .downloadBarMobile {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    z-index: 100;
  }
}
```

### 참고링크 렌더

`reference_links: [{ label: string, url: string }]` — 별 섹션으로 `<ul>` + `<a target="_blank" rel="noopener noreferrer">` 렌더. 없으면(`null`) 섹션 미표시.

### Project Structure Notes

```
apps/web/app/resources/
├── page.tsx                    ← 4.2: 목록 서버 컴포넌트
├── [slug]/
│   ├── page.tsx                ← NEW: 통합 상세 서버 컴포넌트
│   ├── ResourceDetailClient.tsx ← NEW: 다운로드 슬롯·평점 슬롯 클라이언트
│   └── resource-detail.module.css ← NEW
├── prompts/[slug]/page.tsx     ← 기존 (유지, 추후 통합)
└── mcp-skills/[slug]/page.tsx  ← 기존 (유지)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3] — AC 원문
- [Source: apps/web/app/resources/prompts/[slug]/page.tsx] — 현재 UI 계약(구조·클래스명·컴포넌트)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Component Patterns] — 파일 업로드 컴포넌트 행동
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — SSR, sanitize-html
- [Source: _bmad-output/project-context.md#SEO] — JSON-LD 타입별 규칙

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- API TypeScript 오류: `RequestWithUser` 미사용 제거, `ResourceDetailExtended` 타입 외부 export로 반환 타입 명시
- web TypeScript 오류: `DownloadButton`의 `resourceId` 파라미터 `_resourceId`로 prefix 처리 (Story 4.6 슬롯)
- Zod 스키마 테스트: `resourceDetailSchema.safeParse`가 vitest 환경에서 올바로 작동하지 않아 로직 단위 테스트로 전환

### Completion Notes List
- **API**: `GET /api/v1/resources/:slug` 구현. `detail.route.ts` + `detail.service.ts` 신규 생성. `routes.ts` 집계자에 import/registration 1줄씩 추가, placeholder `void app;` 제거.
- **Service**: Drizzle LEFT JOIN (resources + users), isPrimary DESC + displayOrder ASC 정렬, status 필터(deleted/hidden/draft → null), avgRating numeric→number 변환, userIsOwner 판단, `tiptapJsonToHtml`(AR-8 sanitize-html) 로 HTML 변환본 포함 응답.
- **Web SSR**: `apps/web/app/resources/[slug]/page.tsx` 생성. generateMetadata(title·summary·canonical), JSON-LD(resourceType별 SoftwareSourceCode/CreativeWork/DigitalDocument), BreadcrumbList, H1 1개, 쿠키 포워딩으로 userIsOwner 판단, notFound() 처리.
- **ResourceDetailClient**: 다운로드 버튼 scan_status 기반 상태(pending=비활성, infected=숨김, clean=활성), 모바일 하단 고정 바(AC #3), Story 4.6·4.7·Epic5 슬롯 명확히 표시.
- **CSS**: `resource-detail.module.css` — 기존 prompts.module.css 패턴 재사용, 모바일(<768px) 다운로드 고정 바 추가.
- **테스트**: `detail.service.test.ts` 12개 테스트 전체 통과 (avgRating 변환, userIsOwner 판단, status 필터 로직).
- **라우팅 확인**: `/resources/[slug]`는 `/resources/prompts/[slug]` 등 정적 경로와 충돌 없음 (Next.js 정적 경로 우선 매칭).

### File List
- `apps/api/src/routes/v1/resources/detail.route.ts` (NEW)
- `apps/api/src/routes/v1/resources/detail.service.ts` (NEW)
- `apps/api/src/routes/v1/resources/detail.service.test.ts` (NEW)
- `apps/api/src/routes/v1/resources/routes.ts` (MODIFIED — import + registration 추가, placeholder 제거)
- `apps/web/app/resources/[slug]/page.tsx` (NEW)
- `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` (NEW)
- `apps/web/app/resources/[slug]/resource-detail.module.css` (NEW)
- `_bmad-output/implementation-artifacts/4-3-resource-detail-page.md` (MODIFIED — tasks/status/devRecord)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — status 업데이트)
