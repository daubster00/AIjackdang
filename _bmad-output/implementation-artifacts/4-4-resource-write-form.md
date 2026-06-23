---
baseline_commit: 1259d49a1bed13dbd39739ae7d1e9157bf7a30a9
---

# Story 4.4: 자료 등록 폼 (7-Step 구조 + 저작권 동의 + 임시저장)

Status: review

## Story

As a 회원,
I want 7단계 폼 흐름(유형선택→공통정보→첨부파일→사용법/주의사항→태그→미리보기→등록)으로 자료를 등록하기를,
So that 어떤 유형이든 같은 경험으로 빠르게 기여한다.

## Acceptance Criteria

1. 비회원이 [등록] 클릭 시 로그인 유도 모달이 표시되며, 로그인 후 `/resources/new`로 `redirectTo` 복귀한다(UX-DR-U1·FR-4.8).
2. **Step 1(유형 선택)**: 6개 유형 카드(프롬프트/Claude Code Skill/MCP/Rules·설정/템플릿·체크리스트) 표시, 선택 시 Step 2로 이동, 선택 유형이 상단 스텝 헤더에 고정 표시된다. [다음] 버튼으로 진행.
3. **Step 2(공통 정보)**: 제목(min 2, max 150), 한줄설명(min 1, max 300), 지원환경 체크박스(다중), 난이도 Select, "이 자료는 무엇인가요" Tiptap `full` 에디터(AR-8). 유형별 안내 문구만 다르고 구조 동일(FR-4.4). [이전]/[다음] 버튼.
4. **Step 3(첨부파일)**: 드래그앤드롭/클릭 업로드, 허용 확장자(.zip .md .txt .json .pdf .docx .xlsx), 최대 3개, 대표파일 1개 지정, 50MB/개 초과·미허용 확장자 시 인라인 오류(UX-DR-U9·FR-4.5). [이전]/[다음] 버튼.
5. **Step 4(사용법/주의사항)**: 사용법 필수(Tiptap `lite`), 주의사항 선택(Tiptap `lite`). [이전]/[다음] 버튼.
6. **Step 5(태그)**: 자유 입력 + 자동완성, 최대 10개(FR-6.4). [이전]/[다음] 버튼.
7. **Step 6(미리보기)**: 상세 페이지와 동일 레이아웃으로 미리보기. [수정하기]로 해당 Step 복귀 가능. [이전]/[다음] 버튼.
8. **Step 7(등록)**: 저작권 동의 미체크 시 등록 버튼 비활성. 체크박스 레이블: "이 자료의 저작권을 보유하거나 배포 권한이 있음을 확인합니다"(FR-14.2). [이전]/[등록] 버튼.
9. 동의 체크 후 [등록] → `POST /api/v1/resources` → `copyright_agreed=true`, `status=published` 생성, 첨부 S3 업로드·`scan_status=pending`, 자료 상세(`/resources/{pageType}/{slug}`)로 이동 + 성공 토스트.
10. 이탈/[임시저장] → `status=draft`로 저장, `/mypage` 자료 탭에서 재편집 가능(규칙①: `/me/activity` 아님), 본인만 열람.
11. 등록 API 오류 시 danger 토스트 + 입력 유지 + 제출 중 버튼 비활성(UX-DR-U11).
12. 상단 스텝 진행 표시자(Step 1/7 ~ 7/7)가 항상 표시되며, 완료된 Step은 클릭으로 직접 이동 가능(단, 미완료 Step은 순서대로만 진행).

## Tasks / Subtasks

- [x] Task 1: 비회원 게이팅 및 라우트 보호 (AC: #1)
  - [x] `apps/web/app/resources/new/page.tsx` 신규 생성 (NEW)
    - 서버 컴포넌트에서 세션 확인: 미인증 시 `redirect(/login?redirectTo=/resources/new)` 또는 클라이언트 게이팅 모달
    - 클라이언트 진입 시 `useMockAuth` → 비회원이면 로그인 유도 모달 표시

- [x] Task 2: 자료 등록 API 구현 (AC: #9, #10)
  - [x] `apps/api/src/routes/v1/resources/write.route.ts` 신규 생성: `POST /api/v1/resources` 및 `POST /api/v1/resources/draft` 라우트
    - 인증 필수(401 if 미인증)
    - `fastify-type-provider-zod` + `createResourceSchema` body 검증
    - 응답: 201 + `{ id, slug, resourceType, status, pageType }`
  - [x] `apps/api/src/routes/v1/resources/write.service.ts` 신규 생성: `createResource(userId, input)` 함수
    - `packages/utilities` `slugify` + `generateUniqueSlug` 로 slug 생성(중복 시 nanoid6 suffix)
    - `db.transaction()` 내: `resources` insert + tags upsert + `taggable` insert(배치)
    - 파일 처리는 4.5 파이프라인 담당 — 파일 메타 DB insert 없이 메타만 등록(4.5 엔드포인트로 위임)
    - `copyright_agreed` 저장, `status = 'draft'` or `'published'` 처리
  - [x] `apps/api/src/routes/v1/resources/routes.ts` 업데이트: write.route import + 등록 추가

- [x] Task 3: 7-Step 자료 등록 폼 구현 (AC: #2~#12)
  - [x] **기존 코드 완독**: `apps/web/app/resources/prompts/write/ResourceWriteForm.tsx` 완독 — 기존 필드·스타일 패턴 파악 후 재사용
  - [x] `apps/web/app/resources/new/ResourceWriteForm.tsx` 신규 생성 (NEW) — 7-Step 통합 등록 폼
    - Step 1~7 전체 구현 (유형선택→공통정보→첨부파일→사용법/주의사항→태그→미리보기→등록)
    - Tiptap `full`/`lite` 에디터 재사용, dropzone/tag 로직 재사용
    - 저작권 동의 미체크 시 등록 버튼 disabled
    - 임시저장 및 등록 API 연결, danger/success 토스트
  - [x] `apps/web/app/resources/new/StepIndicator.tsx` 신규 생성 (NEW)
    - Step 1~7 진행 표시, 완료된 Step 클릭 이동, 미완료 Step disabled
  - [x] `apps/web/app/resources/new/resource-new.module.css` 신규 생성 (NEW)
    - 기존 resource-write.module.css 패턴 재사용, 신규 클래스 추가
  - [x] `apps/web/app/resources/new/ResourceWriteGate.tsx` 신규 생성 (NEW) — 비회원 게이팅
  - [x] 기존 per-type write/page.tsx 4개를 `/resources/new` redirect로 교체

- [x] Task 4: 타입체크 및 빌드
  - [x] `pnpm typecheck` 통과 (전체 패키지 오류 없음)

## Dev Notes

### 기존 코드 상태 & 재사용할 것

**`apps/web/app/resources/prompts/write/ResourceWriteForm.tsx` 현재 상태:**
- `"use client"` 컴포넌트 (클라이언트 전용 폼)
- `ALLOWED_EXTS = ["zip","md","txt","json","pdf","docx","xlsx"]` — 그대로 재사용
- `MAX_FILES = 5` → AC는 3개 — 통합 폼에서 3으로 변경
- `MAX_TAGS = 5` → AC는 10개 — 통합 폼에서 10으로 변경
- dropzone + drag&drop 로직 완전히 구현됨 — Step 3에서 그대로 재사용
- tag 입력(Enter/콤마 추가, Backspace 삭제) — Step 5에서 재사용
- `handleSubmit`에서 `alert("개발 중")` → 7-Step의 Step 7 [등록] 버튼 핸들러로 교체
- `suggestedTags`를 API 또는 contracts에서 가져오도록 변경 (현재 하드코딩)

**기존 `resource-write.module.css`에 없는 신규 클래스(추가 필요):**
- `.stepIndicator`, `.stepItem`, `.stepActive`, `.stepCompleted` — 스텝 진행 표시자
- `.copyrightCheck` — 저작권 동의 체크박스 영역 (Step 7)
- `.saveBtn` — [임시저장] 버튼 (Step 7)
- `.previewSection` — 미리보기 섹션 (Step 6)
- `.difficultySelect`, `.envCheckGroup` — 환경/난이도 필드 (Step 2)
- `.stepNav`, `.stepNavPrev`, `.stepNavNext` — Step 이전/다음 버튼

### 7-Step 구조 요약

```
Step 1: 유형 선택   → 6개 유형 카드 클릭
Step 2: 공통 정보   → 제목·한줄설명·지원환경·난이도·본문(Tiptap full)
Step 3: 첨부파일    → 드래그앤드롭, max 3개, 50MB 제한, 대표 파일 지정
Step 4: 사용법/주의 → 사용법(필수, Tiptap lite) + 주의사항(선택, Tiptap lite)
Step 5: 태그        → 자유 입력 + 자동완성, max 10개
Step 6: 미리보기    → 상세 페이지 레이아웃으로 미리보기
Step 7: 등록        → 저작권 동의 체크 + [임시저장] + [등록]
```

### 아키텍처 가드레일

- **7-Step 구조 (규칙⑨)**: 기존 단일 스크롤 폼을 7-Step으로 재구성. 단일 스크롤 유지 금지.
- **Tiptap 에디터 (AR-8)**: `apps/web/features/editor/` 내 `full`/`lite` preset 사용. 현재 파일 존재 여부 확인 후 없으면 `apps/web/features/editor/TiptapEditor.tsx` 신규 생성 필요.
- **파일 업로드 (AR-15)**: 이 스토리는 UI + API endpoint만. 실제 S3 업로드·ClamAV는 4.5 담당. API에서는 `multipart/form-data` 또는 별도 파일 업로드 엔드포인트 패턴 고려.
- **`packages/utilities` slugify**: `slug` 생성은 서비스 레이어에서 `slugify(title)` + DB unique 체크. 중복 시 `-{shortid}` suffix.
- **트랜잭션 (AR-2)**: `db.transaction()` → resources insert + resource_files insert. S3 업로드는 트랜잭션 밖(AR-15).
- **율하 제한**: 자료 등록 API에 `@fastify/rate-limit` 적용(분당 10건 — 어뷰징 방지).
- **등록 후 이동**: 성공 시 `/resources/{pageType}/{slug}`로 이동 (예: `/resources/prompts/{slug}`). 자료유형별 독립 페이지 구조 기준.

### API 파일 업로드 패턴

Fastify multipart 또는 JSON + 별도 업로드 엔드포인트 선택:
- **권장**: `POST /api/v1/resources` — JSON body로 메타만. 파일은 `POST /api/v1/resources/{id}/files`로 별도 업로드(4.5에서 처리). 이 스토리에서는 파일 없는 메타 등록만 완성하고, 파일 업로드 UI + 4.5 연결을 통합.
- 또는: `@fastify/multipart` 로 한 번에 받기(API 설정 필요). 4.5 스토리에서 결정.

### 임시저장 라우트

```
POST /api/v1/resources/draft → status=draft
또는
POST /api/v1/resources { status: 'draft' } 로 통합
```

`/mypage` 자료 탭에서 draft 목록 확인(4.9 스토리에서 구현). `/me/activity` 사용 금지(규칙①).

### Project Structure Notes

```
apps/web/app/resources/
├── new/
│   ├── page.tsx                    ← NEW: 서버 컴포넌트 wrapper
│   ├── ResourceWriteGate.tsx       ← NEW: 클라이언트 게이팅
│   ├── ResourceWriteForm.tsx       ← NEW: 7-Step 통합 등록 폼 클라이언트 컴포넌트
│   ├── StepIndicator.tsx           ← NEW: 스텝 진행 표시자
│   └── resource-new.module.css    ← NEW
└── ...
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4] — AC 원문
- [Source: apps/web/app/resources/prompts/write/ResourceWriteForm.tsx] — 기존 UI 계약(dropzone·tag·폼 구조) 재사용
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Component Patterns] — 파일 업로드 행동 규칙
- [Source: _bmad-output/project-context.md#보안] — 업로드 확장자·매직넘버 규칙
- [Source: _bmad-output/planning-artifacts/architecture.md#Security] — 업로드 보안 플로우
- [Source: _STORY-CORRECTION-SPEC.md#규칙⑨] — 7-Step 등록 폼 구조 확정

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- TypeScript 오류 1: `ResourceDetail` import 미사용 → 제거
- TypeScript 오류 2: `status` 타입 불일치 (`"hidden"|"deleted"` 포함) → `as "draft" | "published"` 단언
- Vitest 호이스팅 오류: `vi.mock` 팩터리 내 최상위 변수 참조 → 인라인 정의로 수정

### Completion Notes List
- **Task 1**: `ResourceWriteGate.tsx` (클라이언트 게이팅) + `page.tsx` (서버 래퍼) 생성. 비회원은 `/login?redirectTo=/resources/new` 유도 UI 표시.
- **Task 2**: `write.service.ts` — `createResource()` + `getResourcePageType()`. `write.route.ts` — `POST /resources` (published) + `POST /resources/draft` (draft). `routes.ts` — [STORY-IMPORTS] + [STORY-REGISTRATIONS]에 Story 4.4 한 줄씩 추가.
- **Task 3**: 7-Step 통합 폼 완성. 기존 dropzone/tag/Tiptap 패턴 재사용. per-type write/page.tsx 4개(`prompts/rules/templates/mcp-skills`) → `/resources/new` redirect 교체.
- **Task 4**: `pnpm -r typecheck` 전체 통과. 9개 단위 테스트 통과. ESLint 오류 없음.

### File List
apps/web/app/resources/new/page.tsx (NEW)
apps/web/app/resources/new/ResourceWriteGate.tsx (NEW)
apps/web/app/resources/new/ResourceWriteForm.tsx (NEW)
apps/web/app/resources/new/StepIndicator.tsx (NEW)
apps/web/app/resources/new/resource-new.module.css (NEW)
apps/api/src/routes/v1/resources/write.service.ts (NEW)
apps/api/src/routes/v1/resources/write.route.ts (NEW)
apps/api/src/routes/v1/resources/write.service.test.ts (NEW)
apps/api/src/routes/v1/resources/routes.ts (MODIFIED)
apps/web/app/resources/prompts/write/page.tsx (MODIFIED → redirect)
apps/web/app/resources/mcp-skills/write/page.tsx (MODIFIED → redirect)
apps/web/app/resources/rules/write/page.tsx (MODIFIED → redirect)
apps/web/app/resources/templates/write/page.tsx (MODIFIED → redirect)
_bmad-output/implementation-artifacts/sprint-status.yaml (MODIFIED)

## Change Log
- 2026-06-24: Story 4.4 구현 완료 — 7-Step 자료 등록 폼, API 등록/임시저장 엔드포인트, 비회원 게이팅, per-type write redirect (claude-sonnet-4-6)
