// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, RecentViewedTracker } from "@/components/board";
import styles from "../rules.module.css";

type ResourceType = "rule" | "config";

type Review = {
  author: string;
  tier: string;
  rating: number;
  date: string;
  text: string;
};

type ResourceDetail = {
  type: ResourceType;
  title: string;
  author: string;
  authorTier: string;
  date: string;
  /** 첨부 파일 이름 (확장자 포함) */
  fileName: string;
  fileExt: string;
  fileSize: string;
  /** 다운로드 수 — 자료 신뢰도 핵심 지표 */
  downloads: string;
  rating: number;
  /** 압축 파일 안에 들어있는 파일 목록 */
  includedFiles: string[];
  tags: string[];
  /** 자료 설명 본문 (문단 배열) */
  body: string[];
  reviews: Review[];
};

const resources: Record<string, ResourceDetail> = {
  "nextjs-cursor-rules": {
    type: "rule",
    title: "Next.js + TypeScript Cursor Rules 모음",
    author: "룰메이커",
    authorTier: "master",
    date: "2026.06.18",
    fileName: "nextjs-cursor-rules.zip",
    fileExt: "zip",
    fileSize: "8KB",
    downloads: "1,320",
    rating: 4.8,
    includedFiles: [
      ".cursor/rules/app-router.mdc",
      ".cursor/rules/styling.mdc",
      ".cursor/rules/typescript.mdc",
      "README.md",
    ],
    tags: ["Cursor", "Rules", "Next.js", "TypeScript"],
    body: [
      "App Router·서버 컴포넌트·CSS Module 규칙을 정리한 Cursor rules 모음입니다. 사람이 매번 코드 스타일을 지적하지 않아도 되도록, 규칙을 .cursor/rules 폴더에 나눠 담았습니다.",
      "압축을 풀어 프로젝트 루트의 .cursor/rules 폴더에 넣으면 바로 적용됩니다. README.md에 각 규칙 파일이 어떤 상황에서 동작하는지 정리되어 있습니다.",
      "서버 컴포넌트와 클라이언트 컴포넌트 분리, CSS Module 우선 규칙, 타입 안전 규칙을 포함합니다. 팀 컨벤션에 맞춰 일부 규칙은 끄거나 수정해서 쓰면 됩니다.",
    ],
    reviews: [
      {
        author: "자동화카페",
        tier: "expert",
        rating: 5,
        date: "2026.06.18",
        text: "규칙이 파일별로 잘 나뉘어 있어서 필요한 것만 골라 적용했습니다. 스타일 규칙이 특히 유용했어요.",
      },
      {
        author: "코드작당러",
        tier: "master",
        rating: 5,
        date: "2026.06.17",
        text: "App Router 규칙 덕분에 신규 인원도 패턴을 빨리 익혔습니다. README가 친절해요.",
      },
      {
        author: "파이써니스타",
        tier: "practitioner",
        rating: 4,
        date: "2026.06.16",
        text: "전반적으로 만족합니다. 모노레포 경로 설명이 조금 더 있으면 좋겠네요.",
      },
    ],
  },
  "claude-md-template": {
    type: "config",
    title: "프로젝트용 CLAUDE.md 표준 템플릿",
    author: "자동화카페",
    authorTier: "expert",
    date: "2026.06.16",
    fileName: "claude-md-template.md",
    fileExt: "md",
    fileSize: "5KB",
    downloads: "1,008",
    rating: 4.6,
    includedFiles: ["CLAUDE.md"],
    tags: ["ClaudeCode", "설정", "규칙"],
    body: [
      "Claude Code가 프로젝트 규칙을 일관되게 따르도록 정리한 CLAUDE.md 표준 템플릿입니다. 코딩 규칙·금지 사항·디렉터리 구조 섹션이 미리 나뉘어 있습니다.",
      "프로젝트 루트에 CLAUDE.md로 두고 빈 항목만 채우면 됩니다. 금지 사항을 먼저 명시하는 구조라 모델이 규칙을 어기는 경우를 줄여 줍니다.",
    ],
    reviews: [
      {
        author: "룰메이커",
        tier: "master",
        rating: 5,
        date: "2026.06.16",
        text: "섹션 구성이 깔끔해서 채워 넣기만 했습니다. 금지 사항 섹션이 특히 효과적이에요.",
      },
      {
        author: "파이써니스타",
        tier: "practitioner",
        rating: 4,
        date: "2026.06.15",
        text: "잘 동작합니다. 디렉터리 구조 예시가 도움이 됐어요.",
      },
    ],
  },
  "eslint-prettier-config": {
    type: "config",
    title: "ESLint + Prettier 통합 설정 세트",
    author: "코드작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileName: "eslint-prettier-config.zip",
    fileExt: "zip",
    fileSize: "4KB",
    downloads: "874",
    rating: 4.5,
    includedFiles: [".eslintrc.json", ".prettierrc", ".vscode/settings.json", "README.md"],
    tags: ["설정", "ESLint", "Prettier"],
    body: [
      "충돌 없이 함께 동작하도록 맞춘 ESLint·Prettier 설정 세트입니다. 두 도구가 서로 규칙을 덮어쓰지 않도록 정리했습니다.",
      "README.md의 설치 명령을 실행하고 설정 파일을 프로젝트 루트에 넣으면 됩니다. 추천 VS Code 설정도 함께 들어 있어 저장 시 자동 정렬이 바로 동작합니다.",
    ],
    reviews: [
      {
        author: "자동화카페",
        tier: "expert",
        rating: 5,
        date: "2026.06.14",
        text: "설정 충돌로 고생했는데 이걸로 한 번에 해결했습니다. VS Code 설정까지 있어서 좋네요.",
      },
    ],
  },
  "python-cursor-rules": {
    type: "rule",
    title: "Python 프로젝트 Cursor Rules",
    author: "파이써니스타",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileName: "python-cursor-rules.md",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "521",
    rating: 4.3,
    includedFiles: ["python.mdc"],
    tags: ["Cursor", "Rules", "Python"],
    body: [
      "타입 힌트·docstring·테스트 작성 규칙을 정리한 Python용 Cursor rules입니다. 팀 코드 컨벤션을 자동으로 안내하도록 구성했습니다.",
      ".cursor/rules 폴더에 넣으면 코드 작성 시 규칙을 따르도록 안내합니다. 함수 docstring 형식과 테스트 작성 기준을 포함합니다.",
    ],
    reviews: [
      {
        author: "룰메이커",
        tier: "master",
        rating: 4,
        date: "2026.06.11",
        text: "docstring 규칙이 잘 정리돼 있어서 그대로 적용했습니다. 테스트 규칙도 쓸만해요.",
      },
    ],
  },
};

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  rule: { label: "Rules", icon: "git-repository-line", className: styles.typeSkill },
  config: { label: "설정 파일", icon: "settings-3-line", className: styles.typeMcp },
};

type ResourceSlug = keyof typeof resources;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

export const metadata: Metadata = {
  title: "Rules·설정 자료 상세",
  openGraph: {
    title: "Rules·설정 자료 상세 | AI작당",
    description: "Cursor·Claude의 rules와 설정 파일 자료",
    url: `${SITE_URL}/resources/rules`,
    type: "article",
    siteName: "AI작당",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "Rules·설정 자료" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rules·설정 자료 상세 | AI작당",
    description: "Cursor·Claude의 rules와 설정 파일 자료",
    images: [`${SITE_URL}/og-default.png`],
  },
};

export function generateStaticParams() {
  return Object.keys(resources).map((slug) => ({ slug }));
}

/** 평점을 별 5칸으로 그린다 (반올림 기준 채움) */
function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={`${styles.stars} ${className ?? ""}`} aria-hidden="true">
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

export default async function RulesDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = resources[slug as ResourceSlug];

  if (!resource) {
    notFound();
  }

  const meta = typeMeta[resource.type];
  const reviewCount = resource.reviews.length;

  return (
    <main id="main" className={styles.page}>
      {/* 열람 이력 기록 — localStorage 기반 최근 본 글 */}
      <RecentViewedTracker
        href={`/resources/rules/${slug}`}
        board="Rules·설정"
        title={resource.title}
      />
      <BoardHero menu="resources" currentSub="Rules·설정" />

      <div className={styles.detailLayout}>
        <article className={styles.detail}>
          {/* ── 박스 A: 제목/메타 헤더 + 자료 설명 + 포함 파일 + 태그 ── */}
          <section className={styles.sectionCard}>
            {/* 헤더: 유형 + 평점 + 제목 + 메타 */}
            <header className={styles.detailHeader}>
              <div className={styles.detailTopRow}>
                <span className={`${styles.typeBadge} ${meta.className}`}>
                  <Icon name={meta.icon} />
                  {meta.label}
                </span>
                <span className={styles.ratingChip} aria-label={`평점 ${resource.rating}점`}>
                  <RatingStars rating={resource.rating} />
                  <strong>{resource.rating.toFixed(1)}</strong>
                  <span className={styles.reviewCount}>후기 {reviewCount}</span>
                </span>
              </div>

              <h1 className={styles.detailTitle}>{resource.title}</h1>

              <div className={styles.detailMeta}>
                <span className={styles.metaAuthor}>
                  <Avatar name={resource.author} size="sm" />
                  <AuthorName name={resource.author} className={styles.authorName} />
                </span>
                <span className={styles.metaDivider} aria-hidden="true">
                  |
                </span>
                <span>{resource.date}</span>
                <span className={styles.metaDivider} aria-hidden="true">
                  |
                </span>
                <span className={styles.metaDownloads}>
                  <Icon name="download-2-line" />
                  다운로드 {resource.downloads}
                </span>
              </div>
            </header>

            {/* 자료 설명 */}
            <section className={styles.detailBody} aria-labelledby="desc-title">
              <h2 id="desc-title" className={styles.sectionTitle}>
                자료 설명
              </h2>
              {resource.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <AttachmentList />
            </section>

            {/* 포함 파일 */}
            <section className={styles.fileListSection} aria-labelledby="files-title">
              <h2 id="files-title" className={styles.sectionTitle}>
                포함 파일
              </h2>
              <ul className={styles.fileList}>
                {resource.includedFiles.map((file) => (
                  <li key={file} className={styles.fileListItem}>
                    <Icon name="file-text-line" />
                    {file}
                  </li>
                ))}
              </ul>
            </section>

            {/* 태그 (박스 A 하단) */}
            <div className={styles.detailTagRow}>
              {resource.tags.map((tag) => (
                <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                  #{tag}
                </Tag>
              ))}
            </div>
          </section>

          {/* ── 다운로드 패널 (박스 A 아래) ── */}
          <section className={styles.downloadPanel} aria-label="첨부 파일 다운로드">
            <div className={styles.downloadFile}>
              <span className={styles.downloadFileIcon}>
                <Icon name={resource.fileExt === "zip" ? "folder-zip-line" : "file-code-line"} />
              </span>
              <div className={styles.downloadFileText}>
                <strong className={styles.downloadFileName}>{resource.fileName}</strong>
                <span className={styles.downloadFileMeta}>
                  .{resource.fileExt} · {resource.fileSize} · 다운로드 {resource.downloads}회
                </span>
              </div>
            </div>
            <button type="button" className={styles.downloadAction}>
              <Icon name="download-cloud-2-line" />
              다운로드
            </button>
          </section>

          {/* ── 액션 (북마크 / 공유 / 신고) — 다운로드 아래 ── */}
          <div className={styles.detailActions}>
            <button type="button" className={styles.detailActionBtn}>
              <Icon name="bookmark-line" />
              북마크
            </button>
            <button type="button" className={styles.detailActionBtn}>
              <Icon name="share-line" />
              공유
            </button>
            <button type="button" className={`${styles.detailActionBtn} ${styles.detailActionReport}`}>
              <Icon name="flag-line" />
              신고
            </button>
          </div>

          {/* ── 박스 B: 평점 요약 + 후기 작성 + 후기 목록 ── */}
          <section className={`${styles.sectionCard} ${styles.reviewSection}`} aria-labelledby="review-title">
            <div className={styles.reviewSummary}>
              <div className={styles.reviewScore}>
                <strong>{resource.rating.toFixed(1)}</strong>
                <RatingStars rating={resource.rating} className={styles.reviewScoreStars} />
                <span className={styles.reviewScoreCount}>후기 {reviewCount}개</span>
              </div>
              <button type="button" className={styles.reviewWriteBtn}>
                <Icon name="quill-pen-line" />
                후기 작성
              </button>
            </div>

            <h2 id="review-title" className={styles.sectionTitle}>
              후기 {reviewCount}
            </h2>

            <ul className={styles.reviewList}>
              {resource.reviews.map((review) => (
                <li key={`${review.author}-${review.date}`} className={styles.reviewItem}>
                  <div className={styles.reviewItemHead}>
                    <Avatar name={review.author} size="sm" />
                    <div className={styles.reviewItemAuthor}>
                      <AuthorName name={review.author} />
                      <span>{review.date}</span>
                    </div>
                    <RatingStars rating={review.rating} className={styles.reviewItemStars} />
                  </div>
                  <p className={styles.reviewItemText}>{review.text}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── 푸터 (목록 / 작성자 액션) ── */}
          <footer className={styles.detailFooter}>
            <Link href="/resources/rules" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
            <div className={styles.ownerActions}>
              <button type="button">
                <Icon name="edit-2-line" />
                수정
              </button>
              <button type="button">
                <Icon name="delete-bin-line" />
                삭제
              </button>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
