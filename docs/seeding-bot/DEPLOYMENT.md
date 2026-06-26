---
project_name: 'AI작당 — 시딩 봇 (Seeding Bot)'
doc_type: 'Deployment & Operations Prep'
status: 'draft'
date: '2026-06-26'
audience: '운영자(사용자) — 배포 전 직접 준비해야 할 것'
---

# 시딩 봇 배포 준비 가이드 (운영자용)

> **이 문서는 "당신(운영자)이 직접 준비해야 하는 것"** 만 모았습니다.
> 코드는 개발이 만들지만, **외부 API 키 발급·결제·인프라 결정**은 당신이 해야 합니다.
> 식별자(env 키 등)에는 한국어 뜻을 괄호로 적어 뒀습니다.

---

## 0. 한눈에 보는 준비 체크리스트

발급/결정해서 `.env`에 채워야 하는 것들입니다. (자세한 발급법은 아래 각 절)

| 구분 | 준비물 | env 키 | 필수? |
|---|---|---|---|
| AI | OpenAI API 키 | `OPENAI_API_KEY` | △ (셋 중 최소 1개) |
| AI | Anthropic Claude API 키 | `ANTHROPIC_API_KEY` | △ |
| AI | Google Gemini API 키 | `GEMINI_API_KEY` | △ |
| 검색 | 구글 검색 API 키 + 검색엔진 ID | `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX` | 권장 |
| 검색 | 네이버 검색 API | `NAVER_SEARCH_CLIENT_ID/SECRET` | 권장 |
| 이미지 | Unsplash 또는 Pexels 키 | `UNSPLASH_ACCESS_KEY` / `PEXELS_API_KEY` | 권장 |
| 이미지 | (AI 이미지 생성은 OpenAI 키 재사용) | `OPENAI_API_KEY` | △ |
| 푸시 | 텔레그램 봇 토큰 + 챗 ID | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | 선택 |
| 인프라 | 24시간 도는 서버 + Postgres + Redis + 스토리지 | (기존 사이트 env) | 필수 |

> △ = AI/검색/이미지는 **부분 가동** 가능. 키가 없는 기능은 자동으로 건너뜁니다(코드가 graceful skip).
> 일단 **OpenAI 1개 + 구글 검색 + Unsplash + 텔레그램**만 있어도 전체 흐름이 돕니다.

---

## 1. AI 프로바이더 키 발급

봇이 글·댓글을 쓰고(생성), 자기검열(검열관)하고, 관리자 가이드 이미지를 만드는 데 씁니다.
**셋 중 최소 하나**는 필요하고, 봇별로 섞어 쓸 수 있습니다(관리자에서 할당).

### 1.1 OpenAI (`OPENAI_API_KEY`)
- 발급: <https://platform.openai.com> → 로그인 → **API keys** → "Create new secret key".
- 결제: **Billing**에 카드 등록 + 선불 크레딧 충전(사용량 과금). **Usage limit(사용 한도)**를 꼭 걸어두세요(폭주 방지).
- 이미지 생성도 이 키로 가능(별도 키 불필요).

### 1.2 Anthropic Claude (`ANTHROPIC_API_KEY`)
- 발급: <https://console.anthropic.com> → **API Keys** → 생성.
- 결제: Billing에 크레딧 충전. (정확한 모델 ID는 착수 시 `claude-api` 스킬/문서로 최신 확인.)

### 1.3 Google Gemini (`GEMINI_API_KEY`)
- 발급: <https://aistudio.google.com/apikey> (Google AI Studio) → "Create API key".
- 결제: 무료 등급 존재하나 한도 작음. 운영은 유료 결제(Google Cloud 프로젝트 연결) 권장.

> 권고 기본 티어(설계 14.5): 일반 글·댓글=싸고 빠른 범용 소형, 검열관=추론 소형, 관리자 장문=상위 모델.
> 정확한 모델명은 **운영 중 관리자 화면에서 자유 변경** 가능(추상화 레이어 덕).

---

## 2. 검색 API 발급 (글의 사실성 그라운딩)

### 2.1 구글 Programmable Search (`GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_CX`)
1. **검색엔진 만들기**: <https://programmablesearchengine.google.com> → "Add" → "전체 웹 검색"으로 설정 → 생성 후 **Search engine ID(검색엔진 식별자)** 복사 → `GOOGLE_SEARCH_CX`.
2. **API 키**: <https://console.cloud.google.com> → 프로젝트 생성 → "Custom Search API" 사용 설정 → **사용자 인증 정보**에서 API 키 발급 → `GOOGLE_SEARCH_API_KEY`.
3. 무료 한도: 하루 100쿼리. 초과분은 유료(쿼리당 과금) — 결제 계정 연결 필요.

### 2.2 네이버 검색 API (`NAVER_SEARCH_CLIENT_ID` + `NAVER_SEARCH_CLIENT_SECRET`)
1. <https://developers.naver.com> → 로그인 → **Application 등록**.
2. 사용 API에서 **검색**(뉴스·블로그·웹) 선택 → 등록.
3. 발급된 **Client ID / Client Secret**를 env에 입력.
4. 한국어 트렌드·시사·잡담형 실시간 소스로 유용. 일일 호출 한도 확인.

---

## 3. 이미지 소스 발급

### 3.1 무료 스톡 — 둘 중 하나 이상
- **Unsplash** (`UNSPLASH_ACCESS_KEY`): <https://unsplash.com/developers> → 앱 등록 → Access Key. 데모는 시간당 50요청, 프로덕션 승인 시 5,000요청/시간.
- **Pexels** (`PEXELS_API_KEY`): <https://www.pexels.com/api/> → 키 발급(무료, 넉넉한 한도).
- 둘 다 **무료 라이선스**라 저작권 안전. (밈·짤 퍼오기는 코드가 보류 큐로 보내 운영자가 점검)

### 3.2 AI 이미지 생성
- 별도 발급 불필요 — **OpenAI 키 재사용**(`OPENAI_API_KEY`). `ai-creation`(AI 창작마당)·관리자 가이드 표지에 사용.

---

## 4. 텔레그램 푸시 (선택, 권장)

매일 아침 "어제 봇이 뭐 했나 + 보류 N건 + 대시보드 링크"를 메신저로 받습니다.

1. 텔레그램에서 **@BotFather** 검색 → `/newbot` → 이름 지정 → **봇 토큰** 받기 → `TELEGRAM_BOT_TOKEN`.
2. 만든 봇과 1:1 대화창을 열고 아무 메시지나 보냄.
3. 브라우저에서 `https://api.telegram.org/bot<토큰>/getUpdates` 열기 → 응답의 `chat.id`(채팅 식별자) 복사 → `TELEGRAM_CHAT_ID`.
   - 채널로 받고 싶으면 봇을 채널 관리자로 추가하고 채널 ID 사용.
4. 키가 없으면 푸시는 자동으로 건너뜁니다(대시보드로만 확인).

---

## 5. 인프라 (24시간 구동)

봇은 **실서버에서 24시간 도는 워커**입니다. 기존 사이트 인프라를 재활용합니다.

필요한 것:
- **항상 켜진 서버**: `apps/api`(Fastify) + `apps/worker`(BullMQ) + `apps/web`/`apps/admin`(Next.js)가 도는 호스트. (예: VPS/클라우드 VM, Docker, PM2/systemd로 워커 상시 가동.)
- **PostgreSQL 17**(+pg_bigm): 기존 사이트 DB. 봇 테이블이 여기 추가됨. (`DATABASE_URL`)
- **Redis**: BullMQ 큐·조회수 버퍼. 봇 잡도 여기 얹힘. (`REDIS_URL`)
- **객체 스토리지**(MinIO 또는 Cloudflare R2): 봇이 만든 이미지 업로드. (`S3_*`)
- **ClamAV**: (자료실 업로드 스캔용 — 봇 필수 아님, 기존 그대로)

배포 시 새로 신경 쓸 것:
- `apps/worker`가 **상시 실행**돼야 봇 스케줄러가 돕니다(크론·반복 잡). 프로세스 매니저로 자동 재시작 설정.
- `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부)를 워커 환경에 둠. 처음엔 `false`로 배포 → DB 시드·관리자 점검 후 가동.

---

## 6. 배포 순서 (권장 런북)

1. **코드 배포**: Epic 11~19 머지된 빌드 배포. `SEEDING_BOT_ENABLED=false`(아직 봇 안 돔).
2. **마이그레이션**: `pnpm --filter @ai-jakdang/database db:migrate` — `bot_*` 테이블·`users.is_bot` 생성.
3. **봇 시드**: 시드 스크립트 실행 → 7인+관리자 페르소나·주제 풀·리듬 적재(`is_bot=true` 계정 생성).
4. **키 입력**: `.env`에 §1~§4 키 채우기. `packages/config`가 검증.
5. **관리자 점검**: `apps/admin` "활동 봇" 메뉴에서 봇 목록·캐릭터·모델 할당 확인. 비용 상한·속도 안전선 설정.
6. **관찰 모드로 시동**: `bot_observation_mode`(관찰 모드) ON + `SEEDING_BOT_ENABLED=true`. 게시 전 전량 보류 큐로 들어옴.
7. **1~2주 튜닝**: 매일 보류 큐를 보며 말투·주제·모델을 조정. 품질 만족 시 관찰 모드 OFF(자동 게시 시작).
8. **점진 운영**: 진짜 사용자 늘면 활동 빈도 하향(관리자에서).

> **킬 스위치**: 무슨 일이 생기면 관리자에서 `bot_master_enabled`(봇 전체 가동 스위치) OFF → 모든 봇 즉시 정지.

---

## 7. 비용 관리

호출당 과금되는 항목: AI 글·댓글·검열 생성, 검색 API(구글 무료 한도 초과분), AI 이미지 생성.

- **상한 설정**: `bot_daily_cost_limit_usd`(일일 비용 상한)을 관리자에서 설정 → 도달 시 자동 중단.
- **프로바이더별 한도**: OpenAI/Anthropic/Google 콘솔에서도 **사용 한도(usage limit)**를 별도로 걸어 2중 안전.
- **비용 가시화**: 일일 리포트에 어제 비용 추정이 표시됨.
- **절감 팁**: 일반 글·댓글은 소형 모델, 검색 강도 `light`/`none` 활용, 잡담형은 검색 생략.

---

## 8. 운영·법적 점검 (배포 전 1회)

- **윤리 원칙 명문화**: 시딩(초기 활성화) 목적임을 운영 정책에 기록. 광고·리뷰·여론 조작 아님.
- **봇 표기 정책 결정**: `is_bot`(봇 여부)는 내부 식별용. 외부에 "봇"이라고 표시할지 여부를 결정(기본: 비노출).
- **저작권**: 스톡은 무료 라이선스만. 밈·짤은 보류 큐 점검 후 게시. 출처 불명 이미지 금지.
- **개인정보·금칙어**: 봇 자기검열 + 사이트 `contentGuard`(금칙어·스팸 차단) 2중 방어 동작 확인.
- **약관 정합**: 사이트 이용약관이 자동 생성 콘텐츠와 충돌하지 않는지 확인.

---

## 9. 운영 중 매일 하는 일 (1~2분)

1. 아침에 텔레그램 요약 확인(또는 대시보드 접속).
2. **보류 큐**만 처리: 통과 ↔ 폐기.
3. 경고 신호(차단 多·재생성 多·잠수 계정·비용 급증) 있으면 들여다보기.
4. 이상 시 킬 스위치 OFF.

> 나머지는 시스템이 알아서 돕니다. 정기적으로(주 1회) 주제 풀·모델·빈도를 손보면 충분합니다.

---

## 부록 A. `.env` 채울 값 모음 (복사용)

```dotenv
# ── 시딩 봇: AI 프로바이더 ──
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# ── 시딩 봇: 검색 ──
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=

# ── 시딩 봇: 이미지 스톡 ──
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# ── 시딩 봇: 텔레그램 푸시 ──
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ── 시딩 봇: 부트스트랩 ──
SEEDING_BOT_ENABLED=false
```

런타임 동작 설정(킬 스위치·속도 안전선·비용 상한·관찰 모드·자동 보충)은 **env가 아니라 DB(`bot_settings`)**이며
관리자 대시보드에서 바꿉니다. env는 키와 부팅 토글만 담습니다.
