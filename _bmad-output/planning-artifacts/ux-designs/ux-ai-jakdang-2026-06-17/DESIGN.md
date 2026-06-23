---
name: AI작당 (AI Jakdang)
description: 바이브 코딩·AI 자동화·AI 수익화 실전 커뮤니티의 유저 사이트 비주얼 아이덴티티. 자체 제작 디자인 시스템(외부 UI/CSS 프레임워크 미사용), Next.js App Router `apps/web`, CSS Modules + CSS 변수 토큰, Pretendard, Remix Icon.
status: final
created: 2026-06-17
updated: 2026-06-17
sources:
  - "prd: _bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md"
  - "design-system: 자료/AI작당-디자인시스템-현재까지/ (인수인계·추가확정·신규추가 + HTML 갤러리)"
  - "design-system-impl: docs/user-design-system-implementation.md"
  - "logo: 자료/logo.svg, 자료/logo.png"
  - "og-image: 자료/오픈그래프_대표이미지_사이즈.jpg"
colors:
  primary: '#3030c0'
  primary-hover: '#2828aa'
  primary-active: '#20208a'
  primary-soft: '#eef0ff'
  accent: '#18c7b8'
  accent-soft: '#e8faf8'
  bg: '#f7f8fc'
  surface: '#ffffff'
  text: '#171827'
  text-sub: '#5f6473'
  placeholder: '#9aa1b1'
  border: '#e4e7f0'
  border-strong: '#cfd4e2'
  success: '#148f73'
  success-soft: '#e9f8f3'
  warning: '#b7791f'
  warning-soft: '#fff7e6'
  danger: '#d9363e'
  danger-soft: '#fff0f1'
  info: '#2478d4'
  info-soft: '#edf5ff'
  neutral: '#6b7280'
  neutral-soft: '#f1f3f7'
typography:
  font-family:
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  display:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.25'
  heading:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  label:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  meta:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  md: 8px      # 입력창 / 버튼
  lg: 12px     # 카드 / 드롭다운
  xl: 16px     # 큰 패널
  full: 999px  # 태그 / 칩 (pill)
spacing:
  # 4px 스케일 (--space-1 ~ --space-20)
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  '16': 64px
  '20': 80px
shadow:
  panel: '0 8px 24px rgba(23, 24, 39, 0.08)'
  dropdown: '0 14px 34px rgba(23, 24, 39, 0.14)'
  focus-ring: '0 0 0 4px rgba(48, 48, 192, 0.14)'
components:
  button-primary:
    background: '{colors.primary}'
    background-hover: '{colors.primary-hover}'
    background-active: '{colors.primary-active}'
    foreground: '{colors.surface}'
    radius: '{rounded.md}'
    height: 40px       # md. lg=44px, sm=36px
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.text-sub}'
    radius: '{rounded.md}'
  button-danger:
    background: '{colors.danger}'
    foreground: '{colors.surface}'
    radius: '{rounded.md}'
  card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.5}'        # compact: {spacing.4}
  input:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    border-focus: '1px solid {colors.primary}'
    border-error: '1px solid {colors.danger}'
    border-success: '1px solid {colors.success}'
    radius: '{rounded.md}'
    focus-ring: '{shadow.focus-ring}'
  badge:
    radius: '{rounded.full}'
    padding: '2px 8px'
  tag:
    radius: '{rounded.full}'
    foreground: '{colors.text-sub}'
  chip:
    radius: '{rounded.full}'
    background-active: '{colors.primary}'
    background-soft-active: '{colors.primary-soft}'
  modal:
    background: '{colors.surface}'
    radius: '{rounded.xl}'
    shadow: '{shadow.dropdown}'
    width-sm: 420px
    width-md: 560px
    width-lg: 720px
  dropdown:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    shadow: '{shadow.dropdown}'
  toast:
    radius: '{rounded.lg}'
    shadow: '{shadow.dropdown}'
---

# AI작당 — DESIGN.md (유저 사이트 비주얼 아이덴티티)

> 이 문서는 **어떻게 보이는가**를 소유한다. **어떻게 동작하는가**는 `EXPERIENCE.md`가 소유한다.
> 토큰은 `apps/web/styles/tokens/`에 CSS 변수로 구현되어 있다. 충돌 시 이 spine이 이긴다.
> 어드민(`apps/admin`)은 이 토큰/컴포넌트를 **공유하지 않는다** — 별도 디자인 시스템.

## Brand & Style

AI작당은 바이브 코딩·AI 자동화·AI 수익화를 **실제로 시도하는 사람들**의 실전 커뮤니티다. 브랜드 자세는 한 마디로 **"차분한 실전 동료"** — 과장하거나 화려하게 꾸미지 않고, 실제로 써먹을 수 있는 정보를 정확하고 빠르게 건네는 믿을만한 동료의 인상이다.

시각 표현은 이 자세를 따른다. 침착한 **딥 인디고 파랑(`{colors.primary}`)**이 브랜드의 중심이고, 청록 **민트 accent(`{colors.accent}`)**는 절제해서 쓴다. 면은 깨끗한 흰색(`{colors.surface}`), 배경은 아주 옅은 회청색(`{colors.bg}`)으로 정보가 떠 보이게 한다. 큰 히어로 비주얼·그라데이션·장식 요소를 쓰지 않고(PRD FR-6.1 "큰 비주얼 없음"), **정보 탐색 속도와 신뢰감**을 최우선으로 둔다.

이 시스템은 외부 UI/CSS 프레임워크(Tailwind/MUI/Ant/Chakra/shadcn)를 **상속하지 않는** 자체 제작 디자인 시스템이다. 따라서 이 문서는 델타가 아니라 **값 전체의 단일 출처**다. 새 컴포넌트는 기존 토큰을 확장할 뿐, 별개의 스타일을 임의 생성하지 않는다.

## Colors

팔레트는 **브랜드 2색 + 의미색(semantic) 세트 + 중립 표면**으로 구성된다. 각 의미색은 진한 색과 `-soft`(연한 배경) 짝을 가진다.

- **Primary 인디고 (`{colors.primary}`)** — 브랜드 색. 화면당 핵심 행동 1개(Primary 버튼), 활성 네비게이션, 링크, 활성 칩/탭, 포커스 링에 사용. hover `{colors.primary-hover}` / active `{colors.primary-active}` / 연한 배경 `{colors.primary-soft}`. **남용 금지** — 한 화면에 Primary 강조가 여럿이면 위계가 무너진다.
- **Accent 민트 (`{colors.accent}`)** — 보조 강조. 브랜드 포인트·소수의 강조 요소에만. 상태 표시(success 등)나 chrome에 쓰지 않는다. 절제가 규칙. 연한 배경 `{colors.accent-soft}`.
- **표면 (`{colors.surface}` / `{colors.bg}`)** — 카드·패널은 흰 면, 페이지 배경은 옅은 회청색. 카드를 배경 위에 띄워 목록 가독성을 확보.
- **텍스트 (`{colors.text}` / `{colors.text-sub}` / `{colors.placeholder}`)** — 본문은 진한 잉크, 메타 정보(작성일·조회수 등)는 낮은 대비 sub, 플레이스홀더는 가장 옅게.
- **테두리 (`{colors.border}` / `{colors.border-strong}`)** — 기본 구획선과 강조 테두리(선택 카드·셀렉트 등).
- **의미색** — success `{colors.success}`(해결됨·성공), warning `{colors.warning}`(답변대기·주의), danger `{colors.danger}`(삭제·차단·오류), info `{colors.info}`(안내·신규). 각 `-soft`는 배지/토스트/입력 상태 배경에.
- **neutral `{colors.neutral}`** — 중립 배지·비활성 톤.

**색상만으로 상태를 전달하지 않는다** — 의미색에는 항상 아이콘이나 텍스트를 동반한다(접근성, NFR-5).

## Typography

전부 **Pretendard**(`{typography.font-family.fontFamily}`) 단일 패밀리. 한글 가독성을 최우선으로 하고 장식체는 쓰지 않는다.

- **display (`{typography.display.fontSize}`, 700)** — 페이지 최상위 제목·빈 상태 헤드라인 등 드물게. 페이지당 H1 1개(PRD FR-11.2).
- **heading (`{typography.heading.fontSize}`, 600)** — 섹션·카드·게시글 제목.
- **body (`{typography.body.fontSize}`, 400, line-height 1.6)** — 본문. 한글 줄간격을 넉넉히.
- **label (`{typography.label.fontSize}`, 500)** — 버튼·폼 라벨·배지·칩.
- **meta (`{typography.meta.fontSize}`, 400, sub 색)** — 작성자·작성일·조회수·댓글수 등 보조 정보.

규칙: 제목 600~700, 버튼·배지·칩 500~600, 본문 400. 자유 글자 크기·자유 색상 팔레트를 본문 에디터에 노출하지 않는다(PRD FR-2.5 — 제한 팔레트, 형광펜/배경 강조만 허용).

## Layout & Spacing

**4px 스케일**(`{spacing.1}`=4 ~ `{spacing.20}`=80)을 모든 여백·간격에 사용. 하드코딩 금지, 항상 토큰 변수 참조.

- 콘텐츠 컨테이너 + 단 구성은 `layout/`(container/grid/section)이 담당.
- 브레이크포인트: 데스크톱 1024px+, 태블릿 768~1023px, 모바일 <768px.
- 목록은 **밀도 우선**(게시글 리스트), 카드 그리드는 자료/메인 섹션에. 카드 padding `{spacing.5}`(컴팩트 `{spacing.4}`).
- 모바일에서 필터는 접고(아코디언), 카드 액션은 2버튼([다운로드][상세보기]), 자료 상세 다운로드는 하단 고정(PRD NFR-3).

## Elevation & Depth

그림자는 **위계 장치가 아니라 띄움 신호**로 절제해 쓴다.

- `{shadow.panel}` — 떠 있는 패널·중요 카드에만 약하게. **목록 화면 카드는 그림자 기본 미사용**(테두리로 구획).
- `{shadow.dropdown}` — 드롭다운·팝오버·모달·토스트 등 오버레이 레이어.
- z-index는 `tokens/z-index.css`의 header/dropdown/tooltip/drawer/modal/toast 레이어를 따른다.

## Shapes

모서리는 요소의 무게에 따라 단계적으로 커진다.

- `{rounded.md}`(8px) — 입력창·버튼.
- `{rounded.lg}`(12px) — 카드·드롭다운.
- `{rounded.xl}`(16px) — 큰 패널·모달.
- `{rounded.full}`(999px) — 태그·칩·일부 배지(pill).

크지도 각지지도 않은 중간 곡률이 "도구이자 커뮤니티"의 차분한 인상을 만든다.

## Components

> 행동 규칙은 `EXPERIENCE.md.Component Patterns`. 여기서는 **시각 사양**만. 구현은 `apps/web/components/ui/`.

**역할 구분(엄수)** — 섞으면 화면마다 의미가 흐트러진다:
Button=실행 / Badge=상태·유형 표시(비클릭) / Tag=키워드+태그페이지 이동 / Chip=가벼운 선택 필터 / Tab=영역·화면 전환 / Select=단일 선택 / Input=텍스트.

- **Button** — variant: primary `{components.button-primary}` / secondary `{components.button-secondary}` / ghost `{components.button-ghost}` / danger `{components.button-danger}`. size lg 44 / md 40 / sm 36px. icon+text·text+icon·icon-only·full-width. Primary는 화면당 핵심 1개. danger는 삭제·차단·위험에만.
- **Input / Textarea / Search** — `{components.input}`. 상태별 테두리: 기본 `{colors.border}`, focus `{colors.primary}` + 링 `{shadow.focus-ring}`, error `{colors.danger}`(+`{colors.danger-soft}` 배경), success `{colors.success}`. 검색창은 좌측 아이콘 + 검색 버튼 조합.
- **Select(커스텀)** — 네이티브 `<select>`는 숨겨 폼/접근성 유지, 보이는 UI는 커스텀 트리거+메뉴. 선택 항목 체크 표시. 메뉴 면 `{components.dropdown}`.
- **Badge** — `{components.badge}`. variant: primary/success/warning/danger/info/neutral/outline/solid-*. 묻고답하기 상태(답변대기=warning계열, 답변있음=info/neutral, 해결됨=success), 자료유형, 난이도, 운영상태, 강조(추천/인기/신규). 한 카드에 강조 배지 1~2개.
- **Tag** — `{components.tag}`. pill, sub 색. 목록에선 2~4개만 노출. 클릭 시 `/tags/{tag}` 이동. 등록 화면 태그는 삭제 버튼 포함.
- **Chip** — `{components.chip}`. 활성 `{colors.primary}`, soft-active `{colors.primary-soft}`. 카운트 표시 가능. 게시판 상단 정렬·필터.
- **Card** — `{components.card}`. radius `{rounded.lg}`, padding `{spacing.5}`(compact `{spacing.4}`), 테두리 `{colors.border}`, 면 `{colors.surface}`. 변형: content/resource/question/summary, interactive/compact/highlight, is-selected(테두리·배경 강화)/is-disabled. **카드 중첩 금지**, 목록은 그림자 미사용.
- **게시글 리스트 아이템** — 카드보다 밀도 높게. **상태 배지(답변대기/해결됨/공지/추천/인기)는 항상 제목 위 별도 줄**(같은 라인 금지). 이미지·링크·파일은 Remix Icon 줄로. 메타는 sub 색. 댓글·다운로드 등 행동 판단 수치는 우측/하단 고정.
- **Modal** — `{components.modal}`. sm 420 / md 560 / lg 720, radius `{rounded.xl}`, 그림자 `{shadow.dropdown}`. 데스크톱 중앙, 모바일 하단 시트(modal--sheet). 닫기 버튼 우상단.
- **Toast** — `{components.toast}`. success/warning/danger/info, **화면 중앙(모든 화면 공통, 우측 하단 금지)**.
- **Pagination / Empty / Skeleton / Tooltip / Accordion / Breadcrumb / Dropdown·Popover / 파일 업로드 / 검색 자동완성** — 토큰·상태 규칙은 `.working/design-system-extraction.md` 및 원본 HTML 갤러리 기준.

**아이콘** — Remix Icon으로 통일(`Icon` 래퍼). 문자 기호를 아이콘 대신 쓰지 않고, 같은 기능엔 같은 아이콘, icon-only 버튼엔 `aria-label` 필수.

## Do's and Don'ts

| Do | Don't |
|---|---|
| 화면당 Primary 강조 1개 | 한 화면에 Primary 버튼 다수 |
| accent(민트)는 브랜드 포인트에만 절제 사용 | accent를 상태색·chrome·장식에 남용 |
| 모든 시각 값은 토큰(`var(--...)`/`{path}`) 참조 | 색·여백·radius 하드코딩 |
| 의미색에 아이콘·텍스트 동반(색만으로 상태 전달 X) | 색상만으로 상태 구분 |
| 목록 카드는 테두리로 구획(그림자 미사용) | 목록에 그림자 남발, 카드 중첩 |
| 상태 배지는 제목 위 별도 줄 | 상태 배지를 제목과 같은 라인에 |
| Remix Icon 통일, 같은 기능=같은 아이콘 | 문자 기호로 아이콘 대체 |
| 커스텀 Select(네이티브 숨김+접근성 유지) | 브라우저 기본 select UI 노출 |
| 포커스 링 `{shadow.focus-ring}` 유지 | 키보드 포커스 표시 제거 |
| 외부 토큰을 어드민과 격리 | web/admin 디자인 시스템 공유 |
| 본문 큰 히어로 없이 정보 밀도 우선 | 큰 비주얼·그라데이션·장식 |
