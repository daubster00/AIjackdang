import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { env } from "@ai-jakdang/config";
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { userAuth } from "./auth/user-auth.js";
import { healthRoutes } from "./routes/health";
import { v1Routes } from "./routes/v1/index";
import { toNodeHandler } from "better-auth/node";

/**
 * Fastify 인스턴스를 구성한다.
 * - 요청/응답 검증은 Zod(fastify-type-provider-zod)로 통일한다.
 * - 모든 서비스 API 는 /api/v1 버전 경로를 가진다.
 * - 환경변수는 @ai-jakdang/config 의 `env` 단일 진입점으로만 접근한다.
 * - Better Auth 핸들러는 /api/v1/auth/* 경로에 마운트된다.
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

  // Rate Limit 플러그인 등록 (AC #4)
  // global: false — 라우트별 개별 설정으로 관리
  app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 hour",
  });

  // 멀티파트(파일 업로드) — 아바타/배너. 최대 5MB. @fastify/multipart.
  // request.file() 로 단일 파일을 읽는다(Story 1.9 이미지 업로드).
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  // Better Auth 핸들러 마운트 (AC #1, #5, #6)
  // /api/v1/auth/* 경로를 Better Auth Node 핸들러에 위임한다.
  const betterAuthHandler = toNodeHandler(userAuth);

  // 로그인 rate limit (AC #4): IP당 10회/시간
  // /api/v1/auth/sign-in/email 경로에만 적용
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/api/v1/auth/sign-in/email" && request.method === "POST") {
      const ip = request.ip;
      const key = `sign-in:${ip}`;
      const limit = 10;
      const windowMs = 60 * 60 * 1000; // 1 hour

      // In-memory rate limiter (간단 구현; 프로덕션에서는 Redis 사용)
      const now = Date.now();
      if (!signInAttempts.has(key)) {
        signInAttempts.set(key, { count: 0, resetAt: now + windowMs });
      }
      const entry = signInAttempts.get(key)!;
      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
      }
      entry.count++;
      if (entry.count > limit) {
        reply.code(429).send({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "로그인 시도 횟수를 초과했습니다. 1시간 후 다시 시도해 주세요.",
          },
        });
        return;
      }
    }
  });

  // Better Auth가 처리하는 /api/v1/auth/* 모두 위임 (AC #1, #5, #6)
  //
  // 중요: Better Auth(better-call)는 raw Node.js IncomingMessage stream에서 body를 직접 읽는다.
  // Fastify가 body를 미리 파싱하면 stream이 소모되어 Better Auth가 읽지 못한다.
  // 해결: Better Auth 경로를 서브 플러그인으로 분리하여 body 파싱 전에 처리한다.
  app.register(async (authPlugin) => {
    // auth 경로 전용: JSON 파서를 no-op으로 대체 (stream 소비 방지)
    authPlugin.removeContentTypeParser("application/json");
    authPlugin.addContentTypeParser(
      "application/json",
      (_req: FastifyRequest, payload: NodeJS.ReadableStream, done: (err: Error | null, result?: unknown) => void) => {
        done(null, payload); // raw stream 통과 — Better Auth가 직접 읽음
      },
    );

    authPlugin.all("/api/v1/auth/*", async (request: FastifyRequest, reply: FastifyReply) => {
      await betterAuthHandler(request.raw, reply.raw);
    });
  });

  // 라우트
  app.register(healthRoutes);
  app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

/** 로그인 rate limit 추적 맵 (in-memory, 개발/단일 인스턴스용) */
const signInAttempts = new Map<string, { count: number; resetAt: number }>();
