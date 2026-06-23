import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../vibe-coding.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

const posts = {
  "ai-work-scope": {
    category: "가이드",
    title: "AI에게 일을 맡기기 전에 사람이 정해야 하는 것",
    author: "시작당 운영팀",
    date: "2026.06.18",
    views: "2,418",
    likes: 186,
    bookmarks: 54,
    comments: 3,
    tags: ["ClaudeCode", "요구사항", "검증"],
    body: [
      "AI에게 작업을 맡길 때 가장 먼저 정해야 하는 것은 작업 범위입니다. 무엇을 바꾸고 싶은지보다 무엇을 바꾸면 안 되는지를 먼저 적어두면 결과물을 검토하기 쉬워집니다.",
      "요청서에는 현재 문제, 원하는 결과, 수정 가능한 파일, 완료 기준을 함께 적는 것이 좋습니다. 예를 들어 화면 디자인을 바꾸는 작업이라면 데스크톱과 모바일에서 깨지지 않아야 한다는 조건을 같이 넣어야 합니다.",
      "결과물을 받은 뒤에는 바로 반영하지 말고 빌드, 타입체크, 주요 화면 확인 순서로 검토합니다. 작은 단위로 요청하고 확인하는 흐름이 반복될수록 실패 비용이 줄어듭니다.",
    ],
  },
  "claude-code-checklist": {
    category: "검증",
    title: "Claude Code 결과물을 바로 반영하기 전에 확인할 체크리스트",
    author: "리뷰메이트",
    date: "2026.06.14",
    views: "1,802",
    likes: 142,
    bookmarks: 37,
    comments: 2,
    tags: ["체크리스트", "리뷰", "테스트"],
    body: [
      "Claude Code가 만든 결과물은 먼저 변경 범위부터 확인합니다.",
      "그 다음 타입체크와 빌드를 실행하고 주요 사용자 흐름을 확인합니다.",
      "마지막으로 모바일 화면과 접근성에 영향을 주는 부분을 점검합니다.",
    ],
  },
  "legacy-refactor-flow": {
    category: "리팩터링",
    title: "기존 프로젝트를 단계적으로 개선하는 바이브 코딩 흐름",
    author: "자동화카페",
    date: "2026.06.12",
    views: "1,344",
    likes: 98,
    bookmarks: 26,
    comments: 1,
    tags: ["레거시", "개선", "리팩터링"],
    body: [
      "기존 프로젝트는 한 번에 크게 바꾸기보다 기능 단위로 나누어 개선하는 편이 안전합니다.",
      "현재 동작을 유지해야 하는 부분을 먼저 정리한 뒤 작은 변경부터 요청합니다.",
      "각 단계가 끝날 때마다 빌드와 주요 화면을 확인하면 다음 요청의 기준이 명확해집니다.",
    ],
  },
  "frontend-from-reference": {
    category: "디자인 구현",
    title: "첨부 이미지를 기준으로 프론트엔드 작업을 요청하는 방법",
    author: "프론트라인",
    date: "2026.06.10",
    views: "956",
    likes: 74,
    bookmarks: 18,
    comments: 1,
    tags: ["디자인", "프론트엔드", "반응형"],
    body: [
      "이미지를 기준으로 작업할 때는 유지할 요소와 바꿔도 되는 요소를 나누어 설명해야 합니다.",
      "간격, 카드 모양, 버튼 위치처럼 눈에 보이는 기준과 모바일에서의 순서를 함께 전달합니다.",
      "작업 후에는 실제 화면에서 텍스트가 넘치지 않는지와 버튼을 누를 수 있는지 확인합니다.",
    ],
  },
} as const;

const comments = [
  {
    author: "코드작당러",
    date: "2026.06.18",
    text: "작업 범위와 완료 기준을 같이 적으라는 부분이 제일 도움이 됐습니다.",
    replies: [
      {
        author: "시작당 운영팀",
        date: "2026.06.18",
        text: "맞습니다! 완료 기준이 명확할수록 AI 결과물 검토가 훨씬 수월해집니다. 좋은 피드백 감사해요.",
      },
      {
        author: "프론트라인",
        date: "2026.06.18",
        text: "저도 동의합니다. 특히 '수정하면 안 되는 것'을 먼저 정리하는 방식이 실전에서 정말 유용하더라고요.",
      },
      {
        author: "코드작당러",
        date: "2026.06.19",
        text: "답변 감사해요! 다음 작업에 바로 적용해볼게요.",
      },
    ],
  },
  {
    author: "프론트라인",
    date: "2026.06.18",
    text: "목록으로 돌아가는 동선까지 확인하는 체크를 습관화해야겠네요.",
    replies: [],
  },
  {
    author: "리뷰메이트",
    date: "2026.06.17",
    text: "빌드 전에 변경 범위를 먼저 보는 순서에 동의합니다.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "바이브코딩 가이드 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function VibeCodingDetailPage({
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
      <BoardHero menu="vibe-coding" currentSub="바이브코딩 가이드" />

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
            <Link href="/vibe-coding" className={styles.listButton}>
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
