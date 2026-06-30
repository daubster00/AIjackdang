/**
 * 관리자 본인 계정(셀프 프로필) 조회·수정 API.
 *
 * GET   /api/v1/admin/account/me  — 로그인한 관리자 본인 정보(name·email·phone·role) 조회
 * PATCH /api/v1/admin/account/me  — 본인 name·phone 수정
 *
 * adminGuardHook 이후 실행되므로 request.adminSession.adminUserId 가 존재한다.
 * (BetterAuth get-session 과 달리 일반 Fastify 라우트라 @fastify/cors 가 정상 적용된다.)
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  uploadImage,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage/index.js";

export async function registerAdminAccountRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/admin/account/me ────────────────────────────────────────────
  app.get("/admin/account/me", async (request, reply) => {
    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." } });
    }

    const db = getDb();
    const [row] = await db
      .select({
        id: schema.adminUsers.id,
        name: schema.adminUsers.name,
        email: schema.adminUsers.email,
        phone: schema.adminUsers.phone,
        role: schema.adminUsers.role,
        status: schema.adminUsers.status,
        image: schema.adminUsers.image,
      })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, adminUserId))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "관리자 계정을 찾을 수 없습니다." } });
    }

    return reply.send({ admin: row });
  });

  // ── PATCH /api/v1/admin/account/me ──────────────────────────────────────────
  app.patch("/admin/account/me", async (request, reply) => {
    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." } });
    }

    const body = (request.body ?? {}) as { name?: unknown; phone?: unknown; imageUrl?: unknown };
    const patch: { name?: string; phone?: string; image?: string | null; updatedAt: Date } = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "이름을 입력해 주세요." } });
      }
      patch.name = name;
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      if (phone.length < 1) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "연락처를 입력해 주세요." } });
      }
      patch.phone = phone;
    }
    if (body.imageUrl !== undefined) {
      patch.image = typeof body.imageUrl === "string" ? body.imageUrl || null : null;
    }

    const db = getDb();
    const [updated] = await db
      .update(schema.adminUsers)
      .set(patch)
      .where(eq(schema.adminUsers.id, adminUserId))
      .returning({
        id: schema.adminUsers.id,
        name: schema.adminUsers.name,
        email: schema.adminUsers.email,
        phone: schema.adminUsers.phone,
        role: schema.adminUsers.role,
        status: schema.adminUsers.status,
        image: schema.adminUsers.image,
      });

    if (!updated) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "관리자 계정을 찾을 수 없습니다." } });
    }

    return reply.send({ admin: updated });
  });

  // ── POST /api/v1/admin/account/upload-image ──────────────────────────────────
  // 관리자 프로필 이미지를 MinIO(avatars 버킷)에 업로드하고 URL 을 반환한다.
  // multipart 플러그인은 app.ts 에서 전역 등록됨.
  app.post("/admin/account/upload-image", async (request, reply) => {
    const adminUserId = request.adminSession?.adminUserId;
    if (!adminUserId) {
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." } });
    }

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
        error: { code: "INVALID_CONTENT_TYPE", message: "multipart/form-data 형식으로 전송해주세요." },
      });
    }

    const part = await reqWithFile.file?.();
    if (!part) {
      return reply.status(400).send({ error: { code: "NO_FILE", message: "업로드할 파일이 없습니다." } });
    }

    if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
      return reply.status(400).send({
        error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." },
      });
    }

    const buffer = await part.toBuffer();
    if (part.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
      return reply.status(400).send({
        error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." },
      });
    }

    try {
      const result = await uploadImage(
        { filename: part.filename, mimetype: part.mimetype, data: buffer },
        "avatars",
      );
      return reply.status(200).send({ url: result.url });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "이미지 업로드에 실패했습니다." },
      });
    }
  });
}
