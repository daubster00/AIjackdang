---
name: AI작당 어드민 (AI Jakdang Admin)
description: AI작당 운영자용 어드민(백오피스) 콘솔의 비주얼 아이덴티티. 유저 사이트와 공유하지 않는 별도 디자인 시스템(@ai-jakdang/admin-design-system). 블루(#2563eb) + Slate 중성 팔레트, Pretendard Variable, tabular-nums, 248px 사이드바 + 64px 상단바, 데이터 테이블 중심 단일 라이트 테마.
status: final
created: 2026-06-17
updated: 2026-06-17
sources:
  - "admin-design-system: 자료/ai-jakdang-admin-design-system.html (관리자 디자인 시스템 HTML 목업 — 토큰/컴포넌트 단일 출처)"
  - "admin-page-plan: 자료/ai-jakdang-admin-page-plan-2026-06-15.md (관리자 화면/기능 기획서)"
  - "admin-frontend-structure: docs/admin-frontend-structure.md (관리자 프런트엔드 구조)"
  - "prd: _bmad-output/planning-artifacts/prds/prd-ai-jakdang-2026-06-17/prd.md"
colors:
  # Primary (메인 블루 스케일) — 유저 사이트 보라(#3030c0)와 무관, 어드민 전용
  primary-50: '#eff6ff'    # 액티브 nav 배경, 배지/칩 배경, 선택 행/옵션 배경
  primary-100: '#dbeafe'
  primary-200: '#bfdbfe'
  primary-500: '#3b82f6'   # 입력 포커스 테두리, focus ring 색
  primary-600: '#2563eb'   # 주 액션색 (Primary 버튼, 활성 페이지 버튼, 액티브 아이콘)
  primary-700: '#1d4ed8'   # Primary hover, 액티브 텍스트, 링크
  primary-800: '#1e40af'
  # Gray (Slate 중성 스케일 0~900)
  gray-0: '#ffffff'        # 면/카드 배경
  gray-25: '#fcfcfd'       # 테이블 hover, 미묘한 면
  gray-50: '#f8fafc'       # 페이지 배경, thead 배경
  gray-100: '#f1f5f9'      # hover 배경, 분리선
  gray-200: '#e2e8f0'      # 테두리·구분선 표준
  gray-300: '#cbd5e1'      # 입력 테두리, 스위치 off
  gray-400: '#94a3b8'      # placeholder, 보조 캡션
  gray-500: '#64748b'      # 라벨, 보조 텍스트
  gray-600: '#475569'      # nav 텍스트, 본문 보조
  gray-700: '#334155'      # 기본 본문색
  gray-800: '#1e293b'      # 강조 텍스트, Secondary 버튼
  gray-900: '#0f172a'      # 제목·수치 최강조
  # 시맨틱 (본색 + -bg 연한 배경 쌍)
  success: '#16a34a'       # green 배지, up 추세, 공개 상태
  success-bg: '#f0fdf4'
  warning: '#d97706'       # orange 배지, 숨김·답변대기
  warning-bg: '#fffbeb'
  danger: '#dc2626'        # red 배지, 신고 알림 점, 삭제 액션
  danger-bg: '#fef2f2'
  danger-hover: '#b91c1c'  # Danger 버튼 hover
  info: '#0284c7'          # cyan 배지, 정보 알림
  info-bg: '#f0f9ff'
  purple: '#7c3aed'        # purple 배지, 묻고답하기 유형·확인중
  purple-bg: '#f5f3ff'
  # 차트
  chart-new: '#2563eb'     # 신규 방문자
  chart-return: '#06b6d4'  # 재방문자 (시안)
  # 알림(alert) 전용 텍스트/테두리
  alert-info-text: '#075985'
  alert-info-border: '#bae6fd'
  alert-warning-text: '#92400e'
  alert-warning-border: '#fde68a'
  alert-danger-text: '#991b1b'
  alert-danger-border: '#fecaca'
typography:
  font-family:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  display:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 28px
    fontWeight: '760'
    lineHeight: '1.2'        # [ASSUMPTION]
    letterSpacing: -0.02em
  h1:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 24px
    fontWeight: '760'        # page-title (쇼케이스 740)
    lineHeight: '1.3'
    letterSpacing: -0.02em
  h2:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 20px
    fontWeight: '740'        # section-title
    letterSpacing: -0.015em
  h3:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 16px
    fontWeight: '700'        # card-title
  body:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.55'
  caption:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 12px
    fontWeight: '400'
  field-label:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 13px
    fontWeight: '650'
  stat-value:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 27px
    fontWeight: '770'
    letterSpacing: -0.02em   # tabular-nums 적용
  nav-group-label:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 11px
    fontWeight: '700'
    letterSpacing: 0.04em    # uppercase
  table-header:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 12px
    fontWeight: '700'
  badge:
    fontFamily: '{typography.font-family.fontFamily}'
    fontSize: 12px
    fontWeight: '700'
rounded:
  sm: 6px       # 배지, 세그먼트, 검색 단축키 칩
  md: 8px       # 버튼·입력·셀렉트·nav 아이템·아이콘버튼 (표준)
  lg: 12px      # 카드, 통계 카드, 빈 상태, 프로필
  xl: 16px      # 모달
  popover: 10px # 메뉴·팝오버·토스트·알림
  full: 999px   # 배지/칩/태그 카운트·nav 배지·필터칩·스위치 트랙 (pill)
spacing:
  # 어드민 목업엔 spacing 토큰 변수 없음 — 픽셀 직접 지정. 4px 기준 그리드 추정 [ASSUMPTION]
  card-padding: 18px        # 카드 본문
  stat-padding: 19px        # 통계 카드
  grid-gap: 16px            # .grid 기본
  form-gap: 14px            # 폼 그리드
  page-padding: '26px 28px 48px'   # .page (760px↓ 20px 14px 40px)
shadow:
  card: '0 1px 2px rgba(15,23,42,0.04)'        # 카드·통계 카드 (거의 평면)
  popover: '0 12px 32px rgba(15,23,42,0.12)'   # 셀렉트·행 액션 메뉴·토스트
  modal: '0 24px 70px rgba(15,23,42,0.22)'     # 모달
  drawer: '-16px 0 40px rgba(15,23,42,0.16)'   # 드로어 (좌측 드리움)
  primary-btn: '0 1px 2px rgba(37,99,235,0.18)'
  focus-ring: '0 0 0 3px rgba(59,130,246,0.14)'      # 입력 focus ring
  focus-ring-outline: '3px solid rgba(59,130,246,0.18)'  # 버튼·컨트롤 outline
  focus-ring-error: '0 0 0 3px rgba(220,38,38,0.12)'
  overlay-dim: 'rgba(15,23,42,0.42)'           # 모달 배경 딤 (+ blur 2px)
components:
  # 셸
  sidebar:
    width: 248px
    width-collapsed: 76px
    background: '{colors.gray-0}'
    border-right: '1px solid {colors.gray-200}'
  topbar:
    height: 64px
    background: 'rgba(255,255,255,0.94)'   # backdrop-filter blur(14px)
    border-bottom: '1px solid {colors.gray-200}'
  page:
    max-width: 1680px
    padding: '{spacing.page-padding}'
  # nav 아이템
  nav-item:
    min-height: 42px
    radius: '{rounded.md}'
    foreground: '{colors.gray-600}'
    icon-color: '{colors.gray-500}'
    background-hover: '{colors.gray-100}'
    foreground-hover: '{colors.gray-900}'
    background-active: '{colors.primary-50}'
    foreground-active: '{colors.primary-700}'
    icon-active: '{colors.primary-600}'
    weight-active: '650'
  nav-badge:
    radius: '{rounded.full}'
    background: '{colors.danger-bg}'
    foreground: '{colors.danger}'
  # 버튼
  button-primary:
    background: '{colors.primary-600}'
    background-hover: '{colors.primary-700}'
    foreground: '{colors.gray-0}'
    radius: '{rounded.md}'
    height: 40px            # md. sm=32px, lg=46px
    shadow: '{shadow.primary-btn}'
  button-secondary:
    background: '{colors.gray-800}'
    background-hover: '{colors.gray-900}'
    foreground: '{colors.gray-0}'
    radius: '{rounded.md}'
  button-outline:
    background: '{colors.gray-0}'
    border: '1px solid {colors.gray-300}'
    foreground: '{colors.gray-700}'
    radius: '{rounded.md}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.gray-600}'
    background-hover: '{colors.gray-100}'
    radius: '{rounded.md}'
  button-danger:
    background: '{colors.danger}'
    background-hover: '{colors.danger-hover}'
    foreground: '{colors.gray-0}'
    radius: '{rounded.md}'
  button-text:
    background: 'transparent'
    foreground: '{colors.primary-700}'
    padding: 4px
  # 입력 / 셀렉트
  input:
    height: 40px
    background: '{colors.gray-0}'
    border: '1px solid {colors.gray-300}'
    border-hover: '1px solid {colors.gray-400}'
    border-focus: '1px solid {colors.primary-500}'
    border-error: '1px solid {colors.danger}'
    foreground: '{colors.gray-800}'
    radius: '{rounded.md}'
    focus-ring: '{shadow.focus-ring}'
    placeholder: '{colors.gray-400}'
  custom-select:
    height: 40px
    border: '1px solid {colors.gray-300}'
    border-open: '1px solid {colors.primary-500}'
    radius: '{rounded.md}'
    menu-radius: '{rounded.popover}'
    menu-shadow: '{shadow.popover}'
    option-selected-bg: '{colors.primary-50}'
    option-selected-fg: '{colors.primary-700}'
  # 테이블 / 데이터 그리드
  table:
    min-width: 980px
    thead-height: 44px
    thead-background: '{colors.gray-50}'
    thead-foreground: '{colors.gray-500}'
    thead-border-bottom: '1px solid {colors.gray-200}'
    td-height: 56px
    td-border-bottom: '1px solid {colors.gray-100}'
    td-foreground: '{colors.gray-600}'
    row-hover: '{colors.gray-25}'
    row-selected: '{colors.primary-50}'
    checkbox-accent: '{colors.primary-600}'
  table-toolbar:
    min-height: 52px
  table-row-action:
    width: 140px
    radius: '{rounded.popover}'
    shadow: '{shadow.popover}'
    danger-item-color: '{colors.danger}'
  filter-panel:
    background: '{colors.gray-25}'
    border-bottom: '1px solid {colors.gray-200}'
  line-tabs:
    height: 49px
    active-foreground: '{colors.primary-700}'
    active-underline: '2px solid {colors.primary-600}'
  pagination:
    min-height: 58px
    button-size: 34px
    button-radius: 7px
    active-background: '{colors.primary-600}'
    active-foreground: '{colors.gray-0}'
  # 카드 / 통계
  card:
    background: '{colors.gray-0}'
    border: '1px solid {colors.gray-200}'
    radius: '{rounded.lg}'
    shadow: '{shadow.card}'
    padding: '{spacing.card-padding}'
    header-min-height: 58px
  stat-card:
    min-height: 128px
    padding: '{spacing.stat-padding}'
    radius: '{rounded.lg}'
    icon-box: 36px           # radius 10px, 시맨틱 배경
    value-typography: '{typography.stat-value}'
  # 배지 (7색 시맨틱)
  badge:
    min-height: 24px
    padding: '2px 8px'
    radius: '{rounded.sm}'
    typography: '{typography.badge}'
    # 변형: blue(primary) / green(공개) / orange(숨김·대기) / red(신고·삭제)
    #       gray(임시·후기) / purple(확인중·묻고답하기) / cyan(실전자료·답변있음)
  # 오버레이
  modal:
    width: 'min(540px, 100vw - 32px)'
    radius: '{rounded.xl}'
    shadow: '{shadow.modal}'
    header-min-height: 62px
    overlay: '{shadow.overlay-dim}'
  drawer:
    width: 'min(460px, 100vw - 24px)'
    shadow: '{shadow.drawer}'
    header-height: 64px
  toast:
    min-width: 300px
    max-width: 420px
    radius: '{rounded.popover}'
    shadow: '{shadow.popover}'
  # 폼·표시 보조
  switch:
    track: '42px x 24px'
    track-off: '{colors.gray-300}'
    track-on: '{colors.primary-600}'
    knob: 18px
  checkbox:
    size: 17px
    accent: '{colors.primary-600}'
  tag-input:
    min-height: 42px
    tag-background: '{colors.primary-50}'
    tag-foreground: '{colors.primary-700}'
    tag-radius: '{rounded.sm}'
  filter-chip:
    height: 28px
    radius: '{rounded.full}'
    background: '{colors.primary-50}'
    foreground: '{colors.primary-700}'
  segmented:
    background: '{colors.gray-100}'
    active-background: '{colors.gray-0}'
    active-shadow: '0 1px 2px rgba(15,23,42,0.08)'
  alert:
    padding: '13px 14px'
    radius: '{rounded.popover}'
  empty-state:
    min-height: 238px
    border: '1px dashed {colors.gray-300}'
    background: '{colors.gray-25}'
  icon-button:
    size: 36px
    radius: '{rounded.md}'
    background-hover: '{colors.gray-100}'
---

# AI작당 어드민 — DESIGN.md (어드민 콘솔 비주얼 아이덴티티)

> 이 문서는 어드민 사이트가 **어떻게 보이는가**를 소유한다. **어떻게 동작하는가**는 `EXPERIENCE.md`가 소유한다.
> 토큰은 `@ai-jakdang/admin-design-system`의 `css/tokens/`에 CSS 변수로 구현된다. **충돌 시 이 spine이 목업·import·코드보다 이긴다.**
> 이 시스템은 유저 사이트(`apps/web`, `ux-ai-jakdang-2026-06-17/DESIGN.md`)의 토큰·컴포넌트를 **공유하지 않는 별개 디자인 시스템**이다. 유저 메인색(보라 `#3030c0`)·민트 accent(`#18c7b8`)는 어드민에 절대 들어오지 않는다.

## Brand & Style

AI작당 어드민은 **데이터 밀도가 높은 SaaS 운영 콘솔**이다. 유저 사이트가 "차분한 실전 동료"의 정중한 커뮤니티라면, 어드민은 그 커뮤니티를 **사후(事後)에 운영·모더레이션하는 백오피스 도구**다. 브랜드 자세는 한 마디로 **"피로하지 않게 오래 일하는 운영 콘솔"** — 화려함이 아니라 **판단 속도와 정확성**을 떠받친다.

시각 표현은 이 자세를 따른다. 차분한 **슬레이트(slate) 그레이**(`{colors.gray-50}`~`{colors.gray-900}`)를 중성 기반으로 깔고, 그 위에 선명한 **블루 액센트**(`{colors.primary-600}`)로 상태와 액션만 강조한다. 채도를 낮춘 배경 위에서 색은 "여기를 보라"는 신호로만 쓰인다 — 장시간 운영해도 눈이 피로하지 않게. 면은 흰색(`{colors.gray-0}`), 페이지 배경은 옅은 슬레이트(`{colors.gray-50}`)로 카드·테이블이 떠 보이게 한다.

이 시스템은 외부 어드민 프레임워크(React Admin/Refine/AdminJS/Filament)·UI 라이브러리(MUI/Ant/Chakra/shadcn)를 **일절 상속하지 않는** 자체 제작 디자인 시스템이다. 따라서 이 문서는 델타가 아니라 **값 전체의 단일 출처**다. 아이콘은 Remix Icon 4.6.0(`ri-*`)으로 통일하고, 테마는 **단일 라이트 테마**(다크 모드 미지원, `color-scheme: light`)다.

## Colors

팔레트는 **메인 블루 스케일 + Slate 중성 0~900 + 7색 시맨틱**으로 구성된다. 각 시맨틱 색은 본색과 `-bg`(연한 배경) 짝을 가진다.

- **Primary 블루 (`{colors.primary-600}`)** — 어드민의 단일 액센트. **주 액션색**으로 Primary 버튼, 활성 페이지 버튼, 액티브 nav 아이콘에 쓴다. hover는 `{colors.primary-700}`, 액티브 nav·옵션·선택 행의 연한 배경은 `{colors.primary-50}`, 포커스 테두리·ring은 `{colors.primary-500}`. 데이터가 빽빽한 화면에서 블루는 위계 신호이므로 **남용 금지** — 한 화면에 Primary 강조가 여럿이면 어디를 봐야 할지 흐려진다.
- **Slate 중성 (`{colors.gray-0}`~`{colors.gray-900}`)** — 시스템의 뼈대. 본문은 `{colors.gray-700}`, 라벨·보조는 `{colors.gray-500}`, placeholder는 `{colors.gray-400}`, 제목·수치 최강조는 `{colors.gray-900}`. 테두리 표준은 `{colors.gray-200}`, 입력 테두리는 `{colors.gray-300}`. **테두리-우선 분리**가 이 시스템의 깊이 표현 방식이다(아래 Elevation 참조).
- **시맨틱 7색** — success `{colors.success}`(공개·상승 추세), warning `{colors.warning}`(숨김·답변대기), danger `{colors.danger}`(신고·삭제), info `{colors.info}`(정보·실전자료), purple `{colors.purple}`(확인중·묻고답하기 유형). 각 `-bg`는 배지·알림·통계 아이콘박스 배경에. 배지는 여기에 gray·cyan을 더해 **총 7색 체계**(blue/green/orange/red/gray/purple/cyan)를 이룬다.
- **차트** — 신규 방문자 `{colors.chart-new}`, 재방문자 `{colors.chart-return}`(시안). 아바타는 두 색 그라데이션(`135deg, #2563eb → #06b6d4`).

**상태를 색만으로 전달하지 않는다** — 모든 시맨틱 표현에는 텍스트 라벨(필요 시 아이콘)을 동반한다. 색각 이상·흑백 출력에서도 상태가 읽혀야 한다(접근성).

## Typography

전부 **Pretendard Variable**(`{typography.font-family.fontFamily}`) 단일 패밀리. 한글 가독성을 최우선으로 하고, variable 폰트라 750·760·770 같은 **비표준 중간 웨이트**를 그대로 쓴다(제목군의 단단한 인상).

- **display (`{typography.display.fontSize}`, 760)** — 핵심 지표(대시보드 KPI) 등 드문 강조.
- **h1 (`{typography.h1.fontSize}`, 760)** — 페이지 제목(`page-title`). 페이지당 1개.
- **h2 (`{typography.h2.fontSize}`, 740)** — 섹션 제목.
- **h3 (`{typography.h3.fontSize}`, 700)** — 카드 제목(`card-title`).
- **body (`{typography.body.fontSize}`, 400, line-height 1.55)** — 전역 기본 본문.
- **caption (`{typography.caption.fontSize}`, 400)** — 등록일·작성자·help 텍스트.
- **field-label (`{typography.field-label.fontSize}`, 650)** · **nav-group-label (`{typography.nav-group-label.fontSize}`, 700, uppercase)** · **table-header (`{typography.table-header.fontSize}`, 700)** · **badge (`{typography.badge.fontSize}`, 700)** — 운영 화면 특화 라벨 군.

**핵심 규칙 — `tabular-nums`(자릿수 고정폭 숫자):** 통계값·테이블 수치 셀(조회·신고·다운로드·날짜·포인트)에는 `font-variant-numeric: tabular-nums`를 적용해 자릿수가 세로로 정렬되게 한다. 데이터 그리드에서 숫자가 흔들리지 않는 것이 이 시스템의 가독성 핵심이다. 통계값(`stat-value`)은 27px/770 + tabular-nums.

## Layout & Spacing

어드민 목업에는 spacing 토큰 변수가 없고 **픽셀값을 직접 지정**한다. 기준 그리드는 유저 시스템과 유사한 4px 스케일로 추정하나, 실측엔 7·11·13·14·15·18·19px 등 홀수가 혼용된다 `[ASSUMPTION]`.

- **셸 레이아웃** — 좌측 고정 사이드바 `{components.sidebar.width}`(축소 시 `{components.sidebar.width-collapsed}`), 상단 고정바 `{components.topbar.height}`. 메인 영역은 `margin-left: 248px` + `padding-top: 64px`. 페이지 컨테이너(`{components.page}`)는 max-width `{components.page.max-width}` 중앙 정렬.
- **간격** — 그리드 기본 gap `{spacing.grid-gap}`, 폼 그리드 `{spacing.form-gap}`. 카드 본문 패딩 `{spacing.card-padding}`, 통계 카드 `{spacing.stat-padding}`.
- **주요 그리드** — 통계 카드 `repeat(4,1fr)`, 대시보드 `1.55fr / 0.75fr`(좌 차트·우 운영확인), 필터 행 `검색·셀렉트2·날짜·액션` 다열.
- **반응형 (degrade)** — 데스크톱 우선. `1280px`에서 통계 2열·필터 4열로 축소, `980px`에서 사이드바 off-canvas(슬라이드 + backdrop)·상단바 full-width·collapsed 무효화, `760px`에서 헤더 세로 적층·통계/필터 1열·글로벌 검색 숨김·페이지네이션 세로화. 태블릿/모바일 전용 최적화는 비요구이며 **데스크톱 콘솔이 1순위**.

## Elevation & Depth

깊이는 **테두리-우선, 그림자-보조**로 표현한다. 세 단계 elevation 토큰은 모두 차가운 슬레이트(`rgba(15,23,42,...)`) 기반이다.

- `{shadow.card}` — 카드·통계 카드. 거의 평면이며 분리는 `{colors.gray-200}` 테두리가 담당한다. 그림자는 미세한 들뜸만.
- `{shadow.popover}` — 떠오르는 레이어(셀렉트 메뉴, 행 액션 메뉴, 토스트).
- `{shadow.modal}` — 모달. 가장 강한 그림자.
- `{shadow.drawer}` — 우측 드로어(좌측으로 드리우는 그림자).

**포커스 표현** — 입력은 `{shadow.focus-ring}`(블루 14% ring), 버튼·컨트롤은 `{shadow.focus-ring-outline}`(3px 블루 outline), 오류 입력은 `{shadow.focus-ring-error}`(빨강 12%). 모달 배경 딤은 `{shadow.overlay-dim}` + blur(2px). 원칙: **카드·테이블은 테두리로 구획하고, 떠오르는 레이어(팝오버·모달·드로어)만 강한 그림자**를 쓴다.

## Shapes

모서리는 요소의 무게에 따라 단계적으로 커진다.

- `{rounded.sm}`(6px) — 배지·세그먼트·검색 단축키 칩.
- `{rounded.md}`(8px) — **버튼·입력·셀렉트·nav 아이템·아이콘버튼**(표준).
- `{rounded.lg}`(12px) — 카드·통계 카드·빈 상태·프로필.
- `{rounded.xl}`(16px) — 모달.
- `{rounded.popover}`(10px) — 메뉴·팝오버·토스트·알림.
- `{rounded.full}`(999px) — 배지/칩/태그 카운트·nav 배지·필터칩·스위치 트랙(pill); 아바타·알림 점은 원형(50%).

테두리 표준 두께는 1px, 표준 색 `{colors.gray-200}`(입력은 `{colors.gray-300}`). **빈 상태(empty-state)만 점선**(`1px dashed {colors.gray-300}`)으로 "아직 비어 있음"을 시각적으로 구분한다.

## Components

> 행동 규칙(어떻게 동작하는가)은 `EXPERIENCE.md.Component Patterns`. 여기서는 **시각 사양**만. 구현은 `packages/admin-design-system/`.

**역할 구분(엄수)** — Button=실행 / Badge=상태·유형 표시(비클릭) / Tag·Chip=필터/키워드 / line-tabs=영역 전환 / Custom Select=단일 선택 / Switch=즉시 토글.

- **사이드바 내비게이션** — 폭 `{components.sidebar.width}`, 흰 면 + 우측 테두리 `{colors.gray-200}`, 세로 flex(brand/scroll/footer). 브랜드 영역 64px(로고 34px + 타이틀/부제). nav 그룹 라벨은 `{typography.nav-group-label}` uppercase(그룹: Overview/Content/Operation/Engagement/Business). `{components.nav-item}`: min-height 42px, hover는 `{colors.gray-100}`·`{colors.gray-900}`, **active는 배경 `{colors.primary-50}`·글자 `{colors.primary-700}`·아이콘 `{colors.primary-600}`·weight 650**. 미처리 알림은 `{components.nav-badge}` pill(예: 신고 12). **축소 모드(76px)**: 라벨 숨김·아이콘 중앙·배지는 우상단 점. 푸터는 관리자 프로필(그라데이션 아바타 + 이름/역할).
- **상단바** — 높이 `{components.topbar.height}`, 반투명 흰 배경 + backdrop blur. breadcrumb(13px, 강조 `{colors.gray-700}`) / 글로벌 검색(280px, 38px, 배경 `{colors.gray-50}`, `Ctrl K` 단축키 칩) / 알림 아이콘(빨강 점) / 도움말 아이콘버튼.
- **데이터 테이블 / 그리드 (어드민 핵심)** — `{components.table}`: `border-collapse`, min-width 980px(table-wrap 가로 스크롤). **thead** 높이 44px·배경 `{colors.gray-50}`·글자 `{typography.table-header}` `{colors.gray-500}`·하단 테두리 `{colors.gray-200}`·좌정렬·nowrap. **td** 높이 56px·하단 테두리 `{colors.gray-100}`(연함)·세로 중앙. 행 hover `{colors.gray-25}` / **선택 행 `{colors.primary-50}`**(120ms). 체크박스 17px(accent `{colors.primary-600}`). 수치 셀(`.num`)은 tabular-nums + `{colors.gray-700}`. 콘텐츠 셀은 제목(최대 360px 말줄임) + 메타(12px `{colors.gray-400}`). 작성자 셀은 28px 원형 아바타 + 이름.
  - **테이블 툴바** `{components.table-toolbar}`: min-height 52px, 좌측 선택정보 + 일괄 버튼 / 우측 CSV·등록 버튼.
  - **행 액션 메뉴** `{components.table-row-action}`: 140px 폭, 우측 절대배치, 항목 min-height 34px, **danger 항목은 `{colors.danger}`**.
  - **필터 패널** `{components.filter-panel}`: 배경 `{colors.gray-25}` + 하단 테두리, 필터행 그리드 + 활성 필터칩 영역.
  - **라인 탭** `{components.line-tabs}`: 높이 49px·하단 테두리, active는 `{colors.primary-700}` 글자 + 2px `{colors.primary-600}` 언더라인.
  - **페이지네이션** `{components.pagination}`: min-height 58px, 좌측 page-info(13px) / 우측 34×34px 버튼(radius 7px), active 버튼 배경 `{colors.primary-600}`·흰 글자.
- **버튼** — 기본 높이 40px(`{components.button-primary}` 외), 패딩 0 15px, radius `{rounded.md}`, weight 650, 아이콘 17px. 크기: sm 32px / md 40px / lg 46px. variant: **primary**(`{colors.primary-600}`, hover `{colors.primary-700}`, 그림자) / **secondary**(`{colors.gray-800}`, hover `{colors.gray-900}`) / **outline**(테두리 `{colors.gray-300}`·흰 배경, hover 배경 `{colors.gray-50}`) / **ghost**(투명, hover `{colors.gray-100}`) / **danger**(`{colors.danger}`, hover `{colors.danger-hover}`) / **text**(높이 auto, `{colors.primary-700}`). disabled: opacity 0.48. transition 140ms.
- **입력 / 커스텀 셀렉트** — `{components.input}`: 높이 40px, 테두리 `{colors.gray-300}`, hover `{colors.gray-400}`, focus `{colors.primary-500}` + ring `{shadow.focus-ring}`, error `{colors.danger}` + 빨강 ring. textarea min-height 104px(세로 리사이즈). 폼 보조: field-label 13px/650 · field-help 12px `{colors.gray-400}` · field-error 12px `{colors.danger}`. **커스텀 셀렉트** `{components.custom-select}`: 트리거 40px, 아이콘 회전(열림 180°), `aria-expanded=true`면 `{colors.primary-500}` 테두리. 메뉴는 popover 그림자 + radius 10px, 옵션 selected는 배경 `{colors.primary-50}`·글자 `{colors.primary-700}` + 체크. **네이티브 select 노출 금지.**
- **배지 (7색 시맨틱 — 상태 표시 핵심)** — `{components.badge}`: min-height 24px, 패딩 2px 8px, radius `{rounded.sm}`, 12px/700. 변형: `blue`(primary), `green`(공개), `orange`(숨김·대기), `red`(신고·삭제), `gray`(임시·후기), `purple`(확인중·묻고답하기), `cyan`(실전자료·답변있음). **색 + 텍스트(+필요시 아이콘) 동반**, 색만으로 상태 전달 금지.
- **카드 / 통계 카드** — `{components.card}`: 흰 면·테두리 `{colors.gray-200}`·radius 12px·shadow-card, 헤더 min-height 58px(card-title 16px/700 + card-subtitle 12px `{colors.gray-400}`). `{components.stat-card}`: min-height 128px, 라벨 + 시맨틱 컬러 아이콘박스(36px, blue/green/purple/orange) + 값 27px/770 tabular-nums + 하단 추세(up `{colors.success}` / down `{colors.danger}`).
- **모달 / 드로어 / 토스트** — **모달** `{components.modal}`: width `min(540px, 100vw-32px)`, radius 16px, shadow-modal, 중앙, 헤더 62px(타이틀 17px/720)/본문/푸터 우측 버튼, 열림 160ms. **드로어** `{components.drawer}`: 우측 고정, width `min(460px, 100vw-24px)`, 좌측 그림자, 슬라이드 180ms, 헤더 64px + detail-list(라벨 12px `{colors.gray-400}` + 값 `{colors.gray-800}`). **토스트** `{components.toast}`: 우하단, min 300/max 420px, radius 10px, shadow-popover, success 초록·error 빨강 아이콘.
- **폼·표시 보조** — **switch** `{components.switch}`(42×24px, off `{colors.gray-300}` / on `{colors.primary-600}`, 노브 18px) · **checkbox/radio** `{components.checkbox}`(17px, accent `{colors.primary-600}`) · **tag-input** `{components.tag-input}` · **filter-chip** `{components.filter-chip}`(28px pill, primary-50/700, 제거 ✕) · **segmented** `{components.segmented}`(배경 `{colors.gray-100}`, active 흰 배경 + 미세 그림자) · **alert** `{components.alert}`(info/warning/danger 시맨틱 + 아이콘, 전용 텍스트/테두리색) · **empty-state** `{components.empty-state}`(min-height 238px, 점선 테두리, 중앙 아이콘박스 50px + 제목/설명/액션) · **icon-button** `{components.icon-button}`(36px, hover `{colors.gray-100}`).

**모션** — 표준 transition 140ms ease(버튼/입력/nav), 테이블 행 120ms, 셸 전환 180ms. 키프레임: popIn 120ms, toastIn 180ms, 모달 160ms, 드로어 180ms. **`prefers-reduced-motion`에서 모든 애니메이션 0.01ms로 무효화**(접근성).

**아이콘** — Remix Icon 4.6.0(`ri-*`)으로 통일. 같은 기능엔 같은 아이콘, icon-only 버튼엔 `aria-label` 필수.

## Do's and Don'ts

| Do | Don't |
|---|---|
| 어드민 전용 블루(`{colors.primary-600}`) + slate 중성만 사용 | 유저 사이트 보라(#3030c0)·민트(#18c7b8)를 어드민에 사용 |
| 유저 사이트와 토큰·CSS·컴포넌트 격리(별개 시스템) | web/admin 디자인 시스템 공유·차용 |
| 수치/통계/테이블 숫자에 `tabular-nums` 적용 | 데이터 셀에 가변폭 숫자(자릿수 흔들림) |
| 상태는 7색 시맨틱 배지(색 + 텍스트)로 일관 표현 | 색상만으로 상태 전달 |
| 카드·테이블은 테두리(`{colors.gray-200}`) 중심 분리 + 얕은 그림자 | 카드에 강한 그림자 남발, 떠오르는 레이어를 평면으로 |
| 표준 라운드 토큰 준수(버튼/입력 8px, 카드 12px, 모달 16px, 배지 6px) | 임의 모서리/색/폰트 하드코딩 |
| 커스텀 셀렉트 사용 + 포커스 링 유지(키보드 접근성) | 브라우저 기본 select UI 노출, 포커스 표시 제거 |
| 데스크톱 콘솔 1순위 + 980/760px degrade 대응 | 다크 테마 구현(단일 라이트 테마만) |
| Primary 강조는 화면당 핵심에만 | 데이터 화면 전체에 블루 남발(위계 붕괴) |
