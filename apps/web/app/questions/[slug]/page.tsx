import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Badge, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../questions.module.css";
import { QuestionActions } from "./QuestionActions";
import { AnswerForm } from "./AnswerForm";
import { AnswerItem, type Answer } from "./AnswerItem";

type QuestionStatus = "waiting" | "answered" | "solved";

const statusBadge: Record<
  QuestionStatus,
  { label: string; tone: "warning" | "info" | "success" }
> = {
  waiting: { label: "답변대기", tone: "warning" },
  answered: { label: "답변있음", tone: "info" },
  solved: { label: "해결됨", tone: "success" },
};

type Question = {
  status: QuestionStatus;
  title: string;
  author: string;
  date: string;
  views: string;
  likes: number;
  bookmarks: number;
  tags: string[];
  body: string[];
  answers: Answer[];
};

/** 목록 페이지의 slug와 1:1로 맞춘 질문 상세 데이터 */
const questions: Record<string, Question> = {
  "claude-code-php-misunderstanding": {
    status: "waiting",
    title: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
    author: "작당입문러",
    date: "2026.06.18",
    views: "82",
    likes: 4,
    bookmarks: 1,
    tags: ["ClaudeCode", "PHP", "바이브코딩"],
    body: [
      "레거시 PHP 프로젝트를 수정하려는데 Claude Code가 파일 구조를 매번 다르게 해석해서 엉뚱한 곳을 고칩니다.",
      "include/require로 얽혀 있는 구식 구조라서 그런지, 컨트롤러가 어디인지조차 매번 다르게 추측합니다. 어떻게 컨텍스트를 잡아줘야 일관되게 이해할까요?",
      "프로젝트 루트에 간단한 설명 파일을 두면 도움이 될까요? 예시가 있으면 좋겠습니다.",
    ],
    answers: [],
  },
  "n8n-gmail-auto-classify": {
    status: "solved",
    title: "n8n으로 Gmail 문의를 자동 분류할 수 있을까요?",
    author: "자동화카페",
    date: "2026.06.15",
    views: "146",
    likes: 21,
    bookmarks: 8,
    tags: ["n8n", "Gmail", "자동화"],
    body: [
      "하루 수십 건 들어오는 고객 문의를 카테고리별로 나눠서 라벨링하고 싶습니다.",
      "n8n만으로 가능한지, 아니면 별도 AI 노드가 필요한지 궁금합니다. 분류 기준은 환불 / 배송 / 기타 정도로 단순합니다.",
    ],
    answers: [
      {
        id: "a1",
        author: "리뷰메이트",
        level: "고수",
        date: "2026.06.15",
        votes: 14,
        accepted: true,
        body: [
          "결론부터 말하면 n8n만으로 충분히 가능합니다. Gmail Trigger 노드로 새 메일을 받고, 본문을 AI 노드(OpenAI/Claude)로 보내 카테고리 한 단어만 반환하게 하세요.",
          "프롬프트는 \"다음 문의를 환불/배송/기타 중 하나로만 답하라\"처럼 출력을 강하게 제한하는 게 핵심입니다. 그래야 Switch 노드에서 분기하기 쉽습니다.",
          "마지막에 Gmail 노드의 Add Label 동작으로 분류 결과 라벨을 붙이면 끝입니다. 분류 기준이 단순해서 토큰 비용도 거의 안 듭니다.",
        ],
        comments: [
          { author: "자동화카페", date: "2026.06.15", text: "Switch 노드로 분기하는 부분이 딱 막혔던 지점이었어요. 감사합니다!" },
        ],
      },
      {
        id: "a2",
        author: "프론트라인",
        level: "실전러",
        date: "2026.06.15",
        votes: 5,
        body: [
          "AI 노드 없이 키워드 규칙만으로도 1차 분류는 가능합니다. '환불', '취소' 같은 단어를 IF 노드로 거르면 비용 0원으로 70% 정도는 잡힙니다.",
          "정확도를 더 올리고 싶을 때만 AI 노드를 얹는 단계적 접근을 추천합니다.",
        ],
      },
    ],
  },
  "automation-outsourcing-quote": {
    status: "answered",
    title: "AI 자동화 외주 견적은 얼마가 적당할까요?",
    author: "프리랜서비",
    date: "2026.06.14",
    views: "318",
    likes: 37,
    bookmarks: 19,
    tags: ["수익화", "외주", "견적"],
    body: [
      "소규모 사업장 대상으로 n8n + GPT 자동화를 구축해주는 외주를 시작하려는데, 첫 견적 기준을 어떻게 잡아야 할지 감이 안 옵니다.",
      "워크플로우 1개당 단가로 받아야 할지, 시간제로 받아야 할지 고민입니다. 경험 있으신 분들의 기준이 궁금합니다.",
    ],
    answers: [
      {
        id: "a1",
        author: "자동화카페",
        level: "마스터",
        date: "2026.06.14",
        votes: 9,
        body: [
          "초기에는 워크플로우 단위 + 유지보수 월정액 조합을 추천합니다. 구축 비용은 노드 개수와 연동 서비스 수로 산정하고, 운영은 별도 월 구독으로 받는 구조입니다.",
          "단순 자동화 1건 30~60만 원, 복잡한 다단계 연동은 100만 원 이상으로 시작하는 경우가 많습니다. 첫 고객은 약간 낮게 받되 후기를 꼭 확보하세요.",
        ],
      },
    ],
  },
  "which-ai-tool-for-beginner": {
    status: "answered",
    title: "비개발자인데 어떤 AI 코딩 툴부터 써야 할까요?",
    author: "기획하는사람",
    date: "2026.06.13",
    views: "204",
    likes: 15,
    bookmarks: 6,
    tags: ["Cursor", "ClaudeCode", "입문"],
    body: [
      "Cursor, Claude Code, Windsurf 중에 고민입니다.",
      "코딩 경험이 거의 없는 기획자가 시작하기에 가장 부담 없는 도구가 궁금합니다.",
    ],
    answers: [
      {
        id: "a1",
        author: "코드작당러",
        level: "작당원",
        date: "2026.06.13",
        votes: 6,
        body: [
          "비개발자라면 채팅으로 대화하듯 쓸 수 있는 도구가 진입장벽이 낮습니다. 처음에는 결과를 바로 눈으로 확인할 수 있는 환경에서 작게 시작해보세요.",
          "툴 선택보다 중요한 건 '한 번에 하나씩' 요청하는 습관입니다. 어떤 도구든 작은 단위로 요청하고 확인하는 흐름이 익으면 갈아타기도 쉽습니다.",
        ],
      },
    ],
  },
  "prompt-structure-tips": {
    status: "answered",
    title: "프롬프트를 어떻게 짜야 답변 품질이 올라가나요?",
    author: "작당탐험가",
    date: "2026.06.16",
    views: "263",
    likes: 19,
    bookmarks: 11,
    tags: ["프롬프트", "품질", "팁"],
    body: [
      "같은 질문을 해도 어떤 날은 좋은 답이 나오고, 어떤 날은 엉뚱한 답이 나옵니다.",
      "프롬프트를 더 잘 짜는 일반적인 원칙이 있을까요? 특히 코딩 작업을 시킬 때 결과 편차가 커서 고민입니다.",
    ],
    answers: [
      {
        id: "a1",
        author: "리뷰메이트",
        level: "고수",
        date: "2026.06.16",
        votes: 12,
        body: [
          "결과 편차의 대부분은 맥락 부족에서 옵니다. ① 무엇을 만드는지(목표), ② 어떤 제약이 있는지(바꾸면 안 되는 것), ③ 어떤 형식으로 답해야 하는지(출력 형식)를 항상 같이 적어주세요.",
          "특히 코딩은 \"어떤 파일을 수정 가능하고, 무엇을 건드리면 안 되는지\"를 명시하면 엉뚱한 곳을 고치는 일이 확 줄어듭니다.",
        ],
        comments: [
          { author: "작당탐험가", date: "2026.06.16", text: "출력 형식을 같이 적는다는 게 핵심이었네요. 바로 적용해볼게요!" },
        ],
      },
      {
        id: "a2",
        author: "자동화카페",
        level: "마스터",
        date: "2026.06.16",
        votes: 8,
        body: [
          "예시를 1~2개 같이 주는 것만으로도 품질이 크게 올라갑니다. \"이런 입력이면 이런 출력\"을 보여주면 모델이 형식과 톤을 훨씬 안정적으로 따라옵니다.",
        ],
      },
      {
        id: "a3",
        author: "프론트라인",
        level: "실전러",
        date: "2026.06.16",
        votes: 5,
        body: [
          "한 프롬프트에 여러 가지를 동시에 요구하면 품질이 떨어집니다. 큰 작업은 작은 단위로 쪼개서 한 번에 하나씩 요청하고, 중간 결과를 확인한 뒤 다음으로 넘어가는 게 가장 안정적이었습니다.",
        ],
        comments: [
          { author: "기획하는사람", date: "2026.06.17", text: "쪼개서 요청하니 확실히 헛도는 일이 줄었어요." },
        ],
      },
      {
        id: "a4",
        author: "코드작당러",
        level: "작당원",
        date: "2026.06.17",
        votes: 2,
        body: [
          "마지막에 \"근거나 확인 방법도 같이 알려줘\"를 붙이면 검증하기 쉬운 답이 옵니다. 답만 받는 것보다 검토 비용이 훨씬 줄어듭니다.",
        ],
      },
    ],
  },
  "service-direction-review": {
    status: "waiting",
    title: "제가 만든 서비스 방향, 이대로 괜찮을까요?",
    author: "사이드프로젝트",
    date: "2026.06.12",
    views: "97",
    likes: 6,
    bookmarks: 2,
    tags: ["방향성", "기획", "피드백"],
    body: [
      "AI로 회의록을 요약해주는 서비스를 만들고 있는데 비슷한 게 이미 많아서 방향이 맞는지 모르겠습니다.",
      "차별점을 어디서 찾아야 할지 의견 부탁드립니다.",
    ],
    answers: [],
  },
};

export function generateStaticParams() {
  return Object.keys(questions).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const question = questions[slug];
  return {
    title: question ? `${question.title} — 묻고답하기` : "묻고답하기",
  };
}

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const question = questions[slug];

  if (!question) {
    notFound();
  }

  const badge = statusBadge[question.status];
  const answerCount = question.answers.length;
  const hasAccepted = question.answers.some((a) => a.accepted);
  // 데모에서는 현재 보는 사람을 질문 작성자로 가정해 채택 동선을 보여준다.
  const isAsker = true;

  return (
    <main id="main" className={styles.page}>
      {/* 묻고답하기 대메뉴 공통 히어로 (대메뉴당 1개, 하위 페이지 공유) */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      <div className={styles.detailLayout}>
        <nav className={styles.breadcrumbBack} aria-label="현재 위치">
          <Link href="/questions">
            <Icon name="arrow-left-line" />
            묻고답하기 목록
          </Link>
        </nav>

        {/* ── 질문 본문 ── */}
        <article className={styles.questionDetail}>
          <header className={styles.detailHeader}>
            <div className={styles.detailTopRow}>
              <Badge className={styles.detailStatusBadge} tone={badge.tone}>
                {badge.label}
              </Badge>
              <div className={styles.detailTagRow}>
                {question.tags.map((tag) => (
                  <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                    #{tag}
                  </Tag>
                ))}
              </div>
            </div>

            <h1 className={styles.detailTitle}>{question.title}</h1>

            <div className={styles.detailMeta}>
              <span className={styles.detailAuthor}>
                <Avatar name={question.author} size="sm" />
                <AuthorName name={question.author} />
              </span>
              <span className={styles.metaDivider} aria-hidden="true">|</span>
              <span>{question.date}</span>
              <span className={styles.metaDivider} aria-hidden="true">|</span>
              <span>
                <Icon name="eye-line" />
                조회 {question.views}
              </span>
              <span>
                <Icon name="chat-1-line" />
                답변 {answerCount}
              </span>
            </div>
          </header>

          <div className={styles.articleBody}>
            {question.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <AttachmentList />
          </div>

          <QuestionActions questionId={slug} />
        </article>

        {/* ── 답변 영역 ── */}
        <section className={styles.answerSection} aria-labelledby="answer-title">
          <div className={styles.answerSectionHead}>
            <h2 id="answer-title">
              답변 <strong>{answerCount}</strong>
            </h2>
            {answerCount > 1 && (
              <div className={styles.answerSort} role="group" aria-label="답변 정렬">
                <button type="button" aria-pressed="true">추천순</button>
                <button type="button" aria-pressed="false">최신순</button>
              </div>
            )}
          </div>

          {answerCount === 0 ? (
            <div className={styles.answerEmpty}>
              <Icon name="chat-smile-2-line" />
              <p>아직 답변이 없습니다.</p>
              <span>첫 번째 답변을 남겨 질문자에게 도움을 줘보세요.</span>
            </div>
          ) : (
            <div className={styles.answerList}>
              {question.answers.map((answer) => (
                <AnswerItem
                  key={answer.id}
                  answer={answer}
                  canAccept={isAsker}
                  hasAccepted={hasAccepted}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── 답변 작성 ── */}
        <section className={styles.answerWriteSection} aria-labelledby="answer-write-title">
          <h2 id="answer-write-title" className={styles.answerWriteTitle}>
            <Icon name="quill-pen-line" />
            답변 작성하기
          </h2>
          <AnswerForm />
        </section>

        {/* ── 하단 동선 ── */}
        <footer className={styles.detailFooter}>
          <Link href="/questions" className={styles.listButton}>
            <Icon name="list-check" />
            목록으로
          </Link>
          <div className={styles.ownerActions}>
            <button type="button">
              <Icon name="edit-2-line" />
              수정
            </button>
            <button type="button">
              <Icon name="delete-bin-line" />
              삭제
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
