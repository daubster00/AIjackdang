# @ai-jakdang/admin-design-system

프레임워크에 종속되지 않는 **관리자 페이지 디자인 시스템**입니다.
순수 CSS + 바닐라 JS(ES 모듈)로 되어 있어, 폴더째 복사하면
Next.js·순수 HTML·Vue·Laravel 등 **어떤 프로젝트에도 그대로 이식**할 수 있습니다.

> 설계 원칙: 다른 프로젝트로 옮길 때 보통 **테마 토큰(Primary 색상)과 로고만** 바꾸면 됩니다.

---

## 폴더 구조

```text
packages/admin-design-system/
├── css/
│   ├── index.css            # 단일 진입점 (아래 전부 @import)
│   ├── tokens/
│   │   ├── theme.css        # ★ 프로젝트별 교체 지점 (primary 색상 / 브랜드 / 포커스색)
│   │   └── base.css         # 회색·의미색·치수·라운드·그림자 (보통 그대로 사용)
│   ├── base/
│   │   ├── fonts.css        # Pretendard 로드 (CDN)
│   │   └── reset.css        # 초기화 + body 기준 + 모션 접근성
│   ├── layout/
│   │   ├── app-shell.css    # 사이드바·상단바·본문·접힘 상태
│   │   ├── grid.css         # 대시보드/폼/섹션 그리드
│   │   └── responsive.css   # 반응형 (마지막 로드)
│   └── components/
│       ├── buttons.css  navigation.css  cards.css  chart.css
│       ├── forms.css    data-display.css  feedback.css  overlay.css
│       └── showcase.css # 토큰/타이포 확인용 보조 컴포넌트
├── js/
│   ├── index.js            # initAdminUI() 진입점 + 전 모듈 re-export
│   ├── sidebar.js  select.js  overlay.js  toast.js
│   ├── tabs.js     tag-input.js  table.js  chart.js
└── demo/
    └── index.html          # 전체 컴포넌트 쇼케이스 (분리 파일만으로 동작)
```

---

## 빠른 시작

### 1) 순수 HTML

```html
<head>
  <!-- 아이콘 글꼴 (Remix Icon) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.6.0/fonts/remixicon.css" />
  <!-- 디자인 시스템 CSS -->
  <link rel="stylesheet" href="경로/admin-design-system/css/index.css" />
</head>
<body>
  <!-- ... .app-shell / .sidebar / .topbar / .main 마크업 ... -->
  <script type="module">
    import { initAdminUI } from "경로/admin-design-system/js/index.js";
    const ui = initAdminUI();
    ui.toast("저장됨", "변경 사항이 반영되었습니다.");
  </script>
</body>
```

### 2) 번들러(Next.js 등) 워크스페이스

```ts
// 전역 레이아웃에서 한 번만 CSS import
import "@ai-jakdang/admin-design-system/css";
import "remixicon/fonts/remixicon.css";
```

```ts
// 클라이언트 컴포넌트에서 인터랙션 초기화
"use client";
import { useEffect } from "react";
import { initAdminUI } from "@ai-jakdang/admin-design-system/js";
export function AdminInteractions() {
  useEffect(() => { initAdminUI(); }, []);
  return null;
}
```

데모를 직접 보려면 `demo/index.html` 을 정적 서버로 엽니다(ES 모듈이라 `file://` 가 아닌
`http://` 가 필요). 예: 패키지 폴더에서 `npx serve` 후 `/demo/` 접속.

---

## 마크업 규약 (JS가 인식하는 클래스/데이터 속성)

| 기능 | 마크업 |
|---|---|
| 사이드바 접힘 토글 | `[data-admin-sidebar-toggle]` (버튼) |
| 모바일 메뉴 열기 | `[data-admin-mobile-menu]` (버튼) + `.mobile-backdrop` |
| 메뉴 활성 전환 | `.nav-item` (클릭 시 active 이동) |
| 커스텀 셀렉트 | `.custom-select[data-select="이름"]` → `admin:select-change` 이벤트 |
| 모달/드로어 열기 | `[data-admin-open="대상id"]`, 닫기 `.close-overlay` + `.overlay` |
| 탭 / 세그먼트 | `.line-tabs > .line-tab[data-tab]`, `.segmented > .segment[data-range]` → `admin:tab-change` / `admin:segment-change` |
| 태그 입력 | `.tag-input > input` (Enter로 추가) |
| 테이블 선택 | `.admin-table` + `[data-admin-select-all]` + `.row-check`, 선택 필요 버튼 `[data-admin-requires-selection]` → `admin:selection-change` |
| 행 액션 메뉴 | `.row-action-button` + 인접 `.action-menu` |
| 토스트 | `ui.toast(title, desc, "success"|"error")` |
| 차트 | `createLineChart(canvas, { labels, series })` |

검색·필터·CSV 같은 **앱별 비즈니스 로직**은 위 커스텀 이벤트를 구독해서 각 프로젝트에서
구현합니다(예시는 `demo/index.html` 하단 스크립트 참고). 라이브러리는 시각/공통 인터랙션만 담당합니다.

---

## 다른 프로젝트로 이식하기

1. `packages/admin-design-system/` 폴더(또는 `css/`·`js/`)를 대상 프로젝트로 복사합니다.
2. **`css/tokens/theme.css`** 에서 `--primary-*` 색상과 `--brand-*` 를 브랜드에 맞게 교체합니다.
   - 색만 바꾸면 버튼·탭·배지·포커스링·차트 색까지 자동으로 따라옵니다.
3. 사이드바 브랜드 영역의 로고(`.brand-logo`)를 교체합니다.
4. 아이콘은 Remix Icon(`ri-*`)을 사용합니다. 다른 아이콘 세트로 바꾸려면 클래스만 교체하세요.
5. CDN 사용이 불가한 환경이면 `css/base/fonts.css` 의 Pretendard 를 로컬 폰트로 바꿉니다.

`base.css`(회색/의미색/치수)는 보통 그대로 두어도 무방하며, 필요 시 동일 변수명으로만 덮어씁니다.

---

## 규칙

- 모든 시각 값은 토큰 CSS 변수(`var(--...)`)로 참조합니다. 색·크기 하드코딩 금지.
- 외부 UI/CSS 프레임워크(Tailwind/MUI/Ant 등)를 쓰지 않습니다.
- 사용자(고객) 사이트 디자인 시스템과 토큰/CSS/컴포넌트를 **공유하지 않습니다**(관리자 전용).
- 새 컴포넌트는 역할에 맞는 `components/*.css` 에 추가하고 `css/index.css` 에 `@import` 합니다.
