# Story 3.5: 질문 상세 페이지 (SSR · 상태 배지 · 질문자 액션)

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want 질문 상세에서 제목·상태·태그·본문·첨부를 읽고, 질문자는 수정·삭제·해결됨 변경을 하기를,
so that 맥락·상태를 즉시 파악하고 질문자는 수명 주기를 직접 관리한다.

## Acceptance Criteria

1. 비회원이 `/questions/{slug}` 진입 시 SSR로 즉시 렌더: 제목(H1)·상태 배지·태그·메타(작성자·날짜·조회수·답변수)·본문 HTML(Tiptap content_json → `sanitize-html` lite 화이트리스트 변환)·첨부·답변 영역 노출. breadcrumb JSON-LD·고유 `generateMetadata` (title=`"{질문제목} — 묻고답하기 | AI작당"`, description=요약, canonical=`/questions/{slug}`)(FR-3.4·NFR-1·AR-8).
2. 상태 배지: `deriveQuestionStatus` 결과에 따라 색+텍스트 동반 배지 표시. `is_resolved=false` + `publicAnswerCount=0` → '답변대기'(warning), `is_resolved=false` + `publicAnswerCount>0` → '답변있음'(info), `is_resolved=true` → '해결됨'(success). 색만으로 상태 전달 금지(UX-DR-U13).
3. 질문 작성자 로그인 시: [수정]·[삭제]·[해결됨으로 표시] 버튼 노출. 비작성자·비회원은 미노출(하단 `footer > .ownerActions` 영역).
4. [해결됨으로 표시] 클릭 → `PATCH /api/v1/qna/questions/{id}/resolve` 호출 → `is_resolved=true` 갱신 → 낙관적 배지 교체 + 성공 토스트. 요청자≠질문자이면 403.
5. [삭제] 클릭 → 확인 모달(삭제 취소 가능) → `DELETE /api/v1/qna/questions/{id}` → `status='deleted'`·`deleted_at` soft-delete → `/questions`로 리다이렉트 + 성공 토스트(AR-7).
6. 조회수: 상세 진입 시 Redis 버퍼에 기록 + `view-flush` BullMQ 큐로 DB flush(AR-16·17). 서버 컴포넌트에서 API `POST /api/v1/qna/questions/{id}/view` 또는 `GET` 응답에 포함된 view_count 표시.
7. API `GET /api/v1/qna/questions/{slug}` 엔드포인트: question + answers(공개만) + user + tags 조인 응답. `slug` 또는 `id` 조회 지원. 답변은 `id, user_id, content_json, created_at, updated_at, status` 반환.

## Tasks / Subtasks

- [ ] Task 1: API 엔드포인트 구현 (AC: #7) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `GET /api/v1/qna/questions/:slug` 라우트 추가
  - [ ] DB 쿼리: questions + users(닉네임) + answers(status=published) + taggable→tags JOIN
  - [ ] `sanitize-html` 변환은 **서버(API)에서 수행**: `content_json` → Tiptap HTML 변환 → sanitize-html lite 화이트리스트 적용 → `contentHtml` 필드로 응답
  - [ ] `questionDetailResponseSchema`로 응답 타입 고정
  - [ ] 존재하지 않는 slug / `status='deleted'` → 404

- [ ] Task 2: PATCH /resolve 엔드포인트 (AC: #4) [NEW]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `PATCH /api/v1/qna/questions/:id/resolve`
  - [ ] 인증 필수(401). `request.session.userId === question.user_id` 검증(403 불일치)
  - [ ] `questions.is_resolved = true` UPDATE. `updated_at` 갱신.
  - [ ] 응답: `{ id, isResolved: true }` 200

- [ ] Task 3: DELETE /questions/:id 엔드포인트 (AC: #5) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `DELETE /api/v1/qna/questions/:id`
  - [ ] 인증 + 작성자 본인 확인(401/403)
  - [ ] `status='deleted'`, `deleted_at=now()` soft-delete (AR-7). Hard delete 금지.
  - [ ] 응답: 204 No Content

- [ ] Task 4: 조회수 처리 (AC: #6) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: GET 요청 처리 시 Redis INCR + BullMQ `view-flush` 큐 enqueue
  - [ ] Redis key: `view:question:{id}` INCR. 주기적으로(예: 5분마다) worker가 DB flush.
  - [ ] `apps/worker/src/workers/view-flush.ts` 확인: 이미 Epic 2에서 구현됐으면 재사용, 없으면 `apps/worker/src/workers/view-flush.ts` 생성

- [ ] Task 5: 상세 페이지 서버 컴포넌트 전환 (AC: #1, #2, #3) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` [UPDATE]: 현행 하드코딩 더미 데이터 → API 호출로 교체
  - [ ] `generateMetadata({ params })`: API 호출 → `{ title: '${question.title} — 묻고답하기 | AI작당', description: excerpt, alternates: { canonical: '/questions/${slug}' } }`
  - [ ] 서버 컴포넌트에서 `GET /api/v1/qna/questions/${slug}` 호출
  - [ ] **보존**: 현행 레이아웃(`detailLayout`, `detailHeader`, `articleBody`), `BoardHero menu="questions"`, 답변 영역 구조, `QuestionActions`, `AnswerForm`, `AnswerItem` 컴포넌트 호출 패턴
  - [ ] **교체**: 하드코딩 `questions` Record → API 응답 데이터
  - [ ] `isAsker`: `const isAsker = session?.userId === question.userId` (서버 컴포넌트에서 세션 확인)
  - [ ] breadcrumb JSON-LD 추가: `[AI작당, 묻고답하기, ${question.title}]`

- [ ] Task 6: 질문자 액션 클라이언트 연결 (AC: #3, #4, #5) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` 하단 `ownerActions` 영역: [수정] → `/questions/${slug}/edit` 링크, [삭제] → 확인 모달 + DELETE API 호출
  - [ ] [해결됨으로 표시] 버튼: Client Component `ResolveButton.tsx` 생성 또는 `QuestionActions.tsx`에 통합
  - [ ] `apps/web/app/questions/[slug]/QuestionActions.tsx` [UPDATE]: 현행 공유·신고 버튼에 [해결됨으로 표시] 토글 추가(질문자 전용). `isAsker`, `isResolved` props 받아 조건부 렌더.
  - [ ] 낙관적 업데이트: `is_resolved` 즉시 true로 UI 교체 → 실패 시 롤백

- [ ] Task 7: 본문 HTML 렌더링 (AC: #1, AR-8)
  - [ ] `content_json`(Tiptap JSON) → 서버에서 HTML 변환 후 sanitize-html 적용. API가 `contentHtml` 필드로 응답하면 Next에서 `dangerouslySetInnerHTML={{ __html: question.contentHtml }}` 렌더
  - [ ] XSS 차단: `sanitize-html` lite 화이트리스트(허용: p·ul·ol·li·strong·em·h2·h3·pre·code·a·img·blockquote, script 금지)
  - [ ] 코드블록: 복사 버튼, 가로 스크롤 (기존 `PostWriteForm` 에디터 스타일 재사용)

## Dev Notes

### 현행 코드 분석 (`apps/web/app/questions/[slug]/page.tsx` 읽음)
- 현재 상태: 하드코딩 `questions` Record(6개), `generateStaticParams`, `generateMetadata`, `isAsker=true` 하드코딩, `QuestionActions`·`AnswerForm`·`AnswerItem` 컴포넌트 사용
- 보존: 전체 레이아웃(`detailLayout`, `breadcrumbBack`, `questionDetail`, `detailHeader`, `answerSection`, `answerWriteSection`, `detailFooter`), CSS module 클래스, 컴포넌트 구성 변경 금지
- 교체: 하드코딩 데이터 → API, `isAsker` → 세션 비교, `generateStaticParams` → 동적 라우팅(또는 ISR)

### `QuestionActions.tsx` 현황 (읽어 확인)
- 현재: 공유 드롭다운(SNS + 링크복사), 신고 모달. `isAsker` prop 없음.
- 추가: [해결됨으로 표시] 버튼 → `isAsker && !isResolved`일 때만 노출. `onResolve: () => void` prop 주입.
- 기존 공유·신고 버튼 구성 유지.

### `generateStaticParams` 제거
- 현행 `generateStaticParams`는 하드코딩 slug 배열. 실제 DB 기반으로 전환 시 ISR 또는 동적 렌더링으로 교체.
- 권장: `export const dynamic = 'force-dynamic'` 또는 Next `revalidate`(짧은 TTL) 설정.

### sanitize-html (AR-8, NFR-2)
- `packages/contracts/editor.ts`에 lite 화이트리스트 정의(Story 3.6에서 확정). 이 스토리에서 선행 정의 필요 시 임시 인라인, 3.6에서 패키지로 이동.
- API 서버에서 Tiptap→HTML 변환 + sanitize. Next web에서는 `contentHtml` 그대로 렌더.

### 조회수 패턴 (AR-16, AR-17)
- Redis: `view:question:{id}` INCR → TTL 없음(worker가 주기 flush)
- BullMQ job: `view-flush` 큐, `stats.view-flush` job명, payload `{ entityType: 'question', entityId }` — worker 멱등(동일 ID 중복 flush 안전)
- 목록 API는 DB view_count 그대로 반환(Redis 버퍼 미반영 허용, eventually consistent)

### 보안 (AR-7, NFR-2)
- soft-delete: `status='deleted'`, `deleted_at=now()`. Hard delete 금지.
- 권한 체크: API 서버에서 userId 비교(403). 클라이언트 버튼 숨김은 UX 편의, 최종 통제는 API.

### Project Structure Notes
- 신규 파일: (view-flush worker가 없으면 `apps/worker/src/workers/view-flush.ts`)
- 수정 파일: `apps/web/app/questions/[slug]/page.tsx`, `apps/web/app/questions/[slug]/QuestionActions.tsx`, `apps/api/src/routes/v1/qna/questions.ts`

### References
- [Source: epics.md#Story 3.5 AC] 질문 상세 요구사항
- [Source: apps/web/app/questions/[slug]/page.tsx] 현행 상세 페이지 (읽어 확인)
- [Source: apps/web/app/questions/[slug]/QuestionActions.tsx] 현행 질문 액션 (읽어 확인)
- [Source: _bmad-output/project-context.md#SEO] SSR, generateMetadata, sanitize-html
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-7] soft-delete
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-16] BullMQ view-flush 큐
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U8] 도움된 답변·상태 배지
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U13] 색+텍스트 동반 배지

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
