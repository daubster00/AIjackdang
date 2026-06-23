# AI작당 기술 스택 기준 문서

문서 작성일: 2026-06-16  
프로젝트명: AI작당 (AI Jakdang)  
문서 목적: AI작당 웹 서비스와 향후 모바일 앱 개발에 사용할 기술 스택, 외부 라이브러리, 아키텍처 원칙을 정리한 기준 문서

---

## 1. 문서 사용 원칙

이 문서는 AI작당 개발에서 사용할 기술 스택의 기준 문서이다.

다른 AI, 새로운 개발 세션 또는 외부 개발자가 프로젝트를 이어받을 경우 이 문서를 먼저 확인한다.

기존 기술 검토안과 이 문서가 충돌하면 이 문서를 우선한다.

다만 라이브러리의 패치 및 마이너 버전은 설치 시점의 안정 버전을 사용하고, 메이저 버전을 변경할 때는 호환성과 마이그레이션 비용을 검토한 뒤 문서를 갱신한다.

---

## 2. 기술 방향 최종 결론

AI작당은 PHP와 Laravel을 사용하지 않는다.

웹과 관리자 페이지는 React 기반으로 자체 개발하고, 향후 React Native 앱에서 API, 타입, 인증 규칙, 데이터 검증 규칙과 비즈니스 로직을 공유할 수 있도록 설계한다.

```text
웹 사용자 화면
- Next.js + React + TypeScript

관리자 화면
- 동일한 Next.js 프로젝트 안에서 자체 React UI로 개발
- Filament, MUI, Ant Design 같은 관리자 UI 프레임워크 사용 안 함

백엔드
- Fastify + TypeScript 기반 독립 REST API

백그라운드 작업
- Redis + BullMQ Worker

데이터베이스
- PostgreSQL + Drizzle ORM

향후 모바일 앱
- React Native + Expo

디자인
- 자체 CSS 디자인 시스템
- Tailwind CSS 및 외부 UI 프레임워크 사용 안 함
```

---

## 3. 핵심 개발 원칙

### 3-1. 자체 개발할 영역

AI작당의 서비스 경쟁력과 직접 관련된 부분은 자체 개발한다.

```text
- 사용자 사이트 디자인
- 관리자 페이지 디자인
- 버튼, 입력창, 셀렉트, 모달, 탭, 배지
- 게시판 목록 및 상세 화면
- 글쓰기 화면
- 묻고답하기 구조
- 실전자료 등록 및 다운로드 구조
- 댓글과 후기
- 좋아요와 평점
- 신고 처리 흐름
- 포인트, 등급, 뱃지
- 광고 관리
- 관리자 통계 화면
- 검색 결과 화면
- 서비스 운영 로직
```

### 3-2. 외부 기반 기술을 사용할 영역

직접 개발하면 보안 위험이 크거나 개발 비용만 증가하는 기반 기능은 검증된 외부 라이브러리를 사용한다.

```text
- React 렌더링
- 서버 렌더링
- HTTP 서버
- 데이터베이스 드라이버
- ORM 및 마이그레이션
- 데이터 검증
- 회원 인증
- 비밀번호 해시
- 암호화
- 파일 저장 SDK
- 이미지 변환
- 본문 편집 엔진
- 차트 렌더링
- 작업 큐
- 이메일 전송
- 테스트 도구
```

### 3-3. 외부 라이브러리 선택 기준

```text
1. 디자인을 강제로 결정하지 않아야 한다.
2. TypeScript를 안정적으로 지원해야 한다.
3. React 또는 Node.js 생태계에서 널리 사용되어야 한다.
4. 유지보수가 활발해야 한다.
5. 향후 React Native 앱과 로직을 공유하기 쉬워야 한다.
6. 교체가 필요한 경우 서비스 전체를 다시 만들지 않아도 되어야 한다.
7. AI가 코드 구조와 사용 방식을 이해하기 쉬워야 한다.
```

---

## 4. 전체 시스템 구조

```text
사용자 브라우저
     │
     ▼
Next.js 웹 서버
- 공개 페이지 서버 렌더링
- 사용자 페이지
- 관리자 페이지
- SEO 메타데이터
     │
     ▼
Fastify REST API
- 인증
- 게시판
- 묻고답하기
- 실전자료
- 댓글
- 회원
- 관리자 기능
     │
     ├──────────────► PostgreSQL
     │                 서비스 데이터 저장
     │
     ├──────────────► Redis
     │                 캐시, 요청 제한, 작업 큐
     │
     ├──────────────► S3 호환 스토리지
     │                 이미지, 자료 파일 저장
     │
     └──────────────► BullMQ Worker
                       이미지 변환, 이메일, 통계 집계
```

### 구조 원칙

```text
- 웹 화면과 API 서버를 분리한다.
- 데이터베이스는 API와 Worker만 직접 접근한다.
- Next.js에서 데이터베이스를 직접 조회하지 않는다.
- 웹과 향후 앱은 동일한 REST API를 사용한다.
- 공통 타입과 입력 검증 규칙은 하나의 패키지에서 공유한다.
- 관리자 페이지도 사용자 페이지와 같은 React 기반으로 자체 개발한다.
```

---

## 5. 실행 환경 및 공통 언어

### 확정 기술

```text
Node.js 24 LTS
TypeScript
pnpm
pnpm workspace
```

### 역할

```text
Node.js
- Next.js, Fastify, Worker 실행 환경

TypeScript
- 웹, API, Worker, 공통 패키지 전체의 공통 언어

pnpm
- 패키지 설치 및 버전 관리

pnpm workspace
- 웹, API, Worker, 공통 패키지를 하나의 저장소에서 관리
```

### 설치 원칙

```text
- Node.js는 LTS 버전을 사용한다.
- 의존성은 package.json에 정확한 버전 범위를 기록한다.
- pnpm-lock.yaml을 Git에 포함한다.
- 운영 배포에서는 lock 파일 기준으로 설치한다.
- 메이저 버전 자동 업데이트는 허용하지 않는다.
```

---

## 6. 모노레포 구조

초기에는 pnpm workspace만 사용한다.

Turborepo와 Nx는 빌드 시간이 실제 문제가 되기 전까지 도입하지 않는다.

```text
ai-jakdang/
├── apps/
│   ├── web/
│   │   ├── 사용자 사이트
│   │   └── 관리자 사이트
│   │
│   ├── api/
│   │   └── Fastify REST API
│   │
│   └── worker/
│       └── BullMQ 백그라운드 작업
│
├── packages/
│   ├── ui/
│   │   └── 자체 React UI 컴포넌트
│   │
│   ├── styles/
│   │   └── 디자인 토큰과 공통 CSS
│   │
│   ├── contracts/
│   │   └── Zod API 입력 및 응답 규격
│   │
│   ├── database/
│   │   └── Drizzle 스키마와 데이터 접근 코드
│   │
│   ├── core/
│   │   └── 공통 비즈니스 규칙과 유틸리티
│   │
│   └── config/
│       └── TypeScript, ESLint, Vitest 공통 설정
│
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

---

## 7. 웹 프론트엔드

### 확정 기술

```text
Next.js 16
React 19
TypeScript
```

설치 시에는 해당 메이저 버전의 최신 안정 패치 버전을 사용한다.

### Next.js 역할

```text
- 공개 페이지 서버 렌더링
- 게시글 목록 및 상세 페이지
- 묻고답하기 목록 및 상세 페이지
- 실전자료 목록 및 상세 페이지
- 태그 페이지
- 회원가입 및 로그인 화면
- 마이페이지
- 관리자 페이지 화면
- SEO title과 description
- Open Graph 메타데이터
- sitemap.xml
- robots.txt
- JSON-LD 구조화 데이터 출력
```

### 렌더링 원칙

```text
공개 콘텐츠
- 서버 렌더링 또는 정적 생성 우선

회원 전용 화면
- 서버 렌더링과 클라이언트 렌더링을 목적에 맞게 혼합

관리자 화면
- 클라이언트 인터랙션 비중이 높아도 됨

검색엔진에 노출될 필요가 없는 기능
- 클라이언트 컴포넌트 사용 가능
```

### Next.js에서 하지 않을 일

```text
- 데이터베이스 직접 접근
- 핵심 서비스 로직 처리
- 파일 이미지 변환
- 통계 배치 처리
- 이메일 직접 발송
- 작업 큐 실행
```

---

## 8. CSS 및 자체 디자인 시스템

### 확정 기술

```text
CSS Modules
전역 CSS 변수
Native CSS Nesting
Remix Icon
```

### 사용하지 않을 기술

```text
- Tailwind CSS
- Sass
- styled-components
- Emotion
- Bootstrap
- MUI
- Ant Design
- Chakra UI
- shadcn/ui
```

### 디자인 시스템 구조

```text
packages/styles/
├── tokens.css
├── reset.css
├── typography.css
├── utilities.css
└── themes.css
```

### 디자인 토큰 예시

```css
:root {
  --color-primary: #4f46e5;
  --color-accent: #14b8a6;

  --color-text-primary: #171717;
  --color-text-secondary: #666666;
  --color-border: #e5e7eb;
  --color-surface: #ffffff;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
}
```

### 자체 제작 UI 컴포넌트

```text
Button
IconButton
Input
Textarea
Select
Checkbox
Radio
Switch
Modal
Dialog
Dropdown
Tabs
Badge
Tooltip
Pagination
Table
EmptyState
Loading
Toast
FileUploader
ImageUploader
DatePicker
SearchInput
FilterPanel
```

외부 UI 라이브러리의 컴포넌트를 가져오지 않고, AI작당 디자인 시스템에 맞게 직접 개발한다.

---

## 9. 관리자 페이지

### 확정 방향

```text
- Next.js 프로젝트 안의 /admin 영역으로 개발
- React와 자체 CSS 컴포넌트 사용
- 사용자 사이트와 UI 패키지를 일부 공유
- 관리자 전용 테이블, 필터, 폼, 차트를 직접 개발
```

### 사용하지 않을 시스템

```text
- Filament
- React Admin
- Refine
- AdminJS
- MUI 관리자 템플릿
- 유료 관리자 템플릿
```

### 관리자 자체 개발 범위

```text
- 관리자 로그인
- 관리자 레이아웃
- 좌측 메뉴
- 대시보드
- 통계 차트
- 데이터 테이블
- 검색 및 필터
- 등록 및 수정 폼
- 공개, 숨김, 삭제 상태 처리
- 일괄 작업
- 관리자 확인 모달
- 권한별 메뉴 접근
```

---

## 10. API 서버

### 확정 기술

```text
Fastify 5
TypeScript
REST API
OpenAPI
```

### 주요 패키지

```text
fastify
@fastify/cors
@fastify/cookie
@fastify/helmet
@fastify/rate-limit
@fastify/multipart
@fastify/swagger
@fastify/swagger-ui
fastify-type-provider-zod
```

### 주요 역할

```text
- 회원가입과 로그인
- 사용자 세션 검증
- 권한 검사
- 게시글 등록, 조회, 수정, 삭제
- 묻고답하기 질문과 답변
- 실전자료 등록과 다운로드
- 댓글과 후기
- 좋아요와 평점
- 태그와 검색
- 신고 처리
- 포인트, 등급, 뱃지
- 광고 관리
- 관리자 API
- 이벤트 기록
```

### API 경로 원칙

```text
/api/v1/auth/*
/api/v1/posts/*
/api/v1/questions/*
/api/v1/resources/*
/api/v1/comments/*
/api/v1/tags/*
/api/v1/members/*
/api/v1/reports/*
/api/v1/admin/*
```

### API 규칙

```text
- REST 구조를 사용한다.
- 모든 API는 /api/v1 버전 경로를 가진다.
- 요청과 응답은 Zod 스키마로 정의한다.
- 오류 응답 형식을 통일한다.
- 페이지네이션 형식을 통일한다.
- 관리자 API는 별도 권한 검사를 수행한다.
- 앱도 같은 API를 사용한다.
```

### 사용하지 않을 방식

```text
- GraphQL
- tRPC
- Next.js Server Action에 핵심 API 종속
- 클라이언트에서 데이터베이스 직접 접근
```

---

## 11. 데이터베이스

### 확정 기술

```text
PostgreSQL 18
Drizzle ORM
node-postgres
Drizzle Kit
```

설치 시에는 PostgreSQL 18의 최신 안정 마이너 버전을 사용한다.

### PostgreSQL 선택 이유

```text
- 관계형 커뮤니티 데이터 처리에 적합하다.
- 복잡한 집계와 통계 쿼리를 작성하기 좋다.
- JSONB를 활용할 수 있다.
- 전문 검색과 인덱스 기능이 강하다.
- 장기적으로 데이터 규모가 커져도 대응하기 좋다.
```

### Drizzle ORM 선택 이유

```text
- SQL 구조가 코드에서 명확하게 보인다.
- 과도한 추상화가 적다.
- TypeScript 타입을 제공한다.
- 복잡한 SQL을 직접 작성하기 쉽다.
- 생성된 마이그레이션 SQL을 직접 검토할 수 있다.
- AI가 데이터 구조와 쿼리를 이해하기 쉽다.
```

### 데이터베이스 운영 원칙

```text
- 모든 스키마는 packages/database에서 관리한다.
- DB 테이블명과 컬럼명은 snake_case를 사용한다.
- 코드 타입은 camelCase를 사용해도 된다.
- 운영 DB 변경은 마이그레이션 SQL로만 처리한다.
- 운영 환경에서 drizzle-kit push를 직접 실행하지 않는다.
- 마이그레이션 SQL을 검토한 뒤 적용한다.
- 중요한 변경 전에는 백업한다.
```

### 기본 명령 흐름

```text
개발
- drizzle-kit generate
- 생성된 SQL 검토
- drizzle-kit migrate

운영
- Git에 포함된 마이그레이션 SQL 확인
- DB 백업
- migrate 실행
```

---

## 12. 데이터 검증과 API 공통 타입

### 확정 기술

```text
Zod 4
fastify-type-provider-zod
```

### 역할

```text
- 웹 폼 입력 검증
- API 요청 검증
- API 응답 규격
- 관리자 폼 검증
- 향후 React Native 앱 입력 검증
- TypeScript 타입 생성
```

### 디렉터리 예시

```text
packages/contracts/
├── auth.ts
├── post.ts
├── question.ts
├── resource.ts
├── comment.ts
├── member.ts
├── report.ts
└── admin.ts
```

### 예시

```ts
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().trim().min(2).max(150),
  content: z.record(z.string(), z.unknown()),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
```

### 원칙

```text
- 같은 입력 규칙을 웹과 API에서 중복 작성하지 않는다.
- 클라이언트 검증만 신뢰하지 않는다.
- API 서버에서 반드시 다시 검증한다.
- DB 입력 전 서버 검증을 거친다.
```

---

## 13. 인증과 암호화

### 확정 기술

```text
Better Auth
@node-rs/argon2
Node.js crypto
```

### 역할 구분

```text
Better Auth
- 회원가입
- 이메일 및 비밀번호 로그인
- 이메일 인증
- 비밀번호 재설정
- 소셜 로그인
- 세션 관리
- 웹과 향후 Expo 앱 인증 연동

@node-rs/argon2
- 비밀번호 Argon2id 해시

Node.js crypto
- 보안 토큰 생성
- 필요한 민감 데이터의 AES-256-GCM 암호화
```

### 인증 원칙

```text
웹
- HttpOnly Cookie 세션
- Secure Cookie
- SameSite 설정
- CSRF 또는 Origin 검증

모바일 앱
- 동일한 인증 서버 사용
- Expo SecureStore에 필요한 인증 정보 저장

비밀번호
- 복호화 가능한 암호화 금지
- Argon2id 단방향 해시 사용

토큰
- crypto.randomBytes 등 안전한 난수 생성 사용

로그인 보호
- IP 및 계정 기준 요청 제한
- 반복 실패 기록
- 관리자 로그인은 더 강한 제한 적용
```

### 금지 사항

```text
- 자체 JWT 인증 시스템 개발
- 비밀번호 평문 저장
- 비밀번호 AES 암호화 저장
- localStorage에 웹 인증 토큰 저장
- 클라이언트 권한 값만 믿고 관리자 기능 허용
```

---

## 14. 폼과 서버 데이터 상태

### 확정 기술

```text
React Hook Form
@hookform/resolvers
Zod
TanStack Query
```

### React Hook Form 사용 영역

```text
- 회원가입
- 로그인
- 글쓰기
- 질문 작성
- 실전자료 등록
- 댓글 및 답변
- 프로필 수정
- 관리자 등록 및 수정 폼
```

### TanStack Query 사용 영역

```text
- 관리자 데이터 목록
- 댓글과 답변
- 좋아요 상태
- 평점 상태
- 검색 필터
- 마이페이지 활동 내역
- 실전자료 다운로드 요청
- 관리자 상태 변경
```

### 사용 원칙

```text
- 공개 게시글 목록과 상세 페이지는 서버 렌더링 우선
- 모든 데이터를 TanStack Query로 가져오지 않는다.
- 사용자 액션 이후 갱신되는 데이터에 TanStack Query를 사용한다.
- Zod 스키마를 React Hook Form과 API가 공유한다.
```

---

## 15. 파일 업로드와 저장

### 확정 기술

```text
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
@fastify/multipart
file-type
```

### 저장 대상

```text
- 게시글 이미지
- 프로필 이미지
- 실전자료 ZIP, MD, TXT, JSON, PDF, DOCX, XLSX
- 광고 이미지
- 뱃지 이미지
- 사이트 로고와 OG 이미지
```

### 스토리지 구조

```text
public/
├── posts/
├── profiles/
├── badges/
├── ads/
└── site/

private/
└── resources/
```

### 공개 파일

```text
- 게시글 이미지
- 프로필 이미지
- 광고 이미지
- 뱃지 이미지
- 사이트 이미지
```

### 비공개 파일

```text
- 실전자료 다운로드 파일
```

### 다운로드 흐름

```text
1. 사용자가 다운로드 버튼을 누른다.
2. API가 자료 공개 상태와 사용자 권한을 확인한다.
3. 다운로드 이벤트를 기록한다.
4. 만료시간이 짧은 서명 URL을 발급한다.
5. 사용자가 스토리지에서 파일을 내려받는다.
```

### 파일 검증 원칙

```text
- 확장자 확인
- MIME 타입 확인
- 파일 시그니처 확인
- 파일 크기 제한
- 무작위 저장 파일명 사용
- 원본 파일명은 DB에 별도 보관
- PHP, EXE, BAT, SH 등 실행 가능 파일 차단
- SVG는 기본적으로 업로드를 제한하거나 정제 후 사용
- 브라우저에서 실행되지 않도록 다운로드 헤더 설정
```

### 스토리지 선택 원칙

S3 호환 API를 사용하여 다음 서비스 중 하나를 선택할 수 있게 한다.

```text
- AWS S3
- Cloudflare R2
- MinIO
- 기타 S3 호환 오브젝트 스토리지
```

애플리케이션 코드는 특정 업체에 강하게 종속되지 않게 작성한다.

---

## 16. 이미지 처리 엔진

### 확정 기술

```text
Sharp
```

### 처리 기능

```text
- EXIF 방향 보정
- 불필요한 메타데이터 제거
- 최대 해상도 제한
- 비율 유지 리사이징
- 정사각형 크롭
- WebP 변환
- 썸네일 생성
- OG 이미지 생성
```

### 권장 이미지 규격

```text
프로필 이미지
- 160×160 WebP
- 320×320 WebP

게시글 이미지
- 최대 너비 1600px
- 원본 비율 유지
- WebP 출력

관리자 목록 썸네일
- 최대 너비 320px

OG 이미지
- 1200×630
```

### 처리 흐름

```text
파일 업로드
→ 원본 임시 저장
→ BullMQ 이미지 처리 작업 등록
→ Sharp Worker가 변환
→ 완성 파일을 스토리지에 저장
→ DB 상태를 완료로 변경
→ 임시 파일 삭제
```

이미지 변환 작업을 API 요청 안에서 오래 실행하지 않는다.

---

## 17. 본문 에디터

### 확정 기술

```text
Tiptap 3
ProseMirror
lowlight
highlight.js
```

### 선택 이유

Tiptap은 화면 디자인이 포함되지 않은 headless 에디터다.

따라서 에디터 툴바, 버튼, 드롭다운과 색상 선택 UI를 AI작당 디자인 시스템에 맞게 직접 제작할 수 있다.

### 사용할 확장 패키지

```text
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-image
@tiptap/extension-link
@tiptap/extension-highlight
@tiptap/extension-color
@tiptap/extension-code-block-lowlight
lowlight
highlight.js
```

### 활성화 기능

```text
- 굵게
- H2
- H3
- 순서 목록
- 비순서 목록
- 링크
- 이미지
- 코드블록
- 인용
- 제한된 폰트 색상
- 형광펜
- 실행 취소
- 다시 실행
```

### 비활성화 기능

```text
- 표
- 자유 글자 크기
- 폰트 변경
- 자유 색상 팔레트
- 컬럼 레이아웃
- HTML 직접 입력
- 임의 script 또는 iframe 삽입
```

### 본문 저장 방식

```text
content_json
- Tiptap 원본 JSON

content_text
- 검색, 요약, 통계에 사용하는 일반 텍스트
```

HTML을 원본 데이터로 저장하지 않는다.

필요하면 서버에서 Tiptap JSON을 안전한 HTML로 변환하거나 React 컴포넌트로 렌더링한다.

---

## 18. 코드블록

### 확정 기술

```text
Tiptap CodeBlockLowlight
lowlight
highlight.js
```

### 기능

```text
- 코드 언어 선택
- 문법 색상 강조
- 줄바꿈 보존
- 들여쓰기 보존
- 가로 스크롤
- 코드 복사 버튼
- HTML과 script 실행 차단
```

사용자가 입력한 코드 문자열은 화면에 텍스트로만 렌더링하며 실행하지 않는다.

---

## 19. 관리자 통계 차트

### 확정 기술

```text
Recharts 3
```

### 사용 차트

```text
방문자 추이
- LineChart

회원가입 추이
- LineChart

실전자료 다운로드 추이
- LineChart

유입 경로
- BarChart

게시판별 활동
- BarChart

광고 성과
- BarChart

자료 유형 비중
- PieChart
```

### 사용 원칙

Recharts의 기본 디자인을 그대로 사용하지 않는다.

자체 컴포넌트로 감싸서 디자인 시스템을 적용한다.

```text
VisitorChart
MemberSignupChart
DownloadChart
ReferralChart
ContentActivityChart
AdPerformanceChart
ResourceTypeChart
```

차트 색상, 글꼴, 툴팁, 범례, 축과 반응형 동작을 AI작당 관리자 디자인에 맞춘다.

---

## 20. 캐시와 백그라운드 작업

### 확정 기술

```text
Redis
BullMQ
```

### Redis 사용 영역

```text
- API 요청 제한
- 인기글 캐시
- 조회수 임시 집계
- 검색어 자동완성 캐시
- 관리자 대시보드 캐시
- BullMQ 작업 큐 저장소
- 중복 이벤트 방지용 단기 키
```

### BullMQ Worker 작업

```text
- 이미지 리사이징 및 변환
- 이메일 발송
- 사이트맵 생성
- 일별 통계 집계
- 인기글 점수 계산
- 실전자료 다운로드 통계 집계
- 포인트 자동 지급
- 등급 자동 갱신
- 뱃지 자동 지급
- 임시 파일 삭제
- 외부 통계 데이터 동기화
```

### 프로세스 분리

```text
apps/api
- HTTP 요청 처리

apps/worker
- 오래 걸리는 백그라운드 작업 처리
```

API 서버가 무거운 작업 때문에 느려지지 않게 한다.

---

## 21. 이메일 발송

### 확정 기술

```text
Nodemailer
SMTP
BullMQ
```

### 사용 영역

```text
- 이메일 인증
- 비밀번호 재설정
- 중요한 계정 알림
- 신고 처리 알림
- 관리자 알림
- 운영 공지
```

### 발송 흐름

```text
API에서 이메일 작업 등록
→ BullMQ Worker 실행
→ Nodemailer가 SMTP 발송
→ 성공 또는 실패 기록
```

API 요청 중 SMTP 발송 완료를 기다리지 않는다.

SMTP 설정만 변경하면 이메일 공급자를 교체할 수 있게 한다.

---

## 22. 검색 기술

초기 검색은 PostgreSQL 기능을 사용한다.

별도 검색 서버는 MVP에 도입하지 않는다.

### 초기 검색 대상

```text
- 게시글 제목
- 게시글 본문 일반 텍스트
- 질문 제목과 본문
- 실전자료 이름
- 실전자료 한 줄 설명
- 태그
- 작성자 닉네임
```

### 초기 구현 방향

```text
- PostgreSQL Full Text Search
- 필요한 경우 pg_trgm 확장
- 검색용 정규화 컬럼과 인덱스 사용
```

### 별도 검색엔진 검토 시점

```text
- 게시글과 자료가 크게 증가한 경우
- 오타 교정이 필요한 경우
- 자동완성 품질이 부족한 경우
- 검색 결과 정렬 품질을 개선해야 하는 경우
- 검색 부하가 PostgreSQL 성능에 영향을 주는 경우
```

그때 Meilisearch, Typesense 또는 OpenSearch를 별도로 검토한다.

---

## 23. 테스트 도구

### 확정 기술

```text
Vitest
React Testing Library
Playwright
```

### 역할 구분

```text
Vitest
- 유틸리티 함수
- 비즈니스 로직
- Zod 스키마
- API 서비스 로직
- Fastify 통합 테스트

React Testing Library
- React UI 컴포넌트
- 폼 동작
- 접근성 중심 사용자 동작

Playwright
- 실제 브라우저 E2E 테스트
- Chromium
- Firefox
- WebKit
- 모바일 화면 크기 테스트
```

### 반드시 자동화할 핵심 시나리오

```text
- 회원가입
- 이메일 및 비밀번호 로그인
- 로그아웃
- 비밀번호 재설정
- 글 작성, 수정, 삭제
- 질문 작성
- 답변 작성
- 도움된 답변 지정
- 실전자료 등록
- 자료 파일 다운로드
- 허용되지 않은 파일 업로드 차단
- 댓글과 후기 작성
- 좋아요와 평점
- 신고 등록
- 관리자 로그인
- 관리자 권한 검사
- 글, 자료, 댓글 숨김 및 삭제
- 포인트 지급
- 광고 노출 및 클릭 기록
```

### 테스트 원칙

```text
- 모든 화면을 완벽하게 자동화하려 하지 않는다.
- 회원, 게시글, 질문, 자료, 관리자 권한처럼 치명적인 흐름을 우선한다.
- 버그가 발생한 기능은 수정과 함께 회귀 테스트를 추가한다.
```

---

## 24. 코드 품질 도구

### 확정 기술

```text
ESLint
Prettier
TypeScript strict mode
```

### 기본 원칙

```text
- TypeScript strict를 활성화한다.
- any 사용을 최소화한다.
- 명시적 이유 없이 eslint-disable을 사용하지 않는다.
- 공통 ESLint 설정은 packages/config에서 관리한다.
- Prettier는 코드 형식만 담당한다.
- 비즈니스 규칙 검증은 ESLint가 아니라 테스트로 보장한다.
```

### Git 커밋 전 검사

초기에는 별도 도구를 과도하게 추가하지 않고 다음 명령을 기준으로 한다.

```text
pnpm lint
pnpm typecheck
pnpm test
```

프로젝트가 안정된 뒤 필요하면 lint-staged와 Husky를 검토한다.

---

## 25. 로깅 및 오류 추적

초기에는 다음 원칙으로 구성한다.

```text
- Fastify 기본 로거인 Pino 사용
- 요청 ID 부여
- 사용자에게 내부 오류 상세를 노출하지 않음
- API 오류 코드와 사용자 메시지 분리
- 관리자 작업 로그 기록
- 인증 실패와 권한 실패 기록
```

외부 오류 추적 서비스는 실제 운영 배포 단계에서 Sentry를 검토할 수 있다.

Sentry는 필수 MVP 기술로 고정하지 않는다.

---

## 26. SEO 및 구조화 데이터

### Next.js에서 자체 구현할 항목

```text
- 페이지별 title
- meta description
- canonical URL
- Open Graph
- Twitter Card
- robots.txt
- sitemap.xml
- BreadcrumbList
- Article 또는 BlogPosting
- DiscussionForumPosting
- QAPage
- ProfilePage
- CollectionPage
- WebSite
- Organization
```

SEO 플러그인에 전체 구조를 의존하지 않는다.

Next.js Metadata API와 자체 JSON-LD 컴포넌트를 사용한다.

---

## 27. 향후 모바일 앱

### 예정 기술

```text
React Native
Expo
TypeScript
TanStack Query
Zod
Better Auth 연동
Expo SecureStore
```

### 웹과 앱이 공유할 수 있는 것

```text
- REST API
- Zod 요청 및 응답 스키마
- TypeScript 타입
- 비즈니스 규칙
- API 클라이언트
- TanStack Query 키와 훅 일부
- 인증 규칙
- 유틸리티 함수
```

### 웹과 앱에서 별도로 만들 부분

```text
- 화면 UI
- CSS와 React Native StyleSheet
- 내비게이션
- 파일 선택 UI
- 카메라 및 사진첩 접근
- 푸시 알림
- 앱 전용 저장소
```

React 웹 코드를 그대로 앱으로 변환하는 것은 아니지만, API와 로직을 공유해 앱 개발 비용을 줄이는 구조로 간다.

---

## 28. 사용하지 않을 기술과 이유

| 기술 | 사용하지 않는 이유 |
|---|---|
| PHP / Laravel | React·TypeScript 중심 장기 방향과 맞지 않음 |
| Filament | Laravel 전용이며 관리자 UI가 프레임워크 구조에 종속됨 |
| Tailwind CSS | 자체 CSS 디자인 시스템과 자체 컴포넌트를 우선함 |
| MUI / Ant Design | 사용자 및 관리자 디자인이 외부 UI 스타일에 종속됨 |
| React Admin / Refine | 관리자 흐름이 외부 관리자 프레임워크 구조에 종속됨 |
| React SPA 단독 | 공개 커뮤니티와 SEO에 불리함 |
| GraphQL | 초기 요구에 비해 구조와 운영 복잡도가 증가함 |
| tRPC | 앱 및 외부 API 확장 시 REST보다 종속성이 커짐 |
| Prisma | Drizzle보다 추상화가 크고 직접 SQL 제어가 상대적으로 약함 |
| Firebase | 관계형 게시판, 관리자 통계, 복잡한 운영 데이터에 부적합 |
| Supabase 중심 구조 | Fastify와 PostgreSQL 구조와 기능이 중복됨 |
| Elasticsearch 초기 도입 | MVP에서 서버 비용과 운영 복잡도가 과함 |
| 마이크로서비스 | 1인 개발 단계에서 관리와 배포 부담이 과함 |
| Turborepo / Nx 초기 도입 | pnpm workspace만으로 충분하며 초기 복잡도를 높임 |
| 자체 인증 구현 | 보안 위험이 크고 유지보수 가치가 낮음 |
| 자체 에디터 엔진 구현 | 브라우저 편집기 예외 처리와 보안 부담이 과함 |
| 자체 이미지 처리 엔진 | 검증된 Sharp를 사용하는 것이 안전하고 효율적임 |

---

## 29. 최종 패키지 목록

```text
[런타임 및 공통]
node 24 LTS
typescript
pnpm

[웹]
next
react
react-dom

[API]
fastify
@fastify/cors
@fastify/cookie
@fastify/helmet
@fastify/rate-limit
@fastify/multipart
@fastify/swagger
@fastify/swagger-ui
fastify-type-provider-zod

[데이터베이스]
pg
drizzle-orm
drizzle-kit

[검증]
zod

[인증 및 암호화]
better-auth
@node-rs/argon2
node:crypto

[폼 및 서버 데이터]
react-hook-form
@hookform/resolvers
@tanstack/react-query

[파일]
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
file-type

[이미지]
sharp

[에디터]
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-image
@tiptap/extension-link
@tiptap/extension-highlight
@tiptap/extension-color
@tiptap/extension-code-block-lowlight
lowlight
highlight.js

[차트]
recharts

[캐시 및 작업]
redis
bullmq

[이메일]
nodemailer

[테스트]
vitest
@testing-library/react
@testing-library/dom
@playwright/test

[코드 품질]
eslint
prettier
```

---

## 30. 개발 단계별 도입 순서

### 1단계: 프로젝트 기반

```text
- pnpm workspace
- TypeScript
- Next.js
- Fastify
- PostgreSQL
- Drizzle ORM
- Zod
- 자체 CSS 디자인 시스템
```

### 2단계: 회원과 공통 UI

```text
- Better Auth
- Argon2id
- React Hook Form
- TanStack Query
- Button, Input, Select, Modal 등 자체 UI 컴포넌트
```

### 3단계: 게시판과 묻고답하기

```text
- Tiptap
- 이미지 업로드
- 댓글
- 좋아요
- 질문과 답변
- 도움된 답변
- 신고
```

### 4단계: 실전자료

```text
- S3 호환 스토리지
- 파일 검증
- 서명 URL 다운로드
- Sharp
- 다운로드 통계
- 평점과 후기
```

### 5단계: 관리자

```text
- 자체 관리자 레이아웃
- 데이터 테이블
- 검색과 필터
- 게시글, 질문, 자료, 신고, 회원 관리
- Recharts 통계 화면
```

### 6단계: 비동기 처리와 운영 기능

```text
- Redis
- BullMQ
- Nodemailer
- 이미지 Worker
- 통계 집계
- 포인트, 등급, 뱃지 자동 처리
```

### 7단계: 자동 테스트와 배포 안정화

```text
- Vitest
- React Testing Library
- Playwright
- 핵심 E2E 테스트
- 운영 로그
- 백업 및 복구 절차
```

---

## 31. AI 코딩 작업 지침

다른 AI가 이 프로젝트를 개발할 때 다음 원칙을 지켜야 한다.

```text
1. 새로운 UI 프레임워크를 임의로 설치하지 않는다.
2. Tailwind CSS를 추가하지 않는다.
3. 관리자 템플릿을 설치하지 않는다.
4. Fastify API를 우회해 Next.js에서 DB를 직접 조회하지 않는다.
5. Zod 스키마를 웹과 API에 중복 작성하지 않는다.
6. 인증과 암호화를 직접 구현하지 않는다.
7. 운영 DB에 자동 push 방식으로 스키마를 변경하지 않는다.
8. 긴 작업은 BullMQ Worker로 분리한다.
9. 실전자료 파일을 공개 URL로 직접 노출하지 않는다.
10. 에디터 입력 HTML이나 사용자 코드를 실행하지 않는다.
11. UI는 기존 AI작당 디자인 시스템을 우선한다.
12. 라이브러리를 추가할 때 기존 확정 기술로 해결할 수 없는지 먼저 확인한다.
13. 패키지를 추가하면 사용 목적과 제거 가능성을 문서에 기록한다.
14. 핵심 권한 처리는 클라이언트가 아니라 API 서버에서 검사한다.
15. 기능 추가 후 lint, typecheck, test를 실행한다.
```

---

## 32. 최종 확정 요약

```text
[공통]
Node.js 24 LTS
TypeScript
pnpm workspace

[웹 및 관리자]
Next.js 16
React 19
CSS Modules
전역 CSS 변수
자체 디자인 시스템
Remix Icon

[API]
Fastify 5
REST API
OpenAPI
Zod

[데이터베이스]
PostgreSQL 18
Drizzle ORM

[인증]
Better Auth
Argon2id
Node.js Crypto

[폼 및 데이터]
React Hook Form
TanStack Query

[파일 및 이미지]
S3 호환 스토리지 SDK
file-type
Sharp

[에디터]
Tiptap 3
ProseMirror
lowlight
highlight.js

[차트]
Recharts 3

[캐시와 작업]
Redis
BullMQ

[이메일]
Nodemailer
SMTP

[테스트]
Vitest
React Testing Library
Playwright

[향후 앱]
React Native
Expo
```

AI작당은 디자인, 사용자 화면, 관리자 화면, 게시판, 실전자료와 서비스 운영 로직을 자체 개발한다.

외부 라이브러리는 보안, 데이터베이스, 파일 처리, 이미지 변환, 에디터, 차트와 테스트처럼 직접 새로 만드는 것이 불필요하거나 위험한 기반 기술에만 사용한다.

---

문서 작성일: 2026-06-16
