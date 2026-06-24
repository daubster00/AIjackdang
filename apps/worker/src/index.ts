import { Worker, Queue } from "bullmq";
import { createConnection, QUEUE_NAMES } from "./connection";
import { renderResetPasswordEmail } from "./templates/reset-password.js";
import { renderEmailVerification } from "./templates/email-verification.js";
import { sendMail, isSmtpConfigured } from "./mailer.js";
import { viewFlushProcessor } from "./processors/view.flush.js";
import { processResourceScan } from "./processors/resource-scan.processor.js"; // Story 4.5
import { gradeUpProcessor } from "./processors/gradeUp.processor.js"; // Story 6.3
import { badgeCheckProcessor } from "./processors/badgeCheck.processor.js"; // Story 6.4
import { rankingComputeProcessor } from "./processors/rankingCompute.processor.js"; // Story 6.5
import { setupRankingCron } from "./schedules/ranking.cron.js"; // Story 6.5
import { ogFetchProcessor } from "./processors/og-fetch.js"; // Story 8.6

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

  // ── [6.3] ranking worker ─────────────────────────────────────────────────
  // gamification.grade-up 잡 처리: 등급 변동 감지 → notifications 큐에 grade.level-up 발행
  // ── [6.4] job.name 디스패처로 리팩터:
  //    - gamification.grade-up  → gradeUpProcessor
  //    - gamification.badge-check → badgeCheckProcessor
  //    6.5에서 ranking.compute 잡이 이 라우터에 추가될 예정
  const rankingConnection = createConnection();

  /**
   * ranking 큐 잡 이름 기반 디스패처.
   * 새 잡 추가 시 case 분기만 추가하면 됨.
   */
  async function rankingProcessor(job: import("bullmq").Job): Promise<void> {
    switch (job.name) {
      case "gamification.grade-up":
        return gradeUpProcessor(job as import("bullmq").Job<import("@ai-jakdang/contracts").GradeUpJobPayload>);
      case "gamification.badge-check":
        return badgeCheckProcessor(job as import("bullmq").Job<import("@ai-jakdang/contracts").BadgeCheckJobPayload>);
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
  // ── [6.3/6.4] ranking worker END ─────────────────────────────────────────

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

// ── [1.9] cleanup worker ──────────────────────────────────────────────────────
// 탈퇴 회원 콘텐츠 익명화 워커.
// posts.user_id / comments.user_id 를 null 로 처리한다.
// posts·comments 테이블이 생성된 이후(Epic 2~) 실제 익명화 로직을 구현한다.
//
// job 데이터: { userId: string; jobName: "cleanup.anonymize" }

const cleanupConnection = createConnection();
const cleanupWorker = new Worker(
  QUEUE_NAMES.cleanup,
  async (job) => {
    if (job.name === "cleanup.anonymize") {
      const { userId } = job.data as { userId: string };
      // TODO(Epic 2 이후): posts.user_id = null WHERE user_id = userId
      // TODO(Epic 2 이후): comments.user_id = null WHERE user_id = userId
      console.log(`[worker] cleanup.anonymize 수신 userId=${userId} — posts·comments 테이블 생성 후 처리`);
    } else {
      console.log(`[worker] cleanup job 수신: ${job.id} name=${job.name} (처리기 미구현)`);
    }
  },
  { connection: cleanupConnection },
);

cleanupWorker.on("ready", () => console.log("[worker] cleanup 워커 준비 완료"));
cleanupWorker.on("failed", (job, error) =>
  console.error(`[worker] cleanup job 실패 ${job?.id}:`, error.message),
);

workers.push(cleanupWorker);
