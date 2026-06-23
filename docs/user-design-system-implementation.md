# 사용자 사이트 디자인 시스템 구현

문서 목적: `apps/web` 에 구현된 사용자 사이트 전용 디자인 시스템(토큰·전역 CSS·공통 UI 컴포넌트)의 사용법과 규칙을 정리한다.
원본 기준: `자료/AI작당-디자인시스템-*.md` + `자료/AI작당-디자인시스템-현재까지/*.html` (2026-06-16)

> 이 디자인 시스템은 **사용자 사이트 전용**이다. 관리자 앱(`apps/admin`)은 이 토큰/CSS/컴포넌트를 절대 사용하지 않는다.

---

## 1. 디자인 토큰

토큰은 `apps/web/styles/tokens/` 에 CSS 변수로 정의되어 있으며 `:root` 범위로 노출된다.
(web 앱과 admin 앱은 별도 Next 앱이라 전역 CSS가 섞이지 않으므로 앱 경계로 자연히 격리된다.)

| 파일 | 핵심 토큰(일부) |
|---|---|
| `tokens/colors.css` | `--color-primary:#3030c0`(메인 브랜드 색), `--color-accent:#18c7b8`(보조 강조 색), `--color-bg:#f7f8fc`(페이지 배경), `--color-surface:#ffffff`(카드/패널 면), `--color-text:#171827`, `--color-text-sub:#5f6473`, `--color-border:#e4e7f0`, success/warning/danger/info/neutral + 각 `-soft` |
| `tokens/typography.css` | `--font-sans`(Pretendard), `--font-size-*`(xs 12 ~ 4xl 36), `--font-weight-*`(400~800), `--line-height-*` |
| `tokens/spacing.css` | `--space-1`(4px) ~ `--space-20`(80px), 4px 스케일 |
| `tokens/radius.css` | `--radius-md`(8px 버튼/입력), `--radius-lg`(12px 카드), `--radius-xl`(16px 패널), `--radius-pill`(999px 태그/칩) |
| `tokens/shadows.css` | `--shadow-panel`, `--shadow-dropdown` |
| `tokens/transitions.css` | `--transition-base`(0.16s), `--focus-ring`(`0 0 0 4px rgba(48,48,192,.14)`) |
| `tokens/z-index.css` | `--z-header/dropdown/tooltip/drawer/modal/toast` 레이어 |
| `tokens/breakpoints.css` | 모바일 767px / 태블릿 1023px / 데스크톱 1024px 기준값 |

색상·모서리·폰트·focus ring 등은 원본 HTML 컴포넌트 파일과 동일하게 맞췄다.

---

## 2. 전역 CSS 불러오는 방법

모든 사용자 페이지는 하나의 진입 파일 `apps/web/styles/index.css` 를 통해 디자인 시스템을 불러온다.
이 파일은 `apps/web/app/layout.tsx` 에서 한 번만 import 한다.

```tsx
// apps/web/app/layout.tsx
import "../styles/index.css";          // 디자인 시스템 진입점
import "remixicon/fonts/remixicon.css"; // 아이콘 (Remix Icon)
```

`index.css` 의 로드 순서: 폰트 → 토큰 → base(reset/global/forms/accessibility) → layout → utilities.

```css
@import "./base/fonts.css";
@import "./tokens/colors.css";
/* ... tokens ... */
@import "./base/reset.css";
@import "./base/global.css";
@import "./base/accessibility.css";
/* ... layout / utilities ... */
```

레이어 구성:

- `base/` — reset, fonts(Pretendard CDN), global, forms, accessibility(`.sr-only`, focus-visible, reduced-motion)
- `layout/` — container, grid, section
- `utilities/` — display/spacing/text/accessibility (`u-` 접두사)

---

## 3. UI 컴포넌트 사용법

공통 컴포넌트는 `apps/web/components/ui/` 에 있고 배럴에서 import 한다.

```tsx
import { Button, Input, Badge, Modal, useToast } from "@/components/ui";

export function Example() {
  const { toast } = useToast();
  return (
    <>
      <Button variant="primary" onClick={() => toast({ tone: "success", title: "저장됨" })}>
        저장
      </Button>
      <Input label="제목" required placeholder="제목을 입력하세요" />
      <Badge tone="warning">답변대기</Badge>
    </>
  );
}
```

구현된 컴포넌트(전부 사용자 디자인 시스템 토큰만 사용):

- 입력/동작: `Button`, `IconButton`, `Input`, `Textarea`, `Select`(커스텀), `Checkbox`, `Radio`, `Switch`, `SearchInput`
- 표시: `Badge`, `Tag`, `Avatar`, `Alert`, `Tooltip`, `Divider`, `Spinner`, `Skeleton`, `EmptyState`, `Pagination`
- 레이어: `Modal`, `ConfirmDialog`, `Dropdown`, `Popover`, `Toast`(+`ToastProvider`/`useToast`), `Drawer`
- 레이아웃: `Container`, `Stack`, `Inline`, `Grid`, `Card`(+`CardHead/Title/Desc/Meta/Actions`), `Section`
- 아이콘: `Icon`(Remix Icon 래퍼)

`ToastProvider` 는 `app/layout.tsx` 에서 앱을 감싸며, 토스트는 `useToast().toast(...)` 로 띄운다.

### 접근성/반응형 기본 적용

- 모든 인터랙션 요소에 hover/active/focus/disabled 상태
- 키보드: 커스텀 `Select`/`Dropdown` 방향키·Enter·Esc·바깥 클릭, `Modal`/`Drawer` Esc·배경 클릭·포커스 이동·배경 스크롤 잠금
- 아이콘 전용 버튼(`IconButton`)은 `aria-label` 필수
- 색상 단독으로 상태를 전달하지 않음(상태 배지는 아이콘/텍스트 동반)
- 데스크톱/태블릿/모바일 반응형(브레이크포인트 1024/768 기준)

---

## 4. 새 사용자 컴포넌트 추가 규칙

컴포넌트는 폴더 단위로 로직과 CSS를 분리한다.

```text
apps/web/components/ui/Button/
├── Button.tsx          # 로직(상태/이벤트/접근성)
├── Button.module.css   # 시각 표현(CSS Module, 토큰만 사용)
├── Button.types.ts     # 타입(복잡한 경우 분리, 단순하면 .tsx 내 인라인)
├── Button.test.tsx     # 컴포넌트 테스트(핵심 컴포넌트)
└── index.ts            # 공개 export
```

1. 기존 색상/모서리/폰트/상태값을 임의로 바꾸지 않는다. 기존 CSS 변수(토큰)를 우선 사용한다.
2. 새 색이 필요하면 토큰을 먼저 추가하고 컴포넌트에서 변수로 참조한다(하드코딩 금지).
3. hover/active/focus/disabled, 필요 시 loading/empty/error/success 상태를 구현한다.
4. 아이콘은 `Icon`(Remix Icon)으로 통일한다. 문자 기호를 아이콘 대신 쓰지 않는다.
5. 같은 역할의 컴포넌트를 중복 생성하지 않는다(Button/Badge/Tag/Chip/Tab/Select/Input 역할 구분 유지).
6. 추가 후 `index.ts` 와 `components/ui/index.ts` 배럴에 export 한다.

---

## 5. CSS 작성 규칙 (CSS ↔ TypeScript 역할 분리)

- **CSS(.module.css)** 가 담당: 색상, 크기, 여백, 배치, 반응형, 애니메이션, hover/focus/active/disabled/loading 표현
- **TypeScript/React** 가 담당: 상태 관리, 열기/닫기, 이벤트, 키보드 조작, 데이터 전달, 유효성 검사
- inline style / JS 스타일 객체로 작성하지 않는다. 단, **동적으로 계산해야 하는 값**(예: 스켈레톤 width/height, 토큰 시각화)만 예외.
- 모든 시각 값은 토큰 CSS 변수(`var(--...)`)로 참조한다.
- 클래스 합성은 `@/lib/cn` 헬퍼를 사용한다(외부 라이브러리 미사용).

---

## 6. 디자인 시스템 확인 페이지

```text
http://localhost:3003/dev/design-system
```

색상/타이포/간격/라운드/그림자 토큰, 버튼 종류·상태, 입력·커스텀 셀렉트·체크박스·라디오·스위치,
배지·태그·아바타, 모달·확인 다이얼로그·드롭다운·팝오버·툴팁·토스트·드로어,
스피너·스켈레톤·빈 상태·페이지네이션, 카드, 반응형을 한 페이지에서 확인할 수 있다.

> 관리자 디자인 시스템 확인 페이지는 이번 단계에서 만들지 않는다(관리자 디자인 확정 후 별도).

---

## 7. 금지된 구현 방식

- Tailwind/MUI/Ant Design/Chakra/shadcn 등 외부 UI·CSS 프레임워크 사용
- 디자인 토큰/CSS/UI 컴포넌트를 관리자 앱과 공유
- 모든 CSS를 한 파일에, 모든 컴포넌트를 한 파일에 작성
- inline style 남용(동적 값 외)
- 브라우저 기본 셀렉트 UI 그대로 노출(커스텀 `Select` 사용, native select는 숨겨 폼/접근성 유지)
- 키보드 포커스 표시 제거
