/**
 * 공개 사이트 설정 조회 라우트 (Story 9.15).
 *
 * GET /api/v1/settings/public — 인증 없이 공개 가능한 SEO/메타 설정만 반환.
 * apps/web/app/layout.tsx 의 generateMetadata()가 서버사이드 fetch로 사용한다.
 *
 * 반환 키: site_name, seo_title, seo_description
 * (og_image 등 추가 필요 시 확장)
 *
 * 등록: apps/api/src/routes/v1/index.ts 에
 *   import { registerPublicSiteSettingsRoute } from "./site-settings-public.js";
 *   await registerPublicSiteSettingsRoute(app);
 * 를 추가해야 한다. (오케스트레이터가 처리)
 */

import type { FastifyInstance } from "fastify";
import { getSiteSetting } from "../../lib/siteSettings.js";

const PUBLIC_SETTING_KEYS = [
  "site_name",
  "operator_email",
  "seo_title",
  "seo_description",
  "og_image",
  "favicon_url",
  "file_allowed_extensions",
  "resource_extensions",
  "image_extensions",
  "max_upload_mb",
  // 사업자 정보 (푸터 노출용) — 공개 정보라 인증 없이 반환
  "company_name",
  "representative_name",
  "business_registration_number",
  "mail_order_sales_number",
  "business_address",
  "business_phone",
  "business_email",
] as const;

export async function registerPublicSiteSettingsRoute(app: FastifyInstance): Promise<void> {
  // 이 함수는 v1Routes(prefix "/api/v1") 스코프 안에서 호출되므로 상대 경로로 등록해야 한다.
  // 절대경로("/api/v1/settings/public")로 등록하면 prefix가 한 번 더 붙어
  // /api/v1/api/v1/settings/public 이 되어 404(이중 prefix 버그)가 난다.
  app.get("/settings/public", async (_request, reply) => {
    try {
      const entries = await Promise.all(
        PUBLIC_SETTING_KEYS.map(async (key) => {
          const value = await getSiteSetting<string>(key);
          return [key, value] as const;
        }),
      );
      const result = Object.fromEntries(entries);
      return reply.send(result);
    } catch (err) {
      _request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      });
    }
  });
}
