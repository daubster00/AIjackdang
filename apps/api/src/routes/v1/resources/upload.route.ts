/**
 * 파일 업로드 라우트 — Story 4.5
 *
 * POST /api/v1/resources/:resourceId/files
 *
 * 인증 필수(401). 최대 3개 파일, 개당 50MB 제한.
 * multipart/form-data 요청을 수신하여 업로드 서비스로 위임.
 *
 * 성공: 201 { files: UploadedFileResult[] }
 * 실패 응답 코드:
 * - 400 INVALID_FILE_TYPE: 허용되지 않는 확장자
 * - 400 INVALID_FILE_SIGNATURE: 매직넘버 불일치
 * - 400 FILE_TOO_LARGE: 50MB 초과
 * - 400 TOO_MANY_FILES: 파일 3개 초과
 * - 401 UNAUTHORIZED: 인증 없음
 */

import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import {
  uploadResourceFiles,
  UploadValidationError,
  type UploadedFileData,
} from "./upload.service.js";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function registerResourceUploadRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/resources/:resourceId/files
   * 자료에 파일 첨부(업로드 보안 파이프라인)
   */
  app.post<{ Params: { resourceId: string } }>(
    "/resources/:resourceId/files",
    {
      preHandler: [requireAuthHook],
      config: {
        // @fastify/multipart per-route 설정: 50MB, 최대 3파일
        // app.ts 전역 5MB/1파일보다 넓은 제한을 라우트 핸들러에서 직접 처리
      },
    },
    async (request, reply) => {
      const { resourceId } = request.params;

      // multipart 스트림에서 파일들을 수집
      const uploadedFiles: UploadedFileData[] = [];

      try {
        const files = request.files({
          limits: {
            fileSize: MAX_FILE_SIZE,
            files: MAX_FILES,
          },
        });

        for await (const part of files) {
          // 파일 크기 초과 감지 (truncated 플래그)
          const chunks: Buffer[] = [];
          let totalSize = 0;
          let truncated = false;

          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > MAX_FILE_SIZE) {
              truncated = true;
              // 스트림 소진
              part.file.resume();
              break;
            }
            chunks.push(chunk as Buffer);
          }

          if (truncated) {
            return reply.status(400).send({
              error: {
                code: "FILE_TOO_LARGE",
                message: `파일 크기 초과: ${part.filename ?? "unknown"} (최대 50MB)`,
              },
            });
          }

          uploadedFiles.push({
            originalName: part.filename ?? "unknown",
            mimetype: part.mimetype,
            buffer: Buffer.concat(chunks),
            size: totalSize,
          });

          if (uploadedFiles.length > MAX_FILES) {
            return reply.status(400).send({
              error: {
                code: "TOO_MANY_FILES",
                message: `파일 최대 ${MAX_FILES}개까지 업로드 가능합니다.`,
              },
            });
          }
        }
      } catch (err) {
        // @fastify/multipart 파일 수 초과 에러
        const error = err as Error;
        if (error.message?.includes("limit") || error.message?.includes("files")) {
          return reply.status(400).send({
            error: {
              code: "TOO_MANY_FILES",
              message: `파일 최대 ${MAX_FILES}개까지 업로드 가능합니다.`,
            },
          });
        }
        throw err;
      }

      if (uploadedFiles.length === 0) {
        return reply.status(400).send({
          error: {
            code: "NO_FILES",
            message: "업로드할 파일이 없습니다.",
          },
        });
      }

      try {
        const results = await uploadResourceFiles(resourceId, uploadedFiles);
        return reply.status(201).send({ files: results });
      } catch (err) {
        if (err instanceof UploadValidationError) {
          return reply.status(400).send({
            error: {
              code: err.code,
              message: err.message,
            },
          });
        }
        throw err;
      }
    },
  );
}
