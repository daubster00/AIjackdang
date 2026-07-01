/**
 * 등급(grades) 시드 진입점 — 게이미피케이션 설정값.
 *
 * 실행:
 *   pnpm seed:grades
 *   또는
 *   npx tsx scripts/seed-grades.ts
 *
 * 5개 등급(새내기~마스터)은 설정값이므로 최초 배포 시 1회 시드한다(멱등).
 * 실제 로직은 packages/database/src/seeds/gamification.ts 에 있습니다.
 */

import { getDb } from "../packages/database/src/index.js";
import { seedGamification } from "../packages/database/src/seeds/gamification.js";

async function main(): Promise<void> {
  const db = getDb();
  await seedGamification(db);
  console.info("[seed-grades] 등급 시드 완료");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("[seed-grades] 실행 중 오류:", err);
    process.exit(1);
  });
