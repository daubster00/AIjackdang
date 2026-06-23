import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero } from "@/components/board";
import styles from "../lounge.module.css";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";
import { CreativeSpecPanel, type CreativeSpec } from "./CreativeSpecPanel";

/**
 * 작당 라운지 글 상세 페이지.
 * 창작 스펙(creativeSpec)이 있는 글은 본문 우측에 CreativeSpecPanel을 표시한다.
 * 스펙 없는 글은 기존 단일 컬럼 레이아웃(.detailLayout)을 그대로 유지한다.
 *
 * mock 검수용: 스펙 있는 slug = "ai-webtoon-series", "ai-music-album"
 *              스펙 없는 slug = "my-recipe-app", "diary-summary-bot"
 */

const posts: Record<
  string,
  {
    category: string;
    title: string;
    author: string;
    date: string;
    views: string;
    likes: number;
    bookmarks: number;
    comments: number;
    tags: string[];
    body: string[];
    creativeSpec?: CreativeSpec;
  }
> = {
  "ai-webtoon-series": {
    category: "AI 창작마당",
    title: "주말마다 AI로 그린 단편 웹툰 시리즈를 공유합니다",
    author: "그림덕후",
    date: "2026.06.18",
    views: "1,872",
    likes: 204,
    bookmarks: 63,
    comments: 3,
    tags: ["웹툰", "이미지생성", "창작"],
    body: [
      "주말마다 한 편씩 그리던 단편 웹툰이 어느새 시리즈가 됐습니다. 스토리는 직접 짜고, 작화만 이미지 생성 AI의 도움을 받았습니다.",
      "가장 어려웠던 건 캐릭터 일관성이었습니다. 같은 인물을 여러 컷에 그리려면 레퍼런스 이미지를 고정하고 프롬프트에 특징을 매번 반복해 적는 편이 잘 맞았습니다.",
      "완벽하진 않지만 혼자 즐기던 이야기를 그림까지 붙여 공유할 수 있다는 게 즐겁습니다. 가볍게 봐주시고 피드백 주시면 감사하겠습니다.",
    ],
    // 창작 스펙 있는 글 — 검수 시 우측 패널 노출 확인
    creativeSpec: {
      types: ["이미지"],
      tools: [
        { name: "Midjourney", model: "v6.1", role: "패널 일러스트" },
        { name: "Adobe Firefly", model: "Image 3", role: "배경 합성" },
        { name: "Topaz Photo AI", role: "업스케일" },
      ],
      prompt:
        "webtoon style, Korean manhwa, single character, fantasy setting, soft lighting, detailed lineart, --ar 3:4 --style raw",
      negPrompt:
        "blurry, low quality, extra limbs, deformed, disfigured, watermark, text",
      params: {
        "화면비": "3:4",
        "Steps": "30",
        "CFG Scale": "7.0",
        "Sampler": "DPM++ 2M Karras",
        "Seed": "1847293",
      },
      postProcess:
        "Topaz Photo AI로 2× 업스케일 후 Adobe Lightroom에서 채도·명도 조정. 말풍선은 Clip Studio Paint에서 직접 작업.",
      costType: "유료",
      duration: "주당 약 4~6시간",
      license: "CC BY-NC 4.0",
      commercial: "불가",
    },
  },
  "my-recipe-app": {
    category: "내가 만든 AI 제품",
    title: "냉장고 재료만 넣으면 레시피 짜주는 앱을 직접 만들었어요",
    author: "주말개발자",
    date: "2026.06.16",
    views: "1,540",
    likes: 168,
    bookmarks: 47,
    comments: 2,
    tags: ["사이드프로젝트", "레시피", "자랑"],
    body: [
      "퇴근 후와 주말 시간을 모아 바이브 코딩으로 만든 개인 프로젝트입니다. 냉장고 사진을 찍으면 재료를 인식해 만들 수 있는 메뉴를 추천해줍니다.",
      "처음엔 텍스트로 재료를 입력받았는데, 사진 인식을 붙이니 쓰는 재미가 확 늘었습니다. 모델은 그대로 두고 입력 방식만 바꿨을 뿐인데 체감이 컸어요.",
      "아직 거친 부분이 많지만 직접 만든 걸 매일 쓰고 있다는 게 가장 뿌듯합니다. 비슷한 사이드 프로젝트 하시는 분들과 이야기 나누고 싶어요.",
    ],
    // 스펙 없는 글 — 검수 시 단일 컬럼 레이아웃 유지 확인
  },
  "ai-music-album": {
    category: "AI 창작마당",
    title: "AI로 만든 로파이 앨범, 처음부터 끝까지 혼자 완성했습니다",
    author: "밤샘작곡가",
    date: "2026.06.13",
    views: "1,103",
    likes: 142,
    bookmarks: 38,
    comments: 1,
    tags: ["음악", "로파이", "창작물"],
    body: [
      "작곡 경험이 거의 없는데도 AI의 도움으로 10곡짜리 로파이 앨범을 완성했습니다.",
      "멜로디 뼈대를 AI로 잡고, 마음에 드는 부분만 골라 다듬는 식으로 작업했습니다. 가사도 키워드 몇 개로 초안을 받아 손봤습니다.",
      "전문가가 들으면 부족하겠지만, 내 손으로 한 장을 끝냈다는 성취감이 정말 큽니다. 작업 흐름이 궁금하면 댓글 남겨주세요.",
    ],
    // 창작 스펙 있는 글 — 오디오·음악 유형, 스펙 패널 노출
    creativeSpec: {
      types: ["오디오·음악"],
      tools: [
        { name: "Suno AI", model: "v3.5", role: "멜로디·반주 생성" },
        { name: "Claude", model: "claude-3-5-sonnet", role: "가사 초안" },
        { name: "Adobe Audition", role: "믹싱·마스터링" },
      ],
      prompt:
        "lofi hip hop, chill beats, jazz chords, vinyl crackle, rainy night mood, 70 bpm, nostalgic, cozy",
      params: {
        "BPM": "70",
        "Key": "C minor",
        "곡 길이": "2분 30초",
        "스타일": "lofi hip hop",
      },
      postProcess:
        "Adobe Audition에서 각 트랙 EQ·컴프레서 적용 후 마스터링. 빈티지 느낌을 위해 vinyl noise 플러그인 추가.",
      costType: "유료",
      duration: "트랙당 약 2시간",
      license: "개인 감상·공유 허용, 상업적 사용 불가",
      commercial: "불가",
    },
  },
  "diary-summary-bot": {
    category: "내가 만든 AI 제품",
    title: "하루 일기를 한 줄로 요약해주는 봇을 만들어 써보는 중",
    author: "기록하는사람",
    date: "2026.06.11",
    views: "876",
    likes: 97,
    bookmarks: 21,
    comments: 1,
    tags: ["봇", "일기", "회고"],
    body: [
      "매일 일기를 쓰지만 나중에 다시 읽지 않는 게 아쉬워 요약 봇을 만들었습니다.",
      "하루 일기를 한 줄로 줄여주고, 일주일 치를 모아 주간 회고로 정리해줍니다. 거창한 기능 없이 딱 필요한 것만 담았습니다.",
      "작게 만들어 직접 쓰니 손이 자주 갑니다. 혼자 쓰는 제품이라도 완성해서 매일 쓰는 경험이 생각보다 만족스럽네요.",
    ],
    // 스펙 없는 글 — 검수 시 단일 컬럼 레이아웃 유지 확인
  },
};

const comments = [
  {
    author: "주말개발자",
    date: "2026.06.18",
    text: "캐릭터 일관성 잡는 부분이 제일 공감되네요. 저도 매번 거기서 막혔거든요.",
    replies: [
      {
        author: "그림덕후",
        date: "2026.06.18",
        text: "맞아요! 레퍼런스 이미지를 고정하고 특징을 매번 반복해 적는 게 그나마 안정적이었어요. 좋게 봐주셔서 감사합니다.",
      },
      {
        author: "밤샘작곡가",
        date: "2026.06.18",
        text: "음악도 비슷해요. 결을 유지하려면 같은 조건을 계속 물려주는 게 중요하더라고요.",
      },
      {
        author: "주말개발자",
        date: "2026.06.19",
        text: "팁 감사합니다! 다음 작업에 바로 적용해볼게요.",
      },
    ],
  },
  {
    author: "기록하는사람",
    date: "2026.06.18",
    text: "혼자 즐기던 걸 그림까지 붙여 공유한다는 말이 좋네요. 다음 편도 기대할게요!",
    replies: [],
  },
  {
    author: "리뷰메이트",
    date: "2026.06.17",
    text: "작화 퀄리티가 회를 거듭할수록 좋아지는 게 보여요. 꾸준함이 멋집니다.",
    replies: [],
  },
];

type PostSlug = keyof typeof posts;

export const metadata: Metadata = {
  title: "작당 라운지 상세",
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function LoungeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts[slug as PostSlug];

  if (!post) {
    notFound();
  }

  // 창작 스펙 유무에 따라 레이아웃 클래스를 분기한다.
  // 스펙 있으면 2열 그리드(.detailWithSpec), 없으면 기존 단일 컬럼(.detailLayout).
  const hasSpec = !!post.creativeSpec;
  const layoutClass = hasSpec ? styles.detailWithSpec : styles.detailLayout;

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="AI 창작마당" />

      <div className={layoutClass}>
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
            {/* 첨부파일 다운로드 영역 */}
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
            <Link href="/lounge" className={styles.listButton}>
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

        {/* 창작 스펙 패널 — spec 없으면 CreativeSpecPanel이 null을 반환하므로 안전 */}
        <CreativeSpecPanel spec={post.creativeSpec} />
      </div>
    </main>
  );
}
