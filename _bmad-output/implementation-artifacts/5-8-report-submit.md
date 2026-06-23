# Story 5.8: 신고 제출

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 부적절한 글·질문·답변·자료·댓글을 신고하기를,
so that 운영자가 검토하고 커뮤니티 환경이 유지된다.

## Acceptance Criteria

1. 로그인 회원이 [신고] 클릭 시 모달에 사유 목록(스팸·욕설·개인정보 노출·허위정보·기타)이 표시되고, [기타] 선택 시 상세 textarea가 열린다.
2. 사유 선택 후 [신고] 버튼 클릭 시 `POST /api/v1/reports`에 `{ targetType, targetId, reasonCode, detail? }` 전송, `status=pending` INSERT + 성공 토스트. 자동 숨김·처리는 Epic 9 담당.
3. 동일 콘텐츠 재신고 시 409 ALREADY_REPORTED + "이미 신고됨" 표시.
4. 비회원 [신고] 클릭 시 로그인 유도 모달(UX-DR-U1).
5. 신고 모달: 포커스 트랩·Esc 키로 닫기·`aria-labelledby`(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — reports (AC: #2, #3) [NEW]
  - [ ] `apps/api/src/routes/v1/reports.ts` 생성
  - [ ] `POST /api/v1/reports`: body `createReportInputSchema`(contracts), 인증 필요, 동일 (reporter_id, target_type, target_id) UNIQUE 확인 → 중복 시 409 ALREADY_REPORTED, `status='pending'` INSERT, 204 또는 `{ id, status: 'pending' }` 반환
  - [ ] `reasonCode` enum 값: `'spam'|'abuse'|'privacy'|'misinformation'|'other'` (기존 ReportModal 사유 그대로 유지)
  - [ ] `detail` 필수 조건: `reasonCode === 'other'`이면 `detail` 필수(Zod refine), 아니면 optional
- [ ] Task 2: 프론트 — ReportModal 사유·API 연결 (AC: #1, #2, #3, #4, #5) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/ReportModal.tsx` + 나머지 6개 동일 구조 파일(automation/monetize/lounge/lounge/products/lounge/talk/lounge/gigs)
  - [ ] `REPORT_REASONS` 배열은 기존 ReportModal 사유 그대로 유지: `[{ code: 'spam', label: '스팸' }, { code: 'abuse', label: '욕설' }, { code: 'privacy', label: '개인정보 노출' }, { code: 'misinformation', label: '허위정보' }, { code: 'other', label: '기타' }]` — epics 기준 새 enum(음란물·광고·저작권 등)으로 변경하지 않음
  - [ ] `기타` 선택 시 `detail` textarea 표시
  - [ ] `handleSubmit()` → 비회원 체크 → `POST /api/v1/reports` 호출, 성공 시 모달 닫기 + 성공 토스트, 409 시 "이미 신고한 콘텐츠입니다" 인라인 표시
  - [ ] `Props` 확장: `targetType: string`, `targetId: string` 추가
  - [ ] 모달 `<dialog>` 요소에 `aria-labelledby="report-modal-title"` 추가, `<h3 id="report-modal-title">신고하기</h3>`
  - [ ] Esc 닫기: `<dialog>` native 지원으로 이미 동작 확인, `dialog.addEventListener('close', onClose)` 이미 있음
  - [ ] 포커스 트랩: native `<dialog>` 사용으로 브라우저 기본 제공
  - [ ] 기존 `isOpen`/`onClose` Props 유지
- [ ] Task 3: ReactionBar/CommentItem에서 ReportModal props 전달 (AC: #1, #4) [UPDATE]
  - [ ] `ReactionBar.tsx`: `<ReportModal>` 호출 시 `targetType`, `targetId` props 전달
  - [ ] `CommentItem.tsx`: comment 신고 시 `targetType='comment'`, `targetId=comment.id` 전달
  - [ ] 비회원 [신고] 클릭 시 모달 열기 전 로그인 체크 → 비회원이면 로그인 유도
- [ ] Task 4: 검증 (AC: #1~5)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과
  - [ ] 신고 사유 목록 기존 5개(스팸/욕설/개인정보 노출/허위정보/기타) 그대로 렌더 확인, [기타] → textarea 노출 확인

## Dev Notes

- **기존 ReportModal 현재 상태**: `REPORT_REASONS` 배열에 5개 사유(스팸/욕설/개인정보/허위/기타). `<dialog>` 사용. `selected` state. `handleSubmit()` API 호출 없이 `onClose()`만. `dialogRef`로 native dialog 제어. 기존 Props: `{ isOpen, onClose }`.
- **보존해야 할 것**: `<dialog>` 사용 패턴, native showModal/close, `styles.reportDialog` CSS 클래스, 라디오 버튼 fieldset 구조, 취소/신고 버튼 — 레이아웃 변경 금지. `REPORT_REASONS` 배열은 기존 5개 사유(스팸/욕설/개인정보 노출/허위정보/기타) 그대로 유지. API 연결 + 기타 textarea 추가만 수행.
- **신규 Props**: `targetType`·`targetId`를 ReportModal에 추가. 기존 호출처(ReactionBar, CommentItem)에서 전달.
- **`기타` textarea**: `selected === 'other'`이면 `<textarea name="detail" />` 렌더. Zod에서 `detail` 필수 조건 서버에서 검증.
- **`reasonCode` → DB 저장**: API 계층에서 `code` 문자열로 저장(`spam`/`abuse`/`privacy`/`misinformation`/`other`). `reports.reason_code` text 컬럼. epics 기준 enum(adult/ad/copyright)으로 변경하지 않음 — 기존 ReportModal 사유 코드 그대로.
- **REPORTS UNIQUE**: `(reporter_id, target_type, target_id)` — 동일 신고자가 동일 콘텐츠를 두 번 신고하면 409. DB `unique` 제약 또는 코드 레벨 중복 확인.
- **Epic 9 연계**: 신고 처리·숨김은 이 Story 범위 밖. `status='pending'` INSERT까지만.
- **신고 후 UI**: 성공 토스트("신고가 접수되었습니다") + 모달 닫기. 버튼을 "신고됨" 상태로 변경하는 것은 선택(ReactionBar의 신고 버튼 disabled 처리 가능).

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    reports.ts        ← NEW
    index.ts          ← UPDATE
  web/app/
    vibe-coding/[slug]/ReportModal.tsx  ← UPDATE (사유 업데이트, API 연결, 기타 textarea, aria)
    automation/[slug]/ReportModal.tsx   ← UPDATE
    monetize/[slug]/ReportModal.tsx     ← UPDATE
    lounge/[slug]/ReportModal.tsx       ← UPDATE
    lounge/products/[slug]/ReportModal.tsx ← UPDATE
    lounge/talk/[slug]/ReportModal.tsx  ← UPDATE
    lounge/gigs/[slug]/ReportModal.tsx  ← UPDATE
    vibe-coding/[slug]/ReactionBar.tsx  ← UPDATE (targetType/targetId → ReportModal)
    (나머지 5개 ReactionBar 동일)
    vibe-coding/[slug]/CommentItem.tsx  ← UPDATE (comment 신고 → ReportModal props)
    (나머지 5개 CommentItem 동일)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8 AC]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 모달 접근성]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 행동 게이팅]
- [AR-13: 신고 제출 → Epic 9 처리 연계]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
