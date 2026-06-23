# Story 4.5: 파일 업로드 보안 파이프라인 (확장자/매직넘버 → S3 → ClamAV worker)

Status: ready-for-dev

## Story

As a 시스템,
I want 첨부 파일이 확장자·매직넘버 검증 → S3 저장(검사중) → worker ClamAV 스캔 → 통과 공개/감염 격리 순으로 처리되기를,
So that 악성 파일이 공개 다운로드 경로에 노출되지 않는다(NFR-2·AR-15).

## Acceptance Criteria

1. `POST /api/v1/resources`(또는 파일 업로드 전용 엔드포인트)에 파일 첨부 시 API service에서: ①확장자 검증(미허용 → 400 `INVALID_FILE_TYPE`) ②매직넘버 검증(불일치 → 400 `INVALID_FILE_SIGNATURE`) ③S3(`{resource_id}/{uuid}.{ext}`) 업로드·`resource_files` `scan_status=pending` insert ④`file-scan` BullMQ 큐에 `resource.scan` job 발행(AR-16).
2. DB insert는 service `db.transaction()` 내, S3 업로드·큐 발행은 트랜잭션 외에서 실행한다(AR-2).
3. `apps/worker`에 `resource.scan` BullMQ processor가 구현되어: ①S3 스트림 다운로드 ②ClamAV clamd TCP 소켓 스캔 ③CLEAN=`scan_status=clean` 업데이트 ④FOUND=`scan_status=infected`·quarantine/ prefix S3 이동·public 파일 삭제·운영자 알림 이벤트 발행(`// TODO: Epic 7 알림 연결`) ⑤ERROR=`scan_status=error`·재시도(max 3, exponential backoff).
4. 멱등 설계: 이미 `scan_status=clean` 또는 `infected`인 파일에 동일 job 재처리 시 중복 작업 없이 성공 반환한다(AR-16).
5. `scan_status=pending` 대표 파일을 가진 자료는 published로 표시되되 다운로드 버튼 "검사 중" 비활성.
6. `scan_status=infected` 대표 파일을 가진 자료는 다운로드 버튼 숨김·"보안 검사 문제 발견" 안내 표시.
7. 파일당 최대 50MB 제한: API에서 multipart 수신 시 초과하면 400 `FILE_TOO_LARGE`.
8. 허용 MIME 타입 + 매직넘버 맵핑: .zip(PK\x03\x04), .pdf(%PDF), .docx(PK\x03\x04), .xlsx(PK\x03\x04), .md/txt/json(텍스트 — 매직넘버 없음, `file.type` 또는 내용 첫 512바이트로 판단).

## Tasks / Subtasks

- [ ] Task 1: 매직넘버 검증 유틸 (AC: #1, #8)
  - [ ] `packages/utilities/src/file-magic.ts` 신규 생성 (NEW)
    - `MAGIC_MAP`: 확장자별 매직넘버 정의(hex prefix 비교)
    - `validateFileSignature(buffer: Buffer, ext: string): boolean`
    - `.md`, `.txt`, `.json`은 BOM 또는 텍스트 패턴 확인(첫 512B 내 비인쇄 제어문자 비율로 이진 판별)
  - [ ] `packages/utilities/src/index.ts` UPDATE: `export * from "./file-magic"` 추가

- [ ] Task 2: API 파일 업로드 엔드포인트 구현 (AC: #1, #2, #7)
  - [ ] `@fastify/multipart` 설치: `pnpm add @fastify/multipart --filter @ai-jakdang/api`
  - [ ] `apps/api/src/plugins/multipart.ts` 신규 생성 (NEW) — `@fastify/multipart` 플러그인 등록, `limits: { fileSize: 50 * 1024 * 1024 }`
  - [ ] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: `POST /api/v1/resources/{id}/files` 라우트 추가
    - 또는 `POST /api/v1/resources`를 multipart로 처리(4.4와 협의)
    - 인증 필수(401)
    - 최대 3개 파일
  - [ ] `apps/api/src/routes/v1/resources/resource.service.ts` UPDATE: `uploadResourceFiles(resourceId, files, userId)` 함수
    - ①확장자 검증: `ALLOWED_EXTS` 체크 → 실패 시 400 `INVALID_FILE_TYPE`
    - ②매직넘버: 첫 512바이트 읽어 `validateFileSignature` 호출 → 실패 시 400 `INVALID_FILE_SIGNATURE`
    - ③S3 업로드: AWS SDK v3 `@aws-sdk/client-s3` `PutObjectCommand`; key=`resources/{resourceId}/{uuid}.{ext}`
    - ④`db.transaction()`: `resource_files` batch insert(`scan_status='pending'`)
    - ⑤트랜잭션 후: `fileScanQueue.add('resource.scan', { resourceFileIds, resourceId })` 발행
  - [ ] `apps/api/src/lib/s3.ts` 신규 생성 (NEW) — S3 클라이언트(`@aws-sdk/client-s3`) 초기화, env(`packages/config` 경유)
  - [ ] `apps/api/src/lib/queues.ts` UPDATE 또는 신규 — `fileScanQueue` BullMQ Queue 인스턴스 (`file-scan` 큐명, AR-16)

- [ ] Task 3: BullMQ Job 타입 정의 (AC: #3)
  - [ ] `packages/contracts/src/resource.ts` UPDATE: `ResourceScanJobPayload` 타입 추가
    ```typescript
    export const resourceScanJobPayloadSchema = z.object({
      resourceFileIds: z.array(z.string().uuid()),
      resourceId: z.string().uuid(),
    });
    export type ResourceScanJobPayload = z.infer<typeof resourceScanJobPayloadSchema>;
    ```

- [ ] Task 4: Worker ClamAV Processor 구현 (AC: #3, #4)
  - [ ] `apps/worker` 구조 파악: 현재 worker 파일 확인 (Glob: `apps/worker/src/**/*.ts`)
  - [ ] `clamscan` 또는 `clamdjs` 패키지 설치 확인: `pnpm add clamscan --filter @ai-jakdang/worker`
    - `clamd` TCP 소켓 방식(docker-compose.dev.yml의 ClamAV 서비스와 연결)
  - [ ] `apps/worker/src/processors/resource-scan.processor.ts` 신규 생성 (NEW)
    - `processResourceScan(job: Job<ResourceScanJobPayload>)` 함수
    - 멱등 확인: `resource_files`에서 `scan_status` 조회 → `clean|infected`면 early return
    - S3에서 스트림 다운로드(`GetObjectCommand`)
    - ClamAV 스캔: `clamd` TCP 연결 → `INSTREAM` 명령 → 결과 파싱
    - CLEAN: `db.update(resourceFiles).set({ scanStatus: 'clean', scanCompletedAt: new Date() })`
    - FOUND: `db.update(...)` `infected` → S3 `CopyObjectCommand`(quarantine/) + `DeleteObjectCommand`(원본) → `// TODO: Epic 7 운영자 알림 이벤트 발행`
    - ERROR: `throw new Error(...)` → BullMQ `attempts: 3`, `backoff: { type: 'exponential', delay: 2000 }`
  - [ ] `apps/worker/src/index.ts` UPDATE: `resource-scan` worker 등록
    - `new Worker('file-scan', processResourceScan, { connection: redis, concurrency: 5 })`
  - [ ] `apps/worker/src/lib/s3.ts` 신규 생성 (NEW) — worker용 S3 클라이언트 (api와 동일 패턴, 별도 인스턴스)
  - [ ] `apps/worker/src/lib/redis.ts` 확인 또는 신규 — ioredis 연결 (기존 설정 재사용)

- [ ] Task 5: 환경변수 설정 (AC: #1~#4)
  - [ ] `packages/config/src/index.ts` UPDATE: S3/ClamAV 관련 env 스키마 추가
    - `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`(또는 R2 호환 변수)
    - `CLAMAV_HOST`, `CLAMAV_PORT`(docker-compose의 clamd 서비스)
  - [ ] `.env.example` UPDATE: S3/ClamAV 변수 추가(이미 있으면 스킵)

- [ ] Task 6: 타입체크 및 빌드
  - [ ] `pnpm typecheck` 통과
  - [ ] 로컬 docker-compose 환경에서 ClamAV 실제 스캔 테스트

## Dev Notes

### 매직넘버 맵핑

```typescript
// packages/utilities/src/file-magic.ts
const MAGIC_MAP: Record<string, Buffer[]> = {
  zip:  [Buffer.from([0x50, 0x4b, 0x03, 0x04])],  // PK\x03\x04
  docx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],  // PK\x03\x04 (Office Open XML)
  xlsx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  pdf:  [Buffer.from([0x25, 0x50, 0x44, 0x46])],  // %PDF
  // md/txt/json: 텍스트 파일 — binary 판별 (null byte 비율 < 5%)
};
```

### ClamAV 연결 (docker-compose.dev.yml 기반)

```typescript
// TCP INSTREAM 방식
import net from 'net';
const client = new net.Socket();
client.connect(CLAMAV_PORT, CLAMAV_HOST, () => {
  client.write('INSTREAM\n');
  // chunk 전송 → 'stream: OK\n' 또는 'stream: FOUND ...\n'
});
```

또는 `clamscan` npm 패키지의 `scanStream` API 사용.

### S3/R2 업로드 패턴

```typescript
// @aws-sdk/client-s3 v3 (Cloudflare R2는 S3 호환 — endpoint 설정 필요)
const s3 = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.S3_ENDPOINT, // R2: https://{account_id}.r2.cloudflarestorage.com
  credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
});
await s3.send(new PutObjectCommand({
  Bucket: env.AWS_S3_BUCKET,
  Key: `resources/${resourceId}/${uuid}.${ext}`,
  Body: fileBuffer,
  ContentType: mimeType,
}));
```

### 아키텍처 가드레일

- **트랜잭션 경계 (AR-2)**: DB insert(resource_files)는 `db.transaction()` 내. S3 업로드·BullMQ 발행은 트랜잭션 커밋 후 실행. S3 업로드 실패 시 DB rollback 또는 보상 로직.
- **BullMQ 큐명 (AR-16)**: `'file-scan'` (kebab), job명 `'resource.scan'`.
- **멱등성 (AR-16)**: processor 진입 시 `scan_status` 조회 → `clean|infected`면 즉시 return(재처리 없음). 재시도 safe.
- **worker 독립 S3 클라이언트**: `apps/api`와 `apps/worker` 각각 별도 S3 클라이언트 인스턴스(패키지 공유 금지, 시각 자산 격리와 동일 원칙 적용).
- **env 단일 진입점 (AR-4)**: S3 자격증명은 `packages/config` Zod 스키마로 검증. 분산 `process.env` 접근 금지.
- **격리 키 패턴**: quarantine 이동 시 key prefix를 `quarantine/resources/{resourceId}/{uuid}.{ext}`로. public 접근 차단 버킷 정책 필요(별도 배포 설정).

### 손댈 파일 목록

| 파일 | NEW/UPDATE | 비고 |
|------|-----------|------|
| `packages/utilities/src/file-magic.ts` | NEW | 매직넘버 검증 |
| `packages/utilities/src/index.ts` | UPDATE | re-export |
| `packages/contracts/src/resource.ts` | UPDATE | `ResourceScanJobPayload` 추가 |
| `packages/config/src/index.ts` | UPDATE | S3/ClamAV env 스키마 |
| `apps/api/src/plugins/multipart.ts` | NEW | @fastify/multipart |
| `apps/api/src/lib/s3.ts` | NEW | AWS S3 클라이언트 |
| `apps/api/src/lib/queues.ts` | NEW 또는 UPDATE | BullMQ Queue 인스턴스 |
| `apps/api/src/routes/v1/resources/resource.route.ts` | UPDATE | 파일 업로드 라우트 |
| `apps/api/src/routes/v1/resources/resource.service.ts` | UPDATE | 업로드 service 로직 |
| `apps/worker/src/processors/resource-scan.processor.ts` | NEW | ClamAV 스캔 처리 |
| `apps/worker/src/index.ts` | UPDATE | processor 등록 |
| `apps/worker/src/lib/s3.ts` | NEW | worker용 S3 클라이언트 |
| `.env.example` | UPDATE | S3/ClamAV 변수 |

### 테스트 표준

- `packages/utilities/src/file-magic.test.ts`: 각 확장자별 유효/무효 매직넘버 테스트 (Vitest, buffer 직접 주입)
- `apps/worker/src/processors/resource-scan.processor.test.ts`: mock S3 + mock ClamAV 응답으로 멱등성, CLEAN/FOUND/ERROR 분기 테스트

### Project Structure Notes

- `apps/worker/src/` 현재 구조를 먼저 확인(파일 미탐색). BullMQ Worker 등록 패턴이 이미 있다면 따름.
- docker-compose.dev.yml에 ClamAV(`clamd`) 서비스가 이미 정의됨(ADR-0001 완료). host/port 확인.
- Cloudflare R2는 S3 호환 API. `@aws-sdk/client-s3` v3로 `endpoint` 설정으로 연결.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5] — AC 원문
- [Source: _bmad-output/planning-artifacts/architecture.md#Security] — AR-15 업로드 보안 플로우
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — AR-16 BullMQ 큐/job 네이밍
- [Source: _bmad-output/project-context.md#보안] — 업로드 파이프라인 규칙
- [Source: docs/adr/ADR-0001] — docker-compose ClamAV/MinIO 서비스 정의

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
