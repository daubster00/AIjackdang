import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../monetize.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

const posts = {
  "first-outsourcing-deal": {
    category: "외주·판매 팁",
    title: "AI 결과물로 첫 외주를 따낼 때 가격을 정하는 기준",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,318",
    likes: 187,
    bookmarks: 58,
    comments: 3,
    tags: ["외주", "견적", "협상"],
    body: [
      "AI 결과물로 외주를 시작할 때 가장 어려운 부분이 가격입니다. 너무 낮게 부르면 작업할수록 손해고, 너무 높게 부르면 일을 받기 어렵습니다.",
      "견적은 작업 난이도, 예상 수정 횟수, 납기 압박을 함께 따져 잡는 편이 좋습니다. 결과물의 결과보다 들어가는 시간과 책임을 기준으로 잡아야 흔들리지 않습니다.",
      "협상에서는 최저가를 먼저 깎이지 않도록 수정 범위와 추가 비용 기준을 미리 제시하는 것이 핵심입니다. 처음에 명확히 정하면 분쟁을 크게 줄일 수 있습니다.",
    ],
  },
  "gpt-prompt-store-revenue": {
    category: "수익화 사례",
    title: "프롬프트 묶음을 판매해 한 달 만에 첫 수익을 낸 사례",
    author: "수익화연구소",
    date: "2026.06.15",
    views: "1,904",
    likes: 152,
    bookmarks: 41,
    comments: 2,
    tags: ["프롬프트", "판매", "수익"],
    body: [
      "직접 쓰려고 다듬어 둔 프롬프트가 쌓이자 묶음으로 팔아보기로 했습니다.",
      "특정 업무에 바로 쓰는 실무형 프롬프트가 가장 잘 팔렸고, 사용 예시를 함께 넣으니 구매 전환이 올라갔습니다.",
      "가격은 낮게 시작해 후기가 쌓인 뒤 올렸고, 판매 채널은 익숙한 곳 하나에 집중했습니다.",
    ],
  },
  "client-revision-policy": {
    category: "외주·판매 팁",
    title: "외주 작업에서 무한 수정 요청을 막는 계약 문구 팁",
    author: "프리랜서노트",
    date: "2026.06.12",
    views: "1,366",
    likes: 118,
    bookmarks: 29,
    comments: 1,
    tags: ["계약", "수정", "외주"],
    body: [
      "외주에서 가장 큰 손해는 끝없이 이어지는 수정 요청에서 나옵니다.",
      "계약서에 수정 범위와 횟수를 미리 못 박아두면 분쟁을 크게 줄일 수 있습니다.",
      "추가 수정은 별도 비용이라는 점을 처음부터 명시하면 서로 기준이 분명해집니다.",
    ],
  },
  "ai-design-service-launch": {
    category: "수익화 사례",
    title: "AI 디자인 자동화로 소상공인 상세페이지 서비스를 만든 사례",
    author: "런칭메이커",
    date: "2026.06.10",
    views: "1,072",
    likes: 89,
    bookmarks: 21,
    comments: 1,
    tags: ["디자인", "서비스화", "상세페이지"],
    body: [
      "소상공인 상세페이지 제작은 반복이 많아 AI로 묶기 좋은 작업이었습니다.",
      "공통 양식을 만들고 AI로 초안을 뽑은 뒤 사람이 다듬는 방식으로 단가를 크게 낮췄습니다.",
      "단가를 낮추니 고객 수가 늘었고, 후기가 쌓이면서 안정적인 의뢰로 이어졌습니다.",
    ],
  },
} as const;

const comments = [
  {
    author: "수익화연구소",
    date: "2026.06.18",
    text: "수정 범위를 먼저 정하라는 부분이 제일 와닿네요. 처음에 안 정해서 매번 손해 봤거든요.",
    replies: [
      {
        author: "AI작당 운영팀",
        date: "2026.06.18",
        text: "맞습니다! 수정 범위와 추가 비용 기준만 명확히 해도 분쟁이 확 줄어듭니다. 좋은 피드백 감사해요.",
      },
      {
        author: "프리랜서노트",
        date: "2026.06.18",
        text: "저도 동의해요. 특히 납기까지 견적에 반영하는 습관이 큰 도움이 됐습니다.",
      },
      {
        author: "수익화연구소",
        date: "2026.06.19",
        text: "답변 감사합니다! 이번 견적부터 바로 수정 범위를 문구로 넣어볼게요.",
      },
    ],
  },
  {
    author: "런칭메이커",
    date: "2026.06.18",
    text: "작업 시간과 책임을 기준으로 견적을 잡으라는 말이 가격 정하는 데 큰 도움이 됐습니다.",
    replies: [],
  },
  {
    author: "리뷰메이트",
    date: "2026.06.17",
    text: "추가 수정은 별도 비용이라고 미리 명시하는 팁은 다음 계약에 꼭 써먹어야겠네요.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "AI 수익화 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function MonetizeDetailPage({
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
      <BoardHero menu="monetize" currentSub="외주·판매 팁" />

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
            <Link href="/monetize" className={styles.listButton}>
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
