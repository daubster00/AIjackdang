---
project_name: 'AI작당 — 시딩 봇 (Seeding Bot)'
doc_type: 'Epics & Stories'
status: 'ready-for-story-gen'
date: '2026-06-26'
epics: 'Epic 11 ~ Epic 19 (기존 Epic 1~10 다음 번호 연속)'
inputDocuments:
  - 'docs/seeding-bot/PRD.md'
  - 'docs/seeding-bot/ARCHITECTURE.md'
  - 'docs/seeding-bot-design.md'
  - 'docs/seeding-bot-topic-pools.md'
---

# 시딩 봇 — Epic & Story 분해

> 기존 프로젝트 Epic 1~10에 이어 **Epic 11~19**로 번호를 잇는다.
> 스토리 ID는 `{epic}.{story}`(파일명 컨벤션 `{epic}-{story}-{slug}.md`).
> 각 스토리는 BMad `create-story`로 상세화될 입력이다. 본문 식별자엔 한국어 뜻 병기.

## Epic 의존성 그래프

```
11 (토대) → {12 AI, 13 검색, 14 이미지} → {15 글, 16 댓글} → 17 (오케스트레이터)
                                                              → 18 (관리자 UI), 19 (리포트)
```

## Epic 목록 요약

| Epic | 제목 | 핵심 산출물 |
|---|---|---|
| 11 | 봇 토대: 데이터 모델·공용 도메인 서비스·시드 | `bot_*` 스키마, `createPostAsBot` 등, 페르소나/주제 시드 |
| 12 | AI 추상화 레이어 (멀티 프로바이더) | OpenAI/Claude/Gemini 어댑터, 모델 할당, 비용추적 |
| 13 | 검색·그라운딩 (구글 + 네이버) | 검색 어댑터, 사실 요약, 강도 조절 |
| 14 | 이미지 엔진 (스톡·생성·무이미지) | 스톡/AI생성 어댑터, 전략 선택, 썸네일 연동 |
| 15 | 글 생성 파이프라인 + 자기검열 | 주제선정·작성·검열·보류큐·게시 |
| 16 | 댓글·반응 파이프라인 + 인젝션 방어 | 랜덤 스케줄·맥락 요약·페르소나 반응 |
| 17 | 오케스트레이터·스케줄러·안전장치 | 일일 계획·리듬·킬스위치·속도/비용 가드 |
| 18 | 관리자 봇 대시보드 | 봇 CRUD·캐릭터/프롬프트·주제풀·모델·운영패널 |
| 19 | 일일 리포트 & 텔레그램 푸시 | 집계 리포트·보류큐 처리·푸시 |

---

## Epic 11: 봇 토대 — 데이터 모델·공용 도메인 서비스·시드

**목표**: 봇이 존재하고, 사람과 같은 도메인 로직으로 글·댓글을 쓸 수 있는 토대를 만든다.
**가치**: 이후 모든 Epic이 올라설 기반. DB 직접 INSERT 금지 원칙을 코드로 못박는다.

### Story 11.1: 봇 데이터 스키마 + `users.is_bot` 마이그레이션
- **As a** 개발자, **I want** 봇 관련 테이블과 `is_bot`(봇 계정 여부) 컬럼을 만들기, **so that** 봇 신원·설정·로그를 저장한다.
- **AC**
  1. `packages/database/src/schema/bot.ts`에 ARCHITECTURE §2의 테이블 전체 정의(`bot_personas`, `bot_persona_boards`, `bot_activity_rhythm`, `bot_topics`, `bot_model_assignments`, `bot_generation_jobs`, `bot_hold_queue`, `bot_activity_log`, `bot_settings`).
  2. `users`에 `is_bot` boolean NOT NULL DEFAULT false ALTER.
  3. `schema/index.ts` 배럴에 export 추가.
  4. `db:generate`로 마이그레이션 생성(0022 다음 번호), `db:migrate` 성공, 롤백 가능.
  5. 다중 세션 충돌 방지: 봇 스키마 변경만 마이그레이션에 포함(메모리 규칙).
- **Tasks**: 스키마 작성 → enum 정의(provider/purpose/status 등) → generate → migrate 검증(5433) → idempotent 가드.

### Story 11.2: 봇 Zod 계약(contracts) 정의
- **AC**
  1. `packages/contracts/src/bot.ts`에 페르소나·주제·활동로그·보류큐·설정·모델할당 Zod 스키마 + 추론 타입.
  2. 관리자 API 요청/응답 스키마(목록 `{items,meta}`, 단건 직접 페이로드, 오류 `{error:{code,message}}`) 포함.
  3. 배럴 export. API에서 즉석 타입 정의 금지(재사용).

### Story 11.3: 댓글 생성 도메인 로직 service 추출(선행 리팩터링)
- **As a** 개발자, **I want** `comments.ts`의 댓글 생성 로직을 `comments/service.ts`로 분리, **so that** 봇과 사용자가 같은 경로를 공유한다.
- **AC**
  1. 기존 `apps/api/src/routes/v1/comments.ts`의 POST 핸들러 도메인 로직을 `createComment(input)` service 함수로 추출(트랜잭션·parentId 검증·포인트·알림 발행 보존).
  2. 라우트는 service를 호출하도록 변경, **기존 동작·응답 100% 회귀 없음**(N+1 방지, soft-delete, 2단계 대댓글 차단 5.5 보존).
  3. 기존 댓글 테스트 통과 + service 단위 테스트 추가.
- **Dev Notes**: UPDATE 파일. 현재 동작 정독 후 추출. contentGuard는 라우트 preHandler 유지(봇은 §11.4에서 함수 호출).

### Story 11.4: `contentGuard`를 함수로 추출(봇 직접 호출용)
- **AC**
  1. `apps/api/src/middleware/contentGuard.ts`의 검사 로직을 `runContentGuard(text): Promise<{ ok; code? }>` 순수-ish 함수로 추출.
  2. 기존 preHandler는 이 함수를 감싸도록 리팩터(사용자 경로 회귀 없음).
  3. 봇 경로가 게시 직전 동일 검사를 함수로 호출 가능.

### Story 11.5: 공용 봇 작성 서비스 (`createPostAsBot`/`createCommentAsBot`/`createReplyAsBot`)
- **AC**
  1. `apps/api/src/services/bot/write.ts`에 세 함수 구현. 각각 기존 `createPost()`(11.3의 `createComment()`) 호출 → slug·summary·썸네일·태그·첨부·포인트·OG·알림·캐시 무효화 모두 적용됨을 통합 테스트로 증명.
  2. 게시 직전 `runContentGuard` 통과 실패 시 게시하지 않고 `blocked` 상태 + 로그.
  3. **DB 직접 INSERT 없음**(시드 제외) — 코드 리뷰·테스트로 확인.
  4. 작성자 = 봇 user_id, 게시판 = 페르소나 담당 게시판.

### Story 11.6: `ensureBotUser` + 페르소나/리듬/주제풀 시드
- **AC**
  1. `scripts/seed-bots.ts`(또는 `packages/database` 시드)로 설계 문서의 **7인 + 관리자** 페르소나·담당 게시판·활동 리듬·고정 주제 풀(topic-pools 문서 전량)을 DB에 적재.
  2. `ensureBotUser(persona)`가 `users(is_bot=true)` + 기본 프로필을 생성/보장(멱등).
  3. 닉네임: `dubu_2`,`rainy03`,`semo_k`,`감자세개`,`wolse99`,`latte2x`,`냉장고털이`,`AI작당지기`. 게시판 슬러그는 `BOARDS`(contracts) 키로 매핑.
  4. 재실행해도 중복 생성 안 됨(멱등). 시드는 통제된 직접 생성 허용.
- **Dev Notes**: 게시판 매핑 표(설계 한글명 → BOARDS 키)를 시드에 명시. 예: "자동화 사례"→`automation-cases`, "바이브코딩 팁"→`vibe-coding-tips`, "작당 수다방"→`talk`, "작당 의뢰소"→`gigs`, "AI 창작마당"→`ai-creation`, "내가 만든 AI 제품"→`ai-products`, "묻고답하기"→Q&A(`/questions`), 실전자료 4종→`resources` 유형.

### Story 11.7: 봇 식별·랭킹 제외 토글
- **AC**
  1. `bot_settings.bot_exclude_from_ranking`(봇 랭킹 제외) 값에 따라 기존 통계·랭킹 쿼리가 `is_bot=true`를 제외/포함.
  2. 기본값 제외 ON. 관리자에서 토글(18.x에서 UI).
  3. 회귀: 일반 사용자 통계 변화 없음.

---

## Epic 12: AI 추상화 레이어 (멀티 프로바이더)

**목표**: 봇별로 OpenAI/Claude/Gemini를 갈아끼우고 비용을 추적하는 호출 레이어.
**가치**: 모델 라인업 변화에 강하고, 봇별 모델 혼합·비용 가드의 토대.

### Story 12.1: `AiProvider` 인터페이스 + OpenAI 어댑터
- **AC**
  1. `apps/api/src/lib/ai/index.ts`에 `AiProvider` 인터페이스(`generateText`, 선택 `generateImage`) + `getProvider()`.
  2. `adapters/openai.ts` 구현: system/user 프롬프트 → 텍스트 + usage(토큰) + costUsd.
  3. **도구/함수콜 비활성**(텍스트 후보만). 키 미설정 시 명확한 에러.
  4. 단위 테스트(모킹).

### Story 12.2: Anthropic Claude 어댑터
- **AC**: `adapters/anthropic.ts` 구현, 인터페이스 동일 준수, 비용 계산. 최신 모델 ID는 착수 시 확인(`claude-api` 스킬 참고).

### Story 12.3: Google Gemini 어댑터
- **AC**: `adapters/gemini.ts` 구현, 인터페이스 동일 준수, 비용 계산.

### Story 12.4: 모델 할당 라우팅 + 비용 기록
- **AC**
  1. `callModel(assignment, prompt)`가 `bot_model_assignments`(봇 모델 할당)의 provider+model로 라우팅.
  2. 호출마다 토큰·costUsd를 `bot_generation_jobs.cost`/`bot_activity_log`에 누적.
  3. 봇별 글생성용·검열관용 모델을 분리 적용.

### Story 12.5: 일일 비용 합산 + 상한 가드
- **AC**
  1. `bot_settings.bot_daily_cost_limit_usd`(일일 비용 상한) 도달 시 신규 생성 잡 자동 중단 + 로그 + 리포트 경고.
  2. 비용 집계 쿼리(오늘 누적) 제공.

---

## Epic 13: 검색·그라운딩 (구글 + 네이버)

**목표**: 글이 최신·사실에 뿌리내리게 한다.

### Story 13.1: 구글 Custom Search 어댑터
- **AC**: `lib/search/google.ts` — `GOOGLE_SEARCH_API_KEY`+`GOOGLE_SEARCH_CX`(검색엔진 ID)로 질의, 결과 정규화(제목·스니펫·URL), 레이트리밋·에러 처리, 키 없으면 graceful skip.

### Story 13.2: 네이버 검색 어댑터
- **AC**: `lib/search/naver.ts` — 뉴스·블로그·웹 검색, `NAVER_SEARCH_CLIENT_ID/SECRET`, 한국어 트렌드 소스.

### Story 13.3: 강도별 그라운딩 오케스트레이션 + 사실 요약
- **AC**
  1. `groundTopic(topic, intensity)` — `full`/`light`/`none` 분기로 구글·네이버 혼합 호출.
  2. 검색 결과를 **비신뢰 입력**으로 래핑 → AI 요약기로 사실 근거 객체 생성(`summarizeFacts`).
  3. 확신 없는 수치·고유명사·날짜를 단정하지 않도록 요약 규칙(자기검열 사실성 항목과 연계).
  4. 검색 비용도 일일 비용에 합산.

---

## Epic 14: 이미지 엔진 (스톡·생성·무이미지)

### Story 14.1: 무료 스톡 어댑터 (Unsplash/Pexels)
- **AC**: `lib/images/stock.ts` — 키워드로 무료 라이선스 이미지 검색·선택, `UNSPLASH_ACCESS_KEY`/`PEXELS_API_KEY`, 라이선스 안전 소스만.

### Story 14.2: AI 이미지 생성 어댑터
- **AC**: `lib/images/generate.ts` — 프롬프트로 표지/도식/일러스트 생성(OpenAI 이미지 등), 비용 기록.

### Story 14.3: 이미지 전략 선택 + 업로드·썸네일 연동
- **AC**
  1. `decideImageStrategy(persona, board, postKind)` → `stock`/`ai`/`none`/`meme`.
  2. `ai-creation`(AI 창작마당)·관리자 가이드는 강제 `ai`.
  3. 선택 이미지를 S3 공개 버킷에 업로드(기존 업로드 서비스 재사용) → 본문 첫 이미지로 삽입 → 기존 썸네일 추출이 자동 처리(없으면 기본 빈 썸네일).
  4. 밈·짤 외부 이미지는 `copyright_risk` 보류 경로 연결(옵션).

---

## Epic 15: 글 생성 파이프라인 + 자기검열

**목표**: 주제 선정부터 게시까지 한 건의 글을 안전하게 완성한다.

### Story 15.1: 주제 선정 + 중복 방지
- **AC**
  1. 페르소나·게시판별로 `bot_topics`(주제 풀)에서 `unused`(미사용) 주제 선택, 선택 시 `used`+`used_at` 기록.
  2. 최근 사용 주제는 쿨다운 기간 재등장 금지(`cooling`).
  3. 실시간 주제(검색/사이트 반응)도 소스로 사용.

### Story 15.2: 페르소나 글 작성기
- **AC**
  1. `persona_prompt`(사전 프롬프트) + 사실 근거(13.3) + 주제로 생성모델 호출 → Tiptap JSON 후보.
  2. AI 티 제거 규칙(길이·구조 들쭉날쭉, 상투어 금지, 이모지 금지, 캐릭터별 불완전함) 프롬프트 반영.
  3. 관리자 가이드는 장문·목차·코드블록 모드(15.6).

### Story 15.3: 검열관(자기검열) — 6항목 판정
- **AC**
  1. 생성모델과 **분리된 검열관 모델**(역할·프롬프트 분리)이 6항목 판정(사실성/AI티/페르소나/안전/중복/맥락).
  2. 결과를 `censor_result` jsonb로 저장. 통과/애매/탈락 3분기.
  3. 판정 강도 차등(관리자·정보형 엄격, 잡담·밈 느슨).

### Story 15.4: 보류 큐 + 재생성 루프
- **AC**
  1. 애매 → `bot_hold_queue`(보류 큐, `ambiguous`). 탈락 → 재생성 최대 2~3회 후 `discarded`.
  2. 통과 → `runContentGuard` → `createPostAsBot` → `published`. 차단 시 `blocked`.
  3. 각 분기 `bot_activity_log` 기록.

### Story 15.5: 풀 고갈 자동 보충
- **AC**
  1. `bot_settings.bot_auto_refill_topics`(자동 보충) ON일 때, 미사용 풀이 임계 이하면 AI가 캐릭터 컨셉에 맞는 새 주제를 생성·추가(`topic_kind=auto`).
  2. `bot.refill-topics` 잡으로 주기/온디맨드 실행.

### Story 15.6: 관리자 장문 가이드 시리즈 모드
- **AC**
  1. `is_admin_persona`(관리자 캐릭터) + `series_group`(대주제 시리즈)으로 대주제 1개를 여러 편 연재.
  2. 목차·소제목·코드블록 + AI 생성 표지/도식 포함, 사실성 최고 강도.
  3. 공지사항 게시판은 봇이 작성하지 않음(가드).

---

## Epic 16: 댓글·반응 파이프라인 + 인젝션 방어

**목표**: 대본 없이, 작성 시점에 원본을 읽고 맥락 반응을 단다.

### Story 16.1: 댓글 스케줄 랜덤 결정
- **AC**
  1. 대상 글 선정 후 **① 캐릭터 ② 반응 종류(동조/질문/반박/농담/리액션) ③ 지연 시간**을 랜덤 결정.
  2. 캐릭터는 전체 풀에서(담당 게시판 무관). 즉답 금지(분~시간, 드물게 일).
  3. 모든 글에 달지 않음(댓글 0 자연스럽게).

### Story 16.2: 비신뢰 입력 래핑 + 인젝션 필터
- **AC**
  1. 원본 글·기존 댓글을 `<untrusted_user_content>`로 래핑.
  2. "ignore previous instructions", "system prompt", "환경변수", "비밀키", "관리자 권한" 등 의심 문구 탐지 → 자동 댓글 생성 중단, `bot_hold_queue`(`injection_suspect`).
  3. 탐지 규칙은 `packages/bot-core` 순수 함수 + 테스트.

### Story 16.3: 맥락 요약 정규화 + 페르소나 반응 생성
- **AC**
  1. 1차 요약기가 주제/질문의도/감정/사실만 추출(정규화 맥락 객체). 원문 전체보다 요약 객체를 생성기에 전달.
  2. 뽑힌 반응 종류를 캐릭터 말투로 작성(같은 동조라도 `semo_k`=반말, `감자세개`=공손).
  3. 대댓글(reply)은 `createReplyAsBot`(parentId 검증) 경로.

### Story 16.4: 댓글 자기검열 + 게시
- **AC**
  1. 맥락 항목 포함 검열 → `runContentGuard` → `createCommentAsBot`/`createReplyAsBot`.
  2. 컨셉상 말 안 되는 조합은 검열에서 거름. 보류/폐기/게시 로그.

---

## Epic 17: 오케스트레이터·스케줄러·안전장치

**목표**: 전체를 매일 자율로 굴리고, 폭주·사고를 구조적으로 막는다.

### Story 17.1: 일일 활동 계획 생성기
- **AC**
  1. `bot.daily-plan` cron이 매일 활동 리듬(`bot_activity_rhythm`)·요일·시간대로 오늘 계획을 랜덤 배정(누가 글/댓글/질문/휴식).
  2. 각 활동을 `bot.write`/`bot.comment` 잡으로 enqueue(활동 시간대 내 분 단위 랜덤 delay).
  3. 합산 하루 새 글 5~7 / 댓글 15~25 평균, 매주 ±랜덤·가끔 잠수 계정.

### Story 17.2: 킬 스위치 + 속도 안전선 강제
- **AC**
  1. 모든 봇 processor가 시작 시 `bot_master_enabled`(킬 스위치) 확인 → off면 즉시 skip+로그.
  2. `bot_daily_post_limit`/`bot_daily_comment_limit`(하루 상한, 기본 10/40) 초과분 skip.
  3. 비용 상한(12.5)과 함께 fail-safe.

### Story 17.3: 반자동 관찰 모드
- **AC**
  1. `bot_observation_mode`(관찰 모드) ON이면 게시 전 전량 보류 큐 적재(자동 게시 안 함) → 운영자 통과 시 게시.
  2. 초기 1~2주 튜닝 용도. OFF 전환 시 정상 자동 게시.

### Story 17.4: BullMQ 잡·크론 등록 + 격리
- **AC**
  1. `apps/worker`에 봇 워커(`processors/bot/*`)·크론(`schedules/bot.cron.ts`) 등록(기존 `content.cleanup` 패턴 재사용).
  2. `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부) env로 워커 부팅 시 로드 토글.
  3. 봇 워커 크래시가 사이트 본체를 멈추지 않음(격리 검증).

---

## Epic 18: 관리자 봇 대시보드

**목표**: 캐릭터·주제·리듬·모델·운영을 화면에서 관리(설정 source of truth).

### Story 18.1: 봇 라우트·가드 + 목록 페이지
- **AC**
  1. `/api/v1/admin/bots/*`(목록/상세/CRUD) — `adminGuard`+`requireSuperAdmin`.
  2. `apps/admin` `/bots` 목록: 상태·최근 활동·누적 글/댓글, 개별 활성화·비활성화 토글.
  3. 리스트=상세페이지(`/bots/[id]`) 규약, 액션폼만 모달.

### Story 18.2: 캐릭터 설정 + 사전 프롬프트 편집
- **AC**: 캐릭터 시트 전체 + `persona_prompt`(사전 프롬프트) 직접 편집·저장. 변경 즉시 다음 생성부터 반영.

### Story 18.3: 활동 설정 + 담당 게시판 편집
- **AC**: 글/주·댓글 빈도·활동 시간대·요일·담당 게시판 추가/제거. `bot_activity_rhythm`/`bot_persona_boards` 갱신.

### Story 18.4: 주제 풀 관리 UI
- **AC**: 봇별 고정 주제 추가/수정/삭제, 사용 기록·중복 상태 표시, 자동 보충 ON/OFF.

### Story 18.5: 모델 할당 UI
- **AC**: 봇별 글생성용·검열관용 프로바이더(OpenAI/Claude/Gemini)+모델 선택. `bot_model_assignments` 갱신.

### Story 18.6: 운영 패널
- **AC**: 일일 리포트 요약·보류 큐 통과/폐기·킬 스위치·속도 안전선·비용 현황. 차트는 `createLineChart` 재사용.

---

## Epic 19: 일일 리포트 & 텔레그램 푸시

**목표**: 운영자가 아침 1~2분에 어제를 파악하고 보류 큐만 처리한다.

### Story 19.1: 일일 집계 + 리포트 데이터 API
- **AC**
  1. `bot.daily-report` cron이 어제 활동(`bot_activity_log`) 집계: 글 N·댓글 M·캐릭터 분포·게시 목록(링크)·보류 건수·경고(차단 수·재생성 多·잠수 계정)·비용·상태.
  2. 대시보드용 `/api/v1/admin/bots/report?date=` 제공.

### Story 19.2: 보류 큐 처리 액션
- **AC**: 보류 항목 통과 → 게시(`createPostAsBot`/`createCommentAsBot`), 폐기 → `discarded`. 결정 로그(`decided_by`).

### Story 19.3: 텔레그램 푸시
- **AC**
  1. 매일 아침 **간단 요약(글 N·댓글 M + 보류 건수 + 대시보드 링크)**을 텔레그램으로 전송(`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID`).
  2. 채널은 `bot_settings.bot_push_channel`(푸시 채널). 키 없으면 graceful skip + 로그.
  3. 상세 처리는 링크 → 대시보드.

---

## 스토리 생성 가이드 (다음 단계)

이 문서를 입력으로 `bmad-create-story`(또는 기존 `_STORY-GEN-INSTRUCTIONS.md` 절차)를 돌려
`_bmad-output/implementation-artifacts/11-1-*.md` … `19-3-*.md` 상세 스토리 파일을 Epic 순서대로 생성한다.
상세화 시 각 스토리는 PRD·ARCHITECTURE·project-context의 규칙을 인용(References)해야 한다.

**총계: 9 Epic / 38 Story.**
