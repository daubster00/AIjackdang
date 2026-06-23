# Story 3.7: 도움된 답변 지정 · 변경 (질문자 전용)

Status: ready-for-dev

## Story

As a 질문 작성자,
I want 도움이 된 답변 1개에 "도움된 답변"을 표시하고 언제든 바꾸기를,
so that 답변자 기여를 가볍게 인정하되 정답·마감·보상 없이 운영된다.

## Acceptance Criteria

1. 질문 작성자 로그인 + 공개 답변 1개 이상일 때: [도움된 답변으로 표시] 토글 버튼이 각 `AnswerItem`에 표시된다. 비작성자·비회원에게 미노출(FR-3.7·UX-DR-U8).
2. [도움된 답변으로 표시] 클릭 → `PATCH /api/v1/qna/questions/{questionId}/helpful-answer`(`setHelpfulAnswerSchema: { answerId: string }`) → `questions.helpful_answer_id` 갱신 → 낙관적 UI 업데이트(배지 즉시 표시) + 성공 토스트.
3. 이미 지정된 상태에서 **다른 답변** 지정 → `helpful_answer_id` 교체(1개만 유지), 기존 답변 배지 제거 + 새 답변 배지 표시.
4. **지정 취소**: 동일 답변 재클릭 → `PATCH ... { answerId: null }` → `helpful_answer_id=null` → 배지 제거 + 토스트(FR-3.7).
5. 배지 표시: "도움된 답변" 텍스트 + 체크 아이콘(예: `ri-checkbox-circle-fill`). "채택/정답/내공" 표현 미사용. 포인트·등급·마감 연산 미발생(FR-3.7). `AnswerItem` 상단 배너(현행 `acceptedBanner`)를 재사용 또는 리네이밍.
6. 비작성자·비회원의 직접 API 호출 → 401/403 반환(FR-1.8).
7. 낙관적 업데이트 실패 시 롤백 + danger 토스트(project-context 낙관적 업데이트 패턴).

## Tasks / Subtasks

- [ ] Task 1: API 엔드포인트 구현 (AC: #2, #3, #4, #6) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `PATCH /api/v1/qna/questions/:id/helpful-answer`
  - [ ] 인증 필수(401). `request.session.userId === question.user_id` 검증(403 불일치).
  - [ ] `setHelpfulAnswerSchema` 검증: `{ answerId: z.string().uuid().nullable() }`
  - [ ] `answerId` 유효성: null이 아니면 해당 answer가 이 question 소속이고 `status='published'`인지 확인(400 잘못된 답변 ID)
  - [ ] `questions.helpful_answer_id = answerId` UPDATE + `updated_at` 갱신
  - [ ] 응답: `{ id, helpfulAnswerId: answerId }` 200

- [ ] Task 2: `AnswerItem.tsx` — 도움된 답변 토글 UI (AC: #1, #2, #3, #4, #5, #7) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/AnswerItem.tsx` [UPDATE]
  - [ ] 현행 코드 분석: `accepted`(boolean), `acceptedBanner`(채택된 답변 배너), `acceptBtn`(채택하기 버튼), `hasAccepted`(이미 채택된 답변 있으면 버튼 숨김)
  - [ ] **리네이밍/재매핑**: `accepted` → `isHelpful`, `acceptedBanner` 재사용("도움된 답변" 텍스트로 변경). "채택" 텍스트 → "도움된 답변"으로 변경.
  - [ ] Props 추가: `isHelpful: boolean`(이 답변이 도움된 답변인지), `canMarkHelpful: boolean`(질문자 여부), `onMarkHelpful: (answerId: string | null) => void`
  - [ ] [도움된 답변으로 표시] 버튼: `canMarkHelpful && !isHelpful`일 때 노출. 클릭 → `onMarkHelpful(answer.id)` 호출.
  - [ ] [도움된 답변 해제] 버튼(또는 토글): `canMarkHelpful && isHelpful`일 때 노출. 클릭 → `onMarkHelpful(null)` 호출.
  - [ ] **보존**: 전체 레이아웃, 메뉴 드롭다운, 투표 UI, 댓글 UI, 수정/삭제 API 연결(3.6에서 구현) — 변경 금지

- [ ] Task 3: 상세 페이지에서 도움된 답변 상태 관리 (AC: #2, #3, #7) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` [UPDATE]: 답변 목록을 Client Component로 감싸서 `helpfulAnswerId` 상태 관리
  - [ ] `AnswerList.tsx` (Client Component) 신규 생성: `initialAnswers`, `questionId`, `isAsker`, `initialHelpfulAnswerId` props
  - [ ] 낙관적 업데이트: `setHelpfulAnswerId` 즉시 업데이트 → API 호출 → 실패 시 rollback
  - [ ] 각 `AnswerItem`에 `isHelpful={helpfulAnswerId === answer.id}`, `canMarkHelpful={isAsker}`, `onMarkHelpful` 전달

- [ ] Task 4: 배지 텍스트 정정 (AC: #5)
  - [ ] `AnswerItem.tsx`에서 "채택된 답변" → "도움된 답변"으로 텍스트 변경
  - [ ] `aria-label`: "도움된 답변" (현행 "채택된 답변" 변경)
  - [ ] `acceptedBanner` CSS class명은 유지(CSS 변경 최소화), 텍스트만 교체

## Dev Notes

### 현행 코드 분석 (`AnswerItem.tsx` 읽음)
- 현재: `accepted: boolean` state(초기값 `answer.accepted`), `acceptedBanner`("채택된 답변" 표시), `acceptBtn`("채택하기" 버튼, `!accepted && canAccept && !hasAccepted` 조건), `setAccepted(true)` 로컬 state 변경(API 없음)
- **기획 명칭 변경**: "채택" → "도움된 답변". 기존 UI 패턴 그대로이나 텍스트 교체 + API 연결.
- Props 구조 변경: `canAccept` → `canMarkHelpful`, `hasAccepted` → 필요 없음(helpfulAnswerId로 판단), `accepted` → `isHelpful`(부모에서 주입)
- **주의**: `answer.accepted` 필드를 props로 받지 않고 부모의 `helpfulAnswerId === answer.id` 계산으로 결정해야 함(단일 진실 공급원).

### 낙관적 업데이트 패턴 (project-context)
```ts
// AnswerList.tsx (Client Component)
async function handleMarkHelpful(answerId: string | null) {
  const prevId = helpfulAnswerId;
  setHelpfulAnswerId(answerId); // 즉시 UI 업데이트
  try {
    await fetch(`/api/v1/qna/questions/${questionId}/helpful-answer`, {
      method: 'PATCH', body: JSON.stringify({ answerId })
    });
    toast.success(answerId ? '도움된 답변을 표시했어요.' : '도움된 답변을 해제했어요.');
  } catch {
    setHelpfulAnswerId(prevId); // 롤백
    toast.danger('요청에 실패했습니다. 다시 시도해 주세요.');
  }
}
```

### 도메인 어휘 엄수 (UX-DR-A8)
- 사용: "도움된 답변", "도움된 답변으로 표시", "도움된 답변 해제"
- 금지: "채택", "정답", "내공", "마감", "채택하기"
- 배지: `<Icon name="checkbox-circle-fill" /> 도움된 답변`

### 보안
- API 서버에서 `question.user_id === session.userId` 검증. 클라이언트 버튼 숨김은 UX만.
- `answerId` null 허용(해제), 유효한 published answer 소속 검증.

### Project Structure Notes
- 신규 파일: `apps/web/app/questions/[slug]/AnswerList.tsx`
- 수정 파일: `apps/web/app/questions/[slug]/AnswerItem.tsx`, `apps/web/app/questions/[slug]/page.tsx`, `apps/api/src/routes/v1/qna/questions.ts`

### References
- [Source: epics.md#Story 3.7 AC] 도움된 답변 지정 요구사항
- [Source: apps/web/app/questions/[slug]/AnswerItem.tsx] 현행 답변 아이템 (읽어 확인)
- [Source: apps/web/app/questions/[slug]/page.tsx] 현행 상세 페이지 (읽어 확인)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3.7] 도움된 답변 — 보상 미연결, 마감 아님
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U8] 답변(확장 댓글형) + 도움된 답변 토글
- [Source: _bmad-output/project-context.md#통신패턴] 낙관적 업데이트 패턴
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-A8] 도메인 어휘(Q&A 도움된 답변)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
