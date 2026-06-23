---
baseline_commit: 4076aa9c94bf512e37ed31436ec9dfd8d08f491f
---

# Story 4.8: 본인 자료 수정·삭제 + 상태 관리

Status: review

## Story

As a 자료 등록자(회원),
I want 내 자료를 수정·삭제하고 상태를 관리하기를,
So that 정확성을 유지하고 불필요한 자료를 제거한다(FR-4.8).

## Acceptance Criteria

1. 등록자가 본인 자료 상세 접근 시 [수정하기]·[삭제하기] 버튼이 노출되고, 타인·비회원은 해당 버튼이 미노출이다.
2. [수정하기] 후 `PATCH /api/v1/resources/{id}` → 변경 반영. 새 파일 첨부 시 4.5 보안 파이프라인 재실행(scan_status=pending).
3. 기존 파일 교체 시 기존 S3 즉시 삭제하지 않고 `resource_files.status`를 `deleted`로 soft-mark, `cleanup` 큐에 위임(`// TODO: Epic 9 cleanup worker`).
4. [삭제하기] 클릭 시 확인 다이얼로그, 승인 시 `DELETE /api/v1/resources/{id}` → `status=deleted`·`deleted_at` soft-delete, 목록에서 제외 + 해당 자료유형의 독립 목록 페이지(예: `/resources/prompts`)로 이동(AR-7, 규칙⑧).
5. `/mypage` 자료 탭에서 `status=draft` 자료에 "임시저장" 배지·[이어 작성하기] 버튼 표시(규칙①: `/me/activity` 별도 라우트 사용 금지, `/mypage` 탭 확장으로 처리).
6. 타인·비회원의 수정·삭제 API 직접 호출 시 403 응답(FR-1.8).
7. `status=hidden` 자료에 대해 등록자의 `/mypage` 자료 탭에서 "숨김 처리됨" 배지·사유 안내(어드민이 숨김 처리한 경우, FR-4.8). 비회원은 404.

## Tasks / Subtasks

- [x] Task 1: 수정 API 구현 (AC: #2, #3, #6)
  - [x] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: 수정·삭제 라우트 추가
    - `PATCH /api/v1/resources/:id`
    - `DELETE /api/v1/resources/:id`
  - [x] `apps/api/src/routes/v1/resources/resource.service.ts` UPDATE: 수정·삭제 service 함수
    - `updateResource(resourceId: string, userId: string, input: UpdateResourceInput, files?: UploadedFile[])`:
      1. resource 조회(없으면 404)
      2. 소유권 확인: `resource.userId !== userId` → 403 `FORBIDDEN`
      3. `db.transaction()` 내: resources 필드 업데이트
      4. 파일 교체 있을 경우:
         a. 기존 `resource_files` soft-mark: `update().set({ status: 'deleted' })` (resource_files 테이블에 `status` 컬럼 추가 필요 — 4.1 스키마에 없으면 migration 추가)
         b. `cleanup` 큐 발행: `cleanupQueue.add('resource.file.cleanup', { storageKeys: [...] })` (`// TODO: Epic 9 cleanup worker`)
         c. 새 파일: 4.5와 동일 파이프라인(S3 업로드 + `scan_status=pending` + `file-scan` 큐)
    - `deleteResource(resourceId: string, userId: string)`:
      1. resource 조회(없으면 404)
      2. 소유권 확인: `resource.userId !== userId` → 403 `FORBIDDEN`
      3. `db.update(resources).set({ status: 'deleted', deletedAt: new Date() })`
      4. 삭제 확인 응답 반환

- [x] Task 2: resource_files 스키마 보완 (AC: #3)
  - [x] 4.1 스키마에 `resource_files.status` 컬럼이 없다면 마이그레이션 추가
    - `status` pgEnum: `active|deleted` (또는 기존 `scan_status`와 별개로)
    - 실제 4.1 `resource_files` 정의 확인 필요 — 이미 있으면 스킵
  - [x] `drizzle-kit generate` + `migrate`

- [x] Task 3: 수정 페이지 구현 (AC: #1, #2)
  - [x] **기존 코드 완독**: `apps/web/app/resources/[slug]/ResourceDetailClient.tsx`(4.3에서 생성) + 수정 버튼 구조 확인
  - [x] 현재 UI 계약(기존 코드 기준):
    - `detailFooter .ownerActions` 내 [수정][삭제] 버튼 (4.3에서 구현, `userIsOwner` 조건부 노출)
    ```tsx
    // apps/web/app/resources/prompts/[slug]/page.tsx (원본)
    <div className={styles.ownerActions}>
      <button type="button"><Icon name="edit-2-line" />수정</button>
      <button type="button"><Icon name="delete-bin-line" />삭제</button>
    </div>
    ```
  - [x] `apps/web/app/resources/[id]/edit/page.tsx` 신규 생성 (NEW) — 수정 폼 페이지
    - 서버 컴포넌트: 인증 + 소유권 확인(API 호출), 기존 자료 데이터 사전 로딩
    - 404 if 미소유자
  - [x] `apps/web/app/resources/[id]/edit/ResourceEditForm.tsx` 신규 생성 (NEW)
    - 4.4의 `ResourceWriteForm` 패턴 재사용, 초기 데이터 채우기
    - 기존 파일 목록 표시 + 삭제/교체 UI
    - [저장하기] → `PATCH /api/v1/resources/${id}`
    - 성공 시 `/resources/{slug}` 이동 + "수정되었습니다." 토스트
  - [x] `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` UPDATE:
    - [수정하기] 클릭 → `router.push('/resources/${id}/edit')`
    - [삭제하기] 클릭 → 확인 다이얼로그 표시

- [x] Task 4: 삭제 확인 다이얼로그 (AC: #4)
  - [x] `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` UPDATE:
    - [삭제하기] 클릭 → `window.confirm("자료를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")` 또는 커스텀 Modal
    - 승인 → `DELETE /api/v1/resources/${id}` 호출
    - 성공 → `router.push('/resources/{pageType}')` + "자료가 삭제되었습니다." 토스트 (예: 프롬프트 자료면 `router.push('/resources/prompts')`)
    - 오류 → danger 토스트
  - [x] 커스텀 Modal 사용 시: 기존 `@/components/ui` Modal 컴포넌트 확인 후 재사용

- [x] Task 5: /mypage 자료 탭 상태 표시 준비 (AC: #5, #7)
  - [x] **기존 코드 완독**: `apps/web/app/mypage/page.tsx` 의 `tabs` 구조, `BoardKey.resources` 처리 부분 확인
  - [x] 현재 `/mypage` 는 `BoardKey = "resources"` 항목이 있으나 자료 탭 전용 처리는 미구현
  - [x] 마이페이지의 자료 탭 UI 구현은 4.9 스토리 담당 — 이 스토리에서는 API만 준비
  - [x] API: `GET /api/v1/me/resources?status=draft,published,hidden` — 본인 자료 목록(상태 배지용)
    - `apps/api/src/routes/v1/me/` 또는 기존 resources 라우트에 추가
    - 인증 필수, 본인 데이터만 반환
    - `status`, `hiddenReason`(nullable) 포함
  - [x] **주의**: `/me/activity` 별도 라우트 생성 금지. 자료 탭은 `/mypage` 기존 탭 구조 확장으로만 처리(규칙①).

- [x] Task 6: 타입체크
  - [x] `pnpm typecheck` 통과

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**`apps/web/app/resources/prompts/[slug]/page.tsx` detailFooter 현재:**
```tsx
<footer className={styles.detailFooter}>
  <Link href="/resources/prompts" className={styles.listButton}>
    <Icon name="list-check" />
    목록으로
  </Link>
  <div className={styles.ownerActions}>
    <button type="button">
      <Icon name="edit-2-line" />
      수정
    </button>
    <button type="button">
      <Icon name="delete-bin-line" />
      삭제
    </button>
  </div>
</footer>
```
- `.detailFooter`, `.listButton`, `.ownerActions` 클래스 구조 유지
- [목록으로] 링크는 각 유형의 독립 목록 페이지로 연결 (예: 프롬프트 상세에서는 `/resources/prompts`, MCP 상세에서는 `/resources/mcp-skills`). 통합 `/resources` 단일 경로로 바꾸지 않음(규칙⑧).
- [수정][삭제] 버튼: 실제 핸들러 연결 + `userIsOwner` 조건부 렌더

### resource_files 컬럼 보완 주의

4.1 스키마 정의를 확인하여 `resource_files`에 `status` 컬럼이 없으면 추가 마이그레이션 필요. 마이그레이션 파일 단일 소유권 규칙(AR-2) — 4.1 마이그레이션이 아직 머지 전이면 하나의 파일에 통합 가능. 별도 마이그레이션으로 추가 시 충돌 주의.

### 소유권 검증 패턴

```typescript
// service 레이어에서 일관된 소유권 체크
if (resource.userId !== userId) {
  throw app.httpErrors.forbidden('이 자료를 수정할 권한이 없습니다.');
  // 또는 return reply.code(403).send({ error: { code: 'FORBIDDEN', message: '...' } })
}
```

### 삭제 후 리디렉션

`DELETE` 성공 응답 후 클라이언트에서 자료의 유형에 맞는 독립 목록 페이지로 이동. 예: `router.push('/resources/prompts')`. `/resources` 단일 통합 페이지로 이동하지 않음(규칙⑧). 서버 리디렉션 아님.

### 아키텍처 가드레일

- **soft-delete (AR-7)**: `status=deleted` + `deleted_at` 설정. 실제 DB 행 삭제 없음. worker가 30일 후 자동 hard-delete(Epic 9).
- **S3 파일 soft-mark**: 교체된 파일의 `resource_files.status=deleted`. S3 실제 삭제는 `cleanup` BullMQ 큐 위임(`// TODO: Epic 9`).
- **권한 최종 통제 (AR-9)**: API에서 소유권 확인. 클라이언트의 버튼 숨김은 UX 편의일 뿐.
- **403 vs 404**: 타인 접근 시 존재 여부 노출 최소화를 위해 404 대신 403 사용(소유권 확인 스토리이므로 403 명시).

### Project Structure Notes

```
apps/web/app/resources/
├── [id]/
│   └── edit/
│       ├── page.tsx            ← NEW: 수정 페이지 서버 컴포넌트
│       └── ResourceEditForm.tsx ← NEW: 수정 폼 클라이언트
└── [slug]/
    └── ResourceDetailClient.tsx ← UPDATE: 수정/삭제 핸들러 실제 연결

apps/api/src/routes/v1/
├── resources/
│   ├── resource.route.ts  ← UPDATE: PATCH, DELETE 라우트
│   └── resource.service.ts ← UPDATE: updateResource, deleteResource
└── me/
    └── (resources 탭 API — 4.9와 중복 시 4.9에 통합)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.8] — AC 원문
- [Source: apps/web/app/resources/prompts/[slug]/page.tsx] — detailFooter 현재 구조
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — soft-delete, AR-7
- [Source: _bmad-output/project-context.md#구조] — soft-delete enum 패턴
- [Source: _STORY-CORRECTION-SPEC.md#규칙①] — 마이페이지는 /mypage 단일 라우트 탭 구조 (/me/activity 금지)
- [Source: _STORY-CORRECTION-SPEC.md#규칙⑧] — 4개 독립 페이지 유지, 통합 탭 재편 금지

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-06-24)

### Debug Log References

- drizzle-kit migrate 첫 실행 시 postgres 비밀번호 오류 → DATABASE_URL env 명시적 주입으로 해결 (포트 5433)
- mutate.route.ts에서 미사용 userAuth import → 제거로 typecheck 통과
- edit/page.tsx generateMetadata에서 미사용 slug → _props로 변경

### Completion Notes List

- **Task 1 (수정·삭제 API)**: `mutate.service.ts` + `mutate.route.ts` 신규 작성. PATCH·DELETE·GET /me/resources 3개 엔드포인트 구현. 소유권 검증 패턴(AR-9) 준수. routes.ts `[STORY-IMPORTS]`/`[STORY-REGISTRATIONS]` 영역에 각 1줄 추가.
- **Task 2 (스키마 보완)**: `resource_files` 테이블에 `file_status` pgEnum(`active|deleted`) 컬럼 추가. 마이그레이션 `0006_young_hawkeye.sql` 생성 및 로컬 DB(5433) 적용 완료.
- **Task 3 (수정 페이지)**: `[slug]/edit/page.tsx`(서버 컴포넌트) + `ResourceEditClient.tsx` 신규 생성. 4.4의 `ResourceWriteForm`에 `ResourceWriteFormProps`(resourceId, initialData, returnSlug) 추가하여 편집 모드 재사용. 중복 폼 미작성.
- **Task 4 (삭제 확인)**: `ResourceDetailClient.tsx`의 `handleDelete`를 window.confirm + DELETE API 실제 연결로 완성. `isDeleting` 상태 추가. 다운로드(4.6)·평점(4.7)·Epic5 슬롯 미수정 확인.
- **Task 5 (mypage API)**: `GET /api/v1/me/resources` API 제공. `hiddenReason` 필드로 숨김 사유 반환. `detail.service.ts`에서 hidden/draft 자료를 소유자에게 공개(AC #7). `/me/activity` 별도 라우트 미생성.
- **Task 6 (타입체크)**: `pnpm -r typecheck` 전 워크스페이스 통과. 유닛 테스트 9개(MutateServiceError, updateResource, deleteResource) 신규 추가, 전체 120개 통과.

### File List

**신규 생성 (NEW)**
- `apps/api/src/routes/v1/resources/mutate.service.ts`
- `apps/api/src/routes/v1/resources/mutate.service.test.ts`
- `apps/api/src/routes/v1/resources/mutate.route.ts`
- `apps/web/app/resources/[slug]/edit/page.tsx`
- `apps/web/app/resources/[slug]/edit/ResourceEditClient.tsx`
- `packages/database/migrations/0006_young_hawkeye.sql`

**수정 (UPDATE)**
- `apps/api/src/routes/v1/resources/routes.ts` — STORY-IMPORTS + STORY-REGISTRATIONS 각 1줄 추가
- `apps/api/src/routes/v1/resources/detail.service.ts` — hidden/draft 소유자 접근 허용
- `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` — handleDelete 실제 API 연결
- `apps/web/app/resources/new/ResourceWriteForm.tsx` — 편집 모드 props 추가 (initialData, resourceId, returnSlug)
- `packages/database/src/schema/resources.ts` — resourceFileStatus enum + fileStatus 컬럼
