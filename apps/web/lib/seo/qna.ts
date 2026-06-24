/**
 * Q&A(묻고답하기) JSON-LD 빌더 — Story 3.9
 *
 * schema.org QAPage 구조화 데이터를 생성한다.
 * Next.js 서버 컴포넌트에서 `<script type="application/ld+json">` 태그로 주입한다.
 *
 * 주입 방법:
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildQAPageJsonLd(question, answers)) }}
 *   />
 */

// ── 입력 타입 ──────────────────────────────────────────────────────────────────

/** QAPage mainEntity(Question) 구성에 필요한 질문 데이터 */
export interface QAPageInput {
  /** 질문 제목 → mainEntity.name */
  title: string;
  /** 질문 본문 평문 (HTML 태그 제거, 150자 이내) → mainEntity.text */
  text: string;
  /** 질문 생성 ISO8601 날짜 → mainEntity.dateCreated */
  dateCreated: string;
  /** 질문 작성자 닉네임 */
  author: { name: string };
  /** 도움된 답변 ID (없으면 null) — acceptedAnswer 분기에 사용 */
  helpfulAnswerId: string | null;
}

/** QAPage Answer(acceptedAnswer/suggestedAnswer) 구성에 필요한 답변 데이터 */
export interface AnswerInput {
  /** 답변 ID — helpfulAnswerId 비교에 사용 */
  id: string;
  /** 답변 본문 평문 (HTML 태그 제거, 150자 이내) */
  text: string;
  /** 답변 생성 ISO8601 날짜 */
  dateCreated: string;
  /** 답변 작성자 닉네임 */
  author: { name: string };
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/** schema.org Answer 객체를 생성한다. */
function buildAnswerNode(answer: AnswerInput) {
  return {
    "@type": "Answer",
    text: answer.text,
    dateCreated: answer.dateCreated,
    author: {
      "@type": "Person",
      name: answer.author.name,
    },
  };
}

// ── 공개 빌더 ─────────────────────────────────────────────────────────────────

/**
 * schema.org QAPage JSON-LD 객체를 생성한다 (순수 함수).
 *
 * - 답변 0개: `acceptedAnswer`·`suggestedAnswer` 키 **생략** (AC #2)
 * - `helpfulAnswerId` 일치 답변 → `acceptedAnswer` (AC #1)
 * - 나머지 공개 답변 → `suggestedAnswer` 배열 (AC #1)
 *
 * @param question - 질문 요약 데이터
 * @param answers  - 공개 답변 목록 (status='published' 필터링된 상태)
 */
export function buildQAPageJsonLd(question: QAPageInput, answers: AnswerInput[]) {
  const mainEntity: Record<string, unknown> = {
    "@type": "Question",
    name: question.title,
    text: question.text,
    answerCount: answers.length,
    dateCreated: question.dateCreated,
    author: {
      "@type": "Person",
      name: question.author.name,
    },
  };

  if (answers.length > 0) {
    // helpfulAnswerId와 일치하는 답변 → acceptedAnswer
    const acceptedAnswer = question.helpfulAnswerId
      ? answers.find((a) => a.id === question.helpfulAnswerId)
      : undefined;

    // 나머지 답변 → suggestedAnswer
    const suggestedAnswers = question.helpfulAnswerId
      ? answers.filter((a) => a.id !== question.helpfulAnswerId)
      : answers;

    if (acceptedAnswer) {
      mainEntity["acceptedAnswer"] = buildAnswerNode(acceptedAnswer);
    }

    if (suggestedAnswers.length > 0) {
      mainEntity["suggestedAnswer"] = suggestedAnswers.map(buildAnswerNode);
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity,
  };
}

// ── stripHtml 유틸 ─────────────────────────────────────────────────────────────

/**
 * HTML 태그를 제거하고 지정 길이로 잘라 평문을 반환한다.
 *
 * contentHtml 이 있는 경우 사용한다.
 * contentJson 만 있는 경우 `generateSummary` 를 사용할 것.
 *
 * @param html   - 입력 HTML 문자열
 * @param maxLen - 최대 문자 수 (기본값: 150)
 */
export function stripHtml(html: string, maxLen = 150): string {
  const text = html
    .replace(/<[^>]+>/g, " ") // 태그 → 공백
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLen ? text.slice(0, maxLen) : text;
}
