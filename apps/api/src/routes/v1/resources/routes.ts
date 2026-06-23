import type { FastifyInstance } from "fastify";

/**
 * /api/v1/resources 라우트 집계자 (Epic 4 실전자료).
 *
 * 병렬 개발을 위해 concern별 모듈 파일로 분리한다. 각 스토리는 자기 모듈
 * 파일(`*.route.ts` + 필요 시 `*.service.ts`)을 추가하고, 아래 두 영역에
 * 각각 한 줄씩만 더한다. 이렇게 하면 단일 거대 파일(resource.route.ts)에서의
 * add/add 머지 충돌을 피한다.
 *
 *  - list.route.ts     : GET /resources 목록 (Story 4.2)
 *  - detail.route.ts   : GET /resources/:slug 상세 (Story 4.3)
 *  - upload.route.ts   : 파일 업로드 파이프라인 (Story 4.5)
 *  - write.route.ts    : POST /resources 등록 (Story 4.4)
 *  - download.route.ts : 다운로드 (Story 4.6)
 *  - rating.route.ts   : 평점 (Story 4.7)
 *  - mutate.route.ts   : 수정/삭제 (Story 4.8)
 *
 * commentCount·후기수 등 Epic 5 의존 필드는 활성화 전까지 0 고정.
 */

// ── [STORY-IMPORTS] 각 스토리는 이 영역에 import 한 줄 추가 ──
import { registerResourceListRoutes } from "./list.route.js"; // Story 4.2
import { registerResourceDetailRoutes } from "./detail.route.js"; // Story 4.3
import { registerResourceUploadRoutes } from "./upload.route.js"; // Story 4.5
import { registerResourceWriteRoutes } from "./write.route.js"; // Story 4.4

export async function resourcesRoutes(app: FastifyInstance): Promise<void> {
  // ── [STORY-REGISTRATIONS] 각 스토리는 이 아래에 `await register...(app);` 한 줄 추가 ──
  await registerResourceListRoutes(app); // Story 4.2
  await registerResourceDetailRoutes(app); // Story 4.3
  await registerResourceUploadRoutes(app); // Story 4.5
  await registerResourceWriteRoutes(app); // Story 4.4
}
