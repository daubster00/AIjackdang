/**
 * packages/contracts/src/resource.test.ts
 *
 * 실전자료 Zod 스키마 단위 테스트.
 * Story 4.1 AC #6: createResourceSchema, ratingSchema, listResourcesQuerySchema 검증.
 */

import { describe, expect, it } from "vitest";
import {
  createResourceSchema,
  listResourcesQuerySchema,
  ratingSchema,
  resourceTypeSchema,
  difficultySchema,
  scanStatusSchema,
  resourceStatusSchema,
  updateResourceSchema,
} from "./resource";

// ── createResourceSchema ──────────────────────────────────────────────────────

describe("createResourceSchema", () => {
  const validBase = {
    title: "Claude 프롬프트 모음",
    summary: "실전에서 바로 쓸 수 있는 프롬프트 컬렉션",
    resourceType: "prompt" as const,
    environment: ["Claude.ai", "API"],
    difficulty: "beginner" as const,
    descriptionJson: { type: "doc", content: [] },
    usageJson: { type: "doc", content: [] },
    copyrightAgreed: true as const,
  };

  it("유효한 데이터는 통과한다", () => {
    const result = createResourceSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("copyrightAgreed=false이면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      copyrightAgreed: false,
    });
    expect(result.success).toBe(false);
  });

  it("title이 1자(min 2 미만)이면 실패한다", () => {
    const result = createResourceSchema.safeParse({ ...validBase, title: "A" });
    expect(result.success).toBe(false);
  });

  it("title이 151자(max 150 초과)이면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      title: "A".repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it("summary가 빈 문자열(min 1 미만)이면 실패한다", () => {
    const result = createResourceSchema.safeParse({ ...validBase, summary: "" });
    expect(result.success).toBe(false);
  });

  it("summary가 301자(max 300 초과)이면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      summary: "A".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("resourceType이 유효하지 않은 값이면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      resourceType: "invalid-type",
    });
    expect(result.success).toBe(false);
  });

  it("difficulty가 유효하지 않은 값이면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      difficulty: "expert",
    });
    expect(result.success).toBe(false);
  });

  it("tags 기본값은 빈 배열이다", () => {
    const result = createResourceSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("tags가 10개를 초과하면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("optionals(cautionJson, version, referenceLinks)은 없어도 통과한다", () => {
    const result = createResourceSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("referenceLinks의 url이 유효한 URL이 아니면 실패한다", () => {
    const result = createResourceSchema.safeParse({
      ...validBase,
      referenceLinks: [{ label: "잘못된 링크", url: "not-a-url" }],
    });
    expect(result.success).toBe(false);
  });
});

// ── ratingSchema ──────────────────────────────────────────────────────────────

describe("ratingSchema", () => {
  it("score=1이면 통과한다", () => {
    expect(ratingSchema.safeParse({ score: 1 }).success).toBe(true);
  });

  it("score=5이면 통과한다", () => {
    expect(ratingSchema.safeParse({ score: 5 }).success).toBe(true);
  });

  it("score=3이면 통과한다", () => {
    expect(ratingSchema.safeParse({ score: 3 }).success).toBe(true);
  });

  it("score=0이면 실패한다", () => {
    expect(ratingSchema.safeParse({ score: 0 }).success).toBe(false);
  });

  it("score=6이면 실패한다", () => {
    expect(ratingSchema.safeParse({ score: 6 }).success).toBe(false);
  });

  it("score가 소수(1.5)이면 실패한다", () => {
    expect(ratingSchema.safeParse({ score: 1.5 }).success).toBe(false);
  });

  it("score가 음수이면 실패한다", () => {
    expect(ratingSchema.safeParse({ score: -1 }).success).toBe(false);
  });
});

// ── listResourcesQuerySchema ──────────────────────────────────────────────────

describe("listResourcesQuerySchema", () => {
  it("빈 객체도 기본값으로 통과한다 (page=1, pageSize=20, sort=latest)", () => {
    const result = listResourcesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.sort).toBe("latest");
    }
  });

  it("page/pageSize 쿼리 파라미터(문자열)를 숫자로 coerce한다", () => {
    const result = listResourcesQuerySchema.safeParse({
      page: "2",
      pageSize: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("sort=rating이면 통과한다", () => {
    const result = listResourcesQuerySchema.safeParse({ sort: "rating" });
    expect(result.success).toBe(true);
  });

  it("sort=invalid이면 실패한다", () => {
    const result = listResourcesQuerySchema.safeParse({ sort: "invalid" });
    expect(result.success).toBe(false);
  });

  it("type 필터가 있으면 통과한다", () => {
    const result = listResourcesQuerySchema.safeParse({ type: "prompt" });
    expect(result.success).toBe(true);
  });

  it("difficulty 필터가 있으면 통과한다", () => {
    const result = listResourcesQuerySchema.safeParse({ difficulty: "advanced" });
    expect(result.success).toBe(true);
  });

  it("q(검색어)가 있으면 통과한다", () => {
    const result = listResourcesQuerySchema.safeParse({ q: "Claude 프롬프트" });
    expect(result.success).toBe(true);
  });

  it("pageSize=100은 통과하지만 101은 실패한다", () => {
    expect(listResourcesQuerySchema.safeParse({ pageSize: "100" }).success).toBe(true);
    expect(listResourcesQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });
});

// ── resourceTypeSchema ────────────────────────────────────────────────────────

describe("resourceTypeSchema", () => {
  it("모든 유효한 enum 값이 통과한다", () => {
    const validValues = ["prompt", "claude-code-skill", "mcp", "rules-config", "template-checklist"];
    for (const v of validValues) {
      expect(resourceTypeSchema.safeParse(v).success).toBe(true);
    }
  });

  it("유효하지 않은 값은 실패한다", () => {
    expect(resourceTypeSchema.safeParse("unknown").success).toBe(false);
  });
});

// ── difficultySchema ──────────────────────────────────────────────────────────

describe("difficultySchema", () => {
  it("beginner/intermediate/advanced 모두 통과한다", () => {
    expect(difficultySchema.safeParse("beginner").success).toBe(true);
    expect(difficultySchema.safeParse("intermediate").success).toBe(true);
    expect(difficultySchema.safeParse("advanced").success).toBe(true);
  });

  it("expert는 실패한다", () => {
    expect(difficultySchema.safeParse("expert").success).toBe(false);
  });
});

// ── scanStatusSchema ──────────────────────────────────────────────────────────

describe("scanStatusSchema", () => {
  it("pending/clean/infected/error 모두 통과한다", () => {
    for (const v of ["pending", "clean", "infected", "error"]) {
      expect(scanStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── resourceStatusSchema ──────────────────────────────────────────────────────

describe("resourceStatusSchema", () => {
  it("draft/published/hidden/deleted 모두 통과한다", () => {
    for (const v of ["draft", "published", "hidden", "deleted"]) {
      expect(resourceStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── updateResourceSchema ──────────────────────────────────────────────────────

describe("updateResourceSchema", () => {
  it("빈 객체도 통과한다 (모든 필드 optional)", () => {
    expect(updateResourceSchema.safeParse({}).success).toBe(true);
  });

  it("title만 있어도 통과한다", () => {
    expect(updateResourceSchema.safeParse({ title: "수정된 제목" }).success).toBe(true);
  });
});
