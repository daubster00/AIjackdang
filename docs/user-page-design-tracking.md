# 사용자 페이지 디자인 진행 현황 (팔로업)

문서 목적: `apps/web`(사용자 사이트)에 지금까지 디자인·구현된 페이지를 항목으로 나열하고, **어디까지 됐는지**와 **사용자 검증 여부**를 추적한다.
기준 시각: 2026-06-22 / 기준 경로: `apps/web/app`

> 디자인 시스템(토큰·공통 UI 컴포넌트) 자체의 사용 규칙은 [`docs/user-design-system-implementation.md`](./user-design-system-implementation.md) 참고. 이 문서는 **페이지 단위** 진행 추적용이다.

---

## 표 보는 법 (상태 정의)

- **구현상태**
  - `구현됨` — page.tsx + CSS Module로 화면이 실제로 그려지는 상태 (목업 데이터 기반)
  - `미구현` — 네비게이션에 메뉴만 있고 페이지(라우트)는 아직 없음 (`#앵커` placeholder)
- **검증완료(`[ ]` / `[x]`)** — **사용자가 브라우저에서 직접 보고 "이 디자인 OK" 확인한 항목만** `[x]`.
  내(Claude)가 임의로 체크하지 않는다. 검증 전에는 모두 `[ ]` 상태로 둔다.

검증 방법: `pnpm dev:web` 실행 후 각 경로(기본 포트 `http://localhost:3003`)를 직접 열어 확인.

---

## 1. 메인 / 홈

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 홈(메인) | `/` | `app/page.tsx` | 구현됨 — 인기글 카드, 카테고리 섹션 등 |

## 2. 콘텐츠 게시판 — 바이브 코딩

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 목록 | `/vibe-coding` | `app/vibe-coding/page.tsx` | 구현됨 — 히어로, 사이드바, 정렬, 검색 자동완성 |
| [x] | 상세 | `/vibe-coding/[slug]` | `app/vibe-coding/[slug]/page.tsx` | 구현됨 |
| [x] | 글쓰기 | `/vibe-coding/write` | `app/vibe-coding/write/page.tsx` | 구현됨 — 공용 PostWriteForm |

## 3. 콘텐츠 게시판 — AI 자동화 (신규)

대메뉴 히어로 1개(`automation`) 공유. 하위(자동화 가이드/사례/팁)는 목록 내 카테고리로 처리. 바이브코딩 패턴 재사용.

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 목록 | `/automation` | `app/automation/page.tsx` | 구현됨 — BoardHero/BoardSidebar/검색 재사용 |
| [x] | 상세 | `/automation/[slug]` | `app/automation/[slug]/page.tsx` | 구현됨 — 댓글/반응/신고 컴포넌트 포함 |
| [x] | 글쓰기 | `/automation/write` | `app/automation/write/page.tsx` | 구현됨 — 공용 PostWriteForm |

## 4. 콘텐츠 게시판 — AI 수익화 (신규)

대메뉴 히어로 1개(`monetize`) 공유. 하위(외주·판매 팁/수익화 사례)는 목록 내 카테고리로 처리.

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [ ] | 목록 | `/monetize` | `app/monetize/page.tsx` | 구현됨 |
| [ ] | 상세 | `/monetize/[slug]` | `app/monetize/[slug]/page.tsx` | 구현됨 |
| [ ] | 글쓰기 | `/monetize/write` | `app/monetize/write/page.tsx` | 구현됨 |

## 5. 콘텐츠 게시판 — 묻고답하기 (Q&A)

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 목록 | `/questions` | `app/questions/page.tsx` | 구현됨 — 상태필터(답변대기/답변있음/해결됨/인기) |
| [x] | 상세 | `/questions/[slug]` | `app/questions/[slug]/page.tsx` | 구현됨 — 답변 폼/답변 아이템/질문 액션 |
| [x] | 질문 작성 | `/questions/write` | `app/questions/write/page.tsx` | 구현됨 |

## 6. 콘텐츠 게시판 — 실전자료 (자료실)

다운로드형 자료실. 대메뉴 히어로 1개(`resources`)를 4개 하위메뉴가 공유. MCP·Skills 패턴을 prompts/rules/templates가 재사용.

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | MCP·Skills 목록 | `/resources/mcp-skills` | `app/resources/mcp-skills/page.tsx` | 구현됨 — 다운로드형 자료실, 유형필터 |
| [ ] | MCP·Skills 상세 | `/resources/mcp-skills/[slug]` | `app/resources/mcp-skills/[slug]/page.tsx` | 구현됨 |
| [x] | MCP·Skills 자료 등록 | `/resources/mcp-skills/write` | `app/resources/mcp-skills/write/page.tsx` | 구현됨 — ResourceWriteForm |
| [x] | 프롬프트 목록 | `/resources/prompts` | `app/resources/prompts/page.tsx` | 구현됨 (신규) |
| [ ] | 프롬프트 상세 | `/resources/prompts/[slug]` | `app/resources/prompts/[slug]/page.tsx` | 구현됨 (신규) — 수정사항 2번 대상 |
| [x] | 프롬프트 자료 등록 | `/resources/prompts/write` | `app/resources/prompts/write/page.tsx` | 구현됨 (신규) |
| [x] | Rules·설정 목록 | `/resources/rules` | `app/resources/rules/page.tsx` | 구현됨 (신규) |
| [ ] | Rules·설정 상세 | `/resources/rules/[slug]` | `app/resources/rules/[slug]/page.tsx` | 구현됨 (신규) — 수정사항 2번 대상 |
| [x] | Rules·설정 자료 등록 | `/resources/rules/write` | `app/resources/rules/write/page.tsx` | 구현됨 (신규) |
| [x] | 템플릿·체크리스트 목록 | `/resources/templates` | `app/resources/templates/page.tsx` | 구현됨 (신규) |
| [ ] | 템플릿·체크리스트 상세 | `/resources/templates/[slug]` | `app/resources/templates/[slug]/page.tsx` | 구현됨 (신규) — 수정사항 2번 대상 |
| [x] | 템플릿·체크리스트 자료 등록 | `/resources/templates/write` | `app/resources/templates/write/page.tsx` | 구현됨 (신규) |

## 7. 콘텐츠 게시판 — 작당 라운지 (신규)

대메뉴 히어로 1개(`lounge`) 공유. 하위메뉴는 형태가 다름: **AI 창작마당=갤러리형(`/lounge`)**, **내가 만든 AI 제품=리스트형(`/lounge/products`)**.

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [ ] | AI 창작마당 목록(갤러리형) | `/lounge` | `app/lounge/page.tsx` | 구현됨 — 썸네일 카드 그리드, 사이드바 없음 |
| [ ] | 내가 만든 AI 제품 목록(리스트형) | `/lounge/products` | `app/lounge/products/page.tsx` | 구현됨 (신규) — 세로 리스트, 사이드바 없음 |
| [ ] | 창작마당 상세 | `/lounge/[slug]` | `app/lounge/[slug]/page.tsx` | 구현됨 |
| [ ] | 제품 상세 | `/lounge/products/[slug]` | `app/lounge/products/[slug]/page.tsx` | 구현됨 (신규) — 제품 전용 상세 |
| [ ] | 글쓰기 | `/lounge/write` | `app/lounge/write/page.tsx` | 구현됨 |

## 8. 태그

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 태그별 모아보기 | `/tags/[tag]` | `app/tags/[tag]/page.tsx` | 구현됨 |

## 9. 인증 (로그인/가입)

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 로그인 | `/login` | `app/login/page.tsx` (+ `LoginForm`) | 구현됨 |
| [x] | 회원가입 | `/signup` | `app/signup/page.tsx` (+ `SignupForm`) | 구현됨 |
| [x] | 비밀번호 찾기 | `/forgot-password` | `app/forgot-password/page.tsx` (+ `ForgotPasswordForm`) | 구현됨 |

## 10. 마이페이지 / 개인 영역

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [ ] | 마이페이지(프로필+탭) | `/mypage` | `app/mypage/page.tsx` | 구현됨 — 등급뱃지, 통계, 탭(내가 쓴 글/내 댓글/북마크/좋아요한 글). BOARDS 경로를 실제 라우트로 교정 |
| [x] | 알림 | `/notifications` | `app/notifications/page.tsx` | 구현됨 |
| [ ] | 쪽지함 | `/messages` | `app/messages/page.tsx` | 구현됨 |
| [x] | 북마크 | `/bookmarks` | `app/bookmarks/page.tsx` (+ `BookmarkList`) | 구현됨 |
| [ ] | 프로필 수정(설정) | `/settings/profile` | `app/settings/profile/page.tsx` (+ `ProfileForm`) | 구현됨 (신규) — 아바타/닉네임/소개/이메일(읽기전용) |
| [ ] | 알림 설정(설정) | `/settings/notifications` | `app/settings/notifications/page.tsx` (+ `NotificationsForm`) | 구현됨 (신규) — 알림 항목별 Switch |
| [ ] | 비밀번호 변경(설정) | `/settings/security` | `app/settings/security/page.tsx` (+ `SecurityForm`) | 구현됨 (신규) — 현재/새/확인 + 유효성 |

> 마이페이지 탭(내가 쓴 글/내 댓글/북마크/좋아요한 글)은 별도 라우트가 아니라 `/mypage` 한 화면의 탭으로 처리됨.
> 설정 3종은 독립 화면이 자연스러워 별도 라우트(`/settings/*`)로 신설했고, `/mypage`의 계정관리 링크·프로필 밴드 버튼에서 연결된다.

## 11. 개발용 (사용자 비노출)

| 검증 | 페이지 | 경로 | 파일 | 구현상태 |
|---|---|---|---|---|
| [x] | 디자인 시스템 확인 | `/dev/design-system` | `app/dev/design-system/page.tsx` | 구현됨 — 토큰/컴포넌트 카탈로그 |

## 12. 공통 레이아웃 / 셀(전 페이지 공유)

| 검증 | 요소 | 파일 | 구현상태 |
|---|---|---|---|
| [ ] | 헤더(네비/프로필메뉴/모바일메뉴) | `components/site/SiteHeader.tsx` | 구현됨 — 네비 href를 실제 라우트(/automation·/monetize·/lounge)로 교정 |
| [ ] | 푸터 | `components/site/SiteFooter.tsx` | 구현됨 |
| [ ] | 게시판 히어로 | `components/board/BoardHero.tsx` (+ `heroConfig.ts`) | 구현됨 — 대메뉴당 1개, 하위메뉴 공유. automation/monetize/lounge 히어로 추가 |
| [ ] | 게시판 사이드바 | `components/board/BoardSidebar.tsx` | 구현됨 |
| [ ] | 검색 자동완성 | `components/board/SearchAutocomplete.tsx` | 구현됨 |
| [ ] | 공용 글쓰기 폼 | `components/board/PostWriteForm.tsx` | 구현됨 — 게시판별 차이는 config prop |

---

## 13. 아직 디자인 안 된 페이지 (네비에는 있으나 라우트 없음)

> 2026-06-22 기준 — 헤더 네비게이션의 모든 대메뉴·하위메뉴·마이페이지 설정 진입점에 대응하는 라우트가 모두 구현됨. **현재 미구현(라우트 없음) 항목 없음.**

(이전 미구현 항목: AI 자동화 / AI 수익화 / 작당 라운지 / 실전자료 하위 3종 / 마이페이지 설정 3종 → 모두 위 표로 이동, 검증 대기 `[ ]` 상태)

---

## 진행 요약

- **구현된 사용자 페이지(라우트):** 42개
  - 홈 1 / 바이브코딩 3 / AI자동화 3 / AI수익화 3 / 묻고답하기 3 / 실전자료 12(MCP·Skills 3 + 프롬프트 3 + Rules·설정 3 + 템플릿·체크리스트 3) / 작당라운지 5(AI창작마당 갤러리 + 내가만든AI제품 리스트 + 창작마당 상세 + 제품 상세 + 글쓰기) / 태그 1 / 인증 3 / 개인영역 4 + 설정 3 / 개발용 1
- **공통 레이아웃·셀:** 6개
- **미구현(네비 placeholder):** 0개 (전부 구현 완료, 검증 대기)

**사용자 검증 진행도: 25 / 48 항목 검증완료** (최종 갱신: 2026-06-22, 사용자 2차 검증 + 수정 반영)

검증완료(`[x]`) 25개: 홈 1 / 바이브코딩 3 / AI자동화 3 / 묻고답하기 3 / 실전자료(MCP·Skills 목록·등록 2 + 프롬프트 목록·등록 2 + Rules·설정 목록·등록 2 + 템플릿·체크리스트 목록·등록 2 = 8) / 태그 1 / 인증 3 / 알림 1 / 북마크 1 / 디자인시스템 1 = 25개
미검증(`[ ]`, 신규 또는 손볼 것 있음) 23개: AI수익화 3 / 작당라운지 5(갤러리/리스트/창작마당상세/제품상세/글쓰기) / 실전자료 상세 4(MCP·Skills/프롬프트/Rules·설정/템플릿) / 마이페이지 1 / 쪽지함 1 / 설정 3 / 공통 레이아웃·셀 6 = 23개

> 2차 검증(2026-06-22): AI 자동화 3 + 실전자료 하위보드 목록·등록 6 + 북마크 1 = 신규 10개가 `[x]`로 확정됨(분자 15→25). 실전자료 상세는 사용자 수정요청(자료설명/포함파일 박스화 등) 대상이라 `[ ]` 유지.

---

## 검증 절차 (사용자용)

1. `pnpm dev:web` 실행 (기본 `http://localhost:3003`).
2. 위 표의 경로를 하나씩 열어 디자인 확인.
3. "이 페이지 OK"라고 알려주면 → 내가 해당 줄의 `[ ]` 를 `[x]` 로 바꾸고, "진행 요약"의 검증 카운트를 갱신한다.
4. 수정이 필요하면 항목은 `[ ]` 유지하고 수정 사항을 메모로 남긴다.
