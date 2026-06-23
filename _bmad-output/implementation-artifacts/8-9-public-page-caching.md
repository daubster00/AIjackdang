# Story 8.9: 공개 페이지 성능 캐싱

Status: ready-for-dev

## Story

As a 서비스 운영팀,
I want 공개 목록·상세 페이지에 Next.js Route Segment Cache가 설정되고, 메인 인기글·랭킹·태그 섹션이 Redis로 캐시되며, Redis 장애 시 DB 폴백이 작동하기를,
so that 서버 부하 없이 빠른 공개 페이지를 제공하고 새 글 등록 후 캐시가 무효화되어 최신 콘텐츠가 반영된다(AR-17, AR-16).

## Acceptance Criteria

1. 공개 목록 페이지(게시판 목록, 태그 랜딩 등)에 `export const revalidate = 60`이 선언된다. 해당 페이지의 Next.js Route Segment Cache가 60초 TTL로 동작한다(AR-17).
2. 공개 상세 페이지(게시글 상세, 질문 상세, 자료 상세 등)에 `export const revalidate = 300`이 선언된다(AR-17).
3. 새 글 작성·수정·삭제 API 성공 후 Next.js On-Demand Revalidation이 트리거된다. 구체적으로 `apps/web`의 서버 액션 또는 Route Handler가 API 성공 응답을 받으면 `revalidatePath` 또는 `revalidateTag`를 호출해 해당 경로 캐시를 즉시 무효화한다(AR-17).
4. `packages/utilities/src/cache-keys.ts`가 신규 생성된다. `CACHE_KEYS` 상수 객체를 export하며 다음 키를 포함한다:
   - `POPULAR_ALL_7D: "main:popular:all:7d"` — 메인 페이지 전체 인기글 7일
   - `POPULAR_CATEGORY_30D: (category: string) => \`main:popular:${category}:30d\`` — 카테고리별 인기글 30일
   - `RESOURCES_POPULAR: "main:resources:popular"` — 메인 인기 자료
   - `LOUNGE_LATEST: "main:lounge:latest"` — 메인 라운지 최신글
   - `TAGS_POPULAR: "tags:popular"` — 인기 태그
   - `RANKING_WEEKLY: "ranking:weekly"` — 주간 랭킹
   - `RANKING_MONTHLY: "ranking:monthly"` — 월간 랭킹
5. `apps/api/src/lib/cache.ts`가 신규 생성된다. `CACHE_KEYS`를 `packages/utilities/src/cache-keys.ts`에서 re-export하며, Redis `try/catch` 폴백 래퍼 `withCache<T>(key: string, ttlSeconds: number, fallback: () => Promise<T>): Promise<T>`를 export한다. Redis 오류 시 DB 폴백을 실행하고 pino 로거로 `warn` 레벨 로그만 남기며 오류를 전파하지 않는다(AR-17).
6. `apps/api`의 메인 인기글(`main:popular:*`), 인기 자료(`main:resources:popular`), 라운지 최신글(`main:lounge:latest`) 엔드포인트가 `withCache` 래퍼를 사용하여 Redis에서 응답을 반환하고, 캐시 미스(Miss) 시 DB를 집계한 뒤 Redis에 TTL 1h(3600초)로 저장한다.
7. `apps/api`의 인기 태그 엔드포인트(`GET /api/v1/tags/popular`)가 `withCache`로 `CACHE_KEYS.TAGS_POPULAR`(TTL 1h)를 읽고, 캐시 미스 시 DB에서 집계한다.
8. `apps/worker`에 `ranking` 큐(`QUEUE_NAMES.ranking`)가 추가되고, `ranking.compute` 잡을 처리하는 워커가 등록된다. 해당 워커는 매 1시간마다 반복 실행(BullMQ Repeatable Job)되며 인기 태그 Redis 캐시(`CACHE_KEYS.TAGS_POPULAR`)를 DB 집계 결과로 갱신한다(AR-16).
9. Redis 장애 상황에서 API 엔드포인트는 오류를 응답에 노출하지 않는다. Redis 오류는 pino `logger.warn`으로만 기록하고 DB 폴백 결과를 정상 반환한다.
10. `packages/utilities/src/index.ts`에 `cache-keys.ts` re-export가 추가된다.
11. `pnpm typecheck` 전 워크스페이스 통과.

## Tasks / Subtasks

- [ ] Task 1: `packages/utilities/src/cache-keys.ts` 신규 생성 (AC: #4, #10)
  - [ ] `packages/utilities/src/cache-keys.ts` NEW
  - [ ] `CACHE_KEYS` 상수 객체 정의 (`as const`):
    ```ts
    export const CACHE_KEYS = {
      POPULAR_ALL_7D: "main:popular:all:7d",
      POPULAR_CATEGORY_30D: (category: string) => `main:popular:${category}:30d`,
      RESOURCES_POPULAR: "main:resources:popular",
      LOUNGE_LATEST: "main:lounge:latest",
      TAGS_POPULAR: "tags:popular",
      RANKING_WEEKLY: "ranking:weekly",
      RANKING_MONTHLY: "ranking:monthly",
    } as const;
    ```
  - [ ] `packages/utilities/src/index.ts` UPDATE: `export * from "./cache-keys"` 추가

- [ ] Task 2: `apps/api/src/lib/cache.ts` 신규 생성 (AC: #5, #6, #7, #9)
  - [ ] `apps/api/src/lib/` 폴더 생성
  - [ ] `apps/api/src/lib/cache.ts` NEW
  - [ ] `CACHE_KEYS` re-export: `export { CACHE_KEYS } from "@aijakdang/utilities"`
  - [ ] `ioredis` Redis 클라이언트 싱글턴 생성 또는 `apps/api`에 기존 Redis 클라이언트가 있으면 임포트
  - [ ] `withCache<T>` 구현:
    ```ts
    export async function withCache<T>(
      key: string,
      ttlSeconds: number,
      fallback: () => Promise<T>,
    ): Promise<T> {
      try {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached) as T;
      } catch (e) {
        logger.warn({ err: e, key }, "Redis GET 실패 — DB 폴백");
      }
      const data = await fallback();
      try {
        await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      } catch (e) {
        logger.warn({ err: e, key }, "Redis SET 실패 — 캐시 저장 건너뜀");
      }
      return data;
    }
    ```
  - [ ] `logger`는 `apps/api/src/app.ts`의 Fastify pino 로거 대신 독립 pino 인스턴스 사용: `import pino from "pino"; const logger = pino({ name: "cache" })`
  - [ ] Redis 클라이언트: `new Redis(process.env.REDIS_URL ?? "redis://localhost:6379")`. BullMQ용 연결(`maxRetriesPerRequest: null`)과 분리된 일반 캐시용 연결 사용

- [ ] Task 3: Next.js Route Segment Cache — 목록 페이지 `revalidate=60` 선언 (AC: #1)
  - [ ] 아래 파일 각각의 최상단(import 이후)에 `export const revalidate = 60` 추가 (UPDATE)
  - [ ] `apps/web/app/vibe-coding/page.tsx`
  - [ ] `apps/web/app/automation/page.tsx`
  - [ ] `apps/web/app/monetize/page.tsx`
  - [ ] `apps/web/app/questions/page.tsx`
  - [ ] `apps/web/app/lounge/page.tsx`
  - [ ] `apps/web/app/lounge/talk/page.tsx`
  - [ ] `apps/web/app/lounge/gigs/page.tsx`
  - [ ] `apps/web/app/lounge/products/page.tsx`
  - [ ] `apps/web/app/resources/mcp-skills/page.tsx`
  - [ ] `apps/web/app/resources/prompts/page.tsx`
  - [ ] `apps/web/app/resources/rules/page.tsx`
  - [ ] `apps/web/app/resources/templates/page.tsx`
  - [ ] `apps/web/app/tags/[tag]/page.tsx`
  - [ ] `apps/web/app/page.tsx` (홈 메인): `revalidate = 60`

- [ ] Task 4: Next.js Route Segment Cache — 상세 페이지 `revalidate=300` 선언 (AC: #2)
  - [ ] 아래 파일 각각의 최상단에 `export const revalidate = 300` 추가 (UPDATE)
  - [ ] `apps/web/app/vibe-coding/[slug]/page.tsx`
  - [ ] `apps/web/app/automation/[slug]/page.tsx`
  - [ ] `apps/web/app/monetize/[slug]/page.tsx`
  - [ ] `apps/web/app/questions/[slug]/page.tsx`
  - [ ] `apps/web/app/lounge/[slug]/page.tsx`
  - [ ] `apps/web/app/lounge/talk/[slug]/page.tsx`
  - [ ] `apps/web/app/lounge/gigs/[slug]/page.tsx`
  - [ ] `apps/web/app/lounge/products/[slug]/page.tsx`
  - [ ] `apps/web/app/resources/mcp-skills/[slug]/page.tsx`
  - [ ] `apps/web/app/resources/prompts/[slug]/page.tsx`
  - [ ] `apps/web/app/resources/rules/[slug]/page.tsx`
  - [ ] `apps/web/app/resources/templates/[slug]/page.tsx`

- [ ] Task 5: On-Demand Revalidation — Next.js Revalidation Route Handler 생성 (AC: #3)
  - [ ] `apps/web/app/api/revalidate/route.ts` NEW
  - [ ] `POST /api/revalidate` 엔드포인트 구현:
    ```ts
    import { revalidatePath, revalidateTag } from "next/cache";
    import { NextRequest, NextResponse } from "next/server";

    export async function POST(req: NextRequest) {
      const secret = req.headers.get("x-revalidate-secret");
      if (secret !== process.env.REVALIDATE_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { path, tag } = await req.json();
      if (path) revalidatePath(path);
      if (tag) revalidateTag(tag);
      return NextResponse.json({ revalidated: true });
    }
    ```
  - [ ] `REVALIDATE_SECRET` 환경변수: `apps/web/.env.example`에 `REVALIDATE_SECRET=` 추가
  - [ ] `apps/api`에서 글 작성(POST)·수정(PATCH)·삭제(DELETE) 성공 후 `apps/web`의 `/api/revalidate`를 `fetch`로 호출하는 헬퍼 `apps/api/src/lib/revalidate.ts` NEW:
    ```ts
    export async function triggerRevalidate(path?: string, tag?: string) {
      const url = process.env.WEB_PUBLIC_URL ?? "http://localhost:3003";
      const secret = process.env.REVALIDATE_SECRET;
      try {
        await fetch(`${url}/api/revalidate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-revalidate-secret": secret ?? "",
          },
          body: JSON.stringify({ path, tag }),
        });
      } catch (e) {
        // 무효화 실패는 치명적이지 않음 — 로그만 남김
        logger.warn({ err: e }, "revalidate 호출 실패");
      }
    }
    ```
  - [ ] `apps/api/src/routes/v1/` 글 작성·수정·삭제 라우트에서 성공 후 `triggerRevalidate('/vibe-coding', 'posts')` 등 호출 추가 (해당 라우트가 Epic 2~4에서 구현된 경우 UPDATE, 미구현 시 TODO 주석으로 표시)

- [ ] Task 6: `apps/api` 메인 인기글·자료·라운지 엔드포인트에 `withCache` 적용 (AC: #6)
  - [ ] `apps/api/src/routes/v1/main.ts` 존재 여부 확인. 없으면 NEW 생성
  - [ ] `GET /api/v1/main/popular` — `withCache(CACHE_KEYS.POPULAR_ALL_7D, 3600, () => db.query(...))`
  - [ ] `GET /api/v1/main/popular/:category` — `withCache(CACHE_KEYS.POPULAR_CATEGORY_30D(category), 3600, () => db.query(...))`
  - [ ] `GET /api/v1/main/resources` — `withCache(CACHE_KEYS.RESOURCES_POPULAR, 3600, () => db.query(...))`
  - [ ] `GET /api/v1/main/lounge` — `withCache(CACHE_KEYS.LOUNGE_LATEST, 3600, () => db.query(...))`
  - [ ] DB 집계 쿼리는 실제 스키마가 완성된 Epic 2~5 이후 구현. 현재 단계에서는 Drizzle `select` 쿼리 골격만 작성하고 집계 로직은 TODO 주석으로 표시

- [ ] Task 7: `apps/api` 인기 태그 엔드포인트에 `withCache` 적용 (AC: #7)
  - [ ] `apps/api/src/routes/v1/tags.ts` 존재 여부 확인. 없으면 NEW 생성
  - [ ] `GET /api/v1/tags/popular` — `withCache(CACHE_KEYS.TAGS_POPULAR, 3600, () => db.query(popularTagsFromDb))`
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: `tags` 라우트 등록 추가 (미등록 시)

- [ ] Task 8: `apps/worker`에 `ranking` 큐 및 Repeatable Job 추가 (AC: #8)
  - [ ] `apps/worker/src/connection.ts` UPDATE: `QUEUE_NAMES`에 `ranking: "ranking"` 추가
  - [ ] `apps/worker/src/queues/ranking.ts` NEW: BullMQ `Queue` 인스턴스 생성 + Repeatable Job 등록:
    ```ts
    import { Queue } from "bullmq";
    import { createConnection, QUEUE_NAMES } from "../connection";

    export async function startRankingQueue() {
      const queue = new Queue(QUEUE_NAMES.ranking, { connection: createConnection() });
      await queue.upsertJobScheduler(
        "ranking-hourly",
        { every: 60 * 60 * 1000 }, // 1시간(밀리초)
        { name: "ranking.compute" },
      );
      return queue;
    }
    ```
  - [ ] `apps/worker/src/workers/ranking.ts` NEW: `ranking.compute` 잡 처리기:
    ```ts
    import { Worker } from "bullmq";
    import { createConnection, QUEUE_NAMES } from "../connection";
    import { CACHE_KEYS } from "@aijakdang/utilities";

    export function createRankingWorker() {
      return new Worker(
        QUEUE_NAMES.ranking,
        async (job) => {
          if (job.name === "ranking.compute") {
            // TODO: DB 집계 후 Redis 갱신
            // const tags = await db.query(popularTagsFromDb);
            // await redis.set(CACHE_KEYS.TAGS_POPULAR, JSON.stringify(tags), "EX", 3600);
            console.log("[ranking] ranking.compute 잡 실행 (DB 집계 구현 예정)");
          }
        },
        { connection: createConnection() },
      );
    }
    ```
  - [ ] `apps/worker/src/index.ts` UPDATE: `startRankingQueue()` 호출 및 `createRankingWorker()` 등록 추가

- [ ] Task 9: Redis 클라이언트 환경변수 및 `.env.example` 보완 (AC: #5, #9)
  - [ ] `apps/api/.env.example`에 `REDIS_URL=redis://localhost:6379` 추가 (미존재 시)
  - [ ] `apps/api/.env.example`에 `WEB_PUBLIC_URL=http://localhost:3003` 추가 (미존재 시)
  - [ ] `apps/api/.env.example`에 `REVALIDATE_SECRET=` 추가
  - [ ] `apps/web/.env.example`에 `REVALIDATE_SECRET=` 추가 (미존재 시)

- [ ] Task 10: typecheck 통과 확인 (AC: #11)
  - [ ] `pnpm typecheck` 전 워크스페이스 실행
  - [ ] `@aijakdang/utilities` 패키지가 `apps/api`, `apps/worker`의 `package.json` `dependencies`에 포함되어 있는지 확인. 미포함 시 추가

## Dev Notes

### Route Segment Cache `revalidate` 사용 주의사항
- `export const revalidate = 60`은 Next.js App Router Route Segment Config 선언. 파일 최상단(컴포넌트 정의 전)에 위치해야 함.
- 동적 파라미터(`[slug]`)가 있는 페이지에서 `revalidate`와 `generateStaticParams`를 함께 쓸 경우: `generateStaticParams`는 빌드 타임 프리렌더 대상을 정의하고, `revalidate`는 ISR(증분 정적 재생성) TTL을 설정함. 두 설정이 함께 있어도 충돌하지 않음.
- `revalidate = 0`은 항상 동적 렌더(SSR). `revalidate = false`는 무기한 캐시. 본 스토리에서는 목록=60, 상세=300, 사이트맵=3600(AR-17) 준수.
- 인증이 필요한 페이지(`/mypage`, `/settings/**`, `/bookmarks`, `/messages`, `/notifications`)에는 `revalidate` 선언 불필요 — 이미 세션 의존으로 동적 렌더됨.

### On-Demand Revalidation 패턴
- Next.js 16에서 `revalidatePath`와 `revalidateTag`는 Server Action 또는 Route Handler 안에서만 호출 가능. 클라이언트 컴포넌트에서 직접 호출 불가.
- `apps/api`(Fastify)는 별도 프로세스이므로 `revalidatePath`를 직접 호출할 수 없음. 대신 `apps/web`에 만든 `/api/revalidate` Route Handler를 HTTP로 호출하는 방식 사용.
- `REVALIDATE_SECRET`으로 무단 호출 방지. 값은 `crypto.randomUUID()` 등으로 생성된 임의 문자열 사용.
- 태그 기반 무효화(`revalidateTag`) 사용 시: `fetch` 호출에 `next: { tags: ["posts"] }` 옵션을 추가해야 함. 현재 목업 데이터를 fetch로 교체할 때 태그 옵션 적용.

### Redis 폴백 패턴 (withCache 구현 핵심)
```ts
// 읽기 실패 → 즉시 DB 폴백 (캐시 없는 것처럼 처리)
// 쓰기 실패 → 무시 (다음 요청에 재시도)
// 오류 → pino warn (에러 전파 없음)
```
- Redis 연결 오류(`ECONNREFUSED`)는 `ioredis`가 내부적으로 재연결을 시도. `withCache`의 try/catch는 재연결 중 발생하는 오류를 잡아 DB 폴백으로 처리.
- `JSON.parse` 실패도 catch 범위에 포함됨 — 캐시 데이터 손상 시 자동 DB 재집계.

### BullMQ Repeatable Job
- BullMQ v5에서 Repeatable Job은 `queue.upsertJobScheduler`(구 `queue.add` + `repeat` 옵션)로 등록.
- `every: 60 * 60 * 1000` = 1시간 간격(밀리초 단위).
- 워커 재기동 시 중복 등록 방지: `upsertJobScheduler`는 같은 `schedulerId`를 가진 스케줄이 있으면 업데이트만 함.
- `ranking.compute` 잡 처리기 내에서 Redis `SET`은 `apps/api/src/lib/cache.ts`의 Redis 클라이언트와 동일한 연결 설정 사용. 단 워커 Redis는 BullMQ용(`maxRetriesPerRequest: null`)과 캐시용을 분리 필요 — 캐시 갱신용 Redis는 별도 `new Redis(REDIS_URL)` 생성.

### 캐시 키 중앙화 원칙 (AR-17)
- `CACHE_KEYS`는 `packages/utilities/src/cache-keys.ts` 단 하나에 정의. `apps/api`와 `apps/worker` 모두 이 패키지를 import.
- 새 Redis 키를 추가할 때 반드시 이 파일에만 추가. 라우트 파일·워커 파일에 문자열 리터럴로 하드코딩 금지.
- `POPULAR_CATEGORY_30D`는 함수 형태(카테고리 파라미터 포함): `CACHE_KEYS.POPULAR_CATEGORY_30D("vibe-coding")` → `"main:popular:vibe-coding:30d"`.

### 조회수와 인기글 정렬
- Epic 2/5의 view-flush 로직이 완료된 후 DB `view_count`가 Redis flush된 값을 반영함.
- 인기글 정렬 쿼리는 `view_count` + 좋아요 가중 합산. 집계 쿼리 구현은 Epic 2~5 완료 후 `withCache`의 `fallback` 함수에 채워넣음.
- 현재 목업 데이터를 반환하는 페이지는 `revalidate` 선언만 추가하고 실제 API 연동은 후속 스토리에서 처리.

### 현재 상태 (기존 파일 분석)
- `apps/worker/src/connection.ts`: `QUEUE_NAMES`에 `imageProcessing`, `email`, `stats` 3개 큐 있음. `ranking` 큐 추가 필요.
- `apps/worker/src/index.ts`: `imageWorker` 1개만 등록됨. ranking 워커 추가 필요.
- `apps/api/src/lib/`: 현재 폴더 없음. `cache.ts`, `revalidate.ts` 신규 생성.
- `packages/utilities/src/index.ts`: `string`, `number`, `date` 3개 export. `cache-keys` 추가 필요.
- `apps/web/app/page.tsx`: 정적 목업 데이터 반환. `revalidate=60` 선언만 추가하면 됨 (API 연동은 별도 스토리).

### Project Structure Notes

신규 파일:
- `packages/utilities/src/cache-keys.ts` — CACHE_KEYS 상수 중앙 정의
- `apps/api/src/lib/cache.ts` — withCache 래퍼 + CACHE_KEYS re-export
- `apps/api/src/lib/revalidate.ts` — Next.js On-Demand Revalidation 트리거 헬퍼
- `apps/api/src/routes/v1/main.ts` — 메인 인기글/자료/라운지 엔드포인트 (미존재 시)
- `apps/api/src/routes/v1/tags.ts` — 인기 태그 엔드포인트 (미존재 시)
- `apps/web/app/api/revalidate/route.ts` — On-Demand Revalidation Route Handler
- `apps/worker/src/queues/ranking.ts` — ranking 큐 + Repeatable Job 등록
- `apps/worker/src/workers/ranking.ts` — ranking.compute 잡 처리기

수정 파일:
- `packages/utilities/src/index.ts` — cache-keys re-export 추가
- `apps/worker/src/connection.ts` — QUEUE_NAMES에 ranking 추가
- `apps/worker/src/index.ts` — ranking 큐/워커 시작 추가
- `apps/api/src/routes/v1/index.ts` — tags/main 라우트 등록 추가
- 목록 page.tsx 14개 — `export const revalidate = 60` 추가
- 상세 page.tsx 12개 — `export const revalidate = 300` 추가
- `apps/api/.env.example`, `apps/web/.env.example` — 환경변수 추가

### References

- [AR-17: Next SSR route cache — revalidate=60(목록), revalidate=300(상세), revalidate=3600(sitemap)]
- [AR-16: BullMQ background queue — `ranking` 큐, `ranking.compute` 잡, 1h 주기]
- [Source: architecture.md#Caching Strategy]
- [Source: project-context.md#Performance]
- [FR-11.9: 공개 목록/상세 캐싱 요구사항]
- [apps/worker/src/connection.ts: QUEUE_NAMES 기존 정의 참조]
- [apps/worker/src/index.ts: 워커 시작 패턴 참조]
- [apps/api/src/app.ts: Fastify pino 로거 패턴 참조]
- [packages/utilities/src/index.ts: 배럴 파일 패턴 참조]
- [Story 8.1: 검색 인덱스 (tags 테이블 참조)]
- [Epic 2~5: view-flush, 게시글 스키마 선행 의존]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/utilities/src/cache-keys.ts`
- NEW: `apps/api/src/lib/cache.ts`
- NEW: `apps/api/src/lib/revalidate.ts`
- NEW: `apps/api/src/routes/v1/main.ts`
- NEW: `apps/api/src/routes/v1/tags.ts`
- NEW: `apps/web/app/api/revalidate/route.ts`
- NEW: `apps/worker/src/queues/ranking.ts`
- NEW: `apps/worker/src/workers/ranking.ts`
- UPDATE: `packages/utilities/src/index.ts`
- UPDATE: `apps/worker/src/connection.ts`
- UPDATE: `apps/worker/src/index.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`
- UPDATE: `apps/api/.env.example`
- UPDATE: `apps/web/.env.example`
- UPDATE: `apps/web/app/page.tsx`
- UPDATE: `apps/web/app/vibe-coding/page.tsx`
- UPDATE: `apps/web/app/automation/page.tsx`
- UPDATE: `apps/web/app/monetize/page.tsx`
- UPDATE: `apps/web/app/questions/page.tsx`
- UPDATE: `apps/web/app/lounge/page.tsx`
- UPDATE: `apps/web/app/lounge/talk/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/page.tsx`
- UPDATE: `apps/web/app/lounge/products/page.tsx`
- UPDATE: `apps/web/app/resources/mcp-skills/page.tsx`
- UPDATE: `apps/web/app/resources/prompts/page.tsx`
- UPDATE: `apps/web/app/resources/rules/page.tsx`
- UPDATE: `apps/web/app/resources/templates/page.tsx`
- UPDATE: `apps/web/app/tags/[tag]/page.tsx`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/questions/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/talk/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/products/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/mcp-skills/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/prompts/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/rules/[slug]/page.tsx`
- UPDATE: `apps/web/app/resources/templates/[slug]/page.tsx`
