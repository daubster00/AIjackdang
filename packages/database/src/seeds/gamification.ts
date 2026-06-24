/**
 * 게이미피케이션 시드 데이터 — grades 5개 + badges 7개.
 *
 * 멱등 실행 가능: onConflictDoNothing 으로 중복 삽입 무시.
 * 실행: ts-node -e "import('./seeds/gamification').then(m => m.seedGamification(db))"
 *       또는 메인 seed 스크립트에서 import 후 호출.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { badges, grades } from "../schema/gamification";

// ── grades 시드 ───────────────────────────────────────────────────────────────

const GRADES_SEED = [
  { level: 1, name: "새내기", minPoints: 0,    maxPoints: 99   },
  { level: 2, name: "작당원", minPoints: 100,  maxPoints: 499  },
  { level: 3, name: "실전러", minPoints: 500,  maxPoints: 1499 },
  { level: 4, name: "고수",   minPoints: 1500, maxPoints: 2999 },
  { level: 5, name: "마스터", minPoints: 3000, maxPoints: null },
] as const;

// ── badges 시드 ───────────────────────────────────────────────────────────────

const BADGES_SEED = [
  {
    slug: "first-post",
    name: "첫 글",
    description: "처음으로 글을 작성했습니다.",
    iconUrl: "/badges/first-post.svg",
    isAuto: true,
  },
  {
    slug: "resource-contributor",
    name: "자료 기여자",
    description: "자료를 처음으로 등록했습니다.",
    iconUrl: "/badges/resource-contributor.svg",
    isAuto: true,
  },
  {
    slug: "popular-resource",
    name: "인기 자료",
    description: "자료 다운로드 수 50회 이상을 달성했습니다.",
    iconUrl: "/badges/popular-resource.svg",
    isAuto: true,
  },
  {
    slug: "popular-post",
    name: "인기글",
    description: "게시글 좋아요 수 20개 이상을 달성했습니다.",
    iconUrl: "/badges/popular-post.svg",
    isAuto: true,
  },
  {
    slug: "answer-pro",
    name: "답변러",
    description: "답변 수 5개 이상을 달성했습니다.",
    iconUrl: "/badges/answer-pro.svg",
    isAuto: true,
  },
  {
    slug: "consistent",
    name: "꾸준러",
    description: "4주 연속 활동을 달성했습니다.",
    iconUrl: "/badges/consistent.svg",
    isAuto: true,
  },
  {
    slug: "admin-special",
    name: "운영자 수여",
    description: "운영자가 특별히 수여한 뱃지입니다.",
    iconUrl: "/badges/admin-special.svg",
    isAuto: false,
  },
] as const;

// ── 시드 함수 ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedGamification(db: NodePgDatabase<any>): Promise<void> {
  // grades 삽입 (level 충돌 시 무시 — 멱등)
  await db
    .insert(grades)
    .values(GRADES_SEED.map((g) => ({ ...g, maxPoints: g.maxPoints ?? null })))
    .onConflictDoNothing();

  // badges 삽입 (slug 충돌 시 무시 — 멱등)
  await db
    .insert(badges)
    .values(BADGES_SEED.map((b) => ({ ...b })))
    .onConflictDoNothing();
}
