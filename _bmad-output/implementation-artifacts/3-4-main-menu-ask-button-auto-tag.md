# Story 3.4: 각 대메뉴 [질문하기] → Q&A 작성 + 관련 태그 자동 부착

Status: ready-for-dev

## Story

As a 회원,
I want 각 대메뉴에서 [질문하기] 시 Q&A 작성 화면으로 이동되고 관련 태그가 자동 부착되기를,
so that 컨텍스트를 잃지 않고 바로 질문한다.

## Acceptance Criteria

1. `/vibe-coding` 대메뉴에서 [질문하기] 클릭(회원) 시 `/questions/write?tags=vibe-coding`으로 이동, `vibe-coding` 태그가 부착된 상태로 에디터가 열린다(FR-3.9).
2. `/automation`·`/monetize`·`/lounge`(AI 창작마당·내 AI 제품·작당 수다방·작당 의뢰소) 등 각 대메뉴/하위메뉴에서도 대응 태그가 자동 부착된다: `automation`, `monetization`, `ai-creation`, `ai-product`, `lounge-talk`, `lounge-gig` 등 매핑 테이블 정의.
3. 자동 부착 태그는 삭제·추가 자유(사용자가 강제 고정 없음). 에디터 열릴 때 태그 입력 영역에 미리 채워진 상태.
4. 비회원이 [질문하기] 클릭 시 로그인 유도 모달 + 로그인 후 태그 붙은 작성 화면 복귀(`redirectTo=/questions/write?tags=xxx`)(UX-DR-U1).
5. `createQuestionSchema.tags`에 URL 파라미터 태그가 포함되어 API에 전달된다.
6. 각 대메뉴 페이지에 [질문하기] 버튼이 일관되게 존재하고, 클릭 시 올바른 URL로 이동한다.

## Tasks / Subtasks

- [ ] Task 1: 대메뉴-태그 매핑 테이블 정의 (AC: #2) [NEW]
  - [ ] `apps/web/lib/qna-tags.ts` 생성: `QNA_AUTO_TAG_MAP` 상수 정의
    ```ts
    export const QNA_AUTO_TAG_MAP: Record<string, string[]> = {
      'vibe-coding':  ['vibe-coding'],
      'automation':   ['automation'],
      'monetize':     ['monetization'],
      'lounge':       ['lounge'],
      'lounge/products': ['ai-product'],
      'lounge/talk':  ['lounge-talk'],
      'lounge/gigs':  ['lounge-gig'],
    }
    ```
  - [ ] 태그 값은 kebab-case 소문자로 통일. `createQuestionSchema.tags`와 호환.

- [ ] Task 2: 각 대메뉴 페이지에 [질문하기] 버튼 추가/확인 (AC: #1, #2, #6) [UPDATE]
  - [ ] `apps/web/app/vibe-coding/page.tsx` 읽기 — [질문하기] 버튼 존재 여부 확인
  - [ ] `apps/web/app/automation/page.tsx` 읽기 — [질문하기] 버튼 존재 여부 확인
  - [ ] `apps/web/app/monetize/page.tsx` 읽기 — [질문하기] 버튼 존재 여부 확인
  - [ ] `apps/web/app/lounge/page.tsx` 읽기 — [질문하기] 버튼 존재 여부 확인
  - [ ] 각 페이지에 버튼이 없으면 추가. 있으면 href를 `/questions/write?tags={tag}` 형식으로 업데이트.
  - [ ] 버튼 컴포넌트: `<Link href="/questions/write?tags=vibe-coding"><Button>질문하기</Button></Link>` 또는 `AskButton` 공용 컴포넌트 생성

- [ ] Task 3: [질문하기] 공용 컴포넌트 (AC: #1, #4, #6) [NEW]
  - [ ] `apps/web/components/board/AskButton.tsx` 생성: `{ tags: string[], className?: string }` props
  - [ ] 회원이면 `<Link href={`/questions/write?tags=${tags.join(',')}`}>` 렌더
  - [ ] 비회원이면 버튼 클릭 시 로그인 유도 모달 + `redirectTo` 포함 (UX-DR-U1)
  - [ ] `apps/web/components/board/index.ts` [UPDATE]: `AskButton` export 추가

- [ ] Task 4: 질문 작성 페이지에서 URL 태그 파라미터 읽기 (AC: #3, #5) [UPDATE]
  - [ ] `apps/web/app/questions/write/page.tsx` [UPDATE]: `searchParams` props에서 `tags` 파라미터 추출
  - [ ] `tags` 파라미터(`?tags=vibe-coding` 또는 `?tags=automation,monetization`)를 파싱해 배열로 변환
  - [ ] `PostWriteForm` 또는 해당 컴포넌트에 `initialTags: string[]` prop으로 주입
  - [ ] `PostWriteForm.tsx` [UPDATE]: `initialTags?: string[]` prop 추가 → 태그 입력 영역 초기값으로 설정

- [ ] Task 5: 비회원 게이팅에서 redirectTo 태그 보존 (AC: #4) [UPDATE]
  - [ ] `AskButton.tsx`의 비회원 처리: `redirectTo=/questions/write?tags=xxx` URL encode 포함
  - [ ] 로그인 후 복귀 시 태그 파라미터 그대로 유지 (redirectTo의 쿼리스트링 보존)

## Dev Notes

### 현행 대메뉴 페이지 분석
- `apps/web/app/vibe-coding/page.tsx`, `apps/web/app/automation/page.tsx` 등 각 대메뉴 페이지를 Task 2에서 직접 읽어 확인한다.
- 현재 [질문하기] 버튼이 없을 가능성 높음(Q&A 기능 미구현 상태). 버튼 추가 시 기존 레이아웃 최소 변경.
- 버튼 위치: 각 게시판 목록 헤더 우상단 또는 `BoardHero` 인접 영역. 기존 [글쓰기] 버튼 옆에 나란히 배치 권장.

### URL 태그 파라미터 설계
- `?tags=vibe-coding` (단일) 또는 `?tags=automation,monetization` (다중, 쉼표 구분)
- 파싱: `tags.split(',').map(t => t.trim()).filter(Boolean)`
- `createQuestionSchema.tags` 배열에 매핑

### `PostWriteForm` 확장 (공유 컴포넌트 주의)
- Task 4에서 `initialTags` prop 추가 시 기존 모든 사용처에 영향 없어야 함(optional prop으로 추가).
- 기존 `suggestedTags` 자동완성과 충돌 없이 `initialTags`가 이미 선택된 태그로 표시되어야 함.
- 현행 PostWriteForm에서 태그 관리 방식(useState로 tags 배열) 파악 후 `initialTags` 주입 지점 결정.

### 보존 규칙 (project-context)
- 기존 UI 계약(버튼 구성·레이아웃·상태 흐름) 변경 금지. 버튼만 추가.
- `PostWriteForm` 기존 동작 회귀 없음.

### Project Structure Notes
- 신규 파일: `apps/web/lib/qna-tags.ts`, `apps/web/components/board/AskButton.tsx`
- 수정 파일: 각 대메뉴 `page.tsx` (vibe-coding, automation, monetize, lounge 등), `apps/web/app/questions/write/page.tsx`, `apps/web/components/board/PostWriteForm.tsx`, `apps/web/components/board/index.ts`

### References
- [Source: epics.md#Story 3.4 AC] 대메뉴 질문하기 요구사항
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3.9] 각 대메뉴 [질문하기] → 관련 태그 자동 부착
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U1] 비회원 게이팅 + redirectTo
- [Source: apps/web/components/board/PostWriteForm.tsx] 공유 글쓰기 폼 현황 (읽어 확인)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
