import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./rules.module.css";

export const metadata: Metadata = {
  title: "Rules·설정 자료실",
  description: "Cursor·Claude의 rules와 설정 파일을 받아서 바로 적용하는 다운로드형 자료실",
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
 * Rules·설정 하위메뉴는 두 가지 유형(rules 파일 / 설정 파일)을 함께 담는다.
 */
const typeFilters = [
  { value: "all", label: "전체" },
  { value: "rule", label: "Rules" },
  { value: "config", label: "설정 파일" },
];

type ResourceType = "rule" | "config";

type Resource = {
  slug: string;
  /** 자료 유형: rules 파일 / 설정 파일(config) */
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
    slug: "nextjs-cursor-rules",
    type: "rule",
    title: "Next.js + TypeScript Cursor Rules 모음",
    excerpt:
      "App Router·서버 컴포넌트·CSS Module 규칙을 정리한 Cursor rules 모음입니다. 프로젝트에 그대로 넣으면 일관된 코드 스타일을 강제할 수 있습니다.",
    author: "룰메이커",
    authorTier: "master",
    date: "2026.06.18",
    fileExt: "zip",
    fileSize: "8KB",
    downloads: "1,320",
    rating: 4.8,
    reviews: 35,
    tags: ["Cursor", "Rules", "Next.js", "TypeScript"],
    featured: true,
  },
  {
    slug: "claude-md-template",
    type: "config",
    title: "프로젝트용 CLAUDE.md 표준 템플릿",
    excerpt:
      "Claude Code가 프로젝트 규칙을 일관되게 따르도록 정리한 CLAUDE.md 표준 템플릿입니다. 코딩 규칙·금지 사항·디렉터리 구조 섹션이 포함되어 있습니다.",
    author: "자동화카페",
    authorTier: "expert",
    date: "2026.06.16",
    fileExt: "md",
    fileSize: "5KB",
    downloads: "1,008",
    rating: 4.6,
    reviews: 22,
    tags: ["ClaudeCode", "설정", "규칙"],
  },
  {
    slug: "eslint-prettier-config",
    type: "config",
    title: "ESLint + Prettier 통합 설정 세트",
    excerpt:
      "충돌 없이 함께 동작하도록 맞춘 ESLint·Prettier 설정 세트입니다. 적용 명령어와 추천 VS Code 설정까지 함께 들어 있습니다.",
    author: "코드작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileExt: "zip",
    fileSize: "4KB",
    downloads: "874",
    rating: 4.5,
    reviews: 18,
    tags: ["설정", "ESLint", "Prettier"],
  },
  {
    slug: "python-cursor-rules",
    type: "rule",
    title: "Python 프로젝트 Cursor Rules",
    excerpt:
      "타입 힌트·docstring·테스트 작성 규칙을 정리한 Python용 Cursor rules입니다. 팀 코드 컨벤션을 자동으로 안내하도록 구성했습니다.",
    author: "파이써니스타",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "521",
    rating: 4.3,
    reviews: 10,
    tags: ["Cursor", "Rules", "Python"],
  },
];

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  rule: { label: "Rules", icon: "git-repository-line", className: styles.typeSkill },
  config: { label: "설정 파일", icon: "settings-3-line", className: styles.typeMcp },
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

export default function RulesPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="Rules·설정" />

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
            popularTags={["Cursor", "Rules", "설정", "Next.js", "ClaudeCode", "ESLint"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 41개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>이번 주 신규 4개</span>
          </div>
          <Link href="/resources/rules/write">
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
          <section className={styles.resourceGrid} aria-label="Rules·설정 자료 목록">
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
                    <Link href={`/resources/rules/${item.slug}`} className={styles.cardTitle}>
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
                        href={`/resources/rules/${item.slug}`}
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
