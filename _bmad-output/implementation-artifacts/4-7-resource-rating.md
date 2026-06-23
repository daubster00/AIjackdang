# Story 4.7: 평점 (1~5 등록·수정·집계)

Status: ready-for-dev

## Story

As a 회원,
I want 자료에 1~5점 평점을 남기고 수정하기를,
So that 내 경험을 공유하고 다음 사용자의 신뢰 판단을 돕는다(FR-4.7).

## Acceptance Criteria

1. 비회원이 평점 영역 조회 시 `avg_rating`·`rating_count` 표시, 별점 입력 UI는 "로그인 후 평점" 비활성 상태, 클릭 시 로그인 유도 모달(UX-DR-U1).
2. 회원이 별점(1~5) 클릭 시 `POST /api/v1/resources/{id}/ratings`(unique upsert) → `ratings` 테이블 upsert, `resources.avg_rating`·`rating_count` 재계산·갱신. 서비스 트랜잭션(AR-2).
3. 회원이 상세 진입(로그인) 시 `GET /api/v1/resources/{id}/ratings/me`로 기존 평점 조회 → 별점 UI에 현재 값 채움.
4. 동일 회원 재평점(두 번째 제출) 시 upsert로 갱신(409 없음).
5. 본인 자료에 평점 시도 시 403 `SELF_RATING_NOT_ALLOWED`(어뷰징 방지, AR-12).
6. 평점 등록·수정 후 화면의 `avg_rating`·`rating_count`가 즉시 갱신된다(낙관적 업데이트 또는 API 응답 값으로 교체).

## Tasks / Subtasks

- [ ] Task 1: 평점 API 구현 (AC: #2, #3, #4, #5)
  - [ ] `apps/api/src/routes/v1/resources/resource.route.ts` UPDATE: 평점 라우트 추가
    - `POST /api/v1/resources/:id/ratings` — 평점 등록/수정(upsert)
    - `GET /api/v1/resources/:id/ratings/me` — 현재 로그인 회원 기존 평점 조회
  - [ ] `apps/api/src/routes/v1/resources/resource.service.ts` UPDATE: 평점 service 함수
    - `upsertRating(resourceId: string, userId: string, score: number)`:
      1. `resource` 조회(없으면 404)
      2. 본인 자료 확인: `resource.userId === userId` → 403 `SELF_RATING_NOT_ALLOWED`
      3. `db.transaction()` 내:
         a. `ratings` upsert: `INSERT INTO ratings (...) ON CONFLICT (resource_id, user_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`
         b. `resources.avg_rating`, `resources.rating_count` 재계산:
            ```sql
            UPDATE resources SET
              avg_rating = (SELECT AVG(score)::numeric(3,2) FROM ratings WHERE resource_id = $1),
              rating_count = (SELECT COUNT(*) FROM ratings WHERE resource_id = $1)
            WHERE id = $1
            ```
      4. 갱신된 `avg_rating`, `rating_count` 반환
    - `getMyRating(resourceId: string, userId: string)`:
      1. `ratings` where `resource_id=resourceId AND user_id=userId` 조회
      2. 없으면 null 반환 (404 아님)
  - [ ] Drizzle upsert 패턴 (Drizzle 0.38.x):
    ```typescript
    await db.insert(ratings).values({ resourceId, userId, score })
      .onConflictDoUpdate({
        target: [ratings.resourceId, ratings.userId],
        set: { score, updatedAt: new Date() },
      });
    ```
  - [ ] contracts UPDATE: 평점 API 응답 스키마(이미 4.1에서 정의됨 — `ratingResponseSchema` 재사용 확인)

- [ ] Task 2: 평점 입력 UI 구현 (AC: #1, #3, #6)
  - [ ] **기존 코드 완독**: `apps/web/app/resources/prompts/[slug]/page.tsx` 의 `reviewSection` 및 `reviewSummary` 부분 확인
  - [ ] 현재 UI 계약(기존 코드 기준):
    - `reviewSummary` div: `reviewScore`(숫자 + 별 + 후기수) + `reviewWriteBtn`("후기 작성" 버튼)
    - 이 스토리에서 "후기 작성" 버튼 → 별점 입력 UI로 교체(또는 추가)
    - `reviewList`: 후기 목록 — Epic 5 슬롯이므로 현재는 유지
  - [ ] `apps/web/components/ui/RatingInput/` 신규 생성 (NEW) — 재사용 가능한 별점 입력 컴포넌트
    - `RatingInput.tsx`: `value`(현재 점수, 0=미선택), `onChange`, `disabled`, `readOnly` props
    - 별 5개: `hover` 시 미리보기, `click` 시 확정
    - `aria-label`: "1점부터 5점 중 {n}점 선택" 패턴
    - disabled 상태: 색상 약화 + 클릭 차단 (color-only 금지 → 아이콘·텍스트 동반)
    - `RatingInput.module.css`, `index.ts` 포함
    - `apps/web/components/ui/index.ts` UPDATE: `RatingInput` re-export
  - [ ] `apps/web/app/resources/[slug]/ResourceDetailClient.tsx` UPDATE (4.3에서 생성):
    - 평점 섹션 로직:
      1. 마운트 시 `GET /api/v1/resources/${id}/ratings/me` → `myRating` 상태
      2. `RatingInput` 렌더: 비회원=disabled + "로그인 후 평점 등록" 안내 텍스트, 회원=활성
      3. 비회원 클릭 시 로그인 유도 모달
      4. 별점 클릭 → `POST /api/v1/resources/${id}/ratings` 호출
      5. 성공: 응답의 `avg_rating`, `rating_count`로 화면 갱신 + "평점이 등록되었습니다." 토스트
      6. 오류: danger 토스트
    - `avgRating`, `ratingCount` state: 초기값은 SSR 데이터, 평점 후 응답으로 교체(낙관적 업데이트)

- [ ] Task 3: 타입체크
  - [ ] `pnpm typecheck` 통과

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**`apps/web/app/resources/prompts/[slug]/page.tsx` reviewSection 현재 상태:**
```tsx
<section className={`${styles.sectionCard} ${styles.reviewSection}`} aria-labelledby="review-title">
  <div className={styles.reviewSummary}>
    <div className={styles.reviewScore}>
      <strong>{resource.rating.toFixed(1)}</strong>
      <RatingStars rating={resource.rating} className={styles.reviewScoreStars} />
      <span className={styles.reviewScoreCount}>후기 {reviewCount}개</span>
    </div>
    <button type="button" className={styles.reviewWriteBtn}>
      <Icon name="quill-pen-line" />
      후기 작성
    </button>
  </div>
  ...
```
**보존 필수**: `reviewSummary`, `reviewScore`, `reviewScoreCount` 클래스·구조. "후기 작성" 버튼은 Epic 5(댓글)에서 활성화 — 이 스토리에서는 별점 입력 UI를 `reviewSummary` 아래 별도 추가하거나 인라인으로 통합.

### Drizzle avg_rating 재계산 패턴

```typescript
// 트랜잭션 내 서브쿼리 재계산
const [updated] = await db.update(resources)
  .set({
    avgRating: sql`(SELECT AVG(score)::numeric(3,2) FROM ${ratings} WHERE resource_id = ${resourceId})`,
    ratingCount: sql`(SELECT COUNT(*)::int FROM ${ratings} WHERE resource_id = ${resourceId})`,
    updatedAt: new Date(),
  })
  .where(eq(resources.id, resourceId))
  .returning({ avgRating: resources.avgRating, ratingCount: resources.ratingCount });
return updated;
```

### 아키텍처 가드레일

- **트랜잭션 (AR-2)**: `ratings` upsert + `resources` avg/count 업데이트를 하나의 `db.transaction()` 내에서 실행.
- **어뷰징 방지 (AR-12)**: 본인 자료 평점 불가. service 레이어에서 `resource.userId === userId` 체크.
- **upsert (유니크 제약)**: 4.1 스키마에서 `UNIQUE(resource_id, user_id)` 정의됨 — Drizzle `onConflictDoUpdate` 사용.
- **비회원 UI**: `disabled` prop으로 RatingInput 렌더, 클릭 시 모달. API 호출 없음.
- **낙관적 업데이트**: 평점 API 성공 응답의 `avg_rating`, `rating_count`로 즉시 UI 갱신(실패 시 이전 값 복원 + danger 토스트).

### 별점 접근성 규칙

```tsx
// 각 별 버튼에 aria-label 필수
<button
  aria-label={`${n}점으로 평점 등록`}
  aria-pressed={value === n}
  disabled={disabled}
/>
// 현재 선택 별점 텍스트도 시각 외로 전달
<span className="sr-only">{value ? `현재 ${value}점 선택됨` : '미선택'}</span>
```

### Project Structure Notes

```
apps/web/components/ui/
├── RatingInput/
│   ├── RatingInput.tsx          ← NEW
│   ├── RatingInput.module.css   ← NEW
│   └── index.ts                 ← NEW
└── index.ts                     ← UPDATE: RatingInput re-export

apps/api/src/routes/v1/resources/
├── resource.route.ts  ← UPDATE: 평점 라우트 추가
└── resource.service.ts ← UPDATE: upsertRating, getMyRating
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7] — AC 원문
- [Source: apps/web/app/resources/prompts/[slug]/page.tsx] — reviewSection 현재 구조
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Interaction Primitives] — 접근성 규칙
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — 트랜잭션, 낙관적 업데이트

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
