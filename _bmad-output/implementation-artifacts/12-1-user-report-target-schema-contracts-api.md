# Story 12.1: 회원 신고 대상·사유 — 스키마·계약·신고 API 확장 (Foundation)

Status: ready-for-dev

## Story

As a 개발팀,
I want `report_target_type`에 `user`를 추가하고 회원 전용 신고 사유·신고 API·관리자 신고 목록이 회원 대상을 처리하기를,
so that 이후 스토리(12.2 웹 입구·12.3 누적 귀속·12.4 자동 에스컬레이션·12.5 관리자 처리)가 회원 신고를 일관된 토대 위에서 구현한다.

## Acceptance Criteria

1. `report_target_type` pgEnum에 `user` 값을 추가하는 마이그레이션 `0026_report_target_user.sql`을 생성·migrate한다. SQL: `ALTER TYPE "report_target_type" ADD VALUE IF NOT EXISTS 'user';`(idempotent — `ADD VALUE`는 트랜잭션 밖 단독 실행 필수). `packages/database/src/schema/engagement.ts`의 `reportTargetType` pgEnum 배열에 `"user"` 추가, `packages/contracts/src/engagement.ts`의 `reportTargetTypeSchema`에 `"user"` 추가(`message`도 현재 누락 — 함께 보정), `packages/contracts/src/admin/reports.ts`의 `reportTargetTypeEnum`에 `"user"` 추가. 기존 6종(post/question/answer/resource/comment/message) 신고 동작 회귀 없음.

2. 회원 전용 신고 사유 스키마를 `packages/contracts/src/engagement.ts`에 신설·export한다: `userReportReasonCodeSchema = z.enum(["profile","impersonation","spam","abuse","other"])`. 콘텐츠 신고 사유는 `contentReportReasonCodeSchema = z.enum(["spam","abuse","privacy","misinformation","other"])`로 명명·export(기존 암묵 5종 명시화). `createReportInputSchema`는 discriminated union으로 재정의 — `targetType` 분기에 따라 `reasonCode`가 각각의 enum을 검증. 두 사유 세트를 혼용하지 않는다.

3. `POST /api/v1/reports`(`apps/api/src/routes/v1/reports.ts`)에서 `targetType='user'` 신고를 처리한다: 로컬 `reportTargetTypeSchema`(현재 자체 정의, 6종)에 `"user"` 추가 → 7종. `targetType==='user' && targetId===user.id`이면 즉시 400 `SELF_REPORT`("자기 자신은 신고할 수 없습니다."). `createReportBodySchema`의 `reasonCode` 검증을 `targetType`에 따라 분기(`user` → `userReportReasonCodeSchema`, 그 외 → `contentReportReasonCodeSchema`). `reasonCode==='other'` 이면 `detail` 필수(Zod `.refine` 기존 패턴 유지). 동일 `(reporter_id, 'user', target_id)` 재신고 시 409 `ALREADY_REPORTED`(기존 중복 로직 그대로 동작 — 추가 구현 없음). `status='pending'` INSERT.

4. 회원 대상 신고는 자동 숨김 로직(`AUTO_HIDE_TABLE_MAP`)을 적용하지 않는다. `AUTO_HIDE_TABLE_MAP`에 `user` 키가 없으므로 `targetType in AUTO_HIDE_TABLE_MAP` 조건에서 자연히 제외됨 — **명시적 주석으로 의도 표기** 필수. "회원은 hidden 상태가 없으므로 자동 숨김 제외됨" 주석 추가.

5. 관리자 신고 서비스(`apps/api/src/routes/admin/reports/service.ts`)의 `listReports`·`getReport` 함수 양쪽 동적 CASE 서브쿼리 5종에 `user` 분기를 추가한다:
   - `reportedUserId`: `WHEN ${reports.targetType} = 'user' THEN ${reports.targetId}` (targetId 자체가 피신고 userId)
   - `targetPreview`: `WHEN ${reports.targetType} = 'user' THEN (SELECT nickname FROM users WHERE id = ${reports.targetId})`
   - `targetBoard`: `WHEN ${reports.targetType} = 'user' THEN NULL` (명시적 분기)
   - `targetStatus`(getReport 전용): `WHEN ${reports.targetType} = 'user' THEN NULL` — **`::text` 캐스팅 유지**(7차 배치 교훈: enum status 컬럼을 CASE에 섞을 때 ::text 미캐스팅 시 500)
   - `targetContentJson`(getReport 전용): `WHEN ${reports.targetType} = 'user' THEN NULL`

6. 관리자 신고 목록·상세 화면 UI에 `user` 케이스를 추가한다:
   - `apps/admin/app/reports/page.tsx`: `TARGET_OPTIONS` 배열에 `{ value: "user", label: "회원" }` 추가. `targetBadge` switch에 `case "user": return ["badge-red", "회원"];` 추가.
   - `apps/admin/app/reports/[id]/page.tsx`: `targetLabel` switch에 `case "user": return ["badge-red", "회원"];` 추가. **"대상 숨김" 버튼 렌더 조건에 `targetType !== 'user'` 가드 추가** — 회원은 hidden 상태가 없으므로 숨김 버튼을 표시하면 안 됨. 현재 `!targetHidden && canAct` 조건에 `&& report.targetType !== 'user'` 추가.

## Tasks / Subtasks

- [ ] Task 1: DB enum 확장 마이그레이션 (AC: #1) [NEW]
  - [ ] `packages/database/src/schema/engagement.ts` 53번째 줄 `reportTargetType` pgEnum 배열 — 마지막 `"message"` 뒤에 `"user"` 추가
  - [ ] `drizzle-kit generate` 실행 → 생성된 SQL 파일 확인 후 **수동 idempotent 가드 적용**: 파일명을 `0026_report_target_user.sql`로 변경, SQL을 `ALTER TYPE "report_target_type" ADD VALUE IF NOT EXISTS 'user';` 단독 statement로 교체 (drizzle generate가 IF NOT EXISTS 없이 생성할 수 있음 — 직접 편집)
  - [ ] `pnpm db:migrate` 실행 (루트 `.env` `DATABASE_URL`에 포트 5433 확인 — config 폴백 5432 아님)
  - [ ] raw SQL로 enum 확인: `SELECT enum_range(NULL::"report_target_type");` → 결과에 `user` 포함 검증

- [ ] Task 2: contracts — 신고 스키마 보정·회원 사유 신설 (AC: #1, #2) [UPDATE]
  - [ ] `packages/contracts/src/engagement.ts` 26~32번째 줄 `reportTargetTypeSchema`: `"message"`(현재 누락) + `"user"` 추가 → 최종 7종: post/question/answer/resource/comment/message/user
  - [ ] 같은 파일에 `contentReportReasonCodeSchema` 신설·export: `z.enum(["spam","abuse","privacy","misinformation","other"])`
  - [ ] 같은 파일에 `userReportReasonCodeSchema` 신설·export: `z.enum(["profile","impersonation","spam","abuse","other"])`
  - [ ] `createReportInputSchema`(110~115번째 줄)를 discriminated union으로 재정의:
    ```ts
    // user 신고 스키마
    const userReportSchema = z.object({
      targetType: z.literal("user"),
      targetId: z.string().uuid(),
      reasonCode: userReportReasonCodeSchema,
      detail: z.string().max(500).optional(),
    }).refine(d => d.reasonCode !== "other" || (d.detail && d.detail.trim().length > 0), {
      message: "기타 사유 선택 시 상세 내용을 입력해주세요.", path: ["detail"],
    });
    // 콘텐츠 신고 스키마
    const contentReportSchema = z.object({
      targetType: z.enum(["post","question","answer","resource","comment","message"]),
      targetId: z.string().uuid(),
      reasonCode: contentReportReasonCodeSchema,
      detail: z.string().max(500).optional(),
    }).refine(d => d.reasonCode !== "other" || (d.detail && d.detail.trim().length > 0), {
      message: "기타 사유 선택 시 상세 내용을 입력해주세요.", path: ["detail"],
    });
    export const createReportInputSchema = z.discriminatedUnion("targetType", [
      userReportSchema,
      // contentReport: discriminatedUnion은 리터럴만 허용하므로 union 래핑 필요:
      // 6개 리터럴을 각각 만들거나, z.union으로 처리
    ]);
    ```
    > 주의: `z.discriminatedUnion`은 discriminant가 `z.literal` 이어야 함. `targetType`이 6종 union인 콘텐츠 쪽은 `.superRefine` 또는 `z.union([userReportSchema, contentReportBaseSchema])` 형태로 구현 — 최종 선택은 dev가 타입 안전성 확인 후 결정.
  - [ ] `packages/contracts/src/admin/reports.ts` 20~27번째 줄 `reportTargetTypeEnum`: 현재 6종 → `"user"` 추가해 7종

- [ ] Task 3: 신고 제출 API — user 대상 처리 (AC: #3, #4) [UPDATE]
  - [ ] `apps/api/src/routes/v1/reports.ts` 36~43번째 줄 로컬 `reportTargetTypeSchema`: `"user"` 추가 → 7종 (contracts에서 import로 교체하면 더 좋으나 기존 패턴 유지도 가능 — 최소 변경)
  - [ ] 45번째 줄 `reportReasonCodeSchema` 교체: `contentReportReasonCodeSchema`(기존 5종)와 별도로 `userReportReasonCodeSchema` 정의 또는 contracts에서 import
  - [ ] `createReportBodySchema`(47~57번째 줄) 재정의: `targetType`이 `'user'`이면 `userReportReasonCodeSchema`, 그 외면 `contentReportReasonCodeSchema`. 기존 `.refine` (other → detail 필수) 유지
  - [ ] 자기 신고 차단 추가 — 중복 체크(81~97번째 줄) **앞에** 삽입:
    ```ts
    if (targetType === "user" && targetId === user.id) {
      return reply.code(400).send({
        error: { code: "SELF_REPORT", message: "자기 자신은 신고할 수 없습니다." },
      });
    }
    ```
  - [ ] 응답 스키마(71~73번째 줄) 400 케이스 추가:
    ```ts
    400: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
    ```
  - [ ] 자동 숨김 블록(132번째 줄 `if (action === "auto_hide" && targetType in AUTO_HIDE_TABLE_MAP)`) — `user`는 `AUTO_HIDE_TABLE_MAP`에 없으므로 조건에서 자연 제외. **주석 추가**: `// 'user' targetType은 AUTO_HIDE_TABLE_MAP에 포함되지 않아 자동 숨김 제외됨(회원에는 hidden 상태 없음 — AC #4)`

- [ ] Task 4: 관리자 신고 서비스 — user CASE 분기 추가 (AC: #5) [UPDATE]
  - [ ] `apps/api/src/routes/admin/reports/service.ts` `listReports` 함수 (109~141번째 줄) — 각 CASE `ELSE NULL` 앞에 `user` 분기 삽입:
    - `reportedUserId` CASE (109~121번째 줄): `WHEN ${reports.targetType} = 'user' THEN ${reports.targetId}` 추가
    - `targetBoard` CASE (123~127번째 줄): `WHEN ${reports.targetType} = 'user' THEN NULL` 추가 (명시)
    - `targetPreview` CASE (129~141번째 줄): `WHEN ${reports.targetType} = 'user' THEN (SELECT nickname FROM users WHERE id = ${reports.targetId})` 추가
  - [ ] `getReport` 함수 (177~277번째 줄) — `listReports`와 동일한 3개 CASE + 2개 추가:
    - `reportedUserId`, `targetBoard`, `targetPreview` — listReports와 동일하게 user 분기 추가
    - `targetStatus` CASE (223~235번째 줄): `WHEN ${reports.targetType} = 'user' THEN NULL` 추가 — **`::text` 캐스팅 기존 패턴 유지**(예: `status::text`). 캐스팅 누락 시 PostgreSQL이 enum 타입 통일 실패로 500 반환
    - `targetContentJson` CASE (249~261번째 줄): `WHEN ${reports.targetType} = 'user' THEN NULL` 추가

- [ ] Task 5: 관리자 신고 화면 — user 옵션·뱃지·가드 추가 (AC: #6) [UPDATE]
  - [ ] `apps/admin/app/reports/page.tsx` 43~51번째 줄 `TARGET_OPTIONS`:
    ```ts
    { value: "user", label: "회원" },
    ```
    추가 (마지막 `message` 항목 뒤)
  - [ ] 같은 파일 65~75번째 줄 `targetBadge` switch:
    ```ts
    case "user": return ["badge-red", "회원"];
    ```
    추가 (default 앞)
  - [ ] `apps/admin/app/reports/[id]/page.tsx` 40~50번째 줄 `targetLabel` switch:
    ```ts
    case "user": return ["badge-red", "회원"];
    ```
    추가 (default 앞)
  - [ ] 같은 파일 302~312번째 줄 "대상 숨김" 버튼 렌더 조건:
    현재: `{!targetHidden && (`
    변경: `{!targetHidden && report.targetType !== "user" && (`
    — 회원 신고 상세에서 "대상 숨김" 버튼 미노출 (회원은 hidden 상태 없음)

- [ ] Task 6: 검증 (AC: #1~#6)
  - [ ] `pnpm typecheck` — apps/web·admin·api·contracts 전체 통과
  - [ ] raw SQL로 enum 값 확인: `SELECT enum_range(NULL::"report_target_type")::text;`
  - [ ] 실제 요청으로 확인:
    - `POST /api/v1/reports { targetType:'user', targetId:<본인 id> }` → 400 SELF_REPORT
    - `POST /api/v1/reports { targetType:'user', targetId:<타인 id>, reasonCode:'abuse' }` → 201 `{ id, status:'pending' }`
    - 동일 요청 재전송 → 409 ALREADY_REPORTED
    - `POST /api/v1/reports { targetType:'user', targetId:<타인 id>, reasonCode:'other', detail:'' }` → 400 (detail 필수 검증)
    - 기존 콘텐츠 신고 `{ targetType:'post', reasonCode:'spam' }` → 201 (회귀 없음)
  - [ ] 관리자 신고 목록 `GET /api/v1/admin/reports?targetType=user` → user 신고 행, targetPreview=피신고 회원 닉네임
  - [ ] 관리자 신고 목록 화면(`/reports`) — 대상 유형 드롭다운에 "회원" 옵션 노출 확인
  - [ ] 관리자 신고 상세(`/reports/{user_report_id}`) — "대상 숨김" 버튼 미노출 확인

## Dev Notes

### 핵심 아키텍처 컨텍스트
- **이 스토리는 Epic 12의 enabling Foundation**. 12.2(웹 신고 입구)·12.3(누적 귀속)·12.4(자동 에스컬레이션)·12.5(관리자 연결)가 전부 이 스키마·계약·API 위에서 동작. 단독 PR로 먼저 머지 권장.
- AR-6(다형 참여 모델): `(target_type, target_id)` 복합 참조. `user` 추가는 기존 패턴 완전 준수.
- AR-13(신고 제출→처리 연계): `status='pending'` INSERT → 관리자 큐.

### 수정 대상 파일 — 현재 상태 / 바꾸는 것 / 보존할 것

**`packages/database/src/schema/engagement.ts` (53~60번째 줄)**
- 현재: `reportTargetType` pgEnum 6종 (post/question/answer/resource/comment/message)
- 바꾸는 것: 배열에 `"user"` 추가 → 7종
- 보존: 나머지 enum·테이블 정의 전부, `reports` 테이블 구조 불변

**`packages/contracts/src/engagement.ts` (26~32번째 줄)**
- 현재: `reportTargetTypeSchema` 5종 (message 누락 — 기존 불일치)
- 바꾸는 것: `message` + `"user"` 추가 → 7종. 신규 `contentReportReasonCodeSchema`·`userReportReasonCodeSchema` export. `createReportInputSchema` discriminated union으로 강화.
- 보존: `commentTargetTypeSchema`·`reactionTargetTypeSchema`·`bookmarkTargetTypeSchema`·`createCommentInputSchema`·`createReactionInputSchema` 등 모든 타 스키마 불변

**`packages/contracts/src/admin/reports.ts` (20~27번째 줄)**
- 현재: `reportTargetTypeEnum` 6종 (post/question/answer/resource/comment/message)
- 바꾸는 것: `"user"` 추가 → 7종
- 보존: `adminReportItemSchema`·`adminReportDetailSchema`·`adminReportsQuerySchema`·모든 액션 스키마 구조 불변. `adminReportsQuerySchema`의 `targetType: reportTargetTypeEnum.optional()` 은 `user` 자동 허용됨

**`apps/api/src/routes/v1/reports.ts` (36~57번째 줄)**
- 현재: 로컬 `reportTargetTypeSchema` 6종, 로컬 `reportReasonCodeSchema` 5종 콘텐츠 사유, `createReportBodySchema` 단일 스키마. 자기 신고 차단 없음.
- 바꾸는 것: reportTargetTypeSchema에 `user` 추가, 사유 분기 검증, self-report 400 추가, 400 응답 스키마 등록, 자동숨김 블록 주석
- 보존: 중복 409 로직(81~97번째 줄), INSERT(99~109번째 줄), 자동숨김 try/catch(114~155번째 줄) 전체 구조, 201 응답

**`apps/api/src/routes/admin/reports/service.ts`**
- 현재: `listReports`·`getReport` 모두 5개 CASE 서브쿼리(post/question/answer/comment/resource) + ELSE NULL. `user` 분기 없음.
- 바꾸는 것: 5개 CASE에 각각 `user` 분기 1개씩 추가 (총 10개 WHEN 추가, listReports 3개 + getReport 5개)
- 보존: `TARGET_TABLE_MAP`·`HideableTargetType`·`hideTarget`·`restoreAutoHidden`·`unhideTarget`·`rejectReport`·`markReviewing` 함수 전체 불변. `::text` 캐스팅 기존 패턴 유지.

**`apps/admin/app/reports/page.tsx` (43~75번째 줄)**
- 현재: `TARGET_OPTIONS` 7개(전체+6종), `targetBadge` 6 케이스
- 바꾸는 것: 각각 `user`/`"회원"` 케이스 1개 추가
- 보존: STATUS_TABS·필터 UI·페이지네이션·RowActionMenu 구조 불변. "대상 숨김" 액션 항목(`handleHide`)은 목록 페이지의 RowActionMenu에서 `canAct` 조건으로만 제어 중 — user 타입 가드는 상세 페이지([id])에서 처리하면 충분 (목록 액션은 12.5에서 "회원 제재"로 교체 예정)

**`apps/admin/app/reports/[id]/page.tsx` (40~50번째 줄 targetLabel, 302~312번째 줄 버튼)**
- 현재: `targetLabel` 6 케이스. 257번째 줄 `crossLink = getCrossLink(report.targetType, report.targetId, report.targetBoard)` — 12.5에서 user 케이스 추가 예정(현재 null 반환). 302~312번째 줄 "대상 숨김" 버튼: `{!targetHidden && (` 조건으로만 가드.
- 바꾸는 것: targetLabel에 user 케이스, "대상 숨김" 버튼에 `report.targetType !== "user"` 가드 추가
- 보존: `targetHidden` 로직(263번째 줄) — user 신고면 `targetStatus`=NULL → `targetHidden`=false → 숨김 해제 버튼 자연 미노출(추가 작업 불필요). `canAct` 로직, RejectModal, handleUnhide·handleReview·handleReject 함수 전체 불변.

### 사전 발견 불일치(코드 정독 중)
- **`packages/contracts/src/engagement.ts` `reportTargetTypeSchema` 5종**: DB 스키마(6종, message 포함)와 불일치. Task 2에서 함께 보정.
- **`apps/api/src/routes/v1/reports.ts` 로컬 스키마**: contracts를 import하지 않고 자체 정의. 안티패턴이지만 이번 스토리 범위에서는 기존 패턴 유지(contracts 통합은 별도 리팩터링으로). 단, 값은 contracts와 정합 유지.

### 마이그레이션 주의사항
- 최신 마이그 파일: `0025_admin_custom_roles.sql` → 다음 번호: **`0026`**
- `ALTER TYPE ... ADD VALUE`는 PostgreSQL에서 트랜잭션 내 실행 불가. drizzle 마이그 래퍼가 트랜잭션으로 감쌀 수 있으므로 migration 파일을 단독 statement로 두거나, drizzle config `{ breakpoints: true }` 사용 검토.
- `pnpm db:migrate` 실행 시 `.env` `DATABASE_URL=postgresql://...@localhost:5433/...` (포트 5433 필수 — 미주입 시 5432 폴백으로 auth_failed)

### 테스트 기준
- `pnpm typecheck` 전체 통과 (contracts 타입 변경이 web·admin·api에 전파되므로 전체 체크)
- 실제 API 요청으로 self-report 400·정상 201·중복 409 확인
- 콘텐츠 신고(post 등) 기존 동작 회귀 없음 확인

### Project Structure Notes

- UPDATE: `packages/database/src/schema/engagement.ts`
- UPDATE: `packages/contracts/src/engagement.ts`
- UPDATE: `packages/contracts/src/admin/reports.ts`
- UPDATE: `apps/api/src/routes/v1/reports.ts`
- UPDATE: `apps/api/src/routes/admin/reports/service.ts`
- UPDATE: `apps/admin/app/reports/page.tsx`
- UPDATE: `apps/admin/app/reports/[id]/page.tsx`
- NEW: `packages/database/migrations/0026_report_target_user.sql` (enum ADD VALUE IF NOT EXISTS)
- 신규 테이블 없음. 신규 컬럼 없음. enum 값 1개 추가가 유일한 DB 스키마 변경.
- `apps/admin/lib/contentCrossLink.ts` — **읽지 않음, 수정 없음**. user 케이스의 `getCrossLink` 확장은 12.5 Story에서 담당(현재 null 반환 → `/members/{targetId}` 라우팅). 이 스토리에서는 건드리지 않는다.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 12.1 AC`] — 원본 Given/When/Then
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 12 순서/경계`] — "신규 테이블 없음, enum ADD VALUE만"
- [Source: `_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md#FR-8.6`] — 회원(user) 직접 신고 기획
- [Source: `_bmad-output/project-context.md#신고·제재 모더레이션 (Epic 12 — 절대 규칙)`] — 자기 신고 차단, 사유 세트 분리, hidden 없음
- [Source: `packages/database/src/schema/engagement.ts#reportTargetType`] — 현재 6종 enum
- [Source: `packages/contracts/src/engagement.ts#reportTargetTypeSchema`] — 현재 5종(message 누락 기확인)
- [Source: `packages/contracts/src/admin/reports.ts#reportTargetTypeEnum`] — 현재 6종
- [Source: `apps/api/src/routes/v1/reports.ts`] — 자동숨김 AUTO_HIDE_TABLE_MAP, 중복 409, self-report 없음 확인
- [Source: `apps/api/src/routes/admin/reports/service.ts`] — 동적 CASE 5종(user 분기 없음), ::text 캐스팅 위치
- [Source: `apps/admin/app/reports/page.tsx`] — TARGET_OPTIONS 7개(전체 포함), targetBadge 6케이스 위치
- [Source: `apps/admin/app/reports/[id]/page.tsx`] — targetLabel 6케이스, "대상 숨김" 버튼 302번째 줄
- [AR-6: 다형 참여 모델 — (target_type, target_id) 복합 참조]
- [AR-13: 신고 제출→처리 연계]
- [회귀주의: MEMORY 7차 배치 — 동적 CASE enum `::text` 캐스팅 누락 시 500, comments.author_id]
- [Source: `packages/database/migrations/`] — 최신 번호 0025 확인 → 신규 0026

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
