/** 포인트·등급 도메인 규칙 (비시각적 공유 코드) */

/** 포인트를 부여하는 활동 유형. */
export type PointAction =
  | "post-created"
  | "answer-accepted"
  | "resource-uploaded"
  | "received-like";

/** 활동별 지급 포인트. 운영 로직에서 단일 출처로 사용한다. */
const POINT_TABLE: Record<PointAction, number> = {
  "post-created": 5,
  "answer-accepted": 20,
  "resource-uploaded": 15,
  "received-like": 1,
};

/** 활동에 대한 지급 포인트를 반환한다. */
export function pointsForAction(action: PointAction): number {
  return POINT_TABLE[action];
}

/** 회원 등급. 누적 포인트로 결정된다. */
export type MemberGrade = "seed" | "sprout" | "tree" | "forest";

const GRADE_THRESHOLDS: ReadonlyArray<{ grade: MemberGrade; min: number }> = [
  { grade: "forest", min: 1000 },
  { grade: "tree", min: 300 },
  { grade: "sprout", min: 50 },
  { grade: "seed", min: 0 },
];

/** 누적 포인트로 회원 등급을 계산한다. */
export function gradeForPoints(totalPoints: number): MemberGrade {
  const matched = GRADE_THRESHOLDS.find((entry) => totalPoints >= entry.min);
  return matched ? matched.grade : "seed";
}
