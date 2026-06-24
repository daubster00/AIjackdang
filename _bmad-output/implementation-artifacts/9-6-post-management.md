# Story 9.6: 게시글 관리

Status: done

## Story

As a 관리자,
I want 게시글을 목록/필터로 조회하고 공지·고정·추천·메인노출·숨김·삭제·복구·SEO 메타 보정을 처리하기를,
So that 콘텐츠 품질·구조를 사후 운영한다.

## Acceptance Criteria

1. `/posts` 진입 시 posts 테이블(제목·게시판·작성자·작성일·조회수·댓글수·좋아요수·신고수·상태·플래그) 렌더. 필터(게시판·상태·공지·추천·메인노출·기간·신고여부) URL 파라미터 반영. 페이지네이션.
2. 공지·고정·추천·메인노출 토글: **즉시 실행 + 토스트(undo 버튼 포함)**, 모달 없음(UX-DR-A4 저위험 액션).
3. 숨김 처리: `status=hidden` soft, 즉시 실행 + 토스트(undo), 유저 사이트에서 비노출.
4. 삭제(최고관리자 전용): 모달+사유 입력 확정 → `status=deleted`, `deleted_at` soft-delete, 목록 제외. 사유 없이 확정 버튼 비활성(UX-DR-A4). `staff`는 숨김까지만, 삭제 UI 숨김 + API 403.
5. deleted 게시글(30일 이내): 삭제됨 필터 선택 시 목록 표시, 복구 버튼 → `status=published`, `deleted_at=null`, 즉시 + 토스트.
6. SEO 메타 수정(FR-10.4): 게시글 상세 드로어에서 `seo_title`·`seo_description` 보정 후 저장 → `posts` 업데이트, 페이지 메타 반영.
7. 다중 선택 후 벌크 숨김/삭제: 숨김은 즉시+토스트(undo), 삭제는 모달+사유 필수.

## Tasks / Subtasks

- [x] Task 1: API 라우트 (AC: #1~#7)
  - [x] `GET /api/v1/admin/posts` — 목록(board/status/isNotice/isPinned/isFeatured/isMainFeatured/dateFrom/dateTo/hasReports/page/pageSize/q)
  - [x] `PATCH /api/v1/admin/posts/:id/flags` — 플래그 토글(isNotice/isPinned/isFeatured/isMainFeatured) 즉시 갱신
  - [x] `PATCH /api/v1/admin/posts/:id/hide` — 숨김(status=hidden)
  - [x] `PATCH /api/v1/admin/posts/:id/restore` — 복구(status=published, deleted_at=null)
  - [x] `DELETE /api/v1/admin/posts/:id` — soft-delete(status=deleted, deleted_at=now()) — super_admin만
  - [x] `PATCH /api/v1/admin/posts/:id/seo` — SEO 메타(seo_title, seo_description) 갱신
  - [x] `POST /api/v1/admin/posts/bulk` — 벌크 액션(ids[], action: 'hide'|'delete', note? 필수for delete)
  - [x] `packages/contracts/src/admin/posts.ts` 완성: 요청/응답 Zod 스키마+타입 (hasReports 추가, reportCount/commentCount/likeCount 응답 추가)
  - [x] `requireSuperAdmin` preHandler: DELETE 라우트에만 적용, bulk delete는 라우트 내 role 체크

- [x] Task 2: 서비스 레이어 (AC: #2~#7)
  - [x] `apps/api/src/routes/admin/posts/service.ts` 완성
  - [x] 플래그 토글: 단일 컬럼 UPDATE (트랜잭션 불필요)
  - [x] 숨김/삭제/복구: status + deleted_at UPDATE
  - [x] 벌크: `inArray(posts.id, ids)` WHERE + 일괄 UPDATE (N+1 금지)
  - [x] SEO 메타: seoTitle/seoDescription UPDATE
  - [x] 목록에 신고수/댓글수/좋아요수 서브쿼리 포함, hasReports 필터 서브쿼리

- [x] Task 3: 프런트 — 게시글 목록 페이지 (AC: #1)
  - [x] `apps/admin/app/posts/page.tsx` 실 API 연동
  - [x] 필터 패널: 게시판/상태/속성/기간/신고여부 필터, URL 쿼리 동기화
  - [x] 페이지네이션 컴포넌트

- [x] Task 4: 프런트 — 게시판별 서브페이지 (AC: #1)
  - [x] `apps/admin/app/posts/[board]/page.tsx` 실 API 연동, board 파라미터 필터 고정

- [x] Task 5: 프런트 — 플래그 토글 + 숨김/삭제 (AC: #2, #3, #4)
  - [x] 행 액션 메뉴: 공지/고정/추천/메인노출 토글 → 즉시 API 호출 + success 토스트
  - [x] 숨김 버튼 → API 호출 + 토스트
  - [x] 삭제 버튼: isSuperAdmin=false이면 렌더 안 함, super_admin만 표시 → 모달(사유 textarea 필수)

- [x] Task 6: 프런트 — 삭제됨 필터·복구 (AC: #5)
  - [x] 상태 필터에 "삭제됨" 옵션 있음
  - [x] 삭제됨 행에 "복구" 버튼 표시 → `PATCH /restore`

- [x] Task 7: 프런트 — SEO 메타 드로어 (AC: #6)
  - [x] 행 액션 메뉴에 "SEO 수정" 버튼 추가
  - [x] SeoDrawer 슬라이드인 — seoTitle(최대 60자)·seoDescription(최대 160자) 입력 + 저장 버튼

- [x] Task 8: 프런트 — 벌크 액션 (AC: #7)
  - [x] 체크박스 선택 + 툴바 "일괄 숨김" / "일괄 삭제" 버튼
  - [x] 일괄 숨김: 즉시+토스트
  - [x] 일괄 삭제: BulkDeleteModal+사유 필수(super_admin만 버튼 표시)

## Dev Notes

### 의존성
- **Epic 2 완료 필요**: `posts` 테이블에 `status`(enum), `deleted_at`, `is_notice`, `is_sticky`, `is_featured`, `is_main_featured`, `seo_title`, `seo_description` 컬럼 존재 필요. 없으면 마이그레이션 추가.
- **9.3 완료**: 인증 게이트, `requireSuperAdmin`

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/posts/page.tsx` (UPDATE): 게시글 관리 목록 더미 페이지 확인.
- `apps/admin/app/posts/[board]/page.tsx` (UPDATE): 게시판별 서브페이지 확인.
- `apps/admin/app/posts/[board]/[id]/page.tsx` (UPDATE): 게시글 상세 확인.
- `apps/admin/app/posts/_components/PostForm.tsx` (UPDATE or 참조): 기존 PostForm 컴포넌트 확인.

### 위험도별 확인 UX
| 액션 | 위험도 | 확인 패턴 |
|---|---|---|
| 공지/고정/추천/메인노출 토글 | 저 | 즉시+토스트(undo) |
| 숨김 | 저(되돌릴 수 있음) | 즉시+토스트(undo) |
| 삭제(soft) | 위험 | 모달+사유 필수 |
| 벌크 숨김 | 저 | 즉시+토스트 |
| 벌크 삭제 | 위험 | 모달+사유 필수 |

### soft-delete 패턴
```ts
// 삭제
UPDATE posts SET status='deleted', deleted_at=NOW() WHERE id=:id
// 복구
UPDATE posts SET status='published', deleted_at=NULL WHERE id=:id AND deleted_at > NOW()-interval '30 days'
```

### posts 테이블 flag 컬럼 (Epic 2 스키마 기준으로 확인 필요)
- `is_notice`: boolean
- `is_sticky`: boolean  
- `is_featured`: boolean (추천)
- `is_main_featured`: boolean (메인 노출)
- `seo_title`: text nullable
- `seo_description`: text nullable

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/posts/`, `packages/contracts/src/admin/posts.ts`
- UPDATE: `apps/admin/app/posts/page.tsx`, `apps/admin/app/posts/[board]/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2725-2759] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Permissions & Destructive Actions] — 위험도별 확인

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- contracts의 adminPostItemSchema에 reportCount/commentCount/likeCount 필드 추가(서비스 서브쿼리 연동)
- adminPostsQuerySchema에 hasReports 필터 추가(미구현 상태였음)
- service.ts의 `reports` import를 sql raw query로 대체(linter가 자동 정리)
- posts/index.ts에서 미사용 adminPostsHideSchema import 제거(TS6133 해소)
- [board]/page.tsx에서 window.confirm 대신 BulkDeleteModal 적용, SEO 드로어 추가
- 테스트의 UUID 형식 수정(00000000-... → 550e8400-... 패턴)

### Completion Notes List
- contracts stub → 완전 구현(hasReports 추가, reportCount/commentCount/likeCount 응답 추가)
- API 라우트 7개 + 서비스 레이어: 목록/플래그토글/숨김/복구/삭제/SEO/벌크 모두 구현
- DELETE 라우트에만 requireSuperAdmin preHandler 적용. bulk delete는 라우트 내 role 체크로 403
- 프론트 posts/page.tsx, posts/[board]/page.tsx: 더미 → 실 API 연동 + SEO 드로어 + BulkDeleteModal
- vitest 27개 통과(계약 스키마, soft-delete 패턴, staff DELETE 403 시뮬레이션)
- 공유 파일 4개(index.ts×2, admin/index.ts, v1/index.ts), posts.ts 스키마, 마이그레이션 건드리지 않음

### File List
- packages/contracts/src/admin/posts.ts (수정: hasReports, reportCount/commentCount/likeCount 추가)
- apps/api/src/routes/admin/posts/index.ts (수정: adminPostsHideSchema 미사용 import 제거)
- apps/api/src/routes/admin/posts/service.ts (수정: hasReports 필터, 신고/댓글/좋아요 서브쿼리 추가)
- apps/api/src/routes/admin/__tests__/posts.service.test.ts (신규: 27개 테스트)
- apps/admin/app/posts/page.tsx (수정: SEO 드로어, BulkDeleteModal, 벌크삭제 window.confirm 제거)
- apps/admin/app/posts/[board]/page.tsx (수정: SEO 드로어, BulkDeleteModal, 벌크삭제 window.confirm 제거)
- _bmad-output/implementation-artifacts/9-6-post-management.md (스토리 완료 처리)
