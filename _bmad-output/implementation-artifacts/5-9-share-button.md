# Story 5.9: 공유 버튼

Status: ready-for-dev

## Story

As a 사용자(비회원 포함),
I want 상세에서 공유 버튼으로 URL을 복사하기를,
so that 콘텐츠를 쉽게 전달한다.

## Acceptance Criteria

1. 상세 페이지 [공유] 클릭 시 `navigator.clipboard.writeText(URL)` 실행, "링크를 복사했어요" 토스트(3초) 표시.
2. clipboard 미지원 환경에서는 URL 선택·복사 안내 팝오버(fallback) 표시.
3. 모바일에서 `navigator.share` 지원 시 네이티브 공유 시트 표시.
4. [공유] 버튼은 `<button>`·`aria-label="공유"` 적용(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: ReactionBar 공유 동작 업데이트 (AC: #1, #2, #3, #4) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/ReactionBar.tsx` + 나머지 5개 동일 구조 파일
  - [ ] 기존 공유 버튼은 드롭다운(SHARE_OPTIONS)으로 열림. epics AC는 "링크 복사" 단일 동작이 기본.
  - [ ] 동작 우선순위 구현:
    1. 모바일에서 `navigator.share` 지원 시(`if (navigator.share)`) → `navigator.share({ url, title })` 호출
    2. `navigator.clipboard.writeText(url)` 성공 시 → "링크를 복사했어요" 토스트(3초)
    3. clipboard 실패/미지원 시 → URL 입력창 팝오버(fallback) 표시
  - [ ] 기존 드롭다운(SHARE_OPTIONS)은 유지하되, 링크복사(copy) 옵션의 동작에 위 우선순위 로직 통합
  - [ ] 공유 버튼 `<button>`에 `aria-label="공유"` 추가(기존에 없음)
  - [ ] clipboard 미지원 fallback: URL을 value로 가진 `<input readonly>` + "위 URL을 복사하세요" 텍스트를 드롭다운 내 또는 팝오버로 표시
- [ ] Task 2: 토스트 연결 (AC: #1)
  - [ ] 기존 `ToastProvider` 또는 토스트 훅 사용. `copied` state → 3초 후 `false`(이미 구현됨) 동작과 연동.
  - [ ] 성공 시 success 토스트 "링크를 복사했어요" (현재는 드롭다운 내 "복사됐습니다!" 텍스트만 있음 → 토스트로 업그레이드)
- [ ] Task 3: 검증 (AC: #1~4)
  - [ ] `pnpm typecheck` 통과
  - [ ] desktop 환경에서 링크 복사 → 토스트 확인
  - [ ] `aria-label="공유"` 적용 확인

## Dev Notes

- **기존 ReactionBar 공유 동작**: `SHARE_OPTIONS` 배열(카카오/밴드/Facebook/X/링크복사). 드롭다운 open/close. 링크복사 클릭 시 `navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(...) })`. `copied` state로 드롭다운 내 "복사됐습니다!" 텍스트 전환. `aria-expanded` 있음, `aria-label="공유"` 없음.
- **보존해야 할 것**: 드롭다운 구조(SHARE_OPTIONS, shareRef, shareOpen state), 소셜 공유 URL(카카오/밴드/페이스북/트위터), `styles.shareDropdown`·`styles.shareDropdownItem` CSS 클래스 — 레이아웃 변경 금지. 링크 복사 동작만 토스트 업그레이드 + mobile share 분기 추가.
- **navigator.share 분기**: `if (typeof navigator !== 'undefined' && navigator.share)` 체크(SSR 안전). 모바일 한정이므로 PC에서는 기존 드롭다운 유지.
- **clipboard fallback**: `navigator.clipboard` 없거나 `writeText` 거부 시 `.catch()` 핸들러에서 fallback 팝오버 표시.
- **토스트**: 기존 `ToastProvider` 시스템 활용. `useToast()` hook 또는 `toast.success("링크를 복사했어요")` 형태. 3초 자동 사라짐.
- **비회원도 공유 가능**: 인증 불필요, 로그인 게이팅 없음.
- **ShareModal.tsx**: `apps/web/app/vibe-coding/[slug]/ShareModal.tsx` 파일도 존재함. 내용 확인 후 ReactionBar 공유와 중복/충돌 여부 확인. 중복이면 통합 또는 미사용 처리.

### Project Structure Notes

```
apps/
  web/app/
    vibe-coding/[slug]/ReactionBar.tsx     ← UPDATE (공유 navigator 분기, aria-label, 토스트)
    automation/[slug]/ReactionBar.tsx      ← UPDATE
    monetize/[slug]/ReactionBar.tsx        ← UPDATE
    lounge/[slug]/ReactionBar.tsx          ← UPDATE
    lounge/products/[slug]/ReactionBar.tsx ← UPDATE
    lounge/talk/[slug]/ReactionBar.tsx     ← UPDATE
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.9 AC]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 토스트]
- [UX-DR-U13: 버튼 접근성 — aria-label, button 요소]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
