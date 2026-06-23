# Story 3.9: QAPage JSON-LD + Q&A SEO 메타 완결

Status: ready-for-dev

## Story

As a 검색 엔진/AI 검색,
I want 질문 상세에서 QAPage JSON-LD와 정확한 SEO 메타를 즉시 파싱하기를,
so that Q&A 콘텐츠가 검색 결과에 풍부하게 노출된다(FR-11.5).

## Acceptance Criteria

1. 질문 상세(공개 답변 1개 이상) SSR HTML에 QAPage JSON-LD가 포함된다: `mainEntity: { "@type": "Question", "name": 질문제목, "text": 질문본문요약, "answerCount": 공개답변수, "dateCreated": ISO8601, "author": { "@type": "Person", "name": 닉네임 } }`. `helpful_answer_id` 있으면 `acceptedAnswer: { "@type": "Answer", ... }` 포함, 나머지 공개 답변은 `suggestedAnswer: [...]` 배열로 포함(FR-11.5).
2. 답변 0개 질문: `answerCount: 0`, `acceptedAnswer`·`suggestedAnswer` 키 생략.
3. `/questions` 목록 SSR HTML에 CollectionPage JSON-LD + 고유 title/description/canonical 포함: `{ "@type": "CollectionPage", "name": "묻고답하기", "url": "https://aijakdang.com/questions", "description": "AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간" }`. `generateMetadata`로 구현(FR-11.1·UX-DR-U16).
4. `apps/web/lib/seo/` 디렉터리에 `buildQAPageJsonLD(question, answers)` 헬퍼 함수 구현. Epic 2 헬퍼 패턴 재사용(있으면), 없으면 신규 생성. 중복 없음. 출력이 유효 schema.org QAPage 스키마임을 Vitest 유닛 테스트로 검증.
5. 질문 상세 SSR: `generateMetadata({ params })` — `title: "${question.title} — 묻고답하기 | AI작당"`, `description: 질문 본문 앞 150자(HTML 태그 제거)`, `alternates.canonical: "https://aijakdang.com/questions/${slug}"`, OG 태그(og:title, og:description, og:url, og:type="article") 포함.
6. Q&A `robots` 처리: 공개 질문(`status='published'`)은 색인 대상. `status='draft'|'hidden'|'deleted'`는 `noindex` 메타 태그 추가 또는 404 반환.
7. `buildQAPageJsonLD` 함수는 `question`과 `answers`(공개만)를 받아 순수 함수로 JSON-LD 객체를 반환. `JSON.stringify()`로 직렬화하여 `<script type="application/ld+json">` 태그에 주입.

## Tasks / Subtasks

- [ ] Task 1: SEO 헬퍼 구조 확인 및 신규 생성 (AC: #4) [NEW or UPDATE]
  - [ ] `apps/web/lib/seo/` 디렉터리 존재 여부 확인. 없으면 생성.
  - [ ] Epic 2에서 `buildArticleJsonLD`, `buildBreadcrumbJsonLD` 등 헬퍼가 있으면 패턴 파악 후 재사용.
  - [ ] `apps/web/lib/seo/qna.ts` 생성: `buildQAPageJsonLD(question: QAPageInput, answers: AnswerInput[]): JsonLDObject`
    ```ts
    export interface QAPageInput {
      title: string;
      text: string; // 본문 요약(HTML 태그 제거, 150자)
      dateCreated: string; // ISO8601
      author: { name: string };
      helpfulAnswerId: string | null;
    }
    export interface AnswerInput {
      id: string;
      text: string; // 답변 요약
      dateCreated: string;
      author: { name: string };
    }
    ```
  - [ ] `apps/web/lib/seo/index.ts` [UPDATE 또는 NEW]: `export * from './qna'` + 기존 헬퍼 re-export

- [ ] Task 2: QAPage JSON-LD 빌더 구현 (AC: #1, #2, #7)
  - [ ] `apps/web/lib/seo/qna.ts`: `buildQAPageJsonLD` 구현
    - `@context: "https://schema.org"`, `@type: "QAPage"`
    - `mainEntity: { @type: "Question", name, text, answerCount, dateCreated, author }`
    - `helpful_answer_id` 있는 답변 → `acceptedAnswer: { @type: "Answer", text, dateCreated, author }`
    - 나머지 공개 답변 → `suggestedAnswer: [{ @type: "Answer", ... }, ...]`
    - 답변 0개 시: `suggestedAnswer`, `acceptedAnswer` 키 생략
  - [ ] `apps/web/lib/seo/qna.test.ts` 생성: Vitest 테스트
    - 답변 0개 질문: `acceptedAnswer`, `suggestedAnswer` 키 없음 확인
    - 도움된 답변 있음: `acceptedAnswer` 포함 확인
    - 일반 답변만 있음: `suggestedAnswer` 배열 확인
    - JSON 직렬화 유효성: `JSON.parse(JSON.stringify(result))` 검증

- [ ] Task 3: 질문 상세 페이지 JSON-LD 주입 (AC: #1, #5, #6) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` [UPDATE]: API 응답에서 `question`, `answers` 받아 `buildQAPageJsonLD` 호출
  - [ ] `<script type="application/ld+json">{JSON.stringify(jsonLD)}</script>` — `<head>` 안 또는 Next `generateMetadata`의 `other` 필드 활용
  - [ ] `generateMetadata` 완성:
    ```ts
    return {
      title: `${question.title} — 묻고답하기 | AI작당`,
      description: stripHtml(question.contentHtml).slice(0, 150),
      alternates: { canonical: `https://aijakdang.com/questions/${slug}` },
      openGraph: { title, description, url, type: 'article' },
      robots: question.status === 'published' ? 'index,follow' : 'noindex,nofollow',
    }
    ```
  - [ ] `stripHtml` 유틸: `packages/utilities`에 있으면 재사용, 없으면 `apps/web/lib/seo/utils.ts`에 인라인 구현

- [ ] Task 4: 목록 페이지 CollectionPage JSON-LD + 메타 완성 (AC: #3) [UPDATE]
  - [ ] `apps/web/app/questions/page.tsx` [UPDATE]: CollectionPage JSON-LD 추가
    ```json
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "묻고답하기",
      "url": "https://aijakdang.com/questions",
      "description": "AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간"
    }
    ```
  - [ ] `generateMetadata` 완성: `{ title: '묻고답하기 | AI작당', description: '...', alternates: { canonical: 'https://aijakdang.com/questions' } }`
  - [ ] JSON-LD를 `<script type="application/ld+json">` 태그로 head에 주입(Next Layout 또는 page 내 script 태그)

- [ ] Task 5: Vitest 실행 + typecheck (AC: #4)
  - [ ] `pnpm test` — `apps/web/lib/seo/qna.test.ts` 전 케이스 green
  - [ ] `pnpm typecheck` — 전 워크스페이스 통과

- [ ] Task 6: robots 처리 (AC: #6) [UPDATE]
  - [ ] `apps/web/app/questions/[slug]/page.tsx` [UPDATE]: `question.status !== 'published'` 이면 `notFound()` 반환(Next 404) 또는 `generateMetadata`에서 `robots: 'noindex'`
  - [ ] 권장: `status='deleted'` → `notFound()`, `status='hidden'` → 200이지만 `noindex`

## Dev Notes

### QAPage JSON-LD 스키마 전문 (schema.org 참조)
```json
{
  "@context": "https://schema.org",
  "@type": "QAPage",
  "mainEntity": {
    "@type": "Question",
    "name": "질문 제목",
    "text": "질문 본문 요약 (150자)",
    "answerCount": 3,
    "dateCreated": "2026-06-18T10:00:00Z",
    "author": { "@type": "Person", "name": "작당입문러" },
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "도움된 답변 본문 요약",
      "dateCreated": "2026-06-18T11:00:00Z",
      "author": { "@type": "Person", "name": "리뷰메이트" }
    },
    "suggestedAnswer": [
      {
        "@type": "Answer",
        "text": "일반 답변 1 요약",
        "dateCreated": "2026-06-18T12:00:00Z",
        "author": { "@type": "Person", "name": "프론트라인" }
      }
    ]
  }
}
```

### Epic 2 SEO 헬퍼 패턴 재사용
- `apps/web/lib/seo/` 디렉터리가 Epic 2에서 생성됐을 수 있음. 실제 확인 후 재사용.
- `buildBreadcrumbJsonLD`, `buildArticleJsonLD` 등 존재 시 동일 패턴으로 `buildQAPageJsonLD` 구현.
- 헬퍼는 순수 함수(부작용 없음, 쉬운 테스트 가능).

### `stripHtml` 유틸
- `sanitize-html`의 `{ allowedTags: [] }` 옵션으로 모든 태그 제거 후 150자 자름.
- 또는 단순 regex: `html.replace(/<[^>]+>/g, '').slice(0, 150)`.

### Next.js JSON-LD 주입 방법
```tsx
// page.tsx에서
export default async function QuestionDetailPage({ params }) {
  const jsonLD = buildQAPageJsonLD(question, answers);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLD) }}
      />
      <main>...</main>
    </>
  );
}
```

### SEO 메타 베이스URL
- `alternates.canonical`은 절대 URL: `https://aijakdang.com/questions/${slug}`
- OG URL도 절대 URL
- 환경변수 `NEXT_PUBLIC_SITE_URL` 사용 권장 (`packages/config`의 env에 추가)

### 접근성 + SEO 통합 (UX-DR-U16)
- H1 1개(질문 제목), H2(답변 섹션), breadcrumb JSON-LD 포함(3.2에서 구현)
- 이미지 alt 필수(content_json 내 이미지 노드에 alt 속성 확인)

### Project Structure Notes
- 신규 파일: `apps/web/lib/seo/qna.ts`, `apps/web/lib/seo/qna.test.ts`, `apps/web/lib/seo/index.ts`(없으면)
- 수정 파일: `apps/web/app/questions/[slug]/page.tsx`, `apps/web/app/questions/page.tsx`

### References
- [Source: epics.md#Story 3.9 AC] QAPage JSON-LD 요구사항
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11.5] QAPage JSON-LD 유형
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11.1] 고유 title/description
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11.9] 저품질/빈 페이지 noindex
- [Source: _bmad-output/project-context.md#SEO] generateMetadata, canonical, JSON-LD, noindex
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR-U16] SEO 떠받치는 UX
- [Source: schema.org/QAPage] https://schema.org/QAPage

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
