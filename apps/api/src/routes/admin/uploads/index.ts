/**
 * 관리자 에디터 인라인 이미지 업로드 API.
 *
 * POST /api/v1/admin/uploads/editor-image — 관리자 Tiptap 에디터 이미지 업로드.
 *
 * 사용자 사이트의 /api/v1/users/uploads/editor-image 는 일반 사용자 세션
 * (requireAuthHook)을 요구하므로, 관리자 세션(aj_admin_session)만 가진
 * 관리자 앱에서는 401이 난다. 따라서 관리자 전용 경로를 별도로 둔다.
 *
 * 가드: app.ts 의 전역 adminGuardHook 이 /api/v1/admin/* 전체를 검증하므로
 * (활성 관리자 세션 필수) 여기서는 추가 preHandler 없이 등록한다.
 * super_admin 제한을 두지 않아 staff 관리자도 게시글 작성 시 이미지를 넣을 수 있다.
 */

import type { FastifyInstance } from "fastify";
import {
  uploadImage,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage/index.js";

export async function registerAdminUploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/admin/uploads/editor-image", async (request, reply) => {
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
  });
}
