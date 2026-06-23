import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/** 헬스체크 라우트. 배포/모니터링에서 서버 생존 확인에 사용한다. */
export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal("ok"),
            uptime: z.number(),
          }),
        },
      },
    },
    async () => ({ status: "ok" as const, uptime: process.uptime() }),
  );
}
