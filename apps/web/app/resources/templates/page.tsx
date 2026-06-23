import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./templates.module.css";

export const metadata: Metadata = {
  title: "템플릿·체크리스트 자료실",
  description: "바로 채워 쓰는 문서 템플릿과 체크리스트를 평점과 후기로 검증해 공유하는 다운로드형 자료실",
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
 * 템플릿·체크리스트 하위메뉴는 두 가지 유형(문서 템플릿 / 체크리스트)을 함께 담는다.
 */
const typeFilters = [
  { value: "all", label: "전체" },
  { value: "template", label: "문서 템플릿" },
  { value: "checklist", label: "체크리스트" },
];

type ResourceType = "template" | "checklist";

type Resource = {
  slug: string;
  /** 자료 유형: 문서 템플릿 / 체크리스트 */
  type: ResourceType;
  title: string;
  /** 자료 설명 (요약) */
  excerpt: string;
  author: string;
  authorTier: string;
  date: string;
  /** 첨부 파일 확장자 (예: docx) */
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
    slug: "prd-template",
    type: "template",
    title: "PRD(제품 요구사항 문서) 템플릿",
    excerpt:
      "문제 정의·목표·범위·성공 지표까지 빈칸만 채우면 완성되는 PRD 템플릿입니다. 예시 문장과 작성 팁이 주석으로 들어 있습니다.",
    author: "기획라운지",
    authorTier: "master",
    date: "2026.06.18",
    fileExt: "docx",
    fileSize: "22KB",
    downloads: "1,430",
    rating: 4.8,
    reviews: 38,
    tags: ["템플릿", "기획", "PRD", "문서화"],
    featured: true,
  },
  {
    slug: "release-checklist",
    type: "checklist",
    title: "배포 전 점검 체크리스트",
    excerpt:
      "빌드·테스트·환경변수·롤백 준비까지 배포 직전 빠뜨리기 쉬운 항목을 모은 체크리스트입니다. 단계별로 체크하며 진행할 수 있습니다.",
    author: "데브옵스연구소",
    authorTier: "expert",
    date: "2026.06.16",
    fileExt: "md",
    fileSize: "4KB",
    downloads: "1,102",
    rating: 4.7,
    reviews: 27,
    tags: ["체크리스트", "배포", "검증"],
  },
  {
    slug: "meeting-notes-template",
    type: "template",
    title: "회의록 표준 템플릿",
    excerpt:
      "안건·결정 사항·액션 아이템·담당자를 한눈에 정리하는 회의록 템플릿입니다. 회의가 끝나면 바로 공유할 수 있는 구조입니다.",
    author: "문서달인",
    authorTier: "master",
    date: "2026.06.14",
    fileExt: "docx",
    fileSize: "15KB",
    downloads: "905",
    rating: 4.5,
    reviews: 19,
    tags: ["템플릿", "회의록", "협업"],
  },
  {
    slug: "code-review-checklist",
    type: "checklist",
    title: "코드 리뷰 체크리스트",
    excerpt:
      "가독성·테스트·보안·성능 관점으로 나눈 코드 리뷰 체크리스트입니다. PR 리뷰어가 빠르게 훑어볼 수 있게 항목을 정리했습니다.",
    author: "리뷰메이트",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "564",
    rating: 4.3,
    reviews: 11,
    tags: ["체크리스트", "리뷰", "검증"],
  },
];

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  template: { label: "문서 템플릿", icon: "file-list-3-line", className: styles.typeSkill },
  checklist: { label: "체크리스트", icon: "checkbox-multiple-line", className: styles.typeMcp },
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

export default function TemplatesPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="템플릿·체크리스트" />

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
            popularTags={["템플릿", "체크리스트", "기획", "배포", "회의록", "리뷰"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 52개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>이번 주 신규 7개</span>
          </div>
          <Link href="/resources/templates/write">
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
          <section className={styles.resourceGrid} aria-label="템플릿·체크리스트 자료 목록">
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
                    <Link href={`/resources/templates/${item.slug}`} className={styles.cardTitle}>
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
                        href={`/resources/templates/${item.slug}`}
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
