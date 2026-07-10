/**
 * API용 S3 클라이언트 싱글톤 — Story 4.5
 *
 * MinIO(로컬) / Cloudflare R2(운영) S3 호환 클라이언트.
 * env 단일 진입점(@ai-jakdang/config)을 통해 자격증명을 주입한다(AR-4).
 *
 * 주의: apps/worker/src/lib/s3.ts 와 별도 인스턴스(패키지 공유 금지, 아키텍처 격리).
 *
 * Story 4.6: getPresignedDownloadUrl — presigned URL 생성(60초 만료).
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@ai-jakdang/config";

let _s3Client: S3Client | null = null;
let _presignClient: S3Client | null = null;

/**
 * S3 클라이언트를 반환한다(지연 초기화 싱글톤).
 * S3 env 미설정 시 로컬 개발 환경용 기본값으로 연결을 시도한다.
 * 이 클라이언트는 **내부 엔드포인트**(업로드·삭제 등 서버↔MinIO 직접 통신)에 쓴다.
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

/**
 * presigned 다운로드 URL 서명 전용 클라이언트.
 * S3_PRESIGN_ENDPOINT(외부 접근 가능한 호스트)가 있으면 그걸로 서명한다.
 * presigned URL 의 호스트는 서명에 포함되므로, 서명 엔드포인트가 곧 브라우저가 접근할 호스트다.
 * 운영에서 내부 S3_ENDPOINT(http://minio:9000)로 서명하면 브라우저가 접근 못 해 다운로드가 깨진다.
 * S3_PRESIGN_ENDPOINT 미설정(로컬 등)이면 내부 클라이언트로 폴백.
 */
function getPresignClient(): S3Client {
  if (!env.S3_PRESIGN_ENDPOINT) return getS3Client();
  if (!_presignClient) {
    _presignClient = new S3Client({
      endpoint: env.S3_PRESIGN_ENDPOINT,
      region: env.S3_REGION ?? "auto",
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? "minioadmin",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
      },
    });
  }
  return _presignClient;
}

/** 버킷 이름 (private: 실전자료 원본 파일 저장) */
export function getPrivateBucket(): string {
  return env.S3_BUCKET_PRIVATE ?? "ai-jakdang-private";
}

/**
 * S3 presigned 다운로드 URL 생성 — Story 4.6
 *
 * @param storageKey - S3 오브젝트 키 (resource_files.storage_key)
 * @param expiresIn  - URL 만료 시간(초). 기본 60초.
 * @returns presigned URL 문자열
 */
export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresIn: number = 60,
): Promise<string> {
  const client = getPresignClient();
  const bucket = getPrivateBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}
