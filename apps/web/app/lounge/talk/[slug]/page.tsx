import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
// lounge 공통 스타일(상세 레이아웃·댓글·리액션바 등)은 lounge.module.css에서 공유한다.
import styles from "../../lounge.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

/** 수다방 mock 글 상세 데이터 */
const posts = {
  "worldcup-ai-prediction": {
    category: "작당 수다방",
    title: "AI한테 월드컵 우승팀 물어봤더니 진짜 맞췄어요",
    author: "축구덕후",
    date: "2026.06.20",
    views: "2,310",
    likes: 247,
    bookmarks: 83,
    comments: 58,
    tags: ["잡담", "월드컵", "AI비교"],
    body: [
      "GPT, Claude, Gemini 세 모델한테 '이번 월드컵 우승팀 예측해줘'라고 똑같이 물어봤습니다. 각자 다른 팀을 골랐는데, 흥미롭게도 Claude가 고른 팀이 실제로 우승했어요.",
      "GPT는 과거 통계 중심으로 접근했고, Gemini는 최근 폼을 강조했는데, Claude는 '팀워크 시스템과 감독의 전술 적응력'을 근거로 들었습니다. 근거가 제일 설득력 있었어요.",
      "물론 이게 의미 있는 결론인지는 모르겠지만, 각 모델의 추론 방식 차이가 느껴져서 재미있었습니다. 다들 AI한테 스포츠 예측 물어본 경험 있으신가요?",
    ],
  },
  "ai-app-surprise": {
    category: "작당 수다방",
    title: "요즘 제일 신기했던 AI 앱 공유해요",
    author: "식물키우기",
    date: "2026.06.19",
    views: "1,876",
    likes: 193,
    bookmarks: 61,
    comments: 44,
    tags: ["AI앱추천", "잡담", "공유"],
    body: [
      "사진 한 장으로 식물 이름이랑 물 주는 주기, 햇빛 요구량까지 알려주는 앱을 우연히 발견했는데 너무 신기했어요. 화분을 몇 개 키우는데 이름도 몰랐거든요.",
      "앱 이름은 PictureThis인데, 정확도가 생각보다 높아서 놀랐습니다. 주변에서 보이는 식물이나 꽃을 찍으면 바로 식별해줘서 산책할 때도 유용하고요.",
      "여러분이 최근에 신기하다고 느낀 AI 앱이 있으면 같이 공유해요! 별별 분야에 다 쓰이고 있잖아요. 정보 모아서 북마크해두면 좋을 것 같아서요.",
    ],
  },
  "chatgpt-vs-claude-writing": {
    category: "작당 수다방",
    title: "ChatGPT랑 Claude 중에 글 다듬을 때 어느 게 낫나요",
    author: "카피라이터지망",
    date: "2026.06.18",
    views: "1,543",
    likes: 168,
    bookmarks: 52,
    comments: 37,
    tags: ["ChatGPT", "Claude", "비교"],
    body: [
      "회사 이메일이나 공지 문구 교정할 때 두 모델을 번갈아 써보고 있는데, 결과물이 꽤 달라서요. 같은 문장 넣어도 ChatGPT는 좀 더 격식 있게, Claude는 자연스러운 구어체로 바꿔주는 느낌입니다.",
      "저는 개인적으로 Claude 쪽이 더 낫다고 느끼는데, '왜 이렇게 고쳤는지' 설명을 덧붙여줘서 배우는 재미도 있더라고요. 퇴고할 때 의도가 왜곡되지 않는 것도 좋고요.",
      "물론 영어로 쓸 때는 ChatGPT가 더 익숙하게 느껴지기도 해서, 케이스바이케이스인 것 같습니다. 여러분은 어떻게 쓰시나요? 용도에 따라 구분해서 쓰시는 분 있으면 방법 알려주세요.",
    ],
  },
  "ai-cooking-recipe-fail": {
    category: "작당 수다방",
    title: "AI 레시피 믿고 요리했다가 망한 썰",
    author: "요리망한사람",
    date: "2026.06.17",
    views: "1,201",
    likes: 142,
    bookmarks: 38,
    comments: 29,
    tags: ["잡담", "AI레시피", "실패담"],
    body: [
      "냉장고에 있는 재료를 다 입력하고 레시피 달라고 했더니, '두부 + 케첩 + 참치 + 바나나'로 만드는 덮밥 레시피를 줬습니다. 호기롭게 따라 했다가 결과물이... 그냥 쓰레기통으로 직행했어요.",
      "나중에 보니 저도 입력을 너무 대충 했더라고요. '먹을 수 있는 조합인지 먼저 판단해줘'라고 조건을 추가하니까 훨씬 현실적인 레시피를 줬습니다. AI한테도 어떻게 물어보느냐가 중요하네요.",
      "여러분도 AI 믿었다가 실패한 경험 있으면 풀어주세요. 웃프지만 서로 배울 게 있는 것 같아서요. 댓글에 실패 레시피 도전기 환영합니다.",
    ],
  },
  "voice-ai-daily-use": {
    category: "작당 수다방",
    title: "음성 AI 어시스턴트 일상에서 어떻게 쓰세요?",
    author: "드라이버AI",
    date: "2026.06.16",
    views: "988",
    likes: 115,
    bookmarks: 31,
    comments: 22,
    tags: ["음성AI", "일상활용", "공유"],
    body: [
      "운전하면서 두 손을 못 쓸 때 음성으로 일정 추가하고 메모 남기는 게 정말 편해졌어요. 이전에는 신호 기다릴 때 핸드폰 꺼내서 빠르게 입력했는데 이제는 그냥 말로 처리합니다.",
      "제가 주로 쓰는 건 Apple Siri + 메모 앱 연동인데, 최근에는 ChatGPT 음성 모드도 써봤어요. Siri보다 복잡한 질문에 훨씬 잘 대답해줘서 장거리 운전할 때 말동무 겸 활용하고 있습니다.",
      "집에서 요리할 때도 음성으로 타이머 맞추거나 레시피 다음 단계 물어보면 편하더라고요. 여러분은 음성 AI를 어떤 상황에서 주로 쓰세요? 신선한 활용법 있으면 알려주세요.",
    ],
  },
  "ai-image-generation-tips": {
    category: "작당 수다방",
    title: "이미지 생성 AI 프롬프트 팁 모아봤습니다",
    author: "이미지작가",
    date: "2026.06.15",
    views: "872",
    likes: 99,
    bookmarks: 44,
    comments: 18,
    tags: ["이미지생성", "프롬프트", "팁"],
    body: [
      "Midjourney, DALL-E, Stable Diffusion 세 가지를 번갈아 쓰면서 효과 좋았던 프롬프트 패턴을 정리해봤습니다. 공통으로 통하는 게 있고 툴마다 다른 게 있더라고요.",
      "공통으로 효과 좋은 것: 스타일 참고 작가명 명시('in the style of'), 조명 조건 구체적으로 적기('golden hour lighting'), 시점 명시('from above', 'eye level'). 이 세 가지만 추가해도 결과물이 많이 달라집니다.",
      "Midjourney는 '--ar 16:9' 같은 파라미터가 있어서 구도 잡기 편하고, DALL-E는 한국어 프롬프트도 잘 받아줘서 편해요. 여러분 팁도 댓글에 추가해주시면 같이 모아가겠습니다!",
    ],
  },
} as const;

/** mock 댓글 데이터 (수다방 톤) */
const comments = [
  {
    author: "구경꾼",
    date: "2026.06.20",
    text: "오 진짜요? 어떤 모델이 맞췄는지 제일 궁금했는데 본문에 다 있었네요. 재미있는 실험이에요.",
    replies: [
      {
        author: "축구덕후",
        date: "2026.06.20",
        text: "ㅋㅋ 저도 반신반의하면서 했는데 맞추니까 신기하더라고요.",
      },
      {
        author: "AI매니아",
        date: "2026.06.21",
        text: "저도 이런 식으로 여러 모델 비교해보는 거 좋아해요. 다음에 또 공유해주세요!",
      },
    ],
  },
  {
    author: "수다쟁이",
    date: "2026.06.20",
    text: "근거 설명까지 비교해주셔서 좋았어요. 단순 결과만 보는 것보다 훨씬 흥미롭네요.",
    replies: [],
  },
  {
    author: "AI궁금증",
    date: "2026.06.19",
    text: "저도 스포츠 예측 시켜봐야겠다 생각하고 있었어요. 좋은 아이디어 감사합니다.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "작당 수다방 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function LoungeTalkDetailPage({
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
      {/* 히어로: lounge 대메뉴, 현재 서브메뉴 = 작당 수다방 */}
      <BoardHero menu="lounge" currentSub="작당 수다방" />

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

          {/* 좋아요·북마크·공유·신고 반응 바 */}
          <ReactionBar likes={post.likes} bookmarks={post.bookmarks} postId={slug} targetType="post" authorId={null} />

          {/* 댓글 섹션 */}
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

          {/* 하단 네비게이션: 목록으로 / 수정·삭제 */}
          <footer className={styles.detailFooter}>
            <Link href="/lounge/talk" className={styles.listButton}>
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
