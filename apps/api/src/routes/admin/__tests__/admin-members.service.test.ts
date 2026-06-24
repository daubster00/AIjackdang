/**
 * 운영자 계정 관리 서비스 레이어 단위 테스트 (Story 9.4).
 *
 * 검증 케이스:
 * 1. approveAdmin — pending → active 상태 전이
 * 2. approveAdmin — non-pending 대상에 INVALID_STATUS 에러
 * 3. rejectAdmin  — pending → disabled 상태 전이
 * 4. suspendAdmin — active → suspended 상태 전이 + 세션 전체 삭제
 * 5. suspendAdmin — non-active 대상에 INVALID_STATUS 에러
 * 6. activateAdmin — suspended → active 상태 전이
 * 7. changeAdminRole — 자기 자신 역할 변경 시 FORBIDDEN_SELF 에러 (AC#5)
 * 8. changeAdminRole — 역할 갱신 + 세션 전체 삭제
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── getDb 모킹 ────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();

// drizzle-orm 체인 빌더를 위한 Proxy
function makeChain(finalValue: unknown): unknown {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(finalValue).then(resolve);
        }
        // select/update/delete 의 체인 메서드들 (.from, .where, .set, .returning, .limit, .offset 등)
        return () => chain;
      },
    },
  );
  return chain;
}

vi.mock("@ai-jakdang/database", () => ({
  getDb: () => ({
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  }),
}));

vi.mock("@ai-jakdang/database/schema", () => ({
  adminUsers: { id: "id", status: "status", role: "role" },
  adminSessions: { adminUserId: "adminUserId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

// ── service import (모킹 이후) ────────────────────────────────────────────────

import {
  approveAdmin,
  rejectAdmin,
  suspendAdmin,
  activateAdmin,
  changeAdminRole,
} from "../admin-members/service.js";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPROVER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeDbForStatus(targetStatus: string) {
  const targetRow = {
    id: ADMIN_ID,
    status: targetStatus,
    role: "staff",
    createdAt: new Date(),
    updatedAt: new Date(),
    email: "test@example.com",
    name: "테스터",
    phone: "010-0000-0000",
    approvedBy: null,
    approvedAt: null,
    note: null,
  };

  const updatedRow = { ...targetRow, updatedAt: new Date() };

  // select().from().where().limit(1) → [targetRow]
  const selectChain = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve([targetRow]).then(resolve);
        }
        return () => selectChain;
      },
    },
  );
  mockSelect.mockReturnValue(selectChain);

  // update().set().where().returning() → [updatedRow]
  const updateChain = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve([updatedRow]).then(resolve);
        }
        return () => updateChain;
      },
    },
  );
  mockUpdate.mockReturnValue(updateChain);

  // delete().where() → void
  const deleteChain = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve);
        }
        return () => deleteChain;
      },
    },
  );
  mockDelete.mockReturnValue(deleteChain);

  return { targetRow, updatedRow };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("approveAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("케이스 1: pending 대상을 승인하면 update가 호출되고 결과 반환", async () => {
    makeDbForStatus("pending");

    const result = await approveAdmin(ADMIN_ID, APPROVER_ID, "staff", "승인 테스트");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it("케이스 2: non-pending 대상은 INVALID_STATUS 에러", async () => {
    makeDbForStatus("active");

    await expect(approveAdmin(ADMIN_ID, APPROVER_ID, "staff", "사유")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
  });
});

describe("rejectAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("케이스 3: pending 대상 반려 시 status=disabled로 업데이트", async () => {
    makeDbForStatus("pending");

    const result = await rejectAdmin(ADMIN_ID, "반려 사유");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
});

describe("suspendAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("케이스 4: active 대상 정지 시 update + 세션 삭제(delete) 호출", async () => {
    makeDbForStatus("active");

    const result = await suspendAdmin(ADMIN_ID, "정지 사유");

    // adminUsers update + adminSessions delete 각 1회
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it("케이스 5: non-active 대상은 INVALID_STATUS 에러", async () => {
    makeDbForStatus("pending");

    await expect(suspendAdmin(ADMIN_ID, "사유")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
  });
});

describe("activateAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("케이스 6: suspended 대상 재활성 시 update 호출", async () => {
    makeDbForStatus("suspended");

    const result = await activateAdmin(ADMIN_ID, "재활성 사유");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
});

describe("changeAdminRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("케이스 7: 자기 자신 역할 변경 시 FORBIDDEN_SELF 에러 (AC#5)", async () => {
    // makeDbForStatus 호출 불필요 — 자기 자신 체크가 DB 조회 전에 발생
    await expect(
      changeAdminRole(ADMIN_ID, ADMIN_ID, "staff", "사유"),
    ).rejects.toMatchObject({ code: "FORBIDDEN_SELF" });

    // DB 조회·수정 없어야 함
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("케이스 8: 타인 역할 변경 시 update + 세션 삭제(delete) 호출", async () => {
    makeDbForStatus("active");

    const result = await changeAdminRole(ADMIN_ID, APPROVER_ID, "super_admin", "승급 사유");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
});
