import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./mcp-skills.module.css";

export const metadata: Metadata = {
  title: "MCP·Skills 자료실",
  description: "Claude Code Skill과 MCP 서버 설정 자료를 받아서 바로 적용하는 다운로드형 자료실",
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
 * MCP·Skills 하위메뉴는 두 가지 자료 유형(Claude Code Skill / MCP)을 함께 담는다.
 */
const typeFilters = [
  { value: "all", label: "전체" },
  { value: "skill", label: "Claude Code Skill" },
  { value: "mcp", label: "MCP" },
];

type ResourceType = "skill" | "mcp";

type Resource = {
  slug: string;
  /** 자료 유형: 스킬 / MCP 서버 */
  type: ResourceType;
  title: string;
  /** 자료 설명 (요약) */
  excerpt: string;
  author: string;
  authorTier: string;
  date: string;
  /** 첨부 파일 확장자 (예: zip) */
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
    slug: "quality-review-skill",
    type: "skill",
    title: "코드 품질 자동 리뷰 스킬 (quality-review)",
    excerpt:
      "변경된 코드를 받아 빌드·테스트·접근성 관점으로 자동 점검하는 Claude Code Skill입니다. SKILL.md와 예시 파일이 포함되어 있습니다.",
    author: "리뷰메이트",
    authorTier: "master",
    date: "2026.06.18",
    fileExt: "zip",
    fileSize: "18KB",
    downloads: "1,240",
    rating: 4.8,
    reviews: 32,
    tags: ["ClaudeCode", "Skills", "리뷰", "검증"],
    featured: true,
  },
  {
    slug: "github-mcp-guide",
    type: "mcp",
    title: "GitHub MCP 서버 설정 가이드",
    excerpt:
      "이슈·PR·코드 검색을 Claude에서 바로 다루기 위한 GitHub MCP 설정 자료입니다. 설치 명령어, 설정 JSON, 보안 주의사항을 포함합니다.",
    author: "자동화카페",
    authorTier: "expert",
    date: "2026.06.16",
    fileExt: "zip",
    fileSize: "9KB",
    downloads: "986",
    rating: 4.6,
    reviews: 21,
    tags: ["MCP", "GitHub", "자동화"],
  },
  {
    slug: "notion-mcp-config",
    type: "mcp",
    title: "Notion MCP 연동 설정 + 사용 예시",
    excerpt:
      "Notion 문서를 읽고 쓰는 MCP 서버 연동 설정과 실전 사용 예시를 담았습니다. 토큰 발급부터 권한 범위까지 정리했습니다.",
    author: "코드작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileExt: "json",
    fileSize: "4KB",
    downloads: "742",
    rating: 4.5,
    reviews: 15,
    tags: ["MCP", "Notion", "프롬프트"],
  },
  {
    slug: "doc-writer-skill",
    type: "skill",
    title: "기술 문서 작성 스킬 (doc-writer)",
    excerpt:
      "코드 변경 내역을 받아 README와 변경 로그 초안을 만들어 주는 Skill입니다. 한국어 문서 톤 가이드가 포함되어 있습니다.",
    author: "프론트라인",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileExt: "zip",
    fileSize: "12KB",
    downloads: "513",
    rating: 4.3,
    reviews: 9,
    tags: ["ClaudeCode", "Skills", "문서화"],
  },
];

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  skill: { label: "Claude Code Skill", icon: "magic-line", className: styles.typeSkill },
  mcp: { label: "MCP", icon: "plug-line", className: styles.typeMcp },
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

export default function McpSkillsPage() {
  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="MCP·Skills" />

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
            popularTags={["ClaudeCode", "MCP", "Skills", "GitHub", "Notion", "자동화"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 48개</span>
            <span className={styles.statDivider} aria-hidden="true">
              |
            </span>
            <span>이번 주 신규 6개</span>
          </div>
          <Link href="/resources/mcp-skills/write">
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
          <section className={styles.resourceGrid} aria-label="MCP·Skills 자료 목록">
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
                    <Link href={`/resources/mcp-skills/${item.slug}`} className={styles.cardTitle}>
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
                        href={`/resources/mcp-skills/${item.slug}`}
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
