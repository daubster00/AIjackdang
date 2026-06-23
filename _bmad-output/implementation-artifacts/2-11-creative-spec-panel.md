# Story 2.11: AI 창작마당 창작물 스펙 — 선택 입력 + 상세 우측 패널

Status: ready-for-dev

## Story

As a AI 창작마당에 창작물을 올리는 회원,
I want 사용한 AI 툴·프롬프트·파라미터 등 제작 스펙을 선택적으로 첨부하기를,
so that 다른 사람이 내 창작물을 어떻게 만들었는지 이해하고 재현·학습할 수 있다(FR-5.2).

## Acceptance Criteria

1. `post_creative_spec` 테이블이 `packages/database`에 추가된다. 컬럼: `post_id` uuid PK·FK(`posts.id`, ON DELETE CASCADE)·`media_type` enum(`image`/`video`/`audio`/`3d`/`etc` nullable)·`tools` jsonb(배열: `{name, model?, role}`)·`prompt` text nullable·`negative_prompt` text nullable·`params` jsonb(자유 key-value)·`postprocess` jsonb nullable·`cost_type` enum(`free`/`paid` nullable)·`time_spent` text nullable·`license_note` text nullable·`created_at`/`updated_at` timestamptz. 전 필드 nullable(선택).
2. `packages/contracts/src/post.ts`에 `creativeSpecSchema`(Zod, 전 필드 optional)가 추가된다. api·web import 시 typecheck 통과.
3. `/lounge/ai-creation` 글쓰기 폼에서 [창작 스펙 추가] 접이식 섹션 동작: 미입력 시 spec 레코드 없이 글 등록, 입력 시 `post_creative_spec` 1:1로 저장. 다른 board에서는 이 섹션 미노출(`hasCreativeSpec` 플래그 기준).
4. 창작 스펙 있는 글 상세(`/lounge/ai-creation/{slug}`) 데스크톱 렌더: 본문 우측 사이드 패널에 창작 스펙(툴·프롬프트·파라미터·후처리·라이선스) 표시. 프롬프트/네거티브는 코드블록형 + 복사 버튼. 모바일: 본문 하단으로 접혀 노출.
5. 스펙 없는 창작마당 글 상세: 우측 패널 없이 단일 컬럼 레이아웃 유지. 레이아웃 깨짐 없음.
6. 창작물 스펙 입력값(프롬프트 등): XSS 새니타이즈(2.6 패턴 재사용)·길이 제한 적용. ImageObject/VideoObject JSON-LD에 `creator`/툴 정보 가능 시 보강(FR-11.5, 과도 금지).
7. `pnpm typecheck` 통과.

## Tasks / Subtasks

- [ ] Task 1: post_creative_spec 스키마 생성 (AC: #1)
  - [ ] `packages/database/src/schema/post-creative-spec.ts` NEW
  - [ ] `pgEnum("media_type_enum", ["image","video","audio","3d","etc"])` 정의
  - [ ] `pgEnum("cost_type_enum", ["free","paid"])` 정의
  - [ ] `post_creative_spec` 테이블:
    - `post_id`: `uuid("post_id").primaryKey().references(() => posts.id, { onDelete: "cascade" })`
    - `media_type`: `mediaTypeEnum("media_type")` nullable
    - `tools`: `jsonb("tools")` nullable (배열 `{name:string, model?:string, role?:string}[]`)
    - `prompt`: `text("prompt")` nullable
    - `negative_prompt`: `text("negative_prompt")` nullable
    - `params`: `jsonb("params")` nullable (자유 key-value)
    - `postprocess`: `jsonb("postprocess")` nullable
    - `cost_type`: `costTypeEnum("cost_type")` nullable
    - `time_spent`: `text("time_spent")` nullable
    - `license_note`: `text("license_note")` nullable
    - `created_at`, `updated_at` timestamptz
  - [ ] `packages/database/src/schema/index.ts` UPDATE: re-export
  - [ ] `drizzle-kit generate && migrate` 실행

- [ ] Task 2: creativeSpecSchema Zod 계약 (AC: #2)
  - [ ] `packages/contracts/src/post.ts` UPDATE (또는 별도 `creative-spec.ts` NEW)
  - [ ] `aiToolSchema`: `z.object({ name: z.string(), model: z.string().optional(), role: z.string().optional() })`
  - [ ] `creativeSpecSchema`: 전 필드 `.optional()` - `mediaType`, `tools: z.array(aiToolSchema)`, `prompt`, `negativePrompt`, `params: z.record(z.string())`, `postprocess`, `costType`, `timeSpent`, `licenseNote`
  - [ ] `createPostWithSpecSchema`: `createPostSchema` + `creativeSpec: creativeSpecSchema.optional()`
  - [ ] `packages/contracts/src/index.ts` UPDATE

- [ ] Task 3: API `POST /api/v1/posts` 창작 스펙 연동 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: `board='ai-creation'` 요청에 `creativeSpec` 필드 추가 처리
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `createPost` 함수
    - `db.transaction()` 내부:
      - posts INSERT (기존)
      - `creativeSpec`이 있으면 `post_creative_spec` INSERT (post_id 연결)
      - XSS 새니타이즈: prompt·negativePrompt 필드에 `sanitizeHtml` 적용
  - [ ] `GET /api/v1/posts/{slug}` UPDATE: `creativeSpec` JOIN으로 함께 반환
    - LEFT JOIN `post_creative_spec ON post_creative_spec.post_id = posts.id`
    - `postDetailSchema` UPDATE: `creativeSpec?: CreativeSpec | null` 필드 추가

- [ ] Task 4: 글쓰기 폼 CreativeSpecFields 연동 (AC: #3)
  - [ ] **기존 `apps/web/app/lounge/write/CreativeSpecFields.tsx` 완독 필수** (현재 mock 구현)
  - [ ] 현재: 전 필드 useState, 제출 시 `alert("등록 기능은 아직 개발 중")`
  - [ ] UPDATE: `onSpecChange?: (spec: CreativeSpec | null) => void` prop 추가 또는 상위 폼과 통합
  - [ ] `apps/web/app/lounge/write/page.tsx` UPDATE: `PostWriteForm`의 제출 시 `creativeSpec` 데이터 함께 전송
  - [ ] `hasCreativeSpec` 플래그로 다른 board에서는 `CreativeSpecFields` 미노출 확인

- [ ] Task 5: 상세 CreativeSpecPanel API 연동 (AC: #4, #5)
  - [ ] **기존 `apps/web/app/lounge/[slug]/CreativeSpecPanel.tsx` 완독 필수**
  - [ ] 현재: mock `CreativeSpec` 타입 기반 렌더 구현 완료(툴·프롬프트·파라미터·후처리·라이선스 표시, 복사 버튼, 모바일 하단 노출)
  - [ ] UPDATE: prop `spec: CreativeSpec | null | undefined` → API 응답 `postDetail.creativeSpec`으로 대체
  - [ ] `apps/web/app/lounge/[slug]/page.tsx` UPDATE: API fetch 후 `creativeSpec` prop 전달
  - [ ] 스펙 없으면 `CreativeSpecPanel` null 반환 → 단일 컬럼 레이아웃(기존 `hasSpec` 조건 로직 유지)

- [ ] Task 6: JSON-LD 보강 (AC: #6, 선택)
  - [ ] `apps/web/lib/seo/jsonld.ts` UPDATE: `buildArticleJsonLd` 또는 신규 `buildCreativeWorkJsonLd`
  - [ ] mediaType이 `image`이면 `ImageObject`, `video`이면 `VideoObject` 추가
  - [ ] `creator` 필드: tools[0].name 사용 (툴이 없으면 생략)
  - [ ] **과도 금지**: JSON-LD가 무결해야 하므로 선택 필드 누락 시 해당 속성 제외

- [ ] Task 7: typecheck 통과 (AC: #7)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **1:1 관계**: `post_creative_spec.post_id` = `posts.id` PK+FK. 한 post에 최대 1개. CASCADE delete.
- **선택 입력**: 전 필드 nullable. spec 자체도 없을 수 있음 (`post_creative_spec` 레코드 미존재).
- **XSS**: prompt 필드는 사용자 자유 텍스트 → `sanitize-html` 적용 필수. 단, 코드블록형으로 렌더되므로 HTML이 아닌 text로 취급해도 되나, 안전하게 sanitize 적용.
- **hasCreativeSpec 플래그**: `BOARDS['ai-creation'].hasCreativeSpec = true`. 다른 board는 false/undefined. 이 플래그로 글쓰기 폼·상세 패널 조건부 렌더.

### 기존 코드 분석 (프론트 선구현 — 반드시 완독)
**`apps/web/app/lounge/write/CreativeSpecFields.tsx`** (완독 완료):
- 전 필드 useState로 로컬 관리
- 툴 행 추가형(`toolRows`), 파라미터 key-value 행 추가형(`params`)
- `media_type` = "창작물 유형" 칩 선택 (CREATION_TYPES: 이미지/영상/오디오·음악/3D/기타)
- `cost_type` = 유료/무료 라디오
- `license_note` = `license` 텍스트 + `commercial` 상업적 사용 라디오 (별개 필드로 구현됨, DB는 `license_note` 단일 필드 → 병합 필요)
- `postprocess` = 텍스트 영역
- **보존**: UI 구조·컴포넌트. `onSpecChange` prop 추가만.

**`apps/web/app/lounge/[slug]/CreativeSpecPanel.tsx`** (완독 필수):
- `CreativeSpec` 타입: `{ types, tools, prompt, negPrompt, params, postProcess, costType, duration, license, commercial }`
- 이 타입이 DB 스키마/Zod와 일치하도록 매핑 필요
- 패널 UI: 이미 구현됨 (툴·프롬프트 코드블록·복사 버튼·파라미터·후처리·라이선스 섹션)
- 모바일: CSS로 하단 이동 처리됨

**현재 CreativeSpec 타입 vs DB 컬럼 매핑**:
- `types[]` → `media_type` (단일 또는 배열 정책 결정 필요: DB는 enum 단일, 현재 UI는 다중 선택)
  - 결정: `tools` jsonb에 type 정보를 포함하거나, `media_type`을 jsonb 배열로 변경
  - **권장**: DB `media_type` = jsonb (배열 허용)로 변경 (마이그레이션 수정)
- `types` → `media_type`(jsonb 배열)
- `tools` → `tools` jsonb
- `prompt` → `prompt`
- `negPrompt` → `negative_prompt`
- `params` → `params`
- `postProcess` → `postprocess`
- `costType` → `cost_type` (유료/무료 → paid/free enum)
- `duration` → `time_spent`
- `license` + `commercial` → `license_note` (병합: "CC BY-NC 4.0 / 상업: 불가")

### contracts 타입 정합성
`CreativeSpec` 타입은 `creativeSpecSchema`에서 추론. 프론트(`CreativeSpecPanel`)의 로컬 타입과 합일.

### Project Structure Notes
- NEW: `packages/database/src/schema/post-creative-spec.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- UPDATE: `packages/contracts/src/post.ts` (creativeSpecSchema)
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/lounge/write/CreativeSpecFields.tsx`
- UPDATE: `apps/web/app/lounge/write/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/CreativeSpecPanel.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- OPTIONAL UPDATE: `apps/web/lib/seo/jsonld.ts`
- AUTO-GENERATED: drizzle migration SQL

### References
- [Source: epics.md#Story 2.11 AC]
- [Source: architecture.md#Data Architecture — post_creative_spec (2026-06-22 추가)]
- [Source: project-context.md#응답 & 데이터 포맷]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/database/src/schema/post-creative-spec.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- UPDATE: `packages/contracts/src/post.ts`
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/lounge/write/CreativeSpecFields.tsx`
- UPDATE: `apps/web/app/lounge/write/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/CreativeSpecPanel.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- AUTO-GENERATED: `packages/database/drizzle/migrations/*.sql`
