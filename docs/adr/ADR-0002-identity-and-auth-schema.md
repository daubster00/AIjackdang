# ADR-0002: (유저) 신원·다계정 정책 + 인증 스키마 설계 (초안)

- **상태(Status)**: Accepted (정책) / Draft (스키마 — 인증 Story에서 Better Auth 생성 스키마와 대조 후 확정)
- **범위**: **유저 사이트(`apps/web`) 회원 신원 전용.** 관리자 신원은 완전 분리 → **[[ADR-0003-admin-identity-and-approval]]** 참조. 유저 가입/로그인은 관리자에 전혀 영향을 주지 않으며, 유저 테이블엔 관리자 역할이 존재하지 않는다.
- **맥락 출처**: `architecture.md` (Auth & Security, Pre-Implementation 블로커 `better-auth-providers`), 사용자 결정 2026-06-17
- **관련**: [[ADR-0001-local-dev-infrastructure]], [[ADR-0003-admin-identity-and-approval]]

---

## 1. 신원·다계정 정책 (Decision)

### 결정 요약
가입 정보는 **이메일 + 비밀번호(+ 이메일 인증) + 소셜 로그인(구글/네이버/카카오)** 을 유지한다. 다계정/중복은 "정보를 더 받아서"가 아니라 **계정 연결 + 행동 레이어 방어 + 저비용 가드**로 막는다. **휴대폰 본인인증(실명/CI)은 지금 도입하지 않고, 발동 조건이 오면 도입**한다. (개인정보 최소 수집 = 개인정보보호법 부합 + #1 목표인 가입 전환 보호.)

### 카카오 이메일 (사용자 확정: a)
- **카카오 비즈앱(사업자) 검수를 진행해 `account_email`(카카오 계정 이메일) 확보.** → 세 소셜 모두 이메일 제공 → `users.email`을 **필수(non-null)·유니크**로 설계.
- ⚠️ 검수 리드타임: 비즈앱 승인 전까지 카카오는 이메일을 주지 않음 → 승인 전엔 (1) 카카오 로그인 비활성 또는 (2) 카카오 한정 이메일 추가입력 단계. 승인 후 정상화. (운영 타이밍 이슈일 뿐 스키마는 email 필수로 고정.)

### 다계정이 실제로 아픈 곳 + 방어
| 위험 | 방어(대부분 이미 PRD/행동 레이어) |
|---|---|
| 게이미피케이션 조작(자가 좋아요·자가 다운로드로 포인트·랭킹) | FR-9.1: 자가추천 차단·일일 적립 상한·1인 1자료 1회 다운로드 집계·반복등록 차단(`packages/core`) |
| 평점·후기·다운로드 sockpuppet | 행동 상한 + 신고 누적 자동숨김(FR-8.3) |
| 제재 회피(ban evasion) | 소셜 가입 비중↑로 문턱↑ + 향후 휴대폰 인증 발동 옵션 |
| 스팸/광고 계정 | 이메일 인증 + 일회용 이메일 차단 + 가입 rate limit + 금칙어/스팸필터(FR-8.5) |

### 지금 채택하는 저비용 가드 (인증 Story 범위)
1. **이메일 인증 필수**(FR-1.1) — 가짜 이메일 1차 차단.
2. **계정 연결(account linking)** — 동일 (검증된) 이메일이면 소셜·이메일 가입을 **한 계정으로 병합**(Better Auth `account` 테이블). 실수 중복 구조적 방지.
3. **일회용 이메일 도메인 차단** — blocklist(코드/설정), 가입 시 검증.
4. **가입 rate limiting** — IP/디바이스 기준(`@fastify/rate-limit`).
5. **닉네임 유니크** — `users.nickname` unique.

### 휴대폰 본인인증 — 지금 비도입, 발동 조건
- **버리는 게 아니라 미룬다.** 다음 중 하나가 오면 도입 검토: (1) 다계정·제재회피·평점 조작이 **실제 관측**, (2) Phase 2 **수익화/결제** 도입(실명·정산 필요).
- 비도입 이유: 본인확인기관 계약·건당 비용 💸, 가입 이탈 마찰 🧱, 민감정보 수집에 따른 PIPA 부담 ⚖️ — 모두 #1 목표(검색 유입→가입 전환)와 상충.

## 2. 인증 스키마 설계 (Draft)

> Better Auth가 카카오·네이버·구글을 **네이티브 지원**(ADR-0001 §4). 비밀번호·소셜 토큰은 **`accounts` 테이블**이 보유하며(계정 연결의 핵심), `users.password_hash`는 사용하지 않는다(기존 placeholder `users.ts`의 `passwordHash` 제거). 비밀번호 해시는 Better Auth 커스텀 해셔로 **Argon2id** 지정.
> 아래는 목표 형태. 인증 Story에서 Better Auth가 생성/기대하는 정확한 컬럼과 대조해 확정한다. 네이밍은 프로젝트 컨벤션(snake_case 테이블/컬럼, Drizzle 프로퍼티 camelCase)을 따르며 Better Auth 테이블명을 plural로 매핑.

```ts
// packages/database/src/schema/auth.ts (draft)
import { pgEnum, pgTable, text, boolean, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

// 유저 테이블엔 관리자 역할 없음(관리자는 별도 신원 — ADR-0003). status만 둔다.
export const userStatus = pgEnum("user_status", ["active", "suspended", "withdrawn"]); // 정상/이용제한/탈퇴

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),            // (a)결정: 필수·유니크
  emailVerified: boolean("email_verified").notNull().default(false),
  nickname: text("nickname").notNull().unique(),       // 닉네임 유니크(다계정 가드)
  image: text("image"),                                // 프로필 이미지(소셜/업로드)
  bio: text("bio"),                                    // 소개
  status: userStatus("status").notNull().default("active"),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }), // 이용 제한 만료
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),           // 탈퇴(익명화/soft)
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 소셜 + credential 통합 + 계정 연결의 핵심
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),           // 'credential' | 'google' | 'naver' | 'kakao'
  accountId: text("account_id").notNull(),             // provider의 유저 식별자
  password: text("password"),                          // credential일 때 Argon2id 해시(평문/가역 금지)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ providerAccountUq: uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId) }));

// 이메일 인증 / 비밀번호 재설정 토큰
export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),            // 보통 email
  value: text("value").notNull(),                      // 토큰
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 제재 이력(모더레이션) — 위험 액션은 사유 메모 필수(어드민 UX)
export const sanctionType = pgEnum("sanction_type", ["warning", "suspend", "permaban"]); // 경고/일시정지/영구정지
export const userSanctions = pgTable("user_sanctions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: sanctionType("type").notNull(),
  reason: text("reason").notNull(),                    // 사유 메모(위험도별 확인 UX)
  issuedBy: uuid("issued_by"), // 처리 관리자 admin_users.id (ADR-0003) — 별도 신원이라 FK 대신 id만 보관
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 설계 노트
- **포인트·등급**: `users`에 저장하지 않고 `points_ledger`(원장) + `packages/core`의 `gradeForPoints`로 도출. 랭킹 성능 위해 `current_points`/`grade` 캐시 컬럼은 선택적(필요 시 추가).
- **유저 측 역할 없음**: 사이트 회원은 전원 일반 회원(권한 분기는 status·게이팅으로 충분). 운영자/최고관리자 역할·권한맵은 **관리자 신원(ADR-0003)** 에 별도 존재. 현행 `packages/auth`의 `Role(member|admin)`은 **유저용/관리자용으로 분리 리팩터링** 필요(ADR-0003 참조).
- **Better Auth 매핑**: `socialProviders.{google,naver,kakao}` + 이메일/비밀번호 + 이메일 인증 + account linking(trustedProviders) + 커스텀 Argon2id 해셔. 정확한 컬럼은 인증 Story에서 Better Auth 산출 스키마와 대조.
- **인증 마운트 & 콜백 규약(확정)**: Better Auth 서버는 `apps/api`에서 동작(DB 접근 권위)하되, 브라우저에는 **유저 사이트와 같은 출처로 프록시**(Next rewrite: 유저 출처 `/api/v1/auth/*` → API)해 노출 → **first-party 쿠키**(로컬 크로스-포트/운영 크로스-서브도메인 쿠키 문제 회피). 소셜 콜백 = **유저 출처 기준**: 로컬 `http://localhost:3003/api/v1/auth/callback/{google|naver|kakao}`, 운영 `https://www.<도메인>/api/v1/auth/callback/{provider}`. (관리자는 소셜 없음 — ADR-0003.) 프록시는 HTTP 포워딩일 뿐 Next가 DB에 접근하지 않으므로 "DB는 api/worker만" 원칙 위배 아님.
- **기존 placeholder 대체**: `packages/database/src/schema/users.ts`(예시, `passwordHash` 포함)는 이 설계로 대체. 마이그레이션 아님(그린필드).

## 3. Consequences
- ✅ 가입 마찰 최소 + 다계정은 연결·행동방어·저비용가드로 통제. PIPA 최소수집 부합.
- ✅ 제재 상태(`status`/`suspendedUntil`/`user_sanctions`)가 모더레이션 UX(위험도별 확인·사유 메모)와 직접 연결.
- ⚠️ 카카오 비즈앱 검수 리드타임(운영 타이밍) — 승인 전 카카오 로그인 처리 방침 필요.
- ⚠️ `packages/auth` 2→3단계 역할 확장은 web/admin/api 전반에 영향(권한맵 동시 수정).
- ⏸️ 휴대폰 본인인증은 발동 조건 도래 시 별도 ADR로 도입.
