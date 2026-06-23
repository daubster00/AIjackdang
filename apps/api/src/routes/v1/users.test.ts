/**
 * Story 1.9 — 계정 설정 API 단위 테스트.
 *
 * DB / Redis 가 필요한 통합 테스트는 스킵 처리하고 라이브 인프라 필요 여부를 명시한다.
 * 라이브 인프라 없이 실행 가능한 단위 로직(검증·파서 등)을 중점적으로 검증한다.
 *
 * ─ 라이브 인프라 필요 테스트 ─
 *   describe.todo("통합: DB 연결 필요") 블록은 실제 postgres + redis 환경에서만 실행한다.
 */

import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../services/storage/index.js";

// 멀티파트 파싱은 @fastify/multipart(request.file())로 처리하므로 커스텀 파서 단위테스트는 제거됨.

// ── 이미지 타입·크기 제한 단위 테스트 ──────────────────────────────────────────

describe("이미지 업로드 제한 상수", () => {
  it("ALLOWED_IMAGE_TYPES 에 jpg·png·webp·gif 가 포함된다", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/webp")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/gif")).toBe(true);
  });

  it("pdf 등 비허용 타입은 ALLOWED_IMAGE_TYPES 에 없다", () => {
    expect(ALLOWED_IMAGE_TYPES.has("application/pdf")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("MAX_UPLOAD_BYTES 가 5MB 이다", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});

// ── 닉네임 스키마 단위 테스트 ────────────────────────────────────────────────────

describe("nicknameSchema (contracts)", () => {
  it("유효한 닉네임을 통과시킨다", async () => {
    const { nicknameSchema } = await import("@ai-jakdang/contracts");
    expect(nicknameSchema.safeParse("작당탐험가").success).toBe(true);
    expect(nicknameSchema.safeParse("Claude_123").success).toBe(true);
    expect(nicknameSchema.safeParse("ab").success).toBe(true); // 최소 2자
  });

  it("2자 미만 닉네임을 거부한다", async () => {
    const { nicknameSchema } = await import("@ai-jakdang/contracts");
    expect(nicknameSchema.safeParse("a").success).toBe(false);
  });

  it("20자 초과 닉네임을 거부한다", async () => {
    const { nicknameSchema } = await import("@ai-jakdang/contracts");
    expect(nicknameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });

  it("특수문자(공백·!·@ 등)를 거부한다", async () => {
    const { nicknameSchema } = await import("@ai-jakdang/contracts");
    expect(nicknameSchema.safeParse("hello world").success).toBe(false);
    expect(nicknameSchema.safeParse("nick!name").success).toBe(false);
    expect(nicknameSchema.safeParse("nick@name").success).toBe(false);
  });
});

// ── changePasswordSchema 단위 테스트 ────────────────────────────────────────────

describe("changePasswordSchema (contracts)", () => {
  it("현재 비밀번호와 새 비밀번호(8자 이상)가 있으면 통과한다", async () => {
    const { changePasswordSchema } = await import("@ai-jakdang/contracts");
    const result = changePasswordSchema.safeParse({
      currentPassword: "currentPass",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("새 비밀번호가 8자 미만이면 거부한다", async () => {
    const { changePasswordSchema } = await import("@ai-jakdang/contracts");
    const result = changePasswordSchema.safeParse({
      currentPassword: "current",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("현재 비밀번호가 빈 문자열이면 거부한다", async () => {
    const { changePasswordSchema } = await import("@ai-jakdang/contracts");
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(false);
  });
});

// ── 통합 테스트 (라이브 인프라 필요) ─────────────────────────────────────────────
//
// 아래 테스트는 실행하려면 다음이 필요합니다:
//   - PostgreSQL (DATABASE_URL)
//   - Redis (REDIS_URL)
//
// 로컬 dev 환경에서: docker compose -f docker-compose.dev.yml up -d 로 기동 후 실행.
// CI 에서는 서비스 컨테이너 설정 필요.

describe.todo("통합: PATCH /users/me — 프로필 수정 (라이브 DB 필요)");
// - 성공: 닉네임·bio 갱신 후 200 응답
// - 409: 이미 사용 중인 닉네임 → NICKNAME_TAKEN
// - 401: 인증 없이 요청 → UNAUTHORIZED

describe.todo("통합: POST /users/me/password — 비밀번호 변경 (라이브 DB 필요)");
// - 성공: Argon2id 검증 + 새 해시 갱신 후 200
// - 401 WRONG_PASSWORD: 현재 비밀번호 불일치
// - 401 NO_CREDENTIAL_ACCOUNT: 소셜 전용 계정

describe.todo("통합: DELETE /users/me — 회원 탈퇴 (라이브 DB + Redis 필요)");
// - 성공: status=withdrawn, deletedAt 설정, sessions 삭제, cleanup job 발행
// - 404: 탈퇴 후 동일 사용자 재탈퇴 시도

describe.todo("통합: 이미지 업로드 — POST /users/uploads/avatar · /banner (라이브 DB 필요)");
// - 성공: 파일 저장 후 URL 반환, users.avatarUrl 갱신
// - 400 FILE_TOO_LARGE: 5MB 초과
// - 400 INVALID_FILE_TYPE: pdf 등 비허용 타입
