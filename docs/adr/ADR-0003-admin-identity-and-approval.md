# ADR-0003: 관리자 신원 시스템 (유저와 완전 분리) + 가입 승인 워크플로우

- **상태(Status)**: Accepted (정책) / Draft (스키마 — 관리자 인증 Story에서 확정)
- **맥락 출처**: 사용자 결정 2026-06-17 — "관리자 페이지는 유저와 완전 독립된 별도 계정/세션. 유저 가입·로그인이 관리자에 전혀 영향 없어야 함. 관리자는 이름·이메일·비밀번호·연락처 등을 받고, 가입 후 **운영자 승인**을 받아야 로그인 가능."
- **관련**: [[ADR-0002-identity-and-auth-schema]] (유저 신원), [[ADR-0001-local-dev-infrastructure]]

---

## 1. Decision (결정)

관리자 신원을 **유저 신원과 완전히 분리**한다. 별도 DB 테이블·별도 세션·별도 인증 인스턴스를 사용하며, **유저 사이트의 회원가입/로그인과 어떤 데이터·세션도 공유하지 않는다.** (기존 프로젝트 격리 철학 — `apps/web`↔`apps/admin` 앱·디자인 분리, 별도 서브도메인/포트 — 의 신원 레벨 확장.)

### 분리 원칙 (엄수)
- **별도 테이블**: `admin_users` / `admin_sessions` / `admin_accounts`(credential) / `admin_verifications`. 유저 `users`와 무관(공유 컬럼·FK 없음).
- **별도 세션 쿠키**: 유저 `aj_session`(루트/`www` 도메인) ↔ 관리자 `aj_admin_session`(`admin` 서브도메인 한정). 쿠키 도메인·이름이 달라 상호 사용 불가.
- **별도 인증 인스턴스**: 관리자용 Better Auth 인스턴스(basePath `/api/v1/admin/auth`, 자체 테이블·쿠키·시크릿). 유저 인스턴스(basePath `/api/v1/auth`)와 독립.
- **소셜 로그인 없음**: 관리자는 **이메일+비밀번호(Argon2id)** 만. (외부 IdP 의존·다계정 표면 제거.)
- **결과**: 유저 사이트에서 가입·로그인·탈퇴해도 관리자 접근에 0 영향. 반대도 동일.

### 관리자 가입 → 승인 워크플로우
1. 관리자 페이지 `/signup`에서 **이름·이메일·비밀번호·연락처(필수)** + (선택) 소속/사유 입력 → 계정 생성 시 **`status = pending`(승인 대기)**.
2. **로그인 게이트**: `status = active`일 때만 로그인 허용. `pending`(승인 대기)·`suspended`(정지)·`disabled`(비활성)은 로그인 차단 + 사유 안내.
3. **최고관리자(super_admin)** 가 관리자 콘솔의 **운영자 계정 관리** 화면에서 대기 목록 확인 → 승인(`active`) / 반려(`disabled`) / 역할 지정(staff|super_admin). 위험 액션이므로 사유 메모(어드민 위험도별 확인 UX).
4. **부트스트랩**: 최초 super_admin은 승인자가 없으므로 **시드(seed)로 생성**(마이그레이션 시드 또는 env 기반 1회 스크립트). 이후 가입자는 승인 절차를 탄다.

## 2. Admin Schema (Draft)

```ts
// packages/database/src/schema/admin.ts (draft) — users.ts와 완전 분리
import { pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const adminRole = pgEnum("admin_role", ["staff", "super_admin"]);        // 운영자/최고관리자
export const adminStatus = pgEnum("admin_status", ["pending", "active", "suspended", "disabled"]); // 승인대기/정상/정지/비활성

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),                        // 이름
  phone: text("phone").notNull(),                      // 연락처
  role: adminRole("role").notNull().default("staff"),
  status: adminStatus("status").notNull().default("pending"), // 가입 직후 승인 대기
  approvedBy: uuid("approved_by"),                     // 승인한 super_admin admin_users.id
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  note: text("note"),                                  // 승인/반려 사유 메모
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// credential 전용(소셜 없음). 비밀번호는 Argon2id 해시.
export const adminAccounts = pgTable("admin_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().default("credential"),
  accountId: text("account_id").notNull(),             // 보통 admin_user id/email
  password: text("password"),                          // Argon2id 해시
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ providerAccountUq: uniqueIndex("admin_accounts_provider_account_uq").on(t.providerId, t.accountId) }));

export const adminVerifications = pgTable("admin_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## 3. `packages/auth` 리팩터링 (영향)

현행 `Role = "member" | "admin"`(2단계, 유저·관리자 혼재)을 **두 도메인으로 분리**한다:
- **유저**: 역할 없음(전원 일반 회원) — ADR-0002.
- **관리자**: `AdminRole = "staff" | "super_admin"` + 권한맵(운영자=숨김 상한까지 / 최고관리자=영구삭제·사이트설정·광고·**운영자 계정 승인·권한변경**). `canAccessAdmin`은 **관리자 세션·`status=active`** 기준으로 재정의(유저 역할과 무관).
- API 가드: `/api/v1/admin/*`는 관리자 세션(`aj_admin_session`)만 통과. 유저 세션으로는 어떤 경우에도 접근 불가.

## 4. UX 영향 (admin EXPERIENCE.md 반영)
- 관리자 IA에 `/signup`(승인 대기 안내) 추가, `/login`은 `status=active`만 통과(대기/정지/비활성 사유 안내 화면).
- **운영자 계정 관리(최고관리자 전용)** 화면: 대기 목록 승인/반려·역할 지정·정지. (사이트 회원을 다루는 기존 "8. 회원 관리"와 별개 — 이건 *관리자 계정* 관리.)

## 5. Consequences
- ✅ 유저↔관리자 신원·세션 완전 격리 → 유저 측 사고가 관리자에 전파 불가(보안 경계 강화).
- ✅ 관리자 가입 승인제 → 무단 관리자 계정 생성 차단.
- ✅ 관리자 정보(이름·연락처) 확보로 운영 책임 추적 가능.
- ⚠️ 인증 인스턴스 2개·쿠키 2개 운영 복잡도 소폭 증가(서브도메인 쿠키 스코프 주의).
- ⚠️ 최초 super_admin 시드 부트스트랩 필요(승인자 부재 해결).
- ⚠️ `packages/auth` Role 분리 리팩터링은 web/admin/api 전반 영향 → 관리자 인증 Story에서 일괄.
- 🔁 ADR-0002의 `user_sanctions.issuedBy`는 `admin_users.id`를 가리킴(별도 신원이라 FK 대신 id 보관).
