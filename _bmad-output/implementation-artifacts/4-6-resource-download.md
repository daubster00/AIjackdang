# Story 4.6: 다운로드 (로그인 게이팅 + 다운로드 수 집계)

Status: ready-for-dev

## Story

As a 회원,
I want [다운로드]로 파일을 받고 비회원이면 로그인 후 자동 다운로드가 시작되기를,
So that 마찰 없이 자료를 활용한다(FR-4.6).

## Acceptance Criteria

1. 비회원이 [다운로드] 클릭 시 로그인 유도 모달이 표시되고, 로그인 후 자료 상세(`/resources/{slug}`)로 `redirectTo` 복귀 후 **다운로드가 자동 시작**된다(UX-DR-U1·U5·FR-4.6).
2. 회원이 [다운로드](clean 대표 파일) 클릭 시 `POST /api/v1/resources/{id}/download` 호출 → ①인증 확인(401 if 미인증) ②`is_primary=true`·`scan_status=clean` 파일의 `storage_key` 조회 ③presigned URL(60초 만료) 반환 ④`download_count` +1(대표 파일 기준) ⑤클라이언트가 presigned URL로 직접 다운로드.
3. 동시 다수 요청 시 `download_count` 원자적 increment(`UPDATE resources SET download_count = download_count + 1`) 또는 `stats` BullMQ 큐 비동기 집계(NFR-6·AR-16).
4. `scan_status=pending` 대표 파일 시 409 `RESOURCE_SCAN_PENDING` 응답.
5. `scan_status=infected` 대표 파일 시 403 `RESOURCE_INFECTED` 응답.
6. 비대표(`is_primary=false`) 파일 다운로드: `GET /api/v1/resources/{id}/files/{fileId}/download` → presigned URL 반환, 대표 파일 `download_count` 미집계(FR-4.6).
7. 로그인 후 자동 다운로드: URL에 `?download=true` 쿼리 파라미터가 있으면 자료 상세 페이지 마운트 시 자동으로 download API 호출 → presigned URL → `<a>` 클릭 자동화로 다운로드 시작.

## Tasks / Subtasks

- [ ] Task 1: 다운로드 API 구현 (AC: #2, #3, #4, #5, #6)
  - [ ] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: 다운로드 라우트 추가
    - `POST /api/v1/resources/:id/download` — 대표 파일 다운로드 + 카운트 집계
    - `GET /api/v1/resources/:id/files/:fileId/download` — 비대표 파일 다운로드
  - [ ] `apps/api/src/routes/v1/resources/resource.service.ts` UPDATE: 다운로드 service 함수
    - `downloadResource(resourceId: string, userId: string)`:
      1. resource 조회(없으면 404)
      2. `resource_files` 중 `is_primary=true` 조회
      3. `scan_status` 분기: `pending` → 409, `infected` → 403, `error` → 503
      4. S3 `GetObjectCommand` presigned URL 생성(60초 — `getSignedUrl` from `@aws-sdk/s3-request-presigner`)
      5. `download_count` 원자적 증가: `db.update(resources).set({ downloadCount: sql`${resources.downloadCount} + 1` }).where(eq(resources.id, resourceId))`
      6. presigned URL 반환
    - `downloadFile(resourceId: string, fileId: string, userId: string)`:
      1. `resource_files` 조회(resourceId + fileId 일치 확인)
      2. `scan_status=clean` 확인(아니면 409/403)
      3. presigned URL 반환(카운트 집계 안 함)
  - [ ] `apps/api/src/lib/s3.ts` UPDATE: `getPresignedDownloadUrl(storageKey: string, expiresIn: number)` 함수 추가
    - `@aws-sdk/s3-request-presigner` 설치: `pnpm add @aws-sdk/s3-request-presigner --filter @ai-jakdang/api`
  - [ ] contracts UPDATE: 다운로드 응답 스키마
    - `packages/contracts/src/resource.ts` UPDATE: `downloadResponseSchema = z.object({ url: z.string().url(), expiresAt: z.string() })`

- [ ] Task 2: 비회원 게이팅 + 로그인 후 자동 다운로드 (AC: #1, #7)
  - [ ] **기존 코드 완독**: `apps/web/app/resources/prompts/[slug]/page.tsx`의 `downloadAction` 버튼 부분 확인
  - [ ] `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` UPDATE (4.3에서 신규 생성):
    - [다운로드] 버튼 클릭 핸들러: 인증 상태 확인
      - 비회원: 로그인 유도 모달 표시(`redirectTo=/resources/${slug}?download=true`)
      - 회원: `POST /api/v1/resources/${id}/download` 호출 → presigned URL → 다운로드 트리거
    - `useEffect`: URL에 `?download=true` 있으면 마운트 시 자동 download API 호출
    - 다운로드 트리거: `const a = document.createElement('a'); a.href = presignedUrl; a.download = fileName; a.click()`
    - 다운로드 시작 토스트: "다운로드가 시작됩니다." (success 토스트 3초)
    - 오류 토스트: `scan_status` 오류별 메시지 처리
  - [ ] 목록 페이지 카드 [다운로드] 버튼도 동일 게이팅 적용:
    - `apps/web/app/resources/ResourceCard.tsx` UPDATE: [다운로드] 버튼 클릭 → 게이팅 확인 → 상세 페이지로 `redirectTo` 이동(목록에서 직접 다운로드 시작은 UX 복잡도로 상세로 이동 후 처리)

- [ ] Task 3: 다운로드 율하 제한 (보안)
  - [ ] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: 다운로드 라우트에 rate limit 적용
    - `@fastify/rate-limit`: 회원 1인 기준 분당 30건(동일 파일 반복 다운로드 방지)

- [ ] Task 4: 타입체크 및 검증
  - [ ] `pnpm typecheck` 통과
  - [ ] 로컬 환경에서 실제 S3(MinIO) presigned URL 다운로드 동작 확인

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**`apps/web/app/resources/prompts/[slug]/page.tsx` 의 [다운로드] 버튼 현재 상태:**
```tsx
// 현재: 단순 button, 클릭 핸들러 없음
<button type="button" className={styles.downloadAction}>
  <Icon name="download-cloud-2-line" />
  다운로드
</button>
```
이 버튼 구조(아이콘 + 텍스트)를 그대로 유지하고 클릭 핸들러만 연결한다. 스타일 클래스 변경 금지.

**카드 [다운로드] 버튼 현재 상태:**
```tsx
// apps/web/app/resources/prompts/page.tsx
<Link href={`/resources/prompts/${item.slug}`} className={styles.downloadBtn}>
  <Icon name="download-cloud-2-line" />
  다운로드
</Link>
```
현재 Link(이동)로 구현됨. → 클라이언트 컴포넌트 button으로 교체 또는 `href`에 `?download=true` 추가. 스타일 `.downloadBtn` 클래스 유지.

### Presigned URL 다운로드 패턴

```typescript
// 클라이언트 자동 다운로드
async function triggerDownload(presignedUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = presignedUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

### 원자적 카운트 증가 (동시성)

```typescript
// Drizzle sql 템플릿으로 원자적 increment
await db.update(resources)
  .set({ downloadCount: sql`${resources.downloadCount} + 1` })
  .where(eq(resources.id, resourceId));
```

stats BullMQ 큐 방식(AR-16)도 가능하지만, 다운로드 카운트는 비교적 단순하므로 원자적 DB 업데이트로 충분. 고트래픽 시 `stats` 큐로 전환 예정(`// TODO: 고트래픽 시 stats 큐로 전환`).

### 아키텍처 가드레일

- **인증 필수 (AR-15)**: 다운로드 API는 회원 전용(401 if 미인증). presigned URL은 S3에서 직접 서빙.
- **presigned URL 만료**: 60초(재사용·공유 방지).
- **rate limiting**: `@fastify/rate-limit` 다운로드 라우트에 적용.
- **카운트 집계 기준**: 대표 파일(`is_primary=true`) 다운로드만 집계(FR-4.6). 비대표 파일은 미집계.
- **비회원 redirectTo**: `redirectTo=/resources/{slug}?download=true`. 로그인 후 URL에 `?download=true` 있으면 자동 다운로드 시작. 메모리 콜백 금지(project-context.md 규칙).

### 오류 코드 매핑

| 상황 | 상태 코드 | error.code |
|------|----------|-----------|
| 미인증 | 401 | `UNAUTHORIZED` |
| scan_status=pending | 409 | `RESOURCE_SCAN_PENDING` |
| scan_status=infected | 403 | `RESOURCE_INFECTED` |
| 파일 없음/삭제됨 | 404 | `FILE_NOT_FOUND` |

### Project Structure Notes

```
apps/api/src/routes/v1/resources/
├── resource.route.ts   ← UPDATE: POST /:id/download, GET /:id/files/:fileId/download
├── resource.service.ts ← UPDATE: downloadResource(), downloadFile()

apps/web/app/resources/
├── [slug]/
│   └── ResourceDetailClient.tsx ← UPDATE: [다운로드] 버튼 핸들러, 자동 다운로드 useEffect
├── ResourceCard.tsx ← UPDATE: [다운로드] 버튼 게이팅
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#권한 & 게이팅] — 비회원 게이팅 + 자동 복귀 패턴
- [Source: _bmad-output/planning-artifacts/architecture.md#Security] — AR-15 다운로드 로그인 필요
- [Source: apps/web/app/resources/prompts/[slug]/page.tsx] — 현재 [다운로드] 버튼 구조
- [Source: _bmad-output/project-context.md#UX / 에러 처리] — redirectTo 패턴

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
