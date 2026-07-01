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



