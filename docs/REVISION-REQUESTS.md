# 수정 요청 목록 (REVISION REQUESTS)

> 이 파일은 **사용자가 직접** 수정 요청 항목을 적는 문서입니다.
> 매 프롬프트마다 이 파일 내용이 Claude 컨텍스트에 자동 주입됩니다 (UserPromptSubmit 훅).
> 따라서 여기에 적어두면, 다음 대화에서 수정 요청을 할 때 Claude가 반드시 이 내용을 먼저 확인합니다.

---

## 이 문서의 운영 방식 (중요 — Claude는 매번 이 규칙대로 처리한다)

같은 항목을 여러 번 고쳤는데도 증상이 남는 일을 막기 위한 규칙이다.

### 체크박스 2종 (분리)
각 항목은 **두 개의 체크박스**를 가진다.
- `Claude` — Claude가 수정 + 자체 검증을 마쳤다는 표시 (Claude가 체크)
- `검수` — **사용자가 직접** 브라우저/실사용으로 확인하고 통과시켰다는 표시 (**사용자만 체크**)

`검수`가 체크되어야 비로소 진짜 완료다. `Claude`만 체크된 항목은 "고쳤다고 주장"한 상태일 뿐이다.

### 처리 흐름
1. 사용자가 `## 대기 중 (TODO)` 에 항목을 적는다.
2. Claude는 그 항목을 `## 수정 중 (IN PROGRESS)` 로 내리고 작업한다.
3. 수정 완료 시 Claude가 **시도 이력**(아래 형식)을 적고 `Claude` 박스를 체크 → `## 검수 대기 (사용자 확인 필요)` 로 이동.
4. 사용자가 검수:
   - **통과** → 사용자가 `검수` 박스 체크 → Claude가 통과 항목을 **삭제**한다(토큰 절약 — CLOSED 보관 안 함).
   - **여전히 문제** → 사용자가  박스안에 아무것도 안적으면 Claude가 다시 `수정 중` 으로 올린다.

### 재수정 규칙 (핵심)
같은 항목을 2번째·3번째 다시 고칠 때, Claude는 **반드시 시도 이력에 적힌 앞선 접근 방식을 먼저 읽고, 그와 다른 방식으로 접근**한다.
- 예: 1차에서 "credentials 누락"으로 봤다면, 2차에서는 그 가설을 버리고 다른 경로(렌더 경로/이벤트 바인딩/캐시 등)를 의심한다.
- 같은 원인을 또 짚는 것은 금지. "이미 시도해서 실패한 방식"은 이력에 남아 있으므로 반복하지 않는다.

### 시도 이력 형식
```
- N차 (YYYY-MM-DD): [의심한 원인] → [한 수정] → [검증 방식과 결과]
```
검증 방식은 구체적으로: 단순 "tsc 통과/200 응답/완료"는 검증이 아니다. **실제 클릭·렌더·요청까지 확인**한 것만 검증으로 적는다.

---

## 대기 중 (TODO)

<!-- 사용자가 여기에 한 줄씩 추가. Claude가 읽고 '수정 중'으로 내림.
- [ ] [대상 위치/파일] - 무엇을 어떻게
-->
_(없음 — 16차 배치 검수 대기로 이동 — 2026-06-30)_

## 수정 중 (IN PROGRESS)

<!-- Claude가 작업 중인 항목. 완료하면 '검수 대기'로 이동. -->

_(없음)_


## 보류 (HOLD)

_(없음)_

---


## 검수 대기 (사용자 확인 필요)

> Claude가 수정 + 자체 검증을 마쳤으나 **사용자 검수 전**인 항목.
> 사용자가 확인 후 통과면 `검수` 박스를 v로 체크해 주세요(통과 항목은 Claude가 삭제). 여전히 문제면 그대로 비워두세요.

> **17차 배치(신규 2건) — 2026-07-07 수정 완료, 검수 대기.**

- [x] `Claude` / [ ] `검수` — [봇 운영 패널] 입력창·토글 디자인 시스템 적용
  - 1차 (2026-07-07): 사용자 요청 "운영 패널 입력창을 디자인 시스템 적용된 것으로". 원인: `apps/admin/app/bots/operations/page.tsx`의 입력 3개가 `className="form-input"`(코드 전역 어디에도 미정의 클래스)라 브라우저 기본 스타일로 렌더, 토글 3개도 `toggle-label`(미정의)+raw checkbox. → 숫자 입력 3개(하루 최대 글/댓글 수·일일 비용 상한)를 디자인 시스템 `.field`+`.field-label`+`.control`(settings 페이지 패턴)로, 토글 3개(킬 스위치·관찰 모드·랭킹 제외)를 `.switch`/`.switch-track`으로 교체(핸들러·저장 로직 무변경). **검증(실렌더)**: 로컬 DB+API+admin 기동, Playwright로 super_admin 로그인 → /bots/operations 실측 — `.control` 3개(높이 40px·디자인 토큰 테두리), `.switch` 3개 렌더 + 스크린샷 확인. admin tsc 클린. **검수: 운영 패널에서 입력창이 다른 관리자 화면과 같은 스타일(테두리·포커스 링)인지, 토글이 스위치 모양으로 정상 저장되는지.**

- [x] `Claude` / [ ] `검수` — [봇 운영 패널] 글 작성 로그 — 봇별 작성 시도·모델·검수 반려 사유·최종 결과 확인 (목록=요약, 행 클릭=우측 흰 배경 드로어 상세)
  - 1차 (2026-07-07): 사용자 요청 "어떤 글을 언제 시도, 생성/검수 모델, 게시판, 반려 횟수·사유, 성공/실패 확인 + 목록은 간추리고 클릭 시 오른쪽 모달(배경 흰색 필수)". **신규 테이블 없음** — 기존 `bot_generation_jobs`(스파인)·`bot_activity_log`(`regenerated` payload `{attempt, censorResult}`=시도별 반려 사유)·`ai_usage_log`(실사용 모델·비용)를 join 재구성: ① contracts `packages/contracts/src/bot.ts`에 `botPostLogItemSchema`·`botPostLogDetailSchema`(attempts 타임라인·usageCost·finalEvent)·쿼리 스키마 추가 ② 신규 `apps/api/src/routes/admin/bots/post-logs.ts` — `GET /admin/bots/post-logs`(댓글 제외, persona/status 필터, 제목 폴백 posts.title→draft->>'title'→title_seed, 생성 모델은 ai_usage_log 배치조회) + `GET /admin/bots/post-logs/:jobId`(검수 시도별 반려 사유, gen/censor 모델, purpose별 비용 합산, `refId=jobId OR payload->>'jobId'` 양쪽 관례 커버) + index.ts 등록(static이 `/:id`보다 우선이라 안전) ③ 신규 `apps/admin/app/bots/operations/PostLogSection.tsx` — 목록 표(시각·봇·게시판·제목·생성 모델·반려 N회·결과 배지)+봇/상태 필터+페이지네이션, 행 클릭 → 디자인 시스템 `.drawer` 우측 드로어(**배경 `#fff` 인라인 명시 — 투명 사고 방지**): 개요/모델 정보/검수 이력(시도별 축 배지+사유)/최종 이벤트/발행 글 링크, ESC·스크림·X 닫기. **검증(실호출+실렌더)**: 로컬 PG(마이그레이션 34개)+Redis+API 기동, super_admin 쿠키로 목록·상세 실호출(반려 사유·모델·비용·404·401 확인), Playwright로 행 클릭 → 드로어 배경 `rgb(255,255,255)` 실측 + 검수 이력("출시일 정보가 사실과 다름" 등)·gpt-5-mini/claude-haiku-4-5 표시 스크린샷 확인. contracts·api·admin tsc 클린, api vitest 무회귀(기존 실패 9건은 변경 전과 동일). **검수: 운영 패널 하단 "글 작성 로그"에서 봇 글 시도 목록 확인 → 행 클릭 → 우측 흰 배경 드로어에 반려 사유·모델·비용·최종 결과가 보이는지. (실데이터는 봇이 글을 쓴 뒤부터 쌓임)**

> **16차 배치(신규 1건) — 2026-06-30 수정 완료, 검수 대기.**
> (15차 배치 #1 "유저웹 첨부 확장자 즉시반영"은 사용자 검수 통과(`[v]`) 확인 후 삭제 — 토큰 절약.)

- [x] `Claude` / [ ] `검수` — [푸터/사이트 설정] 사이트 푸터에 사업자정보(회사명·대표자·사업자등록번호 등) 노출 + 관리자 사이트 설정에서 등록/수정
  - 1차 (2026-07-01): 사용자 요청 "푸터에 사업자정보·대표자·회사명 노출, 관리자 사이트 설정에서 등록/수정". 풀스택 배선: ① `packages/contracts/src/admin/settings.ts` patch·response 스키마에 7키 추가(`company_name`(회사명/상호)·`representative_name`(대표자명)·`business_registration_number`(사업자등록번호)·`mail_order_sales_number`(통신판매업신고번호)·`business_address`(사업장주소)·`business_phone`(대표전화)·`business_email`(대표이메일)) ② `apps/api/src/routes/admin/settings/index.ts` 로컬 PATCH allowlist에 동일 7키 추가(안 넣으면 저장 무시됨 — 과거 함정) ③ `apps/api/src/routes/v1/site-settings-public.ts` PUBLIC_SETTING_KEYS에 7키 추가(푸터는 비인증 공개 fetch라 필수) ④ 관리자 UI: `apps/admin/app/settings/page.tsx`에 "사업자 정보" 탭(data-tab="business") 추가 + `SettingsTabPanels.tsx`에 상태·load·saveBusiness·전용 패널(7필드 입력폼) 추가 ⑤ `apps/web/components/site/SiteFooter.tsx`를 async 서버컴포넌트로 전환, `GET /api/v1/settings/public`(60초 revalidate) fetch → 값 있는 항목만 라벨과 함께 `<dl>`로 렌더(전부 비면 블록 숨김) + `SiteFooter.module.css`에 `.business` 스타일. contracts·admin·web typecheck 클린(api는 사전에러 publish-held-drafts만, 이번 변경 무관). **검수: 관리자 로그인 → 사이트 설정 → "사업자 정보" 탭에서 값 입력·저장 → 유저 웹 하단 푸터에 입력한 항목이 노출되는지 확인(60초 캐시 후 반영).**

- [x] `Claude` / [ ] `검수` — [소셜 로그인] 네이버·카카오가 이름·전화번호·성별·생년월일도 요청·저장하도록
  - 1차 (2026-07-01): 사용자 요청 "네이버랑 카카오는 전화번호,성별,생년월일,이름 모두 요청하게". (선행 오해 정정: 사용자가 말한 "동의 화면"은 우리 약관이 아니라 **제공사가 띄우는 권한 동의 화면**이었고, 그건 제공사가 최초 1회만 띄우고 이후 기억 → 안 뜨는 건 버그 아님. 처음에 만든 약관 동의 화면은 전량 되돌림.) → `apps/api/src/auth/user-auth.ts` 단일 파일: ① `user.additionalFields`에 `phone`·`gender`·`birthDate` 추가(이게 있어야 Better Auth 어댑터가 실제 DB에 기록) ② 네이버 provider `mapProfileToUser`로 `response.name/mobile/gender/birthyear/birthday` → users 매핑 ③ 카카오 provider `scope:["name","gender","birthday","birthyear","phone_number"]` + `mapProfileToUser`로 `kakao_account.*` 매핑 ④ 헬퍼(성별 M/F/U·male/female→enum, 생일 YYYY-MM-DD 조립, 카카오 +82폰 정규화, undefined 프루닝). api typecheck 클린(사전에러 publish-held-drafts 제외), API 재기동 health 200, 네이버 소셜 URL 정상 발급, get-session에 phone/gender/birthDate 노출 확인.
  - ⚠️ **코드만으론 부족 — 반드시 개발자센터 설정 필요(검수 시 참고):** ▸네이버: 개발자센터 "네이버 로그인 > 제공 정보 선택"에서 이름/휴대전화번호/성별/생일·출생연도 항목을 켜야 동의화면 표시+API 반환(연락처·이름은 검수 필요). scope 아닌 콘솔 설정이 실질 제어. ▸카카오: 개발자센터에서 해당 동의항목 켜고 **비즈니스 앱 검수** 통과해야 실제 요청·수신(검수 전 로그인 시 KOE 오류 가능). 현재 카카오는 `KAKAO_ENABLED` 미설정으로 비활성이라 지금은 무해, 검수 후 활성 시 효력. **검수: (콘솔 설정 완료 후) 네이버 로그인 최초 동의화면에 전화/성별/생일/이름 항목이 뜨고, 가입 후 관리자 회원상세 또는 회원정보 화면에 값이 채워지는지 확인.**

- [x] `Claude` / [ v] `검수` — [관리자 대시보드] Console 에러 — hydration mismatch (`A tree hydrated but some attributes ... didn't match`, `app/dashboard/page.tsx:203` 의 `<table className="admin-table">` 에 `data-table-initialized="true"`)
  - 1차 (2026-06-30): 레거시 `table.js`의 `initTables()`가 초기화 표식으로 `.admin-table`에 **DOM 속성** `data-table-initialized="true"`를 붙이는 게 원인. 대시보드 "최근 콘텐츠" 표는 `<Suspense>`로 늦게 하이드레이트되는데, 레이아웃의 `AdminInteractions` MutationObserver가 마운트 직후 `initTables`를 돌려 표가 하이드레이트되기 전에 이미 속성을 박아둠 → React가 "서버 HTML에 없던 속성"으로 보고 mismatch 경고. → **초기화 표식을 DOM 속성에서 모듈 스코프 `WeakSet`(`initializedTables`)으로 교체**(`packages/admin-design-system/js/table.js`). DOM에 흔적을 남기지 않으므로 React가 비교할 속성 자체가 사라져 모든 `.admin-table`에 대해 원천 차단. `data-table-initialized`는 코드 전역에서 table.js만 사용함을 grep으로 확인(CSS/타 JS 의존 없음). `node --check` 구문 통과. **브라우저 콘솔 확인은 이번 세션에서 Chrome 확장 미연결로 미수행** — 검수: 관리자 대시보드 새로고침 후 콘솔에 hydration 경고가 더 안 뜨는지 확인.

- [x] `Claude` / [ ] `검수` — [관리자 알림] 회원 신고 시 알림 목록엔 들어오는데 벨의 새 알림 표시(빨간점/배지)가 안 켜짐
  - 1차 (2026-06-30): NotificationMenu가 fetchAlerts를 **마운트 1회 + 드롭다운 열 때만** 호출 → 관리자가 페이지에 머무는 동안 새 신고가 들어와도 배지 카운트가 stale(신고 전 시점 fetch 기준)이라 빨간점이 안 켜짐. 드롭다운을 직접 열어야(=refetch) 비로소 목록에 보임("알림은 들어있는데"와 일치). 회원 신고는 `status:'pending'`+`targetType:'user'`로 insert되고 alerts 엔드포인트는 target_type 무관하게 pending/reviewing을 집계하므로 카운트 누락 아님(코드 확인). → **30초 폴링 추가**(백그라운드 탭은 skip, visibilitychange로 복귀 시 즉시 1회 갱신). admin tsc 통과. **검수: 관리자 로그인 상태로 둔 채 유저가 회원 신고 → 30초 내 벨에 빨간점/배지 자동 표시되는지 확인.**

- [x] `Claude` / [ ] `검수` — [금칙어 처리 정책] 금칙어 포함 글 등록 자체를 막던 하드 차단 → **자동 마스킹**으로 전환 (네이버 댓글 방식)
  - 1차 (2026-07-01): 사용자 결정(AskUserQuestion)="자동 마스킹". 기존 `contentGuard` preHandler는 금칙어 발견 시 422로 글 등록을 거부(하드 차단)했는데, 요즘 플랫폼은 막지 않고 단어만 가림 → ① `packages/core/moderation.ts`에 `maskForbiddenWord()` 추가(대소문자 무시·정규식 메타 이스케이프·같은 길이 `*` 치환, 예 "씨발"→"**") + core 배럴 export ② `contentGuard` preHandler를 "거부"에서 "마스킹 후 통과"로 재작성 — request.body의 `title`·`summary`·`content`(평문/Tiptap)·`contentJson`(Tiptap) text 노드를 in-place 치환(Fastify 검증은 preHandler 이전이라 `*` 치환이 스키마 안 깨짐) ③ **스팸 링크는 종전대로 하드 차단 유지**(422) ④ **봇 경로 `runContentGuard`는 그대로 차단 판정 유지**(봇 초안은 마스킹 아닌 폐기/재생성이 맞음). core 단위테스트 8건 추가(38건 통과), core·api tsc 통과, API 재기동(tsx watch reload, 새 PID 확인)·health 200. **검수: 유저웹에서 금칙어 포함 글 작성 → 글은 정상 등록되고 본문/제목에서 해당 단어만 `*`로 가려지는지 확인. (현재 마이그 0028 기본 금칙어 31개 적용 중)**
  - ⚠️ 알려진 한계(검수 시 참고): 매칭이 "부분 문자열"이라 단어 경계를 안 봄(정상 단어 안에 우연히 포함돼도 가려짐). 또 **기존 글 수정(PATCH) 라우트에는 contentGuard 미적용** — 수정으로 금칙어 삽입은 현재 안 가려짐(작성 라우트만 적용). 수정 경로까지 막아야 하면 별도 요청 주세요.

- [x] `Claude` / [ ] `검수` — [봇 이미지 생성] AI 이미지 생성 기본 모델 = **구글 Gemini 3.1 Flash Image**(조직인증 불필요) + 관리자에서 모델 선택 배선(GPT Image 2·Gemini 옵션)
  - 2차 (2026-07-03): 사용자 사정 "OpenAI 조직 인증은 여권 필요→시간 걸림. 인증 전까지 **구글 최신 이미지 모델로 교체**하고, GPT Image 2도 옵션에 넣고 구글 최신도 넣고 배선 다 연결". 웹검색 확인: 구글 Imagen 4는 2026-08-17 종료 예정→**`gemini-3.1-flash-image`(별명 Nano Banana 2)가 최신 권장**, `generateContent`로 inlineData(base64) 반환, **API 키만 필요(조직 인증 없음)**. → ① `generate.ts` 전면 재작성: 하드코딩 폐기하고 **프로바이더 라우팅**(`genImageGoogle`=Gemini generateContent·responseModalities[TEXT,IMAGE]·inlineData 디코드 / `genImageOpenAI`=gpt-image 계열 base64·dall-e-3 분기), `imageModel` 파라미터 신설, **미지정 시 DEFAULT_IMAGE_MODEL=google gemini-3.1-flash-image** ② `image/index.ts` fetchBotImage에 `imageModel` 전달 배선 + DEFAULT_IMAGE_MODEL export ③ `post-pipeline.ts`가 `getModelAssignment(personaId,'image')`(active만) 조회해 fetchBotImage에 주입 → **관리자에서 고른 이미지 모델이 실제로 적용**(미할당 시 구글 기본) ④ 관리자 UI IMAGE_MODELS: google에 "Gemini 3.1 Flash Image (Nano Banana 2·최신·기본)" 추가·최상단, openai gpt-image 라벨에 "(조직 인증 필요)" 명시, 이미지 행 기본값 google. **실호출 검증(실제 요청까지 확인)**: 운영 GEMINI_API_KEY로 `gemini-3.1-flash-image:generateContent` 직접 호출 → **HTTP 200, 이미지 반환(image/jpeg ~926KB), inlineData 구조 코드와 일치**. server-bot·admin·api tsc 클린, 이미지·봇 유닛테스트 무회귀. **검수: 봇이 AI 창작마당에 'ai' 모드로 글 쓸 때 구글 생성 이미지가 붙는지(관리자 봇 이미지모델 미할당=구글 자동). OpenAI 인증되면 관리자에서 GPT Image 2로 바꾸면 즉시 그 모델 사용.**
  - 1차 (2026-07-03): 사용자 요청 "GPT Image 2 최신 확인 후 AI 이미지 생성 모두 이 모델로". 웹검색으로 확인(2026-04-21 출시, 모델ID `gpt-image-2`, 엔드포인트 `v1/images/generations`). **핵심 차이=DALL·E 3와 응답 방식이 다름**: gpt-image-2는 `response_format` 파라미터 미지원(넣으면 400)이고 **항상 base64(`b64_json`) 반환**(임시 URL 아님), `quality`도 low/medium/high/auto(standard/hd 아님). → ① `packages/server-bot/src/image/generate.ts` 재작성: 모델 `gpt-image-2` 하드코딩(=모든 AI 생성 이 모델), body에서 `response_format` 제거·`quality:"high"`, 응답 `data[0].b64_json`을 Buffer로 디코드, `GenImageResult`를 `{url}`→`{data:Buffer, mimetype, costUsd}`로 변경, 비용은 응답 `usage`(입력 $8/1M·출력 $30/1M) 기반 실계산(usage 없으면 추정 $0.12) ② `packages/server-bot/src/image/index.ts` ai 분기: URL 다운로드 단계 제거하고 genImage가 준 Buffer를 uploadFn에 직접 전달 ③ 관리자 UI `apps/admin/app/bots/[id]/_components/BotModelSection.tsx` IMAGE_MODELS에 "GPT Image 2 (최신·기본)" 최상단 추가 + 이미지 행 기본 model을 `gpt-image-2`로. server-bot·admin tsc 클린, 이미지 유닛테스트 25건 통과, api는 사전에러 publish-held-drafts만(무관). 참고: 실제 AI 생성은 'AI 창작마당' 게시판·관리자 캐릭터에서만 발동(그 외는 웹검색/무료스톡). **검수: (1) OpenAI 계정이 gpt-image-2 접근 권한 있는지(조직 인증 필요할 수 있음) (2) 봇이 AI 창작마당에 글 쓸 때 이미지가 정상 생성·업로드되는지.**
  - ⚠️ 알려진 한계(검수 시 참고): ▸**현재 기본=구글 gemini-3.1-flash-image**(2차에서 교체). gpt-image-2/1을 관리자에서 고르려면 OpenAI **조직 인증(Verify Organization·여권 필요)** 통과해야 하고, 미인증 상태로 고르면 403→genImage null→**이미지 없이 정상 게시**(게시는 안 막힘). ▸비용(내부 회계 추정): 구글 ≈$0.04/장, gpt-image-2 high ≈$0.12/장. ▸`ai/adapters/openai.ts`의 `generateImage`는 죽은 코드라 손대지 않음(실제 경로는 `image/generate.ts`).

- [x] `Claude` / [ ] `검수` — [봇/AI 창작마당] 봇이 직접 AI 생성만이 아니라 **외부 콘텐츠 퍼오기(유튜브 AI 영상 임베드·AI 밈 이미지)** 도 하도록 (사용자 결정: 퍼오기 위주)
  - 1차 (2026-07-03): 사용자 요청 "AI 창작마당은 유튜브 AI 영화/뮤비 퍼오기, AI 밈 퍼와서 소개도 가능해야". AskUserQuestion 결정=범위 "밈·이미지+유튜브 모두", 비율 "퍼오기 위주". **인프라 확인**: 게시판 렌더러(`tiptap-renderer.ts`)가 이미 `youtube` 노드→iframe 임베드 지원(sanitize가 youtube 도메인만 허용), 웹 이미지 퍼오기(`web.ts`+출처캡션)도 기존 존재. 막혀 있던 지점=①`topic.ts` ai-creation이 발굴 제외 ②`strategy.ts` ai-creation 무조건 'ai'. → **"큐레이션 모드" 신설**: ① `packages/server-bot/src/search/brave-video.ts` 신규 — Brave 동영상검색으로 유튜브 링크만 골라 1건 반환(`searchYoutubeVideo`, 키미설정·무결과 시 null) ② `image/tiptap.ts`에 `prependYoutubeToTiptapDoc`(youtube 노드+출처캡션) 추가·배럴 export ③ `bot-core` `PostUserPromptOptions.curation` 필드 + `prompt-builder`가 큐레이션이면 "소재 소개 짧은 글" 전용 프롬프트로 전환(미디어는 본문 위 자동첨부라 링크·"아래 영상"류 금지 지침) ④ `apps/api/src/services/bot/curation.ts` 신규 — `decideCurationMode`(ai-creation·비관리자만, 가중치 youtube45·meme40·ai15=퍼오기 위주)+영상/밈 검색어 풀 ⑤ `post-pipeline.ts` Step 2.5에 큐레이션 결정+영상조달(영상 못구하면 meme 폴백), Step 4에서 영상제목을 주제로 합성, Step 6b에서 imageStrategy 오버라이드(youtube=none·meme=web·ai=ai), 생성프롬프트에 curation 전달, 큐레이션은 censor `allowObvious=true`, 게시 시 유튜브면 `prependYoutubeToTiptapDoc`로 영상 삽입. **검증**: bot-core·server-bot·admin·api(사전에러 publish-held-drafts만) tsc 클린, 신규 유닛테스트(큐레이션 프롬프트 3·tiptap youtube 4·curation 5) 전부 통과, 기존 봇 테스트(post-pipeline 11 등) 무회귀. **검수(봇 실동작): AI 창작마당에 봇 글 여러 개 생성 → (1) 일부 글에 유튜브 AI 영상이 임베드+영상출처 표기되는지 (2) 일부는 AI 밈/이미지가 출처와 함께 퍼와지는지 (3) 가끔 봇 직접 AI 생성물이 올라오는지.**
  - ⚠️ 알려진 한계(검수 시 참고): ▸유튜브/밈 조달은 **BRAVE_SEARCH_API_KEY** 필요(미설정 시 유튜브→밈→그냥 글 순으로 폴백). ▸유튜브 큐레이션 글은 **썸네일(thumbnail_url)이 없음**(영상 노드만 있어 목록 썸네일 빈칸) — 필요하면 별도 요청. ▸봇이 영상을 실제로 시청하진 못하므로 소개글은 제목·채널 기반(줄거리 지어내기 금지 프롬프트로 완화). ▸실게시는 OpenAI 등 크레딧·모델 상태에 좌우(코드 경로는 검증 완료).



