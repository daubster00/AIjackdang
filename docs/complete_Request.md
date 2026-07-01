> **10차 배치 1건(재검증 신규#1 = 관리회원 등급/역할 변경 모달 `.modal.open` 누락) — 2026-06-30 검수 통과.** 8차 미통과 1건을 4번째 재진단(`overlay.css` 직접 판독)으로 해결.

### 재검증 신규#1(10차 = 8차 미통과 재수정). (관리자) "관리회원 등급/역할 변경 모달이 안 뜸" — 진짜 원인은 디자인시스템 `.modal` 에 `.open` 미부착 → opacity:0
- [x] `Claude`   [x] `검수`
- 수정 : 오류 화면 폴더에 등급변경 에러 이미지 봐봐 뿌옇게 블럭만 생성되고 등급 변경 모달이 안나와. 등급 변경 누르면 아예 아무것도 안나와 모달이 안나와.
- 1차 (6차, 2026-06-29): "상세페이지 실데이터 재작성" 가설 → 미통과.
- 2차 (7차, 2026-06-30): "라이브 E2E로 등급변경 모달 라디오 측정 → 역할 3개 표시, 정상" 결론 + 모달 열 때 역할 재조회·빌트인 역할 코드보장 보강 → **여전히 미통과**.
- 3차 (8차, 2026-06-30): **앞선 2번의 "등급변경 모달" 가설을 전면 폐기.** 사용자가 첨부한 `자료/오류화면/관리회원 등급수정 에러.png`를 **직접 열어 판독** → 실제 에러는 모달이 아니라 **Next.js Console Error: "A tree hydrated but some attributes … didn't match"**, 위치 `app/admin-members/AdminMembersClient.tsx (298:11)` 의 `<div className="line-tabs" role="tablist" aria-label="관리 상태">`, diff = `- data-tabs-initialized="true"`(서버에만 존재). **진짜 원인** = 이 `.line-tabs`(전체/승인대기/활성/정지/비활성 빠른상태 탭)는 **React가 onClick으로 완전 제어**(`data-tab` 속성 없음)인데, `AdminInteractions`의 `MutationObserver`(목록 렌더마다 발화)가 레거시 디자인시스템 `tabs.js`의 `initTabs()`를 재실행 → 이 React 탭 컨테이너에 `data-tabs-initialized="true"`를 주입 → React 트리엔 없는 속성이라 hydration 불일치 + onClick 이중 바인딩까지 유발. → **수정**: `tabs.js`의 `initTabs()`가 **`data-tab`(line-tabs) / `data-range`(segmented) 항목이 없는 그룹은 건너뛰도록** 가드 추가. 레거시 패턴 페이지(`settings`·`members/[id]`·`messages`·차트 segmented = `data-tab`/`data-range` 보유)는 그대로 wire되고, React 제어 탭(`admin-members`·`reports`·`qna`·`comments`)은 더 이상 속성 주입을 받지 않음. → ✅ 마스터 실로그인 Playwright 검수: (1) `/admin-members` 로드 시 `.line-tabs[aria-label="관리 상태"]`의 `data-tabs-initialized` = **null**(이전 `"true"`), **hydration console error 0·pageerror 0**(이전엔 298줄 Console Error 발생). (2) 회귀확인 — `/settings`는 `data-tabs-initialized="true"` 유지, 탭 클릭 시 "기본 설정 → 콘텐츠 설정" 정상 전환, hydration error 0. → ⚠️ 사용자께: 등급변경 모달 자체는 7차에서 이미 정상 확인됨. 이번엔 그 화면(관리회원 목록)에서 콘솔에 뜨던 빨간 hydration 에러를 제거했습니다.
- 4차 (10차, 2026-06-30): **3차의 hydration 가설로도 미통과** — 사용자 재증상 "뿌옇게 블럭만 생기고 모달이 안 나옴, 등급/역할 변경 눌러도 아무것도 안 나옴". **3번 모두(상세 재작성·E2E 라디오측정·hydration)와 다른 경로로 재접근** → 디자인시스템 `overlay.css` 직접 판독. **진짜 원인** = 디자인시스템 `.modal`(`packages/admin-design-system/.../overlay.css:35`)은 기본값이 `opacity:0; pointer-events:none; transform:translate(-50%,-48%)`이고 **`.modal.open` 이 붙어야** `opacity:1`이 됨. 그런데 `AdminMembersClient.tsx`(목록)·`AdminMemberDetailClient.tsx`(상세) 두 React 제어 모달이 `className="modal"`(`.open` 누락) + 인라인 `style={{display:"flex"}}` 만 줬다 → **인라인 `display`는 `opacity:0`/`pointer-events:none`을 못 덮음** → 오버레이(인라인 `display:block`)만 보여 "뿌옇게 블럭", 모달 본체는 opacity 0 으로 투명. (※ 7차 E2E "라디오 3개 정상"은 opacity:0 으로 **시각적으로만 숨겨진** DOM 요소의 속성을 Playwright가 읽은 것 — 시각 가시성을 검증하지 못한 함정.) → **수정**: 두 파일의 오버레이 `className="overlay open"`, 모달 `className="modal open"` 로 교체 + 레이아웃 깨뜨리던 인라인 `display:flex` 제거(`.modal` 기본 `display:block` 으로 header/body/footer 세로 정렬). 배경 흰색 인라인은 유지. (points 페이지 모달은 레거시 `data-admin-open`/overlay.js 가 `.open`을 토글하는 별도 정상 경로라 무손상.) → ✅ 마스터 실로그인 Playwright 검수: `/admin-members` 행 메뉴 → 모달 트리거 클릭 → `section.modal` computed **opacity `1`·pointer-events `auto`·visibility `visible`·display `block`·`.open` 클래스 true·rect 540×399 중앙·제목 렌더**(이전엔 opacity 0 으로 안 보였음), console/pageerror 0. 스크린샷(`scripts/shots/gm-2-role-modal.png`)으로 흰 패널·세로 레이아웃 육안 확인. admin typecheck 통과.

> **9차 배치 3건(신규TODO-49 알림 항목별 읽음 · 신규TODO-50 알림 footer 제거+항목별 바로가기 · 신규TODO-51 Q&A 검색 select removeChild) — 2026-06-30 검수 통과.**

### 신규TODO-51(9차). (관리자) 묻고답하기 검색 select(Q&A상태/콘텐츠 상태) 클릭 시 removeChild 에러
- [x] `Claude`   [x] `검수`
- 1차 (6차, 2026-06-29): "Google 번역 확장 충돌" 가설 → admin 레이아웃 `translate="no"`/`notranslate` → 미통과.
- 2차 (9차, 2026-06-30): 번역 가설 폐기. **진짜 원인** = Q&A 필터의 레거시 디자인시스템 select 마크업에 `AdminInteractions` MutationObserver가 레거시 `select.js initSelects()`를 연결 → 옵션 클릭 시 select.js가 React 렌더 체크아이콘을 `.remove()`+`insertAdjacentHTML` → 동시 발화한 React onClick 재렌더가 이미 떼어진 노드를 `removeChild`하다 NotFoundError. 같은 패턴이 admin 7페이지(qna·comments·inquiries·messages·posts·posts/[board]·resources)에 잠복. → **수정**: `select.js initSelects(root,{reactSafe})` 추가 — 메뉴 열기/닫기만 연결, DOM 내용 변형(.selected·체크아이콘·라벨·admin:select-change) 전부 skip(React 담당). `AdminInteractions`가 `{reactSafe:true}` 호출, 순수 HTML 데모는 옵션 없이 호출해 무손상. → ✅ 마스터 실로그인 Playwright: `/qna` 두 select 옵션 클릭 → URL 갱신·removeChild/console error 0건.

### 신규TODO-49(9차). (관리자) 알림 항목 하나만 확인해도 전부 읽음 처리됨
- [x] `Claude`   [x] `검수`
- 1차 (9차, 2026-06-30): **원인** = `NotificationMenu`가 읽음 상태를 단일 시그니처로 관리 → 항목 하나 클릭 시 `acknowledgeAll()`이 전체 읽음 처리. → **수정**: id별 맵(`{reports,inquiries,qna}` 확인 시점 카운트)으로 전환(localStorage `aj_admin_alerts_ack_v2`), `acknowledgeOne(id)`로 단일 항목만 읽음 + 각 항목 "읽음" 버튼. → ✅ Playwright: 읽음 버튼 1개 클릭 → 미읽음 1건만 남고 벨 배지 2→1.

### 신규TODO-50(9차). (관리자) 알림 하단 "신고 관리 바로가기" 제거 + 항목별 바로가기 버튼
- [x] `Claude`   [x] `검수`
- 1차 (9차, 2026-06-30): 하단 고정 `신고 관리 바로가기` Link 제거. 각 알림 항목을 해당 관리 페이지(신고→/reports·문의→/inquiries·Q&A→/qna)로 가는 `<Link>`로 + 하단 "바로가기 →" 라벨(클릭 시 이동 + 그 항목만 읽음, #49 연동). → ✅ Playwright: footer 제거 확인, 항목별 "바로가기" 버튼 렌더.

> **7차 배치 3건(신규TODO-A 신고대상보기 정적페이지 · 신규TODO-B 숨김 복구 · 재검증 신규#2 removeChild) — 2026-06-30 검수 통과.** (미통과였던 재검증 신규#1은 8차·10차에서 재진단 → 검수 대기.)

### 신규TODO-A(7차). (관리자) 신고관리 상세 "신고 대상 보기" 클릭 시 이동 페이지가 정적(더미)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-30): **진짜 원인 = 관리자 게시글 상세(`/posts/[board]/[id]/page.tsx`)가 100% 더미 상수**(`POST`/`COMMENTS` 하드코딩, URL `id` 무시). → 실데이터 클라이언트 컴포넌트로 재작성(`GET /api/v1/admin/posts/:id`) + `getPostDetail`에 댓글 조회 추가. → ✅ 마스터 실로그인 Playwright: 신고 "신고 대상 보기" → 실제 글 표시·실제 상태 배지·pageerror 0.

### 신규TODO-B(7차). (관리자) 신고관리에서 숨김 처리 후 다시 되돌릴 수 없음
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-30): **진짜 원인 = 수동 "대상 숨김"이 `reports.status='resolved'`로 바꾸는데 조치버튼 노출조건 `canAct`이 `status!=='resolved'`라 숨김 직후 모든 버튼 소멸 + 복구 버튼은 `autoHidden===true`에만 노출.** → `getReport`에 `targetStatus`(::text) 추가 + `PATCH /admin/reports/:id/unhide`·`unhideTarget` 신설 + `targetStatus==='hidden'`이면 "숨김 해제" 버튼 노출. → ✅ 마스터 실로그인 Playwright: "숨김 해제" 클릭 시 게시글 published 복구·신고 reviewing 전환·pageerror 0.

### 재검증 신규#2(7차 = 6차 removeChild). (관리자) 묻고답하기 removeChild — translate="no" 라이브 차단 확인
- [x] `Claude`   [x] `검수`
- 원인 (2026-06-29): 관리자 `/qna` + 페이지 자동 번역(Google 번역 등) 켜짐 → 번역 확장이 한국어 텍스트 노드를 `<font>`로 바꿔치기 → React 재렌더 시 부모-자식 불일치로 removeChild 크래시(환경 의존, 번역 OFF에선 재현 불가).
- 수정 (2026-06-29~30): admin 루트 레이아웃 `<html lang="ko" translate="no">` + `<body className="notranslate">`로 번역 도구가 admin 앱을 통째로 건너뛰게 함(HTML 표준 translate 속성). → ✅ Playwright 실측: `/qna`의 `document.documentElement.translate==="no"`·body `notranslate` 적용, pageerror 0.

> **6차 배치 1건(신규#3 쪽지 모달 흰배경) — 2026-06-30 검수 통과.**

### 신규#3(6차). (관리자) 쪽지 상세에서 나오는 모든 모달 배경 투명 → 흰색
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): **진짜 원인 = 모달 컨텐츠 div들이 `background: var(--surface)`인데 `--surface` 토큰이 admin 디자인시스템에 정의돼 있지 않아 transparent로 폴백.** (G13·M14에서 공용 Dialog·`.modal`은 흰색화했지만 이 인라인 스타일 모달들은 누락.) → admin 전역에서 `var(--surface)` → `var(--gray-0, #fff)`로 교체(쪽지 list/상세 RestrictModal·DeleteModal 4곳 포함 12개 파일 21곳). → ✅ 마스터 실로그인 Playwright 검수: 쪽지 상세 `발신제한`·`삭제` 모달 모두 computed 배경 `rgb(255,255,255)`.

> **5차 배치 6건(N8+#3·N10+#2·M12 + 신규#1·#2·#3) — 2026-06-29 검수 통과.**

### N8+신규#3. 관리자 목록 탭바 우측 끝 짧은 보라 세로 스크롤바 삭제 (재수정 4차)
- [x] `Claude`   [x] `검수`
- 4차 (2026-06-29): 원인 = `navigation.css .line-tabs{overflow-x:auto}` → overflow-y도 auto 계산 + 활성탭 밑줄 1px 넘침. → `.line-tabs`를 `overflow:visible`(데스크톱), 좁은화면(≤720px)만 `overflow-x:auto;overflow-y:hidden`. → ✅ computed `overflowY:visible`, 보라 스크롤 0.

### N10+신규#2. 관리자 알림 — 구분선 가시성 + 읽음 처리 영속(빨간점·파란색 사라짐)
- [x] `Claude`   [x] `검수`
- 4차 (2026-06-29): 읽음 카운트 조합을 localStorage 시그니처(`aj_admin_alerts_ack`)로 영속, 빨간점 클래스를 `unreadCount>0`일 때만 부착, 구분선 `gray-100`→`gray-200`. 항목 클릭 단건만 읽음 + 전부 읽어야 빨간점 사라짐. → ✅ 새로고침해도 빨간점·파란배경 미복귀.

### M12. 커스텀 관리자 역할 추가/수정/삭제 (재수정 3차 — 실제 기능 구축)
- [x] `Claude`   [x] `검수`
- 3차 (2026-06-29): `admin_role` enum→text + `admin_roles` 테이블(마이그 0025) + `GET/POST/PATCH/DELETE /admin/roles` + `/admin-members/grades` CRUD UI + 권한 매트릭스 동적 컬럼 + 관리회원 역할 드롭다운 동적화. → ✅ 마스터 실로그인 검수: 역할 추가·권한 토글·삭제 동작, API E2E + 17 유닛테스트 통과.

### 신규#1. (관리자) Q&A 질문 상세 답변 박스 개별 구분
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 각 답변을 개별 `article.card`(흰배경·1px 테두리·라운드·그림자)로 분리. → ✅ 답변 2개 분리 카드 렌더.

### 신규#2. (관리자) 알림 확인 후 읽음 처리 안 됨
- [x] `Claude`   [x] `검수`
- → N10+신규#2 4차에 통합 처리(localStorage 읽음 영속 + 빨간점 조건부).

### 신규#3. (관리자) 신고 목록에 조치 버튼이 전혀 없음
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 진짜 원인 = admin React 앱에 디자인시스템 `table.js` 미로드 → 전 목록 kebab 먹통. React 제어 `components/ui/RowActionMenu` 신설, 전 관리자 목록에 적용. → ✅ reports kebab 클릭 시 조치 메뉴 열림.

> **4차 배치 6건(M8·M9·M10·M11+#4·신규#1·신규#5) — 2026-06-29 검수 통과.** 미통과 3건(N8+#3·N10+#2·M12)은 검수 대기에 잔존(사용자 추가 코멘트·신규 TODO).

### M8. (관리자 Q&A) 질문 상세에 답변 본문 직접 표시 (재수정 2차)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): `/qna/[id]` 답변 카드에 contentJson 본문을 펼친 상태로 즉시 렌더(클릭 진입 제거).

### M9. (관리자 Q&A) 답변 클릭 → 답변 상세 뷰 (재수정 2차)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): M8 인라인 본문으로 목록↔상세 차이 명확화 + 항목에 "답변 상세 →" 링크.

### M10. (관리자 Q&A) 삭제 답변 완전 제거 (재수정 2차)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): 백엔드 listAnswers가 `ne(status,'deleted')` 자동 제외 + 프론트 deleted 필터.

### M11+신규#4. (관리자 Q&A) 숨김 삼점 투명도 제거 + 다시보기 (재수정 2차)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): 행 opacity를 컨텐츠 td에만 적용(드롭다운 불투명) + 숨김 항목에 "다시 보이기".

### 신규#1. (유저웹) 1:1 문의 운영진 답변 흰박스 가로 100% + 날짜 박스 안에
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): `.adminBubble` width:100% 전체폭 카드, `<time>`을 박스 안 헤더로 이동.

### 신규#5. 신고관리 목록 삼점 클릭 시 처리 버튼
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): reports 목록 행에 `.action-menu`(처리 액션) 추가, table.js 위임 단일화.

> **3차 배치 12건(N1·N14·N16·M1·M2·M3·M5·M6·M7·M13·M14·M15) — 2026-06-29 검수 통과.** 미통과 7건(N8·N10·M8·M9·M10·M11·M12)은 4차 배치에서 재수정 → 검수 대기.

### N1. (유저웹) 알림 클릭 → 1:1 문의 답글이면 해당 글로 이동 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): NotificationModal.handleNavigate async 전환, inquiry 이동 전 존재확인 → 404면 중단+토스트.

### N14. 포인트 회원검색 입력 자체가 안 됨 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): 히스토리 onSelect 콜백이 타이핑마다 setHistSearch("")로 덮어쓰던 것 → `onSelect={setHistMember}`로 단순화.

### N16. 콘텐츠/파일/신고 설정 + 인기 기준 지표 선택박스 (재검증)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-29): 인기지표 디자인시스템 Select·콘텐츠/파일/신고 설정 탭별 저장 정상 재확인.

### M1. 신고관리 항목 클릭 → 상세페이지 이동 + 처리 버튼
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 행 클릭 → /reports/{id}, "자동 숨김 복구" 상세로 이관, notifyDialog.

### M2. 등급관리 삭제확인·저장 완료 알림을 모달로
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): ranks 인라인 삭제 → confirmDialog, 완료 → notifyDialog, 목록 행 삭제 버튼.

### M3. 관리자 모든 시스템 알림을 모달로
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 공용 lib/dialog.tsx 신설, 전 admin window.confirm/alert·중앙토스트를 모달로 교체.

### M5. (유저웹) 1:1 문의 운영진 답변 별도 박스 + 회색박스 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 외부 흰박스→배경없는 wrapper, adminBubble 회색→흰색 독립 카드.

### M6. (유저웹) 알림 확인 즉시 헤더 미읽음 카운트 감소
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): NotificationCountContext(SSE·카운트 단일관리)를 layout에 마운트, 헤더·페이지 공유.

### M7. (유저웹) 공지 상세 "목록으로"와 댓글 사이 회색 구분선 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 공지 전용 `.footerNoBorder`로 공지에서만 border-top 제거.

### M13. 회원 상세 활동내역 작성글/댓글 클릭 → 상세로 이동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): members API recentPosts/Comments board 추가, 게시글·댓글 → 원본 콘텐츠 상세.

### M14. 관리자 모든 모달 배경 투명 → 흰색
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): 공용 Dialog·자체 모달 배경 `var(--gray-0,#fff)` 명시.

### M15. 관리자 계정 프로필 이미지 수정 적용
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-29): POST /admin/account/upload-image + PATCH /account/me imageUrl, 헤더 아바타 즉시 반영.

> **2차 배치 16건(G4·G5·G16·G17·G23·N2·N3·N4·N5·N6·N7·N9·N11·N12·N13·N15) — 2026-06-29 검수 통과.** 미통과 5건(N1·N8·N10·N14·N16)은 3·4차에서 재수정.

### G4. 대시보드 최근 콘텐츠 클릭 → 상세 이동 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): 상세페이지가 `findBoard(board)` 미스 시 notFound인데 recent-content board가 DB 원본값이라 admin 슬러그와 불일치 → `lib/boards.ts` dbBoardToAdminSlug 역매핑 + 큐레이션 외 board는 폴백 메타 렌더(notFound 제거).

### G5. 모든 유저 프로필 이미지 표시 (재수정 — 한 곳에서 관리)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): 공통 `components/ui/UserAvatar`(resolveAvatarUrl 래핑) 신설·전 관리자 페이지 적용, 백엔드 list/detail API에 avatarUrl·image·defaultAvatarIndex 추가.

### G16. 댓글·후기 관리 상세 → 대상 콘텐츠 "상세"로 이동 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): `getCrossLink`를 목록→상세로 변경, 댓글 API targetBoard 서브쿼리·계약 추가 → post는 게시글 상세, question/answer→/qna, resource→/resources 상세.

### G17. 신고 관리 신고 항목 표시 + 대상 클릭 → 신고당한 회원 상세 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): 진짜 원인 = reportedUserId CASE 서브쿼리가 comments에 없는 user_id를 SELECT(실제 author_id) → 댓글 신고 1건이라도 있으면 500·목록 전멸. author_id로 교정 + 상세에 "신고당한 회원" 링크.

### G23. 등급 추가 — 생성 반영 + 뱃지 이미지 업로드 (재수정)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): "생성 안됨" 원인 = 목록 level<=5 필터가 신규 등급 숨김 → 필터 제거. `grades.image_url`(마이그 0024)·`POST /admin/grades/upload-badge`·new/[tier] 업로드 실연동.

### N2. (유저웹) 1:1 문의 상세를 게시판 상세 디자인과 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `InquiryThread`를 lounge 상세 레이아웃으로 재구성(헤더·본문 TiptapRenderer·목록 푸터), 문의 답변 스레드만 유지.

### N3. 접속통계 조회순 Select 가로폭을 다운로드 버튼에 맞춤
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 정렬 Select를 min-width:140px 컨테이너로 감싸 다운로드 버튼 폭과 정렬.

### N4. 콘텐츠별 성과 게시글 제목 클릭 → 상세 이동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 성과 테이블 제목을 `<Link>`로(post→/posts/{dbBoardToAdminSlug}/{id}·resource→/resources/{id}).

### N5. (유저웹) 공지 상세에서 좋아요/공유/신고/북마크 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `notice/[slug]`의 `<ReactionBar/>` JSX·import 제거, 본문·댓글·메타 유지.

### N6. 첨부파일 통합관리 + 관리자 파일설정 연동 + 관리자 첨부 등록 디자인 유저화
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공통 `components/ui/AttachmentUpload` 신설, admin ResourceForm/PostForm 드롭존 교체·관리자 파일설정에서 확장자/용량 읽음, `POST /admin/posts/attachments` 실업로드.

### N7. 댓글 후기 관리 상세 관련글 → 게시글 상세 이동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): G16과 동일(getCrossLink 상세화 + 댓글 API targetBoard).

### N9. 문의 관리 답변 가로 가득 + 답변 수정/삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 답변 버블 75% 폭·우정렬 제거→전체폭, 각 답변 수정/삭제 버튼 + `PATCH/DELETE /admin/inquiries/:id/replies/:replyId`.

### N11. 등급 상세 뱃지 이미지 수정
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): G23 인프라로 `/ranks/[tier]` 뱃지 업로드 실연동(선택→업로드→미리보기→PATCH 영속).

### N12. 회원상세 연락처 줄 상단 구분선 여백을 하단과 동일하게
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `members/[id]` 상단 borderTop marginTop 0→16·paddingTop 12로 하단 여백과 대칭.

### N13. 회원 상세에 등급 표기
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 상세 헤더 뱃지를 `Lv.{gradeLevel} {gradeName}`로 표기.

### N15. 사이트 설정 파비콘·OG 이미지를 URL 입력 → 이미지 업로드
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): favicon_url·og_image를 파일 업로드+미리보기로 교체, `POST /admin/settings/upload-image` 신설.

> **Epic9 관리자 27건(G1·G2·G3·G6·G7·G8·G9·G10·G11·G12·G13·G14·G15·G18·G19·G20·G21·G22·G24·G25·G26·G27·G28·G29·G30·G31·G32) — 2026-06-26 검수 통과.** 미통과 5건(G4·G5·G16·G17·G23)은 위 검수 대기에서 2차 재수정.

### G1. 대시보드 "게시글 작성" 버튼 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `dashboard/page.tsx` 헤더의 `<Link href="/posts/new">새 게시글</Link>` 제거.

### G2. 관리자 "알림" 기능 먹통 → 실데이터 연동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `NotificationMenu.tsx` 하드코딩 더미·죽은 링크 제거 → 미처리 신고·미답변 문의 실집계, 항목별 실링크, 벨 뱃지=실카운트.

### G3. 리포트 내보내기 CSV → 엑셀(xlsx), 컬럼 겹침 방지
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공유 `lib/xlsx.ts`(exceljs) 신설 — 컬럼별 명시 폭+헤더 볼드/음영, `DashboardExportButton`을 `downloadXlsx`로 교체.

### G6. 접속통계 게시글별 성과 상위10 + 정렬
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): post-performance limit 20→10, `ContentPerformanceTable`에 정렬 Select(조회수/댓글/다운로드순) 클라 정렬.

### G7. 실전자료별 성과를 게시글별 성과에 통합
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 분리됐던 2개 섹션을 "콘텐츠별 성과" 단일 테이블로 병합(유형 컬럼, 결측 —).

### G8. 접속통계 페이지별 머문시간 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): page_views.dwell_ms(0023), PageViewTracker sendBeacon, collect 적재, `GET /admin/analytics/page-dwell-time`+stats UI.

### G9. (유저웹) 공지 상세를 일반 게시글 구성과 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `notice/[slug]/page.tsx`를 라운지 상세 구성과 동일화(BoardHero·메타·본문·댓글). (※ N5에서 ReactionBar는 별도 제거.)

### G10. 게시글 관리 게시판별 페이지가 빈 목록
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = admin URL 슬러그와 DB `posts.board` 불일치. `lib/boards.ts`에 apiBoard 매핑 추가.

### G11. 모든 선택박스 = 디자인 시스템 드롭다운 + 얇은 보라 스크롤
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공유 `components/ui/Select` 신설, admin 전 native `<select>` 교체(폼/필터·등급필터·에디터 글자크기 포털 드롭다운).

### G12. Q&A 관리 답변 상세 "질문을 찾을 수 없음"
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 신규 `GET /admin/qna/questions/:id` 단건 조회 추가, `qna/[id]`가 이를 호출.

### G13. 모든 모달 배경 투명 → 흰색
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공유 `overlay.css` `.modal-backdrop`(어두운 스크림)·`.modal` 불투명 흰배경 보강.

### G14. 실전자료 관리에 글 등록 기능 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `resources/page.tsx` 헤더에 "새 자료 등록"(/resources/new) 버튼 추가.

### G15. 모든 글쓰기 영역에 리치 에디터 삽입
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공유 `features/editor`(Tiptap) 신설, 본문 textarea를 `<Editor preset="full">`로 교체(PostForm·ResourceForm·공지).

### G18. 문의 관리 모달 → 별도 상세 페이지
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 신규 `inquiries/[id]/page.tsx` 생성, 목록 행 클릭을 `/inquiries/[id]` 이동으로 변경.

### G19. 업적 뱃지 개념 전체 삭제 (등급은 유지)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 뱃지 테이블 DROP(0023)+스키마/API/worker/core/contracts 전량 삭제. 등급/RankBadge/lib/ranks 유지.

### G20. 회원 상세 "보유 뱃지" 섹션 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `members/[id]` 보유뱃지 섹션·모달·핸들러·API 라우트 제거.

### G21. 회원 상세 기본정보에 성별·생년월일·마케팅·약관·연락처 2줄 표기
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): API detail에 phone·gender·birthDate·termsAgreedAt·marketingAgreedAt 추가, 기본정보 2줄 그리드.

### G22. 회원 상세 활동내역 탭 분리
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): API에 recentPosts·recentComments·loginSessions 쿼리 추가, 4탭 UI.

### G24. 권한 설정 토글 작동(영속)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `admin_role_permissions`(0023)+`GET/PATCH /admin/permissions`(코드기본값+DB오버라이드 병합), PermissionsMatrix 즉시 저장.

### G25. 포인트 수동 지급/차감 회원검색 자동완성
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `MemberSearchInput`(디바운스→`/admin/members?q=`) 아바타/닉네임/이메일/포인트 드롭다운.

### G26. 포인트 수동 지급/차감 동작
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 모달 폼·핸들러 — 지급 POST·차감 DELETE `/admin/members/:id/points`, 토스트, 내역 새로고침.

### G27. 회원별 포인트 내역 표시
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `GET /admin/members/:id/points-history`(누적잔액), 회원 검색→내역 테이블+페이지네이션.

### G28. 등급 목록에 관리자 등급 미노출
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `ranks/page.tsx` 하드코딩 "운영자" 행 제거(유저 등급만). (※ G23 2차에서 상한 필터는 제거됨.)

### G29. 등급/뱃지 관리에서 뱃지 목록 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `ranks/page.tsx` 뱃지 목록 섹션·모달·"새 뱃지 추가" 제거, 제목 "등급 관리".

### G30. 등급 목록에서 등록된 등급 수정 가능
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 각 등급 행에 "설정"(/ranks/[id], PATCH) 링크+필요 포인트 인라인 편집.

### G31. 사이트 설정 콘텐츠/파일/신고 탭 동작
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 탭 초기화 레이스 → React `activeTab` 상태 기반 패널 전환으로 리팩터, 각 패널 실 필드 바인딩.

### G32. 사이트 설정 기본설정에 파비콘 등록
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 파비콘 필드·`favicon_url` 저장·공개설정 API·유저웹 generateMetadata 연동. (※ N15에서 URL→이미지 업로드로 개선.)

> 관리자 5건(130·131·132·133·134) — 2026-06-26 2차, 검수 통과. 진짜 원인은 **라우트 이중 prefix 404**(curl 격리검증으로는 못 잡고 실 브라우저 Playwright로만 잡힘) + get-session CORS 차단. 교훈: 관리자 검수는 반드시 실 브라우저 로그인 흐름으로.

### 131. 댓글·후기 관리 검색 영역 줄바꿈 안되고 영역 밖으로 벗어남
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): **안쪽** 날짜범위 컨테이너의 중첩 `filter-row`를 flex로 교체 → 여전히 겹침(엉뚱한 곳).
- 2차 (2026-06-26): 진짜 원인 = **바깥 `.filter-row`(고정 5칼럼 grid)**. 댓글 페이지만 날짜범위(입력 2개)로 항목 5개라 날짜 칸(~298px)이 210px 칼럼 넘쳐 액션 버튼과 겹침. → 이 페이지 바깥 filter-row만 `display:flex; flex-wrap:wrap`(공유 css 불변)·검색창 `flex:1 1 240px`·액션 `margin-left:auto`. → ✅ 실 브라우저 측정: 1280px·1024px 겹침 0, 2줄 줄바꿈, 넘침 0.

### 130. 관리자 모든 목록(게시판·댓글·실전자료·Q&A 등) 데이터 안 불러옴
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 미서명 쿠키 가설 → returnHeaders 서명쿠키. curl `/admin/dashboard/kpi` 401→200만 보고 통과 → 실 브라우저 데이터 0(상대경로 kpi/analytics만 쳐서 놓침).
- 2차 (2026-06-26): 가설 폐기, **실 브라우저(Playwright) 캡처** 재진단 → 진짜 원인 = **라우트 이중 prefix 404**. `adminRoutes`가 `{prefix:"/api/v1"}` 마운트인데 11개 파일이 절대경로 `app.get("/api/v1/admin/…")` 등록 → `/api/v1/api/v1/admin/…` → 프론트 호출 전부 404(상대경로 dashboard·analytics만 우연히 동작). → 11파일 51곳 절대→상대 `/admin/…` 교체. → ✅ 실 브라우저: 10개 관리자 페이지 전부 실데이터 200, 실패 호출 0.

### 132. 신고관리 페이지 "HTTP 401" 표기
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): 130과 동일 **이중 prefix 404**(reports 절대경로 등록). 페이지가 not-ok 시 `HTTP ${status}`를 출력해 표면화. → 상대경로 교체. → ✅ 실 브라우저: /reports 실데이터 200, 오류 텍스트 0.

### 133. 마스터 계정인데 "관리회원 관리" 접근 권한 없음
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): (a) 미서명 쿠키 (b) `/session`→`/get-session` 경로 오타 수정(둘 다 유효).
- 2차 (2026-06-26): admin-members 게이트는 서버사이드 getAdminSession이라 (a)(b)로 동작. → ✅ 실 브라우저: 마스터 로그인 후 `/admin-members` 정상 렌더, 권한없음 텍스트 0.

### 134. 마스터 계정 "내 정보 수정"에 실제 정보 안 나옴 (+저장 기능 추가)
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): 진짜 원인 = client `get-session` **CORS 차단**(toNodeHandler가 reply.raw 직접 써 @fastify/cors 우회). → ① auth 경로 CORS 헤더 수동 부착(+OPTIONS) ② AdminAccountMenu를 신규 `GET/PATCH /api/v1/admin/account/me`(CORS 정상·phone 포함)로 전환 ③ 저장 기능 추가(name·phone PATCH). 이메일 읽기전용, 미동작 비밀번호 필드 제거. → ✅ 실 브라우저: 마스터 실데이터(최고관리자·aijackdang@gmail.com·010-2484-0289) 표시, CORS 0, PATCH 저장 200 영속.

> 신규 5건(125~129) — 2026-06-26 배치, 검수 통과.

### 125. 쪽지 확인 모달 삭제 버튼 → 붉은 테두리(흰 배경)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 공유 Button에 outline형 danger variant 부재가 원인. `Button.types.ts`에 `danger-outline` variant 추가 + `Button.module.css`에 `.danger-outline`(흰배경·빨강글씨·빨강테두리, hover시 danger-soft) 정의 → `MessageDetailModal` 삭제(휴지통) 버튼 `ghost`→`danger-outline`. 영구삭제 버튼(채워진 danger)은 유지.

### 126. 메인 작당 라운지 게시판 태그 가로폭 → 글자폭에 맞춤
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = 부모 `.creativeBody`가 grid라 라벨이 `justify-self:stretch`(기본)로 칼럼 전체폭 차지, 기존 `align-self:flex-start`는 세로축이라 무효. `page.module.css .creativeBoardLabel` `align-self:flex-start`→`justify-self:start`. → ✅ Playwright 실측: 라벨 4개 글자폭(67px·99px)으로 축소.

### 127. 대대댓글 작성 시 프로필 이미지 안 나옴(새로고침하면 보임)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = 낙관적 append 시 `authorAvatarUrl: user?.avatarUrl ?? user?.image ?? null` 이라 기본 아바타 유저는 둘 다 null. → 7벌 CommentForm 전부 `user ? resolveAvatarUrl(user) : null`(lib/avatar 기본아바타 폴백 포함)로 교체.

### 128. 관리자 접속통계 전체가 가짜 데이터 → 진짜 데이터
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 방문 로그 인프라 신규 구축 — `page_views`(마이그 0022) + 공개 적재 `POST /api/v1/analytics/collect` + 유저웹 `PageViewTracker`(layout, sendBeacon) + 집계 API 5종(visitor-trend·referrers·keywords·post/resource-performance). stats 더미 전량 제거→실 API. → ✅ curl 실측: collect 204, 집계 6종 200 실데이터. ⚠️ 방문 로그는 도입 시점부터 누적 → 초기엔 희소.

### 129. 대시보드 방문자 추이·최근 콘텐츠 진짜 데이터
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): "최근 콘텐츠" → `GET /admin/dashboard/recent-content`(posts·resources·questions 최신순) 신설, RECENT 더미 제거. "방문자 추이" → page_views 인프라 공유, TrafficChart 더미 제거→visitor-trend API. → ✅ curl 실측: recent-content·visitor-trend 200 실데이터.

> 재수정 4건(122·107·108·113) — 2026-06-26 2차 배치, 검수 통과. 근본 원인 = **댓글 컴포넌트가 게시판별 7벌 복제**라 1차가 lounge 한 벌만 고쳤던 것.

### 122. 대댓글에 또 답글 — 같은 층위 + @멘션 표기
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `lounge/[slug]` 한 벌만 수정 → 미통과.
- 2차 (2026-06-26): `CommentItem.tsx`/`CommentForm.tsx`가 게시판별 7벌 복제임을 확인 → 수정된 lounge 한 쌍을 나머지 6벌에 복제(css import만 보정). 106(즉시표시)·116(아바타)도 전 게시판 반영. → ✅ grep + web typecheck + 빌드.

### 107. 실전자료 후기 빈 별(테두리만 있는 별) 삭제
- [x] `Claude`   [x] `검수`
- 3차 (2026-06-26): 조언이 지목한 `ResourceDetailClient`의 `<div data-slot="rating-input">`(별점 직접입력 `RatingInput`, 후기폼 StarPicker와 중복) 삭제 + `myRating`/`handleRatingChange`/`requireAuth`·`useGatingContext` 연쇄 제거. → ✅ web typecheck + 빌드.

### 108. 실전자료 후기작성 제목과 별점 picker를 같은 줄에 배치
- [x] `Claude`   [x] `검수`
- 3차 (2026-06-26): `ReviewForm`에 `title` prop → `.reviewFormHeader`(flex space-between)로 "후기작성" h2(좌)+StarPicker(우) 한 줄. 외부 h2 제거, aria id는 폼 안 h2로 유지. → ✅ web typecheck + 빌드.

### 113. 대댓글 작성 시 [취소]·[답글 등록] 버튼이 간격 없이 붙음
- [x] `Claude`   [x] `검수`
- 2차 (2026-06-26): CSS 모듈도 게시판별 분리임을 확인 → `automation`·`monetize`·`vibe-coding` `.module.css`의 `.commentFormActions`에 `gap` + `.mention` 추가. → ✅ web typecheck + 빌드.

> 신규 10건(119·120·121·123·124 + 114~118) — 2026-06-26 검수 통과.

### 119. 메인 실전 인기글 — 라운지 외 탭 비노출 원인 + 탭당 3개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = `posts.category`(글 대분류 컬럼) DB 전부 NULL → category 필터 0건. `popular.route.ts`에서 `BOARDS`(게시판 메타)로 category→board 슬러그 매핑해 board IN 필터로 변경, `page.tsx` 인기글 `.slice(0,3)`. → ✅ 캐시 flush 후 실측 vibe 2·자동화 3·수익화 3건.

### 120. 메인 작당 라운지 섹션 — 썸네일 + 게시판 표기 + 4개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): popular 라우트·`contracts/home.ts`에 `thumbnailUrl` 추가, 라운지 카드에 썸네일 img(없으면 empty_thumbnail)+게시판 라벨 뱃지+`.slice(0,4)`. (기존 글은 thumbnail null이라 폴백, 신규 작성부터 본문 첫 이미지.)

### 121. 쪽지 상세 모달 닫기 버튼 → 테두리 있는 흰색 버튼
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `MessageDetailModal` 닫기 버튼 `variant="secondary"`(흰 배경 #fff + 테두리)로 교체.

### 123. 쪽지 상세 모달 삭제 버튼 → 휴지통 이동
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 삭제 버튼 → `POST /messages/:id/trash`(발신/수신 측 대칭 soft-delete, 영구삭제 아님), 낙관적 제거 + 중앙 토스트.

### 124. 쪽지함 휴지통 탭 + 선택 일괄 영구삭제 + 30일 자동삭제
- [x] `Claude`   [x] `검수`
- 스키마(메인): `messages` 4컬럼 추가(`trashed_by_*_at`·`purged_by_*`, 마이그 0021). 휴지통 탭·체크박스 일괄선택·`POST /messages/purge`·lazy 30일 자동 purge.

### 114. 쪽지함 프로필 이미지에 실제 사진이 안 나옴
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `getMessages`/`getConversations` SELECT에 `u.image`·`u.default_avatar_index` 추가, `avatar_url||image||기본아바타` 해석.

### 115. 작당 의뢰소에서 내가 쓴 글에는 [쪽지 보내기] 버튼이 안 떠야 함
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `GigDetailClient` 쪽지 버튼을 `{!isSelf && ...}`로 미렌더 + 누락된 `recipientId`/`recipientAvatarUrl` 주입.

### 116. 쪽지 보내기 모달에 프로필 이미지가 안 보임
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `MessageModal`에 `recipientAvatarUrl` prop·`AuthorName`에 `authorAvatarUrl` prop 추가, 아바타 아는 호출부 일괄 주입.

### 117. 푸터에 작당 라운지 하위 메뉴 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `SiteFooter` "작당 라운지" 그룹 4개 링크로 확장(헤더와 동일).

### 118. 쪽지·알림 페이지 이동/새로고침 시 즉시 알림 모달
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `NotificationAlert`를 `layout.tsx`에 마운트, `usePathname` 변경 시 미읽음 count 비교해 증가 시 중앙 토스트.

> 신규 12건(100~112 + 게시글 첨부) — 2026-06-26 배치, 사용자 검수 통과.

### 100. 유저 계정 페이지 노출글 선택 박스 스크롤바 디자인(얇은 옅은 보라색)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `FeaturedPostsPanel.module.css`의 `.panelBody`(max-height 400·overflow-y auto)에 커스텀 스크롤바 추가 — WebKit(`::-webkit-scrollbar` 폭 6px·track 투명 둥금·thumb 옅은보라 `rgba(167,139,250,0.45)` 99px 라운드·hover 0.70) + Firefox(`scrollbar-width:thin; scrollbar-color: rgba(167,139,250,0.45) transparent`). primary가 인디고(#3030c0)라 보라가 아니므로 violet-400 계열로 "옅은 보라" 충족. → ✅ 코드 확인.

### 101. 유저 계정 페이지 노출글 저장 후 즉시 반영(새로고침 불필요)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `handleSave()`가 PATCH 성공 후 `setDirty(false)`만 하고 좌측 노출글 목록(서버 컴포넌트 렌더)은 미갱신이라 새로고침 필요였음. → `useRouter().router.refresh()`를 저장 성공 분기에 추가, page.tsx의 `fetchFeaturedPosts`는 이미 `cache:"no-store"`라 refresh만으로 최신 반영. → ✅ 코드 확인.

### 102. 헤더 계정 드롭다운에 "내 계정" 항목 추가
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `SiteHeader` UserMenu에 `내 계정`(아이콘 account-circle-line) → `/u/${encodeURIComponent(user.nickname)}`(본인 공개 프로필) 추가. 기존 마이페이지(user-line·/mypage)와 아이콘·경로 구분해 둘 다 유지. → ✅ 빌드 통과.

### 103. 메인 페이지 "AI 수익화 인기글" 섹션 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `app/page.tsx`의 `.popularBand`(monetization-title) 섹션 전체 + `fetchMonetizationPosts` import·`monetizationPosts` 변수·호출 제거(미사용 잔재 grep 0건). `lib/home.ts` 함수 본체·CSS는 유지. → ✅ web 빌드 성공.

### 104. 메인 페이지 "기여자 랭킹" 섹션 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `app/page.tsx`의 `#ranking` 섹션(내부 `RankingWidget`) 전체 + `RankingWidget` import 제거(파일 자체는 보존). → ✅ web 빌드 성공.

### 105. 쪽지함 메일박스형 전면 개편(받은/보낸 탭·단건 모달·답장·실사진·AuthorName)
- [x] `Claude`   [x] `검수`
- 증상(원인): 기존 `/messages`는 **채팅형**(대화 스레드 버블, `ThreadView`)으로 보낸/받은 구분 없음, 메시지마다 프로필·계정 메뉴 없음.
- 1차 (2026-06-26): **채팅 → 메일박스**로 재설계. **API**: `GET /api/v1/messages?box=received|sent` + `POST /api/v1/messages/:id/read`(기존 conversations 라우트 보존). **프론트**: `/messages` = 신규 `MessagesPage`(받은/보낸 탭) — 행 클릭 → `MessageDetailModal`(채팅 버블 없음), 받은 쪽지만 "답장하기" → `MessageModal` 연결, 모달 열 때 읽음 처리. → ✅ typecheck green + web 빌드.

### 106. 대댓글 작성 시 즉시 표시(새로고침 불필요)
- [x] `Claude`   [x] `검수`
- 증상(원인): reply 폼 `onSuccess`가 `router.refresh()`만 호출해 새 대댓글이 즉시 안 보임.
- 1차 (2026-06-26): 로컬 state 즉시 append 방식 — `CommentForm`이 POST 201 응답을 현재 유저 정보로 낙관적 `CreatedComment`로 구성→`onSuccess(created)`, `CommentItem`이 `localReplies`에 append+펼침, `router.refresh()` 제거. → ✅ typecheck green.

### 109. 푸터 메뉴 실제 페이지 링크 연결
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): footerGroups가 전부 `<a href="#">`(미동작)였음 → `{label, href}` + next/link `<Link>`로 통일. 실제 app/ 폴더 존재로 매핑 검증. → ✅ web 빌드. ⚠️ 이용약관(/terms)·개인정보처리방침(/privacy)은 페이지 미생성이라 해당 2개만 `href="#"` 유지(페이지 신설 시 연결).

### 110. 첨부파일 게시글 수정 시 첨부 편집 기능 추가
- [x] `Claude`   [x] `검수`
- 증상(원인): `PostEditForm`이 title/contentJson/tags만 PATCH — 기존 첨부 편집 불가.
- 1차 (2026-06-26): 수정 폼에 `existingAttachments`(삭제 버튼)+`newFiles`(드롭존, 10MB·5개) 추가. 새 파일은 `POST /posts/attachments` 업로드, 기존 첨부는 변환해 **유지목록 전체**를 PATCH `attachments`로 전송(전량 교체로 유실 방지). 계약 스키마 일치 확인. → ✅ typecheck green + web 빌드.

### 111. 게시판 상세 페이지 "관련 글" 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 4개 상세(vibe-coding·automation·monetize·lounge)에서 `<RelatedPosts>` JSX + import + 전용 `relatedData` fetch 제거. 컴포넌트 파일은 보존. → ✅ grep 잔재 0 + web 빌드.

### 112. txt 등 첨부 강제 다운로드(브라우저 인라인 열림 방지)
- [x] `Claude`   [x] `검수`
- 증상(원인): `<a href download>`는 .txt 인라인 렌더·크로스오리진 시 download 무시.
- 1차 (2026-06-26): API 다운로드 프록시 `GET /api/v1/posts/attachments/download?url=&name=` 신설 — `Content-Disposition: attachment` + `application/octet-stream`으로 스트리밍. SSRF 방지(허용 base·path traversal 차단), `/posts/:slug`보다 먼저 등록. `AttachmentList` href를 프록시로 교체. → ✅ typecheck green + 메인 직접 검수.

### 게시글 첨부파일 — 작성 시 첨부 → 상세 페이지에서 확인·다운로드
- [x] `Claude`   [x] `검수`
- 증상(원인): 게시글 첨부가 미구현(서버 업로드 없음·`post_attachments` 테이블 없음·`hasAttachment` 하드코딩 false).
- 1차 (2026-06-26): 풀스택 신규 구현(마이그 0020). **DB** `post_attachments` 테이블. **API** 공개버킷 업로드(`storage.uploadAttachment`)+`POST /api/v1/posts/attachments`(인증·10MB·5개), 허용 확장자는 관리자 설정 `file_allowed_extensions`로 검증, getPostBySlug `attachments[]`/`hasAttachment` 동적화. **프론트** `PostWriteForm` 실업로드, `AttachmentList` 실데이터, 상세 9곳 주입. → ✅ 전 패키지 typecheck green + 읽기경로 실측(테스트 첨부 GET 확인 후 정리).

> 신규 16건(84~99) — 2026-06-26 병렬 배치. 스키마/마이그(0019: posts.thumbnail_url·resources.thumbnail_url·users.featured_post_ids·comments.rating)은 메인 단일 소유 선처리, 기능은 파일 비충돌 7개 서브에이전트 병렬 + 메인 검수. 전 패키지 typecheck green + web 프로덕션 빌드 63페이지 성공(RSC 위반 0).

### 84. 최근 본 글 최대 5개
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `RecentViewedPanel`이 localStorage 항목 전체를 렌더 → `setItems(parsed.slice(0, 5))`로 5개 상한. → ✅ 코드 확인. (실제 누적 5개 초과 표시는 로그인·열람 이력 필요 → 사용자 검수)

### 85. 게시글 썸네일 자동 생성(본문 첫 이미지 크롭, 없으면 empty_thumbnail)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): posts·resources에 `thumbnail_url` 컬럼(0019). 신규 `extractFirstImageUrl(contentJson)`(Tiptap JSON 재귀→첫 image attrs.src)을 글/자료 생성·수정 시 계산해 저장. 카드에 썸네일 `<img src={thumbnailUrl ?? "/empty_thumbnail.png"}>` + CSS `object-fit:cover`로 크롭(네이티브 sharp 미설치 — CSS 크롭). `자료/empty_thumbnail.png`→`apps/web/public/`. → ✅ Playwright: /automation 카드 썸네일 3개 렌더, 기존 글(이미지 없음) empty_thumbnail 폴백. (기존 글은 thumbnail_url=null이라 폴백, 신규 작성부터 본문 첫 이미지 적용 — 사용자 검수)

### 86. 실전자료 정렬(최신순) 드롭다운 가로 폭 확대
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `.sortGroup`이 `width:fit-content`라 "다운로드" 라벨이 좁게 잘림 → `min-width:140px`(ResourceFilterClient.module.css·prompts.module.css). 디자인 시스템 Select 유지(네이티브 금지). → ✅ 코드 확인 (시각 폭은 사용자 검수)

### 87. 회원정보에서 약관동의 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/settings/membership`(AccountInfoForm)에서 "약관 동의(표시 전용)" 블록·termsAgreedAt 상태·`.termsAgreed` CSS 제거. 나머지 회원정보 필드 유지. → ✅ 빌드(membership 페이지 생성) 통과.

### 88. 유저 계정 페이지 회색선 아래 뱃지 항목 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/u/[nickname]` 상단 구분선 아래 뱃지 행 JSX + `fetchUserBadges`·`UserBadgeItem`·`.badgeRow/.badgeList/...` CSS 제거. 등급 진행도 등 나머지 유지. → ✅ 빌드(/u/[nickname] 생성) 통과.

### 89. 유저 계정 페이지 노출글 선택 기능(우측 280px, 본인만)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `users.featured_post_ids`(jsonb, 0019). API `PATCH /users/me/featured-posts`(최대 5, 본인 글만 검증)·`GET /users/profile/:nickname/featured-posts`(공개). 프로필 우측 280px `FeaturedPostsPanel`(체크박스로 본인 글 선택→저장). **본인 조회 시에만 렌더**(서버에서 `/users/me` 쿠키 조회로 isOwner 산출, 타인은 패널 미전달·결과 글만 노출). → ✅ 빌드 통과. (본인/타인 가시성·저장 동작은 로그인 필요 → 사용자 검수)

### 90. 자기 자신 차단 클릭 시 안내
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `AuthorName` 차단 메뉴 onClick 최상단에 isSelf(닉네임 비교) 가드 추가 → 본인일 때 "자기 자신은 차단할 수 없습니다." 토스트 후 return(차단 API 미호출). 팔로우 자기차단(#51)과 동일 패턴. → ✅ 코드 확인. (클릭 토스트는 로그인 후 사용자 검수)

### 91. 에디터 글자 크기 48px까지
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `EditorToolbar` FONT_SIZES에 26·30·36·42·48px 추가(기존 12~22px 뒤에). 동일 렌더 map 사용. → ✅ 코드 확인(총 10옵션). (드롭다운 표시는 글쓰기 진입=로그인 필요 → 사용자 검수)

### 92. 쪽지 보내기 버튼 비활성화(글 작성해도 활성 안 됨)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 진짜 원인 = **테스트 유저 문제가 아니라 `authorId`(쪽지 수신자 id)가 AuthorName까지 안 흘러옴**. MessageModal `canSend = text>0 && !!recipientId`인데 카드·상세·댓글의 `<AuthorName>`가 authorId 없이 렌더 → recipientId="" → 버튼 항상 비활성. → ① `postCardSchema`에 `userId` 추가 + posts/service select, ② 목록 카드 전부 `authorId={post.userId}`, ③ **상세 본문/댓글/대댓글/후기/Q&A의 AuthorName ~36곳에 authorId 일괄 주입**(post.authorId·comment.authorId·reply.authorId·review.authorId·question.author.id·answer.author.id). → ✅ API `/api/v1/posts` 응답에 userId 채워짐 확인, typecheck green. (실제 쪽지 전송은 로그인 후 사용자 검수)

### 93. 다른 유저 팔로우 안 됨
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 진짜 원인 = 팔로우 버튼이 로컬 state만 토글(`setFollowing`)하고 **API를 호출하지 않음**. → `POST /api/v1/follows {followingId:authorId}`(팔로우)·`DELETE /api/v1/follows/:nickname`(언팔)로 실연동(credentials include, 성공/실패 토스트). authorId 부재 시 안내 토스트. #92의 authorId 주입으로 대상 id 확보. → ✅ follows 라우트 메서드/경로 확인 + typecheck green. (실제 팔로우는 로그인 후 사용자 검수)

### 94. 메인페이지 작당 라운지 글 클릭 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = 홈 카드가 `/lounge/${board}/${id}`(UUID)로 링크하나 실제 라우트는 `/{category}/{board}/{slug}`이고 popular API가 slug를 안 내려줌. → popular.route.ts select에 `slug` 추가, home contract에 slug 추가, page.tsx에 `getPostDetailHref(board,slug,category)`(BOARDS.urlPath 매핑) 도입해 전 홈 카드 href 교정. → ✅ Playwright: 홈 카드 href에 UUID 0건.

### 95. 메인페이지 실전 인기글 클릭 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): #94와 동일 작업으로 인기글/수익화 인기글 카드 href를 slug 기반으로 교정. 실전자료 인기글은 `/resources/{slug}` 사용(이미 정상). → ✅ Playwright: 홈 UUID href 0건.

### 96. --font-mono 삭제 → --font-sans 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): typography.css의 `--font-mono` 정의 삭제, 사용처(Editor.module.css `pre code`/`code`, page.module.css `.questionItem span`) 전부 `var(--font-sans)`로 교체. → ✅ grep: font-mono 잔존 0, 빌드 통과.

### 97. 게시글 사이드바 작당랭킹 실데이터 + 클릭 프로필 메뉴
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 원인 = BoardSidebar가 하드코딩 rankings prop("워크플로마스터" 등)을 렌더. → 신규 `RankingPanel`(client)이 `GET /gamification/ranking?period=weekly&limit=10` 실데이터 fetch, 각 항목을 `<AuthorName name authorId gradeLevel>`로 렌더(팔로우/쪽지/계정바로가기 메뉴 + 등급뱃지). BoardSidebar가 prop 무시하고 RankingPanel 사용(게시판 페이지 미수정으로 충돌 회피). → ✅ Playwright: /automation 사이드바에 실유저(이성적인전사2968888·은빛달236) 렌더, 하드코딩명 0건.

### 98. 실전자료 상세 액션바(북마크/공유/신고 작동 + 좋아요 + 타 게시판 통일)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 기존 aria-disabled 플레이스홀더 → automation ReactionBar를 미러한 작동 ReactionBar(좋아요·북마크·공유 드롭다운·신고, 동일 아이콘/좌우정렬). reactions/bookmarks/reports 테이블이 이미 `targetType:"resource"` 지원 → 그대로 연동. → ✅ Playwright: 상세 액션바 버튼 4종 [좋아요 0·북마크 0·공유·신고] 확인.

### 99. 실전자료 후기 = 댓글 기능 + 별점(대댓글 별점 없음)
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 새 테이블 불필요 — `comments`가 `targetType:"resource"` 지원, `comments.rating`(smallint) 컬럼만 추가(0019). API `GET/POST/DELETE /resources/:id/reviews`(최상위는 rating 1~5 필수·대댓글 null, 생성·삭제 시 같은 tx로 resources.avgRating/ratingCount 재계산). 프론트 ReviewForm(최상위만 별점 picker)+ReviewList(스레드, AuthorName 재사용). → ✅ Playwright: 상세에 별점 picker+후기 폼+목록 렌더 확인.

### 47. 실전자료 지원환경 드롭다운 스크롤 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `Select`는 이미 디자인 시스템 커스텀 드롭다운이 맞고, `.menu`가 `max-height:280px`라 옵션 7개(292px)가 넘쳐 메뉴 내부 스크롤바가 생긴 게 원인 → `Select.module.css .menu` max-height 280→480px. → ✅ Playwright: 지원환경 클릭 시 메뉴 scrollable=false 확인.

### 48. 실전자료 검색 기능 실제 동작
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): API 서비스 레이어(list.service.ts)에 q 필터 누락 → `ilike(title)/ilike(summary)` 추가. → ✅ Playwright: `?q=테스트` 필터 확인.

### 49. 프로필 수정 / 회원정보 분리
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `/settings/profile`=프로필, 신규 `/settings/membership`=회원정보로 분리, settings 좌측 탭 nav 신설. → ✅ Playwright 확인.

### 50. 1:1문의 상세 목록 버튼 디자인 통일
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): InquiryThread 하단 목록 버튼을 automation `.listButton` 동일 토큰으로 교체.

### 51. 자기 자신 팔로우 차단 안내
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): `AuthorName` 팔로우 버튼 isSelf(닉네임 비교) 가드 → 본인 클릭 시 토스트. → ✅ Playwright 확인.

### 52. 유저 프로필 "계정 바로가기" 크래시
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): Next 15 `cookies()` await 누락 → `const cookieStore = await cookies()`. → ✅ Playwright: `/u/…` 200.

### 77. 에디터 이미지 아이콘 → 바로 파일 선택·삽입
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 모달 제거, 바로 `<input type=file>` 열고 업로드 후 setImage 삽입. → ✅ Playwright 확인.

### 78. 에디터 글자 크기 select에서 제목/목차 제거
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): FONT_SIZES에서 제목 H2/소제목 H3 항목·heading 분기 제거 → 순수 크기만. → ✅ Playwright 확인.

### 79. 에디터 목차 삽입 아이콘 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): "목차 삽입" 버튼·handleInsertToc·중복 divider 제거. → ✅ Playwright 확인.

### 80. 상단 헤더 검색 삭제
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): SiteHeader SearchAutocomplete import·JSX 제거. → ✅ Playwright: 헤더 검색 input 0.

### 81. 실전자료 삭제 후 404
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 삭제 후 `/resources`(없음)→`typeToListUrl(resourceType)`로 push. → ✅ Playwright 확인.

### 82. 실전자료 삭제 후 즉시 반영 / 83. 등록 후 즉시 반영
- [x] `Claude`   [x] `검수`
- 1차 (2026-06-26): 4개 유형 목록 `force-dynamic`+fetch `no-store`. → ✅ Playwright: 등록·삭제 즉시 반영.

### A. 로그아웃 글 등록 안내 → "로그인 후 이용"
- [x] `Claude`   [x] `검수`
- 증상: 로그아웃 상태에서 글 등록 클릭 시 "관리자 승인" 류 안내가 떴다(주장).
- 시도 이력:
  - 1차 (2026-06-26): "관리자 승인" 문구를 web 전역 grep → **사용자向 웹에는 존재하지 않음**(admin 가입 화면에만 존재). 실제 글쓰기 진입 경로 추적 결과 ①섹션 페이지 글쓰기는 `<Link href=".../write">`로 이동 ②write 페이지가 인증 게이트 없이 공용 폼을 바로 렌더해 비로그인도 폼에 진입 후 제출 시점 401을 받는 구조였음. → 공용 글쓰기 폼들(PostWriteForm·ResourceWriteForm·RecruitForm·Q&A·gigs/resource Gate)에 `useAuth` 기반 렌더 게이트 추가(ready&&!user → "로그인 후 이용해 주세요" EmptyState + 로그인 버튼), 401 토스트 문구도 "로그인 후 이용해 주세요"로 통일, ResourceWriteGate의 `useMockAuth`(목업)→`useAuth`(실세션) 교체. → ✅ 검증: Playwright 로그아웃 상태로 `/automation/write` 진입 시 미들웨어가 `/login?redirectTo=...`로 즉시 리다이렉트되어 "관리자 승인" 문구 노출 0건 확인.

### B. 시스템 알림(토스트) 디자인 통일
- [x] `Claude`   [x] `검수`
- 증상: tone별 색/한줄형/제목+내용+버튼형 등 토스트 디자인이 제각각.
- 시도 이력:
  - 1차 (2026-06-26): Toast.tsx/Toast.module.css에서 tone별(success/warning/danger/info) 배경·테두리·아이콘색 분기 제거 → **모서리 둥근 흰 박스 1종**으로 통일. 레이아웃: 제목(좌측 정렬) + 내용(가운데 정렬, 선택) + "확인" 버튼(항상) + 우상단 X. toast() 시그니처(tone/title/description/duration) 하위호환 유지, 정중앙 오버레이 유지. → ✅ 검증: Playwright로 휴대폰 미입력 저장 시 뜬 토스트 스크린샷 확인 — 반투명 배경막 위 흰 박스, "휴대폰 번호를 입력해 주세요"(좌측), 파란 "확인" 버튼, 우상단 X.

### C. 실전자료 지원환경 필터 → 선택박스 + 검색창 + 난이도 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): ResourceFilterClient를 재작성 — 지원환경 칩/모바일 아코디언 → 디자인 시스템 `Select`(지원환경 전체+6옵션), 난이도 `Select`/difficultyOptions 및 4개 목록 페이지의 difficulty 파라미터 완전 제거, 좌측에 디자인 시스템 `SearchInput`(?q= 갱신) 추가. → ✅ 검증: Playwright로 `/resources/prompts` 렌더 — DOM에 select 2개(지원환경·정렬)+검색 input 2종 존재, "난이도" 텍스트 0건. 스크린샷으로 디자인 시스템 스타일(브라우저 기본 아님) 확인.

### D. 마이페이지 뱃지 탭 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): mypage/page.tsx의 TabKey/tabs에서 "badges" 제거, 뱃지 전용 상태(badgeList/badgeLoaded)·useEffect·렌더 블록 삭제. 등급 진행도용 gradeData fetch는 유지. → ✅ 검증: Playwright 로그인 세션으로 `/mypage` 렌더 — 본문에 "뱃지" 0건 확인.

### E. 계정 드롭다운 메뉴 재구성
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): SiteHeader UserMenu에서 "내가 쓴 글"·"북마크"(둘 다 /mypage) 제거, 회원정보(/settings/profile)·1:1문의(/inquiries)·포인트(/points) 추가. → ✅ 검증: Playwright로 헤더 계정 메뉴 DOM 추출 — [마이페이지→/mypage, 회원정보→/settings/profile, 1:1문의→/inquiries, 포인트→/points] 확인(북마크·내가쓴글 없음).

### F. 회원정보 페이지
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): users 테이블에 phone·gender(enum)·birth_date·marketing_agreed_at 컬럼 + 마이그레이션 0018 추가, contracts(publicUser/updateProfile)·API GET·PATCH /users/me 확장(메인 직접). /settings/profile(ProfileForm)에 회원정보 섹션 신설 — 이메일(읽기전용)·이름·휴대폰(필수)·성별(select)·생년월일(date)·마케팅 수신 동의(토글)·약관 동의(상태표시)·비밀번호 변경 버튼(→/settings/security, 현재 비밀번호 재확인). 기존 닉네임/아바타/소개/링크는 하단 유지. → ✅ 검증: Playwright 로그인 세션으로 `/settings/profile` 렌더 — 8개 필드 전부 표기, 휴대폰 빈 값 저장 시 검증 토스트 확인. contracts/api/database/web 타입체크 그린, DB 컬럼 4종 적용 확인.

### G. 포인트 페이지 (현재 포인트 + 적립 상세 + 등급 안내 탭)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): API에 GET /gamification/me/points-history(페이지네이션, reasonLabel 한국어 변환)·GET /gamification/grades 추가(메인 직접). /points 신규 페이지 — 탭1 "내 포인트"(누적 포인트+RankBadge+다음등급 진행바+적립/회수 내역), 탭2 "등급 안내"(5등급 RankBadge+포인트 구간, 현재 등급 하이라이트). middleware PROTECTED_PATHS에 /points 추가. → ✅ 검증: Playwright 로그인 세션+ledger 4건 주입으로 `/points` 렌더 — 26P, 내역(게시글 작성+10/댓글 작성+1/실전자료 등록+20/답변 작성(회수)-5), 등급 안내 탭 5등급(새내기~마스터) 현재등급 하이라이트 스크린샷 확인.

### H. 1:1문의 게시판 + 관리자 CS 관리
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1차 (2026-06-26): 조사 결과 1:1문의는 web(/inquiries 목록·작성·상세 스레드)·API(사용자 GET/POST/상세 + 관리자 목록/상세/상태변경/답변)·admin(문의 관리 페이지+드로어, Operation 네비에 "문의 관리" ri-customer-service-2-line 노출)·DB(inquiries·inquiry_replies)·contracts까지 **이미 완전 구현**됨. 누락은 사용자 진입 동선뿐 → E에서 계정 메뉴에 "1:1문의→/inquiries" 추가로 연결. → ✅ 검증: 코드/네비 확인 + 계정 메뉴 링크 동작 확인.

### 0. 로그인이 또 안 됨 (API 전역 관리자 가드 회귀)
- [x] `Claude`   [x] `검수`
- 증상: 로그인이 반복적으로 안 됨. 서버 재시작으로도 안 고쳐짐.
- 시도 이력:
  - 1차 (2026-06-26): 서버 꼬임 의심해 전부 종료·재기동 → API는 떠 있으나 `/health`가 200이 아니라 **401 `ADMIN_UNAUTHORIZED`** 반환 발견. 원인: `adminGuardHook`(관리자 세션 검증 훅)이 `app.ts`에서 **루트 앱 전역 preHandler로 등록**돼 모든 경로(health·공개 API·유저 로그인 `/api/v1/auth/*`)를 401로 막음. 훅 docstring은 `/api/v1/admin/*` 한정 적용을 전제(9.1 커밋 3b25fd8에서 범위 제한 누락된 회귀). → `adminGuard.ts`에 "`/api/v1/admin/` 로 시작하지 않으면 가드 통과" 경로 가드 추가. → ✅ 검증: `/health` 200 복구, 유저 로그인 POST가 더 이상 ADMIN_UNAUTHORIZED 아닌 Better Auth `INVALID_EMAIL_OR_PASSWORD` 도달(=로그인 흐름 정상), 관리자 보호 경로(`/api/v1/admin/members`)는 여전히 401 가드 유지.

### 1. 댓글 등록 버튼 눌러도 반응 없음 (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 댓글 입력 후 등록 버튼을 눌러도 아무 일도 안 일어남.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): credentials 누락 의심 → CommentForm/CommentItem 7개 mutation fetch에 `credentials:"include"` 추가 + 등록 후 `router.refresh()` → **여전히 무반응**.
  - 2차 (2026-06-24, 4차 배치): 앞선 가설 폐기, 렌더/이벤트 경로 추적 → 진짜 원인은 **Button 컴포넌트 기본 `type="button"`** 이라 `<form>` onSubmit이 호출조차 안 됨. 등록 버튼 7개 전부 `type="submit"` 추가 + `GatingContext.requireAuth`가 세션 로드 전(ready=false) 막던 것 보정 → ✅ 로그인 후 입력→등록 클릭→즉시 노출(0→1) 브라우저 확인.

### 2. 빈 상태 "첫 글을 작성해 보세요" 글씨↔글쓰기 버튼 간격 40px (3회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 빈 게시판 안내문구와 글쓰기 버튼 사이 여백이 좁음(40px 요청).
- 시도 이력:
  - 1차 (2026-06-24, 2차 배치): `EmptyState.module.css` `.desc` `margin-bottom` 16→40px → **반영 안 보임**.
  - 2차 (2026-06-24, 3차 배치): 코드상 이미 40px임 확인, dev 서버 재시작 권장 → **여전히 안 보임**.
  - 3차 (2026-06-24, 4차 배치): 덮어쓰기 의심 → `!important`로 강제 적용 → ✅ 계산값 `margin-bottom=40px` 브라우저 확인.

### 4. 글 작성·수정 후 화면에 즉시 반영 안 됨 (캐시) (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 글 작성·수정 후 목록/상세에 새 내용이 안 보이고 새로고침해야 반영됨.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): 게시판 목록 6개 + 공지 데이터 fetch `next:{revalidate:30/60}` → `cache:"no-store"` → 목록은 반영되나 **상세는 옛 글**.
  - 2차 (2026-06-24, 4차 배치): 상세 page.tsx 본문 fetch도 `revalidate` 캐시였음. 전 게시판 상세 8곳(lounge/automation/monetize/vibe-coding/notice/gigs/(content)/resources) + generateMetadata fetch를 `cache:"no-store"`로 변경 → 수정 즉시 반영.

### 6. 에디터 포커스 테두리 (2회 수정)
- [x] `Claude`   [x] `검수`
- 증상: 글쓰기 에디터 포커스 시 테두리가 어색함.
- 시도 이력:
  - 1차 (2026-06-24, 1차 배치): `Editor.module.css` `.editorContainer:focus-within` 포커스 링 제거.
  - 2차 (2026-06-24, 2차 배치): 답변 LightEditor와 동일하게 — 바깥 컨테이너에만 포커스 링(primary+ring), 안쪽 ProseMirror는 outline·box-shadow 제거.

### 8. AI 창작마당 창작 스펙 (4회 손댐)
- [x] `Claude`   [x] `검수`
- 증상: 창작 스펙 표시/위치/필드 과다.
- 시도 이력:
  - 1차 (2026-06-24, 3차 배치): 상세 우측 280px 배치, ≤1024px 1단·모바일은 댓글 위 (lounge/[slug] 2단 레이아웃).
  - 2차 (3차 배치): 글쓰기 위치 — PostWriteForm `afterAttachment` 슬롯, CreativeSpecFields를 파일첨부 밑 흰 박스로 이동.
  - 3차 (3차 배치): 필드 축소 — params·postProcess·costType 입력·표시 삭제(스키마는 optional 유지).
  - 4차 (4차 배치): "안 보임" 진짜 원인은 #4와 같은 revalidate 캐시. no-store로 해결 → ✅ 우측 280px 흰박스 표기 확인.

### 11. 글 작성/리스트 클릭 후 404 (slug)
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): 한글 slug 이중 인코딩 버그 → `encodeURIComponent(decodeURIComponent(slug))`로 정규화(전 게시판 17곳). 리스트 클릭 404도 동일 원인.

### 12. EmptyState "첫 글을 작성해 보세요" 가운데 정렬
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): EmptyState.module.css flex 중앙 정렬 추가.

### 13. Q&A 답변 즉시 표시
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): AnswerForm onSuccess로 생성된 답변을 AnswerSection state에 즉시 추가.

### 14. 시스템 알림(토스트) 반투명 배경막
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): Toast에 overlay(rgba 0.45) 추가, 배경 클릭 시 닫힘.

### 15. 필수 입력 누락 안내
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): 검증 실패 시 정확한 토스트 노출 + 서버 에러 메시지 우선 표시.

### 16. 대메뉴 클릭 시 첫 하위메뉴로 이동
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 1차 배치): `children[0]?.href` 사용(데스크톱·모바일·브레드크럼).

### 17. 게시글 상세 "작성자의 다른 글" 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): RelatedPosts.tsx에서 authorPosts 섹션 제거(관련 글만 노출).

### 18. 상세 footer 공유 버튼(목록↔수정 사이) 삭제
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): lounge/automation/monetize/vibe-coding/notice/(content) 6개 상세에서 ShareButton 제거(본문 반응바 공유는 유지).

### 19. 묻고답하기 수정·삭제 위치 통일
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 2차 배치): QuestionFooterOwnerActions 신설로 하단 footer 목록 옆으로 이동, 해결됨 배지는 상단 유지.

### 20. 헤더 쪽지 아이콘 빨간 배지 (실제 미읽음 연동)
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): 하드코딩 count={1} 제거, useUnreadMessages 훅 신설(대화목록 unreadCount 합산), 0이면 배지 없음.

### 21. 자기 게시물 좋아요 → 차단 알림
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): ReactionBar 7개 disabled 제거, 클릭 시 "내 글에는 좋아요를 누를 수 없습니다" 토스트.

### 22. 수정하기 BoardHero 크래시
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): BOARDS.category와 boardHeroes 키 불일치로 config.media undefined → heroConfig에 resolveHeroKey(카테고리→히어로키 매핑+lounge 폴백) 추가, BoardHero·수정/목록/상세에 적용.

### 23. 프로필 이미지 전역 표기
- [x] `Claude`   [x] `검수`
- 시도 이력: 1차 (2026-06-24, 3차 배치): postCard/postDetail/댓글 contract에 authorAvatarUrl 추가, API가 avatarUrl||image||기본아바타 resolve. 게시글 목록/상세/댓글/Q&A/자료 카드 Avatar에 src 연결(목업 자료상세 4종·DM·tags는 추후).

### 24. 마이페이지 (3건)
- [x] `Claude`   [x] `검수`
- 시도 이력 (모두 2026-06-24, 3차 배치):
  - 내가 쓴 글: 빈 배열 하드코딩 제거, GET /api/v1/users/me/posts 신설(게시글+실전자료 합산 최신순) 실연동.
  - 내 자료 탭 삭제: 실전자료 글을 '내가 쓴 글'에 kind=resource로 통합 표기.
  - 북마크 항목 디자인: '내가 쓴 글'과 동일한 activityItem 마크업으로 통일.

### 3. 삭제 확인 모달 — 취소/삭제 색 구분 + hover 글자
- [x] `Claude`   [x] `검수`
- 사용자 조언 : 해당 요소에 영향을 미치는 다른 CSS가 없는지 찾아봐.
- 시도 이력:
  - 1~3차 (2026-06-24): DeleteConfirmModal 추출·색상 CSS·window.confirm 교체 → **여전히 증상**(사용자 재지적).
  - 4차 (2026-06-26): 메인이 실제 삭제 모달을 브라우저로 띄워 computed style 측정 — 취소·삭제 둘 다 분홍배경+빨강글씨 동일, 삭제 hover 시 흰배경+흰글씨(투명). 진짜 원인 = 게시판 상세 `.ownerActions button` CSS(배경 danger-soft·hover 흰배경)가 **portal 없이 그 안에 렌더되던 모달 버튼까지** 덮음(사용자 조언 적중). → `DeleteConfirmModal`을 `createPortal(document.body)`로 변경(한 곳 수정→전 게시판 일괄). → ✅ 재측정: 취소=흰배경/검은글씨, 삭제=빨강(217,54,62)/흰글씨, hover 진한빨강/흰글씨 유지 + 스크린샷 확인.

### 5. 자기 자신에게 쪽지 보내기 → 차단 알림
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~2차 (2026-06-24): AuthorName isSelf(authorId 기준) + GigDetail 가드 → authorId 미전달 호출부에서 여전히 본인에게 모달.
  - 3차 (2026-06-26): 진짜 원인 = isSelf를 authorId로만 판정(대다수 호출부 미전달). → `AuthorName` isSelf를 **닉네임 비교**(user.nickname===name)로 보강(호출부 수정 없이 전역 적용) + "계정 바로가기" 고정 샘플(/u/작당탐험가)→실제 `/u/[name]` 수정. → ✅ Playwright: 본인 글 작성자명→쪽지 클릭 시 차단 토스트.

### 7. 에디터 기능 개선
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~2차 (2026-06-24): 확장/버튼 정리 → ①활성 상태 즉시 미반영 ②리스트 마커 안 보임 잔존.
  - 3차 (2026-06-26): ①`useEditorState`로 툴바 isActive/폰트크기 구독→선택 즉시 활성 반영 ②전역 reset `ul,ol{list-style:none}`이 마커를 죽인 게 원인 → `.ProseMirror ul{list-style:disc} ol{decimal}` 명시. → ✅ Playwright: 불릿 클릭 시 ul list-style:disc·padding 24px·마커 표시, 굵게/불릿 버튼 즉시 active.

### 9. 실전자료 등록/상세 (구조 변경)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~3차 (2026-06-24): 단일폼·상세 경로·버튼 배치 → 자료유형 선택 제거(③) 미완·목록 404 잔존.
  - 4차 (2026-06-26): ①상세 북마크/공유/신고 세미볼드 제거+자료설명 밑 흰 박스(page.tsx로 이동) ②목록 버튼 href를 typeToListUrl로 교정 ③**유형 선택 카드 제거**→각 `/resources/{type}/write`가 고정 유형 주입(fixedResourceType), 목록 "자료 등록"이 유형별 write로. → ✅ Playwright: /resources/prompts/write에 유형카드 없음, 등록→상세 정상.

### 10. 최근 본 글 (실제 열람 이력)
- [x] `Claude`   [x] `검수`
- 시도 이력:
  - 1~4차 (2026-06-24): 공용 사이드바·빈 상태 안내 → 여전히 안 나옴.
  - 5차 (2026-06-26): 진짜 원인 = "최근 본 글"이 실제 열람 이력이 아니라 각 게시판이 자기 목록 일부를 prop으로 넣던 가짜. → `RecentViewedTracker`(상세 진입 시 localStorage 기록)+`RecentViewedPanel`(읽어 렌더) 신설, BoardSidebar가 Panel 사용(전 게시판 동일), 15개 상세 페이지에 Tracker 추가. → ✅ Playwright: automation·vibe 글 열람 후 /monetize 사이드바에 두 글 모두 표시.