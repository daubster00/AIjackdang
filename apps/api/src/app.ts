import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { env } from "@ai-jakdang/config";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { healthRoutes } from "./routes/health";
import { v1Routes } from "./routes/v1/index";

/**
 * Fastify 인스턴스를 구성한다.
 * - 요청/응답 검증은 Zod(fastify-type-provider-zod)로 통일한다.
 * - 모든 서비스 API 는 /api/v1 버전 경로를 가진다.
 * - 환경변수는 @ai-jakdang/config 의 `env` 단일 진입점으로만 접근한다.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Zod 검증/직렬화 컴파일러 등록
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 공통 플러그인
  app.register(helmet);
  app.register(sensible);
  app.register(cors, {
    origin: [env.WEB_PUBLIC_URL, env.ADMIN_PUBLIC_URL],
    credentials: true,
  });

  // 라우트
  app.register(healthRoutes);
  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}
