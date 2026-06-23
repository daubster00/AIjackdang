import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import { BoardHero } from "@/components/board";
import type { ListResourcesQuery } from "@ai-jakdang/contracts";
import { ResourceCard, type ResourceCardStyles, type TypeMeta } from "../ResourceCard";
import { ResourceFilterClient } from "../ResourceFilterClient";
import { ResourcePagination } from "../ResourcePagination";
import styles from "./mcp-skills.module.css";

export const revalidate = 60; // 목록은 1분 캐시 (AR-17)

/** generateMetadata — 고유 title·description·canonical (FR-11.1) */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "MCP Skill 자료 — AI작당",
    description: "Claude Code Skill과 MCP 서버 설정 자료를 받아서 바로 적용하는 다운로드형 자료실",
    alternates: {
      canonical: "https://aijakdang.com/resources/mcp-skills",
    },
  };
}

/**
 * MCP·Skills 페이지의 유형 탭.
 * DB enum에는 'claude-code-skill'과 'mcp' 두 가지가 있으나,
 * 이 페이지는 'mcp' 고정 필터 (사용자 제약 조건 기준).
 */
const typeMetaMap: TypeMeta = {
  label: "MCP·Skill",
  icon: "plug-line",
  className: styles.typeSkill,
};

/** CSS Module 클래스 맵 (ResourceCard에 전달) */
const cardStyles: ResourceCardStyles = {
  card: styles.card,
  cardTop: styles.cardTop,
  typeBadge: styles.typeBadge,
  typeSkill: styles.typeSkill,
  typeMcp: styles.typeMcp,
  ratingChip: styles.ratingChip,
  stars: styles.stars,
  starOn: styles.starOn,
  starOff: styles.starOff,
  reviewCount: styles.reviewCount,
  cardHeading: styles.cardHeading,
  cardTitle: styles.cardTitle,
  cardExcerpt: styles.cardExcerpt,
  tagRow: styles.tagRow,
  cardMeta: styles.cardMeta,
  metaAuthor: styles.metaAuthor,
  authorName: styles.authorName,
  metaDate: styles.metaDate,
  cardFooter: styles.cardFooter,
  fileInfo: styles.fileInfo,
  fileChip: styles.fileChip,
  footerRight: styles.footerRight,
  downloadCount: styles.downloadCount,
  downloadBtn: styles.downloadBtn,
};

/** API 호출 — 서버 컴포넌트에서 직접 호출 */
async function fetchResources(query: ListResourcesQuery) {
  const params = new URLSearchParams();
  params.set("type", "mcp");
  if (query.sort) params.set("sort", query.sort);
  if (query.difficulty) params.set("difficulty", query.difficulty);
  if (query.q) params.set("q", query.q);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.environment) params.set("environment", query.environment);

  const apiUrl = `${process.env.API_INTERNAL_URL ?? "http://localhost:4003"}/api/v1/resources?${params.toString()}`;

  try {
    const res = await fetch(apiUrl, {
      next: { revalidate: 60 },
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      items: import("@ai-jakdang/contracts").ResourceCard[];
      meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
    }>;
  } catch {
    return null;
  }
}

export default async function McpSkillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const sp = await searchParams;

  const query: ListResourcesQuery = {
    type: "mcp",
    sort: (sp.sort as ListResourcesQuery["sort"]) ?? "latest",
    difficulty: (sp.difficulty as ListResourcesQuery["difficulty"]) ?? undefined,
    environment: typeof sp.environment === "string" ? sp.environment : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined,
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 12,
  };

  const data = await fetchResources(query);
  const items = data?.items ?? [];
  const meta = data?.meta ?? { page: 1, pageSize: 12, totalItems: 0, totalPages: 1 };

  const filterStyles = {
    toolbar: styles.toolbar,
    typeFilter: styles.typeFilter,
    typeChip: styles.typeChip,
    toolbarRight: styles.toolbarRight,
    sortGroup: styles.sortGroup,
  };

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="resources" currentSub="MCP·Skills" />

      <section className={styles.toolbar} aria-label="자료 검색 및 정렬">
        <ResourceFilterClient styles={filterStyles} popularTags={["ClaudeCode", "MCP", "Skills", "GitHub", "Notion", "자동화"]} />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
            {meta.totalItems > 0 && (
              <>
                <span className={styles.statDivider} aria-hidden="true">
                  |
                </span>
                <span>{meta.totalPages}페이지</span>
              </>
            )}
          </div>
          <Link href="/resources/new">
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
          {items.length === 0 ? (
            <EmptyState
              icon="plug-line"
              title="등록된 MCP·Skill 자료가 없습니다"
              description="첫 번째 MCP·Skill 자료를 공유해 보세요."
              actions={
                <Link href="/resources/new">
                  <Button>등록하기</Button>
                </Link>
              }
            />
          ) : (
            <>
              <section className={styles.resourceGrid} aria-label="MCP·Skills 자료 목록">
                {items.map((item) => (
                  <ResourceCard
                    key={item.id}
                    item={item}
                    pagePath="/resources/mcp-skills"
                    typeMeta={typeMetaMap}
                    styles={cardStyles}
                  />
                ))}
              </section>

              <ResourcePagination page={meta.page} totalPages={meta.totalPages} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
