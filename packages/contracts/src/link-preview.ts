/**
 * link-preview Zod 스키마 — Story 8.6
 *
 * API 응답의 linkPreviews 필드 타입.
 * linkPreviewMapSchema: URL(string) → LinkPreviewItem 맵.
 */

import { z } from "zod";

export const linkPreviewItemSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  siteName: z.string().nullable(),
});

export type LinkPreviewItem = z.infer<typeof linkPreviewItemSchema>;

export const linkPreviewMapSchema = z.record(z.string(), linkPreviewItemSchema);

export type LinkPreviewMap = z.infer<typeof linkPreviewMapSchema>;
