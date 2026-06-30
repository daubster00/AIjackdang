# 시딩 봇 (Seeding Bot) — 기획 문서 모음

사이트 초기 활성화를 위한 **AI 활동 봇** 시스템의 BMAD 기획 문서 세트입니다.
원본 구상 문서(`docs/seeding-bot-design.md`, `docs/seeding-bot-topic-pools.md`)를
구현 가능한 PRD → 아키텍처 → 에픽/스토리 → 배포 준비로 전개했습니다.

## 읽는 순서

1. **[PRD.md](./PRD.md)** — 무엇을·왜 만드는가. 목표·기능요구(FR-SB)·비기능요구(NFR-SB)·범위·오픈퀘스천.
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 어떻게 만드는가. DB 스키마(`bot_*`)·공용 도메인 서비스·AI 추상화·검색·이미지·워커/큐·관리자 UI·환경변수. **실제 코드베이스 기준**.
3. **[EPICS-AND-STORIES.md](./EPICS-AND-STORIES.md)** — **Epic 11 하나 / 스토리 18개**(그룹 A~F). 기존 프로젝트 Epic 1~10 다음 번호. (기능 1개 = Epic 1개)
4. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — **운영자(당신)가 배포 전 직접 준비할 것**: API 키 발급법·인프라·비용·배포 런북·매일 운영.

## 핵심 요약

- **봇 구성**: 일반 7인(`dubu_2` 등) + 관리자 1(`AI작당지기`). `users.is_bot`(봇 여부)로 식별.
- **절대 원칙**: 봇도 사람과 **같은 도메인 서비스**로 글·댓글을 쓴다(DB 직접 INSERT 금지).
- **안전장치**: 자기검열(검열관 분리) + 사이트 `contentGuard`(금칙어·스팸) 2중 방어, 보류 큐, 킬 스위치, 속도·비용 상한, 인젝션 가드.
- **설정 출처**: 운영 설정의 진짜 출처는 **DB(`bot_settings`·`bot_personas` 등)**, 관리자 대시보드에서 수정. 설계 문서 값은 최초 시드.
- **당신이 준비할 것**: AI 키(OpenAI/Claude/Gemini 중 1+) · 검색 키(구글/네이버) · 이미지 키(Unsplash/Pexels) · 텔레그램 봇 → 전부 `.env`. (→ DEPLOYMENT.md §0 체크리스트)

## 다음 단계

- 상세 스토리 파일 생성: `EPICS-AND-STORIES.md`를 입력으로 `bmad-create-story`를 그룹 A→F 순서로 실행 →
  `_bmad-output/implementation-artifacts/11-1-*.md` … `11-18-*.md` 생성.
- 구현 착수: 그룹 A(Story 11.1, 토대)부터. 의존성 그래프는 ARCHITECTURE.md §12 / EPICS 문서 상단 참고.
