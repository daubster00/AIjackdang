// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, RecentViewedTracker } from "@/components/board";
import styles from "../templates.module.css";

type ResourceType = "template" | "checklist";

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
  "prd-template": {
    type: "template",
    title: "PRD(제품 요구사항 문서) 템플릿",
    author: "기획라운지",
    authorTier: "master",
    date: "2026.06.18",
    fileName: "prd-template.docx",
    fileExt: "docx",
    fileSize: "22KB",
    downloads: "1,430",
    rating: 4.8,
    includedFiles: ["prd-template.docx"],
    tags: ["템플릿", "기획", "PRD", "문서화"],
    body: [
      "문제 정의·목표·범위·성공 지표까지 빈칸만 채우면 완성되는 PRD 템플릿입니다. 매번 문서 구조를 새로 고민하지 않도록, 검증된 섹션 순서를 미리 잡아 두었습니다.",
      "각 섹션에는 예시 문장과 작성 팁이 주석으로 들어 있어 무엇을 써야 하는지 바로 알 수 있습니다. 회색 안내 문구를 지우고 내용만 채우면 됩니다.",
      "성공 지표를 먼저 정의하도록 배치해, 만들기 전에 '왜 만드는지'를 분명히 하도록 유도합니다.",
    ],
    reviews: [
      {
        author: "문서달인",
        tier: "master",
        rating: 5,
        date: "2026.06.18",
        text: "섹션 순서가 잘 잡혀 있어서 빈칸만 채웠더니 PRD가 완성됐습니다. 작성 팁이 특히 유용했어요.",
      },
      {
        author: "데브옵스연구소",
        tier: "expert",
        rating: 5,
        date: "2026.06.17",
        text: "성공 지표를 먼저 쓰게 하는 구조가 마음에 듭니다. 팀에 그대로 공유했어요.",
      },
      {
        author: "리뷰메이트",
        tier: "practitioner",
        rating: 4,
        date: "2026.06.16",
        text: "전반적으로 만족합니다. 마크다운 버전도 있으면 좋겠네요.",
      },
    ],
  },
  "release-checklist": {
    type: "checklist",
    title: "배포 전 점검 체크리스트",
    author: "데브옵스연구소",
    authorTier: "expert",
    date: "2026.06.16",
    fileName: "release-checklist.md",
    fileExt: "md",
    fileSize: "4KB",
    downloads: "1,102",
    rating: 4.7,
    includedFiles: ["release-checklist.md"],
    tags: ["체크리스트", "배포", "검증"],
    body: [
      "빌드·테스트·환경변수·롤백 준비까지 배포 직전 빠뜨리기 쉬운 항목을 모은 체크리스트입니다. 항목을 하나씩 확인하며 진행할 수 있도록 구성했습니다.",
      "마크다운 체크박스 형식이라 PR 설명이나 이슈에 그대로 붙여 넣어 쓸 수 있습니다. 팀 환경에 맞춰 항목을 더하거나 빼면 됩니다.",
    ],
    reviews: [
      {
        author: "기획라운지",
        tier: "master",
        rating: 5,
        date: "2026.06.16",
        text: "롤백 준비 항목 덕분에 사고를 한 번 막았습니다. 그대로 PR 템플릿에 넣어 쓰고 있어요.",
      },
      {
        author: "문서달인",
        tier: "master",
        rating: 4,
        date: "2026.06.15",
        text: "항목이 실용적입니다. 환경변수 점검 부분이 특히 좋았어요.",
      },
    ],
  },
  "meeting-notes-template": {
    type: "template",
    title: "회의록 표준 템플릿",
    author: "문서달인",
    authorTier: "master",
    date: "2026.06.14",
    fileName: "meeting-notes-template.docx",
    fileExt: "docx",
    fileSize: "15KB",
    downloads: "905",
    rating: 4.5,
    includedFiles: ["meeting-notes-template.docx"],
    tags: ["템플릿", "회의록", "협업"],
    body: [
      "안건·결정 사항·액션 아이템·담당자를 한눈에 정리하는 회의록 템플릿입니다. 회의가 끝나면 바로 공유할 수 있는 구조로 만들었습니다.",
      "액션 아이템마다 담당자와 기한을 적는 칸이 있어 후속 조치가 누락되지 않습니다.",
    ],
    reviews: [
      {
        author: "데브옵스연구소",
        tier: "expert",
        rating: 5,
        date: "2026.06.14",
        text: "액션 아이템 칸 덕분에 후속 조치 누락이 줄었습니다. 깔끔해서 그대로 쓰고 있어요.",
      },
    ],
  },
  "code-review-checklist": {
    type: "checklist",
    title: "코드 리뷰 체크리스트",
    author: "리뷰메이트",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileName: "code-review-checklist.md",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "564",
    rating: 4.3,
    includedFiles: ["code-review-checklist.md"],
    tags: ["체크리스트", "리뷰", "검증"],
    body: [
      "가독성·테스트·보안·성능 관점으로 나눈 코드 리뷰 체크리스트입니다. 리뷰어가 빠르게 훑어볼 수 있게 관점별로 항목을 묶었습니다.",
      "마크다운 체크박스 형식이라 PR 설명에 붙여 넣고 항목을 확인하며 리뷰하면 됩니다.",
    ],
    reviews: [
      {
        author: "기획라운지",
        tier: "master",
        rating: 4,
        date: "2026.06.11",
        text: "관점별로 묶여 있어서 리뷰 흐름이 매끄러웠습니다. 보안 항목이 특히 도움이 됐어요.",
      },
    ],
  },
};

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  template: { label: "문서 템플릿", icon: "file-list-3-line", className: styles.typeSkill },
  checklist: { label: "체크리스트", icon: "checkbox-multiple-line", className: styles.typeMcp },
};

type ResourceSlug = keyof typeof resources;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

export const metadata: Metadata = {
  title: "템플릿·체크리스트 자료 상세",
  openGraph: {
    title: "템플릿·체크리스트 자료 상세 | AI작당",
    description: "바로 채워 쓰는 문서 템플릿과 체크리스트 자료",
    url: `${SITE_URL}/resources/templates`,
    type: "article",
    siteName: "AI작당",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "템플릿·체크리스트 자료" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "템플릿·체크리스트 자료 상세 | AI작당",
    description: "바로 채워 쓰는 문서 템플릿과 체크리스트 자료",
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

export default async function TemplatesDetailPage({
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
        href={`/resources/templates/${slug}`}
        board="템플릿·체크리스트"
        title={resource.title}
      />
      <BoardHero menu="resources" currentSub="템플릿·체크리스트" />

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
            <Link href="/resources/templates" className={styles.listButton}>
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
