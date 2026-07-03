---
project_name: 'AI작당 — 시딩 봇 (Seeding Bot)'
doc_type: 'Design Extension (Epic 13)'
status: 'design-approved / partial-prototype-built'
date: '2026-07-03'
parent_epic: 'Epic 11 (시딩 봇)'
new_epic: 'Epic 13 (가이드 커리큘럼 · 이미지 3-모드 · 스테이징 · 스케줄)'
supersedes_notes: 'Epic 11 FR-SB-4(이미지)·FR-SB-5.5(관리자 가이드 장문)의 확장/재정의'
---

# 가이드 커리큘럼 & 이미지 3-모드 (Epic 13 설계)

> **왜 이 문서가 있나**: Epic 11(시딩 봇) 착수 이후, 관리자 봇의 "가이드 글"을
> **강의 커리큘럼 시리즈**로 개편하고, 봇 글의 **이미지 조달을 3가지 모드**로 나누며,
> 커리큘럼 글은 **사람이 검수·이미지 준비 후 예약 게시**하는 스테이징 워크플로우로 바꾸기로
> 했다(2026-07-03 사용자와 설계 확정). 이 변화는 Epic 11 원안(PRD FR-SB-4·5.5)과 상당히
> 달라서, 코드를 뜯지 않고도 파악할 수 있게 이 문서로 남긴다.
>
> **현재 상태**: 커리큘럼 엔진의 **일부는 이미 프로토타입으로 구현·검증**됐고(§10),
> 나머지(관리자 UI·DB 테이블·스테이징·스케줄·사후 플래너)는 **Epic 13 스토리로 개발 예정**이다.
> 본문 식별자엔 한국어 뜻을 괄호로 병기한다(전역 규칙).

---

## 1. 봇 글 이미지 3-모드 (핵심 결정)

봇이 쓰는 글은 성격에 따라 이미지 조달 방식이 다르다. **택일이 아니라 상황별 라우팅**이다.

| 모드 | 대상 | 이미지 결정 시점 | 사람 개입 |
|---|---|---|---|
| **A. 사전 준비 (커리큘럼)** | 관리자 가이드 강의 시리즈(가이드 게시판) | 커리큘럼을 짤 때 **미리** 어떤 이미지가 필요한지 정하고, 사람이 준비 | ✅ 있음 (관리자 커리큘럼 플랜) |
| **B. 사후 콘텐츠 기반 (일반 글)** | 봇의 일반 정보·잡담 글 | **글을 쓴 뒤** 완성된 내용을 보고 필요한 자리에 이미지 생성/삽입 | ❌ 없음 (자율) |
| **C. 미디어 우선 (퍼오기)** | 밈·짤·유튜브 등 외부 창작물 소개 | **미디어를 먼저 확보**하고 그 미디어에 맞춰 소개글 작성 | ❌ 없음 (자율) |

- **A(커리큘럼)만 스테이징 트랙**(사람이 큐레이션). B·C는 봇이 실시간 자율 게시.
- **C(미디어 우선)는 이미 구현돼 있다** — `apps/api/src/services/bot/curation.ts`의 `decideCurationMode`(퍼오기 방식 결정)가 유튜브 영상/밈을 먼저 검색해 확보하고, `buildCurationUserPrompt`(소개글 프롬프트)가 그 소재 소개글만 쓴다. Epic 13에서는 이 모드의 **적용 범위(어느 게시판/상황에서 켤지)만 넓힌다.**
- **B(사후 플래너)는 신규**. 지금 일반 글은 상단 1장(스톡/웹/AI)만 붙는데, 이를 "글 내용을 읽고 필요한 자리에 여러 장(주로 AI 도식)"으로 업그레이드한다.

---

## 2. 커리큘럼 강의 시리즈 — 스테이징 워크플로우

공식 강의는 순서·정확도·이미지가 중요해 **생성과 게시를 분리**하고 사람이 중간 검수한다.

```
① 플랜 수립      커리큘럼(시리즈·챕터·학습목표·이미지 슬롯)을 정의
      ↓
② 초안 생성      봇이 각 챕터 본문을 생성해 스테이징(게시 아님). 본문에 [[IMG:키]] 마커 포함
      ↓
③ 이미지 채움    각 이미지 슬롯을 준비(자동 도식/캡처/사람 업로드) → 슬롯 '완료'
      ↓
④ 준비완료 판정  한 챕터의 모든 이미지 슬롯이 채워지면 그 챕터 = ready
      ↓
⑤ 예약           챕터별 게시 날짜·시간 지정(기본 하루 1편 자동 배정, 개별 수정 가능)
      ↓
⑥ 스케줄 게시    예약시각 도달 + ready인 챕터만 실제 게시판에 발행(이미지는 마커 자리에 인라인 삽입)
```

- **초안 텍스트도 관리자에서 수정 가능**(사람이 문장을 다듬음).
- **연속성**: N편은 앞 편들의 실제 요약을 프롬프트에 받아 이어쓰고 중복하지 않는다.
- **완결**: 마지막 편까지 게시되면 시리즈 종료.

두 시리즈(최초):
- **제로부터 바이브코딩** (게시판 `vibe-coding-guide`, 도구 Claude Code) — 1~5강.
- **반복업무 자동화 실전** (게시판 `automation-guide`, 도구 Make) — 1~5강.

---

## 3. 이미지 슬롯 3(+1) 분류 — 누가·어떻게 만드나

각 이미지 슬롯은 **출처 종류(source_kind)**를 갖고, 관리자 화면에서 색 배지로 구분한다.

| 배지 | source_kind | 뜻 | 준비 방법 |
|---|---|---|---|
| 🟢 자동 | `ai_diagram` | AI 도식(Gemini 생성) | Claude가 **아무 때나 자동 생성**, 사람 개입 0 |
| 🟢 자동 | `web_download` | 공식문서 등의 실제 이미지 | Claude가 공개 URL에서 **자동 다운로드**(출처 표기) |
| 🟡 세팅필요 | `capture` | 실제 화면 캡처(터미널·데스크톱 앱·로그인 웹) | Claude가 찍지만 **사람이 컴퓨터 켜고 앱 세팅/로그인** 해줘야 함 → "지시하면 그때 생성" |
| 🔵 업로드 | `user_upload` | 사람이 직접 만든 이미지 | 사람이 만들어 **업로드 버튼**으로 첨부 |

- 사용자 방침(2026-07-03): **미리 만들지 말고, 지시가 있을 때 생성**한다. 🟡(캡처)는 사람이 환경을 준비해야 찍히기 때문. 🟢(도식)도 부담은 없지만 동일하게 "지시 시 생성"으로 통일 가능.
- 슬롯 상태(status): `pending`(대기) → `ready`(이미지 채워짐).
- 각 슬롯엔 **상세 안내문(guidance)**이 붙는다: "어떤 이미지를 만들어야 하는지" 사람이 읽고 판단할 수 있게(캡션·도식 프롬프트에서 자동 생성).

---

## 4. 데이터 모델 (Epic 13 신설 — 프로토타입은 파일+jsonb였음)

> 프로토타입(§10)은 커리큘럼을 코드 파일(`curriculum.ts`)+`bot_settings` jsonb로 들고 있다.
> 관리자 CRUD·슬롯별 업로드·상태 관리를 위해 **정식 테이블로 승격**한다.
> `curriculum.ts`는 이 테이블을 **처음 채우는 시드**로 재활용한다.

**`bot_curriculum_series`** — 시리즈 헤더
- `id` uuid PK · `title` (표시·식별) · `board`(대상 게시판 슬러그) · `tool`(주력 도구명) · `intro`(한 줄 소개) · `is_active` · `created_at`

**`bot_curriculum_chapters`** — 챕터(=편)
- `id` uuid PK · `series_id` FK · `order_index`(1-based) · `title` · `goal`(학습목표) · `outline` jsonb(소주제 배열)
- `draft_content` jsonb(Tiptap, 생성 전 null) · `draft_text_editable`(사람 수정 반영)
- `status` enum: `planned` → `drafted` → `ready` → `published` (+ `skipped`)
- `scheduled_at` timestamptz(챕터별 예약 게시 시각, null이면 미예약)
- `published_post_id` uuid(게시 결과 참조, 크로스도메인 FK 미설정) · `created_at` · `updated_at`

**`bot_curriculum_image_slots`** — 챕터의 이미지 자리
- `id` uuid PK · `chapter_id` FK · `asset_key`(본문 `[[IMG:키]]` 매칭용, 챕터 내 유일)
- `caption`(본문 캡션) · `alt` · `guidance`(사람용 상세 안내) · `position_hint`(대략 어느 설명 옆)
- `source_kind` enum: `ai_diagram | web_download | capture | user_upload`
- `status` enum: `pending | ready`
- `image_url`(버킷 업로드 결과, 준비 전 null) · `diagram_prompt`(ai_diagram용) · `source_url`(web_download/capture 원본) · `created_at` · `updated_at`

> **준비완료 판정**: 챕터의 모든 슬롯 status=ready → 챕터 status=ready 승격(스케줄 게시 대상).

---

## 5. 관리자 "커리큘럼 플랜" UI (`apps/admin`)

봇 하위 메뉴에 **커리큘럼 플랜** 추가. 리스트=상세페이지 규약(메모리 규칙) 준수.

- **목록**: 시리즈·챕터를 게시판처럼 나열. 챕터마다 상태(`초안/준비/게시`)·"이미지 3/4 완료"·예약시각 표시.
- **챕터 상세**:
  - 상단: 챕터 제목·학습목표. **초안 본문(편집 가능)**.
  - 이미지 슬롯 목록: 각 슬롯의 🟢🟡🔵 배지 · 상세 안내문 · 현재 이미지 미리보기 · **업로드 버튼**(🔵/교체) · **완료 처리**(생성/캡처된 이미지 확정) · (🟢은 "지금 생성" 버튼).
  - **최종 미리보기**: 이미지가 마커 자리에 실제로 끼워진 **완성 글 모습**을 그대로 렌더(배포 전 확인).
  - **예약시각 지정**: datetime 피커(챕터별 날짜·시간).
- API: `/api/v1/admin/bots/curriculum/*` (`adminGuard`+`requireSuperAdmin`).

---

## 6. 스케줄러 (기본 하루 1편 · 챕터별 예약시각)

- **기본 하루 1편**: 플랜 생성 시 1편·2편·3편…에 **하루 간격 예약시각을 자동 배정**(사람이 개별 수정).
- **게시 조건**: `scheduled_at <= now` **그리고** 챕터 status=`ready`(이미지 다 채워짐)일 때만 실제 게시.
- **미완 안전장치**: 예약시각이 됐는데 이미지가 아직 안 채워졌으면 **게시하지 않고 대기 + 관리자에 표시**(반쪽짜리 글 방지).
- 구현: 기존 봇 크론(`bot` 큐 + `job.name` 디스패처) 위에 `bot.curriculum-publish` job 추가(주기적으로 게시 대상 스캔).

---

## 7. 사후 이미지 플래너 (일반 글, 모드 B — 신규)

일반 봇 글에 대해, **생성된 본문을 읽고** 어떤 도식이 어디에 필요한지 판단해 삽입한다.

```
일반 글 생성(본문 완성)
   → 이미지 플래너: 본문 분석 → "이 글엔 도식 N개가 여기·여기 필요" 판단(0개도 가능)
   → 각 자리에 AI 도식 생성(정확한 라벨 프롬프트) / 필요 시 스톡·웹 이미지
   → insertInlineImagesByMarker(같은 재활용) 또는 위치 삽입으로 본문에 인라인
```

- 실제 스크린샷은 즉석 생성 불가(§9) → 도식 위주. 실제 화면이 꼭 필요하면 라이브러리 매칭.
- 개수·위치가 **글마다 자동으로 달라진다**(고정 슬롯 없음).

---

## 8. 스크린샷/이미지 조달 수단 — 크롬 확장은 필수 아님

과거 세션에서 "크롬 확장(claude-in-chrome) 미연결이라 스크린샷 불가"로 정리했으나, **그건 한 도구일 뿐**이다. 실제 조달 경로:

| 수단 | 무엇을 찍나 | 제약 |
|---|---|---|
| **AI 도식(Gemini `genImage`)** | 개념·흐름·구조·표 | 실제 UI 스샷은 못 만듦. **한국어 라벨을 프롬프트에 정확히 quote**로 박아야 안 깨짐(§10 함정) |
| **공식문서 이미지 다운(`curl`)** | 공식문서에 이미 실린 실제 캡처 | 문서에 이미지가 있어야(예: Make help는 있음, Claude Code docs는 스샷 전무) |
| **Playwright(프로젝트에 설치됨)** | 아무 **웹페이지**의 실제 화면 | 로그인 벽(예: Make 편집기)은 자격증명 필요 → 제한. 텍스트 위주 문서 페이지는 무의미 |
| **PowerShell 화면 캡처** | 로컬 **터미널·데스크톱 앱**(예: `claude` CLI 실행 화면, 에디터의 설정 파일) | 사람이 앱 설치·로그인·정돈 후 진행. 개입적(실화면 이동) |

- 즉 실제 스크린샷이 "아예 불가"가 아니라 **부분적으로 가능**하며, 비현실적인 곳에만 AI 도식으로 대체한다. → 슬롯 `source_kind`가 이 선택을 인코딩한다.
- 봇 발행은 서버(3.38.65.203)에서 도므로, 준비된 이미지는 **버킷에 1회 올려두면 재사용**(로컬 PC 꺼져도 무관). 캡처(🟡)만 준비 시점에 로컬이 필요.

---

## 9. 배포 전략 — 마이그레이션 회피

스테이징 초안+이미지는 DB·버킷에 쌓인다. "로컬 준비 → 서버로 데이터 이사"는 번거롭다.
→ **처음부터 게시할 환경(운영 prod 관리자 패널)에서 준비**한다(관리자 전용이라 안전). 데이터가 이미 prod에 있고, 스케줄러가 상태만 `published`로 바꾸면 끝. 로컬 캡처 이미지는 admin 업로드 버튼으로 prod 버킷에 바로 올라간다. (실험은 dev에서 먼저.)

---

## 10. 현재 구현 상태 (2026-07-03 프로토타입 — Epic 13 이전)

> ⚠️ 아래는 이미 코드에 **존재하고 dev에서 검증된** 프로토타입이다. Epic 13은 이 위에
> "스테이징 분리 + 관리자 UI + DB 테이블 + 스케줄 + 사후 플래너"를 얹어 정식화한다.
> **현재 프로토타입은 생성과 게시가 한 번에 일어난다**(스크립트로 즉시 발행). 스테이징 아님.

**이미 구현됨**:
- `apps/api/src/services/bot/curriculum.ts` — 두 시리즈 × 5강(챕터·학습목표·소주제·이미지 슬롯). **현재 커리큘럼의 원본**(→ Epic 13에서 DB 시드로).
- `apps/api/src/services/bot/post-pipeline.ts` **Step 2.6 가이드 분기**: `getGuideSeriesForBoard`로 감지 → `discoverTopic`(검색발굴) 건너뜀 → 다음 미발행 챕터 선택 → 앞편 요약 연속성 → `bot_settings.guide_progress`(발행편·요약) 저장 → 완결 시 skip.
- `packages/bot-core` `buildGuideChapterUserPrompt` — 강의 편 프롬프트(마커·이전편·상투구 금지).
- `packages/server-bot/src/image/tiptap.ts` **`insertInlineImagesByMarker`** — 본문 `[[IMG:키]]`(문단 끝/중간 포함)를 매니페스트 이미지+캡션으로 분할 삽입, 같은 키 1회만. 단위테스트 10개.
- `apps/api/src/services/bot/censor.ts` **`allowDidacticTone`** — 가이드 편은 `ai_tone`·`duplicate` 축의 오탐 fail을 pass로 완화(safety·factuality·persona·context는 유지).
- `bot_settings` jsonb 저장: `guide_asset_manifest`(assetKey→url·캡션·출처), `guide_progress`(시리즈별 published[]·summaries).
- 운영/검증 스크립트(`apps/api/src/scripts/`): `build-guide-assets.ts`(스샷 다운+Gemini 도식 생성→버킷→매니페스트, `FORCE=1`/`ONLY=키,키`), `publish-guide-chapter.ts`(관리자봇으로 다음편 발행, `BOARDS=`), `set-admin-censor-openai.ts`, `reset-guide-demo.ts`, `verify-series.ts`.

**검증 결과(dev)**: 두 시리즈 1~5강 전편 발행 성공. 편당 이미지 정확히 1개(내용 옆 인라인+캡션), 썸네일 자동, 연속성(`published=[1..5]`), 완결 스킵 동작. Gemini 도식 품질 양호(파일트리·플로우·표 한국어 라벨 정확).

**구현 중 잡은 함정(재발 방지)**:
- 관리자봇 `AI작당지기` 검열모델이 `google/gemini-2.5-pro`였는데 **크레딧 소진**으로 검열 실패→held. **`openai/gpt-4o-mini`로 전환함**(DB config 실제 변경). 생성모델 `openai/gpt-4o`는 정상. (→ [[credit-exhaustion-telegram-alert]] 알림도 별도 있음)
- 약한 검열모델(gpt-4o-mini)이 **실제 없는 상투어("이번 편에서는"·"안내드립니다")를 지어내 `ai_tone`·`duplicate` 오탐 fail**→discarded. 실제 draft엔 없음(확인). → `allowDidacticTone`로 해결.
- 모델이 `[[IMG]]` 마커를 **단독 줄이 아니라 문단 끝**에 붙임 → 초기 삽입 로직이 마커만 제거하고 이미지 누락. `insertInlineImagesByMarker`를 마커 기준 분할 삽입으로 재작성해 해결.
- Gemini 도식은 프롬프트에 **정확한 한국어 라벨을 quote로 박고 은유(broom 등)를 빼야** 안 깨짐. 안 그러면 영어 라벨/글자 깨짐/은유 오해(broom→방청소 체크리스트).

---

## 11. 관련 파일 인덱스

| 영역 | 파일 |
|---|---|
| 커리큘럼 원본 | `apps/api/src/services/bot/curriculum.ts` |
| 가이드 파이프라인 분기 | `apps/api/src/services/bot/post-pipeline.ts` (Step 2.6, finalContentJson 가이드 분기) |
| 강의 편 프롬프트 | `packages/bot-core/src/prompt-builder.ts` (`buildGuideChapterUserPrompt`) |
| 마커 인라인 삽입 | `packages/server-bot/src/image/tiptap.ts` (`insertInlineImagesByMarker`) |
| 검열 완화 | `apps/api/src/services/bot/censor.ts` (`allowDidacticTone`) |
| 큐레이션(미디어 우선) | `apps/api/src/services/bot/curation.ts` |
| 에셋 조달 | `apps/api/src/scripts/build-guide-assets.ts` |
| 발행/검증 스크립트 | `apps/api/src/scripts/{publish-guide-chapter,verify-series,reset-guide-demo,set-admin-censor-openai}.ts` |

> 개발 스토리는 [EPICS-AND-STORIES.md](./EPICS-AND-STORIES.md) **Epic 13** 참조.
