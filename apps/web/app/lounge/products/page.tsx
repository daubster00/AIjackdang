import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { AskButton, BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./products.module.css";

export const metadata: Metadata = {
  title: "내가 만든 AI 제품",
  description: "AI작당 작당 라운지 - 직접 만든 AI 제품 소개 목록",
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const posts = [
  {
    slug: "fridge-recipe-app",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "냉장고 사진 한 장으로 레시피를 짜주는 앱을 출시했습니다",
    excerpt:
      "재료 인식부터 메뉴 추천, 장보기 리스트 생성까지 한 번에 처리하는 개인 프로젝트입니다. 사용 흐름과 만든 과정을 소개해요.",
    author: "주말개발자",
    date: "2026.06.18",
    views: "1,640",
    likes: 182,
    comments: 27,
    tags: ["사이드프로젝트", "레시피", "출시"],
    featured: true,
  },
  {
    slug: "meeting-note-bot",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "회의 녹음을 자동으로 정리해주는 노트 봇을 만들어 씁니다",
    excerpt:
      "음성을 받아 화자별로 나누고 결정 사항과 할 일을 뽑아내는 도구입니다. 작은 팀에서 직접 쓰며 다듬는 중이에요.",
    author: "기록하는사람",
    date: "2026.06.15",
    views: "1,208",
    likes: 134,
    comments: 19,
    tags: ["회의록", "STT", "생산성"],
    featured: false,
  },
  {
    slug: "study-quiz-maker",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "PDF를 넣으면 시험 문제를 만들어주는 학습 도구를 공개해요",
    excerpt:
      "강의 자료를 업로드하면 핵심 개념을 뽑아 퀴즈로 변환합니다. 혼자 공부할 때 쓰려고 만들었는데 반응이 좋네요.",
    author: "공부하는AI",
    date: "2026.06.12",
    views: "972",
    likes: 101,
    comments: 14,
    tags: ["학습", "퀴즈생성", "교육"],
    featured: false,
  },
  {
    slug: "shop-review-summarizer",
    category: "내가 만든 AI 제품",
    board: "내가 만든 AI 제품",
    title: "쇼핑몰 리뷰를 한눈에 요약해주는 크롬 확장을 만들었습니다",
    excerpt:
      "상품 페이지의 리뷰 수백 개를 장단점으로 정리해 보여주는 확장 프로그램입니다. 설치형으로 직접 배포한 경험을 풀어봅니다.",
    author: "확장만드는사람",
    date: "2026.06.10",
    views: "845",
    likes: 88,
    comments: 11,
    tags: ["크롬확장", "리뷰요약", "쇼핑"],
    featured: false,
  },
];

export default function LoungeProductsPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="내가 만든 AI 제품" />

      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue="latest" />
        </div>

        <SearchAutocomplete
          label="제품 검색"
          placeholder="제품 검색"
          popularTags={["사이드프로젝트", "출시", "생산성", "크롬확장", "학습", "봇"]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 18개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>최신글 4개</span>
          </div>
          <div className={styles.headerActions}>
            <AskButton tags={["ai-product"]} />
            <Link href="/lounge/products/write">
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
          <section className={styles.postList} aria-label="내가 만든 AI 제품 게시글 목록">
            {posts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                <Link href={`/lounge/products/${post.slug}`} className={styles.postThumb}>
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
                    <Link href={`/lounge/products/${post.slug}`} className={styles.postTitle}>
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
      </div>
    </main>
  );
}
