import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import styles from "./automation.module.css";

export const metadata: Metadata = {
  title: "AI 자동화",
  description: "AI작당 AI 자동화 가이드 목록",
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const posts = [
  {
    slug: "first-automation-tools",
    category: "자동화 가이드",
    board: "자동화 가이드",
    title: "처음 자동화를 시작할 때 고르면 좋은 도구 정리",
    excerpt:
      "n8n, Make, Zapier 중 무엇부터 손대야 할지, 작업 규모와 예산을 기준으로 선택하는 방법을 정리했습니다.",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,041",
    likes: 168,
    comments: 28,
    tags: ["n8n", "Make", "Zapier"],
    featured: true,
  },
  {
    slug: "email-summary-workflow",
    category: "자동화 사례",
    board: "자동화 사례",
    title: "매일 쌓이는 메일을 AI가 요약해 슬랙으로 보내준 사례",
    excerpt: "받은 메일을 자동으로 분류하고 핵심만 요약해 팀 채널로 전달하는 워크플로를 공유합니다.",
    author: "자동화카페",
    date: "2026.06.15",
    views: "1,627",
    likes: 131,
    comments: 19,
    tags: ["메일", "요약", "Slack"],
    featured: false,
  },
  {
    slug: "trigger-design-tip",
    category: "자동화 팁",
    board: "자동화 팁",
    title: "자동화가 자꾸 꼬일 때 트리거부터 다시 보는 팁",
    excerpt: "실행 조건과 트리거 시점을 명확히 나누면 중복 실행과 누락을 크게 줄일 수 있습니다.",
    author: "워크플로마스터",
    date: "2026.06.12",
    views: "1,208",
    likes: 96,
    comments: 14,
    tags: ["트리거", "디버깅", "워크플로"],
    featured: false,
  },
  {
    slug: "sheet-to-report",
    category: "자동화 사례",
    board: "자동화 사례",
    title: "스프레드시트 데이터를 주간 리포트로 자동 변환하기",
    excerpt: "흩어진 데이터를 모아 정해진 양식의 리포트로 만들어 매주 자동 발송한 과정을 소개합니다.",
    author: "데이터정리러",
    date: "2026.06.10",
    views: "934",
    likes: 71,
    comments: 11,
    tags: ["스프레드시트", "리포트", "자동발송"],
    featured: false,
  },
];

/** 사이드바: 최근 본 글 (게시글 상위 4개 재사용) */
const recentPosts = posts.slice(0, 4).map((post) => ({
  href: `/automation/${post.slug}`,
  board: post.board,
  title: post.title,
}));

/** 사이드바: 작당 랭킹 */
const userRankings = [
  { rank: 1, nickname: "워크플로마스터", tier: "master" },
  { rank: 2, nickname: "자동화카페", tier: "expert" },
  { rank: 3, nickname: "데이터정리러", tier: "practitioner" },
  { rank: 4, nickname: "리뷰메이트", tier: "member" },
];

export default function AutomationPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="automation" currentSub="자동화 가이드" />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="가이드 검색"
          placeholder="가이드 검색"
          popularTags={["n8n", "Make", "Zapier", "트리거", "요약", "리포트"]}
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
          <Link href="/automation/write">
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
          <section className={styles.postList} aria-label="AI 자동화 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                <Link href={`/automation/${post.slug}`} className={styles.postThumb}>
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
                    <Link href={`/automation/${post.slug}`} className={styles.postTitle}>
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
