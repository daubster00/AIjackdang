# Story 3.6: 답변 작성 · 수정 · 삭제 (확장 댓글형)

Status: ready-for-dev

## Story

As a 회원,
I want 질문 상세에서 여러 줄·코드블록·이미지를 포함한 답변을 작성·수정·삭제하기를,
so that 내 지식을 명확히 전달하고 필요 시 고친다.

## Acceptance Criteria

1. 비회원이 답변 입력 영역 클릭/[답변 등록] 시도 시 로그인 유도 모달 + `redirectTo=/questions/{slug}` 복귀(UX-DR-U1).
2. 회원이 답변 작성 후 [답변 등록] 클릭 → `POST /api/v1/qna/questions/{questionId}/answers`(`createAnswerSchema`) → `status='published'` 저장·즉시 노출(낙관적 업데이트 또는 재패치). 등록 직후 `deriveQuestionStatus` 재평가로 목록의 상태 배지가 '답변있음'으로 갱신됨을 Next invalidation으로 보장.
3. 답변 에디터: `LightEditor` `lite` preset 사용(줄바꿈·링크·이미지·코드블록만 허용). H2·H3·색·형광펜·파일첨부 미허용. `content_json` Tiptap JSON 저장(AR-8·FR-3.6). `packages/contracts/editor.ts`에 lite 화이트리스트 정의(서버 sanitize와 공유).
4. 작성자 본인 [수정]: `AnswerItem.tsx`의 인라인 편집 UI 활성화 → `PATCH /api/v1/qna/answers/{id}` → `content_json`·`updated_at` 갱신. 비작성자 API 호출 시 403.
5. 작성자 본인 [삭제]: 메뉴 드롭다운에서 [삭제] 클릭 → 확인 모달 → `DELETE /api/v1/qna/answers/{id}` → `status='deleted'`·`deleted_at` soft-delete(AR-7). 유일 공개 답변 삭제 시 '답변대기' 복귀.
6. 답변 좋아요·신고 슬롯(Epic 5 예약): 답변 렌더 시 좋아요 수(0)·신고 슬롯 마크업 존재하되 `aria-disabled="true"`. 코드 주석: "// TODO: Epic 5에서 활성화"(FR-3.8).
7. `packages/contracts/editor.ts` 파일 생성: `EDITOR_LITE_WHITELIST`(sanitize-html options), `EDITOR_FULL_WHITELIST` 정의·export. API sanitize와 클라이언트 에디터 preset이 동일 화이트리스트 참조.

## Tasks / Subtasks

- [ ] Task 1: `packages/contracts/editor.ts` 생성 (AC: #3, #7) [NEW]
  - [ ] `EDITOR_LITE_WHITELIST`: `allowedTags: ['p','br','strong','em','a','img','pre','code','ul','ol','li','blockquote']`, `allowedAttributes: { a: ['href','target'], img: ['src','alt'], code: ['class'] }`, script 태그 명시 금지
  - [ ] `EDITOR_FULL_WHITELIST`: lite + `['h2','h3','mark','span']` + color 관련 속성 (FR-2.5 게시판용)
  - [ ] `packages/contracts/src/index.ts` [UPDATE]: `export * from './editor'` 추가

- [ ] Task 2: 답변 작성 API 엔드포인트 (AC: #2) [NEW]
  - [ ] `apps/api/src/routes/v1/qna/answers.ts` 생성: `POST /api/v1/qna/questions/:questionId/answers`
  - [ ] 인증 필수(401). `createAnswerSchema` 검증.
  - [ ] question 존재 확인(404). `status='published'`, `content_json` 저장.
  - [ ] `apps/api/src/routes/v1/index.ts` [UPDATE]: answers 라우트 등록
  - [ ] 응답: `{ id, questionId, userId, contentJson, status, createdAt }` 201

- [ ] Task 3: 답변 수정 API (AC: #4) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/answers.ts` [UPDATE]: `PATCH /api/v1/qna/answers/:id`
  - [ ] 인증 + 작성자 본인 확인(401/403)
  - [ ] `content_json`, `updated_at` UPDATE
  - [ ] 응답: `{ id, contentJson, updatedAt }` 200

- [ ] Task 4: 답변 삭제 API (AC: #5) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/answers.ts` [UPDATE]: `DELETE /api/v1/qna/answers/:id`
  - [ ] 인증 + 작성자 본인 확인(401/403)
  - [ ] soft-delete: `status='deleted'`, `deleted_at=now()` (AR-7)
  - [ ] 응답: 204 No Content
  - [ ] **부작용**: 삭제 후 question의 공개 답변 count 재계산 → 상태 배지 자동 업데이트(클라이언트 재패치 또는 낙관적 업데이트)

- [ ] Task 5: `AnswerForm.tsx` — 실제 API 연결 (AC: #1, #2) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/AnswerForm.tsx` [UPDATE]: 현행 `LightEditor` + [답변 등록] 버튼 유지
  - [ ] **보존**: `LightEditor` 사용, MAX_LENGTH 2000, placeholder, [답변 등록] 버튼 disabled 로직
  - [ ] 추가: `questionId: string` props 받기, 비회원 감지 → 모달, 유효 시 `POST /api/v1/qna/questions/${questionId}/answers` 호출
  - [ ] 성공: 토스트 + 에디터 리셋 + 답변 목록 재패치(router.refresh() 또는 상태 콜백)
  - [ ] 실패: danger 토스트 + 입력 유지

- [ ] Task 6: `AnswerItem.tsx` — 수정/삭제 API 연결 (AC: #4, #5, #6) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/AnswerItem.tsx` [UPDATE]: 현행 인라인 edit UI 유지
  - [ ] **보존**: 전체 레이아웃, 메뉴 드롭다운, 투표 버튼 UI, 채택 버튼, 댓글 UI — 변경 금지
  - [ ] 수정 저장: [저장] 클릭 → `PATCH /api/v1/qna/answers/${answer.id}` 호출 → 성공 시 editOpen=false + 새 content 반영
  - [ ] 삭제: [삭제] → 확인 모달 추가(현행에 없으면 신규, 있으면 연결) → `DELETE /api/v1/qna/answers/${answer.id}` 호출 → 성공 시 해당 AnswerItem 제거(부모에서 state 관리)
  - [ ] 좋아요 버튼: `aria-disabled="true"` 추가. 현행 `handleVote` 함수는 UI 전용으로 남기되 API 호출 없음 + 주석 추가.
  - [ ] `isCurrentUser: boolean` props 추가: `answer.userId === session.userId`일 때만 수정/삭제 메뉴 노출. 현행 `canAccept`와 별개.

- [ ] Task 7: sanitize-html 연동 확인 (AC: #3, #7)
  - [ ] `sanitize-html` 패키지 설치 여부 확인(project-context: 미설치 — `apps/api`에서 `npm install sanitize-html @types/sanitize-html`)
  - [ ] `EDITOR_LITE_WHITELIST` 사용해 API에서 `content_json` → HTML 변환 후 sanitize 적용

## Dev Notes

### 현행 코드 분석 (`AnswerForm.tsx`, `AnswerItem.tsx` 읽음)
- `AnswerForm`: `LightEditor` + MAX_LENGTH 2000 + [답변 등록] disabled 로직. `questionId` props 없음 → 추가 필요.
- `AnswerItem`: 메뉴 드롭다운(수정/삭제/신고), 인라인 편집 textarea, 투표(추천/비추천) UI, 채택 버튼. 현재 API 연결 없음.
  - **투표 버튼**: 현행 `handleVote`가 로컬 state만 변경. Epic 5에서 reaction API 연결 예정. 이 스토리에서는 `aria-disabled` 추가 + 주석.
  - **채택 버튼**: `canAccept && !hasAccepted` 조건. 현재 `setAccepted(true)` 로컬 state. Story 3.7에서 API 연결.
  - **인라인 편집**: textarea 기반. Tiptap `lite` preset으로 업그레이드는 이 스토리에서 수행(또는 Story 3.6 범위 내에서 LightEditor 사용으로 교체).

### lite vs full preset
- Q&A **질문** 작성: `full` preset(`PostWriteForm` 기본 — 이미지·파일·코드·색 허용)
- Q&A **답변** 작성: `lite` preset — 줄바꿈·링크·이미지·코드블록만(H2·H3·색·형광펜·파일 제외, FR-3.6)
- `AnswerForm`의 `LightEditor` 이미 `lite` 수준이므로 적합. `maxLength={2000}` 유지.

### `packages/contracts/editor.ts` 위치
- 새 파일: `packages/contracts/src/editor.ts`
- export: `EDITOR_LITE_WHITELIST`(sanitize-html Options), `EDITOR_FULL_WHITELIST`
- `apps/api`(sanitize 시) + `apps/web`(에디터 설정 시) 모두 import 가능

### soft-delete 후 상태 재계산 (AR-7)
- 답변 삭제 후 클라이언트: `router.refresh()` 또는 부모 컴포넌트에서 answers 배열 state 업데이트
- 서버: 목록 API가 항상 `status='published'` 답변만 카운트하므로 자동 반영

### 보안 (NFR-2, AR-8)
- `content_json`: Tiptap JSON 저장. HTML 원본 저장 금지.
- sanitize-html: API 렌더링 시 항상 적용. 클라이언트 신뢰 금지.
- 권한: API에서 최종 확인(userId 비교). 클라이언트 버튼 숨김은 UX.

### Project Structure Notes
- 신규 파일: `packages/contracts/src/editor.ts`, `apps/api/src/routes/v1/qna/answers.ts`
- 수정 파일: `packages/contracts/src/index.ts`, `apps/api/src/routes/v1/index.ts`, `apps/web/app/questions/[slug]/AnswerForm.tsx`, `apps/web/app/questions/[slug]/AnswerItem.tsx`

### References
- [Source: epics.md#Story 3.6 AC] 답변 작성/수정/삭제 요구사항
- [Source: apps/web/app/questions/[slug]/AnswerForm.tsx] 현행 답변 폼 (읽어 확인)
- [Source: apps/web/app/questions/[slug]/AnswerItem.tsx] 현행 답변 아이템 (읽어 확인)
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-8] content_json, sanitize-html, lite preset
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-7] soft-delete
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3.6] 답변(확장 댓글형) — lite 허용 노드
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3.8] 답변 좋아요·신고 슬롯(Epic 5 예약)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
