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
import {
  uploadImage,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage/index.js";

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
  favicon_url: z.string().max(500).optional(),
  // 사업자 정보 (푸터 노출용) — 빈 문자열 허용(미노출 처리)
  company_name: z.string().max(100).optional(),
  representative_name: z.string().max(50).optional(),
  business_registration_number: z.string().max(50).optional(),
  mail_order_sales_number: z.string().max(100).optional(),
  business_address: z.string().max(300).optional(),
  business_phone: z.string().max(50).optional(),
  business_email: z.string().max(100).optional(),
  auto_hide_enabled: z.boolean().optional(),
  auto_hide_threshold: z.number().int().min(1).max(1000).optional(),
  // [12.4] 신고 누적 자동경고 — 임계치(기본 5)·자동경고 활성화(기본 false)
  report_escalation_threshold: z.number().int().min(1).max(1000).optional(),
  report_auto_warning_enabled: z.boolean().optional(),
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

  // ── POST /api/v1/admin/settings/upload-image ─────────────────────────────────
  // OG 이미지·파비콘 등 사이트 설정용 이미지를 업로드하고 URL을 반환한다.
  // multipart 플러그인은 app.ts에서 전역 등록됨.
  app.post(
    "/admin/settings/upload-image",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const reqWithFile = request as typeof request & {
        isMultipart?: () => boolean;
        file?: () => Promise<
          | {
              filename: string;
              mimetype: string;
              file: { truncated: boolean };
              toBuffer: () => Promise<Buffer>;
            }
          | undefined
        >;
      };

      if (!reqWithFile.isMultipart?.()) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CONTENT_TYPE",
            message: "multipart/form-data 형식으로 전송해주세요.",
          },
        });
      }

      const part = await reqWithFile.file?.();
      if (!part) {
        return reply.status(400).send({
          error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." },
        });
      }

      if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_FILE_TYPE",
            message: "jpg·png·webp·gif 형식만 허용됩니다.",
          },
        });
      }

      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
        return reply.status(400).send({
          error: {
            code: "FILE_TOO_LARGE",
            message: "파일 크기는 5MB 이하여야 합니다.",
          },
        });
      }

      try {
        const result = await uploadImage(
          { filename: part.filename, mimetype: part.mimetype, data: buffer },
          "editor-images",
        );
        return reply.send({ url: result.url });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "이미지 업로드에 실패했습니다." },
        });
      }
    },
  );
}
