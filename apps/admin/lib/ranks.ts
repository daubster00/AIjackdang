/**
 * 등급(뱃지) 중앙 레지스트리 — 관리자 앱.
 *
 * 뱃지는 "수동 지급"하는 것이 아니라, 누적 작당력(회원이 활동으로 쌓는 기여 점수)에 따라
 * 자동으로 부여되는 회원 등급이다(하락 없음). 기획: docs/gamification-ranking-spec.md.
 * 등급은 5단계로 고정: 새내기 → 작당원 → 실전러 → 고수 → 마스터.
 * 등급명/이미지는 apps/web 의 lib/ranks 와 동일하며, 뱃지 이미지는 /badges/{tier}.png 에 있다.
 *
 * 운영자는 새 뱃지를 "만드는" 것이 아니라 각 등급의 달성 기준(작당력 임계값)·혜택·이미지를
 * "설정"한다. 아래 threshold/holders/benefits 는 디자인용 더미이며, 이후 API 와 연동한다.
 */

/** 등급 키 — 낮은 등급부터 높은 등급 순 */
export type RankTier = "rookie" | "member" | "practitioner" | "expert" | "master";

export type RankInfo = {
  /** 등급 키(영문 식별자, URL 에도 사용) */
  tier: RankTier;
  /** 화면에 노출되는 한국어 등급명 */
  label: string;
  /** 뱃지 이미지 경로(admin public 기준) */
  badge: string;
  /** 등급 순위(1=가장 낮음, 5=가장 높음) */
  order: number;
  /** 이 등급이 되기 위한 누적 작당력 하한(더미·설정값) */
  threshold: number;
  /** 현재 이 등급의 보유 회원 수(더미) */
  holders: number;
  /** 등급 혜택(더미·설정값) */
  benefits: string[];
};

/** 등급 정의(낮은 등급 → 높은 등급). 누적 작당력 임계값으로 자동 부여된다. */
export const RANKS: Record<RankTier, RankInfo> = {
  rookie: {
    tier: "rookie",
    label: "새내기",
    badge: "/badges/rookie.png",
    order: 1,
    threshold: 0,
    holders: 1820,
    benefits: ["글·댓글 작성", "실전자료 다운로드", "묻고답하기 질문"],
  },
  member: {
    tier: "member",
    label: "작당원",
    badge: "/badges/member.png",
    order: 2,
    threshold: 100,
    holders: 964,
    benefits: ["실전자료 업로드", "쪽지 발송", "답변 작성"],
  },
  practitioner: {
    tier: "practitioner",
    label: "실전러",
    badge: "/badges/practitioner.png",
    order: 3,
    threshold: 500,
    holders: 420,
    benefits: ["실전자료 가격 책정", "추천글 후보 노출", "프로필 강조"],
  },
  expert: {
    tier: "expert",
    label: "고수",
    badge: "/badges/expert.png",
    order: 4,
    threshold: 1500,
    holders: 96,
    benefits: ["베타 기능 우선 접근", "메인 노출 가중치", "전용 뱃지 강조"],
  },
  master: {
    tier: "master",
    label: "마스터",
    badge: "/badges/master.png",
    order: 5,
    threshold: 4000,
    holders: 18,
    benefits: ["명예의 전당 등재", "운영 피드백 우선 반영", "마스터 전용 혜택"],
  },
};

/** 낮은 등급부터 높은 등급 순으로 정렬된 배열(순회용) */
export const RANK_LIST: RankInfo[] = Object.values(RANKS).sort((a, b) => a.order - b.order);

/** 등급 키로 등급 정보를 찾는다. 없으면 undefined. */
export function resolveRank(tier: string): RankInfo | undefined {
  return RANKS[tier as RankTier];
}
