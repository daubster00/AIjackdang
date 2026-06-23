import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../automation.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

const posts = {
  "first-automation-tools": {
    category: "자동화 가이드",
    title: "처음 자동화를 시작할 때 고르면 좋은 도구 정리",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,041",
    likes: 168,
    bookmarks: 51,
    comments: 3,
    tags: ["n8n", "Make", "Zapier"],
    body: [
      "자동화를 처음 시작할 때는 도구를 고르기보다 어떤 작업을 자동화할지 먼저 정하는 편이 좋습니다. 매일 반복하는 일 가운데 손이 가장 많이 가는 작업부터 적어보면 시작점이 보입니다.",
      "도구는 작업 규모와 예산을 기준으로 고릅니다. 가벼운 연결은 Zapier, 분기와 데이터 가공이 많으면 Make, 직접 서버에 두고 자유롭게 쓰려면 n8n이 잘 맞습니다.",
      "처음부터 큰 워크플로를 만들기보다 한 단계짜리 자동화를 완성해보는 것이 중요합니다. 작은 성공을 쌓아야 다음 단계를 안정적으로 붙일 수 있습니다.",
    ],
  },
  "email-summary-workflow": {
    category: "자동화 사례",
    title: "매일 쌓이는 메일을 AI가 요약해 슬랙으로 보내준 사례",
    author: "자동화카페",
    date: "2026.06.15",
    views: "1,627",
    likes: 131,
    bookmarks: 34,
    comments: 2,
    tags: ["메일", "요약", "Slack"],
    body: [
      "받은 메일이 너무 많아 중요한 내용을 놓치는 문제를 자동화로 해결했습니다.",
      "메일을 가져와 AI로 핵심만 요약하고, 분류 결과에 따라 팀 슬랙 채널로 전달하도록 구성했습니다.",
      "요약 길이와 분류 기준을 몇 번 다듬으니 매일 아침 확인 시간이 크게 줄었습니다.",
    ],
  },
  "trigger-design-tip": {
    category: "자동화 팁",
    title: "자동화가 자꾸 꼬일 때 트리거부터 다시 보는 팁",
    author: "워크플로마스터",
    date: "2026.06.12",
    views: "1,208",
    likes: 96,
    bookmarks: 22,
    comments: 1,
    tags: ["트리거", "디버깅", "워크플로"],
    body: [
      "자동화가 중복 실행되거나 누락된다면 대부분 트리거 설계 문제입니다.",
      "실행 조건과 트리거 시점을 분리해서 적어보면 어디서 꼬이는지 금방 드러납니다.",
      "트리거를 손본 뒤에는 소량 데이터로 먼저 테스트하고 전체에 적용하는 순서를 권합니다.",
    ],
  },
  "sheet-to-report": {
    category: "자동화 사례",
    title: "스프레드시트 데이터를 주간 리포트로 자동 변환하기",
    author: "데이터정리러",
    date: "2026.06.10",
    views: "934",
    likes: 71,
    bookmarks: 17,
    comments: 1,
    tags: ["스프레드시트", "리포트", "자동발송"],
    body: [
      "여러 시트에 흩어진 데이터를 매주 손으로 정리하던 작업을 자동화했습니다.",
      "데이터를 모아 정해진 양식으로 가공하고, 정해진 시간에 리포트를 자동 발송하도록 구성했습니다.",
      "양식을 고정해두니 매주 같은 품질의 리포트가 안정적으로 나옵니다.",
    ],
  },
} as const;

const comments = [
  {
    author: "워크플로마스터",
    date: "2026.06.18",
    text: "작은 자동화부터 완성해보라는 부분이 제일 와닿네요. 처음부터 욕심내다 매번 멈췄거든요.",
    replies: [
      {
        author: "AI작당 운영팀",
        date: "2026.06.18",
        text: "맞습니다! 한 단계짜리부터 안정화한 뒤 붙이면 실패 비용이 확 줄어듭니다. 좋은 피드백 감사해요.",
      },
      {
        author: "자동화카페",
        date: "2026.06.18",
        text: "저도 동의해요. 특히 어떤 작업을 자동화할지 먼저 적어보는 습관이 큰 도움이 됐습니다.",
      },
      {
        author: "워크플로마스터",
        date: "2026.06.19",
        text: "답변 감사합니다! 이번 주에 바로 한 단계 자동화부터 만들어볼게요.",
      },
    ],
  },
  {
    author: "데이터정리러",
    date: "2026.06.18",
    text: "도구별로 예산과 규모 기준을 나눠준 게 선택하는 데 큰 도움이 됐습니다.",
    replies: [],
  },
  {
    author: "리뷰메이트",
    date: "2026.06.17",
    text: "트리거 시점을 분리해서 적어보라는 팁은 디버깅할 때 꼭 써먹어야겠네요.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "AI 자동화 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts[slug as PostSlug];

  if (!post) {
    notFound();
  }

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="automation" currentSub="자동화 가이드" />

      <div className={styles.detailLayout}>
        <article className={styles.postDetail}>
          <header className={styles.detailHeader}>
            <div className={styles.detailCategoryRow}>
              <div className={styles.tagRow}>
                {post.tags.map((tag) => (
                  <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                    #{tag}
                  </Tag>
                ))}
              </div>
            </div>
            <h2>{post.title}</h2>
            <div className={styles.detailMeta}>
              <AuthorName name={post.author} />
              <span>{post.date}</span>
              <span>조회 {post.views}</span>
              <span>댓글 {post.comments}</span>
              <span>좋아요 {post.likes}</span>
            </div>
          </header>

          <div className={styles.articleBody}>
            {post.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <AttachmentList />
          </div>

          <ReactionBar likes={post.likes} bookmarks={post.bookmarks} />

          <section className={styles.commentSection} aria-labelledby="comment-title">
            <div className={styles.commentHeader}>
              <h3 id="comment-title">댓글 {post.comments}</h3>
            </div>

            <CommentForm />

            <div className={styles.commentList}>
              {comments.map((comment) => (
                <CommentItem key={`${comment.author}-${comment.date}`} comment={comment} />
              ))}
            </div>
            <button type="button" className={styles.commentLoadMore}>
              <Icon name="arrow-down-s-line" />
              댓글 더보기
            </button>
          </section>

          <footer className={styles.detailFooter}>
            <Link href="/automation" className={styles.listButton}>
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
        </article>
      </div>
    </main>
  );
}
