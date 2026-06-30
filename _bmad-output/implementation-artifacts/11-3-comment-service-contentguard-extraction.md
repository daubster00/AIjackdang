# Story 11.3: 댓글 생성 service + `contentGuard` 함수 추출 (선행 리팩터링)

Status: ready-for-dev

## Story

As a 개발자,
I want 댓글 생성 로직과 contentGuard(콘텐츠 검열 미들웨어)를 봇이 함수로 호출 가능하게 추출하기를,
so that 봇·사용자가 같은 도메인 경로를 공유하고 DB 직접 INSERT 없이도 댓글을 생성한다.

## Acceptance Criteria

1. `apps/api/src/routes/v1/comments.ts`의 POST 댓글 도메인 로직(트랜잭션 경계·`parentId`(부모 댓글 ID) 검증·포인트 적립·알림 큐 발행)을 `apps/api/src/routes/v1/comments/service.ts`의 `createComment(input)` 함수로 추출한다. 라우트 핸들러는 이 함수를 호출하는 얇은 어댑터로만 남는다. **기존 동작 100% 회귀 없음** — N+1 방지·soft-delete·2단계 대댓글 차단·트랜잭션·포인트·알림 보존.
2. `apps/api/src/middleware/contentGuard.ts`의 검사 로직을 `runContentGuard(text: string): Promise<ContentGuardResult>` 함수로 추출한다(강화 타입 `ContentGuardResult` = `{ ok: true } | { ok: false; code: string; message: string; reason?: string }` 판별 유니온도 함께 export). 기존 `contentGuard` preHandler(패스트파이 훅)는 이 함수를 내부적으로 감싸도록 변경한다. 사용자 경로(기존 preHandler 등록) 회귀 없음.
3. 기존 댓글 관련 테스트(현재 없음) 대신, 새로 추출된 `comments/service.ts`의 `createComment`와 `runContentGuard`에 대한 단위 테스트를 각각 추가한다: `createComment` 핵심 불변식 4종, `runContentGuard` 검사 결과 2종.

## Tasks / Subtasks

- [ ] Task 1: `apps/api/src/routes/v1/comments/service.ts` 신규 생성 (AC: #1)
  - [ ] 입력 타입 `CreateCommentServiceInput` 정의:
    ```ts
    export interface CreateCommentServiceInput {
      userId: string;           // 작성자 user_id (봇의 경우 봇 계정 user_id)
      targetType: "post" | "question" | "answer" | "resource" | "comment";
      targetId: string;         // 댓글이 달릴 대상 엔티티 ID
      content: string;          // 댓글 본문(plain text)
      parentId?: string;        // 대댓글인 경우 부모 댓글 ID
    }
    ```
  - [ ] `createComment(input: CreateCommentServiceInput): Promise<{ id: string }>` 구현 — 아래 불변식 목록을 모두 보존한 채 routes/v1/comments.ts의 POST 핸들러 로직을 그대로 이식:
    1. **빈/공백 내용 차단**: `content.trim()` 후 빈값이면 `ValidationError` throw (에러 코드 `"VALIDATION_ERROR"`·메시지 `"댓글 내용을 입력해주세요."`)
    2. **parentId 검증 + 2단계 대댓글 차단**: parentId 있으면 DB에서 부모 댓글 SELECT → 없으면 `"VALIDATION_ERROR"` throw → `parent.parentId !== null`이면 `"NESTING_NOT_ALLOWED"` throw. `parentCommentAuthorId`(부모 댓글 작성자 ID) 회수.
    3. **댓글 INSERT + returning id**: `db.insert(schema.comments).values({...}).returning({ id })`
    4. **포인트 적립(best-effort)**: `getTodayCount` → `earnPoints`; 실패해도 댓글 저장 유지 (try/catch 패턴 그대로)
    5. **알림 큐 발행(best-effort)**: `getNotificationsQueue().add("comment.created", { commentId, authorId, targetType, targetId, ...(parentCommentAuthorId ? { parentCommentAuthorId } : {}) })`; 실패해도 댓글 저장 유지
  - [ ] 라우트 핸들러와의 에러 규약 정의: service는 에러를 `throw`하고, 라우트가 try/catch 후 400/422 응답 변환.
    ```ts
    export class CommentServiceError extends Error {
      constructor(public code: string, message: string) { super(message); }
    }
    ```

- [ ] Task 2: `apps/api/src/routes/v1/comments.ts` 리팩터링 (AC: #1)
  - [ ] 파일을 `apps/api/src/routes/v1/comments/` 디렉터리 구조로 이동하거나, 기존 파일 위치는 유지하되 service를 import하는 방식 선택. **권장**: 기존 `comments.ts`는 그 자리에 두고, 동일 디렉터리에 `comments/` 폴더 신설하여 `comments/service.ts` 배치. routes는 `"./comments/service.js"` import.
  - [ ] POST `/comments` 핸들러 내 도메인 로직을 `createComment({ userId: user.id, targetType, targetId, content, parentId })` 호출로 교체.
  - [ ] `CommentServiceError` catch → `code === "NESTING_NOT_ALLOWED"` 이면 400, 나머지 `"VALIDATION_ERROR"`면 400 반환. 기타 에러는 throw(500 핸들러 위임).
  - [ ] GET·PATCH·DELETE 핸들러는 **변경 없음** — 손대지 않는다.

- [ ] Task 3: `apps/api/src/middleware/contentGuard.ts` 리팩터링 (AC: #2)
  - [ ] 내부 헬퍼 함수 `extractTextFromTiptap`(Tiptap JSON 텍스트 추출)·`extractBodyText`(body에서 텍스트 추출)는 **그대로 유지** — 라우트 preHandler 경로에서 계속 사용.
  - [ ] **강화 타입 `ContentGuardResult` 정의**(판별 유니온 — `ok: false`면 `code` 필수). `contentGuard.ts`에서 export하여 봇 작성 서비스(11.4)·파이프라인(11.9/11.10)이 재사용:
    ```ts
    export type ContentGuardResult =
      | { ok: true }
      | { ok: false; code: "SPAM" | "FORBIDDEN_WORD" | string; message: string; reason?: string };
    ```
  - [ ] 핵심 검사 로직을 `export async function runContentGuard(text: string): Promise<ContentGuardResult>` 로 추출:
    ```ts
    export async function runContentGuard(text: string): Promise<ContentGuardResult> {
      if (!text.trim()) return { ok: true };  // 빈 텍스트는 통과
      if (detectSpam(text)) return { ok: false, code: "SPAM", message: "스팸으로 의심되는 내용입니다.", reason: "spam_pattern" };
      const forbiddenWords = await getSiteSetting<string[]>("forbidden_words");
      const wordList = Array.isArray(forbiddenWords) ? forbiddenWords : [];
      if (detectForbiddenWord(text, wordList)) return { ok: false, code: "FORBIDDEN_WORD", message: "허용되지 않는 단어가 포함되어 있습니다.", reason: "forbidden_word" };
      return { ok: true };
    }
    ```
  - [ ] 기존 `export async function contentGuard(request, reply)` preHandler는 내부에서 `runContentGuard`를 호출하도록 변경:
    ```ts
    export async function contentGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const text = extractBodyText(request.body);
        const result = await runContentGuard(text);
        if (!result.ok) {
          await reply.status(422).send({ error: { code: result.code || "FORBIDDEN_CONTENT", message: result.message } });
        }
      } catch {
        // DB/Redis 장애 시 통과 (가용성 우선)
      }
    }
    ```
  - [ ] `contentGuard` preHandler가 등록된 라우트(`POST /comments`, `POST /posts`, `POST /qna/questions`, `POST /qna/answers`)는 **import 경로 변경 없음** — 기존 `contentGuard` named export 그대로.

- [ ] Task 4: 단위 테스트 신규 작성 (AC: #3)
  - [ ] `apps/api/src/routes/v1/comments/service.test.ts` — vitest, DB 모킹 방식(프로젝트 기존 패턴 준수):
    1. 빈 content → `CommentServiceError("VALIDATION_ERROR")` throw 확인
    2. 존재하지 않는 parentId → `CommentServiceError("VALIDATION_ERROR")` throw 확인
    3. 2단계 중첩 parentId(parent.parentId가 null이 아님) → `CommentServiceError("NESTING_NOT_ALLOWED")` throw 확인
    4. 정상 입력 → INSERT 호출 + `earnPoints` + 알림 큐 `add` 호출 확인(mock으로 호출 여부 검증)
  - [ ] `apps/api/src/middleware/contentGuard.test.ts` — vitest:
    1. 스팸 링크 포함 텍스트 → `{ ok: false, code: "SPAM", message: string }` 반환
    2. 금칙어 포함 텍스트 → `{ ok: false, code: "FORBIDDEN_WORD", message: string }` 반환
    3. 정상 텍스트 → `{ ok: true }` 반환
    4. 빈 문자열 → `{ ok: true }` 반환(빈 통과)
  - [ ] 테스트 도구: `vitest`, `vi.mock`, DB mock은 기존 `points.service.test.ts` 패턴 참조

- [ ] Task 5: 타입체크 및 검증 (AC: #1, #2, #3)
  - [ ] `pnpm typecheck` 통과 (apps/api)
  - [ ] `pnpm lint` 통과
  - [ ] `pnpm test --filter apps/api` 전체 테스트 통과 — 기존 테스트 회귀 없음

## Dev Notes

### 보존해야 할 불변식 목록 (현재 동작 박제)

아래는 `apps/api/src/routes/v1/comments.ts` L286~390의 POST 핸들러에서 추출되는 정확한 동작이다. **단 하나도 누락하면 안 된다.**

**불변식 1 — 빈/공백 내용 차단 (L311~315)**
```ts
if (!content.trim()) {
  return reply.code(400).send({
    error: { code: "VALIDATION_ERROR", message: "댓글 내용을 입력해주세요." },
  });
}
```
service 추출 시: `content.trim()`이 빈값이면 `CommentServiceError("VALIDATION_ERROR", ...)` throw.

**불변식 2 — parentId 검증 + 2단계 대댓글 차단 (L318~345)**
```ts
let parentCommentAuthorId: string | null = null;
if (parentId) {
  const parentRows = await db.select({ id, parentId, authorId })
    .from(schema.comments).where(eq(schema.comments.id, parentId)).limit(1);
  const parent = parentRows[0];
  if (!parent) { /* 400 VALIDATION_ERROR */ }
  if (parent.parentId !== null) { /* 400 NESTING_NOT_ALLOWED */ }
  parentCommentAuthorId = parent.authorId;
}
```
service 추출 시: 동일 SELECT 쿼리 + 동일 분기. `parentCommentAuthorId`(부모 댓글 작성자 ID)를 알림 큐 페이로드로 전달.

**불변식 3 — 댓글 INSERT (L347~359)**
```ts
const inserted = await db.insert(schema.comments)
  .values({ authorId: user.id, targetType, targetId, parentId: parentId ?? null, content: content.trim() })
  .returning({ id: schema.comments.id });
const row = inserted[0];
if (!row) throw new Error("INSERT comment returned no row");
```
service 추출 시: `userId`를 `authorId`로 매핑. `parentId: parentId ?? null` 보존.

**불변식 4 — 포인트 적립 (best-effort, L361~374)**
```ts
try {
  const todayCount = await getTodayCount(db, { userId: user.id, reason: "comment.created" });
  await earnPoints(db, { userId: user.id, reason: "comment.created", sourceType: "comment", sourceId: row.id, todayCount });
} catch (err) {
  console.error("[points] 댓글 적립 실패 (무시):", (err as Error).message);
}
```
실패해도 댓글 저장 유지. try/catch 패턴 그대로.

**불변식 5 — 알림 큐 발행 (best-effort, L376~387)**
```ts
try {
  await getNotificationsQueue().add("comment.created", {
    commentId: row.id, authorId: user.id, targetType, targetId,
    ...(parentCommentAuthorId ? { parentCommentAuthorId } : {}),
  });
} catch { console.error("[comments] notifications 큐 발행 실패"); }
```
`parentCommentAuthorId`(부모 댓글 작성자 ID)는 conditional spread 패턴 보존.

**불변식 6 — soft-delete (DELETE 핸들러, 건드리지 않음)**
PATCH·DELETE 핸들러는 이번 스토리에서 변경하지 않는다. soft-delete 로직(status=deleted + deleted_at + revokePoints 트랜잭션)은 손대지 않는다.

**불변식 7 — N+1 방지 (GET 핸들러, 건드리지 않음)**
최상위 댓글 SELECT → `parentId IN (ids)` 배치 대댓글 SELECT → reactions 배치 SELECT. GET 핸들러 변경 없음.

---

### 회귀 위험 포인트 3개

1. **parentCommentAuthorId(부모 댓글 작성자 ID) 누락**: 알림 큐 페이로드에서 `parentCommentAuthorId`가 빠지면 대댓글 알림이 부모 댓글 작성자에게 가지 않는다. service 인터페이스에서 이 값을 `createComment` 반환값 또는 내부에서 큐 발행까지 담당하는 방식으로 보장해야 한다.

2. **contentGuard preHandler import 경로 변경**: 기존 `contentGuard.ts`가 `extractTextFromTiptap`·`extractBodyText`를 내부 함수로 가지고 있어 여러 body 구조(Tiptap JSON 객체·평문 string·`contentJson` 필드)를 모두 처리한다. `runContentGuard`는 이미 추출된 `text: string`만 받으므로, preHandler는 기존 `extractBodyText`로 추출 후 `runContentGuard`를 호출해야 한다. 텍스트 추출 로직이 `runContentGuard` 내부에 중복 들어가지 않도록 분리 경계 명확히.

3. **포인트 적립 best-effort 패턴 훼손**: service 내부에서 포인트 적립 실패 시 catch 없이 throw하면, 포인트 실패가 댓글 등록 전체를 롤백시킨다. 현재 코드는 명시적으로 try/catch로 "적립 실패해도 댓글 저장 유지"를 보장한다. 이 패턴을 service로 이식할 때 반드시 동일한 best-effort 구조를 유지해야 한다.

---

### 파일 구조 변경 요약

```
apps/api/src/
├── middleware/
│   └── contentGuard.ts          [UPDATE] runContentGuard 추출 + preHandler 래핑
├── routes/v1/
│   ├── comments.ts              [UPDATE] POST 핸들러 → createComment() 위임
│   └── comments/                [NEW 디렉터리]
│       ├── service.ts           [NEW] createComment + CreateCommentServiceInput + CommentServiceError
│       ├── service.test.ts      [NEW] 단위 테스트 4종
└── middleware/
    └── contentGuard.test.ts     [NEW] runContentGuard 단위 테스트 4종
```

> `comments/` 서브디렉터리를 신설하는 이유: 11.4에서 `createCommentAsBot`이 `comments/service.ts`를 import하게 되며, 이후 댓글 관련 타입·헬퍼가 같은 디렉터리에 모이는 설계를 선행 준비한다.

---

### admin comments service와의 혼동 주의

`apps/api/src/routes/admin/comments/service.ts`는 관리자용 댓글 목록/숨김/삭제 서비스다(Story 9.9). 이번 스토리에서 만드는 `apps/api/src/routes/v1/comments/service.ts`는 사용자용 댓글 **생성** 서비스다. 두 파일은 경로만 다른 게 아니라 목적 자체가 다르다 — 혼동 금지.

---

### 봇 경로에서의 사용 (Story 11.4 연결)

이 스토리 완료 후 Story 11.4의 `createCommentAsBot(input)`은 다음과 같이 동작한다:
```ts
// apps/api/src/services/bot/write.ts (Story 11.4)
import { createComment } from "../../routes/v1/comments/service.js";
import { runContentGuard } from "../../middleware/contentGuard.js";

export async function createCommentAsBot(input: { botUserId, targetType, targetId, content, parentId? }) {
  const text = input.content;
  const guard = await runContentGuard(text);
  if (!guard.ok) {
    // bot_activity_log 'blocked' + bot_generation_jobs status='blocked'
    return { status: "blocked", code: guard.code, message: guard.message, reason: guard.reason };
  }
  const result = await createComment({
    userId: input.botUserId,
    targetType: input.targetType,
    targetId: input.targetId,
    content: input.content,
    parentId: input.parentId,
  });
  return { status: "published", commentId: result.id };
}
```
봇은 preHandler를 거치지 않으므로 `runContentGuard`를 **직접 호출**한다. `contentGuard` preHandler는 사용자 HTTP 경로에서만 작동한다.

---

### 테스트 패턴 참조

프로젝트 기존 단위 테스트 패턴(`vitest` + `vi.mock`):
- DB mock: `vi.mock("@ai-jakdang/database", () => ({ getDb: vi.fn(() => mockDb), schema: { comments: {...}, ... } }))`
- drizzle-orm mock: `vi.mock("drizzle-orm", () => ({ eq: vi.fn(...), and: vi.fn(...), inArray: vi.fn(...) }))`
- Queue mock: `vi.mock("../../../lib/queues.js", () => ({ getNotificationsQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue({}) })) }))`

참조 파일: `apps/api/src/routes/v1/gamification/points.service.test.ts`

### Project Structure Notes

- 신규 파일 위치 `apps/api/src/routes/v1/comments/service.ts`는 기존 posts/service.ts, resources/list.service.ts 등의 service 레이어 패턴과 일치한다. [Source: apps/api/src/routes/v1/posts/service.ts]
- `contentGuard.ts`는 기존 위치 `apps/api/src/middleware/contentGuard.ts` 그대로 유지. export 추가만(기존 named export `contentGuard` 유지).
- 이 스토리는 **UPDATE 작업**이다. 기존 동작 변경 없이 추출만 한다. API 응답 스키마·라우트 등록·preHandler 등록 변경 없음.

### References

- [Source: apps/api/src/routes/v1/comments.ts L1~13] — 설계 주석: N+1 방지(AR-2)·soft-delete(AR-7)·2단계 대댓글 차단(5.5) 원칙
- [Source: apps/api/src/routes/v1/comments.ts L286~390] — POST 핸들러 전체 (추출 대상 도메인 로직)
- [Source: apps/api/src/routes/v1/comments.ts L317~345] — parentId 검증 + 2단계 대댓글 차단 로직
- [Source: apps/api/src/routes/v1/comments.ts L347~359] — 댓글 INSERT + returning id
- [Source: apps/api/src/routes/v1/comments.ts L361~374] — 포인트 적립 best-effort
- [Source: apps/api/src/routes/v1/comments.ts L376~387] — 알림 큐 발행 best-effort
- [Source: apps/api/src/routes/v1/comments.ts L499~515] — DELETE soft-delete + revokePoints 트랜잭션(변경 없음)
- [Source: apps/api/src/middleware/contentGuard.ts L1~138] — contentGuard preHandler 전체
- [Source: apps/api/src/middleware/contentGuard.ts L34~50] — extractTextFromTiptap (Tiptap JSON 텍스트 추출)
- [Source: apps/api/src/middleware/contentGuard.ts L52~91] — extractBodyText (body 텍스트 추출)
- [Source: apps/api/src/middleware/contentGuard.ts L101~138] — contentGuard preHandler 검사 흐름 (추출 대상)
- [Source: apps/api/src/routes/admin/comments/service.ts] — 관리자용 댓글 서비스 (혼동 금지, 이번 스토리 대상 아님)
- [Source: apps/api/src/routes/v1/posts/service.ts] — service 레이어 패턴 참조
- [Source: apps/api/src/routes/v1/gamification/points.service.test.ts] — vitest + vi.mock 테스트 패턴 참조
- [Source: docs/seeding-bot/ARCHITECTURE.md §3] — 봇 도메인 서비스 설계: 댓글 생성 경로 공유 근거
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md Story 11.3] — AC 원문

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- `apps/api/src/routes/v1/comments/service.ts` [NEW]
- `apps/api/src/routes/v1/comments/service.test.ts` [NEW]
- `apps/api/src/routes/v1/comments.ts` [UPDATE]
- `apps/api/src/middleware/contentGuard.ts` [UPDATE]
- `apps/api/src/middleware/contentGuard.test.ts` [NEW]
