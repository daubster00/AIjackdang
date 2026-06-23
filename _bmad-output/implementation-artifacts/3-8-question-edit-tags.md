# Story 3.8: 질문 수정 + 태그 수정

Status: ready-for-dev

## Story

As a 질문 작성자,
I want 내 질문의 제목·본문·태그를 수정하기를,
so that 추가 정보 제공·오류 수정을 한다.

## Acceptance Criteria

1. 작성자가 질문 상세에서 [수정] 버튼 클릭 → `/questions/{slug}/edit` 진입 시 기존 제목·`content_json`·태그가 복원된 편집 화면이 표시된다(FR-3.5). 비작성자 직접 URL 접근 시 403(서버 컴포넌트 redirect 또는 API 403).
2. 수정 후 [저장] 클릭 → `PATCH /api/v1/qna/questions/{id}` → 갱신 + `updated_at` 반영 → 수정된 상세 페이지(`/questions/{slug}`)로 리다이렉트 + 성공 토스트.
3. 태그 수정(제거/추가) → taggable 레코드 삭제·삽입(AR-6). 변경된 태그 배열 반영.
4. 필수 항목(제목/본문) 삭제 후 [저장] 시 인라인 오류 표시·저장 차단·입력 유지.
5. 비작성자/비회원이 `PATCH /api/v1/qna/questions/{id}` 직접 호출 시 403/401.
6. 편집 화면 폼은 질문 작성 폼(`PostWriteForm`)과 동일 UI, 초기값만 다름(`initialTitle`, `initialContentJson`, `initialTags` 주입).

## Tasks / Subtasks

- [ ] Task 1: 질문 수정 API 엔드포인트 (AC: #2, #3, #5) [UPDATE]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `PATCH /api/v1/qna/questions/:id`
  - [ ] 인증 필수(401). `question.user_id === session.userId` 검증(403).
  - [ ] `updateQuestionSchema`(partial: title, contentJson, tags) 검증.
  - [ ] `db.transaction()`: (1) questions UPDATE(title, content_json, updated_at), (2) taggable DELETE 기존 태그(target_type='question', target_id) + INSERT 새 태그
  - [ ] slug 변경: title 변경 시 slug 재생성 필요. 단, slug 변경은 URL 안정성(NFR-8) 위반이므로 **title 변경 시에도 slug는 유지**. `updated_at`만 갱신.
  - [ ] 응답: `{ id, slug, updatedAt }` 200

- [ ] Task 2: `/questions/[slug]/edit` 페이지 생성 (AC: #1, #6) [NEW]
  - [ ] `apps/web/app/questions/[slug]/edit/page.tsx` 생성: Server Component
  - [ ] 서버 컴포넌트에서 세션 확인 → 비회원 redirect to login, 작성자 아니면 403 또는 redirect
  - [ ] `GET /api/v1/qna/questions/${slug}` 호출 → `question` 데이터 로드
  - [ ] `PostWriteForm` 렌더: `initialTitle={question.title}`, `initialContentJson={question.contentJson}`, `initialTags={question.tags}`, `cancelHref="/questions/${slug}"`, `submitLabel="저장"`, `onSubmit` → PATCH API 호출
  - [ ] `generateMetadata`: `{ title: '질문 수정 | 묻고답하기 - AI작당' }`

- [ ] Task 3: `PostWriteForm` — 초기값 주입 지원 (AC: #6) [UPDATE]
  - [ ] `apps/web/components/board/PostWriteForm.tsx` [UPDATE]: `initialTitle?: string`, `initialContentJson?: Record<string, unknown>`, `initialTags?: string[]` props 추가
  - [ ] **보존**: 모든 기존 props, 기존 사용처(vibe-coding, automation 등) 회귀 없음
  - [ ] `useState`의 초기값에 `initialTitle`, `initialTags` 반영
  - [ ] 에디터(`LightEditor` 또는 Tiptap)의 `initialContent` 주입

- [ ] Task 4: 상세 페이지 [수정] 버튼 링크 연결 (AC: #1) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` [UPDATE]: 하단 `ownerActions > [수정]` 버튼
  - [ ] 현행 `<button type="button"><Icon name="edit-2-line" />수정</button>` → `<Link href="/questions/${slug}/edit"><Button variant="ghost"><Icon.../>수정</Button></Link>` 로 교체
  - [ ] `isAsker`일 때만 노출(이미 3.5에서 조건 처리)

- [ ] Task 5: 클라이언트 편집 폼 제출 로직 (AC: #2, #4)
  - [ ] `apps/web/app/questions/[slug]/edit/page.tsx` 또는 별도 `EditForm.tsx` Client Component
  - [ ] 제출: `PATCH /api/v1/qna/questions/${question.id}` → 성공 시 `router.push('/questions/${slug}')` + 성공 토스트
  - [ ] 필수 필드 검증: blur 시 개별 + submit 시 전체(UX-DR 에러처리)
  - [ ] 제출 중: 버튼 disabled + 중복 제출 차단

## Dev Notes

### 슬러그 불변 원칙 (NFR-8)
- 질문 제목 변경 시 slug는 **절대 변경하지 않는다**. URL이 바뀌면 기존 검색 유입 보호(NFR-8) 위반.
- `questions.slug` 컬럼은 INSERT 시 한 번 설정, 이후 PATCH에서 변경 금지.
- 응답에 slug 포함: `{ id, slug, updatedAt }` (slug는 원본 그대로).

### `PostWriteForm` 초기값 주입 (공유 컴포넌트 주의)
- `PostWriteForm`은 이미 Story 3.3에서 `onSubmit` prop 추가됨.
- 이 스토리에서 `initialTitle`, `initialContentJson`, `initialTags` 추가.
- 기존 사용처(questions/write, vibe-coding/write 등)에 회귀 없음 확인(optional props, 기본값 undefined/빈 배열).

### taggable 교체 패턴 (AR-6)
```sql
-- 트랜잭션 안에서:
DELETE FROM taggable WHERE target_type='question' AND target_id={questionId};
INSERT INTO taggable (target_type, target_id, tag_name) VALUES ...;
```
- 기존 taggable 삭제 후 새 taggable 삽입(교체 방식)
- `target_type='question'`, `target_id=question.id`

### 권한 체크 (API + 서버 컴포넌트)
- 서버 컴포넌트(`/questions/[slug]/edit/page.tsx`): 세션 없으면 login redirect, `question.userId !== session.userId`이면 `/questions/${slug}` redirect(또는 403 에러 페이지)
- API PATCH: userId 비교 403 반환

### 접근성 (UX-DR-U13)
- 편집 화면: H1 "질문 수정" (또는 상단 header에 표시)
- 폼 레이블, 오류 메시지 aria 연결

### Project Structure Notes
- 신규 파일: `apps/web/app/questions/[slug]/edit/page.tsx`
- 수정 파일: `apps/api/src/routes/v1/qna/questions.ts`, `apps/web/components/board/PostWriteForm.tsx`, `apps/web/app/questions/[slug]/page.tsx`

### References
- [Source: epics.md#Story 3.8 AC] 질문 수정 요구사항
- [Source: apps/web/app/questions/[slug]/page.tsx] 현행 상세 페이지 하단 ownerActions (읽어 확인)
- [Source: apps/web/components/board/PostWriteForm.tsx] 공유 글쓰기 폼 (읽어 확인)
- [Source: _bmad-output/planning-artifacts/epics.md#AR-6] taggable 다형 참조
- [Source: _bmad-output/project-context.md#응답&데이터포맷] slug 불변(NFR-8)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U11] 인라인 오류, 입력 유지

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
