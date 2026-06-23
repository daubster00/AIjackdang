# 디자인 시스템 추출 (기존 자료 → spine 증류용)

출처: `자료/AI작당-디자인시스템-현재까지/*.md`, `docs/user-design-system-implementation.md`, PRD.
용도: Finalize에서 DESIGN.md(비주얼) / EXPERIENCE.md(행동) 증류 시 1차 소스.

## Foundation (EXPERIENCE.md)
- form-factor: **반응형 웹** (데스크톱/태블릿/모바일). 브레이크포인트 1024 / 768.
- 렌더링: **SSR**(공개 페이지, SEO #1 과제 — NFR-1).
- UI 시스템: **자체 제작 DS**. 외부 UI/CSS 프레임워크 금지(Tailwind/MUI/Ant/Chakra/shadcn).
- 구현: Next.js App Router, `apps/web`, CSS Modules + CSS 변수 토큰, `@/components/ui` 배럴.
- 아이콘: Remix Icon 통일. 문자 기호 아이콘 대체 금지. icon-only 버튼 `aria-label` 필수.
- 향후: 인증/타입/검증/비즈니스 로직 RN 앱과 공유 가능하게(NFR-7) — Phase 1은 웹만.

## Colors (DESIGN.md frontmatter 후보)
- primary #3030c0 / hover #2828aa / active #20208a / soft #eef0ff
- accent #18c7b8 / soft #e8faf8
- bg #f7f8fc / surface #ffffff
- text #171827 / text-sub #5f6473 / placeholder #9aa1b1
- border #e4e7f0 / border-strong #cfd4e2
- success #148f73(soft #e9f8f3) / warning #b7791f(soft #fff7e6) / danger #d9363e(soft #fff0f1) / info #2478d4(soft #edf5ff) / neutral #6b7280(soft #f1f3f7)

## Typography
- Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- size: xs12 ~ 4xl36 / weight 400~800 / 한글 가독성 우선
- 제목 600~700, 버튼·배지·칩 500~600, 본문 400. 장식체 금지.

## Shapes / Rounded
- 입력창·버튼 8px / 카드·드롭다운 12px / 큰 패널 16px / 태그·칩 999px(pill)

## Elevation & Depth
- --shadow-panel: 0 8px 24px rgba(23,24,39,.08)
- --shadow-dropdown: 0 14px 34px rgba(23,24,39,.14)
- 목록 화면은 그림자 기본 미사용, 중요 패널에만 약하게.

## Focus
- focus ring: 0 0 0 4px rgba(48,48,192,.14). 포커스 표시 제거 금지.

## Spacing
- 4px 스케일: --space-1(4) ~ --space-20(80).

## Components (DESIGN.md 비주얼 + EXPERIENCE.md 행동 분리 대상)
역할 구분(엄수): Button=실행, Badge=상태/유형 표시(비클릭), Tag=키워드+태그페이지 이동, Chip=가벼운 선택 필터, Tab=영역/화면 전환, Select=단일 선택, Input=텍스트.
인벤토리(구현 완료): Button/IconButton, Input/Textarea/Select(커스텀)/Checkbox/Radio/Switch/SearchInput,
Badge/Tag/Avatar/Alert/Tooltip/Divider/Spinner/Skeleton/EmptyState/Pagination,
Modal/ConfirmDialog/Dropdown/Popover/Toast/Drawer, Container/Stack/Inline/Grid/Card/Section, Icon.
공통 상태: default/hover/active/focus/selected/disabled/loading/empty/error/success.

### 컴포넌트별 핵심 행동/상태 규칙 (EXPERIENCE.md)
- Button: variant primary/secondary/ghost/danger, size lg44/md40/sm36. Primary는 화면당 핵심 1개. loading 중복클릭 차단.
- Select: 커스텀 UI(네이티브 숨김), 방향키/Enter/Space/Esc/바깥클릭, role=listbox/option, 모바일 동일.
- Badge: 묻고답하기 상태(답변대기/답변있음/해결됨), 자료유형, 난이도, 운영상태(공개/임시저장/숨김/삭제됨), 강조(추천/인기/신규).
- 게시글 리스트 아이템: 상태 배지는 **항상 제목 위 별도 줄**(같은 라인 금지). 이미지/링크/파일 = 아이콘 줄. 모바일은 우측 통계를 제목 아래로.
- Card: radius12, padding20(compact16), 목록은 그림자 미사용. 카드 중첩 금지. card--resource/--question/--content/--summary.
- Modal: sm420/md560/lg720. 데스크톱 중앙, 모바일 하단 시트(modal--sheet). 배경 스크롤 잠금, 포커스 트랩. 위험=Danger, 신고=Warning, 로그인유도=Primary.
- Toast: 우측하단(모바일 하단중앙), 자동닫힘 3~5s, 오류는 길게/수동. 액션은 즉시행동만.
- 파일 업로드: 클릭+드래그앤드롭, 확장자/용량 노출, 진행/성공/실패, 말줄임. (자료 .zip .md .txt .json .pdf .docx .xlsx, 최대 3개, 대표파일 1개 — PRD FR-4.5)
- Empty: 원인+다음행동, primary 버튼 최대 1개. 유형: 게시글없음/검색결과없음/답변없음/자료없음.
- Pagination: aria-current=page, 모바일 축약형(현재/전체 + 이전·다음), 최소터치 36px.
- 검색 자동완성: 최근검색어/추천태그/인기검색어, 방향키·Enter·Esc.
- 탭: line(큰 전환)/segment(보조 보기), role=tablist/tab + aria-selected. 4개↑ 모바일 가로스크롤.
- Breadcrumb: 마지막=현재(비링크), JSON-LD 고려.

## Accessibility Floor
- 버튼=<button>, 링크=<a>. icon-only aria-label. 커스텀 select aria-haspopup/expanded/role.
- 색상만으로 상태 전달 금지(아이콘/텍스트 동반). 포커스 표시 제거 금지.
- disabled = 클릭차단 + 시각약화. 터치영역 최소 36~44px. hover 의존 금지.
- 본문 XSS 차단(HTML/script 실행 금지) — PRD FR-2.3/NFR-2.

## IA (PRD 8장 + 네비)
상단 메뉴: 바이브 코딩 / AI 자동화 / AI 수익화 / 묻고답하기 / 실전자료 / 작당 라운지.
URL: /vibe-coding/{guide,tips}, /automation/{guide,cases,tips}, /monetization/{sales-tips,cases},
/qna, /resources/{prompts,mcp-skills,rules-settings,templates-checklists}, /resources/{type}/{slug},
/lounge/{ai-creation,ai-products}, /tags/{tag}.
권한: 비회원=읽기·검색만 / 회원=행동(다운로드·작성·반응·쪽지) / 게이팅 행동은 로그인 모달 유도.

## Key Flows 원형 (PRD UJ — 명명된 주인공)
- UJ-1 지훈(외주 개발자): 검색 유입 → 글 읽고 코드복사 → 태그페이지 탐색 → 가입 → 질문. (climax: 검색결과 상단 노출→첫 코드복사)
- UJ-2 수민(자동화 입문자): 질문 게시(답변대기) → 답변(답변있음) → 도움된 답변 표시 → 해결됨.
- UJ-3 민지(프리랜서): 실전자료 MCP탭+지원환경 필터 → 카드 평점/다운로드 확인 → 상세 주의사항 → zip 다운로드(로그인 게이트) → 후기·평점.
- UJ-4 현우(회원): Cursor Rules zip 등록(유형/지원환경/설명/태그) → 즉시 공개 → 다운로드·평점 누적.
- (UJ-5 운영자 = 어드민, 이번 범위 제외)

## 식별된 GAP (사용자에게 elicit 필요 — 자료에 없음)
1. Brand & Style 내러티브 / 브랜드 퍼스널리티(시각 토큰은 있으나 "성격" 미정).
2. Voice & Tone / 마이크로카피(존댓말 vs 친근체, 커뮤니티 말투, 빈상태·에러·로그인유도 문구 톤).
3. (확인) form-factor 반응형 웹으로 확정 — 네이티브 앱 Phase1 제외.
4. 화면별 State Pattern 상세(컴포넌트 상태는 있으나 페이지 단위 로딩/빈/에러/권한 조합 미정).
