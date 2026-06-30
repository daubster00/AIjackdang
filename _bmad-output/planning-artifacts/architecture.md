---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-17'
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/addendum.md'
  - '_bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/reconcile-master-plan.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md'
  - 'docs/project-structure.md'
  - 'docs/user-design-system-implementation.md'
  - 'docs/admin-frontend-structure.md'
partyModeFindings:
  - 'turborepo: pnpm workspace에 빌드 그래프/캐시 없음 → 패키지 6~8개 넘으면 CI 전체 재빌드로 시간 선형 증가. turbo.json 조기 도입 검토(Winston+Amelia). 후속 단계에서 결정.'
  - 'korean-search: PostgreSQL 기본 tsvector는 한국어 형태소 처리 불가. pg_bigm(n-gram) vs Elasticsearch/Meilisearch를 DB 스키마 설계 前 선결정 필요(Winston, blocking). PRD Open Q-10.'
  - 'notif-sse: 알림 전달은 polling 대신 SSE(Next App Router Route Handler + Fastify) 권장. 초기 확정(Winston+Amelia).'
  - 'admin-via-api: apps/admin도 반드시 apps/api 경유로만 DB 접근(직접 Drizzle import 금지). ADR로 명시(Winston).'
  - 'migration-ownership: Drizzle 마이그레이션 파일 동시 작업 시 Git 자동 머지 불가 → 소유권 규칙/머지 전 커밋 금지 컨벤션 필요(Amelia). inquiry·inquiry_reply·notice 동시 작업 주의.'
  - 'barrel-circular: 공유 패키지(contracts/core)의 export * 배럴 + circular import는 Next transpilePackages 빌드를 깨뜨림 → 배럴/순환참조 컨벤션 정립(Amelia).'
  - 'notice-seo: /notice는 운영자 콘텐츠지만 검색 유입 목적 → generateMetadata + Article JSON-LD를 초기 story부터 포함(Winston).'
preImplementationBlockers:
  - 'sse-pubsub: SSE를 ECS 다중 인스턴스에서 쓰려면 Redis Pub/Sub 팬아웃 필요. (해결: 아키텍처 결정 §API에 명시 완료.)'
  - 'better-auth-providers: (de-risked + 설계완료 2026-06-17) Better Auth가 카카오·네이버·구글 네이티브 지원 확인. 신원·다계정 정책 + 인증 스키마 초안 = docs/adr/ADR-0002-identity-and-auth-schema.md. 카카오 이메일=(a)비즈앱 검수→email 필수. 남은 일: (사용자) 구글/네이버/카카오 개발자 앱 등록·키 발급·콜백 등록 + 카카오 비즈앱 검수 신청. (에이전트, 인증 Story) packages/auth Role 2→3단계 확장, Better Auth 산출 스키마와 ADR-0002 대조 확정, 실제 로그인 검증.'
  - 'auth-schema-design: (정정) 실제 DB/마이그레이션 없음 = DB는 그린필드. packages/database/src/schema/users.ts는 예시 placeholder일 뿐. 데이터 이전 이슈 아님. 인증 Story에서 예시 users.ts를 Better Auth 기대 스키마(user/session/account/verification) + 확장 컬럼(nickname/role/소셜 식별자)으로 처음부터 일관 설계(placeholder 대체). DB 스키마 Story 착수 전 설계 확정.'
  - 'local-dev-infra: ✅(완료 2026-06-17) ADR-0001 + 실제 인프라 파일 생성됨 — docker-compose.dev.yml, infra/postgres/Dockerfile, infra/postgres/init/01-pg_bigm.sql, .env.example 갱신(ClamAV/MinIO/OAuth/dev-bypass/관리자 시크릿, PG주석 18→17). `docker compose -f docker-compose.dev.yml up -d`로 즉시 부팅 가능. (스키마/Better Auth 코드는 구현 Story에서.)'
  - 'prd-ux-sync: ✅(완료 2026-06-17) 신규 요구사항 4건 PRD/UX 동기화 완료 — PRD FR-1.6/1.9·FR-5.1·FR-15(공지)·FR-16(문의)·FR-10.6/10.7·§8 IA·Q-9, UX user EXPERIENCE IA, admin EXPERIENCE 14번 메뉴. 잔여(튜닝): 신고 자동숨김 임계값(Q-13)·회원 제재 단계는 모더레이션 Story 전 확정. → ✅(확정 2026-06-30, Epic 12) Q-13 해소: 처리완료 기준 누적·자동 경고까지·자동 정지 금지, 회원 직접 신고(FR-8.6~8.8) 추가.'
  - 'pg_bigm-ranking: 통합검색 UNION ALL 시 bigm_similarity 스코어 정규화·랭킹 기준. 검색 Story 착수 전까지만 확정하면 됨(나머지 착수 비차단).'
workflowType: 'architecture'
project_name: 'AI작당 (AI Jakdang)'
user_name: 'daubs'
date: '2026-06-17'
newRequirements:
  - 'lounge-free-board: 작당 라운지 하위 자유 게시판 추가 (특정 주제 비고정, 다양한 AI 관련 글). 공통 게시판(FR-2.x) 구조 재사용. URL 후보 /lounge/free. PRD §6-5/§8 IA에 반영 필요.'
  - 'mypage-structure (Q-9 확정): 마이페이지를 활동 허브(/me)와 계정 설정(/settings)으로 분리. /me: 요약(/me) · 내 활동 탭(/me/activity: 글/질문/답변/댓글/자료) · 북마크(/me/bookmarks) · 내 뱃지·등급(/me/badges) · 알림(/me/notifications) · 쪽지(/me/messages) · 1:1 문의(/me/inquiries). /settings: 회원정보 수정(/settings/profile) · 비밀번호 변경(/settings/password) · 알림 설정(/settings/notifications) · 차단 목록(/settings/blocks) · 회원 탈퇴(/settings/account). 전부 로그인 필요+noindex. PRD FR-1.6 확장 필요.'
  - 'my-comments (신규): 작성한 댓글 모아보기(/me/activity 댓글 탭). 기존 comment 테이블 작성자 기준 조회. PRD FR-1.6에 댓글 누락 → 추가.'
  - 'password-change (신규): 로그인 상태 비밀번호 변경(/settings/password). 현행 FR-1.4는 분실 시 재설정 메일만 → 변경 엔드포인트 추가.'
  - 'profile-edit (신규 명시): 회원정보 수정 화면(/settings/profile, 닉네임·소개·프로필 이미지). FR-1.5는 공개 표시만 명시 → 편집 화면 추가.'
  - 'my-badges (신규 뷰): 마이페이지 내 보유 뱃지·등급 진행 뷰(/me/badges). FR-9.3 뱃지는 있으나 마이페이지 뷰 미명시.'
  - 'inquiry-system (신규 기능, Phase 1 확정·필수): 운영진 대상 1:1 문의(고객지원). 유저 /me/inquiries(작성+내역+답변 확인), 어드민 신규 메뉴 "문의 관리"(목록·상태 접수/처리중/완료·답변). 신규 엔티티 inquiry, inquiry_reply. 외주 문의 유입 경로(=#1 수익 경로)로 활용. 사용자 확정: Party Mode에서 Mary의 Phase 2 격하 권고가 있었으나 사용자가 "무조건 이번 개발에 포함" 지시 → Phase 1 필수로 확정. PRD 신규 FR(예: FR-15.x) + 어드민 IA 14번 메뉴 추가 필요.'
  - 'notice-board (신규/승격): 독립 공지 게시판(/notice, /notice/{slug}). 운영자만 작성·전체 읽기. 공통 게시판 구조 재사용하되 작성 권한 운영자 한정. 헤더·푸터 링크 + 메인 섹션 노출 + 중요 공지 상단 고정/배너 옵션. 공개·SSR·색인(noindex 예외). 현행 FR-10.1 공지글 플래그에서 독립 게시판으로 승격. PRD §6 + §8 IA 추가 필요.'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** PRD 기준 86개 FR, 16개 그룹.
- 계정·인증(9): 이메일+비밀번호, 소셜 로그인(구글/네이버/카카오), 공개 프로필, 마이페이지, 계정 설정, 탈퇴 → 공유 `auth` 패키지 + API 서버 통제.
- 콘텐츠(공통 게시판 7 + 작당 라운지 1[자유 게시판 포함] + 공지 3 = 11): 단일 "board" 도메인 모델을 게시판 유형(category)으로 인스턴스화(공지는 작성권한=운영자인 시스템 보드). 텍스트형 리스트 + 에디터 + 코드블록 + XSS 차단.
- 묻고답하기(9): 단일 통합, 질문=글형/답변=확장 댓글형, 상태값(답변대기/답변있음/해결됨), 도움된 답변(보상 미연결).
- 실전자료(8): 다운로드형 자료실, 카드형 목록, 단일 등록 폼, 평점·후기, 다운로드 로그인 게이팅 + 다운로드 수 집계.
- 메인·탐색(4) + 참여(9): 좋아요·조회수·댓글·대댓글·북마크·관련글·차단, 통합 검색, 태그 페이지(SEO 랜딩).
- 신고·모더레이션(5) + 관리자(7): 신고 큐, 신고 누적 자동 숨김, 회원 제재, soft-delete+보존기간+자동 hard-delete, 사후 관리 + 문의·공지 관리.
- 게이미피케이션(4): 포인트(뒷단)·등급·뱃지·랭킹 — 도메인 규칙은 `core` 패키지, 어뷰징 방지.
- SEO(9): 자동 메타·canonical·H1·breadcrumb·sitemap·robots·OG·JSON-LD(유형별)·noindex·GA4+Search Console.
- 알림(3) + 쪽지(2) + 1:1 문의(4): 인앱 알림, 1:1 DM(외주 문의 경로), 운영진 대상 문의(접수/처리중/완료).
- 약관(2): 한국 개인정보보호법 대응.

**Non-Functional Requirements (아키텍처 드라이버):**
- NFR-1 SSR/SEO (#1 과제) — 공개 페이지 서버 렌더링, 시맨틱 마크업. 모든 렌더링 결정의 최상위 제약.
- NFR-2 보안 — XSS 차단, 업로드 화이트리스트 + 자동 보안 스캔(Phase 1), 비밀번호 해시, CSRF, rate limiting, 어뷰징 방지.
- NFR-3 반응형/모바일, NFR-4 성능(수치 미정 Q-11), NFR-5 접근성.
- NFR-6 백그라운드 처리 — Redis+BullMQ 워커(이메일·이미지·통계).
- NFR-7 확장성 — 인증/타입/검증/비즈니스 로직을 향후 RN 앱과 공유(비시각 `packages/*`).
- NFR-8 URL 안정성 — 검색 유입 보호, 초기부터 고정.

**Scale & Complexity:**
- Primary domain: 풀스택 웹 (SSR 프런트 2종 + Fastify REST API + BullMQ 워커)
- Complexity level: 중상 (medium-high) — 넓은 도메인 + 다수 횡단 관심사, 단일 테넌트
- Estimated architectural components: apps 4(web/admin/api/worker) + packages 6+ + 외부 인프라(PostgreSQL/Redis/객체 스토리지/메일/검색)

### Technical Constraints & Dependencies

- 스택 확정(addendum, 충돌 시 원본 우선): Next.js+React+TypeScript(SSR), Fastify, PostgreSQL+Drizzle ORM, Redis+BullMQ, 자체 제작 CSS 디자인 시스템(Tailwind/MUI/Ant/Chakra/shadcn 미사용), Better Auth(추정), 향후 React Native+Expo. **PHP/Laravel 미사용.**
- 모노레포: pnpm workspace(Turborepo/Nx 미도입), Node >=22(배포 24 LTS 권장), TypeScript strict. 공유 패키지는 TS 소스 직접 export(`transpilePackages`/`tsx`).
- 격리 규칙: web/admin은 **시각 자산(토큰·CSS·UI 컴포넌트) 비공유**, 비시각 패키지(`contracts`·`auth`·`core`·`database`·`utilities`·`config`)만 공유. DB 직접 접근은 `api`·`worker` 한정, Next 앱은 API 경유.
- 디자인 시스템: 유저(`apps/web/styles+components/ui`)·어드민(`packages/admin-design-system`) 모두 구축 완료, codex 담당. 개발은 Claude Code 담당.
- 포트: web 3003 / admin 3004 / api 4003. 운영은 서브도메인 분리.

### Cross-Cutting Concerns Identified

- SSR/SEO 렌더링 파이프라인(메타·JSON-LD·sitemap·noindex) — 전 공개 페이지
- 인증/인가: 공유 `auth` 패키지(타입·규칙) + API 서버 최종 통제, 클라이언트 권한은 UX 편의일 뿐
- 본문 안전성: 사용자 입력 HTML/script 차단(새니타이즈), 코드블록·줄바꿈 보존
- 파일 업로드 + 자동 보안 스캔 + 객체 스토리지 서빙
- 백그라운드 잡(BullMQ): 이메일·이미지 변환·통계 집계
- 알림 전달 방식(인앱; 폴링 vs SSE 미정) + 1:1 쪽지
- 검색: 글·질문·자료 통합, 한국어 전문 검색 방식 미정(Q-10)
- 어뷰징 방지/rate limiting: 게이미피케이션 자가 추천·반복 등록 차단, 신고 자동 숨김
- 모더레이션 데이터 수명주기: soft-delete + 보존기간 + 자동 hard-delete, 감사 메모
- 캐싱/성능: 목록·상세·검색 응답(수치 목표 미정 Q-11)

### Open Architecture Decisions (PRD/UX가 아키텍처로 이관)
- DB 스키마 설계(Q-2), SEO 자동 생성 규칙 + 실전자료 JSON-LD 타입(Q-4), 한국어 전문 검색 방식(Q-10), 알림 전달 메커니즘, URL 최종 확정(Q-3, 자유 게시판 URL 포함), 성능 목표 수치(Q-11)

## Starter Template Evaluation

### Primary Technology Domain

풀스택 웹(SSR 프런트 2종 + Fastify REST API + BullMQ 워커). 모노레포(pnpm workspace).

### Decision: 신규 스타터 미도입 — 기존 스캐폴딩이 기반

이 프로젝트는 **그린필드가 아니라 브라운필드**다. `docs/project-structure.md` 기준의 모노레포가 이미
스캐폴딩되어 있고(`apps/web|admin|api|worker` + `packages/*`), 스택은 addendum에서 확정·구현되었다.
따라서 외부 스타터(T3/create-next-app/RedwoodJS 등)를 새로 도입하지 않는다 — 도입하면 확정된 격리 규칙
(web/admin 시각 자산 비공유, DB 접근 api/worker 한정)·자체 CSS 디자인 시스템·이미 구축된 디자인 시스템
패키지와 충돌한다. **기존 리포지토리 구조 자체가 우리의 검증된 기반(de-facto starter)이다.**

> 버전은 외부 스타터 가정값이 아니라 **실제 설치된 `package.json`에서 확정**했다(브라운필드라 이게 정확).
> Party Mode 검토 결과 세 관점(Architect·Dev·Analyst) 모두 이 기반 결정에 동의. 단, 후속 단계에서 다룰
> 리스크는 frontmatter `partyModeFindings`에 기록(Turborepo 조기 도입, 한국어 검색 인프라 선결정, 알림 SSE,
> admin도 API 경유 ADR, 마이그레이션 소유권 규칙, 배럴/순환참조 컨벤션, 공지 SEO 초기 포함).

### Established Foundation (이미 적용·검증됨)

**Language & Runtime:** TypeScript 5.7 (strict), Node ≥22(배포 Node 24 LTS 권장), ESM(`type: module`), pnpm 10.16.1 workspace (Turborepo/Nx 미도입 — 도입 여부는 후속 검토).

**Frontend (apps/web, apps/admin):** Next.js 16 (App Router, Turbopack) + React 19. 자체 제작 CSS 디자인 시스템(CSS Modules + CSS 변수 토큰, 외부 UI/CSS 프레임워크 미사용). 아이콘 Remix Icon 4.9. **web/admin 시각 자산 완전 격리** — admin은 `packages/admin-design-system`(순수 CSS+바닐라 JS) 사용.

**Backend (apps/api):** Fastify 5.5 REST API + `@fastify/cors`·`@fastify/helmet`·`@fastify/sensible`, `fastify-type-provider-zod` 6, Zod 4.1. DB 직접 접근은 api/worker만 (admin 포함 모든 프런트는 API 경유).

**Worker (apps/worker):** BullMQ + Redis 백그라운드 워커(이메일·이미지 변환·통계).

**Shared packages (비시각만 공유):** `config`(tsconfig/ESLint/Prettier), `contracts`(API 타입+Zod), `database`(Drizzle 스키마, api/worker 전용), `core`(도메인 규칙: 질문 상태·포인트·등급), `auth`(권한 타입·`hasPermission`/`canAccessAdmin`), `utilities`. 모두 TS 소스 직접 export(`transpilePackages`/`tsx`, 별도 빌드 없음).

**Testing / Quality:** Vitest 3 + Testing Library + jsdom. ESLint 9 (flat config) + Prettier 3.4. `pnpm typecheck`/`lint`/`test`/`build` 전 워크스페이스 통과 확인됨(기반 단계).

**Ports:** web 3003 / admin 3004 / api 4003. 운영은 서브도메인 분리.

**Note:** 신규 프로젝트 초기화 스토리는 불필요. 첫 구현 스토리는 "스타터 셋업"이 아니라
**기존 기반 위에서 첫 도메인 수직 슬라이스(예: 인증 또는 공통 게시판) 구현**이 된다.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (구현 차단 해소):**
- 한국어 전문 검색 = PostgreSQL `pg_bigm`(2-gram 인덱스 확장) — AWS RDS/PG17 지원 확인
- 호스팅 = AWS(ECS/RDS/ElastiCache) / 객체 스토리지 = Cloudflare R2 / 파일 보안검사 = ClamAV(worker 비동기)
- 콘텐츠 데이터 모델(다형성 처리), 인증(Better Auth) 세션 전략

**Important Decisions (아키텍처 형성):**
- 알림 전달 = SSE, 캐싱 전략, XSS 새니타이즈, rate limiting, API 문서, 프런트 상태관리, CI + Turborepo

**Deferred (Post-MVP):** 유료결제·자료마켓·실시간 채팅(Phase 2). 검색 고도화(랭킹·동의어)는 pg_bigm 한계 도달 시 Meilisearch 이관 검토.

### Data Architecture

- **DB**: PostgreSQL 17 + Drizzle ORM(`drizzle-orm` 0.38.x stable, `drizzle-kit` 0.30.x). v1.0은 beta라 stable 유지(0.45 금지), 업그레이드는 별도 스토리. DB 접근은 `apps/api`·`apps/worker`만(admin 포함 프런트는 API 경유 — ADR).
- **콘텐츠 모델링(다형성)**: 콘텐츠 유형별 분리 테이블 + 횡단 참여는 다형 참조.
  - `post`(게시판·작당라운지·자유게시판·**공지** 통합 — `board`/카테고리로 구분, 공지는 작성권한=운영자인 시스템 보드) / `question`·`answer`(묻고답하기) / `resource`·`resource_file`(실전자료).
  - 참여 테이블은 `(target_type, target_id)` 다형 참조: `comment`(대댓글 1단계), `reaction`(좋아요), `bookmark`, `report`, `rating`(자료 평점). `tag` + `taggable` 다형 연결.
  - `inquiry`·`inquiry_reply`(1:1 문의, 신규). `notification`(알림), `message`(쪽지), `block`(차단), `points_ledger`(포인트 원장)·`badge`·`user_badge`·`grade`(게이미피케이션).
- **데이터 모델 동기화 (2026-06-22, PRD/에픽 추가분 반영 — 이전 06-17 모델에 누락됐던 항목)**:
  - `follows`(팔로우 관계, FR-7.10 / Epic 5): `follower_id`·`following_id` FK + 복합 PK + 자기참조 금지 CHECK. **다형 참여가 아니라 user→user 그래프**라 `block`과 별개 전용 테이블. (06-17 모델엔 `block`만 있었음)
  - `post_creative_spec`(AI 창작마당 창작물 스펙, FR-5.2 / Epic 2): `post_id` FK(1:1)·`media_type`·`tools` jsonb·`prompt`·`negative_prompt`·`params` jsonb·`postprocess` jsonb·`cost_type`·`license_note`. 전 항목 선택. **내가 만든 AI 제품에는 미적용**(창작마당 전용).
  - `recruit_post`(작당 의뢰소 구인·외주, FR-5.3 / Epic 2): `post_id` FK(1:1)·`post_kind` enum(`request`/`offer`)·`fields` jsonb(분야 다중)·`recruit_status` enum(`open`/`closed`)·`budget`·`duration`·`work_mode`·`contact_method` jsonb.
  - `notification_settings`(알림 종류별 on/off, FR-12.3 / Epic 7): `user_id` unique·`settings` jsonb.
  - `link_previews`(링크 OG 자동수집 캐시, FR-11.7 / Epic 8): `url` PK·`title`·`description`·`image_url`·`site_name`·`fetched_at`·`error_at`.
  - `users` 추가 컬럼: `default_avatar_index` int **NOT NULL**(기본 프로필 이미지 인덱스, 가입 시 랜덤 배정 — FR-1.10)·`banner_url` nullable(배너)·`links` jsonb nullable(외부 링크 — FR-1.9)·`terms_agreed_at`·`terms_version`(약관 동의 — FR-14.1)·`suspended_until` nullable(일시정지 종료일 — FR-8.4). ⚠️ Story 1.2 첫 스키마부터 포함(누락 시 마이그레이션 재작성).
  - `posts` 추가 컬럼: `is_pinned` boolean default false(상단 고정 — FR-15.2)·`seo_title`·`seo_description` nullable(운영자 SEO 보정 — FR-10.4).
  - **기존 테이블 컬럼 명세 보강(설계 의도 고정)**: `questions`={`is_resolved` bool·`helpful_answer_id` nullable FK→answers} / `resources`={`environment` text[]·`difficulty` enum·`description_json`·`usage_json`·`caution_json`·`version`·`reference_links` jsonb·`copyright_agreed` bool(FR-14.2)·`download_count`·`avg_rating`·`rating_count`} / `comments.target_type` 허용값={`post`|`question`|`answer`|`resource`|`comment`(대댓글)} / `points_ledger`={`source_type`·`source_id`(멱등키)} / `badges.is_auto`·`user_badges.granted_by` / `user_sanctions`={`type`·`starts_at`·`ends_at`·`reason`·`admin_id`} / `ad_slots`={`position`·`device_target`·`start_at`·`end_at`·`is_active`·`code`·`click_count`·`impression_count`}.
- **검색**: `pg_bigm` GIN 인덱스를 `post`/`question`/`resource`의 제목·본문 파생 컬럼에. 글·질문·자료 통합 검색은 API에서 유형별 질의 후 병합. (인프라 추가 없음 → 초기 적합. 한계 시 Meilisearch 이관.)
- **soft-delete + 보존**: 콘텐츠/자료/댓글은 `status`(공개/숨김/삭제) soft-delete, `deleted_at` + 보존기간(예: 30일) 후 worker가 자동 hard-delete(휴지통 자동 비움). 운영자=숨김 상한, 자동/수동 영구삭제=최고관리자/시스템.
- **캐싱**: ① Next.js SSR 캐시(route segment 캐시/재검증) — 공개 목록·상세·태그 페이지. ② Redis — 인기글·랭킹·조회수 버퍼(조회수는 Redis 집계 후 worker가 주기 flush). 무한스크롤 미사용·페이지네이션(SEO·색인 안정).
- **마이그레이션 규칙(Party Mode)**: `drizzle-kit generate` 파일은 단일 소유권/머지 전 커밋 금지 컨벤션. `inquiry`·`notice` 등 동시 작업 충돌 방지.

### Authentication & Security

- **인증**: Better Auth(`packages/auth`). 세션 = httpOnly 쿠키, **API 서버가 인증 권위**, Next 앱은 쿠키 포워딩. 소셜 = 구글·**네이버·카카오 모두 Better Auth 네이티브 지원**(genericOAuth 불필요, 2026-06-17 확인). 이메일+비밀번호(가입 시 이메일 인증·Argon2id), 로그인 상태 비밀번호 변경 엔드포인트(신규). 비밀번호·소셜 토큰은 `accounts` 테이블 보유(계정 연결).
- **신원·다계정 정책 (ADR-0002)**: 이메일+비밀번호(+인증)+소셜 유지. 카카오 이메일 = **(a) 비즈앱 검수로 확보** → `users.email` 필수·유니크. 다계정은 **계정 연결(account linking) + 행동 레이어 방어(FR-9.1 자가추천 차단·일일 상한·1인1자료1회) + 저비용 가드(일회용 이메일 차단·가입 rate limit·닉네임 유니크)** 로 통제. **휴대폰 본인인증은 비도입 — 발동조건(실제 어뷰징 관측 / Phase 2 결제) 시 도입.**
- **관리자 신원 = 유저와 완전 분리 (ADR-0003)**: 별도 테이블(`admin_users`/`admin_sessions`/`admin_accounts`/`admin_verifications`), 별도 세션 쿠키(`aj_admin_session`, admin 서브도메인 한정), 별도 Better Auth 인스턴스(basePath `/api/v1/admin/auth`). **유저 가입/로그인이 관리자에 0 영향.** 관리자는 이메일+비밀번호(소셜 없음) + **이름·연락처** 수집. **가입 후 최고관리자 승인(status pending→active)해야 로그인** 가능. 최초 super_admin은 시드 부트스트랩.
- **인가**: **유저**는 역할 없음(전원 일반 회원, 게이팅으로 분기). **관리자**는 `AdminRole`(staff|super_admin) + 권한맵(운영자=숨김 상한 / 최고관리자=영구삭제·설정·광고·운영자 승인·권한변경). **클라이언트 분기는 UX 편의, 최종 통제는 API**. `/api/v1/admin/*`는 **관리자 세션만** 통과(유저 세션 불가). 현행 `packages/auth` `Role(member|admin)`은 유저용/관리자용으로 **분리 리팩터링 필요**(ADR-0003).
- **본문 안전성(XSS)**: 서버측 `sanitize-html` 2.17.x — 에디터 허용 기능(FR-2.5: 굵게·H2/H3·목록·링크·이미지·코드블록·인용·제한 색상·형광펜)에 맞춘 태그/속성 화이트리스트. 코드블록 줄바꿈·특수문자 보존, script/HTML 실행 차단.
- **업로드 보안**: 허용 확장자(`.zip .md .txt .json .pdf .docx .xlsx`, 최대 3개) + 매직넘버 검증 → R2 저장(상태=검사중) → `apps/worker`가 ClamAV(clamd) 비동기 스캔 → 통과 시 공개/감염 시 격리. 다운로드는 로그인 필요(FR-4.6).
- **API 보안**: `@fastify/helmet`(설치됨), `@fastify/cors`, `@fastify/rate-limit` 10.3.x(로그인·등록·다운로드·문의 등 어뷰징 방지), CSRF(쿠키 기반), 게이미피케이션 자가추천·반복등록 차단(`packages/core`).

### API & Communication Patterns

- **스타일**: REST(`/api/v1/*`), Fastify 5.5. 요청·응답 계약은 `packages/contracts`(Zod 4.1) 공유 + `fastify-type-provider-zod`로 타입 일관.
- **알림 전달 = SSE + Redis Pub/Sub 팬아웃**: `apps/api` Fastify SSE 라우트로 단방향 푸시(헤더 종 배지·실시간 알림). **ECS 다중 인스턴스 대응**: SSE 커넥션은 특정 api 인스턴스에 고정되므로, worker/다른 api 인스턴스가 발생시킨 이벤트는 **Redis Pub/Sub 채널**(BullMQ와 동일 Redis)로 브로드캐스트 → 해당 유저 커넥션을 보유한 인스턴스만 push. (단일 인스턴스 가정 금지 — 누락 시 스케일아웃에서 알림 유실. Party Mode — Winston.) 미수신분은 알림 목록(`/me/notifications`)에서 보강.
- **API 문서**: `@fastify/swagger` 9.5.x + `@fastify/swagger-ui` 5.2.x(OpenAPI 자동 생성, Zod 스키마 연동).
- **에러 표준**: `@fastify/sensible` + 표준 오류 응답 스키마(`code`·`message`·`details`)를 `packages/contracts`에 정의. 프런트는 토스트/인라인 일관 처리.

### Frontend Architecture

- **렌더링**: Next.js 16 App Router, **공개 페이지 SSR**(서버 컴포넌트 우선, NFR-1). 작성·반응 등 인터랙션만 클라이언트 컴포넌트.
- **상태관리**: 서버 컴포넌트 + URL 상태(필터·정렬·탭은 쿼리스트링 — 딥링크·SEO, EXPERIENCE.md) 우선. 전역 client 상태는 최소(인증 컨텍스트·토스트 `ToastProvider` 기존 활용). 복잡한 클라 상태 필요 시에만 경량 store(Zustand) 도입.
- **데이터 패칭**: 서버 컴포넌트 → `apps/api` 호출(쿠키 포워딩). 클라이언트 변이는 API 직접 호출 + 낙관적 업데이트 선택적.
- **디자인 시스템**: 기존 자체 CSS(web `components/ui` / admin `packages/admin-design-system`) 사용, 시각 자산 web↔admin 비공유 유지.
- **SEO 구현**: 페이지별 `generateMetadata`(메타·canonical·OG), 유형별 JSON-LD(Article/DiscussionForumPosting/QAPage/SoftwareSourceCode/ProfilePage/BreadcrumbList), `sitemap.xml`/`robots.txt` 자동 생성, 태그 페이지 SEO 랜딩, 빈약 페이지 noindex. **공지(/notice)도 Article JSON-LD + 메타 초기 포함**(Party Mode).

### Infrastructure & Deployment

- **호스팅 = AWS**: 4개 앱(web/admin/api/worker) 컨테이너(ECS Fargate 권장; ECR 이미지) + **RDS PostgreSQL 17**(pg_bigm 확장 활성) + **ElastiCache Redis**(BullMQ/캐시) + **Cloudflare R2**(객체 스토리지, S3 호환) + CloudFront(web/admin 앞단). 시크릿은 SSM/Secrets Manager. web 3003 / admin 3004 / api 4003 → 서브도메인 분리(`www`/`admin`/`api`).
- **교차 클라우드 주의**: 컴퓨트·DB는 AWS, 객체 스토리지는 R2 → 백업·모니터링 2곳 관리(R2 egress 무료 이점과 트레이드오프).
- **CI/CD**: GitHub Actions → typecheck/lint/test → 이미지 빌드 → ECR → ECS 배포. **Turborepo(`turbo.json`) 조기 도입**으로 affected 빌드/테스트 캐시(Party Mode 리스크 대응).
- **로깅/모니터링**: `pino`(api 설치됨) 구조화 로그 → CloudWatch. 분석은 GA4 + Google Search Console(FR-11.8).
- **백그라운드**: `apps/worker`(BullMQ) — 이메일·이미지 변환·통계 집계·ClamAV 스캔·조회수 flush·자동 hard-delete·랭킹 산정.

### Decision Impact Analysis

**Implementation Sequence (권장):**
1. 인프라 결정 ADR 고정(API 단독 DB 접근, 마이그레이션 규칙, 배럴/순환참조 컨벤션) + `turbo.json`
2. DB 스키마(`packages/database`) — user·post·question·answer·resource·engagement·tag + pg_bigm 인덱스
3. 인증/인가(Better Auth + 소셜 + 권한) — 모든 행동 게이팅의 토대
4. 공통 게시판 수직 슬라이스(목록·상세·작성·SSR·SEO) → 묻고답하기 → 실전자료(+R2+ClamAV)
5. 참여(댓글·좋아요·북마크) → 게이미피케이션 → 알림(SSE)·쪽지 → 문의·공지 → 어드민 → 검색·랭킹

**Cross-Component Dependencies:**
- pg_bigm 결정 → DB 스키마(검색 컬럼/인덱스)를 직접 규정 → 스키마는 검색 결정 후 착수
- ClamAV/R2 → 실전자료 업로드 플로우 + worker 동시 필요
- SSE 알림 → api 라우트 + worker 이벤트 발행 연동
- 권한(packages/auth) → web·admin·api 전부 의존(최우선)

## Implementation Patterns & Consistency Rules

기존 스캐폴딩에서 추출한 권위 있는 컨벤션 + 다중 AI 에이전트 충돌 방지 규칙. **충돌 시 이 규칙이 이긴다.** 새 코드는 기존 패턴을 확장할 뿐, 새 스타일을 임의 생성하지 않는다. (Party Mode 보강: Amelia·Sally·Paige.)

### Naming Patterns

**Database (Drizzle + PostgreSQL):**
- 테이블명 = `snake_case` 복수형(`users`, `posts`, `resource_files`). 컬럼 = `snake_case`(`password_hash`, `created_at`), **Drizzle 프로퍼티는 camelCase**(`passwordHash`, `createdAt`).
- PK = `id` `uuid` `defaultRandom()`. FK = `{entity}_id`(`user_id`, `post_id`). 타임스탬프 = `timestamptz`(`created_at`/`updated_at`/`deleted_at`).
- enum = `pgEnum("snake_case", [...])`(예: `user_role`). Row 타입 = `XxxRow`/`NewXxxRow`(`$inferSelect`/`$inferInsert`).
- soft-delete = `status` enum(`draft`/`published`/`hidden`/`deleted`) + `deleted_at`.

**API (Fastify REST):**
- 모든 서비스 API는 `/api/v1/*` 버전 prefix. 리소스 = 복수형 kebab(`/posts`, `/resources`), 다단어 경로 kebab(`/auth/sign-up`). 라우트 파라미터 `:id`. 쿼리 파라미터 = `camelCase`(`pageSize`).
- HTTP 상태 코드를 의미대로 사용(200/201/400/401/403/404/409/422/501 등).

**Code (TypeScript):**
- 타입·컴포넌트 = `PascalCase`(`UserRow`, `PostCategory`, `Button`). 함수·변수 = `camelCase`(`deriveQuestionStatus`, `pointsForAction`). 상수 enum 값은 도메인에 따름(카테고리 kebab `vibe-coding`, 상태 lowercase `published`).
- Zod 스키마 = `xxxSchema` + 추론 타입 `Xxx`/`XxxInput`(`createPostSchema` → `CreatePostInput`). 입력 필드 = `camelCase`.
- 파일명: **컴포넌트 = PascalCase**(`Button.tsx`), 그 외 모듈 = lowercase(`string.ts`, `qna.ts`, `cn.ts`). named export 우선(default export 지양, Next page/layout 예외).

### Structure Patterns

**Project Organization (기존 모노레포 준수):**
- **domain logic**(순수 함수) = `packages/core`(`deriveQuestionStatus`/`pointsForAction`/`gradeForPoints` 식). **라우트·컴포넌트에 도메인 규칙을 두지 않는다.** (용어: 본 문서는 "domain logic"으로 통일하며 "business logic"을 혼용하지 않는다 — Glossary 참조.)
- API 타입·Zod = `packages/contracts`(web/admin/api 공유, 중복 정의 금지). DB 스키마 = `packages/database`(api/worker 전용). 권한 = `packages/auth`. 범용 유틸 = `packages/utilities`. 환경변수 검증 = `packages/config`.
- 공유 패키지는 `./src/index.ts` 배럴 export. **transpiled 패키지에서 무거운 `export *` 배럴/순환 import 금지**(Next 빌드 깨짐 — Party Mode).
- Next 앱 = App Router. 페이지=`app/`, 공통 UI=`components/ui/`(폴더당), 도메인 기능=`features/`, 헬퍼=`lib/`.

**File Structure (컴포넌트 — 기존 규칙):**
- 컴포넌트는 폴더 단위: `Button/{Button.tsx, Button.module.css, Button.types.ts(복잡 시), Button.test.tsx(핵심), index.ts}`. 배럴 `index.ts`로 export, `components/ui/index.ts`에 재노출.
- CSS = CSS Modules, **모든 시각 값은 토큰 `var(--...)` 참조**(하드코딩 금지), 클래스 합성은 `@/lib/cn`. 외부 UI/CSS 프레임워크 금지. **반응형은 `tokens/breakpoints.css` 변수만 사용**(데스크톱 1024 / 태블릿 768; `@media` 숫자 하드코딩 금지).
- 테스트 = co-located `*.test.ts(x)`, Vitest.

### Format Patterns

**API Response (기존 규격 — 엄수):**
- 성공: 단건 = 페이로드 직접 반환(래퍼 없음). 목록 = `{ items: [...], meta: { page, pageSize, totalItems, totalPages } }`(`paginatedResponseSchema`).
- **페이지네이션 = 오프셋 고정**: `paginationQuerySchema`(`page`,`pageSize`) + `paginationMetaSchema`. **커서 방식 금지**(혼용 방지·SEO 페이지네이션 일관).
- 오류: `{ error: { code, message, details? } }`. `code` = `UPPER_SNAKE`(`NOT_IMPLEMENTED`, `UNAUTHORIZED`). `message` = 사용자용 한국어, `details` = 선택. 내부 코드와 사용자 메시지 분리.
- 검증 = Zod(요청 body/query/params + 응답) via `fastify-type-provider-zod`. 클라이언트도 동일 `contracts` 스키마 재사용.

**Data Formats:**
- JSON 필드 = `camelCase`(`pageSize`, `totalItems`, `contentJson`). **날짜 = ISO 8601 UTC 문자열**(클라이언트가 로컬 변환 책임), DB는 `timestamptz`. boolean = `true`/`false`.
- **게시글/질문/답변 본문 = Tiptap JSON**(`content_json`)으로 저장(HTML 원본 저장 안 함). 렌더 시 서버에서 안전 HTML로 변환 + `sanitize-html` 화이트리스트(코드블록 보존, script 차단).
- **slug**: `packages/utilities`의 단일 `slugify`로 생성(한글 처리 + URL-safe + 중복 시 `-{shortid}` suffix). 게시글·자료·공지 slug 일관.

### Communication Patterns

**Background Jobs (BullMQ):**
- 큐 이름 = kebab(`email`, `image`, `stats`, `file-scan`, `view-flush`, `cleanup`). job 페이로드는 `packages/contracts`에 타입 정의. job 이름 = `domain.action`(`email.send`, `resource.scan`).
- worker는 멱등(idempotent) 처리 지향(재시도 안전). 무거운 작업(이메일·이미지·스캔·통계·hard-delete·랭킹)은 전부 worker로.

**Notifications (SSE) & State:**
- 알림 이벤트 = `domain.event` 명명(`comment.created`, `answer.created`, `report.resolved`). SSE 페이로드 = `contracts` 타입.
- 프런트 상태 = 서버 컴포넌트 + URL 쿼리 우선(필터·정렬·탭). client 상태 변이는 불변 업데이트. 전역은 인증 컨텍스트·`ToastProvider`만 기본.
- **낙관적 업데이트**: 좋아요·북마크·도움된답변 등 빠른 토글에 적용, 실패 시 상태 롤백 + danger 토스트.

### Process Patterns

**Transaction & Data Access (Party Mode — Amelia):**
- `db.transaction()`은 **`apps/api`·`apps/worker`의 service 레이어에서만** 연다. `packages/core`·route handler·컴포넌트에서 직접 열지 않는다.
- **N+1 방지**: 1:N 이상 관계는 Drizzle `with` 절 또는 `inArray` 배치 로딩. 루프 내 개별 쿼리 금지.
- 마이그레이션 파일(`drizzle-kit generate`)은 단일 소유권·머지 전 커밋 금지(충돌 방지).

**Error Handling:**
- API = 표준 오류 셰이프로만 응답(`{error:{code,message}}`). 예측된 도메인 오류는 적절한 상태코드 + `code`. 예외는 Fastify 글로벌 핸들러가 표준화.
- 클라이언트 오류 표시 기준: **토스트** = 흐름 비중단 성공/정보 + 귀속 위치 없는 서버 오류 / **인라인** = 폼 필드·특정 블록 귀속 오류(필드 아래 meta 13px, `--color-danger`). 입력 유지 + 재시도. **색만으로 상태 전달 금지**(아이콘·텍스트 동반).
- **폼 검증 타이밍**: blur 시 개별 필드 + submit 시 전체.
- 권한 = API가 최종 통제(`packages/auth`의 `hasPermission`/`canAccessAdmin`). 클라이언트 분기는 UX 편의일 뿐.

**Loading / Empty / Auth-gating:**
- **로딩 표시**: 첫 로드·섹션 = `Skeleton`(레이아웃 일치), 액션 대기(submit·이동) = `Spinner`/버튼 내 로딩. **버튼에 Skeleton 금지.** 빈 상태 = `EmptyState`(원인 + 다음 행동 1개). 무한 스크롤 금지 → `Pagination`.
- 비회원 행동 시도 = 차단 화면이 아니라 **로그인 유도 모달**(가치 강조). 복귀는 URL `redirectTo` 파라미터로 통일(메모리 콜백 금지) → 로그인 후 원행동 복귀.

**Editor (Tiptap — 2 preset, Party Mode — Sally):**
- `full`(게시글·공지 — 굵게·H2/H3·목록·링크·이미지·코드블록·인용·제한색·형광펜) / `lite`(답변·문의·후기 — 줄바꿈·링크·이미지·코드블록). **허용 노드 목록(스키마)은 `packages/contracts/editor.ts`**(server 새니타이즈와 공유), **에디터 React 컴포넌트·preset 구성은 `apps/web/features/editor/`**(시각 자산이므로 web 내부, admin은 별도). web/admin 간 에디터 컴포넌트 비공유, 노드 화이트리스트만 contracts로 공유.

**Security:**
- 비밀번호 = **Argon2id 단방향 해시**(평문/가역 암호화 금지). 업로드 = 확장자·매직넘버 검증 → R2 저장(검사중) → worker ClamAV 스캔. rate limiting = `@fastify/rate-limit`. env = `packages/config` Zod 단일 진입점(분산 `process.env` 접근 금지).

### Enforcement Guidelines

**All AI Agents MUST:**
- 타입·검증은 `packages/contracts`에서 import해 재사용(중복 정의·로컬 타입 생성 금지).
- DB 접근은 `apps/api`·`apps/worker`에서만(web/admin은 API 경유, Drizzle 직접 import 금지). 트랜잭션은 service 레이어에서만.
- domain logic은 `packages/core` 순수 함수로(테스트 동반), 라우트/컴포넌트에 흩지 않기.
- UI는 기존 `components/ui` + 토큰만 사용, 새 색·여백·radius·breakpoint 하드코딩 금지. web↔admin 시각 자산 비공유.
- API 응답·오류 셰이프, DB/코드 네이밍, 페이지네이션(오프셋), 날짜(UTC) 규칙을 그대로 따른다.

**권위 계층(SoT, 충돌 시 우선순위):** UX `EXPERIENCE.md`/`DESIGN.md`(시각·행동) > `architecture.md`(기술·구조) > `docs/*`(구현 메모) > 코드. `docs/*` 상단에 `deferred-to` 메타 부착(후속 작업).

**Pattern Enforcement:** 자동 집행(=`pnpm typecheck`/`lint`/Zod 스키마)과 리뷰 집행 항목을 분리. 규칙 변경은 이 문서 + `project-context.md`(step-07 생성)에 기록 후 적용. project-context.md 생성 전 착수하는 story는 `architecture.md §Implementation Patterns`를 반드시 확인.

**신규 요구사항 상태:** mypage/settings·inquiry·notice·자유게시판 → **PRD/UX 동기화 완료(2026-06-17)**. (PRD FR-1.6/1.9·FR-5.1·FR-15·FR-16·FR-10.6/10.7·§8·Q-9, UX user/admin EXPERIENCE 반영.) 잔여 튜닝값(신고 임계값·제재 단계)은 모더레이션 Story 전 확정.

### Glossary

- **domain logic**: 게시글 상태 도출·포인트·등급 등 순수 비즈니스 규칙(`packages/core`). ("business logic"이라는 표현은 본 문서에서 쓰지 않는다.)
- **service 레이어**: `apps/api`/`apps/worker`에서 DB 트랜잭션·외부 IO를 조율하는 계층(라우트 핸들러와 분리).
- **content_json**: 게시글/질문/답변 본문의 Tiptap JSON 원본(렌더 시 안전 HTML로 변환).
- **행동 게이팅**: 읽기는 개방, 다운로드·작성·반응·쪽지·신고 등 "행동"은 로그인 필요(로그인 유도 모달 + `redirectTo` 복귀).
- **PENDING-PRD-SYNC**: 아키텍처에서 확정됐으나 PRD/UX 본문에 아직 미반영된 신규 요구사항 상태.

## Project Structure & Boundaries

> 기존 모노레포(`docs/project-structure.md`)를 도메인 기능까지 확장한 목표 구조. 신규 폴더는 본 결정/패턴을 따른다.

### Complete Project Directory Structure

```text
ai-jakdang/
├── package.json  pnpm-workspace.yaml  turbo.json(신규)  .npmrc  .env.example
├── eslint.config.js  prettier.config.js  tsconfig(base via packages/config)
├── .github/workflows/ci.yml(신규: typecheck/lint/test → build → ECR → ECS)
├── infra/(신규)              # AWS 배포 정의(ECS task def, Dockerfile per app, IaC)
│   ├── api.Dockerfile  web.Dockerfile  admin.Dockerfile  worker.Dockerfile
│   └── ecs/  (task-definitions, env mapping — 시크릿은 SSM/Secrets Manager)
│
├── apps/
│   ├── web/                  # 사용자 사이트 (Next.js 16 App Router, SSR)
│   │   ├── app/
│   │   │   ├── layout.tsx  page.tsx(홈 6섹션)  sitemap.ts  robots.ts
│   │   │   ├── (content)/                 # 공개 SSR route group
│   │   │   │   ├── [category]/[board]/         # vibe-coding|automation|monetization 등
│   │   │   │   │   ├── page.tsx (목록)  [slug]/page.tsx (상세)  write/page.tsx
│   │   │   │   ├── lounge/[board]/             # ai-creation|ai-products|free(자유게시판 신규)
│   │   │   │   ├── qna/ page.tsx  [slug]/page.tsx  ask/page.tsx
│   │   │   │   ├── resources/[type]/ page.tsx  [slug]/page.tsx  ../new/page.tsx
│   │   │   │   ├── notice/ page.tsx  [slug]/page.tsx        # 공지 게시판(신규)
│   │   │   │   └── tags/[tag]/page.tsx                      # SEO 랜딩
│   │   │   ├── search/page.tsx
│   │   │   ├── (auth)/ login/  signup/  reset-password/
│   │   │   ├── me/ page.tsx  activity/  bookmarks/  badges/  notifications/  messages/  inquiries/   # 마이페이지(신규 IA)
│   │   │   ├── settings/ profile/  password/  notifications/  blocks/  account/                       # 계정설정(신규 IA)
│   │   │   ├── u/[nickname]/page.tsx       # 공개 프로필(JSON-LD ProfilePage)
│   │   │   ├── legal/ terms/  privacy/  policy/
│   │   │   └── dev/design-system/page.tsx (기존)
│   │   ├── components/ ui/(기존 디자인 시스템)  site/(Header/Footer)
│   │   ├── features/         # 도메인 기능 UI (board/qna/resource/comment/gamification/notification/inquiry...)
│   │   ├── lib/ cn.ts  api.ts(서버/클라 fetch, 쿠키 포워딩)  seo/(metadata·jsonld 헬퍼)
│   │   └── styles/ tokens/  base/  layout/  utilities/ (기존)
│   │
│   ├── admin/               # 관리자 앱 (별도 Next.js + 별도 신원/세션, packages/admin-design-system)
│   │   ├── app/ login/  signup/(승인 대기)  dashboard/  analytics/  posts/  qna/  resources/  comments/
│   │   │        reports/  members/(사이트 회원)  admin-accounts/(운영자 계정 승인·최고관리자 전용)
│   │   │        points/  grades/  badges/  inquiries/(신규 14번)  ads/  settings/
│   │   ├── components/ ui/  layout/(AdminShell)
│   │   ├── features/  lib/api.ts  styles/(admin 전용)
│   │
│   ├── api/                  # Fastify REST (DB 접근 권위)
│   │   ├── src/ server.ts  app.ts
│   │   │   ├── plugins/ auth.ts  rateLimit.ts  swagger.ts  errorHandler.ts
│   │   │   ├── lib/ storage.ts(R2 S3-client)  sse.ts  queue.ts(BullMQ 발행)
│   │   │   └── routes/ health.ts
│   │   │       └── v1/ index.ts
│   │   │           ├── auth/ qna/ posts/ resources/ comments/ reactions/ bookmarks/
│   │   │           ├── reports/ tags/ search/ notifications/(SSE) messages/ inquiries/ notice/
│   │   │           ├── users/(me·profile) gamification/(points·badges·grades·ranking)
│   │   │           └── admin/ ...(posts/qna/resources/comments/reports/members/points/
│   │   │                          grades/badges/inquiries/ads/settings/analytics)
│   │   │   # 각 도메인 폴더 = { routes.ts, service.ts(트랜잭션 경계), *.test.ts }
│   │
│   └── worker/              # BullMQ 워커
│       └── src/ index.ts  connection.ts
│           ├── queues/      # 큐 정의(email, image, stats, file-scan, view-flush, cleanup, ranking, search-index)
│           └── processors/  # email.send / image.transform / resource.scan(ClamAV) / view.flush
│                            #   / content.cleanup(자동 hard-delete) / ranking.compute / search.reindex
│
└── packages/                # 비시각 공유만
    ├── config/     tsconfig·eslint·prettier + env.ts(Zod 환경변수 단일 검증, 신규)
    ├── contracts/  src/ common.ts auth.ts post.ts(+창작스펙·의뢰소 확장 스키마, 신규) qna.ts resource.ts comment.ts
    │               follow.ts(신규) tag.ts search.ts notification.ts(+notification_settings, 신규) message.ts
    │               inquiry.ts(신규) notice.ts(신규) link-preview.ts(OG 카드, 신규)
    │               gamification.ts admin.ts editor.ts(Tiptap preset 노드, 신규)  index.ts
    ├── database/   src/ client.ts  schema/ (users, sessions, accounts, verifications, user_sanctions,
    │               admin_users, admin_sessions, admin_accounts, admin_verifications,  # 관리자 분리 신원(ADR-0003)
    │               posts, post_creative_spec(신규), recruit_post(신규), questions, answers, resources, resource_files,
    │               comments, reactions, bookmarks, reports, ratings, follows(신규), tags, taggables, inquiries(신규),
    │               inquiry_replies(신규), notifications, notification_settings(신규), messages, blocks, link_previews(신규),
    │               points_ledger, badges, user_badges, grades, ad_slots, site_settings)  + pg_bigm 인덱스 마이그레이션
    ├── core/       src/ qna.ts points.ts grades.ts badges.ts ranking.ts report.ts moderation.ts
    ├── auth/       src/ permissions.ts (Role/Permission, hasPermission, canAccessAdmin)
    └── utilities/  src/ string.ts(slugify) date.ts number.ts
```

### Architectural Boundaries

**API Boundaries:** 외부 표면은 `apps/api`의 `/api/v1/*`(공개) + `/api/v1/admin/*`(권한). web·admin은 이 API만 호출(쿠키 포워딩). **DB 직접 접근·Drizzle import는 api/worker 한정.** 트랜잭션은 `routes/*/service.ts`에서만.

**Component Boundaries:** web↔admin 시각 자산 비공유(별도 디자인 시스템). 공통 UI는 각 앱 `components/ui`, 도메인 조합은 `features/*`. 컴포넌트 간 통신은 props + URL 상태, 전역은 인증 컨텍스트·토스트만.

**Service Boundaries:** `apps/api`는 동기 요청/응답, 무거운/지연 작업은 BullMQ로 `apps/worker`에 위임(이메일·이미지·ClamAV·통계·hard-delete·랭킹·검색 reindex). 발행은 `api/lib/queue.ts`, 처리는 `worker/processors/*`.

**Data Boundaries:** 콘텐츠 유형별 테이블(post/question/answer/resource) + 다형 참여(`(target_type,target_id)`: comment/reaction/bookmark/report/rating, tag↔taggable). 검색은 pg_bigm GIN 인덱스. 캐시 = Next 캐시(공개 페이지) + Redis(인기·랭킹·조회수 버퍼).

### Requirements to Structure Mapping

- **인증/계정(FR-1)** → `app/(auth)`, `me`, `settings`, `u/[nickname]` · api `v1/auth`,`v1/users` · `packages/auth` · db `users`
- **공통 게시판/라운지/자유게시판(FR-2,5 + 신규)** → `app/(content)/[category]/[board]`,`lounge` · api `v1/posts` · db `posts`
- **묻고답하기(FR-3)** → `app/(content)/qna` · api `v1/qna` · core `qna.ts` · db `questions`,`answers`
- **실전자료(FR-4)** → `app/(content)/resources` · api `v1/resources` + `lib/storage.ts`(R2) + worker `resource.scan` · db `resources`,`resource_files`,`ratings`
- **메인/검색/태그(FR-6)** → `app/page.tsx`,`search`,`tags/[tag]` · api `v1/search`(pg_bigm),`v1/tags`
- **참여(FR-7)** → api `v1/comments`,`reactions`,`bookmarks` · db 다형 테이블
- **신고/모더레이션(FR-8,10)** → admin `reports`,`posts`... · api `v1/admin/*` · core `moderation.ts` · worker `cleanup`. `report_target_type` 다형 enum에 **`user` 포함(회원 직접 신고, FR-8.6)**. **처리완료(resolved) 신고 누적→작성자 귀속→자동 경고+에스컬레이션(FR-8.7)** 은 `user_sanctions`(type=`warning`/`suspend`/`permaban`) 재사용 + `site_settings`(`report_escalation_threshold`·`report_auto_warning_enabled`) 플래그. **자동 정지 없음**(경고 상한). 제재 통보는 `v1/notifications`(FR-8.8). — *Epic 12*
- **게이미피케이션(FR-9)** → `me/badges` · api `v1/gamification` · core `points/grades/badges/ranking.ts` · db `points_ledger`,`badges`,`grades`
- **알림/쪽지(FR-12,13)** → `me/notifications`,`me/messages` · api `v1/notifications`(SSE),`v1/messages`
- **SEO(FR-11)** → `app/sitemap.ts`,`robots.ts`,`lib/seo/*`, 페이지별 `generateMetadata`+JSON-LD
- **1:1 문의(신규)** → `me/inquiries` + admin `inquiries` · api `v1/inquiries`,`v1/admin/inquiries` · db `inquiries`,`inquiry_replies`
- **공지(신규)** → `app/(content)/notice` · api `v1/notice`(읽기)+`v1/admin`(작성=운영자)
- **약관(FR-14)** → `app/legal/*`

### Integration Points

- **내부 통신**: web/admin(서버 컴포넌트) → `lib/api.ts` → `apps/api`(쿠키 인증) → service(트랜잭션) → Drizzle/PostgreSQL. 이벤트성 작업 → BullMQ → worker.
- **외부 연동**: Cloudflare R2(객체), AWS RDS/ElastiCache, SMTP(메일, worker), 소셜 OAuth(구글/네이버/카카오), GA4 + Search Console, ClamAV(daemon).
- **데이터 흐름(예: 자료 등록)**: 폼 → api `resources` service(트랜잭션 저장, 상태=검사중) → R2 업로드 → `file-scan` 큐 → worker ClamAV → 통과 시 상태=공개 + 알림 이벤트.

### File Organization / Workflow

- **설정**: 루트 공통(eslint/prettier/tsconfig via `packages/config`), 앱별 `next.config.ts`/`tsconfig.json`. 환경변수는 `packages/config` Zod 검증.
- **테스트**: co-located `*.test.ts(x)`(Vitest). 통합/계약 테스트는 각 도메인 폴더.
- **개발**: `pnpm dev:web|admin|api|worker`(3003/3004/4003 + Redis). **빌드/CI**: `turbo.json`로 affected typecheck/lint/test/build → 이미지 → ECR → ECS.
- **배포**: 4앱 컨테이너(ECS) + RDS + ElastiCache + R2 + CloudFront, 서브도메인(`www`/`admin`/`api`).

## Architecture Validation Results

### Coherence Validation ✅
- **Decision Compatibility:** 모든 기술 선택 상호 호환. Next.js 16/React 19, Fastify 5.5, Drizzle 0.38/PostgreSQL 17(+pg_bigm, AWS RDS 지원 확인), BullMQ/Redis(ElastiCache), Zod 4.1 계약 공유. 충돌 없음. 교차 클라우드(AWS 컴퓨트/DB + Cloudflare R2 스토리지)는 의도적 결정으로 기록.
- **Pattern Consistency:** 네이밍(snake_case DB / camelCase 코드), API 셰이프({items,meta} · {error}), 오프셋 페이지네이션, Tiptap JSON 본문, 토큰-only CSS가 스택과 정합. 권위 계층(SoT) 명시.
- **Structure Alignment:** 모노레포 구조가 결정을 지지(DB 접근 api/worker 한정, web/admin 시각 격리, worker 큐 분리). 경계·통합 지점 정의됨.

### Requirements Coverage Validation
- **FR Coverage:** 계정/게시판/Q&A/실전자료/메인·탐색/참여/신고·모더레이션/게이미피케이션/SEO/알림/쪽지/약관 + 신규(자유게시판·마이페이지·문의·공지) 모두 구조 매핑 완료(§Requirements to Structure Mapping).
- **NFR Coverage:** NFR-1 SSR ✅, NFR-2 보안(Argon2id·sanitize-html·ClamAV·rate-limit·CSRF) ✅, NFR-3 반응형(디자인시스템) ✅, NFR-5 접근성 ✅, NFR-6 백그라운드(worker) ✅, NFR-7 확장성(공유 패키지·RN 대비) ✅, NFR-8 URL 안정 ✅. **NFR-4 성능: 아키텍처적 대비(SSR 캐시·Redis·인덱스·페이지네이션·worker offload)는 됐으나 수치 목표 미정(Q-11).**

### Implementation Readiness Validation
- **Decision Completeness:** 핵심 결정 버전과 함께 문서화(검증 완료).
- **Structure Completeness:** 전체 디렉터리 트리·경계·통합 지점·요구사항 매핑 구체화.
- **Pattern Completeness:** 네이밍·구조·포맷·통신·프로세스 + 트랜잭션 경계·N+1·날짜·env·slug·폼검증·로딩·게이팅까지 충돌 지점 망라.

### Gap Analysis Results
**Critical Gaps → Pre-Implementation 블로커(착수 전 해소, Party Mode 보강 — frontmatter `preImplementationBlockers` 참조):**
- ✅ (해결) SSE Redis Pub/Sub 팬아웃 — 아키텍처 §API & Communication에 명시.
- 🔴 Better Auth 카카오/네이버 OAuth PoC(표준 OIDC 아님) + 인증 스키마 설계(예시 `users.ts` placeholder를 Better Auth 스키마로 대체 — DB 그린필드, 데이터 이전 아님) — 인증/스키마 Story 전 필수.
- 🔴 로컬 dev 인프라 ADR(docker-compose: PG17+pg_bigm Dockerfile, Redis, ClamAV, 소셜 OAuth 목업) — DB/인증 Story 전 필수.
- ✅ (해결 2026-06-17) PRD/UX 동기화 완료(문의 엔티티·어드민 14, /me·/settings URL, 자유게시판, 공지). 잔여 튜닝값(신고 임계값·제재 단계)은 모더레이션 Story 전 확정. → ✅ (확정 2026-06-30, Epic 12) 신고 임계값·제재 단계 확정 + 회원 직접 신고·처리완료 누적 자동 경고/에스컬레이션(FR-8.6~8.8) 추가.
- ✅ (재동기화 2026-06-22) PRD/에픽 추가분 데이터 모델 반영 — §Data Architecture에 신규 테이블 5개(`follows`·`post_creative_spec`·`recruit_post`·`notification_settings`·`link_previews`) + `users`/`posts` 추가 컬럼 + 기존 테이블 컬럼 명세 보강. 갭 총 14건(치명 7건) 해소. 최우선: `users.default_avatar_index`(NOT NULL)는 Epic 1 Story 1.2 첫 스키마부터 포함.
- 🟡 pg_bigm 통합검색 랭킹 정규화(`bigm_similarity` UNION ALL 스코어) — 검색 Story 전까지(나머지 비차단).

**Important Gaps (해당 Story 전 순차 확정):** ~~Q-13 신고 임계치·제재 단계~~(✅ 확정 2026-06-30, Epic 12 — FR-8.6~8.8), Q-14 알림 채널, Q-4 SEO 자동생성 규칙 + 실전자료 JSON-LD 타입.
**Defer (운영 튜닝):** 성능 수치(Q-11), soft-delete 보존기간, 공개 프로필 범위(Q-9 일부), 알림 이메일 채널(feature flag), Turborepo 도입 시점, 검색 고도화(pg_bigm→Meilisearch) 트리거.

### Validation Issues Addressed
- 페이지네이션 오프셋/커서 혼용 위험 → 오프셋 고정(기존 스키마 일치).
- admin DB 직접 접근 유혹 → "DB는 api/worker만 + 트랜잭션 service 레이어" ADR로 차단.
- SSE 다중 인스턴스 알림 유실 위험 → Redis Pub/Sub 팬아웃 명시(보강).
- 신규기능 PRD 미반영 → PENDING-PRD-SYNC + Pre-Implementation 블로커로 승격.
- Tiptap preset 위치 모호 → 노드 화이트리스트=contracts, 컴포넌트=web/features/editor 명시.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined (SSE Pub/Sub 팬아웃 포함)
- [x] Performance considerations addressed (수치 목표 Q-11은 튜닝 대상)

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS — 16개 체크리스트 충족·아키텍처 설계 자체는 일관·완비. 단, **Pre-Implementation 블로커(인증 PoC/마이그레이션, 로컬 dev 인프라 ADR, PRD/UX 동기화)를 Story 착수 전에 해소**해야 한다. 블로커는 설계 결함이 아니라 착수 전 선행 과제다.

**Confidence Level:** high — 스택이 이미 검증·스캐폴딩됐고 결정이 기존 코드 컨벤션에 정합.

**Key Strengths:** 검증된 브라운필드 기반, SSR/SEO 우선 설계, 명확한 경계(DB 접근/시각 격리), 비시각 공유로 RN 확장 대비, 충돌 방지 패턴 망라.

**Areas for Future Enhancement:** 성능 목표 수치화, 검색 고도화 이관 기준, Turborepo 캐시 파이프라인, 알림 이메일 채널, OpenAPI 외부 노출.

### Implementation Handoff

**AI Agent Guidelines:** 본 문서의 결정·패턴·구조·경계를 정확히 따른다. contracts 재사용, DB는 api/worker만(트랜잭션 service 레이어), domain logic은 core, UI는 토큰만. 모든 아키텍처 질문은 이 문서를 SoT로.

**First Implementation Priority (스타터 셋업 불필요):**
0. **Pre-Implementation 블로커 해소** — Better Auth 카카오/네이버 OAuth PoC + 인증 스키마 설계(placeholder users.ts 대체), 로컬 dev 인프라 ADR(docker-compose), PRD/UX 동기화.
1. ADR 고정(API 단독 DB 접근, 트랜잭션 경계, 배럴/순환참조, 마이그레이션 소유권) + `turbo.json`
2. `packages/database` 스키마 + pg_bigm 인덱스
3. 인증/인가(Better Auth + 소셜 + 권한)
4. 공통 게시판 수직 슬라이스(목록·상세·작성·SSR+SEO)

### Pattern Examples

**Good:**
- 목록 API: `GET /api/v1/posts?category=vibe-coding&page=1&pageSize=20` → `{ items, meta }`(`paginatedResponseSchema(postCardSchema)`).
- 새 컴포넌트: `components/ui/Foo/{Foo.tsx, Foo.module.css(토큰), index.ts}` + 배럴 등록.
- domain 규칙: `gradeForPoints(points)`를 `packages/core`에 두고 web/api/worker가 공유.
- 트랜잭션: `apps/api`의 `resourceService.create()` 안에서 `db.transaction(...)`.

**Anti-Patterns:**
- ❌ API에서 즉석 타입 정의(contracts 우회), ❌ Next 서버 컴포넌트/`packages/core`에서 Drizzle 직접 호출, ❌ 본문을 HTML 문자열로 저장, ❌ 컴포넌트에 색/픽셀/breakpoint 하드코딩, ❌ 오류를 평문 문자열로 반환, ❌ 커서 페이지네이션·무한 스크롤, ❌ 루프 내 개별 쿼리(N+1), ❌ `process.env` 분산 접근, ❌ 무거운 배럴/순환 import.
