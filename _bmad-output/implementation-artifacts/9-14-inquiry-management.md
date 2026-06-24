# Story 9.14: 문의 관리 (FR-10.6)

Status: done

## Story

As a 관리자,
I want 회원 1:1 문의를 조회하고 상태 변경·운영자 답변하기를,
So that 외주 포함 고객지원을 빠르게 처리한다.

## Acceptance Criteria

1. `/inquiries` 진입 시 inquiries 목록(제목·문의자·접수일·처리일·상태). 필터(상태·기간)·검색 URL 파라미터 반영.
2. 상세 드로어에서 상태 접수→처리중 변경 → `status='in_progress'`, 즉시+토스트.
3. 운영자 답변 작성: 답변 input+저장 → `inquiry_replies`(`author_type='admin'`, `author_id`=현재 관리자 id) 생성, `status='resolved'`. 유저 `/inquiries`(Epic 7 7.5)에서 확인 가능 + `inquiry.replied` 알림(Epic 7 알림 채널로 전송).
4. 완료 문의에 추가 답변: status를 `in_progress`로 되돌리고 새 `inquiry_replies` 추가, 상태 재갱신, 스레드 시간순 표시.
5. `staff`도 `/inquiries` 접근 가능, 답변 작성 가능(최고관리자 전용 아님).

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 확인·신규 생성 (AC: #1~#4)
  - [ ] `packages/database/src/schema/inquiries.ts` 확인 (Epic 7에서 이미 생성됐을 수 있음)
  - [ ] 없으면 NEW: `inquiries`(`id`, `userId`, `title`, `content`, `status`('received'|'in_progress'|'resolved'), `createdAt`, `resolvedAt`)
  - [ ] `inquiry_replies`(`id`, `inquiryId`, `content`, `authorType`('user'|'admin'), `authorId`, `createdAt`)
  - [ ] 마이그레이션 실행 (단일 소유권 규칙 — 동시 마이그레이션 충돌 주의)

- [ ] Task 2: API 라우트 (AC: #1~#5)
  - [ ] `GET /api/v1/admin/inquiries` — 목록(status/dateFrom/dateTo/q/page/pageSize)
  - [ ] `GET /api/v1/admin/inquiries/:id` — 상세(replies 스레드 포함, 시간순)
  - [ ] `PATCH /api/v1/admin/inquiries/:id/status` — 상태 변경('in_progress'/'resolved')
  - [ ] `POST /api/v1/admin/inquiries/:id/replies` — 답변 작성(content, author_type='admin', author_id)
  - [ ] 답변 후 자동 status='resolved' 처리
  - [ ] `packages/contracts/src/admin/inquiries.ts` NEW: Zod 스키마
  - [ ] adminGuard 미들웨어 적용(active 계정, staff 포함 가능)

- [ ] Task 3: 알림 발송 (AC: #3)
  - [ ] 답변 저장 후 BullMQ `email` 큐에 `inquiry.replied` job 추가
  - [ ] payload: `{ userId, inquiryId, adminReply }` → Epic 7 알림 처리 worker에서 처리
  - [ ] (Epic 7 알림 worker 미완료 시) 큐에 넣는 부분만 구현, 실제 발송은 Epic 7 완료 시 동작

- [ ] Task 4: 프런트 — 신규 화면 레이아웃 구성 + API 연동 (AC: #1~#5)
  - **중요: 1:1 문의는 디자인 페이지가 전혀 없다. 어드민 디자인 시스템 컴포넌트를 직접 조합해 화면을 새로 설계·구성해야 한다(단순 API 연동이 아님).**
  - [ ] `apps/admin/app/messages/` 경로가 쪽지인지 확인 후 별도 `/inquiries/` 경로 신규 생성
  - [ ] **[신규 화면 설계] 문의 목록 페이지** `apps/admin/app/inquiries/page.tsx` NEW
    - 어드민 데이터 테이블 컴포넌트 사용: 컬럼 — 제목·문의자·접수일·처리일·상태
    - 상태 배지(`StatusBadge` 또는 어드민 디자인 시스템 Badge): 접수(`received`) / 처리중(`in_progress`) / 완료(`resolved`) — 색상 구분(예: gray/primary/success)
    - 필터 패널: 상태 셀렉트 + 기간(from~to date range) + 검색어 입력
    - URL 파라미터 반영(`?status=&from=&to=&q=&page=`)
    - 페이지네이션 컴포넌트 연결
  - [ ] **[신규 화면 설계] 문의 상세 드로어** `apps/admin/app/inquiries/InquiryDrawer.tsx` NEW
    - 어드민 디자인 시스템 Drawer/Sheet 컴포넌트 기반 (없으면 오버레이 패널 직접 구성)
    - 상단: 문의 제목·문의자 정보·접수일·현재 상태 배지
    - 본문: 문의 내용 표시(Card 컴포넌트)
    - 답변 스레드 영역: `inquiry_replies`를 시간순(ASC) 렌더
      - `authorType='user'` 추가 문의 → 좌측 정렬(배경 gray-50)
      - `authorType='admin'` 답변 → 우측 정렬(배경 primary-50), 작성 관리자 이름 표시
    - 상태 변경 버튼: 접수→처리중(즉시+토스트), 완료→처리중 되돌리기(즉시+토스트)
  - [ ] **[신규 화면 설계] 답변 작성 폼** (InquiryDrawer 내 하단 영역)
    - 어드민 디자인 시스템 Textarea + 저장 버튼
    - 내용 비어있으면 저장 버튼 비활성
    - 저장 성공 시 스레드에 새 답변 즉시 추가(낙관적 업데이트 또는 re-fetch), 토스트 표시
    - 저장 후 status 자동 `resolved`로 갱신, 드로어 상태 배지 업데이트
  - [ ] AdminShell nav에 "문의 관리" 메뉴 추가 (key: 'inquiries', href: '/inquiries', icon: 'ri-customer-service-2-line') — 9.3에서 누락됐을 경우 이 스토리에서 추가

## Dev Notes

### 디자인 부재 — 신규 화면 구성 필수
**1:1 문의는 디자인 페이지(Figma/HTML 목업)가 전혀 없다.** 어드민 디자인 시스템(`packages/admin-design-system`)에서 제공하는 기존 컴포넌트(DataTable, Badge, Drawer/Sheet, Card, Textarea, Button, Toast, Pagination 등)를 직접 조합해 문의 목록·상세·답변 폼 화면을 새로 설계·구현해야 한다. 단순 API 연동이 아니라 **새 화면 레이아웃을 직접 구성하는 작업이 포함**된다.

사용 컴포넌트 참고:
- 목록 테이블: 어드민 공통 DataTable 패턴 (회원 관리, 신고 관리 페이지 참고)
- 상태 배지: 어드민 Badge/StatusBadge — 접수(gray)·처리중(primary/blue)·완료(green)
- 상세 드로어: 어드민 Drawer 또는 Sheet 컴포넌트 (없으면 오버레이 패널 직접 구성)
- 답변 폼: 어드민 Textarea + Button 컴포넌트

### 의존성
- **Epic 7 완료 여부 확인**: `inquiries`·`inquiry_replies` 테이블이 Epic 7에서 이미 생성됐을 가능성. 이 스토리에서 어드민 측 API·화면만 추가.
- **9.3 완료**: AdminShell nav, adminGuard
- **유저측 라우트**: 유저 1:1 문의 페이지는 `/inquiries` (Epic 7 스토리 7.5). `/me/inquiries` 아님.

### 마이그레이션 소유권
`inquiry`·`inquiry_reply` 테이블은 아키텍처에서 "동시 작업 주의" 항목으로 명시됨. Epic 7 스토리와 병행 시 충돌 방지 필요. [Source: architecture.md#partyModeFindings]

### inquiry.status 도메인 어휘
- DB: `received` / `in_progress` / `resolved`
- 표시: `접수` / `처리중` / `완료`

### 답변 스레드 패턴
- `inquiry_replies` 정렬: `ORDER BY created_at ASC`
- `authorType='admin'` 답변은 우측 정렬(primary-50 배경) / `authorType='user'` 추가 문의는 좌측 정렬(gray-50 배경)

### Project Structure Notes
- NEW: `apps/admin/app/inquiries/page.tsx` (문의 목록 — 신규 화면 설계 포함)
- NEW: `apps/admin/app/inquiries/InquiryDrawer.tsx` (상세·답변 드로어 — 신규 화면 설계 포함)
- NEW: `packages/contracts/src/admin/inquiries.ts`, `apps/api/src/routes/admin/inquiries/`
- UPDATE(if needed): `packages/database/src/schema/inquiries.ts`, AdminShell nav

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2961-2987] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Information Architecture] — 14번 문의 관리 메뉴

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
