// AI작당 사용자 등급(랭킹 뱃지) 중앙 레지스트리.
//
// 등급 뱃지 이미지는 public/badges/ 에 있고, 어느 화면에서든
// (랭킹 사이드바, 답변 작성자, 프로필 등) 동일한 라벨·이미지로 재사용해야 한다.
// 등급 정보를 여기 한 곳에서만 정의하고, 표시는 <RankBadge /> 컴포넌트로 통일한다.
//
// tier(등급 키)는 영문, label(라벨)은 화면에 노출되는 한국어 명칭이다.

/** 등급 키 — 낮은 등급부터 높은 등급 순서로 정의 */
export type RankTier = "rookie" | "member" | "practitioner" | "expert" | "master";

export type RankInfo = {
  /** 등급 키 (영문 식별자) */
  tier: RankTier;
  /** 화면에 노출되는 한국어 등급명 */
  label: string;
  /** 뱃지 이미지 경로 (public 기준 절대경로) */
  badge: string;
  /** 등급 순위 (1=가장 낮음, 5=가장 높음). 정렬·비교에 사용 */
  order: number;
};

/**
 * 등급 정의 (낮은 등급 → 높은 등급).
 * 새내기 → 작당원 → 실전러 → 고수 → 마스터
 */
export const RANKS: Record<RankTier, RankInfo> = {
  rookie: { tier: "rookie", label: "새내기", badge: "/badges/rookie.png", order: 1 },
  member: { tier: "member", label: "작당원", badge: "/badges/member.png", order: 2 },
  practitioner: { tier: "practitioner", label: "실전러", badge: "/badges/practitioner.png", order: 3 },
  expert: { tier: "expert", label: "고수", badge: "/badges/expert.png", order: 4 },
  master: { tier: "master", label: "마스터", badge: "/badges/master.png", order: 5 },
};

/** 낮은 등급부터 높은 등급 순으로 정렬된 배열 (디자인 시스템 문서 등에서 순회용) */
export const RANK_LIST: RankInfo[] = Object.values(RANKS).sort((a, b) => a.order - b.order);

/** 한국어 라벨 → 등급 정보 역인덱스 (예: "마스터" → master) */
const RANK_BY_LABEL: Record<string, RankInfo> = RANK_LIST.reduce(
  (acc, info) => {
    acc[info.label] = info;
    return acc;
  },
  {} as Record<string, RankInfo>,
);

/**
 * 등급 키("master") 또는 한국어 라벨("마스터") 어느 쪽으로도 등급 정보를 찾는다.
 * 매칭되는 등급이 없으면 undefined.
 */
export function resolveRank(value: RankTier | string): RankInfo | undefined {
  return RANKS[value as RankTier] ?? RANK_BY_LABEL[value];
}
