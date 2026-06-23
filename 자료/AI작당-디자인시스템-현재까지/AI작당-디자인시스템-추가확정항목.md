# AI작당 디자인 시스템 추가 확정 항목

문서 작성일: 2026-06-16  
적용 범위: 기존 디자인 시스템에서 미정으로 남아 있던 사용자 사이트 화면 구조 및 공통 컴포넌트

---

## 1. 추가 확정 항목

이번 문서에서 다음 항목을 확정한다.

```text
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

실제 시각 기준 파일:

```text
ai-jakdang-layout-components.html
ai-jakdang-new-components-system.html
```

신규 추가 항목의 상세 디자인 시스템 문서:

```text
AI작당-신규추가-디자인시스템.md
```

---

## 2. 탭

탭은 콘텐츠 영역 또는 화면 단위 전환에 사용한다. 가벼운 필터는 칩을 사용하고, 화면 구조가 바뀌는 경우에만 탭을 사용한다.

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

### 포함 유형

```text
- 밑줄형 탭
- 세그먼트형 탭
- 아이콘·카운트 포함 탭
- 모바일 가로 스크롤 탭
```

### 원칙

- 탭은 `<button>`으로 구현한다.
- 활성 탭은 `is-active`와 `aria-selected="true"`를 함께 사용한다.
- 탭 목록에는 `role="tablist"`를 사용한다.
- 탭이 많아지면 모바일에서 가로 스크롤을 허용한다.
- 탭 안에 배지, 칩, 셀렉트를 중첩하지 않는다.
- 큰 화면 전환은 밑줄형 탭을 우선 사용한다.
- 같은 영역 안의 보조 보기 전환은 세그먼트형 탭을 사용한다.

---

## 3. 카드

카드는 목록에서 하나의 콘텐츠, 자료, 질문, 운영 항목을 묶는 단위다.

### 클래스

```text
.card
.card__head
.card__title
.card__desc
.card__meta
.card__actions
.card--interactive
.card--compact
.card--highlight
.card--resource
.card--question
.card--summary
.card.is-selected
.card.is-disabled
```

### 포함 유형

```text
- 일반 콘텐츠 카드
- 실전자료 카드
- 묻고답하기 카드
- 관리자 요약 카드
- hover 상태
- 선택 상태
- 비활성 상태
```

### 크기와 형태

```text
기본 radius: 12px
카드 padding: 20px
컴팩트 카드 padding: 16px
테두리: 1px solid var(--color-border)
배경: var(--color-surface)
```

### 원칙

- 카드 전체가 이동 링크이면 카드 내부 주요 제목을 링크로 처리한다.
- 카드 안의 강조 배지는 1~2개만 사용한다.
- 카드 내부 버튼은 우측 또는 하단 액션 영역에 둔다.
- 카드 안에 또 다른 카드형 박스를 넣지 않는다.
- 목록 화면에서는 그림자를 기본으로 쓰지 않고, 중요 패널에만 약한 그림자를 허용한다.
- 선택 가능한 카드는 `is-selected`로 테두리와 배경을 강화한다.
- 비활성 카드는 `is-disabled`로 투명도와 클릭 차단을 함께 적용한다.
- 관리자 요약 카드는 향후 관리자 디자인 시스템에서 재정의할 수 있으며, 현재는 카드 상태 예시로만 둔다.

---

## 4. 게시글 리스트 아이템

게시글 리스트는 커뮤니티 탐색 속도를 우선한다. 카드보다 밀도 있게 구성하되, 모바일에서는 제목과 메타 정보가 읽히도록 줄바꿈을 허용한다.

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

### 포함 정보

```text
- 게시판 또는 자료 유형 배지
- 제목
- 요약 또는 일부 본문
- 작성자
- 작성일
- 조회수
- 댓글 수
- 추천 수 또는 다운로드 수
- 태그 2~4개
- 이미지·링크·파일 아이콘
- 공지·추천·인기 상태
```

### 원칙

- 제목은 한 줄 또는 두 줄까지만 허용한다.
- 답변대기, 해결됨 같은 상태 배지는 항상 제목 위의 별도 줄에 배치한다.
- 상태 배지를 제목 또는 기타 텍스트와 같은 라인에 나란히 배치하지 않는다.
- 메타 정보는 낮은 대비 색상으로 표시한다.
- 댓글 수, 다운로드 수처럼 행동 판단에 필요한 수치는 우측 또는 하단에 고정한다.
- 답변대기, 해결됨 같은 상태는 배지로 표시한다.
- 공지, 추천, 인기 상태도 제목 위 별도 상태 줄에 배지로 표시한다.
- 이미지, 링크, 파일 첨부 여부는 제목 아래 또는 메타 줄 앞에 Remix Icon으로 표시한다.

---

## 5. 페이지네이션

페이지네이션은 게시판, 실전자료 목록에 공통 사용한다.

### 클래스

```text
.pagination
.page-btn
.page-btn.is-active
.page-btn--icon
.pagination--compact
```

### 포함 유형

```text
- 이전·다음
- 페이지 번호
- 현재 페이지
- 처음·마지막
- 모바일 축약형
```

### 원칙

- 이전/다음 버튼에는 Remix Icon을 사용한다.
- 처음/마지막 버튼에는 `ri-skip-left-line`, `ri-skip-right-line` 또는 동일 의미의 Remix Icon을 사용한다.
- 현재 페이지에는 `aria-current="page"`를 넣는다.
- 모바일에서는 처음/끝 이동 버튼을 생략할 수 있다.
- 모바일 축약형은 `현재 페이지 / 전체 페이지` 텍스트와 이전·다음 버튼으로 구성한다.
- 비활성 이전/다음 버튼은 `disabled`로 처리한다.
- 페이지 번호 버튼의 최소 터치 영역은 36px이다.

---

## 6. 드롭다운·팝오버

드롭다운은 메뉴 선택, 정렬, 사용자 메뉴에 사용한다. 팝오버는 짧은 보조 정보나 빠른 액션에 사용한다.

### 클래스

```text
.dropdown
.dropdown__trigger
.dropdown__menu
.dropdown__item
.dropdown__divider
.popover
.popover__title
.popover__body
.notification-menu
```

### 포함 유형

```text
- 프로필 메뉴
- 더보기 메뉴
- 정렬 메뉴
- 알림 메뉴
```

### 원칙

- 열림 상태는 `is-open`으로 관리한다.
- 트리거에는 `aria-expanded`를 넣는다.
- 메뉴 항목은 버튼 또는 링크로 명확히 구분한다.
- 바깥 클릭, Esc 키로 닫혀야 한다.
- 방향키, Enter, Space 키보드 조작을 지원한다.
- 위험 액션은 `dropdown__item--danger`로 표시한다.

---

## 7. 모달

모달은 삭제 확인, 신고 처리, 자료 승인, 로그인 유도처럼 사용자의 결정을 받아야 하는 상황에 사용한다.

### 클래스

```text
.modal-backdrop
.modal
.modal__head
.modal__title
.modal__body
.modal__actions
.modal--sm
.modal--md
.modal--lg
.modal--sheet
```

### 포함 유형

```text
- 기본 확인 모달
- 삭제 경고 모달
- 신고 모달
- 로그인 유도 모달
- 모바일 하단 시트형
```

### 크기

```text
Small: 420px
Medium: 560px
Large: 720px
```

### 원칙

- 화면 중앙에 배치한다.
- 닫기 버튼은 우측 상단에 둔다.
- 본문에는 핵심 메시지와 영향을 짧게 쓴다.
- 위험 작업은 Danger 버튼과 보조 취소 버튼을 함께 둔다.
- 모달이 열리면 배경 스크롤을 막는다.
- 키보드 포커스가 모달 밖으로 빠져나가지 않게 한다.
- 모바일 하단 시트형은 작은 화면에서만 사용하고, 데스크톱에서는 일반 모달을 우선한다.

---

## 8. 알림·토스트

토스트는 저장 완료, 복사 완료, 다운로드 시작, 오류 안내처럼 짧은 피드백에 사용한다.

### 클래스

```text
.toast-stack
.toast
.toast--success
.toast--warning
.toast--danger
.toast--info
.toast__icon
.toast__content
.toast__action
.toast__close
```

### 원칙

- 기본 위치는 우측 하단이다.
- 모바일에서는 하단 중앙에 배치한다.
- 성공, 경고, 오류, 정보 상태를 구분한다.
- 자동 닫힘은 3~5초를 기본으로 한다.
- 오류 토스트는 자동 닫힘을 길게 하거나 수동 닫기를 허용한다.
- 액션 버튼 포함형 토스트는 되돌리기, 다시 시도, 자세히 보기처럼 즉시 행동이 필요한 경우에만 사용한다.

---

## 9. 파일 업로드

파일 업로드는 실전자료 등록, 이미지 첨부에 사용한다.

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
.upload-file__info
.upload-file__progress
.upload-file.is-error
```

### 원칙

- 클릭 업로드와 드래그 앤 드롭을 모두 지원한다.
- 업로드 가능 확장자와 최대 용량을 명시한다.
- 진행률, 성공, 실패 상태를 표시한다.
- 삭제 버튼에는 `aria-label`을 넣는다.
- 파일명은 길어도 레이아웃을 깨지 않게 말줄임 처리한다.
- 오류 파일은 오류 메시지와 재시도 또는 삭제 액션을 함께 제공한다.

---

## 10. 빈 상태

빈 상태는 콘텐츠가 없거나 사용자가 검색·필터 결과를 얻지 못했을 때 사용한다.

### 클래스

```text
.empty
.empty__icon
.empty__title
.empty__desc
.empty__actions
```

### 포함 유형

```text
- 게시글 없음
- 검색 결과 없음
- 답변 없음
- 자료 없음
```

### 원칙

- 빈 상태는 원인과 다음 행동을 짧게 안내한다.
- 주요 행동이 있으면 버튼 1개만 primary로 둔다.
- 단순 안내만 필요한 경우 버튼 없이 텍스트와 아이콘만 둔다.

---

## 11. 로딩·스켈레톤

로딩은 데이터가 아직 도착하지 않았음을 보여준다.

### 클래스

```text
.skeleton
.skeleton-card
.skeleton-list
.page-loading
.is-loading
```

### 포함 유형

```text
- 카드 로딩
- 리스트 로딩
- 버튼 로딩
- 페이지 전체 로딩
```

### 원칙

- 카드와 리스트는 실제 레이아웃에 가까운 스켈레톤을 사용한다.
- 버튼 로딩은 기존 `.btn__spinner` 또는 `.spinner` 규칙을 따른다.
- 페이지 전체 로딩은 짧은 메시지와 스피너를 함께 제공한다.
- 로딩 중에는 중복 클릭을 막는다.

---

## 12. 툴팁

툴팁은 아이콘 버튼이나 짧은 보조 설명이 필요한 요소에 사용한다.

### 클래스

```text
.tooltip
.tooltip__bubble
```

### 포함 유형

```text
- 아이콘 설명
- 관리자 기능 안내
```

### 원칙

- 툴팁은 짧은 문장으로 쓴다.
- 중요한 정보나 필수 안내를 툴팁에만 의존하지 않는다.
- hover와 focus 둘 다에서 노출되어야 한다.
- 관리자 기능 안내는 향후 관리자 디자인 시스템에서 별도 확장할 수 있다.

---

## 13. 아코디언

아코디언은 접었다 펼치는 보조 정보에 사용한다.

### 클래스

```text
.accordion
.accordion__item
.accordion__trigger
.accordion__panel
```

### 포함 유형

```text
- FAQ
- 필터 접기
- 모바일 상세 정보
```

### 원칙

- 트리거에는 `aria-expanded`를 넣는다.
- 패널은 제목 바로 아래에 둔다.
- 모바일에서 긴 상세 정보를 숨길 때 우선 사용한다.

---

## 14. Breadcrumb

Breadcrumb는 현재 위치를 보여주고 SEO 구조와 연결한다.

### 클래스

```text
.breadcrumb
.breadcrumb__item
.breadcrumb__link
```

### 원칙

- 홈에서 현재 페이지까지의 계층을 표시한다.
- 마지막 항목은 링크가 아닌 현재 페이지 텍스트로 둔다.
- 구조화 데이터 적용을 고려한다.

---

## 15. 검색 자동완성

검색 자동완성은 검색창 입력 중 빠른 선택을 돕는다.

### 클래스

```text
.autocomplete
.autocomplete__menu
.autocomplete__group
.autocomplete__item
```

### 포함 유형

```text
- 최근 검색어
- 추천 태그
- 인기 검색어
- 키보드 선택
```

### 원칙

- 방향키로 항목 이동, Enter로 선택, Esc로 닫기를 지원한다.
- 최근 검색어는 삭제 액션을 제공할 수 있다.
- 추천 태그와 인기 검색어는 시각적으로 구분한다.

---

## 16. 네비게이션

네비게이션은 사용자 사이트의 주요 메뉴 이동에 사용한다. 관리자 페이지 네비게이션은 별도 디자인 시스템에서 다시 정한다.

### 사용자 사이트 메뉴

```text
바이브 코딩
AI 자동화
AI 수익화
묻고답하기
실전자료
작당 라운지
```

### 클래스

```text
.site-nav
.site-nav__link
.site-nav__link.is-active
```

### 원칙

- 활성 메뉴는 `is-active`로 표시한다.
- 사용자 사이트는 상단 가로 메뉴를 기본으로 한다.
- 모바일 사용자 사이트는 메뉴 버튼으로 접는다.
- 관리자 페이지 네비게이션 규칙은 이 문서에 포함하지 않는다.

---

## 17. 헤더 / 푸터

### 헤더

헤더는 브랜드, 주요 메뉴, 검색, 로그인/회원 액션을 담는다.

클래스:

```text
.site-header
.site-header__inner
.site-logo
.site-actions
.mobile-menu-btn
```

원칙:

- 로고는 좌측에 둔다.
- 주요 메뉴는 중앙 또는 로고 우측에 둔다.
- 검색과 로그인/글쓰기 액션은 우측에 둔다.
- 핵심 CTA는 한 개만 primary로 표시한다.
- 모바일에서는 로고, 검색 아이콘, 메뉴 버튼을 우선 노출한다.

### 푸터

푸터는 서비스 정보, 운영 정책, 문의 링크를 담는다.

클래스:

```text
.site-footer
.site-footer__inner
.site-footer__links
.site-footer__meta
```

원칙:

- 푸터는 본문보다 낮은 대비로 처리한다.
- 링크는 개인정보처리방침, 이용약관, 문의, 광고 문의를 포함할 수 있다.
- 푸터에 과도한 장식 요소를 넣지 않는다.

---

## 18. 공통 상태 규칙

모든 신규 컴포넌트는 다음 상태를 기본으로 고려한다.

```text
default
hover
active
focus
disabled
loading
empty
error
success
```

상태가 불필요한 컴포넌트라도 hover, focus, disabled 가능성은 먼저 검토한다.

---

## 19. 구현 우선순위

실제 프로젝트에 적용할 때는 다음 순서로 구현한다.

```text
1. 헤더 / 네비게이션 / 푸터
2. 카드 / 게시글 리스트 아이템
3. 탭 / 페이지네이션
4. 드롭다운 / 팝오버
5. 모달 / 토스트
6. 파일 업로드
7. 빈 상태 / 로딩·스켈레톤
8. 툴팁 / 아코디언 / Breadcrumb / 검색 자동완성
```

---

## 20. 최종 기준

이 문서는 기존 `AI작당-디자인시스템-인수인계.md`를 대체하지 않고 확장한다.

기존에 확정된 버튼, 입력창, 셀렉트, 배지, 태그, 칩 규칙은 그대로 유지한다. 새 컴포넌트는 기존 색상, 폰트, radius, focus ring, Remix Icon 정책을 반드시 따른다.

관리자 페이지 전용 컴포넌트와 운영 화면 레이아웃은 이 문서에서 확정하지 않는다. 관리자 디자인 시스템은 별도 문서에서 다시 정한다.
