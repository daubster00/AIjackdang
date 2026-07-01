/**
 * 봇 전역 설정 관리 API — Story 11.16 Task 2
 *
 * GET   /api/v1/admin/bots/settings  — bot_settings(봇 전역 설정) 테이블 전체를 flat 객체로 반환
 * PATCH /api/v1/admin/bots/settings  — 전달된 키만 UPSERT + Redis 캐시 무효화
 *
 * 모든 라우트: requireSuperAdmin 전용 (staff → 403).
 *
 * 이중 prefix 주의: 등록 경로는 "/admin/bots/settings" (prefix 없음).
 * app.ts가 /api/v1 prefix를 부여하여 최종 /api/v1/admin/bots/settings 가 됨.
 *
 * [Source: _bmad-output/implementation-artifacts/11-16-operations-panel.md#Task2]
 * [Source: apps/api/src/routes/admin/settings/index.ts — requireSuperAdmin 패턴]
 * [Source: apps/api/src/lib/botSettings.ts — getAllBotSettings·setBotSetting]
 */

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  botSettingsPatchSchema,
} from "@ai-jakdang/contracts";
import {
  getAllBotSettings,
  setBotSetting,
} from "../../../lib/botSettings.js";

export async function registerAdminBotSettingsRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /api/v1/admin/bots/settings ─────────────────────────────────────────
  //    bot_settings 전체 flat 객체 반환 (requireSuperAdmin)
  app.get(
    "/admin/bots/settings",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        const settings = await getAllBotSettings();
        return reply.send(settings);
      } catch (err) {
        request.log.error(err, "[bot-settings] 전체 설정 조회 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── PATCH /api/v1/admin/bots/settings ───────────────────────────────────────
  //    전달된 키만 UPSERT + Redis 캐시 무효화 (requireSuperAdmin)
  app.patch(
    "/admin/bots/settings",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = botSettingsPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "잘못된 설정 값입니다.",
            details: parsed.error.flatten(),
          },
        });
      }

      const body = parsed.data;
      const entries = Object.entries(body).filter(
        ([, v]) => v !== undefined,
      ) as [string, unknown][];

      if (entries.length === 0) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "변경할 설정이 없습니다." },
        });
      }

      const updatedKeys: string[] = [];
      for (const [key, value] of entries) {
        // setBotSetting은 upsert + invalidateBotSetting 내부 호출 포함
        await setBotSetting(key, value);
        updatedKeys.push(key);
      }

      return reply.send({ ok: true, updated: updatedKeys });
    },
  );
}
