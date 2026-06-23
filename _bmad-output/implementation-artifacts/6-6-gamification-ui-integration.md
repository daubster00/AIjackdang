# Story 6.6: 게이미피케이션 UI 통합

Status: ready-for-dev

## Story

As a 회원·방문자,
I want 등급·뱃지가 이름 옆·프로필·목록 작성자 메타에 일관 노출되고 마이페이지에서 현황을 보기를,
so that 게이미피케이션이 서비스 전반에 자연스럽게 녹아든다.

## Acceptance Criteria

1. `GET /api/v1/gamification/me` (로그인 필요) 응답:
   - `{ totalPoints, grade: { level, name }, nextGrade: { level, name } | null, pointsToNext: number | null, badges: [{ badgeSlug, badgeName, iconUrl, grantedAt }] }`
   - Zod `gradeSchema` + `userBadgesResponseSchema` 통합 검증

2. 마이페이지(`/mypage`) 로그인 진입 시:
   - 사이드바에 등급명·레벨 아이콘(`RankBadge`) + 누적 포인트(소형·비강조) + 잔여 포인트 표시
   - 포인트 숫자 폰트 크기는 등급명보다 작고, `var(--color-text-tertiary)` 색상 사용 (비강조)
   - 다음 등급 잔여: `{잔여} P 남았어요` 또는 `최고 등급 달성` 텍스트

3. `/mypage` 뱃지 탭 접근 시 (6.4 구현 완료):
   - 보유 뱃지 카드 그리드 렌더 (아이콘 + 뱃지명 + 수여일)
   - 0개면 `EmptyState` (원인 + "활동하면 자동으로 수여됩니다" 안내)

4. 공개 프로필(`/u/[nickname]`) SSR:
   - 닉네임 옆 `RankBadge` (등급명 + 레벨 배지, showLabel=true)
   - 보유 뱃지 아이콘 row (비회원 열람)
   - `aria-label="등급: 실전러"` 적용 (색 단독 전달 금지)

5. 게시글 목록(`/posts`, `/questions`, `/resources` 등) 및 상세 페이지의 작성자 메타에 등급 레벨 배지 동반:
   - `<AuthorName>` 컴포넌트 또는 작성자 메타 영역에 `RankBadge` 추가 (showLabel=false, size=16)
   - Lv1 새내기도 빈 공간 없이 자연스럽게 배치 (Lv1용 뱃지 이미지 존재 확인)
   - 등급 배지는 닉네임 오른쪽에 inline 배치

6. 게이미피케이션 전면화 거부 원칙:
   - 어느 페이지에도 포인트 리더보드(`"N포인트 획득!"` 팝업·플로팅 알림) 미존재
   - 포인트 숫자는 `/mypage` 사이드바에서만 소형 노출
   - 뱃지 수여 팝업 미존재 (인앱 알림 채널은 Epic 7에서 별도 처리)

7. 모바일(<768px) 작성자 메타:
   - 등급 배지가 닉네임과 자연스럽게 배치 (겹침·잘림 없음)
   - 배지가 닉네임 오른쪽 또는 아래 줄 (반응형 `flex-wrap: wrap` 허용)

8. 등급·뱃지 icon-only 접근성:
   - `RankBadge` 모든 사용처에 `aria-label="등급: {등급명}"` 명시
   - 뱃지 아이콘 img에 `alt="{뱃지명}"` 필수

9. `pnpm typecheck && pnpm lint` 완료 후 web·api·worker·core·contracts 전 패키지 타입·lint 오류 0.

## Tasks / Subtasks

- [ ] Task 1: `GET /api/v1/gamification/me` 응답 통합 (AC: #1)
  - [ ] `apps/api/src/routes/v1/gamification/gamification.routes.ts` UPDATE (6.3 파일 수정)
  - [ ] 기존 `GET /api/v1/gamification/me` 응답에 `badges` 필드 추가: `getUserGrade(db, userId)` + `getUserBadges(db, userId)` 병렬 호출
  - [ ] 통합 응답 Zod 스키마: `packages/contracts/src/gamification.ts`에 `meResponseSchema` 추가 (grade + badges 통합)

- [ ] Task 2: 마이페이지 등급 사이드바 폴리싱 (AC: #2)
  - [ ] `apps/web/app/mypage/page.tsx` UPDATE
  - [ ] 현재 `profileExtra.points` 하드코딩 → `GET /api/v1/gamification/me` API 응답으로 교체 (6.3에서 시작한 작업 완성)
  - [ ] `totalPoints` 표시: 등급명 아래 소형 텍스트 `{totalPoints.toLocaleString()} P` — `var(--color-text-tertiary)`, font-size `var(--text-sm)`
  - [ ] `pointsToNext` 표시: `{pointsToNext.toLocaleString()} P 남았어요` 또는 `최고 등급 달성 🎉`
  - [ ] 진행률 progressbar: `(totalPoints - currentGrade.minPoints) / (nextGrade.minPoints - currentGrade.minPoints) * 100` 계산
  - [ ] progressbar `aria-valuenow`, `aria-label` 유지 (기존 코드 보존)
  - [ ] **보존**: 기존 tabBar, activityList, followList, stats grid UI 계약

- [ ] Task 3: 공개 프로필 등급·뱃지 완성 (AC: #4)
  - [ ] `apps/web/app/u/[nickname]/page.tsx` UPDATE (6.3~6.4에서 시작한 작업 완성)
  - [ ] RankBadge에 `aria-label={`등급: ${gradeName}`}` prop 확인·추가
  - [ ] 보유 뱃지 row 위치: 외부 링크 row 아래, 가입일 위 (디자인 자연스러운 위치)
  - [ ] 뱃지 아이콘: `<img src={iconUrl} alt={badgeName} width={20} height={20} />`
  - [ ] 0개면 뱃지 row 미렌더 (EmptyState 불필요 — 공개 프로필에서 미보유는 숨김)
  - [ ] JSON-LD ProfilePage 스크립트 유지

- [ ] Task 4: 게시글 목록·상세 작성자 메타 등급 배지 통합 (AC: #5, #7)
  - [ ] 현재 작성자 메타 구현 파악: 각 게시판 목록/상세 페이지의 작성자 표시 컴포넌트 확인
  - [ ] `apps/web/components/ui/AuthorName/` 컴포넌트 확인 (index.ts 존재 확인됨)
  - [ ] `AuthorName` 컴포넌트를 직접 읽어 현재 구조 파악 후 `RankBadge` 통합 방식 결정
  - [ ] `AuthorName` 컴포넌트에 `gradeLevel?: number` prop 추가 (선택 — 없으면 배지 미렌더)
  - [ ] 또는 작성자 API 응답에 `gradeLevel` 필드 포함시켜 각 페이지에서 RankBadge 직접 렌더
  - [ ] 목록 API 응답에 `author.gradeLevel` 추가: `packages/contracts`의 `postListItemSchema` 등 UPDATE
  - [ ] CSS: 닉네임 옆 RankBadge inline 배치 — `display: flex; align-items: center; gap: var(--space-1)` 패턴
  - [ ] 모바일(<768px): `flex-wrap: wrap` 허용, 배지가 2번째 줄로 내려가도 OK
  - [ ] Lv1(`rookie`) `RankBadge` 확인: `public/badges/rookie.png` 이미지 존재 필수

- [ ] Task 5: 게이미피케이션 전면화 거부 확인 (AC: #6)
  - [ ] 전체 코드에서 `"N포인트 획득"` 패턴 텍스트 미존재 확인 (grep)
  - [ ] 포인트 리더보드 엔드포인트 미노출 확인
  - [ ] 포인트 숫자가 마이페이지 외 페이지에서 노출되는 곳 없는지 확인

- [ ] Task 6: RankBadge 접근성 강화 (AC: #8)
  - [ ] `apps/web/components/ui/RankBadge/` 폴더 완독
  - [ ] `aria-label` prop 지원 여부 확인
  - [ ] 없으면 컴포넌트에 `aria-label` prop 추가: `aria-label={ariaLabel ?? `등급: ${rank.label}`}`
  - [ ] 모든 사용처(mypage, u/[nickname], 목록·상세 작성자 메타)에 적절한 aria-label 전달 확인

- [ ] Task 7: 전체 타입 검사 (AC: #9)
  - [ ] `pnpm typecheck` 실행 — 오류 0 확인
  - [ ] `pnpm lint` 실행 — 오류 0 확인
  - [ ] 특히 `packages/contracts`의 gamification 스키마 변경이 api·web 양쪽에 정합한지 확인

## Dev Notes

### 기존 파일 상태 및 변경 내용

**`apps/web/components/ui/AuthorName/index.ts` (UPDATE 또는 확인)**
- 현재 `index.ts`만 확인됨, 실제 컴포넌트 파일(`AuthorName.tsx`) 완독 필수
- 현재 컴포넌트가 쪽지/팔로우/계정바로가기 메뉴 + 등급뱃지를 이미 처리하는지 확인 (메모리 참조: "작성자 닉네임은 AuthorName 컴포넌트 — 클릭 시 쪽지/팔로우/계정바로가기 메뉴+등급뱃지")
- 이미 RankBadge를 렌더하고 있다면 gradeLevel 데이터 연결만 추가
- API 응답에 `author.gradeLevel` 미포함 시 추가 (contracts UPDATE)

**`apps/web/app/mypage/page.tsx` (UPDATE — 6.3에서 일부 시작, 이 스토리에서 완성)**
- 현재 사이드바 포인트 표시: `{profileExtra.points.toLocaleString()} P` 하드코딩
- 이 스토리에서: API 응답 `totalPoints` 대입 완성
- 기존 `progressbar` aria 속성 보존 필수 (UX 접근성)
- `profileExtra.nextThreshold` → `nextGrade.minPoints` 교체

### 게이미피케이션 UI 원칙 체크리스트

| 원칙 | 구현 방식 |
|---|---|
| 포인트는 `/mypage` 내부에서만 | 마이페이지 사이드바 소형 텍스트 |
| 포인트 획득 팝업 없음 | `toast()` 호출 없음, 알림은 Epic 7 |
| 등급 배지는 닉네임 옆에 항상 | `RankBadge size=16~22, showLabel=false` (목록) |
| Lv1도 빈 공간 없음 | `public/badges/rookie.png` 존재 확인 필수 |
| 색 단독 전달 금지 | aria-label 항상 동반 |

### API 응답 구조 (meResponseSchema)

```typescript
// packages/contracts/src/gamification.ts
export const meResponseSchema = z.object({
  totalPoints: z.number().int().min(0),
  grade: gradeSchema,                    // { level, name, minPoints }
  nextGrade: gradeSchema.nullable(),
  pointsToNext: z.number().int().min(0).nullable(),
  badges: z.array(userBadgeSchema),      // [{ badgeSlug, badgeName, iconUrl, grantedAt }]
})
export type MeResponse = z.infer<typeof meResponseSchema>
```

### 목록 API 작성자 등급 필드 추가

게시글 목록 API 응답에 `author.gradeLevel` 추가 시:
- `packages/contracts/src/post.ts` 또는 `common.ts`의 `authorSchema` UPDATE (있다면)
- API에서 users JOIN 또는 별도 grade 조회 후 병합
- N+1 방지: 목록 조회 후 `authorIds`로 `inArray` 배치 grade 조회

### 모바일 반응형 (UX-DR-U14)

```css
/* 작성자 메타 영역 */
.authorMeta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;  /* 모바일에서 뱃지가 2번째 줄로 내려가도 OK */
}
```
`breakpoints.css` 변수로 `@media (max-width: var(--breakpoint-tablet))` 사용, 픽셀 하드코딩 금지.

### RankBadge 컴포넌트 파일 위치

```
apps/web/components/ui/RankBadge/
  RankBadge.tsx   ← 완독 필수
  RankBadge.module.css
  index.ts
```
컴포넌트 파일을 완독해 현재 prop 시그니처 확인 후 aria-label prop 누락 시 추가.

### Project Structure Notes

- `apps/web/features/gamification/` (6.5에서 생성) — 이 스토리의 위젯·통합 컴포넌트 위치
- `public/badges/rookie.png` 존재 여부 반드시 확인; 없으면 placeholder 생성 또는 Icon 대체
- 6.3~6.5에서 변경된 API 응답 타입이 web 사용처와 정합한지 TypeScript로 확인

### References

- [Source: epics.md#Story-6.6 L2020~2063]
- [Source: apps/web/app/mypage/page.tsx — 기존 마이페이지 구현 (보존 필수)]
- [Source: apps/web/app/u/[nickname]/page.tsx — 기존 공개 프로필 구현]
- [Source: apps/web/lib/ranks.ts — RANKS/RankTier 매핑]
- [Source: project-context.md#안티패턴 — 색/픽셀/breakpoint 하드코딩 금지]
- [Source: project-context.md#프론트-선구현 — UI 계약 불변, 기존 컴포넌트 완독 필수]
- [Source: MEMORY.md — 등급 뱃지는 lib/ranks + RankBadge 컴포넌트로만, 작성자는 AuthorName 컴포넌트]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
