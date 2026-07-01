/**
 * 실전자료 통합 상세 페이지 — Story 4.3
 *
 * SSR 서버 컴포넌트:
 * - generateMetadata: 자료명·summary·canonical, noindex 조건(deleted/hidden)
 * - JSON-LD: resourceType별 SoftwareSourceCode / CreativeWork / DigitalDocument
 * - BreadcrumbList JSON-LD: 홈 > 실전자료 > 자료명
 * - H1 1개 (detailTitle)
 * - API 호출 → notFound() 처리
 * - 쿠키 포워딩으로 userIsOwner 판단
 *
 * 클라이언트 파트(다운로드 버튼·평점 슬롯·Epic5 슬롯): ResourceDetailClient.tsx
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, RecentViewedTracker } from "@/components/board";
import { ResourceDetailClient } from "./ResourceDetailClient";
import { ResourceOwnerActions } from "./ResourceOwnerActions";
import { ReactionBar } from "./ReactionBar";
import styles from "./resource-detail.module.css";
import type { ResourceFile } from "./ResourceDetailClient";

// ── 타입 ──────────────────────────────────────────────────────────────────────

type ResourceType =
  | "prompt"
  | "claude-code-skill"
  | "mcp"
  | "rules-config"
  | "template-checklist";

/** API 상세 응답 (resourceDetailSchema + HTML 변환본 + userIsOwner) */
interface ResourceDetailResponse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  resourceType: ResourceType;
  environment: string[];
  difficulty: string;
  authorId: string | null;
  authorNickname: string | null;
  authorAvatarIndex: number;
  avgRating: number;
  ratingCount: number;
  downloadCount: number;
  commentCount: number;
  tagNames: string[];
  updatedAt: string;
  createdAt: string;
  status: string;
  descriptionJson: Record<string, unknown>;
  usageJson: Record<string, unknown>;
  cautionJson: Record<string, unknown> | null;
  version: string | null;
  referenceLinks: { label: string; url: string }[] | null;
  files: ResourceFile[];
  userIsOwner: boolean;
  descriptionHtml: string;
  usageHtml: string;
  cautionHtml: string | null;
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

/** resourceType → 해당 유형 목록 페이지 URL */
function typeToListUrl(resourceType: ResourceType): string {
  const map: Record<ResourceType, string> = {
    prompt: "/resources/prompts",
    "claude-code-skill": "/resources/mcp-skills",
    mcp: "/resources/mcp-skills",
    "rules-config": "/resources/rules",
    "template-checklist": "/resources/templates",
  };
  return map[resourceType] ?? "/resources/prompts";
}
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://aijakdang.com").replace(/\/$/, "");

/** resourceType별 JSON-LD 타입 매핑 */
const JSON_LD_TYPE: Record<ResourceType, string> = {
  prompt: "SoftwareSourceCode",
  "claude-code-skill": "SoftwareSourceCode",
  mcp: "SoftwareSourceCode",
  "rules-config": "DigitalDocument",
  "template-checklist": "CreativeWork",
};

/** resourceType별 표시 레이블·아이콘 */
const TYPE_META: Record<ResourceType, { label: string; icon: string; className: string }> = {
  prompt: { label: "단일 프롬프트", icon: "chat-quote-line", className: styles.typePrompt },
  "claude-code-skill": { label: "Claude Code Skill", icon: "magic-line", className: styles.typeSkill },
  mcp: { label: "MCP", icon: "plug-line", className: styles.typeMcp },
  "rules-config": { label: "Rules·Config", icon: "settings-3-line", className: styles.typeRules },
  "template-checklist": { label: "템플릿·체크리스트", icon: "file-list-3-line", className: styles.typeTemplate },
};

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchResourceDetail(
  slug: string,
  cookie?: string,
): Promise<ResourceDetailResponse | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/resources/${encodeURIComponent(decodeURIComponent(slug))}`,
      {
        headers: cookie ? { cookie } : {},
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<ResourceDetailResponse>;
  } catch {
    return null;
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await fetchResourceDetail(slug);

  if (!resource) {
    return { robots: { index: false, follow: false } };
  }

  const canonicalUrl = `${SITE_URL}/resources/${resource.slug}`;
  const description = (resource.summary ?? resource.title).slice(0, 160);
  const ogTitle = `${resource.title} | AI작당`;
  const ogImageUrl = `${SITE_URL}/og-default.png`;
  const noindex =
    resource.status === "hidden" || resource.status === "deleted";

  return {
    title: resource.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "AI작당",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: resource.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImageUrl],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params;

  // 쿠키 포워딩으로 userIsOwner 판단 (선택적 인증)
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const resource = await fetchResourceDetail(slug, cookie);

  if (!resource) {
    notFound();
  }

  const typeMeta = TYPE_META[resource.resourceType] ?? TYPE_META.prompt;
  const jsonLdType = JSON_LD_TYPE[resource.resourceType] ?? "CreativeWork";

  const primaryFile = resource.files.find((f) => f.isPrimary) ?? null;
  const attachmentFiles = resource.files.filter((f) => !f.isPrimary);

  // ── JSON-LD 구성 ───────────────────────────────────────────────────────────
  const resourceUrl = `${SITE_URL}/resources/${resource.slug}`;

  const resourceJsonLd = {
    "@context": "https://schema.org",
    "@type": jsonLdType,
    name: resource.title,
    description: resource.summary,
    author: resource.authorNickname
      ? { "@type": "Person", name: resource.authorNickname }
      : undefined,
    dateModified: resource.updatedAt,
    url: resourceUrl,
    fileFormat: primaryFile?.mimeType ?? undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "홈",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "실전자료",
        item: `${SITE_URL}/resources`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: resource.title,
        item: resourceUrl,
      },
    ],
  };

  // ── 날짜 포맷 ──────────────────────────────────────────────────────────────
  const formattedDate = new Date(resource.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* 열람 이력 기록 — localStorage 기반 최근 본 글 */}
      <RecentViewedTracker
        href={`/resources/${resource.slug}`}
        board={typeMeta.label}
        title={resource.title}
      />

      <BoardHero menu="resources" currentSub={typeMeta.label} />

      <div className={styles.detailLayout}>
        <article className={styles.detail}>
          {/* ── ① 메타 헤더 ───────────────────────────────────────────────── */}
          <section className={styles.sectionCard}>
            <header className={styles.detailHeader}>
              <div className={styles.detailTopRow}>
                <span className={`${styles.typeBadge} ${typeMeta.className}`}>
                  <Icon name={typeMeta.icon} />
                  {typeMeta.label}
                </span>
                <span
                  className={styles.ratingChip}
                  aria-label={`평점 ${resource.avgRating.toFixed(1)}점`}
                >
                  <span className={styles.stars} aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon
                        key={n}
                        name={n <= Math.round(resource.avgRating) ? "star-fill" : "star-line"}
                        className={n <= Math.round(resource.avgRating) ? styles.starOn : styles.starOff}
                      />
                    ))}
                  </span>
                  <strong>
                    {resource.avgRating > 0 ? resource.avgRating.toFixed(1) : "–"}
                  </strong>
                  <span className={styles.reviewCount}>후기 {resource.ratingCount}</span>
                </span>
              </div>

              {/* H1 — 페이지당 1개 (SEO FR-11) */}
              <h1 className={styles.detailTitle}>{resource.title}</h1>

              <div className={styles.detailMeta}>
                {resource.authorNickname && (
                  <span className={styles.metaAuthor}>
                    <AuthorName
                      name={resource.authorNickname}
                      defaultAvatarIndex={resource.authorAvatarIndex}
                      className={styles.authorName}
                    />
                  </span>
                )}
                {resource.authorNickname && (
                  <span className={styles.metaDivider} aria-hidden="true">|</span>
                )}
                <span>{formattedDate}</span>
                <span className={styles.metaDivider} aria-hidden="true">|</span>
                <span className={styles.metaDownloads}>
                  <Icon name="download-2-line" />
                  다운로드 {resource.downloadCount.toLocaleString()}
                </span>
              </div>
            </header>

            {/* ── ③ 자료설명 (description_json — 사용법·주의사항을 통합) ───── */}
            <section className={styles.detailBody} aria-labelledby="desc-title">
              <h2 id="desc-title" className={styles.sectionTitle}>
                자료설명
              </h2>
              {/* HTML은 API 서버에서 sanitize-html 처리됨 (AR-8) */}
              <div
                className={styles.richContent}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: resource.descriptionHtml }}
              />
            </section>

            {/* ── 버전 (optional) ───────────────────────────────────────── */}
            {resource.version && (
              <div className={styles.versionSection}>
                <span className={styles.versionBadge}>
                  <Icon name="price-tag-3-line" />
                  버전 {resource.version}
                </span>
              </div>
            )}

            {/* ── ⑥ 참고링크 (nullable) ────────────────────────────────── */}
            {resource.referenceLinks && resource.referenceLinks.length > 0 && (
              <section className={styles.referenceSection} aria-labelledby="ref-title">
                <h2 id="ref-title" className={styles.sectionTitle}>
                  참고링크
                </h2>
                <ul className={styles.referenceList}>
                  {resource.referenceLinks.map((link) => (
                    <li key={link.url} className={styles.referenceItem}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="external-link-line" />
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 태그 행 */}
            {resource.tagNames.length > 0 && (
              <div className={styles.detailTagRow}>
                {resource.tagNames.map((tag) => (
                  <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                    #{tag}
                  </Tag>
                ))}
              </div>
            )}

            {/* ── ⑨ 좋아요·북마크·공유·신고 — ReactionBar */}
            <ReactionBar
              likes={0}
              bookmarks={0}
              resourceId={resource.id}
              authorId={resource.authorId}
            />
          </section>

          {/* ── ② 다운로드 영역 + ⑦ 평점 + ⑧⑨ Epic5 슬롯 (클라이언트) ── */}
          <ResourceDetailClient
            resourceId={resource.id}
            resourceSlug={resource.slug}
            primaryFile={primaryFile}
            attachmentFiles={attachmentFiles}
            avgRating={resource.avgRating}
            ratingCount={resource.ratingCount}
            userIsOwner={resource.userIsOwner}
          />

          {/* ── ⑩ 하단 푸터: 목록으로 (left) · 수정/삭제 (right, 소유자만) ── */}
          <footer className={styles.detailFooter}>
            <Link href={typeToListUrl(resource.resourceType)} className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
            {resource.userIsOwner && (
              <ResourceOwnerActions
                resourceId={resource.id}
                resourceSlug={resource.slug}
                resourceType={resource.resourceType}
              />
            )}
          </footer>
        </article>
      </div>
    </main>
  );
}
