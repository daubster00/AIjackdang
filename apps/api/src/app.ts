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
import { adminRoutes } from "./routes/admin/index.js";
import { toNodeHandler } from "better-auth/node";
import { adminAuthPlugin } from "./plugins/adminAuth.js";
import { adminGuardHook } from "./plugins/adminGuard.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(helmet);
  app.register(sensible);
  app.register(cors, {
    origin: [env.WEB_PUBLIC_URL, env.ADMIN_PUBLIC_URL],
    credentials: true,
  });

  app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: "1 hour",
  });

  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  const betterAuthHandler = toNodeHandler(userAuth);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/api/v1/auth/sign-in/email" && request.method === "POST") {
      const ip = request.ip;
      const key = "sign-in:" + ip;
      const limit = 10;
      const windowMs = 60 * 60 * 1000;

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
            message: "Too many login attempts. Please try again in 1 hour.",
          },
        });
        return;
      }
    }
  });

  app.register(async (authPlugin) => {
    authPlugin.removeContentTypeParser("application/json");
    authPlugin.addContentTypeParser(
      "application/json",
      (_req: FastifyRequest, payload: NodeJS.ReadableStream, done: (err: Error | null, result?: unknown) => void) => {
        done(null, payload);
      },
    );

    authPlugin.all("/api/v1/auth/*", async (request: FastifyRequest, reply: FastifyReply) => {
      await betterAuthHandler(request.raw, reply.raw);
    });
  });

  app.register(adminAuthPlugin);

  app.addHook("preHandler", adminGuardHook);

  app.register(healthRoutes);
  app.register(v1Routes, { prefix: "/api/v1" });
  app.register(adminRoutes, { prefix: "/api/v1" });

  return app;
}

const signInAttempts = new Map<string, { count: number; resetAt: number }>();
