import Image from "next/image";
import { resolveRank, type RankTier } from "@/lib/ranks";
import { cn } from "@/lib/cn";
import styles from "./RankBadge.module.css";

export interface RankBadgeProps {
  /** 등급 키("master") 또는 한국어 라벨("마스터") */
  rank: RankTier | string;
  /** 뱃지 이미지 한 변 크기(px). 기본 28 */
  size?: number;
  /** 등급명 라벨을 뱃지 옆에 함께 표기할지. 기본 false (이미지만) */
  showLabel?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 사용자 등급 뱃지. lib/ranks 의 중앙 정의를 사용해 어디서든 동일한 이미지·라벨로 렌더한다.
 * - 색(이미지) 단독 전달 금지 규칙에 따라, 이미지만 쓸 때도 alt/aria-label 로 등급명을 항상 제공한다.
 * - showLabel=true 면 시각적으로도 등급명 텍스트를 함께 노출한다 (답변 작성자 옆 등).
 */
export function RankBadge({ rank, size = 28, showLabel = false, className }: RankBadgeProps) {
  const info = resolveRank(rank);
  if (!info) return null;

  return (
    <span
      className={cn(styles.root, className)}
      // 라벨을 글자로 함께 보일 땐 이미지를 장식 처리하고, 이미지만일 땐 그룹에 등급명을 부여
      aria-label={showLabel ? undefined : info.label}
    >
      <Image
        src={info.badge}
        alt={showLabel ? "" : info.label}
        width={size}
        height={size}
        className={styles.image}
      />
      {showLabel && <span className={styles.label}>{info.label}</span>}
    </span>
  );
}
