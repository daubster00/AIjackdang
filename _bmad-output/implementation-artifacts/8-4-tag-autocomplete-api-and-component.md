# Story 8.4: 태그 자동완성 API & 태그 입력 컴포넌트

Status: done

## Story

As a 게시글 작성자,
I want 태그 입력 시 자동완성 드롭다운과 인기 태그 추천을 제공받고,
so that 올바른 태그를 빠르게 찾아 붙이고 신규 태그도 자유롭게 생성할 수 있다.

## Acceptance Criteria

1. `GET /api/v1/tags/autocomplete?q=&limit=10` — q가 2자 이상일 때 `name ILIKE $q%` 또는 pg_trgm `bigm_similarity > 0.1` 매칭을 사용 수(`usage_count`) 내림차순으로 최대 10개 반환한다.
2. `GET /api/v1/tags/popular?limit=20` — Redis 캐시(키: `tags:popular`, TTL 1h)를 먼저 확인하여 hit 시 즉시 반환, miss 시 DB에서 최근 30일 빈도 집계 후 Redis에 저장하여 반환한다(AR-17).
3. 게시글 작성 폼(`PostWriteForm`) 태그 입력란에서 2자 이상 입력 시 자동완성 드롭다운이 열리고 "추천 태그" 섹션과 매칭 결과가 표시된다. 방향키로 항목 이동, Enter/Space로 선택 확정, Esc로 드롭다운 닫힘이 동작한다(UX-DR-U10).
4. 드롭다운 컨테이너는 `role="listbox"`, 각 항목은 `role="option"`, 입력 input에 `aria-haspopup="listbox"`, `aria-expanded`, `aria-activedescendant`가 적용된다(UX-DR-U7).
5. DB에 존재하지 않는 태그를 자유 입력한 후 Enter/쉼표로 확정하면 신규 `tags` 레코드가 생성(entity-when-needed)되고, 태그 칩이 표시되며 최대 10개 제한이 적용된다.
6. 태그 칩의 삭제 버튼을 클릭하거나 입력란이 빈 상태에서 Backspace를 누르면 마지막 태그가 제거된다. 각 삭제 버튼에는 `aria-label="태그 {name} 삭제"`가 붙는다(UX-DR-U9).
7. 헤더 검색창(`SearchAutocomplete`)이 포커스를 받으면 입력 전에는 "최근 검색어" + "추천 태그(`/api/v1/tags/popular`)를 보여주고, 입력 시 `/api/v1/tags/autocomplete?q=` 매칭 결과로 교체된다(UX-DR-U10, FR-6.4).

## Tasks / Subtasks

- [ ] Task 1: `packages/contracts/src/tag.ts` 신규 생성 — Zod 스키마 정의 (AC: #1, #2)
  - [ ] 1.1: `tagSchema` (id, name, usageCount, createdAt) 정의
  - [ ] 1.2: `tagAutocompleteQuerySchema` (q: min 2자, limit: default 10 max 20) 정의
  - [ ] 1.3: `tagPopularQuerySchema` (limit: default 20 max 50) 정의
  - [ ] 1.4: `packages/contracts/src/index.ts`에 re-export 추가

- [ ] Task 2: `apps/api/src/routes/v1/tags/` 신규 생성 — 두 엔드포인트 구현 (AC: #1, #2)
  - [ ] 2.1: `apps/api/src/routes/v1/tags/index.ts` 생성, Fastify ZodTypeProvider 플러그인으로 등록
  - [ ] 2.2: `GET /api/v1/tags/autocomplete` 핸들러 구현
    - q 파라미터 2자 미만이면 빈 배열 즉시 반환
    - Drizzle ORM `ilike(tags.name, \`${q}%\`)` 쿼리, `orderBy(desc(tags.usageCount))`, limit 적용
    - (선택) pg_trgm 확장 사용 가능 환경이면 `bigm_similarity > 0.1` 조건 추가
    - 응답: `{ items: TagItem[] }` (단일 객체, 페이지네이션 없음)
  - [ ] 2.3: `GET /api/v1/tags/popular` 핸들러 구현
    - Redis에서 `tags:popular` 키 조회 → hit 시 파싱 후 반환
    - miss 시: `taggables` join `tags`, 최근 30일(`created_at >= now() - 30d`) 빈도 집계, DESC 정렬, limit 적용, 결과를 Redis `SETEX tags:popular 3600 <json>` 저장 후 반환
    - Redis 인스턴스는 `apps/api/src/lib/redis.ts`에서 가져옴 (없으면 신규 생성)
  - [ ] 2.4: `apps/api/src/routes/v1/index.ts`에 태그 라우트 등록 (`app.register(tagRoutes, { prefix: '/tags' })`)

- [ ] Task 3: Redis 유틸 정비 (AC: #2)
  - [ ] 3.1: `apps/api/src/lib/redis.ts` 존재 여부 확인 후 없으면 생성 — `ioredis` 클라이언트, `packages/config`의 `REDIS_URL` 환경변수 사용
  - [ ] 3.2: `apps/api/src/lib/cache.ts` 신규 생성 또는 업데이트 — 캐시 키 상수 `CACHE_KEYS.TAGS_POPULAR = 'tags:popular'` 정의 (AR-17 규약: 캐시 키는 이 파일에서만 정의)

- [ ] Task 4: `apps/web/components/board/TagInput/` 신규 컴포넌트 생성 (AC: #3, #4, #5, #6)
  - [ ] 4.1: `apps/web/components/board/TagInput/TagInput.tsx` 생성
    - props: `value: string[]`, `onChange: (tags: string[]) => void`, `maxTags?: number` (기본 10), `placeholder?: string`
    - 내부 상태: `inputValue` (현재 입력 텍스트), `open` (드롭다운 열림), `suggestions` (자동완성 결과), `activeIndex` (방향키 포커스 인덱스)
    - `inputValue` 길이 >= 2이면 debounce(300ms) 후 `/api/v1/tags/autocomplete?q={inputValue}&limit=10` fetch
    - 드롭다운 패널 `role="listbox"`, 각 항목 `role="option"` + `id="tag-option-{i}"`, input에 `aria-haspopup="listbox"` + `aria-expanded={open}` + `aria-activedescendant={activeIndex >= 0 ? 'tag-option-{activeIndex}' : undefined}`
    - 키보드: ArrowDown/ArrowUp → `activeIndex` 이동, Enter/Space → `activeIndex` 항목 또는 `inputValue` 확정, Esc → 드롭다운 닫기, Backspace (inputValue 빈 상태) → 마지막 태그 제거
    - 태그 확정 로직: 선택/입력된 태그명이 suggestions에 없으면 `POST /api/v1/tags` (body: `{ name }`) 호출하여 신규 레코드 생성, 실패 시 무시하고 UI에는 추가 (entity-when-needed)
    - 태그 칩: 각 삭제 버튼 `aria-label="태그 {name} 삭제"`
  - [ ] 4.2: `apps/web/components/board/TagInput/TagInput.module.css` 생성 — 기존 `PostWriteForm.module.css`의 `.tagField`, `.tagChip`, `.tagInput`, `.suggestedTags` 스타일 참조하여 독립 모듈로 분리
  - [ ] 4.3: `apps/web/components/board/TagInput/index.ts` 생성 — barrel export

- [ ] Task 5: `PostWriteForm` 업데이트 — 신규 `TagInput` 컴포넌트로 교체 (AC: #3, #4, #5, #6)
  - [ ] 5.1: `apps/web/components/board/PostWriteForm.tsx` 수정
    - 기존 인라인 태그 상태(`tags`, `tagInput`, `handleAddTag`, `handleTagKeyDown`, `handleRemoveTag`)와 태그 입력 UI 블록 제거
    - `import { TagInput } from '@/components/board/TagInput'` 추가
    - 태그 섹션에 `<TagInput value={tags} onChange={setTags} maxTags={10} placeholder={config.tagPlaceholder} />` 삽입
    - `PostWriteFormConfig.suggestedTags` prop은 제거하거나 TagInput에 `suggestedTags` prop으로 전달 (하위 호환 유지 검토 필요)
  - [ ] 5.2: `PostWriteForm` 호출 측(각 게시판 write 페이지)에서 `suggestedTags` prop 제거 또는 유지 여부 확인 후 적용

- [ ] Task 6: `SearchAutocomplete` 업데이트 — 실제 API 연결 (AC: #7)
  - [ ] 6.1: `apps/web/components/board/SearchAutocomplete.tsx` 수정
    - 포커스 시 `popularTags` prop이 없거나 빈 배열이면 `/api/v1/tags/popular?limit=20` fetch (클라이언트 컴포넌트, `useEffect` + 포커스 이벤트)
    - 입력 중(`query.length >= 2`) `/api/v1/tags/autocomplete?q={query}&limit=10` fetch, debounce 300ms
    - fetch 결과로 드롭다운 교체 (기존 로컬 filter 로직 대체)
    - `SiteHeader`에서 `SearchAutocomplete`에 `popularTags` prop을 넘기지 않아도 동작하도록 변경 (서버 컴포넌트인 `SiteHeader`에서 prop 제거 또는 서버 사이드 프리패치 선택)
    - 로딩/에러 상태 처리: fetch 중에는 기존 popularTags 유지, 에러 시 조용히 fallback

- [ ] Task 7: `apps/api/src/routes/v1/tags/` — `POST /api/v1/tags` 엔드포인트 추가 (AC: #5)
  - [ ] 7.1: 인증된 사용자만 신규 태그 생성 가능 (`preHandler: [verifyAuth]`)
  - [ ] 7.2: body: `{ name: string (min 1, max 30) }`, 중복 시 기존 태그 반환 (upsert 또는 조회 후 반환), 신규 시 INSERT
  - [ ] 7.3: 성공 응답: `{ id, name, usageCount, createdAt }` (201 신규 / 200 기존)

- [ ] Task 8: 검증 (AC: #1~#7)
  - [ ] 8.1: Playwright로 `http://localhost:3003`의 헤더 검색창 포커스 시 인기 태그 노출 확인 (실제 API 응답 기반)
  - [ ] 8.2: 게시글 작성 폼에서 태그 2자 입력 → 드롭다운 표시, 방향키 이동, Enter 선택 → 칩 추가 확인
  - [ ] 8.3: 10개 태그 추가 후 추가 불가 확인
  - [ ] 8.4: 칩 X 버튼 클릭/Backspace 삭제 확인 및 `aria-label` 확인
  - [ ] 8.5: `GET /api/v1/tags/popular` 두 번 호출 시 두 번째는 Redis 응답 확인 (로그에서 "cache hit" 확인)

## Dev Notes

### 아키텍처 규칙 준수 사항

- **DB 접근**: `apps/api`와 `apps/worker`에서만 Drizzle ORM 0.38 사용. `apps/web`은 항상 API를 통해 데이터 접근.
- **Zod 스키마**: `packages/contracts/src/tag.ts` 신규 파일로 분리. `packages/contracts/src/index.ts`에서 re-export.
- **캐시 키 상수**: `apps/api/src/lib/cache.ts`에서만 정의. `CACHE_KEYS.TAGS_POPULAR = 'tags:popular'` (AR-17).
- **Redis TTL**: `tags:popular` 키는 3600초(1h).
- **도메인 로직**: 태그 집계/검색 비즈니스 로직이 복잡해지면 `packages/core`로 이동. 현 단계 API 핸들러 내 구현 허용.
- **API 경로**: `/api/v1/tags/autocomplete`, `/api/v1/tags/popular`, `/api/v1/tags` (POST) — 모두 `/api/v1/*` 접두사 준수.
- **환경 변수**: `REDIS_URL`은 `packages/config`의 Zod 환경변수 스키마에 추가 (없으면 추가 필요).

### 태그 DB 스키마 (선행 스토리에서 생성 전제)

```sql
-- tags 테이블
CREATE TABLE tags (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- taggables 다형성 조인 테이블
CREATE TABLE taggables (
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,  -- 'post' | 'question' | 'resource'
  target_id   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, target_type, target_id)
);
CREATE INDEX taggables_target_idx ON taggables(target_type, target_id);
CREATE INDEX taggables_recent_idx ON taggables(created_at);
```

### 자동완성 쿼리 (Drizzle ORM 예시)

```typescript
// apps/api/src/routes/v1/tags/index.ts
import { ilike, desc } from 'drizzle-orm';

const results = await db
  .select({ id: tags.id, name: tags.name, usageCount: tags.usageCount })
  .from(tags)
  .where(ilike(tags.name, `${q}%`))
  .orderBy(desc(tags.usageCount))
  .limit(limit);
```

### 인기 태그 집계 쿼리 (Drizzle ORM 예시)

```typescript
// miss 시 DB 집계
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const results = await db
  .select({ id: tags.id, name: tags.name, count: count(taggables.tagId) })
  .from(taggables)
  .innerJoin(tags, eq(taggables.tagId, tags.id))
  .where(gte(taggables.createdAt, thirtyDaysAgo))
  .groupBy(tags.id, tags.name)
  .orderBy(desc(count(taggables.tagId)))
  .limit(limit);

await redis.setex(CACHE_KEYS.TAGS_POPULAR, 3600, JSON.stringify(results));
```

### TagInput 컴포넌트 설계 주의사항

- `PostWriteForm`은 기존에 `suggestedTags: string[]` prop을 config에서 받아 "추천 태그" 칩으로 표시했다. 신규 `TagInput` 컴포넌트는 이 추천 태그를 API에서 자동으로 가져온다. `PostWriteFormConfig.suggestedTags`는 하위 호환을 위해 optional로 유지하거나, 게시판별 호출 측 코드를 함께 수정한다.
- 현재 `PostWriteForm`의 `MAX_TAGS`는 5로 설정되어 있으나, `createPostSchema` (`packages/contracts/src/post.ts`)에는 `max(10)`으로 정의되어 있다. Story 8.4에서 `TagInput`의 기본값을 10으로 통일한다.
- 기존 `PostWriteForm` 내 태그 관련 state: `tags`, `tagInput`, `handleAddTag`, `handleTagKeyDown`, `handleRemoveTag`. `TagInput` 컴포넌트 교체 후 이 state들을 제거한다.
- 드롭다운 blur 처리: 항목 클릭 시 blur보다 click이 먼저 처리되도록 `onMouseDown={e => e.preventDefault()}` 패턴 적용 (기존 `SearchAutocomplete` 참조).

### SearchAutocomplete 수정 범위

- `apps/web/components/site/SiteHeader.tsx`에서 `SearchAutocomplete`에 `popularTags` prop을 넘기는 부분 확인 후 제거 또는 유지.
- `SearchAutocomplete`는 `"use client"` 클라이언트 컴포넌트이므로 `useEffect` 내에서 fetch 가능.
- fetch URL: `process.env.NEXT_PUBLIC_API_BASE_URL + '/api/v1/tags/popular?limit=20'` (또는 Next.js route handler 프록시).

### Project Structure Notes

```
apps/
  api/src/
    lib/
      redis.ts          [NEW or CHECK]  — ioredis 클라이언트 싱글톤
      cache.ts          [NEW]           — CACHE_KEYS 상수 (AR-17)
    routes/v1/
      tags/
        index.ts        [NEW]           — GET autocomplete, GET popular, POST (생성)
      index.ts          [UPDATE]        — tagRoutes 등록
  web/components/
    board/
      TagInput/
        TagInput.tsx    [NEW]           — 태그 자동완성 입력 컴포넌트
        TagInput.module.css [NEW]
        index.ts        [NEW]           — barrel export
      PostWriteForm.tsx [UPDATE]        — TagInput으로 태그 섹션 교체
      SearchAutocomplete.tsx [UPDATE]   — 실제 API 연결
packages/
  contracts/src/
    tag.ts             [NEW]            — tagSchema, autocomplete/popular 쿼리 스키마
    index.ts           [UPDATE]         — tag.ts re-export
```

### References

- AR-17 (Redis 캐싱 전략): popular content TTL 1h, 캐시 키 `cache.ts` 집중 관리
- UX-DR-U7 (접근성): listbox/option ARIA 역할
- UX-DR-U9 (태그 삭제): `aria-label="태그 {name} 삭제"`
- UX-DR-U10 (검색 자동완성): 포커스 시 인기 태그, 입력 시 매칭 결과
- FR-6.4 (헤더 검색): 실시간 태그 자동완성
- `packages/contracts/src/post.ts`: `createPostSchema.tags` max(10) — TagInput 최대값 근거
- `apps/web/components/board/SearchAutocomplete.tsx`: 기존 목업 구조 및 DEFAULT_POPULAR 대체 대상
- `apps/web/components/board/PostWriteForm.tsx`: L88-89 (`tags`, `tagInput` state), L541-563 (handleAddTag/TagKeyDown/RemoveTag), L967-1018 (태그 UI 블록) — 교체 대상

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
