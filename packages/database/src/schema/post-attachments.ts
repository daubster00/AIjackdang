/**
 * 게시글 첨부파일(post_attachments) 스키마 — 게시글 본문 하단 다운로드 파일.
 *
 * 자료실 resource_files 와 달리 공개 버킷에 직접 저장하고 URL 로 바로 다운로드한다
 * (ClamAV 스캔 파이프라인 없음). 허용 확장자는 site_settings.file_allowed_extensions
 * (관리자 설정)로 제어한다. 파일당 10MB·게시글당 최대 5개.
 *
 * post 삭제 시 cascade. S3 실제 객체 삭제는 Epic 9 cleanup worker 소관.
 */

import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { posts } from "./posts";

export const postAttachments = pgTable(
  "post_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 소속 게시글 (삭제 시 cascade)
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),

    // 공개 버킷 다운로드 URL
    fileUrl: text("file_url").notNull(),

    // 원본 파일명 (확장자 포함, 다운로드 표시용)
    fileName: text("file_name").notNull(),

    // 파일 크기(byte)
    fileSize: integer("file_size").notNull(),

    // MIME 타입
    mimeType: text("mime_type").notNull(),

    // 표시 순서
    displayOrder: integer("display_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_attachments_post_id_idx").on(t.postId)],
);

export type PostAttachmentRow = typeof postAttachments.$inferSelect;
export type NewPostAttachmentRow = typeof postAttachments.$inferInsert;
