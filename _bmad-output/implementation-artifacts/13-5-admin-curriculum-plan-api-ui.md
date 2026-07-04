# Story 13.5: 관리자 "커리큘럼 플랜" API + UI

Status: done

## Story

As a 슈퍼관리자,
I want 관리자 콘솔 봇 메뉴의 "커리큘럼 플랜" 페이지에서 강의 시리즈의 챕터별 초안 본문·이미지 슬롯·예약 시각을 관리하기,
so that 커리큘럼 글을 게시 전 충분히 검수·이미지 준비 후 원하는 날짜에 자동 게시할 수 있다.

## Acceptance Criteria

> **전제**: Story 13.1(커리큘럼 DB 스키마), 13.2(Zod 계약), 13.3(스테이징 파이프라인), 13.4(슬롯 조달 워크플로우)가 완료된 상태에서 착수한다.

### AC 1: API 엔드포인트 (adminGuard + requireSuperAdmin 전체)

라우트 파일 `apps/api/src/routes/admin/bots/curriculum.ts`를 신규 생성하고, `registerAdminBotsRoutes`에 등록한다. 이중 prefix 방지: 라우트 경로는 `/api/v1/` 없이 `/admin/bots/curriculum/...`로 등록 (`apps/api/src/app.ts`가 `/api/v1` prefix 자동 부여). 모든 라우트에 `preHandler: [requireSuperAdmin]`(슈퍼관리자 전용 가드).

다음 엔드포인트가 존재하고 올바르게 응답해야 한다:

1. `GET /admin/bots/curriculum/series` — 시리즈 목록. 응답: `paginatedCurriculumSeriesSchema`(시리즈 페이지네이션 응답) 형식 `{items, meta}`. 쿼리: `isActive?`·`page`·`pageSize`.
2. `GET /admin/bots/curriculum/series/:seriesId` — 시리즈 상세 + 챕터 요약 목록. 응답: `curriculumSeriesDetailSchema`(시리즈+챕터 상세). 미존재 시 `404 {error:{code:"NOT_FOUND",...}}`.
3. `GET /admin/bots/curriculum/chapters` — 챕터 플랫 목록. 쿼리: `seriesId?`·`status?`·`page`·`pageSize`. 각 항목에 `totalSlots`(슬롯 총 수)·`readySlots`(완료 슬롯 수) 집계 포함. 응답: `paginatedCurriculumChaptersSchema`.
4. `GET /admin/bots/curriculum/chapters/:chapterId` — 챕터 상세 + 이미지 슬롯 목록 전체. 응답: `curriculumChapterDetailSchema`(챕터 상세 + `slots` 배열). 미존재 시 `404`.
5. `PATCH /admin/bots/curriculum/chapters/:chapterId/draft` — 초안 본문 수정. Body: `curriculumChapterDraftUpdateSchema`(초안 본문 수정 스키마, `{draftContent?: unknown, draftTextEditable?: string}`). `draftContent`(Tiptap 초안 jsonb)·`draftTextEditable`(사람 수정 텍스트) 중 하나 이상 필수. 저장 후 챕터 레코드 반환.
6. `PATCH /admin/bots/curriculum/chapters/:chapterId/schedule` — 예약시각 지정. Body: `curriculumChapterScheduleSchema`(예약시각 지정 스키마, `{scheduledAt: string | null}`). `scheduledAt`(챕터별 예약 게시 시각) ISO 문자열 또는 null(예약 해제).
7. `GET /admin/bots/curriculum/chapters/:chapterId/preview` — 최종 미리보기. `insertInlineImagesByMarker`(`packages/server-bot/src/image/tiptap.ts`)를 사용해 `draftContent`의 `[[IMG:키]]`(이미지 마커) 자리에 `ready` 상태 슬롯 이미지를 삽입한 Tiptap JSON을 `tiptap-renderer.ts`(`apps/api/src/lib/tiptap-renderer.ts`)로 HTML 변환 후 `{html: string}` 반환. 미완료 슬롯 자리는 `[이미지 미준비: 키]` 플레이스홀더 표시. `draftContent`가 null이면 `{html: "<p>(초안 없음)</p>"}`.
8. `POST /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload` — 이미지 업로드. 멀티파트 form-data `file` 필드. 기존 `uploadImage()`(`apps/api/src/services/storage/index.ts`)를 `"editor-images"` 버킷으로 호출 → 슬롯 `image_url`(버킷 업로드 결과) 저장 + `status=ready`. 준비완료 판정(챕터 전 슬롯 `ready`이면 챕터 `status=ready`) 자동 실행. 응답: 업데이트된 슬롯 레코드.
9. `POST /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate` — 🟢 자동 생성 요청. Body: `curriculumSlotGenerateSchema`(슬롯 자동 생성 요청). `source_kind`가 `ai_diagram`·`web_download`인 슬롯만 허용(`capture`·`user_upload`는 `400 INVALID_SOURCE_KIND`). Story 13.4의 `fillImageSlot(slotId, { force, imageModel, diagramPrompt })`을 직접 호출하고, 성공 후 준비완료 판정을 실행한다. 응답: `{ ok, imageUrl, outcome, reason? }`.
10. `PATCH /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/complete` — 슬롯 완료 처리. `image_url`이 null이면 `400 IMAGE_URL_REQUIRED`. 슬롯 `status → ready`. 준비완료 판정 자동 실행. 응답: 업데이트된 슬롯 레코드.

### AC 2: AdminShell 메뉴 + 커리큘럼 플랜 목록 페이지

1. `apps/admin/components/layout/AdminShell.tsx`의 "활동 봇" 그룹 children에 아이템 추가:
   ```ts
   { key: "bots-curriculum", href: "/bots/curriculum", icon: "ri-book-open-line", label: "커리큘럼 플랜", subKey: "curriculum" }
   ```
   `SUPER_ADMIN_ONLY_KEYS`(슈퍼관리자 전용 메뉴 키 집합)에 `"bots-curriculum"` 포함.

2. `apps/admin/app/bots/curriculum/page.tsx` 신규 생성 — 커리큘럼 플랜 목록 페이지:
   - `AdminShell`(`activeKey="bots"`, `breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜"]}`) 사용.
   - `useSearchParams` 사용 → 반드시 `<Suspense>` 래핑(Next.js 15 필수).
   - 시리즈 단위 섹션으로 구분해 챕터 목록 나열. 각 챕터 행: 순서(N강)·챕터 제목·상태 배지(`planned`/`drafted`/`ready`/`published`/`skipped`)·"이미지 M/T 완료"(`readySlots/totalSlots`)·예약시각(없으면 "미예약")·"상세보기" 링크.
   - 상태 필터: `Select` 컴포넌트(`@/components/ui/Select`) 사용. native `<select>` 직접 노출 금지(메모리 규칙).
   - `fetch` 호출 시 `credentials: "include"` 필수.
   - 챕터 행 클릭(또는 "상세보기" 링크) → `/bots/curriculum/[chapterId]` 이동.

### AC 3: 챕터 상세 페이지 (리스트=상세 규약)

`apps/admin/app/bots/curriculum/[chapterId]/page.tsx` 신규 생성 — 챕터 상세 페이지(메모리 규칙: 리스트=상세 규약, 모달로 구현 금지):

1. `AdminShell`(`activeKey="bots"`, `breadcrumb={["관리자", "활동 봇", "커리큘럼 플랜", chapterTitle]}`) 사용.
2. 상단 요약 카드: 시리즈명·챕터 순서(N강)·챕터 제목·학습목표(`goal`)·상태 배지·이미지 완료 현황(`readySlots/totalSlots`).
3. **섹션 A — 초안 본문 편집**:
   - `draftContent`(Tiptap 초안 jsonb)를 JSON 문자열로 `<textarea className="control" rows={16}>` 표시(편집 가능). 사람이 수정한 텍스트는 `draftTextEditable`(사람 수정 텍스트) 필드로도 함께 저장.
   - "초안 저장" 버튼 → `PATCH .../draft` 호출. 성공·실패 토스트(화면 중앙).
   - `draftContent`가 null이면 "(초안 미생성 — 13.3 스테이징 파이프라인 실행 필요)" 안내.
4. **섹션 B — 이미지 슬롯 목록**:
   - 각 슬롯 카드: 슬롯 `assetKey`(마커 매칭 키)·`source_kind`(슬롯 출처 종류) 배지·`guidance`(사람용 상세 안내)·현재 이미지 미리보기(`image_url` 있으면 `<img>` 태그)·액션 버튼.
   - 배지 색상 (메모리 규칙 §3 반영):
     - 🟢 `ai_diagram`(AI 도식): `badge-green` + "자동(AI 도식)"
     - 🟢 `web_download`(웹 다운로드): `badge-green` + "자동(웹 다운로드)"
     - 🟡 `capture`(화면 캡처): `badge-orange` + "세팅필요(캡처)"
     - 🔵 `user_upload`(직접 업로드): `badge-blue` + "업로드 필요"
   - 슬롯 상태(`status`): `pending`(이미지 미준비) / `ready`(이미지 채워짐) — 인라인 표시.
   - 액션 버튼:
     - `user_upload` / 모든 슬롯: "이미지 업로드" 버튼 → `<input type="file">` 선택 → `POST .../upload` multipart 전송. 업로드 후 슬롯·챕터 상태 자동 갱신.
     - `ai_diagram`·`web_download`: "지금 생성" 버튼 → `POST .../generate` → 성공 시 슬롯·챕터 상태 refetch.
     - 이미지가 있고 `status=pending`인 경우: "완료 처리" 버튼 → `confirmDialog`(`{title:"슬롯 완료 처리", message:"이 슬롯을 완료로 표시하겠습니까?"}`) → `PATCH .../complete`.
5. **섹션 C — 최종 미리보기**:
   - "미리보기 새로고침" 버튼 → `GET .../preview` 호출 → 응답 `html` 필드를 `<div className="post-content" dangerouslySetInnerHTML={{ __html: html }}>` 로 렌더.
   - 이미지가 끼워진 완성 글 모습 확인. 미완료 슬롯은 플레이스홀더로 표시.
   - `dangerouslySetInnerHTML` 사용 — 서버 측 `tiptap-renderer.ts`가 sanitize-html로 XSS 방어.
6. **섹션 D — 예약시각 지정**:
   - `<input type="datetime-local" className="control">` 피커. 현재 `scheduled_at`(챕터별 예약 게시 시각) 값으로 초기화(없으면 비어있음).
   - "예약 설정" 버튼 → `PATCH .../schedule` 호출. "예약 해제" 버튼 → `{scheduledAt: null}` 전송.
   - 챕터 `status`가 `ready`가 아닌 경우 "(이미지 미완료 — 예약 설정해도 게시하지 않음)" 경고 문구 표시.

### AC 4: 공통 규칙

1. `Select` 컴포넌트: 모든 선택 UI는 `@/components/ui/Select`(커스텀 드롭다운)만 사용. native `<select>` 직접 노출 절대 금지.
2. 모달: 액션 확인 모달은 `@/lib/dialog`의 `confirmDialog`·`notifyDialog` 사용. `window.confirm`·`window.alert` 금지. 상세 페이지는 모달 아닌 별도 페이지(리스트=상세 규약).
3. 토스트: 화면 중앙(`position:fixed; top:50%; left:50%; transform:translate(-50%,-50%)`) — 우측 하단 금지.
4. `.modal`에 `.open` 클래스 없으면 `opacity:0` — 모달 표시 시 반드시 `.open` 부착.
5. `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과.
6. `pnpm --filter @ai-jakdang/admin tsc --noEmit` 통과.
7. `pnpm --filter @ai-jakdang/admin build` 통과 (RSC 경계 위반 없음).

## Tasks / Subtasks

- [ ] **Task 1: API 서비스 레이어 구현** (AC: #1)
  - [ ] 1.1 `apps/api/src/routes/admin/bots/curriculum.service.ts` 신규 생성
  - [ ] 1.2 `listCurriculumSeries(query)` — `bot_curriculum_series` 조회 + `bot_curriculum_chapters` LEFT JOIN 집계(totalChapters·publishedChapters·readyChapters)
  - [ ] 1.3 `getCurriculumSeries(seriesId)` — 시리즈 단건 + 챕터 요약 목록. 미존재 시 `throw Object.assign(new Error(...), { code: "NOT_FOUND" })`
  - [ ] 1.4 `listCurriculumChapters(query)` — 챕터 플랫 목록 + 슬롯 집계(totalSlots·readySlots, `bot_curriculum_image_slots` GROUP BY)
  - [ ] 1.5 `getCurriculumChapter(chapterId)` — 챕터 단건 + 슬롯 전체 배열. 미존재 시 NOT_FOUND
  - [ ] 1.6 `updateChapterDraft(chapterId, data)` — `draft_content`(Tiptap 초안 jsonb)·`draft_text_editable`(사람 수정 텍스트) 업데이트, `updated_at`(최종 수정 시각) 갱신
  - [ ] 1.7 `setChapterSchedule(chapterId, scheduledAt)` — `scheduled_at`(챕터별 예약 게시 시각) 업데이트(null 허용)
  - [ ] 1.8 `getChapterPreviewHtml(chapterId)` — `draftContent` 조회 → `insertInlineImagesByMarker`(`packages/server-bot/src/image/tiptap.ts`) 호출(ready 슬롯 manifest 구성) → `generateSafeHtml`(`apps/api/src/lib/tiptap-renderer.ts`) → `{html}` 반환. 미완료 슬롯은 `[이미지 미준비: ${assetKey}]` 플레이스홀더
  - [ ] 1.9 `uploadSlotImage(chapterId, slotId, file)` — `uploadImage()`(`apps/api/src/services/storage/index.ts`)로 `"editor-images"` 버킷 업로드 → `image_url` + `status=ready` 업데이트 → Story 13.3의 `checkAndPromoteChapter(chapterId)` 호출
  - [ ] 1.10 `requestSlotGenerate(chapterId, slotId, data)` — 슬롯 `source_kind` 검증(`ai_diagram`·`web_download`만 허용) → Story 13.4의 `fillImageSlot(slotId, { force: data.force, imageModel: data.imageModel, diagramPrompt: data.diagramPrompt })` 직접 호출 → 성공 시 `checkAndPromoteChapter(chapterId)` 호출
  - [ ] 1.11 `completeSlot(chapterId, slotId)` — `image_url` null 검증 → `status=ready` → Story 13.3의 `checkAndPromoteChapter(chapterId)` 호출
  - [ ] 1.12 `checkAndPromoteChapter(chapterId)`는 직접 재구현하지 않고 Story 13.3에서 export된 함수를 import해 호출한다

- [ ] **Task 2: API 라우트 등록** (AC: #1)
  - [ ] 2.1 `apps/api/src/routes/admin/bots/curriculum.ts` 신규 생성 — `registerAdminBotCurriculumRoutes(app)` export
  - [ ] 2.2 라우트 충돌 방지: 구체 경로(`.../draft`, `.../schedule`, `.../preview`, `.../upload`, `.../generate`, `.../complete`)를 와일드카드(`:chapterId`) 앞에 등록
  - [ ] 2.3 AC #1의 엔드포인트 10종 구현. 모든 라우트 `preHandler: [requireSuperAdmin]` 적용
  - [ ] 2.4 `zod` safeParse로 요청 검증. 계약 스키마(`curriculumChapterDraftUpdateSchema` 등)는 `@ai-jakdang/contracts`에서 import (13.2 완료 전제). 미완료 시 이 스토리 착수 금지(로컬 임시 정의 금지)
  - [ ] 2.5 멀티파트 업로드 라우트: `request.parts()` 반복으로 `file` 필드 추출. 파일 타입(`ALLOWED_IMAGE_TYPES`) + 크기(`MAX_UPLOAD_BYTES`) 검증 (admin/settings 패턴 동일)
  - [ ] 2.6 `apps/api/src/routes/admin/bots/index.ts`의 `registerAdminBotsRoutes` 내부에 `await registerAdminBotCurriculumRoutes(app)` 호출 추가

- [ ] **Task 3: AdminShell 메뉴 추가** (AC: #2.1)
  - [ ] 3.1 `apps/admin/components/layout/AdminShell.tsx` 수정
  - [ ] 3.2 "활동 봇" 그룹 children 배열에 `{ key: "bots-curriculum", href: "/bots/curriculum", icon: "ri-book-open-line", label: "커리큘럼 플랜", subKey: "curriculum" }` 추가
  - [ ] 3.3 `SUPER_ADMIN_ONLY_KEYS`(슈퍼관리자 전용 메뉴 키 집합)에 `"bots-curriculum"` 추가

- [ ] **Task 4: 커리큘럼 플랜 목록 페이지** (AC: #2.2)
  - [ ] 4.1 `apps/admin/app/bots/curriculum/page.tsx` 신규 생성 (`"use client"`)
  - [ ] 4.2 `CurriculumContent` (내부 컴포넌트) + `AdminCurriculumPage`(Suspense 래핑) 분리. `useSearchParams` → 반드시 `<Suspense>` 래핑
  - [ ] 4.3 시리즈 목록 fetch(`GET /api/v1/admin/bots/curriculum/series`, `credentials:"include"`) → 시리즈별 섹션으로 챕터 나열
  - [ ] 4.4 챕터 행: 순서 배지·제목·상태 배지(`planned`→gray, `drafted`→blue, `ready`→green, `published`→purple, `skipped`→orange)·"M/T 완료" 표시·예약시각·상세 링크
  - [ ] 4.5 상태 필터: `Select` 컴포넌트(native `<select>` 금지), 옵션: 전체/초안 전/초안 완료/이미지 완료/게시 완료
  - [ ] 4.6 `<Link href={`/bots/curriculum/${chapter.id}`}>상세보기</Link>` 링크

- [ ] **Task 5: 챕터 상세 페이지** (AC: #3)
  - [ ] 5.1 `apps/admin/app/bots/curriculum/[chapterId]/page.tsx` 신규 생성 (`"use client"`)
  - [ ] 5.2 마운트 시 `GET /api/v1/admin/bots/curriculum/chapters/:chapterId` fetch — 챕터 + 슬롯 전체 로드
  - [ ] 5.3 상단 요약 카드: 시리즈명·N강·제목·학습목표·상태 배지·이미지 현황
  - [ ] 5.4 **섹션 A — 초안 편집**: `draftContent`(Tiptap 초안 jsonb) JSON.stringify → `<textarea>` 표시. "초안 저장" → `PATCH .../draft`. 토스트(화면 중앙)
  - [ ] 5.5 **섹션 B — 이미지 슬롯 목록**: 슬롯 카드 반복 렌더. source_kind 배지·guidance 텍스트·이미지 미리보기·액션 버튼(업로드·생성·완료)
  - [ ] 5.6 업로드 버튼: `<input type="file" accept="image/*" style={{display:"none"}}>` + 버튼 클릭 시 `inputRef.current.click()` → `onChange`에서 FormData 구성 → `POST .../upload` fetch
  - [ ] 5.7 "지금 생성" 버튼(🟢 슬롯 전용): `POST .../generate` → 완료/실패 토스트 표시 후 슬롯·챕터 상태 refetch
  - [ ] 5.8 "완료 처리" 버튼: `confirmDialog({ title:"슬롯 완료 처리", message:"이 슬롯을 완료로 표시하겠습니까?" })` → `PATCH .../complete`. 슬롯·챕터 상태 refetch
  - [ ] 5.9 **섹션 C — 최종 미리보기**: "미리보기 새로고침" 버튼 → `GET .../preview` → `{html}` → `dangerouslySetInnerHTML={{ __html: html }}`. 결과를 `<div className="post-content">` 래핑
  - [ ] 5.10 **섹션 D — 예약 지정**: `<input type="datetime-local" className="control">` + "예약 설정" / "예약 해제" 버튼 → `PATCH .../schedule`. `status !== "ready"` 시 경고 문구 표시
  - [ ] 5.11 `<Link href="/bots/curriculum">← 목록으로</Link>` 뒤로가기 링크
  - [ ] 5.12 404 응답 시 "존재하지 않는 챕터입니다." 안내

- [ ] **Task 6: TypeScript 타입 검사 + 빌드 검증** (AC: #4)
  - [ ] 6.1 `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과 (오류 없음)
  - [ ] 6.2 `pnpm --filter @ai-jakdang/admin tsc --noEmit` 통과 (오류 없음)
  - [ ] 6.3 `pnpm --filter @ai-jakdang/admin build` 통과 — `/bots/curriculum`·`/bots/curriculum/[chapterId]` 라우트 생성 확인. RSC 경계 위반 없음(page.tsx는 `"use client"`, next/headers import 금지)

## Dev Notes

### 의존 스토리 (착수 전 확인 필수)

| 스토리 | 확인 대상 | 미완료 시 대응 |
|---|---|---|
| **13.1** | `packages/database/src/schema/bot-curriculum.ts` — `botCurriculumSeries`·`botCurriculumChapters`·`botCurriculumImageSlots` 테이블 + 관련 enum 존재 | 착수 불가 — 13.1 먼저 |
| **13.2** | `packages/contracts/src/bot-curriculum.ts` — `curriculumChapterDraftUpdateSchema`·`curriculumChapterScheduleSchema`·`curriculumSlotGenerateSchema` 등 export | 미완료 시 착수 불가. 로컬 임시 타입 금지 |
| **13.3** | `apps/api/src/services/bot/curriculum-staging.ts` — `checkAndPromoteChapter`(준비완료 판정) | 미완료 시 착수 불가. 이 스토리에서 인라인 재구현 금지 |
| **13.4** | `apps/api/src/services/bot/slot-filler.ts`의 `fillImageSlot` 서비스 | `generate` 엔드포인트는 이 서비스를 직접 호출한다. 조달 로직 중복 구현 금지 |
| **11.14** | `apps/api/src/routes/admin/bots/index.ts`의 `registerAdminBotsRoutes` 함수 | `registerAdminBotCurriculumRoutes` 등록 진입점 |

### 주요 아키텍처 규칙 (위반 시 review reject)

1. **DB 접근은 `apps/api`에서만.** admin 페이지가 DB를 직접 import하는 것 절대 금지.
2. **선택박스(Select)는 반드시 디자인시스템 커스텀 드롭다운.** `<select>` native 태그 금지. `@/components/ui/Select` 컴포넌트만 사용(메모리 규칙: select-must-be-design-system-dropdown).
3. **`useSearchParams`는 반드시 `<Suspense>` 래핑.** 미적용 시 Next.js 15 빌드 깨짐.
4. **리스트=상세페이지 규약.** `/bots/curriculum/[chapterId]`는 별도 페이지. 상세를 모달로 구현 금지. 슬롯 완료 확인(`confirmDialog`) 같은 액션만 모달 사용 가능(메모리 규칙: admin-list-detail-page-convention).
5. **토스트는 화면 중앙.** `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%)` (메모리 규칙: toast-notifications-center).
6. **`.modal`에 `.open` 클래스 필수.** `confirmDialog`/`notifyDialog`는 `@/lib/dialog`에서 import — `window.confirm`·`window.alert` 금지(메모리 규칙: admin-modal-needs-open-class).
7. **requireSuperAdmin 전용.** 커리큘럼 라우트 전체에 `preHandler: [requireSuperAdmin]`(슈퍼관리자 전용 가드) 적용. staff는 접근 불가.
8. **RSC 경계 주의.** admin 페이지는 `"use client"` 선언 필수. `next/headers`, `cookies()` import 시 빌드 크래시(메모리 규칙: admin-rsc-boundary-build-traps).
9. **이중 prefix 방지.** 라우트 등록 경로는 `/admin/bots/curriculum/...`(prefix 없이). admin 클라이언트 fetch는 `${API_BASE_URL}/api/v1/admin/bots/curriculum/...` 형식(메모리 규칙: revision-batch-125-134-admin-auth-and-analytics).

### 이미지 업로드 재사용 패턴 (Task 2.5)

기존 `apps/api/src/routes/admin/settings/index.ts`의 이미지 업로드 라우트를 **그대로 복제**한다.

```ts
// apps/api/src/routes/admin/bots/curriculum.ts (업로드 라우트)
import {
  uploadImage,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage/index.js";

app.post(
  "/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload",
  { preHandler: [requireSuperAdmin] },
  async (request, reply) => {
    const { chapterId, slotId } = request.params as { chapterId: string; slotId: string };
    const parts = request.parts();
    let part: Awaited<ReturnType<typeof parts.next>>["value"] | undefined;
    for await (const p of request.parts()) {
      if (p.type === "file" && p.fieldname === "file") { part = p; break; }
    }
    if (!part || part.type !== "file") {
      return reply.status(400).send({ error: { code: "FILE_REQUIRED", message: "file 필드가 필요합니다." } });
    }
    if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
      return reply.status(400).send({ error: { code: "INVALID_FILE_TYPE", message: "jpg·png·webp·gif 형식만 허용됩니다." } });
    }
    const buffer = await part.toBuffer();
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return reply.status(400).send({ error: { code: "FILE_TOO_LARGE", message: "파일 크기는 5MB 이하여야 합니다." } });
    }
    try {
      const result = await uploadImage({ filename: part.filename, mimetype: part.mimetype, data: buffer }, "editor-images");
      // service: uploadSlotImage(chapterId, slotId, result.url)
      const slot = await uploadSlotImage(chapterId, slotId, result.url);
      return reply.send(slot);
    } catch (err) { /* NOT_FOUND 또는 INTERNAL_ERROR 처리 */ }
  },
);
```

`uploadImage`(`apps/api/src/services/storage/index.ts`)는 `"editor-images"` 버킷에 업로드 시 자동 워터마크를 합성하므로 추가 처리 불필요.

### 최종 미리보기 서버 렌더 패턴 (Task 1.8)

```ts
// apps/api/src/routes/admin/bots/curriculum.service.ts
import { insertInlineImagesByMarker } from "@ai-jakdang/server-bot/image/tiptap.js";
import { generateSafeHtml } from "../../lib/tiptap-renderer.js";
// (또는 generateSafeHtml이 없으면 tiptap-renderer.ts의 export 함수명 확인 후 사용)

export async function getChapterPreviewHtml(chapterId: string): Promise<{ html: string }> {
  const chapter = await getCurriculumChapter(chapterId);
  if (!chapter.draftContent) return { html: "<p>(초안 없음)</p>" };

  // ready 슬롯만 manifest로 구성
  const manifest: Record<string, { url: string; caption?: string }> = {};
  for (const slot of chapter.slots) {
    if (slot.status === "ready" && slot.imageUrl) {
      manifest[slot.assetKey] = { url: slot.imageUrl, caption: slot.caption ?? undefined };
    } else {
      // 미완료 슬롯: 플레이스홀더 (insertInlineImagesByMarker가 인식하는 형태로)
      // 또는 draftContent JSON 텍스트에서 [[IMG:key]] 를 [이미지 미준비: key]로 치환 후 렌더
    }
  }

  const assembledJson = await insertInlineImagesByMarker(
    chapter.draftContent,
    manifest,
  );
  const html = generateSafeHtml(assembledJson);
  return { html };
}
```

`insertInlineImagesByMarker`(`packages/server-bot/src/image/tiptap.ts`)는 `[[IMG:키]]` 마커를 manifest의 이미지+캡션으로 분할 삽입한다. manifest에 없는 키는 `[이미지 미준비: 키]` 텍스트로 폴백 처리하거나, 스킵한다(함수 구현에 따라 확인).

`tiptap-renderer.ts`(`apps/api/src/lib/tiptap-renderer.ts`)의 실제 export 함수명을 착수 시 확인한 뒤 import한다(`generateHTML` + `sanitizeHtml` 조합 또는 래핑 함수).

### admin 페이지 구현 패턴

```tsx
// apps/admin/app/bots/curriculum/page.tsx 골격
"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";   // ← 반드시 이것만
import { API_BASE_URL } from "@/lib/api";

function CurriculumContent() {
  const searchParams = useSearchParams();
  // ...fetch, 목록 렌더
}

export default function AdminCurriculumPage() {
  return (
    <Suspense>   {/* useSearchParams → Suspense 필수 */}
      <CurriculumContent />
    </Suspense>
  );
}
```

```tsx
// apps/admin/app/bots/curriculum/[chapterId]/page.tsx 골격
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { confirmDialog } from "@/lib/dialog";
import { API_BASE_URL } from "@/lib/api";

export default function ChapterDetailPage() {
  const params = useParams();
  const chapterId = params?.chapterId as string;
  // ...
}
```

### 이미지 슬롯 배지 컬럼명 매핑 (DB snake_case → JS camelCase)

| DB 컬럼 | JS 프로퍼티 | 의미 |
|---|---|---|
| `source_kind` | `sourceKind` | 슬롯 출처 종류 (ai_diagram/web_download/capture/user_upload) |
| `asset_key` | `assetKey` | 본문 `[[IMG:키]]` 매칭용 식별자(챕터 내 유일) |
| `image_url` | `imageUrl` | 버킷 업로드 결과 URL(준비 전 null) |
| `diagram_prompt` | `diagramPrompt` | 🟢 ai_diagram 전용 생성 프롬프트 |
| `source_url` | `sourceUrl` | 🟢 web_download / 🟡 capture 원본 URL |
| `position_hint` | `positionHint` | 본문에서 이 이미지가 들어갈 대략적 위치 |
| `scheduled_at` | `scheduledAt` | 챕터별 예약 게시 시각(null이면 미예약) |
| `draft_content` | `draftContent` | Tiptap JSON 초안(생성 전 null) |
| `draft_text_editable` | `draftTextEditable` | 사람이 수정한 텍스트 반영본 |
| `order_index` | `orderIndex` | 1-based 강의 순서 |
| `published_post_id` | `publishedPostId` | 게시 결과 참조(크로스 도메인 FK 미설정) |

### service.ts Drizzle 슬롯 집계 쿼리 예시

```ts
// 챕터 목록 + 슬롯 집계 (totalSlots·readySlots)
import { getDb } from "@ai-jakdang/database";
import { botCurriculumChapters, botCurriculumImageSlots } from "@ai-jakdang/database/schema";
import { eq, count, sql } from "drizzle-orm";

const rows = await db
  .select({
    id: botCurriculumChapters.id,
    seriesId: botCurriculumChapters.seriesId,
    orderIndex: botCurriculumChapters.orderIndex,
    title: botCurriculumChapters.title,
    goal: botCurriculumChapters.goal,
    status: botCurriculumChapters.status,
    scheduledAt: botCurriculumChapters.scheduledAt,
    publishedPostId: botCurriculumChapters.publishedPostId,
    createdAt: botCurriculumChapters.createdAt,
    updatedAt: botCurriculumChapters.updatedAt,
    totalSlots: count(botCurriculumImageSlots.id),
    readySlots: count(
      sql`CASE WHEN ${botCurriculumImageSlots.status} = 'ready' THEN 1 END`,
    ),
  })
  .from(botCurriculumChapters)
  .leftJoin(botCurriculumImageSlots, eq(botCurriculumChapters.id, botCurriculumImageSlots.chapterId))
  // .where(...)
  .groupBy(botCurriculumChapters.id)
  .orderBy(botCurriculumChapters.orderIndex);
```

> `botCurriculumChapters`·`botCurriculumImageSlots` 실제 객체명은 13.1 스키마 파일을 착수 시 확인한다(`packages/database/src/schema/bot-curriculum.ts`).

### Toast 컴포넌트 패턴 (11.14·11.15 동일)

```tsx
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", zIndex: 99999,
      background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
      color: "#fff", borderRadius: 8, padding: "12px 20px",
    }}>
      {message}
    </div>
  );
}
```

### 라우트 충돌 방지 순서 (Task 2.2)

Fastify는 등록 순서대로 경로 매칭한다. 구체 경로(서픽스 포함)를 와일드카드(`:slotId`) 앞에 먼저 등록해야 충돌을 피한다. 참조: `apps/api/src/routes/admin/bots/index.ts`의 `PATCH /admin/bots/:id/toggle`을 `PATCH /admin/bots/:id` 앞에 등록하는 패턴 동일.

```ts
// 올바른 등록 순서 예시
app.get("/admin/bots/curriculum/series", ...);             // 1. 구체
app.get("/admin/bots/curriculum/series/:seriesId", ...);   // 2. 파라미터
app.get("/admin/bots/curriculum/chapters", ...);
app.get("/admin/bots/curriculum/chapters/:chapterId", ...);
// 챕터 하위 라우트: 서픽스 먼저
app.get("/admin/bots/curriculum/chapters/:chapterId/preview", ...);
app.patch("/admin/bots/curriculum/chapters/:chapterId/draft", ...);
app.patch("/admin/bots/curriculum/chapters/:chapterId/schedule", ...);
// 슬롯 라우트: 서픽스 먼저
app.post("/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/upload", ...);
app.post("/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate", ...);
app.patch("/admin/bots/curriculum/chapters/:chapterId/slots/:slotId/complete", ...);
```

### 신규 생성 파일 목록

| 파일 경로 | 용도 |
|---|---|
| `apps/api/src/routes/admin/bots/curriculum.service.ts` | DB 조회·수정·집계 서비스 레이어 |
| `apps/api/src/routes/admin/bots/curriculum.ts` | API 라우트 등록 (`registerAdminBotCurriculumRoutes`) |
| `apps/admin/app/bots/curriculum/page.tsx` | 커리큘럼 플랜 목록 페이지 |
| `apps/admin/app/bots/curriculum/[chapterId]/page.tsx` | 챕터 상세 페이지 |

### 수정 파일 목록

| 파일 경로 | 수정 내용 |
|---|---|
| `apps/api/src/routes/admin/bots/index.ts` | `registerAdminBotCurriculumRoutes` import·등록 추가 |
| `apps/admin/components/layout/AdminShell.tsx` | "커리큘럼 플랜" nav 항목 + `SUPER_ADMIN_ONLY_KEYS` 추가 |

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.5] — AC 원문
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#5] — 관리자 커리큘럼 플랜 UI 상세 (목록·챕터 상세·초안 편집·슬롯 목록·업로드/생성/완료·최종 미리보기·예약 datetime)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#3] — 이미지 슬롯 3(+1) 분류 및 🟢🟡🔵 배지 정의
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#2] — 스테이징 워크플로우 전체 흐름(초안→이미지→준비완료→예약→게시)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4] — 데이터 모델(`bot_curriculum_series`·`bot_curriculum_chapters`·`bot_curriculum_image_slots` 컬럼 전체)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#9] — prod에서 직접 준비 전략(로컬→prod 이사 불필요)
- [Source: _bmad-output/implementation-artifacts/13-2-curriculum-zod-contracts.md] — `curriculumChapterDraftUpdateSchema`·`curriculumChapterScheduleSchema`·`curriculumSlotGenerateSchema` 등 계약 스키마 전체 목록
- [Source: apps/api/src/routes/admin/bots/index.ts] — `registerAdminBotsRoutes` 등록 진입점 및 후속 스토리 배선 패턴
- [Source: apps/api/src/routes/admin/settings/index.ts] — `uploadImage` + `ALLOWED_IMAGE_TYPES` + `MAX_UPLOAD_BYTES` 재사용 패턴(이미지 업로드 라우트 완전 동일)
- [Source: apps/api/src/services/storage/index.ts] — `uploadImage(file, bucket)` 함수 시그니처(`"editor-images"` 버킷으로 호출 시 워터마크 자동 합성)
- [Source: apps/api/src/lib/tiptap-renderer.ts] — `generateHTML`(Tiptap→HTML 변환) + `sanitizeHtml`(XSS 방어) — 최종 미리보기 HTML 생성에 재사용
- [Source: packages/server-bot/src/image/tiptap.ts] — `insertInlineImagesByMarker`(`[[IMG:키]]` 마커→이미지 인라인 삽입 함수) — 미리보기 조립에 재사용
- [Source: apps/admin/components/layout/AdminShell.tsx] — `NAV_GROUPS`, `SUPER_ADMIN_ONLY_KEYS`, `children` nav 배열 수정 위치
- [Source: apps/admin/app/bots/[id]/page.tsx] — Toast·`confirmDialog`·탭 패턴·fetch 패턴 기준
- [Source: apps/admin/app/bots/page.tsx] — `Suspense`·`useSearchParams`·`Select`·`AdminShell` 패턴 기준
- [Source: apps/admin/app/members/[id]/page.tsx] — Toast 컴포넌트 중앙 고정 패턴
- [Source: apps/admin/lib/dialog.tsx] — `confirmDialog`·`notifyDialog` API (window.confirm 대체)
- [Source: apps/api/src/routes/admin/admin-members/index.ts] — `requireSuperAdmin` import 경로·패턴

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
