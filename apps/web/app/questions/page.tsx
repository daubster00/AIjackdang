import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Badge, Button, Icon, Tag } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import styles from "./questions.module.css";

export const metadata: Metadata = {
  title: "묻고답하기",
  description: "AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간",
};

/** 상태 필터: 기획 확정값(답변대기 / 답변있음 / 해결됨) + 전체 / 인기질문 */
const statusFilters = [
  { value: "all", label: "전체" },
  { value: "waiting", label: "답변대기" },
  { value: "answered", label: "답변있음" },
  { value: "solved", label: "해결됨" },
  { value: "popular", label: "인기질문" },
] as const;

type QuestionStatus = "waiting" | "answered" | "solved";

/** 상태값 → 배지 표현 매핑 (색 단독 전달 금지 규칙에 따라 라벨 동반) */
const statusBadge: Record<
  QuestionStatus,
  { label: string; tone: "warning" | "info" | "success" }
> = {
  waiting: { label: "답변대기", tone: "warning" },
  answered: { label: "답변있음", tone: "info" },
  solved: { label: "해결됨", tone: "success" },
};

const questions: {
  slug: string;
  status: QuestionStatus;
  title: string;
  excerpt: string;
  tags: string[];
  author: string;
  date: string;
  views: string;
  answers: number;
  likes: number;
  isNew?: boolean;
}[] = [
  {
    slug: "claude-code-php-misunderstanding",
    status: "waiting",
    title: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
    excerpt:
      "레거시 PHP 프로젝트를 수정하려는데 파일 구조를 매번 다르게 해석해서 엉뚱한 곳을 고칩니다. 컨텍스트를 어떻게 잡아줘야 할까요?",
    tags: ["ClaudeCode", "PHP", "바이브코딩"],
    author: "작당입문러",
    date: "2026.06.18",
    views: "82",
    answers: 0,
    likes: 4,
    isNew: true,
  },
  {
    slug: "n8n-gmail-auto-classify",
    status: "solved",
    title: "n8n으로 Gmail 문의를 자동 분류할 수 있을까요?",
    excerpt:
      "하루 수십 건 들어오는 고객 문의를 카테고리별로 나눠서 라벨링하고 싶습니다. n8n만으로 가능한지, 아니면 별도 AI 노드가 필요한지 궁금합니다.",
    tags: ["n8n", "Gmail", "자동화"],
    author: "자동화카페",
    date: "2026.06.15",
    views: "146",
    answers: 3,
    likes: 21,
  },
  {
    slug: "automation-outsourcing-quote",
    status: "answered",
    title: "AI 자동화 외주 견적은 얼마가 적당할까요?",
    excerpt:
      "소규모 사업장 대상으로 n8n + GPT 자동화를 구축해주는 외주를 시작하려는데, 첫 견적 기준을 어떻게 잡아야 할지 감이 안 옵니다.",
    tags: ["수익화", "외주", "견적"],
    author: "프리랜서비",
    date: "2026.06.14",
    views: "318",
    answers: 5,
    likes: 37,
  },
  {
    slug: "which-ai-tool-for-beginner",
    status: "answered",
    title: "비개발자인데 어떤 AI 코딩 툴부터 써야 할까요?",
    excerpt:
      "Cursor, Claude Code, Windsurf 중에 고민입니다. 코딩 경험이 거의 없는 기획자가 시작하기에 가장 부담 없는 도구가 궁금합니다.",
    tags: ["Cursor", "ClaudeCode", "입문"],
    author: "기획하는사람",
    date: "2026.06.13",
    views: "204",
    answers: 2,
    likes: 15,
  },
  {
    slug: "prompt-structure-tips",
    status: "answered",
    title: "프롬프트를 어떻게 짜야 답변 품질이 올라가나요?",
    excerpt:
      "같은 질문을 해도 답변 품질 편차가 큽니다. 특히 코딩 작업을 시킬 때 프롬프트를 더 잘 짜는 일반적인 원칙이 있을까요?",
    tags: ["프롬프트", "품질", "팁"],
    author: "작당탐험가",
    date: "2026.06.16",
    views: "263",
    answers: 4,
    likes: 19,
  },
  {
    slug: "service-direction-review",
    status: "waiting",
    title: "제가 만든 서비스 방향, 이대로 괜찮을까요?",
    excerpt:
      "AI로 회의록을 요약해주는 서비스를 만들고 있는데 비슷한 게 이미 많아서 방향이 맞는지 모르겠습니다. 차별점에 대한 의견 부탁드립니다.",
    tags: ["방향성", "기획", "피드백"],
    author: "사이드프로젝트",
    date: "2026.06.12",
    views: "97",
    answers: 0,
    likes: 6,
    isNew: true,
  },
];

/** 사이드바: 최근 본 글 (질문 목록 상위 4개 재사용) */
const recentPosts = questions.slice(0, 4).map((q) => ({
  href: `/questions/${q.slug}`,
  board: "묻고답하기",
  title: q.title,
}));

/** 사이드바: 작당 랭킹 */
const userRankings = [
  { rank: 1, nickname: "자동화카페", tier: "master" },
  { rank: 2, nickname: "리뷰메이트", tier: "expert" },
  { rank: 3, nickname: "프론트라인", tier: "practitioner" },
  { rank: 4, nickname: "코드작당러", tier: "member" },
];

export default function QuestionsPage() {
  return (
    <main id="main" className={styles.page}>
      {/* 묻고답하기 대메뉴 공통 히어로 (대메뉴당 1개, 하위 페이지 공유) */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      <section className={styles.toolbar} aria-label="질문 상태 필터 및 검색">
        <div className={styles.filterGroup} role="group" aria-label="상태 필터">
          {statusFilters.map((filter, index) => (
            <button
              key={filter.value}
              type="button"
              className={styles.filterChip}
              aria-pressed={index === 0}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <SearchAutocomplete
          label="질문 검색"
          placeholder="질문 검색"
          popularTags={["ClaudeCode", "n8n", "자동화", "Cursor", "수익화", "프롬프트"]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 312개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>답변대기 24개</span>
          </div>
          <Link href="/questions/write">
            <Button
              className={styles.askButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              질문하기
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          <section className={styles.questionList} aria-label="질문 목록">
            {questions.map((q) => {
              const badge = statusBadge[q.status];
              return (
                <article key={q.slug} className={styles.questionItem}>
                  {/* 답변 수를 강조하는 좌측 카운트 블록 (Q&A 목록은 답변 수 표시가 핵심) */}
                  <div
                    className={`${styles.answerCount} ${q.answers > 0 ? styles.answerCountActive : ""}`}
                    aria-label={`답변 ${q.answers}개`}
                  >
                    <strong>{q.answers}</strong>
                    <span>답변</span>
                  </div>

                  <div className={styles.questionBody}>
                    <div className={styles.questionTop}>
                      <Badge className={styles.statusBadge} tone={badge.tone}>
                        {badge.label}
                      </Badge>
                      <div className={styles.tagRow}>
                        {q.tags.map((tag) => (
                          <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                            #{tag}
                          </Tag>
                        ))}
                      </div>
                    </div>

                    <h3 className={styles.questionHeading}>
                      <Link href={`/questions/${q.slug}`} className={styles.questionTitle}>
                        {q.title}
                      </Link>
                      {q.isNew ? (
                        <span className={styles.newDot} aria-label="새 질문">
                          N
                        </span>
                      ) : null}
                    </h3>

                    <p className={styles.questionExcerpt}>{q.excerpt}</p>

                    <div className={styles.questionFooter}>
                      <div className={styles.questionAuthor}>
                        <Avatar name={q.author} size="sm" />
                        <AuthorName name={q.author} className={styles.authorName} />
                        <span className={styles.footerDivider} aria-hidden="true">
                          |
                        </span>
                        <span className={styles.questionDate}>{q.date}</span>
                      </div>
                      <div className={styles.questionStats} aria-label="질문 정보">
                        <span>
                          <Icon name="eye-line" />
                          {q.views}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <nav className={styles.pagination} aria-label="페이지 이동">
            <button type="button" aria-label="이전 페이지">
              <Icon name="arrow-left-s-line" />
            </button>
            <button type="button" aria-current="page">
              1
            </button>
            <button type="button">2</button>
            <button type="button">3</button>
            <button type="button" aria-label="다음 페이지">
              <Icon name="arrow-right-s-line" />
            </button>
          </nav>
        </div>

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel="질문 보조 정보"
        />
      </div>
    </main>
  );
}
