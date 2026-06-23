# Story 2.5: Tiptap 에디터 full preset + packages/contracts/editor.ts

Status: ready-for-dev

## Story

As a 개발팀,
I want Tiptap `full` preset 에디터와 허용 노드 화이트리스트가 `apps/web/features/editor/`·`packages/contracts/editor.ts`에 정착되기를,
so that 글쓰기·공지·Epic 3·4 에디터가 같은 preset을 재사용하고 서버 새니타이즈와 클라이언트 에디터가 동일 화이트리스트를 공유한다(AR-8·FR-2.5).

## Acceptance Criteria

1. `packages/contracts/src/editor.ts`가 NEW로 생성된다. named export: `FULL_ALLOWED_NODES`(굵게/bold·H2·H3·목록/bulletList+orderedList·링크/link·이미지/image·코드블록/codeBlock·인용/blockquote·제한 색상/textStyle+color·형광펜/highlight) 각 노드의 허용 속성까지 명시. `LITE_ALLOWED_NODES`(줄바꿈/hardBreak·링크·이미지·코드블록). **표·복잡 레이아웃·자유 글자크기·자유 색상 미포함**(FR-2.5). `index.ts`에서 re-export.
2. `apps/web/features/editor/Editor.tsx`가 NEW로 생성된다. props: `preset: "full" | "lite"`, `value?: object`(contentJson), `onChange?: (json: object) => void`, `placeholder?: string`. `'use client'` 마킹. Tiptap `useEditor` + 해당 preset 익스텐션만 로드.
3. `apps/web/features/editor/EditorToolbar.tsx`가 NEW로 생성된다. `full` preset 시 툴바 버튼(굵게·H2/H3·목록·링크·이미지·코드블록·인용·색상·형광펜). 각 버튼 `aria-label`·포커스 링(`var(--shadow-focus-ring)`). `lite` preset 시 해당 버튼만 노출.
4. `apps/web/features/editor/Editor.module.css`가 NEW로 생성된다. Tiptap 에디터 영역 스타일(min-height, 포커스 링, 코드블록 배경 등). **모든 시각 값은 토큰 `var(--...)` 참조**.
5. `apps/web/features/editor/index.ts` 배럴 export: `Editor`, `EditorToolbar` named export.
6. 이미지 삽입 시 `alt` 입력 강제(없으면 삽입 버튼 비활성). 실 파일 업로드 S3 연동은 범위 외 — URL 입력 방식 사용.
7. 툴바 버튼 포커스 시 `var(--shadow-focus-ring)` 포커스 링 시각 표시. 제외 기능(표·자유 글자크기·자유 색상) 버튼은 툴바에 존재하지 않음.
8. `pnpm typecheck` 통과. Tiptap 패키지가 `apps/web/package.json`에 설치됨.

## Tasks / Subtasks

- [ ] Task 1: packages/contracts/editor.ts 생성 (AC: #1)
  - [ ] `packages/contracts/src/editor.ts` NEW
  - [ ] `AllowedNode` 타입: `{ type: string; attrs?: Record<string, string[]> }` (허용 속성 배열)
  - [ ] `FULL_ALLOWED_NODES: AllowedNode[]` 정의:
    - `bold`, `italic`(선택), `heading`(levels:[2,3])
    - `bulletList`, `orderedList`, `listItem`
    - `link`(attrs: href, target, rel)
    - `image`(attrs: src, alt, title) — alt 필수 강제는 에디터 레벨에서
    - `codeBlock`(attrs: language)
    - `blockquote`
    - `textStyle`(attrs: color — 제한 팔레트만)
    - `highlight`(attrs: color — 제한 팔레트만)
    - `hardBreak`, `paragraph`, `doc`, `text`
  - [ ] `LITE_ALLOWED_NODES: AllowedNode[]`: `hardBreak`, `link`, `image`, `codeBlock`, `paragraph`, `doc`, `text`
  - [ ] `packages/contracts/src/index.ts` UPDATE: editor.ts re-export

- [ ] Task 2: Tiptap 패키지 설치 (AC: #8)
  - [ ] `pnpm --filter apps/web add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-code-block @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-highlight`
  - [ ] `apps/web/package.json` 의존성 확인

- [ ] Task 3: Editor.tsx 생성 (AC: #2)
  - [ ] `apps/web/features/editor/Editor.tsx` NEW
  - [ ] `'use client'`
  - [ ] `useEditor({ extensions: buildExtensions(preset), content: value, onUpdate: ({ editor }) => onChange?.(editor.getJSON()) })`
  - [ ] `buildExtensions(preset: "full"|"lite"): Extension[]` 내부 함수: preset에 따라 FULL 또는 LITE 익스텐션 목록 반환
  - [ ] full 익스텐션: StarterKit(heading: [2,3], dropcursor, gapcursor), Link(openOnClick: false), Image, CodeBlock(lowlight 제외 — 2.6에서 추가), Color, TextStyle, Highlight
  - [ ] lite 익스텐션: StarterKit(heading: false, bold: false, italic: false), Link, Image, CodeBlock
  - [ ] `<EditorContent editor={editor} />` 렌더

- [ ] Task 4: EditorToolbar.tsx 생성 (AC: #3, #7)
  - [ ] `apps/web/features/editor/EditorToolbar.tsx` NEW
  - [ ] `'use client'`
  - [ ] props: `editor: Editor | null`, `preset: "full" | "lite"`
  - [ ] full 버튼 목록: 굵게(`toggleBold`), H2(`toggleHeading({level:2})`), H3(`toggleHeading({level:3})`), 불릿리스트(`toggleBulletList`), 순서리스트(`toggleOrderedList`), 링크(`setLink`), 이미지(`insertImage` - URL+alt 입력 모달), 코드블록(`toggleCodeBlock`), 인용(`toggleBlockquote`), 색상 선택, 형광펜
  - [ ] 각 버튼: `aria-label="..."`, `aria-pressed={editor?.isActive(...)}`
  - [ ] 포커스 링: `&:focus-visible { box-shadow: var(--shadow-focus-ring); outline: none; }` in CSS
  - [ ] 이미지 버튼 클릭 시 작은 인라인 모달(URL + alt 입력). alt 비어있으면 [삽입] 버튼 disabled.

- [ ] Task 5: Editor.module.css 생성 (AC: #4)
  - [ ] `apps/web/features/editor/Editor.module.css` NEW
  - [ ] 에디터 컨테이너: `border: 1px solid var(--color-border)`, `border-radius: var(--radius-md)`, `min-height: 320px`
  - [ ] 툴바: `border-bottom: 1px solid var(--color-border)`, flex 레이아웃, 버튼 `padding: var(--space-1) var(--space-2)`
  - [ ] 에디터 본문: `padding: var(--space-4)`, `cursor: text`
  - [ ] 코드블록: `background: var(--color-surface-raised)`, `font-family: var(--font-mono)`, `border-radius: var(--radius-sm)`
  - [ ] 모든 색·크기·radius: 토큰만. 픽셀 하드코딩 금지.

- [ ] Task 6: index.ts 배럴 (AC: #5)
  - [ ] `apps/web/features/editor/index.ts` NEW

- [ ] Task 7: 기존 write 페이지 에디터 연동
  - [ ] `apps/web/app/vibe-coding/write/page.tsx` 참조: `PostWriteForm`이 에디터를 포함함
  - [ ] `components/board/PostWriteForm.tsx`가 현재 어떤 에디터를 사용하는지 확인 후 `<Editor preset="full" />` 연동
  - [ ] `LightEditor` 컴포넌트(components/board) → `<Editor preset="lite" />` 연동 여부 확인 (작당 의뢰소 RecruitForm이 사용)

- [ ] Task 8: typecheck 통과 (AC: #8)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **AR-8 에디터 격리**: `apps/web/features/editor/`는 web 전용. admin은 별도 구현. 노드 화이트리스트만 `packages/contracts/editor.ts`로 공유. [Source: architecture.md#Implementation Patterns — Editor]
- **contracts 우선**: `FULL_ALLOWED_NODES`는 2.6의 `sanitize-html` 화이트리스트 빌더(`buildSanitizeOptions`)의 단일 소스. 서버·클라이언트 모두 동일 상수 참조. [Source: project-context.md#응답 & 데이터 포맷]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
현재 글쓰기 관련 파일 확인 결과:
- `apps/web/app/vibe-coding/write/page.tsx`: `PostWriteForm` + `PostWriteFormConfig` 사용. `PostWriteForm`은 `@/components/board`에서 import.
- `apps/web/app/lounge/write/page.tsx`: `PostWriteForm` + `CreativeSpecFields` 사용.
- `apps/web/app/lounge/gigs/write/RecruitForm.tsx`: `LightEditor` 컴포넌트 사용(`@/components/board`에서 import).
- **반드시 읽어야 할 파일**: `apps/web/components/board/PostWriteForm.tsx` — 현재 에디터 구현 상태 파악 필수.

`PostWriteForm.tsx`를 읽어 현재 에디터(textarea인지 기존 Tiptap 인지)를 확인하고:
- textarea → `<Editor preset="full" />` 교체
- 이미 Tiptap → 노드 화이트리스트를 `FULL_ALLOWED_NODES` 기반으로 통일

### Tiptap 버전 주의
- `@tiptap/react` v2.x 사용 (Next.js 16과 호환)
- `@tiptap/pm` (ProseMirror peer dep) 별도 설치 필요
- `lowlight`(코드 하이라이팅) 설치: 2.6에서 추가 예정. 현재는 CodeBlock 기본 스타일만.

### 색상 제한 팔레트
- 색상(`Color`) 허용 팔레트: 프로젝트 CSS 토큰 기반 (예: `var(--color-accent)`, `var(--color-danger)` 등)
- 자유 색상 입력 금지 — 색상 picker는 preset된 선택지만 노출
- 형광펜(`Highlight`) 허용 색상: 노란색(기본)·하늘색·연두색 등 3~5가지

### 이미지 alt 강제
```tsx
function insertImageWithAlt(editor: Editor) {
  const url = prompt("이미지 URL");
  const alt = prompt("이미지 설명(alt)");
  if (!url || !alt) return; // alt 없으면 삽입 안 함
  editor.chain().focus().setImage({ src: url, alt }).run();
}
```
→ 실제 모달 컴포넌트로 대체 권장(UX 개선).

### Project Structure Notes
- NEW: `packages/contracts/src/editor.ts`
- NEW: `apps/web/features/editor/Editor.tsx`
- NEW: `apps/web/features/editor/EditorToolbar.tsx`
- NEW: `apps/web/features/editor/Editor.module.css`
- NEW: `apps/web/features/editor/index.ts`
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/web/components/board/PostWriteForm.tsx` (에디터 교체)
- `apps/web/features/` 폴더: architecture에 `features/` = 도메인 기능 UI 위치로 명시됨

### References
- [Source: epics.md#Story 2.5 AC]
- [Source: architecture.md#Implementation Patterns — Editor]
- [Source: project-context.md#응답 & 데이터 포맷 — 본문 = Tiptap JSON]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Accessibility Floor]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/contracts/src/editor.ts`
- NEW: `apps/web/features/editor/Editor.tsx`
- NEW: `apps/web/features/editor/EditorToolbar.tsx`
- NEW: `apps/web/features/editor/Editor.module.css`
- NEW: `apps/web/features/editor/index.ts`
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/web/components/board/PostWriteForm.tsx`
- UPDATE: `apps/web/package.json` (Tiptap 의존성 추가)
