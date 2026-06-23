import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import styles from "./monetize.module.css";

export const metadata: Metadata = {
  title: "AI 수익화",
  description: "AI작당 AI 수익화 가이드 목록",
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const posts = [
  {
    slug: "first-outsourcing-deal",
    category: "외주·판매 팁",
    board: "외주·판매 팁",
    title: "AI 결과물로 첫 외주를 따낼 때 가격을 정하는 기준",
    excerpt:
      "작업 난이도와 수정 횟수, 납기까지 고려해 견적을 잡는 방법과 협상에서 손해 보지 않는 요령을 정리했습니다.",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,318",
    likes: 187,
    comments: 31,
    tags: ["외주", "견적", "협상"],
    featured: true,
  },
  {
    slug: "gpt-prompt-store-revenue",
    category: "수익화 사례",
    board: "수익화 사례",
    title: "프롬프트 묶음을 판매해 한 달 만에 첫 수익을 낸 사례",
    excerpt: "어떤 주제의 프롬프트가 팔렸는지, 가격과 판매 채널은 어떻게 정했는지 실제 경험을 공유합니다.",
    author: "수익화연구소",
    date: "2026.06.15",
    views: "1,904",
    likes: 152,
    comments: 24,
    tags: ["프롬프트", "판매", "수익"],
    featured: false,
  },
  {
    slug: "client-revision-policy",
    category: "외주·판매 팁",
    board: "외주·판매 팁",
    title: "외주 작업에서 무한 수정 요청을 막는 계약 문구 팁",
    excerpt: "수정 범위와 횟수를 미리 못 박아두면 분쟁을 크게 줄일 수 있습니다. 바로 쓰는 문구 예시를 담았습니다.",
    author: "프리랜서노트",
    date: "2026.06.12",
    views: "1,366",
    likes: 118,
    comments: 17,
    tags: ["계약", "수정", "외주"],
    featured: false,
  },
  {
    slug: "ai-design-service-launch",
    category: "수익화 사례",
    board: "수익화 사례",
    title: "AI 디자인 자동화로 소상공인 상세페이지 서비스를 만든 사례",
    excerpt: "반복되는 상세페이지 제작을 AI로 묶어 서비스화하고, 단가를 낮춰 고객을 늘린 과정을 소개합니다.",
    author: "런칭메이커",
    date: "2026.06.10",
    views: "1,072",
    likes: 89,
    comments: 13,
    tags: ["디자인", "서비스화", "상세페이지"],
    featured: false,
  },
];

/** 사이드바: 최근 본 글 (게시글 상위 4개 재사용) */
const recentPosts = posts.slice(0, 4).map((post) => ({
  href: `/monetize/${post.slug}`,
  board: post.board,
  title: post.title,
}));

/** 사이드바: 작당 랭킹 */
const userRankings = [
  { rank: 1, nickname: "수익화연구소", tier: "master" },
  { rank: 2, nickname: "프리랜서노트", tier: "expert" },
  { rank: 3, nickname: "런칭메이커", tier: "practitioner" },
  { rank: 4, nickname: "리뷰메이트", tier: "member" },
];

export default function MonetizePage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="monetize" currentSub="외주·판매 팁" />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="가이드 검색"
          placeholder="가이드 검색"
          popularTags={["외주", "견적", "프롬프트", "판매", "계약", "서비스화"]}
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
          <Link href="/monetize/write">
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
          <section className={styles.postList} aria-label="AI 수익화 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                <Link href={`/monetize/${post.slug}`} className={styles.postThumb}>
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
                    <Link href={`/monetize/${post.slug}`} className={styles.postTitle}>
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
