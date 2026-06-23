import { z } from "zod";

/**
 * 공통 페이지네이션 요청 규격.
 * 모든 목록 API 가 동일한 형식을 사용한다.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** 목록 응답에 공통으로 붙는 메타 정보. */
export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** 페이지네이션된 목록 응답을 만드는 제네릭 헬퍼 스키마. */
export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    meta: paginationMetaSchema,
  });
}

/** 통일된 오류 응답 형식. 사용자 메시지와 내부 코드를 분리한다. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
