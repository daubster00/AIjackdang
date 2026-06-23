# Story 4.9: 마이페이지 자료 탭 + 자료 CollectionPage JSON-LD

Status: ready-for-dev

## Story

As a 방문자·회원,
I want 실전자료 목록이 검색엔진에 색인되고 마이페이지에서 내 자료를 관리하기를,
So that SEO 노출이 강화되고 내 기여 이력을 파악한다.

## Acceptance Criteria

1. `/resources/prompts`, `/resources/mcp-skills`, `/resources/rules`, `/resources/templates` 각 목록 SSR 렌더 시(또는 `/resources` 인덱스 페이지), `<script type="application/ld+json">` CollectionPage JSON-LD(`name`, `description`, `url`, `hasPart`: 해당 유형 published 자료 상위 10개의 `{@type, name, url}` 배열)가 포함된다(FR-11.5). 4개 독립 페이지 구조 기준(규칙⑧).
2. 회원이 `/mypage` 자료 탭 진입 시 본인 등록 자료 목록(상태 배지·제목·다운로드수·평점·등록일) + [수정/삭제] 인라인 버튼이 렌더된다.
3. 등록 자료 없음 상태에서 `EmptyState` + [첫 자료 등록하기] 버튼이 표시된다(UX-DR-U11).
4. 운영자가 `status=hidden` 처리한 자료의 경우 등록자 자료 탭에 "숨김 처리됨" 배지·사유 안내가 표시된다(FR-4.8).
5. 각 독립 페이지(`/resources/prompts` 등) 필터 쿼리 포함 URL의 `generateMetadata`에서 유형명 포함 고유 title, canonical은 필터 없는 해당 페이지 기본 URL(예: `/resources/prompts`)이 적용된다(중복 색인 방지, FR-11.1·NFR-8). 통합 `/resources` canonical 사용 금지(규칙⑧).
6. 마이페이지 자료 탭 API `GET /api/v1/me/resources`가 본인 자료 전체(draft/published/hidden 포함, deleted 제외)를 반환한다.
7. 마이페이지 자료 탭에서 [삭제하기] 클릭 시 확인 다이얼로그 → 삭제 API 호출 → 목록 갱신.
8. 마이페이지 자료 탭에서 `status=draft` 자료에 "임시저장" 배지·[이어 작성하기] 버튼이 표시된다.

## Tasks / Subtasks

- [ ] Task 1: CollectionPage JSON-LD 추가 (AC: #1)
  - [ ] **기존 코드 완독**: 4개 독립 페이지 확인
    - `apps/web/app/resources/prompts/page.tsx`
    - `apps/web/app/resources/mcp-skills/page.tsx`
    - `apps/web/app/resources/rules/page.tsx`
    - `apps/web/app/resources/templates/page.tsx`
  - [ ] 각 독립 페이지에 유형별 CollectionPage JSON-LD 추가:
    - 각 `page.tsx` UPDATE: `<script type="application/ld+json">` 추가(generateMetadata가 아닌 페이지 직접 렌더)
    - API 호출: `GET /api/v1/resources?type={해당유형}&pageSize=10&sort=downloads` — 해당 유형 상위 10개
    - JSON-LD 예시(prompts 페이지):
      ```json
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "프롬프트 자료 — AI작당",
        "description": "바로 복사해서 쓰는 재사용 가능한 프롬프트 자료 모음",
        "url": "https://aijakdang.com/resources/prompts",
        "hasPart": [
          { "@type": "SoftwareSourceCode", "name": "...", "url": "..." },
          ...
        ]
      }
      ```
    - `hasPart` 배열: 해당 유형 상위 10개 자료를 `resourceType`에 따라 `@type` 설정(4.3 JSON-LD 타입 매핑 재사용)
  - [ ] 통합 `/resources` 인덱스 페이지(존재 시)에도 전체 자료 CollectionPage JSON-LD 추가 가능하나, 4개 독립 페이지 각각이 주요 대상

- [ ] Task 2: generateMetadata 필터 메타 처리 (AC: #5)
  - [ ] 각 독립 페이지의 `generateMetadata` 함수 보완:
    - `apps/web/app/resources/prompts/page.tsx` UPDATE
    - `apps/web/app/resources/mcp-skills/page.tsx` UPDATE
    - `apps/web/app/resources/rules/page.tsx` UPDATE
    - `apps/web/app/resources/templates/page.tsx` UPDATE
    - 필터 쿼리(`?difficulty=beginner` 등) 포함 시에도 canonical은 해당 페이지 기본 URL로 고정(중복 색인 방지)
    ```typescript
    // apps/web/app/resources/prompts/page.tsx 예시
    export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
      return {
        title: '프롬프트 자료 — AI작당',
        description: '바로 복사해서 쓰는 재사용 가능한 프롬프트 자료 모음',
        alternates: { canonical: 'https://aijakdang.com/resources/prompts' }, // 필터 제거
      };
    }
    ```
    - 각 페이지마다 canonical을 자기 경로로 고정. 통합 `/resources`로 canonical 설정 금지(규칙⑧).

- [ ] Task 3: 마이페이지 자료 탭 API (AC: #6)
  - [ ] `apps/api/src/routes/v1/me/resources.route.ts` 신규 생성 (NEW)
    - `GET /api/v1/me/resources` — 인증 필수, 본인 자료만
    - 반환: `{ items: MyResourceCard[], meta: PaginationMeta }`
    - `MyResourceCard`: `id`, `slug`, `title`, `status`, `hiddenReason`(nullable), `downloadCount`, `avgRating`, `ratingCount`, `createdAt`, `updatedAt`
  - [ ] `apps/api/src/routes/v1/me/` 디렉토리 신규 생성 또는 기존 구조에 통합 (NEW)
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: `/me/resources` 라우트 등록
  - [ ] `packages/contracts/src/resource.ts` UPDATE: `myResourceCardSchema` 추가

- [ ] Task 4: 마이페이지 자료 탭 UI 구현 (AC: #2, #3, #4, #7, #8)
  - [ ] **기존 코드 완독**: `apps/web/app/mypage/page.tsx` 전체 완독 (핵심)
  - [ ] 현재 마이페이지 코드 분석:
    - `TabKey` = `"posts" | "comments" | "bookmarks" | "likes" | "following" | "followers"` — `resources` 탭 없음
    - `BoardKey.resources` → `{ label: "실전자료", base: "/resources/mcp-skills" }` — 내가 쓴 글에 자료 항목 있음
    - 현재 구현: `myPosts` 배열에 `board: "resources"` 항목이 포함됨(목업)
    - 자료 탭을 별도 `TabKey` 추가 vs 기존 `posts` 탭에 통합 결정 필요
  - [ ] ⚠️ **UI 계약 판단**:
    - 기존 `TabKey`에 `resources`가 없음 → 신규 탭 추가는 UI 계약 확장(변경은 아님, 승인 불필요)
    - **`/me/activity` 별도 라우트 생성 금지(규칙①)**. `/mypage` 탭 확장으로만 처리.
    - 권장: `/mypage` 기존 탭 구조에 `resources` 탭 추가
  - [ ] `apps/web/app/mypage/page.tsx` UPDATE:
    - `tabs` 배열에 `{ key: 'resources', label: '내 자료', icon: 'file-download-line' }` 추가
    - `TabKey` 타입에 `'resources'` 추가
    - `resources` 탭 컨텐츠: `MyResourceList` 컴포넌트 렌더
  - [ ] `apps/web/app/mypage/MyResourceList.tsx` 신규 생성 (NEW)
    - `GET /api/v1/me/resources` 호출
    - 자료 행: 상태 배지 + 제목 + 다운로드수 + 평점 + 등록일 + [수정][삭제] 버튼
    - 상태 배지 매핑:
      - `published` → success 배지
      - `draft` → warning 배지 "임시저장" + [이어 작성하기] 링크
      - `hidden` → danger 배지 "숨김 처리됨" + `hiddenReason` 텍스트
    - EmptyState: `@/components/ui` EmptyState 재사용 + [첫 자료 등록하기] 버튼(→ `/resources/new`)
    - [수정] → `/resources/${id}/edit`
    - [삭제] → 확인 다이얼로그 → `DELETE /api/v1/resources/${id}` → 목록 갱신

- [ ] Task 5: 타입체크 및 검증
  - [ ] `pnpm typecheck` 통과
  - [ ] CollectionPage JSON-LD 구조 검증(Google Rich Results Test 기준 확인)

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**`apps/web/app/mypage/page.tsx` 현재 탭 구조:**
```typescript
type TabKey = "posts" | "comments" | "bookmarks" | "likes" | "following" | "followers";
const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "posts", label: "내가 쓴 글", icon: "article-line" },
  { key: "comments", label: "내 댓글", icon: "chat-1-line" },
  { key: "bookmarks", label: "북마크", icon: "bookmark-line" },
  { key: "likes", label: "좋아요한 글", icon: "heart-3-line" },
  { key: "following", label: "팔로잉", icon: "user-follow-line" },
  { key: "followers", label: "팔로워", icon: "user-heart-line" },
];
```
**보존 필수**: 기존 탭 순서·구조·클래스명. `resources` 탭은 맨 뒤에 추가(또는 posts 다음).

**기존 `boardKey.resources` 처리:**
```typescript
const BOARDS: Record<BoardKey, ...> = {
  resources: { label: "실전자료", tone: "neutral", base: "/resources/mcp-skills" },
```
→ `base` 경로: 기존 `/resources/mcp-skills`가 이미 독립 페이지 경로로 올바름. 통합 `/resources` 단일 경로로 바꾸지 않음(규칙⑧). 필요 시 유형 특성에 맞는 독립 경로 유지.

**마이페이지는 `/mypage` 단일 라우트 탭 구조 (MEMORY 규칙)**: 별도 라우트(`/mypage/resources`) 만들지 않음. 탭 확장으로만 처리.

### CollectionPage JSON-LD 위치

Next.js에서 JSON-LD 삽입 방법:
```tsx
// page.tsx 서버 컴포넌트
const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', ... };
return (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <main>...</main>
  </>
);
```
`dangerouslySetInnerHTML`은 서버 렌더 JSON-LD에서 허용(XSS 위험 없음 — 서버에서 구조화된 객체 직렬화).

### 자료 탭 행 레이아웃 (기존 posts 탭 패턴 참조)

```
[상태배지] [제목] ........... [다운로드 N] [★ 4.8] [2026.06.18] [수정][삭제]
```
기존 `myPosts` 행 스타일(`styles.postItem` 등) 패턴을 자료 행에도 동일하게 적용.

### 아키텍처 가드레일

- **SSR (NFR-1)**: CollectionPage JSON-LD는 서버 컴포넌트 렌더. API 호출은 서버에서.
- **canonical 고정 (NFR-8)**: 필터 URL의 canonical을 각 독립 페이지의 기본 URL(예: `/resources/prompts`)로 고정. 통합 `/resources`를 canonical로 쓰지 않음(규칙⑧). 중복 색인 방지.
- **hasPart 항목 수**: 상위 10개 제한(Google 권장). 너무 많으면 JSON-LD 크기 문제.
- **`/me/activity` 금지 (규칙①)**: `/me/activity` 별도 라우트 생성 금지. 자료 관리는 `/mypage` 탭으로만 처리. `GET /api/v1/me/resources` API는 `/mypage` 자료 탭에서 호출.
- **마이페이지 단일 라우트 (MEMORY 규칙)**: `별도 라우트 만들지 말 것` — `/mypage?tab=resources` 또는 탭 상태로만 처리.

### API me/resources 상태 필터

```typescript
// 본인 자료 목록: draft + published + hidden (deleted 제외)
await db.select().from(resources)
  .where(and(
    eq(resources.userId, userId),
    notInArray(resources.status, ['deleted'])
  ))
  .orderBy(desc(resources.createdAt));
```

### Project Structure Notes

```
apps/web/app/
├── resources/
│   ├── prompts/page.tsx      ← UPDATE: CollectionPage JSON-LD + generateMetadata canonical
│   ├── mcp-skills/page.tsx   ← UPDATE: CollectionPage JSON-LD + generateMetadata canonical
│   ├── rules/page.tsx        ← UPDATE: CollectionPage JSON-LD + generateMetadata canonical
│   └── templates/page.tsx    ← UPDATE: CollectionPage JSON-LD + generateMetadata canonical
└── mypage/
    ├── page.tsx              ← UPDATE: resources 탭 추가 (/mypage 탭 확장, 별도 라우트 금지)
    ├── MyResourceList.tsx    ← NEW: 내 자료 탭 컴포넌트
    └── mypage.module.css     ← UPDATE: 자료 행 스타일 추가(필요 시)

apps/api/src/routes/v1/
└── me/
    └── resources.route.ts    ← NEW: GET /api/v1/me/resources

packages/contracts/src/
└── resource.ts               ← UPDATE: myResourceCardSchema 추가
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.9] — AC 원문
- [Source: apps/web/app/mypage/page.tsx] — 탭 구조·BoardKey 현재 상태
- [Source: apps/web/app/resources/prompts/page.tsx] — 기존 독립 페이지 구조 기준
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#SEO] — CollectionPage 규칙
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — SEO 구현 패턴
- [Source: _bmad-output/project-context.md#SEO] — JSON-LD 타입별 규칙
- [Source: memory/MEMORY.md] — 마이페이지는 /mypage 단일 라우트 탭 구조 규칙
- [Source: _STORY-CORRECTION-SPEC.md#규칙①] — 마이페이지는 /mypage 단일 라우트 탭 구조 (/me 경로 금지)
- [Source: _STORY-CORRECTION-SPEC.md#규칙⑧] — 4개 독립 페이지 유지, 통합 탭 재편 금지

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
