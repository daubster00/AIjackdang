/**
 * 파일 바이러스 스캔 Processor — Story 4.5
 *
 * BullMQ Worker `file-scan` 큐에서 `resource.scan` job을 소비한다.
 * 처리 순서:
 * 1. 멱등 확인: scan_status가 이미 clean|infected이면 early return
 * 2. S3(private)에서 파일 스트림 다운로드 (GetObjectCommand)
 * 3. ClamAV clamd TCP INSTREAM 스캔
 * 4. CLEAN → scan_status=clean, scan_completed_at 업데이트
 * 5. FOUND → scan_status=infected, quarantine/ prefix로 S3 이동(Copy+Delete), 원본 삭제
 *            → // TODO: Epic 7 운영자 알림 이벤트 발행
 * 6. ERROR → throw Error (BullMQ가 attempts:3, exponential backoff:2000ms로 재시도)
 *
 * 아키텍처 가드레일:
 * - AR-2: DB 업데이트는 worker 직접 수행(경량, 단일 행 UPDATE)
 * - AR-4: env는 @ai-jakdang/config 단일 진입점
 * - AR-16: 멱등 처리(clean|infected 상태 early return)
 */

import net from "node:net";
import { Readable } from "node:stream";
import type { Job } from "bullmq";
import {
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import type { ResourceScanJobPayload } from "@ai-jakdang/contracts";
import { env } from "@ai-jakdang/config";
import { getS3Client, getPrivateBucket } from "../lib/s3.js";

/** ClamAV 스캔 결과 */
type ClamScanResult =
  | { status: "CLEAN" }
  | { status: "FOUND"; virusName: string }
  | { status: "ERROR"; message: string };

/**
 * ClamAV clamd TCP INSTREAM 스캔.
 * raw `net` 소켓으로 INSTREAM 명령을 사용한다(npm 패키지 불필요).
 *
 * 프로토콜:
 * 1. 연결 후 "nINSTREAM\n" 전송
 * 2. 데이터를 4바이트 big-endian 길이 헤더 + 청크로 전송
 * 3. 종료: 길이 0의 청크(0x00000000) 전송
 * 4. 응답: "stream: OK\n" 또는 "stream: {VirusName} FOUND\n" 또는 "stream: ERROR ...\n"
 *
 * @param data 스캔할 파일 버퍼
 */
async function scanWithClamd(data: Buffer): Promise<ClamScanResult> {
  return new Promise((resolve, reject) => {
    const host = env.CLAMD_HOST;
    const port = env.CLAMD_PORT;

    const socket = new net.Socket();
    let response = "";

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`ClamAV 연결 타임아웃 (${host}:${port})`));
    }, 30000); // 30초 타임아웃

    socket.connect(port, host, () => {
      // INSTREAM 명령 전송 (n prefix = newline-terminated command)
      socket.write("nINSTREAM\n");

      // 데이터를 청크 단위로 전송 (최대 64KB씩)
      const CHUNK_SIZE = 65536;
      let offset = 0;

      while (offset < data.length) {
        const chunk = data.subarray(offset, offset + CHUNK_SIZE);
        const lengthBuf = Buffer.allocUnsafe(4);
        lengthBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lengthBuf);
        socket.write(chunk);
        offset += chunk.length;
      }

      // 종료 신호: 길이 0
      const endBuf = Buffer.allocUnsafe(4);
      endBuf.writeUInt32BE(0, 0);
      socket.write(endBuf);
    });

    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString();
      // 응답 완료 감지: 줄바꿈 포함 시 처리
      if (response.includes("\n") || response.length > 0) {
        clearTimeout(timeout);
        socket.destroy();

        const trimmed = response.trim();
        if (trimmed.endsWith("OK")) {
          resolve({ status: "CLEAN" });
        } else if (trimmed.includes("FOUND")) {
          // 형식: "stream: {VirusName} FOUND"
          const match = trimmed.match(/stream:\s+(.+)\s+FOUND/);
          const virusName = match?.[1] ?? "UnknownVirus";
          resolve({ status: "FOUND", virusName });
        } else if (trimmed.includes("ERROR")) {
          resolve({ status: "ERROR", message: trimmed });
        } else {
          resolve({ status: "ERROR", message: `알 수 없는 ClamAV 응답: ${trimmed}` });
        }
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`ClamAV 소켓 오류: ${err.message}`));
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      if (!response) {
        reject(new Error("ClamAV 연결이 응답 없이 닫혔습니다."));
      }
    });
  });
}

/**
 * S3 Readable 스트림을 Buffer로 변환한다.
 */
async function streamToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * resource.scan BullMQ job 처리기.
 *
 * 멱등 설계(AR-16): clean|infected 상태이면 즉시 return.
 * ERROR 발생 시 throw → BullMQ가 attempts:3, exponential backoff:2000ms로 재시도.
 */
export async function processResourceScan(
  job: Job<ResourceScanJobPayload>,
): Promise<void> {
  const { resourceFileIds, resourceId } = job.data;
  const db = getDb();
  const s3 = getS3Client();
  const bucket = getPrivateBucket();

  console.info(`[resource-scan] job 시작: ${job.id} resourceId=${resourceId} files=${resourceFileIds.length}`);

  for (const fileId of resourceFileIds) {
    // ── Step 1: 멱등 확인 ───────────────────────────────────────────────────────
    const rows = await db
      .select({
        id: schema.resourceFiles.id,
        storageKey: schema.resourceFiles.storageKey,
        scanStatus: schema.resourceFiles.scanStatus,
      })
      .from(schema.resourceFiles)
      .where(eq(schema.resourceFiles.id, fileId));

    const fileRow = rows[0];
    if (!fileRow) {
      console.warn(`[resource-scan] fileId=${fileId} 를 DB에서 찾을 수 없음. 건너뜀.`);
      continue;
    }

    // clean 또는 infected면 이미 처리 완료 — 재처리 없이 early return (멱등)
    if (fileRow.scanStatus === "clean" || fileRow.scanStatus === "infected") {
      console.info(`[resource-scan] fileId=${fileId} 이미 처리됨 (${fileRow.scanStatus}). 건너뜀.`);
      continue;
    }

    // ── Step 2: S3에서 파일 다운로드 ─────────────────────────────────────────────
    const getObjectResult = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: fileRow.storageKey,
      }),
    );

    if (!getObjectResult.Body) {
      throw new Error(`S3 파일 스트림 없음: ${fileRow.storageKey}`);
    }

    const fileBuffer = await streamToBuffer(getObjectResult.Body as Readable);

    // ── Step 3: ClamAV 스캔 ───────────────────────────────────────────────────
    let scanResult: ClamScanResult;
    try {
      scanResult = await scanWithClamd(fileBuffer);
    } catch (err) {
      // ClamAV 연결 실패 등 — 재시도 가능 오류로 throw
      throw new Error(`ClamAV 스캔 실패: ${(err as Error).message}`);
    }

    // ── Step 4~5: 결과 처리 ───────────────────────────────────────────────────
    if (scanResult.status === "CLEAN") {
      // 정상 파일: scan_status=clean 업데이트
      await db
        .update(schema.resourceFiles)
        .set({
          scanStatus: "clean",
          scanCompletedAt: new Date(),
        })
        .where(eq(schema.resourceFiles.id, fileId));

      console.info(`[resource-scan] fileId=${fileId} CLEAN 판정 완료`);
    } else if (scanResult.status === "FOUND") {
      // 감염 파일: scan_status=infected + quarantine 이동
      const quarantineKey = `quarantine/${fileRow.storageKey}`;

      // S3 Copy → quarantine prefix
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${fileRow.storageKey}`,
          Key: quarantineKey,
        }),
      );

      // 원본 삭제
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: fileRow.storageKey,
        }),
      );

      // DB 업데이트: infected + quarantine key 기록(storageKey 변경)
      await db
        .update(schema.resourceFiles)
        .set({
          scanStatus: "infected",
          scanCompletedAt: new Date(),
          storageKey: quarantineKey,
        })
        .where(eq(schema.resourceFiles.id, fileId));

      console.warn(
        `[resource-scan] fileId=${fileId} 감염 감지! virus=${(scanResult as { status: "FOUND"; virusName: string }).virusName} quarantine=${quarantineKey}`,
      );

      // TODO: Epic 7 운영자 알림 이벤트 발행
    } else {
      // ERROR: 재시도 가능 오류
      throw new Error(`ClamAV 스캔 오류: ${(scanResult as { status: "ERROR"; message: string }).message}`);
    }
  }

  console.info(`[resource-scan] job 완료: ${job.id}`);
}
