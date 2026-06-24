import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { AskButton, BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./talk.module.css";

export const metadata: Metadata = {
  title: "작당 수다방",
  description: "AI작당 작당 라운지 - AI 관련 잡담·수다 게시판",
};

/** 정렬 옵션 */
const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

/** 수다방 mock 글 데이터 (자유 AI 잡담 톤) */
const posts = [
  {
    slug: "worldcup-ai-prediction",
    title: "AI한테 월드컵 우승팀 물어봤더니 진짜 맞췄어요",
    excerpt:
      "GPT·Claude·Gemini 세 모델한테 같은 질문 던졌는데 답이 다 달랐습니다. 어떤 모델이 제일 근거가 탄탄했는지 비교해봤어요.",
    author: "축구덕후",
    date: "2026.06.20",
    views: "2,310",
    likes: 247,
    comments: 58,
    tags: ["잡담", "월드컵", "AI비교"],
    featured: true,
  },
  {
    slug: "ai-app-surprise",
    title: "요즘 제일 신기했던 AI 앱 공유해요",
    excerpt:
      "사진 찍으면 식물 이름이랑 관리법 알려주는 앱 써봤는데 진짜 신기하더라고요. 여러분이 요즘 쓰는 AI 앱 있으면 같이 공유해요.",
    author: "식물키우기",
    date: "2026.06.19",
    views: "1,876",
    likes: 193,
    comments: 44,
    tags: ["AI앱추천", "잡담", "공유"],
    featured: true,
  },
  {
    slug: "chatgpt-vs-claude-writing",
    title: "ChatGPT랑 Claude 중에 글 다듬을 때 어느 게 낫나요",
    excerpt:
      "이메일 문구 교정할 때 두 모델 결과물이 꽤 달라서요. 저는 Claude 쪽이 더 자연스럽던데, 다른 분들 경험도 궁금합니다.",
    author: "카피라이터지망",
    date: "2026.06.18",
    views: "1,543",
    likes: 168,
    comments: 37,
    tags: ["ChatGPT", "Claude", "비교"],
    featured: false,
  },
  {
    slug: "ai-cooking-recipe-fail",
    title: "AI 레시피 믿고 요리했다가 망한 썰",
    excerpt:
      "냉장고에 있는 재료 입력하고 레시피 받았는데 조합이 너무 이상했어요. 모두의 AI 요리 실패담 환영합니다.",
    author: "요리망한사람",
    date: "2026.06.17",
    views: "1,201",
    likes: 142,
    comments: 29,
    tags: ["잡담", "AI레시피", "실패담"],
    featured: false,
  },
  {
    slug: "voice-ai-daily-use",
    title: "음성 AI 어시스턴트 일상에서 어떻게 쓰세요?",
    excerpt:
      "저는 운전할 때 주로 쓰는데, 일정 추가하거나 메모할 때 정말 편하더라고요. 여러분만의 활용법 있으면 공유해주세요.",
    author: "드라이버AI",
    date: "2026.06.16",
    views: "988",
    likes: 115,
    comments: 22,
    tags: ["음성AI", "일상활용", "공유"],
    featured: false,
  },
  {
    slug: "ai-image-generation-tips",
    title: "이미지 생성 AI 프롬프트 팁 모아봤습니다",
    excerpt:
      "Midjourney·DALL-E·Stable Diffusion 쓰면서 효과 좋았던 프롬프트 패턴 정리해봤어요. 같이 추가해가요.",
    author: "이미지작가",
    date: "2026.06.15",
    views: "872",
    likes: 99,
    comments: 18,
    tags: ["이미지생성", "프롬프트", "팁"],
    featured: false,
  },
];

export default function LoungeTalkPage() {
  return (
    <main id="main" className={styles.page}>
      {/* 히어로: lounge 대메뉴 공통 히어로, 현재 서브메뉴 = 작당 수다방 */}
      <BoardHero menu="lounge" currentSub="작당 수다방" />

      {/* 툴바: 정렬 선택 + 키워드 검색 */}
      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="수다방 검색"
          placeholder="수다방 검색"
          popularTags={["잡담", "AI비교", "AI앱추천", "이미지생성", "프롬프트", "팁"]}
        />
      </section>

      <div className={styles.listLayout}>
        {/* 목록 헤더: 통계 + 글쓰기 버튼 */}
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 24개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>최신글 6개</span>
          </div>
          {/* 버튼 그룹: [질문하기] + [글쓰기] */}
          <div className={styles.headerActions}>
            <AskButton tags={["lounge-talk"]} />
            {/* 글쓰기는 수다방 전용 write 라우트로 이동 */}
            <Link href="/lounge/talk/write">
              <Button
                className={styles.writeButton}
                leftIcon={
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                }
              >
                글쓰기
              </Button>
            </Link>
          </div>
        </div>

        <div className={styles.mainCol}>
          {/* 텍스트형 게시글 목록 (썸네일 없음) */}
          <section className={styles.postList} aria-label="작당 수다방 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                {/* 태그 행 */}
                <div className={styles.postTop}>
                  <div className={styles.tagRow}>
                    {post.tags.map((tag) => (
                      <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                        #{tag}
                      </Tag>
                    ))}
                  </div>
                </div>

                {/* 제목 + NEW 뱃지 */}
                <h3 className={styles.postHeading}>
                  <Link href={`/lounge/talk/${post.slug}`} className={styles.postTitle}>
                    {post.title}
                  </Link>
                  {post.featured ? (
                    <span className={styles.newDot} aria-label="새 글">
                      N
                    </span>
                  ) : null}
                </h3>

                {/* 요약 */}
                <p className={styles.postExcerpt}>{post.excerpt}</p>

                {/* 하단: 작성자 + 통계 */}
                <div className={styles.postFooter}>
                  <div className={styles.postAuthor}>
                    <Avatar name={post.author} size="sm" />
                    <AuthorName name={post.author} className={styles.authorName} />
                    <span className={styles.footerDivider} aria-hidden="true">
                      |
                    </span>
                    <span className={styles.postDate}>{post.date}</span>
                  </div>
                  <div className={styles.postStats} aria-label="게시글 정보">
                    <span>
                      <Icon name="eye-line" />
                      {post.views}
                    </span>
                    <span>
                      <Icon name="chat-3-line" />
                      {post.comments}
                    </span>
                    <span>
                      <Icon name="heart-3-line" />
                      {post.likes}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {/* 페이지네이션 */}
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
      </div>
    </main>
  );
}
