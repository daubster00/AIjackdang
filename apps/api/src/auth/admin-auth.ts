/**
 * 관리자 Better Auth 인스턴스 (apps/api 전용).
 *
 * packages/auth/adminAuth.ts 의 createAdminAuth() 를 사용하되,
 * DB 인스턴스·스키마·시크릿·baseURL 을 주입한다.
 * (packages/auth 는 DB 직접 import 금지 원칙 — DB 주입은 apps/api 에서 담당)
 *
 * ADR-0003:
 * - basePath: /api/v1/admin/auth
 * - cookiePrefix: aj_admin_session
 * - credential only (소셜 없음)
 * - Argon2id 해시
 * - admin_* 테이블 바인딩
 */

import { env } from "@ai-jakdang/config";
import { getDb } from "@ai-jakdang/database";
import * as schema from "@ai-jakdang/database/schema";
import { createAdminAuth } from "@ai-jakdang/auth";

export const adminAuth = createAdminAuth({
  db: getDb(),
  schema: {
    adminUsers: schema.adminUsers,
    adminSessions: schema.adminSessions,
    adminAccounts: schema.adminAccounts,
    adminVerifications: schema.adminVerifications,
  },
  secret: env.ADMIN_AUTH_SECRET ?? env.AUTH_SECRET,
  baseURL: env.ADMIN_PUBLIC_URL ?? "http://localhost:3004",
});

export type AdminAuthInstance = typeof adminAuth;
