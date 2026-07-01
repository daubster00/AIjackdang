# Story 12.4: 누적 임계치 자동 경고 + 관리자 에스컬레이션 + 제재 통보 알림

Status: done

## Story

As a 관리자,
I want 회원의 처리완료 신고 누적이 임계치에 도달하면 자동 경고가 발부되고 검토 큐로 승격되며, 모든 제재가 당사자에게 통보되기를,
so that 상습 위반을 자동으로 감지·격상하되 정지 이상의 결정은 사람이 내린다.

## Acceptance Criteria

1. `site_settings` 테이블에 `report_escalation_threshold`(JSONB int, 기본 5)·`report_auto_warning_enabled`(JSONB bool, 기본 `false`)를 추가하고, 관리자 설정 화면 신고 탭에서 조정할 수 있다. 하드코딩 금지.

2. 신고가 처리완료(`reports.status='resolved'`)로 전이되는 시점(`hideTarget` — 콘텐츠 신고, 12.5의 회원 신고 제재 처리)에 해당 작성자의 누적 처리완료 신고수를 재집계한다. `report_auto_warning_enabled=true` + `resolvedReportCount >= threshold` + 해당 임계치 구간 자동 경고 미존재 이면: **자동 `user_sanctions(type='warning')` 1건 생성**(`reason`=`"auto-warning:신고 누적 {N}회"`, `issuedBy`=처리 관리자 또는 null). **자동 `suspend`/`permaban` 절대 금지**.

3. 멱등 보장: 같은 임계치 구간 재진입 시 중복 경고 금지. 전략: `Math.floor(resolvedCount / threshold) > existingAutoWarningCount` 일 때만 발부. `existingAutoWarningCount`는 `user_sanctions` WHERE `userId=X AND type='warning' AND reason ILIKE 'auto-warning:%'` 카운트. `users` 컬럼 추가 금지, 파생 쿼리로 해결.

4. 에스컬레이션(검토 요망) 발생 시 대시보드 운영 알림(`/api/v1/admin/dashboard/alerts`)에 `flaggedUsers`("검토 요망 회원 N명") 필드 추가. 에스컬레이션 플래그는 파생 쿼리(`resolvedReportCount >= threshold AND users.status='active'`)로 집계. `users` 테이블 컬럼 추가 금지.

5. 제재 부여(경고·정지·영구밴 — `sanctionMember` 수동 호출 시)와 자동 경고 발부 시 당사자에게 인앱 알림 발송. 알림 타입: `"sanction.applied"`(이미 contracts에 존재 — 신규 enum 값 불필요). `title`="운영 조치 안내", `body`=사유·종료일 포함 문자열. 알림 실패는 제재 자체를 막지 않는다(try/catch).

6. `report_auto_warning_enabled=false`(기본값)이면 신고 처리완료 시 자동 액션 없음. 기존 `hideTarget`/제재 처리 흐름 회귀 없음.

## Tasks / Subtasks

- [ ] Task 1: 사이트 설정 키 추가 (AC: #1, #6) [UPDATE]
  - [ ] DB 시드에 `report_escalation_threshold`(기본값 `5`)·`report_auto_warning_enabled`(기본값 `false`) INSERT — `packages/database/src/schema/site-settings.ts` 시드 파일 또는 마이그레이션 확인 후 추가. 키가 없을 때만 INSERT(멱등 보장).
  - [ ] `apps/admin/app/settings/_components/SettingsTabPanels.tsx` UPDATE:
    - `AdminSettingsResponse` 인터페이스(파일 상단, 현재 `auto_hide_enabled?` 등 열거)에 `report_escalation_threshold?: unknown`, `report_auto_warning_enabled?: unknown` 추가
    - state 선언부에 `const [reportEscalationThreshold, setReportEscalationThreshold] = useState(5)` + `const [reportAutoWarningEnabled, setReportAutoWarningEnabled] = useState(false)` 추가
    - `loadSettings` 내 `data.report_escalation_threshold`·`data.report_auto_warning_enabled` 읽어 state에 반영 (기존 `data.auto_hide_threshold` 패턴 복제)
    - 신고 탭 JSX에 에스컬레이션 토글("누적 자동경고 활성화") + 임계치 숫자 입력 필드 추가 (기존 `autoHideEnabled`/`autoHideThreshold` 토글+입력 패턴과 동일 구조)
    - 신고 탭 저장 핸들러(현재 파일 내 `saveModeration` 또는 `saveReport` 이름 직접 확인 후 수정)의 PATCH payload에 `report_escalation_threshold: reportEscalationThreshold`, `report_auto_warning_enabled: reportAutoWarningEnabled` 추가
  - [ ] API(`PATCH /api/v1/admin/settings`)는 임의 키 UPSERT 구조이므로 별도 API 변경 불필요 — 프론트 payload 키 이름만 DB 키와 일치하면 됨

- [ ] Task 2: 에스컬레이션 평가 함수 (AC: #2, #3) [NEW]
  - [ ] `apps/api/src/lib/escalation.ts` NEW — 다음 세 함수 구현:

    **1) `resolveAuthorUserId(targetType, targetId, db): Promise<string | null>`**
    - `post` → `SELECT user_id FROM posts WHERE id = targetId`
    - `question` → `SELECT user_id FROM questions WHERE id = targetId`
    - `answer` → `SELECT user_id FROM answers WHERE id = targetId`
    - `comment` → `SELECT author_id FROM comments WHERE id = targetId`
    - `resource` → `SELECT user_id FROM resources WHERE id = targetId`
    - `user` → `targetId` 자체 반환(12.5 회원 신고 경로)
    - 그 외 → `null`

    **2) `getResolvedReportCountForUser(userId, db): Promise<number>`**
    - 12.3의 `resolvedReportCount` 집계 로직과 동일. `reports.status='resolved'` 건 중 해당 userId가 작성자인 것 합산:
      - `post`/`question`/`answer`/`resource` → 해당 테이블의 `user_id` 서브쿼리로 귀속
      - `comment` → `comments.author_id` 서브쿼리
      - `user` (12.1 추가) → `reports.target_id = userId` 직접 매칭
    - SQL 또는 Drizzle ORM으로 구현. 성능: 인덱스 커버 가능 쿼리 우선.

    **3) `evaluateAuthorEscalation(authorUserId, adminId): Promise<{ warned: boolean }>`**
    ```typescript
    import { getDb } from "@ai-jakdang/database";
    import { getRedisPublisher } from "./redis.js";  // apps/api/src/lib/redis.ts
    import { getSiteSetting } from "./siteSettings.js";
    import { sanctionMember } from "../routes/admin/members/service.js";
    import { publishNotification } from "./notifications.js";
    import { userSanctions } from "@ai-jakdang/database/schema";
    import { eq, and, sql, count } from "drizzle-orm";

    export async function evaluateAuthorEscalation(
      authorUserId: string,
      adminId: string | null,
    ): Promise<{ warned: boolean }> {
      const enabled = await getSiteSetting<boolean>("report_auto_warning_enabled");
      if (!enabled) return { warned: false };

      const threshold = (await getSiteSetting<number>("report_escalation_threshold")) ?? 5;
      const db = getDb();

      const resolvedCount = await getResolvedReportCountForUser(authorUserId, db);
      if (resolvedCount < threshold) return { warned: false };

      // 멱등: floor(resolvedCount / threshold) > 기존 자동경고 수
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(userSanctions)
        .where(
          and(
            eq(userSanctions.userId, authorUserId),
            eq(userSanctions.type, "warning"),
            sql`${userSanctions.reason} ILIKE 'auto-warning:%'`,
          ),
        );
      const existingAutoWarningCount = Number(cnt ?? 0);
      const currentBucket = Math.floor(resolvedCount / threshold);
      if (currentBucket <= existingAutoWarningCount) return { warned: false };

      // 자동 경고 생성
      const reason = `auto-warning:신고 누적 ${resolvedCount}회`;
      await sanctionMember(authorUserId, "warning", reason, null, adminId);

      // 알림 발송 (실패해도 경고 자체는 성공)
      try {
        const redis = getRedisPublisher();
        await publishNotification(
          authorUserId,
          {
            type: "sanction.applied",
            title: "운영 조치 안내",
            body: `신고 누적 ${resolvedCount}회로 자동 경고가 발부되었습니다.`,
          },
          db,
          redis,
        );
      } catch (err) {
        console.error("[escalation] 알림 발송 실패 (무시):", (err as Error).message);
      }

      return { warned: true };
    }
    ```

- [ ] Task 3: 처리완료 전이 지점에 트리거 연결 (AC: #2) [UPDATE]
  - [ ] `apps/api/src/routes/admin/reports/service.ts` UPDATE — `hideTarget` 함수(line 314~361) 수정:
    - import 추가: `import { resolveAuthorUserId, evaluateAuthorEscalation } from "../../../lib/escalation.js";`
    - 트랜잭션 `updated` 반환 후, 트랜잭션 바깥에서:
      ```typescript
      // try/catch: 에스컬레이션 실패가 hideTarget 응답을 막지 않음
      try {
        const authorUserId = await resolveAuthorUserId(targetType, targetId, db);
        if (authorUserId) {
          await evaluateAuthorEscalation(authorUserId, adminId);
        }
      } catch (err) {
        console.error("[reports] escalation evaluation failed (무시):", (err as Error).message);
      }
      ```
    - 참고 패턴: `apps/api/src/routes/v1/reports.ts` line 114~155 자동 숨김 try/catch
    - **`targetType='user'`는 `hideTarget` 호출 대상 아님**(12.5 전용 처리 경로) — `resolveAuthorUserId`는 'user' 케이스를 처리하지만, `hideTarget`이 targetType='user'를 받는 일은 설계상 없음

- [ ] Task 4: 수동 제재 통보 알림 (AC: #5) [UPDATE]
  - [ ] `apps/api/src/routes/admin/members/index.ts` UPDATE — `POST /api/v1/admin/members/:id/sanctions`(line 105~136) 핸들러 수정:
    - import 추가: `import { publishNotification } from "../../../lib/notifications.js";` + `import { getRedisPublisher } from "../../../lib/redis.js";` + `import { getDb } from "@ai-jakdang/database";`
    - `sanctionMember(...)` 호출 성공(`result` 반환) 후, `return reply.status(201).send(result)` **전에** try/catch로 알림 발송:
      ```typescript
      try {
        const db = getDb();
        const redis = getRedisPublisher();
        const endsAtLabel = endsAt
          ? ` (${new Date(endsAt).toLocaleDateString("ko-KR")}까지)`
          : "";
        const typeLabel = type === "warning" ? "경고" : type === "suspend" ? "정지" : "영구 이용 정지";
        await publishNotification(
          id,  // userId
          {
            type: "sanction.applied",
            title: "운영 조치 안내",
            body: `[${typeLabel}${endsAtLabel}] ${reason}`,
          },
          db,
          redis,
        );
      } catch (err) {
        request.log.warn({ err }, "[members] 제재 알림 발송 실패 (무시)");
      }
      ```

- [ ] Task 5: 대시보드 "검토 요망 회원" 카운트 (AC: #4) [UPDATE]
  - [ ] `packages/contracts/src/admin/dashboard.ts` UPDATE — `dashboardAlertsResponseSchema`(현재 `{reports, pendingQna, newResources}`)에 `flaggedUsers: z.number().int().nonnegative()` 추가
  - [ ] 대시보드 알림 API 구현 파일 확인 (`apps/api/src/routes/admin/dashboard/` 또는 관련 서비스) UPDATE — `flaggedUsers` 집계 추가:
    - `getSiteSetting<number>("report_escalation_threshold")` 폴백 5
    - 파생 쿼리: resolved 신고를 작성자로 귀속(Task 2의 `getResolvedReportCountForUser` 로직 참고) 후 COUNT >= threshold인 활성(`status='active'`) 회원 수
    - 대략적 SQL(Drizzle 변환):
      ```sql
      WITH rc AS (
        SELECT u.id, COUNT(r.id) AS cnt
        FROM users u
        JOIN reports r ON (
          (r.target_type = 'post' AND r.target_id IN (SELECT id FROM posts WHERE user_id = u.id))
          OR (r.target_type = 'comment' AND r.target_id IN (SELECT id FROM comments WHERE author_id = u.id))
          OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions WHERE user_id = u.id))
          OR (r.target_type = 'answer' AND r.target_id IN (SELECT id FROM answers WHERE user_id = u.id))
          OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources WHERE user_id = u.id))
          OR (r.target_type = 'user' AND r.target_id = u.id)
        )
        WHERE r.status = 'resolved' AND u.status = 'active'
        GROUP BY u.id
        HAVING COUNT(r.id) >= :threshold
      )
      SELECT COUNT(*) FROM rc
      ```
    - 성능 주의: 대시보드 호출마다 실행됨 → 복잡도 경감 위해 `cache: 'no-store'`이지만 쿼리 자체는 인덱스 활용(reports.status, reports.target_type 인덱스 확인)
  - [ ] `apps/admin/app/dashboard/page.tsx` UPDATE — 기존 `DashboardAlertsResponse` 렌더 영역에 `flaggedUsers` 노출:
    - `alerts.flaggedUsers > 0`일 때 danger pill("검토 요망 회원 {N}명") 렌더 (UX-DR-A1 danger 톤)
    - pill 클릭 → `/members?flagged=true` 또는 `/reports?targetType=user` (12.5 정합 — 12.5 구현 후 라우팅 확정)

- [ ] Task 6: 검증 (AC: #1~#6)
  - [ ] `pnpm typecheck` 통과 (contracts 스키마 변경, 신규 lib 파일 타입 체크 포함)
  - [ ] OFF(기본): 신고 `hideTarget` 처리 후 자동 경고/알림 없음 확인(회귀 없음)
  - [ ] ON + `resolvedCount >= threshold`: `user_sanctions`에 `type='warning'` 1건 생성, `reason ILIKE 'auto-warning:%'` 확인, `sanction.applied` 알림 발송, 대시보드 `flaggedUsers > 0` 확인
  - [ ] ON + 동일 임계치 구간 재처리(같은 유저, 추가 신고 resolved): 중복 경고 미발부(멱등) 확인
  - [ ] 자동 `suspend`/`permaban` 미발생 확인
  - [ ] 수동 제재(경고/정지/영구밴) 후 `sanction.applied` 알림 발송 확인

## Dev Notes

### 선행 의존성
- **12.1 완료 필수**: `report_target_type` enum에 `user` 값 존재. `resolveAuthorUserId`의 `'user'` 케이스가 동작하려면 12.1의 스키마 확장이 선행돼야 함.
- **12.3 완료 필수**: `resolvedReportCount` 집계 로직. Task 2의 `getResolvedReportCountForUser`는 12.3의 집계와 동일한 로직을 `lib/escalation.ts`로 추출해 공유하거나, 12.3이 이미 추출한 함수가 있으면 그것을 import.

### publishNotification 시그니처 (실코드 확인 완료)
- 파일: `apps/api/src/lib/notifications.ts`
- 시그니처: `publishNotification(userId: string, payload: NotificationEventPayload, db: Database, redisPublisher: Redis): Promise<...>`
- `db` 주입: `getDb()` from `@ai-jakdang/database`
- `redis` 주입: **`getRedisPublisher()`** from `apps/api/src/lib/redis.ts` (`import { getRedisPublisher } from "./redis.js"`)
  - `getApiRedis()`(일반/구독용)가 아닌 **`getRedisPublisher()`**(PUBLISH 전용) 사용
- `NotificationEventPayload` 타입: `packages/contracts/src/notification.ts`의 `notificationEventPayloadSchema` 참조
- **`"sanction.applied"` 타입**: `notificationType` enum에 이미 존재(line 26, `packages/contracts/src/notification.ts`). 신규 enum 값 추가 불필요. `DEFAULT_NOTIFICATION_SETTINGS`에도 `"sanction.applied": true`로 포함돼 SSE 발송됨.

### sanctionMember 동작 (실코드 확인 완료)
- 파일: `apps/api/src/routes/admin/members/service.ts`, line 337
- 시그니처: `sanctionMember(userId, type, reason, endsAt, issuedBy)`
- **`type='warning'`이면 `users.status` 변경 없음** (line 377 조건문: `if (type !== "warning") { ...update users... }`). 경고는 `user_sanctions` INSERT만.
- 자동 경고 호출: `sanctionMember(authorUserId, "warning", "auto-warning:신고 누적 N회", null, adminId ?? null)`

### 자동 숨김(9.11)과 구분
| | 9.11 자동 숨김 | 12.4 자동 경고 |
|---|---|---|
| **기준** | 신고 접수 누적(pending 포함) | 처리완료 누적(resolved만) |
| **대상** | 콘텐츠(post/comment 등) | 작성자(user_sanctions) |
| **트리거 위치** | `apps/api/src/routes/v1/reports.ts` | `apps/api/src/routes/admin/reports/service.ts` `hideTarget` |
| **피처 플래그** | `auto_hide_enabled` | `report_auto_warning_enabled` |
| **기본값** | false | false |
| **상한** | 콘텐츠 hidden | 경고(warning)만 — 정지/영구밴 절대 금지 |

두 플래그는 독립적이다. 한쪽을 켜도 다른 쪽에 영향 없음.

### hideTarget 수정 포인트
현재 `hideTarget`(`apps/api/src/routes/admin/reports/service.ts`, line 314):
1. `existing` 조회: `{ id, targetType, targetId }` 이미 확보됨
2. 트랜잭션: `reports.status='resolved'` + 대상 콘텐츠 `status='hidden'`
3. **추가 위치**: 트랜잭션 `await db.transaction(...)` 반환 후, `return { id, status, reviewedAt }` 전에 try/catch 블록 삽입
4. `targetType`·`targetId`는 이미 `existing`에서 꺼낸 변수이므로 추가 쿼리 없이 `resolveAuthorUserId`에 전달 가능

참고 패턴 (9.11 자동숨김, `apps/api/src/routes/v1/reports.ts` line 114~155):
```typescript
try {
  // 설정 조회 → 평가 → 액션
} catch (err) {
  console.error("[reports] 자동 숨김 처리 실패 (무시):", (err as Error).message);
}
```

### 멱등 전략 (스키마 변경 없이)
```
existingAutoWarningCount = COUNT(user_sanctions WHERE userId AND type='warning' AND reason ILIKE 'auto-warning:%')
currentBucket = Math.floor(resolvedCount / threshold)
issue = currentBucket > existingAutoWarningCount
```
- `reason` prefix `'auto-warning:'`으로 자동/수동 경고를 DB 조회로 구분
- `users` 컬럼 추가 없음. 마이그레이션 없음.
- 구간 예시: threshold=5, resolvedCount=5 → bucket=1, existingAuto=0 → 발부. resolvedCount=7 → bucket=1, existingAuto=1 → 스킵. resolvedCount=10 → bucket=2, existingAuto=1 → 발부(2차 경고).

### Project Structure Notes
- **NEW**: `apps/api/src/lib/escalation.ts`
- **UPDATE**: `apps/api/src/routes/admin/reports/service.ts` (`hideTarget` 함수 끝부분)
- **UPDATE**: `apps/api/src/routes/admin/members/index.ts` (sanctions POST 핸들러, 알림 추가)
- **UPDATE**: `packages/contracts/src/admin/dashboard.ts` (`dashboardAlertsResponseSchema.flaggedUsers` 추가)
- **UPDATE**: `apps/admin/app/dashboard/page.tsx` (`DashboardAlertsResponse.flaggedUsers` 렌더)
- **UPDATE**: `apps/admin/app/settings/_components/SettingsTabPanels.tsx` (모더레이션 탭 2개 필드 추가)
- 신규 DB 테이블 없음. `users` 컬럼 추가 없음. DB 마이그레이션 없음(site_settings INSERT만).

### References

- [Source: apps/api/src/lib/notifications.ts] — `publishNotification` 시그니처·의존성(db, redisPublisher) 실확인
- [Source: apps/api/src/lib/redis.ts] — `getRedisPublisher()` (PUBLISH 전용, line 50) vs `getApiRedis()` (일반, line 26) 구분
- [Source: packages/contracts/src/notification.ts] — `notificationType` enum `"sanction.applied"` 기존 존재(line 26), 신규 추가 불필요
- [Source: apps/api/src/routes/admin/members/service.ts#sanctionMember] — `type='warning'` 시 `users.status` 변경 없음(line 377 조건)
- [Source: apps/api/src/routes/admin/members/index.ts] — `POST /api/v1/admin/members/:id/sanctions` 핸들러(line 105~136), 알림 추가 지점
- [Source: apps/api/src/routes/admin/reports/service.ts#hideTarget] — 처리완료 전이 지점(line 314), 추가 위치 확인
- [Source: apps/api/src/routes/v1/reports.ts#L114-155] — 자동 숨김 try/catch 패턴(복제 대상)
- [Source: apps/api/src/lib/siteSettings.ts] — `getSiteSetting<T>(key)` 시그니처·캐시 동작
- [Source: apps/admin/app/settings/_components/SettingsTabPanels.tsx] — `AdminSettingsResponse` 인터페이스·신고 탭 UI 패턴(line 11~30, 180~191)
- [Source: packages/contracts/src/admin/dashboard.ts] — `dashboardAlertsResponseSchema` 현재 구조(`{reports, pendingQna, newResources}`) 확인
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.4] — AC 원문·설계 의도
- [UX-DR-A1: danger pill — 미처리/위험 항목 강조]
- [UX-DR-A4: 위험 액션(정지/영구밴) 확인 모달]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
