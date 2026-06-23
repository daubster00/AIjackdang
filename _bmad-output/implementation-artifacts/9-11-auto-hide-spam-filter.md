# Story 9.11: 자동 숨김 · 금칙어/스팸 필터

Status: ready-for-dev

## Story

As a 관리자,
I want 신고 누적 자동 숨김(기본 OFF·보수적)·금칙어/스팸 필터가 동작하고 사이트 설정으로 제어되기를,
So that 오탐 리스크를 인지하며 필요 시 자동화 보조를 켠다.

## Acceptance Criteria

1. 자동 숨김(FR-8.3·UX-DR-A12): `auto_hide_enabled=false`(기본). 임계치 미설정이면 자동 숨김 미실행·신고 큐에만 추가. `auto_hide_enabled=true` + 신고 수 ≥ `auto_hide_threshold`이면 `deriveReportAction` 호출 → `status='hidden'` + "자동 숨김" 플래그로 큐 추가(검토 가능). `site_settings`에서 설정값 조회.
2. 자동 숨김된 정상 글 복구: 신고 큐에서 "자동 숨김" 플래그 게시글 복구 버튼 → `status='published'` 복구, 즉시+토스트.
3. 금칙어(FR-8.5): 콘텐츠 작성 API(`POST /api/v1/posts`, `POST /api/v1/qna`, `POST /api/v1/comments` 등)에서 `detectForbiddenWord(content, forbiddenList)` 체크. 포함 시 422 `FORBIDDEN_CONTENT`. 금칙어 목록은 `site_settings.forbidden_words`(JSON 배열) DB 기반 조회(코드 재배포 없이 갱신).
4. 스팸 링크(FR-8.5): `detectSpam(content)` 순수 함수로 광고 링크 패턴 감지. 포함 시 422 `FORBIDDEN_CONTENT`. `packages/core/src/moderation.ts`에 캡슐화, 단위 테스트(Vitest).
5. `detectSpam`·`detectForbiddenWord` 모두 `packages/core/src/moderation.ts` 안에 캡슐화. 라우트 핸들러에 도메인 로직 분산 금지.

## Tasks / Subtasks

- [ ] Task 1: site_settings 테이블·초기값 (AC: #1, #3)
  - [ ] `packages/database/src/schema/site-settings.ts` NEW: `site_settings` 테이블(key TEXT PK, value JSONB, updatedAt)
  - [ ] 초기 시드: `auto_hide_enabled=false`, `auto_hide_threshold=null`, `content_retention_days=30`, `forbidden_words=[]`
  - [ ] `apps/api/src/lib/siteSettings.ts` NEW: `getSiteSetting(key)` 캐시 유틸(Redis 캐시 60초 또는 단순 DB 조회)

- [ ] Task 2: core/moderation.ts 확장 (AC: #3~#5)
  - [ ] `packages/core/src/moderation.ts` UPDATE (9.10에서 생성)
  - [ ] `detectForbiddenWord(content: string, forbiddenList: string[]): boolean` 추가
  - [ ] `detectSpam(content: string): boolean` 추가: 외부 URL 패턴 감지 (`http://`, `https://` 링크가 일정 수 초과하거나 알려진 광고 도메인 패턴 포함)
  - [ ] 스팸 패턴 정의: 단기 URL 단축 서비스(`bit.ly`, `tinyurl.com` 등) + 비정상 링크 과다(>3개)
  - [ ] `packages/core/src/moderation.test.ts` UPDATE: `detectForbiddenWord`, `detectSpam` 테스트 케이스 추가

- [ ] Task 3: 콘텐츠 작성 API 금칙어/스팸 훅 연결 (AC: #3, #4)
  - [ ] `apps/api/src/middleware/contentGuard.ts` NEW: Fastify preHandler — `getSiteSetting('forbidden_words')` → `detectForbiddenWord` + `detectSpam` → 포함 시 422 FORBIDDEN_CONTENT
  - [ ] 연결 라우트: `POST /api/v1/posts`, `POST /api/v1/qna/questions`, `POST /api/v1/qna/answers`, `POST /api/v1/comments`
  - [ ] 오류 응답: `{ error: { code: "FORBIDDEN_CONTENT", message: "허용되지 않는 내용이 포함되어 있습니다." } }`

- [ ] Task 4: 자동 숨김 로직 연결 (AC: #1)
  - [ ] `apps/api/src/routes/reports/service.ts` (Epic 5에서 신고 접수 서비스) UPDATE: 신고 누적 시 `getSiteSetting('auto_hide_enabled')`, `getSiteSetting('auto_hide_threshold')` 조회
  - [ ] `deriveReportAction(reportCount, threshold)` 호출 → `'auto_hide'`이면 target status='hidden' + report.auto_hidden=true 마킹
  - [ ] `auto_hidden=true` 플래그 컬럼: `reports` 테이블에 `auto_hidden boolean DEFAULT false` 추가(마이그레이션)

- [ ] Task 5: 자동 숨김 복구 UI (AC: #2)
  - [ ] `/reports` 필터에 "자동 숨김" 서브 필터 추가
  - [ ] 자동 숨김 행에 "복구" 버튼 → `PATCH /api/v1/admin/reports/:id/restore-auto-hide` → target status='published'

## Dev Notes

### 의존성
- **9.10 완료**: `deriveReportAction` 함수, `moderation.ts` 파일 존재
- **9.15 이전**: `site_settings` 테이블이 없으면 이 스토리에서 먼저 생성(9.15는 설정 UI만)

### 자동 숨김 기본값 (UX-DR-A12)
- 기본 `auto_hide_enabled = false` — 오탐 리스크 최우선
- "초기에는 신중하게" 운영 철학 반영
- [Source: EXPERIENCE.md#State Patterns] — 자동 숨김 기본 OFF

### 금칙어 DB 기반 패턴
```ts
// getSiteSetting('forbidden_words') → string[]
const forbidden: string[] = await getSiteSetting('forbidden_words') ?? [];
if (detectForbiddenWord(content, forbidden)) throw 422;
```
코드 재배포 없이 관리자가 9.15 사이트 설정에서 금칙어 추가/삭제 가능.

### detectSpam 구현 참고
```ts
const SPAM_DOMAINS = ['bit.ly', 'tinyurl.com', 't.co'];
const URL_REGEX = /https?:\/\/[^\s]+/g;
export function detectSpam(content: string): boolean {
  const urls = content.match(URL_REGEX) ?? [];
  if (urls.length > 3) return true;
  return urls.some(url => SPAM_DOMAINS.some(d => url.includes(d)));
}
```

### Project Structure Notes
- NEW: `packages/database/src/schema/site-settings.ts`, `apps/api/src/lib/siteSettings.ts`, `apps/api/src/middleware/contentGuard.ts`
- UPDATE: `packages/core/src/moderation.ts`, `packages/core/src/moderation.test.ts`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2869-2892] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#State Patterns] — 자동 숨김 보수 기본

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
