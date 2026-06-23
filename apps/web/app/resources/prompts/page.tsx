import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./prompts.module.css";

export const metadata: Metadata = {
  title: "프롬프트 자료실",
  description: "바로 복사해서 쓰는 재사용 가능한 프롬프트를 평점과 후기로 검증해 공유하는 다운로드형 자료실",
};

/** 정렬 옵션 — 자료실은 다운로드 수를 핵심 지표로 본다 */
const sortOptions = [
  { value: "downloads", label: "다운로드순" },
  { value: "latest", label: "최신순" },
  { value: "rating", label: "평점순" },
  { value: "reviews", label: "후기순" },
];

/**
 * 자료 유형 필터.
 * 프롬프트 하위메뉴는 두 가지 유형(단일 프롬프트 / 프롬프트 모음팩)을 함께 담는다.
 */
const typeFilters = [
  { value: "all", label: "전체" },
  { value: "prompt", label: "단일 프롬프트" },
  { value: "pack", label: "프롬프트 팩" },
];

type ResourceType = "prompt" | "pack";

type Resource = {
  slug: string;
  /** 자료 유형: 단일 프롬프트 / 프롬프트 팩(여러 개 묶음) */
  type: ResourceType;
  title: string;
  /** 자료 설명 (요약) */
  excerpt: string;
  author: string;
  authorTier: string;
  date: string;
  /** 첨부 파일 확장자 (예: md) */
  fileExt: string;
  /** 첨부 파일 용량 표기 */
  fileSize: string;
  /** 다운로드 수 — 자료 신뢰도 핵심 지표 */
  downloads: string;
  /** 평균 평점 (5점 만점) */
  rating: number;
  /** 후기(리뷰) 개수 */
  reviews: number;
  tags: string[];
  featured?: boolean;
};

const resources: Resource[] = [
  {
    slug: "code-review-prompt",
    type: "prompt",
    title: "코드 리뷰 요청 프롬프트 (한국어)",
    excerpt:
      "변경된 코드를 붙여 넣으면 버그·가독성·성능 관점으로 우선순위를 매겨 리뷰해 주는 프롬프트입니다. 한국어 보고 톤으로 정리해 줍니다.",
    author: "프롬프트장인",
    authorTier: "master",
    date: "2026.06.18",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "1,510",
    rating: 4.9,
    reviews: 41,
    tags: ["프롬프트", "리뷰", "검증", "ClaudeCode"],
    featured: true,
  },
  {
    slug: "blog-writing-pack",
    type: "pack",
    title: "기술 블로그 작성 프롬프트 팩 (8종)",
    excerpt:
      "주제 선정·개요·초안·제목·요약까지 단계별로 쓰는 프롬프트 8종 모음입니다. 각 단계 사용 순서와 예시 입력이 포함되어 있습니다.",
    author: "글쓰는개발자",
    authorTier: "expert",
    date: "2026.06.16",
    fileExt: "zip",
    fileSize: "11KB",
    downloads: "1,024",
    rating: 4.7,
    reviews: 26,
    tags: ["프롬프트", "문서화", "블로그"],
  },
  {
    slug: "sql-helper-prompt",
    type: "prompt",
    title: "자연어 → SQL 변환 프롬프트",
    excerpt:
      "테이블 스키마와 원하는 질문을 한국어로 적으면 안전한 SELECT 쿼리로 바꿔 주는 프롬프트입니다. 위험한 쿼리는 경고하도록 설계했습니다.",
    author: "데이터작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileExt: "txt",
    fileSize: "2KB",
    downloads: "812",
    rating: 4.5,
    reviews: 17,
    tags: ["프롬프트", "SQL", "데이터"],
  },
  {
    slug: "interview-prep-pack",
    type: "pack",
    title: "기획 인터뷰 질문 생성 프롬프트 팩",
    excerpt:
      "사용자 인터뷰 전 질문지를 자동으로 만들어 주는 프롬프트 모음입니다. 가설 검증용·탐색용 질문을 구분해서 뽑아 줍니다.",
    author: "기획라운지",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileExt: "zip",
    fileSize: "7KB",
    downloads: "488",
    rating: 4.3,
    reviews: 8,
    tags: ["프롬프트", "기획", "인터뷰"],
  },
];

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  prompt: { label: "단일 프롬프트", icon: "chat-quote-line", className: styles.typeSkill },
  pack: { label: "프롬프트 팩", icon: "stack-line", className: styles.typeMcp },
};

/** 평점을 별 5칸으로 그린다 (반올림 기준 채움) */
function RatingStars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name={n <= Math.round(rating) ? "star-fill" : "star-line"}
          className={n <= Math.round(rating) ? styles.starOn : styles.starOff}
        />
      ))}
    </span>
  );
}

export default function PromptsPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="프롬프트" />

      <section className={styles.toolbar} aria-label="자료 검색 및 정렬">
        <div className={styles.typeFilter} role="group" aria-label="자료 유형 필터">
          {typeFilters.map((filter, i) => (
            <button
              key={filter.value}
              type="button"
              className={styles.typeChip}
              aria-pressed={i === 0}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.sortGroup}>
            <Select options={sortOptions} defaultValue="downloads" />
          </div>
          <SearchAutocomplete
            label="자료 검색"
            placeholder="자료 검색"
            popularTags={["프롬프트", "리뷰", "문서화", "SQL", "기획", "블로그"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 36개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>이번 주 신규 5개</span>
          </div>
          <Link href="/resources/prompts/write">
            <Button
              className={styles.writeButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            >
              자료 등록
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          <section className={styles.resourceGrid} aria-label="프롬프트 자료 목록">
            {resources.map((item) => {
              const meta = typeMeta[item.type];
              return (
                <article key={item.slug} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={`${styles.typeBadge} ${meta.className}`}>
                      <Icon name={meta.icon} />
                      {meta.label}
                    </span>
                    <span className={styles.ratingChip} aria-label={`평점 ${item.rating}점`}>
                      <RatingStars rating={item.rating} />
                      <strong>{item.rating.toFixed(1)}</strong>
                      <span className={styles.reviewCount}>({item.reviews})</span>
                    </span>
                  </div>

                  <h3 className={styles.cardHeading}>
                    <Link href={`/resources/prompts/${item.slug}`} className={styles.cardTitle}>
                      {item.title}
                    </Link>
                    {item.featured ? (
                      <span className={styles.newDot} aria-label="새 자료">
                        N
                      </span>
                    ) : null}
                  </h3>

                  <p className={styles.cardExcerpt}>{item.excerpt}</p>

                  <div className={styles.tagRow}>
                    {item.tags.map((tag) => (
                      <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                        #{tag}
                      </Tag>
                    ))}
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.metaAuthor}>
                      <Avatar name={item.author} size="sm" />
                      <AuthorName name={item.author} className={styles.authorName} />
                    </span>
                    <span className={styles.metaDate}>{item.date}</span>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileChip}>
                        <Icon name="file-zip-line" />
                        .{item.fileExt}
                      </span>
                      <span className={styles.fileSize}>{item.fileSize}</span>
                    </div>
                    <div className={styles.footerRight}>
                      <span className={styles.downloadCount} aria-label={`다운로드 ${item.downloads}회`}>
                        <Icon name="download-2-line" />
                        {item.downloads}
                      </span>
                      <Link
                        href={`/resources/prompts/${item.slug}`}
                        className={styles.downloadBtn}
                      >
                        <Icon name="download-cloud-2-line" />
                        다운로드
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
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
