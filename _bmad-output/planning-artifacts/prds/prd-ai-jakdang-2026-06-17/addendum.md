# AI작당 PRD — Addendum (기술·심층 자료)

PRD 본문은 "무엇을(capabilities)"만 담고, "어떻게(기술 선택)"는 여기에 보관한다.
원본 기준: `자료/ai-jakdang-technology-stack-2026-06-16.md` (충돌 시 원본 우선).

## 기술 스택 (헤드라인)
- **웹 사용자 화면**: Next.js + React + TypeScript (공개 페이지 SSR — PRD NFR-1 SEO 직결)
- **관리자 화면**: 동일 Next.js 프로젝트 내 자체 React UI (Filament/MUI/Ant Design 미사용)
- **백엔드**: Fastify + TypeScript 기반 독립 REST API
- **백그라운드 작업**: Redis + BullMQ Worker (이메일·이미지 변환 등 — PRD NFR-6)
- **데이터베이스**: PostgreSQL + Drizzle ORM
- **디자인**: 자체 CSS 디자인 시스템 (Tailwind/외부 UI 프레임워크 미사용)
- **향후 모바일 앱**: React Native + Expo (인증/타입/검증/비즈니스 로직 공유 — PRD NFR-7)
- **PHP/Laravel 미사용.**

## 모노레포 매핑 (현재 코드 = 구조 스캐폴딩만, 실제 구현 전)
- `apps/web` — 사용자 사이트 (디자인 시스템 일부 구현됨, codex 작업)
- `apps/admin` — 관리자
- `apps/api` — Fastify API
- `apps/worker` — BullMQ 워커
- `packages/*` — 공유 패키지

## 작업 분담 (사용자 운영 방식)
- **디자인**: codex 담당 (디자인 시스템 완성, 구조/프론트엔드 작업 중)
- **개발**: Claude Code 담당
- 참고 디자인 자료: `docs/user-design-system-implementation.md`, `자료/AI작당-디자인시스템-현재까지/*`, `자료/ai-jakdang-admin-design-system.html`

## 외부 라이브러리 사용 영역 (자체 개발 안 함)
React/SSR 렌더링, HTTP 서버, DB 드라이버, ORM/마이그레이션, 데이터 검증, 회원 인증, 비밀번호 해시, 암호화, 파일 저장 SDK, 이미지 변환, 본문 편집 엔진, 차트 렌더링, 작업 큐, 이메일 전송, 테스트 도구.
선택 기준: 디자인 강제 안 함 / TS 안정 지원 / React·Node 생태계 표준 / 활발한 유지보수 / RN 로직 공유 용이 / 교체 용이 / AI가 이해하기 쉬움.

## 추가 심층 자료 (다운스트림에서 활용)
- 관리자 기능 상세: `자료/ai-jakdang-admin-page-plan-2026-06-15.md` (1134줄)
- 기술 스택 전문: `자료/ai-jakdang-technology-stack-2026-06-16.md` (1666줄)
