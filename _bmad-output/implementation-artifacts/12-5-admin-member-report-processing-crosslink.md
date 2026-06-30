# Story 12.5: 관리자 신고관리 — 회원 신고 큐 처리 · 대상 보기 라우팅 · 제재 직접 연결

Status: ready-for-dev

## Story

As a 관리자,
I want 신고관리에서 회원 신고를 처리하고 "신고 대상 보기"가 회원 상세로 연결되며 거기서 바로 제재할 수 있기를,
so that 회원 신고를 콘텐츠 신고와 동일한 큐에서 일관되게 처리한다.

## Acceptance Criteria

1. **[목록·상세 액션 분기]** 신고관리 목록(`/reports`)·상세(`/reports/[id]`)에서 `targetType='user'`인 행/화면의 처리 액션에는 "대상 숨김" 대신 **"회원 제재"** 버튼이 노출된다. "확인중으로 변경"(pending일 때)과 "신고 반려"는 공통 노출. `canAct`(resolved/dismissed 아닐 때) 조건은 동일 적용. 회원에는 hidden 상태가 없으므로 "대상 숨김"·"숨김 해제"·"자동 숨김 복구"는 user 신고에서 렌더링 제외.

2. **[신고 대상 보기 라우팅]** 신고 상세의 "신고 대상 보기" 링크(`getCrossLink` 반환값)가 `targetType='user'`일 때 `/members/{targetId}`(회원 상세)로 라우팅된다. 현재 user는 default 분기로 null 반환 → 버튼 미노출이므로, `contentCrossLink.ts`에 user 케이스 추가로 해결.

3. **[제재 확정 → 신고 resolved 원자 처리]** "회원 제재" 확정 시 단일 API 호출(`PATCH /api/v1/admin/reports/:id/sanction-member`)로 ① 제재 1건 생성(`user_sanctions` INSERT + `users.status`/`suspendedUntil` 갱신, 기존 `sanctionMember` 재사용) ② 해당 신고 `status='resolved'` + `reviewedBy` + `reviewedAt` 기록이 트랜잭션으로 원자 처리된다. 성공 후 12.4의 `evaluateAuthorEscalation(targetId, adminId)` try/catch로 호출(실패가 처리를 막지 않음).

4. **[신고 닫기 정책]** "회원 제재"로 처리 시 **현재 신고 1건만 resolved**가 기본(같은 피신고 회원의 다른 pending 신고를 일괄 닫지 않는다). 일괄 닫기는 이 스토리 범위 밖.

5. **[검토 요망 필터]** 회원관리 목록(`/members`)에 "검토 요망" 탭/필터 옵션을 추가한다(12.4 에스컬레이션 기준: `resolvedReportCount >= report_escalation_threshold AND status='active'`). 회원 상세에서는 12.3의 피신고 이력 섹션 + 9.12의 제재 모달이 한 화면에서 동작하는지 확인(이미 구현됨).

6. **[기존 콘텐츠 신고 처리 회귀 없음]** 콘텐츠(`post`/`question`/`answer`/`comment`/`resource`/`message`) 신고의 기존 처리 액션 — "확인중으로 변경"(`/review`)·"대상 숨김"(`/hide`)·"신고 반려"(`/reject`)·"자동 숨김 복구"(`/restore-auto-hide`)·"숨김 해제"(`/unhide`)·`targetStatus`·`autoHidden` — 은 변경 없이 보존된다.

## Tasks / Subtasks

- [ ] **Task 1: getCrossLink user 케이스 추가** (AC: #2) [UPDATE]
  - [ ] `apps/admin/lib/contentCrossLink.ts` — `ContentTargetType` union에 `"user"` 추가:
    ```ts
    export type ContentTargetType = "post" | "question" | "answer" | "resource" | "comment" | "user";
    ```
  - [ ] `getCrossLink` switch에 케이스 추가:
    ```ts
    case "user":
      return `/members/${targetId}`;
    ```
  - [ ] 신고 상세 `reports/[id]/page.tsx` 이미 `crossLink && <Link href={crossLink}>신고 대상 보기</Link>` 패턴 사용 중 → user 케이스 추가만으로 버튼 자동 노출 확인. 신규 import 불필요.

- [ ] **Task 2: SanctionModal 공유 컴포넌트 추출** (AC: #1, #3) [NEW + UPDATE]
  - [ ] `apps/admin/app/members/_components/SanctionModal.tsx` NEW — `members/[id]/page.tsx` 내 로컬 `SanctionModal` 함수(lines 215–281)를 이 파일로 추출. 동일 props 인터페이스 유지:
    ```ts
    interface SanctionModalProps {
      onClose: () => void;
      onConfirm: (type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null) => void;
    }
    ```
  - [ ] 공유 `Modal`·`ModalFooter` 헬퍼도 동일 파일 또는 별도 `_components/Modal.tsx`에 추출(현재 `members/[id]/page.tsx` 로컬 정의 — `Modal`, `ModalFooter`, `Toast` 포함). 필요 최소한으로 추출.
  - [ ] `apps/admin/app/members/[id]/page.tsx` UPDATE — 로컬 정의 제거, import로 대체:
    ```ts
    import { SanctionModal } from "../_components/SanctionModal";
    ```
  - [ ] 기존 `sanctionOpen` 상태·`handleSanction` 핸들러·`POST /api/v1/admin/members/:userId/sanctions` 호출 로직은 변경 없이 보존.

- [ ] **Task 3: API — 신고 회원 제재 엔드포인트** (AC: #3) [NEW]
  - [ ] `apps/api/src/routes/admin/reports/service.ts` UPDATE — 신규 함수 추가:
    ```ts
    export async function resolveReportWithMemberSanction(
      reportId: string,
      targetUserId: string,
      type: "warning" | "suspend" | "permaban",
      reason: string,
      endsAt: Date | null,
      adminId: string,
    ): Promise<{ reportId: string; sanctionId: string }>
    ```
    - `db.transaction()`: ① `sanctionMember(targetUserId, type, reason, endsAt, adminId)` 호출(import from members/service.ts) → sanctionId 반환 ② `reports` UPDATE `status='resolved'`, `reviewedBy=adminId`, `reviewedAt=now`
    - 트랜잭션 완료 후 try/catch로 `evaluateAuthorEscalation(targetUserId, adminId)` 호출(12.4가 구현됐으면 import, 미구현이면 TODO 주석 + 빈 호출 위치 확보)
  - [ ] `apps/api/src/routes/admin/reports/index.ts` UPDATE — 신규 라우트 등록:
    ```ts
    // PATCH /admin/reports/:id/sanction-member
    app.patch("/admin/reports/:id/sanction-member", async (request, reply) => {
      const { id } = request.params as { id: string };
      const { targetUserId, type, reason, endsAt } = request.body as {
        targetUserId: string;
        type: "warning" | "suspend" | "permaban";
        reason: string;
        endsAt?: string | null;
      };
      const adminId = request.adminSession?.adminUserId ?? "";
      const result = await resolveReportWithMemberSanction(
        id, targetUserId, type, reason, endsAt ? new Date(endsAt) : null, adminId
      );
      return reply.send(result);
    });
    ```
  - [ ] contracts에 `adminSanctionFromReportSchema` Zod 스키마 추가(또는 inline validation): `{ targetUserId: z.string().uuid(), type: z.enum(["warning","suspend","permaban"]), reason: z.string().min(1), endsAt: z.string().datetime().nullable().optional() }`

- [ ] **Task 4: 신고 목록 페이지 — user 분기 추가** (AC: #1, #6) [UPDATE]
  - [ ] `apps/admin/app/reports/page.tsx`
    - `targetBadge()` 함수에 케이스 추가: `case "user": return ["badge-teal", "회원"];`
    - `TARGET_OPTIONS` 배열: 12.1 선행 완료 시 이미 `{ value: "user", label: "회원" }` 존재. 없으면 추가.
    - `actionItems` 조합 로직 수정 (현재 lines 476–490):
      ```ts
      const isUserReport = r.targetType === "user";

      const actionItems: RowActionItem[] = [
        { label: "상세보기", icon: "ri-eye-line", href: `/reports/${r.id}` },
        // 자동 숨김 복구: 콘텐츠 전용(user 제외)
        ...(!isUserReport && r.autoHidden && canAct
          ? [{ label: "자동 숨김 복구", icon: "ri-refresh-line", onClick: () => void handleRestoreAutoHide(r.id) }]
          : []),
        // 확인중으로 변경: 공통
        ...(canAct && r.status === "pending"
          ? [{ label: "확인중으로 변경", icon: "ri-search-eye-line", onClick: () => void handleReview(r.id) }]
          : []),
        // user: "회원 제재" / content: "대상 숨김"
        ...(canAct
          ? isUserReport
            ? [{ label: "회원 제재", icon: "ri-user-forbid-line", onClick: () => setSanctionTarget({ reportId: r.id, targetId: r.targetId }) }]
            : [{ label: "대상 숨김", icon: "ri-eye-off-line", onClick: () => void handleHide(r.id) }]
          : []),
        // 신고 반려: 공통
        ...(canAct
          ? [{ label: "신고 반려", icon: "ri-close-circle-line", danger: true, onClick: () => setRejectTarget(r.id) }]
          : []),
      ];
      ```
    - state 추가: `const [sanctionTarget, setSanctionTarget] = useState<{ reportId: string; targetId: string } | null>(null);`
    - `handleSanctionFromList(reportId, targetId, type, reason, endsAt)` 핸들러 추가:
      ```ts
      const handleSanctionFromList = async (
        reportId: string, targetId: string,
        type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null
      ) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${reportId}/sanction-member`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: targetId, type, reason, endsAt }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await notifyDialog("회원 제재가 적용되고 신고가 처리완료 되었습니다.");
          setSanctionTarget(null);
          void fetchReports();
        } catch {
          await notifyDialog("제재 처리 중 오류가 발생했습니다.", "danger");
        }
      };
      ```
    - JSX 끝 부분에 `SanctionModal` 렌더 추가:
      ```tsx
      {sanctionTarget && (
        <SanctionModal
          onClose={() => setSanctionTarget(null)}
          onConfirm={(type, reason, endsAt) =>
            void handleSanctionFromList(sanctionTarget.reportId, sanctionTarget.targetId, type, reason, endsAt)
          }
        />
      )}
      ```
    - `SanctionModal` import 추가: `import { SanctionModal } from "@/app/members/_components/SanctionModal";`

- [ ] **Task 5: 신고 상세 페이지 — user 분기 추가** (AC: #1, #2, #3) [UPDATE]
  - [ ] `apps/admin/app/reports/[id]/page.tsx`
    - `targetLabel()` 함수에 user 케이스 추가: `case "user": return ["badge-teal", "회원"];`
    - 상단 `page-actions` 영역의 "대상 숨김" 버튼 조건 수정:
      ```tsx
      // 기존: {canAct && !targetHidden && <button ...대상 숨김...>}
      // 수정: user 신고에는 "대상 숨김" 미노출, "회원 제재" 노출
      {canAct && report.targetType !== "user" && !targetHidden && (
        <button className="btn btn-secondary" disabled={actionLoading} onClick={() => void handleHide()}>
          <i className="ri-eye-off-line" /> 대상 숨김
        </button>
      )}
      {canAct && report.targetType === "user" && (
        <button className="btn btn-danger" disabled={actionLoading} onClick={() => setSanctionOpen(true)}>
          <i className="ri-user-forbid-line" /> 회원 제재
        </button>
      )}
      ```
    - "숨김 해제" 버튼(`targetHidden` 조건)도 user에서 제외:
      ```tsx
      {report && targetHidden && report.targetType !== "user" && (
        <button ...숨김 해제...>
      )}
      ```
    - state 추가: `const [sanctionOpen, setSanctionOpen] = useState(false);`
    - `handleSanctionFromDetail(type, reason, endsAt)` 핸들러:
      ```ts
      const handleSanctionFromDetail = async (
        type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null
      ) => {
        if (!report || actionLoading) return;
        setActionLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/sanction-member`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: report.targetId, type, reason, endsAt }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await notifyDialog("회원 제재가 적용되고 신고가 처리완료 되었습니다.");
          setSanctionOpen(false);
          void fetchReport();
        } catch {
          await notifyDialog("제재 처리 중 오류가 발생했습니다.", "danger");
        } finally {
          setActionLoading(false);
        }
      };
      ```
    - JSX 끝에 SanctionModal 렌더:
      ```tsx
      {sanctionOpen && report && (
        <SanctionModal
          onClose={() => setSanctionOpen(false)}
          onConfirm={(type, reason, endsAt) => void handleSanctionFromDetail(type, reason, endsAt)}
        />
      )}
      ```
    - `SanctionModal` import 추가.

- [ ] **Task 6: 검토 요망 필터 — 회원관리 목록** (AC: #5) [UPDATE]
  - [ ] `apps/api/src/routes/admin/members/service.ts` `listUserMembers` 함수:
    - 쿼리 파라미터에 `escalated?: boolean` 추가
    - `escalated=true`이면 WHERE 조건에: `resolvedReportCount >= threshold AND users.status = 'active'` 파생 조건 추가. `threshold`는 `getSiteSetting('report_escalation_threshold', 5)` 조회.
    - 또는 간단하게: escalated 필터를 HAVING 또는 서브쿼리로 처리. 파생 쿼리 우선(컬럼 추가 회피 — 12.4 원칙 동일).
  - [ ] `apps/admin/app/members/page.tsx` UPDATE:
    - 상태 탭 또는 필터에 "검토 요망" 옵션 추가. 기존 STATUS_TABS(`전체/정상/이용제한/탈퇴`) 외에 별도 필터 버튼 또는 탭으로 추가. URL 파라미터 `escalated=true` 반영.
    - API 호출 시 `escalated=true` param 포함.

- [ ] **Task 7: 검증** (AC: #1~#6)
  - [ ] `pnpm typecheck` (admin/api/contracts) 통과
  - [ ] admin:reset → sign-in 서명쿠키 발급 → Playwright `addCookies` 실로그인 (격리 curl로는 prefix/CORS 오류 못 잡음)
  - [ ] 신고관리 목록에서 user 신고 행: "대상 숨김" 미노출·"회원 제재" 노출 직접 확인
  - [ ] 신고 상세에서 user 신고: "신고 대상 보기" 클릭 → `/members/[targetId]` 이동 확인
  - [ ] "회원 제재" 모달 오픈 → 경고/일시정지/영구정지 선택 → 사유 입력 → 확정: API 200 + 신고 처리완료 배지 갱신 + 회원 제재 이력 확인
  - [ ] 기존 post/comment/question 신고 행의 "대상 숨김"·"자동 숨김 복구"·"숨김 해제" 정상 동작 확인 (회귀 없음)
  - [ ] 회원관리 "검토 요망" 필터 → 해당 회원 목록 노출 확인

## Dev Notes

### 선행 의존성
- **12.1 완료 필요**: `report_target_type` enum에 `user` 추가, TARGET_OPTIONS·targetBadge에 user 반영(12.1 산출). 12.5는 12.1이 있어야 user 신고 row가 존재.
- **12.3 완료 권장**: 회원 상세 `resolvedReportCount`·`receivedReports` 섹션. 없어도 12.5 독립 동작 가능(제재 모달과 무관).
- **12.4 완료 권장**: `evaluateAuthorEscalation` 함수. 없으면 Task 3에서 TODO 주석 + try/catch 위치만 확보. 12.5 자체 기능은 독립 동작.

### getCrossLink 현재 매핑 (완독 기준)
```ts
// apps/admin/lib/contentCrossLink.ts 현재 상태
export type ContentTargetType = "post" | "question" | "answer" | "resource" | "comment";
// switch 케이스: post → /posts/{board}/{id} 또는 /posts?highlight=:id
//               question/answer → /qna/:id
//               resource → /resources/:id
//               comment → /comments/:id
//               default → null   ← user는 여기 떨어져 null 반환
// message도 default → null (본 에픽 범위 밖, 별도 REVISION)
```
이 스토리에서 추가: `case "user": return '/members/' + targetId;`

### SanctionModal 재사용 — 추출 방법 (상세)
`members/[id]/page.tsx`의 현재 `SanctionModal` (lines 215–281):
- 내부 상태: `type("warning"|"suspend"|"permaban")`, `reason(string)`, `endsAt(string)`
- 외부 의존: `Modal`, `ModalFooter` 헬퍼 (같은 파일 로컬) → 이것도 함께 추출
- 추출 경로: `apps/admin/app/members/_components/SanctionModal.tsx`
- **추출 시 주의**: `SanctionModal`·`Modal`·`ModalFooter`는 현재 `members/[id]/page.tsx` 파일 내에만 있음. 추출 후 members 페이지에서 import 교체. 기존 동작(`sanctionOpen` state, `handleSanction` 핸들러)은 변경 없음 — **UI 계약 불변**.

### 기존 신고 처리 액션 보존 명시 (회귀 금지)
보존해야 할 기존 7차 배치 산출:
- `handleReview` → `PATCH /reports/:id/review` (확인중으로 변경)
- `handleHide` → `PATCH /reports/:id/hide` (대상 숨김 + reports.resolved + target.hidden 트랜잭션)
- `handleReject` + `RejectModal` → `PATCH /reports/:id/reject` (사유 필수)
- `handleRestoreAutoHide` → `PATCH /reports/:id/restore-auto-hide` (자동 숨김 복구)
- `handleUnhide` → `PATCH /reports/:id/unhide` (숨김 해제 + resolved→reviewing 복귀) — 상세 페이지 전용
- `targetStatus` 조건부 "숨김 해제" 버튼 — 상세 페이지 전용
- `autoHidden` badge, `canAct` 조건 — 변경 없음

이 스토리의 모든 분기 추가는 `isUserReport` 조건으로 격리하고, false 경로는 기존 코드 그대로.

### 신고 닫기 정책 확정
**현재 신고 1건만 resolved.** `PATCH /reports/:id/sanction-member`는 `reportId`로 지정된 1건만 처리완료. 같은 회원에 대한 다른 pending/reviewing 신고는 각자 별도 처리. 일괄 닫기는 이 스토리 범위 밖(추후 관리자 요청 시 별도 구현).

### resolveReportWithMemberSanction 서비스 함수 설계
```ts
// apps/api/src/routes/admin/reports/service.ts 신규 추가
import { sanctionMember } from "../members/service"; // 교차 import (동일 앱 내 허용)

export async function resolveReportWithMemberSanction(
  reportId: string,
  targetUserId: string,
  type: "warning" | "suspend" | "permaban",
  reason: string,
  endsAt: Date | null,
  adminId: string,
) {
  const db = getDb();
  const now = new Date();

  // 신고 존재 확인
  const [existing] = await db.select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId })
    .from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!existing) throw Object.assign(new Error("신고를 찾을 수 없습니다."), { code: "NOT_FOUND" });

  // sanction + report resolve 원자 처리
  // ⚠️ sanctionMember 내부에 db.transaction()이 있으므로 중첩 방지:
  //   Option A) sanctionMember를 트랜잭션 밖에서 먼저 호출, 실패 시 보상(없음 — 신고 resolve는 멱등)
  //   Option B) sanctionMember 로직을 inline으로 트랜잭션에 포함
  // → Option A 선택(구현 단순성):
  const { id: sanctionId } = await sanctionMember(targetUserId, type, reason, endsAt, adminId);
  await db.update(reports)
    .set({ status: "resolved", reviewedBy: adminId, reviewedAt: now })
    .where(eq(reports.id, reportId));

  // 12.4 에스컬레이션 평가 (비차단 — 실패해도 제재/신고 처리는 완료)
  try {
    // import { evaluateAuthorEscalation } from "../../lib/escalation"; // 12.4 완료 시 활성화
    // await evaluateAuthorEscalation(targetUserId, adminId);
  } catch (e) {
    console.error("[escalation] 평가 중 오류:", e);
  }

  return { reportId, sanctionId };
}
```
`sanctionMember` 내부에서 type='warning'은 `users.status` 변경 없음(기존 구현 그대로). type='suspend'/'permaban'은 `users.status='suspended'` + `suspendedUntil` 갱신.

### 검수 절차 (실로그인 필수)
```bash
# 1. 마스터 계정 초기화 (필요 시)
pnpm --filter api admin:reset

# 2. sign-in으로 서명쿠키 발급
curl -X POST http://localhost:4003/api/v1/admin/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"aijackdang@gmail.com","password":"..."}' \
  -c /tmp/admin.cookie

# 3. Playwright addCookies로 실 브라우저 검수
# → 신고관리 /reports 에서 user 신고 행 확인
# → 제재 모달 오픈 → 경고 선택 → 사유 입력 → 확정
# → /reports/{id} 상세에서 "처리완료" 배지 확인
# → /members/{targetId} 에서 제재 이력 확인
```
격리 curl만으로는 `/api/v1/` 이중 prefix 오류, CORS 누락을 못 잡음 — 반드시 브라우저 실요청으로 검증.

### 12.4 연동 주의점
- `evaluateAuthorEscalation`은 12.4 Story가 완료돼야 import 가능.
- 12.5 단독 구현 시 try/catch 블록에 TODO 코멘트만 남기고 빈 함수 호출 패턴 유지.
- 12.4가 `hideTarget` 내부에도 동일 호출을 추가하므로, 12.5 엔드포인트만 추가 호출 위치로 등록하면 됨.

### Project Structure Notes

```
[UPDATE] apps/admin/lib/contentCrossLink.ts
  — ContentTargetType에 "user" 추가, getCrossLink user 케이스 추가

[NEW]    apps/admin/app/members/_components/SanctionModal.tsx
  — members/[id]/page.tsx에서 SanctionModal·Modal·ModalFooter 추출

[UPDATE] apps/admin/app/members/[id]/page.tsx
  — 로컬 SanctionModal·Modal·ModalFooter 제거, import로 대체

[UPDATE] apps/admin/app/reports/page.tsx
  — targetBadge user 케이스, actionItems user 분기, SanctionModal 통합

[UPDATE] apps/admin/app/reports/[id]/page.tsx
  — targetLabel user 케이스, "대상 숨김"/"숨김 해제" user 제외, "회원 제재" 버튼+모달 추가

[UPDATE] apps/api/src/routes/admin/reports/service.ts
  — resolveReportWithMemberSanction() 신규 함수 추가

[UPDATE] apps/api/src/routes/admin/reports/index.ts
  — PATCH /admin/reports/:id/sanction-member 라우트 등록

[UPDATE] apps/api/src/routes/admin/members/service.ts
  — listUserMembers에 escalated 필터 파라미터 추가

[UPDATE] apps/admin/app/members/page.tsx
  — "검토 요망" 탭/필터 옵션 추가 + URL 파라미터 escalated 반영

신규 테이블 없음. 신규 마이그레이션 없음.
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.5 AC] — 원문 AC
- [Source: apps/admin/lib/contentCrossLink.ts] — getCrossLink 현재 매핑 (user 미지원, default null)
- [Source: apps/admin/app/reports/page.tsx] — actionItems 조합 로직 (lines 476–490), handleHide·handleReview·handleReject·handleRestoreAutoHide 핸들러
- [Source: apps/admin/app/reports/[id]/page.tsx] — crossLink 사용 패턴, targetHidden/canAct 조건, handleUnhide·RejectModal
- [Source: apps/admin/app/members/[id]/page.tsx lines 215–281] — SanctionModal 로컬 정의 (추출 대상), Modal·ModalFooter 헬퍼
- [Source: apps/api/src/routes/admin/members/service.ts#sanctionMember] — `sanctionMember(userId, type, reason, endsAt, issuedBy)` 시그니처, type='warning'은 users.status 불변
- [Source: apps/api/src/routes/admin/members/index.ts] — `POST /admin/members/:id/sanctions` 기존 라우트 (12.5는 직접 호출 안 하고 service 함수 재사용)
- [Source: apps/api/src/routes/admin/reports/service.ts] — hideTarget·rejectReport·unhideTarget·restoreAutoHidden 패턴 (보존 대상)
- [Source: _bmad-output/implementation-artifacts/9-12-member-management-sanctions.md] — 제재 모달·sanctions API 소유 스토리
- [Source: _bmad-output/implementation-artifacts/12-3-resolved-report-aggregation-author-attribution.md] — resolvedReportCount 집계 패턴
- [Source: _bmad-output/implementation-artifacts/12-4-auto-warning-escalation-sanction-notify.md] — evaluateAuthorEscalation 시그니처, 에스컬레이션 파생 쿼리 기준
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Flow E] — 위반 회원 제재 여정 + Epic 12 확장 노트
- [Source: _bmad-output/project-context.md#신고·제재 모더레이션] — 절대 규칙: resolved 기준 카운트, 자동 정지 금지, 하드코딩 금지
- [회귀주의: 7차 배치 — targetStatus·/unhide·resolved canAct·autoHidden 보존]
- [UX-DR-A1: danger pill 위험/미처리], [UX-DR-A4: 위험 액션 모달 — 제재 확정]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
