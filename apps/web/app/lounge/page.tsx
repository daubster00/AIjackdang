import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AuthorName, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./lounge.module.css";

export const metadata: Metadata = {
  title: "작당 라운지",
  description: "AI작당 작당 라운지 게시글 목록",
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const posts = [
  {
    slug: "ai-webtoon-series",
    category: "AI 창작마당",
    board: "AI 창작마당",
    title: "주말마다 AI로 그린 단편 웹툰 시리즈를 공유합니다",
    excerpt:
      "스토리는 직접 짜고 작화는 이미지 생성 AI로 채운 4컷 웹툰입니다. 캐릭터 일관성 잡은 방법도 함께 풀어봅니다.",
    author: "그림덕후",
    date: "2026.06.18",
    views: "1,872",
    likes: 204,
    comments: 31,
    tags: ["웹툰", "이미지생성", "창작"],
    featured: true,
  },
  {
    slug: "my-recipe-app",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "냉장고 재료만 넣으면 레시피 짜주는 앱을 직접 만들었어요",
    excerpt:
      "주말에 바이브 코딩으로 만든 개인 프로젝트입니다. 사진 한 장으로 재료를 인식하고 메뉴를 추천해줍니다.",
    author: "주말개발자",
    date: "2026.06.16",
    views: "1,540",
    likes: 168,
    comments: 24,
    tags: ["사이드프로젝트", "레시피", "자랑"],
    featured: false,
  },
  {
    slug: "ai-music-album",
    category: "AI 창작마당",
    board: "AI 창작마당",
    title: "AI로 만든 로파이 앨범, 처음부터 끝까지 혼자 완성했습니다",
    excerpt:
      "작곡 보조 AI로 멜로디를 잡고 가사까지 붙여 10곡짜리 앨범을 냈습니다. 작업 흐름을 가볍게 공유해요.",
    author: "밤샘작곡가",
    date: "2026.06.13",
    views: "1,103",
    likes: 142,
    comments: 18,
    tags: ["음악", "로파이", "창작물"],
    featured: false,
  },
  {
    slug: "diary-summary-bot",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "하루 일기를 한 줄로 요약해주는 봇을 만들어 써보는 중",
    excerpt:
      "매일 쓰는 일기를 모아 주간 회고로 정리해주는 개인용 봇입니다. 작게 만들어 직접 쓰니 만족도가 높네요.",
    author: "기록하는사람",
    date: "2026.06.11",
    views: "876",
    likes: 97,
    comments: 12,
    tags: ["봇", "일기", "회고"],
    featured: false,
  },
];

export default function LoungePage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="AI 창작마당" />

      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="라운지 검색"
          placeholder="라운지 검색"
          popularTags={["웹툰", "음악", "사이드프로젝트", "창작물", "자랑", "봇"]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 24개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>최신글 5개</span>
          </div>
          <Link href="/lounge/write">
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

        <div className={styles.mainCol}>
          <section className={styles.galleryGrid} aria-label="작당 라운지 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.card}>
                <Link href={`/lounge/${post.slug}`} className={styles.cardThumb}>
                  <Image
                    src="/default-thumbnail.png"
                    alt=""
                    fill
                    sizes="(max-width: 600px) 100vw, (max-width: 1080px) 50vw, 25vw"
                    className={styles.thumbImage}
                  />
                  {post.featured ? (
                    <span className={styles.newDot} aria-label="새 글">
                      N
                    </span>
                  ) : null}
                </Link>

                <div className={styles.cardBody}>
                  <div className={styles.cardAuthor}>
                    <Avatar name={post.author} size="sm" />
                    <AuthorName name={post.author} className={styles.authorName} />
                  </div>

                  <h3 className={styles.cardHeading}>
                    <Link href={`/lounge/${post.slug}`} className={styles.cardTitle}>
                      {post.title}
                    </Link>
                  </h3>

                  {post.tags.length > 0 ? (
                    <div className={styles.cardTagRow}>
                      {post.tags.map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          #{tag}
                        </Tag>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.cardStats} aria-label="게시글 정보">
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
