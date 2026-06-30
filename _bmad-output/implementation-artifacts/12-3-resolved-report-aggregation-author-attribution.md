# Story 12.3: 신고 누적(처리완료 기준) 집계 · 작성자 귀속 · 회원 상세 피신고 이력

Status: ready-for-dev

## Story

As a 관리자,
I want 회원별로 "처리완료된 신고"가 작성자 기준으로 누적 집계되고 회원 상세에서 피신고 이력을 보기를,
so that 단발 신고가 아니라 반복 위반 패턴을 근거로 제재를 판단한다.

## Acceptance Criteria

1. 한 회원에게 귀속되는 "처리완료 신고수"(`resolvedReportCount`)를 집계한다.
   - **`reports.status = 'resolved'` 만 카운트** (pending/reviewing/dismissed 제외 — 브리게이딩 방어).
   - 귀속 규칙(전체 대상 유형):
     - `target_type='post'` → `posts.user_id = userId`
     - `target_type='comment'` → `comments.author_id = userId` (**author_id, user_id 아님** — G17 주의)
     - `target_type='question'` → `questions.user_id = userId`
     - `target_type='answer'` → `answers.user_id = userId`
     - `target_type='resource'` → `resources.user_id = userId`
     - `target_type='user'` → `reports.target_id = userId` (12.1 머지 후 활성화)
   - 기존 raw `reportCount`(post/comment only, status 무관)는 **그대로 보존** — 제거·수정 금지.

2. 회원 목록(`/members`)에 "처리완료 신고수" 컬럼을 추가한다.
   - 기존 `<th>신고</th>` 헤더를 `<th>접수 신고</th>`로 라벨 변경, 셀 표시 유지.
   - 처리완료 신고수 컬럼(`<th>처리완료 신고</th>`) 을 새로 추가한다: `resolvedReportCount > 0` 이면 `badge-orange`, 0이면 숫자 0.
   - CSV 다운로드에도 `resolvedReportCount` 컬럼 추가.

3. 회원 상세(`/members/[id]`) 프로필 헤더의 "신고 {member.reportCount}" 표기 옆에 "처리완료 {member.resolvedReportCount}" 를 병기한다.
   그리고 활동 내역 섹션 이후에 **별도 `<section>`** "피신고 이력"을 추가한다:
   - 상단 요약: "처리완료된 신고 N건" + 임계치 근접 시 danger 배지.
     - `resolvedReportCount >= reportEscalationThreshold` → `badge-red` "임계치 도달"
     - `resolvedReportCount >= Math.ceil(reportEscalationThreshold * 0.8)` && 미도달 → `badge-orange` "임계치 근접"
   - 목록 테이블(처리완료 신고 최대 20건, 최신순):
     컬럼: 대상 유형(`targetType`) · 사유(`reasonCode`) · 처리일(`reviewedAt`) · 처리자(`reviewedByName`)
   - 신고 0건이면 EmptyState("피신고 내역이 없습니다.").

4. API 계약을 확장한다:
   - `GET /api/v1/admin/members` 응답 아이템: `resolvedReportCount: number` 추가.
   - `GET /api/v1/admin/members/:id` 응답:
     - `resolvedReportCount: number` 추가.
     - `reportEscalationThreshold: number` 추가 (`site_settings` `report_escalation_threshold` 키, 없으면 fallback 5).
     - `receivedReports: ReceivedReportItem[]` 추가 (처리완료 신고 목록, 최대 20건).
   - 기존 `reportCount`(raw)는 두 엔드포인트 모두 보존(회귀 방지).

## Tasks / Subtasks

- [ ] Task 1: API 서비스 — `resolvedReportCount` 서브쿼리 추가 (AC: #1, #4) [UPDATE]
  - [ ] `apps/api/src/routes/admin/members/service.ts` `listUserMembers` 함수:
    - `db.select()` 내 `resolvedReportCount` 서브쿼리를 기존 `reportCount` 서브쿼리(lines 134-138) **바로 아래**에 추가:
      ```sql
      resolvedReportCount: sql<number>`(
        SELECT COUNT(*)::int FROM reports r
        WHERE r.status = 'resolved'
        AND (
          (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${users.id}))
          OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${users.id}))
          OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${users.id}))
          OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${users.id}))
          OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${users.id}))
          OR (r.target_type = 'user'     AND r.target_id = ${users.id})
        )
      )`
      ```
    - `rows.map(...)` 반환 객체에 `resolvedReportCount: Number(r.resolvedReportCount)` 추가.
  - [ ] import에 `questions`, `answers`, `resources` Drizzle 테이블 추가 (`@ai-jakdang/database/schema`).
    - 현재 import: `users, userSanctions, pointsLedger, grades, sessions, posts, comments` — `questions, answers, resources` 미포함.

- [ ] Task 2: API 서비스 — 상세 `resolvedReportCount` + `receivedReports` + `reportEscalationThreshold` (AC: #1, #3, #4) [UPDATE]
  - [ ] `apps/api/src/routes/admin/members/service.ts` `getUserMemberDetail` 함수:
    - 기존 `reportCount` 서브쿼리(lines 216-222)를 담은 `stats` 쿼리에 `resolvedReportCount` 서브쿼리 추가 (Task 1과 동일 SQL, `${userId}` 리터럴 사용).
    - `getSiteSetting` 호출로 임계치 조회:
      ```typescript
      import { getSiteSetting } from "../../../lib/siteSettings.js";
      const thresholdRaw = await getSiteSetting<number>("report_escalation_threshold");
      const reportEscalationThreshold = typeof thresholdRaw === "number" ? thresholdRaw : 5;
      ```
    - `receivedReports` 별도 쿼리 (Drizzle raw SQL 또는 `.select()`):
      ```sql
      SELECT r.id, r.target_type, r.reason_code, r.reviewed_at, au.name AS reviewed_by_name
      FROM reports r
      LEFT JOIN admin_users au ON au.id = r.reviewed_by
      WHERE r.status = 'resolved'
      AND (
        (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts     WHERE user_id   = ${userId}))
        OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments  WHERE author_id = ${userId}))
        OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id   = ${userId}))
        OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers   WHERE user_id   = ${userId}))
        OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id   = ${userId}))
        OR (r.target_type = 'user'     AND r.target_id = ${userId})
      )
      ORDER BY r.reviewed_at DESC NULLS LAST
      LIMIT 20
      ```
      - Drizzle로 쓸 경우 `adminUsers` 테이블 import 필요 (`@ai-jakdang/database/schema`의 `admin.ts`).
    - 반환 객체에 `resolvedReportCount`, `reportEscalationThreshold`, `receivedReports` 추가:
      ```typescript
      receivedReports: receivedReportRows.map((r) => ({
        id: r.id,
        targetType: r.targetType,   // target_type → camelCase
        reasonCode: r.reasonCode,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewedByName: r.reviewedByName ?? null,
      })),
      ```

- [ ] Task 3: contracts — 응답 스키마 확장 (AC: #4) [UPDATE]
  - [ ] `packages/contracts/src/admin/members.ts`:
    - `adminUserMemberItemSchema`에 필드 추가:
      ```typescript
      resolvedReportCount: z.number(),
      ```
    - 피신고 신고 아이템 스키마 신설:
      ```typescript
      export const adminReceivedReportItemSchema = z.object({
        id: z.string().uuid(),
        targetType: z.string(),
        reasonCode: z.string(),
        reviewedAt: z.string().nullable(),
        reviewedByName: z.string().nullable(),
      });
      export type AdminReceivedReportItem = z.infer<typeof adminReceivedReportItemSchema>;
      ```
    - `adminUserMemberDetailSchema`에 필드 추가:
      ```typescript
      resolvedReportCount: z.number(),
      reportEscalationThreshold: z.number(),
      receivedReports: z.array(adminReceivedReportItemSchema),
      ```
    - **`adminUserMemberItemSchema`에 `avatarUrl`, `image`, `defaultAvatarIndex` 가 contracts에 없으나 service.ts는 반환 중.** 이 스토리에서 함께 추가 권장(선행 story 9.12 갭).

- [ ] Task 4: 프런트 — 회원 목록 컬럼 (AC: #2) [UPDATE]
  - [ ] `apps/admin/app/members/page.tsx`:
    - 로컬 `interface AdminUserMemberItem`(lines 14-29)에 `resolvedReportCount: number` 추가.
    - 테이블 헤더(line 313 `<th>신고</th>`) → `<th>접수 신고</th>` 로 라벨 변경.
    - 그 바로 뒤에 처리완료 신고 `<th>` 추가: `<th>처리완료 신고</th>`.
    - 테이블 행(lines 352-354) 기존 신고 셀 유지 후 처리완료 신고 셀 삽입:
      ```tsx
      <td className="num">
        {m.resolvedReportCount > 0
          ? <span className="badge badge-orange">{m.resolvedReportCount}</span>
          : 0}
      </td>
      ```
    - `colSpan` 값 조정: 기존 9 → 10.
    - `downloadCsv` 매핑에 `resolvedReportCount` 추가.

- [ ] Task 5: 프런트 — 회원 상세 피신고 이력 섹션 (AC: #3) [UPDATE]
  - [ ] `apps/admin/app/members/[id]/page.tsx`:
    - 로컬 `interface AdminUserMemberDetail`(lines 51-77)에 추가:
      ```typescript
      resolvedReportCount: number;
      reportEscalationThreshold: number;
      receivedReports: Array<{
        id: string;
        targetType: string;
        reasonCode: string;
        reviewedAt: string | null;
        reviewedByName: string | null;
      }>;
      ```
    - 프로필 헤더 신고 표기(lines 691-694) 수정: 기존 `신고 {member.reportCount}` 에 처리완료 수 병기:
      ```tsx
      <span className="content-meta" style={{ fontSize: "12px" }}>
        <i className="ri-flag-line" style={{ marginRight: "4px" }} />
        접수 신고 {member.reportCount} · 처리완료 {member.resolvedReportCount}
      </span>
      ```
    - 활동 내역 `</section>` 닫힘 태그(~line 1004) **이후**, 모달 블록 이전에 "피신고 이력" 섹션 삽입:
      ```tsx
      {/* 피신고 이력 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">피신고 이력</h2>
            <p className="section-description">
              처리완료된 신고 누적 — 반복 위반 패턴 확인용.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {member.resolvedReportCount >= member.reportEscalationThreshold && member.reportEscalationThreshold > 0 && (
              <span className="badge badge-red">
                <i className="ri-error-warning-line" style={{ marginRight: 4 }} />
                임계치 도달
              </span>
            )}
            {member.resolvedReportCount >= Math.ceil(member.reportEscalationThreshold * 0.8) &&
              member.resolvedReportCount < member.reportEscalationThreshold &&
              member.reportEscalationThreshold > 0 && (
              <span className="badge badge-orange">
                <i className="ri-alert-line" style={{ marginRight: 4 }} />
                임계치 근접
              </span>
            )}
          </div>
        </div>
        <article className="card">
          <div className="card-body" style={{ paddingBottom: 8 }}>
            <p style={{ fontSize: 13, color: "var(--gray-600)" }}>
              처리완료된 신고 총 <strong>{member.resolvedReportCount}건</strong>
              {member.reportEscalationThreshold > 0 && ` (임계치: ${member.reportEscalationThreshold}건)`}
            </p>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>대상 유형</th>
                  <th>사유</th>
                  <th style={{ width: 110 }}>처리일</th>
                  <th style={{ width: 120 }}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {member.receivedReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>
                      피신고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  member.receivedReports.map((r) => (
                    <tr key={r.id}>
                      <td><span className="badge badge-blue">{r.targetType}</span></td>
                      <td>{r.reasonCode}</td>
                      <td className="num">
                        {r.reviewedAt ? formatDate(r.reviewedAt) : "—"}
                      </td>
                      <td>{r.reviewedByName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      ```

- [ ] Task 6: 검증 (AC: #1~#4)
  - [ ] `pnpm typecheck` (admin/api/contracts) 통과.
  - [ ] 특정 회원의 게시글·댓글에 대해 `reports.status='resolved'` 행 수동 INSERT → API 응답 `resolvedReportCount` 값이 일치하는지 raw SQL 대조.
  - [ ] `status='pending'`/`'dismissed'` 신고는 카운트에 포함되지 않는지 확인.
  - [ ] 회원 상세 브라우저 직접 열어: 피신고 이력 섹션 렌더, 임계치 배지 조건 확인.
  - [ ] 목록 "처리완료 신고" 컬럼 값이 상세 `resolvedReportCount`와 일치하는지 확인.

## Dev Notes

### 기존 `reportCount` 정확한 현재 정의 (보존 필수)

**`listUserMembers` (service.ts lines 134-138)**:
```sql
(SELECT COUNT(*)::int FROM reports r
WHERE (r.target_type = 'post' AND r.target_id IN (SELECT id FROM posts WHERE user_id = ${users.id}))
   OR (r.target_type = 'comment' AND r.target_id IN (SELECT id FROM comments WHERE author_id = ${users.id})))
```
- status 무관 raw 집계, **post/comment 만**, `comments.author_id` 올바름.

**`getUserMemberDetail` (service.ts lines 216-222)**: 동일 패턴.

이 두 서브쿼리는 **절대 변경 금지**. `resolvedReportCount` 는 별도 컬럼으로만 추가.

### `comments.author_id` vs `user_id` (G17 회귀 방지)

`comments` 테이블의 작성자 컬럼은 `author_id` (NOT `user_id`). 기존 `reportCount` 서브쿼리가 이미 `author_id` 를 올바르게 사용하고 있으므로, `resolvedReportCount` 서브쿼리 작성 시 동일하게 `author_id` 사용. 실수하면 comment 귀속이 전부 0이 됨.

### `admin_users.name` (피신고 이력 처리자)

`admin_users` 테이블 컬럼: `id`, `email`, **`name`**(NOT NULL), `phone`, `role`, `status` 등.
`reports.reviewed_by` → `admin_users.id` FK. `reviewedByName` 은 `admin_users.name` 으로 JOIN. `reviewed_by`가 NULL이면 (자동처리 또는 미기록) `reviewedByName = null`.

### `getSiteSetting` import 경로

`apps/api/src/lib/siteSettings.ts` 에 구현됨. service.ts 에서:
```typescript
import { getSiteSetting } from "../../../lib/siteSettings.js";
```
Redis 60초 캐시 적용(DB 매번 조회 아님). 12.4 가 `report_escalation_threshold` 키를 `site_settings` 에 INSERT하면 60초 내 자동 반영. 이전엔 null → fallback 5.

### Drizzle import 추가 필요

현재 service.ts `import { ... } from "@ai-jakdang/database/schema"` 에 `questions, answers, resources, adminUsers` 가 없음. Task 1·2에서 추가.
`adminUsers`는 `packages/database/src/schema/admin.ts` export, 동일 배럴(`@ai-jakdang/database/schema`)로 접근 가능 여부 확인 필요 — 없으면 개별 경로 import.

### 로컬 인터페이스 중복 (contracts 미사용 주의)

`members/page.tsx`(lines 14-29) 와 `[id]/page.tsx`(lines 51-77) 모두 로컬 `interface` 를 contracts 없이 정의해 사용 중. Task 4·5 에서 **로컬 인터페이스만 업데이트**하면 됨(contracts 타입으로 교체는 별도 리팩터링 스코프).

### 피신고 이력 섹션 삽입 위치 ([id]/page.tsx)

기존 레이아웃 순서:
1. 프로필 헤더 `<section>` (~line 651~700)
2. 기본 정보 `<section>` (~line 702~790)
3. 활동 내역 `<section>` (~line 792~1004, `id="member-activity-tabs"`)
4. **← 여기에 "피신고 이력" `<section>` 삽입** (~line 1005)
5. 모달 블록 (`{sanctionOpen && ...}`)

`MemberActivityTabs` 컴포넌트는 `id="member-activity-tabs"` 내부 `data-tab-panel` 패널만 관리 → 새 `<section>` 은 영향 없음. 새 탭을 기존 활동내역 탭에 추가하지 않고 별도 섹션으로 분리하는 것이 이 스토리의 의도.

### 12.4와의 임계치 경계 (핵심)

| 항목 | 소유 스토리 | 메모 |
|------|------------|------|
| `report_escalation_threshold` site_settings INSERT | **12.4** | 12.3 시점엔 행 없음 → fallback 5 |
| `report_auto_warning_enabled` | **12.4** | 12.3 무관 |
| 자동 경고 트리거(`user_sanctions` 자동 생성) | **12.4** | 12.3에서 호출 금지 |
| 에스컬레이션 플래그 | **12.4** | 12.3 무관 |
| `resolvedReportCount` 집계·표시·배지 | **이 스토리(12.3)** | 임계치는 settings 조회(fallback 5) |

12.4 머지 후: `site_settings` 에 `report_escalation_threshold` 행이 생기면 `getSiteSetting` 캐시 무효화(60초) 후 자동 반영. 12.3 코드 재수정 불필요.

### 12.1 선행 의존

`target_type='user'` 귀속(`OR r.target_type = 'user' AND r.target_id = ${users.id}`)은 12.1이 `report_target_type` enum 에 `user` 값을 추가해야 DB 오류 없이 쿼리 가능. 12.1 미머지 상태에서 `user` 케이스를 SQL에 포함해도 기존 데이터엔 없어서 0 카운트로 안전하지만, **enum 오류 없이 실행되는지** 확인(PostgreSQL `WHERE target_type = 'user'` 는 enum 값 존재 여부와 무관하게 실행됨 — 타입 캐스트 에러 없음).

### 이 스토리의 범위 (경계 엄수)

- 집계·표시·배지 **만**.
- `user_sanctions` 자동 생성, 에스컬레이션 플래그, 알림 발송은 **모두 12.4 소유 — 절대 호출 금지**.
- 신규 테이블 없음. `reports` 집계 쿼리 확장만.

### Project Structure Notes

- UPDATE: `apps/api/src/routes/admin/members/service.ts`
- UPDATE: `packages/contracts/src/admin/members.ts`
- UPDATE: `apps/admin/app/members/page.tsx`
- UPDATE: `apps/admin/app/members/[id]/page.tsx`
- 신규 마이그레이션 없음.
- `apps/admin/app/members/_components/MemberActivityTabs.tsx` — 읽기 전용(수정 없음). 새 섹션은 해당 탭 컨테이너 밖이므로 MemberActivityTabs 영향 없음.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.3 AC (line 3289~3311)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 12 경계 설명 (line 3228~3231)]
- [Source: _bmad-output/project-context.md#신고·제재 모더레이션 (Epic 12 — 절대 규칙)]
- [Source: _bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md#FR-8.7 신고 처리완료 누적 귀속]
- [Source: apps/api/src/routes/admin/members/service.ts (lines 134-138 기존 reportCount 서브쿼리, lines 216-222 상세 reportCount)]
- [Source: packages/contracts/src/admin/members.ts (adminUserMemberItemSchema, adminUserMemberDetailSchema)]
- [Source: apps/admin/app/members/page.tsx (로컬 interface, 신고 컬럼 lines 313/352-354)]
- [Source: apps/admin/app/members/[id]/page.tsx (로컬 interface, 신고 표기 line 693, 섹션 구조)]
- [Source: apps/admin/app/members/_components/MemberActivityTabs.tsx (탭 시스템 — admin:tab-change 이벤트)]
- [Source: apps/api/src/lib/siteSettings.ts (getSiteSetting 경로·캐시 60초)]
- [Source: packages/database/src/schema/engagement.ts (reports 테이블: id/reporter_id/target_type/target_id/reason_code/detail/status/reviewed_by/reviewed_at)]
- [Source: packages/database/src/schema/admin.ts (adminUsers 테이블: id/email/name)]
- [Source: _bmad-output/implementation-artifacts/12-1-user-report-target-schema-contracts-api.md (12.1 선행 — user enum 추가)]
- [Source: _bmad-output/implementation-artifacts/9-12-member-management-sanctions.md (회원 상세 화면 소유 스토리)]
- [AR-6: report 다형 모델], [AR-12: 어뷰징/브리게이딩 방어]
- [회귀주의: comments.author_id (G17 이력) — user_id 혼동 시 comment 귀속 전부 누락]
- [회귀주의: 기존 reportCount 서브쿼리 수정 금지 — 두 함수 모두 보존 대상]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
