# Story 9.10: 신고 관리 — 통합 큐 · 처리 · 반려 · cleanup worker

Status: done

## Story

As a 관리자,
I want 신고 통합 큐에서 확인 후 숨김·반려·이용제한 처리하고 상태를 갱신하기를,
So that 신고 콘텐츠를 판단 기반으로 처리하고 이력을 남긴다.

## Acceptance Criteria

1. `/reports` 진입 시 reports 통합 목록(대상 미리보기·유형·신고자·사유·신고일·상태·처리자). 필터(상태 접수/확인중/처리완료/반려·대상 유형·기간) URL 파라미터 반영(UX-DR-A8).
2. 신고 상세 드로어 "신고 대상 보기" 클릭 → 해당 콘텐츠 관리 화면 크로스 링크(9.9 contentCrossLink 재사용).
3. 상태 접수→확인중 변경: 즉시+토스트(undo 가능, UX-DR-A4 저위험).
4. 위반 확정 후 숨김 처리: `reports.status='처리완료'`, 대상 콘텐츠 `status='hidden'` 동시 갱신(트랜잭션). 즉시+토스트(undo).
5. 부당 신고 반려: 사유 메모 입력 필수 확정 → `reports.status='반려'`·대상 콘텐츠 변경 없음. 사유 없이 반려 버튼 비활성.
6. `packages/core/src/moderation.ts`에 `deriveReportAction(reportCount: number, threshold: number): 'auto_hide' | 'queue_only'` 순수 함수 구현. 단위 테스트(Vitest).
7. `apps/worker/src/jobs/cleanup.ts` NEW: BullMQ `cleanup` 큐의 `content.cleanup` job 구현. `status='deleted' AND deleted_at < NOW()-INTERVAL '30 days'` 레코드(posts/qna_questions/qna_answers/comments/resources) hard-delete. 연관 R2 파일 삭제 (`resource_files` 연결). 멱등성 보장(이미 없는 레코드 skip).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 (AC: #1~#5)
  - [ ] `GET /api/v1/admin/reports` — 목록(status/targetType/dateFrom/dateTo/page/pageSize/q)
  - [ ] `GET /api/v1/admin/reports/:id` — 상세(신고 정보 + 대상 콘텐츠 미리보기)
  - [ ] `PATCH /api/v1/admin/reports/:id/review` — 접수→확인중
  - [ ] `PATCH /api/v1/admin/reports/:id/hide` — 위반 확정+숨김(트랜잭션: reports.status='처리완료' + target status='hidden')
  - [ ] `PATCH /api/v1/admin/reports/:id/reject` — 반려(note 필수)
  - [ ] `packages/contracts/src/admin/reports.ts` NEW

- [ ] Task 2: 서비스 레이어 — 신고 처리 (AC: #4)
  - [ ] `apps/api/src/routes/admin/reports/service.ts` NEW
  - [ ] `hideTarget(reportId, adminId)`: db.transaction() — reports UPDATE + target 테이블 UPDATE (target_type 기반 동적 테이블 선택)
  - [ ] 동적 target 테이블 선택: `{ post: posts, qna_question: qnaQuestions, comment: comments, resource: resources }`

- [ ] Task 3: core/moderation.ts (AC: #6)
  - [ ] `packages/core/src/moderation.ts` NEW (또는 UPDATE):
    ```ts
    export function deriveReportAction(
      reportCount: number,
      threshold: number
    ): 'auto_hide' | 'queue_only' {
      if (threshold <= 0) return 'queue_only'; // 임계치 미설정
      return reportCount >= threshold ? 'auto_hide' : 'queue_only';
    }
    ```
  - [ ] `packages/core/src/moderation.test.ts` NEW: Vitest 단위 테스트 (임계치 0, 임계치 미달, 임계치 초과 케이스)
  - [ ] `packages/core/src/index.ts`에 export 추가

- [ ] Task 4: BullMQ cleanup worker (AC: #7)
  - [ ] `apps/worker/src/jobs/cleanup.ts` NEW
  - [ ] BullMQ `cleanup` 큐에서 `content.cleanup` job 처리
  - [ ] `site_settings`에서 `content_retention_days` 값 조회(기본 30일)
  - [ ] `posts`, `qna_questions`, `qna_answers`, `comments`, `resources` 순으로 expired deleted 레코드 조회
  - [ ] `resource_files` hard-delete + R2 오브젝트 삭제(cloudflare R2 SDK)
  - [ ] 각 테이블 hard-delete: `DELETE FROM ... WHERE status='deleted' AND deleted_at < NOW()-INTERVAL ':days days'`
  - [ ] 멱등성: 각 DELETE는 WHERE 조건에만 의존, 없는 레코드는 자연스럽게 skip
  - [ ] `apps/worker/src/index.ts` UPDATE: cleanup 큐 worker 등록
  - [ ] 큐 스케줄러: 매일 새벽 3시 CRON 등록 (`0 3 * * *`)

- [ ] Task 5: 프런트 — 신고 관리 (AC: #1~#5)
  - [ ] `apps/admin/app/reports/page.tsx` UPDATE (현재 파일 완독 필수)
  - [ ] 더미 REPORTS → 실제 `GET /api/v1/admin/reports` 데이터
  - [ ] 필터 패널: 상태 탭(전체/접수/확인중/처리완료/반려) + 대상 유형 셀렉트 + 기간
  - [ ] 행 상세 드로어: 신고 상세 + "신고 대상 보기" 링크(contentCrossLink)
  - [ ] 상태 변경 버튼: 확인중(즉시+토스트), 숨김(즉시+토스트), 반려(모달+사유 필수)
  - [ ] `apps/admin/app/reports/[id]/page.tsx` UPDATE (완독 필수): 상세 페이지

## Dev Notes

### 의존성
- **Epic 5 완료 필요**: `reports` 테이블 (target_type/target_id/status/reporter_id/reason/note)
- **9.9 완료**: `contentCrossLink` 유틸 재사용
- **9.15 완료 이전**: `site_settings.content_retention_days` 없으면 cleanup worker에서 기본 30일 하드코딩으로 시작

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/reports/page.tsx` (UPDATE): 현재 더미 REPORTS 배열, STATUS_TABS, 필터 패널, 테이블 — 전부 더미. 실제 API 연동 없음. 상태 변경 버튼 없음.
- `apps/admin/app/reports/[id]/page.tsx` (UPDATE): 상세 페이지 확인 필요.

### BullMQ 큐 컨벤션
- 큐명: `cleanup` (kebab-case)
- job명: `content.cleanup` (domain.action)
- 페이로드: `{ triggeredAt: string }` (또는 비어있는 페이로드, 멱등)
- 재시도: 최대 3회, 실패 시 DLQ(Dead Letter Queue)
- [Source: _bmad-output/project-context.md#통신 패턴]

### report.status 도메인 어휘
- DB 값: `received` / `reviewing` / `resolved` / `rejected`
- 표시값: `접수` / `확인중` / `처리완료` / `반려`

### soft-delete 보존기간 (30일 기본)
```sql
DELETE FROM posts 
WHERE status = 'deleted' 
  AND deleted_at < NOW() - INTERVAL '30 days';
```
`site_settings.content_retention_days` 값으로 동적 치환.

### 위험도별 확인
| 액션 | 위험도 | 패턴 |
|---|---|---|
| 접수→확인중 | 저 | 즉시+토스트(undo) |
| 위반 확정+숨김 | 저(되돌릴 수 있음) | 즉시+토스트(undo) |
| 반려 | 위험(되돌리기 어려움) | 모달+사유 필수 |

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/reports/`, `packages/contracts/src/admin/reports.ts`, `packages/core/src/moderation.ts`, `packages/core/src/moderation.test.ts`, `apps/worker/src/jobs/cleanup.ts`
- UPDATE: `apps/admin/app/reports/page.tsx`, `apps/worker/src/index.ts`, `packages/core/src/index.ts`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2833-2867] — AC 원문
- [Source: _bmad-output/project-context.md#통신 패턴] — BullMQ 큐 컨벤션
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-7, AR-16] — 멱등 worker

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
