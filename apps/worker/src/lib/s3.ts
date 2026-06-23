/**
 * Worker용 S3 클라이언트 싱글톤 — Story 4.5
 *
 * apps/api/src/lib/s3.ts 와 별도 인스턴스(패키지 공유 금지, 아키텍처 격리).
 * MinIO(로컬) / Cloudflare R2(운영) S3 호환 클라이언트.
 * env 단일 진입점(@ai-jakdang/config)을 통해 자격증명을 주입한다(AR-4).
 */

import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@ai-jakdang/config";

let _s3Client: S3Client | null = null;

/**
 * S3 클라이언트를 반환한다(지연 초기화 싱글톤).
 */
export function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION ?? "auto",
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "minioadmin",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      },
    });
  }
  return _s3Client;
}

/** Private 버킷 이름 (실전자료 원본 파일) */
export function getPrivateBucket(): string {
  return env.S3_BUCKET_PRIVATE ?? "ai-jakdang-private";
}
