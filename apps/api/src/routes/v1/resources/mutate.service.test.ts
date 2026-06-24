/**
 * mutate.service.ts 단위 테스트 — Story 4.8
 *
 * DB를 실제로 사용하지 않고 getDb를 모킹하여 서비스 로직을 검증한다.
 *
 * 검증 항목:
 * - updateResource: 소유권 확인(403) · 미존재(404) · 정상 수정
 * - deleteResource: 소유권 확인(403) · 미존재(404) · soft-delete 실행
 * - getMyResources: 본인 자료만 반환 · deleted 제외 · 상태 필터
 *
 * vitest 호이스팅 규칙: vi.mock 팩터리 내 외부 변수 참조 금지.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ── drizzle-orm 모킹 ──────────────────────────────────────────────────────────
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: "inArray", col, vals })),
}));

// ── DB mock 팩토리 ────────────────────────────────────────────────────────────

/** select().from().where().limit() 체인을 만든다 */
function makeSelectChain(returnValue: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(returnValue);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));
  return { selectMock, fromMock, whereMock, limitMock };
}

/** update().set().where() 체인을 만든다 */
function makeUpdateChain(returnValue?: unknown[]) {
  const returningMock = returnValue
    ? vi.fn().mockResolvedValue(returnValue)
    : undefined;
  const whereMock = returningMock
    ? vi.fn(() => ({ returning: returningMock }))
    : vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  return { updateMock, setMock, whereMock, returningMock };
}

// ── @ai-jakdang/database 모킹 ────────────────────────────────────────────────

let mockDb: {
  select: Mock;
  update: Mock;
  transaction: Mock;
};

vi.mock("@ai-jakdang/database", () => {
  return {
    getDb: vi.fn(() => mockDb),
    schema: {
      resources: {
        id: "resources.id",
        userId: "resources.userId",
        slug: "resources.slug",
        resourceType: "resources.resourceType",
        status: "resources.status",
        updatedAt: "resources.updatedAt",
        deletedAt: "resources.deletedAt",
      },
      resourceFiles: {
        id: "resourceFiles.id",
        resourceId: "resourceFiles.resourceId",
        fileStatus: "resourceFiles.fileStatus",
      },
      pointsLedger: {
        id: "pointsLedger.id",
        userId: "pointsLedger.userId",
        reason: "pointsLedger.reason",
        sourceType: "pointsLedger.sourceType",
        sourceId: "pointsLedger.sourceId",
        delta: "pointsLedger.delta",
        createdAt: "pointsLedger.createdAt",
      },
    },
  };
});

// ── gamification points.service 모킹 (mutate.service가 import) ───────────────
vi.mock("../gamification/points.service.js", () => ({
  revokePoints: vi.fn().mockResolvedValue(true),
  earnPoints: vi.fn().mockResolvedValue(true),
  getTodayCount: vi.fn().mockResolvedValue(0),
}));

// ── 테스트 임포트 (vi.mock 이후) ─────────────────────────────────────────────
// dynamic import 사용 (호이스팅 회피)
const { updateResource, deleteResource, MutateServiceError } = await import(
  "./mutate.service.js"
);

// ── 테스트 픽스처 ─────────────────────────────────────────────────────────────

const OWNER_ID = "user-owner-uuid";
const OTHER_ID = "user-other-uuid";
const RESOURCE_ID = "resource-uuid";

const publishedResource = {
  id: RESOURCE_ID,
  userId: OWNER_ID,
  slug: "test-resource",
  resourceType: "prompt",
  status: "published",
};

const deletedResource = {
  id: RESOURCE_ID,
  userId: OWNER_ID,
  status: "deleted",
};

// ── updateResource 테스트 ─────────────────────────────────────────────────────

describe("updateResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("존재하지 않는 자료 → 404 RESOURCE_NOT_FOUND", async () => {
    const { selectMock } = makeSelectChain([]);
    const { updateMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      transaction: vi.fn(),
    };

    await expect(updateResource(RESOURCE_ID, OWNER_ID, {})).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("deleted 자료 → 404 RESOURCE_NOT_FOUND", async () => {
    const { selectMock } = makeSelectChain([deletedResource]);
    const { updateMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      transaction: vi.fn(),
    };

    await expect(updateResource(RESOURCE_ID, OWNER_ID, {})).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("비소유자 수정 시도 → 403 FORBIDDEN", async () => {
    const { selectMock } = makeSelectChain([publishedResource]);
    const { updateMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      transaction: vi.fn(),
    };

    await expect(updateResource(RESOURCE_ID, OTHER_ID, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("소유자 수정 → 정상 반환", async () => {
    const updatedResult = {
      id: RESOURCE_ID,
      slug: "updated-slug",
      resourceType: "prompt",
      status: "published",
    };

    const { selectMock } = makeSelectChain([publishedResource]);
    // transaction은 콜백을 실행하는 방식으로 모킹
    const transactionMock = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: makeUpdateChain([updatedResult]).updateMock,
      };
      return cb(tx);
    });

    mockDb = {
      select: selectMock,
      update: vi.fn(),
      transaction: transactionMock,
    };

    const result = await updateResource(RESOURCE_ID, OWNER_ID, { title: "수정된 제목" });

    expect(result).toMatchObject({
      id: RESOURCE_ID,
      slug: "updated-slug",
      status: "published",
    });
  });
});

// ── deleteResource 테스트 ─────────────────────────────────────────────────────

describe("deleteResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("존재하지 않는 자료 → 404 RESOURCE_NOT_FOUND", async () => {
    const { selectMock } = makeSelectChain([]);
    const { updateMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      transaction: vi.fn(),
    };

    await expect(deleteResource(RESOURCE_ID, OWNER_ID)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("비소유자 삭제 시도 → 403 FORBIDDEN", async () => {
    const { selectMock } = makeSelectChain([publishedResource]);
    const { updateMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      transaction: vi.fn(),
    };

    await expect(deleteResource(RESOURCE_ID, OTHER_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("소유자 삭제 → update 호출 (soft-delete)", async () => {
    const { selectMock } = makeSelectChain([publishedResource]);
    const { updateMock, setMock, whereMock } = makeUpdateChain();
    mockDb = {
      select: selectMock,
      update: updateMock,
      // Story 6.2: deleteResource가 이제 트랜잭션 내에서 soft-delete + 포인트 회수를 수행함
      // transaction mock이 콜백을 실행하도록 구현
      transaction: vi.fn(async (callback: (tx: typeof mockDb) => Promise<void>) => {
        const tx = { select: selectMock, update: updateMock };
        return callback(tx as unknown as typeof mockDb);
      }),
    };

    await deleteResource(RESOURCE_ID, OWNER_ID);

    expect(updateMock).toHaveBeenCalledWith(expect.anything());
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "deleted" }),
    );
    expect(whereMock).toHaveBeenCalled();
  });
});

// ── MutateServiceError 구조 테스트 ────────────────────────────────────────────

describe("MutateServiceError", () => {
  it("code, message, statusCode가 올바르게 설정된다", () => {
    const err = new MutateServiceError("TEST_CODE", "테스트 메시지", 403);
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("테스트 메시지");
    expect(err.statusCode).toBe(403);
    expect(err instanceof Error).toBe(true);
  });

  it("기본 statusCode는 403", () => {
    const err = new MutateServiceError("TEST", "msg");
    expect(err.statusCode).toBe(403);
  });
});
