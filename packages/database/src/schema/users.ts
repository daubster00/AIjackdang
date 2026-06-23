import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 회원 테이블 (기반 예시 스키마).
 *
 * 주의: 이 단계에서는 전체 데이터베이스 테이블을 구현하지 않는다.
 * 인증/회원 기능 구현 단계에서 Better Auth 가 요구하는 테이블과 함께 확장한다.
 * 테이블명·컬럼명은 snake_case, 코드 타입은 camelCase 를 사용한다.
 */
export const userRole = pgEnum("user_role", ["member", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  nickname: text("nickname").notNull(),
  // 비밀번호는 Argon2id 단방향 해시로만 저장한다(평문/가역 암호화 금지).
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
