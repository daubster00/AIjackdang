/**
 * 게이미피케이션 시드 데이터 — grades 5개.
 *
 * 멱등 실행 가능: onConflictDoNothing 으로 중복 삽입 무시.
 * 실행: ts-node -e "import('./seeds/gamification').then(m => m.seedGamification(db))"
 *       또는 메인 seed 스크립트에서 import 후 호출.
 *
 * (업적 뱃지 시드는 수정요청으로 제거됨 — 마이그 0023.)
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { grades } from "../schema/gamification";

// ── grades 시드 ───────────────────────────────────────────────────────────────

const GRADES_SEED = [
  { level: 1, name: "새내기", minPoints: 0,    maxPoints: 99   },
  { level: 2, name: "작당원", minPoints: 100,  maxPoints: 499  },
  { level: 3, name: "실전러", minPoints: 500,  maxPoints: 1499 },
  { level: 4, name: "고수",   minPoints: 1500, maxPoints: 2999 },
  { level: 5, name: "마스터", minPoints: 3000, maxPoints: null },
] as const;

// ── 시드 함수 ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedGamification(db: NodePgDatabase<any>): Promise<void> {
  // grades 삽입 (level 충돌 시 무시 — 멱등)
  await db
    .insert(grades)
    .values(GRADES_SEED.map((g) => ({ ...g, maxPoints: g.maxPoints ?? null })))
    .onConflictDoNothing();
}
