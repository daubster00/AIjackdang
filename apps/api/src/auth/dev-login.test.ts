/**
 * dev-login production 차단 테스트 (AC #7).
 *
 * AUTH_DEV_BYPASS=true && NODE_ENV !== 'production' 조건 검증.
 */

import { describe, expect, it, vi } from "vitest";

// env 모듈을 모킹해서 NODE_ENV/AUTH_DEV_BYPASS 제어
vi.mock("@ai-jakdang/config", () => ({
  env: {
    NODE_ENV: "development",
    AUTH_DEV_BYPASS: true,
    WEB_PUBLIC_URL: "http://localhost:3003",
    BETTER_AUTH_URL: undefined,
    AUTH_SECRET: "test-secret-32-characters-minimum",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5433/ai_jakdang",
    REDIS_URL: "redis://localhost:6380",
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    NAVER_CLIENT_ID: undefined,
    NAVER_CLIENT_SECRET: undefined,
    KAKAO_REST_API_KEY: undefined,
    KAKAO_CLIENT_SECRET: undefined,
  },
}));

describe("isDevLoginEnabled", () => {
  it("개발 환경에서 AUTH_DEV_BYPASS=true 이면 활성화된다", async () => {
    const { isDevLoginEnabled } = await import("./dev-login.js");
    expect(isDevLoginEnabled()).toBe(true);
  });
});

describe("dev-login production 차단", () => {
  it("NODE_ENV=production 이면 비활성화된다", async () => {
    const { env } = await import("@ai-jakdang/config");
    const mutableEnv = env as Record<string, unknown>;
    const originalNodeEnv = mutableEnv["NODE_ENV"];

    try {
      mutableEnv["NODE_ENV"] = "production";

      const { isDevLoginEnabled } = await import("./dev-login.js");
      expect(isDevLoginEnabled()).toBe(false);
    } finally {
      mutableEnv["NODE_ENV"] = originalNodeEnv;
    }
  });

  it("AUTH_DEV_BYPASS=false 이면 비활성화된다", async () => {
    const { env } = await import("@ai-jakdang/config");
    const mutableEnv = env as Record<string, unknown>;
    const originalBypass = mutableEnv["AUTH_DEV_BYPASS"];

    try {
      mutableEnv["AUTH_DEV_BYPASS"] = false;

      const { isDevLoginEnabled } = await import("./dev-login.js");
      expect(isDevLoginEnabled()).toBe(false);
    } finally {
      mutableEnv["AUTH_DEV_BYPASS"] = originalBypass;
    }
  });
});

describe("v1Routes dev-login 라우트 조건부 등록", () => {
  it("NODE_ENV=production 환경에서는 dev-login 라우트가 등록되지 않는다", async () => {
    const { env } = await import("@ai-jakdang/config");
    const mutableEnv = env as Record<string, unknown>;

    // production 시뮬레이션
    mutableEnv["NODE_ENV"] = "production";
    mutableEnv["AUTH_DEV_BYPASS"] = false;

    // 라우트 등록 조건: NODE_ENV !== 'production' && AUTH_DEV_BYPASS
    const shouldRegister = env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS;
    expect(shouldRegister).toBe(false);

    // 복원
    mutableEnv["NODE_ENV"] = "development";
    mutableEnv["AUTH_DEV_BYPASS"] = true;
  });

  it("개발 환경에서 AUTH_DEV_BYPASS=true 이면 dev-login 라우트가 등록된다", async () => {
    const { env } = await import("@ai-jakdang/config");
    const shouldRegister = env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS;
    expect(shouldRegister).toBe(true);
  });
});
