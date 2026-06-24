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

const PUBLIC_SETTING_KEYS = ["site_name", "seo_title", "seo_description", "og_image"] as const;

export async function registerPublicSiteSettingsRoute(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/settings/public", async (_request, reply) => {
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
