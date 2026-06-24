import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero } from "@/components/board";
import styles from "../mcp-skills.module.css";

type ResourceType = "skill" | "mcp";

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
  "quality-review-skill": {
    type: "skill",
    title: "코드 품질 자동 리뷰 스킬 (quality-review)",
    author: "리뷰메이트",
    authorTier: "master",
    date: "2026.06.18",
    fileName: "quality-review-skill.zip",
    fileExt: "zip",
    fileSize: "18KB",
    downloads: "1,240",
    rating: 4.8,
    includedFiles: ["SKILL.md", "README.md", "examples.md"],
    tags: ["ClaudeCode", "Skills", "리뷰", "검증"],
    body: [
      "변경된 코드를 받아 빌드·테스트·접근성 관점으로 자동 점검하는 Claude Code Skill입니다. 사람이 매번 같은 체크리스트를 반복하지 않도록, 리뷰 기준을 SKILL.md에 정리해 두었습니다.",
      "압축을 풀어 프로젝트의 .claude/skills 폴더에 넣으면 바로 사용할 수 있습니다. README.md에 설치 위치와 호출 예시가 정리되어 있고, examples.md에는 실제 리뷰 결과 예시가 담겨 있습니다.",
      "빌드 실패, 타입 오류, 누락된 테스트, 접근성 위반을 우선순위로 정리해 보고하도록 설계했습니다. 한국어 보고 톤을 기본으로 합니다.",
    ],
    reviews: [
      {
        author: "코드작당러",
        tier: "master",
        rating: 5,
        date: "2026.06.18",
        text: "리뷰 기준이 명확해서 그대로 적용했더니 PR 리뷰 시간이 확 줄었습니다. SKILL.md 구성이 깔끔해요.",
      },
      {
        author: "프론트라인",
        tier: "practitioner",
        rating: 5,
        date: "2026.06.17",
        text: "접근성 위반을 잡아주는 부분이 특히 좋았습니다. 예시 파일이 있어서 적용이 쉬웠어요.",
      },
      {
        author: "자동화카페",
        tier: "expert",
        rating: 4,
        date: "2026.06.16",
        text: "전반적으로 만족합니다. 다만 모노레포 환경 설명이 조금 더 있으면 좋겠네요.",
      },
    ],
  },
  "github-mcp-guide": {
    type: "mcp",
    title: "GitHub MCP 서버 설정 가이드",
    author: "자동화카페",
    authorTier: "expert",
    date: "2026.06.16",
    fileName: "github-mcp-guide.zip",
    fileExt: "zip",
    fileSize: "9KB",
    downloads: "986",
    rating: 4.6,
    includedFiles: [
      "README.md",
      "install-command.txt",
      "mcp-config.json",
      "usage-example.md",
      "security-note.md",
    ],
    tags: ["MCP", "GitHub", "자동화"],
    body: [
      "이슈·PR·코드 검색을 Claude에서 바로 다루기 위한 GitHub MCP 설정 자료입니다. 설치 명령어와 설정 JSON, 사용 예시, 보안 주의사항을 모두 포함합니다.",
      "install-command.txt의 명령으로 서버를 설치하고, mcp-config.json을 자신의 설정에 붙여 넣은 뒤 토큰만 교체하면 됩니다. usage-example.md에 실제 호출 흐름이 정리되어 있습니다.",
      "토큰 권한 범위를 최소로 두는 방법을 security-note.md에 따로 정리했습니다. 조직 저장소에 연결할 때 꼭 확인하세요.",
    ],
    reviews: [
      {
        author: "코드작당러",
        tier: "master",
        rating: 5,
        date: "2026.06.16",
        text: "설정 JSON을 그대로 쓸 수 있어서 5분 만에 연결했습니다. 보안 노트가 특히 유용했어요.",
      },
      {
        author: "리뷰메이트",
        tier: "member",
        rating: 4,
        date: "2026.06.15",
        text: "잘 동작합니다. 토큰 권한 설명이 친절해서 좋았습니다.",
      },
    ],
  },
  "notion-mcp-config": {
    type: "mcp",
    title: "Notion MCP 연동 설정 + 사용 예시",
    author: "코드작당러",
    authorTier: "master",
    date: "2026.06.14",
    fileName: "notion-mcp-config.json",
    fileExt: "json",
    fileSize: "4KB",
    downloads: "742",
    rating: 4.5,
    includedFiles: ["notion-mcp-config.json"],
    tags: ["MCP", "Notion", "프롬프트"],
    body: [
      "Notion 문서를 읽고 쓰는 MCP 서버 연동 설정입니다. 토큰 발급부터 권한 범위까지 주석으로 정리해 두었습니다.",
      "설정 파일을 자신의 MCP 설정에 붙여 넣고 토큰을 교체하면 바로 사용할 수 있습니다.",
    ],
    reviews: [
      {
        author: "프론트라인",
        tier: "practitioner",
        rating: 5,
        date: "2026.06.14",
        text: "주석이 친절해서 바로 적용했습니다. 권한 범위 설명이 좋네요.",
      },
    ],
  },
  "doc-writer-skill": {
    type: "skill",
    title: "기술 문서 작성 스킬 (doc-writer)",
    author: "프론트라인",
    authorTier: "practitioner",
    date: "2026.06.11",
    fileName: "doc-writer-skill.zip",
    fileExt: "zip",
    fileSize: "12KB",
    downloads: "513",
    rating: 4.3,
    includedFiles: ["SKILL.md", "README.md", "tone-guide.md"],
    tags: ["ClaudeCode", "Skills", "문서화"],
    body: [
      "코드 변경 내역을 받아 README와 변경 로그 초안을 만들어 주는 Skill입니다. 한국어 문서 톤 가이드가 포함되어 있습니다.",
      "tone-guide.md의 문장 규칙을 기준으로 초안을 생성하므로, 팀 문서 톤을 일관되게 유지할 수 있습니다.",
    ],
    reviews: [
      {
        author: "자동화카페",
        tier: "expert",
        rating: 4,
        date: "2026.06.11",
        text: "초안 품질이 괜찮습니다. 톤 가이드를 우리 팀 규칙으로 바꿔서 잘 쓰고 있어요.",
      },
    ],
  },
};

const typeMeta: Record<ResourceType, { label: string; icon: string; className: string }> = {
  skill: { label: "Claude Code Skill", icon: "magic-line", className: styles.typeSkill },
  mcp: { label: "MCP", icon: "plug-line", className: styles.typeMcp },
};

type ResourceSlug = keyof typeof resources;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

export const metadata: Metadata = {
  title: "MCP·Skills 자료 상세",
  openGraph: {
    title: "MCP·Skills 자료 상세 | AI작당",
    description: "Claude Code Skill과 MCP 서버 설정 자료",
    url: `${SITE_URL}/resources/mcp-skills`,
    type: "article",
    siteName: "AI작당",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "MCP·Skills 자료" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP·Skills 자료 상세 | AI작당",
    description: "Claude Code Skill과 MCP 서버 설정 자료",
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

export default async function McpSkillsDetailPage({
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
      <BoardHero menu="resources" currentSub="MCP·Skills" />

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
            <Link href="/resources/mcp-skills" className={styles.listButton}>
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
