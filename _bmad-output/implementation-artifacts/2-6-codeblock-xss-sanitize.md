# Story 2.6: 코드블록 렌더링 + sanitize-html XSS 차단

Status: review

## Story

As a 방문자,
I want 게시글 본문이 코드블록 줄바꿈·들여쓰기·특수문자를 보존하면서 HTML/script 실행 없이 안전하게 렌더되기를,
so that 실전 코드 예제를 그대로 읽고 복사하며 악성 스크립트 실행 걱정이 없다(FR-2.3·FR-2.6·NFR-2).

## Acceptance Criteria

1. `apps/api/src/routes/v1/posts/service.ts`가 UPDATE된다. `getPostBySlug` 내 `contentHtml` 생성 로직: Tiptap JSON→HTML 변환(`@tiptap/html` 또는 자체 renderer) 후 `sanitize-html` 화이트리스트 적용. `<script>`·`<iframe>`·`<object>`·`on*` 이벤트 핸들러 제거(AR-8).
2. `buildSanitizeOptions(allowedNodes: AllowedNode[])` 함수가 `packages/contracts/src/editor.ts`에서 파생되거나 `apps/api/src/lib/sanitize.ts`에 존재한다. `FULL_ALLOWED_NODES`를 입력으로 `sanitize-html` options 객체를 반환. 서버 새니타이즈·에디터 preset이 동일 `FULL_ALLOWED_NODES` 소스를 참조함을 단위 테스트로 증명.
3. 코드블록(`<pre><code class="language-{lang}">`) 포함 HTML 렌더 시: 줄바꿈·들여쓰기·특수문자(`<`, `>`, `&`) 보존, `<pre><code class="language-js">` 구조 유지, JavaScript 미실행.
4. 하이드레이션 후 코드블록 hover/터치 시 [복사] 버튼 표시·클립보드 복사·성공 토스트. 가로 스크롤 지원(FR-2.6).
5. XSS 페이로드 5개 이상을 커버하는 단위 테스트(`apps/api/src/lib/sanitize.test.ts`): `<script>alert(1)</script>`, `<img onerror="alert(1)" src="x">`, `<svg onload="alert(1)">`, `javascript:alert(1)` href, `<iframe src="...">`. 각각 스크립트 미실행·허용 태그만 출력 검증. Vitest로 통과.
6. `FULL_ALLOWED_NODES` 변경 시 `buildSanitizeOptions` 결과도 자동 반영되고 단위 테스트가 이를 검증한다.
7. `sanitize-html` 패키지가 `apps/api/package.json`에 설치되고 `pnpm typecheck` 통과.

## Tasks / Subtasks

- [ ] Task 1: sanitize-html 설치 (AC: #7)
  - [ ] `pnpm --filter apps/api add sanitize-html`
  - [ ] `pnpm --filter apps/api add -D @types/sanitize-html`

- [ ] Task 2: buildSanitizeOptions 유틸 구현 (AC: #2, #6)
  - [ ] `apps/api/src/lib/sanitize.ts` NEW
  - [ ] import `FULL_ALLOWED_NODES` from `packages/contracts`
  - [ ] `buildSanitizeOptions(nodes: AllowedNode[]): sanitizeHtml.IOptions` 함수:
    - `allowedTags`: nodes의 type 배열 + `p`, `br`, `pre`, `code` 기본 포함
    - `allowedAttributes`: nodes의 attrs 매핑 (`a: ['href','target','rel']`, `img: ['src','alt','title']`, `code: ['class']`)
    - `allowedClasses`: `{ code: ['language-*'] }`
    - `exclusiveFilter`: `(frame) => frame.tag === 'a' && frame.attribs?.href?.startsWith('javascript:')` → true (제거)
  - [ ] `sanitizeHtml(html: string)` wrapper export: `sanitizeHtml(html, buildSanitizeOptions(FULL_ALLOWED_NODES))`

- [ ] Task 3: Tiptap JSON→HTML 변환 구현 (AC: #1, #3)
  - [ ] `apps/api/src/lib/tiptap-renderer.ts` NEW
  - [ ] `tiptapJsonToHtml(contentJson: unknown): string` 함수
  - [ ] 방법 A: `@tiptap/html` 패키지 사용 (`pnpm --filter apps/api add @tiptap/html`)
  - [ ] 방법 B: 자체 재귀 renderer (paragraph→`<p>`, heading→`<h2>`/`<h3>`, codeBlock→`<pre><code class="language-{lang}">`, bulletList→`<ul>`, orderedList→`<ol>`, link→`<a href="..." rel="noopener noreferrer" target="_blank">`, image→`<img src="..." alt="...">`, blockquote→`<blockquote>`, bold→`<strong>`, highlight→`<mark>`)
  - [ ] **코드블록 주의**: `codeBlock` 노드 텍스트의 `<`, `>`, `&`는 HTML 이스케이프 필수 (`&lt;`, `&gt;`, `&amp;`)
  - [ ] 방법 A 권장 (Tiptap 공식 유지보수)

- [ ] Task 4: service.ts 연동 (AC: #1)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE
  - [ ] `getPostBySlug` 내: `const html = tiptapJsonToHtml(post.content_json)` → `const contentHtml = sanitizeHtml(html)`
  - [ ] `postDetailSchema`의 `contentHtml` 필드에 반영

- [ ] Task 5: XSS 단위 테스트 (AC: #5)
  - [ ] `apps/api/src/lib/sanitize.test.ts` NEW
  - [ ] 5개 이상 XSS 벡터 테스트:
    1. `<script>alert(1)</script>` → 스크립트 태그 제거
    2. `<img onerror="alert(1)" src="x">` → `onerror` 제거, `src` 유지
    3. `<p onclick="alert(1)">text</p>` → onclick 제거, `<p>text</p>` 출력
    4. `<a href="javascript:alert(1)">link</a>` → href 제거 또는 a 태그 제거
    5. `<iframe src="https://evil.com">` → iframe 전체 제거
    6. `<svg onload="alert(1)"><rect /></svg>` → svg 전체 제거
  - [ ] `pnpm test` 통과

- [ ] Task 6: 코드블록 복사 버튼 클라이언트 컴포넌트 (AC: #4)
  - [ ] `apps/web/components/board/CodeBlockCopyButton.tsx` NEW (`'use client'`)
  - [ ] `useEffect`로 렌더 후 DOM에서 `pre code` 요소 찾아 복사 버튼 동적 삽입 (또는 `dangerouslySetInnerHTML` 래퍼 컴포넌트)
  - [ ] 복사 성공 시 토스트(`ToastProvider` 사용) + 버튼 아이콘 변경
  - [ ] CSS: `pre { position: relative; overflow-x: auto; }` — 가로 스크롤

- [ ] Task 7: typecheck + 테스트 통과 (AC: #7)
  - [ ] `pnpm typecheck` 전 워크스페이스
  - [ ] `pnpm test` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **AR-8 XSS 차단**: 서버 `sanitize-html` 화이트리스트가 유일한 방어선. 클라이언트 검증은 UX일 뿐. [Source: architecture.md#Authentication & Security]
- **단일 소스 원칙**: `FULL_ALLOWED_NODES`(contracts) → `buildSanitizeOptions`(api) + `Editor` 익스텐션 목록(web). 변경 시 양쪽 동기화 불필요. [Source: epics.md#Story 2.6 AC]
- **HTML 원본 저장 금지**: DB에는 `content_json`(Tiptap JSON)만 저장. `contentHtml`은 읽기 시마다 서버에서 생성. [Source: project-context.md#응답 & 데이터 포맷]

### sanitize-html allowedTags 권장 목록
```javascript
allowedTags: ['p', 'br', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em',
              'a', 'img', 'pre', 'code', 'blockquote', 'mark', 'span']
```
`script`, `iframe`, `object`, `embed`, `form`, `input`, `svg`, `style` 은 목록에 없으면 자동 차단.

### 코드블록 특수문자 보존
- Tiptap JSON의 codeBlock 텍스트: `{ type: "text", text: "const x = 1 < 2;" }`
- `<`·`>`·`&`를 HTML 이스케이프 후 `<pre><code>` 래핑 필요
- `sanitize-html`의 `disableOutputEncoding: false` (기본값) 유지 → 특수문자 보존됨

### 코드블록 복사 버튼 패턴
```tsx
// PostDetailContent.tsx ('use client')
useEffect(() => {
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach((block) => {
    const pre = block.parentElement!;
    const btn = document.createElement('button');
    btn.className = styles.copyBtn;
    btn.textContent = '복사';
    btn.onclick = () => {
      navigator.clipboard.writeText(block.textContent ?? '');
      toast.success('복사됨');
    };
    pre.appendChild(btn);
  });
}, []);
```

### 기존 코드 분석
- 현재 `apps/api/src/routes/v1/posts/service.ts`의 `getPostBySlug`는 2.4에서 생성됨. 이 스토리에서 `contentHtml` 생성 로직을 `tiptapJsonToHtml + sanitizeHtml`로 교체.
- 기존 placeholder 텍스트 렌더 코드 제거 후 실 변환 로직으로 대체.

### Project Structure Notes
- NEW: `apps/api/src/lib/sanitize.ts`
- NEW: `apps/api/src/lib/sanitize.test.ts`
- NEW: `apps/api/src/lib/tiptap-renderer.ts`
- NEW: `apps/web/components/board/CodeBlockCopyButton.tsx`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/api/package.json` (sanitize-html, @tiptap/html 추가)

### References
- [Source: epics.md#Story 2.6 AC]
- [Source: architecture.md#Authentication & Security — 본문 안전성(XSS)]
- [Source: project-context.md#보안]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Interaction Primitives — 코드블록]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- TS2322: null in Record<string,string> map — fixed by extracting `text`/`doc` early-return before map lookup.

### Completion Notes List
- `sanitize-html` + `@types/sanitize-html` + `@tiptap/html` were already installed in `apps/api/package.json` — no new installs needed.
- `buildSanitizeOptions()` derives `allowedTags`/`allowedAttributes` from the passed `AllowedNode[]`; the exported `sanitizeHtml()` wrapper hard-codes `FULL_ALLOWED_NODES` as input — single source proved by unit tests.
- `tiptap-renderer.ts` uses `@tiptap/html generateHTML` with StarterKit + Image + Highlight + TextStyle + Color extensions, then pipes through `sanitizeHtml()`.
- Temporary `extractTextFromTiptapJson` + `extractNodeText` helpers removed from `service.ts`.
- `CodeBlockCopyButton.tsx` is a `'use client'` component wrapping `dangerouslySetInnerHTML`; `useEffect` inserts copy buttons after hydration. Uses `useToast` from existing `ToastProvider`.
- `CodeBlockCopyButton.module.css` added (co-located) with `pre { position: relative; overflow-x: auto }` and hover-reveal copy button.
- `CodeBlockCopyButton` exported from `apps/web/components/board/index.ts` barrel.
- API typecheck: PASS. Web typecheck: PASS. API tests: 55 passed (22 from sanitize.test.ts, 0 failures).

### File List
- NEW: `apps/api/src/lib/sanitize.ts`
- NEW: `apps/api/src/lib/sanitize.test.ts`
- NEW: `apps/api/src/lib/tiptap-renderer.ts`
- NEW: `apps/web/components/board/CodeBlockCopyButton.tsx`
- NEW: `apps/web/components/board/CodeBlockCopyButton.module.css`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/components/board/index.ts`
