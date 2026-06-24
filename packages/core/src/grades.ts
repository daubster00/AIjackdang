/**
 * 등급 도메인 순수 함수 — Epic 6.
 *
 * DB 미참조. 호출자가 grades 배열을 DB에서 조회하여 주입한다.
 * GradeRow 는 DB grades 테이블의 camelCase 매핑.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

/** grades 테이블 Row 의 camelCase 미러. */
export interface GradeRow {
  id: string;
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

// ── 함수 ──────────────────────────────────────────────────────────────────────

/**
 * 누적 포인트에 해당하는 등급을 반환한다.
 * grades 를 level 내림차순으로 정렬 후 `minPoints <= totalPoints` 인 첫 항목.
 * 매칭이 없으면(grades 가 비어 있거나 모두 불충족 시) 마지막(최저) 등급을 반환한다.
 */
export function gradeForPoints(totalPoints: number, grades: GradeRow[]): GradeRow {
  if (grades.length === 0) {
    throw new Error("grades 배열이 비어 있습니다.");
  }

  const sorted = [...grades].sort((a, b) => b.level - a.level);
  const matched = sorted.find((g) => totalPoints >= g.minPoints);

  // 점수가 최저 등급 minPoints 미만이어도 최저 등급 반환
  return matched ?? sorted[sorted.length - 1];
}

/**
 * 다음 등급을 반환한다. 최고 등급이면 null.
 * current.level + 1 인 등급을 grades 에서 찾는다.
 */
export function nextGrade(current: GradeRow, grades: GradeRow[]): GradeRow | null {
  return grades.find((g) => g.level === current.level + 1) ?? null;
}

/**
 * 다음 등급까지 필요한 포인트 수를 반환한다.
 * 다음 등급이 없으면(최고 등급이면) null.
 */
export function pointsToNextGrade(totalPoints: number, grades: GradeRow[]): number | null {
  const current = gradeForPoints(totalPoints, grades);
  const next = nextGrade(current, grades);

  if (next === null) {
    return null;
  }

  return Math.max(0, next.minPoints - totalPoints);
}
