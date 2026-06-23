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
