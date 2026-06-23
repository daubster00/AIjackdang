# Story 3.3: 질문 작성 (`/questions/write`) · 태그 · 임시저장

Status: ready-for-dev

## Story

As a 회원,
I want 질문 제목·본문(코드블록·이미지 포함)·태그를 입력하고 임시저장·등록하기를,
so that 내 문제를 명확히 전달하고 나중에 이어 작성한다.

## Acceptance Criteria

1. 비회원이 `/questions/write` 진입 또는 [질문하기] 클릭 시 로그인 유도 모달이 표시되고, 로그인 후 `redirectTo=/questions/write`로 복귀한다(UX-DR-U1·FR-1.8). 차단 화면(빈 페이지/404) 금지.
2. 회원이 `/questions/write` 로드 시 현행 `PostWriteForm` 구성이 그대로 표시된다: 제목 입력, `LightEditor`(Tiptap lite preset: 줄바꿈·링크·이미지·코드블록), 태그 입력(자유입력+자동완성), [임시저장]·[질문 등록]·[취소] 버튼, SEO 입력 비노출(FR-3.5·AR-8·FR-11.1).
3. 유효 입력 후 [질문 등록] 클릭 시 `POST /api/v1/qna/questions`(`createQuestionSchema`) 호출: `status='published'`, `is_resolved=false` 저장. 성공 시 `/questions/{slug}` 리다이렉트 + 성공 토스트. `content_json` Tiptap JSON 저장(HTML 원본 미저장, AR-8).
4. 태그 입력: 자동완성 제공, 선택/자유입력 후 taggable 연결 (`target_type='question'`, `target_id=question.id`) 생성. 등록 요청 시 `createQuestionSchema.tags` 배열에 포함(FR-6.4·AR-6).
5. [임시저장] 클릭 시 `POST /api/v1/qna/questions`(`status='draft'`) 저장. 재진입 시 드래프트 복원(회원 본인의 draft 질문 있으면 자동 로드).
6. 필수 항목(제목/본문) 미입력 후 [질문 등록] 시 인라인 오류 표시, API 미호출, 입력 유지. 제출 중 버튼 disabled + 중복 제출 차단(UX-DR-U11).
7. API `POST /api/v1/qna/questions` 엔드포인트 구현: 인증 필수(401 미인증), `createQuestionSchema` 검증, `questions` 테이블 INSERT, `taggable` INSERT(tags 배열), `slug` 생성(`packages/utilities`의 `slugify`), 응답 `{ id, slug, status }`.

## Tasks / Subtasks

- [ ] Task 1: 비회원 게이팅 (AC: #1) [UPDATE]
  - [ ] `apps/web/app/questions/write/page.tsx` [UPDATE]: 현행 페이지 읽기 — 현재 Server Component로 metadata + `PostWriteForm` 렌더
  - [ ] 비회원 접근 감지: 서버 컴포넌트에서 세션 확인(`packages/auth`의 `getSession` 또는 better-auth 세션 체크). 비회원이면 로그인 유도 모달 표시 또는 `redirectTo` 포함 `/login?redirectTo=/questions/write` 리다이렉트
  - [ ] `LoginGate` 패턴(Epic 1에서 확립된 방법 재사용). 없으면 서버 측 redirect.
  - [ ] **보존**: 현행 `PostWriteFormConfig` 설정 전체(header, tip, titleLabel, suggestedTags 등) 유지. 변경 금지.

- [ ] Task 2: API 엔드포인트 구현 (AC: #3, #7) [NEW]
  - [ ] `apps/api/src/routes/v1/qna/questions.ts` [UPDATE]: `POST /api/v1/qna/questions` 라우트 추가(3.2에서 GET 생성한 파일에 POST 추가)
  - [ ] 인증 미들웨어: `request.session.userId` 확인, 없으면 401 `{ error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }`
  - [ ] `createQuestionSchema` 검증: title, contentJson, tags
  - [ ] `slugify(title)` — `packages/utilities`의 `slugify` 함수 사용(한글+URL-safe+중복 시 `-{shortid}`)
  - [ ] `db.transaction()` 안에서: (1) questions INSERT(`status`, `is_resolved=false`, `user_id`, `slug`), (2) taggable INSERT 각 태그별
  - [ ] 응답: `{ id, slug, status }` (201 Created)
  - [ ] rate limiting 고려: `@fastify/rate-limit` 적용(질문 등록 제한)

- [ ] Task 3: 임시저장 기능 (AC: #5)
  - [ ] `POST /api/v1/qna/questions` + `status='draft'` 파라미터 처리 (동일 엔드포인트, body에 `status` 필드 추가)
  - [ ] `GET /api/v1/qna/questions/draft` (또는 `?status=draft&userId=me`) — 회원의 최신 draft 질문 1개 반환
  - [ ] `apps/web/app/questions/write/page.tsx` [UPDATE]: 서버 컴포넌트에서 draft 조회 후 PostWriteForm에 초기값으로 주입
  - [ ] **단, `PostWriteForm`이 현재 `submitAlert` alert 방식이므로**: 실제 API 연결로 교체 필요. `PostWriteForm.tsx` [UPDATE]: `submitAlert` prop 제거 또는 조건부, 실제 `onSubmit` handler 추가

- [ ] Task 4: 클라이언트 폼 연결 (AC: #2, #6) [UPDATE]
  - [ ] `apps/web/components/board/PostWriteForm.tsx` [UPDATE]: 현재 `submitAlert` alert 방식 → 실제 `onSubmit` prop 받는 방식으로 확장
  - [ ] **보존**: 에디터 UI, 태그 입력 UI, 파일 첨부 드롭존 UI — 레이아웃·버튼 구성 변경 금지
  - [ ] 추가: `onSubmit: (data: { title, contentJson, tags, status }) => Promise<void>` prop
  - [ ] 필수 필드 검증: blur 시 개별 + submit 시 전체(UX-DR-U 에러처리)
  - [ ] 제출 중: 버튼 disabled + 로딩 상태
  - [ ] 성공: 토스트 + router.push(`/questions/{slug}`)
  - [ ] 실패: danger 토스트 + 입력 유지 + 버튼 재활성화
  - [ ] 태그 자동완성: 현행 `SearchAutocomplete` 또는 태그 전용 컴포넌트 재사용. API `GET /api/v1/tags?q=xxx&targetType=question` 호출(Epic 2 tags API 있으면 재사용, 없으면 하드코딩 suggestedTags로 자동완성 유지)

- [ ] Task 5: Slug 유틸리티 확인 (AC: #7)
  - [ ] `packages/utilities`에 `slugify` 함수 존재 여부 확인
  - [ ] 없으면 `packages/utilities/src/slugify.ts` 생성: 한글→로마자 음역 또는 그대로 + URL-safe 특수문자 제거 + 중복 시 `-{nanoid(6)}` 접미

## Dev Notes

### 현행 코드 분석 (`apps/web/app/questions/write/page.tsx` 읽음)
- 현재 상태: `PostWriteFormConfig` 설정(`header`, `tip`, `suggestedTags`, `cancelHref: '/questions'` 등)으로 `PostWriteForm` 렌더. `submitAlert`로 "개발 중" alert 표시.
- 보존: 모든 config 값(badgeIcon, badgeLabel, tip 체크리스트, titleLabel, suggestedTags, dropzoneText, submitLabel, submitIcon 등). 이 설정은 Q&A 글쓰기 고유 UX이므로 변경 금지.
- 교체: `submitAlert` → 실제 API 연결. 비회원 게이팅 추가.

### `PostWriteForm.tsx` 분석 (읽어 확인)
- 현재 `submitAlert` prop이 있고 제출 시 `alert(submitAlert)` 호출
- **`PostWriteForm`은 모든 게시판 공유 컴포넌트**. 변경 시 바이브코딩, 자동화 등 모든 게시판에 영향.
- 안전한 변경: `onSubmit?: (data) => Promise<void>` prop 추가 + `submitAlert`는 backward 호환으로 유지(undefined이면 onSubmit 사용). 기존 config 구조 변경 금지.
- `contentJson`: `LightEditor`가 현재 텍스트 기반. Tiptap JSON 직렬화가 완료되었는지 확인 필요. `LightEditor.tsx` 읽기 권장.

### `LightEditor` 에디터 preset
- 현행 `apps/web/components/board/LightEditor.tsx` 사용
- `lite` preset 허용 노드: 줄바꿈, 링크, 이미지, 코드블록 (H2·H3·색·형광펜·파일첨부 제외 — FR-3.6)
- `full` preset: 게시판용 (PostWriteForm 기본)
- Q&A 질문 작성은 `full` preset 사용(이미지·파일·코드블록 포함, FR-3.5)
- Q&A 답변 작성(`AnswerForm`)은 `lite` preset — Story 3.6에서 처리

### slug 생성 (AR-13, project-context)
- `packages/utilities`에 `slugify` 없으면 신규 생성
- 한글 title 처리: `transliterate` 라이브러리 또는 정규식으로 한글 제거 후 영문+숫자만 남기기
- 충돌 시 DB UNIQUE 위반 → shortid 접미 추가 재시도

### 보안 (NFR-2, AR-8)
- 본문은 `content_json`(Tiptap JSON)으로 저장. HTML 저장 금지.
- rate limiting: 질문 등록 API에 `@fastify/rate-limit` 적용

### Project Structure Notes
- 신규 파일: (없음 — 기존 파일 UPDATE 위주)
- 수정 파일: `apps/web/app/questions/write/page.tsx`, `apps/api/src/routes/v1/qna/questions.ts`, `apps/web/components/board/PostWriteForm.tsx`(주의: 공유 컴포넌트)

### References
- [Source: epics.md#Story 3.3 AC] 질문 작성 요구사항
- [Source: apps/web/app/questions/write/page.tsx] 현행 작성 페이지 (읽어 확인)
- [Source: apps/web/components/board/PostWriteForm.tsx] 공유 글쓰기 폼 (읽어 확인)
- [Source: _bmad-output/project-context.md#UX/에러처리] 행동 게이팅, 토스트, 인라인 오류
- [Source: _bmad-output/project-context.md#보안] content_json, rate limiting
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U1] 비회원 게이팅, redirectTo
- [Source: _bmad-output/planning-artifacts/epics.md#AR-8] Tiptap JSON 저장, sanitize

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
