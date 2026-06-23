> 출처(Provenance): `자료/ai-jakdang-admin-design-system.html` (관리자 디자인 시스템 HTML 목업, 추출 기준) · 참조: `docs/user-design-system-implementation.md` (사용자 사이트 비교용, 값 차용 금지)

# AI작당 Admin 비주얼 디자인 시스템 추출 (DESIGN.md 스파인 매핑)

이 문서는 관리자(admin) 전용 디자인 시스템의 시각 정체성을 HTML 목업에서 추출한 결과다.
**중요:** 관리자는 사용자 사이트와 별개의 디자인 시스템이다. 사용자 사이트 토큰(`--color-primary:#3030c0`(사용자 메인 보라색) 등)을 차용하지 않는다. 주요 차이는 아래 각 섹션에 명시한다.

---

## 1. Brand & Style (브랜드 & 스타일)

- **제품명:** AI작당 Admin (브랜드 타이틀), 부제 "Admin Core UI"
- **로고:** 좌상단 사이드바 브랜드 영역에 PNG 로고(`brand-logo`, 34×34px, `border-radius:9px`)
- **전체 톤:** 데이터 밀도가 높은 SaaS 운영 콘솔. 밝은(light) 단일 테마(`color-scheme: light`).
- **분위기:** 차분한 슬레이트(slate) 그레이 기반 + 선명한 블루 액센트. 장시간 봐도 피로하지 않게 채도를 낮춘 중성 배경 위에 상태/액션만 색으로 강조.
- **본문 기본색:** `--gray-700`(#334155, 본문 글자색), 배경 `--gray-50`(#f8fafc, 페이지 배경).
- **아이콘 시스템:** Remix Icon 4.6.0 (`remixicon.css` CDN). 모든 아이콘은 `ri-*` 클래스.
- **사용자 사이트와의 차이:** 사용자 메인색은 보라(#3030c0)·민트 액센트(#18c7b8)인 반면, **관리자 메인색은 블루(#2563eb)**, 중성색은 slate 계열(#0f172a~#f8fafc)로 완전히 다른 팔레트다.

---

## 2. Colors (색상)

HTML `:root`에 정의된 정확한 토큰 값.

### Primary (메인 블루 스케일)
| 토큰 | HEX | 용도 |
|---|---|---|
| `--primary-50` | #eff6ff | 액티브 nav 배경, 배지/칩 배경, 선택된 행/옵션 배경 |
| `--primary-100` | #dbeafe | (보조 톤) |
| `--primary-200` | #bfdbfe | (토큰 쇼케이스 노출) |
| `--primary-500` | #3b82f6 | 입력 포커스 테두리, focus ring 색 |
| `--primary-600` | #2563eb | **주 액션색** (Primary 버튼, 활성 페이지 버튼, 액티브 아이콘) |
| `--primary-700` | #1d4ed8 | Primary 버튼 hover, 액티브 텍스트, 링크 텍스트 |
| `--primary-800` | #1e40af | (예비) |

### Gray (Slate 중성 스케일, 0~900)
| 토큰 | HEX | | 토큰 | HEX |
|---|---|---|---|---|
| `--gray-0` | #ffffff (면/카드 배경) | | `--gray-400` | #94a3b8 (placeholder, 보조 캡션) |
| `--gray-25` | #fcfcfd (테이블 hover, 미묘한 면) | | `--gray-500` | #64748b (라벨, 보조 텍스트) |
| `--gray-50` | #f8fafc (페이지 배경, thead 배경) | | `--gray-600` | #475569 (nav 텍스트, 본문 보조) |
| `--gray-100` | #f1f5f9 (hover 배경, 분리선) | | `--gray-700` | #334155 (기본 본문색) |
| `--gray-200` | #e2e8f0 (테두리·구분선 표준) | | `--gray-800` | #1e293b (강조 텍스트, Secondary 버튼) |
| `--gray-300` | #cbd5e1 (입력 테두리, 스위치 off) | | `--gray-900` | #0f172a (제목·수치 최강조) |

### 시맨틱 색상 (각 색 + `-bg` 연한 배경 쌍)
| 의미 | 본색 | 배경(`-bg`) | 용도 |
|---|---|---|---|
| success (성공/공개) | #16a34a | #f0fdf4 | green 배지, up 추세, 공개 상태 |
| warning (주의/숨김·대기) | #d97706 | #fffbeb | orange 배지, 숨김·답변대기 |
| danger (위험/신고·삭제) | #dc2626 | #fef2f2 | red 배지, 신고 알림 점, 삭제 액션 |
| info (정보/실전자료) | #0284c7 | #f0f9ff | cyan 배지, 정보 알림 |
| purple (확인중/특수) | #7c3aed | #f5f3ff | purple 배지, 묻고답하기 유형 |

- **차트 색:** 신규 방문자 #2563eb, 재방문자 #06b6d4(시안). 아바타 그라데이션 `linear-gradient(135deg, #2563eb, #06b6d4)`.
- **알림(alert) 전용 텍스트/테두리:** info 텍스트 #075985·테두리 #bae6fd, warning 텍스트 #92400e·테두리 #fde68a, danger 텍스트 #991b1b·테두리 #fecaca.
- **Danger 버튼 hover:** #b91c1c.

---

## 3. Typography (타이포그래피)

- **폰트 패밀리:** `"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (Pretendard variable, jsdelivr CDN)
- **기본 본문:** `font-size: 14px`, `line-height: 1.55`, `-webkit-font-smoothing: antialiased`
- **숫자:** 수치 셀/통계값에 `font-variant-numeric: tabular-nums` (자릿수 정렬용 고정폭 숫자) — 데이터 그리드 핵심.

### 타입 스케일 (쇼케이스 + 실제 사용 값)
| 역할 | size | weight | line-height | 비고 |
|---|---|---|---|---|
| Display (핵심 지표) | 28px | 760 | 1.2 [ASSUMPTION] | `letter-spacing: -0.02em`(통계값 기준) |
| Heading 1 (페이지 제목) | 24px | 760 (`page-title`) / 740 (쇼케이스) | 1.3 | `letter-spacing: -0.02em` |
| Heading 2 (섹션 제목) | 20px | 740 (`section-title`) / 720 (쇼케이스) | 기본 | `letter-spacing: -0.015em` |
| Heading 3 (카드 제목) | 16px | 700 | 기본 | `card-title` |
| Body (기본 본문) | 14px | 400 | 1.55 | 전역 기본 |
| Caption (보조) | 12px | 400 | 기본 | 등록일·작성자·help 텍스트 |

### 그 외 관측된 폰트 사이즈/웨이트
- 통계값(`stat-value`): 27px / 770, tabular-nums, `letter-spacing: -0.02em`
- 브랜드 타이틀 15px/750, 부제 11px
- nav 라벨(섹션 헤더) 11px/700, `letter-spacing:0.04em`, uppercase
- 테이블 헤더(`thead th`) 12px/700, 셀 본문 14px(상속)
- 배지/태그/칩 12px/700(배지)·650(태그/칩)
- 폼 라벨(`field-label`) 13px/650
- breadcrumb 13px (강조 strong 650)

> Pretendard variable 폰트라 750·760·770 같은 비표준 중간 웨이트를 그대로 사용한다.

---

## 4. Layout & Spacing (레이아웃 & 간격)

### 셸(shell) 레이아웃
- **사이드바 폭:** `--sidebar-width: 248px` (고정 fixed, 좌측). 축소 시 `76px`(`.sidebar-collapsed`).
- **상단바 높이:** `--topbar-height: 64px` (fixed, 사이드바 우측부터 시작). 반투명 `rgba(255,255,255,0.94)` + `backdrop-filter: blur(14px)`.
- **메인 영역:** `margin-left: 248px`, `padding-top: 64px`.
- **페이지 컨테이너(`.page`):** `max-width: 1680px`, 중앙 정렬, 패딩 `26px 28px 48px`.

### 간격 스케일
- 명시적 spacing 토큰 변수는 없음. 실측 간격은 대체로 **4px 배수 + 미세 조정값**(7·11·13·14·15·18·19px 등 홀수 혼용). [ASSUMPTION] 기준 그리드는 사용자 시스템과 유사한 4px 스케일이나, 관리자 목업은 픽셀값 직접 지정 방식.
- 그리드 기본 gap: `.grid { gap: 16px }`, 폼 그리드 14px, 토큰 그리드 8px.
- 카드 본문 패딩 18px, 카드 헤더 `15px 18px`(min-height 58px), 통계 카드 패딩 19px.

### 주요 그리드 패턴
- 통계 카드: `repeat(4, 1fr)` → 1280px↓ 2열 → 760px↓ 1열
- 대시보드: `minmax(0,1.55fr) minmax(320px,0.75fr)` (좌 차트 / 우 운영확인)
- 필터 행: `minmax(240px,1fr) 170px 170px 210px auto` (검색·셀렉트2·날짜·액션) — 반응형 단계별 열 축소
- 컴포넌트/폼 그리드: `1fr 1fr`

### 반응형 브레이크포인트
- **1280px:** 통계 2열, 필터 4열로 축소
- **980px:** 사이드바 off-canvas(transform 슬라이드 + backdrop), 상단바 full-width, 모바일 메뉴 버튼 노출, collapsed 무효화
- **760px:** 페이지 패딩 축소(`20px 14px 40px`), 헤더 세로 적층, 통계/필터 1열, 글로벌 검색 숨김, 페이지네이션 세로화

---

## 5. Elevation & Depth (입체감 & 그림자)

세 단계 elevation 토큰 (모두 slate `rgba(15,23,42,...)` 기반, 차가운 그림자):
| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(15,23,42,0.04)` | 카드·통계 카드 (거의 평면, 미세 분리) |
| `--shadow-popover` | `0 12px 32px rgba(15,23,42,0.12)` | 셀렉트 메뉴, 행 액션 메뉴, 토스트 |
| `--shadow-modal` | `0 24px 70px rgba(15,23,42,0.22)` | 모달 |

기타 그림자:
- Primary 버튼: `0 1px 2px rgba(37,99,235,0.18)`
- Drawer: `-16px 0 40px rgba(15,23,42,0.16)` (좌측으로 드리움)
- 스위치 노브: `0 1px 3px rgba(15,23,42,0.2)`
- 세그먼트 active: `0 1px 2px rgba(15,23,42,0.08)`
- **Focus ring:** `outline: 3px solid rgba(59,130,246,0.18)` (버튼·아이콘버튼·컨트롤) / 입력은 `box-shadow: 0 0 0 3px rgba(59,130,246,0.14)`. 오류 입력은 `rgba(220,38,38,0.12)`.
- 오버레이 딤: `rgba(15,23,42,0.42)` + `blur(2px)` (모달 배경) / 모바일 backdrop `rgba(15,23,42,0.35)`.

> 전반적으로 **얕은(flat) 그림자** — 카드는 거의 테두리(`--gray-200`)로 분리하고 그림자는 보조. 떠오르는 레이어(팝오버·모달·드로어)만 강한 그림자.

---

## 6. Shapes (모서리 & 형태)

라운드 토큰:
| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | 6px | 배지, 세그먼트, 검색 단축키 칩 |
| `--radius-md` | 8px | **버튼·입력·셀렉트·nav 아이템·아이콘버튼**(표준) |
| `--radius-lg` | 12px | 카드, 통계 카드, 빈 상태, 프로필 |
| `--radius-xl` | 16px | 모달 |

기타 형태 값:
- 완전 원형(pill): 배지/칩/태그 카운트·nav 배지·필터칩 `border-radius: 999px`; 스위치 트랙 999px
- 원(circle): 아바타 50%, 알림 점, 체크박스 등
- 메뉴·팝오버·토스트·알림: 10px (직접 지정), 셀렉트 옵션 7px, 색상 토큰 카드 9px
- 테두리 표준 두께 1px, 표준 색 `--gray-200`; 입력 테두리 `--gray-300`
- 빈 상태(empty-state)만 `1px dashed --gray-300` (점선)

---

## 7. Components (컴포넌트 시각 스펙)

### 7.1 버튼 (`.btn`)
- 기본: 높이 40px, 패딩 `0 15px`, radius 8px, weight 650, gap 7px, 아이콘 17px, `white-space: nowrap`
- 크기 변형: `btn-sm` 32px/패딩 0 11px/13px, `btn-lg` 46px/패딩 0 18px
- 변형:
  - `btn-primary`: 배경 #2563eb, 흰 글자, 그림자 / hover #1d4ed8
  - `btn-secondary`: 배경 #1e293b(gray-800), 흰 글자 / hover #0f172a
  - `btn-outline`: 테두리 gray-300, 배경 white, 글자 gray-700 / hover 테두리 gray-400·배경 gray-50
  - `btn-ghost`: 투명, 글자 gray-600 / hover 배경 gray-100
  - `btn-danger`: 배경 #dc2626, 흰 글자 / hover #b91c1c
  - `btn-text`: 높이 auto, 패딩 4px, 글자 primary-700, 배경 투명
  - disabled: `opacity: 0.48`, `cursor: not-allowed`
- transition 140ms ease, focus-visible는 3px 블루 outline

### 7.2 입력 (`.control`)
- 높이 40px, 테두리 1px gray-300, radius 8px, 배경 white, 패딩 `0 12px`, 글자 gray-800
- hover 테두리 gray-400 / focus 테두리 primary-500 + `0 0 0 3px rgba(59,130,246,0.14)` ring
- placeholder gray-400 / disabled 배경 gray-100·글자 gray-400
- `textarea.control`: min-height 104px, 세로 리사이즈
- `.control.error`: 테두리 danger, focus ring 빨강(0.12)
- 아이콘 입력(`.input-icon`): 좌측 12px 아이콘, 입력 좌패딩 38px
- 폼 보조: `field-label` 13px/650, `field-help` 12px gray-400, `field-error` 12px danger

### 7.3 커스텀 셀렉트 (`.custom-select`)
- 트리거: 높이 40px, 테두리 gray-300, radius 8px, 양끝 정렬, 아이콘 회전(열림 시 180°)
- `aria-expanded=true`: 테두리 primary-500 + ring
- 메뉴: 절대배치, top `calc(100% + 6px)`, 패딩 6px, radius 10px, 그림자 popover, popIn 120ms 애니메이션
- 옵션: min-height 36px, radius 7px / hover gray-100 / selected 배경 primary-50·글자 primary-700·weight 650 + 체크 아이콘
- > native select 금지, 커스텀 셀렉트 사용 (사용자 시스템과 동일 원칙)

### 7.4 테이블 / 데이터 그리드 (관리자 핵심)
- `table`: `width:100%`, `border-collapse: collapse`, `min-width: 980px` (table-wrap이 가로 스크롤)
- `thead th`: 높이 44px, 패딩 `0 14px`, 배경 gray-50, 글자 gray-500 12px/700, 하단 테두리 gray-200, `white-space: nowrap`, 좌정렬
- `tbody td`: 높이 56px, 패딩 `8px 14px`, 하단 테두리 gray-100(연함), 글자 gray-600, 세로 중앙
- 행 hover: 배경 gray-25 / 선택 행(`.selected`): 배경 primary-50 (120ms transition)
- 체크박스(`.check`): 17×17px, `accent-color: primary-600`
- 수치 셀(`.num`): tabular-nums, 글자 gray-700 (조회·신고·날짜 우측 데이터)
- 콘텐츠 셀: `content-title`(최대 360px, 말줄임) + `content-meta`(12px gray-400 보조)
- 작성자 셀: 28px 원형 아바타(`author-avatar`, 이니셜) + 이름
- **테이블 툴바**(`.table-toolbar`): min-height 52px, 좌측 선택정보+일괄버튼 / 우측 CSV·등록 버튼
- **행 액션 메뉴**(`.action-menu`): 140px 폭, 절대배치 우측, 항목 min-height 34px, danger 항목 빨강
- **필터 패널**(`.filter-panel`): 배경 gray-25, 하단 테두리, 그리드 필터행 + 활성 필터칩 영역
- **라인 탭**(`.line-tabs`): 높이 49px, 하단 테두리, active는 primary-700 글자 + 2px primary-600 언더라인
- **페이지네이션**(`.pagination`): min-height 58px, 좌측 page-info(13px), 우측 버튼들(34×34px, radius 7px); active 버튼 배경 primary-600·흰 글자

### 7.5 카드 / 통계 카드
- `.card`: 배경 white, 테두리 gray-200, radius 12px, shadow-card
- `.card-header`: min-height 58px, 패딩 15px 18px, 하단 테두리, 양끝 정렬; `card-title` 16px/700, `card-subtitle` 12px gray-400
- `.stat-card`: min-height 128px, 패딩 19px; 라벨 13px/600 + 컬러 아이콘박스(36px, radius 10px, blue/green/purple/orange 시맨틱 배경); 값 27px/770 tabular-nums; 하단 추세(`trend up` 초록 / `down` 빨강)

### 7.6 배지 (`.badge`) — 상태 표시 핵심
- min-height 24px, 패딩 `2px 8px`, radius 6px, 12px/700, gap 5px, `white-space: nowrap`
- 변형(배경+글자 시맨틱 쌍): `badge-blue`(primary), `badge-green`(공개), `badge-orange`(숨김/대기), `badge-red`(신고/삭제), `badge-gray`(임시/후기), `badge-purple`(확인중/묻고답하기), `badge-cyan`(실전자료/답변있음)
- 상태를 색만으로 전달하지 않고 텍스트(+필요시 아이콘) 동반

### 7.7 사이드바 내비게이션 (관리자 핵심)
- 폭 248px, 배경 white, 우측 테두리 gray-200, 세로 flex (brand / scroll / footer)
- 브랜드 영역: 높이 64px, 로고 34px + 타이틀/부제 + 축소 토글
- nav 그룹 라벨: 11px/700 uppercase gray-400, 그룹 간 20px 간격. 그룹: Overview/Content/Operation/Engagement/Business
- `.nav-item`: min-height 42px, gap 11px, radius 8px, 글자 gray-600, 아이콘 18px gray-500
  - hover: 배경 gray-100·글자 gray-900
  - **active: 배경 primary-50·글자 primary-700·weight 650, 아이콘 primary-600**
- `.nav-badge`: pill, 배경 danger-bg·글자 danger, 11px/750 (예: 신고 12)
- **축소 모드(76px):** 라벨·텍스트 숨김, 아이콘만 중앙, 배지는 우상단 작은 점으로
- 사이드바 푸터: 관리자 프로필(아바타 그라데이션 + 이름/역할 "Super Admin")

### 7.8 상단바 (`.topbar`)
- breadcrumb(13px, 강조 gray-700) / 글로벌 검색(280px, 38px, 배경 gray-50, `Ctrl K` 단축키 칩) / 알림(빨강 점 dot) / 도움말 아이콘버튼

### 7.9 모달 / 드로어 / 토스트
- **모달:** width `min(540px, 100vw-32px)`, radius 16px, shadow-modal, 중앙, 열림 시 translate/opacity 트랜지션(160ms). 헤더 min-height 62px(타이틀 17px/720) / 본문 18px / 푸터 우측 버튼
- **드로어:** 우측 고정, width `min(460px, 100vw-24px)`, 좌측 그림자, translateX 슬라이드(180ms). 헤더(64px)/본문(스크롤)/detail-list(라벨 12px gray-400 + 값 gray-800)
- **토스트:** **화면 중앙(우측 하단 금지)**, min-width 300/max 420px, radius 10px, shadow-popover, toastIn 180ms; success 아이콘 초록 / error 빨강

### 7.10 기타 폼·표시 컴포넌트
- **스위치(`.switch`):** 42×24px 트랙, off gray-300 / on primary-600, 노브 18px 흰원 translateX(18px)
- **체크박스/라디오(`.choice`):** 17px, accent primary-600
- **태그 입력(`.tag-input`):** min-height 42px, 태그(28px, radius 6px, primary-50/primary-700)
- **필터칩(`.filter-chip`):** 28px pill, primary-50/primary-700, 제거 ✕ 버튼
- **세그먼트(`.segmented`):** 배경 gray-100 패딩 3px, 세그먼트 30px, active는 흰 배경 + 미세 그림자
- **알림(`.alert`):** 패딩 13px 14px, radius 10px, info/warning/danger 시맨틱 색조 + 아이콘
- **빈 상태(`.empty-state`):** min-height 238px, 점선 테두리 gray-300, 배경 gray-25, 중앙 아이콘박스(50px, radius 14px) + 제목/설명/액션
- **아이콘 버튼(`.icon-button`):** 36×36px, radius 8px, hover 배경 gray-100

### 7.11 모션
- 표준 transition 140ms ease (버튼/입력/nav), 테이블 행 120ms, 셸 전환 180ms
- 키프레임: popIn 120ms, toastIn 180ms, 모달 160ms, 드로어 180ms
- `prefers-reduced-motion`: 모든 애니메이션/트랜지션 0.01ms로 무효화 (접근성)

---

## 8. Do's and Don'ts (해야 할 것 / 하지 말 것)

### Do (권장)
- 관리자 전용 블루(#2563eb) + slate 중성 팔레트만 사용. 데이터 밀도 우선 설계.
- 수치/통계/테이블 숫자에 `tabular-nums` 적용해 자릿수 정렬.
- 상태는 시맨틱 배지(색 + 텍스트, 필요 시 아이콘)로 표현. 7색 배지 체계 일관 사용.
- 카드는 테두리(gray-200) 중심 + 얕은 그림자로 분리. 떠오르는 레이어만 강한 그림자.
- 표준 라운드 토큰 준수: 버튼/입력 8px, 카드 12px, 모달 16px, 배지 6px.
- 커스텀 셀렉트 사용(native select 노출 금지), focus ring 유지(키보드 접근성).
- `prefers-reduced-motion` 존중.

### Don't (금지)
- **사용자 사이트 디자인 시스템(토큰/CSS/컴포넌트) 공유·차용 금지** — 별개 앱·별개 시스템(원본 명시 규칙).
- 사용자 메인색(보라 #3030c0)·민트(#18c7b8)를 관리자에 사용 금지.
- 색만으로 상태 전달 금지(텍스트/아이콘 동반).
- 키보드 포커스 표시 제거 금지.
- 브라우저 기본 셀렉트 UI 그대로 노출 금지.
- 임의 색/모서리/폰트 하드코딩 금지 — 정의된 토큰 우선.

---

## 부록: 미명시 값 표기 [ASSUMPTION]
- spacing 스케일 변수: 관리자 목업엔 spacing 토큰 변수가 없고 픽셀 직접 지정. 4px 기준 그리드 추정. [ASSUMPTION]
- Display/H1 line-height: Display는 통계값 기준 1.2, H1 1.3 외 일부는 폰트 기본값 의존. [ASSUMPTION]
- 다크 테마: 정의되지 않음(`color-scheme: light` 단일). 다크 모드 미지원으로 간주. [ASSUMPTION]
