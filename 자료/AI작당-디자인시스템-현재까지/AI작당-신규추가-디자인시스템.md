# AI작당 신규 추가 항목 디자인 시스템

문서 작성일: 2026-06-16  
문서 목적: 기존 버튼, 입력창, 배지, 태그, 칩 외에 새로 추가한 UI 항목을 실제 서비스에서 일관되게 구현하기 위한 상세 기준

시각 기준 파일:

```text
ai-jakdang-new-components-system.html
```

---

## 1. 적용 원칙

이 문서의 모든 컴포넌트는 기존 디자인 시스템의 토큰을 따른다.

```text
Primary: #3030c0
Accent: #18c7b8
Surface: #ffffff
Background: #f7f8fc
Text: #171827
Sub text: #5f6473
Border: #e4e7f0
Radius: 8px / 12px / 16px
Icon: Remix Icon
Focus ring: 0 0 0 4px rgba(48, 48, 192, 0.14)
```

공통 상태:

```text
default
hover
active
focus
selected
disabled
loading
empty
error
success
```

---

## 2. 탭

### 유형

```text
밑줄형 탭
- 게시판, 자료 목록, 상세 화면 내 큰 콘텐츠 전환

세그먼트형 탭
- 같은 영역 안의 보기 방식, 정렬, 가벼운 모드 전환

아이콘·카운트 포함 탭
- 메뉴 의미가 명확하거나 수량 정보가 중요한 경우

모바일 가로 스크롤 탭
- 탭이 4개 이상이거나 텍스트가 길 때
```

### 클래스

```text
.tabs
.tabs--line
.tabs--segment
.tab
.tab.is-active
.tab__count
.tab-panel
```

### 접근성

- `role="tablist"`를 탭 그룹에 적용한다.
- 각 탭은 `role="tab"`과 `aria-selected`를 가진다.
- 키보드 방향키 이동을 지원한다.
- 활성 탭은 시각 상태와 ARIA 상태가 일치해야 한다.

---

## 3. 카드

### 유형

```text
일반 콘텐츠 카드
- 가이드, 팁, 사례 글 미리보기

실전자료 카드
- 파일 유형, 다운로드, 난이도, 태그를 포함

묻고답하기 카드
- 답변 상태, 질문 요약, 댓글/답변 수를 포함

관리자 요약 카드
- 숫자 지표를 요약하는 카드
- 추후 관리자 디자인 시스템에서 재정의 가능
```

### 클래스

```text
.card
.card--content
.card--resource
.card--question
.card--summary
.card--interactive
.card--compact
.card.is-selected
.card.is-disabled
.card__head
.card__title
.card__desc
.card__meta
.card__actions
.card__number
```

### 상태

```text
hover
- 클릭 가능한 카드에서만 사용

selected
- 선택 가능한 자료, 필터형 카드에서 사용

disabled
- 권한 없음, 준비 중, 비공개 상태에서 사용
```

### 원칙

- 카드 안의 핵심 제목은 2줄까지 허용한다.
- 카드 안의 배지는 1~2개만 강조한다.
- 카드 전체 클릭과 내부 버튼 클릭이 충돌하지 않게 한다.
- 카드 안에 다른 카드를 중첩하지 않는다.

---

## 4. 게시글 리스트 아이템

### 포함 요소

```text
상태 배지
제목
요약
태그
작성자
날짜
조회
댓글
이미지 아이콘
링크 아이콘
파일 아이콘
공지·추천·인기 상태
```

### 클래스

```text
.post-list
.post-item
.post-item__main
.post-item__status
.post-item__title
.post-item__excerpt
.post-item__icons
.post-item__meta
.post-item__side
.post-item__stat
```

### 고정 규칙

- `답변대기`, `해결됨`, `공지`, `추천`, `인기` 같은 상태 배지는 항상 제목 위 별도 줄에 둔다.
- 상태 배지를 제목이나 기타 텍스트와 같은 라인에 나란히 배치하지 않는다.
- 이미지·링크·파일 여부는 제목 아래의 아이콘 줄에 표시한다.
- 모바일에서는 우측 통계 영역을 제목 아래로 내린다.

---

## 5. 페이지네이션

### 포함 요소

```text
처음
이전
페이지 번호
현재 페이지
다음
마지막
모바일 축약형
```

### 클래스

```text
.pagination
.pagination--full
.pagination--compact
.page-btn
.page-btn--icon
.page-btn.is-active
```

### 원칙

- 현재 페이지는 `aria-current="page"`를 사용한다.
- 처음/마지막/이전/다음은 아이콘 버튼으로 구현한다.
- 모바일 축약형은 `현재 / 전체`과 이전·다음만 표시한다.
- 비활성 버튼은 `disabled`로 처리한다.

---

## 6. 드롭다운·팝오버

### 유형

```text
프로필 메뉴
더보기 메뉴
정렬 메뉴
알림 메뉴
정보 팝오버
```

### 클래스

```text
.dropdown
.dropdown.is-open
.dropdown__trigger
.dropdown__menu
.dropdown__item
.dropdown__divider
.dropdown__item--danger
.notification-menu
.popover
.popover__title
.popover__body
```

### 인터랙션

- 트리거 클릭 시 열고 닫는다.
- 바깥 클릭 시 닫는다.
- Esc 키로 닫는다.
- 방향키로 항목 이동, Enter/Space로 선택한다.
- 트리거의 `aria-expanded`를 상태와 동기화한다.

---

## 7. 모달

### 유형

```text
기본 확인 모달
삭제 경고 모달
신고 모달
로그인 유도 모달
모바일 하단 시트형
```

### 클래스

```text
.modal-backdrop
.modal
.modal--sm
.modal--md
.modal--lg
.modal--sheet
.modal__head
.modal__title
.modal__body
.modal__actions
```

### 원칙

- 데스크톱은 중앙 모달을 기본으로 한다.
- 모바일에서는 선택지 중심 모달을 하단 시트로 전환할 수 있다.
- 위험 작업은 Danger 버튼을 사용한다.
- 신고는 Warning 계열 버튼을 사용할 수 있다.
- 로그인 유도는 Primary 버튼을 사용한다.
- 모달 열림 중 배경 스크롤은 막는다.

---

## 8. 알림·토스트

### 유형

```text
성공
오류
경고
정보
자동 닫힘
액션 버튼 포함형
```

### 클래스

```text
.toast-stack
.toast
.toast--success
.toast--danger
.toast--warning
.toast--info
.toast__icon
.toast__content
.toast__action
.toast__close
```

### 원칙

- 기본 위치는 우측 하단이다.
- 모바일에서는 하단 중앙 또는 화면 폭에 맞춘다.
- 자동 닫힘은 3~5초를 기본으로 한다.
- 액션 버튼은 `되돌리기`, `다시 시도`, `저장`처럼 즉시 행동에만 사용한다.

---

## 9. 파일 업로드

### 유형

```text
클릭 업로드
드래그앤드롭
파일 목록
진행 상태
오류
삭제
확장자·용량 안내
```

### 클래스

```text
.upload
.upload.is-dragover
.upload__icon
.upload__title
.upload__desc
.upload__meta
.upload-list
.upload-file
.upload-file.is-error
.upload-file__info
.upload-file__progress
```

### 원칙

- 업로드 영역 전체를 클릭 가능하게 만든다.
- 확장자와 최대 용량을 항상 노출한다.
- 진행 중, 완료, 오류 상태를 명확히 표시한다.
- 파일 삭제 버튼에는 `aria-label`을 넣는다.

---

## 10. 빈 상태

### 유형

```text
게시글 없음
검색 결과 없음
답변 없음
자료 없음
```

### 클래스

```text
.empty
.empty__icon
.empty__title
.empty__desc
.empty__actions
```

### 원칙

- 제목은 현재 상태를 직접 말한다.
- 설명은 다음 행동을 짧게 안내한다.
- 버튼은 최대 1개를 primary로 둔다.

---

## 11. 로딩·스켈레톤

### 유형

```text
카드 로딩
리스트 로딩
버튼 로딩
페이지 전체 로딩
```

### 클래스

```text
.skeleton
.skeleton-card
.skeleton-list
.skeleton-line
.page-loading
.spinner
.is-loading
```

### 원칙

- 스켈레톤은 실제 콘텐츠 구조와 비슷한 크기로 만든다.
- 버튼 로딩 중에는 중복 클릭을 막는다.
- 페이지 전체 로딩은 스피너와 짧은 문구를 함께 쓴다.

---

## 12. 툴팁

### 유형

```text
아이콘 설명
관리자 기능 안내
```

### 클래스

```text
.tooltip
.tooltip__bubble
```

### 원칙

- hover와 focus 모두에서 보여야 한다.
- 필수 정보는 툴팁에만 넣지 않는다.
- 1문장 이하로 짧게 쓴다.

---

## 13. 아코디언

### 유형

```text
FAQ
필터 접기
모바일 상세 정보
```

### 클래스

```text
.accordion
.accordion__item
.accordion__trigger
.accordion__panel
```

### 원칙

- 트리거는 `<button>`으로 만든다.
- `aria-expanded`를 실제 열림 상태와 동기화한다.
- 모바일에서 긴 필터나 상세 정보 접기에 우선 사용한다.

---

## 14. Breadcrumb

### 목적

현재 위치를 보여주고, 검색 엔진이 콘텐츠 구조를 이해하도록 돕는다.

### 클래스

```text
.breadcrumb
.breadcrumb__link
.breadcrumb__item
```

### 원칙

- 홈에서 현재 페이지까지의 계층을 표시한다.
- 마지막 항목은 현재 페이지이며 링크로 만들지 않는다.
- 실제 구현 시 JSON-LD 또는 마이크로데이터 적용을 고려한다.

---

## 15. 검색 자동완성

### 유형

```text
최근 검색어
추천 태그
인기 검색어
키보드 선택
```

### 클래스

```text
.autocomplete
.autocomplete__menu
.autocomplete__group
.autocomplete__item
.autocomplete__item.is-active
```

### 인터랙션

- 입력 포커스 시 자동완성 메뉴를 연다.
- 방향키로 항목을 이동한다.
- Enter로 선택한다.
- Esc로 닫는다.
- 최근 검색어는 삭제 버튼을 제공할 수 있다.

---

## 16. 최종 기준

신규 추가 항목은 이 문서와 `ai-jakdang-new-components-system.html`을 우선 기준으로 삼는다.

기존 `AI작당-디자인시스템-추가확정항목.md`와 충돌할 경우, 신규 추가 항목에 한해서는 이 문서의 상세 기준을 우선한다.
