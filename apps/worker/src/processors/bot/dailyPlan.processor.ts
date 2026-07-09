/**
 * dailyPlan.processor — Story 11.11
 *
 * 매일 새벽 `bot.daily-plan` 잡(Story 11.13 cron 등록)이 트리거하면
 * 모든 활성 봇 페르소나의 오늘 활동 계획을 수립하고 `bot.write` / `bot.comment`
 * 잡을 단일 `bot` 큐에 delay가 붙은 채로 enqueue한다.
 *
 * 소유 경계:
 *  - processor 로직: Story 11.11 (이 파일)
 *  - 큐 인스턴스·cron 등록·디스패처: Story 11.13
 *
 * 11.13 디스패처가 `switch(job.name) case 'bot.daily-plan'`에서
 * `dailyPlanProcessor`를 import하여 호출한다. 이 파일은 cron/Worker를 직접 생성하지 않는다.
 *
 * [Source: _bmad-output/implementation-artifacts/11-11-daily-activity-planner.md]
 * [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커·큐·크론]
 */

import type { Job } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import {
  botPersonas,
  botActivityRhythm,
  botPersonaBoards,
  botActivityLog,
  botSettings,
} from "@ai-jakdang/database/schema";
import type { BotWriteJobPayload, BotDailyPlanJobPayload } from "@ai-jakdang/contracts";
import { getBotQueue } from "../../queues/bot.js";

// ── 순수 함수 (exported for unit testing) ────────────────────────────────────

/**
 * 문자열 seed 기반 결정론적 0~1 float.
 * 동일 seed → 재실행 간 동일 결과 보장.
 *
 * ⚠️ 과거 버그: DJB2 해시만 쓰면 애벌런치(avalanche, 입력 한 글자 변화가 출력 전체로
 * 퍼지는 성질)가 없어, seed 끝 글자만 바뀌면(예: `...-day-2026-07-06` vs `...-07`)
 * 결과가 소수점 8자리 아래에서만 달라졌다. 그 결과 "날짜별 확률"이 페르소나마다
 * 고정된 단일 값으로 굳어, 특정 봇이 매일 영구 스킵되는 문제가 있었다.
 * → DJB2 누산 후 Murmur3 fmix32 마무리 믹싱을 적용해 하위 비트 변화까지
 *   전 비트로 확산시킨다. (끝 글자만 달라도 출력이 완전히 달라짐)
 */
export function seededRandom(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 33) ^ seed.charCodeAt(i)) | 0;
  }
  // fmix32 (Murmur3 finalizer) — 완전 확산
  let h = hash | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

/** 주어진 날짜의 해당 주 월요일 자정 반환 (로컬 자정). */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=일, 1=월
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 이번 주(월요일 기준) 잠수 여부를 seed PRNG으로 결정한다.
 * 잠수 확률 12% (약 7~8주에 1회).
 */
export function isDormantThisWeek(personaId: string, date: Date): boolean {
  const monday = getMonday(date);
  const key = `${personaId}-dormant-${monday.toISOString().slice(0, 10)}`;
  return seededRandom(key) < 0.12;
}

/**
 * 주당 횟수 → 오늘 횟수 변환. ±20% 랜덤 변동 (seed 기반, 재실행 동일 결과). 최솟값 0.
 * 기대치 `perWeek / 7 × [0.8 ~ 1.2]`.
 *
 * ⚠️ 과거 버그: `Math.round(base * mult)` 방식은 소수 기대치를 매일 같은 방향으로
 * 반올림해, 주 3회(base≈0.43) 봇은 매일 0으로 깎여 사실상 글을 전혀 못 썼다.
 * → 정수부(floor)는 확정 발행하고, 소수부(frac)는 **확률적 반올림**(독립 seed 롤이
 *   frac보다 작으면 +1)으로 처리한다. 이렇게 하면 주 3회 봇도 장기적으로 주당 ~3회를
 *   채운다(일부 날은 0, 일부 날은 1). 애벌런치가 고쳐진 seededRandom과 함께여야
 *   날짜별로 값이 실제로 달라진다.
 */
export function calcTodayCount(perWeek: number, seed: string): number {
  const base = perWeek / 7;
  const multiplier = 0.8 + seededRandom(seed) * 0.4; // 0.8 ~ 1.2
  const expected = base * multiplier;
  const floorCount = Math.floor(expected);
  const frac = expected - floorCount;
  const bonus = seededRandom(`${seed}-frac`) < frac ? 1 : 0;
  return Math.max(0, floorCount + bonus);
}

/** UTC 기준 Date를 KST "YYYY-MM-DD" 문자열로 변환한다. */
export function toKSTDateKey(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * 가중치 기반 게시판 선택 (seed 기반, 결정론적).
 * boards가 비어있으면 "lounge"로 폴백.
 */
export function weightedBoardPick(
  boards: ReadonlyArray<{ board: string; weight: number }>,
  seed: string,
): string {
  if (boards.length === 0) return "lounge";
  const total = boards.reduce((sum, b) => sum + b.weight, 0);
  const target = seededRandom(seed) * total;
  let cumulative = 0;
  for (const b of boards) {
    cumulative += b.weight;
    if (target < cumulative) return b.board;
  }
  return boards[boards.length - 1].board;
}

/**
 * 실전자료(resource) 담당 게시판 슬러그를 실제 파이프라인 board 파라미터로 확장한다.
 *
 * bot_persona_boards에는 담당 게시판이 접두사 없는 "resource"(실전자료)로 저장되지만,
 * runPostPipeline(글 생성 파이프라인)은 board가 "resource:<유형>" 형태여야
 * 실전자료 작성 경로(createResourceAsBot → resources 도메인)로 라우팅한다.
 * 접두사가 없으면 board.startsWith("resource:") 판정이 false라 jobKind='post'(일반 게시글)로
 * 처리돼, 실전자료가 아니라 존재하지 않는 board="resource"에 잡담글을 쓰려다 어긋난다.
 *
 * (자동 스케줄러가 이 확장을 하지 않던 잠재 갭 — 수동 트리거로 "resource:prompt"를 직접
 *  넣었을 때만 정상 동작했다. 이 헬퍼로 자동 경로도 유형을 골라 접두사를 붙인다.)
 *
 * 유형은 seed 기반 가중치 랜덤으로 결정론적으로 고른다(같은 날·같은 인덱스면 동일 결과).
 * resource 이외의 board는 그대로 반환한다.
 */
const RESOURCE_TYPE_WEIGHTS: ReadonlyArray<{ type: string; weight: number }> = [
  { type: "prompt", weight: 40 }, // 프롬프트 자료 (가장 흔하고 수요 큼)
  { type: "claude-code-skill", weight: 15 }, // Claude Code 스킬
  { type: "mcp", weight: 15 }, // MCP 서버
  { type: "rules-config", weight: 15 }, // 규칙·설정 파일
  { type: "template-checklist", weight: 15 }, // 템플릿·체크리스트
];

export function resolveWriteBoard(board: string, seed: string): string {
  if (board !== "resource") return board;
  const total = RESOURCE_TYPE_WEIGHTS.reduce((sum, t) => sum + t.weight, 0);
  const target = seededRandom(seed) * total;
  let cumulative = 0;
  for (const t of RESOURCE_TYPE_WEIGHTS) {
    cumulative += t.weight;
    if (target < cumulative) return `resource:${t.type}`;
  }
  return `resource:${RESOURCE_TYPE_WEIGHTS[RESOURCE_TYPE_WEIGHTS.length - 1]!.type}`;
}

/**
 * `active_hours` 윈도우 내 KST 랜덤 시각 → 현재 시각 기준 ms delay.
 *
 * - `Math.random()` 사용 (delay는 재실행 간 달라져도 됨. 멱등은 jobId가 보장).
 * - 이미 지난 시각이면 0 반환 (음수 방지).
 * - `crossesMidnight:true`: {from:23, to:2} 형태로 자정 넘김 처리.
 *   `to > 24` / `% 24` 금지 — crossesMidnight 플래그로만 처리.
 */
export function pickDelayMs(
  activeHours: ReadonlyArray<{ from: number; to: number; crossesMidnight?: boolean }>,
  index: number,
  today: Date,
): number {
  const fallback: Array<{ from: number; to: number; crossesMidnight?: boolean }> = [{ from: 10, to: 22 }];
  const windows = activeHours.length > 0 ? activeHours : fallback;
  const win = windows[index % windows.length];

  const jitter = Math.random();
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  let targetHourFloat: number;
  let dayOffset = 0;

  if (win.crossesMidnight) {
    // e.g. {from:23, to:2}: span = (24-23)+2 = 3h
    const span = 24 - win.from + win.to;
    targetHourFloat = win.from + jitter * span;
    if (targetHourFloat >= 24) {
      targetHourFloat -= 24;
      dayOffset = 1; // 다음 날로 넘어감
    }
  } else {
    targetHourFloat = win.from + jitter * (win.to - win.from);
  }

  const targetHour = Math.floor(targetHourFloat);
  const targetMin = Math.floor((targetHourFloat % 1) * 60);

  // KST 오늘 자정(UTC) 계산
  // today + kstOffsetMs → UTC 필드로 KST 시각을 읽을 수 있는 Date 객체
  const todayShiftedToKST = new Date(today.getTime() + kstOffsetMs);
  todayShiftedToKST.setUTCHours(0, 0, 0, 0);
  // 실제 KST 자정의 UTC timestamp
  const kstMidnightActualUTC = todayShiftedToKST.getTime() - kstOffsetMs;

  // 타겟 UTC timestamp
  const targetUTCMs =
    kstMidnightActualUTC +
    dayOffset * 24 * 3_600_000 +
    targetHour * 3_600_000 +
    targetMin * 60_000;

  return Math.max(0, targetUTCMs - today.getTime());
}

// ── 댓글 잡 계획 페이로드 ────────────────────────────────────────────────────
// `BotCommentJobPayload`(contracts)는 targetPostId: string(required)이지만
// 계획 단계에서는 대상 게시글이 미확정이다. Story 11.10 프로세서가 실행 시점에 선택한다.
// TODO(11.10): 댓글 프로세서가 personaId + targetBoard 기반으로 대상 게시글을 선택하도록 연동.
type PlannerCommentPayload = {
  /** 댓글을 작성할 봇 페르소나 ID. */
  personaId: string;
  /** 계획 생성 날짜 KST YYYY-MM-DD. */
  triggeredDate: string;
  /** 대상 게시판 슬러그 (가중 선택). */
  targetBoard: string;
};

// ── 메인 프로세서 ─────────────────────────────────────────────────────────────

/**
 * `bot.daily-plan` 잡 처리기.
 *
 * Story 11.13 디스패처가 `switch(job.name)` `case 'bot.daily-plan'`에서 호출한다.
 * 이 함수는 BullMQ Worker를 직접 생성하거나 cron을 등록하지 않는다.
 *
 * 처리 순서:
 * 0. 킬 스위치(bot_master_enabled) 확인 → off면 전체 skip
 * 1. 활성 페르소나 + 활동 리듬 조인 조회
 * 2. (옵션) job.data.personaId로 단일 페르소나 필터
 * 3. 담당 게시판 일괄 조회 (N+1 방지)
 * 4. 페르소나별 순회:
 *    a. 잠수 주 체크 → skip + log("skipped", reason:"dormant_week")
 *    b. 요일 확률 체크 → skip + log("skipped", reason:"day_probability")
 *    c. 오늘 글/댓글 개수 산출 (±20% seed 변동)
 *    d. bot.write 잡 enqueue (jobId 멱등 보장)
 *    e. bot.comment 잡 enqueue (jobId 멱등 보장)
 *    f. 계획 완료 log("planned")
 */
export async function dailyPlanProcessor(
  job: Job<BotDailyPlanJobPayload>,
): Promise<void> {
  const today = new Date();
  const dateKey = toKSTDateKey(today);

  const db = getDb();

  // ── 0. 킬 스위치 확인 ────────────────────────────────────────────────────────
  // stub — Story 11.12 완료 후 공용 checkBotGates()로 교체 예정.
  const [masterSetting] = await db
    .select()
    .from(botSettings)
    .where(eq(botSettings.key, "bot_master_enabled"))
    .limit(1);

  if (masterSetting?.value === false) {
    console.warn("[bot-daily-plan] 킬 스위치 OFF — 전체 skip");
    return;
  }

  // ── 1. 활성 페르소나 + 리듬 조인 조회 ──────────────────────────────────────
  const allPersonas = await db
    .select({
      persona: botPersonas,
      rhythm: botActivityRhythm,
    })
    .from(botPersonas)
    .innerJoin(botActivityRhythm, eq(botPersonas.id, botActivityRhythm.personaId))
    .where(eq(botPersonas.isActive, true));

  // job.data.personaId 지정 시 단일 페르소나만 처리 (부분 재계획 지원)
  const targetPersonas = job.data.personaId
    ? allPersonas.filter(({ persona }) => persona.id === job.data.personaId)
    : allPersonas;

  if (targetPersonas.length === 0) {
    console.info("[bot-daily-plan] 처리 대상 페르소나 없음 — skip");
    return;
  }

  // ── 1-2. 담당 게시판 일괄 조회 (N+1 방지) ──────────────────────────────────
  const personaIds = targetPersonas.map(({ persona }) => persona.id);
  const allBoards = await db
    .select()
    .from(botPersonaBoards)
    .where(inArray(botPersonaBoards.personaId, personaIds));

  // personaId → boards 맵
  const boardsByPersona = new Map<string, Array<{ board: string; weight: number }>>();
  for (const b of allBoards) {
    const list = boardsByPersona.get(b.personaId) ?? [];
    list.push({ board: b.board, weight: b.weight });
    boardsByPersona.set(b.personaId, list);
  }

  // 단일 bot 큐 (별도 큐 인스턴스 생성 금지 — 11.13 큐를 getBotQueue()로만 접근)
  const botQueue = getBotQueue();

  for (const { persona, rhythm } of targetPersonas) {
    // ── 2. 잠수 주 체크 ─────────────────────────────────────────────────────
    if (isDormantThisWeek(persona.id, today)) {
      await db.insert(botActivityLog).values({
        personaId: persona.id,
        eventType: "skipped",
        payload: { reason: "dormant_week", date: dateKey },
      });
      console.info(`[bot-daily-plan] persona=${persona.nickname} 잠수 주 — skip`);
      continue;
    }

    // ── 3. 요일 확률 체크 (KST 기준) ────────────────────────────────────────
    const kstNow = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    const isWeekend = [0, 6].includes(kstNow.getUTCDay());
    const activeDays = rhythm.activeDays as { weekday: number; weekend: number } | null;
    const prob = activeDays ? (isWeekend ? activeDays.weekend : activeDays.weekday) : 0.8;

    if (seededRandom(`${persona.id}-day-${dateKey}`) > prob) {
      await db.insert(botActivityLog).values({
        personaId: persona.id,
        eventType: "skipped",
        payload: { reason: "day_probability", date: dateKey },
      });
      console.info(`[bot-daily-plan] persona=${persona.nickname} 요일 확률 미충족 — skip`);
      continue;
    }

    // ── 4. 오늘 개수 산출 ────────────────────────────────────────────────────
    const activeHours = (rhythm.activeHours as Array<{
      from: number;
      to: number;
      crossesMidnight?: boolean;
    }> | null) ?? [];
    const postsToday = calcTodayCount(
      rhythm.postsPerWeek,
      `${persona.id}-posts-${dateKey}`,
    );
    const commentsToday = calcTodayCount(
      rhythm.commentsPerWeek,
      `${persona.id}-comments-${dateKey}`,
    );
    const personaBoards = boardsByPersona.get(persona.id) ?? [];

    // ── 5. bot.write 잡 enqueue ──────────────────────────────────────────────
    for (let i = 0; i < postsToday; i++) {
      const delay = pickDelayMs(activeHours, i, today);
      // 담당 게시판 가중치 선택 → 실전자료(resource)면 유형 접두사 확장(resource:<유형>).
      const targetBoard = resolveWriteBoard(
        weightedBoardPick(personaBoards, `${persona.id}-board-write-${dateKey}-${i}`),
        `${persona.id}-restype-write-${dateKey}-${i}`,
      );
      await botQueue.add(
        "bot.write",
        {
          personaId: persona.id,
          targetBoard,
          jobKind: "post",
        } satisfies BotWriteJobPayload,
        {
          delay,
          jobId: `bot-write-${persona.id}-${dateKey}-${i}`,
        },
      );
    }

    // ── 6. bot.comment 잡 enqueue ────────────────────────────────────────────
    for (let i = 0; i < commentsToday; i++) {
      const delay = pickDelayMs(activeHours, postsToday + i, today);
      const targetBoard = weightedBoardPick(
        personaBoards,
        `${persona.id}-board-comment-${dateKey}-${i}`,
      );
      // PlannerCommentPayload 사용: targetPostId는 11.10 프로세서가 실행 시점에 선택
      await botQueue.add(
        "bot.comment",
        {
          personaId: persona.id,
          triggeredDate: dateKey,
          targetBoard,
        } as PlannerCommentPayload,
        {
          delay,
          jobId: `bot-comment-${persona.id}-${dateKey}-${i}`,
        },
      );
    }

    // ── 7. 일일 계획 로그 ('planned' — 비용이 아닌 계획 기록) ────────────────
    await db.insert(botActivityLog).values({
      personaId: persona.id,
      eventType: "planned",
      payload: {
        plannedPosts: postsToday,
        plannedComments: commentsToday,
        date: dateKey,
      },
    });

    console.info(
      `[bot-daily-plan] persona=${persona.nickname} 계획 완료` +
        ` — 글 ${postsToday}건, 댓글 ${commentsToday}건`,
    );
  }
}
