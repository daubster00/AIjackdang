import { Worker } from "bullmq";
import { createConnection, QUEUE_NAMES } from "./connection";
import { renderResetPasswordEmail } from "./templates/reset-password.js";

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
        // TODO(실 SMTP 연동): nodemailer / Resend 로 실제 발송
        // const transporter = nodemailer.createTransport({ ... });
        // await transporter.sendMail({ from: "noreply@ai-jakdang.com", to, subject, html });

        // dev 골격: console 출력으로 이메일 내용 확인
        console.info("[email-worker] ── 이메일 발송 (console 출력) ──────────");
        console.info("[email-worker]   TO       :", to);
        console.info("[email-worker]   SUBJECT  :", subject);
        console.info("[email-worker]   TEMPLATE :", templateId);

        if (templateId === "email-verification") {
          console.info("[email-worker]   인증 URL  :", variables["verificationUrl"]);
        }

        // ── [1.6] 비밀번호 재설정 이메일 처리 ────────────────────────────────
        if (templateId === "reset-password") {
          const resetUrl = variables["resetUrl"] ?? "";
          console.info("[email-worker]   재설정 URL:", resetUrl);
          // dev: HTML 렌더링 결과도 로깅 (실 SMTP 연동 전 개발 확인용)
          const html = renderResetPasswordEmail({
            resetUrl,
            email: variables["email"] ?? to,
          });
          console.info("[email-worker]   HTML 미리보기 (앞 200자):", html.slice(0, 200));
        }
        // ── [1.6] END ─────────────────────────────────────────────────────────

        Object.entries(variables).forEach(([key, value]) => {
          if (key !== "verificationUrl" && key !== "resetUrl") {
            console.info(`[email-worker]   ${key}: ${value}`);
          }
        });
        console.info("[email-worker] ────────────────────────────────────────");
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

  return [imageWorker, emailWorker];
}

const workers = startWorkers();
console.log("[worker] AI작당 워커가 기동되었습니다. (Redis 연결 대기 중일 수 있음)");

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
