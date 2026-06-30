---
project_name: 'AI작당 — 시딩 봇 (Seeding Bot)'
doc_type: 'Architecture'
status: 'draft-for-build'
date: '2026-06-26'
parent_architecture: '_bmad-output/planning-artifacts/architecture.md'
project_context: '_bmad-output/project-context.md'
---

# 시딩 봇 아키텍처

> 기존 모노레포(`apps/web|admin|api|worker` + `packages/*`) 위에 **증분**으로 얹는다.
> 본 문서는 실제 코드(확인 완료)를 출발점으로 한다. 본문 식별자에는 한국어 뜻을 괄호 병기.

---

## 0. 설계 원칙 (절대 규칙)

1. **DB 직접 INSERT 금지.** 봇 글·댓글은 공용 도메인 서비스를 탄다(시드 계정 생성 제외).
2. **DB 접근은 `apps/api`·`apps/worker`에서만.** (project-context 규칙)
3. **트랜잭션은 service 레이어(`routes/*/service.ts`)에서만.**
4. **AI 생성 모델에 도구 권한 없음.** 텍스트 후보만 반환. DB·env·관리자설정 접근 불가.
5. **모든 외부 입력(사용자 글·검색 결과)은 비신뢰 입력.** 인젝션 가드 후 사용.
6. **설정의 source of truth는 DB.** 설계 문서 값은 시드.
7. **타입은 `packages/contracts`(Zod), env는 `packages/config` 단일 진입점.**

---

## 1. 시스템 구성 (큰 그림)

```
                 ┌────────────────────────────────────────────────┐
                 │  apps/admin  "활동 봇" 메뉴 (슈퍼관리자 전용)      │
                 │  봇 CRUD · 캐릭터/프롬프트 · 주제풀 · 모델할당      │
                 │  운영패널(리포트·보류큐·킬스위치·비용)              │
                 └───────────────┬────────────────────────────────┘
                                 │ HTTP /api/v1/admin/bots/*
                 ┌───────────────▼────────────────────────────────┐
                 │  apps/api  (Fastify)                            │
                 │  - 관리자 봇 라우트 (admin/bots/*)                │
                 │  - 공용 도메인 서비스 (createPostAsBot 등) ◀──┐   │
                 └───────────────┬─────────────────────────────│──┘
                                 │ 공유                          │ 같은 도메인 로직 재사용
   packages/  ┌──────────────────▼─────────────────┐            │
   bot-core   │ 페르소나·프롬프트 빌더·자기검열 규칙 │            │
   (순수함수) │ 인젝션 필터·맥락 요약·중복 판정      │            │
              └──────────────────┬─────────────────┘            │
                                 │ 호출                          │
                 ┌───────────────▼─────────────────────────────┴──┐
                 │  apps/worker  (BullMQ)  ── 단일 `bot` 큐        │
                 │  job.name 분기: bot.daily-plan · bot.write       │
                 │  · bot.comment · bot.daily-report · bot.refill-  │
                 │  topics  (검열은 bot.write/comment 내부 인라인)  │
                 └──┬────────────┬──────────────┬──────────────┬──┘
                    │            │              │              │
            ┌───────▼──┐  ┌──────▼─────┐  ┌─────▼──────┐  ┌────▼──────┐
            │ AI 추상화 │  │ 검색 어댑터 │  │ 이미지 엔진 │  │ 텔레그램   │
            │ OpenAI/   │  │ Google /   │  │ 스톡/생성/  │  │ 푸시       │
            │ Claude/   │  │ Naver      │  │ 무이미지    │  │            │
            │ Gemini    │  └────────────┘  └────────────┘  └───────────┘
            └──────────┘
                    │ 모든 상태 → PostgreSQL (bot_* 테이블) + Redis(BullMQ)
```

### 새 패키지 / 앱 변경
| 위치 | 무엇 | 비고 |
|---|---|---|
| `packages/bot-core` (신규, 순수 함수) | 페르소나 프롬프트 빌더, 자기검열 규칙, 인젝션 필터, 맥락 요약 정규화, 중복 유사도 판정 | DB·네트워크 접근 금지. `packages/core`와 동일 격리 원칙 |
| `packages/contracts` (수정) | `bot.ts` — 봇 페르소나·주제·활동로그·보류큐·설정·모델할당 Zod 스키마 | API/worker/admin 공유 |
| `packages/database` (수정) | `schema/bot.ts` + 마이그레이션 — `bot_*` 테이블, `users.is_bot` 컬럼 | drizzle generate |
| `packages/config` (수정) | `env.ts` — AI/검색/이미지/텔레그램 키 추가 | Zod 검증 |
| `apps/api` (수정) | `services/bot/*` 공용 도메인 서비스 + `routes/admin/bots/*` | 게시는 기존 posts/comments service 재사용 |
| `apps/worker` (수정) | 봇 워커·잡·크론 (`processors/bot/*`, `schedules/bot.cron.ts`) | 기존 BullMQ 인프라 위. `apps/api/src/*` 직접 import 금지 |
| `apps/admin` (수정) | "활동 봇" 메뉴·페이지 | `packages/admin-design-system` 사용 |
| `packages/server-bot` (권장 신규, server-only) | api/worker가 함께 쓰는 봇 작성·AI·검색·이미지·게이트 경계 | DB 접근 허용 대상은 api/worker 런타임뿐. web/admin import 금지 |
| server-only AI/Search/Image 모듈 | AI 프로바이더·검색·이미지 엔진 | OpenAI/Claude/Gemini, Google/Naver, 스톡/생성. 위치는 `packages/server-bot` 권장 |

---

## 2. 데이터 모델 (Drizzle, `packages/database/src/schema/bot.ts`)

> 네이밍: 테이블 snake_case 복수형, 컬럼 snake_case, Drizzle 프로퍼티 camelCase,
> PK=`id` uuid `defaultRandom()`, 타임스탬프 `timestamptz`. (project-context 규칙)

### 2.1 `users.is_bot` (기존 테이블 컬럼 추가)
- `is_bot`(봇 계정 여부) boolean NOT NULL DEFAULT false. 마이그레이션으로 ALTER. 통계·랭킹 제외 필터의 기준.

### 2.2 `bot_personas` (봇 페르소나 = 캐릭터 시트)
| 컬럼 | 타입 | 의미 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | 이 페르소나가 연결된 봇 계정 |
| nickname | varchar | 화면 닉네임(예: `dubu_2`) |
| hidden_identity | text | 숨은 정체성(내부 전용: "30대 직장인…") |
| age_job | varchar | 나이대·직업 |
| tone | text | 말투·입버릇 |
| persona_prompt | text | **사전 프롬프트(시스템 컨텍스트)** — 관리자 편집 대상 |
| info_ratio | int | 정보형 vs 잡담형 비율(0~100) |
| intentional_flaws | text | 의도적 약점·버릇(오타 빈도 등) |
| is_admin_persona | boolean | 관리자 캐릭터(`AI작당지기`) 여부 |
| is_active | boolean | 개별 ON/OFF |
| created_at / updated_at | timestamptz | |

> ⚠️ 모델 할당은 `bot_personas`가 아니라 **`bot_model_assignments`가 `persona_id`로 역참조**한다(#5 정합, 2026-06-29). `bot_personas`에는 `gen_model_id`/`censor_model_id` 컬럼을 두지 않는다. 모델 조회는 `(persona_id, purpose)`로 수행.

### 2.3 `bot_persona_boards` (담당 게시판, N:M)
- `persona_id` FK, `board`(게시판 슬러그, `packages/contracts/board.ts`의 BOARDS 키), `weight`(배분 가중치).

### 2.4 `bot_activity_rhythm` (활동 리듬)
- `persona_id` FK, `posts_per_week`(주당 글 수) int, `comments_per_week`(주당 댓글 수) int,
  `active_hours`(활동 시간대) jsonb(예: `[{from:21,to:24},{from:12,to:13}]`),
  `active_days`(활동 요일 성향) jsonb(예: `{weekday:0.8, weekend:0.2}`).

### 2.5 `bot_topics` (주제 풀)
| 컬럼 | 의미 |
|---|---|
| id, persona_id FK | |
| board | 올라갈 게시판 |
| title_seed | 주제 출발점 텍스트 |
| topic_kind | `fixed`(고정) / `realtime`(실시간) / `auto`(자동 보충) |
| status | `unused`(미사용) / `used`(사용됨) / `cooling`(재사용 대기) |
| used_at | 마지막 사용 시각(중복 방지 기준) |
| series_group | 관리자 대주제 그룹(장문 시리즈 묶음) |

### 2.6 `bot_model_assignments` (모델 할당 — persona별)
- `persona_id`(FK→`bot_personas.id`, NOT NULL, `onDelete: cascade`), `provider`(프로바이더) enum(`openai`|`anthropic`|`google`), `model`(모델명) varchar, `purpose`(용도) enum(`generation`|`censor`|`image`), `is_active`, `note`.
- **unique 제약 `(persona_id, purpose)`** — 페르소나당 용도별 모델 1개. 모델 조회는 `(persona_id, purpose)`로 수행(글 생성=`generation`, 검열관=`censor`, 이미지=`image`).

### 2.7 `bot_generation_jobs` (생성 작업 추적 — 글·댓글 후보의 수명주기)
| 컬럼 | 의미 |
|---|---|
| id | |
| persona_id FK | 누가 |
| job_kind | `post` / `comment` / `reply` / `question` / `resource` (#6 정합 — Q&A·실전자료 작성 경로) |
| target_board / target_post_id | 어디에 |
| topic_id FK (nullable) | 주제(댓글은 null) |
| status | `pending`(대기)/`generating`(생성중)/`censoring`(검열중)/`held`(보류)/`approved`(승인)/`published`(게시됨)/`discarded`(폐기)/`blocked`(contentGuard 차단) |
| draft_content | jsonb (Tiptap JSON 후보) |
| censor_result | jsonb (항목별 통과/탈락) |
| regen_count | 재생성 횟수 |
| scheduled_at | 예정 게시 시각(분 단위 랜덤) |
| published_post_id / published_comment_id | 게시 결과 참조 |
| cost | jsonb (토큰·검색·이미지 비용 추정) |
| created_at / updated_at | |

### 2.8 `bot_hold_queue` (보류 큐) — `bot_generation_jobs`의 `held` 뷰 + 사유
- `job_id` FK, `reason`(보류 사유: `ambiguous`|`injection_suspect`|`copyright_risk`|`observation_mode`), `decided`(결정됨) boolean, `decision`(`approved`|`discarded`), `decided_at`, `decided_by`(admin_user_id). `observation_mode`는 관찰 모드(`bot_observation_mode`) ON일 때 게시 전 전량 보류 시 사용(Story 11.12).

### 2.9 `bot_activity_log` (활동 로그) — 사후 감시·일일 요약 원천
- `persona_id`, `event_type`(이벤트: `post.published`|`comment.published`|`held`|`blocked`|`regenerated`|`skipped`|`cost`|`discarded`|`planned`), `ref_id`, `payload` jsonb, `created_at`. `discarded`(폐기: 재생성 한도 초과·보류 폐기), `planned`(일일 계획 기록: Story 11.11). 일일 계획 로그는 `cost`가 아닌 `planned`를 사용.

### 2.10 `bot_settings` (봇 전역 설정) — site_settings 패턴(key-value JSONB)
| key | 의미 |
|---|---|
| `bot_master_enabled` | 킬 스위치(봇 전체 가동 스위치). false면 모든 봇 잡 즉시 중단 |
| `bot_daily_post_limit` | 하루 최대 글 수(속도 안전선, 기본 10) |
| `bot_daily_comment_limit` | 하루 최대 댓글 수(기본 40) |
| `bot_daily_cost_limit_usd` | 일일 비용 상한(달러) |
| `bot_exclude_from_ranking` | 봇을 통계·랭킹에서 제외 |
| `bot_auto_refill_topics` | 주제 풀 자동 보충 ON/OFF |
| `bot_observation_mode` | 반자동 관찰 모드(게시 전 전량 보류) |
| `bot_push_channel` | 푸시 채널(기본 `telegram`) |

> 마이그레이션 번호는 **고정하지 않는다**. 착수 시점에 `packages/database/migrations/`와 `packages/database/migrations/meta/_journal.json`의 **최신 번호를 확인**한 뒤 그 다음 번호로 drizzle `db:generate`가 자동 부여한다(캡처 후 `db:migrate`).
> ⚠️ 다중 세션 충돌 주의(메모리): generate가 타 세션 스키마를 묶을 수 있음 — 봇 스키마만 선별 반영.

---

## 3. 공용 도메인 서비스 (봇 작성 경로)

위치: `apps/api/src/services/bot/` 또는 공용 server-only 패키지(`packages/server-bot`). **worker가 호출해야 하는 함수는 `apps/api/src/*`를 직접 import하지 않도록 server-only 경계로 추출**하고, 기존 사용자 작성 service를 재사용한다.

```
ensureBotUser(persona)        → users(is_bot=true) 레코드 보장/생성 (시드 단계, 통제된 직접 생성 허용)
updateBotProfile(persona)     → 닉네임·프로필 이미지 등 동기화
createPostAsBot(input)        → 내부에서 posts/service.ts createPost() 호출(같은 부수효과)
createCommentAsBot(input)     → routes/v1/comments.ts 의 댓글 생성 도메인 로직 재사용
createReplyAsBot(input)       → parentId 검증 포함 동일 경로
createQuestionAsBot(input)    → Q&A 질문 생성 도메인 서비스 재사용
createResourceAsBot(input)    → 실전자료 생성 도메인 서비스 재사용
```

**핵심**: `createPostAsBot`은 `apps/api/src/routes/v1/posts/service.ts`의 `createPost()`가 하는 것
(slug 생성, summary, 썸네일 추출, 태그 upsert, 첨부, 포인트 적립, OG fetch job, contentGuard, 캐시 무효화)을
**그대로** 거친다. 봇이라고 우회하지 않는다.

> 현재 댓글 생성 로직은 `apps/api/src/routes/v1/comments.ts`에 라우트와 함께 있음(별도 service 미분리).
> **선행 리팩터링**(Story 11.3): 댓글 생성 도메인 로직을 `comments/service.ts`로 추출해 봇·사용자가 공유.
> contentGuard는 현재 preHandler(`apps/api/src/middleware/contentGuard.ts`)이므로, 봇 경로에서는
> 동일 검사를 **함수로 직접 호출**(`runContentGuard(text)`)할 수 있게 추출한다. 단, worker가 필요로 하는 순수 검사·텍스트 추출 로직은 `packages/bot-core` 또는 server-only 공용 경계로 이동해 `apps/api/src/*` 직접 import를 피한다.

---

## 4. AI 추상화 레이어 (server-only 공용 경계)

```
interface AiProvider {
  generateText(req: { system: string; user: string; model: string; maxTokens; temperature })
    : Promise<{ text: string; usage: { inputTokens; outputTokens }; costUsd }>
  generateImage?(req): Promise<{ url|bytes; costUsd }>   // OpenAI 등만
}
adapters/openai.ts · anthropic.ts · gemini.ts   // 각 SDK 래핑
index.ts: getProvider(providerName) → AiProvider
callModel(assignment, prompt) → 봇별 모델 할당으로 라우팅 + 비용 기록(bot_activity_log cost)
```

- **위치 원칙**: worker와 api가 함께 쓰므로 `packages/server-bot` 같은 server-only 패키지를 표준 경계로 둔다. worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다.
- **격리**: 생성 모델 호출에는 **system 프롬프트 + 비신뢰 입력 블록**만 전달. 도구/함수콜 비활성.
- **비용**: 각 호출 후 `costUsd`(달러 비용 추정)를 `bot_generation_jobs.cost`에 누적, 일일 상한 비교.
- **모델명 하드코딩 금지**: `bot_model_assignments`에서 읽음. 라인업 변경에 강함.
- 키: `OPENAI_API_KEY`·`ANTHROPIC_API_KEY`·`GEMINI_API_KEY`(env, §8).

## 5. 검색 어댑터 (server-only 공용 경계)

```
searchGoogle(query)  → Google Custom Search JSON API (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX)
searchNaver(query)   → Naver 검색 API (NAVER_SEARCH_CLIENT_ID + NAVER_SEARCH_CLIENT_SECRET)
groundTopic(topic, intensity) → 성격별로 둘 섞어 호출 → 결과를 비신뢰 입력으로 요약기에 투입
```

- `intensity`(검색 강도): `full`(정보형) / `light`(트렌드 키워드만) / `none`(잡담·밈).
- 검색 결과 → `summarizeFacts()`(packages/bot-core 순수 함수 + AI 요약기) → 사실 근거 객체.
- 검색 결과 텍스트 안의 지시문은 인젝션 필터 통과 후 사용(§7).

## 6. 이미지 엔진 (server-only 공용 경계)

```
pickStock(keyword)  → Unsplash/Pexels API (UNSPLASH_ACCESS_KEY | PEXELS_API_KEY)
genImage(prompt)    → AI 이미지 생성 (OPENAI_API_KEY image endpoint 등)
decideImageStrategy(persona, board, postKind) → 'stock' | 'ai' | 'none' | 'meme'
```

규칙:
- `ai-creation`(AI 창작마당) → 반드시 `ai`.
- 관리자 가이드 표지/도식 → `ai`.
- 짧은 잡담·질문 → 흔히 `none`.
- 선택된 이미지는 **에디터 본문 첫 이미지로 삽입** → 기존 썸네일 추출 로직이 자동 처리(없으면 기본 빈 썸네일).
- 이미지 파일은 기존 S3(MinIO/R2) 공개 버킷에 업로드 후 URL을 본문에 넣음(기존 업로드 서비스 재사용).
- 밈·짤 외부 이미지는 게시 전 보류 큐(`copyright_risk`)로 점검 가능.

## 7. 자기검열 & 인젝션 방어 파이프라인 (`packages/bot-core` + worker)

### 글 생성 파이프라인 (Story 11.9)
```
주제선정(중복 방지) → groundTopic(검색·요약) → 페르소나 작성(생성모델)
  → decideImageStrategy → 자기검열(검열관 모델, 6항목)
     ├ 통과 → contentGuard(runContentGuard) 통과 → createPostAsBot → published
     ├ 애매 → bot_hold_queue(ambiguous) → 일일 리포트
     └ 탈락 → 재생성(≤2~3) or discarded
```

### 댓글 생성 파이프라인 (Story 11.10) — 1.5절 방식
```
스케줄러: (캐릭터·반응종류·지연) 랜덤 결정
  → 원본 글+기존 댓글을 <untrusted_user_content>로 래핑
  → 인젝션 키워드 필터(injection_suspect면 보류 큐)
  → 1차 요약기: 주제/질문의도/감정/사실만 추출(정규화 맥락 객체)
  → 댓글 생성기: 맥락 객체 + 페르소나 말투로 반응 작성
  → 자기검열(맥락 항목 포함) → contentGuard → createCommentAsBot
```

### 자기검열 6항목 (FR-SB-8.2)
사실성 / AI 티(이모지 금지) / 페르소나 일관성 / 안전·위험 / 중복성 / 맥락(댓글). 강도 차등.

### 중복성 판정
- 최근 자기 글/남의 글과의 유사도 → `bot-core`의 단순 유사도(코사인/자카드) 1차 + 검열관 판정 2차.

## 8. 환경변수 (`.env.example` 추가, `packages/config/src/env.ts` Zod 검증)

```
# ── AI 프로바이더 (봇 글·댓글·검열·이미지 생성) ──
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# ── 검색 (그라운딩) ──
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=          # Programmable Search Engine ID(검색엔진 식별자)
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=

# ── 이미지 스톡 ──
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# ── 푸시 알림 ──
TELEGRAM_BOT_TOKEN=        # BotFather 발급 토큰
TELEGRAM_CHAT_ID=          # 리포트 받을 채팅/채널 ID

# ── 봇 동작 부트스트랩(런타임 설정은 bot_settings DB가 우선) ──
SEEDING_BOT_ENABLED=false  # 워커 부팅 시 봇 모듈 로드 여부(기본 off, 배포 후 관리자에서 가동)
```

> 모든 키는 비어 있어도 앱이 부팅되도록 `packages/config`에서 **optional**로 검증하고,
> 해당 기능 사용 시점에 "키 미설정" 에러를 명확히 던진다(부분 가동 허용).

## 9. 워커·큐·크론 (`apps/worker`, 기존 BullMQ 위)

> **단일 `bot` 큐 + `job.name` 디스패처**가 표준이다(Story 11.13 소유, 기존 `ranking` 큐가 `ranking.compute`·`gamification.grade-up`을 공유하는 방식과 동일). `QUEUE_NAMES.bot = "bot"` 하나에 아래 `job.name`들이 들어가고 `switch(job.name)`로 분기한다. **별도 큐(`bot-write`·`bot-comment` 등)를 만들지 않는다.**

| `job.name` (단일 `bot` 큐) | 트리거 | 처리 |
|---|---|---|
| `bot.daily-plan` | cron 매일 새벽(KST) | 오늘 활동 계획 랜덤 생성 → `bot.write`/`bot.comment` 잡 enqueue(분 단위 랜덤 delay) |
| `bot.write` | 스케줄된 시각(delay) | 글/질문/자료 생성 파이프라인 1건 (검열은 이 잡 **내부 인라인**) |
| `bot.comment` | 스케줄된 시각(delay) | 댓글 생성 파이프라인 1건 (검열은 이 잡 **내부 인라인**) |
| `bot.daily-report` | cron 매일 아침(KST) | 어제 활동 집계 → 대시보드 데이터 + 텔레그램 푸시 |
| `bot.refill-topics` | 풀 소진 감지 / 주기 cron | 자동 주제 보충 |

> ⚠️ 검열(`bot.censor`)은 **별도 잡이 아니다** — `bot.write`/`bot.comment` 파이프라인 내부에서 생성 모델과 분리된 검열관 모델을 인라인 호출한다(Story 11.9/11.10).

- **킬 스위치 강제**: 모든 봇 잡 processor는 시작 시 `bot_master_enabled`(킬 스위치)와 일일 상한·비용 상한을 확인하고, 차단 상태면 즉시 skip + 로그.
- BullMQ `repeat`/cron 패턴은 기존 `apps/worker`의 `content.cleanup`(매일 03:00) 패턴 재사용.

## 10. 관리자 대시보드 (`apps/admin` "활동 봇")

- 라우트: `/bots` 목록 → `/bots/[id]` 상세(리스트=상세페이지 규약, 메모리 규칙), 액션폼만 모달.
- API: `/api/v1/admin/bots/*`(`adminGuard` + `requireSuperAdmin`).
- 탭: 봇 목록 / 캐릭터·프롬프트 / 활동 설정 / 주제 풀 / 모델 할당 / 운영 패널.
- 차트는 기존 `createLineChart` 재사용(Recharts 금지 — 메모리 규칙).
- 보류 큐 통과/폐기 버튼이 유일한 일상 조작 지점.

## 11. 보안·실패 모드

- **fail-safe**: 검열·가드·키 누락·AI 오류 시 게시하지 않고 보류 또는 skip. "의심되면 안 올린다".
- **격리**: 봇 워커 크래시가 사이트 본체(api/web)를 멈추지 않음(별 프로세스).
- **권한 최소화**: 생성 모델에 도구 권한 없음. 봇 라우트는 슈퍼관리자 전용.
- **관측**: 모든 단계 `bot_activity_log` 적재. 일일 리포트가 사후 감시 창구.
- **인젝션**: 비신뢰 입력 래핑 + 키워드 필터 + 요약 정규화 3중.

## 12. 단계적 구축 순서 (의존성)

> 시딩 봇 전체 = **Epic 11 하나**. 아래는 그 안의 스토리 그룹(A~F) 순서다. 상세는 [EPICS-AND-STORIES.md](./EPICS-AND-STORIES.md).

```
[A] 봇 토대·도메인 서비스·시드 (11.1~11.5)     ← 최우선 토대
   ├─ [B] AI 추상화 (11.6)
   ├─ [B] 검색 (11.7)
   └─ [B] 이미지 (11.8)
        ↓ (B 위에서)
[C] 글 파이프라인 (11.9) ─┐
[C] 댓글 파이프라인 (11.10)─┤
        ↓                 │
[D] 오케스트레이터·안전장치 (11.11~11.13)  ← C를 굴림
        ↓
[E] 관리자 대시보드 (11.14~11.16)  ← 설정·운영 UI
[F] 일일 리포트·텔레그램 (11.17~11.18) ← D의 로그 위
```
