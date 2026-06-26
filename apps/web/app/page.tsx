// Story 8.9: ISR — 홈 메인 페이지 60초 TTL 캐시 (AR-17)
export const revalidate = 60;

import Link from "next/link";
import type { Metadata } from "next";
import { BOARDS } from "@ai-jakdang/contracts";
import { Badge, Card, CardDesc, CardHead, CardMeta, CardTitle, Icon, Tag, EmptyState } from "@/components/ui";
import { RankingWidget } from "@/features/gamification/RankingWidget";
import {
  fetchPopularPosts,
  fetchLatestQuestions,
  fetchMonetizationPosts,
  fetchPopularResources,
  fetchLoungeLatest,
  fetchPinnedNotice,
} from "@/lib/home";
import styles from "./page.module.css";

// ── generateMetadata (AC #2) ─────────────────────────────────────────────────

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

const HOME_DESC =
  "바이브 코딩, AI 자동화, AI 수익화를 실제로 시도하는 사람들의 커뮤니티. 경험과 자료를 함께 쌓아가세요.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "AI작당 — 실전 AI 커뮤니티",
    description: HOME_DESC,
    openGraph: {
      title: "AI작당 — 실전 AI 커뮤니티",
      description: HOME_DESC,
      url: `${SITE_URL}/`,
      type: "website",
      siteName: "AI작당",
      images: [
        {
          url: `${SITE_URL}/og-default.png`,
          width: 1200,
          height: 630,
          alt: "AI작당",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "AI작당 — 실전 AI 커뮤니티",
      description: HOME_DESC,
      images: [`${SITE_URL}/og-default.png`],
    },
  };
}

// ── JSON-LD (WebSite + Organization) ─────────────────────────────────────────

function HomeJsonLd() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AI작당",
    url: "https://aijackdang.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://aijackdang.com/tags/{search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AI작당",
    url: "https://aijackdang.com",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
    </>
  );
}

// ── 게시글 상세 URL 빌더 ──────────────────────────────────────────────────────
// board 슬러그로 BOARDS 상수를 찾고, urlPath 에서 쿼리스트링을 제거한 뒤
// slug 를 붙인다. BOARDS 에 없는 게시판(예: "free")은 category/board/slug 폴백.
function getPostDetailHref(
  board: string,
  slug: string,
  category?: string | null,
): string {
  const boardMeta = BOARDS[board];
  if (boardMeta) {
    // urlPath 가 "/vibe-coding?board=vibe-coding-tips" 형태일 수 있으므로 쿼리 제거
    const baseUrl = boardMeta.urlPath.split("?")[0];
    return `${baseUrl}/${slug}`;
  }
  // 알 수 없는 게시판 → /{category}/{board}/{slug} 제너릭 라우트
  return `/${category ?? board}/${board}/${slug}`;
}

// ── 탭 정의 ────────────────────────────────────────────────────────────────────

const POPULAR_TABS = [
  { id: "vibe-coding", label: "바이브코딩" },
  { id: "ai-automation", label: "자동화" },
  { id: "ai-monetization", label: "수익화" },
  { id: "lounge", label: "라운지" },
] as const;

// ── 아이콘 매핑 (탭 카테고리별) ───────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  "vibe-coding": "code-ai-line",
  "ai-automation": "flow-chart",
  "ai-monetization": "funds-line",
  lounge: "sparkling-2-line",
};

// ── 홈 페이지 서버 컴포넌트 ──────────────────────────────────────────────────

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ "popular-tab"?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params["popular-tab"] ?? "vibe-coding";

  // ── 병렬 데이터 패치 (Promise.all, AC #9 graceful degradation) ──────────────
  const [popularPosts, questions, monetizationPosts, resources, loungePosts, pinnedNotice] =
    await Promise.all([
      fetchPopularPosts(activeTab),
      fetchLatestQuestions(),
      fetchMonetizationPosts(),
      fetchPopularResources(),
      fetchLoungeLatest(),
      fetchPinnedNotice(),
    ]);

  return (
    <main id="main" className={styles.page}>
      <HomeJsonLd />

      {/* ── ① 소개 섹션 ─────────────────────────────────────────────────────── */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <video
          className={styles.heroVideo}
          src="/Office_scene_with_subtle_movements_202606171218.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <Badge tone="primary" variant="solid">
            <Icon name="sparkling-2-line" />
            실전 AI 커뮤니티
          </Badge>
          <h1 id="hero-title">AI로 만들고 자동화하고 수익화하는 사람들의 작업장</h1>
          <p>
            AI작당은 바이브 코딩, 업무 자동화, AI 수익화를 실제로 시도하는 사람들이 경험과 자료,
            막힌 질문을 함께 쌓아가는 커뮤니티입니다.
          </p>
          <div className={styles.heroActions}>
            <Link href="#resources" className={styles.primaryLink}>
              실전자료 보기
              <Icon name="arrow-right-line" />
            </Link>
            <Link href="#questions" className={styles.secondaryLink}>
              묻고답하기
            </Link>
          </div>

          {/* 공지 배너 (FR-15.2) */}
          {pinnedNotice && (
            <div className={styles.noticeBanner} role="complementary" aria-label="공지사항">
              <span className={styles.noticeBannerIcon}>
                <Icon name="notification-3-line" />
              </span>
              <span className={styles.noticeBannerText}>
                {pinnedNotice.url ? (
                  <Link href={pinnedNotice.url} className={styles.noticeBannerLink}>
                    {pinnedNotice.title}
                  </Link>
                ) : (
                  pinnedNotice.title
                )}
                {pinnedNotice.content && <> — {pinnedNotice.content}</>}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── ② 실전 인기글 탭 섹션 ───────────────────────────────────────────── */}
      <section
        id="popular-tab"
        className={styles.popularBand}
        aria-labelledby="category-title"
      >
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Popular</span>
              <h2 id="category-title">실전 인기글</h2>
              <p>
                바이브 코딩, AI 자동화, AI 수익화에서 지금 가장 많이 읽히는 글을 바로 확인하세요.
              </p>
            </div>
          </div>

          {/* 탭 네비게이션 (role="tablist", UX-DR-U2/U6) */}
          <nav role="tablist" aria-label="인기글 카테고리" className={styles.tabNav}>
            {POPULAR_TABS.map((tab) => (
              <Link
                key={tab.id}
                href={`/?popular-tab=${tab.id}#popular-tab`}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`${styles.tabLink} ${activeTab === tab.id ? styles.tabLinkActive : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {popularPosts.length === 0 ? (
            <EmptyState
              title="인기글이 없습니다"
              description="잠시 후 다시 시도해주세요."
              icon="article-line"
            />
          ) : (
            <div className={styles.categoryGrid}>
              {popularPosts.map((post, index) => (
                <Link
                  key={post.id}
                  href={getPostDetailHref(post.board, post.slug, post.category)}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Card
                    variant={index === 0 ? "highlight" : index === 1 ? "resource" : "question"}
                    interactive
                    className={styles.categoryCard}
                  >
                    <CardHead>
                      <span className={styles.categoryIcon}>
                        <Icon name={CATEGORY_ICONS[post.category ?? activeTab] ?? "article-line"} />
                      </span>
                      <Badge tone={index === 0 ? "primary" : index === 1 ? "success" : "warning"}>
                        인기
                      </Badge>
                    </CardHead>
                    <p className={styles.cardKicker}>{post.category ?? activeTab}</p>
                    <CardTitle>{post.title}</CardTitle>
                    {post.description && <CardDesc>{post.description}</CardDesc>}
                    <CardMeta>
                      {post.tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          {tag}
                        </Tag>
                      ))}
                    </CardMeta>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ⑤ 실전자료 섹션 ─────────────────────────────────────────────────── */}
      <section id="resources" className={styles.resourceBand} aria-labelledby="resource-title">
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Resources</span>
            <h2 id="resource-title">바로 써먹는 실전자료</h2>
            <p>
              프롬프트, Claude Code Skill, MCP, Cursor Rules, 설정 파일을 첨부파일 중심으로
              공유합니다.
            </p>
          </div>
          <Link href="/resources" className={styles.moreLink}>
            더보기
            <Icon name="arrow-right-line" />
          </Link>
        </div>

        {resources.length === 0 ? (
          <EmptyState
            title="등록된 자료가 없습니다"
            description="잠시 후 다시 시도해주세요."
            icon="folder-line"
          />
        ) : (
          <div className={styles.resourceGrid}>
            {resources.map((resource) => (
              <Link
                key={resource.id}
                href={`/resources/${resource.slug}`}
                className={styles.resourceLinkCard}
              >
                <Card variant="summary" interactive className={styles.resourceCard}>
                  <CardHead>
                    <Badge tone={(resource.tone as "primary" | "success" | "info" | "warning") ?? "primary"}>
                      {resource.meta}
                    </Badge>
                    <Icon name="download-cloud-2-line" />
                  </CardHead>
                  <CardTitle>{resource.title}</CardTitle>
                  {resource.description && <CardDesc>{resource.description}</CardDesc>}
                  <div className={styles.resourceStats}>
                    <span>
                      <Icon name="download-2-line" />
                      다운로드 {resource.downloadCount}
                    </span>
                    {resource.avgRating != null && resource.avgRating > 0 && (
                      <span>
                        <Icon name="star-line" />
                        평점 {resource.avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── ③ 묻고답하기 최신 섹션 ──────────────────────────────────────────── */}
      <section id="questions" className={styles.qnaBand} aria-labelledby="question-title">
        <div className={styles.splitSection}>
          <div className={styles.questionIntro}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>Q&amp;A</span>
                <h2 id="question-title">막힌 지점은 묻고, 해결 과정은 남깁니다</h2>
                <p>
                  코드 오류만이 아니라 도구 선택, 자동화 설계, 외주 견적, 결과물 판매 가능성까지
                  실전 질문을 한곳에서 다룹니다.
                </p>
              </div>
            </div>
            <Link href="/qna" className={styles.primaryLink}>
              질문 작성하기
              <Icon name="edit-line" />
            </Link>
          </div>

          {questions.length === 0 ? (
            <EmptyState
              title="등록된 질문이 없습니다"
              description="잠시 후 다시 시도해주세요."
              icon="question-line"
            />
          ) : (
            <div className={styles.questionList}>
              {questions.map((question, index) => (
                <Link
                  key={question.id}
                  href={`/questions/${question.slug}`}
                  className={styles.questionItem}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{question.title}</strong>
                    <div className={styles.questionMeta}>
                      <Badge
                        tone={
                          question.status === "resolved"
                            ? "success"
                            : question.status === "answered"
                              ? "info"
                              : "warning"
                        }
                        variant="soft"
                      >
                        {question.status === "resolved"
                          ? "해결됨"
                          : question.status === "answered"
                            ? "답변있음"
                            : "답변대기"}
                      </Badge>
                      <span>답변 {question.commentCount}개</span>
                    </div>
                  </div>
                  <Icon name="arrow-right-s-line" />
                </Link>
              ))}
              <Link href="/qna" className={styles.moreLink} style={{ justifyContent: "center" }}>
                더 보기
                <Icon name="arrow-right-line" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ④ AI 수익화 인기글 섹션 ──────────────────────────────────────────── */}
      <section className={styles.popularBand} aria-labelledby="monetization-title">
        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Monetization</span>
              <h2 id="monetization-title">AI 수익화 인기글</h2>
              <p>AI로 실제 수익을 만들어낸 사람들의 경험과 전략을 확인하세요.</p>
            </div>
            <Link href="/monetization/" className={styles.moreLink}>
              더보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>

          {monetizationPosts.length === 0 ? (
            <EmptyState
              title="인기글이 없습니다"
              description="잠시 후 다시 시도해주세요."
              icon="funds-line"
            />
          ) : (
            <div className={styles.categoryGrid}>
              {monetizationPosts.map((post, index) => (
                <Link
                  key={post.id}
                  href={getPostDetailHref(post.board, post.slug, post.category)}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Card
                    variant={index === 0 ? "highlight" : index === 1 ? "resource" : "question"}
                    interactive
                    className={styles.categoryCard}
                  >
                    <CardHead>
                      <span className={styles.categoryIcon}>
                        <Icon name="funds-line" />
                      </span>
                      <Badge tone={index === 0 ? "primary" : index === 1 ? "success" : "warning"}>
                        인기
                      </Badge>
                    </CardHead>
                    <CardTitle>{post.title}</CardTitle>
                    {post.description && <CardDesc>{post.description}</CardDesc>}
                    <CardMeta>
                      {post.tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          {tag}
                        </Tag>
                      ))}
                    </CardMeta>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── [6.5] 랭킹 섹션 ────────────────────────────────────────────────── */}
      <section id="ranking" className={styles.rankingBand} aria-labelledby="ranking-title">
        <div className={styles.rankingInner}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Ranking</span>
              <h2 id="ranking-title">기여자 랭킹</h2>
              <p>이번 주·이번 달 가장 활발하게 기여한 회원을 확인하세요.</p>
            </div>
            <Link href="/ranking" className={styles.moreLink}>
              전체 랭킹 보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>
          <div className={styles.rankingWidgetWrap}>
            <RankingWidget />
          </div>
        </div>
      </section>
      {/* ── [6.5] END ───────────────────────────────────────────────────────── */}

      {/* ── ⑥ 작당 라운지 섹션 ──────────────────────────────────────────────── */}
      <section id="lounge" className={styles.loungeBand} aria-labelledby="cta-title">
        <div className={styles.loungeInner}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>Lounge</span>
              <h2 id="cta-title">작당 라운지</h2>
              <p>AI 창작마당에 올라온 재미있는 이미지와 영상형 창작물을 둘러보세요.</p>
            </div>
            <Link href="/lounge/" className={styles.moreLink}>
              더보기
              <Icon name="arrow-right-line" />
            </Link>
          </div>

          {loungePosts.length === 0 ? (
            <EmptyState
              title="게시글이 없습니다"
              description="잠시 후 다시 시도해주세요."
              icon="image-line"
            />
          ) : (
            <div className={styles.creativeGrid}>
              {loungePosts.map((item) => (
                <Link
                  key={item.id}
                  href={getPostDetailHref(item.board, item.slug, item.category)}
                  className={styles.creativeCard}
                >
                  {/* 실제 API 데이터에는 thumbnail_url이 없어 텍스트 카드로 렌더링 */}
                  <div className={styles.creativeBody}>
                    <strong>{item.title}</strong>
                    {item.description && <span>{item.description}</span>}
                    <div className={styles.creativeStats}>
                      <span>
                        <Icon name="heart-line" />
                        {item.likeCount}
                      </span>
                      <span>
                        <Icon name="eye-line" />
                        {item.viewCount}
                      </span>
                      <span>
                        <Icon name="chat-3-line" />
                        {item.commentCount}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
