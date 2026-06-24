# Story 9.15: 사이트 설정 (최고관리자 전용)

Status: done

## Story

As a 최고관리자(super_admin),
I want 사이트 운영 정책(신고·콘텐츠·파일·SEO)을 어드민 UI에서 제어하기를,
So that 코드 재배포 없이 운영 정책을 즉시 변경한다.

## Acceptance Criteria

1. 최고관리자가 `/settings` 진입 시 `site_settings`에서 섹션별(기본/콘텐츠/파일/신고) 폼 로드, `staff`는 메뉴 숨김·직접 URL 접근 시 403.
2. 신고 설정 탭: `auto_hide_enabled` 토글·`auto_hide_threshold` 입력·저장 → `site_settings` 갱신, 9.10/9.11 로직 즉시 반영.
3. 콘텐츠 설정 탭: `content_retention_days` 수정·저장 → `site_settings` 갱신, cleanup worker 다음 실행 시 반영.
4. 신고 설정 탭: 금칙어 목록 관리(추가/삭제) → `site_settings.forbidden_words`(JSON 배열) 갱신, 재배포 없이 즉시 반영(9.11 `detectForbiddenWord` DB 조회).
5. 기본 설정 탭: SEO 기본 메타(사이트명·기본 설명·OG 이미지) 수정·저장 → `site_settings` 갱신, `apps/web/app/layout.tsx` 기본값 반영.

## Tasks / Subtasks

- [ ] Task 1: site_settings DB 확인 (AC: #1~#5)
  - [ ] `packages/database/src/schema/site-settings.ts` 확인 (9.11에서 이미 생성됨)
  - [ ] 테이블 구조: `key TEXT PK, value JSONB, updatedAt`
  - [ ] 필요 키 목록 확인 및 누락 시 시드 추가:
    - `site_name`, `operator_email`, `site_description`, `seo_title`, `seo_description`
    - `auto_hide_enabled`, `auto_hide_threshold`, `content_retention_days`, `forbidden_words`
    - `file_allowed_extensions`, `max_upload_mb`, `image_extensions`, `resource_extensions`
    - `report_reasons`, `popular_post_metric`, `popular_resource_metric`

- [ ] Task 2: API 라우트 (AC: #1~#5)
  - [ ] `GET /api/v1/admin/settings` — 전체 설정 조회(flat JSON 반환)
  - [ ] `PATCH /api/v1/admin/settings` — 설정 부분 업데이트(전달된 키만 갱신, key별 UPSERT)
  - [ ] `packages/contracts/src/admin/settings.ts` NEW: 설정 Zod 스키마
  - [ ] `requireSuperAdmin` 미들웨어 적용(staff → 403)
  - [ ] 저장 후 Redis `site_settings` 캐시 무효화(`getSiteSetting` 캐시, 9.11에서 구현)

- [ ] Task 3: 프런트 (AC: #1~#5)
  - [ ] `apps/admin/app/settings/page.tsx` UPDATE (현재 파일 완독 필수 — 이미 더미 4탭 구조 있음)
  - [ ] Server Component에서 `GET /api/v1/admin/settings` 호출 → 각 탭 패널의 `defaultValue`를 실제 DB값으로 교체
  - [ ] `apps/admin/app/settings/_components/SettingsTabPanels.tsx` UPDATE (완독 필수)
  - [ ] 탭별 저장 버튼 → `PATCH /api/v1/admin/settings` 호출 → 성공 토스트
  - [ ] 신고 탭 `auto_hide_enabled` 토글: 저장 시 `auto_hide_threshold`와 함께 전송
  - [ ] 신고 탭 금칙어 목록: 태그 추가/삭제 → 저장 시 `forbidden_words` 배열로 전송
  - [ ] AdminShell에서 `staff` 역할이면 Settings 메뉴 숨김 처리 (9.3에서 nav 역할 필터링 미완이면 여기서 추가)
  - [ ] `apps/web/app/layout.tsx` UPDATE: 메타데이터 생성 시 `getSiteSetting` 서버 호출로 `site_name`·`seo_title`·`seo_description` 동적 로드

## Dev Notes

### 의존성
- **9.11 완료 필수**: `site_settings` 테이블, `getSiteSetting()` 캐시 유틸
- **9.3 완료**: `requireSuperAdmin`, AdminShell 역할 기반 nav 필터

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/settings/page.tsx` (UPDATE): 이미 4탭(기본/콘텐츠/파일/신고) 구조 더미 구현 완료. 저장 버튼은 더미. 각 탭 패널에 `defaultValue` 하드코딩.
- `apps/admin/app/settings/_components/SettingsTabPanels.tsx` (UPDATE): 탭 전환 클라이언트 컨트롤러. 패널 show/hide 담당.

### PATCH 업데이트 방식
```ts
// PATCH body: 변경된 설정 키만 전달
// { "auto_hide_enabled": true, "auto_hide_threshold": 5 }
// 서버에서 각 키를 site_settings UPSERT
for (const [key, value] of Object.entries(body)) {
  await db.insert(siteSettings).values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: now } });
}
// 캐시 무효화
await redis.del(`site_settings:${key}`);
```

### web layout.tsx 반영 패턴
```ts
// apps/web/app/layout.tsx
export async function generateMetadata() {
  const siteName = await getSiteSetting('site_name') ?? 'AI작당';
  const description = await getSiteSetting('seo_description') ?? '바이브코딩·AI 자동화...';
  return { title: siteName, description };
}
```

### 위험도별 확인 — 설정 저장
- 설정 저장은 전체적으로 "즉시+토스트" (reversible, 언제든 다시 저장 가능)
- 예외: `auto_hide_enabled=true` 변경 시 경고 배너 표시(이미 마크업에 `.alert-warning` 존재)

### Project Structure Notes
- UPDATE: `apps/admin/app/settings/page.tsx`, `apps/admin/app/settings/_components/SettingsTabPanels.tsx`, `apps/web/app/layout.tsx`
- NEW: `packages/contracts/src/admin/settings.ts`, `apps/api/src/routes/admin/settings/`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2989-3011] — AC 원문
- [Source: apps/admin/app/settings/page.tsx] — 현재 더미 4탭 구조
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Role & Permission Matrix] — staff 접근 금지

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
