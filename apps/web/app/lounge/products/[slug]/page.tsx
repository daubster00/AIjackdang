import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../../lounge.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

const posts = {
  "fridge-recipe-app": {
    category: "내가 만든 AI 제품",
    title: "냉장고 사진 한 장으로 레시피를 짜주는 앱을 출시했습니다",
    author: "주말개발자",
    date: "2026.06.18",
    views: "1,640",
    likes: 182,
    bookmarks: 54,
    comments: 27,
    tags: ["사이드프로젝트", "레시피", "출시"],
    body: [
      "냉장고 문을 열고 '오늘 뭐 해 먹지' 고민하던 시간을 줄여보고 싶어 만든 앱입니다. 냉장고 사진을 한 장 찍으면 재료를 인식해 바로 만들 수 있는 메뉴를 추천해줍니다.",
      "처음에는 재료를 일일이 텍스트로 입력받았는데, 사진 인식을 붙이고 나서 사용 흐름이 확 매끄러워졌습니다. 인식한 재료 중 빠진 게 있으면 손으로 더하거나 빼고, 그 결과로 레시피를 다시 받습니다.",
      "추천된 메뉴를 고르면 부족한 재료를 모아 장보기 리스트까지 만들어줍니다. 거창하진 않지만 매일 저녁마다 직접 쓰고 있다는 게 가장 뿌듯합니다. 비슷한 사이드 프로젝트 하시는 분들 의견 환영합니다.",
    ],
  },
  "meeting-note-bot": {
    category: "내가 만든 AI 제품",
    title: "회의 녹음을 자동으로 정리해주는 노트 봇을 만들어 씁니다",
    author: "기록하는사람",
    date: "2026.06.15",
    views: "1,208",
    likes: 134,
    bookmarks: 41,
    comments: 19,
    tags: ["회의록", "STT", "생산성"],
    body: [
      "회의가 끝나고 나면 누가 무엇을 하기로 했는지 정리하는 데 매번 시간이 걸려 만든 도구입니다. 녹음 파일을 올리면 음성을 텍스트로 바꾸고 화자별로 발언을 나눠줍니다.",
      "단순 받아쓰기에서 멈추지 않고, 결정된 사항과 할 일을 따로 뽑아 담당자와 함께 목록으로 정리해주는 부분에 가장 공을 들였습니다. 회의 직후 바로 공유할 수 있어 편합니다.",
      "작은 팀에서 직접 쓰면서 부족한 부분을 조금씩 다듬는 중입니다. 화자 구분 정확도를 더 높이는 게 다음 과제인데, 비슷한 고민 해보신 분 계시면 조언 부탁드려요.",
    ],
  },
  "study-quiz-maker": {
    category: "내가 만든 AI 제품",
    title: "PDF를 넣으면 시험 문제를 만들어주는 학습 도구를 공개해요",
    author: "공부하는AI",
    date: "2026.06.12",
    views: "972",
    likes: 101,
    bookmarks: 33,
    comments: 14,
    tags: ["학습", "퀴즈생성", "교육"],
    body: [
      "혼자 공부할 때 스스로 문제를 내기가 어려워서 만든 학습 도구입니다. 강의 자료나 교재 PDF를 업로드하면 핵심 개념을 추려 객관식과 단답형 문제로 바꿔줍니다.",
      "단순히 문장을 빈칸으로 만드는 수준을 넘어, 개념을 이해했는지 묻는 문제가 나오도록 다듬는 데 시간을 많이 썼습니다. 틀린 문제는 따로 모아 복습 퀴즈로 다시 풀 수 있습니다.",
      "처음엔 제 시험 준비용으로 만들었는데, 같이 공부하는 분들 반응이 좋아 이렇게 공개합니다. 어떤 과목에서 잘 통하고 어디서 약한지 피드백을 모으고 있어요.",
    ],
  },
  "shop-review-summarizer": {
    category: "내가 만든 AI 제품",
    title: "쇼핑몰 리뷰를 한눈에 요약해주는 크롬 확장을 만들었습니다",
    author: "확장만드는사람",
    date: "2026.06.10",
    views: "845",
    likes: 88,
    bookmarks: 27,
    comments: 11,
    tags: ["크롬확장", "리뷰요약", "쇼핑"],
    body: [
      "물건 하나 사려고 리뷰 수백 개를 스크롤하던 게 답답해서 만든 크롬 확장 프로그램입니다. 상품 페이지에서 버튼을 누르면 리뷰를 모아 장점과 단점으로 정리해 보여줍니다.",
      "별점만으로는 알기 어려운 '실제로 자주 언급되는 불만'을 뽑아주는 데 초점을 맞췄습니다. 사이즈, 배송, 내구성처럼 항목별로 묶어주니 구매 결정이 한결 빨라졌습니다.",
      "설치형으로 직접 배포하면서 권한 설정과 페이지별 구조 차이 때문에 고생을 많이 했습니다. 확장 프로그램 처음 만드시는 분들께 도움이 될 만한 시행착오를 댓글로 풀어볼게요.",
    ],
  },
} as const;

const comments = [
  {
    author: "주말개발자",
    date: "2026.06.18",
    text: "혼자 쓰려고 만든 도구를 이렇게 공개해주셔서 감사해요. 사용 흐름 정리한 부분이 특히 도움이 됐습니다.",
    replies: [
      {
        author: "기록하는사람",
        date: "2026.06.18",
        text: "맞아요, 작게 시작해서 매일 쓰는 제품으로 다듬는 과정이 인상적이었어요.",
      },
      {
        author: "공부하는AI",
        date: "2026.06.18",
        text: "저도 비슷하게 학습 도구를 만들고 있는데, 입력 방식 고민이 제일 컸거든요. 참고 많이 됐습니다.",
      },
      {
        author: "주말개발자",
        date: "2026.06.19",
        text: "다들 같은 데서 고생하시는군요. 다음 글에 시행착오 더 풀어볼게요!",
      },
    ],
  },
  {
    author: "확장만드는사람",
    date: "2026.06.18",
    text: "직접 배포까지 해보신 경험이 귀하네요. 권한 설정 관련해서 따로 글 한 번 부탁드려요!",
    replies: [],
  },
  {
    author: "리뷰메이트",
    date: "2026.06.17",
    text: "완성해서 매일 쓰고 있다는 말이 가장 멋집니다. 응원할게요.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "내가 만든 AI 제품 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function LoungeProductDetailPage({
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
      <BoardHero menu="lounge" currentSub="내가 만든 AI 제품" />

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
            <Link href="/lounge/products" className={styles.listButton}>
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
