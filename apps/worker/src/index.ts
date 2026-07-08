import { Worker, Queue } from "bullmq";
import { createConnection, QUEUE_NAMES } from "./connection";
import { renderResetPasswordEmail } from "./templates/reset-password.js";
import { renderEmailVerification } from "./templates/email-verification.js";
import { sendMail, isSmtpConfigured } from "./mailer.js";
import { viewFlushProcessor } from "./processors/view.flush.js";
import { processResourceScan } from "./processors/resource-scan.processor.js"; // Story 4.5
import { gradeUpProcessor } from "./processors/gradeUp.processor.js"; // Story 6.3
import { rankingComputeProcessor } from "./processors/rankingCompute.processor.js"; // Story 6.5
import { setupRankingCron } from "./schedules/ranking.cron.js"; // Story 6.5
import { ogFetchProcessor } from "./processors/og-fetch.js"; // Story 8.6
import { contentCleanupProcessor } from "./jobs/cleanup.js"; // Story 9.10

/**
 * 일일 USD→KRW 환율 갱신을 apps/api 내부 엔드포인트로 위임한다.
 * (worker는 apps/api를 직접 import할 수 없으므로 내부 HTTP 브리지 사용)
 * throw 금지 — 실패해도 로그만 남기고 다음 날 재시도.
 */
async function refreshExchangeRate(): Promise<void> {
  const apiBaseUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:4003").replace(/\/$/, "");
  const internalKey = process.env.INTERNAL_API_KEY ?? "";
  try {
    const res = await fetch(`${apiBaseUrl}/internal/exchange-rate/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: "{}",
    });
    if (!res.ok) {
      console.error(`[worker] 환율 갱신 응답 오류: ${res.status} ${res.statusText}`);
      return;
    }
    const data = (await res.json()) as { ok: boolean; rate: number | null; baseDate: string | null };
    console.info(`[worker] 환율 갱신 완료: USD 1 = ${data.rate}원 (기준일 ${data.baseDate})`);
  } catch (err) {
    console.error("[worker] 환율 갱신 미도달 (네트워크 오류):", (err as Error).message);
  }
}

/**
 * 워커 엔트리.
 *
 * 이번 기반 단계에서는 실제 작업 로직(Sharp 이미지 변환, Nodemailer 발송, 통계 집계)을
 * 구현하지 않는다. 큐 연결과 워커 기동 구조만 준비한다.
 * 실제 작업 처리기는 해당 기능 구현 단계에서 추가한다.
 */
function startWorkers(): Worker[] {
  const connection = createConnection();

  const imageWorker = new Worker(
    QUEUE_NAMES.imageProcessing,
    async (job) => {
      // TODO(이미지 단계): Sharp 로 리사이즈/WebP 변환 후 스토리지에 저장한다.
      console.log(`[worker] image job 수신: ${job.id} (처리기 미구현)`);
    },
    { connection },
  );

  imageWorker.on("ready", () => console.log("[worker] image-processing 워커 준비 완료"));
  imageWorker.on("failed", (job, error) =>
    console.error(`[worker] job 실패 ${job?.id}:`, error.message),
  );

  // ── [1.3] email worker ──────────────────────────────────────────────────────
  //
  // email 큐(QUEUE_NAMES.email = "email") 에서 job을 처리한다.
  // 현재 구현: dev에서 수신자·제목·인증링크를 console에 출력 (실 SMTP 발송은 TODO).
  // 실 발송 연동 시 이 핸들러 안에 nodemailer / Resend SDK 호출을 추가한다.
  //
  // job 명칭: "email.send" (EMAIL_JOB_NAMES.send — contracts/jobs/email.ts)
  // payload 형식: EmailSendPayload { to, subject, templateId, variables }
  const emailConnection = createConnection();
  const emailWorker = new Worker(
    QUEUE_NAMES.email,
    async (job) => {
      const { to, subject, templateId, variables } = job.data as {
        to: string;
        subject: string;
        templateId: string;
        variables: Record<string, string>;
      };

      console.info("[email-worker] 이메일 job 처리 시작:", {
        jobId: job.id,
        jobName: job.name,
        to,
        subject,
        templateId,
      });

      if (job.name === "email.send") {
        // templateId 별로 HTML 본문 렌더링
        let html: string | null = null;
        if (templateId === "email-verification") {
          html = renderEmailVerification({
            verificationUrl: variables["verificationUrl"] ?? "",
            userEmail: variables["userEmail"] ?? to,
          });
        } else if (templateId === "reset-password") {
          html = renderResetPasswordEmail({
            resetUrl: variables["resetUrl"] ?? "",
            email: variables["email"] ?? to,
          });
        }

        if (html && isSmtpConfigured()) {
          // 실제 SMTP 발송 (Gmail 등)
          await sendMail({ to, subject, html });
          console.info(`[email-worker] 발송 완료 → ${to} (${templateId})`);
        } else {
          // SMTP 미설정 폴백: 콘솔에 링크 출력(개발 확인용)
          console.info("[email-worker] ── SMTP 미설정 — 콘솔 폴백 ──────────");
          console.info("[email-worker]   TO       :", to);
          console.info("[email-worker]   SUBJECT  :", subject);
          console.info("[email-worker]   TEMPLATE :", templateId);
          const link = variables["verificationUrl"] ?? variables["resetUrl"];
          if (link) console.info("[email-worker]   LINK     :", link);
          if (!html) console.warn("[email-worker]   (알 수 없는 templateId — 본문 없음)");
          console.info("[email-worker] ────────────────────────────────────────");
        }
      } else {
        console.warn("[email-worker] 알 수 없는 job 이름:", job.name);
      }
    },
    { connection: emailConnection },
  );

  emailWorker.on("ready", () => console.log("[worker] email 워커 준비 완료"));
  emailWorker.on("completed", (job) =>
    console.info(`[email-worker] job 완료: ${job.id}`),
  );
  emailWorker.on("failed", (job, error) =>
    console.error(`[email-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [1.3] email worker END ─────────────────────────────────────────────────

  // ── [2.4] view-flush worker ─────────────────────────────────────────────────
  // Redis 조회수 버퍼를 1분마다 DB로 flush한다.
  const viewFlushConnection = createConnection();
  const viewFlushWorker = new Worker(
    QUEUE_NAMES.viewFlush,
    viewFlushProcessor,
    { connection: viewFlushConnection },
  );

  viewFlushWorker.on("ready", () => console.log("[worker] view-flush 워커 준비 완료"));
  viewFlushWorker.on("completed", (job) =>
    console.info(`[view-flush-worker] job 완료: ${job.id}`),
  );
  viewFlushWorker.on("failed", (job, error) =>
    console.error(`[view-flush-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [2.4] view-flush worker END ───────────────────────────────────────────

  // ── [4.5] resource-scan worker ─────────────────────────────────────────────
  // ClamAV 바이러스 스캔: S3 다운로드 → clamd TCP INSTREAM → clean/infected 판정
  const resourceScanConnection = createConnection();
  const resourceScanWorker = new Worker(
    "file-scan", // AR-16: 큐명 'file-scan'
    processResourceScan,
    { connection: resourceScanConnection, concurrency: 5 },
  );

  resourceScanWorker.on("ready", () => console.log("[worker] resource-scan 워커 준비 완료"));
  resourceScanWorker.on("completed", (job) =>
    console.info(`[resource-scan-worker] job 완료: ${job.id}`),
  );
  resourceScanWorker.on("failed", (job, error) =>
    console.error(`[resource-scan-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [4.5] resource-scan worker END ────────────────────────────────────────

  // ── [5.2] stats worker 스텁 ────────────────────────────────────────────────
  // reaction.created 등 활동 이벤트를 수신한다. 실처리(포인트 적립)는 Epic 6.
  const statsConnection = createConnection();
  const statsWorker = new Worker(
    QUEUE_NAMES.stats,
    async (job) => {
      console.info(`[stats-worker] job 수신: ${job.name}`, job.data);
    },
    { connection: statsConnection },
  );

  statsWorker.on("ready", () => console.log("[worker] stats 워커 준비 완료"));
  statsWorker.on("failed", (job, error) =>
    console.error(`[stats-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [5.2] stats worker END ────────────────────────────────────────────────

  // ── [5.4] notifications worker 스텁 ───────────────────────────────────────
  // comment.created 등 알림 이벤트를 수신한다. 실전송(SSE·푸시)은 Epic 7.
  const notificationsConnection = createConnection();
  const notificationsWorker = new Worker(
    QUEUE_NAMES.notifications,
    async (job) => {
      console.info(`[notifications-worker] job 수신: ${job.name}`, job.data);
    },
    { connection: notificationsConnection },
  );

  notificationsWorker.on("ready", () => console.log("[worker] notifications 워커 준비 완료"));
  notificationsWorker.on("failed", (job, error) =>
    console.error(`[notifications-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [5.4] notifications worker END ───────────────────────────────────────

  // ── [6.3/6.5] ranking worker ─────────────────────────────────────────────────
  // gamification.grade-up 잡 처리: 등급 변동 감지 → notifications 큐에 grade.level-up 발행
  const rankingConnection = createConnection();

  /**
   * ranking 큐 잡 이름 기반 디스패처.
   * 새 잡 추가 시 case 분기만 추가하면 됨.
   */
  async function rankingProcessor(job: import("bullmq").Job): Promise<void> {
    switch (job.name) {
      case "gamification.grade-up":
        return gradeUpProcessor(job as import("bullmq").Job<import("@ai-jakdang/contracts").GradeUpJobPayload>);
      // ── [6.5] ranking.compute ────────────────────────────────────────────────
      case "ranking.compute":
        return rankingComputeProcessor(job as import("bullmq").Job<import("@ai-jakdang/contracts").RankingComputeJobPayload>);
      // ── [6.5] END ─────────────────────────────────────────────────────────────
      default:
        console.warn(`[ranking-worker] 알 수 없는 job.name: ${job.name} (jobId=${job.id})`);
    }
  }

  const rankingWorker = new Worker(
    QUEUE_NAMES.ranking,
    rankingProcessor,
    { connection: rankingConnection },
  );

  rankingWorker.on("ready", () => console.log("[worker] ranking 워커 준비 완료"));
  rankingWorker.on("completed", (job) =>
    console.info(`[ranking-worker] job 완료: ${job.id} (${job.name})`),
  );
  rankingWorker.on("failed", (job, error) =>
    console.error(`[ranking-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [6.3/6.5] ranking worker END ─────────────────────────────────────────

  // ── [8.6] og-fetch worker ─────────────────────────────────────────────────
  // link_previews 테이블에 OG 메타를 upsert한다.
  const ogFetchConnection = createConnection();
  const ogFetchWorker = new Worker(
    QUEUE_NAMES.ogFetch,
    ogFetchProcessor,
    { connection: ogFetchConnection, concurrency: 3 },
  );

  ogFetchWorker.on("ready", () => console.log("[worker] og-fetch 워커 준비 완료"));
  ogFetchWorker.on("completed", (job) =>
    console.info(`[og-fetch-worker] job 완료: ${job.id}`),
  );
  ogFetchWorker.on("failed", (job, error) =>
    console.error(`[og-fetch-worker] job 실패 ${job?.id}:`, error.message),
  );
  // ── [8.6] og-fetch worker END ─────────────────────────────────────────────

  return [imageWorker, emailWorker, viewFlushWorker, resourceScanWorker, statsWorker, notificationsWorker, rankingWorker, ogFetchWorker];
}

const workers = startWorkers();
console.log("[worker] AI작당 워커가 기동되었습니다. (Redis 연결 대기 중일 수 있음)");

// view-flush 반복 job 등록 (5분마다)
// BullMQ repeat job — 이미 등록된 경우 중복 없음
void (async () => {
  try {
    const viewFlushQueue = new Queue(QUEUE_NAMES.viewFlush, {
      connection: createConnection(),
    });
    await viewFlushQueue.add(
      "view.flush",
      {},
      { repeat: { every: 300000 }, jobId: "view-flush-repeat" },
    );
    console.log("[worker] view-flush 반복 job 등록 완료 (5분마다)");
  } catch (err) {
    console.warn("[worker] view-flush 반복 job 등록 실패:", (err as Error).message);
  }
})();

// ── [6.5] ranking cron 등록 ───────────────────────────────────────────────────
void (async () => {
  try {
    const rankingCronQueue = new Queue(QUEUE_NAMES.ranking, {
      connection: createConnection(),
    });
    await setupRankingCron(rankingCronQueue);
  } catch (err) {
    console.warn("[worker] ranking cron 등록 실패:", (err as Error).message);
  }
})();
// ── [6.5] ranking cron END ────────────────────────────────────────────────────

// 안전한 종료
async function shutdown() {
  console.log("[worker] 종료 중...");
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// ── [1.9 + 9.10] cleanup worker ──────────────────────────────────────────────
// 1.9: 탈퇴 회원 콘텐츠 익명화 (cleanup.anonymize)
// 9.10: 소프트 삭제된 콘텐츠 hard-delete (content.cleanup) — 매일 새벽 3시

const cleanupConnection = createConnection();
const cleanupWorker = new Worker(
  QUEUE_NAMES.cleanup,
  async (job) => {
    if (job.name === "cleanup.anonymize") {
      const { userId } = job.data as { userId: string };
      // TODO(Epic 2 이후): posts.user_id = null WHERE user_id = userId
      // TODO(Epic 2 이후): comments.user_id = null WHERE user_id = userId
      console.log(`[worker] cleanup.anonymize 수신 userId=${userId} — posts·comments 테이블 생성 후 처리`);
    } else if (job.name === "content.cleanup") {
      // Story 9.10: soft-delete 보존 기간 초과 콘텐츠 hard-delete
      await contentCleanupProcessor(job);
    } else if (job.name === "exchange-rate.refresh") {
      // 일일 USD→KRW 환율 갱신: apps/api 내부 엔드포인트로 위임 (수출입은행 API 호출)
      await refreshExchangeRate();
    } else {
      console.log(`[worker] cleanup job 수신: ${job.id} name=${job.name} (처리기 미구현)`);
    }
  },
  { connection: cleanupConnection },
);

cleanupWorker.on("ready", () => console.log("[worker] cleanup 워커 준비 완료"));
cleanupWorker.on("completed", (job) =>
  console.info(`[cleanup-worker] job 완료: ${job.id} (${job.name})`),
);
cleanupWorker.on("failed", (job, error) =>
  console.error(`[worker] cleanup job 실패 ${job?.id}:`, error.message),
);

workers.push(cleanupWorker);

// ── [9.10] content.cleanup 일일 cron 등록 (매일 새벽 3시) ─────────────────────
void (async () => {
  try {
    const contentCleanupQueue = new Queue(QUEUE_NAMES.cleanup, {
      connection: createConnection(),
    });
    await contentCleanupQueue.add(
      "content.cleanup",
      { triggeredAt: new Date().toISOString() },
      {
        repeat: { pattern: "0 3 * * *" }, // 매일 03:00
        jobId: "content-cleanup-daily",
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
      },
    );
    console.log("[worker] content.cleanup 일일 cron 등록 완료 (매일 03:00)");
  } catch (err) {
    console.warn("[worker] content.cleanup cron 등록 실패:", (err as Error).message);
  }
})();
// ── [9.10] content.cleanup cron END ──────────────────────────────────────────

// ── 일일 USD→KRW 환율 갱신 cron (매일 KST 12:00 = UTC 03:00) ─────────────────
// 수출입은행은 영업일 11시경 이후 당일 환율을 제공하므로 정오에 갱신하면 당일값 확보.
// 기동 시 1회 즉시 갱신(seed)해 최초 캐시를 채운다. cleanup 큐 재사용(봇 비활성과 무관하게 상시 가동).
void (async () => {
  try {
    const exchangeRateQueue = new Queue(QUEUE_NAMES.cleanup, {
      connection: createConnection(),
    });
    await exchangeRateQueue.add(
      "exchange-rate.refresh",
      { triggeredAt: new Date().toISOString() },
      {
        repeat: { pattern: "0 3 * * *" }, // 매일 UTC 03:00 = KST 12:00
        jobId: "exchange-rate-refresh-daily",
      },
    );
    // 기동 즉시 1회 seed (최초 캐시 채우기)
    await exchangeRateQueue.add(
      "exchange-rate.refresh",
      { triggeredAt: new Date().toISOString(), seed: true },
      { jobId: `exchange-rate-seed-${Date.now()}` },
    );
    console.log("[worker] 환율 갱신 cron 등록 완료 (매일 KST 12:00 + 기동 seed)");
  } catch (err) {
    console.warn("[worker] 환율 갱신 cron 등록 실패:", (err as Error).message);
  }
})();
// ── 환율 갱신 cron END ────────────────────────────────────────────────────────

// ── [11.13] 봇 워커 (SEEDING_BOT_ENABLED=true 시에만 등록) ──────────────────
void (async () => {
  if (process.env.SEEDING_BOT_ENABLED === "true") {
    try {
      // 동적 import: SEEDING_BOT_ENABLED=false 시 봇 모듈 전체 미로드 (메모리·의존성 격리)
      const { botProcessor } = await import("./processors/bot/index.js");
      const { setupBotCrons } = await import("./schedules/bot.cron.js");

      const botConnection = createConnection();
      const botWorker = new Worker(
        QUEUE_NAMES.bot,
        botProcessor,
        { connection: botConnection, concurrency: 3 }, // 여러 봇 동시 처리
      );

      // [격리 보장] failed·error 핸들러: console.error만, process.exit() 금지
      botWorker.on("ready", () => console.log("[worker] bot 워커 준비 완료"));
      botWorker.on("completed", (job) =>
        console.info(`[bot-worker] job 완료: ${job.id} (${job.name})`),
      );
      botWorker.on("failed", (job, error) =>
        // 잡 실패 → 로그만. 다른 워커·api·web 영향 없음
        console.error(`[bot-worker] job 실패 ${job?.id} (${job?.name}):`, error.message),
      );
      botWorker.on("error", (error) =>
        // Worker 수준 오류 → 전파 차단, 로그만
        console.error("[bot-worker] Worker 오류 (사이트 본체 영향 없음):", error.message),
      );

      workers.push(botWorker); // 그레이스풀 셧다운 포함
      console.log("[worker] 봇 워커 등록 완료 (SEEDING_BOT_ENABLED=true)");

      // 봇 크론 등록
      try {
        const botCronQueue = new Queue(QUEUE_NAMES.bot, { connection: createConnection() });
        await setupBotCrons(botCronQueue);
      } catch (err) {
        console.warn("[worker] 봇 크론 등록 실패 (봇 비활성화 유지):", (err as Error).message);
      }
    } catch (err) {
      // 봇 모듈 초기화 실패 → 봇만 비활성화, 나머지 워커 정상 가동 [격리 핵심]
      console.error("[worker] 봇 워커 초기화 실패 (사이트 본체 영향 없음):", (err as Error).message);
    }
  } else {
    console.log("[worker] 봇 워커 비활성화 (SEEDING_BOT_ENABLED != true)");
  }
})();
// ── [11.13] 봇 워커 END ───────────────────────────────────────────────────────
