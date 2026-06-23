# AI작당 프로젝트 구조

문서 목적: 모노레포 전체 구조, 각 앱·패키지의 역할, 실행 방법, 포트·환경변수, 공유 가능/금지 코드를 정리한다.
기준 기술 스택 문서: `자료/ai-jakdang-technology-stack-2026-06-16.md`

---

## 1. 개요

- pnpm workspace 기반 모노레포 (Turborepo/Nx 미도입)
- 언어: TypeScript (strict), 런타임: Node.js (`engines: >=22`, 문서 권장은 Node 24 LTS — 배포 시 24 권장)
- 프런트엔드 2개(사용자/관리자)는 **완전히 독립된** Next.js 앱이며 시각 자산(디자인 토큰·CSS·UI 컴포넌트)을 공유하지 않는다.
- 공유는 **비시각적 코드(타입·검증·도메인 로직·설정)만** `packages/*` 를 통해 이뤄진다.

---

## 2. 전체 구조

```text
ai-jakdang/
├── apps/
│   ├── web/        사용자 사이트 (Next.js) — 사용자 전용 디자인 시스템 + 공통 UI
│   ├── admin/      관리자 앱 (Next.js)   — 독립 구조, 디자인 시스템 추후 확정
│   ├── api/        Fastify REST API
│   └── worker/     BullMQ 백그라운드 워커
│
├── packages/
│   ├── config/     TypeScript / ESLint / Prettier 공통 설정
│   ├── contracts/  API 요청·응답 타입 + Zod 검증 스키마
│   ├── database/   Drizzle 스키마 + DB 접근 코드 (API/Worker 전용)
│   ├── core/       도메인 비즈니스 규칙 (포인트/등급/질문 상태 등)
│   ├── auth/       권한 타입 + 권한 검사 규칙 (Better Auth 설정은 인증 단계에서)
│   └── utilities/  날짜·문자열·숫자 등 비시각적 범용 유틸리티
│
├── docs/           프로젝트 문서
├── 자료/            고객/기획/디자인 시스템 원본 자료 (보존)
├── package.json    워크스페이스 루트 (스크립트 + 공용 dev 도구)
├── pnpm-workspace.yaml
├── eslint.config.js / prettier.config.js  (packages/config 재노출)
├── .npmrc          node-linker=hoisted (도구 해석 단순화)
└── .env.example
```

> 시각 자산 공유 패키지(`packages/ui`, `packages/styles`, `packages/design-system`)는 **의도적으로 만들지 않았다.**
> 사용자/관리자의 시각 기반은 각 앱 내부에서 독립적으로 관리한다.

---

## 3. 앱별 역할

| 앱 | 패키지명 | 역할 | 포트(dev) |
|---|---|---|---|
| web | `@ai-jakdang/web` | 사용자 공개 사이트, SEO, 디자인 시스템, 공통 UI, `/dev/design-system` | 3003 |
| admin | `@ai-jakdang/admin` | 운영 관리자 앱(독립). 로그인/대시보드 자리, 관리자 전용 디자인 시스템 추후 | 3004 |
| api | `@ai-jakdang/api` | Fastify REST API. `/health`, `/api/v1/*`. Zod 검증, CORS/Helmet | 4003 |
| worker | `@ai-jakdang/worker` | BullMQ 워커(이미지/이메일/통계 큐). Redis 필요 | — |

DB 직접 접근은 API·Worker만 한다. Next.js(web/admin)는 API를 통해서만 데이터에 접근한다.

---

## 4. 패키지별 역할 (공유 가능한 비시각적 코드)

| 패키지 | 내용 | 사용처 |
|---|---|---|
| `@ai-jakdang/config` | tsconfig 베이스(node/react), ESLint 플랫 설정, Prettier 설정 | 전 워크스페이스 |
| `@ai-jakdang/contracts` | `signUpSchema` 등 Zod 스키마, `PublicUser`/페이지네이션/오류 응답 타입 | web, admin, api |
| `@ai-jakdang/database` | Drizzle `users` 스키마(예시), `getDb()` 클라이언트, drizzle.config | api, worker |
| `@ai-jakdang/core` | `deriveQuestionStatus`, `pointsForAction`, `gradeForPoints` 등 도메인 규칙 | web, api, worker |
| `@ai-jakdang/auth` | `Role`/`Permission` 타입, `hasPermission`/`canAccessAdmin` | web, admin, api |
| `@ai-jakdang/utilities` | `formatRelativeTime`, `slugify`, `formatCompactCount` 등 | 전역 |

공유 패키지는 TypeScript 소스를 그대로 export(`exports: "./src/index.ts"`)하며, Next 앱은 `transpilePackages` 로,
api/worker는 `tsx` 로 트랜스파일한다(별도 빌드 단계 없이 사용).

---

## 5. 실행 방법

먼저 의존성 설치:

```bash
pnpm install
```

개발 서버(앱별 독립 실행):

```bash
pnpm dev:web      # 사용자 사이트  http://localhost:3003
pnpm dev:admin    # 관리자 페이지  http://localhost:3004
pnpm dev:api      # API 서버       http://localhost:4003
pnpm dev:worker   # BullMQ 워커 (Redis 필요)
```

검증/품질:

```bash
pnpm typecheck    # 전 워크스페이스 tsc --noEmit
pnpm lint         # ESLint (저장소 전체)
pnpm test         # 전 워크스페이스 Vitest
pnpm build        # apps/* 빌드 (web/admin Next build)
pnpm format       # Prettier
```

DB 마이그레이션(스키마 작업 시):

```bash
pnpm --filter @ai-jakdang/database db:generate   # SQL 생성 → 검토
pnpm --filter @ai-jakdang/database db:migrate     # 적용 (운영은 push 금지)
```

---

## 6. 포트 / 환경변수

| 구분 | dev 포트 | 운영 도메인 예시 |
|---|---|---|
| 사용자 사이트 | 3003 | `www` / 루트 도메인 |
| 관리자 | 3004 | `admin` 서브도메인 |
| API | 4003 | `api` 서브도메인 |

실제 도메인/연결값은 환경변수로 관리한다(`.env.example` 참고). 주요 키:

- `WEB_PUBLIC_URL` / `ADMIN_PUBLIC_URL` / `API_PUBLIC_URL`
- `NEXT_PUBLIC_API_URL` (브라우저에서 호출할 API 주소)
- `DATABASE_URL` (PostgreSQL), `REDIS_URL` (Redis/BullMQ)
- `AUTH_SECRET`, `S3_*`, `SMTP_*` (해당 기능 구현 단계에서 사용)

---

## 7. 공유 가능 코드 vs 공유 금지 코드

**공유 가능 (packages/*, 비시각적):**
TypeScript 타입 · Zod 스키마 · API 요청/응답 규격 · DB 스키마 · 인증/권한 규칙 · 도메인 로직 · 범용 유틸 · ESLint/TS 설정

**공유 금지 (앱 내부에서만):**
디자인 토큰 · 색상/타이포/간격/라운드/그림자 · CSS 파일 · UI 컴포넌트 · 레이아웃 컴포넌트 · 반응형 규칙 · 버튼/입력/셀렉트/모달 디자인

- 사용자 UI 컴포넌트를 관리자에서, 관리자 컴포넌트를 사용자 사이트에서 재사용하지 않는다.
- `apps/admin` 은 `apps/web/styles/*`, `apps/web/components/*`, `apps/web/features/*` 를 import 하지 않는다.

---

## 8. 검증 상태(기반 단계 기준)

- `pnpm typecheck` 통과(10개 워크스페이스)
- `pnpm lint` 통과(0 error)
- `pnpm test` 통과(Vitest 34 tests: utilities 11, core 5, contracts 3, auth 4, web 컴포넌트 11)
- `pnpm build:web` / `pnpm build:admin` 성공(Next.js 16, Turbopack)
- API `/health` 응답 확인

자세한 사용자 디자인 시스템은 `docs/user-design-system-implementation.md`,
관리자 앱 독립 구조는 `docs/admin-frontend-structure.md` 참고.
