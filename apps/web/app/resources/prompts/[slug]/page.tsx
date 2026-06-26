// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, RecentViewedTracker } from "@/components/board";
import styles from "../prompts.module.css";

type ResourceType = "prompt" | "pack";

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
  "code-review-prompt": {
    type: "prompt",
    title: "코드 리뷰 요청 프롬프트 (한국어)",
    author: "프롬프트장인",
    authorTier: "master",
    date: "2026.06.18",
    fileName: "code-review-prompt.md",
    fileExt: "md",
    fileSize: "3KB",
    downloads: "1,510",
    rating: 4.9,
    includedFiles: ["code-review-prompt.md"],
    tags: ["프롬프트", "리뷰", "검증", "ClaudeCode"],
    body: [
      "변경된 코드를 붙여 넣으면 버그·가독성·성능 관점으로 우선순위를 매겨 리뷰해 주는 프롬프트입니다. 매번 같은 리뷰 기준을 반복 입력하지 않도록, 역할·체크리스트·출력 형식을 한 파일에 정리했습니다.",
      "md 파일을 열어 코드 블록 부분에 변경된 코드를 붙여 넣고 그대로 모델에 전달하면 됩니다. 우선순위(치명/권장/사소)로 나눠 한국어 보고 톤으로 정리해 줍니다.",
      "필요에 따라 체크리스트 항목을 팀 규칙에 맞게 수정해서 쓰면 됩니다. 접근성·테스트 누락 점검 항목도 포함되어 있습니다.",
    ],
    reviews: [
      {
        author: "글쓰는개발자",
        tier: "expert",
        rating: 5,
        date: "2026.06.18",
        text: "리뷰 우선순위가 명확하게 나와서 그대로 PR에 옮겨 적었습니다. 한국어 톤이 자연스러워요.",
      },
      {
        author: "데이터작당러",
        tier: "master",
        rating: 5,
        date: "2026.06.17",
        text: "체크리스트가 잘 정리돼 있어서 팀 규칙만 살짝 바꿔서 바로 적용했습니다.",
      },
      {
        author: "기획라운지",
        tier: "practitioner",
        rating: 4,
        date: "2026.06.16",
        text: "전반적으로 만족합니다. 성능 관점 예시가 조금 더 있으면 좋겠어요.",
      },
    ],
  },
  "blog-writing-pack": {
    type: "pack",
    title: "기술 블로그 작성 프롬프트 팩 (8종)",
    author: "글쓰는개발자",
    authorTier: "expert",
    date: "2026.06.16",
    fileName: "blog-writing-pack.zip",
    fileExt: "zip",
    fileSize: "11KB",
    downloads: "1,024",
    rating: 4.7,
    includedFiles: [
      "01-topic.md",
      "02-outline.md",
      "03-draft.md",
      "04-title.md",
      "05-summary.md",
      "README.md",
    ],
    tags: ["프롬프트", "문서화", "블로그"],
    body: [
      "주제 선정·개요·초안·제목·요약까지 단계별로 쓰는 프롬프트 8종 모음입니다. 글 한 편을 처음부터 끝까지 끌고 갈 수 있도록 단계별로 나눴습니다.",
      "README.md에 사용 순서가 정리되어 있습니다. 각 단계 프롬프트에는 예시 입력이 포함되어 있어 무엇을 넣어야 하는지 바로 알 수 있습니다.",
      "기술 블로그뿐 아니라 사내 문서 초안에도 응용할 수 있습니다.",
    ],
    reviews: [
      {
        author: "프롬프트장인",
        tier: "master",
        rating: 5,
        date: "2026.06.16",
        text: "단계가 잘 나뉘어 있어서 글쓰기 막힘이 확 줄었습니다. 개요 프롬프트가 특히 좋아요.",
      },
      {
        author: "기획라운지",
        tier: "practitioner",
        rating: 4,
        date: "2026.06.15",
        text: "예시 입력 덕분에 적용이 쉬웠습니다. 요약 단계 결과가 깔끔하네요.",
      },
    ],
  },
  "sql-helper-prompt": {
    type: "prompt",
    title: "자연어 → SQL 변환 프롬프트",
    author: "데이터작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileName: "sql-helper-prompt.txt",
    fileExt: "txt",
    fileSize: "2KB",
    downloads: "812",
    rating: 4.5,
    includedFiles: ["sql-helper-prompt.txt"],
    tags: ["프롬프트", "SQL", "데이터"],
    body: [
      "테이블 스키마와 원하는 질문을 한국어로 적으면 안전한 SELECT 쿼리로 바꿔 주는 프롬프트입니다. 스키마를 함께 제시하므로 잘못된 컬럼명을 만들지 않습니다.",
      "삭제·갱신처럼 위험한 작업 요청에는 경고하고 실행 대신 확인을 요청하도록 설계했습니다.",
    ],
    reviews: [
      {
        author: "글쓰는개발자",
        tier: "expert",
        rating: 5,
        date: "2026.06.14",
        text: "스키마만 넣으면 바로 쿼리가 나와서 편합니다. 위험 쿼리 경고가 안심돼요.",
      },
    ],
  },
  "interview-prep-pack": {
    type: "pack",
    title: "기획 인터뷰 질문 생성 프롬프트 팩",
    author: "기획라운지",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileName: "interview-prep-pack.zip",
    fileExt: "zip",
    fileSize: "7KB",
    downloads: "488",
    rating: 4.3,
    includedFiles: ["hypothesis-questions.md", "discovery-questions.md", "README.md"],
    tags: ["프롬프트", "기획", "인터뷰"],
    body: [
      "사용자 인터뷰 전 질문지를 자동으로 만들어 주는 프롬프트 모음입니다. 가설 검증용 질문과 탐색용 질문을 구분해서 뽑아 줍니다.",
      "제품 단계와 인터뷰 목표를 입력하면 그에 맞는 질문 세트를 제안합니다. README.md에 사용 흐름이 정리되어 있습니다.",
    ],
    reviews: [
      {
        author: "데이터작당러",
        tier: "master",
        rating: 4,
        date: "2026.06.11",
        text: "질문 분류가 잘 돼 있어서 인터뷰 준비 시간이 줄었습니다. 탐색용 질문이 특히 쓸만해요.",
      },
    ],
  },
};

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  prompt: { label: "단일 프롬프트", icon: "chat-quote-line", className: styles.typeSkill },
  pack: { label: "프롬프트 팩", icon: "stack-line", className: styles.typeMcp },
};

type ResourceSlug = keyof typeof resources;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

export const metadata: Metadata = {
  title: "프롬프트 자료 상세",
  openGraph: {
    title: "프롬프트 자료 상세 | AI작당",
    description: "바로 복사해서 쓰는 재사용 가능한 프롬프트 자료",
    url: `${SITE_URL}/resources/prompts`,
    type: "article",
    siteName: "AI작당",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "프롬프트 자료" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "프롬프트 자료 상세 | AI작당",
    description: "바로 복사해서 쓰는 재사용 가능한 프롬프트 자료",
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

export default async function PromptsDetailPage({
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
        href={`/resources/prompts/${slug}`}
        board="프롬프트"
        title={resource.title}
      />
      <BoardHero menu="resources" currentSub="프롬프트" />

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
            <Link href="/resources/prompts" className={styles.listButton}>
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
