# Story 11.18: 텔레그램 푸시

Status: ready-for-dev

## Story

As a 시스템 운영자,
I want 매일 아침 텔레그램으로 봇 활동 간단 요약을 받기,
so that 대시보드를 직접 열지 않아도 전날 봇 활동 현황과 보류 건수를 빠르게 파악할 수 있다.

---

## Acceptance Criteria

1. `bot.daily-report`(일일 리포트 잡) 처리 마지막 단계에서 텔레그램 메시지를 전송한다. 메시지 내용: 날짜, 글 N건·댓글 M건, 보류 건수, 관리자 대시보드 링크(`ADMIN_PUBLIC_URL`(관리자 웹 공개 URL) + `/bots`).

2. `bot_settings.bot_push_channel`(푸시 채널) 값이 `"telegram"`이 아니면 텔레그램 전송을 시도하지 않는다(향후 다른 채널 지원을 위한 예비 분기).

3. `TELEGRAM_BOT_TOKEN`(BotFather 발급 봇 토큰) 또는 `TELEGRAM_CHAT_ID`(리포트 받을 채팅·채널 ID)가 설정되지 않으면 **graceful skip** — 경고 로그만 남기고 잡 자체는 성공으로 완료한다.

4. Telegram API 호출 실패(HTTP 비-2xx, 네트워크 오류 등) 시 에러 로그를 남기되 잡 전체를 실패시키지 않는다. 텔레그램 푸시는 부가 기능이며, 리포트 집계 성공·실패와 독립적으로 처리된다.

5. `packages/config/src/env.ts`에 `TELEGRAM_BOT_TOKEN`(봇 토큰)과 `TELEGRAM_CHAT_ID`(채팅 ID)가 `optional` 필드로 추가된다.

---

## Tasks / Subtasks

### Task 1: `packages/config/src/env.ts` — Telegram env 추가 (AC: #3, #5)

- [ ] 1.1 `envSchema` 객체 안에 아래 두 필드를 optional로 추가한다.
  ```typescript
  TELEGRAM_BOT_TOKEN: z.string().optional(), // BotFather 발급 봇 토큰
  TELEGRAM_CHAT_ID:   z.string().optional(), // 리포트 받을 채팅·채널 ID
  ```
  기존 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`(소셜 OAuth용)과 혼동 금지. 이 스토리에서 추가하는 키는 이 두 개뿐이다.
- [ ] 1.2 `pnpm -F @ai-jakdang/config typecheck`로 타입 추론이 `Env`에 반영됨을 확인한다.

### Task 2: `apps/worker/src/lib/telegram.ts` 신규 생성 (AC: #1, #3, #4)

- [ ] 2.1 `sendTelegramMessage(token: string, chatId: string, text: string): Promise<void>` 구현.
  - Node.js 내장 `fetch()`(Node 18+) 사용. 외부 SDK(node-telegram-bot-api 등) 금지.
  - `POST https://api.telegram.org/bot{token}/sendMessage`
  - Body: `{ chat_id: chatId, text, parse_mode: 'HTML' }`
  - 네트워크 오류: try/catch로 잡아 `console.error` 후 **return** (throw 금지).
  - HTTP 비-2xx: `res.ok !== true`이면 응답 body 포함 `console.error` 후 **return** (throw 금지).
  
  ```typescript
  // 구현 예시 (실제 코드에 그대로 사용 가능)
  export async function sendTelegramMessage(
    token: string,
    chatId: string,
    text: string,
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
    } catch (err) {
      console.error('[telegram] 네트워크 오류:', (err as Error).message);
      return; // graceful skip — throw 않음
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[telegram] API 오류 (${res.status}): ${body}`);
      return; // graceful skip — throw 않음
    }
  }
  ```

- [ ] 2.2 `buildDailyReportMessage(summary: BotDailyReportSummary, dashboardUrl: string): string` 구현.
  - 순수 함수. DB·네트워크 접근 없음.
  - `BotDailyReportSummary`는 Story 11.17이 `packages/contracts/src/bot.ts`에서 `botDailyReportSummarySchema`와 함께 export한 타입을 import한다. worker 내부 임시 interface 재정의 금지.
  - `summary` 필드 중 11.18에서 사용하는 것: `date`(어제 날짜 "YYYY-MM-DD"), `publishedPosts`(게시된 글 건수), `publishedComments`(게시된 댓글 건수), `heldCount`(보류 큐 잔여 건수).
  - 출력 예시(Telegram HTML):
    ```
    🤖 <b>AI작당 봇 일일 리포트</b> (2026-06-29)
    
    글 5건 · 댓글 12건
    보류: 2건
    
    👉 <a href="https://admin.example.com/bots">대시보드 바로가기</a>
    ```
  - Telegram HTML 허용 태그: `<b>`, `<i>`, `<a href="...">`. 그 외 태그 사용 금지.
  - 총 길이는 200자 이내(Telegram 4096자 제한 내 여유).

- [ ] 2.3 `apps/worker/src/lib/telegram.test.ts` 단위 테스트 작성.
  - `buildDailyReportMessage`가 `<b>`, `<a href>`, `heldCount`(보류 건수), `publishedPosts`(게시 글 수) 값을 올바르게 포함하는지 검증.
  - 기존 worker 테스트 스타일(Vitest 또는 Jest) 동일 적용. `apps/worker/src/processors/resource-scan.processor.test.ts` 패턴 참고.

### Task 3: `apps/worker/src/lib/botSettings.ts` 신규 생성 — 푸시 채널 조회 (AC: #2)

- [ ] 3.1 `getBotPushChannel(): Promise<string>` 구현.
  - `bot_settings`(봇 전역 설정) 테이블에서 key `'bot_push_channel'` 값을 조회한다.
  - 실패(테이블 미존재·쿼리 오류) 또는 미설정 시 기본값 `'telegram'` 반환.
  - Story 11.5에서 시드된 기본값이 `"telegram"`이므로 일반 운영에서는 항상 조회 성공.

  ```typescript
  // 구현 예시
  import { getDb } from '@ai-jakdang/database';
  import { eq } from 'drizzle-orm';
  import { botSettings } from '@ai-jakdang/database/schema';
  
  export async function getBotPushChannel(): Promise<string> {
    try {
      const db = getDb();
      const [row] = await db
        .select({ value: botSettings.value })
        .from(botSettings)
        .where(eq(botSettings.key, 'bot_push_channel'))
        .limit(1);
      return (row?.value as string) ?? 'telegram';
    } catch {
      return 'telegram'; // 테이블 미존재(11.1 미완) 시 기본값
    }
  }
  ```

  > 이 패턴은 Story 11.5의 `getBotExcludeFromRanking`(봇 랭킹 제외 플래그 조회)과 동일하다. worker는 `apps/api`와 다른 프로세스이므로 `getDb()` 직접 사용(API 레이어 경유 없음). Story 9.10 `cleanup.ts`의 `getRetentionDays()` 패턴 참고.

### Task 4: `apps/worker/src/processors/bot/daily-report.processor.ts` 수정 (AC: #1, #2, #3, #4)

> 이 파일은 **Story 11.17**이 신규 생성한다. Story 11.18은 해당 파일의 processor 함수 말미에 Telegram push 단계를 추가한다.
> Story 11.17이 미완인 상태에서 착수하면 파일이 없으므로 반드시 11.17 완료 후 진행할 것.

- [ ] 4.1 11.17의 aggregation(집계) 로직 완료 후, processor 함수 마지막에 아래 순서로 push 단계를 추가한다.

  ```typescript
  // ── 텔레그램 푸시 단계 (Story 11.18) ─────────────────────────────────────
  const pushChannel = await getBotPushChannel();
  if (pushChannel !== 'telegram') {
    console.debug(`[bot-report] bot_push_channel=${pushChannel} — 텔레그램 푸시 대상 아님, skip`);
    return;
  }
  
  const token  = process.env.TELEGRAM_BOT_TOKEN;   // packages/config env 타입 보다 process.env 직접 참조(optional이므로)
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[bot-report] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정 — 텔레그램 푸시 skip');
    return;
  }
  
  const dashboardUrl = (process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3004') + '/bots';
  const text = buildDailyReportMessage(summary, dashboardUrl);
  
  try {
    await sendTelegramMessage(token, chatId, text);
    console.info('[bot-report] 텔레그램 푸시 완료');
  } catch (err) {
    // sendTelegramMessage는 throw하지 않지만 혹시 모를 예외 격리
    console.error('[bot-report] 텔레그램 푸시 예외 (무시):', (err as Error).message);
  }
  // ── 텔레그램 푸시 단계 END ────────────────────────────────────────────────
  ```

  > `env.TELEGRAM_BOT_TOKEN`는 optional이므로 타입이 `string | undefined`다. `packages/config`의 `env` 객체를 import해도 되지만, worker 프로세스에서 `process.env` 직접 참조도 허용(값은 이미 env.ts가 부팅 시 주입함).

- [ ] 4.2 import 추가:
  ```typescript
  import { getBotPushChannel } from '../lib/botSettings.js';
  import { sendTelegramMessage, buildDailyReportMessage } from '../lib/telegram.js';
  import type { BotDailyReportSummary } from '@ai-jakdang/contracts';
  ```
- [ ] 4.3 `pnpm -F @ai-jakdang/worker typecheck` 통과 확인.

### Task 5: 검증 (AC: 전체)

- [ ] 5.1 **키 미설정 graceful skip**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 설정하지 않은 상태에서 `bot.daily-report` 잡을 BullMQ에 직접 enqueue → 잡이 `completed`(완료) 상태로 끝나고, 콘솔에 warn 로그 확인.
- [ ] 5.2 **단위 테스트**: `pnpm -F @ai-jakdang/worker test` 실행 → `telegram.test.ts` 통과.
- [ ] 5.3 **typecheck**: `pnpm -F @ai-jakdang/worker typecheck` + `pnpm -F @ai-jakdang/config typecheck` 통과.
- [ ] 5.4 (선택) 유효한 Telegram 키를 `.env`에 채운 뒤 실제 메시지 수신 확인(수동 integration 테스트).

---

## Dev Notes

### 선행 의존성 (착수 순서 엄수)

| 스토리 | 제공 항목 | 미완 시 증상 |
|---|---|---|
| **11.1** | `bot_settings`(봇 전역 설정) 테이블 + 마이그레이션 | `getBotPushChannel()` 호출 시 테이블 미존재 오류 → graceful skip fallback |
| **11.5** | `bot_settings` 시드 (`bot_push_channel = "telegram"`) | DB 값이 없으면 함수가 기본값 `"telegram"` 반환하므로 동작은 하나 시드 없이는 불완전 |
| **11.13** | `bot` 큐 + `bot.daily-report` cron 등록, `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부) 토글 | cron이 없으면 processor 자체가 실행되지 않음 |
| **11.17** | `apps/worker/src/processors/bot/daily-report.processor.ts` 파일 + `BotDailyReportSummary`(일일 리포트 요약) 타입 | 이 파일이 없으면 4.1 작업 불가 |

### `BotDailyReportSummary` 타입 계약 (11.17 → 11.18 인터페이스)

Story 11.17이 `packages/contracts/src/bot.ts`에 아래 Zod schema와 타입을 정의한다. 11.18은 이 타입을 import해 사용하며, worker 내부에서 별도 interface를 재정의하지 않는다.

```typescript
// packages/contracts/src/bot.ts에 추가 (11.17 담당)
export const botDailyReportSummarySchema = z.object({
  date: z.string(),              // 어제 날짜 "YYYY-MM-DD"
  publishedPosts: z.number(),    // 게시된 글 건수
  publishedComments: z.number(), // 게시된 댓글 건수
  heldCount: z.number(),         // 보류 큐 잔여 건수
  blockedCount: z.number().optional(),
  costUsd: z.number().optional(),
});
export type BotDailyReportSummary = z.infer<typeof botDailyReportSummarySchema>;
```

### Telegram API 호출 방식

- 엔드포인트: `https://api.telegram.org/bot{token}/sendMessage`
- 메서드: `POST`, Content-Type: `application/json`
- `parse_mode: 'HTML'` 사용 — MarkdownV2보다 이스케이프 규칙이 단순함.
- Telegram HTML 허용 태그: `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a href>`. 그 외는 일반 텍스트로 렌더됨.
- 메시지 최대 길이 4096자(UTF-8). 일일 요약은 200자 이내이므로 분할 불필요.
- 채널로 메시지를 받으려면: 봇을 채널 관리자로 추가하고 `TELEGRAM_CHAT_ID`에 `@채널명` 또는 채널 ID(`-100...`) 입력. ([Source: docs/seeding-bot/DEPLOYMENT.md#4-텔레그램-푸시])

### graceful skip 로그 메시지 규격

일관된 로그 식별자를 사용한다.

| 상황 | 레벨 | 메시지 |
|---|---|---|
| 키 미설정 | `warn` | `[bot-report] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정 — 텔레그램 푸시 skip` |
| 채널 불일치 | `debug` | `[bot-report] bot_push_channel=slack — 텔레그램 푸시 대상 아님, skip` |
| API 오류 | `error` | `[telegram] API 오류 (403): {"ok":false,...}` |
| 네트워크 오류 | `error` | `[telegram] 네트워크 오류: fetch failed` |
| 성공 | `info` | `[bot-report] 텔레그램 푸시 완료` |

### `env.ts` 수정 범위 경계

이 스토리에서 `packages/config/src/env.ts`에 추가하는 키는 `TELEGRAM_BOT_TOKEN`과 `TELEGRAM_CHAT_ID` **2개만**이다.

건드리지 않는 키:
- `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` — 이미 있는 소셜 OAuth용.
- AI 프로바이더 키(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) — Story 11.6 담당.
- 검색 키(`GOOGLE_SEARCH_API_KEY`, `NAVER_SEARCH_CLIENT_ID` 등) — Story 11.7 담당.
- 이미지 키(`UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`) — Story 11.8 담당.

### `ADMIN_PUBLIC_URL`(관리자 웹 공개 URL) 기존 등록 확인

`packages/config/src/env.ts`에 `ADMIN_PUBLIC_URL: z.string().default("http://localhost:3004")`로 이미 등록되어 있다. 별도 추가 불필요. 대시보드 링크: `${env.ADMIN_PUBLIC_URL}/bots`. 운영 배포 시 `.env`에 실제 관리자 URL을 설정한다.

### 봇 워커 격리 원칙

Story 11.13 원칙에 따라 봇 워커 크래시가 사이트 본체(`apps/api`, `apps/web`)를 멈추지 않는다. Telegram push 실패도 동일하게 격리한다. `sendTelegramMessage`는 어떠한 경우에도 throw하지 않는 계약이다.

### 기존 cron 패턴 참고

이 스토리는 새 cron을 등록하지 않는다. 기존 `bot.daily-report` cron(Story 11.13 + 11.17에서 등록)에 **push 단계를 추가**하는 것이다. `content.cleanup` 패턴(`apps/worker/src/index.ts` 315~335줄, `apps/worker/src/jobs/cleanup.ts`)과 `ranking.cron.ts`는 cron 등록 구조 참고용이며, 이 스토리에서는 복제하지 않는다.

---

### Project Structure Notes

**신규 파일 (이 스토리 생성)**:
```
apps/worker/src/lib/telegram.ts        (sendTelegramMessage + buildDailyReportMessage)
apps/worker/src/lib/telegram.test.ts   (buildDailyReportMessage 단위 테스트)
apps/worker/src/lib/botSettings.ts     (getBotPushChannel 헬퍼)
```

**수정 파일 (이 스토리 수정)**:
```
packages/config/src/env.ts                                           (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID optional 추가)
apps/worker/src/processors/bot/daily-report.processor.ts             (11.17 생성 파일 — push 단계 추가)
```

**이 스토리가 건드리지 않는 파일**:
- `apps/worker/src/index.ts` — 봇 워커 등록은 Story 11.13 담당
- `apps/worker/src/schedules/bot.cron.ts` — cron 등록은 Story 11.13 담당
- `apps/api/src/routes/admin/bots/report.ts` — 리포트 API 엔드포인트는 Story 11.17 담당
- `packages/contracts/src/bot.ts` — `BotDailyReportSummary` 타입 정의는 Story 11.17 담당
- `apps/worker/src/connection.ts`의 `QUEUE_NAMES`(큐 이름 상수) — Story 11.13 담당

---

### References

- Story 11.18 AC 원문: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.18]
- Story 11.17 AC 원문 (리포트 집계 내용): [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.17]
- Story 11.13 AC 원문 (BullMQ 잡·크론 등록): [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.13]
- `bot.daily-report` cron + 텔레그램 푸시 역할: [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커큐크론-appsworker-기존-bullmq-위]
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` env 변수 정의: [Source: docs/seeding-bot/ARCHITECTURE.md#8-환경변수-envexample-추가-packagesconfigentvts-zod-검증]
- `bot_settings.bot_push_channel` 키 의미: [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings-봇-전역-설정--site_settings-패턴key-value-jsonb]
- 텔레그램 봇 토큰·채팅 ID 발급 방법: [Source: docs/seeding-bot/DEPLOYMENT.md#4-텔레그램-푸시-선택-권장]
- graceful skip + optional 키 원칙 ("모든 키는 비어 있어도 앱이 부팅되도록 optional로 검증"): [Source: docs/seeding-bot/ARCHITECTURE.md#8-환경변수]
- 봇 워커 격리·fail-safe 원칙: [Source: docs/seeding-bot/ARCHITECTURE.md#11-보안실패-모드]
- `packages/config/src/env.ts` 현재 구조 (optional 필드 패턴, `ADMIN_PUBLIC_URL` 기존 등록 확인): [Source: packages/config/src/env.ts]
- `getDb()` 직접 사용 패턴(worker 내 DB 접근): [Source: apps/worker/src/jobs/cleanup.ts#getRetentionDays]
- `getBotExcludeFromRanking` 동일 패턴 (try/catch + fallback): [Source: _bmad-output/implementation-artifacts/11-5-ensure-bot-user-seed-ranking-exclude.md#Task-4]
- `content.cleanup` cron 등록 패턴: [Source: apps/worker/src/index.ts] (315~336줄)
- 기존 cron 파일 구조: [Source: apps/worker/src/schedules/ranking.cron.ts]
- worker 기존 테스트 파일 스타일: [Source: apps/worker/src/processors/resource-scan.processor.test.ts]

---

## Dev Agent Record

### Agent Model Used

_미입력 (dev 착수 시 기입)_

### Debug Log References

_착수 후 기입_

### Completion Notes List

_착수 후 기입_

### File List

```
packages/config/src/env.ts                                           (수정)
apps/worker/src/lib/telegram.ts                                      (신규)
apps/worker/src/lib/telegram.test.ts                                 (신규)
apps/worker/src/lib/botSettings.ts                                   (신규)
apps/worker/src/processors/bot/daily-report.processor.ts             (수정 — Story 11.17 생성 파일)
```
