/**
 * ResourceCard — 실전자료 목록 카드 (Story 4.2)
 *
 * 4개 독립 페이지(prompts/mcp-skills/rules/templates)가 공유.
 * 기존 각 페이지의 UI 계약(카드 구조·버튼·레이아웃)을 동일하게 유지.
 *
 * 다운로드 버튼 실제 다운로드 연결은 Story 4.6에서 처리.
 * CSS 클래스는 각 페이지의 *.module.css에서 전달받는다.
 */

import Link from "next/link";
import type { ResourceCard as ResourceCardData } from "@ai-jakdang/contracts";
import { AuthorName } from "@/components/ui/AuthorName";
import { Tag } from "@/components/ui/Tag";
import { Icon } from "@/components/ui/Icon";

/** 각 페이지의 styles 모듈을 외부에서 전달받는 타입 */
export interface ResourceCardStyles {
  card: string;
  cardTop: string;
  typeBadge: string;
  typeSkill: string;
  typeMcp: string;
  ratingChip: string;
  stars: string;
  starOn: string;
  starOff: string;
  reviewCount: string;
  cardHeading: string;
  cardTitle: string;
  newDot?: string;
  cardExcerpt: string;
  tagRow: string;
  cardMeta: string;
  metaAuthor: string;
  authorName: string;
  metaDate: string;
  cardFooter: string;
  fileInfo: string;
  fileChip: string;
  fileSize?: string;
  footerRight: string;
  downloadCount: string;
  downloadBtn: string;
}

/** 페이지별 유형 메타 (아이콘·라벨·배지 색상 클래스) */
export interface TypeMeta {
  label: string;
  icon: string;
  className: string; // typeSkill 또는 typeMcp
}

export interface ResourceCardProps {
  item: ResourceCardData;
  /** 해당 페이지의 URL 경로 (예: /resources/prompts) */
  pagePath: string;
  typeMeta: TypeMeta;
  styles: ResourceCardStyles;
}

/** 평점을 별 5칸으로 그린다 (반올림 기준 채움) */
function RatingStars({
  rating,
  styles,
}: {
  rating: number;
  styles: Pick<ResourceCardStyles, "stars" | "starOn" | "starOff">;
}) {
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

/**
 * 단일 자료 카드.
 * [상세보기] = 제목 Link (/resources/{pagePath}/{slug}).
 * [다운로드] = button (Story 4.6에서 연결, 현재 게이팅 플레이스홀더).
 */
export function ResourceCard({ item, typeMeta, styles }: ResourceCardProps) {
  const formattedDate = new Date(item.updatedAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const displayRating = item.avgRating;

  return (
    <article className={styles.card}>
      {/* 썸네일: descriptionJson 첫 번째 이미지 또는 기본 빈 이미지 */}
      <Link
        href={`/resources/${item.slug}`}
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          overflow: "hidden",
          background: "linear-gradient(155deg, #1b1c2e 0%, #11121d 100%)",
          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
          flexShrink: 0,
        }}
        aria-hidden="true"
        tabIndex={-1}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnailUrl ?? "/empty_thumbnail.png"}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Link>
      <div className={styles.cardTop}>
        <span className={`${styles.typeBadge} ${typeMeta.className}`}>
          <Icon name={typeMeta.icon} />
          {typeMeta.label}
        </span>
        <span className={styles.ratingChip} aria-label={`평점 ${displayRating.toFixed(1)}점`}>
          <RatingStars rating={displayRating} styles={styles} />
          <strong>{displayRating.toFixed(1)}</strong>
          <span className={styles.reviewCount}>({item.ratingCount})</span>
        </span>
      </div>

      <h3 className={styles.cardHeading}>
        <Link href={`/resources/${item.slug}`} className={styles.cardTitle}>
          {item.title}
        </Link>
      </h3>

      <p className={styles.cardExcerpt}>{item.summary}</p>

      {item.tagNames.length > 0 && (
        <div className={styles.tagRow}>
          {item.tagNames.map((tag) => (
            <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
              #{tag}
            </Tag>
          ))}
        </div>
      )}

      <div className={styles.cardMeta}>
        <span className={styles.metaAuthor}>
          <AuthorName name={item.authorNickname ?? "알 수 없음"} authorId={item.authorId ?? undefined} defaultAvatarIndex={item.authorAvatarIndex} className={styles.authorName} />
        </span>
        <span className={styles.metaDate}>{formattedDate}</span>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.fileInfo}>
          {/* 파일 정보는 Story 4.3 상세·Story 4.6 다운로드에서 확정. 현재 환경/난이도 표시 */}
          <span className={styles.fileChip}>
            <Icon name="hard-drive-3-line" />
            {item.difficulty === "beginner"
              ? "입문"
              : item.difficulty === "intermediate"
                ? "중급"
                : "고급"}
          </span>
          {item.environment.length > 0 && (
            <span className={styles.fileChip} style={{ marginLeft: "4px" }}>
              <Icon name="computer-line" />
              {item.environment.slice(0, 2).join("·")}
              {item.environment.length > 2 ? " 외" : ""}
            </span>
          )}
        </div>
        <div className={styles.footerRight}>
          <span
            className={styles.downloadCount}
            aria-label={`다운로드 ${item.downloadCount}회`}
          >
            <Icon name="download-2-line" />
            {item.downloadCount.toLocaleString()}
          </span>
          {/* 다운로드 버튼: 상세 페이지로 이동 + ?download=true → 자동 다운로드 시작 (Story 4.6) */}
          <Link href={`/resources/${item.slug}?download=true`} className={styles.downloadBtn}>
            <Icon name="download-cloud-2-line" />
            다운로드
          </Link>
        </div>
      </div>
    </article>
  );
}
