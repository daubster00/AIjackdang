/**
 * 봇 페르소나 시드 진입점 — Story 11.5
 *
 * 실행:
 *   pnpm seed:bots
 *   또는
 *   npx tsx scripts/seed-bots.ts
 *
 * 실제 로직은 packages/database/src/seeds/bots.ts 에 있습니다.
 * (Dev Notes: 스크립트 실행 환경에서 @ai-jakdang/database 패키지 심볼릭 링크가
 * 루트 node_modules에 없으므로, 상대 경로로 database 패키지 시드를 직접 호출합니다.)
 */

import { main } from "../packages/database/src/seeds/bots.js";

main().catch((err: unknown) => {
  console.error("[seed-bots] 실행 중 오류:", err);
  process.exit(1);
});
