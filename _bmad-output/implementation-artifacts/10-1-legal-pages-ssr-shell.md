# Story 10.1: 약관 페이지 SSR 셸 — `/terms` · `/privacy` · `/operation-policy` + 푸터 링크

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want 이용약관·개인정보처리방침·운영정책 세 페이지를 즉시 열람하기를,
so that 가입 전 권리·의무를 확인하고 검색엔진이 색인한다.

## Acceptance Criteria

1. `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/operation-policy/page.tsx` 세 파일이 존재하며, 비회원(쿠키 없음)이 각 URL에 접근하면 SSR 방식으로 법무 본문 HTML이 서버에서 즉시 렌더된다(로그인 리다이렉트 없음, NFR-1).
2. 각 법무 페이지에 `generateMetadata`가 구현되어 고유 `title`, `meta description`, `canonical` URL, H1 1개, BreadcrumbList JSON-LD가 포함된다(FR-11.1·11.2).
3. `apps/web/components/site/SiteFooter.tsx`의 푸터 하단 `<a>` 태그(현재 `href="#"`)가 `<Link href="/terms">이용약관</Link>`, `<Link href="/privacy">개인정보처리방침</Link>`, `<Link href="/operation-policy">운영정책</Link>`으로 교체되며, "운영정책" 링크가 추가된다.
4. 법무 텍스트가 미확정인 상태에서는 각 페이지에 플레이스홀더 텍스트와 `버전 0.1 · 시행일 미정` 표기를 렌더하며, 실제 텍스트로 교체할 때는 해당 `page.tsx` 또는 분리된 콘텐츠 상수 파일만 수정한다.
5. 모바일(<768px)에서 가로 스크롤이 없고, 푸터 링크가 Tab 키로 접근 가능하며, 터치 영역이 ≥36px이다(NFR-3·UX-DR-U13).
6. 각 페이지는 `robots` 메타가 없어 기본 색인 허용이며(약관 페이지는 공개 SSR, noindex 아님), `<main id="main">`으로 본문 바로가기 대상이 된다.

## Tasks / Subtasks

- [ ] Task 1: 법무 페이지 공통 레이아웃 컴포넌트 생성 (AC: #1, #4, #5, #6)
  - [ ] 디자인 페이지 없음 → 기존 디자인 시스템으로 약관 본문 레이아웃 직접 구성 (단순 API 연동이 아님)
  - [ ] **약관 페이지 레이아웃 설계**: 제목(H1) + 개정일/시행일 메타 + 목차(ToC) + 섹션(H2/H3) + 조항 본문 영역으로 구성. 기존 디자인 시스템 컴포넌트(`Button`, `Badge` 불필요 — 텍스트 중심)와 CSS 토큰(`--spacing-*`, `--color-*`, `--font-*`, `var(--container-md)`)만 활용.
  - [ ] `apps/web/app/(legal)/layout.tsx` NEW — `<main id="main">` 래퍼, 사이드바 없음, 콘텐츠 최대 폭 `var(--container-md)` 제한, `(legal)/layout.module.css` NEW
    - 레이아웃 구조: 상단 breadcrumb 영역 + 본문 영역(좌측 ToC sticky / 우측 조항 본문, 모바일은 ToC 접힘)
  - [ ] `apps/web/app/(legal)/_content/terms.ts` NEW — 이용약관 플레이스홀더 텍스트 상수(`TERMS_SECTIONS: Array<{ id, heading, body }>`, `TERMS_VERSION = '0.1'`, `TERMS_EFFECTIVE_DATE = '미정'`)
  - [ ] `apps/web/app/(legal)/_content/privacy.ts` NEW — 동일 구조
  - [ ] `apps/web/app/(legal)/_content/operation-policy.ts` NEW — 동일 구조
  - [ ] `apps/web/components/legal/LegalPageLayout.tsx` NEW — 재사용 레이아웃 컴포넌트:
    ```
    Props: title, sections: Array<{ id, heading, body }>, version, effectiveDate
    구조:
      <article>
        <header>
          <h1>{title}</h1>
          <p className={styles.meta}>버전 {version} · 시행일 {effectiveDate}</p>
        </header>
        <nav aria-label="목차">   ← 목차: section heading 목록, sticky 사이드바 or 상단 inline
          <ol>
            {sections.map(s => <li><a href={`#${s.id}`}>{s.heading}</a></li>)}
          </ol>
        </nav>
        <div className={styles.body}>
          {sections.map(s => (
            <section key={s.id} id={s.id}>
              <h2>{s.heading}</h2>
              <div>{s.body}</div>
            </section>
          ))}
        </div>
      </article>
    ```
  - [ ] `apps/web/components/legal/LegalPageLayout.module.css` NEW — 토큰 기반 스타일:
    - `.meta`: 개정일/시행일 표기, `color: var(--color-text-secondary)`, `font-size: var(--font-size-sm)`
    - `.toc`: sticky nav, `position: sticky; top: var(--spacing-lg)`, 모바일(<768px)은 `position: static; margin-bottom: var(--spacing-md)`
    - `.toc a`: 클릭 시 `color: var(--color-primary)`, 기본 `color: var(--color-text-secondary)`, `font-size: var(--font-size-sm)`
    - `.body section`: `margin-bottom: var(--spacing-xl)`, `h2: font-size: var(--font-size-lg)`
    - 가로 스크롤 방지: `overflow-x: hidden`, `word-break: break-word`

- [ ] Task 2: 이용약관 페이지 생성 (AC: #1, #2, #4, #6)
  - [ ] `apps/web/app/terms/page.tsx` NEW — `export const dynamic = 'force-static'`(법무 텍스트는 빌드 시 고정), `generateMetadata` 구현: `title: '이용약관'`, `description: 'AI작당 이용약관'`, `alternates.canonical: '/terms'`
  - [ ] H1: `<h1>이용약관</h1>`, BreadcrumbList JSON-LD: `[홈 → 이용약관]`, `TERMS_SECTIONS` 플레이스홀더 렌더
  - [ ] `LegalPageLayout` 컴포넌트 사용하여 렌더: `<LegalPageLayout title="이용약관" sections={TERMS_SECTIONS} version={TERMS_VERSION} effectiveDate={TERMS_EFFECTIVE_DATE} />`

- [ ] Task 3: 개인정보처리방침 페이지 생성 (AC: #1, #2, #4, #6)
  - [ ] `apps/web/app/privacy/page.tsx` NEW — `generateMetadata`: `title: '개인정보처리방침'`, `canonical: '/privacy'`
  - [ ] H1, BreadcrumbList JSON-LD: `[홈 → 개인정보처리방침]`, `PRIVACY_SECTIONS` 플레이스홀더, `LegalPageLayout` 사용

- [ ] Task 4: 운영정책 페이지 생성 (AC: #1, #2, #4, #6)
  - [ ] `apps/web/app/operation-policy/page.tsx` NEW — `generateMetadata`: `title: '운영정책'`, `canonical: '/operation-policy'`
  - [ ] H1, BreadcrumbList JSON-LD: `[홈 → 운영정책]`, `OPERATION_POLICY_SECTIONS` 플레이스홀더, `LegalPageLayout` 사용

- [ ] Task 5: SiteFooter 업데이트 — 푸터 링크 연결 (AC: #3, #5)
  - [ ] `apps/web/components/site/SiteFooter.tsx` UPDATE
    - `import Link from "next/link"` 이미 있음
    - 현재 `<a href="#">이용약관</a>` → `<Link href="/terms">이용약관</Link>`
    - `<a href="#">개인정보처리방침</a>` → `<Link href="/privacy">개인정보처리방침</Link>`
    - "운영정책" 링크 추가: `<Link href="/operation-policy">운영정책</Link>`
    - 푸터 링크 터치 영역: `SiteFooter.module.css`에서 `.bottom a { min-height: 36px; display: inline-flex; align-items: center; }` 또는 동등 패딩 확보
  - [ ] 기존 푸터 구조(`footerGroups` 내비게이션, `.brandBlock`, `.linkGroups`, `.bottom`)는 변경하지 않음

- [ ] Task 6: 반응형 검증 (AC: #5)
  - [ ] `LegalPageLayout.module.css`에 모바일 breakpoint(`@media (max-width: var(--breakpoint-tablet))`) 가로 스크롤 방지 및 ToC 레이아웃 조정
  - [ ] 모든 CSS값은 토큰 `var(--...)` 참조, 숫자 하드코딩 금지 (단, breakpoint는 `tokens/breakpoints.css` 변수 사용)

## Dev Notes

### 아키텍처 패턴
- **SSR 방식**: App Router 서버 컴포넌트. 법무 페이지는 정적 콘텐츠이므로 `export const dynamic = 'force-static'`으로 빌드 시 정적화. [Source: architecture.md#Frontend Architecture]
- **SEO**: `generateMetadata` + BreadcrumbList JSON-LD는 프로젝트 표준. 각 페이지 독립 `metadata.title`, canonical은 `/terms`, `/privacy`, `/operation-policy` 절대 경로. [Source: architecture.md#Frontend Architecture - SEO 구현]
- **NFR-1**: 법무 텍스트는 서버에서 렌더해 HTML에 포함 — 클라이언트 패치 없음.
- **비회원 접근**: 미들웨어/auth 게이팅 없음. `app/terms/`, `app/privacy/`, `app/operation-policy/` 는 모두 공개 라우트.
- **디자인 없음 주의**: 약관 페이지 Figma 디자인이 없으므로 기존 디자인 시스템 컴포넌트와 CSS 토큰으로 레이아웃을 직접 설계·구현. 단순 플레이스홀더 텍스트 출력이 아니라 실제 서비스 품질의 약관 페이지 UI를 만들어야 함.

### 라우트 구조
```
apps/web/app/
  terms/
    page.tsx           ← /terms (이용약관)
  privacy/
    page.tsx           ← /privacy (개인정보처리방침)
  operation-policy/
    page.tsx           ← /operation-policy (운영정책)
  (legal)/             ← 선택: 세 페이지 공통 layout이 필요하면 Route Group으로 묶기
    layout.tsx
    layout.module.css
    _content/
      terms.ts
      privacy.ts
      operation-policy.ts

apps/web/components/
  legal/
    LegalPageLayout.tsx
    LegalPageLayout.module.css
```

> **참고**: `(legal)` Route Group은 URL에 나타나지 않음(`/legal/terms` 아님). `app/terms/page.tsx` → URL `/terms`, `app/privacy/page.tsx` → URL `/privacy`, `app/operation-policy/page.tsx` → URL `/operation-policy`.

### 수정 대상 파일 현황
- **`apps/web/components/site/SiteFooter.tsx`** (UPDATE):
  - 현재: 푸터 하단에 `<a href="#">이용약관</a>`, `<a href="#">개인정보처리방침</a>` (href="#" 미연결). `import Link` 이미 있음.
  - 변경: `<Link href="/terms">이용약관</Link>`, `<Link href="/privacy">개인정보처리방침</Link>`, `<Link href="/operation-policy">운영정책</Link>` 추가.
  - 보존: `footerGroups` 커뮤니티/자료실/라운지 링크 그룹, `.brandBlock`, `.inner` 구조 전혀 건드리지 않음.
  - 주의: "운영정책" 추가 시 `.bottom div`가 3개 항목이 되므로 레이아웃 유지 확인 필요(기존 CSS flex/gap으로 처리됨).

### 콘텐츠 파일 설계 (향후 텍스트 교체 경로)
```
apps/web/app/(legal)/_content/
  terms.ts             ← 이용약관 섹션 배열 상수 + 버전/시행일
  privacy.ts           ← 개인정보처리방침 섹션 배열 상수
  operation-policy.ts  ← 운영정책 섹션 배열 상수
```
실제 법무팀 약관 텍스트 확정 시 이 파일의 `body` 필드만 교체하면 전 페이지 반영.

### BreadcrumbList JSON-LD 예시 (각 페이지 적용)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://aijakdang.com" },
    { "@type": "ListItem", "position": 2, "name": "이용약관", "item": "https://aijakdang.com/terms" }
  ]
}
```
`<script type="application/ld+json">` 태그로 `<head>`에 삽입(Next.js `generateMetadata`의 `other` 또는 `<Script>` 컴포넌트 사용).

### CSS 규칙
- 색·여백·radius: `var(--...)` 토큰 참조, 하드코딩 금지.
- 반응형: `tokens/breakpoints.css` 변수 사용(`--breakpoint-tablet: 768px` 등). `@media` 내 숫자 직접 입력 금지.
- [Source: project-context.md#구조]

### 테스트
- co-located `apps/web/app/terms/page.test.tsx` (Vitest) — renderToStaticMarkup 후 H1 텍스트, BreadcrumbList JSON-LD 포함 여부 확인(선택, 필수 아님).
- 접근성: 푸터 링크 Tab 순서 확인. 약관 페이지 내 목차 링크 Tab 이동 확인.

### Project Structure Notes
- 약관 페이지 URL: `/terms`, `/privacy`, `/operation-policy` — Epic 10 전체에서 일관 사용.
- Story 10.3에서 `SignupForm`의 가입폼 동의 링크를 `/terms`·`/privacy`로 연결(이 스토리는 푸터만; 가입폼 링크 교정은 10.3에서 처리).
- `app/terms/page.tsx` 등은 전역 `layout.tsx`의 `SiteHeader`·`SiteFooter`를 그대로 상속 — 별도 헤더/푸터 불필요.

### References
- [Source: epics.md#Story 10.1 AC]
- [Source: architecture.md#Frontend Architecture]
- [Source: project-context.md#SEO]
- [Source: apps/web/components/site/SiteFooter.tsx — 현재 상태 (href="#" 미연결, import Link 있음)]
- [Source: apps/web/app/layout.tsx — 전역 레이아웃]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#SEO & 구조화]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- NEW `apps/web/app/terms/page.tsx`
- NEW `apps/web/app/privacy/page.tsx`
- NEW `apps/web/app/operation-policy/page.tsx`
- NEW `apps/web/app/(legal)/layout.tsx`
- NEW `apps/web/app/(legal)/layout.module.css`
- NEW `apps/web/app/(legal)/_content/terms.ts`
- NEW `apps/web/app/(legal)/_content/privacy.ts`
- NEW `apps/web/app/(legal)/_content/operation-policy.ts`
- NEW `apps/web/components/legal/LegalPageLayout.tsx`
- NEW `apps/web/components/legal/LegalPageLayout.module.css`
- UPDATE `apps/web/components/site/SiteFooter.tsx`
