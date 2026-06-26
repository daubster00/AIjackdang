/**
 * 사이트 설정 관리 API (Story 9.15).
 *
 * GET  /api/v1/admin/settings — 전체 설정 조회 (super_admin 전용)
 * PATCH /api/v1/admin/settings — 변경된 키 UPSERT (super_admin 전용)
 *
 * 두 라우트 모두 requireSuperAdmin preHandler 적용 → staff는 403.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "@ai-jakdang/database";
import { siteSettings } from "@ai-jakdang/database/schema";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import {
  getAllSiteSettings,
  invalidateSiteSetting,
} from "../../../lib/siteSettings.js";

/**
 * 사이트 설정 PATCH 스키마 (로컬 정의).
 * 오케스트레이터가 packages/contracts/src/index.ts 에 settings 를 export 한 후
 * `import { adminSettingsPatchSchema } from "@ai-jakdang/contracts"` 로 교체 가능.
 */
const adminSettingsPatchSchema = z.object({
  site_name: z.string().min(1).max(100).optional(),
  operator_email: z.string().email().optional(),
  site_description: z.string().max(500).optional(),
  seo_title: z.string().max(100).optional(),
  seo_description: z.string().max(300).optional(),
  og_image: z.string().max(500).optional(),
  auto_hide_enabled: z.boolean().optional(),
  auto_hide_threshold: z.number().int().min(1).max(1000).optional(),
  report_reasons: z.array(z.string().min(1).max(50)).optional(),
  forbidden_words: z.array(z.string().min(1).max(100)).optional(),
  content_retention_days: z.number().int().min(1).max(36500).optional(),
  popular_post_metric: z.string().max(50).optional(),
  popular_resource_metric: z.string().max(50).optional(),
  file_allowed_extensions: z.string().max(500).optional(),
  max_upload_mb: z.number().int().min(1).max(1000).optional(),
  image_extensions: z.string().max(500).optional(),
  resource_extensions: z.string().max(500).optional(),
});

export async function registerAdminSettingsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/settings ───────────────────────────────────────────────
  app.get(
    "/admin/settings",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      try {
        const settings = await getAllSiteSettings();
        return reply.send(settings);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── PATCH /api/v1/admin/settings ────────────────────────────────────────────
  app.patch(
    "/admin/settings",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminSettingsPatchSchema.safeParse(request.body);
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
      const entries = Object.entries(body) as [string, unknown][];

      if (entries.length === 0) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "변경할 설정이 없습니다." },
        });
      }

      const db = getDb();
      const now = new Date();
      const updatedKeys: string[] = [];

      for (const [key, value] of entries) {
        await db
          .insert(siteSettings)
          .values({ key, value, updatedAt: now })
          .onConflictDoUpdate({
            target: siteSettings.key,
            set: { value, updatedAt: now },
          });
        await invalidateSiteSetting(key);
        updatedKeys.push(key);
      }

      return reply.send({ updated: updatedKeys });
    },
  );
}
