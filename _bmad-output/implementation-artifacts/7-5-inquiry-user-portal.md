# Story 7.5: 1:1 문의 작성·내역·답변 확인 (`/inquiries`)

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 운영진에게 1:1 문의를 작성하고 내역·답변을 스레드형으로 확인하기를,
so that 외주 상담·기술 지원 등을 운영진에게 직접 전달하고 결과를 추적한다.

## Acceptance Criteria

1. `/inquiries` 진입 시 `GET /api/v1/inquiries?page=1&pageSize=20` → 문의 목록 오프셋 페이지네이션 렌더:
   - 각 항목: 제목·상태 배지(접수→`warning`, 처리중→`info`, 완료→`success`)·작성일·최근 업데이트일
   - [새 문의 작성] 버튼
   - 0건: `EmptyState` + [새 문의 작성] 버튼 포함
2. [새 문의 작성] 클릭 → 폼 화면(또는 모달): 제목(1~100자)·본문(lite 에디터, 1~500자 텍스트 기준)·[제출] 버튼.
3. [제출] → 유효 데이터 → `POST /api/v1/inquiries` (`status=pending`) → `/inquiries` 목록 페이지 이동 + "문의가 접수됐습니다" success 토스트.
4. 24시간 5건 이상 제출 시 429 `{ error: { code: "INQUIRY_RATE_LIMIT_EXCEEDED", message: "하루 최대 5건의 문의를 접수할 수 있습니다." } }` → 클라이언트 danger 토스트.
5. 문의 목록 항목 클릭 → `GET /api/v1/inquiries/{id}` → 스레드 뷰:
   - 회원 원문(제목+본문+작성일)
   - `author_type=admin` 답변이 있으면 시간 오름차순으로 표시(어드민 답변은 운영자 라벨)
   - 현재 상태 배지 표시
   - 답변 추가(Epic 9 어드민 구현 시)로 `inquiry.replied` 알림 발행(이 스토리에서 API 포함, 실제 알림 발행은 Epic 9 어드민 답변 라우트에서 `publishNotification` 호출 — 단 `publishNotification` 헬퍼는 7.1에서 이미 존재)
6. 타인의 문의 ID로 직접 접근 시 403 또는 404 반환.
7. 비회원이 `/inquiries` 접근 시 로그인 유도 + `redirectTo=/inquiries`. API 미인증 401.
8. 폼 검증: 제목 미입력 또는 100자 초과 시 인라인 에러. 본문 미입력 시 인라인 에러. blur 시 개별 + submit 시 전체.

## Tasks / Subtasks

- [ ] Task 1: `@fastify/rate-limit`이 설치됐는지 확인 (Story 7.4에서 설치 예정)
  - [ ] 미설치 시: `pnpm --filter api add @fastify/rate-limit` (Story 7.4와 중복 방지)

- [ ] Task 2: API 엔드포인트 구현 (AC: #1, #3, #4, #5, #6, #7)
  - [ ] `apps/api/src/routes/v1/inquiries/` (NEW 폴더):
    - `routes.ts` (NEW):
      - `GET /`: 인증 필수 → `paginationQuerySchema` 검증 → `SELECT ... FROM inquiries WHERE user_id=? ORDER BY created_at DESC` → `paginatedResponseSchema(inquirySchema)` 반환
      - `POST /`: 인증 필수 → rate limit (24h 5건) 적용 → `createInquirySchema` 검증 → `db.insert(inquiries)` → 201 반환
      - `GET /:id`: 인증 필수 → `inquiries` WHERE `id=? AND user_id=?` → 없으면 404 → `inquiry_replies` JOIN → 스레드 응답
      - (Epic 9용 stub) `POST /:id/replies`: 어드민 전용 — 이 스토리에서 구현 불필요, Epic 9에서 어드민 라우트(`/api/v1/admin/inquiries/{id}/replies`)로 구현
    - `service.ts` (NEW):
      - `getInquiries(userId, pagination)`: 목록 조회
      - `createInquiry(userId, data)`: insert (24h rate limit은 라우트 플러그인 레벨)
      - `getInquiryThread(userId, inquiryId)`: 소유자 검증 + replies JOIN
    - `index.ts` (NEW): 라우트 등록
  - [ ] `apps/api/src/routes/v1/index.ts` (UPDATE): inquiries 라우트 등록
  - [ ] rate limit 설정: POST / 에만 24h/5건 제한 → `config: { rateLimit: { max: 5, timeWindow: '24 hours', keyGenerator: (req) => req.user?.id } }`

- [ ] Task 3: Contracts 보강 (AC: #1~#5)
  - [ ] `packages/contracts/src/inquiry.ts` (UPDATE — Story 7.1에서 정의):
    - `inquiryListItemSchema`: `{ id, title, status, createdAt, updatedAt }` (목록용 경량 스키마)
    - `inquiryThreadSchema`: `{ inquiry: inquirySchema, replies: inquiryReplySchema[] }` (상세+스레드)
    - `createInquirySchema`: `z.object({ title: z.string().min(1).max(100), body: z.any() })` (Tiptap JSON)
    - `paginatedInquiryListSchema` 추가
  - [ ] `pnpm typecheck` 통과 확인

- [ ] Task 4: `/inquiries` 페이지 구현 — **디자인 페이지 없음: 기존 디자인 시스템 컴포넌트로 신규 화면 직접 구성** (AC: #1~#8)
  > ⚠️ 이 스토리는 1:1 문의 전용 디자인 파일이 존재하지 않는다. Figma 참조 불가. 기존 디자인 시스템 컴포넌트(Button, Badge, Card, Input, Textarea, EmptyState, Skeleton, Pagination 등)를 직접 조합하여 아래 3개 화면 레이아웃을 새로 구성한다.

  - [ ] **[신규 화면 1: 문의 목록 페이지]** `apps/web/app/inquiries/page.tsx` (NEW — 최상위 독립 라우트 `/inquiries` 신규 생성):
    - 서버 컴포넌트: 인증 체크 → 미인증 `redirect('/login?redirectTo=/inquiries')`
    - `generateMetadata`: `{ title: "1:1 문의", robots: { index: false } }`
    - `InquiriesPage` 클라이언트 컴포넌트 렌더
  - [ ] `apps/web/features/inquiry/InquiriesPage.tsx` (NEW, 클라이언트):
    - **레이아웃 구성**: 페이지 상단 헤딩("1:1 문의") + 우측 [새 문의 작성] `Button` (variant="primary")
    - 마운트: `GET /api/v1/inquiries?page=1&pageSize=20` → 목록 렌더
    - `InquiryListItem` 컴포넌트 반복 (상태 배지, 제목, 날짜 — Card 컴포넌트 사용)
    - [새 문의 작성] 버튼 클릭 → `/inquiries/new` 라우트 이동
    - `EmptyState`(0건, "아직 문의 내역이 없어요." + [새 문의 작성] 버튼 포함)
    - `Skeleton`(로딩), `Pagination`(다중 페이지)
  - [ ] `apps/web/features/inquiry/InquiryListItem.tsx` (NEW):
    - **레이아웃**: Card 래퍼 → 제목(좌)·상태 `Badge`(우) / 작성일·최근업데이트일(하단 소문자)
    - 클릭 시 `/inquiries/{id}` 이동
    - Badge variant 매핑: `pending`→`warning`(접수), `in_progress`→`info`(처리중), `resolved`→`success`(완료)
  - [ ] **[신규 화면 2: 문의 작성 폼 페이지]** `apps/web/app/inquiries/new/page.tsx` (NEW):
    - 서버 컴포넌트: 인증 체크 → 미인증 `redirect('/login?redirectTo=/inquiries/new')`
    - `InquiryForm` 클라이언트 컴포넌트 렌더
  - [ ] `apps/web/features/inquiry/InquiryForm.tsx` (NEW, 클라이언트):
    - **레이아웃 구성**: 페이지 헤딩("새 문의 작성") + 폼 Card
    - 제목 `<Input>` 필드: 레이블 "제목", placeholder "문의 제목을 입력하세요", 1~100자, blur 검증, 인라인 에러
    - 본문 필드: `apps/web/features/editor/`의 `lite` preset 존재 시 `<TiptapEditor preset="lite" />`; 없으면 `<Textarea>` 폴백(rows=8, placeholder "문의 내용을 입력하세요"), 1~500자 텍스트 기준, blur 검증, 인라인 에러
    - 폼 하단: [취소] Button(variant="ghost", onClick→`/inquiries`) + [제출] Button(variant="primary", 로딩 중 disabled+Spinner, 중복 클릭 방지)
    - 폼 검증: blur 개별 + submit 전체 인라인 에러
    - 성공: `router.push('/inquiries')` + toast success("문의가 접수됐습니다.")
    - 429: danger 토스트 "하루 최대 5건의 문의를 접수할 수 있습니다."
  - [ ] **[신규 화면 3: 문의 상세·스레드 페이지]** `apps/web/app/inquiries/[id]/page.tsx` (NEW):
    - 서버 컴포넌트: 인증 체크 → 미인증 `redirect('/login?redirectTo=/inquiries/{id}')`
    - `InquiryThread` 클라이언트 컴포넌트 렌더
  - [ ] `apps/web/features/inquiry/InquiryThread.tsx` (NEW, 클라이언트):
    - **레이아웃 구성**: 상단 헤더 (← [뒤로가기]→`/inquiries` + 현재 상태 `Badge`) / 원문 Card(제목·본문·작성일) / 답변 스레드 영역(시간 오름차순 리스트)
    - 마운트: `GET /api/v1/inquiries/{id}` → 원문 + replies 시간순 렌더
    - 403/404: `notFound()` 또는 에러 UI
    - 상태 배지: `Badge` 컴포넌트 (`variant="warning|info|success"`)
    - 어드민 답변 버블: 좌측 정렬 + "운영진" 레이블(`<span>`) + 다른 배경색 CSS 토큰 (`--color-surface-alt` 등)
    - 회원 원문/추가 메시지 버블: 우측 정렬 + 기본 배경 토큰
    - `TiptapRenderer` 사용(없으면 `sanitize-html` 기반 `dangerouslySetInnerHTML` — XSS 차단 필수)
  - [ ] `apps/web/app/inquiries/layout.tsx` (NEW): `noindex` + 인증 체크 레이아웃 공유 (page.tsx에서 개별 처리해도 무방)
  - [ ] `apps/web/features/inquiry/inquiry.module.css` (NEW): 목록·폼·스레드 전용 CSS Modules (디자인 토큰만 사용, 하드코딩 금지)

- [ ] Task 5: 알림 발행 준비 (AC: #5 — `inquiry.replied` 알림)
  - [ ] `apps/api/src/lib/notifications.ts` (UPDATE): `notificationType` enum에 `inquiry.replied` 추가 여부 확인 (Story 7.1에서 7종만 정의 — `inquiry.replied`는 별도 타입으로 추가 필요)
  - [ ] `packages/database/src/schema/notifications.ts` (UPDATE): `notificationType` pgEnum에 `"inquiry.replied"` 추가 → 마이그레이션 재생성
  - [ ] `packages/contracts/src/notification.ts` (UPDATE): `notificationTypeSchema` enum에 `"inquiry.replied"` 추가
  - [ ] 실제 `publishNotification` 호출은 **Epic 9 어드민 답변 라우트**에서 수행 — 이 스토리는 타입 정의만

- [ ] Task 6: 통합 검증
  - [ ] `pnpm typecheck` 전 워크스페이스 통과
  - [ ] `apps/api/src/routes/v1/inquiries/routes.test.ts` (NEW): 타인 문의 접근 403/404, 24h rate limit 429, 미인증 401 검증

## Dev Notes

### 아키텍처 가드레일

- **Tiptap lite 에디터**: `apps/web/features/editor/`에 이미 구현되어 있는지 확인 필수. 있으면 `lite` preset 재사용. 없으면 `<Textarea>` 폴백 사용(에디터 구현은 Epic 2 스코프) ([Source: architecture.md#Editor — Tiptap 2 preset])
- **inquiry body = Tiptap JSON**: `content_json` 컬럼(jsonb)에 저장, HTML 저장 금지 ([Source: project-context.md#응답 & 데이터 포맷])
- **rate limit**: 24h/5건, 유저 ID 기준 키생성. `@fastify/rate-limit` 라우트 레벨 적용 ([Source: architecture.md#Authentication & Security, epics.md#FR-16.4])
- **소유권 검증**: `GET /inquiries/{id}`: `WHERE id=? AND user_id=?` — 소유자 아니면 404 반환 (403 정보 노출 방지 위해 404도 허용) ([Source: epics.md#Story 7.5 AC])
- **트랜잭션**: `service.ts` 레이어에서만 ([Source: architecture.md#Transaction & Data Access])
- **폼 검증 타이밍**: blur 시 개별, submit 시 전체 인라인 에러 ([Source: architecture.md#Error Handling])
- **noindex**: `/inquiries`, `/inquiries/new`, `/inquiries/[id]` 전부 noindex (로그인 전용 페이지) ([Source: project-context.md#SEO])

### 손댈 소스 트리

```
packages/
  contracts/src/
    inquiry.ts                (UPDATE: list/thread 스키마 보강)
    notification.ts           (UPDATE: inquiry.replied 타입 추가)
  database/src/schema/
    notifications.ts          (UPDATE: notificationType enum에 inquiry.replied 추가)
    inquiries.ts              (확인: status enum, body jsonb)
    inquiry-replies.ts        (확인: author_type enum)
apps/
  api/src/routes/v1/
    inquiries/
      routes.ts               (NEW)
      service.ts              (NEW)
      index.ts                (NEW)
    index.ts                  (UPDATE: inquiries 등록)
  web/
    features/inquiry/
      InquiriesPage.tsx       (NEW)
      InquiryListItem.tsx     (NEW)
      InquiryForm.tsx         (NEW)
      InquiryThread.tsx       (NEW)
      inquiry.module.css      (NEW: 디자인 없음 — 디자인 시스템 토큰으로 신규 레이아웃 구성)
    app/inquiries/
      layout.tsx              (NEW: noindex + 인증 체크)
      page.tsx                (NEW: 문의 목록)
      new/page.tsx            (NEW: 문의 작성 폼)
      [id]/page.tsx           (NEW: 문의 상세·스레드)
```

### 상태 배지 매핑

| `status` | Badge variant | 한국어 |
|---------|--------------|-------|
| `pending` | `warning` | 접수 |
| `in_progress` | `info` | 처리중 |
| `resolved` | `success` | 완료 |

기존 `Badge` 컴포넌트(`apps/web/components/ui/Badge/`) 재사용 — variant 확인 필수.

### `inquiry_replies` 렌더 구분

```tsx
// InquiryThread.tsx 내부
{reply.authorType === "admin" ? (
  <div className={styles.adminReply}>
    <span className={styles.adminLabel}>운영진</span>
    <TiptapRenderer content={reply.body} />
    <time>{formatRelative(reply.createdAt)}</time>
  </div>
) : (
  <div className={styles.userReply}>
    <TiptapRenderer content={reply.body} />
    <time>{formatRelative(reply.createdAt)}</time>
  </div>
)}
```

`TiptapRenderer`: Tiptap JSON → 안전 HTML 변환 컴포넌트. `apps/web/features/editor/`에 이미 있는지 확인. 없으면 `sanitize-html` 기반 서버 유틸로 변환 후 `dangerouslySetInnerHTML` 사용(XSS 차단 필수).

### Epic 9 연계 경계

- 이 스토리: 유저 문의 작성·조회 + API 정의 + `inquiry.replied` 타입 선언
- Epic 9: 어드민 `POST /api/v1/admin/inquiries/{id}/replies` → `inquiry_replies` insert + `publishNotification(inquiry.userId, { type: 'inquiry.replied', ... })` 호출 + 문의 `status` → `in_progress`/`resolved` 변경
- 이 경계를 넘어서 Epic 9 어드민 라우트를 이 스토리에서 구현하지 않는다.

### rate limit 설정 예시

```ts
// routes.ts 내 POST / 핸들러 options
config: {
  rateLimit: {
    max: 5,
    timeWindow: 24 * 60 * 60 * 1000, // 24h in ms
    keyGenerator: (request) => request.user?.id ?? request.ip,
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: 'INQUIRY_RATE_LIMIT_EXCEEDED',
        message: `하루 최대 5건의 문의를 접수할 수 있습니다. ${Math.ceil(context.ttl / 1000)}초 후 다시 시도하세요.`
      }
    })
  }
}
```

### lite 에디터 처리 전략

`apps/web/features/editor/` 존재 여부와 `lite` preset 구현 여부 확인:
- **있으면**: `<TiptapEditor preset="lite" />` 재사용
- **없으면**: `<Textarea>` 폴백(plaintext body를 Tiptap JSON으로 래핑: `{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] }`)

500자 제한은 텍스트 길이 기준(Tiptap JSON의 text node 합산).

### 테스트 표준

- `apps/api/src/routes/v1/inquiries/routes.test.ts`:
  - `GET /{id}`: 타인 문의 → 404
  - `POST /`: rate limit 초과 → 429 `INQUIRY_RATE_LIMIT_EXCEEDED`
  - `POST /`: 미인증 → 401
  - `POST /`: 제목 101자 → 422 `VALIDATION_ERROR`

### 보안

- 소유권 검증: 모든 단건 조회/수정에서 `AND user_id = req.user.id` 필수
- body(Tiptap JSON)는 DB에 jsonb로 저장 후 렌더 시 `sanitize-html` 화이트리스트 통과 — HTML 직접 저장 절대 금지
- 미인증 요청은 모든 엔드포인트에서 401

### Project Structure Notes

- `/inquiries`는 별도 독립 최상위 라우트로 신규 생성 (`apps/web/app/inquiries/`). `/me/inquiries` 경로 아님 — 절대 `/me` 하위에 만들지 말 것.
- `apps/web/app/inquiries/layout.tsx`에서 noindex + 인증 체크를 한 번에 처리. page 단위로 중복 설정하지 않아도 됨.
- **디자인 없음 주의**: 1:1 문의 화면은 Figma 디자인이 존재하지 않는다. 기존 `apps/web/components/ui/` 디자인 시스템 컴포넌트(Button, Badge, Card, Input, Textarea, EmptyState, Skeleton, Pagination 등)만 활용해 목록·폼·스레드 레이아웃을 직접 설계·구현한다. 임의 색상·폰트 하드코딩 금지 — CSS 토큰 사용.
- `Badge` 컴포넌트의 `variant` 지원값 확인: `apps/web/components/ui/Badge/Badge.tsx` 완독 필수 (warning/info/success 지원 여부). 미지원 시 `data-variant` 또는 `className` 조건부로 처리.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5, L2200~2240]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — inquiries, inquiry_replies]
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping — 1:1 문의]
- [Source: _bmad-output/project-context.md#응답 & 데이터 포맷 — Tiptap JSON, 보안]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Information Architecture — /inquiries (독립 라우트, 디자인 없음 — 디자인 시스템 컴포넌트로 신규 구성)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
