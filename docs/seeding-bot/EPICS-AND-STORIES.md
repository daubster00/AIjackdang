---
project_name: 'AI작당 — 시딩 봇 (Seeding Bot)'
doc_type: 'Epic & Stories'
status: 'ready-for-story-gen'
date: '2026-06-26'
epic: 'Epic 11 (스토리 18개) + Epic 13 (스토리 8개, 가이드 커리큘럼·이미지 3-모드)'
story_count: 26
inputDocuments:
  - 'docs/seeding-bot/PRD.md'
  - 'docs/seeding-bot/ARCHITECTURE.md'
  - 'docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md'
  - 'docs/seeding-bot-design.md'
  - 'docs/seeding-bot-topic-pools.md'
---

# Epic 11: AI 시딩 봇 (Seeding Bot)

> 시딩 봇 전체를 **하나의 Epic**으로 다룬다(기능 1개 = Epic 1개). 내부는 의존성 순서대로
> 6개 **스토리 그룹(A~F)**으로 묶고, 총 **18개 스토리**로 분해한다.
> 스토리 ID는 `11.{n}`(파일명 `11-{n}-{slug}.md`). 본문 식별자엔 한국어 뜻 병기.

## Epic 개요

- **목표**: AI가 운영하는 7개 일반 계정 + 1개 관리자 계정이 사람처럼 글·댓글·이미지를 자율 스케줄로 올려 사이트 초기 활성화(시딩)를 만든다.
- **가치**: 콜드 스타트 해소. 사람 고용보다 빠르고, 검색 그라운딩으로 사실에 기반하며, 캐릭터별 일관된 말투.
- **핵심 제약**: 봇도 사람과 같은 도메인 서비스로 작성(DB 직접 INSERT 금지) · 자기검열+contentGuard 2중 방어 · 설정 출처는 DB.
- **상세 근거**: [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

## 스토리 그룹 & 의존성

```
[A] 봇 토대·도메인 서비스 (11.1~11.5)   ← 최우선 토대
        ↓
[B] AI·검색·이미지 (11.6~11.8)          ← A 위에서 병렬 가능
        ↓
[C] 생성 파이프라인 (11.9~11.10)        ← A·B 사용
        ↓
[D] 오케스트레이터·안전장치 (11.11~11.13) ← C를 굴림
        ↓
[E] 관리자 UI (11.14~11.16)  ·  [F] 리포트·푸시 (11.17~11.18)  ← 운영 레이어
```

| 그룹 | 스토리 | 제목 |
|---|---|---|
| A | 11.1 | 봇 데이터 스키마 + `users.is_bot` 마이그레이션 |
| A | 11.2 | 봇 Zod 계약(contracts) |
| A | 11.3 | 댓글 생성 service + `contentGuard` 함수 추출(선행 리팩터링) |
| A | 11.4 | 공용 봇 작성 서비스(`createPostAsBot`/`Comment`/`Reply`/`Question`/`Resource`) |
| A | 11.5 | `ensureBotUser` + 페르소나·리듬·주제풀 시드 + 랭킹 제외 토글 |
| B | 11.6 | AI 추상화 레이어(3사 어댑터·모델 할당·비용 가드) |
| B | 11.7 | 검색·그라운딩(구글 + 네이버 + 강도별 사실 요약) |
| B | 11.8 | 이미지 엔진(스톡·AI생성·무이미지·썸네일 연동) |
| C | 11.9 | 글 생성 파이프라인(주제선정·작성·자기검열·보류큐·자동보충) |
| C | 11.10 | 댓글·반응 파이프라인(랜덤 스케줄·인젝션 방어·맥락 반응) |
| D | 11.11 | 일일 활동 계획 생성기(리듬·요일·시간대) |
| D | 11.12 | 킬 스위치·속도 안전선·비용 상한·관찰 모드 |
| D | 11.13 | BullMQ 잡·크론 등록 + 워커 격리 + 부팅 토글 |
| E | 11.14 | 관리자 봇 라우트·목록/상세 + 캐릭터·프롬프트 편집 |
| E | 11.15 | 활동 설정·담당 게시판 + 주제 풀 + 모델 할당 UI |
| E | 11.16 | 운영 패널(킬스위치·속도·비용·보류큐 요약) |
| F | 11.17 | 일일 집계·리포트 API + 보류 큐 처리 액션 |
| F | 11.18 | 텔레그램 푸시 |

---

## 그룹 A — 봇 토대·도메인 서비스

### Story 11.1: 봇 데이터 스키마 + `users.is_bot` 마이그레이션
- **As a** 개발자, **I want** 봇 테이블과 `is_bot`(봇 계정 여부) 컬럼을 만들기, **so that** 봇 신원·설정·로그를 저장한다.
- **AC**
  1. `packages/database/src/schema/bot.ts`에 ARCHITECTURE §2의 테이블 전체 정의(`bot_personas`, `bot_persona_boards`, `bot_activity_rhythm`, `bot_topics`, `bot_model_assignments`, `bot_generation_jobs`, `bot_hold_queue`, `bot_activity_log`, `bot_settings`) + 필요한 enum.
  2. `users`에 `is_bot` boolean NOT NULL DEFAULT false ALTER.
  3. `schema/index.ts` 배럴 export.
  4. `db:generate`로 새 마이그레이션 생성(**번호 고정 금지** — `packages/database/migrations/`와 `meta/_journal.json`의 최신 번호 확인 후 다음 번호 자동 부여), `db:migrate` 성공.
  5. 다중 세션 충돌 방지: 봇 스키마 변경만 마이그레이션에 포함(메모리 규칙).

### Story 11.2: 봇 Zod 계약(contracts)
- **AC**
  1. `packages/contracts/src/bot.ts`에 페르소나·주제·활동로그·보류큐·설정·모델할당 Zod 스키마 + 추론 타입.
  2. 관리자 API 요청/응답 스키마(목록 `{items,meta}`, 단건 직접 페이로드, 오류 `{error:{code,message}}`).
  3. 배럴 export. API 즉석 타입 정의 금지(재사용).

### Story 11.3: 댓글 생성 service + `contentGuard` 함수 추출 (선행 리팩터링)
- **As a** 개발자, **I want** 댓글 생성 로직과 contentGuard를 봇이 함수로 호출 가능하게 추출, **so that** 봇·사용자가 같은 경로를 공유한다.
- **AC**
  1. `apps/api/src/routes/v1/comments.ts`의 POST 도메인 로직을 `comments/service.ts`의 `createComment(input)`로 추출(트랜잭션·parentId 검증·포인트·알림 보존). 라우트는 service 호출. **기존 동작 100% 회귀 없음**(N+1 방지·soft-delete·2단계 대댓글 차단 보존).
  2. `apps/api/src/middleware/contentGuard.ts`의 검사 로직을 `runContentGuard(text): Promise<ContentGuardResult>` 함수로 추출(강화 타입 `ContentGuardResult` = `{ ok: true } | { ok: false; code: string; message: string; reason?: string }` 판별 유니온도 함께 export). 기존 preHandler는 이 함수를 감싸도록 변경(사용자 경로 회귀 없음).
  3. 기존 댓글 테스트 통과 + service·guard 단위 테스트 추가.
- **Dev Notes**: UPDATE 파일. 현재 동작 정독 필수.

### Story 11.4: 공용 봇 작성 서비스
- **AC**
  1. `apps/api/src/services/bot/write.ts`에 `createPostAsBot`/`createCommentAsBot`/`createReplyAsBot`/`createQuestionAsBot`/`createResourceAsBot` **5종** 구현. 각각 기존 도메인 create 서비스(글=`createPost()`, 댓글=11.3의 `createComment()`, 질문=Epic3 Q&A 생성 서비스, 자료=Epic4 자료 생성 서비스) 호출 → slug·summary·썸네일·태그·첨부·포인트·OG·알림·캐시 무효화 적용을 **통합 테스트로 증명**. (Q&A·자료는 11.5가 `qna`·`resource:<type>` 토픽을 시드하고 11.9가 선택하므로 필수.)
  2. 게시 직전 `runContentGuard` 실패 시 게시하지 않고 `blocked` 상태 + 로그.
  3. **DB 직접 INSERT 없음**(시드 제외) — 리뷰·테스트로 확인. 작성자=봇 user_id, 게시판=페르소나 담당.

### Story 11.5: `ensureBotUser` + 시드 + 랭킹 제외 토글
- **AC**
  1. `scripts/seed-bots.ts`로 설계 문서 **7인+관리자** 페르소나·담당 게시판·활동 리듬·고정 주제 풀(topic-pools 전량) 적재. 멱등(재실행 중복 없음).
  2. `ensureBotUser(persona)`가 `users(is_bot=true)`+기본 프로필 생성/보장. 닉네임: `dubu_2`,`rainy03`,`semo_k`,`감자세개`,`wolse99`,`latte2x`,`냉장고털이`,`AI작당지기`.
  3. 게시판 한글명→`BOARDS`(contracts) 키 매핑표 명시(예: "자동화 사례"→`automation-cases`, "바이브코딩 팁"→`vibe-coding-tips`, "작당 수다방"→`talk`, "작당 의뢰소"→`gigs`, "AI 창작마당"→`ai-creation`, "내가 만든 AI 제품"→`ai-products`, "묻고답하기"→Q&A, 실전자료 4종→`resources` 유형).
  4. `bot_settings.bot_exclude_from_ranking`(봇 랭킹 제외) 값에 따라 기존 통계·랭킹 쿼리가 `is_bot=true`를 제외/포함. 기본 제외 ON. 일반 사용자 통계 회귀 없음.

---

## 그룹 B — AI·검색·이미지

### Story 11.6: AI 추상화 레이어 (3사 어댑터·모델 할당·비용 가드)
- **As a** 시스템, **I want** OpenAI/Claude/Gemini를 봇별로 갈아끼우고 비용을 추적, **so that** 모델 변화에 강하고 폭주 비용을 막는다.
- **AC**
  1. 서버 전용 봇 AI 레이어에 `AiProvider` 인터페이스(`generateText`, 선택 `generateImage`) + `getProvider()`를 구현한다. 위치는 worker와 api가 모두 import 가능한 server-only 경계(`packages/server-bot` 권장)로 확정한다. worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다. `adapters/openai.ts`·`anthropic.ts`·`gemini.ts` 구현, 인터페이스 동일 준수.
  2. **도구/함수콜 비활성**(텍스트 후보만 반환). 키 미설정 시 명확한 에러. 모킹 단위 테스트.
  3. `callModel(assignment, prompt)`가 `bot_model_assignments`(봇 모델 할당)의 provider+model로 라우팅. 봇별 글생성용·검열관용 모델 분리 적용.
  4. 호출마다 토큰·`costUsd`(달러 비용)를 `bot_generation_jobs.cost`/`bot_activity_log`에 누적. `bot_settings.bot_daily_cost_limit_usd`(일일 비용 상한) 도달 시 신규 생성 잡 자동 중단 + 로그 + 리포트 경고.
  5. 모델명 하드코딩 금지(DB에서 읽음). 최신 모델 ID는 착수 시 확인(`claude-api` 스킬 참고).

### Story 11.7: 검색·그라운딩 (구글 + 네이버 + 강도별 사실 요약)
- **AC**
  1. `lib/search/google.ts`(`GOOGLE_SEARCH_API_KEY`+`GOOGLE_SEARCH_CX`(검색엔진 ID)) + `lib/search/naver.ts`(`NAVER_SEARCH_CLIENT_ID/SECRET`) 어댑터. 키 없으면 graceful skip.
  2. `groundTopic(topic, intensity)` — `full`(정보형)/`light`(트렌드만)/`none`(잡담) 분기로 둘 혼합 호출.
  3. 검색 결과를 **비신뢰 입력**으로 래핑 → AI 요약기로 사실 근거 객체(`summarizeFacts`). 확신 없는 수치·고유명사·날짜 단정 금지.
  4. 검색 비용도 일일 비용 합산.

### Story 11.8: 이미지 엔진 (스톡·AI생성·무이미지·썸네일 연동)
- **AC**
  1. `lib/images/stock.ts`(Unsplash/Pexels, 무료 라이선스만) + `lib/images/generate.ts`(AI 생성, OpenAI 키 재사용, 비용 기록).
  2. `decideImageStrategy(persona, board, postKind)` → `stock`/`ai`/`none`/`meme`. `ai-creation`(AI 창작마당)·관리자 가이드는 강제 `ai`.
  3. 선택 이미지를 S3 공개 버킷 업로드(기존 업로드 서비스 재사용) → 본문 첫 이미지 삽입 → 기존 썸네일 추출 자동 처리(없으면 기본 빈 썸네일).
  4. 밈·짤 외부 이미지는 `copyright_risk` 보류 경로 연결(옵션).

---

## 그룹 C — 생성 파이프라인

### Story 11.9: 글 생성 파이프라인 (주제선정·작성·자기검열·보류큐·자동보충)
- **As a** 봇, **I want** 주제 선정부터 게시까지 한 건의 글을 안전하게 완성, **so that** 사람다운 사실 기반 글이 올라간다.
- **AC**
  1. **주제 선정+중복 방지**: `bot_topics`에서 `unused` 선택→`used`+`used_at` 기록, 쿨다운 재등장 금지(`cooling`). 실시간 주제도 소스.
  2. **작성**: `persona_prompt`(사전 프롬프트)+사실 근거(11.7)+주제로 생성모델 호출→Tiptap JSON 후보. AI 티 제거 규칙(길이·구조 들쭉날쭉, 상투어·이모지 금지, 캐릭터별 불완전함) 반영.
  3. **자기검열**: 생성모델과 **분리된 검열관 모델**이 6항목 판정(사실성/AI티/페르소나/안전/중복/맥락) → `censor_result` 저장. 강도 차등(관리자·정보형 엄격, 잡담·밈 느슨).
  4. **분기**: 통과→`runContentGuard`→게시판별 작성 함수(`qna`→`createQuestionAsBot`, `resource:<type>`→`createResourceAsBot`, 그 외→`createPostAsBot`; `job_kind`도 `question`/`resource`/`post`로 동일 기준 기록)→`published`(차단 시 `blocked`). 애매→`bot_hold_queue`(`ambiguous`). 탈락→재생성 ≤2~3회 후 `discarded`. 각 분기 `bot_activity_log`.
  5. **자동 보충**: `bot_auto_refill_topics` ON + 미사용 풀이 임계 이하면 AI가 캐릭터 컨셉 새 주제 생성(`topic_kind=auto`).
  6. **관리자 장문 모드**: `is_admin_persona`+`series_group`으로 대주제 1개를 여러 편 연재(목차·코드블록·AI 표지, 사실성 최고). 공지사항은 봇 작성 안 함(가드).

### Story 11.10: 댓글·반응 파이프라인 (랜덤 스케줄·인젝션 방어·맥락 반응)
- **As a** 봇, **I want** 대본 없이 작성 시점에 원본을 읽고 맥락 반응을 달기, **so that** 진짜 대화처럼 자연스럽다.
- **AC**
  1. **랜덤 스케줄**: 대상 글 선정 후 ① 캐릭터(전체 풀, 담당 무관) ② 반응 종류(동조/질문/반박/농담/리액션) ③ 지연 시간을 모두 랜덤. 즉답 금지(분~시간, 드물게 일). 모든 글에 달지 않음(댓글 0 자연스럽게).
  2. **인젝션 방어**: 원본 글·기존 댓글을 `<untrusted_user_content>`로 래핑. "ignore previous instructions"·"system prompt"·"환경변수"·"비밀키"·"관리자 권한" 등 의심 문구 탐지→자동 댓글 중단, `bot_hold_queue`(`injection_suspect`). 탐지 규칙은 `packages/bot-core` 순수 함수+테스트.
  3. **맥락 반응**: 1차 요약기가 주제/질문의도/감정/사실만 추출(정규화 맥락 객체)→생성기엔 요약 객체 전달. 반응 종류를 캐릭터 말투로 작성(같은 동조라도 `semo_k`=반말, `감자세개`=공손).
  4. **게시**: 맥락 포함 검열→`runContentGuard`→`createCommentAsBot`/`createReplyAsBot`(parentId 검증). 컨셉상 말 안 되는 조합은 검열에서 거름. 보류/폐기/게시 로그.

---

## 그룹 D — 오케스트레이터·안전장치

### Story 11.11: 일일 활동 계획 생성기
- **AC**
  1. `bot.daily-plan` cron이 매일 활동 리듬(`bot_activity_rhythm`)·요일·시간대로 오늘 계획 랜덤 배정(누가 글/댓글/질문/휴식).
  2. 각 활동을 `bot.write`/`bot.comment` 잡으로 enqueue(활동 시간대 내 분 단위 랜덤 delay).
  3. 합산 하루 새 글 5~7 / 댓글 15~25 평균, 매주 ±랜덤·가끔 잠수 계정.

### Story 11.12: 킬 스위치·속도 안전선·비용 상한·관찰 모드
- **AC**
  1. 모든 봇 processor가 시작 시 `bot_master_enabled`(킬 스위치) 확인→off면 즉시 skip+로그.
  2. `bot_daily_post_limit`/`bot_daily_comment_limit`(하루 상한, 기본 10/40) 초과분 skip. 비용 상한(11.6)과 함께 fail-safe.
  3. `bot_observation_mode`(관찰 모드) ON이면 게시 전 전량 보류 큐 적재(자동 게시 안 함)→운영자 통과 시 게시. 초기 1~2주 튜닝용.

### Story 11.13: BullMQ 잡·크론 등록 + 워커 격리 + 부팅 토글
- **AC**
  1. `apps/worker`에 봇 워커(`processors/bot/*`)·크론(`schedules/bot.cron.ts`) 등록(기존 `content.cleanup` 패턴 재사용).
  2. `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부) env로 워커 부팅 시 로드 토글(기본 false).
  3. 봇 워커 크래시가 사이트 본체(api/web)를 멈추지 않음(격리 검증).

---

## 그룹 E — 관리자 봇 대시보드

> 전부 `adminGuard`+`requireSuperAdmin`(슈퍼관리자 전용). 리스트=상세페이지 규약, 액션폼만 모달, 차트는 `createLineChart` 재사용(메모리 규칙).

### Story 11.14: 관리자 봇 라우트·목록/상세 + 캐릭터·프롬프트 편집
- **AC**
  1. `/api/v1/admin/bots/*`(목록/상세/CRUD). `apps/admin` `/bots` 목록(상태·최근 활동·누적 글/댓글, 개별 활성화·비활성화 토글) → `/bots/[id]` 상세.
  2. 캐릭터 시트 전체 + `persona_prompt`(사전 프롬프트) 직접 편집·저장. 변경 즉시 다음 생성부터 반영.

### Story 11.15: 활동 설정·담당 게시판 + 주제 풀 + 모델 할당 UI
- **AC**
  1. 글/주·댓글 빈도·활동 시간대·요일·담당 게시판 추가/제거(`bot_activity_rhythm`/`bot_persona_boards` 갱신).
  2. 봇별 고정 주제 추가/수정/삭제, 사용 기록·중복 상태 표시, 자동 보충 ON/OFF.
  3. 봇별 글생성용·검열관용 프로바이더(OpenAI/Claude/Gemini)+모델 선택(`bot_model_assignments` 갱신).

### Story 11.16: 운영 패널
- **AC**: 일일 리포트 요약·보류 큐 통과/폐기·킬 스위치·속도 안전선·비용 현황을 한 화면에서 관리.

---

## 그룹 F — 일일 리포트 & 푸시

### Story 11.17: 일일 집계·리포트 API + 보류 큐 처리 액션
- **AC**
  1. `bot.daily-report` cron이 어제 활동(`bot_activity_log`) 집계: 글 N·댓글 M·캐릭터 분포·게시 목록(링크)·보류 건수·경고(차단 수·재생성 多·잠수 계정)·비용·상태. `/api/v1/admin/bots/report?date=` 제공.
  2. 보류 항목 통과→게시(`job_kind`별 5종 분기: `post`→`createPostAsBot`, `comment`→`createCommentAsBot`, `reply`→`createReplyAsBot`, `question`→`createQuestionAsBot`, `resource`→`createResourceAsBot`), 폐기→`discarded`. 결정 로그(`decided_by`).

### Story 11.18: 텔레그램 푸시
- **AC**
  1. 매일 아침 **간단 요약(글 N·댓글 M + 보류 건수 + 대시보드 링크)**을 텔레그램 전송(`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID`).
  2. 채널은 `bot_settings.bot_push_channel`(푸시 채널). 키 없으면 graceful skip + 로그.

---

## 스토리 생성 가이드 (다음 단계)

이 문서를 입력으로 `bmad-create-story`(또는 `_STORY-GEN-INSTRUCTIONS.md` 절차)를 그룹 A→F 순서로 돌려
`_bmad-output/implementation-artifacts/11-1-*.md` … `11-18-*.md` 상세 스토리 파일을 생성한다.
각 스토리는 PRD·ARCHITECTURE·project-context 규칙을 References로 인용해야 한다.

**총계: Epic 11 = 스토리 18개.** 구현 착수는 그룹 A(11.1)부터.

---

# Epic 13: 가이드 커리큘럼 · 이미지 3-모드 · 스테이징

> Epic 11(시딩 봇) 위 확장. 관리자 가이드 글을 **강의 커리큘럼 시리즈**로 개편하고, 봇 이미지를
> **3-모드**로 조달하며, 커리큘럼은 **생성≠게시(스테이징)** + 사람 검수 + 예약 게시로 바꾼다.
> **설계·데이터 모델·현재 구현 상태·함정의 단일 출처: [GUIDE-CURRICULUM-AND-IMAGE-MODES.md](./GUIDE-CURRICULUM-AND-IMAGE-MODES.md)** (읽고 착수).

## Epic 13 개요

- **목표**: 공식 강의 시리즈는 사람이 큐레이션(순서·정확도·이미지)해 예약 게시하고, 일반 글·퍼오기는 자율 게시하되 이미지를 글 성격에 맞게 붙인다.
- **가치**: "강의답게 이어지는 글 + 설명과 정확히 일치하는 이미지". 콜드 스타트 이후 **양질의 앵커 콘텐츠**.
- **현재 상태(중요)**: 커리큘럼 엔진 일부가 **이미 프로토타입으로 구현·dev 검증**됨(설계문서 §10). Epic 13은 그 위에 **스테이징 분리·DB 승격·관리자 UI·스케줄·사후 플래너**를 얹는다. 프로토타입은 생성+게시가 한 번에 일어나므로 13.3에서 분리한다.
- **선행/전제**: Epic 11 그룹 A·B·C(스키마·AI·이미지·파이프라인) 완료 상태 위.

## Epic 13 스토리 & 의존성

```
13.1 커리큘럼 DB 스키마 ─┬─ 13.2 계약
                         ↓
13.3 스테이징 파이프라인(생성≠게시) ── 13.4 이미지 슬롯 워크플로우
                         ↓
13.5 관리자 커리큘럼 플랜 UI ── 13.6 예약 스케줄러
                         ↓ (독립)
13.7 일반 글 사후 이미지 플래너   ·   13.8 퍼오기 모드 범위 확장
```

| 스토리 | 제목 |
|---|---|
| 13.1 | 커리큘럼 DB 스키마 + `curriculum.ts` 시드 이관 |
| 13.2 | 커리큘럼 Zod 계약(contracts) |
| 13.3 | 스테이징 파이프라인(생성≠게시) + 준비완료 판정 |
| 13.4 | 이미지 슬롯 워크플로우(🟢자동/🟡캡처/🔵업로드) |
| 13.5 | 관리자 "커리큘럼 플랜" API + UI |
| 13.6 | 예약 스케줄러(하루 1편·챕터별 시각·준비완료 게이트) |
| 13.7 | 일반 글 사후 이미지 플래너 |
| 13.8 | 퍼오기(미디어 우선) 모드 범위 확장 |

---

### Story 13.1: 커리큘럼 DB 스키마 + `curriculum.ts` 시드 이관
- **As a** 개발자, **I want** 커리큘럼을 DB 테이블로 승격, **so that** 관리자가 챕터·이미지 슬롯을 CRUD하고 상태를 관리한다.
- **AC**
  1. `bot_curriculum_series`·`bot_curriculum_chapters`·`bot_curriculum_image_slots` 테이블 + enum(챕터 상태 `planned|drafted|ready|published|skipped`, 슬롯 `source_kind` `ai_diagram|web_download|capture|user_upload`, 슬롯 상태 `pending|ready`) 정의(설계문서 §4). `db:generate`→`db:migrate`(번호 고정 금지, 봇 스키마만 포함).
  2. 기존 `apps/api/src/services/bot/curriculum.ts`(두 시리즈×5강)를 **시드 스크립트**로 이관해 테이블 초기화(멱등). 기존 `bot_settings.guide_asset_manifest`의 이미지 URL을 슬롯 `image_url`로 이식.
  3. `schema/index.ts` 배럴 export.
- **Dev Notes**: 프로토타입의 `bot_settings.guide_progress`(published[]·summaries)는 챕터 `status`/`published_post_id` + 별도 요약 컬럼으로 대체된다(마이그레이션 매핑 명시).

### Story 13.2: 커리큘럼 Zod 계약(contracts)
- **AC**
  1. `packages/contracts/src/bot-curriculum.ts`에 시리즈·챕터·이미지슬롯 + 관리자 요청/응답(목록 `{items,meta}`·단건·오류) Zod 스키마·타입.
  2. 배럴 export. API 즉석 타입 금지.

### Story 13.3: 스테이징 파이프라인 (생성 ≠ 게시) + 준비완료 판정
- **As a** 시스템, **I want** 커리큘럼 초안 생성과 실제 게시를 분리, **so that** 사람이 중간에 검수·이미지 준비를 한다.
- **AC**
  1. **초안 생성** 잡: 챕터의 학습목표·소주제·앞편 요약으로 본문을 생성해 `chapters.draft_content`에 저장(**게시 안 함**), 상태 `drafted`. 본문에 `[[IMG:키]]` 마커 포함. (기존 `buildGuideChapterUserPrompt` 재사용.)
  2. 기존 프로토타입 `post-pipeline.ts` **Step 2.6(생성+즉시게시)를 스테이징으로 리팩터**: 커리큘럼 편은 즉시 게시 경로에서 분리(회귀 없이 일반/퍼오기 경로는 유지).
  3. **준비완료 판정**: 챕터의 모든 이미지 슬롯 `status=ready`면 챕터 `status=ready`로 승격. 하나라도 `pending`이면 승격 금지.
  4. **게시 실행**(스케줄러가 호출): `insertInlineImagesByMarker`(기존)로 마커→이미지 인라인 삽입 후 `createPostAsBot` → `published`+`published_post_id`. 앞편 요약을 다음 편 생성에 전달(연속성 유지).
  5. `allowDidacticTone`(기존) 유지.

### Story 13.4: 이미지 슬롯 워크플로우 (🟢자동 / 🟡캡처 / 🔵업로드)
- **AC**
  1. 슬롯 `source_kind`별 조달: 🟢`ai_diagram`=Gemini 생성(정확한 한국어 라벨 프롬프트), 🟢`web_download`=공식문서 URL `curl` 다운, 🟡`capture`=사람 세팅 후 Playwright(웹)/PowerShell(로컬) 캡처, 🔵`user_upload`=업로드. 결과를 버킷 업로드→`image_url` 저장→슬롯 `ready`. (기존 `build-guide-assets.ts` 정식화.)
  2. **미리 만들지 않고 지시 시 생성**(설계 §3). 🟢도 동일 정책 적용 가능.
  3. 각 슬롯에 **사람용 상세 안내문(guidance)** 자동 생성(캡션·도식 프롬프트 기반). 관리자 화면에서 🟢🟡🔵 배지로 구분.
  4. 워터마크(editor-images 경로)·출처 캡션 규칙은 기존 유지.

### Story 13.5: 관리자 "커리큘럼 플랜" API + UI
- **AC**
  1. `/api/v1/admin/bots/curriculum/*`(`adminGuard`+`requireSuperAdmin`): 시리즈·챕터 목록/상세, 초안 본문 수정, 슬롯 이미지 업로드/교체/생성요청/완료, 예약시각 설정.
  2. `apps/admin` 봇 하위 **"커리큘럼 플랜"** 메뉴. 목록(챕터 상태·"이미지 N/M 완료"·예약시각) → 상세(리스트=상세 규약).
  3. 챕터 상세: **초안 본문 편집** + 이미지 슬롯 목록(배지·안내·미리보기·업로드/생성 버튼·완료) + **최종 미리보기**(이미지가 마커 자리에 끼워진 완성 글 렌더) + **예약 datetime 피커**.
  4. 차트·모달 등 기존 admin 컨벤션 준수(메모리 규칙).
- **Dev Notes**: 업로드는 관리자 이미지 업로드 경로 재사용. 미리보기는 게시글 렌더러 재사용.

### Story 13.6: 예약 스케줄러 (하루 1편 · 챕터별 시각 · 준비완료 게이트)
- **AC**
  1. 플랜/초안 생성 시 챕터에 **하루 간격 예약시각 자동 배정**(1편 D+0, 2편 D+1 …), 관리자에서 개별 수정 가능.
  2. 크론 잡 `bot.curriculum-publish`(기존 단일 `bot` 큐 디스패처에 추가)가 주기적으로 스캔해 **`scheduled_at<=now` AND `status=ready`** 챕터를 게시(13.3의 게시 실행 호출).
  3. **미완 안전장치**: 예약시각이 지났는데 `ready`가 아니면 **게시하지 않고 대기** + 관리자에 "이미지 미완으로 보류" 표시. 킬 스위치·상한 가드 동일 적용.
  4. 게시 성공 시 다음 편 초안이 앞편 요약을 이어받도록 연속성 갱신.

### Story 13.7: 일반 글 사후 이미지 플래너 (모드 B)
- **As a** 봇, **I want** 일반 글을 쓴 뒤 내용을 보고 필요한 이미지를 정해 넣기, **so that** 이미지 개수·위치가 글마다 자연스럽게 맞는다.
- **AC**
  1. 일반 글 생성(본문 완성) 후 **이미지 플래너**가 본문을 분석해 "몇 개를, 어느 자리에, 무엇을" 판단(0개 가능).
  2. 각 자리에 AI 도식 생성(정확한 라벨) 또는 필요 시 스톡/웹 이미지 → 본문에 인라인 삽입(`insertInlineImagesByMarker` 또는 위치 삽입 재사용).
  3. 실제 스크린샷은 즉석 생성 불가 → 도식 위주. 기존 "상단 1장" 방식을 대체/보강(회귀 없이).
  4. 비용·검열·contentGuard 기존 경로 통과.

### Story 13.8: 퍼오기(미디어 우선) 모드 범위 확장
- **AC**
  1. 기존 `curation.ts`(`decideCurationMode`·유튜브/밈 우선)를 `ai-creation` 외 **다른 게시판/상황에도 적용 가능**하게 라우팅 확장(설정으로 대상·가중치 제어).
  2. 미디어(영상/이미지)를 먼저 확보→소개글 작성→출처 표기 임베드(기존 `prependYoutubeToTiptapDoc`·이미지 출처 캡션 재사용).
  3. 저작권 점검(보류 큐 `copyright_risk`) 경로 유지.

---

## 스토리 생성 가이드 (Epic 13)

이 문서 + [GUIDE-CURRICULUM-AND-IMAGE-MODES.md](./GUIDE-CURRICULUM-AND-IMAGE-MODES.md)를 입력으로 `bmad-create-story`를 13.1→13.8 순서로 돌려 상세 스토리 파일을 생성한다. **착수 전 설계문서 §10(현재 구현 상태)을 반드시 읽어** 프로토타입과 중복 구현하지 않는다.

**총계: Epic 13 = 스토리 8개.** 착수는 13.1(스키마)부터.
