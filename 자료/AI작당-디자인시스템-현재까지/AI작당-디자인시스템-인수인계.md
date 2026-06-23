# AI작당 디자인 시스템 인수인계 문서

문서 작성일: 2026-06-16  
프로젝트명: AI작당  
영문명: AI Jakdang  
문서 목적: 다른 AI 또는 개발자가 지금까지 확정된 디자인 시스템을 그대로 이해하고 재사용할 수 있도록 정리한 기준 문서

---

## 1. 디자인 시스템 목표

AI작당은 바이브 코딩, AI 자동화, AI 수익화, 묻고답하기, 실전자료를 중심으로 한 실전형 AI 커뮤니티다.

디자인 시스템은 다음 기준을 따른다.

- 커뮤니티 서비스답게 정보 탐색이 빠를 것
- 과도하게 화려하지 않고 실무형·신뢰감 있는 인상을 줄 것
- AI 서비스 특유의 현대적인 느낌은 유지할 것
- PC와 모바일 모두에서 일관되게 동작할 것
- 설명만 있는 규칙이 아니라 실제 CSS 컴포넌트로 재사용할 수 있을 것
- 모든 인터랙션 요소는 hover, active, focus, disabled 상태를 가질 것
- 아이콘은 Remix Icon을 통일해서 사용할 것
- 브라우저 기본 UI를 그대로 노출하지 않고 필요 시 커스텀 UI로 구현할 것

---

## 2. 기본 스타일 방향

### 2-1. 컬러

현재 컴포넌트에서 사용하는 핵심 컬러는 다음과 같다.

```css
:root {
  --color-primary: #3030c0;
  --color-primary-hover: #2828aa;
  --color-primary-active: #20208a;
  --color-primary-soft: #eef0ff;

  --color-accent: #18c7b8;
  --color-accent-soft: #e8faf8;

  --color-bg: #f7f8fc;
  --color-surface: #ffffff;

  --color-text: #171827;
  --color-text-sub: #5f6473;
  --color-placeholder: #9aa1b1;

  --color-border: #e4e7f0;
  --color-border-strong: #cfd4e2;

  --color-success: #148f73;
  --color-success-soft: #e9f8f3;

  --color-warning: #b7791f;
  --color-warning-soft: #fff7e6;

  --color-danger: #d9363e;
  --color-danger-soft: #fff0f1;

  --color-info: #2478d4;
  --color-info-soft: #edf5ff;

  --color-neutral: #6b7280;
  --color-neutral-soft: #f1f3f7;
}
```

### 2-2. 폰트

```css
font-family:
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

기본 원칙:

- 한글 가독성 우선
- 제목은 600~700
- 버튼·배지·칩은 500~600
- 본문은 400
- 지나치게 굵거나 장식적인 폰트는 사용하지 않는다

### 2-3. 모서리

```text
입력창 / 버튼: 8px
카드 / 드롭다운: 12px
큰 패널: 16px
태그 / 칩: 999px
```

### 2-4. 그림자

```css
--shadow-panel: 0 8px 24px rgba(23, 24, 39, 0.08);
--shadow-dropdown: 0 14px 34px rgba(23, 24, 39, 0.14);
```

### 2-5. 포커스

키보드 접근성을 위해 모든 버튼, 입력창, 셀렉트, 칩에 포커스 표시를 둔다.

```css
box-shadow: 0 0 0 4px rgba(48, 48, 192, 0.14);
```

---

## 3. 아이콘 정책

아이콘은 Remix Icon만 사용한다.

공식 사이트:

```text
https://remixicon.com/
```

CDN:

```html
<link
  href="https://cdn.jsdelivr.net/npm/remixicon@4.9.0/fonts/remixicon.css"
  rel="stylesheet"
/>
```

사용 예시:

```html
<i class="ri-search-line"></i>
<i class="ri-mail-line"></i>
<i class="ri-eye-line"></i>
<i class="ri-arrow-down-s-line"></i>
<i class="ri-check-line"></i>
<i class="ri-close-line"></i>
```

원칙:

- 문자 기호를 아이콘 대신 사용하지 않는다
- 같은 기능에는 항상 같은 아이콘을 사용한다
- 아이콘 전용 버튼에는 `aria-label`을 반드시 넣는다
- 장식용 아이콘에는 불필요한 의미를 부여하지 않는다

---

## 4. 버튼 컴포넌트

파일:

```text
ai-jakdang-button-components.html
```

### 4-1. 구조

버튼은 하나의 공통 `.btn` 클래스를 기반으로 조합한다.

```text
Variant
- primary
- secondary
- ghost
- danger

Size
- lg
- md
- sm

State
- default
- hover
- active
- focus
- disabled
- loading

Content
- text only
- icon + text
- text + icon
- icon only

Width
- auto
- full width
```

### 4-2. 클래스

```text
.btn

.btn--primary
.btn--secondary
.btn--ghost
.btn--danger

.btn--lg
.btn--md
.btn--sm

.btn--icon
.btn--full

.btn__icon
.btn__spinner
.is-loading
```

### 4-3. 크기

```text
Large: 44px
Medium: 40px
Small: 36px
```

### 4-4. 사용 예시

```html
<button class="btn btn--primary btn--md">
  <i class="ri-add-line btn__icon"></i>
  <span>새 글 작성</span>
</button>
```

```html
<button class="btn btn--secondary btn--lg btn--full">
  다운로드
</button>
```

```html
<button
  class="btn btn--ghost btn--sm btn--icon"
  aria-label="저장하기"
>
  <i class="ri-bookmark-line btn__icon"></i>
</button>
```

### 4-5. 적용 원칙

- Primary는 화면의 핵심 행동 1개에 사용
- Secondary는 보조 행동에 사용
- Ghost는 취소, 뒤로가기, 덜 중요한 행동에 사용
- Danger는 삭제·차단·위험 작업에만 사용
- 한 화면에 Primary 버튼을 과도하게 여러 개 배치하지 않는다
- 버튼 상태는 CSS에서 자동 처리한다
- 로딩 상태에서는 중복 클릭을 막는다

---

## 5. 입력창·검색창·커스텀 셀렉트

파일:

```text
ai-jakdang-input-components-v2.html
```

### 5-1. 포함된 컴포넌트

```text
기본 텍스트 입력
필수 입력 표시
도움말 문구
비활성 입력
이메일 입력
비밀번호 입력
비밀번호 보기/숨기기
검색창
커스텀 셀렉트
태그 입력
Textarea
글자 수 표시
```

### 5-2. 입력창 클래스

```text
.field
.label
.required
.help
.message

.control
.input
.textarea

.icon-left
.icon-right
.control-icon
```

### 5-3. 입력 상태

```text
default
hover
focus
disabled
error
success
```

오류 상태는 빨간 테두리와 연한 배경을 사용한다.

성공 상태는 녹색 테두리와 연한 배경을 사용한다.

### 5-4. 검색창

검색창은 입력창과 버튼을 조합한다.

```html
<div class="search">
  <span class="control icon-left">
    <i class="ri-search-line control-icon left"></i>
    <input class="input" type="search" placeholder="검색어 입력">
  </span>

  <button class="btn">
    <i class="ri-search-line"></i>
    검색
  </button>
</div>
```

### 5-5. 커스텀 셀렉트

브라우저 기본 셀렉트 UI를 사용하지 않는다.

구조:

```text
.custom-select
.native-select
.select-trigger
.select-value
.select-menu
.select-option
```

기능:

- 클릭으로 열고 닫기
- 선택 항목 체크 표시
- 바깥 영역 클릭 시 닫기
- 방향키 이동
- Enter / Space 선택
- Esc 닫기
- 실제 `<select>` 값과 동기화
- 모바일에서도 동일하게 동작

중요:

- 기본 `<select>`는 접근성과 폼 데이터 제출을 위해 숨긴 상태로 유지한다
- 보이는 UI만 커스텀 버튼과 목록으로 구현한다
- 커스텀 셀렉트에는 반드시 키보드 조작을 넣는다

### 5-6. 비밀번호 입력

Remix Icon의 눈 아이콘을 사용한다.

```text
ri-eye-line
ri-eye-off-line
```

JavaScript로 `type="password"`와 `type="text"`를 전환한다.

---

## 6. 배지·태그·칩

파일:

```text
ai-jakdang-badge-tag-chip-components.html
```

### 6-1. 배지

배지는 상태나 유형을 표시한다.

클릭 기능은 없다.

사용 대상:

```text
묻고답하기 상태
- 답변대기
- 답변있음
- 해결됨

자료 유형
- 프롬프트
- Claude Code Skill
- MCP
- Rules·설정
- 템플릿·체크리스트

난이도
- 쉬움
- 보통
- 어려움

운영 상태
- 공개
- 임시저장
- 숨김
- 삭제됨

강조
- 추천
- 인기
- 신규
```

클래스:

```text
.badge
.badge--primary
.badge--success
.badge--warning
.badge--danger
.badge--info
.badge--neutral
.badge--outline
.badge--solid-primary
.badge--solid-success
.badge--solid-danger
```

원칙:

- 한 카드 안에서 강조 배지는 1~2개만 사용
- 긴 문장을 배지에 넣지 않는다
- 상태와 유형의 색상은 서비스 전체에서 동일하게 유지한다

### 6-2. 태그

태그는 게시글과 실전자료의 키워드를 표시한다.

사용 예:

```text
ClaudeCode
Cursor
n8n
PHP
AI자동화
수익화
MCP
```

클래스:

```text
.tag
.tag--filled
.tag--disabled
.tag__remove
```

기능:

- 기본 태그
- 강조 태그
- 클릭 가능한 태그
- 삭제 가능한 태그
- 비활성 태그

원칙:

- 목록에서는 너무 많은 태그를 노출하지 않는다
- 보통 2~4개만 보여주고 나머지는 생략 가능
- 클릭 시 태그 랜딩 페이지로 이동할 수 있다
- 등록 화면의 태그는 삭제 버튼을 포함할 수 있다

### 6-3. 칩

칩은 선택 가능한 필터다.

사용 예:

```text
전체
최신글
인기글
댓글 많은 글
답변대기
해결됨
```

클래스:

```text
.chip
.is-active
.is-soft-active
.chip__count
```

기능:

- 기본
- hover
- focus
- active
- soft active
- disabled
- 카운트 표시
- 아이콘 포함

원칙:

- 칩은 클릭 가능한 요소다
- 단순 상태 표시는 배지로 처리한다
- 게시판 상단의 가벼운 정렬·필터에 사용한다
- 페이지 구조를 크게 전환하는 기능은 탭으로 처리한다

---

## 7. 컴포넌트 구분 원칙

```text
Button
- 실행 행동

Badge
- 상태 또는 유형 표시

Tag
- 키워드 표시 및 태그 페이지 이동

Chip
- 가벼운 선택형 필터

Tab
- 콘텐츠 영역 또는 화면 전환

Select
- 하나의 옵션 선택

Input
- 텍스트 입력
```

이 구분을 무시하면 화면마다 역할이 섞이므로 반드시 유지한다.

---

## 8. 모바일 원칙

- 버튼은 필요 시 `.btn--full`로 전체 너비 처리
- 검색창과 검색 버튼은 모바일에서 세로 배치 가능
- 칩과 태그는 줄바꿈 또는 가로 스크롤 허용
- 셀렉트 드롭다운은 화면 밖으로 잘리지 않게 한다
- 터치 영역은 최소 36~44px 확보
- 아이콘 전용 버튼도 최소 36px 이상 유지
- hover에만 의존하는 기능을 만들지 않는다

---

## 9. 접근성 원칙

- 버튼은 `<button>` 요소 사용
- 링크 이동은 `<a>` 요소 사용
- 아이콘 전용 버튼에는 `aria-label`
- 커스텀 셀렉트는 `aria-haspopup`, `aria-expanded`, `role="listbox"`, `role="option"` 적용
- 키보드 포커스 표시 제거 금지
- 색상만으로 상태를 전달하지 않는다
- 위험·성공·대기 상태에는 텍스트 또는 아이콘을 함께 사용
- disabled 상태는 클릭 차단과 시각적 약화를 모두 적용

---

## 10. 현재까지 확정된 디자인 시스템

```text
완료
- 버튼
- 입력창
- 검색창
- 비밀번호 보기
- 커스텀 셀렉트
- 태그 입력
- Textarea
- 배지
- 태그
- 칩
- 탭
- 카드
- 게시글 리스트 아이템
- 페이지네이션
- 드롭다운·팝오버
- 모달
- 알림·토스트
- 파일 업로드
- 빈 상태
- 로딩·스켈레톤
- 툴팁
- 아코디언
- Breadcrumb
- 검색 자동완성
- 네비게이션
- 헤더 / 푸터
```

추가 확정 항목의 상세 기준은 다음 파일을 기준으로 삼는다.

```text
AI작당-디자인시스템-추가확정항목.md
ai-jakdang-layout-components.html
```

---

## 11. 다른 AI에게 전달할 작업 지침

아래 지침을 그대로 전달해도 된다.

```text
AI작당 디자인 시스템은 기존 HTML 컴포넌트 파일을 기준으로 구현한다.

1. 기존 색상, 모서리, 폰트, 상태값을 임의로 바꾸지 않는다.
2. 아이콘은 Remix Icon만 사용한다.
3. 버튼, 입력창, 배지, 태그, 칩은 기존 클래스 구조를 재사용한다.
4. 컴포넌트를 새로 만들 때 기존 CSS 변수를 우선 사용한다.
5. hover, active, focus, disabled 상태를 반드시 구현한다.
6. 모바일 반응형과 키보드 접근성을 포함한다.
7. 브라우저 기본 셀렉트 UI를 그대로 노출하지 않는다.
8. 같은 역할의 컴포넌트를 중복 생성하지 않는다.
9. 공통 CSS를 우선 분리하고 페이지별 CSS는 최소화한다.
10. 디자인을 변경할 때는 기존 디자인 시스템과 충돌 여부를 먼저 검토한다.
```

---

## 12. 권장 파일 구조

실제 프로젝트에 적용할 때는 다음처럼 분리하는 것을 권장한다.

```text
src/
├── styles/
│   ├── tokens.css
│   ├── base.css
│   └── components/
│       ├── button.css
│       ├── form.css
│       ├── select.css
│       ├── badge.css
│       ├── tag.css
│       └── chip.css
│
├── scripts/
│   ├── custom-select.js
│   ├── password-toggle.js
│   └── chip-filter.js
│
└── components/
    ├── Button
    ├── Input
    ├── CustomSelect
    ├── Badge
    ├── Tag
    └── Chip
```

현재 제공된 HTML 파일은 시각 확인과 CSS 추출을 위한 기준 파일이다.

---

## 13. 포함 파일

```text
AI작당-디자인시스템-인수인계.md
AI작당-디자인시스템-추가확정항목.md
AI작당-신규추가-디자인시스템.md
ai-jakdang-button-components.html
ai-jakdang-input-components-v2.html
ai-jakdang-badge-tag-chip-components.html
ai-jakdang-layout-components.html
ai-jakdang-new-components-system.html
```

---

## 14. 최종 기준

이 문서와 포함된 HTML 파일을 함께 기준으로 삼는다.

설명보다 실제 HTML/CSS 구현 결과가 우선이다.

다른 AI가 새 컴포넌트를 추가할 때는 현재 스타일을 확장해야 하며, 기존 디자인 시스템과 별개의 새로운 스타일을 임의로 만들면 안 된다.
