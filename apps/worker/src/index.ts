import { Worker } from "bullmq";
import { createConnection, QUEUE_NAMES } from "./connection";

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

  return [imageWorker];
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
