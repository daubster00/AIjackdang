# 관리자 프런트엔드 구조

문서 목적: 관리자 앱(`apps/admin`)이 사용자 사이트와 어떻게 분리되어 있는지, 폴더 구조, 가져오면 안 되는 코드,
추후 관리자 디자인 시스템을 추가할 위치, 실행 방법을 정리한다.

---

## 1. 관리자 앱이 독립된 이유

사용자 사이트와 관리자 페이지는 **서로 다른 디자인 시스템**을 사용한다. 따라서 다음을 절대 공유하지 않는다.

> 디자인 토큰 · 색상 체계 · 타이포그래피 · 간격 · 라운드 · 그림자 · CSS 파일 · UI 컴포넌트 ·
> 레이아웃 컴포넌트 · 반응형 규칙 · 아이콘 표현 규칙 · 버튼/입력/셀렉트/모달 디자인

이를 구조적으로 보장하기 위해 관리자 페이지를 사용자 사이트와 **별도의 Next.js 앱**(`apps/admin`)으로 분리했다.
사용자 사이트의 시각 자산을 import 할 경로가 애초에 없으므로, 실수로 섞일 가능성을 차단한다.

> 참고: 기술 스택 문서는 초기에 관리자를 `/admin` 경로로 같은 앱에 두는 안을 적었으나,
> "사용자/관리자 디자인 시스템 완전 분리" 지침(최신)에 따라 별도 앱으로 구성했다.

---

## 2. 폴더 구조

```text
apps/admin/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (admin 전역 CSS만 import)
│   ├── page.tsx            # / → /dashboard 리다이렉트
│   ├── login/
│   │   ├── page.tsx        # 관리자 로그인 자리(인증 단계에서 구현)
│   │   └── login.module.css
│   └── dashboard/
│       └── page.tsx        # 관리자 대시보드 자리
│
├── components/
│   ├── ui/                 # 관리자 전용 UI 컴포넌트 (현재 비어 있음 + README)
│   └── layout/
│       ├── AdminShell.tsx        # 관리자 기본 레이아웃 자리(사이드바/상단바)
│       └── AdminShell.module.css
│
├── features/               # 관리자 기능 모듈 (현재 비어 있음 + README)
├── hooks/                  # 관리자 전용 훅 (현재 비어 있음 + README)
├── lib/
│   └── api.ts              # API 베이스 URL + 공유 타입 재노출
├── styles/
│   ├── tokens/
│   │   └── placeholder.css # 관리자 토큰 자리표시(--admin-* 네임스페이스)
│   ├── base/
│   │   └── reset.css       # 최소 초기화 (사용자 사이트와 독립)
│   └── index.css           # 관리자 전역 CSS 진입점
├── next.config.ts          # transpilePackages: contracts, auth (비시각적만)
└── tsconfig.json
```

현재 단계에서 준비한 것:

- 독립적으로 실행 가능한 Next.js 관리자 앱
- 관리자 전용 라우팅(`/login`, `/dashboard`, `/` 리다이렉트)
- 관리자 전용 **빈/자리표시** 전역 CSS (`--admin-*` 중립 토큰)
- 관리자 전용 컴포넌트 폴더(`components/ui`, `components/layout`)
- 관리자 로그인 페이지 자리 / 기본 레이아웃 자리 / 대시보드 자리
- API 연결을 위한 기본 구조(`lib/api.ts`)

관리자 디자인은 임의로 상세 구현하지 않았고, 사용자 디자인 시스템을 복사하지도 않았다.

---

## 3. 사용자 사이트에서 가져오면 안 되는 코드

관리자 앱은 다음을 **import 하지 않는다.**

```text
apps/web/styles/*
apps/web/components/*
apps/web/features/*
```

관리자 앱이 공유받는 것은 **비시각적 패키지뿐이다.**

- `@ai-jakdang/contracts` — API 요청/응답 타입, Zod 스키마
- `@ai-jakdang/auth` — 권한 타입, `canAccessAdmin` 등 권한 검사 규칙

(`next.config.ts` 의 `transpilePackages` 에도 이 둘만 등록되어 있다.)

---

## 4. 관리자 디자인 시스템 (적용됨 — 재사용 가능 패키지)

관리자 디자인 시스템은 **프레임워크 비종속 패키지**로 구축되어 있다:
`packages/admin-design-system/` (순수 CSS + 바닐라 JS). 폴더째 복사하면 다른 프로젝트에도
그대로 이식 가능하며, 보통 `css/tokens/theme.css`(Primary 색상·브랜드)와 로고만 교체한다.

- 토큰: `packages/admin-design-system/css/tokens/` (`theme.css` = 교체 지점, `base.css` = 공통)
- 레이아웃/컴포넌트: `css/layout/`, `css/components/` (버튼·카드·폼·테이블·배지·알림·모달·드로어·토스트·차트)
- 인터랙션: `js/` (사이드바·셀렉트·오버레이·토스트·탭·태그입력·테이블·차트), 진입점 `initAdminUI()`
- 데모/확인 페이지: `packages/admin-design-system/demo/index.html`
- 자세한 사용·이식법: 해당 패키지 `README.md`

관리자 앱 연동:
- `apps/admin/app/layout.tsx` 가 `@ai-jakdang/admin-design-system/css` 와 `remixicon` 을 import
- `apps/admin/next.config.ts` 의 `transpilePackages` 에 디자인 시스템 등록(관리자 전용 시각 자산)
- `apps/admin/styles/index.css` 는 앱 전용 추가/덮어쓰기만 담당(디자인 시스템 다음에 로드)

> 사용자 사이트와는 여전히 완전히 분리된다. 이 패키지는 `apps/web` 어디에서도 import 하지 않는다.

---

## 5. 관리자 앱 실행 방법

```bash
pnpm dev:admin       # http://localhost:3004
pnpm build:admin     # 프로덕션 빌드
pnpm --filter @ai-jakdang/admin typecheck
```

- 사용자 사이트(3003), API(4003)와 **다른 포트(3004)** 로 독립 실행된다.
- 운영에서는 `admin` 서브도메인 등으로 사용자 사이트와 분리 배포한다(도메인은 환경변수로 관리).

---

## 6. 현재 적용 상태 / 미구현

- 적용됨: 독립 Next 앱, 라우팅, 자리표시 페이지, 비시각적 패키지 공유, 빌드/타입체크 통과
- 적용됨: **관리자 디자인 시스템 패키지**(`packages/admin-design-system`) 구축 + 관리자 앱 연동(빌드 통과)
- 사용자 사이트 디자인 시스템은 관리자 앱에 **적용하지 않음**(의도적)
- 미구현(이후 단계): 로그인/대시보드/AdminShell 을 디자인 시스템 컴포넌트로 교체(현재는 자리표시 + `--admin-*` 토큰 유지), 인증/권한 연동, 실제 데이터 연동, 권한별 메뉴
