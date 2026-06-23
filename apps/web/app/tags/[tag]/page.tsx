import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Icon, Tag } from "@/components/ui";
import { SearchAutocomplete } from "@/components/board";
import styles from "./tags.module.css";

type Params = { tag: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded} 태그 글 모음`,
    description: `${decoded} 태그가 달린 AI작당 글 모음`,
  };
}

/**
 * 태그 랜딩 페이지 (목업).
 * 실제 데이터는 개발 단계에서 해당 태그가 달린 글을 질의해 채운다.
 * 현재는 형태(헤더 + 글 목록 + 관련 태그)만 구현한 목업이며 글 데이터는 고정값이다.
 */
const samplePosts = [
  {
    slug: "ai-work-scope",
    board: "바이브코딩 가이드",
    href: "/vibe-coding/ai-work-scope",
    title: "AI에게 일을 맡기기 전에 사람이 정해야 하는 것",
    excerpt:
      "요구사항, 수정 범위, 완료 기준을 먼저 정리하면 AI 결과물을 검토하고 반영하는 시간을 줄일 수 있습니다.",
    author: "AI작당 운영팀",
    date: "2026.06.18",
    views: "2,418",
    comments: 32,
  },
  {
    slug: "claude-code-checklist",
    board: "바이브코딩 가이드",
    href: "/vibe-coding/claude-code-checklist",
    title: "Claude Code 결과물을 바로 반영하기 전에 확인할 체크리스트",
    excerpt: "빌드, 테스트, 사용 흐름, 접근성까지 빠르게 잡는 검증 순서를 정리했습니다.",
    author: "리뷰메이트",
    date: "2026.06.14",
    views: "1,802",
    comments: 21,
  },
  {
    slug: "claude-code-php-misunderstanding",
    board: "묻고답하기",
    href: "/questions/claude-code-php-misunderstanding",
    title: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
    excerpt:
      "레거시 PHP 프로젝트를 수정하려는데 파일 구조를 매번 다르게 해석해서 엉뚱한 곳을 고칩니다.",
    author: "작당입문러",
    date: "2026.06.18",
    views: "82",
    comments: 0,
  },
];

const relatedTags = ["바이브코딩", "ClaudeCode", "Cursor", "검증", "리팩터링", "자동화", "프롬프트"];

export default async function TagLandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  return (
    <main id="main" className={styles.page}>
      <section className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href="/" aria-label="홈">
            <Icon name="home-5-line" />
          </Link>
          <Icon name="arrow-right-s-line" aria-hidden="true" />
          <span>태그</span>
          <Icon name="arrow-right-s-line" aria-hidden="true" />
          <span className={styles.current}>#{decoded}</span>
        </nav>

        <h1 className={styles.title}>#{decoded}</h1>
        <p className={styles.subtitle}>
          이 태그가 달린 글 <strong>128</strong>개
        </p>

        <SearchAutocomplete label="태그 글 검색" placeholder={`#${decoded} 안에서 검색`} />
      </section>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <section className={styles.postList} aria-label={`#${decoded} 글 목록`}>
            {samplePosts.map((post) => (
              <article key={post.slug} className={styles.postItem}>
                <div className={styles.postBody}>
                  <span className={styles.boardLabel}>{post.board}</span>
                  <h2 className={styles.postHeading}>
                    <Link href={post.href} className={styles.postTitle}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className={styles.postExcerpt}>{post.excerpt}</p>
                  <div className={styles.postFooter}>
                    <div className={styles.postAuthor}>
                      <Avatar name={post.author} size="sm" />
                      <AuthorName name={post.author} className={styles.authorName} />
                      <span aria-hidden="true">|</span>
                      <span>{post.date}</span>
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

        <aside className={styles.sidebar} aria-label="관련 태그">
          <section className={styles.sidePanel}>
            <div className={styles.sideHeader}>
              <Icon name="price-tag-3-line" />
              <h2>관련 태그</h2>
            </div>
            <div className={styles.relatedTags}>
              {relatedTags.map((related) => (
                <Tag key={related} href={`/tags/${encodeURIComponent(related)}`}>
                  #{related}
                </Tag>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
