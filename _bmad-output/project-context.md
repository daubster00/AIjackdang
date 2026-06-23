---
project_name: 'AI작당 (AI Jakdang)'
user_name: 'daubs'
date: '2026-06-17'
sections_completed:
  ['technology_stack', 'boundaries_isolation', 'naming', 'response_data_formats', 'structure', 'communication', 'security', 'ux_errors', 'seo', 'workflow', 'anti_patterns']
status: 'complete'
rule_count: 50
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**모노레포**: pnpm 10.16.1 workspace (`apps/*` + `packages/*`), Node ≥22, ESM(`"type":"module"`), TypeScript 5.7 strict. Turborepo/Nx **미도입**(architecture는 `turbo.json` 조기 도입 권장 — 아직 없음).

**Frontend** (`apps/web` 포트 3003, `apps/admin` 포트 3004): Next.js ^16 (App Router, Turbopack) · React ^19 · `remixicon` ^4.9. 외부 UI/CSS 프레임워크 없음(자체 CSS 디자인 시스템).

**Backend** (`apps/api` 포트 4003): Fastify ^5.5 · `fastify-type-provider-zod` ^6.1 · Zod ^4.1 · `@fastify/cors` ^10 · `@fastify/helmet` ^13 · `@fastify/sensible` ^6 · `pino-pretty` ^13.

**Worker** (`apps/worker`): BullMQ ^5.34 · ioredis 5.10.1.

**DB** (`packages/database`, api/worker 전용): Drizzle ORM **^0.38** · drizzle-kit **^0.30** · pg ^8.13 → PostgreSQL 17 + pg_bigm(한국어 검색).

**Test/Quality**: Vitest ^3 · Testing Library(react 16 / dom 10 / jest-dom 6 / user-event 14) · jsdom ^25 · ESLint ^9(flat config) · Prettier ^3.4 · tsx ^4.19.

**⚠️ 계획됐으나 아직 미설치 (코드 작성 시 설치 필요)**: Better Auth(`packages/auth` 현재 빈 패키지) · `sanitize-html` · `@fastify/rate-limit` · `@fastify/swagger`(+ui). architecture.md는 이들을 전제하나 의존성에 없음 — 해당 Story에서 설치.

**버전 규칙**: drizzle-orm은 0.45가 아니라 **0.38 stable 유지**(v1.0 beta 금지, 업그레이드는 별도 Story). 모든 공유 패키지는 빌드 없이 TS 소스 직접 export(Next `transpilePackages` / `tsx`).

## Critical Implementation Rules

### 패키지 경계 & 격리 (최우선 — 위반 시 빌드/보안 깨짐)
- **DB 접근은 `apps/api`·`apps/worker`에서만.** web/admin 포함 모든 프런트는 API(`/api/v1/*`) 경유. Next 서버 컴포넌트·`packages/core`에서 Drizzle 직접 import 금지.
- **트랜잭션(`db.transaction()`)은 `apps/*`의 service 레이어(`routes/*/service.ts`)에서만** 연다. route handler·`packages/core`·컴포넌트에서 금지.
- **web ↔ admin 시각 자산(토큰·CSS·UI 컴포넌트) 완전 비공유.** admin은 `packages/admin-design-system`(순수 CSS+바닐라 JS) 사용. 공유는 비시각 패키지만(`contracts`·`auth`·`core`·`database`·`utilities`·`config`).
- **타입·검증은 `packages/contracts`(Zod)에서 import 재사용.** API에서 즉석 타입/로컬 스키마 정의 금지.
- **domain logic(순수 함수)은 `packages/core`에만**(`deriveQuestionStatus`/`pointsForAction`/`gradeForPoints`). 라우트·컴포넌트에 도메인 규칙 분산 금지. (용어는 "domain logic"으로 통일 — "business logic" 미사용.)
- **env는 `packages/config`의 Zod 단일 진입점.** 분산 `process.env` 접근 금지.
- 공유 패키지는 `./src/index.ts` 배럴 export. **transpiled 패키지에서 무거운 `export *` 배럴·순환 import 금지**(Next 빌드 깨짐).

### 네이밍
- **DB**: 테이블 `snake_case` 복수형(`posts`), 컬럼 `snake_case`(`created_at`) — 단 **Drizzle 프로퍼티는 camelCase**(`createdAt`). PK=`id` uuid `defaultRandom()`, FK=`{entity}_id`, 타임스탬프=`timestamptz`. enum=`pgEnum("snake_case",[...])`. Row 타입=`XxxRow`/`NewXxxRow`.
- **API**: 전 라우트 `/api/v1/*` prefix. 리소스=복수형 kebab(`/posts`), 다단어 경로 kebab(`/auth/sign-up`), 파라미터 `:id`, 쿼리=camelCase(`pageSize`).
- **Code**: 타입·컴포넌트 PascalCase, 함수·변수 camelCase. Zod 스키마=`xxxSchema` + 추론 타입 `Xxx`/`XxxInput`. 파일명: **컴포넌트=PascalCase**(`Button.tsx`), 그 외 모듈=lowercase(`qna.ts`). **named export 우선**(Next page/layout만 default 예외).

### 응답 & 데이터 포맷 (엄수)
- 성공: 단건=페이로드 직접(래퍼 없음). 목록=`{ items, meta: { page, pageSize, totalItems, totalPages } }`.
- **페이지네이션 = 오프셋 고정**(`page`/`pageSize`). **커서·무한 스크롤 금지**(SEO 일관).
- 오류: `{ error: { code, message, details? } }`. `code`=UPPER_SNAKE, `message`=사용자용 한국어. 검증은 Zod(body/query/params + 응답) via `fastify-type-provider-zod`.
- **본문 = Tiptap JSON 저장**(`content_json`). HTML 원본 저장 금지 → 렌더 시 서버에서 `sanitize-html` 화이트리스트로 안전 HTML 변환(코드블록 보존·script 차단). 에디터 노드 화이트리스트는 `packages/contracts/editor.ts`(server와 공유), React 컴포넌트는 `apps/web/features/editor/`.
- **날짜 = ISO 8601 UTC 문자열**(클라가 로컬 변환), DB는 `timestamptz`. JSON 필드=camelCase.
- **slug = `packages/utilities`의 단일 `slugify`**(한글+URL-safe+중복 시 `-{shortid}`).

### 구조
- Next 앱: 페이지 `app/`, 공통 UI `components/ui/`(폴더당: `Foo/{Foo.tsx, Foo.module.css, index.ts}`), 도메인 기능 `features/`, 헬퍼 `lib/`.
- CSS = CSS Modules, **모든 시각 값은 토큰 `var(--...)` 참조**(색·여백·radius 하드코딩 금지), 클래스 합성은 `@/lib/cn`. **반응형은 `tokens/breakpoints.css` 변수만**(`@media` 숫자 하드코딩 금지; 데스크톱 1024/태블릿 768).
- soft-delete = `status` enum(`draft`/`published`/`hidden`/`deleted`) + `deleted_at`.
- 테스트 = co-located `*.test.ts(x)`(Vitest).

### 통신 패턴
- **알림 = SSE + Redis Pub/Sub 팬아웃**(폴링 금지). ECS 다중 인스턴스에서 SSE 커넥션은 특정 인스턴스 고정 → worker/타 인스턴스 이벤트는 Redis Pub/Sub로 브로드캐스트. **단일 인스턴스 가정 금지**(스케일아웃 시 알림 유실). 이벤트명=`domain.event`(`comment.created`).
- **BullMQ**: 큐명=kebab(`email`,`file-scan`,`view-flush`,`cleanup`,`ranking`), job명=`domain.action`(`email.send`,`resource.scan`). 페이로드 타입은 `packages/contracts`. **worker 처리는 멱등(idempotent)**(재시도 안전). 무거운 작업(이메일·이미지·ClamAV 스캔·통계·hard-delete·랭킹)은 전부 worker로.
- **낙관적 업데이트**: 좋아요·북마크·도움된답변 토글에 적용, 실패 시 롤백 + danger 토스트.

### 보안
- **비밀번호 = Argon2id 단방향 해시**(평문/가역 암호화 금지).
- **인증 권위는 API 서버**(httpOnly 쿠키 세션), Next 앱은 쿠키 포워딩만. 클라이언트 권한 분기는 UX 편의일 뿐 — **최종 통제는 API**(`packages/auth`의 `hasPermission`/`canAccessAdmin`).
- **관리자 신원은 유저와 완전 분리**(ADR-0003): 별도 테이블(`admin_users`/`admin_sessions`/…), 별도 세션 쿠키(`aj_admin_session`), 별도 Better Auth 인스턴스(`/api/v1/admin/auth`). `/api/v1/admin/*`는 관리자 세션만 통과(유저 세션 불가). **유저는 역할 없음**(전원 일반 회원, 게이팅 분기) / **관리자만** `AdminRole`(staff|super_admin), 가입 후 super_admin 승인(pending→active) 필요.
- **업로드**: 허용 확장자(`.zip .md .txt .json .pdf .docx .xlsx`, 최대 3개) + 매직넘버 검증 → R2 저장(상태=검사중) → worker ClamAV 스캔 → 통과 시 공개. 다운로드는 로그인 필요.
- **rate limiting**=`@fastify/rate-limit`(로그인·등록·다운로드·문의). 게이미피케이션 자가추천·반복등록 차단은 `packages/core`.

### UX / 에러 처리 (UX EXPERIENCE.md가 SoT)
- **에러 표시**: 토스트=흐름 비중단 성공/정보 + 귀속 없는 서버 오류 / 인라인=폼 필드 귀속 오류(입력 유지 + 재시도). **색만으로 상태 전달 금지**(아이콘·텍스트 동반). 폼 검증=blur 시 개별 + submit 시 전체.
- **로딩**: 첫 로드·섹션=`Skeleton`(레이아웃 일치) / 액션 대기=`Spinner`·버튼 내 로딩. **버튼에 Skeleton 금지.** 빈 상태=`EmptyState`(원인+다음 행동 1개). **무한 스크롤 금지 → `Pagination`.**
- **행동 게이팅**: 읽기 개방, 행동(다운로드·작성·반응·쪽지·신고)은 로그인 필요. 비회원은 차단 화면이 아니라 **로그인 유도 모달** + URL `redirectTo`로 복귀(메모리 콜백 금지).

### SEO (NFR-1, 모든 렌더링의 최상위 제약)
- 공개 페이지는 SSR(서버 컴포넌트 우선). 페이지별 `generateMetadata`(메타·canonical·OG) + 유형별 JSON-LD(Article/QAPage/SoftwareSourceCode/ProfilePage/BreadcrumbList). `sitemap.xml`/`robots.txt` 자동 생성. 공지(`/notice`)도 Article JSON-LD 초기 포함. URL은 초기 고정(검색 유입 보호).

### 워크플로
- Git 미초기화 상태(현재 비-git). **drizzle-kit 마이그레이션 파일은 단일 소유권 + 머지 전 커밋 금지**(동시 작업 충돌 방지; `inquiry`/`notice` 주의).
- 개발: `pnpm dev:web|admin|api|worker`. 검증: `pnpm typecheck`/`lint`/`test`(Vitest)/`build` 전 워크스페이스 통과.
- **권위 계층(SoT, 충돌 시 우선)**: UX `EXPERIENCE.md`/`DESIGN.md` > `architecture.md` > `docs/*` > 코드. 규칙 변경은 architecture.md + 이 파일에 기록 후 적용. **단 예외**: UX 문서가 명시하지 않은 화면별 UI 디테일(버튼 구성·상호작용·상태 흐름·모달 내부)은 **이미 구현된 `apps/web`·`apps/admin` 컴포넌트 코드가 권위**다(프론트 선구현 완료 — 아래 정합성 규칙 참조).

### 프론트 선구현 — 디테일 정합성 (create-story·dev-story 필수)
> 전제: `apps/web`·`apps/admin`의 **모든 페이지 프론트엔드는 이미 구현 완료**(디자인 페이지=실제 컴포넌트). UI·상호작용의 진실 공급원은 epics.md가 아니라 기존 컴포넌트 코드다. epics.md/AC는 라우트(`/signup` 등)만 가리키고 컴포넌트 파일은 안 가리키므로, 아래 절차로 직접 연결해 디테일 누락을 막는다.

- **라우트→컴포넌트 해석(완독 필수)**: 스토리/작업의 ACs에 등장하는 라우트·화면을 파일로 해석해 **완독**한다. `/xxx` → `apps/web/app/xxx/`의 `page.tsx` + 동일 폴더 `*.tsx`, 그리고 거기서 import하는 `components/board`·`components/ui` 컴포넌트까지 따라간다. (예: `/signup` → `app/signup/SignupForm.tsx`, 게시글 상세 → `app/<board>/[slug]/`의 `CommentForm`·`ReportModal`·`ShareModal`·`ReactionBar`, 글쓰기 → `components/board/PostWriteForm.tsx`.)
- **존재하는 디테일 = 요구사항**: 읽은 컴포넌트의 모든 버튼·입력·상태·모달·토글·상호작용을 AC에 안 적혀 있어도 구현 요구사항으로 스토리에 명시한다(시스템이 end-to-end로 동작해야 함).
- **UI 계약 불변**: 기존 레이아웃·버튼 구성·상태 흐름(=UI 계약)은 변경하지 않는다. **백엔드·데이터·로직만 연결**한다. 디자인 변경이 필요하면 사용자 승인 후 진행.
- **양방향 정합성**: ① 코드엔 있는데 epics에 없는 기능 → 그 동작 기준으로 구현하고 `epics.md`에 역반영. ② epics엔 있는데 코드에 없는 화면 → `DESIGN.md` 토큰 준수로 컴포넌트를 먼저 추가한 뒤 구현(사용자 승인). 어느 쪽이든 코드와 기획을 일치 상태로 남긴다.

### 안티패턴 (절대 금지)
- ❌ contracts 우회 즉석 타입 정의 ❌ Next 서버 컴포넌트·`packages/core`에서 Drizzle 직접 호출 ❌ 본문을 HTML 문자열로 저장 ❌ 색/픽셀/breakpoint 하드코딩 ❌ 오류를 평문 문자열 반환 ❌ 커서 페이지네이션·무한 스크롤 ❌ 루프 내 개별 쿼리(N+1 — `with`/`inArray` 배치) ❌ 분산 `process.env` 접근 ❌ 무거운 배럴/순환 import ❌ web↔admin 시각 자산 공유 ❌ 스토리 착수 시 해당 화면의 기존 컴포넌트 미완독 ❌ 기존 UI 계약(버튼 구성·레이아웃·상태 흐름) 임의 변경.

---

## Usage Guidelines

**AI 에이전트용:**
- 코드 구현 전 이 파일을 먼저 읽는다. 모든 규칙을 정확히 따른다.
- 애매하면 더 제약적인 쪽을 택한다.
- 더 깊은 근거는 SoT 문서 참조: `_bmad-output/planning-artifacts/architecture.md`(§Implementation Patterns), `docs/adr/ADR-0001~0003`, UX `EXPERIENCE.md`/`DESIGN.md`.
- 새 패턴이 정해지면 architecture.md와 이 파일을 함께 갱신한다.

**사람용:**
- 이 파일은 lean하게 유지(에이전트가 놓치기 쉬운 비자명한 규칙만).
- 기술 스택/패턴 변경 시 갱신. 자명해진 규칙은 제거.
- ⚠️ **미설치 의존성 추적**: Better Auth·`sanitize-html`·`@fastify/rate-limit`·`@fastify/swagger`는 아직 미설치 — 설치 완료 시 "계획됨" 표기 제거.

Last Updated: 2026-06-22
