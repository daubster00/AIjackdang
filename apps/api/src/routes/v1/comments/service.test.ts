/**
 * 댓글 생성 서비스 단위 테스트 — Story 11.3 AC#3
 *
 * createComment 핵심 불변식 4종:
 * 1. 빈 content → CommentServiceError("VALIDATION_ERROR") throw
 * 2. 존재하지 않는 parentId → CommentServiceError("VALIDATION_ERROR") throw
 * 3. 2단계 중첩 parentId(parent.parentId가 null이 아님) → CommentServiceError("NESTING_NOT_ALLOWED") throw
 * 4. 정상 입력 → INSERT 호출 + earnPoints + 알림 큐 add 호출
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── getNotificationsQueue 모킹 ────────────────────────────────────────────────
vi.mock("../../../lib/queues.js", () => ({
  getNotificationsQueue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: "mock-job" }),
  })),
}));

// ── 포인트 서비스 모킹 ────────────────────────────────────────────────────────
vi.mock("../gamification/points.service.js", () => ({
  getTodayCount: vi.fn().mockResolvedValue(0),
  earnPoints: vi.fn().mockResolvedValue(true),
}));

// ── drizzle-orm 연산자 모킹 ───────────────────────────────────────────────────
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
}));

// ── @ai-jakdang/database 모킹 ─────────────────────────────────────────────────
// 테스트 간 상태를 공유하는 변수
let mockParentRow: { id: string; parentId: string | null; authorId: string } | null = null;
let mockInsertedId = "inserted-comment-id";

vi.mock("@ai-jakdang/database", () => {
  const makeDb = () => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (mockParentRow ? [mockParentRow] : [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: mockInsertedId }]),
      })),
    })),
  });

  return {
    getDb: vi.fn(() => makeDb()),
    schema: {
      comments: {
        id: "id",
        parentId: "parent_id",
        authorId: "author_id",
        targetType: "target_type",
        targetId: "target_id",
        content: "content",
      },
    },
  };
});

// ── 테스트 대상 import ─────────────────────────────────────────────────────────
// vi.mock 이후에 import해야 모킹이 적용됨
import { createComment, CommentServiceError } from "./service.js";
import { getNotificationsQueue } from "../../../lib/queues.js";
import { earnPoints, getTodayCount } from "../gamification/points.service.js";

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("createComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParentRow = null;
    mockInsertedId = "inserted-comment-id";

    // 기본 mock 복원
    vi.mocked(getTodayCount).mockResolvedValue(0);
    vi.mocked(earnPoints).mockResolvedValue(true);
    vi.mocked(getNotificationsQueue).mockReturnValue({
      add: vi.fn().mockResolvedValue({ id: "mock-job" }),
    } as never);
  });

  // ── 불변식 1: 빈/공백 내용 차단 ─────────────────────────────────────────────
  it("빈 content → CommentServiceError(VALIDATION_ERROR) throw", async () => {
    await expect(
      createComment({
        userId: "user-1",
        targetType: "post",
        targetId: "target-uuid-1",
        content: "",
      }),
    ).rejects.toMatchObject({
      name: "CommentServiceError",
      code: "VALIDATION_ERROR",
      message: "댓글 내용을 입력해주세요.",
    });
  });

  it("공백만 있는 content → CommentServiceError(VALIDATION_ERROR) throw", async () => {
    await expect(
      createComment({
        userId: "user-1",
        targetType: "post",
        targetId: "target-uuid-1",
        content: "   ",
      }),
    ).rejects.toBeInstanceOf(CommentServiceError);
  });

  // ── 불변식 2-a: 존재하지 않는 parentId ───────────────────────────────────────
  it("존재하지 않는 parentId → CommentServiceError(VALIDATION_ERROR) throw", async () => {
    mockParentRow = null; // DB에 부모 댓글 없음

    await expect(
      createComment({
        userId: "user-1",
        targetType: "post",
        targetId: "target-uuid-1",
        content: "테스트 댓글",
        parentId: "nonexistent-parent-id",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "부모 댓글을 찾을 수 없습니다.",
    });
  });

  // ── 불변식 2-b: 2단계 대댓글 차단 ───────────────────────────────────────────
  it("2단계 중첩 parentId(parent.parentId !== null) → CommentServiceError(NESTING_NOT_ALLOWED) throw", async () => {
    mockParentRow = {
      id: "parent-comment-1",
      parentId: "grandparent-comment-1", // null이 아님 → 이미 대댓글 → 중첩 불가
      authorId: "author-uuid-1",
    };

    await expect(
      createComment({
        userId: "user-1",
        targetType: "post",
        targetId: "target-uuid-1",
        content: "대댓글의 대댓글 시도",
        parentId: "parent-comment-1",
      }),
    ).rejects.toMatchObject({
      code: "NESTING_NOT_ALLOWED",
      message: "2단계 이상의 대댓글은 허용되지 않습니다.",
    });
  });

  // ── 불변식 3·4·5: 정상 입력 ──────────────────────────────────────────────────
  it("정상 입력 → INSERT 호출 + earnPoints + 알림 큐 add 호출", async () => {
    const mockQueueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
    vi.mocked(getNotificationsQueue).mockReturnValue({ add: mockQueueAdd } as never);

    const result = await createComment({
      userId: "user-1",
      targetType: "post",
      targetId: "target-uuid-1",
      content: "정상적인 댓글입니다.",
    });

    // 반환값 확인
    expect(result.id).toBe("inserted-comment-id");
    expect(result.parentCommentAuthorId).toBeNull();

    // 불변식 4: 포인트 적립 호출 확인
    expect(getTodayCount).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "user-1", reason: "comment.created" },
    );
    expect(earnPoints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-1",
        reason: "comment.created",
        sourceType: "comment",
        sourceId: "inserted-comment-id",
      }),
    );

    // 불변식 5: 알림 큐 add 호출 확인
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "comment.created",
      expect.objectContaining({
        commentId: "inserted-comment-id",
        authorId: "user-1",
        targetType: "post",
        targetId: "target-uuid-1",
      }),
    );
    // parentCommentAuthorId가 없으면 큐 페이로드에 포함되지 않아야 함
    const queuePayload = mockQueueAdd.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(queuePayload).not.toHaveProperty("parentCommentAuthorId");
  });

  it("대댓글 정상 입력 → parentCommentAuthorId가 결과 및 큐 페이로드에 포함됨", async () => {
    mockParentRow = {
      id: "parent-comment-1",
      parentId: null, // 최상위 댓글 → 대댓글 가능
      authorId: "parent-author-uuid",
    };

    const mockQueueAdd = vi.fn().mockResolvedValue({ id: "job-2" });
    vi.mocked(getNotificationsQueue).mockReturnValue({ add: mockQueueAdd } as never);

    const result = await createComment({
      userId: "user-2",
      targetType: "post",
      targetId: "target-uuid-1",
      content: "대댓글 내용",
      parentId: "parent-comment-1",
    });

    expect(result.id).toBe("inserted-comment-id");
    expect(result.parentCommentAuthorId).toBe("parent-author-uuid");

    // parentCommentAuthorId가 큐 페이로드에 포함돼야 함 (conditional spread 보존)
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "comment.created",
      expect.objectContaining({
        parentCommentAuthorId: "parent-author-uuid",
      }),
    );
  });

  it("포인트 적립 실패해도 댓글 id를 반환한다 (best-effort)", async () => {
    vi.mocked(earnPoints).mockRejectedValue(new Error("points DB error"));

    const result = await createComment({
      userId: "user-1",
      targetType: "post",
      targetId: "target-uuid-1",
      content: "포인트 실패 테스트",
    });

    // 포인트 실패해도 댓글 id 반환
    expect(result.id).toBe("inserted-comment-id");
  });
});
