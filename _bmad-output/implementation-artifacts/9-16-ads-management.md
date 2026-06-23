# Story 9.16: 광고 관리 (최고관리자 전용)

Status: ready-for-dev

## Story

As a 최고관리자(super_admin),
I want 광고 슬롯을 등록·비활성화·삭제하고 성과를 조회하기를,
So that 사이트 수익화 광고를 코드 없이 운영한다.

## Acceptance Criteria

1. 최고관리자가 `/ads` 진입 시 `ad_slots` 목록(광고명·위치·기기·노출기간·활성·클릭수·노출수), `staff`는 메뉴 숨김·직접 접근 403.
2. 신규 등록(광고명·위치·기기·기간·코드) → `ad_slots` 생성·토스트·코드 저장·해당 위치 즉시 렌더.
3. 비활성화 토글 → `ad_slots.is_active = false`, 즉시+토스트(undo), 사이트 즉시 비노출.
4. 삭제 → 모달+사유 확정 → `ad_slots.deleted_at` soft-delete(위험 액션).
5. 성과 조회 → 슬롯 상세 드로어에서 기간별 노출·클릭·CTR(차트+수치 표시, UX-DR-A11).

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 (AC: #1~#5)
  - [ ] `packages/database/src/schema/ads.ts` NEW:
    ```ts
    ad_slots: {
      id uuid PK, name text, placement text, device('all'|'pc'|'mobile'),
      adType('adsense'|'direct_banner'|'text'|'affiliate'|'internal'),
      startDate date(nullable), endDate date(nullable),
      clickUrl text(nullable), code text(nullable), imageUrl text(nullable),
      memo text(nullable), isActive boolean DEFAULT true,
      createdAt, updatedAt, deletedAt(nullable)
    }
    ad_impressions: { id, slotId FK→ad_slots.id, date date, impressions int, clicks int }
    ```
  - [ ] 마이그레이션 실행

- [ ] Task 2: API 라우트 (AC: #1~#5)
  - [ ] `GET /api/v1/admin/ads` — 목록(placement/device/adType/status/q/page/pageSize)
  - [ ] `GET /api/v1/admin/ads/:id` — 상세(성과 집계 포함)
  - [ ] `GET /api/v1/admin/ads/:id/stats` — 기간별 성과(dateFrom/dateTo → ad_impressions 집계)
  - [ ] `POST /api/v1/admin/ads` — 신규 등록(name/placement/device/adType/startDate/endDate/clickUrl/code/memo)
  - [ ] `PATCH /api/v1/admin/ads/:id` — 수정(모든 필드 partial)
  - [ ] `PATCH /api/v1/admin/ads/:id/toggle` — 비활성화 토글(isActive 반전)
  - [ ] `DELETE /api/v1/admin/ads/:id` — soft-delete(note 필수, super_admin만)
  - [ ] `packages/contracts/src/admin/ads.ts` NEW
  - [ ] `requireSuperAdmin` 미들웨어 적용

- [ ] Task 3: 성과 집계 API (AC: #5)
  - [ ] `ad_impressions`는 초기 더미 데이터 시드(7일치 샘플) — 실제 트래킹 연동은 Epic 범위 외
  - [ ] `/stats` 엔드포인트: `GROUP BY date` 집계 → `{ date, impressions, clicks, ctr }[]`

- [ ] Task 4: 프런트 — 광고 목록 (AC: #1~#4)
  - [ ] `apps/admin/app/ads/page.tsx` UPDATE (현재 파일 완독 필수 — 이미 더미 STATS, ADS 배열, adForm 드로어, 필터 패널 있음)
  - [ ] 더미 ADS → 실제 `GET /api/v1/admin/ads` 데이터
  - [ ] 더미 STATS 카드 → `GET /api/v1/admin/ads` 집계값(활성 광고 수 등)
  - [ ] adForm 드로어 → 신규 등록 `POST /api/v1/admin/ads` 연결
  - [ ] 비활성화 토글: 행 메뉴 "중지" 버튼 → `PATCH /api/v1/admin/ads/:id/toggle` + 즉시+토스트(undo: 다시 toggle)
  - [ ] 삭제: 행 메뉴 "삭제" 버튼 → 모달(사유 textarea 필수) 확정 → `DELETE /api/v1/admin/ads/:id`

- [ ] Task 5: 프런트 — 광고 상세·성과 (AC: #5)
  - [ ] `apps/admin/app/ads/[id]/page.tsx` UPDATE(완독 필수) 또는 NEW(기존 없으면)
  - [ ] 슬롯 정보 + 기간 선택(기본 7일) + 성과 차트(날짜별 노출/클릭/CTR 라인 차트)
  - [ ] UX-DR-A11: 차트 없이 수치 테이블로 대체 가능(admin-design-system 차트 컴포넌트 여부 확인)
  - [ ] 수정 버튼 → adForm 드로어 재사용(현재 행의 데이터 pre-fill)

- [ ] Task 6: 사이트 광고 렌더링 연결 (AC: #2, #3)
  - [ ] `apps/web/src/components/ads/AdSlot.tsx` NEW: 슬롯 위치 key를 prop으로 받아 `GET /api/v1/ads/:placement` 조회 → `isActive=true`인 광고 렌더
  - [ ] `GET /api/v1/ads/:placement` 공개 API NEW (admin 아님): 활성 광고 코드/이미지 반환
  - [ ] 비활성화 시 즉시 비노출: `isActive=false`이면 공개 API에서 빈 응답 반환

## Dev Notes

### 의존성
- **9.3 완료**: `requireSuperAdmin`, AdminShell nav staff 숨김
- UX-DR-A11: "성과 데이터 차트가 없어도 수치 테이블로 충분" — admin-design-system에 차트 미존재 시 수치만 표시

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/ads/page.tsx` (UPDATE): STATS 4개, PLACEMENTS 9개, TYPE_BADGE/STATUS_BADGE, ADS 7개 더미 배열 포함. adForm 드로어(이름/유형/위치/기기/기간/상태/URL/이미지/코드/메모) 완성형. 행 링크는 `/ads/{encodeURIComponent(ad.name)}` — ID 기반으로 변경 필요.
- `apps/admin/app/ads/[id]/page.tsx` (확인 필요): 상세 페이지 존재 여부 확인 후 UPDATE 또는 NEW.

### 광고 위치 코드 → 한국어 매핑
기존 `PLACEMENTS` 배열 그대로 사용. DB에는 영문 코드(snake_case) 저장 권장:
```
main_top / main_middle / post_list_top / post_list_middle /
post_detail_top / post_detail_bottom / resource_download / sidebar / mobile_bottom
```

### 비활성화 undo 패턴
```ts
// 즉시 toggle + 토스트 + undo 버튼
const undo = async () => fetch(`PATCH /api/v1/admin/ads/${id}/toggle`);
showToast('광고가 비활성화되었습니다.', { undo });
```

### 소프트 딜리트 (위험 액션)
```ts
// DELETE → soft-delete
UPDATE ad_slots SET deleted_at = NOW() WHERE id = :id;
// 공개 API에서 deleted_at IS NULL 조건으로 자동 제외
```

### 위험도별 확인
| 액션 | 위험도 | 패턴 |
|---|---|---|
| 신규 등록 | 저 | 즉시+토스트 |
| 비활성화 토글 | 저(undo 가능) | 즉시+토스트(undo) |
| 삭제 | 위험 | 모달+사유 필수 |

### Project Structure Notes
- NEW: `packages/database/src/schema/ads.ts`, `apps/api/src/routes/admin/ads/`, `apps/api/src/routes/ads/` (공개 API), `packages/contracts/src/admin/ads.ts`, `apps/web/src/components/ads/AdSlot.tsx`
- UPDATE: `apps/admin/app/ads/page.tsx`, `apps/admin/app/ads/[id]/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L3013-3035] — AC 원문
- [Source: apps/admin/app/ads/page.tsx] — 현재 더미 구조(PLACEMENTS, TYPE_BADGE, adForm 드로어)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#UX-DR-A11] — 성과 차트 대체 허용

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
