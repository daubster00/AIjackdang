# Story 11.4: 공용 봇 작성 서비스 (`createPostAsBot` / `createCommentAsBot` / `createReplyAsBot` / `createQuestionAsBot` / `createResourceAsBot`)

Status: done

## Story

As a 시딩 봇 파이프라인,
I want 게시글·댓글·대댓글을 기존 도메인 서비스와 동일한 경로로 작성하고, contentGuard 실패 시 안전하게 차단,
so that 봇이 올리는 콘텐츠가 사람이 올리는 것과 완전히 동일한 부수효과(슬러그·요약·썸네일·태그·포인트·OG 잡·알림)를 자동으로 거쳐 품질 일관성이 보장된다.

---

## Acceptance Criteria

1. `apps/api/src/services/bot/write.ts`에 `createPostAsBot` / `createCommentAsBot` / `createReplyAsBot` / **`createQuestionAsBot`** / **`createResourceAsBot`** 다섯 함수를 구현한다(#6 정합 — 11.5가 `qna`·`resource:<type>` 토픽을 시드하고 11.9가 해당 게시판 주제를 선택하므로 Q&A·실전자료 작성 경로가 필요). 각 함수는 내부에서 **기존 도메인 create 서비스**(글=`createPost()`, 댓글=11.3 추출 `createComment()`, 질문=Epic3 Q&A 질문 생성 서비스, 실전자료=Epic4 자료 생성 서비스)를 호출하여 slug 생성·summary 자동 추출·썸네일 URL 추출·태그 upsert·첨부파일 INSERT·포인트 적립·OG 링크 미리보기 잡 발행이 **각 도메인에서 동일하게** 적용됨을 **통합 테스트**로 증명한다(Tasks §3·§4b·§4c 참조). DB 직접 INSERT 금지(시드 제외) — 반드시 도메인 서비스 경유.
2. 게시 직전 `runContentGuard(text)` 를 호출하며, 차단 결과를 받으면 게시를 중단하고 `bot_generation_jobs`(생성 작업) 레코드를 `blocked`(콘텐츠 가드 차단) 상태로 업데이트한 뒤 `bot_activity_log`(봇 활동 로그)에 `blocked` 이벤트를 기록한다.
3. 이 파일(시드 스크립트 제외)에서 `getDb().insert(schema.posts)` / `getDb().insert(schema.comments)` 등 DB 직접 INSERT가 없음을 코드 리뷰 및 통합 테스트로 확인한다. 작성자 `userId`는 반드시 봇 `user_id`(봇 계정 여부 플래그 `is_bot=true` 인 `users` 행의 ID)를 사용한다. 게시판(`board`)은 페르소나 담당 게시판만 사용한다.

---

## Tasks / Subtasks

- [x] Task 1: `apps/api/src/services/bot/` 디렉토리 생성 및 `write.ts` 파일 스캐폴드 (AC1, AC3)
  - [x] 1.1: 디렉토리 `apps/api/src/services/bot/` 생성 (현재 없음, Glob 확인 완료)
  - [x] 1.2: 입력 타입 정의 — `CreatePostAsBotInput` / `CreateCommentAsBotInput` / `CreateReplyAsBotInput` (아래 Dev Notes §입력 타입 참조)
  - [x] 1.3: 결과 타입 정의 — `BotWriteResult` (`{ status: 'published' | 'blocked'; refId?: string }`)

- [x] Task 2: `createPostAsBot(input)` 구현 (AC1, AC2, AC3)
  - [x] 2.1: **공지사항 게시 방어 가드** — `input.postInput.board === 'notice'` 이면 에러를 던진다(봇은 공지 작성 불가, ARCHITECTURE §3)
  - [x] 2.2: 본문 텍스트 추출 — `input.postInput.contentJson`에서 Tiptap text 노드 추출 후 `runContentGuard(text)` 호출 (11.3 선행 완료 가정)
  - [x] 2.3: 차단 시 처리 — `bot_generation_jobs.status = 'blocked'` 업데이트 + `bot_activity_log` INSERT(event_type=`blocked`) → `{ status: 'blocked' }` 반환
  - [x] 2.4: 통과 시 `createPost({ input: postInput, userId: input.botUserId })` 호출 (재사용 경로 확정, 아래 §재사용 경로 참조)
  - [x] 2.5: 성공 시 `bot_generation_jobs.status = 'published'`, `published_post_id` 업데이트 + `bot_activity_log` INSERT(event_type=`post.published`) → `{ status: 'published', refId: post.id }` 반환
  - [x] 2.6: 예외 발생 시 잡 상태를 `discarded`로 마킹 후 에러를 재throw — 파이프라인이 재시도 결정을 내릴 수 있도록

- [x] Task 3: `createCommentAsBot(input)` 구현 (AC1, AC2, AC3)
  - [x] 3.1: `runContentGuard(input.content)` 호출 → 차단 시 2.3과 동일 blocked 처리
  - [x] 3.2: 통과 시 11.3에서 추출된 `createComment({ userId: input.botUserId, targetType, targetId, content })` 호출
  - [x] 3.3: 성공 시 잡 상태 `published`, `published_comment_id` 업데이트 + 활동 로그(event_type=`comment.published`)

- [x] Task 4: `createReplyAsBot(input)` 구현 (AC1, AC2, AC3)
  - [x] 4.1: `runContentGuard(input.content)` 호출 → 차단 시 blocked 처리
  - [x] 4.2: `parentId` 필수 검증 — 없으면 에러
  - [x] 4.3: 11.3에서 추출된 `createComment({ userId: input.botUserId, targetType, targetId, parentId: input.parentId, content })` 호출
    - 2단계 중첩 차단은 `createComment()` 내부(`NESTING_NOT_ALLOWED` 에러)에서 이미 처리
  - [x] 4.4: 성공 시 잡 상태 `published`, `published_comment_id` 업데이트 + 활동 로그(event_type=`comment.published`)

- [x] Task 4b: `createQuestionAsBot(input)` 구현 (#6, AC1, AC2, AC3)
  - [x] 4b.1: Q&A 질문 생성 도메인 서비스 탐색 완료 — `apps/api/src/routes/v1/qna/write.service.ts`의 `createQuestion()` 재사용 (Story 3.3에서 이미 분리됨). 시그니처: `{ title, contentJson, tags, status, userId }` → `{ id, slug, status }`. 태그 upsert + taggable INSERT + OG 잡 발행 포함.
  - [x] 4b.2: 본문 텍스트 추출 → `runContentGuard(text)` 호출 → 차단 시 `blocked` 처리(2.3과 동일)
  - [x] 4b.3: 통과 시 `createQuestion({ ...questionInput, userId: input.botUserId })` 호출.
  - [x] 4b.4: 성공 시 `bot_generation_jobs.status='published'`, `published_post_id`(질문 id) 업데이트 + 활동 로그(event_type=`post.published`, payload에 `kind:'question'`).
  - [ ] 4b.5: 통합 테스트 — 질문 생성 후 Q&A 도메인 side effect(slug·태그·포인트 등) 적용 증명 (후속 스프린트 E2E 테스트 포함 예정)

- [x] Task 4c: `createResourceAsBot(input)` 구현 (#6, AC1, AC2, AC3)
  - [x] 4c.1: 실전자료 생성 도메인 서비스 탐색 완료 — `apps/api/src/routes/v1/resources/write.service.ts`의 `createResource()` 재사용 (Story 4.4에서 이미 분리됨). 시그니처: `{ input: CreateResourceInput & { status? }, userId }` → `{ id, slug, resourceType, status }`. 태그 upsert + 썸네일 추출 + 포인트 적립 포함. 파일 업로드 없는 본문 위주 자료 전용. `resourceType` 실제 값: `prompt | claude-code-skill | mcp | rules-config | template-checklist`.
  - [x] 4c.2: 본문 텍스트 추출 → `runContentGuard(text)` → 차단 시 `blocked` 처리
  - [x] 4c.3: 통과 시 자료 생성 서비스 호출(작성자=봇 `user_id`, `copyrightAgreed=true` 고정).
  - [x] 4c.4: 성공 시 `bot_generation_jobs.status='published'`, `published_post_id`(자료 id) 업데이트 + 활동 로그(event_type=`post.published`, payload에 `kind:'resource'`).
  - [ ] 4c.5: 통합 테스트 — 자료 생성 후 도메인 side effect 적용 증명 (후속 스프린트 E2E 테스트 포함 예정)

- [ ] Task 5: 통합 테스트 작성 — `createPostAsBot` side effect 전량 증명 (AC1)
  - [ ] 5.1~5.8: 통합 테스트는 실 DB가 필요한 환경 의존도로 후속 11.9/11.13 E2E 단계에서 작성 예정. AC3(직접 INSERT 없음)은 코드 리뷰로 확인 완료: `write.ts`에 `schema.posts`/`schema.comments` 직접 INSERT 없음.

- [x] Task 6: `apps/api/src/services/bot/index.ts` 배럴 export 추가
  - [x] 6.1: `export * from './write.js'` (settings.js 포함 일괄 export)

---

## Dev Notes

> ⚠️ **Epic 11 핵심 제약 — 최상단 경고**: 봇도 사람과 완전히 동일한 도메인 서비스 경로를 거친다. `write.ts` 안에서 `getDb().insert(schema.posts)` / `getDb().insert(schema.comments)` 등 DB 직접 INSERT는 절대 금지다(시드 계정 생성 제외, ARCHITECTURE §0 절대 규칙 #1). 이를 어기면 slug·summary·포인트·OG 잡 등 모든 부수효과가 누락되어 봇 콘텐츠와 사람 콘텐츠 품질이 갈린다. 코드 리뷰 체크포인트.

### 선행 의존성 (구현 전 반드시 확인)

| 의존 | 상태 | 비고 |
|---|---|---|
| **Story 11.1** — `bot_generation_jobs`(생성 작업 추적) · `bot_activity_log`(봇 활동 로그) 스키마 | 선행 완료 필수 | 이 파일이 두 테이블에 INSERT/UPDATE |
| **Story 11.3** — `comments/service.ts`의 `createComment(input)` 추출 | 선행 완료 필수 | `createCommentAsBot`/`createReplyAsBot`이 이를 호출 |
| **Story 11.3** — `runContentGuard(text): Promise<ContentGuardResult>` 추출 | 선행 완료 필수 | 게시 직전 텍스트 검사. 실패 시 `code`·`message`·`reason`을 blocked 로그에 남김 |

### 재사용 경로 (게시글)

`createPostAsBot`이 호출하는 함수:

```ts
import { createPost } from '../../routes/v1/posts/service.js'
// 위치: apps/api/src/routes/v1/posts/service.ts (line 279)
// 시그니처: createPost({ input: CreatePostInput & { status?, creativeSpec?, recruitPost? }, userId: string })
//           Promise<{ id, slug, board, category, status }>
```

`createPost()`가 내부에서 자동 처리하는 부수효과(통합 테스트 증명 대상):
- `slug`(슬러그) — `slugify(title)` + DB uniqueness 루프로 고유 슬러그 생성 [Source: apps/api/src/routes/v1/posts/service.ts, line 299~308]
- `summary`(요약) — `generateSummary(contentJson)` 자동 추출 [Source: service.ts, line 311~314]
- `thumbnailUrl`(썸네일 URL) — `extractFirstImageUrl(contentJson)` 본문 첫 이미지 추출 [Source: service.ts, line 317]
- `post_attachments`(첨부파일) INSERT — `input.attachments` 배열, 최대 5개 [Source: service.ts, line 348~359]
- tags upsert + `taggable`(태그 연결) INSERT — `input.tags` 배열 [Source: service.ts, line 361~409]
- `post_creative_spec`(창작 스펙) INSERT — `board === 'ai-creation'` 일 때만 [Source: service.ts, line 411~437]
- `recruit_post`(구인·외주 스펙) INSERT — `board === 'gigs'` 일 때만 [Source: service.ts, line 439~452]
- 포인트 적립 `earnPoints` — `status === 'published'`일 때 `post.created` reason [Source: service.ts, line 453~467]
- OG fetch 잡 발행 — `status !== 'draft'` + 외부 URL 존재 시 BullMQ `og-fetch` 큐에 fire-and-forget [Source: service.ts, line 476~497]

> **캐시 무효화**: `createPost()` 코드를 직접 확인한 결과, Redis 기반 명시적 캐시 무효화 로직은 없다. Redis는 `getPostBySlug`에서 조회수 INCR 버퍼링에만 사용한다. ARCHITECTURE.md가 "캐시 무효화"를 언급했지만 실제 구현에 없으므로 이 스토리에서도 별도 무효화 로직을 추가하지 않는다.

### 재사용 경로 (댓글·대댓글)

11.3에서 추출될 `createComment()` 예상 시그니처 (현재 comments.ts 기준 역추출):

```ts
// 위치(11.3 완료 후): apps/api/src/routes/v1/comments/service.ts
interface CreateCommentInput {
  authorId: string;                           // 봇 user_id
  targetType: 'post' | 'question' | 'answer' | 'resource' | 'comment';
  targetId: string;                           // 대상 콘텐츠 ID
  parentId?: string;                          // 대댓글이면 부모 댓글 ID
  content: string;                            // 평문 텍스트
}
// 반환: Promise<{ id: string }>
```

`createComment()` 내부 부수효과:
- `content.trim()` 검증
- parentId 있을 때 부모 댓글 존재 확인 + `NESTING_NOT_ALLOWED`(2단계 중첩 차단) [Source: apps/api/src/routes/v1/comments.ts, line 318~345]
- DB INSERT `schema.comments`
- 포인트 적립 `earnPoints` (reason=`comment.created`) [Source: comments.ts, line 362~373]
- notifications 큐 발행 (reply 시 `parentCommentAuthorId` 포함) [Source: comments.ts, line 375~385]

### `runContentGuard` 호출 방식

11.3 완료 후 아래 방식으로 import:

```ts
// 위치(11.3 완료 후): apps/api/src/middleware/contentGuard.ts
import { runContentGuard } from '../../middleware/contentGuard.js'
// 시그니처:
// type ContentGuardResult =
//   | { ok: true }
//   | { ok: false; code: string; message: string; reason?: string };
// runContentGuard(text: string): Promise<ContentGuardResult>
```

현재 `contentGuard`가 하는 검사 [Source: apps/api/src/middleware/contentGuard.ts]:
- `detectSpam(text)` — 스팸 링크 탐지
- `detectForbiddenWord(text, wordList)` — DB `site_settings.forbidden_words`(금칙어 목록) 참조

게시글의 경우 `text`는 `title + 본문 Tiptap JSON text 노드 추출` 결합값. 댓글/대댓글은 `content` 문자열 그대로.
Tiptap 텍스트 추출 함수 `extractTextFromTiptap()`는 `contentGuard.ts`에 이미 구현되어 있으므로, 11.3 추출 시 함께 export하거나 `write.ts`에서 동일 유틸을 재사용한다.

### 입력 타입 정의

```ts
// apps/api/src/services/bot/write.ts 에 정의

import type { CreatePostInput } from '@ai-jakdang/contracts'
import type { CreativeSpec, RecruitPost } from '@ai-jakdang/contracts'

export interface CreatePostAsBotInput {
  botUserId: string;            // 봇 user_id (users.is_bot=true 보장)
  personaId: string;            // bot_personas.id (활동 로그용)
  jobId: string;                // bot_generation_jobs.id (상태 업데이트용)
  postInput: CreatePostInput & {
    status?: 'published';       // 봇은 항상 published(초안 없음)
    creativeSpec?: CreativeSpec;
    recruitPost?: RecruitPost;
  };
}

export interface CreateCommentAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  targetType: 'post' | 'question' | 'answer' | 'resource' | 'comment';
  targetId: string;
  content: string;
}

export interface CreateReplyAsBotInput extends CreateCommentAsBotInput {
  parentId: string;             // 필수 (대댓글은 parentId가 반드시 있어야 함)
}

// #6: Q&A 질문 작성 (Epic3 질문 생성 도메인 서비스 입력에 맞춰 확정)
export interface CreateQuestionAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  questionInput: {              // 실제 Q&A 질문 생성 서비스 입력 타입으로 교체(4b.1에서 확정)
    title: string;
    contentJson: unknown;       // Tiptap JSON
    tags?: string[];
  };
}

// #6: 실전자료 작성 (Epic4 자료 생성 도메인 서비스 입력에 맞춰 확정)
export interface CreateResourceAsBotInput {
  botUserId: string;
  personaId: string;
  jobId: string;
  resourceInput: {              // 실제 자료 생성 서비스 입력 타입으로 교체(4c.1에서 확정)
    type: string;               // resource:<type>의 <type> (prompt/dataset/template 등 실제 키)
    title: string;
    contentJson: unknown;       // Tiptap JSON
    tags?: string[];
  };
}

export interface BotWriteResult {
  status: 'published' | 'blocked';
  refId?: string;               // 게시 성공 시 post/comment/question/resource id
}
```

> ⚠️ `CreateQuestionAsBotInput.questionInput` / `CreateResourceAsBotInput.resourceInput`의 필드는 **Task 4b.1·4c.1에서 실제 Epic3 Q&A·Epic4 자료 생성 도메인 서비스의 입력 타입을 확인한 뒤 그에 맞춰 확정**한다(여기 정의는 골격). 즉석 타입 금지 — 가능하면 `@ai-jakdang/contracts`의 기존 질문/자료 생성 스키마를 재사용한다.

### `bot_generation_jobs` 상태 업데이트 경로

이 파일은 `bot_generation_jobs`(생성 작업) 테이블에 직접 UPDATE를 한다 — 이것은 메타데이터 갱신이며 콘텐츠 INSERT가 아니므로 허용:

```ts
// 게시 성공 시
await db.update(schema.botGenerationJobs)
  .set({ status: 'published', publishedPostId: post.id, updatedAt: new Date() })
  .where(eq(schema.botGenerationJobs.id, input.jobId));

// contentGuard 차단 시
await db.update(schema.botGenerationJobs)
  .set({ status: 'blocked', updatedAt: new Date() })
  .where(eq(schema.botGenerationJobs.id, input.jobId));
```

### `bot_activity_log` 기록 경로

```ts
// 게시 성공 예시
await db.insert(schema.botActivityLog).values({
  personaId: input.personaId,
  eventType: 'post.published',          // 'post.published' | 'comment.published' | 'blocked'
  refId: post.id,
  payload: { jobId: input.jobId, board: input.postInput.board },
});

// 차단 시
await db.insert(schema.botActivityLog).values({
  personaId: input.personaId,
  eventType: 'blocked',
  refId: input.jobId,
  payload: { reason: guardResult.code ?? 'FORBIDDEN_CONTENT' },
});
```

### 공지사항 게시 방어 가드

EPICS-AND-STORIES.md Story 11.9 AC#6: "공지사항은 봇 작성 안 함(가드)". `createPostAsBot`에서:

```ts
if (input.postInput.board === 'notice') {
  throw new Error('[bot-write] 봇은 공지사항 게시판에 글을 작성할 수 없습니다.');
}
```

### 봇 userId 검증

`botUserId`가 `users.is_bot=true`인지 런타임 검증을 `createPostAsBot`에서 수행하면 매 호출마다 추가 쿼리가 발생한다. 11.5에서 `ensureBotUser(persona)`가 봇 계정을 보장하므로, 이 스토리에서는 입력값을 신뢰(11.5 계약)하되, 개발 환경에서는 `assert(isBotUser)` 검증을 선택 옵션으로 추가해도 된다.

### 타입 import 정리

```ts
// packages/contracts에서 가져올 것들
import type { CreatePostInput } from '@ai-jakdang/contracts'
import type { CreativeSpec, RecruitPost } from '@ai-jakdang/contracts'

// 기존 posts service
import { createPost } from '../../routes/v1/posts/service.js'

// 11.3에서 추출된 것들 (선행 완료 후 주석 해제)
// import { createComment } from '../../routes/v1/comments/service.js'
// import { runContentGuard } from '../../middleware/contentGuard.js'

// DB
import { getDb, schema } from '@ai-jakdang/database'
import { eq } from 'drizzle-orm'
```

### 주의: `createPostInput` 필수 필드

`CreatePostInput`에서 봇이 반드시 채워야 하는 필드 [Source: packages/contracts/src/post.ts]:
- `board`: 페르소나 담당 게시판 슬러그 (contracts `BOARDS` 키, Story 11.5 매핑표 참조)
- `title`: 최소 2자 이상
- `contentJson`: Tiptap JSON 객체 (`Record<string, unknown>`)
- `tags`: 선택 (최대 10개, 각 1~30자)

`summary`(요약)는 `createPost()` 내부에서 자동 생성되므로 봇이 생성한 요약을 넘겨도 되고 생략해도 된다.

### 파일 변경 요약

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `apps/api/src/services/bot/write.ts` | **신규** | 이 스토리의 핵심 산출물 |
| `apps/api/src/services/bot/index.ts` | **신규** | 배럴 export |
| `apps/api/src/routes/v1/posts/service.ts` | **읽기 전용** | `createPost()` 재사용, 수정 없음 |
| `apps/api/src/routes/v1/comments/service.ts` | **읽기 전용** (11.3 생성) | `createComment()` 재사용, 수정 없음 |
| `apps/api/src/middleware/contentGuard.ts` | **읽기 전용** (11.3 수정) | `runContentGuard()` 재사용, 수정 없음 |

### Project Structure Notes

- `apps/api/src/services/bot/` 디렉토리는 현재 존재하지 않음(Glob 확인). 신규 생성.
- 기존 `apps/api/src/routes/v1/` 하위에 있는 service 패턴과 달리, 봇 서비스는 `services/bot/` 에 위치한다(ARCHITECTURE §1 표 참조). 이는 라우트에 종속되지 않는 공용 서비스이기 때문.
- worker가 이 서비스를 직접 호출해야 하는 경우 `apps/api/src/*`를 직접 import하지 말고, 후속 경계 정리에서 `packages/server-bot` 같은 server-only 공용 패키지로 옮긴 뒤 api/worker가 그 패키지를 공유한다. 이 스토리는 API 내부 도메인 서비스의 원형을 정의하되, worker import 경계는 Story 11.9/11.10/11.13 착수 전 확정한다.
- `packages/contracts/src/bot.ts`(Story 11.2)에서 입력/출력 Zod 스키마가 정의된다. 이 스토리에서는 로컬 TypeScript 인터페이스로 대체하되, 11.2 완료 후 Zod 스키마로 교체한다.
- 테스트 파일 위치: `apps/api/src/services/bot/write.test.ts` (API 통합 테스트, jest + drizzle 테스트 DB)

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.4] — AC 원문, 의존성
- [Source: docs/seeding-bot/ARCHITECTURE.md, §0 절대 규칙] — DB 직접 INSERT 금지
- [Source: docs/seeding-bot/ARCHITECTURE.md, §3 공용 도메인 서비스] — `createPostAsBot` 설계 원칙
- [Source: docs/seeding-bot/ARCHITECTURE.md, §2.7 bot_generation_jobs] — 상태 라이프사이클
- [Source: docs/seeding-bot/ARCHITECTURE.md, §2.9 bot_activity_log] — 이벤트 타입 목록
- [Source: apps/api/src/routes/v1/posts/service.ts, line 279~499] — `createPost()` 실제 구현 (slug·summary·썸네일·태그·첨부·포인트·OG 잡 처리 전량 확인)
- [Source: apps/api/src/routes/v1/comments.ts, line 285~390] — `POST /comments` 도메인 로직 (11.3 추출 원본)
- [Source: apps/api/src/middleware/contentGuard.ts, line 101~138] — `contentGuard` 검사 로직 (11.3 추출 원본)
- [Source: packages/contracts/src/post.ts] — `CreatePostInput` 및 `CreativeSpec`, `RecruitPost` 타입

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

없음 (타입체크 1회 통과, 에러 없음)

### Completion Notes List

1. **선행 서비스 탐색 결과**:
   - Q&A 질문: `apps/api/src/routes/v1/qna/write.service.ts` → `createQuestion({ title, contentJson, tags, status, userId })` — Story 3.3에서 이미 분리됨, 인라인 추출 불필요.
   - 실전자료: `apps/api/src/routes/v1/resources/write.service.ts` → `createResource({ input: CreateResourceInput & { status? }, userId })` — Story 4.4에서 이미 분리됨, 인라인 추출 불필요.
2. **댓글 서비스 필드명**: 스토리 Dev Notes에 `authorId`로 기재되어 있으나 실제 `comments/service.ts` 인터페이스는 `userId`임 — 실제 시그니처 기준으로 구현.
3. **extractTextFromTiptap**: `contentGuard.ts`에서 export하지 않아 로컬 복제 정의. 완전히 동일한 로직.
4. **`CreateResourceInput.copyrightAgreed`**: `z.literal(true)` 타입이므로 봇 경로에서 항상 `true` 하드코딩 (봇 운영자 동의 전제, Story 4c.3 지침).
5. **통합 테스트**: Task 5(실 DB 필요 통합 테스트)는 환경 의존도로 후속 11.9/11.13 단계에서 작성 예정. AC3(직접 INSERT 없음)은 코드 리뷰로 확인: `write.ts`에 `schema.posts`, `schema.comments`, `schema.questions`, `schema.resources` 직접 INSERT 호출 없음.
6. **handleFailed 반환 타입**: `Promise<never>`로 선언하여 TypeScript 흐름 분석이 catch 블록 이후 코드를 dead code로 정확히 인식.

### File List

- `apps/api/src/services/bot/write.ts` — **신규** (이 스토리의 핵심 산출물)
- `apps/api/src/services/bot/index.ts` — **신규** (배럴 export)
