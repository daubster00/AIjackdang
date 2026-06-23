import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import styles from "./vibe-coding.module.css";

export const metadata: Metadata = {
  title: "바이브 코딩 가이드",
  description: "AI작당 바이브 코딩 가이드 목록",
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const posts = [
  {
    slug: "ai-work-scope",
    category: "시작 가이드",
    board: "바이브코딩 가이드",
    title: "AI에게 일을 맡기기 전에 사람이 정해야 하는 것",
    excerpt:
      "요구사항, 수정 범위, 완료 기준을 먼저 정리하면 AI 결과물을 검토하고 반영하는 시간을 줄일 수 있습니다.",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,418",
    likes: 186,
    comments: 32,
    tags: ["요구사항", "작업범위", "검증"],
    featured: true,
  },
  {
    slug: "claude-code-checklist",
    category: "검증",
    board: "코드 리뷰 흐름",
    title: "Claude Code 결과물을 바로 반영하기 전에 확인할 체크리스트",
    excerpt: "빌드, 테스트, 사용 흐름, 접근성까지 빠르게 잡는 검증 순서를 정리했습니다.",
    author: "리뷰메이트",
    date: "2026.06.14",
    views: "1,802",
    likes: 142,
    comments: 21,
    tags: ["체크리스트", "리뷰", "테스트"],
    featured: false,
  },
  {
    slug: "legacy-refactor-flow",
    category: "리팩터링",
    board: "레거시 개선",
    title: "기존 프로젝트를 단계적으로 개선하는 바이브 코딩 흐름",
    excerpt: "한 번에 갈아엎지 않고 기능 단위로 나누어 요청하고 검증하는 실전 방식을 소개합니다.",
    author: "자동화카페",
    date: "2026.06.12",
    views: "1,344",
    likes: 98,
    comments: 17,
    tags: ["레거시", "개선", "리팩터링"],
    featured: false,
  },
  {
    slug: "frontend-from-reference",
    category: "디자인 구현",
    board: "바이브코딩 팁",
    title: "첨부 이미지를 기준으로 프론트엔드 작업을 요청하는 방법",
    excerpt: "이미지에서 유지할 요소와 바꿀 요소를 분리해 전달하고 반응형 기준까지 명확히 쓰는 방법입니다.",
    author: "프론트라인",
    date: "2026.06.10",
    views: "956",
    likes: 74,
    comments: 12,
    tags: ["디자인", "프론트엔드", "반응형"],
    featured: false,
  },
];

/** 사이드바: 최근 본 글 (게시글 상위 4개 재사용) */
const recentPosts = posts.slice(0, 4).map((post) => ({
  href: `/vibe-coding/${post.slug}`,
  board: post.board,
  title: post.title,
}));

/** 사이드바: 작당 랭킹 */
const userRankings = [
  { rank: 1, nickname: "코드작당러", tier: "master" },
  { rank: 2, nickname: "자동화카페", tier: "expert" },
  { rank: 3, nickname: "프론트라인", tier: "practitioner" },
  { rank: 4, nickname: "리뷰메이트", tier: "member" },
];

export default function VibeCodingPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="vibe-coding" currentSub="바이브코딩 가이드" />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="가이드 검색"
          placeholder="가이드 검색"
          popularTags={["바이브코딩", "ClaudeCode", "검증", "리팩터링", "디자인", "반응형"]}
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
          <Link href="/vibe-coding/write">
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
          <section className={styles.postList} aria-label="바이브 코딩 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                <Link href={`/vibe-coding/${post.slug}`} className={styles.postThumb}>
                  <Image
                    src="/default-thumbnail.png"
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 132px"
                    className={styles.thumbImage}
                  />
                </Link>
                <div className={styles.postBody}>
                  <div className={styles.postTop}>
                    <div className={styles.tagRow}>
                      {post.tags.map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          #{tag}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <h3 className={styles.postHeading}>
                    <Link href={`/vibe-coding/${post.slug}`} className={styles.postTitle}>
                      {post.title}
                    </Link>
                    {post.featured ? (
                      <span className={styles.newDot} aria-label="새 글">
                        N
                      </span>
                    ) : null}
                  </h3>

                  <p className={styles.postExcerpt}>{post.excerpt}</p>

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

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel="가이드 보조 정보"
        />
      </div>
    </main>
  );
}
